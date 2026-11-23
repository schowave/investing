// Rückblick auf die Strategie: baut die Kandidaten zu jedem Stichtag, simuliert das Portfolio, rechnet rollende Fenster, die
// Zufallsgegenprobe und den Vergleich mit dem Index. Das Ergebnis ist reines JSON und lässt sich später vergleichen.

import { PROFILE_FOCUSED, PROFILE_GLOBAL } from "../calc/index.ts";
import type { Database, Stock } from "../data/db.ts";
import { CALC_VERSION } from "../valuation/run.ts";
import { MIN_MARKET_CAP_EUR } from "../valuation/universe.ts";
import type { PriceSeries } from "./benchmark.ts";
import { closeAtOrBefore } from "./benchmark.ts";
import { monthEnd, monthRange, shiftMonth } from "./calendar.ts";
import type { StockData } from "./candidates.ts";
import { buildCandidates } from "./candidates.ts";
import type { FxHistory } from "./fx.ts";
import type { RateSeries } from "./rates.ts";
import { rateAt } from "./rates.ts";
import type { BacktestSummary, Diagnostics, WindowResult } from "./report.ts";
import { median, metrics, quantile, randomScores, thirds, windowStarts, yearsBetween } from "./report.ts";
import type { Trade } from "./simulate.ts";
import { makeReturnOf, simulate } from "./simulate.ts";

export interface BacktestOptions {
  /** Erster Stichtag, "JJJJ-MM" (Monatsschluss). */
  start: string;
  /** Letzter Monat der Reihe und Tag seines Kurses. */
  end: string;
  endDate: string;
  profile: "fokussiert" | "global";
  /** Tauschschwelle als Anteil (0.03 = 3 Punkte); ohne Angabe die des Profils. */
  swap?: number;
  /** Nur jeden n-ten Quartalsstichtag umschichten. */
  every: number;
  randomRuns: number;
  windowMonths: number;
  /** Kosten je Handelsumsatz, einseitig. */
  cost: number;
  /** Verzinsung des Bargelds. */
  cashRate: number;
  /** Untergrenze der inneren Rendite (Anleiherendite). */
  hurdle: number;
  minCapEur: number;
  /** Annahme: Verlust, wenn die Kursreihe endet, bevor der Zeitraum zu Ende ist. */
  delistLoss: number;
  /** Bargeldzins und Hürde folgen den Zinsreihen der EZB je Stichtag; `cashRate` und `hurdle` sind dann deren Mittel. */
  ratesHistory?: boolean;
}

export const DEFAULT_OPTIONS: Omit<BacktestOptions, "start" | "end" | "endDate" | "hurdle"> = {
  profile: "fokussiert",
  every: 1,
  randomRuns: 200,
  windowMonths: 36,
  cost: 0.0025,
  cashRate: 0.034,
  minCapEur: MIN_MARKET_CAP_EUR,
  delistLoss: 0.5,
};

export interface BacktestResult extends BacktestSummary {
  trades: Record<string, Trade[]>;
  candidatesPerDate: Record<string, number>;
  diagnostics: Diagnostics;
}

const REBALANCE_STEP_MONTHS = 3;

