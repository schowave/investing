// Tagesschlusskurse von EODHD. Der Token wird nie in Fehlermeldungen ausgegeben.
// Antworten werden mit zod geprüft: Was nicht passt, fällt hier auf und nicht erst in der Bewertung.

import { z } from "zod";

export interface DailyClose {
  /** ISO-Datum, z. B. 2026-11-18. */
  date: string;
  close: number;
}

export interface EodhdAccount {
  dailyRateLimit: number;
  requestsToday: number;
  subscription: string;
}

type Fetch = typeof fetch;

/** ISO-Datum, wie EODHD es liefert. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const DailyCloseRow = z.object({ date: IsoDate, close: z.number().finite() });

const AccountAnswer = z.object({
  dailyRateLimit: z.coerce.number().finite(),
  apiRequests: z.coerce.number().finite(),
  subscriptionType: z.string().optional(),
});

const BASE_URL = "https://eodhd.com/api";

export class EodhdError extends Error {
  readonly status: number;
  constructor(status: number, what: string) {
    super(`EODHD ${what}: HTTP ${status}`);
    this.status = status;
  }
}

async function getJson(path: string, token: string, query: Record<string, string>, fetchFn: Fetch): Promise<unknown> {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries({ ...query, api_token: token, fmt: "json" })) {
    url.searchParams.set(key, value);
  }
  const response = await fetchFn(url);
  if (!response.ok) throw new EodhdError(response.status, path);
  return response.json();
}

/** Schlusskurse für ein Symbol wie `IMB.LSE` im Zeitraum, ältester zuerst. */
export async function fetchDailyCloses(
  symbol: string,
  from: string,
  to: string,
  token: string,
  fetchFn: Fetch = fetch,
): Promise<DailyClose[]> {
  const rows = await getJson(`eod/${encodeURIComponent(symbol)}`, token, { from, to, period: "d" }, fetchFn);
  if (!Array.isArray(rows)) throw new Error(`EODHD eod/${symbol}: unerwartete Antwort`);
  return rows.map((row) => {
    const parsed = DailyCloseRow.safeParse(row);
    if (!parsed.success) throw new Error(`EODHD eod/${symbol}: Zeile ohne Datum oder Schlusskurs`);
    return { date: parsed.data.date, close: parsed.data.close };
  });
}

/** Tageslimit und Verbrauch des Kontos. */
export async function fetchAccount(token: string, fetchFn: Fetch = fetch): Promise<EodhdAccount> {
  const parsed = AccountAnswer.safeParse(await getJson("user", token, {}, fetchFn));
  if (!parsed.success) throw new Error("EODHD user: unerwartete Antwort");
  return {
    dailyRateLimit: parsed.data.dailyRateLimit,
    requestsToday: parsed.data.apiRequests,
    subscription: parsed.data.subscriptionType ?? "unbekannt",
  };
}
