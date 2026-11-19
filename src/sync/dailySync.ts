// Täglicher Abgleich (Spezifikation Abschnitt 8): Kurse und Wechselkurse laden, Bewertungen und
// Zielportfolios neu rechnen und als Tagesstand speichern. Ein Fehler bei einem Titel hält den Lauf nicht auf.
//
// Der Abgleich richtet sich nach dem Tagesbudget des Tarifs. Reicht es nicht für alle Titel, kommen zuerst
// gehaltene Aktien, dann die Watchlist, jeweils die mit dem ältesten Kurs zuerst; der Rest folgt am nächsten Tag.

import type { Database, ScreeningRow, Stock } from "../data/db.ts";
import { fetchEcbRates } from "../data/ecb.ts";
import { EodhdError, fetchAccount, fetchDailyCloses } from "../data/eodhd.ts";
import type { DailyClose } from "../data/eodhd.ts";
import { searchEodhd } from "../data/eodhdFundamentals.ts";
import { fetchSupplementRates } from "../data/fxSupplement.ts";
import { fetchBondYield, fetchInflationForecasts } from "../data/reference.ts";
import { BOND_KEY, loadPortfolio } from "../valuation/portfolioRun.ts";
import { computeValuation, valueStock } from "../valuation/run.ts";

/** Der kostenlose Tarif liefert höchstens ein Jahr Kurshistorie. */
const MAX_LOOKBACK_DAYS = 360;
const MIN_LOOKBACK_DAYS = 10;
/** Abrufe am Tag, wenn das Konto nicht abgefragt werden kann (kostenloser Tarif). */
const FALLBACK_BUDGET = 20;
/** Abrufe, die für Handarbeit am selben Tag übrig bleiben sollen. */
const RESERVE = 2;
/** Der Datenvorrat bekommt nur Kurse, wenn das Budget deutlich über dem kostenlosen Tarif liegt. */
const STOCKPILE_MIN_BUDGET = 500;
const PARALLEL = 4;

export interface SyncReport {
  date: string;
  /** Stichtag der Wechselkurse; `null`, wenn der Abruf scheiterte. */
  fxDate: string | null;
  fxError: string | null;
  /** Abrufe, die dem Lauf zur Verfügung standen. */
  budget: number;
  pricesLoaded: number;
  /** Kurs war schon aktuell, kein Abruf nötig. */
  pricesCurrent: number;
  /** Watchlist- und Portfolio-Titel, die wegen des Budgets auf den nächsten Lauf warten. */
  pricesDeferred: string[];
  priceErrors: { id: string; error: string }[];
  /** Anleiherendite oder Inflationsprognosen nicht geladen; dann gelten die alten Werte. */
  referenceErrors: string[];
  valuations: number;
  screened: number;
  portfolios: number;
}

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Vollständig heißt: Wechselkurse da, kein Kursfehler, kein beobachteter Titel zurückgestellt. */
export function syncSucceeded(report: SyncReport): boolean {
  return report.fxError === null && report.priceErrors.length === 0 && report.pricesDeferred.length === 0;
}

/** Rückfluss über diesem Anteil des Kurses gilt als Datenfehler. */
const MAX_PAYOUT_YIELD = 0.2;
/** Ein Kurs unter diesem Vielfachen des Gewinnniveaus gilt als Datenfehler. */
const MIN_PRICE_TO_EARNINGS = 3;

/**
 * Grobe Prüfung, ob Kurs und Fundamentaldaten zusammenpassen. Sie fängt vor allem Hinterlegungsscheine, deren
 * Zahlen sich auf eine andere Stückelung oder Währung beziehen. Echte Sonderfälle fallen auch darunter.
 */
export function looksImplausible(price: number | null, payoutLevel: number | undefined, earningsLevel: number | null): boolean {
  if (price === null || !(price > 0)) return false;
  if (payoutLevel !== undefined && payoutLevel / price > MAX_PAYOUT_YIELD) return true;
  return earningsLevel !== null && earningsLevel > 0 && price / earningsLevel < MIN_PRICE_TO_EARNINGS;
}

function describe(error: unknown): string {
  if (!(error instanceof EodhdError)) return (error as Error).message;
  const hint = error.status === 403 ? " (im Tarif nicht enthalten)" : error.status === 402 ? " (Tageslimit erreicht)" : "";
  return `HTTP ${error.status}${hint}`;
}

/**
 * @param token EODHD-Token; `null` überspringt den Kursabruf (Bewertungen werden trotzdem gespeichert).
 * @param now Zeitpunkt des Laufs; bestimmt den Tagesstand.
 */
