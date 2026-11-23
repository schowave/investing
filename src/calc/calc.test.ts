import { describe, expect, it } from "vitest";
import {
  assessRisk,
  comparableReturn,
  DEFAULT_GROWTH_PARAMS,
  DEFAULT_RETURN_PARAMS,
  defaultProbability,
  dividendLevel,
  earningsLevel,
  growthParamsFor,
  growthProposal,
  historicalGrowth,
  hurdleRate,
  innerReturn,
  isCandidate,
  levelFromAverage,
  lossesAtEnd,
  lowerGrowth,
  netBuybacksPerShare,
  PROFILE_FOCUSED,
  PROFILE_GLOBAL,
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
  type RiskRatings,
  requiredDebtRepayment,
  returnParamsFor,
  riskClass,
  type Stock,
  scenarioReturns,
  sustainableCashFlow,
  targetPortfolio,
  terminalPayoutRatio,
  toEuroTerms,
  toLocalTerms,
  usableCompensation,
  withHurdle,
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

  it("rechnet mit schrumpfendem Rückfluss und hält die Bandbreite geordnet", () => {
    const shrinking = { ...IMPERIAL, growth: -0.03 };
    const s = scenarioReturns(30, shrinking);
    expect(s.base!).toBeLessThan(innerReturn(30, { ...IMPERIAL, growth: 0 })!);
    expect(s.cautious!).toBeLessThan(s.base!);
    expect(s.base!).toBeLessThan(s.optimistic!);
  });
});

describe("steigende Ausschüttungsquote", () => {
  // Gewinn 10, davon 2 ausgeschüttet, Wachstum 8,5 %: Einbehaltene Gewinne bringen 6,5 % / 0,8 = 8,1 %.
  const grower = { payoutLevel: 2, growth: 0.085, defaultProbability: 0.02, earningsLevel: 10 };

  it("rechnet einbehaltene Gewinne an, soweit sie Wachstum gebracht haben", () => {
    // Ziel 90 % (Dauerwachstum 3 % braucht 10 % des Gewinns), angerechnet zu 81,25 %: 0,2 + 0,8125 · 0,7.
    expect(terminalPayoutRatio(grower)).toBeCloseTo(0.76875);
    // Volle Anrechnung ab 10 % Rendite auf das Einbehaltene.
    expect(terminalPayoutRatio({ ...grower, payoutLevel: 4 })).toBeCloseTo(0.9);
  });

  it("lässt die Quote, wenn einbehalten wird, ohne dass das Unternehmen wächst", () => {
    const trap = { ...grower, growth: 0.02 };
    expect(terminalPayoutRatio(trap)).toBeCloseTo(0.2);
    expect(innerReturn(40, trap)!).toBeCloseTo(innerReturn(40, { ...trap, earningsLevel: null })!, 10);
  });

  it("senkt die Quote nie und braucht ein Gewinnniveau", () => {
    expect(terminalPayoutRatio({ ...grower, payoutLevel: 9.5 })).toBeCloseTo(0.95);
    expect(terminalPayoutRatio({ ...grower, payoutLevel: 12 })).toBeNull();
    expect(terminalPayoutRatio({ ...grower, earningsLevel: null })).toBeNull();
    expect(terminalPayoutRatio(IMPERIAL)).toBeNull();
  });

  it("hebt die innere Rendite eines Wachstumswerts und lässt das erste Jahr unverändert", () => {
    const without = { ...grower, earningsLevel: null };
    expect(innerReturn(40, grower)!).toBeGreaterThan(innerReturn(40, without)! + 0.03);
    const rate = innerReturn(40, grower)!;
    expect(presentValue(rate, grower)).toBeCloseTo(40, 6);
    // Bei sehr hohem Zins zählt fast nur das erste Jahr: Dort gilt noch die heutige Ausschüttung.
    expect(presentValue(50, grower) / presentValue(50, without)).toBeCloseTo(1, 2);
  });

  it("verschiebt in der Bandbreite Rückfluss und Gewinn gemeinsam", () => {
    const s = scenarioReturns(40, grower);
    expect(s.cautious!).toBeLessThan(s.base!);
    expect(s.base!).toBeLessThan(s.optimistic!);
  });
});

