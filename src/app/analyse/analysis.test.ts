import { describe, expect, it } from "vitest";
import { FUNDAMENTAL_FIELDS, type FundamentalsYear } from "../../data/db.ts";
import {
  cagr,
  compact,
  dividendGrowth,
  dividendsByYear,
  formatUnit,
  fundamentalSeries,
  logTicks,
  maxDrawdown,
  niceTicks,
  periodOf,
  periodStats,
  preferLog,
  priceSeries,
  recentYears,
  sinceYears,
  trailingDividends,
  trendText,
  yearEndPrice,
  yearMultiples,
  yearsWithoutCut,
} from "./analysis.ts";

function year(fiscalYear: number, values: Partial<FundamentalsYear> = {}): FundamentalsYear {
  const y = { fiscalYear } as FundamentalsYear;
  for (const field of FUNDAMENTAL_FIELDS) y[field] = null;
  return { ...y, ...values };
}

describe("Kursreihe", () => {
  it("bereinigt Rohkurse um spätere Splits und rechnet Pence in Pfund", () => {
    const points = priceSeries(
      [
        { date: "2020-01-31", close: 200, adjustedClose: 80 },
        { date: "2021-01-29", close: 110, adjustedClose: 100 },
        { date: "2021-02-26", close: 0, adjustedClose: 0 },
      ],
      [
        { date: "2020-06-01", ratio: 2 },
        { date: "2020-07-01", ratio: 0 },
      ],
      100,
    );
    expect(points).toEqual([
      { date: "2020-01-31", price: 1, total: 0.8 },
      { date: "2021-01-29", price: 1.1, total: 1 },
    ]);
  });

  it("rechnet einen Split im selben Monat nicht heraus, weil der Monatsschluss ihn schon enthält", () => {
    const points = priceSeries(
      [
        { date: "2012-07-02", close: 80, adjustedClose: 26 },
        { date: "2012-08-01", close: 37.4, adjustedClose: 24 },
      ],
      [{ date: "2012-08-13", ratio: 2 }],
      1,
    );
    expect(points.map((p) => p.price)).toEqual([40, 37.4]);
  });

  it("schneidet auf Zeiträume ab dem letzten Punkt zurück", () => {
    const points = ["2014-05-30", "2016-05-31", "2020-01-31", "2026-05-29"].map((date) => ({ date }));
    expect(sinceYears(points, 10).map((p) => p.date)).toEqual(["2016-05-31", "2020-01-31", "2026-05-29"]);
    expect(sinceYears(points, null)).toHaveLength(4);
    expect(sinceYears([], 5)).toEqual([]);
    expect(periodOf("5j").years).toBe(5);
    expect(periodOf("unsinn").key).toBe("10j");
  });

  it("rechnet Rendite pro Jahr und größten Rückgang", () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1);
    expect(cagr(0, 121, 2)).toBeNull();
    expect(cagr(100, 121, 0)).toBeNull();
    expect(maxDrawdown([100, 120, 60, 90, 130])).toBeCloseTo(-0.5);
    expect(maxDrawdown([1, 2, 3])).toBe(0);
    const stats = periodStats([
      { date: "2016-01-01", price: 10, total: 10 },
      { date: "2018-01-01", price: 8, total: 9 },
      { date: "2026-01-01", price: 15, total: 25.937 },
    ]);
    expect(stats?.priceReturn).toBeCloseTo(0.5);
    expect(stats?.totalPerYear).toBeCloseTo(0.1, 3);
    expect(stats?.drawdown).toBeCloseTo(-0.1);
    const short = periodStats([
      { date: "2026-01-01", price: 10, total: 10 },
      { date: "2026-07-01", price: 11, total: 11 },
    ]);
    expect(short?.totalPerYear).toBeCloseTo(0.1);
    expect(periodStats([{ date: "2026-01-01", price: 1, total: 1 }])).toBeNull();
  });
});

describe("Dividenden", () => {
  const payments = [
    { date: "2021-03-01", value: 1, currency: "EUR" },
    { date: "2021-09-01", value: 1, currency: "EUR" },
    { date: "2023-03-01", value: 2.2, currency: "EUR" },
    { date: "2024-03-01", value: 2.42, currency: "EUR" },
    { date: "2024-04-01", value: 9, currency: "USD" },
    { date: "2026-03-01", value: 1.5, currency: "EUR" },
  ];

  it("summiert je Jahr in der Kurswährung, lässt Lücken als 0 stehen und markiert das laufende Jahr", () => {
    const years = dividendsByYear(payments, "EUR", "2026-11-26");
    expect(years.map((y) => [y.year, y.sum, y.partial])).toEqual([
      [2021, 2, false],
      [2022, 0, false],
      [2023, 2.2, false],
      [2024, 2.42, false],
      [2025, 0, false],
      [2026, 1.5, true],
    ]);
    expect(dividendsByYear([], "EUR", "2026-01-01")).toEqual([]);
  });

  it("rechnet Wachstum, Jahre ohne Kürzung und die letzten zwölf Monate", () => {
    const years = dividendsByYear(payments.slice(0, 4), "EUR", "2026-11-26");
    expect(dividendGrowth(years, 1)).toBeCloseTo(0.1);
    expect(dividendGrowth(years, 10)).toBeNull();
    expect(yearsWithoutCut(years)).toBe(2);
    expect(yearsWithoutCut(dividendsByYear(payments, "EUR", "2026-11-26"))).toBe(0);
    expect(trailingDividends(payments, "EUR", "2026-11-26")).toBe(1.5);
  });
});

