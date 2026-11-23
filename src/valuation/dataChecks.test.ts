import { describe, expect, it } from "vitest";
import { steadyYears, stock } from "../test/fixtures.ts";
import { dataWarnings } from "./dataChecks.ts";

const base = { stock, years: steadyYears(), payments: [{ date: "2025-05-01", value: 2 }], netBuybacksPerShare: 1, price: 40 };

describe("Prüfung der Anbieterdaten", () => {
  it("meldet bei sauberen Daten nichts", () => {
    expect(dataWarnings(base)).toEqual([]);
  });

  it("meldet eine Berichtswährung, die nicht zum Sitzland passt, aber nicht USD, EUR oder GBP", () => {
    expect(dataWarnings({ ...base, stock: { ...stock, country: "IN", reportingCurrency: "TWD" } })[0]).toMatch(
      /TWD passt nicht zum Sitzland IN \(INR\)/,
    );
    expect(dataWarnings({ ...base, stock: { ...stock, country: "IN", reportingCurrency: "USD" } })).toEqual([]);
  });

  it("meldet Finanzwerte nach GICS oder ohne Sektor, die nicht als Finanzwert gelten", () => {
    expect(dataWarnings({ ...base, stock: { ...stock, gicSector: "Financials", isFinancial: false } })[0]).toMatch(/Financials/);
    expect(dataWarnings({ ...base, stock: { ...stock, sector: "Unbekannt" } })[0]).toMatch(/Sektor unbekannt/);
    expect(dataWarnings({ ...base, stock: { ...stock, gicSector: "Financials", isFinancial: true } })).toEqual([]);
  });

  it("meldet eine Dividendenhistorie, die lange vor dem letzten Abschluss endet", () => {
    expect(dataWarnings({ ...base, payments: [{ date: "2023-05-01", value: 2 }] })[0]).toMatch(
      /Historie endet 2023, der Abschluss 2025 weist 2\.00 je Aktie aus/,
    );
    expect(dataWarnings({ ...base, payments: [] })[0]).toMatch(/endet ohne Zahlung/);
    expect(dataWarnings({ ...base, payments: null })).toEqual([]);
  });

  it("meldet hohe Netto-Rückkäufe bei gleichbleibender Aktienzahl", () => {
    expect(dataWarnings({ ...base, netBuybacksPerShare: 4 })[0]).toMatch(/Netto-Rückkäufe von 10 % des Kurses/);
    const falling = steadyYears((y, i) => (y.shares = 100 - i));
    expect(dataWarnings({ ...base, years: falling, netBuybacksPerShare: 4 })).toEqual([]);
  });

  it("meldet vermutete Sonderdividenden und doppelte Schlussdividenden in einem Kalenderjahr", () => {
    const quarterly = ["2025-02-01", "2025-05-01", "2025-08-01", "2025-11-01"].map((date) => ({ date, value: 0.5, period: "Quarterly" }));
    expect(dataWarnings({ ...base, payments: [...quarterly, { date: "2025-12-01", value: 3, period: "Quarterly" }] })[0]).toMatch(
      /Zahlung 2025-12-01 über dem 2,5-Fachen/,
    );
    // Als Sonderzahlung gekennzeichnet: kein Hinweis.
    expect(dataWarnings({ ...base, payments: [...quarterly, { date: "2025-12-01", value: 3, period: "Special" }] })).toEqual([]);
    const finals = [
      { date: "2024-06-30", value: 1, period: "Final" },
      { date: "2025-01-15", value: 1, period: "Final" },
      { date: "2025-12-20", value: 1, period: "Final" },
    ];
    expect(dataWarnings({ ...base, payments: finals })[0]).toMatch(/Zwei Schlussdividenden im Kalenderjahr 2025/);
  });

  it("meldet offensichtlich falsche Felder der Abschlüsse", () => {
    const broken = steadyYears((y, i) => {
      if (i === 9) y.ebit = (y.revenue ?? 0) * 2;
      if (i >= 8) y.operatingCashFlow = null;
      if (i >= 7) Object.assign(y, { netDebt: 500, longTermDebt: 800, interestExpense: 0 });
    });
    const warnings = dataWarnings({ ...base, years: broken });
    expect(warnings).toEqual([
      expect.stringMatching(/EBIT über dem Umsatz in 2025/),
      expect.stringMatching(/Operativer Cashflow fehlt in 2024, 2025/),
      expect.stringMatching(/Schulden ohne Zinsaufwand in 2023, 2024, 2025/),
    ]);
  });
});