describe("Eingaben", () => {
  it("rechnet die BASF-Werte aus dem Buch nach", () => {
    expect(historicalGrowth(BASF)!).toBeCloseTo(0.155, 3);
    // Das Buch rundet das Wachstum vor der Hochrechnung auf 15,5 %; Toleranz laut Spezifikation 7: 0,01.
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

  it("rechnet mit fünf bis neun Jahren aus den beiden Hälften der Reihe", () => {
    // Sieben Jahre mit 10 % Wachstum: erste gegen letzte drei Jahre, vier Jahre auseinander.
    const seven = Array.from({ length: 7 }, (_, i) => 1.1 ** i);
    expect(historicalGrowth(seven)!).toBeCloseTo(0.1);
    // Hochgerechnet wird um die halbe Länge, abgerundet: hier drei Jahre.
    const average = seven.reduce((sum, v) => sum + v, 0) / 7;
    expect(levelFromAverage(seven, 10)!).toBeCloseTo(average * 1.3);
    // Jede Länge von fünf bis zehn trifft ein gleichmäßiges Wachstum genau.
    for (const length of [5, 6, 7, 8, 9, 10]) {
      const series = Array.from({ length }, (_, i) => 2 * 1.06 ** i);
      expect(historicalGrowth(series)!).toBeCloseTo(0.06);
    }
    // Bei fünf Jahren stimmen Rechnung aus der ganzen Reihe und Kontrollrechnung überein.
    const five = [1, 1.2, 1.1, 1.4, 1.5];
    expect(levelFromAverage(five, 10)!).toBeCloseTo(levelFromAverage(five, 5)!);
    expect(earningsLevel([1, 2, 1.5, 2.5, 2])).toBeLessThanOrEqual(2.5);
    expect(() => historicalGrowth([1, 2, 3, 4])).toThrow("Erwartet 5 bis 10 Geschäftsjahre");
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

  it("lässt die Einbehaltungsgrenze bei negativem Eigenkapital weg", () => {
    expect(growthProposal({ historicalGrowth: 0.05, payoutLevel: 4, earningsLevel: 4, equityPerShare: -5 })).toEqual({
      value: 0.05,
      shrinking: false,
      retentionCap: null,
      fromRevenue: false,
    });
  });

  it("schlägt bei schrumpfendem Gewinn das gemessene Wachstum vor, höchstens bis −5 %", () => {
    expect(growthProposal({ historicalGrowth: -0.02, payoutLevel: 1, earningsLevel: 4, equityPerShare: 20 })).toMatchObject({
      value: -0.02,
      shrinking: true,
    });
    expect(growthProposal({ historicalGrowth: -0.12, payoutLevel: 1, earningsLevel: 4, equityPerShare: 20 }).value).toBe(-0.05);
  });

  it("macht ohne bestimmbares Gewinn- und Umsatzwachstum keinen Vorschlag", () => {
    expect(growthProposal({ historicalGrowth: null, payoutLevel: 1, earningsLevel: 4, equityPerShare: 20 })).toMatchObject({
      value: null,
      shrinking: false,
      fromRevenue: false,
    });
  });

  it("nimmt ohne bestimmbares Gewinnwachstum den Umsatz, begrenzt auf −5 % bis 3 %, bei Verlusten am Ende bis 0 %", () => {
    const args = { historicalGrowth: null, payoutLevel: 1, earningsLevel: null, equityPerShare: 20 };
    expect(growthProposal({ ...args, revenueGrowth: 0.18 })).toMatchObject({ value: 0.03, fromRevenue: true, shrinking: false });
    expect(growthProposal({ ...args, revenueGrowth: 0.01 }).value).toBeCloseTo(0.01);
    expect(growthProposal({ ...args, revenueGrowth: -0.3 }).value).toBe(-0.05);
    expect(growthProposal({ ...args, revenueGrowth: 0.18, lossesAtEnd: true }).value).toBe(0);
    expect(growthProposal({ ...args, revenueGrowth: -0.02, lossesAtEnd: true }).value).toBe(-0.02);
    // Die Grenze aus Einbehaltung gilt weiter: Gewinnniveau 4, alles ausgeschüttet, also nur Preissteigerungen.
    expect(growthProposal({ ...args, earningsLevel: 4, payoutLevel: 4, revenueGrowth: 0.18 }).value).toBeCloseTo(0.02);
  });

  it("erkennt Verluste am Ende der Reihe", () => {
    expect(lossesAtEnd([7.4, -14.8, -4.6, -11.3, 73.8])).toBe(false);
    expect(lossesAtEnd([5, 4, 3, -2, -4])).toBe(true);
  });
});

const ALL_MET: RiskRatings = {
  earnings: 0,
  financing: 0,
  size: 0,
  age: 0,
  sector: 0,
  country: 0,
  moat: 0,
  returnOnCapital: 0,
  ebitMargin: 0,
  management: 0,
  forecast: 0,
  cashFlow: 0,
  dependencies: 0,
  currency: 0,
  situation: 0,
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
      ...ALL_MET,
      earnings: 0.1,
      size: 0.1,
      financing: 0.15,
      returnOnCapital: 0.05,
      cashFlow: 0.05,
      moat: -0.1,
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

    // Einmaleffekte unterhalb des EBIT zählen nicht: Coca-Cola 2017 (Steuerreform), Gewinn und EBIT in Mrd. USD.
    const cola = [6.5, 1.2, 6.4, 8.9, 7.7, 9.8, 9.5, 10.7, 10.6, 13.1];
    expect(proposeEarnings(cola)).toBe(0.125);
    expect(proposeEarnings(cola, [8.9, 7.7, 9.2, 11.7, 11.2, 14.0, 12.6, 14.5, 14.7, 17.7])).toBe(0);
    // Das Jahr nach einem Sondergewinn ist kein Einbruch (Charter 2017/18): gemessen wird am Mittel der Vorjahre.
    expect(proposeEarnings([3, 3, 3, 9, 2.5, 3, 3, 3, 3, 3])).toBe(0);
    // Verlust bei intaktem operativem Ergebnis zählt nicht, bei eingebrochenem als Einbruch, bei operativem Verlust voll.
    const oneLoss = [1, 1, 1, -1, 1, 1, 1, 1, 1, 1];
    expect(proposeEarnings(oneLoss, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2])).toBe(0);
    expect(proposeEarnings(oneLoss, [2, 2, 2, 1.2, 2, 2, 2, 2, 2, 2])).toBe(0.125);
    expect(proposeEarnings(oneLoss, [2, 2, 2, -1, 2, 2, 2, 2, 2, 2])).toBe(0.25);
    // Fehlt das EBIT in dem Jahr, entscheidet der Gewinn allein.
    expect(proposeEarnings(oneLoss, [2, 2, 2, null, 2, 2, 2, 2, 2, 2])).toBe(0.25);
    // Ein halbierter Gewinn zählt, wenn auch das EBIT um mehr als 30 % fällt (BASF 2022).
    const halved = [4, 4, 4, 4, 1.5, 4, 4, 4, 4, 4];
    expect(proposeEarnings(halved, [6, 6, 6, 6, 5, 6, 6, 6, 6, 6])).toBe(0);
    expect(proposeEarnings(halved, [6, 6, 6, 6, 4, 6, 6, 6, 6, 6])).toBe(0.125);

    const solid = { netDebt: 100, operatingCashFlow: 100, ebit: 80, interestExpense: 5, currentAssets: 2, currentLiabilities: 1 };
    expect(proposeFinancing(solid)).toBe(0);
    expect(proposeFinancing({ ...solid, netDebt: -50 })).toBe(0);
    // Buch: Nettoschulden bis zum Dreifachen des operativen Cashflows sind in Ordnung, ab dem Sechsfachen gilt der volle Abzug.
    expect(proposeFinancing({ ...solid, netDebt: 300 })).toBe(0);
    expect(proposeFinancing({ ...solid, netDebt: 450 })).toBeCloseTo(0.15);
    expect(proposeFinancing({ ...solid, netDebt: 700 })).toBeCloseTo(0.3);
    expect(proposeFinancing({ ...solid, operatingCashFlow: -10 })).toBeCloseTo(0.3);
    // Zinsdeckung 5: halber Weg zwischen 2 und 8, also 10 %.
    expect(proposeFinancing({ ...solid, interestExpense: 16 })).toBeCloseTo(0.1);
    // Schulden und Zinsdeckung messen dieselbe Last: Es gilt der höhere Abzug, dazu 10 % für knappes Umlaufvermögen.
    const strained = { ...solid, netDebt: 700, interestExpense: 50, currentLiabilities: 3 };
    expect(proposeFinancing(strained)).toBeCloseTo(0.4);
    // Stetige Gewinne tragen mehr Schulden (Buch: Wal-Mart 5 % statt 14 %).
    expect(proposeFinancing({ ...strained, earningsRating: 0.125 })).toBeCloseTo(0.4);
    expect(proposeFinancing({ ...strained, earningsRating: 0 })).toBeCloseTo(0.28);
    expect(proposeFinancing({ ...strained, earningsRating: -0.1 })).toBeCloseTo(0.16);

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
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 10, years: 10, paysOut: true, dividendCutInLastTenYears: false })).toBe(0);
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 10, years: 10, paysOut: true, dividendCutInLastTenYears: true })).toBe(0.05);
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 0, years: 10, paysOut: false, dividendCutInLastTenYears: false })).toBe(0.25);
    // Acht von zehn Jahren, bei kürzerer Reihe derselbe Anteil.
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 6, years: 7, paysOut: true, dividendCutInLastTenYears: false })).toBe(0);
    expect(proposeCashFlow({ positiveFreeCashFlowYears: 5, years: 7, paysOut: true, dividendCutInLastTenYears: false })).toBe(0.125);
    expect(proposeCurrency("gbp")).toBe(0);
    expect(proposeCurrency("KZT")).toBe(0.1);
  });
});

