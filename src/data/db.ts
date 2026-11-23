// SQLite-Zugriff für Stammdaten, Kurse, Wechselkurse und Fundamentaldaten, über Drizzle (Schema: schema.ts).

import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import { and, asc, count, desc, eq, gt, inArray, isNull, lte, max, or, type SQL, sql } from "drizzle-orm";
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
  /** Sektor nach GICS laut Anbieter; fehlt bei Titeln ohne Anbieterdaten. */
  gicSector?: string | null;
  /** Art des Wertpapiers laut Anbieter, z. B. "Common Stock"; `null`, wenn unbekannt. */
  securityType?: string | null;
  /** Letzter Kurstag eines eingestellten Titels; nur der Rückblick (`includeDelisted`) kennt solche Titel. */
  delistedOn?: string | null;
  /** ISIN laut Anbieter; `null`, solange sie nicht aus den Abschlüssen gelesen ist. */
  isin?: string | null;
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
  /** Depot bei der comdirect, aus dem der Bestand übernommen wird. */
  comdirectDepotId: string | null;
  /** Symbol des eigenen Wikifolios; gesetzt heißt Bestandsquelle wikifolio, `null` heißt von Hand. */
  wikifolio: string | null;
  /** Letzter erfolgreicher Abgleich mit wikifolio (ISO-Zeitpunkt). */
  syncedAt: string | null;
  /** Kandidaten des Zielportfolios: die Watchlist oder nur die gehaltenen Titel. */
  selection: PortfolioSelection;
}

/** Position eines Wikifolios ohne passende Aktie in der Datenbank. */
export interface UnmatchedPosition {
  isin: string;
  quantity: number;
  /** Einstandswert in Euro; `null`, wenn wikifolio keinen Kaufkurs nennt. */
  valueEur: number | null;
}

/** Bestand eines Wikifolios, wie der Abgleich ihn übernimmt. */
export interface WikifolioState {
  cashEur: number;
  /** Stückzahlen je Aktie. */
  holdings: ReadonlyMap<string, number>;
  unmatched: readonly UnmatchedPosition[];
  syncedAt: string;
}

export type PortfolioSelection = "watchlist" | "bestand";

export interface StockSearchHit {
  stock: Stock;
  /** Anzahl gespeicherter Geschäftsjahre. */
  fiscalYears: number;
}

/** Vorläufige Bewertung eines Titels aus den Vorschlägen, ohne Verlauf. */
/** Jüngstes Geschäftsjahr, dessen Abschluss vorliegen sollte: ab Juni das Vorjahr, davor das Jahr davor. */
export function expectedFiscalYear(today: string): number {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 6 ? year - 1 : year - 2;
}

export interface ScreeningFilter {
  region?: string;
  /** Risikowert höchstens. */
  maxRisk?: number;
  maxReturn?: number;
  /** Suche in Name und Symbol. */
  query?: string;
  includeImplausible?: boolean;
}

/** Warum für einen Titel keine innere Rendite gerechnet werden kann. */
/** Titel einer Börse aus einem Sitzland. */
export interface CoverageRow {
  /** Endung des Symbols, z. B. LSE. */
  exchange: string;
  region: string;
  /** ISO-Code des Sitzlands; leer, wenn unbekannt. */
  country: string;
  stocks: number;
  /** Davon mit innerer Rendite und plausiblen Zahlen. */
  rated: number;
}

export type RatingGap = "kurs-nicht-abrufbar" | "kein-kurs" | "rueckfluss-fehlt" | "rueckfluss-null" | "wachstum-fehlt" | "keine-loesung";

/** Eine Position im Zielportfolio des Vorwärtsprotokolls. */
export interface ForwardLogRow {
  stockId: string;
  weight: number;
  innerReturn: number;
  riskScore: number;
  priceEur: number;
}

export interface ForwardLogEntry extends ForwardLogRow {
  date: string;
  arm: string;
  profile: string;
  calcVersion: number;
  /** Version der Strategie (`docs/STRATEGIE.md`), nach der der Eintrag entstand. */
  strategyVersion: string;
}

/** Ein Rangplatz in der Rangliste des Vorwärtsprotokolls. */
export interface ForwardRankingRow {
  rank: number;
  stockId: string;
  innerReturn: number;
  riskScore: number;
  sector: string;
  region: string;
  priceEur: number;
}

