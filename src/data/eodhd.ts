// Tagesschlusskurse von EODHD. Der Token wird nie in Fehlermeldungen ausgegeben.

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
  return rows.map((row: { date?: unknown; close?: unknown }) => {
    if (typeof row.date !== "string" || typeof row.close !== "number") {
      throw new Error(`EODHD eod/${symbol}: Zeile ohne Datum oder Schlusskurs`);
    }
    return { date: row.date, close: row.close };
  });
}

/** Tageslimit und Verbrauch des Kontos. */
export async function fetchAccount(token: string, fetchFn: Fetch = fetch): Promise<EodhdAccount> {
  const data = (await getJson("user", token, {}, fetchFn)) as Record<string, unknown>;
  return {
    dailyRateLimit: Number(data.dailyRateLimit),
    requestsToday: Number(data.apiRequests),
    subscription: String(data.subscriptionType ?? "unbekannt"),
  };
}