export function runBacktest(
  db: Database,
  options: BacktestOptions,
  deps: { name: string; fx: FxHistory; benchmark: PriceSeries | null; rates?: { bond: RateSeries; cash: RateSeries }; now?: Date },
): BacktestResult {
  const months = monthRange(options.start, options.end);
  const last = { month: options.end, date: options.endDate };
  const dateOf = (month: string) => monthEnd(month, last);
  const rebalanceMonths = months.filter((_, i) => i % REBALANCE_STEP_MONTHS === 0 && i < months.length - 1);

  const inflationEuro = db.referenceRate("inflation:EUR");
  const gaps = new Map<string, number>();
  const inflationGap = (currency: string) => {
    if (currency === "EUR") return 0;
    if (!gaps.has(currency)) {
      const local = db.referenceRate(`inflation:${currency}`);
      gaps.set(currency, local !== null && inflationEuro !== null ? local - inflationEuro : 0);
    }
    return gaps.get(currency)!;
  };

  const firstBar = months[0] ? `${Number(months[0].slice(0, 4)) - 1}${months[0].slice(4)}` : options.start;
  const load = (stock: Stock): StockData | null => {
    const fundamentals = db.fundamentals(stock.id);
    if (fundamentals.length === 0) return null;
    const rows = db.monthlyPrices(stock.id).filter((r) => r.month >= firstBar && r.month <= options.end);
    if (rows.length === 0) return null;
    return {
      stock,
      fundamentals,
      dividends: db.dividends(stock.id),
      splits: db.splits(stock.id),
      bars: new Map(rows.map((r) => [r.month, { close: r.close, adjustedClose: r.adjustedClose }])),
    };
  };

  const stocks = db.stocks({ includeStockpile: true, includeDelisted: true });
  const set = buildCandidates(stocks, load, rebalanceMonths, { fx: deps.fx, inflationGap, minCapEur: options.minCapEur, last });
  const quoteCurrency = new Map(stocks.map((s) => [s.id, s.priceCurrency]));
  // Als eingestellt gilt nur, wessen Tageskurse auch aufhören; läuft nur die Monatsreihe nicht weiter, ist der Titel nicht tot.
  const lastDaily = db.latestPriceDates();
  const staleBefore = `${shiftMonth(options.end, -3)}-01`;
  const delistings: string[] = [];
  const returnOf = makeReturnOf(set.bars, quoteCurrency, deps.fx, dateOf, options.end, options.delistLoss, {
    isDelisted: (id) => (lastDaily.get(id) ?? "") < staleBefore,
    onDelist: (id, month) => delistings.push(`${id} ${month}`),
  });

  // Fehlt ein Wert (Reihe beginnt später, Lücke), gilt der feste Wert aus den Optionen.
  const cashAt = (month: string) => Math.max(0, (deps.rates && rateAt(deps.rates.cash, dateOf(month))) ?? options.cashRate);
  const hurdleAt = (month: string) => Math.max(0, (deps.rates && rateAt(deps.rates.bond, dateOf(month))) ?? options.hurdle);
  const mean = (f: (m: string) => number, list: readonly string[] = months) => list.reduce((t, m) => t + f(m), 0) / list.length;
  const ratesFallback = deps.rates
    ? months.filter((m) => rateAt(deps.rates!.cash, dateOf(m)) === null || rateAt(deps.rates!.bond, dateOf(m)) === null).length
    : 0;
  const used: BacktestOptions = deps.rates
    ? { ...options, ratesHistory: true, cashRate: mean(cashAt, months.slice(0, -1)), hurdle: mean(hurdleAt) }
    : options;

  const base = options.profile === "global" ? PROFILE_GLOBAL : PROFILE_FOCUSED;
  const profile = { ...base, minReturn: options.hurdle, swapThreshold: options.swap ?? base.swapThreshold };
  const common = {
    months,
    candidates: set.byMonth,
    returnOf,
    profile,
    cost: options.cost,
    cashRate: options.cashRate,
    ...(deps.rates ? { cashRateAt: cashAt, minReturnAt: hurdleAt } : {}),
    every: options.every,
  };
  const years = yearsBetween(dateOf(months[0]!), options.endDate);

  const main = simulate({ ...common, trades: true });
  const benchmark = deps.benchmark ? benchmarkValues(deps.benchmark, months, dateOf) : null;

  const starts = windowStarts(months.length, options.windowMonths, REBALANCE_STEP_MONTHS);
  const windows: WindowResult[] = starts.map((s) => {
    const to = s + options.windowMonths;
    const run = simulate({ ...common, from: s, to });
    const m = metrics(run.values, options.windowMonths / 12);
    return {
      start: months[s]!,
      strategy: { total: m.total, vol: m.vol, maxDrawdown: m.maxDrawdown, turnover: run.turnover },
      benchmark: benchmark ? benchmark[to]! / benchmark[s]! - 1 : null,
      // Verzinst wird ab dem zweiten Monat des Fensters mit dem Zins des Vormonats.
      ...(deps.rates ? { cashRate: mean(cashAt, months.slice(s, to)) } : {}),
    };
  });

  let random: BacktestSummary["random"] = null;
  const sims: ReturnType<typeof simulate>[] = [];
  if (options.randomRuns > 0) {
    for (let k = 0; k < options.randomRuns; k++) sims.push(simulate({ ...common, random: randomScores(5000 + k) }));
    const column = (i: number) => sims.map((v) => v.values[i]!);
    const lastIndex = months.length - 1;
    const strategyEnd = main.values[lastIndex]!;
    random = {
      runs: sims.length,
      median: months.map((_, i) => median(column(i))),
      p5: months.map((_, i) => quantile(column(i), 0.05)),
      p95: months.map((_, i) => quantile(column(i), 0.95)),
      shareBeatingStrategy: sims.filter((v) => v.values[lastIndex]! >= strategyEnd).length / sims.length,
      turnover: median(sims.map((v) => v.turnover)),
      shareBeatingBenchmark: benchmark ? sims.filter((v) => v.values[lastIndex]! >= benchmark[lastIndex]!).length / sims.length : null,
    };
  }

  const periods = thirds(months.length).map(([a, b]) => ({
    label: `${months[a]} bis ${months[b]}`,
    strategy: main.values[b]! / main.values[a]! - 1,
    benchmark: benchmark ? benchmark[b]! / benchmark[a]! - 1 : null,
    randomMedian: random ? random.median[b]! / random.median[a]! - 1 : null,
  }));

  return {
    name: deps.name,
    meta: {
      erstelltAm: (deps.now ?? new Date()).toISOString(),
      rechenversion: CALC_VERSION,
      optionen: used,
      vergleichsindex: deps.benchmark?.symbol ?? null,
    },
    months,
    strategy: main.values,
    benchmark,
    full: {
      strategy: { ...metrics(main.values, years), turnover: main.turnover, holdings: main.holdings },
      benchmark: benchmark ? metrics(benchmark, years) : null,
    },
    periods,
    windows,
    random,
    trades: main.trades,
    candidatesPerDate: Object.fromEntries(rebalanceMonths.map((m) => [m, set.byMonth.get(m)!.length])),
    diagnostics: {
      skipped: set.skipped,
      delistings,
      outliers: main.outliers,
      stocksWithBars: set.bars.size,
      ...(deps.rates ? { ratesFallback } : {}),
    },
  };
}

function benchmarkValues(series: PriceSeries, months: readonly string[], dateOf: (month: string) => string): number[] | null {
  const start = closeAtOrBefore(series, dateOf(months[0]!));
  if (start === null) return null;
  const values = months.map((m) => closeAtOrBefore(series, dateOf(m)));
  return values.some((v) => v === null) ? null : values.map((v) => (v! / start) * 100);
}
