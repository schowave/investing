// Datenbankschema für Drizzle. Quelle der Wahrheit für Tabellen und Spalten: Änderungen hier, dann
// `mise run db:generate <name>` erzeugt die Migration in db/migrations. Nie Tabellen im Code anlegen.

import { blob, index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const stocks = sqliteTable(
  "stocks",
  {
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
    /** Sektor nach GICS laut Anbieter, z. B. "Real Estate". Strenger als `sector`, der Anleihen von Versorgern als REIT führt. */
    gicSector: text("gic_sector"),
    /** ISIN laut Anbieter oder aus der Aufnahme über die ISIN; ordnet Positionen aus dem Depot zu. Mehrere Notizen können sie teilen. */
    isin: text("isin"),
    /** Letzter Kurstag eines eingestellten Titels (Übernahme, Insolvenz, Rückzug). Nur der Rückblick lädt solche Titel; Abgleich und Bewertung überspringen sie. */
    delistedOn: text("delisted_on"),
  },
  (t) => [index("stocks_isin").on(t.isin)],
);

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
  /** Depot bei der comdirect (`depotId` der Bank), aus dem der Bestand übernommen wird; `null`, solange keines gewählt ist. */
  comdirectDepotId: text("comdirect_depot_id"),
  /** Kandidaten des Zielportfolios: "watchlist" (Strategie 7.1) oder "bestand" (nur gehaltene Titel, z. B. ein Wikifolio). */
  selection: text("selection").notNull().default("watchlist"),
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

/** Titel, deren Kurs sich nicht abrufen ließ (eingestellt, Symbol unbekannt). Der Abgleich versucht sie seltener erneut. */
export const priceFailures = sqliteTable("price_failures", {
  stockId: stockId().primaryKey(),
  failedAt: text("failed_at").notNull(),
  attempts: integer("attempts").notNull(),
  error: text("error").notNull(),
});

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

/** Jüngste Vorschläge von Jev für die Urteilsfaktoren einer Aktie, mit Recherche und Quellen. */
export const judgements = sqliteTable("judgements", {
  stockId: text("stock_id")
    .primaryKey()
    .references(() => stocks.id),
  createdAt: text("created_at").notNull(),
  jevModel: text("jev_model").notNull(),
  researchModel: text("research_model"),
  research: text("research"),
  /** Tag der Recherche (YYYY-MM-DD); älter als `createdAt`, wenn eine gespeicherte Recherche wiederverwendet wurde. */
  researchedAt: text("researched_at"),
  sources: text("sources", { mode: "json" }).notNull().$type<{ url: string; title: string; pageAge: string | null; kind?: "sec" }[]>(),
  proposals: text("proposals", { mode: "json" })
    .notNull()
    .$type<Record<string, { value: number; confidence: number; probabilities: Record<string, number> }>>(),
  /** Fassung der Stufen (`LEVELS_VERSION`), nach der eingestuft wurde; Vorschläge einer älteren Fassung gelten nicht mehr. */
  levelsVersion: integer("levels_version").notNull().default(1),
});

/** Warteschlange der Hintergrundläufe (Abgleich, Importe). Der Worker arbeitet sie nacheinander ab. */
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    args: text("args", { mode: "json" }).notNull().$type<unknown>(),
    /** queued, running, done, failed, cancelled */
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    /** Gesetzt, wenn jemand den Lauf abbrechen will; der Lauf prüft das zwischen zwei Titeln. */
    cancelRequested: integer("cancel_requested", { mode: "boolean" }).notNull().default(false),
    progressDone: integer("progress_done"),
    progressTotal: integer("progress_total"),
    /** Die letzten Zeilen des Protokolls. */
    log: text("log").notNull().default(""),
    /** Kurze Zusammenfassung oder Fehlermeldung. */
    summary: text("summary"),
  },
  (t) => [index("jobs_status").on(t.status)],
);

/** Einstellungen der Anwendung als Schlüssel und Wert (z. B. ob der nächtliche Abgleich läuft). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Vorwärtsprotokoll: Was die Anwendung zum Monatsanfang als Zielportfolio vorgeschlagen hätte, mit dem Kurs von damals.
 * Daran lässt sich später ohne Rückschaufehler messen, was die Urteile (Jev, Handeingaben) gebracht haben.
 * `arm`: "zahlen" (Datenvorrat, nur Zahlenfaktoren) oder "urteil" (Watchlist mit allen Risikofaktoren, wie in der Anwendung).
 */
export const forwardLog = sqliteTable(
  "forward_log",
  {
    date: text("date").notNull(),
    arm: text("arm").notNull(),
    profile: text("profile").notNull(),
    stockId: stockId(),
    /** Anteil am Portfolio; der Rest zu 1 ist Bargeld. */
    weight: real("weight").notNull(),
    innerReturn: real("inner_return").notNull(),
    riskScore: real("risk_score").notNull(),
    /** Kurs in Euro am Tag des Eintrags. */
    priceEur: real("price_eur").notNull(),
    calcVersion: integer("calc_version").notNull(),
    /**
     * Version der Strategie (`docs/STRATEGIE.md`), nach der das Zielportfolio entstand. Einträge aus der Zeit vor dieser Spalte
     * tragen "1.0" (Vorbehalt in `docs/STRATEGIE-AENDERUNGEN.md`).
     */
    strategyVersion: text("strategy_version").notNull().default("1.0"),
  },
  (t) => [primaryKey({ columns: [t.date, t.arm, t.profile, t.stockId] })],
);

/**
 * Vorwärtsprotokoll, Rangliste: die besten Kandidaten eines Arms zum Monatsanfang nach innerer Rendite (Rang 1 ist der beste), mit
 * den Werten von damals. Anders als `forward_log` nicht nur das Portfolio, sondern auch die Titel dahinter; so lässt sich später das
 * Ranking messen, nicht nur die Auswahl. Gilt für beide Profile (die Rangfolge der Strategie hängt nicht vom Profil ab).
 */
export const forwardRanking = sqliteTable(
  "forward_ranking",
  {
    date: text("date").notNull(),
    arm: text("arm").notNull(),
    rank: integer("rank").notNull(),
    stockId: stockId(),
    innerReturn: real("inner_return").notNull(),
    riskScore: real("risk_score").notNull(),
    sector: text("sector").notNull(),
    region: text("region").notNull(),
    /** Kurs in Euro am Tag des Eintrags. */
    priceEur: real("price_eur").notNull(),
    calcVersion: integer("calc_version").notNull(),
    strategyVersion: text("strategy_version").notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.arm, t.stockId] })],
);