function stock(id: string, innerReturnValue: number, overrides: Partial<Stock> = {}): Stock {
  return {
    id,
    innerReturn: innerReturnValue,
    riskScore: 0.2,
    complete: true,
    sector: id,
    region: "Europa",
    heldWeight: 0,
    ...overrides,
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
        stock("schwach", 0.02),
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
    const slightlyBetter = targetPortfolio([held, stock("neu", 0.125)], onePlace); // 2,5 Punkte Abstand: unter der Schwelle von 3
    expect(slightlyBetter.positions.map((p) => p.id)).toEqual(["alt"]);
    const clearlyBetter = targetPortfolio([held, stock("neu", 0.14)], onePlace);
    expect(clearlyBetter.positions.map((p) => p.id)).toEqual(["neu"]);
  });

  it("kürzt eine über ihr Limit gewachsene Position nicht und schlägt Käufe und Verkäufe vor", () => {
    const stocks = [stock("gewachsen", 0.12, { heldWeight: 0.3 }), stock("neu", 0.11), stock("raus", 0.02, { heldWeight: 0.1 })];
    const target = targetPortfolio(stocks, PROFILE_FOCUSED);
    expect(target.positions.find((p) => p.id === "gewachsen")!.weight).toBeCloseTo(0.3);
    const result = proposals(stocks, target);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ id: "raus", action: "verkaufen", change: -0.1 });
    expect(result.find((p) => p.id === "neu")).toMatchObject({ action: "kaufen" });
  });
});

