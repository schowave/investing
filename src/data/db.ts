// SQLite-Zugriff für Stammdaten, Kurse, Wechselkurse und Fundamentaldaten.

import { DatabaseSync } from "node:sqlite";

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
}

export interface Price {
  date: string;
  /** Schlusskurs in der Hauptwährung (bereits durch den Divisor geteilt). */
  close: number;
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
  is_financial INTEGER NOT NULL DEFAULT 0
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
CREATE TABLE IF NOT EXISTS raw_documents (
  stock_id TEXT NOT NULL REFERENCES stocks(id),
  kind TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (stock_id, kind)
);
`;

export class Database {
  readonly #db: DatabaseSync;

  /** `path` ist eine Datei oder `:memory:`. */
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec("PRAGMA foreign_keys = ON");
    this.#db.exec(SCHEMA);
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
           price_divisor, founded_year, is_financial)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      )
      .run(
        stock.id, stock.name, stock.sector, stock.region, stock.country, stock.reportingCurrency,
        stock.priceCurrency, stock.priceDivisor, stock.foundedYear, stock.isFinancial ? 1 : 0,
      );
  }

  stocks(): Stock[] {
    const rows = this.#db.prepare("SELECT * FROM stocks ORDER BY id").all() as Record<string, unknown>[];
    return rows.map((r) => ({
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
    }));
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

  /** Bewahrt die unveränderte Antwort eines Anbieters auf; je Aktie und Art gilt die jüngste. */
  saveRawDocument(stockId: string, kind: string, body: string): void {
    this.#db
      .prepare(
        `INSERT INTO raw_documents (stock_id, kind, fetched_at, body) VALUES (?, ?, ?, ?)
         ON CONFLICT (stock_id, kind) DO UPDATE SET fetched_at = excluded.fetched_at, body = excluded.body`,
      )
      .run(stockId, kind, new Date().toISOString(), body);
  }

  rawDocument(stockId: string, kind: string): { fetchedAt: string; body: string } | null {
    const row = this.#db
      .prepare("SELECT fetched_at, body FROM raw_documents WHERE stock_id = ? AND kind = ?")
      .get(stockId, kind) as { fetched_at: string; body: string } | undefined;
    return row ? { fetchedAt: row.fetched_at, body: row.body } : null;
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
