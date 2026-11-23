import { describe, expect, it } from "vitest";
import { isinOf, parseEodhdFundamentals } from "./eodhdFundamentals.ts";

const SAMPLE = {
  General: { Sector: "Technology", GicSector: "Information Technology", CountryISO: "US", CurrencyCode: "USD" },
  Earnings: { Annual: { "2025-09-30": { date: "2025-09-30", epsActual: 7.47 } } },
  Financials: {
    Income_Statement: {
      currency_symbol: "USD",
      yearly: {
        "2025-09-30": { netIncome: "112000.00", totalRevenue: "416000.00", ebit: "133000.00" },
        "2024-09-30": { netIncome: "93700.00", totalRevenue: "391000.00", ebit: "123000.00" },
      },
    },
    Balance_Sheet: {
      yearly: {
        "2025-09-30": {
          commonStockSharesOutstanding: "15000.00",
          totalAssets: "360000.00",
          totalStockholderEquity: "74000.00",
          totalCurrentAssets: "148000.00",
          totalCurrentLiabilities: "166000.00",
          longTermDebt: "78000.00",
          cash: "36000.00",
        },
        "2024-09-30": { commonStockSharesOutstanding: "15400.00", totalAssets: "365000.00" },
      },
    },
    Cash_Flow: {
      yearly: {
        "2025-09-30": {
          salePurchaseOfStock: "-90700.00",
          issuanceOfCapitalStock: null,
          stockBasedCompensation: "12900.00",
          dividendsPaid: "15400.00",
          totalCashFromOperatingActivities: "111000.00",
          freeCashFlow: "98800.00",
        },
        "2024-09-30": { salePurchaseOfStock: "500.00", dividendsPaid: "-15200.00" },
      },
    },
  },
};

describe("EODHD-Fundamentaldaten", () => {
  const parsed = parseEodhdFundamentals(SAMPLE);

  it("ordnet die Jahre aufsteigend und liest Stammdaten", () => {
    expect(parsed.years.map((y) => y.fiscalYear)).toEqual([2024, 2025]);
    expect(parsed).toMatchObject({ reportingCurrency: "USD", sector: "Technology", gicSector: "Information Technology", country: "US" });
  });

  it("rechnet den Gewinn je Aktie aus Gewinn und Aktienzahl und ignoriert epsActual", () => {
    expect(parsed.years[1]!.epsDiluted).toBeCloseTo(112000 / 15000);
    expect(parsed.years[0]!.epsDiluted).toBeCloseTo(93700 / 15400);
  });

  it("wertet negative Aktiengeschäfte als Rückkauf und Dividenden unabhängig vom Vorzeichen", () => {
    expect(parsed.years[1]).toMatchObject({ repurchases: 90700, issuance: 0, stockBasedCompensation: 12900 });
    expect(parsed.years[1]!.dividendPerShare).toBeCloseTo(15400 / 15000);
    expect(parsed.years[0]!.repurchases).toBe(0);
    expect(parsed.years[0]!.dividendPerShare).toBeCloseTo(15200 / 15400);
  });

  it("lässt fehlende Werte leer statt sie zu erfinden", () => {
    expect(parsed.years[0]).toMatchObject({ equity: null, freeCashFlow: null, stockBasedCompensation: null });
    expect(parseEodhdFundamentals({}).years).toEqual([]);
  });

  it("ergänzt eine fehlende Aktienzahl aus outstandingShares oder dem Nachbarjahr", () => {
    const yearly = (dates: string[]) => Object.fromEntries(dates.map((d) => [d, { netIncome: "1000" }]));
    const dates = ["2016-12-31", "2017-12-31", "2018-12-31", "2019-12-31", "2020-12-31", "2021-12-31"];
    const parsed = parseEodhdFundamentals({
      Financials: {
        Income_Statement: { yearly: yearly(dates) },
        Balance_Sheet: {
          yearly: {
            "2016-12-31": { commonStockSharesOutstanding: null },
            "2017-12-31": { commonStockSharesOutstanding: "100" },
            "2018-12-31": {},
            "2019-12-31": { commonStockSharesOutstanding: "120" },
            "2021-12-31": {},
          },
        },
      },
      outstandingShares: { annual: { "0": { date: "2016", dateFormatted: "2016-12-31", shares: 95 }, "1": { shares: "x" } } },
    });
    // 2016 aus outstandingShares, 2018 vom früheren Nachbarn, 2020 und 2021 vom nächsten Jahr mit Bilanzangabe.
    expect(parsed.years.map((y) => y.shares)).toEqual([95, 100, 100, 120, 120, 120]);
    expect(parsed.years[0]!.epsDiluted).toBeCloseTo(1000 / 95);
  });

  it("füllt keine Aktienzahl über mehr als zwei Jahre", () => {
    const dates = ["2016-12-31", "2017-12-31", "2018-12-31", "2019-12-31"];
    const parsed = parseEodhdFundamentals({
      Financials: {
        Income_Statement: { yearly: Object.fromEntries(dates.map((d) => [d, { netIncome: "1000" }])) },
        Balance_Sheet: { yearly: { "2019-12-31": { commonStockSharesOutstanding: "50" } } },
      },
    });
    expect(parsed.years.map((y) => y.shares)).toEqual([null, 50, 50, 50]);
  });
});

describe("ISIN aus den Stammdaten", () => {
  it.each([
    [" de000basf111 ", "DE000BASF111"],
    ["DE000BASF11", null],
    ["", null],
    [undefined, null],
  ])("liest %j als %j", (value, expected) => {
    expect(isinOf(value)).toBe(expected);
    expect(parseEodhdFundamentals({ General: { ISIN: value } }).isin).toBe(expected);
  });
});