describe("Schulden, Währung und Hürde", () => {
  it("verlangt Tilgung nur für Schulden über dem Dreifachen des EBITDA", () => {
    expect(requiredDebtRepayment(250, 100)).toBe(0);
    expect(requiredDebtRepayment(500, 100)).toBe(20);
    expect(requiredDebtRepayment(500, -10)).toBe(50);
    expect(requiredDebtRepayment(-40, 100)).toBe(0);
  });

  it("nimmt das vorsichtigere Wachstum", () => {
    expect(lowerGrowth(0.1, 0.04)).toBe(0.04);
    expect(lowerGrowth(0.02, 0.05)).toBe(0.02);
    expect(lowerGrowth(null, 0.05)).toBeNull();
  });

  it("zieht den Inflationsunterschied von Renditen in Fremdwährung ab", () => {
    expect(comparableReturn(0.18, 0.043)).toBeCloseTo(0.1313, 3);
    expect(comparableReturn(0.05, -0.015)).toBeCloseTo(0.066, 3);
    expect(comparableReturn(0.08, 0)).toBeCloseTo(0.08);
    expect(comparableReturn(null, 0.04)).toBeNull();
  });

  it("nimmt die Anleiherendite als Untergrenze, ohne Aufschlag", () => {
    expect(hurdleRate(0.034)).toBeCloseTo(0.034);
    expect(hurdleRate(0.034, { premium: 0.05, floor: 0.07 })).toBeCloseTo(0.084);
    expect(hurdleRate(0.005, { premium: 0.05, floor: 0.07 })).toBe(0.07);
    expect(withHurdle(PROFILE_FOCUSED, 0.04).minReturn).toBeCloseTo(0.04);
    expect(withHurdle(PROFILE_FOCUSED, null).minReturn).toBe(0.03);
  });

  it("lässt jeden vollständig bewerteten Titel zu, der die Anleihe schlägt", () => {
    const profile = { ...PROFILE_FOCUSED, minReturn: 0.034 };
    expect(isCandidate(stock("mäßig", 0.05), profile)).toBe(true);
    expect(isCandidate(stock("darunter", 0.03), profile)).toBe(false);
    expect(isCandidate(stock("offen", 0.2, { complete: false }), profile)).toBe(false);
    expect(isCandidate(stock("riskant", 0.2, { riskScore: 0.75 }), profile)).toBe(false);
    expect(isCandidate(stock("ohne", 0.2, { innerReturn: null }), profile)).toBe(false);
  });
});

