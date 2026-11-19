// Datenbankschema für Drizzle. Quelle der Wahrheit für Tabellen und Spalten: Änderungen hier, dann
// `mise run db:generate <name>` erzeugt die Migration in db/migrations. Nie Tabellen im Code anlegen.

import { blob, index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stocks = sqliteTable("stocks", {
  /** EODHD-Symbol, z. B. IMB.LSE. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  region: text("region").notNull(),
  country: text("country").notNull(),
  reportingCurrency: text("reporting_currency").notNull(),
  priceCurrency: text("price_currency").notNull(),
  priceDivisor: real("price_divisor").notNull().default(1),
  foundedYear: integer("founded_year"),
  isFinancial: integer("is_financial", { mode: "boolean" }).notNull().default(false),
  watched: integer("watched", { mode: "boolean" }).notNull().default(true),
  /** Art des Wertpapiers laut Anbieter, z. B. "Common Stock". */
  securityType: text("security_type"),
});

const stockId = () =>
  text("stock_id")
    .notNull()
    .references(() => stocks.id);

export const prices = sqliteTable(
  "prices",
  {
    stockId: stockId(),
    date: text("date").notNull(),
    /** Rohkurs, wie der Anbieter ihn liefert (bei London in Pence). */
    close: real("close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.date] })],
);

export const fxRates = sqliteTable(
  "fx_rates",
  {
    date: text("date").notNull(),
    currency: text("currency").notNull(),
    perEur: real("per_eur").notNull(),
  },
  // latestFxRate sucht je Währung den jüngsten Tag; der Primärschlüssel beginnt mit dem Datum.
  (t) => [primaryKey({ columns: [t.date, t.currency] }), index("fx_rates_currency_date").on(t.currency, t.date)],
);

export const fundamentals = sqliteTable(
  "fundamentals",
  {
    stockId: stockId(),
    fiscalYear: integer("fiscal_year").notNull(),
    epsDiluted: real("eps_diluted"),
    dividendPerShare: real("dividend_per_share"),
    shares: real("shares"),
    repurchases: real("repurchases"),
    issuance: real("issuance"),
    stockBasedCompensation: real("stock_based_compensation"),
    revenue: real("revenue"),
    ebit: real("ebit"),
    totalAssets: real("total_assets"),
    equity: real("equity"),
    currentAssets: real("current_assets"),
    currentLiabilities: real("current_liabilities"),
    longTermDebt: real("long_term_debt"),
    cash: real("cash"),
    operatingCashFlow: real("operating_cash_flow"),
    freeCashFlow: real("free_cash_flow"),
    netDebt: real("net_debt"),
    interestExpense: real("interest_expense"),
    ebitda: real("ebitda"),
    source: text("source").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.fiscalYear] })],
);

export const manualInputs = sqliteTable(
  "manual_inputs",
  {
    stockId: stockId(),
    key: text("key").notNull(),
    value: real("value").notNull(),
    note: text("note").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.key] })],
);

export const valuations = sqliteTable(
  "valuations",
  {
    stockId: stockId(),
    date: text("date").notNull(),
    complete: integer("complete", { mode: "boolean" }).notNull(),
    price: real("price"),
    riskScore: real("risk_score").notNull(),
    innerReturn: real("inner_return"),
    innerReturnCautious: real("inner_return_cautious"),
    innerReturnOptimistic: real("inner_return_optimistic"),
    details: text("details", { mode: "json" }).notNull().$type<unknown>(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.date] })],
);

export const portfolios = sqliteTable("portfolios", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  profile: text("profile").notNull(),
  cashEur: real("cash_eur").notNull().default(0),
  otherEur: real("other_eur").notNull().default(0),
});

const portfolioId = () =>
  integer("portfolio_id")
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" });

export const holdings = sqliteTable(
  "holdings",
  {
    portfolioId: portfolioId(),
    stockId: stockId(),
    shares: real("shares").notNull(),
  },
  (t) => [primaryKey({ columns: [t.portfolioId, t.stockId] })],
);

export const portfolioSnapshots = sqliteTable(
  "portfolio_snapshots",
  {
    portfolioId: portfolioId(),
    date: text("date").notNull(),
    totalEur: real("total_eur").notNull(),
    details: text("details", { mode: "json" }).notNull().$type<unknown>(),
  },
  (t) => [primaryKey({ columns: [t.portfolioId, t.date] })],
);

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  finishedAt: text("finished_at").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  report: text("report", { mode: "json" }).notNull().$type<unknown>(),
});

export const screening = sqliteTable(
  "screening",
  {
    stockId: text("stock_id")
      .primaryKey()
      .references(() => stocks.id),
    date: text("date").notNull(),
    priceDate: text("price_date"),
    price: real("price"),
    payoutLevel: real("payout_level"),
    growth: real("growth"),
    riskScore: real("risk_score").notNull(),
    innerReturn: real("inner_return"),
    implausible: integer("implausible", { mode: "boolean" }).notNull().default(false),
  },
  // Die Rangliste im Datenvorrat sortiert nach innerer Rendite und braucht nur die ersten Treffer.
  (t) => [index("screening_inner_return").on(t.innerReturn)],
);

export const referenceRates = sqliteTable("reference_rates", {
  key: text("key").primaryKey(),
  value: real("value").notNull(),
  date: text("date").notNull(),
});

export const dividends = sqliteTable(
  "dividends",
  {
    stockId: stockId(),
    date: text("date").notNull(),
    value: real("value").notNull(),
    currency: text("currency").notNull(),
    period: text("period").notNull().default(""),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.date] })],
);

export const splits = sqliteTable(
  "splits",
  {
    stockId: stockId(),
    date: text("date").notNull(),
    ratio: real("ratio").notNull(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.date] })],
);

export const monthlyPrices = sqliteTable(
  "monthly_prices",
  {
    stockId: stockId(),
    month: text("month").notNull(),
    date: text("date").notNull(),
    close: real("close").notNull(),
    adjustedClose: real("adjusted_close").notNull(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.month] })],
);

export const historyLoaded = sqliteTable(
  "history_loaded",
  {
    stockId: stockId(),
    kind: text("kind").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  // stockIdsWithHistory fragt nach der Art; der Primärschlüssel beginnt mit der Aktie.
  (t) => [primaryKey({ columns: [t.stockId, t.kind] }), index("history_loaded_kind").on(t.kind)],
);

export const rawDocuments = sqliteTable(
  "raw_documents",
  {
    stockId: stockId(),
    kind: text("kind").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    /** gzip-gepackte Antwort des Anbieters. */
    body: blob("body", { mode: "buffer" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.stockId, t.kind] }), index("raw_documents_kind").on(t.kind)],
);
