// SQLite-Zugriff für Stammdaten, Kurse, Wechselkurse und Fundamentaldaten.

import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";

export const FUNDAMENTAL_FIELDS = [
  "epsDiluted",
  "dividendPerShare",
  "shares",
  "repurchases",
  "issuance",
  "stockBasedCompensation",
  "revenue",
  "ebit",
  "totalAssets",
  "equity",
  "currentAssets",
  "currentLiabilities",
  "longTermDebt",
  "cash",
  "operatingCashFlow",
  "freeCashFlow",
] as const;

export type FundamentalField = (typeof FUNDAMENTAL_FIELDS)[number];
export type FundamentalsSource = "eodhd" | "sec" | "csv" | "manuell";

export type FundamentalsYear = { fiscalYear: number } & Record<FundamentalField, number | null>;

export interface Stock {
  /** EODHD-Symbol, z. B. IMB.LSE. */
  id: string;
  name: string;
  sector: string;
  region: string;
  country: string;
  reportingCurrency: string;
  priceCurrency: string;
  /** 100, wenn der Kurs in einer Unterwährung notiert (Pence in London), sonst 1. */
  priceDivisor: number;
  foundedYear: number | null;
  /** Bank oder Versicherer: Risikofaktoren 2, 8 und 9 ohne Vorschlag. */
  isFinancial: boolean;
  /** `true`: auf der Watchlist. `false`: nur Datenvorrat für späteres Screening, ohne Kursabgleich. */
  watched: boolean;
}

export interface Price {
  date: string;
  /** Schlusskurs in der Hauptwährung (bereits durch den Divisor geteilt). */
  close: number;
}

export type ProfileName = "fokussiert" | "global";

export interface Portfolio {
  id: number;
  name: string;
  profile: ProfileName;
  /** Barbestand in Euro. */
  cashEur: number;
}

export interface StockSearchHit {
  stock: Stock;
  /** Anzahl gespeicherter Geschäftsjahre. */
  fiscalYears: number;
}

/** Vorläufige Bewertung eines Titels aus den Vorschlägen, ohne Verlauf. */
export interface ScreeningRow {
  stockId: string;
  date: string;
  priceDate: string | null;
  /** Kurs in Berichtswährung. */
  price: number | null;
  payoutLevel: number | null;
  growth: number | null;
  /** Summe der gesetzten Risikofaktoren (Untergrenze). */
  riskScore: number;
  innerReturn: number | null;
  /** Zahlen passen nicht zum Kurs (z. B. Hinterlegungsschein mit anderem Verhältnis). */
  implausible: boolean;
}

export interface ManualInput {
  key: string;
  value: number;
  note: string;
  updatedAt: string;
}

export interface StoredValuation {
  complete: boolean;
  /** Kurs je Aktie in Berichtswährung. */
  price: number | null;
  riskScore: number;
  innerReturn: number | null;
  innerReturnCautious: number | null;
  innerReturnOptimistic: number | null;
  /** Geltende Eingaben, Vorschläge und Hinweise zum Nachvollziehen. */
  details: unknown;
}