describe("Wachstumsgrenzen je Währung (Strategie 4.6)", () => {
  const LIRA = 0.175;
  const euroCompany = { payoutLevel: 5, growth: 0.085, defaultProbability: 0.02 };
  // Dasselbe Unternehmen in Lira: Rückfluss des kommenden Jahres, Gewinn und Wachstum nominal um den Abstand höher.
  const liraCompany = (gap: number, extra: { earningsLevel?: number } = {}) => ({
    payoutLevel: euroCompany.payoutLevel * (1 + gap),
    growth: toLocalTerms(euroCompany.growth, gap),
    defaultProbability: euroCompany.defaultProbability,
    ...(extra.earningsLevel === undefined ? {} : { earningsLevel: extra.earningsLevel * (1 + gap) }),
  });

  it("rechnet beim Abstand 0 bitgleich wie bisher", () => {
    expect(growthParamsFor(0)).toEqual(DEFAULT_GROWTH_PARAMS);
    expect(returnParamsFor(0)).toEqual(DEFAULT_RETURN_PARAMS);
    expect(toLocalTerms(0.085, 0)).toBe(0.085);
    expect(toEuroTerms(0.085, 0)).toBe(0.085);
  });

  it("verschiebt die Grenzen in der Verhältnisform von comparableReturn", () => {
    const params = growthParamsFor(LIRA);
    expect(params.maxGrowth).toBeCloseTo(1.085 * 1.175 - 1);
    expect(params.minGrowth).toBeCloseTo(0.95 * 1.175 - 1);
    expect(params.inflationAllowance).toBeCloseTo(1.02 * 1.175 - 1);
    expect(params.maxGrowthFromRevenue).toBeCloseTo(1.03 * 1.175 - 1);
    expect(params.inflationGap).toBe(LIRA);
    expect(toEuroTerms(toLocalTerms(0.03, LIRA), LIRA)).toBeCloseTo(0.03, 12);
    expect(returnParamsFor(LIRA).maxTerminalGrowth).toBeCloseTo(1.03 * 1.175 - 1);
    // Bei negativem Abstand (Franken) sinken sie.
    expect(growthParamsFor(-0.02).maxGrowth).toBeLessThan(0.085);
  });

  it("liefert für dasselbe Unternehmen in Euro und Lira dieselbe vergleichbare Rendite", () => {
    const euro = innerReturn(100, euroCompany)!;
    const lira = comparableReturn(innerReturn(100, liraCompany(LIRA), returnParamsFor(LIRA)), LIRA)!;
    expect(lira).toBeCloseTo(euro, 8);
    // Auch mit steigender Ausschüttungsquote (Rendite des Einbehaltenen in Euro-Kaufkraft).
    const euroGrower = { ...euroCompany, earningsLevel: 10 };
    const liraGrower = liraCompany(LIRA, { earningsLevel: 10 });
    expect(comparableReturn(innerReturn(100, liraGrower, returnParamsFor(LIRA)), LIRA)!).toBeCloseTo(innerReturn(100, euroGrower)!, 8);
    // Die Bandbreite ist in Euro-Kaufkraft gleich breit.
    const euroBand = scenarioReturns(100, euroGrower);
    const liraBand = scenarioReturns(100, liraGrower, undefined, returnParamsFor(LIRA));
    expect(comparableReturn(liraBand.cautious, LIRA)!).toBeCloseTo(euroBand.cautious!, 8);
    expect(comparableReturn(liraBand.optimistic, LIRA)!).toBeCloseTo(euroBand.optimistic!, 8);
  });

  it("deckelt ohne Verschiebung das Wachstum zu früh (der Fehler, den die Verschiebung behebt)", () => {
    const capped = { ...liraCompany(LIRA), growth: 0.085 };
    const before = comparableReturn(innerReturn(100, capped), LIRA)!;
    const after = comparableReturn(innerReturn(100, liraCompany(LIRA), returnParamsFor(LIRA)), LIRA)!;
    expect(after - before).toBeGreaterThan(0.1);
  });

  it("gilt auch bei negativem Abstand", () => {
    const gap = -0.02;
    const euro = innerReturn(100, euroCompany)!;
    const franc = comparableReturn(innerReturn(100, liraCompany(gap), returnParamsFor(gap)), gap)!;
    expect(franc).toBeCloseTo(euro, 8);
    const band = scenarioReturns(100, liraCompany(gap), undefined, returnParamsFor(gap));
    const euroBand = scenarioReturns(100, euroCompany);
    expect(comparableReturn(band.cautious, gap)!).toBeCloseTo(euroBand.cautious!, 8);
  });

  it("begrenzt den Wachstumsvorschlag in Euro-Kaufkraft", () => {
    const args = { revenueGrowth: 0.5, payoutLevel: 1, earningsLevel: 10, equityPerShare: 20 };
    const params = growthParamsFor(LIRA);
    const cap = toLocalTerms(0.085, LIRA);
    expect(growthProposal({ ...args, historicalGrowth: 0.12 }, DEFAULT_GROWTH_PARAMS).value).toBeCloseTo(0.085);
    expect(growthProposal({ ...args, historicalGrowth: 0.3 }, params).value).toBeCloseTo(cap);
    expect(growthProposal({ ...args, historicalGrowth: 0.3 }, params).shrinking).toBe(false);
    // Unter der Grenze bleibt das gemessene Wachstum.
    expect(growthProposal({ ...args, historicalGrowth: 0.22 }, params).value).toBeCloseTo(0.22);
    // Negativer Abstand: die Grenze sinkt.
    expect(growthProposal({ ...args, historicalGrowth: 0.2 }, growthParamsFor(-0.02)).value).toBeCloseTo(1.085 * 0.98 - 1);
  });

  it("behandelt nominales Wachstum unter dem Abstand als schrumpfend", () => {
    const args = { revenueGrowth: 0.1, payoutLevel: 1, earningsLevel: 10, equityPerShare: 20 };
    // 5 % nominal bei 17,5 Punkten Abstand sind real minus 10 %: Untergrenze (−5 % real) greift.
    const result = growthProposal({ ...args, historicalGrowth: 0.05 }, growthParamsFor(LIRA));
    expect(result.shrinking).toBe(true);
    expect(result.value).toBeCloseTo(toLocalTerms(-0.05, LIRA));
    // Im Euro dagegen wächst dasselbe Wachstum.
    expect(growthProposal({ ...args, historicalGrowth: 0.05 }).shrinking).toBe(false);
    // Real schrumpfend, aber über der Untergrenze (−4,3 % real): das gemessene Wachstum bleibt.
    const mild = growthProposal({ ...args, historicalGrowth: 0.13 }, growthParamsFor(LIRA));
    expect(mild.value).toBeCloseTo(0.13);
    expect(mild.shrinking).toBe(true);
  });

  it("verschiebt auch die Schwellen bei 0 im Umsatzvorschlag", () => {
    const args = { historicalGrowth: null, revenueGrowth: 0.5, payoutLevel: 1, earningsLevel: 100, equityPerShare: 10 };
    const params = growthParamsFor(LIRA);
    // Verluste am Ende: höchstens reales 0, also der Abstand.
    expect(growthProposal({ ...args, lossesAtEnd: true }, params).value).toBeCloseTo(LIRA);
    expect(growthProposal({ ...args, lossesAtEnd: false }, params).value).toBeCloseTo(toLocalTerms(0.03, LIRA));
    expect(growthProposal({ ...args, revenueGrowth: -0.9, lossesAtEnd: true }, params).value).toBeCloseTo(toLocalTerms(-0.05, LIRA));
    // Real schrumpfender Umsatz (5 % nominal) deckelt das Wachstum bei reinem 0, hier dem Abstand.
    expect(growthProposal({ ...args, historicalGrowth: 0.4, revenueGrowth: 0.05 }, params).value).toBeCloseTo(LIRA);
    expect(growthProposal({ ...args, historicalGrowth: 0.4, revenueGrowth: 0.05 }).value).toBeCloseTo(0.05);
  });

  it("behandelt Wachstum genau an der Schwelle nicht als schrumpfend (Gleitkommakante)", () => {
    for (const gap of [-0.03, -0.0075, 0.0123, 0.175]) {
      const atZero = toLocalTerms(0, gap);
      const args = { revenueGrowth: 0.5, payoutLevel: 1, earningsLevel: 10, equityPerShare: 20 };
      const result = growthProposal({ ...args, historicalGrowth: atZero }, growthParamsFor(gap));
      expect(result.shrinking).toBe(false);
      expect(result.value).toBeCloseTo(atZero, 12);
      // Knapp darunter schrumpft er.
      expect(growthProposal({ ...args, historicalGrowth: atZero - 0.001 }, growthParamsFor(gap)).shrinking).toBe(true);
      // Die Bandbreite behandelt reales 0 ebenso: vorsichtig nicht unter 0 real.
      const band = scenarioReturns(100, { ...euroCompany, growth: atZero }, undefined, returnParamsFor(gap));
      const cautious = scenarioReturns(100, { ...euroCompany, growth: toLocalTerms(0, gap) - 0.0 }, undefined, returnParamsFor(gap));
      expect(band.cautious).toBe(cautious.cautious);
    }
    expect(toEuroTerms(toLocalTerms(0, -0.03), -0.03)).toBeCloseTo(0, 15);
  });
});

