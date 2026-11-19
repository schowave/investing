import { describe, expect, it } from "vitest";
import { dividendLevel, dividendWasCut } from "../calc/index.ts";
import { Database } from "../data/db.ts";
import type { FundamentalsYear, Stock } from "../data/db.ts";
import { parseEodhdFundamentals, stockFromEodhd } from "../data/eodhdFundamentals.ts";
import { valueStock } from "./run.ts";
import { evaluate, INPUT_KEYS, priceInReportingCurrency, proposeInputs } from "./valuation.ts";
import type { InputValues } from "./valuation.ts";

const stock: Stock = {
  id: "TEST.US", name: "Test", sector: "Chemie", region: "Europa", country: "DE", reportingCurrency: "EUR",
  priceCurrency: "EUR", priceDivisor: 1, foundedYear: 1950, isFinancial: false, watched: true,
};

/** Zehn ruhige Jahre: 100 Aktien, Gewinn je Aktie steigt von 5,0 um 0,1 pro Jahr, Dividende 2, freier Cashflow 4 je Aktie. */
function steadyYears(change: (year: FundamentalsYear, index: number) => void = () => {}): FundamentalsYear[] {
  return Array.from({ length: 10 }, (_, i) => {
    const year: FundamentalsYear = {
      fiscalYear: 2016 + i, epsDiluted: 5 + i * 0.1, dividendPerShare: 2, shares: 100, repurchases: 100, issuance: 0,
      stockBasedCompensation: null, revenue: 5000 * 1.03 ** i, ebit: 750 * 1.03 ** i, totalAssets: 30e9, equity: 18e9, currentAssets: 2000,
      currentLiabilities: 1000, longTermDebt: null, cash: 0, operatingCashFlow: 600, freeCashFlow: 400,
    };
    change(year, i);
    return year;
  });
}

