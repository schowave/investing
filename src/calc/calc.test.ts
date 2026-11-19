import { describe, expect, it } from "vitest";
import {
  PROFILE_FOCUSED,
  PROFILE_GLOBAL,
  assessRisk,
  defaultProbability,
  dividendLevel,
  earningsLevel,
  growthProposal,
  historicalGrowth,
  innerReturn,
  levelFromAverage,
  netBuybacksPerShare,
  payoutLevelProposal,
  positionLimit,
  presentValue,
  proposals,
  proposeAge,
  proposeCashFlow,
  proposeCountry,
  proposeCurrency,
  proposeEarnings,
  proposeFinancing,
  proposeProfitability,
  proposeSize,
  riskClass,
  scenarioReturns,
  targetPortfolio,
  type RiskRatings,
  type Stock,
} from "./index.ts";

// Folie 7: Dividende 1,59 + Rückkäufe 1,50 GBP, Wachstum 2,3 %, Ausfall 1,8 %.
const IMPERIAL = { payoutLevel: 3.09, growth: 0.023, defaultProbability: 0.018 };
// Buch Abb. 23, Gewinn je Aktie 2002 bis 2011.
const BASF = [1.3, 0.81, 1.83, 2.87, 3.19, 4.16, 3.13, 1.54, 4.96, 6.74];
const WALMART = [1.79, 2.08, 2.46, 2.72, 2.92, 3.15, 3.35, 3.73, 4.18, 4.54];

describe("innere Rendite", () => {
  it("trifft Imperial Brands von Folie 7 auf 0,2 Prozentpunkte", () => {
    expect(Math.abs(innerReturn(30, IMPERIAL)! - 0.106)).toBeLessThan(0.002);
    expect(Math.abs(innerReturn(25, IMPERIAL)! - 0.127)).toBeLessThan(0.002);
  });

  it("entspricht im einstufigen Fall der geschlossenen Formel", () => {
    const q = 1.023 * 0.982;
    expect(innerReturn(30, IMPERIAL)!).toBeCloseTo((3.09 * 0.982) / 30 + q - 1, 8);
  });

  it("gibt beim gelösten Zinssatz den Kurs als Barwert zurück", () => {
    const growthStock = { payoutLevel: 5, growth: 0.1, defaultProbability: 0.02 };
    const rate = innerReturn(100, growthStock)!;
    expect(presentValue(rate, growthStock)).toBeCloseTo(100, 6);
  });

  it("steigt mit dem Wachstum und fällt mit der Ausfallwahrscheinlichkeit", () => {
    const base = innerReturn(100, { payoutLevel: 5, growth: 0.05, defaultProbability: 0.02 })!;
    expect(innerReturn(100, { payoutLevel: 5, growth: 0.08, defaultProbability: 0.02 })!).toBeGreaterThan(base);
    expect(innerReturn(100, { payoutLevel: 5, growth: 0.05, defaultProbability: 0.04 })!).toBeLessThan(base);
  });

  it("liefert ohne Rückflüsse oder Kurs kein Ergebnis", () => {
    expect(innerReturn(100, { payoutLevel: 0, growth: 0.05, defaultProbability: 0.02 })).toBeNull();
    expect(innerReturn(0, IMPERIAL)).toBeNull();
  });

  it("ordnet die Bandbreite vorsichtig < Basis < optimistisch", () => {
    const s = scenarioReturns(30, IMPERIAL);
    expect(s.cautious!).toBeLessThan(s.base!);
    expect(s.base!).toBeLessThan(s.optimistic!);
  });
});

