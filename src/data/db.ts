// SQLite-Zugriff für Stammdaten, Kurse, Wechselkurse und Fundamentaldaten, über Drizzle (Schema: schema.ts).

import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import { and, asc, count, desc, eq, isNull, lte, max, or, type SQL, sql } from "drizzle-orm";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrateDatabase } from "./migrate.ts";
import * as t from "./schema.ts";

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
  "netDebt",
  "interestExpense",
  "ebitda",
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
  /** Wert der Anlagen, die die Strategie nicht bewertet (Fonds, Anleihen, ETF), in Euro. */
  otherEur: number;
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

/** Vorschläge von Jev für die Urteilsfaktoren einer Aktie, mit den Belegen dazu. */
export interface StoredJudgement {
  createdAt: string;
  jevModel: string;
  /** `null`, wenn ohne Recherche im Netz eingestuft wurde. */
  researchModel: string | null;
  research: string | null;
  /** Quellen der Recherche und, mit `kind: "sec"`, die Mitteilungen an die SEC (`pageAge` ist dann das Datum). */
  sources: { url: string; title: string; pageAge: string | null; kind?: "sec" }[];
  /** Je Faktor (z. B. "moat"): Abzug, Sicherheit und Wahrscheinlichkeit je Stufe. */
  proposals: Record<string, { value: number; confidence: number; probabilities: Record<string, number> }>;
}

type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

/** Ein Hintergrundlauf aus der Warteschlange (src/jobs/). */
export interface Job {
  id: number;
  kind: string;
  args: unknown;
  status: JobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequested: boolean;
  progressDone: number | null;
  progressTotal: number | null;
  log: string;
  summary: string | null;
}

const toJob = (row: typeof t.jobs.$inferSelect): Job => ({ ...row, status: row.status as JobStatus });

export const toColumn = (field: string) => field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Wert der neuen Zeile in `ON CONFLICT … DO UPDATE SET`. */
const excluded = (column: { name: string }) => sql.raw(`excluded."${column.name}"`);

