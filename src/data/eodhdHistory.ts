// Dividenden, Aktiensplits und Kurshistorie von EODHD (Tarif mit Kursdaten nötig, je ein Abruf).

import { EodhdError } from "./eodhd.ts";

export interface DividendPayment {
  /** Ex-Tag. */
  date: string;
  /** Je Aktie, um spätere Splits bereinigt. */
  value: number;
  currency: string;
  /** Art laut Anbieter, z. B. "Quarterly" oder "Special"; leer, wenn unbekannt. */
  period: string;
}

export interface Split {
  date: string;
  /** Neue Aktien je alter Aktie, z. B. 5 bei einem Split 5:1. */
  ratio: number;
}

export interface MonthlyClose {
  /** Letzter Handelstag des Monats. */
  date: string;
  close: number;
  /** Um Splits und Dividenden bereinigt. */
  adjustedClose: number;
}

async function getRows(path: string, token: string, query: Record<string, string>, fetchFn: typeof fetch): Promise<Record<string, unknown>[]> {
  const url = new URL(`https://eodhd.com/api/${path}`);
  for (const [key, value] of Object.entries({ ...query, api_token: token, fmt: "json" })) url.searchParams.set(key, value);
  const response = await fetchFn(url);
  if (!response.ok) throw new EodhdError(response.status, path);
  const rows = await response.json();
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function fetchDividends(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<DividendPayment[]> {
  const rows = await getRows(`div/${encodeURIComponent(symbol)}`, token, { from: "1990-01-01" }, fetchFn);
  return rows
    .filter((r) => isDate(r.date) && typeof r.value === "number" && r.value > 0)
    .map((r) => ({ date: r.date as string, value: r.value as number, currency: String(r.currency ?? ""), period: String(r.period ?? "") }));
}

export async function fetchSplits(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<Split[]> {
  const rows = await getRows(`splits/${encodeURIComponent(symbol)}`, token, { from: "1990-01-01" }, fetchFn);
  const result: Split[] = [];
  for (const row of rows) {
    const [after, before] = String(row.split ?? "").split("/").map(Number);
    if (isDate(row.date) && after && before && after > 0 && before > 0) result.push({ date: row.date, ratio: after / before });
  }
  return result;
}

export async function fetchMonthlyCloses(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<MonthlyClose[]> {
  const rows = await getRows(`eod/${encodeURIComponent(symbol)}`, token, { from: "1990-01-01", period: "m" }, fetchFn);
  return rows
    .filter((r) => isDate(r.date) && typeof r.close === "number")
    .map((r) => ({ date: r.date as string, close: r.close as number, adjustedClose: typeof r.adjusted_close === "number" ? r.adjusted_close : (r.close as number) }));
}

/** Letzte Schlusskurse aller Titel einer Börse in einem Abruf (zählt beim Anbieter als 100 Abrufe). Schlüssel: Symbol mit Börse. */
export async function fetchBulkLastDay(exchange: string, token: string, fetchFn: typeof fetch = fetch): Promise<Map<string, { date: string; close: number }>> {
  const rows = await getRows(`eod-bulk-last-day/${encodeURIComponent(exchange)}`, token, {}, fetchFn);
  const result = new Map<string, { date: string; close: number }>();
  for (const row of rows) {
    if (typeof row.code === "string" && isDate(row.date) && typeof row.close === "number" && row.close > 0) {
      result.set(`${row.code}.${exchange}`, { date: row.date, close: row.close });
    }
  }
  return result;
}