describe("Eingaben", () => {
  it("rechnet die BASF-Werte aus dem Buch nach", () => {
    expect(historicalGrowth(BASF)!).toBeCloseTo(0.155, 3);
    // Das Buch rundet das Wachstum vor der Hochrechnung auf 15,5 %; Toleranz laut Spezifikation 0,01.
    expect(Math.abs(levelFromAverage(BASF, 10)! - 5.42)).toBeLessThan(0.01);
    expect(Math.abs(levelFromAverage(BASF, 5)! - 5.38)).toBeLessThan(0.01);
    expect(Math.abs(earningsLevel(BASF)! - 5.38)).toBeLessThan(0.01);
  });

  it("rechnet Wal-Mart aus dem Buch nach", () => {
    expect(Math.abs(levelFromAverage(WALMART, 10)! - 4.6)).toBeLessThan(0.05);
    // Stetig steigend: es gilt der letzte Gewinn.
    expect(earningsLevel(WALMART)).toBe(4.54);
  });

  it("liefert kein Wachstum bei negativen Durchschnitten", () => {
    expect(historicalGrowth([-1, -1, -1, -1, -1, 1, 1, 1, 1, 1])).toBeNull();
  });

  it("nimmt die letzte Dividende, wenn sie nie gesenkt wurde, sonst höchstens die letzte", () => {
    expect(dividendLevel([1, 1, 1.1, 1.2, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7])).toBe(1.7);
    expect(dividendLevel([2, 2, 2, 2, 2, 2, 2, 2, 2, 1])).toBe(1);
  });

  it("zieht Aktienausgabe und aktienbasierte Vergütung von den Rückkäufen ab", () => {
    const year = { repurchases: 100, issuance: 10, stockBasedCompensation: 30, shares: 20 };
    expect(netBuybacksPerShare([year, year, year, year, year])).toBeCloseTo(3);
    expect(netBuybacksPerShare([{ ...year, repurchases: 0 }])).toBe(0);
  });

  it("deckelt das Rückflussniveau auf den freien Cashflow je Aktie", () => {
    expect(payoutLevelProposal({ dividendLevel: 2, netBuybacksPerShare: 3, sustainablePayout: 4 })).toEqual({
      value: 4,
      capped: true,
    });
    expect(payoutLevelProposal({ dividendLevel: 2, netBuybacksPerShare: 1, sustainablePayout: 4 })).toEqual({
      value: 3,
      capped: false,
    });
  });

  it("begrenzt das Wachstum durch Einbehaltung und Eigenkapitalrendite", () => {
    const args = { historicalGrowth: 0.07, earningsLevel: 4, equityPerShare: 20 };
    expect(growthProposal({ ...args, payoutLevel: 3 }).value).toBeCloseTo(0.07);
    expect(growthProposal({ ...args, payoutLevel: 4 }).value).toBeCloseTo(0.02);
    expect(growthProposal({ ...args, historicalGrowth: 0.2, payoutLevel: 0 }).value).toBeCloseTo(0.085);
  });

  it("lässt die Einbehaltungsgrenze bei negativem Eigenkapital weg und schlägt bei negativem Wachstum nichts vor", () => {
    expect(growthProposal({ historicalGrowth: 0.05, payoutLevel: 4, earningsLevel: 4, equityPerShare: -5 })).toEqual({
      value: 0.05,
      retentionCap: null,
    });
    expect(
      growthProposal({ historicalGrowth: -0.02, payoutLevel: 1, earningsLevel: 4, equityPerShare: 20 }).value,
    ).toBeNull();
  });
});

const ALL_MET: RiskRatings = {
  earnings: 0, financing: 0, size: 0, age: 0, sector: 0, country: 0, moat: 0, returnOnCapital: 0,
  ebitMargin: 0, management: 0, forecast: 0, cashFlow: 0, dependencies: 0, currency: 0, situation: 0,
};

describe("Risiko", () => {
  it("rechnet die Einstufungen aus Buchkapitel 5.9 nach", () => {
    // Wal-Mart: Bonus Gewinn 10, Finanzierung 5, Bonus Wettbewerb 5, EBIT-Marge 10.
    const walmart = assessRisk({ ...ALL_MET, earnings: -0.1, financing: 0.05, moat: -0.05, ebitMargin: 0.1 });
    expect(walmart.score).toBeCloseTo(0);
    expect(riskClass(walmart.score)).toBe("hervorragend");
    // Flughafen Wien: Gewinn 10, Größe 10, Finanzierung 15, Rendite 5, Dividende 5, Bonus Monopol 10.
    // Die Einzelwerte ergeben 35 %; das Buch nennt als Summe 40 %.
    const vienna = assessRisk({
      ...ALL_MET, earnings: 0.1, size: 0.1, financing: 0.15, returnOnCapital: 0.05, cashFlow: 0.05, moat: -0.1,
    });
    expect(vienna.score).toBeCloseTo(0.35);
    expect(riskClass(vienna.score)).toBe("durchschnittlich");
  });

  it("meldet fehlende Faktoren und lässt den Risikowert nicht unter 0 fallen", () => {
    const { management: _omitted, ...withoutManagement } = ALL_MET;
    expect(assessRisk(withoutManagement)).toMatchObject({ complete: false, missing: ["management"] });
    expect(assessRisk({ ...ALL_MET, moat: -0.2, management: -0.1 }).score).toBe(0);
  });

  it("weist Werte außerhalb des Rasters zurück", () => {
    expect(() => assessRisk({ ...ALL_MET, currency: 0.2 })).toThrow();
    expect(() => assessRisk({ ...ALL_MET, size: -0.1 })).toThrow();
  });

  it("ordnet Klassen und Ausfallwahrscheinlichkeit zu", () => {
    expect(riskClass(0.6)).toBe("riskant");
    expect(riskClass(0.75)).toBe("Spekulation");
    expect(defaultProbability(0)).toBeCloseTo(0.005);
    expect(defaultProbability(0.26)).toBeCloseTo(0.018);
  });

  it("schlägt die Zahlenfaktoren nach den Regeln vor", () => {
    expect(proposeEarnings(WALMART)).toBe(-0.1);
    expect(proposeEarnings(BASF)).toBe(0.125); // 2009 mehr als halbiert
    expect(proposeEarnings([1, -1, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(0.25);
    expect(proposeEarnings([1, -1, -1, -1, 1, 1, 1, 1, 1, 1])).toBe(0.5);

    const solid = { currentAssets: 2, currentLiabilities: 1, longTermDebt: 2, operatingCashFlow: 1 };
    expect(proposeFinancing({ ...solid, equityRatio: 0.415, steadyEarnings: false })).toBeCloseTo(0.085);
    expect(proposeFinancing({ ...solid, equityRatio: 0.415, steadyEarnings: true })).toBe(0);
    expect(proposeFinancing({ ...solid, equityRatio: 0.39, longTermDebt: 4, steadyEarnings: false })).toBeCloseTo(0.21);

    expect(proposeSize(20e9)).toBe(0);
    expect(proposeSize(2e9)).toBeCloseTo(0.4 / 3);
    expect(proposeSize(1e6)).toBe(0.4);
    expect(proposeAge(25)).toBe(0);
    expect(proposeAge(3)).toBeCloseTo(0.3);
    expect(proposeCountry("Europa")).toBe(0);
    expect(proposeCountry("Asien")).toBe(0.125);
    expect(proposeProfitability(0.25)).toBe(-0.05);
    expect(proposeProfitability(0.075)).toBeCloseTo(0.075);
    expect(proposeProfitability(0.02)).toBeCloseTo(0.15);
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 10, paysOut: true, dividendCutInLastTenYears: false })).toBe(0);
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 10, paysOut: true, dividendCutInLastTenYears: true })).toBe(0.05);
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 0, paysOut: false, dividendCutInLastTenYears: false })).toBe(0.25);
    expect(proposeCurrency("gbp")).toBe(0);
    expect(proposeCurrency("KZT")).toBe(0.1);
  });
});

