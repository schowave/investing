import { describe, expect, it } from "vitest";
import { EodhdError, fetchDailyCloses } from "./eodhd.ts";

function fakeFetch(status: number, body: unknown, seen: string[] = []): typeof fetch {
  return (async (input: URL | RequestInfo) => {
    seen.push(String(input));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe("EODHD", () => {
  it("liest Datum und Schlusskurs und fragt den Zeitraum ab", async () => {
    const seen: string[] = [];
    const rows = [{ date: "2026-11-18", open: 1, high: 2, low: 1, close: 29.5, adjusted_close: 29.5, volume: 10 }];
    const closes = await fetchDailyCloses("IMB.LSE", "2026-11-11", "2026-11-18", "geheim", fakeFetch(200, rows, seen));
    expect(closes).toEqual([{ date: "2026-11-18", close: 29.5 }]);
    expect(seen[0]).toContain("/eod/IMB.LSE?");
    expect(seen[0]).toContain("from=2026-11-11");
  });

  it("meldet HTTP-Fehler ohne den Token", async () => {
    const failure = fetchDailyCloses("X.US", "2026-11-11", "2026-11-18", "geheim", fakeFetch(403, {}));
    await expect(failure).rejects.toBeInstanceOf(EodhdError);
    await expect(failure).rejects.not.toThrow(/geheim/);
  });

  it("weist unvollständige Zeilen zurück", async () => {
    const failure = fetchDailyCloses("X.US", "2026-11-11", "2026-11-18", "t", fakeFetch(200, [{ date: "2026-11-18" }]));
    await expect(failure).rejects.toThrow(/Schlusskurs/);
  });
});
