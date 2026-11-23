// Gemeinsame Testdaten: eine ruhige Beispielaktie mit zehn Geschäftsjahren.

import type { FundamentalsYear, Stock } from "../data/db.ts";

export const stock: Stock = {
  id: "TEST.US",
  name: "Test",
  sector: "Basic Materials",
  region: "Europa",
  country: "DE",
  reportingCurrency: "EUR",
  priceCurrency: "EUR",
  priceDivisor: 1,
  foundedYear: 1950,
  isFinancial: false,
  watched: true,
};

/** Zehn ruhige Jahre: 100 Aktien, Gewinn je Aktie steigt von 5,0 um 0,1 pro Jahr, Dividende 2, freier Cashflow 4 je Aktie. */
export function steadyYears(change: (year: FundamentalsYear, index: number) => void = () => {}): FundamentalsYear[] {
  return Array.from({ length: 10 }, (_, i) => {
    const year: FundamentalsYear = {
      fiscalYear: 2016 + i,
      epsDiluted: 5 + i * 0.1,
      dividendPerShare: 2,
      shares: 100,
      repurchases: 100,
      issuance: 0,
      stockBasedCompensation: null,
      revenue: 5000 * 1.03 ** i,
      ebit: 750 * 1.03 ** i,
      totalAssets: 30e9,
      equity: 18e9,
      currentAssets: 2000,
      currentLiabilities: 1000,
      longTermDebt: null,
      cash: 0,
      operatingCashFlow: 600,
      freeCashFlow: 400,
      netDebt: 0,
      interestExpense: 0,
      ebitda: 900 * 1.03 ** i,
    };
    change(year, i);
    return year;
  });
}
