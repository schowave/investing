import { describe, expect, it } from "vitest";
import { situationSignals } from "./situation.ts";

// Gekürzt aus den Rohdaten von International Money Express (IMXI.US), Stand 18.11.2026.
const imxi = JSON.stringify({
  Technicals: { "52WeekHigh": 15.95 },
  Highlights: { QuarterlyRevenueGrowthYOY: -0.184 },
  Earnings: {
    History: {
      "2026-12-31": { date: "2026-12-31", epsActual: null, epsEstimate: 0.2, surprisePercent: null },
      "2026-09-30": { date: "2026-09-30", epsActual: 0.32, epsEstimate: 0.22, surprisePercent: 45.45 },
      "2026-06-30": { date: "2026-06-30", epsActual: 0.17, epsEstimate: 0.51, surprisePercent: -66.67 },
      "2026-03-31": { date: "2026-03-31", epsActual: 0.13, epsEstimate: 0.35, surprisePercent: -63.26 },
      "2025-12-31": { date: "2025-12-31", epsActual: 0.42, epsEstimate: 0.44, surprisePercent: -4.55 },
      "2025-09-30": { date: "2025-09-30", epsActual: 0.38, epsEstimate: 0.53, surprisePercent: -28.3 },
    },
  },
});

describe("situationSignals", () => {
  it("schlägt bei IMXI dreifach an", () => {
    expect(situationSignals({ fundamentalsJson: imxi, price: 5.79, isFinancial: false })).toEqual([
      { kind: "drawdown", text: "Der Kurs liegt 64 % unter dem 52-Wochen-Hoch." },
      { kind: "misses", text: "2 der letzten 4 Quartale lagen mehr als 15 % unter der Gewinnschätzung, zuletzt bis zu 67 %." },
      { kind: "revenue", text: "Der Umsatz des letzten Quartals lag 18 % unter dem Vorjahresquartal." },
    ]);
  });

  it("prüft bei Finanzwerten den Umsatz nicht", () => {
    expect(situationSignals({ fundamentalsJson: imxi, price: 5.79, isFinancial: true }).map((s) => s.kind)).toEqual(["drawdown", "misses"]);
  });

  it("schweigt unterhalb der Schwellen", () => {
    const calm = JSON.stringify({
      Technicals: { "52WeekHigh": "100" },
      Highlights: { QuarterlyRevenueGrowthYOY: -0.1 },
      Earnings: {
        History: {
          a: { date: "2026-09-30", epsActual: 1, epsEstimate: 1.3, surprisePercent: -23 },
          b: { date: "2026-06-30", epsActual: 1, epsEstimate: 1, surprisePercent: 0 },
          c: { date: "2026-03-31", epsActual: 1, epsEstimate: 1, surprisePercent: -14.9 },
        },
      },
    });
    expect(situationSignals({ fundamentalsJson: calm, price: 61, isFinancial: false })).toEqual([]);
  });

  it("kommt mit fehlenden Daten aus", () => {
    expect(situationSignals({ fundamentalsJson: null, price: 5, isFinancial: false })).toEqual([]);
    expect(situationSignals({ fundamentalsJson: "{}", price: null, isFinancial: false })).toEqual([]);
    expect(
      situationSignals({ fundamentalsJson: JSON.stringify({ Technicals: { "52WeekHigh": 0 } }), price: 1, isFinancial: false }),
    ).toEqual([]);
  });
});
