import { describe, expect, it } from "vitest";
import { stock } from "../test/fixtures.ts";
import { Database } from "./db.ts";
import { FUNDAMENTALS_KIND, parseEodhdSnapshot, storedSnapshot } from "./eodhdSnapshot.ts";

describe("parseEodhdSnapshot", () => {
  it("liest Zahlen aus Text, verwirft Einträge in fremder Form und nimmt die Branche ersatzweise aus GIC", () => {
    const snapshot = parseEodhdSnapshot(
      JSON.stringify({
        General: {
          CIK: 1683695,
          GicIndustry: "Payments",
          FullTimeEmployees: "1200",
          Officers: [{ Name: "A. Boss", Title: "CEO" }, { Name: "" }, "kaputt"],
        },
        Technicals: { "52WeekHigh": "15.95" },
        Highlights: { QuarterlyRevenueGrowthYOY: "" },
        Earnings: {
          History: { a: { date: "2026-09-30", epsActual: "0.32", epsEstimate: 0.22 }, b: { epsActual: 1 } },
          Trend: {
            "2026-12-31": {
              period: "0y",
              earningsEstimateNumberOfAnalysts: "13.0000",
              epsTrendCurrent: "3.99",
              epsTrend30daysAgo: "4.04",
              epsTrend90daysAgo: null,
            },
            kaputt: 5,
          },
        },
        InsiderTransactions: { "0": { date: "2026-03-01", ownerName: " B ", transactionAmount: "10" } },
        AnalystRatings: { Rating: 4.1, TargetPrice: "x" },
      }),
    );
    expect(snapshot).toEqual({
      cik: "1683695",
      week52High: 15.95,
      quarterlyRevenueGrowth: null,
      earnings: [{ date: "2026-09-30", epsActual: 0.32, epsEstimate: 0.22, surprisePercent: null }],
      company: { industry: "Payments", ipoDate: null, employees: 1200, description: null, officers: ["A. Boss, CEO"] },
      insiderTransactions: [
        { date: "2026-03-01", owner: "B", acquiredDisposed: null, code: null, amount: 10, price: null, heldAfter: null },
      ],
      analystRatings: { rating: 4.1, targetPrice: null },
      estimateTrend: [{ period: "0y", analysts: 13, current: 3.99, daysAgo: { 7: null, 30: 4.04, 60: null, 90: null } }],
    });
  });

  it("macht aus einer kaputten oder fremden Antwort eine leere Momentaufnahme", () => {
    const empty = parseEodhdSnapshot("kein json");
    expect(empty).toMatchObject({ cik: null, week52High: null, earnings: [], insiderTransactions: [], analystRatings: null });
    expect(parseEodhdSnapshot('"Fehlermeldung"')).toEqual(empty);
    expect(parseEodhdSnapshot(JSON.stringify({ General: "x", Earnings: [], InsiderTransactions: 5 }))).toEqual(empty);
  });

  it("liest die gespeicherte Antwort einer Aktie", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    expect(storedSnapshot(db, stock.id)).toBeNull();
    db.saveRawDocument(stock.id, FUNDAMENTALS_KIND, JSON.stringify({ General: { CIK: "0001" } }));
    expect(storedSnapshot(db, stock.id)?.cik).toBe("0001");
    db.close();
  });
});