describe("Tragbarer Cashflow über den Zyklus", () => {
  const cycle = [1, 1, 1, 1, 1, 8, 8, 8, 8, 8];
  const medianOf = (values: number[]) => {
    const sorted = [...values].sort((x, y) => x - y);
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
  };

  it("nimmt ohne Zyklusabzug das Mittel der letzten fünf Jahre, auch wenn die Reihe länger ist", () => {
    const level = sustainableCashFlow(cycle)!;
    expect(level.cashFlow).toBe(8);
    expect(level.longMedian).toBeNull();
    expect(level.usedLong).toBe(false);
    expect(level.windowYears).toBe(5);
  });

  it("nimmt beim Zykliker den niedrigeren Wert aus Fünfjahresmittel und Median der ganzen Reihe", () => {
    const level = sustainableCashFlow(cycle, { cyclical: true })!;
    expect(level.fiveYearAverage).toBe(8);
    expect(level.longMedian).toBe(4.5);
    expect(level.cashFlow).toBe(4.5);
    expect(level.usedLong).toBe(true);
    expect(level.windowYears).toBe(10);
    // Fiel der Zyklus in die letzten fünf Jahre, bleibt es bei diesen.
    expect(sustainableCashFlow([8, 8, 8, 8, 8, 1, 2, 1, 2, 1], { cyclical: true })!.usedLong).toBe(false);
    expect(sustainableCashFlow([4, 4, 4, 4, 4, 1, 2, 1, 2, 1], { cyclical: true })!.cashFlow).toBeCloseTo(1.4);
  });

  it("lässt einzelne stark negative Jahre den langen Wert nicht zerstören (Median statt Mittel)", () => {
    // Drei Jahre mit Buchungsartefakt wie bei einer Finanzsparte; sonst ein Wert um 5, im letzten Jahrfünft höher.
    const series = [-8, -7, -2, 5, 5, 5, 5, 5, 7, 7];
    const level = sustainableCashFlow(series, { cyclical: true })!;
    expect(level.longMedian).toBe(5);
    expect(level.fiveYearAverage).toBeCloseTo(5.8);
    expect(level.cashFlow).toBe(5);
    // Das Mittel läge bei 2,2.
    expect(series.reduce((sum, v) => sum + v, 0) / 10).toBeCloseTo(2.2);
  });

  it("rechnet ältere Jahre mit dem Inflationsabstand auf heutige Kaufkraft hoch, beim Abstand 0 ohne Wirkung", () => {
    const gap = 0.1;
    const level = sustainableCashFlow(cycle, { cyclical: true, inflationGap: gap })!;
    const expected = medianOf(cycle.map((v, i) => v * (1 + gap) ** (cycle.length - 1 - i)));
    expect(level.longMedian).toBeCloseTo(expected, 12);
    expect(level.longMedian!).toBeGreaterThan(4.5);
    expect(level.cashFlow).toBeCloseTo(Math.min(8, expected), 12);
    expect(sustainableCashFlow(cycle, { cyclical: true, inflationGap: 0 })!.longMedian).toBe(4.5);
    // Mit niedrigerer Inflation als der Euro schrumpfen ältere Jahre.
    expect(sustainableCashFlow(cycle, { cyclical: true, inflationGap: -0.05 })!.longMedian!).toBeLessThan(4.5);
  });

  it("hält auch bei hohem Abstand und negativen älteren Jahren am Median fest", () => {
    const gap = 0.5;
    const series = [-5, -5, -5, -5, -5, 8, 8, 8, 8, 8];
    const level = sustainableCashFlow(series, { cyclical: true, inflationGap: gap })!;
    const expected = medianOf(series.map((v, i) => v * (1 + gap) ** (series.length - 1 - i)));
    // Die negativen Jahre wachsen mit dem Abstand zu großen Fehlbeträgen; der Median bleibt von den Rändern unberührt.
    expect(level.longMedian).toBeCloseTo(expected, 12);
    expect(level.longMedian!).toBeLessThan(0);
    expect(level.cashFlow).toBe(level.longMedian);
    expect(level.usedLong).toBe(true);
  });

  it("nimmt bei fehlenden älteren Jahren den Median der vorhandenen und verlangt die letzten fünf", () => {
    const gaps = [null, null, 1, 1, 1, 1, 1, 1, 1, 8];
    const level = sustainableCashFlow(gaps, { cyclical: true })!;
    expect(level.longMedian).toBe(1);
    expect(level.windowYears).toBe(8);
    expect(
      sustainableCashFlow(
        [1, 1, 1, 1, null, 8, 8, 8, 8, 8].map((v, i) => (i === 7 ? null : v)),
        { cyclical: true },
      ),
    ).toBeNull();
    // Fehlen alle älteren Jahre, gibt es keinen langen Wert (kein Hochrechnen derselben fünf Jahre).
    expect(
      sustainableCashFlow([null, null, null, null, null, 8, 8, 8, 8, 8], { cyclical: true, inflationGap: -0.1 })!.longMedian,
    ).toBeNull();
  });

  it("greift bei kürzerer Reihe auf die vorhandene Länge", () => {
    const short = [1, 1, 1, 1, 8, 8, 8];
    const level = sustainableCashFlow(short, { cyclical: true })!;
    expect(level.windowYears).toBe(7);
    expect(level.longMedian).toBe(1);
    expect(level.fiveYearAverage).toBeCloseTo(5.2);
    expect(level.cashFlow).toBe(1);
    expect(sustainableCashFlow(cycle.slice(5), { cyclical: true })!.longMedian).toBeNull();
    expect(sustainableCashFlow(cycle.slice(6), { cyclical: true })).toBeNull();
  });

  it("zieht das Mittel der Vergütung derselben Jahre ab und mittelt nur über Jahre mit Wert", () => {
    const sbc = [0, 0, 0, 0, 0, 2, 2, 2, 2, 2];
    expect(sustainableCashFlow(cycle, { compensationPerShare: sbc })!.compensation).toBe(2);
    // Ganze Reihe: fünf Jahre mit 0, fünf mit 2 gemeldet.
    const long = sustainableCashFlow(cycle, { cyclical: true, compensationPerShare: sbc })!;
    expect(long.usedLong).toBe(true);
    expect(long.compensation).toBe(1);
    // Fehlende Jahre zählen nicht als 0: Mittel aus 2 und 4.
    const sparse = [null, null, null, null, null, 2, null, 4, null, null];
    expect(sustainableCashFlow(cycle, { compensationPerShare: sparse })!.compensation).toBe(3);
    expect(sustainableCashFlow(cycle, { cyclical: true, compensationPerShare: sparse })!.compensation).toBe(3);
    // Kein Wert in der ganzen Reihe: 0.
    expect(sustainableCashFlow(cycle, { compensationPerShare: sparse.map(() => null) })!.compensation).toBe(0);
    expect(sustainableCashFlow(cycle)!.compensation).toBe(0);
  });

  it("zieht bei Zyklikern mit niedrigerem Fünfjahreswert die Vergütung der letzten fünf Jahre ab", () => {
    const high = [8, 8, 8, 8, 8, 1, 2, 1, 2, 1];
    const sbc = [9, 9, 9, 9, 9, 1, 1, 1, 1, 3];
    const level = sustainableCashFlow(high, { cyclical: true, compensationPerShare: sbc })!;
    expect(level.usedLong).toBe(false);
    expect(level.cashFlow).toBeCloseTo(1.4);
    expect(level.windowYears).toBe(5);
    expect(level.compensation).toBeCloseTo(1.4);
  });

  it("rechnet die Vergütung des langen Fensters wie den Cashflow hoch", () => {
    const gap = 0.1;
    const sbc = cycle.map(() => 1);
    const level = sustainableCashFlow(cycle, { cyclical: true, inflationGap: gap, compensationPerShare: sbc })!;
    expect(level.usedLong).toBe(true);
    expect(level.compensation).toBeCloseTo(cycle.reduce((sum, _, i) => sum + (1 + gap) ** (9 - i), 0) / 10, 12);
  });
});