export interface ForwardRankingEntry extends ForwardRankingRow {
  date: string;
  arm: string;
  calcVersion: number;
  strategyVersion: string;
}

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
  /** Tag der Recherche (YYYY-MM-DD); bei Urteilen von vor dieser Spalte `null`, dann gilt `createdAt`. */
  researchedAt: string | null;
  /** Quellen der Recherche und, mit `kind: "sec"`, die Mitteilungen an die SEC (`pageAge` ist dann das Datum). */
  sources: { url: string; title: string; pageAge: string | null; kind?: "sec" }[];
  /** Je Faktor (z. B. "moat"): Abzug, Sicherheit und Wahrscheinlichkeit je Stufe. */
  proposals: Record<string, { value: number; confidence: number; probabilities: Record<string, number> }>;
  /** Fassung der Stufen, nach der eingestuft wurde (`LEVELS_VERSION` in `src/judgement/factors.ts`). */
  levelsVersion: number;
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

/** Schlüssel der Einstellung für den nächtlichen Abgleich. */
const AUTO_SYNC = "auto-sync";

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
    gicSector: r.gicSector,
    securityType: r.securityType,
    delistedOn: r.delistedOn,
    isin: r.isin,
  };
}

function toPortfolio(r: PortfolioRow): Portfolio {
  return {
    id: r.id,
    name: r.name,
    profile: r.profile === "global" ? "global" : "fokussiert",
    cashEur: r.cashEur,
    otherEur: r.otherEur,
    comdirectDepotId: r.comdirectDepotId,
    selection: r.selection === "bestand" ? "bestand" : "watchlist",
    wikifolio: r.wikifolio,
    syncedAt: r.syncedAt,
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

  /**
   * Ohne Angabe nur die Watchlist; mit `includeStockpile` auch der Datenvorrat. Eingestellte Titel (Survivorship-Daten für den
   * Rückblick) gehören nicht zum Datenvorrat und kommen nur mit `includeDelisted`, damit Abgleich und Bewertung sie überspringen.
   */
  stocks(options: { includeStockpile?: boolean; includeDelisted?: boolean } = {}): Stock[] {
    return this.#db
      .select()
      .from(t.stocks)
      .where(
        and(
          options.includeStockpile ? undefined : eq(t.stocks.watched, true),
          options.includeDelisted ? undefined : isNull(t.stocks.delistedOn),
        ),
      )
      .orderBy(t.stocks.id)
      .all()
      .map(toStock);
  }

  stock(id: string): Stock | null {
    const row = this.#db.select().from(t.stocks).where(eq(t.stocks.id, id)).get();
    return row ? toStock(row) : null;
  }

  /** Symbole der eingestellten Titel (Survivorship-Daten); ein neues Listing mit gleichem Kürzel darf sie nicht überschreiben. */
  delistedStockIds(): Set<string> {
    const rows = this.#db.select({ id: t.stocks.id }).from(t.stocks).where(sql`${t.stocks.delistedOn} IS NOT NULL`).all();
    return new Set(rows.map((r) => r.id));
  }

  /** Kennzeichnet einen Titel als eingestellt (letzter Kurstag). */
  setDelistedOn(id: string, date: string): void {
    this.#db.update(t.stocks).set({ delistedOn: date }).where(eq(t.stocks.id, id)).run();
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
      .where(and(isNull(t.stocks.delistedOn), or(likeEscaped(t.stocks.name, pattern), likeEscaped(t.stocks.id, pattern))))
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

  /** Setzt die Bestandsquelle: ein Wikifolio-Symbol oder `null` für Pflege von Hand. Ein Wechsel vergisst den letzten Abgleich. */
  setWikifolio(portfolioId: number, symbol: string | null): void {
    this.#db.transaction((tx) => {
      tx.update(t.portfolios).set({ wikifolio: symbol, syncedAt: null }).where(eq(t.portfolios.id, portfolioId)).run();
      tx.delete(t.unmatchedPositions).where(eq(t.unmatchedPositions.portfolioId, portfolioId)).run();
      tx.delete(t.tradableStocks).where(eq(t.tradableStocks.portfolioId, portfolioId)).run();
      tx.delete(t.tradableLoaded).where(eq(t.tradableLoaded.portfolioId, portfolioId)).run();
    });
  }

  /**
   * Übernimmt den Bestand eines Wikifolios in einem Schritt: Bargeld, Stückzahlen, nicht zugeordnete Positionen. Deren
   * Einstandswert steht danach als sonstige Anlagen im Portfolio; Positionen, die nicht mehr im Wikifolio stehen, verschwinden.
   */
  replaceWithWikifolio(portfolioId: number, state: WikifolioState): void {
    const otherEur = state.unmatched.reduce((sum, p) => sum + (p.valueEur ?? 0), 0);
    this.#db.transaction((tx) => {
      tx.update(t.portfolios)
        .set({ cashEur: state.cashEur, otherEur, syncedAt: state.syncedAt })
        .where(eq(t.portfolios.id, portfolioId))
        .run();
      tx.delete(t.holdings).where(eq(t.holdings.portfolioId, portfolioId)).run();
      for (const [stockId, shares] of state.holdings) {
        if (shares > 0) tx.insert(t.holdings).values({ portfolioId, stockId, shares }).run();
      }
      tx.delete(t.unmatchedPositions).where(eq(t.unmatchedPositions.portfolioId, portfolioId)).run();
      for (const position of state.unmatched)
        tx.insert(t.unmatchedPositions)
          .values({ portfolioId, ...position })
          .run();
    });
  }

  unmatchedPositions(portfolioId: number): UnmatchedPosition[] {
    return this.#db
      .select({ isin: t.unmatchedPositions.isin, quantity: t.unmatchedPositions.quantity, valueEur: t.unmatchedPositions.valueEur })
      .from(t.unmatchedPositions)
      .where(eq(t.unmatchedPositions.portfolioId, portfolioId))
      .orderBy(t.unmatchedPositions.isin)
      .all();
  }

  /** Speichert, welche Aktien im Anlageuniversum eines Wikifolios handelbar sind (ersetzt den vorigen Stand). */
  setTradable(portfolioId: number, stockIds: Iterable<string>, loadedAt: string, isins: number): void {
    this.#db.transaction((tx) => {
      tx.delete(t.tradableStocks).where(eq(t.tradableStocks.portfolioId, portfolioId)).run();
      for (const stockId of new Set(stockIds)) tx.insert(t.tradableStocks).values({ portfolioId, stockId }).run();
      tx.insert(t.tradableLoaded)
        .values({ portfolioId, loadedAt, isins })
        .onConflictDoUpdate({ target: t.tradableLoaded.portfolioId, set: { loadedAt, isins } })
        .run();
    });
  }

  /** Handelbare Aktien eines Wikifolios; `null`, solange das Anlageuniversum nie geladen wurde (dann gilt keine Einschränkung). */
  tradable(portfolioId: number): { stockIds: Set<string>; loadedAt: string; isins: number } | null {
    const loaded = this.#db.select().from(t.tradableLoaded).where(eq(t.tradableLoaded.portfolioId, portfolioId)).get();
    if (!loaded) return null;
    const rows = this.#db
      .select({ stockId: t.tradableStocks.stockId })
      .from(t.tradableStocks)
      .where(eq(t.tradableStocks.portfolioId, portfolioId))
      .all();
    return { stockIds: new Set(rows.map((r) => r.stockId)), loadedAt: loaded.loadedAt, isins: loaded.isins };
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
      tx.delete(t.priceFailures).where(eq(t.priceFailures.stockId, stockId)).run();
      for (const c of closes) {
        tx.insert(t.prices)
          .values({ stockId, date: c.date, close: c.close })
          .onConflictDoUpdate({ target: [t.prices.stockId, t.prices.date], set: { close: c.close } })
          .run();
      }
    });
  }

  /** Merkt, dass ein Kursabruf scheiterte; `attempts` zählt die Fehlschläge in Folge. */
  recordPriceFailure(stockId: string, error: string, at: string): void {
    this.#db
      .insert(t.priceFailures)
      .values({ stockId, failedAt: at, attempts: 1, error })
      .onConflictDoUpdate({
        target: t.priceFailures.stockId,
        set: { failedAt: at, error, attempts: sql`${t.priceFailures.attempts} + 1` },
      })
      .run();
  }

  /** Titel mit gescheitertem Kursabruf: wann zuletzt und wie oft. */
  priceFailures(): Map<string, { failedAt: string; attempts: number }> {
    return new Map(
      this.#db
        .select()
        .from(t.priceFailures)
        .all()
        .map((r) => [r.stockId, { failedAt: r.failedAt, attempts: r.attempts }] as const),
    );
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

  /**
   * Einzelheiten des Tagesstands, der an einem Tag galt: der jüngste bis zu diesem Tag, sonst der erste danach.
   * `null`, wenn es keinen gibt.
   */
  valuationDetailsAsOf(stockId: string, date: string): unknown {
    const pick = (condition: SQL, order: SQL) =>
      this.#db
        .select({ details: t.valuations.details })
        .from(t.valuations)
        .where(and(eq(t.valuations.stockId, stockId), condition))
        .orderBy(order)
        .limit(1)
        .get();
    const row = pick(lte(t.valuations.date, date), desc(t.valuations.date)) ?? pick(gt(t.valuations.date, date), asc(t.valuations.date));
    return row?.details ?? null;
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

  /** Ob der nächtliche Timer den Abgleich einstellt (Standard: ja). Von Hand geht der Abgleich immer. */
  autoSync(): boolean {
    return this.setting(AUTO_SYNC) !== "aus";
  }

  setAutoSync(on: boolean): void {
    this.setSetting(AUTO_SYNC, on ? "an" : "aus");
  }

  /** Wert einer Einstellung; `null`, wenn sie nie gesetzt wurde. */
  setting(key: string): string | null {
    return this.#db.select({ value: t.settings.value }).from(t.settings).where(eq(t.settings.key, key)).get()?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    const updatedAt = new Date().toISOString();
    this.#db
      .insert(t.settings)
      .values({ key, value, updatedAt })
      .onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt } })
      .run();
  }

  referenceRate(key: string): number | null {
    return this.referenceRateEntry(key)?.value ?? null;
  }

  /** Bezugsgröße mit dem Tag, für den sie gilt; `null`, wenn sie nie geladen wurde. */
  referenceRateEntry(key: string): { value: number; date: string } | null {
    return (
      this.#db
        .select({ value: t.referenceRates.value, date: t.referenceRates.date })
        .from(t.referenceRates)
        .where(eq(t.referenceRates.key, key))
        .get() ?? null
    );
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

  /** Bedingungen der Titelsuche im Datenvorrat. Nur Stammaktien: Vorzugspapiere und Anleihen tragen die Zahlen des Mutterkonzerns. */
  #screeningWhere(filter: ScreeningFilter, ...extra: (SQL | undefined)[]): SQL | undefined {
    const pattern = filter.query ? containing(filter.query) : null;
    return and(
      isNull(t.stocks.delistedOn),
      or(isNull(t.stocks.securityType), eq(t.stocks.securityType, "Common Stock")),
      filter.region ? eq(t.stocks.region, filter.region) : undefined,
      pattern ? or(likeEscaped(t.stocks.name, pattern), likeEscaped(t.stocks.id, pattern)) : undefined,
      ...extra,
    );
  }

  #rated(filter: ScreeningFilter): SQL | undefined {
    return this.#screeningWhere(
      filter,
      sql`${t.screening.innerReturn} IS NOT NULL`,
      filter.includeImplausible ? undefined : eq(t.screening.implausible, false),
      filter.maxRisk !== undefined ? lte(t.screening.riskScore, filter.maxRisk) : undefined,
      filter.maxReturn !== undefined ? lte(t.screening.innerReturn, filter.maxReturn) : undefined,
    );
  }

  /**
   * Titel mit berechenbarer innerer Rendite, höchste zuerst.
   * @param filter `region` und `maxRisk` (Risikowert höchstens) sind optional; `query` sucht in Name und Symbol.
   * @param offset Wie viele Treffer übersprungen werden (Blättern).
   */
  screening(filter: ScreeningFilter, limit: number, offset = 0): { stock: Stock; row: ScreeningRow }[] {
    return this.#db
      .select({ stock: t.stocks, row: t.screening })
      .from(t.screening)
      .innerJoin(t.stocks, eq(t.stocks.id, t.screening.stockId))
      .where(this.#rated(filter))
      .orderBy(desc(t.screening.innerReturn), asc(t.stocks.id))
      .limit(limit)
      .offset(offset)
      .all()
      .map((r) => ({ stock: toStock(r.stock), row: r.row }));
  }

  /** Anzahl der Titel, die `screening` ohne Begrenzung liefern würde. */
  countScreening(filter: ScreeningFilter): number {
    return this.#db
      .select({ n: count() })
      .from(t.screening)
      .innerJoin(t.stocks, eq(t.stocks.id, t.screening.stockId))
      .where(this.#rated(filter))
      .get()!.n;
  }

  /** Warum eine Rendite fehlt, in der Reihenfolge der Prüfung. */
  static readonly #gapSql = sql<RatingGap>`CASE
    WHEN ${t.screening.price} IS NULL AND EXISTS (SELECT 1 FROM ${t.priceFailures} WHERE ${t.priceFailures.stockId} = ${t.screening.stockId}) THEN 'kurs-nicht-abrufbar'
    WHEN ${t.screening.price} IS NULL THEN 'kein-kurs'
    WHEN ${t.screening.payoutLevel} IS NULL THEN 'rueckfluss-fehlt'
    WHEN ${t.screening.payoutLevel} <= 0 THEN 'rueckfluss-null'
    WHEN ${t.screening.growth} IS NULL THEN 'wachstum-fehlt'
    ELSE 'keine-loesung' END`;

  /** Titel ohne berechenbare Rendite je Grund, soweit Region und Suche passen. */
  ratingGaps(filter: Pick<ScreeningFilter, "region" | "query">): Record<RatingGap, number> {
    const rows = this.#db
      .select({ gap: Database.#gapSql, n: count() })
      .from(t.screening)
      .innerJoin(t.stocks, eq(t.stocks.id, t.screening.stockId))
      .where(this.#screeningWhere(filter, sql`${t.screening.innerReturn} IS NULL`))
      .groupBy(Database.#gapSql)
      .all();
    const result: Record<RatingGap, number> = {
      "kurs-nicht-abrufbar": 0,
      "kein-kurs": 0,
      "rueckfluss-fehlt": 0,
      "rueckfluss-null": 0,
      "wachstum-fehlt": 0,
      "keine-loesung": 0,
    };
    for (const row of rows) result[row.gap] = row.n;
    return result;
  }

  /** Titel ohne berechenbare Rendite aus einem Grund, nach Name. */
  unrated(
    gap: RatingGap,
    filter: Pick<ScreeningFilter, "region" | "query">,
    limit: number,
    offset = 0,
  ): { stock: Stock; row: ScreeningRow }[] {
    return this.#db
      .select({ stock: t.stocks, row: t.screening })
      .from(t.screening)
      .innerJoin(t.stocks, eq(t.stocks.id, t.screening.stockId))
      .where(this.#screeningWhere(filter, sql`${t.screening.innerReturn} IS NULL`, sql`${Database.#gapSql} = ${gap}`))
      .orderBy(asc(t.stocks.name))
      .limit(limit)
      .offset(offset)
      .all()
      .map((r) => ({ stock: toStock(r.stock), row: r.row }));
  }

  /**
   * Abdeckung des Datenvorrats je Börse (Endung des Symbols) und Sitzland, nur Stammaktien wie im Screening.
   * „Bewertet“ zählt Titel mit innerer Rendite, die nicht als unplausibel ausgeblendet sind.
   */
  coverage(): CoverageRow[] {
    const rows = this.#db
      .select({
        id: t.stocks.id,
        region: t.stocks.region,
        country: t.stocks.country,
        rated: sql<number>`${t.screening.innerReturn} IS NOT NULL AND NOT ${t.screening.implausible}`,
      })
      .from(t.stocks)
      .leftJoin(t.screening, eq(t.screening.stockId, t.stocks.id))
      .where(and(isNull(t.stocks.delistedOn), or(isNull(t.stocks.securityType), eq(t.stocks.securityType, "Common Stock"))))
      .all();
    const groups = new Map<string, CoverageRow>();
    for (const row of rows) {
      const exchange = row.id.slice(row.id.lastIndexOf(".") + 1);
      const key = `${exchange}|${row.region}|${row.country}`;
      const group = groups.get(key) ?? { exchange, region: row.region, country: row.country, stocks: 0, rated: 0 };
      group.stocks++;
      if (row.rated) group.rated++;
      groups.set(key, group);
    }
    return [...groups.values()];
  }

  /** Regionen, für die es Titel gibt. */
  regions(): string[] {
    return this.#db
      .selectDistinct({ region: t.stocks.region })
      .from(t.stocks)
      .where(isNull(t.stocks.delistedOn))
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

  /**
   * Titel, deren Abschlüsse wahrscheinlich ein neues Geschäftsjahr verpasst haben: Das jüngste Jahr liegt vor dem
   * Vorjahr von `today`, und der letzte Abruf ist älter als `minAgeDays` (sonst gibt es schlicht noch keinen neuen Bericht).
   */
  staleFundamentals(kind: string, today: string, minAgeDays = 90): string[] {
    // Abschlüsse kommen von März bis Mai; vorher fehlt das Vorjahr bei fast allen und ein Auffrischen brächte nichts.
    const cutoff = new Date(Date.parse(today) - minAgeDays * 86_400_000).toISOString();
    const rows = this.#client
      .prepare(
        `SELECT r.stock_id AS id FROM raw_documents r LEFT JOIN fundamentals f ON f.stock_id = r.stock_id
         WHERE r.kind = ? AND r.fetched_at < ? GROUP BY r.stock_id HAVING COALESCE(MAX(f.fiscal_year), 0) < ?`,
      )
      .all(kind, cutoff, expectedFiscalYear(today)) as { id: string }[];
    return rows.map((r) => r.id).sort();
  }

  /** Titel, die in irgendeinem Portfolio mit Stückzahl über 0 stehen. */
  heldStockIds(): Set<string> {
    const rows = this.#db.selectDistinct({ id: t.holdings.stockId }).from(t.holdings).where(gt(t.holdings.shares, 0)).all();
    return new Set(rows.map((r) => r.id));
  }

  /** Titel mit berechenbarer innerer Rendite im Screening. */
  ratedStockIds(): Set<string> {
    const rows = this.#db.select({ id: t.screening.stockId }).from(t.screening).where(sql`${t.screening.innerReturn} IS NOT NULL`).all();
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

  /** ISIN einer Notiz (aus den Stammdaten des Anbieters oder der Aufnahme über die ISIN). */
  setIsin(id: string, isin: string): void {
    this.#db.update(t.stocks).set({ isin }).where(eq(t.stocks.id, id)).run();
  }

  /** Notizen je ISIN; eine ISIN kann an mehreren Börsen notieren. Unbekannte ISINs fehlen in der Antwort. */
  stockIdsByIsin(isins: readonly string[]): Map<string, string[]> {
    const found = new Map<string, string[]>();
    if (isins.length === 0) return found;
    const rows = this.#db
      .select({ id: t.stocks.id, isin: t.stocks.isin })
      .from(t.stocks)
      .where(inArray(t.stocks.isin, [...isins]))
      .orderBy(t.stocks.id)
      .all();
    for (const row of rows) found.set(row.isin!, [...(found.get(row.isin!) ?? []), row.id]);
    return found;
  }

  /** Die Aktien aus `ids`, für die noch keine ISIN gespeichert ist. */
  stockIdsWithoutIsin(ids: readonly string[]): string[] {
    if (ids.length === 0) return [];
    return this.#db
      .select({ id: t.stocks.id })
      .from(t.stocks)
      .where(and(inArray(t.stocks.id, [...new Set(ids)]), isNull(t.stocks.isin)))
      .orderBy(t.stocks.id)
      .all()
      .map((r) => r.id);
  }

  setSelection(portfolioId: number, selection: PortfolioSelection): void {
    this.#db.update(t.portfolios).set({ selection }).where(eq(t.portfolios.id, portfolioId)).run();
  }

  setComdirectDepot(portfolioId: number, depotId: string | null): void {
    this.#db.update(t.portfolios).set({ comdirectDepotId: depotId }).where(eq(t.portfolios.id, portfolioId)).run();
  }

  /**
   * Ersetzt den ganzen Bestand eines Portfolios in einem Schritt: Barbestand, sonstige Anlagen und Stückzahlen. Positionen,
   * die nicht in `shares` stehen, fallen weg.
   */
  replaceHoldings(portfolioId: number, bestand: { cashEur: number; otherEur: number; shares: ReadonlyMap<string, number> }): void {
    this.#db.transaction((tx) => {
      tx.update(t.portfolios).set({ cashEur: bestand.cashEur, otherEur: bestand.otherEur }).where(eq(t.portfolios.id, portfolioId)).run();
      tx.delete(t.holdings).where(eq(t.holdings.portfolioId, portfolioId)).run();
      for (const [stockId, shares] of bestand.shares) {
        if (shares > 0) tx.insert(t.holdings).values({ portfolioId, stockId, shares }).run();
      }
    });
  }

  /** Aktien je ISIN (Watchlist und Datenvorrat); eine ISIN kann mehrere Notizen haben. */
  stocksByIsin(): Map<string, Stock[]> {
    const result = new Map<string, Stock[]>();
    const rows = this.#db.select().from(t.stocks).where(sql`${t.stocks.isin} IS NOT NULL`).orderBy(t.stocks.id).all();
    for (const row of rows) result.set(row.isin!, [...(result.get(row.isin!) ?? []), toStock(row)]);
    return result;
  }

  /** Sektor nach GICS laut Anbieter. */
  setGicSector(id: string, gicSector: string): void {
    this.#db.update(t.stocks).set({ gicSector }).where(eq(t.stocks.id, id)).run();
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

  /**
   * Schreibt das Zielportfolio eines Tages in das Vorwärtsprotokoll; ein früherer Eintrag desselben Tages wird ersetzt.
   * `done` ist die Einstellung, die den Eintrag als erledigt markiert; sie wird in derselben Transaktion gesetzt.
   */
  saveForwardLog(
    date: string,
    arm: string,
    profile: string,
    versions: { calcVersion: number; strategyVersion: string },
    rows: readonly ForwardLogRow[],
    done: { key: string; value: string },
  ): void {
    this.#db.transaction((tx) => {
      tx.delete(t.forwardLog)
        .where(and(eq(t.forwardLog.date, date), eq(t.forwardLog.arm, arm), eq(t.forwardLog.profile, profile)))
        .run();
      for (const row of rows)
        tx.insert(t.forwardLog)
          .values({ date, arm, profile, ...versions, ...row })
          .run();
      const updatedAt = new Date().toISOString();
      tx.insert(t.settings)
        .values({ key: done.key, value: done.value, updatedAt })
        .onConflictDoUpdate({ target: t.settings.key, set: { value: done.value, updatedAt } })
        .run();
    });
  }

  /** Schreibt die Rangliste eines Arms zu einem Tag (ein früherer Eintrag desselben Tages wird ersetzt); `done` wie bei `saveForwardLog`. */
  saveForwardRanking(
    date: string,
    arm: string,
    versions: { calcVersion: number; strategyVersion: string },
    rows: readonly ForwardRankingRow[],
    done: { key: string; value: string },
  ): void {
    this.#db.transaction((tx) => {
      tx.delete(t.forwardRanking)
        .where(and(eq(t.forwardRanking.date, date), eq(t.forwardRanking.arm, arm)))
        .run();
      for (const row of rows)
        tx.insert(t.forwardRanking)
          .values({ date, arm, ...versions, ...row })
          .run();
      const updatedAt = new Date().toISOString();
      tx.insert(t.settings)
        .values({ key: done.key, value: done.value, updatedAt })
        .onConflictDoUpdate({ target: t.settings.key, set: { value: done.value, updatedAt } })
        .run();
    });
  }

  /** Alle Ranglisten des Vorwärtsprotokolls, älteste zuerst, je Tag und Arm nach Rang. */
  forwardRanking(): ForwardRankingEntry[] {
    return this.#db.select().from(t.forwardRanking).orderBy(t.forwardRanking.date, t.forwardRanking.arm, t.forwardRanking.rank).all();
  }

  /** Gewichte des jüngsten Eintrags vor `before` (ohne ihn); leer, wenn es keinen gibt. */
  forwardLogWeights(arm: string, profile: string, before: string): Map<string, number> {
    const latest = this.#db
      .select({ date: max(t.forwardLog.date) })
      .from(t.forwardLog)
      .where(and(eq(t.forwardLog.arm, arm), eq(t.forwardLog.profile, profile), sql`${t.forwardLog.date} < ${before}`))
      .get();
    if (!latest?.date) return new Map();
    const rows = this.#db
      .select({ stockId: t.forwardLog.stockId, weight: t.forwardLog.weight })
      .from(t.forwardLog)
      .where(and(eq(t.forwardLog.arm, arm), eq(t.forwardLog.profile, profile), eq(t.forwardLog.date, latest.date)))
      .all();
    return new Map(rows.map((r) => [r.stockId, r.weight]));
  }

  /** Das ganze Vorwärtsprotokoll, älteste Einträge zuerst. */
  forwardLog(): ForwardLogEntry[] {
    return this.#db
      .select()
      .from(t.forwardLog)
      .orderBy(t.forwardLog.date, t.forwardLog.arm, t.forwardLog.profile, desc(t.forwardLog.weight))
      .all();
  }
}
