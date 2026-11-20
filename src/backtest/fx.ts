// Euro-Referenzkurse der EZB als Tagesreihe, für Kurse und Renditen in früheren Jahren.

import { z } from "zod";

/** Einheiten je Euro, je Währung aufsteigend nach Datum. */
export type FxHistory = ReadonlyMap<string, readonly { date: string; rate: number }[]>;

const ECB_HISTORY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml";

const Day = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive().finite()),
});

/** Parst die Historie der EZB (`eurofxref-hist.xml`). Wirft, wenn nichts Brauchbares darin steht oder ein Datum nicht stimmt. */
export function parseEcbHistory(xml: string): FxHistory {
  const history = new Map<string, { date: string; rate: number }[]>();
  let days = 0;
  for (const match of xml.matchAll(/<Cube time=['"]([^'"]+)['"]>([\s\S]*?)<\/Cube>/g)) {
    const rates: Record<string, number> = {};
    for (const rate of match[2]!.matchAll(/currency=['"]([^'"]+)['"]\s+rate=['"]([^'"]+)['"]/g)) {
      // Einzelne Währungen ohne Kurs an einem Tag ("N/A") überspringen, statt die ganze Historie zu verwerfen.
      const value = Number(rate[2]);
      if (Number.isFinite(value) && value > 0) rates[rate[1]!] = value;
    }
    const day = Day.parse({ date: match[1], rates });
    days++;
    for (const [currency, rate] of Object.entries(day.rates)) {
      const series = history.get(currency) ?? [];
      series.push({ date: day.date, rate });
      history.set(currency, series);
    }
  }
  if (days === 0) throw new Error("EZB-Historie: keine Kurse gefunden");
  for (const series of history.values()) series.sort((a, b) => a.date.localeCompare(b.date));
  return history;
}

export async function fetchEcbHistory(fetchFn: typeof fetch = fetch): Promise<string> {
  const response = await fetchFn(ECB_HISTORY_URL);
  if (!response.ok) throw new Error(`EZB-Historie: HTTP ${response.status}`);
  return response.text();
}

const MAJOR_OF: Record<string, string> = { GBX: "GBP", ILA: "ILS", ZAC: "ZAR" };

/**
 * Einheiten der Währung je Euro am Tag oder zuletzt davor, höchstens `maxAgeDays` zurück (Wochenenden, Feiertage).
 * `null` für Währungen ohne EZB-Kurs und wenn der Kurs zu alt ist.
 */
export function fxPerEur(history: FxHistory, currency: string, date: string, maxAgeDays = 10): number | null {
  const code = MAJOR_OF[currency] ?? currency;
  if (code === "EUR") return 1;
  const series = history.get(code);
  if (!series) return null;
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
