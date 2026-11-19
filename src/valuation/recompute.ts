// Rechnet alles neu, was aus den Daten abgeleitet gespeichert ist: Tagesstände der beobachteten Titel, das Screening
// des Datenvorrats und die Tagesstände der Portfolios. Braucht nur die Datenbank, keinen Abruf.
//
// Der Abgleich ruft es nach dem Laden der Kurse auf; der Worker stellt es beim Start ein, wenn die gespeicherten
// Stände mit einer anderen Version der Rechnung entstanden sind (`CALC_VERSION`). So zeigt der Datenvorrat nach einem
// Deployment nicht bis zum nächsten Abgleich die alte Rechnung.

import type { Database, ScreeningRow } from "../data/db.ts";
import { loadPortfolio } from "./portfolioRun.ts";
import type { StockValuation } from "./run.ts";
import { CALC_VERSION, computeValuation, storedBaseline, valueStock } from "./run.ts";
import { doubtfulNumbers } from "./valuation.ts";

/** Einstellung mit der Version der Rechnung, mit der die gespeicherten Stände entstanden sind. */
const CALC_VERSION_KEY = "calc-version";
export const RECOMPUTE_JOB = "recompute";

export interface RecomputeReport {
  /** Tagesstände mit Verlauf (Watchlist und gehaltene Titel). */
  valuations: number;
  /** Titel im Screening mit innerer Rendite. */
  screened: number;
  portfolios: number;
  /** Titel, deren Bewertung scheiterte (etwa unbrauchbare gespeicherte Zahlen); der Lauf geht weiter. */
  valuationErrors: { id: string; error: string }[];
}

/**
 * Der Tagesstand von heute stammt aus einer älteren Rechnung. Er bleibt stehen: Wurde heute bewertet, ist er der
 * Prüfstand, und „Bewertung prüfen“ soll die Verschiebung durch die neue Rechnung zeigen. Morgen gilt ein neuer Tag.
 */
function olderCalcToday(db: Database, stockId: string, date: string): boolean {
  if (db.valuationHistory(stockId, 1)[0]?.date !== date) return false;
  const baseline = storedBaseline(db.valuationDetailsAsOf(stockId, date));
  return baseline !== null && baseline.calcVersion !== CALC_VERSION;
}

/** @param date ISO-Datum der Tagesstände, z. B. 2026-11-19. */
export function recomputeAll(db: Database, date: string): RecomputeReport {
  const held = new Set<string>();
  for (const portfolio of db.portfolios()) for (const id of db.holdings(portfolio.id).keys()) held.add(id);
  const report: RecomputeReport = { valuations: 0, screened: 0, portfolios: 0, valuationErrors: [] };

  // Mit Verlauf für beobachtete Titel, als Momentaufnahme für den Datenvorrat.
  const screening: ScreeningRow[] = [];
  const valued = new Map<string, StockValuation>();
  for (const stock of db.stocks({ includeStockpile: true })) {
    const tracked = stock.watched || held.has(stock.id);
    const keep = tracked && olderCalcToday(db, stock.id, date);
    let result: StockValuation;
    try {
      result = tracked && !keep ? valueStock(db, stock, date) : computeValuation(db, stock, date);
    } catch (error) {
      report.valuationErrors.push({ id: stock.id, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    valued.set(stock.id, result);
    const { valuation, priceDate, proposals } = result;
    if (tracked && !keep) report.valuations++;
    screening.push({
      stockId: stock.id,
      date,
      priceDate,
      price: valuation.price,
      payoutLevel: valuation.inputs.payoutLevel ?? null,
      growth: valuation.inputs.growth ?? null,
      riskScore: valuation.riskScore,
      innerReturn: valuation.returns?.base ?? null,
      implausible: doubtfulNumbers(valuation, proposals) !== null,
    });
  }
  db.saveScreening(screening);
  report.screened = screening.filter((r) => r.innerReturn !== null).length;

  for (const portfolio of db.portfolios()) {
    const { view } = loadPortfolio(db, portfolio, date, valued);
    db.savePortfolioSnapshot(portfolio.id, date, view.totalEur, {
      profile: portfolio.profile,
      cashEur: portfolio.cashEur,
      targetCashWeight: view.targetCashWeight,
      rows: view.rows,
    });
    report.portfolios++;
  }

  db.setSetting(CALC_VERSION_KEY, String(CALC_VERSION));
  return report;
}

/**
 * Stellt das Neurechnen ein, wenn die gespeicherten Stände aus einer anderen Version der Rechnung stammen.
 * Eine leere Datenbank hat nichts zu rechnen und bekommt nur die Version. `true`, wenn ein Lauf eingestellt wurde.
 */
export function enqueueRecomputeIfOutdated(db: Database): boolean {
  if (db.setting(CALC_VERSION_KEY) === String(CALC_VERSION)) return false;
  if (db.stocks({ includeStockpile: true }).length === 0) {
    db.setSetting(CALC_VERSION_KEY, String(CALC_VERSION));
    return false;
  }
  db.enqueueJob(RECOMPUTE_JOB, {});
  return true;
}