describe("proposeInputs", () => {
  it("leitet Rückfluss, Wachstum und Zahlenfaktoren aus zehn Jahren ab", () => {
    const { values, details, notes } = proposeInputs(stock, steadyYears(), 1, 2026);
    expect(details.earningsLevel).toBeCloseTo(5.9);
    // Dividende 2 plus Rückkäufe 1 je Aktie; nicht gemeldete Vergütung zählt als 0. Tragbar wären 4.
    expect(values.payoutLevel).toBeCloseTo(3);
    expect(values.growth).toBeCloseTo((5.7 / 5.2) ** 0.2 - 1);
    expect(values["risk.earnings"]).toBe(-0.1);
    expect(values["risk.financing"]).toBe(0);
    expect(values["risk.size"]).toBe(0);
    expect(values["risk.age"]).toBe(0);
    expect(values["risk.country"]).toBe(0);
    expect(values["risk.ebitMargin"]).toBeCloseTo(0);
    expect(values["risk.cashFlow"]).toBe(0);
    expect(values["risk.currency"]).toBe(0);
    expect(values["risk.moat"]).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it("deckelt den Rückfluss auf den freien Cashflow und meldet das", () => {
    const { values, notes } = proposeInputs(stock, steadyYears((y) => (y.freeCashFlow = 250)), 1, 2026);
    expect(values.payoutLevel).toBeCloseTo(2.5);
    expect(notes.some((n) => n.includes("gedeckelt"))).toBe(true);
  });

  it("macht bei weniger als zehn Jahren nur Vorschläge aus den Stammdaten", () => {
    const { values, notes } = proposeInputs(stock, steadyYears().slice(3), 1, 2026);
    expect(values.payoutLevel).toBeUndefined();
    expect(values["risk.earnings"]).toBeUndefined();
    expect(values["risk.currency"]).toBe(0);
    expect(notes[0]).toContain("Nur 7 Geschäftsjahre");
  });

  it("schlägt bei Finanzwerten Finanzierung, Kapitalrendite und Marge nicht vor und nimmt das Gewinnniveau als Deckel", () => {
    const { values, details } = proposeInputs({ ...stock, isFinancial: true }, steadyYears((y) => (y.freeCashFlow = null)), 1, 2026);
    expect(values["risk.financing"]).toBeUndefined();
    expect(values["risk.returnOnCapital"]).toBeUndefined();
    expect(values["risk.ebitMargin"]).toBeUndefined();
    expect(details.sustainablePayout).toBeCloseTo(5.9);
    expect(values.payoutLevel).toBeCloseTo(3);
  });

  it("gibt bei fallendem Gewinn keinen Wachstumsvorschlag", () => {
    const { values, notes } = proposeInputs(stock, steadyYears((y, i) => (y.epsDiluted = 5 - i * 0.3)), 1, 2026);
    expect(values.growth).toBeUndefined();
    expect(notes.some((n) => n.includes("von Hand"))).toBe(true);
  });

  it("begrenzt das Wachstum auf das Umsatzwachstum je Aktie", () => {
    const flat = proposeInputs(stock, steadyYears((y) => (y.revenue = 5000)), 1, 2026);
    expect(flat.values.growth).toBe(0);
    const slow = proposeInputs(stock, steadyYears((y, i) => (y.revenue = 5000 * 1.01 ** i)), 1, 2026);
    expect(slow.values.growth).toBeCloseTo(0.01);
  });

  it("deckelt das Gewinnniveau auf den höchsten Gewinn der letzten drei Jahre", () => {
    const eps = [0.7, 1.5, 1.4, 1.1, 1.6, 3.0, 1.7, 2.5, 3.0, 2.5];
    const { details } = proposeInputs(stock, steadyYears((y, i) => (y.epsDiluted = eps[i]!)), 1, 2026);
    expect(details.earningsLevel).toBe(3.0);
  });

  it("bewertet die Größe nicht ohne Wechselkurs und das Alter ohne Gründungsjahr nur bei langer Historie", () => {
    const young = proposeInputs({ ...stock, foundedYear: null }, steadyYears(), null, 2026).values;
    expect(young["risk.size"]).toBeUndefined();
    expect(young["risk.age"]).toBeUndefined();
    const long = [...steadyYears((y) => (y.fiscalYear -= 15)), ...steadyYears()];
    expect(proposeInputs({ ...stock, foundedYear: null }, long, 1, 2026).values["risk.age"]).toBe(0);
  });
});

describe("Dividendenniveau", () => {
  it("wertet kleine Schwankungen nicht als Kürzung", () => {
    const series = [3.2, 3.3, 3.293, 3.407, 3.39, 3.39, 3.4, 3.4, 3.4, 3.4];
    expect(dividendWasCut(series)).toBe(false);
    expect(dividendLevel(series)).toBe(3.4);
  });

  it("wird nie negativ", () => {
    expect(dividendLevel([50, 0.5, 0.6, 0.5, 70, 0.2, 0.6, 0.1, 0, 0])).toBe(0);
  });
});

describe("evaluate", () => {
  const full: InputValues = Object.fromEntries(INPUT_KEYS.map((key) => [key, 0]));
  const imperial: InputValues = { ...full, payoutLevel: 3.09, growth: 0.023, "risk.financing": 0.26 };

  it("rechnet das Beispiel Imperial Brands aus den Folien", () => {
    const v = evaluate(imperial, {}, 30);
    expect(v.complete).toBe(true);
    expect(v.defaultProbability).toBeCloseTo(0.018);
    expect(v.returns!.base!).toBeCloseTo(0.106, 2);
    expect(v.returns!.cautious!).toBeLessThan(v.returns!.base!);
  });

  it("lässt manuelle Werte gelten und nennt sie", () => {
    const v = evaluate(imperial, { growth: 0, "risk.moat": -0.2 }, 30);
    expect(v.inputs.growth).toBe(0);
    expect(v.manual).toEqual(["growth", "risk.moat"]);
    expect(v.riskScore).toBeCloseTo(0.06);
  });

  it("ist unvollständig, solange ein Faktor oder der Kurs fehlt, rechnet aber vorläufig", () => {
    const { "risk.management": _, ...rest } = imperial;
    const v = evaluate(rest, {}, 30);
    expect(v.complete).toBe(false);
    expect(v.missing).toEqual(["risk.management"]);
    expect(v.returns!.base).not.toBeNull();
    expect(evaluate(imperial, {}, null).complete).toBe(false);
  });

  it("rechnet Kurse in die Berichtswährung um", () => {
    expect(priceInReportingCurrency(100, 1.25, 500)).toBeCloseTo(40000);
    expect(priceInReportingCurrency(100, 1.25, null)).toBeNull();
  });
});

describe("Datenbank", () => {
  it("speichert manuelle Werte und den Tagesstand der Bewertung", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    expect(db.stocks().map((s) => s.id)).toEqual(["TEST.US"]);
    expect(db.stocks({ includeStockpile: true })).toHaveLength(2);

    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 40 }]);
    db.setManualInput(stock.id, "growth", 0.01, "vorsichtig");
    db.setManualInput(stock.id, "risk.moat", 0.05);
    db.clearManualInput(stock.id, "risk.moat");

    const result = valueStock(db, stock, "2026-11-19");
    expect(result.valuation.manual).toEqual(["growth"]);
    expect(result.valuation.price).toBe(40);
    const stored = db.latestValuation(stock.id)!;
    expect(stored.date).toBe("2026-11-19");
    expect(stored.complete).toBe(false);
    expect(stored.innerReturn).toBeCloseTo(result.valuation.returns!.base!);
    db.close();
  });
});

describe("stockFromEodhd", () => {
  it("leitet Stammdaten für den Datenvorrat ab und erkennt Pence-Notizen", () => {
    const parsed = parseEodhdFundamentals({
      General: { Name: "Beispiel PLC", CurrencyCode: "GBX", CountryISO: "GB", Sector: "Financial Services" },
      Financials: { Income_Statement: { currency_symbol: "GBP", yearly: {} } },
    });
    expect(stockFromEodhd("BSP.LSE", parsed)).toMatchObject({
      name: "Beispiel PLC", region: "Europa", reportingCurrency: "GBP", priceCurrency: "GBP", priceDivisor: 100,
      isFinancial: true, watched: false, foundedYear: null,
    });
  });
});
