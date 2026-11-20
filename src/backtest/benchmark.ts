// Vergleichsindex: Kurse eines thesaurierenden Indexfonds in Euro (Standard: iShares Core MSCI World, EUNL.DE).
// Quelle ist die inoffizielle Chart-Schnittstelle von Yahoo Finance; sie kann sich ändern. Fehlt der Index, läuft der
// Rückblick ohne Vergleich weiter.

import { z } from "zod";

export interface PriceSeries {
  symbol: string;
  /** Aufsteigend nach Datum. */
  points: readonly { date: string; close: number }[];
}

const Chart = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          timestamp: z.array(z.number()),
          indicators: z.object({ quote: z.array(z.object({ close: z.array(z.number().nullable()) })).min(1) }),
        }),
      )
      .min(1),
  }),
});

export const DEFAULT_BENCHMARK = "EUNL.DE";

export function parseChart(symbol: string, json: unknown): PriceSeries {
  const result = Chart.parse(json).chart.result[0]!;
  const closes = result.indicators.quote[0]!.close;
  const points = result.timestamp.flatMap((t, i) => {
    const close = closes[i];
    return close != null && close > 0 ? [{ date: new Date(t * 1000).toISOString().slice(0, 10), close }] : [];
  });
  if (points.length === 0) throw new Error(`Vergleichsindex ${symbol}: keine Kurse gefunden`);
  return { symbol, points };
}

export async function fetchChart(symbol: string, from: string, fetchFn: typeof fetch = fetch): Promise<unknown> {
  const period1 = Math.floor(Date.parse(`${from}-01`) / 1000) - 40 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${Math.floor(Date.now() / 1000) + 86400}&interval=1d`;
  const response = await fetchFn(url, { headers: { "User-Agent": "investing-backtest" } });
  if (!response.ok) throw new Error(`Vergleichsindex ${symbol}: HTTP ${response.status}`);
  return response.json();
}

/** Letzter Schlusskurs am Tag oder davor; `null`, wenn die Reihe später beginnt. */
export function closeAtOrBefore(series: PriceSeries, date: string): number | null {
  let low = 0;
  let high = series.points.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (series.points[mid]!.date <= date) {
      best = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return best < 0 ? null : series.points[best]!.close;
}