export const toColumn = (field: string) => field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stocks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  reporting_currency TEXT NOT NULL,
  price_currency TEXT NOT NULL,
  price_divisor REAL NOT NULL DEFAULT 1,
  founded_year INTEGER,
  is_financial INTEGER NOT NULL DEFAULT 0,
  watched INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS prices (
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  date TEXT NOT NULL,
  close REAL NOT NULL,
  PRIMARY KEY (stock_id, date)
);
CREATE TABLE IF NOT EXISTS fx_rates (
  date TEXT NOT NULL,
  currency TEXT NOT NULL,
  per_eur REAL NOT NULL,
  PRIMARY KEY (date, currency)
);
CREATE TABLE IF NOT EXISTS fundamentals (
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  fiscal_year INTEGER NOT NULL,
  ${FUNDAMENTAL_FIELDS.map((f) => `${toColumn(f)} REAL`).join(",\n  ")},
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (stock_id, fiscal_year)
);
CREATE TABLE IF NOT EXISTS manual_inputs (
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  key TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (stock_id, key)
);
CREATE TABLE IF NOT EXISTS valuations (
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  date TEXT NOT NULL,
  complete INTEGER NOT NULL,
  price REAL,
  risk_score REAL NOT NULL,
  inner_return REAL,
  inner_return_cautious REAL,
  inner_return_optimistic REAL,
  details TEXT NOT NULL,
  PRIMARY KEY (stock_id, date)
);
CREATE TABLE IF NOT EXISTS portfolios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  profile TEXT NOT NULL,
  cash_eur REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS holdings (
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  shares REAL NOT NULL,
  PRIMARY KEY (portfolio_id, stock_id)
);
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_eur REAL NOT NULL,
  details TEXT NOT NULL,
  PRIMARY KEY (portfolio_id, date)
);
CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finished_at TEXT NOT NULL,
  ok INTEGER NOT NULL,
  report TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS screening (
  stock_id TEXT PRIMARY KEY REFERENCES stocks(id),
  date TEXT NOT NULL,
  price_date TEXT,
  price REAL,
  payout_level REAL,
  growth REAL,
  risk_score REAL NOT NULL,
  inner_return REAL,
  implausible INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS raw_documents (
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  kind TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (stock_id, kind)
);
`;

function toStock(r: Record<string, unknown>): Stock {
  return {
    id: String(r.id),
    name: String(r.name),
    sector: String(r.sector),
    region: String(r.region),
    country: String(r.country),
    reportingCurrency: String(r.reporting_currency),
    priceCurrency: String(r.price_currency),
    priceDivisor: Number(r.price_divisor),
    foundedYear: r.founded_year === null ? null : Number(r.founded_year),
    isFinancial: r.is_financial === 1,
    watched: r.watched === 1,
  };
}

function toPortfolio(r: Record<string, unknown>): Portfolio {
  return {
    id: Number(r.id),
    name: String(r.name),
    profile: r.profile === "global" ? "global" : "fokussiert",
    cashEur: Number(r.cash_eur),
  };
}

export class Database {
  readonly #db: DatabaseSync;

  /** `path` ist eine Datei oder `:memory:`. */
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec("PRAGMA foreign_keys = ON");
    // Oberfläche und Abgleich greifen gleichzeitig zu: Schreibsperren abwarten statt abzubrechen, und mit
    // Schreibprotokoll (WAL) blockiert ein laufender Abgleich das Lesen nicht.
    this.#db.exec("PRAGMA busy_timeout = 10000");
    if (path !== ":memory:") this.#db.exec("PRAGMA journal_mode = WAL");
    this.#db.exec(SCHEMA);
    // Datenbanken aus der Zeit vor dem Datenvorrat haben die Spalte noch nicht.
    const columns = this.#db.prepare("PRAGMA table_info(stocks)").all() as { name: string }[];
    if (!columns.some((c) => c.name === "watched")) {
      this.#db.exec("ALTER TABLE stocks ADD COLUMN watched INTEGER NOT NULL DEFAULT 1");
    }
    if (!columns.some((c) => c.name === "security_type")) this.#db.exec("ALTER TABLE stocks ADD COLUMN security_type TEXT");
    const screeningColumns = this.#db.prepare("PRAGMA table_info(screening)").all() as { name: string }[];
    if (!screeningColumns.some((c) => c.name === "implausible")) {
      this.#db.exec("ALTER TABLE screening ADD COLUMN implausible INTEGER NOT NULL DEFAULT 0");
    }
  }

  close(): void {
    this.#db.close();
  }

  #transaction(work: () => void): void {
    this.#db.exec("BEGIN");
    try {
      work();
      this.#db.exec("COMMIT");
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  /** Legt eine Aktie an; vorhandene Einträge bleiben unverändert. */
  addStockIfMissing(stock: Stock): void {
    this.#db
      .prepare(
        `INSERT INTO stocks (id, name, sector, region, country, reporting_currency, price_currency,
           price_divisor, founded_year, is_financial, watched)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      )
      .run(
        stock.id, stock.name, stock.sector, stock.region, stock.country, stock.reportingCurrency,
        stock.priceCurrency, stock.priceDivisor, stock.foundedYear, stock.isFinancial ? 1 : 0,
        stock.watched ? 1 : 0,
      );
  }

  /** Ohne Angabe nur die Watchlist; mit `includeStockpile` auch der Datenvorrat. */
  stocks(options: { includeStockpile?: boolean } = {}): Stock[] {
    const filter = options.includeStockpile ? "" : "WHERE watched = 1";
    const rows = this.#db.prepare(`SELECT * FROM stocks ${filter} ORDER BY id`).all() as Record<string, unknown>[];
    return rows.map(toStock);
  }

  stock(id: string): Stock | null {
    const row = this.#db.prepare("SELECT * FROM stocks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? toStock(row) : null;
  }

  /** Nimmt eine Aktie auf die Watchlist oder legt sie zurück in den Datenvorrat. */
  setWatched(id: string, watched: boolean): void {
    this.#db.prepare("UPDATE stocks SET watched = ? WHERE id = ?").run(watched ? 1 : 0, id);
  }

  /** Sucht in Watchlist und Datenvorrat nach Name oder Symbol (Teilwort, Groß- und Kleinschreibung egal). */
  searchStocks(query: string, limit: number): StockSearchHit[] {
    const pattern = `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = this.#db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM fundamentals f WHERE f.stock_id = s.id) AS fiscal_years
         FROM stocks s WHERE s.name LIKE ? ESCAPE '\\' OR s.id LIKE ? ESCAPE '\\'
         ORDER BY s.watched DESC, s.name LIMIT ?`,
      )
      .all(pattern, pattern, limit) as Record<string, unknown>[];
    return rows.map((r) => ({ stock: toStock(r), fiscalYears: Number(r.fiscal_years) }));
  }

  createPortfolio(name: string, profile: ProfileName): number {
    const result = this.#db.prepare("INSERT INTO portfolios (name, profile) VALUES (?, ?)").run(name, profile);
    return Number(result.lastInsertRowid);
  }

  portfolios(): Portfolio[] {
    const rows = this.#db.prepare("SELECT * FROM portfolios ORDER BY name").all() as Record<string, unknown>[];
    return rows.map(toPortfolio);
  }

  portfolio(id: number): Portfolio | null {
    const row = this.#db.prepare("SELECT * FROM portfolios WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? toPortfolio(row) : null;
  }

  deletePortfolio(id: number): void {
    this.#db.prepare("DELETE FROM portfolios WHERE id = ?").run(id);
  }

  setCash(portfolioId: number, cashEur: number): void {
    this.#db.prepare("UPDATE portfolios SET cash_eur = ? WHERE id = ?").run(cashEur, portfolioId);
  }

  /** Setzt die Stückzahl einer Position; 0 entfernt sie. */
  setHolding(portfolioId: number, stockId: string, shares: number): void {
    if (shares === 0) {
      this.#db.prepare("DELETE FROM holdings WHERE portfolio_id = ? AND stock_id = ?").run(portfolioId, stockId);
      return;
    }
    this.#db
      .prepare(
        `INSERT INTO holdings (portfolio_id, stock_id, shares) VALUES (?, ?, ?)
         ON CONFLICT (portfolio_id, stock_id) DO UPDATE SET shares = excluded.shares`,
      )
      .run(portfolioId, stockId, shares);
  }

  /** Stückzahlen je Aktie. */
  holdings(portfolioId: number): Map<string, number> {
    const rows = this.#db
      .prepare("SELECT stock_id, shares FROM holdings WHERE portfolio_id = ?")
      .all(portfolioId) as { stock_id: string; shares: number }[];
    return new Map(rows.map((r) => [r.stock_id, r.shares]));
  }

  /** Trägt einen Kurs in der Hauptwährung von Hand ein (z. B. Pfund, nicht Pence). */
  saveManualPrice(stockId: string, date: string, close: number): void {
    const stock = this.stock(stockId);
    if (!stock) throw new Error(`Unbekannte Aktie ${stockId}`);
    this.saveRawCloses(stockId, [{ date, close: close * stock.priceDivisor }]);
  }

  /** Speichert Rohkurse, wie der Anbieter sie liefert (bei London in Pence). */
  saveRawCloses(stockId: string, closes: readonly { date: string; close: number }[]): void {
    const statement = this.#db.prepare(
      "INSERT INTO prices (stock_id, date, close) VALUES (?, ?, ?) ON CONFLICT (stock_id, date) DO UPDATE SET close = excluded.close",
    );
    this.#transaction(() => closes.forEach((c) => statement.run(stockId, c.date, c.close)));
  }

  latestPrice(stockId: string): Price | null {
    const row = this.#db
      .prepare(
        `SELECT p.date AS date, p.close / s.price_divisor AS close FROM prices p JOIN stocks s ON s.id = p.stock_id
         WHERE p.stock_id = ? ORDER BY p.date DESC LIMIT 1`,
      )
      .get(stockId) as { date: string; close: number } | undefined;
    return row ? { date: row.date, close: row.close } : null;
  }

  saveFxRates(date: string, perEur: Readonly<Record<string, number>>): void {
    const statement = this.#db.prepare(
      "INSERT INTO fx_rates (date, currency, per_eur) VALUES (?, ?, ?) ON CONFLICT (date, currency) DO UPDATE SET per_eur = excluded.per_eur",
    );
    this.#transaction(() => Object.entries(perEur).forEach(([currency, rate]) => statement.run(date, currency, rate)));
  }

  /** Einheiten der Währung je Euro am letzten verfügbaren Tag; `null`, wenn kein Kurs vorliegt. */
  latestFxRate(currency: string): number | null {
    if (currency === "EUR") return 1;
    const row = this.#db
      .prepare("SELECT per_eur FROM fx_rates WHERE currency = ? ORDER BY date DESC LIMIT 1")
      .get(currency) as { per_eur: number } | undefined;
    return row ? row.per_eur : null;
  }

  saveFundamentals(stockId: string, years: readonly FundamentalsYear[], source: FundamentalsSource): void {
    const columns = FUNDAMENTAL_FIELDS.map(toColumn);
    const statement = this.#db.prepare(
      `INSERT INTO fundamentals (stock_id, fiscal_year, ${columns.join(", ")}, source, updated_at)
       VALUES (?, ?, ${columns.map(() => "?").join(", ")}, ?, ?)
       ON CONFLICT (stock_id, fiscal_year) DO UPDATE SET
         ${columns.map((c) => `${c} = excluded.${c}`).join(", ")}, source = excluded.source, updated_at = excluded.updated_at`,
    );
    const now = new Date().toISOString();
    this.#transaction(() =>
      years.forEach((y) => statement.run(stockId, y.fiscalYear, ...FUNDAMENTAL_FIELDS.map((f) => y[f]), source, now)),
    );
  }

  /** Setzt einen manuellen Wert für eine Eingabe (Rückfluss, Wachstum oder Risikofaktor). */
  setManualInput(stockId: string, key: string, value: number, note = ""): void {
    this.#db
      .prepare(
        `INSERT INTO manual_inputs (stock_id, key, value, note, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (stock_id, key) DO UPDATE SET value = excluded.value, note = excluded.note, updated_at = excluded.updated_at`,
      )
      .run(stockId, key, value, note, new Date().toISOString());
  }

  /** Entfernt den manuellen Wert; danach gilt wieder der Vorschlag. */
  clearManualInput(stockId: string, key: string): void {
    this.#db.prepare("DELETE FROM manual_inputs WHERE stock_id = ? AND key = ?").run(stockId, key);
  }

  manualInputs(stockId: string): ManualInput[] {
    const rows = this.#db
      .prepare("SELECT key, value, note, updated_at FROM manual_inputs WHERE stock_id = ? ORDER BY key")
      .all(stockId) as { key: string; value: number; note: string; updated_at: string }[];
    return rows.map((r) => ({ key: r.key, value: r.value, note: r.note, updatedAt: r.updated_at }));
  }

  /** Speichert den Tagesstand einer Bewertung; je Aktie und Tag gilt der letzte. */
  saveValuation(stockId: string, date: string, valuation: StoredValuation): void {
    this.#db
      .prepare(
        `INSERT INTO valuations (stock_id, date, complete, price, risk_score, inner_return, inner_return_cautious,
           inner_return_optimistic, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (stock_id, date) DO UPDATE SET complete = excluded.complete, price = excluded.price,
           risk_score = excluded.risk_score, inner_return = excluded.inner_return,
           inner_return_cautious = excluded.inner_return_cautious,
           inner_return_optimistic = excluded.inner_return_optimistic, details = excluded.details`,
      )
      .run(
        stockId, date, valuation.complete ? 1 : 0, valuation.price, valuation.riskScore, valuation.innerReturn,
        valuation.innerReturnCautious, valuation.innerReturnOptimistic, JSON.stringify(valuation.details),
      );
  }

  latestValuation(stockId: string): (StoredValuation & { date: string }) | null {
    const row = this.#db
      .prepare("SELECT * FROM valuations WHERE stock_id = ? ORDER BY date DESC LIMIT 1")
      .get(stockId) as Record<string, unknown> | undefined;
    if (!row) return null;
    const optional = (value: unknown) => (value === null ? null : Number(value));
    return {
      date: String(row.date),
      complete: row.complete === 1,
      price: optional(row.price),
      riskScore: Number(row.risk_score),
      innerReturn: optional(row.inner_return),
      innerReturnCautious: optional(row.inner_return_cautious),
      innerReturnOptimistic: optional(row.inner_return_optimistic),
      details: JSON.parse(String(row.details)),
    };
  }

  /** Gespeicherte Tagesstände einer Aktie, jüngster zuerst. */
  valuationHistory(stockId: string, limit: number): { date: string; price: number | null; riskScore: number; innerReturn: number | null; complete: boolean }[] {
    const rows = this.#db
      .prepare("SELECT date, price, risk_score, inner_return, complete FROM valuations WHERE stock_id = ? ORDER BY date DESC LIMIT ?")
      .all(stockId, limit) as { date: string; price: number | null; risk_score: number; inner_return: number | null; complete: number }[];
    return rows.map((r) => ({ date: r.date, price: r.price, riskScore: r.risk_score, innerReturn: r.inner_return, complete: r.complete === 1 }));
  }

  /** Speichert den Tagesstand eines Portfolios (Ist, Ziel, Vorschläge); je Portfolio und Tag gilt der letzte. */
  savePortfolioSnapshot(portfolioId: number, date: string, totalEur: number, details: unknown): void {
    this.#db
      .prepare(
        `INSERT INTO portfolio_snapshots (portfolio_id, date, total_eur, details) VALUES (?, ?, ?, ?)
         ON CONFLICT (portfolio_id, date) DO UPDATE SET total_eur = excluded.total_eur, details = excluded.details`,
      )
      .run(portfolioId, date, totalEur, JSON.stringify(details));
  }

  portfolioSnapshots(portfolioId: number, limit: number): { date: string; totalEur: number; details: unknown }[] {
    const rows = this.#db
      .prepare("SELECT date, total_eur, details FROM portfolio_snapshots WHERE portfolio_id = ? ORDER BY date DESC LIMIT ?")
      .all(portfolioId, limit) as { date: string; total_eur: number; details: string }[];
    return rows.map((r) => ({ date: r.date, totalEur: r.total_eur, details: JSON.parse(r.details) }));
  }

  saveSyncRun(ok: boolean, report: unknown): void {
    this.#db.prepare("INSERT INTO sync_runs (finished_at, ok, report) VALUES (?, ?, ?)").run(new Date().toISOString(), ok ? 1 : 0, JSON.stringify(report));
  }

  latestSyncRun(): { finishedAt: string; ok: boolean; report: unknown } | null {
    const row = this.#db.prepare("SELECT finished_at, ok, report FROM sync_runs ORDER BY id DESC LIMIT 1").get() as
      | { finished_at: string; ok: number; report: string }
      | undefined;
    return row ? { finishedAt: row.finished_at, ok: row.ok === 1, report: JSON.parse(row.report) } : null;
  }

  /** Datum des jüngsten Kurses je Aktie. */
  latestPriceDates(): Map<string, string> {
    const rows = this.#db.prepare("SELECT stock_id, MAX(date) AS date FROM prices GROUP BY stock_id").all() as { stock_id: string; date: string }[];
    return new Map(rows.map((r) => [r.stock_id, r.date]));
  }

  /** Alle Berichts- und Kurswährungen der gespeicherten Aktien. */
  currencies(): string[] {
    const rows = this.#db
      .prepare("SELECT reporting_currency AS c FROM stocks UNION SELECT price_currency FROM stocks")
      .all() as { c: string }[];
    return rows.map((r) => r.c).filter((c) => c !== "");
  }

  saveScreening(rows: readonly ScreeningRow[]): void {
    const statement = this.#db.prepare(
      `INSERT INTO screening (stock_id, date, price_date, price, payout_level, growth, risk_score, inner_return, implausible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (stock_id) DO UPDATE SET date = excluded.date, price_date = excluded.price_date, price = excluded.price,
         payout_level = excluded.payout_level, growth = excluded.growth, risk_score = excluded.risk_score,
         inner_return = excluded.inner_return, implausible = excluded.implausible`,
    );
    this.#transaction(() =>
      rows.forEach((r) => statement.run(r.stockId, r.date, r.priceDate, r.price, r.payoutLevel, r.growth, r.riskScore, r.innerReturn, r.implausible ? 1 : 0)),
    );
  }

  /**
   * Titel mit berechenbarer innerer Rendite, höchste zuerst.
   * @param filter `region` und `maxRisk` (Risikowert höchstens) sind optional; `query` sucht in Name und Symbol.
   */
  screening(filter: { region?: string; maxRisk?: number; maxReturn?: number; query?: string; includeImplausible?: boolean }, limit: number): { stock: Stock; row: ScreeningRow }[] {
    // Nur Stammaktien: Vorzugspapiere und Anleihen tragen die Zahlen des Mutterkonzerns.
    const where = ["c.inner_return IS NOT NULL", "(s.security_type IS NULL OR s.security_type = 'Common Stock')"];
    if (!filter.includeImplausible) where.push("c.implausible = 0");
    const args: (string | number)[] = [];
    if (filter.region) {
      where.push("s.region = ?");
      args.push(filter.region);
    }
    if (filter.maxRisk !== undefined) {
      where.push("c.risk_score <= ?");
      args.push(filter.maxRisk);
    }
    if (filter.maxReturn !== undefined) {
      where.push("c.inner_return <= ?");
      args.push(filter.maxReturn);
    }
    if (filter.query) {
      const pattern = `%${filter.query.trim().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
      where.push("(s.name LIKE ? ESCAPE '\\' OR s.id LIKE ? ESCAPE '\\')");
      args.push(pattern, pattern);
    }
    const rows = this.#db
      .prepare(
        `SELECT s.*, c.date AS c_date, c.price_date, c.price, c.payout_level, c.growth, c.risk_score, c.inner_return, c.implausible
         FROM screening c JOIN stocks s ON s.id = c.stock_id WHERE ${where.join(" AND ")}
         ORDER BY c.inner_return DESC LIMIT ?`,
      )
      .all(...args, limit) as Record<string, unknown>[];
    const optional = (value: unknown) => (value === null ? null : Number(value));
    return rows.map((r) => ({
      stock: toStock(r),
      row: {
        stockId: String(r.id), date: String(r.c_date), priceDate: r.price_date === null ? null : String(r.price_date),
        price: optional(r.price), payoutLevel: optional(r.payout_level), growth: optional(r.growth),
        riskScore: Number(r.risk_score), innerReturn: optional(r.inner_return), implausible: r.implausible === 1,
      },
    }));
  }

  /** Regionen, für die es Titel gibt. */
  regions(): string[] {
    return (this.#db.prepare("SELECT DISTINCT region FROM stocks ORDER BY region").all() as { region: string }[]).map((r) => r.region);
  }

  /** Bewahrt die unveränderte Antwort eines Anbieters auf; je Aktie und Art gilt die jüngste. */
  saveRawDocument(stockId: string, kind: string, body: string): void {
    this.#db
      .prepare(
        `INSERT INTO raw_documents (stock_id, kind, fetched_at, body) VALUES (?, ?, ?, ?)
         ON CONFLICT (stock_id, kind) DO UPDATE SET fetched_at = excluded.fetched_at, body = excluded.body`,
      )
      .run(stockId, kind, new Date().toISOString(), gzipSync(body));
  }

  /** Kennungen aller Aktien, zu denen eine Rohantwort dieser Art vorliegt. */
  stockIdsWithRawDocument(kind: string): Set<string> {
    const rows = this.#db.prepare("SELECT stock_id FROM raw_documents WHERE kind = ?").all(kind) as { stock_id: string }[];
    return new Set(rows.map((r) => r.stock_id));
  }

  rawDocument(stockId: string, kind: string): { fetchedAt: string; body: string } | null {
    const row = this.#db
      .prepare("SELECT fetched_at, body FROM raw_documents WHERE stock_id = ? AND kind = ?")
      .get(stockId, kind) as { fetched_at: string; body: string | Uint8Array } | undefined;
    if (!row) return null;
    // Ältere Einträge liegen noch als Text vor, neue gepackt.
    const body = typeof row.body === "string" ? row.body : gunzipSync(row.body).toString("utf8");
    return { fetchedAt: row.fetched_at, body };
  }

  /** Packt Rohantworten, die noch als Text gespeichert sind, und gibt den Platz frei. Liefert die Anzahl. */
  compressRawDocuments(): number {
    const pending = this.#db.prepare("SELECT stock_id, kind FROM raw_documents WHERE typeof(body) = 'text'").all() as { stock_id: string; kind: string }[];
    const read = this.#db.prepare("SELECT body FROM raw_documents WHERE stock_id = ? AND kind = ?");
    const write = this.#db.prepare("UPDATE raw_documents SET body = ? WHERE stock_id = ? AND kind = ?");
    for (const { stock_id, kind } of pending) {
      const { body } = read.get(stock_id, kind) as { body: string };
      write.run(gzipSync(body), stock_id, kind);
    }
    if (pending.length > 0) this.#db.exec("VACUUM");
    return pending.length;
  }

  /** Art des Wertpapiers laut Anbieter, z. B. "Common Stock". */
  setSecurityType(id: string, type: string): void {
    this.#db.prepare("UPDATE stocks SET security_type = ? WHERE id = ?").run(type, id);
  }

  /** Trägt das Gründungsjahr nach, wenn noch keines gesetzt ist. */
  setFoundedYearIfMissing(id: string, year: number): void {
    this.#db.prepare("UPDATE stocks SET founded_year = ? WHERE id = ? AND founded_year IS NULL").run(year, id);
  }

  /** Geschäftsjahre einer Aktie, ältestes zuerst. */
  fundamentals(stockId: string): FundamentalsYear[] {
    const rows = this.#db
      .prepare("SELECT * FROM fundamentals WHERE stock_id = ? ORDER BY fiscal_year")
      .all(stockId) as Record<string, unknown>[];
    return rows.map((r) => {
      const year = { fiscalYear: Number(r.fiscal_year) } as FundamentalsYear;
      for (const field of FUNDAMENTAL_FIELDS) {
        const value = r[toColumn(field)];
        year[field] = value === null ? null : Number(value);
      }
      return year;
    });
  }
}
