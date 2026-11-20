// Testdaten für den Rückblick: Aktien mit so vielen Aktien, dass der Marktwert über der Grenze liegt.

import type { Bar, StockData } from "../backtest/candidates.ts";
import type { FundamentalsYear } from "../data/db.ts";
import { steadyYears, stock } from "./fixtures.ts";

const MONEY_FIELDS = [
  "revenue",
  "ebit",
  "ebitda",
  "totalAssets",
  "equity",
  "currentAssets",
  "currentLiabilities",
  "operatingCashFlow",
  "freeCashFlow",
  "repurchases",
] as const;

/** Zehn ruhige Jahre mit `shares` Aktien; die absoluten Posten wachsen mit, je Aktie bleibt alles gleich (steadyYears hat 100). */
export function scaledYears(shares: number, change: (year: FundamentalsYear) => void = () => {}): FundamentalsYear[] {
  const f = shares / 100;
  return steadyYears((y) => {
    y.shares = shares;
    for (const field of MONEY_FIELDS) y[field] = (y[field] ?? 0) * f;
    change(y);
  });
}

export function monthBars(months: readonly string[], close = 40): Map<string, Bar> {
  return new Map(months.map((m) => [m, { close, adjustedClose: close }]));
}

export function stockData(id: string, months: readonly string[], over: Partial<StockData> = {}, shares = 1e9): StockData {
  return {
    stock: { ...stock, id, watched: false },
    fundamentals: scaledYears(shares),
    dividends: null,
    splits: [],
    bars: monthBars(months),
    ...over,
  };
}
