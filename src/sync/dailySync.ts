// Täglicher Abgleich (Spezifikation Abschnitt 8): Kurse und Wechselkurse laden, Bewertungen und
// Zielportfolios neu rechnen und als Tagesstand speichern. Ein Fehler bei einem Titel hält den Lauf nicht auf.

import type { Database } from "../data/db.ts";
import { fetchEcbRates } from "../data/ecb.ts";
import { EodhdError, fetchDailyCloses } from "../data/eodhd.ts";
import { loadPortfolio } from "../valuation/portfolioRun.ts";
import { valueStock } from "../valuation/run.ts";

/** Der kostenlose Tarif liefert höchstens ein Jahr Kurshistorie. */
const MAX_LOOKBACK_DAYS = 360;
const MIN_LOOKBACK_DAYS = 10;

export interface SyncReport {
  date: string;
  /** Stichtag der Wechselkurse; `null`, wenn der Abruf scheiterte. */
  fxDate: string | null;
  fxError: string | null;
  prices: { id: string; date: string | null; error: string | null }[];
  valuations: number;
  portfolios: number;
}

const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

export function syncSucceeded(report: SyncReport): boolean {
  return report.fxError === null && report.prices.every((p) => p.error === null);
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
  const report: SyncReport = { date, fxDate: null, fxError: null, prices: [], valuations: 0, portfolios: 0 };

  try {
    const rates = await fetchEcbRates(fetchFn);
    db.saveFxRates(rates.date, rates.perEur);
    report.fxDate = rates.date;
  } catch (error) {
    report.fxError = (error as Error).message;
  }

  // Kurse für die Watchlist und für alle gehaltenen Titel.
  const stocks = new Map(db.stocks().map((s) => [s.id, s]));
  for (const portfolio of db.portfolios()) {
    for (const id of db.holdings(portfolio.id).keys()) {
      const stock = stocks.get(id) ?? db.stock(id);
      if (stock) stocks.set(id, stock);
    }
  }

  for (const stock of stocks.values()) {
    if (token === null) {
      report.prices.push({ id: stock.id, date: db.latestPrice(stock.id)?.date ?? null, error: "kein Token" });
      continue;
    }
    try {
      // Ab dem letzten gespeicherten Kurs, damit nach einer Pause keine Lücke bleibt.
      const last = db.latestPrice(stock.id)?.date;
      const gapDays = last ? Math.round((Date.parse(date) - Date.parse(last)) / 86_400_000) : MAX_LOOKBACK_DAYS;
      const lookback = Math.min(MAX_LOOKBACK_DAYS, Math.max(MIN_LOOKBACK_DAYS, gapDays));
      const closes = await fetchDailyCloses(stock.id, isoDay(now.getTime() - lookback * 86_400_000), date, token, fetchFn);
      db.saveRawCloses(stock.id, closes);
      report.prices.push({ id: stock.id, date: db.latestPrice(stock.id)?.date ?? null, error: null });
    } catch (error) {
      const reason =
        error instanceof EodhdError
          ? `HTTP ${error.status}${error.status === 403 ? " (Tarif enthält keine Kurse)" : error.status === 402 ? " (Tageslimit erreicht)" : ""}`
          : (error as Error).message;
      report.prices.push({ id: stock.id, date: db.latestPrice(stock.id)?.date ?? null, error: reason });
    }
  }

  for (const stock of stocks.values()) {
    valueStock(db, stock, date);
    report.valuations++;
  }
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