describe("Aktienbasierte Vergütung bereinigen", () => {
  it("macht fehlende, negative und um das Tausendfache überhöhte Werte unbrauchbar, eine gemeldete 0 nicht", () => {
    const raw = [59, 45, null, -8, 63000, 50, 47, 0, 49, 51];
    const { values, flagged } = usableCompensation(raw);
    expect(values).toEqual([59, 45, null, null, null, 50, 47, 0, 49, 51]);
    expect(flagged).toBe(1);
  });

  it("lässt echtes Wachstum der Vergütung und Reihen unter drei positiven Jahren gelten", () => {
    expect(usableCompensation([10, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120]).flagged).toBe(0);
    // Nur zwei positive Jahre: kein Median, kein Ausreißertest.
    expect(usableCompensation([1, 5000, null, null, null]).flagged).toBe(0);
    expect(usableCompensation([1, 5000, null, null, null]).values).toEqual([1, 5000, null, null, null]);
  });

  it("prüft nichts, wenn es keine positiven Jahre gibt (Median 0)", () => {
    const { values, flagged } = usableCompensation([0, 0, 0, 0, 0, 0]);
    expect(values).toEqual([0, 0, 0, 0, 0, 0]);
    expect(flagged).toBe(0);
    expect(usableCompensation([0, 0, 0, 0, 5]).flagged).toBe(0);
  });

  it("erkennt nur grobe Fehler: das Fünfzigfache bleibt, das Hundertfünfzigfache fällt", () => {
    expect(usableCompensation([10, 10, 10, 10, 500]).flagged).toBe(0);
    expect(usableCompensation([10, 10, 10, 10, 1500]).flagged).toBe(1);
  });
});
