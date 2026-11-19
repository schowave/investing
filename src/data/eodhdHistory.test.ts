import { describe, expect, it } from "vitest";
import { Database } from "./db.ts";
import { fetchBulkLastDay, fetchDividends, fetchMonthlyCloses, fetchSplits } from "./eodhdHistory.ts";

const answer = (rows: unknown) => (async () => Response.json(rows)) as unknown as typeof fetch;

describe("Historie von EODHD", () => {
  it("liest Dividenden und überspringt Zeilen ohne Betrag", async () => {
    const rows = [
      { date: "2025-02-20", period: "Quarterly", value: 0.4026, unadjustedValue: 40.26, currency: "GBP" },
      { date: "2025-05-22", period: null, value: 0, currency: "GBP" },
      { date: "kaputt", value: 1, currency: "GBP" },
    ];
    expect(await fetchDividends("IMB.LSE", "t", answer(rows))).toEqual([
      { date: "2025-02-20", value: 0.4026, currency: "GBP", period: "Quarterly" },
    ]);
  });

  it("liest Splits als Verhältnis neu zu alt", async () => {
    const rows = [
      { date: "2025-02-11", split: "5.000000/1.000000" },
      { date: "2020-01-02", split: "1/10" },
      { date: "2019-01-01", split: "unklar" },
    ];
    expect(await fetchSplits("SAMPO.HE", "t", answer(rows))).toEqual([
      { date: "2025-02-11", ratio: 5 },
      { date: "2020-01-02", ratio: 0.1 },
    ]);
  });

  it("liest Monatskurse und den Sammelabruf einer Börse", async () => {
    expect(await fetchMonthlyCloses("IMB.LSE", "t", answer([{ date: "2000-01-31", close: 429.5, adjusted_close: 80.5 }]))).toEqual([
      { date: "2000-01-31", close: 429.5, adjustedClose: 80.5 },
    ]);
    const bulk = await fetchBulkLastDay(
      "XETRA",
      "t",
      answer([
        { code: "BAS", date: "2026-11-18", close: 51.19 },
        { code: "X", date: "2026-11-18", close: 0 },
      ]),
    );
    expect([...bulk]).toEqual([["BAS.XETRA", { date: "2026-11-18", close: 51.19 }]]);
  });

  it("meldet einen gesperrten Abruf ohne den Token", async () => {
    const blocked = (async () => new Response("", { status: 403 })) as unknown as typeof fetch;
    await expect(fetchDividends("IMB.LSE", "geheim", blocked)).rejects.toThrow(/HTTP 403/);
    await expect(fetchDividends("IMB.LSE", "geheim", blocked)).rejects.not.toThrow(/geheim/);
  });

  it("speichert die Historie und unterscheidet leer von nie geladen", () => {
    const db = new Database(":memory:");
    const base = {
      name: "T",
      sector: "S",
      region: "Europa",
      country: "DE",
      reportingCurrency: "EUR",
      priceCurrency: "EUR",
      priceDivisor: 1,
      foundedYear: null,
      isFinancial: false,
      watched: true,
    };
    db.addStockIfMissing({ ...base, id: "A.XETRA" });
    db.addStockIfMissing({ ...base, id: "B.XETRA" });
    expect(db.dividends("A.XETRA")).toBeNull();
    db.saveDividends("A.XETRA", []);
    db.saveDividends("B.XETRA", [{ date: "2025-05-02", value: 2.25, currency: "EUR", period: "Annual" }]);
    expect(db.dividends("A.XETRA")).toEqual([]);
    expect(db.dividends("B.XETRA")).toHaveLength(1);
    db.saveSplits("A.XETRA", [{ date: "2025-02-11", ratio: 5 }]);
    expect(db.splits("A.XETRA")).toEqual([{ date: "2025-02-11", ratio: 5 }]);
    db.saveMonthlyPrices("A.XETRA", [
      { date: "2025-01-31", close: 10, adjustedClose: 9 },
      { date: "2025-02-28", close: 11, adjustedClose: 10 },
    ]);
    expect(db.monthlyPrices("A.XETRA").map((m) => m.month)).toEqual(["2025-01", "2025-02"]);
    expect([...db.stockIdsWithHistory("splits")]).toEqual(["A.XETRA"]);
    db.close();
  });
});