describe("Kennzahlen je Jahr", () => {
  const points = [
    { date: "2023-12-29", price: 20, total: 20 },
    { date: "2024-06-28", price: 22, total: 23 },
    { date: "2024-11-29", price: 25, total: 26 },
  ];

  it("nimmt den letzten Kurs eines Jahres", () => {
    expect(yearEndPrice(points, 2024)).toBe(25);
    expect(yearEndPrice(points, 2022)).toBeNull();
  });

  it("rechnet KGV nur in gleicher Währung und Dividendenrendite aus den Zahlungen", () => {
    const fundamentals = [year(2023, { epsDiluted: 2 }), year(2024, { epsDiluted: -1 }), year(2020, { epsDiluted: 1 })];
    const dividends = [
      { year: 2023, sum: 1, payments: 2, partial: false },
      { year: 2024, sum: 1, payments: 1, partial: true },
    ];
    expect(yearMultiples(fundamentals, points, dividends, true)).toEqual([
      { year: 2023, pe: 10, dividendYield: 0.05 },
      { year: 2024, pe: null, dividendYield: null },
    ]);
    expect(yearMultiples(fundamentals, points, dividends, false)[0]?.pe).toBeNull();
  });

  it("bildet Reihen aus den Abschlüssen und lässt leere weg", () => {
    const series = fundamentalSeries([
      year(2023, {
        revenue: 100,
        ebit: 20,
        epsDiluted: 2,
        dividendPerShare: 1,
        shares: 10,
        equity: 40,
        totalAssets: 100,
        ebitda: 25,
        netDebt: 50,
        repurchases: -5,
        issuance: 1,
      }),
      year(2024, { revenue: 0, epsDiluted: -1, ebitda: -2 }),
    ]);
    const byKey = Object.fromEntries(series.map((s) => [s.key, s.values.map((v) => v.value)]));
    expect(byKey.margin).toEqual([0.2, null]);
    expect(byKey.payout).toEqual([0.5, null]);
    expect(byKey.roe).toEqual([0.5, null]);
    expect(byKey.leverage).toEqual([2, null]);
    expect(byKey.buybacks).toEqual([4, null]);
    expect(byKey.equityRatio).toEqual([0.4, null]);
    expect(byKey.fcf).toBeUndefined();
  });

  it("zeigt die letzten Jahre ab dem ersten Wert", () => {
    const values = [2018, 2019, 2020, 2021].map((y, i) => ({ year: y, value: i === 0 ? null : i }));
    expect(recentYears(values, 10).map((v) => v.year)).toEqual([2019, 2020, 2021]);
    expect(recentYears(values, 2).map((v) => v.year)).toEqual([2020, 2021]);
    expect(recentYears([{ value: null }], 3)).toEqual([]);
    expect(recentYears([{ value: 0 }, { value: 1 }, { value: 0 }], 3)).toEqual([{ value: 1 }, { value: 0 }]);
  });
});

describe("Achsen und Texte", () => {
  it("wählt runde Teilstriche, die den Bereich abdecken", () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(3, 47, 4)).toEqual([0, 20, 40, 60]);
    expect(niceTicks(5, 5).length).toBeGreaterThan(1);
    expect(niceTicks(Number.NaN, 1)).toEqual([]);
    expect(logTicks(3, 80)).toEqual([5, 10, 20, 50]);
    expect(logTicks(2.5, 38)).toEqual([3, 5, 7, 10, 15, 20, 30]);
    expect(logTicks(0.5, 50000)).toEqual([1, 10, 100, 1000, 10000]);
    expect(logTicks(0, 10)).toEqual([]);
  });

  it("nimmt eine logarithmische Achse nur über lange Zeit und große Spannen", () => {
    expect(preferLog([1, 10], 20)).toBe(true);
    expect(preferLog([1, 10], 5)).toBe(false);
    expect(preferLog([4, 10], 20)).toBe(false);
    expect(preferLog([10], 20)).toBe(false);
  });

  it("schreibt Beträge kurz und in der Einheit der Reihe", () => {
    expect(compact(2.5e12)).toBe("2,5 Bio.");
    expect(compact(1.23e9)).toBe("1,2 Mrd.");
    expect(compact(3.5e11)).toBe("350 Mrd.");
    expect(compact(3.5e8)).toBe("350 Mio.");
    expect(compact(1.5e6)).toBe("1,5 Mio.");
    expect(compact(12345)).toBe("12.345");
    expect(compact(123)).toBe("123");
    expect(compact(1.5)).toBe("1,50");
    expect(compact(null)).toBe("–");
    expect(formatUnit(0.1234, "percent")).toBe("12,3 %");
    expect(formatUnit(2, "times")).toBe("2,0×");
    expect(formatUnit(2e9, "big")).toBe("2,0 Mrd.");
    expect(formatUnit(1.5, "amount")).toBe("1,50");
    expect(formatUnit(null, "amount")).toBe("–");
  });

  it("beschreibt den Trend einer Reihe", () => {
    const grow = [
      { year: 2014, value: 100 },
      { year: 2024, value: 259.37 },
    ];
    expect(trendText(grow, "big")).toBe("+10,0 % pro Jahr seit 2014");
    expect(
      trendText(
        [
          { year: 2014, value: 100 },
          { year: 2024, value: 38.55 },
        ],
        "big",
      ),
    ).toBe("−9,1 % pro Jahr seit 2014");
    expect(
      trendText(
        [
          { year: 2020, value: 0.2 },
          { year: 2024, value: 0.15 },
        ],
        "percent",
      ),
    ).toBe("−5 Punkte seit 2020");
    expect(trendText(grow, "times")).toBe("100,0× → 259,4× seit 2014");
    expect(
      trendText(
        [
          { year: 2020, value: -1 },
          { year: 2024, value: 2 },
        ],
        "amount",
      ),
    ).toBeNull();
    expect(trendText([{ year: 2020, value: 1 }], "amount")).toBeNull();
  });
});