function stock(id: string, innerReturnValue: number, overrides: Partial<Stock> = {}): Stock {
  return {
    id, innerReturn: innerReturnValue, riskScore: 0.2, complete: true,
    sector: id, region: "Europa", heldWeight: 0, ...overrides,
  };
}

describe("Zielportfolio", () => {
  it("berechnet das Positionslimit aus Basislimit und Risikowert", () => {
    expect(positionLimit(0.125, 0.4)).toBeCloseTo(0.075);
  });

  it("füllt absteigend nach innerer Rendite bis zum Limit und lässt den Rest als Cash", () => {
    const target = targetPortfolio([stock("A", 0.1), stock("B", 0.14), stock("C", 0.12)], PROFILE_FOCUSED);
    expect(target.positions.map((p) => p.id)).toEqual(["B", "C", "A"]);
    expect(target.positions[0]!.weight).toBeCloseTo(0.12);
    expect(target.cash).toBeCloseTo(1 - 3 * 0.12);
  });

  it("schließt unvollständige, zu riskante und zu renditeschwache Titel aus", () => {
    const target = targetPortfolio(
      [
        stock("offen", 0.2, { complete: false }),
        stock("riskant", 0.2, { riskScore: 0.75 }),
        stock("schwach", 0.08),
        stock("ohne", 0.2, { innerReturn: null }),
        stock("gut", 0.09),
      ],
      PROFILE_FOCUSED,
    );
    expect(target.positions.map((p) => p.id)).toEqual(["gut"]);
  });

  it("hält sich im globalen Profil an Zählregel, Branchen- und Regionsgrenze", () => {
    const sameSector = ["A", "B", "C"].map((id, i) => stock(id, 0.15 - i / 100, { sector: "Tabak" }));
    expect(targetPortfolio(sameSector, PROFILE_GLOBAL).positions.map((p) => p.id)).toEqual(["A", "B"]);

    const europe = Array.from({ length: 12 }, (_, i) => stock(`E${String(i).padStart(2, "0")}`, 0.2 - i / 1000));
    const target = targetPortfolio(europe, PROFILE_GLOBAL);
    const total = target.positions.reduce((sum, p) => sum + p.weight, 0);
    expect(total).toBeCloseTo(0.4);
    expect(target.positions.every((p) => p.weight >= PROFILE_GLOBAL.minPosition - 1e-9)).toBe(true);
  });

  it("tauscht einen gehaltenen Titel erst oberhalb der Tauschschwelle", () => {
    // Ein Platz frei: Limit 100 %, damit nur der erste Titel aufgenommen wird.
    const onePlace = { ...PROFILE_FOCUSED, baseLimit: 1.25 };
    const held = stock("alt", 0.1, { heldWeight: 1 });
    const slightlyBetter = targetPortfolio([held, stock("neu", 0.105)], onePlace);
    expect(slightlyBetter.positions.map((p) => p.id)).toEqual(["alt"]);
    const clearlyBetter = targetPortfolio([held, stock("neu", 0.12)], onePlace);
    expect(clearlyBetter.positions.map((p) => p.id)).toEqual(["neu"]);
  });

  it("kürzt eine über ihr Limit gewachsene Position nicht und schlägt Käufe und Verkäufe vor", () => {
    const stocks = [
      stock("gewachsen", 0.12, { heldWeight: 0.3 }),
      stock("neu", 0.11),
      stock("raus", 0.05, { heldWeight: 0.1 }),
    ];
    const target = targetPortfolio(stocks, PROFILE_FOCUSED);
    expect(target.positions.find((p) => p.id === "gewachsen")!.weight).toBeCloseTo(0.3);
    const result = proposals(stocks, target);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: "raus", action: "verkaufen", change: -0.1 });
    expect(result.find((p) => p.id === "neu")).toMatchObject({ action: "kaufen" });
  });
});
