// Nachgebautes EODHD für Tests: Antworten je Pfad, mitgezählte Abrufe.

import type { Database } from "../data/db.ts";
import type { JobContext } from "../jobs/context.ts";

type Handler = (url: URL) => Response | Promise<Response>;

/** `routes`: Pfad nach /api/ (z. B. "fundamentals/IMB.LSE") oder dessen Anfang mit "*" am Ende. */
export function fakeEodhd(routes: Record<string, Handler | unknown>): typeof fetch & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\//, "");
    // Die Kontoabfrage kostet nichts und läuft vor großen Läufen; sie bleibt aus der Liste der Abrufe.
    if (path !== "user") calls.push(path);
    const key = Object.keys(routes).find((k) => (k.endsWith("*") ? path.startsWith(k.slice(0, -1)) : k === path));
    if (key === undefined) return new Response("not found", { status: 404 });
    const route = routes[key];
    return typeof route === "function" ? (route as Handler)(url) : Response.json(route);
  }) as typeof fetch & { calls: string[] };
  fn.calls = calls;
  return fn;
}

export const status = (code: number) => () => new Response("", { status: code });

/** Minimale Fundamentaldaten: drei Jahre, 10 Aktien, Sitz in den USA. */
export function fundamentalsAnswer(name = "Test Corp", years = [2023, 2024, 2025]) {
  const yearly = (make: (y: number) => object) => Object.fromEntries(years.map((y) => [`${y}-12-31`, make(y)]));
  return {
    General: {
      Name: name,
      Type: "Common Stock",
      CurrencyCode: "USD",
      CountryISO: "US",
      Sector: "Technology",
      GicSector: "Information Technology",
      AddressData: { Country: "United States" },
    },
    Financials: {
      Income_Statement: {
        currency_symbol: "USD",
        yearly: yearly((y) => ({ netIncome: String(y - 2000), totalRevenue: "1000", ebit: "150" })),
      },
      Balance_Sheet: {
        yearly: yearly(() => ({ commonStockSharesOutstanding: "10", totalAssets: "5000", totalStockholderEquity: "2000" })),
      },
      Cash_Flow: { yearly: yearly(() => ({ dividendsPaid: "-20", freeCashFlow: "40" })) },
    },
  };
}

/** Kontext mit gesammeltem Protokoll und Fortschritt. */
export function testContext(db: Database, fetchFn: typeof fetch, overrides: Partial<JobContext> = {}) {
  const log: string[] = [];
  const progress: [number, number][] = [];
  const ctx: JobContext = {
    db,
    token: "test-token",
    fetchFn,
    today: "2026-11-19",
    log: (line) => log.push(line),
    progress: (done, total) => progress.push([done, total]),
    shouldStop: () => false,
    ...overrides,
  };
  return { ctx, log, progress };
}
