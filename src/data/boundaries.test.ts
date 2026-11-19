// Was die Prüfungen mit zod an den Grenzen zu EODHD und IWF abfangen.
import { describe, expect, it } from "vitest";
import { fetchAccount } from "./eodhd.ts";
import { parseEodhdFundamentals, searchEodhd } from "./eodhdFundamentals.ts";
import { fetchMonthlyCloses, fetchSplits } from "./eodhdHistory.ts";
import { parseInflationForecasts } from "./reference.ts";

const answer = (body: unknown) => (async () => Response.json(body)) as unknown as typeof fetch;

describe("Prüfung der Antworten", () => {
  it("liest das Konto und weist eine Antwort ohne Verbrauch zurück, statt mit NaN zu rechnen", async () => {
    expect(await fetchAccount("t", answer({ dailyRateLimit: "100000", apiRequests: 12 }))).toEqual({
      dailyRateLimit: 100000,
      requestsToday: 12,
      subscription: "unbekannt",
    });
    await expect(fetchAccount("t", answer({ dailyRateLimit: 100000 }))).rejects.toThrow(/unerwartete Antwort/);
  });

  it("überspringt Suchtreffer ohne Symbol oder Börse", async () => {
    const hits = await searchEodhd(
      "imb",
      "t",
      answer([{ Code: "IMB", Exchange: "LSE", Name: "Imperial", ISIN: "", previousClose: 0 }, { Name: "ohne Code" }, "Unsinn"]),
    );
    expect(hits).toEqual([
      {
        symbol: "IMB.LSE",
        name: "Imperial",
        exchange: "LSE",
        type: "",
        isin: null,
        isPrimary: false,
        previousClose: null,
        previousCloseDate: null,
      },
    ]);
    expect(await searchEodhd("x", "t", answer({ error: "kein Array" }))).toEqual([]);
  });

  it("liest Fundamentaldaten mit falsch geformten Teilen als leer", () => {
    expect(parseEodhdFundamentals("Ticker Not Found").years).toEqual([]);
    const parsed = parseEodhdFundamentals({
      General: "kaputt",
      Financials: { Income_Statement: { currency_symbol: "EUR", yearly: { "2025-12-31": { netIncome: "10" } } }, Balance_Sheet: 7 },
    });
    expect(parsed.reportingCurrency).toBe("EUR");
    expect(parsed.name).toBeNull();
    expect(parsed.years.map((y) => y.fiscalYear)).toEqual([2025]);
  });

  it("überspringt Split- und Monatszeilen mit falschem Format", async () => {
    expect(
      await fetchSplits(
        "X",
        "t",
        answer([
          { date: "2025-01-02", split: "2/1" },
          { date: "2025-01-03", split: 2 },
        ]),
      ),
    ).toEqual([{ date: "2025-01-02", ratio: 2 }]);
    expect(
      await fetchMonthlyCloses(
        "X",
        "t",
        answer([
          { date: "2025-01-31", close: "5" },
          { date: "2025-02-28", close: 6 },
        ]),
      ),
    ).toEqual([{ date: "2025-02-28", close: 6, adjustedClose: 6 }]);
  });

  it("liest Inflationsprognosen und ignoriert unbrauchbare Werte", () => {
    const data = { values: { PCPIPCH: { EURO: { "2027": 2, "2028": "zwei", "2029": 2.4 } } } };
    expect(parseInflationForecasts(data, 2026).EUR).toBeCloseTo(0.022);
    expect(parseInflationForecasts("Fehler", 2026)).toEqual({});
  });
});