export async function runDailySync(
  db: Database,
  token: string | null,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
): Promise<SyncReport> {
  const date = isoDay(now.getTime());
  const yesterday = isoDay(now.getTime() - 86_400_000);
  const report: SyncReport = {
    date, fxDate: null, fxError: null, budget: 0, pricesLoaded: 0, pricesCurrent: 0, pricesDeferred: [], priceErrors: [],
    referenceErrors: [],
    valuations: 0, screened: 0, portfolios: 0,
  };

  // --- Wechselkurse: EZB, dazu eine zweite Quelle für Währungen, die dort fehlen ---
  try {
    const rates = await fetchEcbRates(fetchFn);
    db.saveFxRates(rates.date, rates.perEur);
    report.fxDate = rates.date;
    const missing = db.currencies().filter((c) => c !== "EUR" && rates.perEur[c] === undefined);
    if (missing.length > 0) {
      try {
        db.saveFxRates(rates.date, await fetchSupplementRates(missing, fetchFn));
      } catch {
        // Ohne Zusatzkurse bleiben nur die betroffenen Titel unbewertet.
      }
    }
  } catch (error) {
    report.fxError = (error as Error).message;
  }

  // --- Bezugsgrößen: Anleiherendite für die Mindestrendite, Inflationsprognosen für den Währungsabgleich.
  // Fällt eine Quelle aus, gelten die zuletzt gespeicherten Werte weiter.
  try {
    const bond = await fetchBondYield(fetchFn);
    db.setReferenceRate(BOND_KEY, bond.rate, bond.date);
  } catch (error) {
    report.referenceErrors.push((error as Error).message);
  }
  try {
    const forecasts = await fetchInflationForecasts(now.getUTCFullYear(), fetchFn);
    for (const [currency, rate] of Object.entries(forecasts)) db.setReferenceRate(`inflation:${currency}`, rate, date);
  } catch (error) {
    report.referenceErrors.push((error as Error).message);
  }

  // --- Reihenfolge: gehaltene Titel, Watchlist, Datenvorrat; je Gruppe der älteste Kurs zuerst ---
  const all = db.stocks({ includeStockpile: true });
  const held = new Set<string>();
  for (const portfolio of db.portfolios()) for (const id of db.holdings(portfolio.id).keys()) held.add(id);
  const priceDates = db.latestPriceDates();
  const group = (s: Stock) => (held.has(s.id) ? 0 : s.watched ? 1 : 2);
  const queue = all
    .filter((s) => (priceDates.get(s.id) ?? "") < yesterday)
    .sort((a, b) => group(a) - group(b) || (priceDates.get(a.id) ?? "").localeCompare(priceDates.get(b.id) ?? "") || a.id.localeCompare(b.id));
  report.pricesCurrent = all.length - queue.length;

  if (token !== null) {
    try {
      const account = await fetchAccount(token, fetchFn);
      report.budget = Math.max(0, account.dailyRateLimit - account.requestsToday - RESERVE);
    } catch {
      report.budget = FALLBACK_BUDGET - RESERVE;
    }
  }
  const tracked = queue.filter((s) => group(s) < 2);
  const stockpile = report.budget >= STOCKPILE_MIN_BUDGET ? queue.filter((s) => group(s) === 2) : [];
  const planned = [...tracked, ...stockpile].slice(0, report.budget);
  report.pricesDeferred = tracked.slice(report.budget).map((s) => s.id);

  // Der Tarif "Fundamentals" sperrt die Kurshistorie; dann liefert die Symbolsuche den letzten Schlusskurs.
  let historyBlocked = false;
  async function closesFor(stock: Stock): Promise<DailyClose[]> {
    if (!historyBlocked) {
      try {
        const last = priceDates.get(stock.id);
        const gapDays = last ? Math.round((Date.parse(date) - Date.parse(last)) / 86_400_000) : MAX_LOOKBACK_DAYS;
        const lookback = Math.min(MAX_LOOKBACK_DAYS, Math.max(MIN_LOOKBACK_DAYS, gapDays));
        return await fetchDailyCloses(stock.id, isoDay(now.getTime() - lookback * 86_400_000), date, token!, fetchFn);
      } catch (error) {
        if (!(error instanceof EodhdError && error.status === 403)) throw error;
        historyBlocked = true;
      }
    }
    const hit = (await searchEodhd(stock.id, token!, fetchFn)).find((h) => h.symbol === stock.id);
    if (!hit || hit.previousClose === null || hit.previousCloseDate === null) throw new Error("kein Kurs in der Symbolsuche");
    return [{ date: hit.previousCloseDate, close: hit.previousClose }];
  }

  let next = 0;
  let limitReached = false;
  async function loadNext(): Promise<void> {
    const stock = planned[next++]!;
    try {
      db.saveRawCloses(stock.id, await closesFor(stock));
      report.pricesLoaded++;
    } catch (error) {
      if (error instanceof EodhdError && error.status === 402) limitReached = true;
      // Fehler im Datenvorrat sind erwartbar (eingestellte Titel) und füllen den Bericht nicht.
      if (group(stock) < 2) report.priceErrors.push({ id: stock.id, error: describe(error) });
    }
  }
  async function worker(): Promise<void> {
    while (next < planned.length && !limitReached) await loadNext();
  }
  if (token === null) {
    report.priceErrors = tracked.map((s) => ({ id: s.id, error: "kein Token" }));
  } else if (planned.length > 0) {
    // Der erste Abruf läuft allein, damit eine gesperrte Kurshistorie nur einmal festgestellt wird.
    await loadNext();
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  }

  // --- Bewertungen: mit Verlauf für beobachtete Titel, als Momentaufnahme für den Datenvorrat ---
  const screening: ScreeningRow[] = [];
  for (const stock of all) {
    const trackedStock = group(stock) < 2;
    const { valuation, priceDate, proposals } = trackedStock ? valueStock(db, stock, date) : computeValuation(db, stock, date);
    if (trackedStock) report.valuations++;
    screening.push({
      stockId: stock.id, date, priceDate, price: valuation.price,
      payoutLevel: valuation.inputs.payoutLevel ?? null, growth: valuation.inputs.growth ?? null,
      riskScore: valuation.riskScore, innerReturn: valuation.returns?.base ?? null,
      implausible: looksImplausible(valuation.price, valuation.inputs.payoutLevel, proposals.details.earningsLevel),
    });
  }
  db.saveScreening(screening);
  report.screened = screening.filter((r) => r.innerReturn !== null).length;

  for (const portfolio of db.portfolios()) {
    const { view } = loadPortfolio(db, portfolio, date);
    db.savePortfolioSnapshot(portfolio.id, date, view.totalEur, {
      profile: portfolio.profile, cashEur: portfolio.cashEur, targetCashWeight: view.targetCashWeight, rows: view.rows,
    });
    report.portfolios++;
  }

  db.saveSyncRun(syncSucceeded(report), report);
  return report;
}
