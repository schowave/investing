// Zinsreihen der EZB (Zinsstrukturkurve, AAA-Staatsanleihen) für den Rückblick: die Hürde der inneren Rendite folgt dem
// Zehnjahreszins, das Bargeld dem Dreimonatszins des jeweiligen Stichtags statt dem Wert von heute.

import { z } from "zod";

/** Zinssätze als Anteil, aufsteigend nach Datum. */
export type RateSeries = readonly { date: string; rate: number }[];

export type RateMaturity = "SR_10Y" | "SR_3M";

const Row = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), value: z.number().finite() });

const ecbUrl = (maturity: RateMaturity, from: string) =>
  `https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.${maturity}?startPeriod=${from}&format=csvdata`;

/**
 * Parst die CSV der EZB. Die Spalten `TIME_PERIOD` und `OBS_VALUE` stehen vor den Textspalten mit Kommas, einfaches Trennen genügt.
 * Wirft bei unerwarteter Form; Tage ohne Wert (leere Zelle) werden übersprungen.
 */
export function parseEcbRates(csv: string): RateSeries {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = header?.split(",") ?? [];
  const t = columns.indexOf("TIME_PERIOD");
  const v = columns.indexOf("OBS_VALUE");
  if (t < 0 || v < 0) throw new Error("EZB-Zinsreihe: unerwartete Antwort");
  const points = lines.flatMap((line) => {
    const cells = line.split(",");
    if (cells[v] === undefined || cells[v] === "") return [];
    const row = Row.parse({ date: cells[t], value: Number(cells[v]) });
    return [{ date: row.date, rate: row.value / 100 }];
  });
  if (points.length === 0) throw new Error("EZB-Zinsreihe: keine Werte gefunden");
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchEcbRates(maturity: RateMaturity, from: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const response = await fetchFn(ecbUrl(maturity, from), { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`EZB-Zinsreihe ${maturity}: HTTP ${response.status}`);
  return response.text();
}

/** Letzter Wert am Tag oder davor, höchstens `maxAgeDays` zurück; sonst `null`. */
export function rateAt(series: RateSeries, date: string, maxAgeDays = 10): number | null {
  let low = 0;
  let high = series.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (series[mid]!.date <= date) {
      best = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  if (best < 0) return null;
  const oldest = new Date(Date.parse(date) - maxAgeDays * 864e5).toISOString().slice(0, 10);
  return series[best]!.date < oldest ? null : series[best]!.rate;
}
