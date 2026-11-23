// Kandidaten zu einem früheren Stichtag: dieselbe Rechnung wie in der Anwendung (`proposeInputs`, `evaluate`), aber nur mit
// dem, was damals bekannt war (Abschlüsse bis zum letzten veröffentlichten Jahr, Kurs und Wechselkurs des Monatsschlusses).
//
// Grenzen: Die Abschlüsse stehen in der heutigen Fassung. Der Risikowert kommt nur aus den Zahlenfaktoren (mit Ersatzabzügen),
// ohne Urteile. Heute geführte Titel sind überrepräsentiert (Survivorship).

import type { FundamentalsYear, Stock } from "../data/db.ts";
import { delistedArtefact, fingerprint, isCommonShare } from "../valuation/universe.ts";
import { dividendsByYear, doubtfulNumbers, evaluate, priceInReportingCurrency, proposeInputs } from "../valuation/valuation.ts";
import { lastKnownFiscalYear, monthEnd } from "./calendar.ts";
import type { FxHistory } from "./fx.ts";
import { fxPerEur } from "./fx.ts";

export interface Bar {
  /** Schlusskurs des Monats, roh (ohne Splits und Dividenden bereinigt), in der Einheit der Notiz. */
  close: number;
  /** Um Splits und Dividenden bereinigt: Verhältnisse zweier Monate sind die Gesamtrendite. */
  adjustedClose: number;
}

export interface StockData {
  stock: Stock;
  fundamentals: readonly FundamentalsYear[];
  dividends: readonly { date: string; value: number; currency: string; period: string }[] | null;
  splits: readonly { date: string; ratio: number }[];
  bars: ReadonlyMap<string, Bar>;
}

export interface Candidate {
  id: string;
  name: string;
  country: string;
  sector: string;
  region: string;
  innerReturn: number;
  riskScore: number;
  complete: true;
  heldWeight: number;
  capEur: number;
  /** Gleiche Zahlen unter verschiedenen Symbolen sind dasselbe Unternehmen (ADR, Zweitnotiz). */
  fingerprint: string;
}

export type SkipReason = "kurs" | "wechselkurs" | "split" | "marktwert" | "unplausibel" | "fehler" | "ausgeschlossen";

export interface CandidateContext {
  fx: FxHistory;
  /** Inflationsabstand der Berichtswährung zum Euro: die heutige Prognose der Anwendung für alle Stichtage, ohne Prognose 0. */
  inflationGap: (currency: string) => number;
  minCapEur: number;
  /** Letzter Monat der Reihe und der Tag seines Kurses. */
  last: { month: string; date: string };
}

/**
 * Split-Basis der Abschlüsse: "adjusted" (Aktienzahl springt nicht), "unadjusted" (sie springt ungefähr um das Verhältnis)
 * oder "unknown" (Aktienzahlen fehlen rund um den Split).
 */
export function splitBasis(
  years: readonly FundamentalsYear[],
  split: { date: string; ratio: number },
): "adjusted" | "unadjusted" | "unknown" {
  const year = Number(split.date.slice(0, 4));
  for (const candidate of [year, year + 1]) {
    const now = years.find((y) => y.fiscalYear === candidate)?.shares;
    const before = years.find((y) => y.fiscalYear === candidate - 1)?.shares;
    if (!now || !before || now <= 0 || before <= 0) continue;
    if (Math.abs(now / before / split.ratio - 1) < 0.25) return "unadjusted";
    if (Math.abs(now / before - 1) < 0.25) return "adjusted";
  }
  return "unknown";
}

