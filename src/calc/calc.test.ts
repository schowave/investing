import { describe, expect, it } from "vitest";
import {
  assessRisk,
  comparableReturn,
  defaultProbability,
  dividendLevel,
  earningsLevel,
  growthProposal,
  historicalGrowth,
  hurdleRate,
  innerReturn,
  isCandidate,
  levelFromAverage,
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
  riskClass,
  type Stock,
  scenarioReturns,
  targetPortfolio,
  terminalPayoutRatio,
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

  it("lässt die Einbehaltungsgrenze bei negativem Eigenkapital weg und schlägt bei negativem Wachstum nichts vor", () => {
    expect(growthProposal({ historicalGrowth: 0.05, payoutLevel: 4, earningsLevel: 4, equityPerShare: -5 })).toEqual({
      value: 0.05,
      retentionCap: null,
    });
    expect(growthProposal({ historicalGrowth: -0.02, payoutLevel: 1, earningsLevel: 4, equityPerShare: 20 }).value).toBeNull();
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
    const slightlyBetter = targetPortfolio([held, stock("neu", 0.105)], onePlace);
    expect(slightlyBetter.positions.map((p) => p.id)).toEqual(["alt"]);
    const clearlyBetter = targetPortfolio([held, stock("neu", 0.12)], onePlace);
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
