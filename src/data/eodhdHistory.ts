// Dividenden, Aktiensplits und Kurshistorie von EODHD (Tarif mit Kursdaten nötig, je ein Abruf).

import { z } from "zod";
import { EodhdError, IsoDate } from "./eodhd.ts";

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

async function getRows(
  path: string,
  token: string,
  query: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<Record<string, unknown>[]> {
  const url = new URL(`https://eodhd.com/api/${path}`);
  for (const [key, value] of Object.entries({ ...query, api_token: token, fmt: "json" })) url.searchParams.set(key, value);
  const response = await fetchFn(url);
  if (!response.ok) throw new EodhdError(response.status, path);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

/** Gültige Zeilen nach dem Schema; unbrauchbare (fehlendes Datum, Betrag 0) überspringt der Anbieter-Abruf. */
function valid<T extends z.ZodType>(schema: T, rows: unknown[]): z.infer<T>[] {
  return rows.flatMap((row) => {
    const parsed = schema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

const positive = z.number().finite().positive();
const DividendRow = z.object({ date: IsoDate, value: positive, currency: z.string().nullish(), period: z.string().nullish() });
/** Verhältnis als Text "neu/alt", z. B. "5.000000/1.000000". */
const SplitRow = z.object({ date: IsoDate, split: z.string().regex(/^[0-9.]+\/[0-9.]+$/) });
const MonthlyRow = z.object({ date: IsoDate, close: z.number().finite(), adjusted_close: z.number().finite().nullish() });
const BulkRow = z.object({ code: z.string(), date: IsoDate, close: positive });

export async function fetchDividends(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<DividendPayment[]> {
  const rows = await getRows(`div/${encodeURIComponent(symbol)}`, token, { from: "1990-01-01" }, fetchFn);
  return valid(DividendRow, rows).map((r) => ({ date: r.date, value: r.value, currency: r.currency ?? "", period: r.period ?? "" }));
}

export async function fetchSplits(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<Split[]> {
  const rows = await getRows(`splits/${encodeURIComponent(symbol)}`, token, { from: "1990-01-01" }, fetchFn);
  return valid(SplitRow, rows).flatMap((row) => {
    const [after, before] = row.split.split("/").map(Number);
    return after && before && after > 0 && before > 0 ? [{ date: row.date, ratio: after / before }] : [];
  });
}

export async function fetchMonthlyCloses(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<MonthlyClose[]> {
  const rows = await getRows(`eod/${encodeURIComponent(symbol)}`, token, { from: "1990-01-01", period: "m" }, fetchFn);
  return valid(MonthlyRow, rows).map((r) => ({ date: r.date, close: r.close, adjustedClose: r.adjusted_close ?? r.close }));
}

/** Letzte Schlusskurse aller Titel einer Börse in einem Abruf (zählt beim Anbieter als 100 Abrufe). Schlüssel: Symbol mit Börse. */
export async function fetchBulkLastDay(
  exchange: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, { date: string; close: number }>> {
  const rows = await getRows(`eod-bulk-last-day/${encodeURIComponent(exchange)}`, token, {}, fetchFn);
  const result = new Map<string, { date: string; close: number }>();
  for (const row of valid(BulkRow, rows)) result.set(`${row.code}.${exchange}`, { date: row.date, close: row.close });
  return result;
}