export function candidateAt(data: StockData, month: string, ctx: CandidateContext): { candidate: Candidate } | { skipped: SkipReason } {
  const { stock } = data;
  const bar = data.bars.get(month);
  if (!bar) return { skipped: "kurs" };
  const date = monthEnd(month, ctx.last);
  const known = lastKnownFiscalYear(month);
  const years = data.fundamentals.filter((y) => y.fiscalYear <= known);

  // Splits nach dem letzten bekannten Abschluss (vor oder nach dem Stichtag): Kurs und Zahlen je Aktie passen nur zusammen, wenn
  // die Abschlüsse nachweislich bereinigt sind. Bei unbereinigten Abschlüssen stünde ein Kurs nach dem Split neben Zahlen davor.
  const laterSplits = data.splits.filter((s) => Math.abs(s.ratio - 1) >= 0.2 && s.date > `${known}-12-31`);
  if (laterSplits.some((s) => splitBasis(data.fundamentals, s) !== "adjusted")) return { skipped: "split" };

  const quoteFx = fxPerEur(ctx.fx, stock.priceCurrency, date);
  const reportingFx = fxPerEur(ctx.fx, stock.reportingCurrency, date);
  if (quoteFx === null || reportingFx === null) return { skipped: "wechselkurs" };
  const afterSplits = data.splits.filter((s) => s.date > date && s.ratio > 0).reduce((product, s) => product * s.ratio, 1);
  const price = priceInReportingCurrency(bar.close / stock.priceDivisor / afterSplits, quoteFx, reportingFx);
  if (price === null) return { skipped: "wechselkurs" };

  try {
    const gap = ctx.inflationGap(stock.reportingCurrency);
    const paid = data.dividends === null ? null : dividendsByYear(data.dividends, stock.reportingCurrency, date);
    const proposals = proposeInputs(
      stock,
      years,
      reportingFx,
      Number(month.slice(0, 4)),
      { dividendsByYear: paid, splits: data.splits },
      gap,
    );
    const valuation = evaluate(
      proposals.values,
      {},
      price,
      gap,
      proposals.details.earningsLevel,
      proposals.details.payoutEarningsLevel ?? null,
      proposals.standIns,
    );
    const base = valuation.returns?.base;
    if (base == null || doubtfulNumbers(valuation, proposals) !== null) return { skipped: "unplausibel" };
    const last = years.at(-1);
    const shares = last?.shares ?? 0;
    const capEur = shares > 0 ? (shares * price) / reportingFx : 0;
    if (!(capEur >= ctx.minCapEur)) return { skipped: "marktwert" };
    return {
      candidate: {
        id: stock.id,
        name: stock.name,
        country: stock.country,
        sector: stock.sector,
        region: stock.region,
        innerReturn: base,
        riskScore: valuation.riskScore,
        complete: true,
        heldWeight: 0,
        capEur,
        fingerprint: fingerprint(stock.id, stock.reportingCurrency, last?.epsDiluted, shares),
      },
    };
  } catch {
    return { skipped: "fehler" };
  }
}

export interface CandidateSet {
  byMonth: Map<string, Candidate[]>;
  /** Monatsbalken der Titel, die mindestens einmal Kandidat waren (für die Renditen). */
  bars: Map<string, ReadonlyMap<string, Bar>>;
  skipped: Record<SkipReason, number>;
}

/** Kandidaten zu allen Stichtagen; von mehreren Notierungen desselben Unternehmens bleibt die mit dem größten Marktwert. */
export function buildCandidates(
  stocks: Iterable<Stock>,
  load: (stock: Stock) => StockData | null,
  months: readonly string[],
  ctx: CandidateContext,
): CandidateSet {
  const byMonth = new Map<string, Candidate[]>(months.map((m) => [m, []]));
  const bars = new Map<string, ReadonlyMap<string, Bar>>();
  const skipped: Record<SkipReason, number> = {
    kurs: 0,
    wechselkurs: 0,
    split: 0,
    marktwert: 0,
    unplausibel: 0,
    fehler: 0,
    ausgeschlossen: 0,
  };
  for (const stock of stocks) {
    if (!isCommonShare(stock)) continue;
    const data = load(stock);
    if (!data) continue;
    // Eingestellte Titel mit Schuldtitel-, Datenfehler- oder Umbenennungsmuster zählen nicht (siehe `delistedArtefact`).
    const series = [...data.bars.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, bar]) => bar);
    if (
      delistedArtefact(
        stock,
        data.fundamentals.map((y) => y.fiscalYear),
        series,
      )
    ) {
      skipped.ausgeschlossen += months.length;
      continue;
    }
    let used = false;
    for (const month of months) {
      const result = candidateAt(data, month, ctx);
      if ("skipped" in result) skipped[result.skipped]++;
      else {
        byMonth.get(month)!.push(result.candidate);
        used = true;
      }
    }
    if (used) bars.set(stock.id, data.bars);
  }
  for (const [month, list] of byMonth) {
    const best = new Map<string, Candidate>();
    for (const c of list) {
      const known = best.get(c.fingerprint);
      if (!known || c.capEur > known.capEur) best.set(c.fingerprint, c);
    }
    byMonth.set(month, [...best.values()]);
  }
  return { byMonth, bars, skipped };
}