/** Muster für LIKE: Teilwort, Platzhalterzeichen der Eingabe gelten wörtlich (mit ESCAPE '\'). */
const containing = (query: string) => `%${query.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const likeEscaped = (column: SQL.Aliased | typeof t.stocks.name | typeof t.stocks.id, pattern: string) =>
  sql`${column} LIKE ${pattern} ESCAPE '\\'`;

type StockRow = typeof t.stocks.$inferSelect;
type PortfolioRow = typeof t.portfolios.$inferSelect;

function toStock(r: StockRow): Stock {
  return {
    id: r.id,
    name: r.name,
    sector: r.sector,
    region: r.region,
    country: r.country,
    reportingCurrency: r.reportingCurrency,
    priceCurrency: r.priceCurrency,
    priceDivisor: r.priceDivisor,
    foundedYear: r.foundedYear,
    isFinancial: r.isFinancial,
    watched: r.watched,
  };
}

function toPortfolio(r: PortfolioRow): Portfolio {
  return {
    id: r.id,
    name: r.name,
    profile: r.profile === "global" ? "global" : "fokussiert",
    cashEur: r.cashEur,
    otherEur: r.otherEur,
  };
}

const GZIP_MAGIC = [0x1f, 0x8b];
const isGzip = (body: Uint8Array) => body[0] === GZIP_MAGIC[0] && body[1] === GZIP_MAGIC[1];

export class Database {
  readonly #client: DatabaseSync;
  readonly #db: NodeSQLiteDatabase<typeof t>;

  /** `path` ist eine Datei oder `:memory:`. */
  constructor(path: string) {
    this.#client = new DatabaseSync(path);
    this.#client.exec("PRAGMA foreign_keys = ON");
    // Oberfläche und Abgleich greifen gleichzeitig zu: Schreibsperren abwarten statt abzubrechen, und mit
    // Schreibprotokoll (WAL) blockiert ein laufender Abgleich das Lesen nicht.
    this.#client.exec("PRAGMA busy_timeout = 10000");
    if (path !== ":memory:") this.#client.exec("PRAGMA journal_mode = WAL");
    this.#db = drizzle({ client: this.#client, schema: t });
    // Offene Migrationen aus db/migrations anwenden, auch für ":memory:" in Tests.
    migrateDatabase(this.#db);
  }

  close(): void {
    this.#client.close();
  }

  /** Konsistente Kopie der ganzen Datenbank in eine neue Datei (auch während andere schreiben). */
  backupTo(path: string): void {
    this.#client.prepare("VACUUM INTO ?").run(path);
  }

  /** Legt eine Aktie an; vorhandene Einträge bleiben unverändert. */
  addStockIfMissing(stock: Stock): void {
    this.#db.insert(t.stocks).values(stock).onConflictDoNothing().run();
  }

  /** Ohne Angabe nur die Watchlist; mit `includeStockpile` auch der Datenvorrat. */
  stocks(options: { includeStockpile?: boolean } = {}): Stock[] {
    return this.#db
      .select()
      .from(t.stocks)
      .where(options.includeStockpile ? undefined : eq(t.stocks.watched, true))
      .orderBy(t.stocks.id)
      .all()
      .map(toStock);
  }

  stock(id: string): Stock | null {
    const row = this.#db.select().from(t.stocks).where(eq(t.stocks.id, id)).get();
    return row ? toStock(row) : null;
  }

  /** Nimmt eine Aktie auf die Watchlist oder legt sie zurück in den Datenvorrat. */
  setWatched(id: string, watched: boolean): void {
    this.#db.update(t.stocks).set({ watched }).where(eq(t.stocks.id, id)).run();
  }

  /** Sucht in Watchlist und Datenvorrat nach Name oder Symbol (Teilwort, Groß- und Kleinschreibung egal). */
  searchStocks(query: string, limit: number): StockSearchHit[] {
    const pattern = containing(query);
    const fiscalYears = this.#db.select({ n: count() }).from(t.fundamentals).where(eq(t.fundamentals.stockId, t.stocks.id));
    return this.#db
      .select({ stock: t.stocks, fiscalYears: sql<number>`(${fiscalYears})` })
      .from(t.stocks)
      .where(or(likeEscaped(t.stocks.name, pattern), likeEscaped(t.stocks.id, pattern)))
      .orderBy(desc(t.stocks.watched), t.stocks.name)
      .limit(limit)
      .all()
      .map((r) => ({ stock: toStock(r.stock), fiscalYears: Number(r.fiscalYears) }));
  }

  createPortfolio(name: string, profile: ProfileName): number {
    return this.#db.insert(t.portfolios).values({ name, profile }).returning({ id: t.portfolios.id }).get().id;
  }

  portfolios(): Portfolio[] {
    return this.#db.select().from(t.portfolios).orderBy(t.portfolios.name).all().map(toPortfolio);
  }

  portfolio(id: number): Portfolio | null {
    const row = this.#db.select().from(t.portfolios).where(eq(t.portfolios.id, id)).get();
    return row ? toPortfolio(row) : null;
  }

  deletePortfolio(id: number): void {
    this.#db.delete(t.portfolios).where(eq(t.portfolios.id, id)).run();
  }

  setCash(portfolioId: number, cashEur: number): void {
    this.#db.update(t.portfolios).set({ cashEur }).where(eq(t.portfolios.id, portfolioId)).run();
  }

  setOtherAssets(portfolioId: number, otherEur: number): void {
    this.#db.update(t.portfolios).set({ otherEur }).where(eq(t.portfolios.id, portfolioId)).run();
  }

  /** Setzt die Stückzahl einer Position; 0 entfernt sie. */
  setHolding(portfolioId: number, stockId: string, shares: number): void {
    if (shares === 0) {
      this.#db
        .delete(t.holdings)
        .where(and(eq(t.holdings.portfolioId, portfolioId), eq(t.holdings.stockId, stockId)))
        .run();
      return;
    }
    this.#db
      .insert(t.holdings)
      .values({ portfolioId, stockId, shares })
      .onConflictDoUpdate({ target: [t.holdings.portfolioId, t.holdings.stockId], set: { shares } })
      .run();
  }

  /** Stückzahlen je Aktie. */
  holdings(portfolioId: number): Map<string, number> {
    const rows = this.#db
      .select({ stockId: t.holdings.stockId, shares: t.holdings.shares })
      .from(t.holdings)
      .where(eq(t.holdings.portfolioId, portfolioId))
      .all();
    return new Map(rows.map((r) => [r.stockId, r.shares]));
  }

  /** Trägt einen Kurs in der Hauptwährung von Hand ein (z. B. Pfund, nicht Pence). */
  saveManualPrice(stockId: string, date: string, close: number): void {
    const stock = this.stock(stockId);
    if (!stock) throw new Error(`Unbekannte Aktie ${stockId}`);
    this.saveRawCloses(stockId, [{ date, close: close * stock.priceDivisor }]);
  }

  /** Speichert Rohkurse, wie der Anbieter sie liefert (bei London in Pence). */
  saveRawCloses(stockId: string, closes: readonly { date: string; close: number }[]): void {
    if (closes.length === 0) return;
    this.#db.transaction((tx) => {
      for (const c of closes) {
        tx.insert(t.prices)
          .values({ stockId, date: c.date, close: c.close })
          .onConflictDoUpdate({ target: [t.prices.stockId, t.prices.date], set: { close: c.close } })
          .run();
      }
    });
  }

  latestPrice(stockId: string): Price | null {
    const row = this.#db
      .select({ date: t.prices.date, close: sql<number>`${t.prices.close} / ${t.stocks.priceDivisor}` })
      .from(t.prices)
      .innerJoin(t.stocks, eq(t.stocks.id, t.prices.stockId))
      .where(eq(t.prices.stockId, stockId))
      .orderBy(desc(t.prices.date))
      .limit(1)
      .get();
    return row ? { date: row.date, close: row.close } : null;
  }

  saveFxRates(date: string, perEur: Readonly<Record<string, number>>): void {
    this.#db.transaction((tx) => {
      for (const [currency, rate] of Object.entries(perEur)) {
        tx.insert(t.fxRates)
          .values({ date, currency, perEur: rate })
          .onConflictDoUpdate({ target: [t.fxRates.date, t.fxRates.currency], set: { perEur: rate } })
          .run();
      }
    });
  }

  /** Einheiten der Währung je Euro am letzten verfügbaren Tag; `null`, wenn kein Kurs vorliegt. */
  latestFxRate(currency: string): number | null {
    if (currency === "EUR") return 1;
    const row = this.#db
      .select({ perEur: t.fxRates.perEur })
      .from(t.fxRates)
      .where(eq(t.fxRates.currency, currency))
      .orderBy(desc(t.fxRates.date))
      .limit(1)
      .get();
    return row ? row.perEur : null;
  }

  saveFundamentals(stockId: string, years: readonly FundamentalsYear[], source: FundamentalsSource): void {
    const updatedAt = new Date().toISOString();
    const set = Object.fromEntries(
      [...FUNDAMENTAL_FIELDS, "source", "updatedAt"].map((field) => [field, excluded(t.fundamentals[field as FundamentalField])]),
    );
    this.#db.transaction((tx) => {
      for (const year of years) {
        tx.insert(t.fundamentals)
          .values({ ...year, stockId, source, updatedAt })
          .onConflictDoUpdate({ target: [t.fundamentals.stockId, t.fundamentals.fiscalYear], set })
          .run();
      }
    });
  }

  /** Setzt einen manuellen Wert für eine Eingabe (Rückfluss, Wachstum oder Risikofaktor). */
  setManualInput(stockId: string, key: string, value: number, note = ""): void {
    const updatedAt = new Date().toISOString();
    this.#db
      .insert(t.manualInputs)
      .values({ stockId, key, value, note, updatedAt })
      .onConflictDoUpdate({ target: [t.manualInputs.stockId, t.manualInputs.key], set: { value, note, updatedAt } })
      .run();
  }

  /** Entfernt den manuellen Wert; danach gilt wieder der Vorschlag. */
  clearManualInput(stockId: string, key: string): void {
    this.#db
      .delete(t.manualInputs)
      .where(and(eq(t.manualInputs.stockId, stockId), eq(t.manualInputs.key, key)))
      .run();
  }

  manualInputs(stockId: string): ManualInput[] {
    return this.#db
      .select({ key: t.manualInputs.key, value: t.manualInputs.value, note: t.manualInputs.note, updatedAt: t.manualInputs.updatedAt })
      .from(t.manualInputs)
      .where(eq(t.manualInputs.stockId, stockId))
      .orderBy(t.manualInputs.key)
      .all();
  }

  /** Speichert den Tagesstand einer Bewertung; je Aktie und Tag gilt der letzte. */
  saveValuation(stockId: string, date: string, valuation: StoredValuation): void {
    const values = {
      complete: valuation.complete,
      price: valuation.price,
      riskScore: valuation.riskScore,
      innerReturn: valuation.innerReturn,
      innerReturnCautious: valuation.innerReturnCautious,
      innerReturnOptimistic: valuation.innerReturnOptimistic,
      details: valuation.details,
    };
    this.#db
      .insert(t.valuations)
      .values({ stockId, date, ...values })
      .onConflictDoUpdate({ target: [t.valuations.stockId, t.valuations.date], set: values })
      .run();
  }

  latestValuation(stockId: string): (StoredValuation & { date: string }) | null {
    const row = this.#db
      .select()
      .from(t.valuations)
      .where(eq(t.valuations.stockId, stockId))
      .orderBy(desc(t.valuations.date))
      .limit(1)
      .get();
    if (!row) return null;
    const { stockId: _, ...valuation } = row;
    return valuation;
  }

  /** Gespeicherte Tagesstände einer Aktie, jüngster zuerst. */
  valuationHistory(
    stockId: string,
    limit: number,
  ): { date: string; price: number | null; riskScore: number; innerReturn: number | null; complete: boolean }[] {
    return this.#db
      .select({
        date: t.valuations.date,
        price: t.valuations.price,
        riskScore: t.valuations.riskScore,
        innerReturn: t.valuations.innerReturn,
        complete: t.valuations.complete,
      })
      .from(t.valuations)
      .where(eq(t.valuations.stockId, stockId))
      .orderBy(desc(t.valuations.date))
      .limit(limit)
      .all();
  }

  /** Speichert den Tagesstand eines Portfolios (Ist, Ziel, Vorschläge); je Portfolio und Tag gilt der letzte. */
  savePortfolioSnapshot(portfolioId: number, date: string, totalEur: number, details: unknown): void {
    this.#db
      .insert(t.portfolioSnapshots)
      .values({ portfolioId, date, totalEur, details })
      .onConflictDoUpdate({ target: [t.portfolioSnapshots.portfolioId, t.portfolioSnapshots.date], set: { totalEur, details } })
      .run();
  }

  portfolioSnapshots(portfolioId: number, limit: number): { date: string; totalEur: number; details: unknown }[] {
    return this.#db
      .select({ date: t.portfolioSnapshots.date, totalEur: t.portfolioSnapshots.totalEur, details: t.portfolioSnapshots.details })
      .from(t.portfolioSnapshots)
      .where(eq(t.portfolioSnapshots.portfolioId, portfolioId))
      .orderBy(desc(t.portfolioSnapshots.date))
      .limit(limit)
      .all();
  }

  saveSyncRun(ok: boolean, report: unknown): void {
    this.#db.insert(t.syncRuns).values({ finishedAt: new Date().toISOString(), ok, report }).run();
  }

  latestSyncRun(): { finishedAt: string; ok: boolean; report: unknown } | null {
    const row = this.#db
      .select({ finishedAt: t.syncRuns.finishedAt, ok: t.syncRuns.ok, report: t.syncRuns.report })
      .from(t.syncRuns)
      .orderBy(desc(t.syncRuns.id))
      .limit(1)
      .get();
    return row ?? null;
  }

  /** Ersetzt die Dividendenhistorie einer Aktie und merkt, dass sie geladen ist (auch wenn sie leer ist). */
  saveDividends(stockId: string, payments: readonly { date: string; value: number; currency: string; period: string }[]): void {
    this.#db.transaction((tx) => {
      tx.delete(t.dividends).where(eq(t.dividends.stockId, stockId)).run();
      for (const p of payments)
        tx.insert(t.dividends)
          .values({ stockId, ...p })
          .onConflictDoUpdate({ target: [t.dividends.stockId, t.dividends.date], set: p })
          .run();
      this.#markLoaded(tx, stockId, "dividends");
    });
  }

  /** Dividendenzahlungen, älteste zuerst; `null`, wenn die Historie nie geladen wurde. */
  dividends(stockId: string): { date: string; value: number; currency: string; period: string }[] | null {
    if (!this.historyLoaded(stockId, "dividends")) return null;
    return this.#db
      .select({ date: t.dividends.date, value: t.dividends.value, currency: t.dividends.currency, period: t.dividends.period })
      .from(t.dividends)
      .where(eq(t.dividends.stockId, stockId))
      .orderBy(t.dividends.date)
      .all();
  }

  saveSplits(stockId: string, splits: readonly { date: string; ratio: number }[]): void {
    this.#db.transaction((tx) => {
      tx.delete(t.splits).where(eq(t.splits.stockId, stockId)).run();
      for (const x of splits)
        tx.insert(t.splits)
          .values({ stockId, ...x })
          .onConflictDoUpdate({ target: [t.splits.stockId, t.splits.date], set: x })
          .run();
      this.#markLoaded(tx, stockId, "splits");
    });
  }

  splits(stockId: string): { date: string; ratio: number }[] {
    return this.#db
      .select({ date: t.splits.date, ratio: t.splits.ratio })
      .from(t.splits)
      .where(eq(t.splits.stockId, stockId))
      .orderBy(t.splits.date)
      .all();
  }

  /** Monatsschlusskurse in der Einheit der Kursnotiz (bei London Pence). */
  saveMonthlyPrices(stockId: string, closes: readonly { date: string; close: number; adjustedClose: number }[]): void {
    this.#db.transaction((tx) => {
      for (const c of closes) {
        const values = { date: c.date, close: c.close, adjustedClose: c.adjustedClose };
        tx.insert(t.monthlyPrices)
          .values({ stockId, month: c.date.slice(0, 7), ...values })
          .onConflictDoUpdate({ target: [t.monthlyPrices.stockId, t.monthlyPrices.month], set: values })
          .run();
      }
      this.#markLoaded(tx, stockId, "monthly_prices");
    });
  }

  monthlyPrices(stockId: string): { month: string; date: string; close: number; adjustedClose: number }[] {
    return this.#db
      .select({
        month: t.monthlyPrices.month,
        date: t.monthlyPrices.date,
        close: t.monthlyPrices.close,
        adjustedClose: t.monthlyPrices.adjustedClose,
      })
      .from(t.monthlyPrices)
      .where(eq(t.monthlyPrices.stockId, stockId))
      .orderBy(t.monthlyPrices.month)
      .all();
  }

  #markLoaded(tx: Pick<NodeSQLiteDatabase<typeof t>, "insert">, stockId: string, kind: string): void {
    const fetchedAt = new Date().toISOString();
    tx.insert(t.historyLoaded)
      .values({ stockId, kind, fetchedAt })
      .onConflictDoUpdate({ target: [t.historyLoaded.stockId, t.historyLoaded.kind], set: { fetchedAt } })
      .run();
  }

  historyLoaded(stockId: string, kind: string): boolean {
    const row = this.#db
      .select({ kind: t.historyLoaded.kind })
      .from(t.historyLoaded)
      .where(and(eq(t.historyLoaded.stockId, stockId), eq(t.historyLoaded.kind, kind)))
      .get();
    return row !== undefined;
  }

  /** Kennungen aller Aktien, für die diese Historie geladen ist. */
  stockIdsWithHistory(kind: string): Set<string> {
    const rows = this.#db.select({ id: t.historyLoaded.stockId }).from(t.historyLoaded).where(eq(t.historyLoaded.kind, kind)).all();
    return new Set(rows.map((r) => r.id));
  }

  /** Bezugsgrößen des Marktes, z. B. `bond:EUR10Y` oder `inflation:KZT`, als Anteil (0.034). */
  setReferenceRate(key: string, value: number, date: string): void {
    this.#db
      .insert(t.referenceRates)
      .values({ key, value, date })
      .onConflictDoUpdate({ target: t.referenceRates.key, set: { value, date } })
      .run();
  }

  referenceRate(key: string): number | null {
    const row = this.#db.select({ value: t.referenceRates.value }).from(t.referenceRates).where(eq(t.referenceRates.key, key)).get();
    return row ? row.value : null;
  }

  /** Datum des jüngsten Kurses je Aktie. */
  latestPriceDates(): Map<string, string> {
    const rows = this.#db
      .select({ stockId: t.prices.stockId, date: max(t.prices.date) })
      .from(t.prices)
      .groupBy(t.prices.stockId)
      .all();
    return new Map(rows.flatMap((r) => (r.date === null ? [] : [[r.stockId, r.date] as const])));
  }

  /** Alle Berichts- und Kurswährungen der gespeicherten Aktien. */
  currencies(): string[] {
    const reporting = this.#db.select({ c: t.stocks.reportingCurrency }).from(t.stocks);
    const quoted = this.#db.select({ c: t.stocks.priceCurrency }).from(t.stocks);
    return reporting
      .union(quoted)
      .all()
      .map((r) => r.c)
      .filter((c) => c !== "");
  }

  saveScreening(rows: readonly ScreeningRow[]): void {
    this.#db.transaction((tx) => {
      for (const { stockId, ...values } of rows) {
        tx.insert(t.screening)
          .values({ stockId, ...values })
          .onConflictDoUpdate({ target: t.screening.stockId, set: values })
          .run();
      }
    });
  }

  /**
   * Titel mit berechenbarer innerer Rendite, höchste zuerst.
   * @param filter `region` und `maxRisk` (Risikowert höchstens) sind optional; `query` sucht in Name und Symbol.
   */
  screening(
    filter: { region?: string; maxRisk?: number; maxReturn?: number; query?: string; includeImplausible?: boolean },
    limit: number,
  ): { stock: Stock; row: ScreeningRow }[] {
    const pattern = filter.query ? containing(filter.query) : null;
    const rows = this.#db
      .select({ stock: t.stocks, row: t.screening })
      .from(t.screening)
      .innerJoin(t.stocks, eq(t.stocks.id, t.screening.stockId))
      .where(
        and(
          sql`${t.screening.innerReturn} IS NOT NULL`,
          // Nur Stammaktien: Vorzugspapiere und Anleihen tragen die Zahlen des Mutterkonzerns.
          or(isNull(t.stocks.securityType), eq(t.stocks.securityType, "Common Stock")),
          filter.includeImplausible ? undefined : eq(t.screening.implausible, false),
          filter.region ? eq(t.stocks.region, filter.region) : undefined,
          filter.maxRisk !== undefined ? lte(t.screening.riskScore, filter.maxRisk) : undefined,
          filter.maxReturn !== undefined ? lte(t.screening.innerReturn, filter.maxReturn) : undefined,
          pattern ? or(likeEscaped(t.stocks.name, pattern), likeEscaped(t.stocks.id, pattern)) : undefined,
        ),
      )
      .orderBy(desc(t.screening.innerReturn))
      .limit(limit)
      .all();
    return rows.map((r) => ({ stock: toStock(r.stock), row: r.row }));
  }

  /** Regionen, für die es Titel gibt. */
  regions(): string[] {
    return this.#db
      .selectDistinct({ region: t.stocks.region })
      .from(t.stocks)
      .orderBy(asc(t.stocks.region))
      .all()
      .map((r) => r.region);
  }

  /** Bewahrt die unveränderte Antwort eines Anbieters auf; je Aktie und Art gilt die jüngste. */
  saveRawDocument(stockId: string, kind: string, body: string): void {
    const values = { fetchedAt: new Date().toISOString(), body: gzipSync(body) };
    this.#db
      .insert(t.rawDocuments)
      .values({ stockId, kind, ...values })
      .onConflictDoUpdate({ target: [t.rawDocuments.stockId, t.rawDocuments.kind], set: values })
      .run();
  }

  /**
   * Stellt einen Lauf in die Warteschlange. Wartet oder läuft schon einer derselben Art mit denselben Parametern,
   * bleibt es bei diesem (kein doppelter Verbrauch des Tagesbudgets durch zweimal Klicken).
   */
  enqueueJob(kind: string, args: unknown): { id: number; existing: boolean } {
    const serialized = JSON.stringify(args);
    return this.#db.transaction((tx) => {
      const same = tx
        .select()
        .from(t.jobs)
        .where(and(eq(t.jobs.kind, kind), or(eq(t.jobs.status, "queued"), eq(t.jobs.status, "running"))))
        .all()
        .find((job) => JSON.stringify(job.args) === serialized);
      if (same) return { id: same.id, existing: true };
      const { id } = tx
        .insert(t.jobs)
        .values({ kind, args, status: "queued", createdAt: new Date().toISOString() })
        .returning({ id: t.jobs.id })
        .get();
      return { id, existing: false };
    });
  }

  job(id: number): Job | null {
    const row = this.#db.select().from(t.jobs).where(eq(t.jobs.id, id)).get();
    return row ? toJob(row) : null;
  }

  /** Jüngste Läufe zuerst. */
  jobs(limit: number): Job[] {
    return this.#db.select().from(t.jobs).orderBy(desc(t.jobs.id)).limit(limit).all().map(toJob);
  }

  /** Laufende und wartende Läufe in der Reihenfolge, in der der Worker sie abarbeitet. */
  activeJobs(): Job[] {
    return this.#db
      .select()
      .from(t.jobs)
      .where(or(eq(t.jobs.status, "running"), eq(t.jobs.status, "queued")))
      .orderBy(asc(t.jobs.id))
      .all()
      .map(toJob);
  }

  /** Nimmt den ältesten wartenden Lauf und markiert ihn als laufend; `null`, wenn keiner wartet. */
  claimNextJob(): Job | null {
    return this.#db.transaction((tx) => {
      const next = tx.select().from(t.jobs).where(eq(t.jobs.status, "queued")).orderBy(asc(t.jobs.id)).limit(1).get();
      if (!next) return null;
      const startedAt = new Date().toISOString();
      tx.update(t.jobs).set({ status: "running", startedAt }).where(eq(t.jobs.id, next.id)).run();
      return toJob({ ...next, status: "running", startedAt });
    });
  }

  updateJobProgress(id: number, progress: { done: number | null; total: number | null; log: string }): void {
    this.#db
      .update(t.jobs)
      .set({ progressDone: progress.done, progressTotal: progress.total, log: progress.log })
      .where(eq(t.jobs.id, id))
      .run();
  }

  finishJob(id: number, status: "done" | "failed" | "cancelled", summary: string, log: string): void {
    this.#db.update(t.jobs).set({ status, summary, log, finishedAt: new Date().toISOString() }).where(eq(t.jobs.id, id)).run();
  }

  /** Ein wartender Lauf entfällt sofort; ein laufender hört beim nächsten Titel auf. */
  requestJobCancel(id: number): void {
    const job = this.job(id);
    if (job?.status === "queued") this.finishJob(id, "cancelled", "abgebrochen, bevor er begann", "");
    else if (job?.status === "running") this.#db.update(t.jobs).set({ cancelRequested: true }).where(eq(t.jobs.id, id)).run();
  }

  isJobCancelRequested(id: number): boolean {
    return this.#db.select({ c: t.jobs.cancelRequested }).from(t.jobs).where(eq(t.jobs.id, id)).get()?.c === true;
  }

  /** Läufe, die bei einem Neustart des Workers mittendrin abbrachen, als gescheitert markieren. Liefert die Anzahl. */
  failOrphanedJobs(): number {
    const orphans = this.#db.select({ id: t.jobs.id }).from(t.jobs).where(eq(t.jobs.status, "running")).all();
    for (const { id } of orphans) {
      this.#db
        .update(t.jobs)
        .set({ status: "failed", summary: "abgebrochen: der Worker wurde neu gestartet", finishedAt: new Date().toISOString() })
        .where(eq(t.jobs.id, id))
        .run();
    }
    return orphans.length;
  }

  /** Speichert die jüngsten Jev-Vorschläge einer Aktie; ältere werden ersetzt. */
  saveJudgement(stockId: string, judgement: StoredJudgement): void {
    this.#db
      .insert(t.judgements)
      .values({ stockId, ...judgement })
      .onConflictDoUpdate({ target: t.judgements.stockId, set: judgement })
      .run();
  }

  judgement(stockId: string): StoredJudgement | null {
    const row = this.#db.select().from(t.judgements).where(eq(t.judgements.stockId, stockId)).get();
    if (!row) return null;
    const { stockId: _, ...judgement } = row;
    return judgement;
  }

  /** Kennungen aller Aktien, zu denen eine Rohantwort dieser Art vorliegt. */
  stockIdsWithRawDocument(kind: string): Set<string> {
    const rows = this.#db.select({ id: t.rawDocuments.stockId }).from(t.rawDocuments).where(eq(t.rawDocuments.kind, kind)).all();
    return new Set(rows.map((r) => r.id));
  }

  rawDocument(stockId: string, kind: string): { fetchedAt: string; body: string } | null {
    // Roh gelesen: ältere Einträge liegen noch als ungepackter Text vor, neue gzip-gepackt.
    const row = this.#client.prepare("SELECT fetched_at, body FROM raw_documents WHERE stock_id = ? AND kind = ?").get(stockId, kind) as
      | { fetched_at: string; body: string | Uint8Array }
      | undefined;
    if (!row) return null;
    const body =
      typeof row.body === "string"
        ? row.body
        : isGzip(row.body)
          ? gunzipSync(row.body).toString("utf8")
          : Buffer.from(row.body).toString("utf8");
    return { fetchedAt: row.fetched_at, body };
  }

  /** Packt Rohantworten, die noch ungepackt gespeichert sind, und gibt den Platz frei. Liefert die Anzahl. */
  compressRawDocuments(): number {
    const pending = this.#client
      .prepare("SELECT stock_id, kind FROM raw_documents WHERE typeof(body) = 'text' OR substr(body, 1, 2) != x'1f8b'")
      .all() as { stock_id: string; kind: string }[];
    for (const { stock_id, kind } of pending) {
      const document = this.rawDocument(stock_id, kind);
      if (document) this.saveRawDocument(stock_id, kind, document.body);
    }
    // Immer: auch Migrationen, die Tabellen neu aufbauen, hinterlassen freie Seiten.
    this.#client.exec("VACUUM");
    return pending.length;
  }

  /** Setzt Land und Region für Titel im Datenvorrat; Stammdaten der Watchlist bleiben unberührt. */
  setSeatInStockpile(id: string, country: string, region: string): void {
    this.#db
      .update(t.stocks)
      .set({ country, region })
      .where(and(eq(t.stocks.id, id), eq(t.stocks.watched, false)))
      .run();
  }

  /** Art des Wertpapiers laut Anbieter, z. B. "Common Stock". */
  setSecurityType(id: string, type: string): void {
    this.#db.update(t.stocks).set({ securityType: type }).where(eq(t.stocks.id, id)).run();
  }

  /** Trägt das Gründungsjahr nach, wenn noch keines gesetzt ist. */
  setFoundedYearIfMissing(id: string, year: number): void {
    this.#db
      .update(t.stocks)
      .set({ foundedYear: year })
      .where(and(eq(t.stocks.id, id), isNull(t.stocks.foundedYear)))
      .run();
  }

  /** Geschäftsjahre einer Aktie, ältestes zuerst. */
  fundamentals(stockId: string): FundamentalsYear[] {
    return this.#db
      .select()
      .from(t.fundamentals)
      .where(eq(t.fundamentals.stockId, stockId))
      .orderBy(t.fundamentals.fiscalYear)
      .all()
      .map((r) => {
        const year = { fiscalYear: r.fiscalYear } as FundamentalsYear;
        for (const field of FUNDAMENTAL_FIELDS) year[field] = r[field];
        return year;
      });
  }
}
