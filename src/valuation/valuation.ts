// Bewertung einer Aktie: Vorschläge aus den Fundamentaldaten, manuelle Übersteuerung, innere Rendite.
// Reine Rechnung ohne Datenbank- und Netzzugriff (Spezifikation Abschnitte 4 bis 6).

import {
  assessRisk, defaultProbability, dividendLevel, dividendWasCut, earningsLevel, growthProposal, historicalGrowth,
  MANUAL_FOR_FINANCIALS, netBuybacksPerShare, payoutLevelProposal, proposeAge, proposeCashFlow, proposeCountry,
  proposeCurrency, proposeEarnings, proposeFinancing, proposeProfitability, proposeSize, RISK_FACTOR_IDS, RISK_FACTORS,
  riskClass,
  scenarioReturns,
} from "../calc/index.ts";
import type { Region, RiskClass, RiskFactorId, RiskRatings, ScenarioReturns } from "../calc/index.ts";
import type { FundamentalsYear, Stock } from "../data/db.ts";

/** Schlüssel einer Eingabe: `payoutLevel`, `growth` oder `risk.<Faktor>`. */
export type InputKey = "payoutLevel" | "growth" | `risk.${RiskFactorId}`;

export const INPUT_KEYS: InputKey[] = ["payoutLevel", "growth", ...RISK_FACTOR_IDS.map((id) => `risk.${id}` as const)];

export type InputValues = Partial<Record<InputKey, number>>;

export interface Proposals {
  /** Automatische Vorschläge; ein fehlender Schlüssel bedeutet: kein Vorschlag möglich. */
  values: InputValues;
  /** Zwischenwerte je Aktie in Berichtswährung, zur Anzeige und Kontrolle. */
  details: {
    fiscalYears: number[];
    earningsLevel: number | null;
    dividendLevel: number | null;
    netBuybacksPerShare: number | null;
    sustainablePayout: number | null;
    historicalGrowth: number | null;
    revenueGrowth: number | null;
    retentionCap: number | null;
  };
  /** Hinweise für die Oberfläche, z. B. gegriffene Deckelung oder fehlende Daten. */
  notes: string[];
}

const REGIONS: readonly string[] = ["Europa", "Nordamerika", "Japan", "Asien", "Südamerika", "Afrika", "Ozeanien"];

const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

function allNumbers(values: readonly (number | null)[]): values is number[] {
  return values.every((v) => v !== null);
}

/**
 * Vorschläge aus den letzten zehn Geschäftsjahren. Nicht gemeldete Dividenden, Rückkäufe, Aktienausgaben und
 * aktienbasierte Vergütung zählen als 0; fehlen dagegen Gewinn oder Aktienzahl, gibt es keinen Vorschlag.
 *
 * @param years Geschäftsjahre, ältestes zuerst (beliebig viele; verwendet werden die letzten zehn).
 * @param reportingPerEur Einheiten der Berichtswährung je Euro; `null`, wenn kein Wechselkurs vorliegt.
 * @param currentYear Kalenderjahr der Bewertung, für die Existenzdauer.
 */
export function proposeInputs(
  stock: Stock,
  years: readonly FundamentalsYear[],
  reportingPerEur: number | null,
  currentYear: number,
): Proposals {
  const values: InputValues = {};
  const notes: string[] = [];
  const details: Proposals["details"] = {
    fiscalYears: [], earningsLevel: null, dividendLevel: null, netBuybacksPerShare: null,
    sustainablePayout: null, historicalGrowth: null, revenueGrowth: null, retentionCap: null,
  };

  values["risk.currency"] = proposeCurrency(stock.reportingCurrency);
  if (REGIONS.includes(stock.region)) values["risk.country"] = proposeCountry(stock.region as Region);

  // Existenzdauer: Gründungsjahr, mindestens aber die Zeitspanne, für die Abschlüsse vorliegen.
  const firstYear = years[0]?.fiscalYear;
  const knownSince = Math.min(stock.foundedYear ?? Infinity, firstYear ?? Infinity);
  if (Number.isFinite(knownSince)) {
    const age = currentYear - knownSince;
    if (stock.foundedYear !== null || age >= 20) values["risk.age"] = proposeAge(age);
  }

  const ten = years.slice(-10);
  details.fiscalYears = ten.map((y) => y.fiscalYear);
  if (ten.length < 10) {
    notes.push(`Nur ${ten.length} Geschäftsjahre vorhanden, zehn sind nötig.`);
    return { values, details, notes };
  }
  const last = ten[9]!;
  if (last.fiscalYear < currentYear - 2) notes.push(`Letzter Abschluss ist von ${last.fiscalYear}.`);

  const eps = ten.map((y) => y.epsDiluted);
  const shares = ten.map((y) => y.shares);
  if (!allNumbers(eps) || !allNumbers(shares) || shares.some((s) => !(s > 0))) {
    notes.push("Gewinn je Aktie oder Aktienzahl fehlt in mindestens einem Jahr.");
    return { values, details, notes };
  }

  // Rückflussniveau
  const dividends = ten.map((y) => y.dividendPerShare ?? 0);
  const level = earningsLevel(eps);
  const divLevel = dividendLevel(dividends);
  const buybacks = netBuybacksPerShare(
    ten.map((y, i) => ({
      repurchases: y.repurchases ?? 0,
      issuance: y.issuance ?? 0,
      stockBasedCompensation: y.stockBasedCompensation ?? 0,
      shares: shares[i]!,
    })),
  );
  const fcfPerShare = ten.slice(5).map((y, i) => (y.freeCashFlow === null ? null : y.freeCashFlow / shares[i + 5]!));
  const sustainable = stock.isFinancial ? level : allNumbers(fcfPerShare) ? mean(fcfPerShare) : null;
  Object.assign(details, { earningsLevel: level, dividendLevel: divLevel, netBuybacksPerShare: buybacks, sustainablePayout: sustainable });

  let payout: number | null = null;
  if (sustainable === null) {
    notes.push(stock.isFinancial ? "Gewinnniveau nicht bestimmbar, daher kein Vorschlag für den Rückfluss." : "Freier Cashflow fehlt, daher kein Vorschlag für den Rückfluss.");
  } else {
    const proposal = payoutLevelProposal({ dividendLevel: divLevel, netBuybacksPerShare: buybacks, sustainablePayout: sustainable });
    payout = proposal.value;
    values.payoutLevel = payout;
    if (proposal.capped) notes.push(`Rückfluss auf den tragbaren Wert gedeckelt (${(divLevel + buybacks).toFixed(2)} auf ${payout.toFixed(2)}).`);
    if (payout === 0) notes.push("Rückflussniveau ist 0, eine innere Rendite lässt sich daraus nicht rechnen.");
  }

  // Wachstum
  const growthHistory = historicalGrowth(eps);
  details.historicalGrowth = growthHistory;
  const equityPerShare = last.equity === null ? null : last.equity / last.shares!;
  if (payout !== null && equityPerShare !== null) {
    const revenuePerShare = ten.map((y, i) => (y.revenue === null ? null : y.revenue / shares[i]!));
    const revenueGrowth = allNumbers(revenuePerShare) ? historicalGrowth(revenuePerShare) : null;
    details.revenueGrowth = revenueGrowth;
    const growth = growthProposal({ historicalGrowth: growthHistory, revenueGrowth, payoutLevel: payout, earningsLevel: level, equityPerShare });
    details.retentionCap = growth.retentionCap;
    if (growth.value !== null) values.growth = growth.value;
    else notes.push("Historisches Wachstum negativ oder nicht bestimmbar, Wachstum muss von Hand gesetzt werden.");
    if (equityPerShare <= 0) notes.push("Eigenkapital negativ, die Wachstumsgrenze aus Einbehaltung entfällt.");
  }

  // Risikofaktoren aus Zahlen
  const earningsRating = proposeEarnings(eps);
  values["risk.earnings"] = earningsRating;
  if (last.totalAssets !== null && reportingPerEur !== null) values["risk.size"] = proposeSize(last.totalAssets / reportingPerEur);
  else if (reportingPerEur === null) notes.push(`Kein Wechselkurs für ${stock.reportingCurrency}, Größe nicht bewertbar.`);

  if (!stock.isFinancial) {
    if (last.equity !== null && last.totalAssets && last.currentAssets !== null && last.currentLiabilities !== null && last.operatingCashFlow !== null) {
      values["risk.financing"] = proposeFinancing({
        equityRatio: last.equity / last.totalAssets,
        currentAssets: last.currentAssets,
        currentLiabilities: last.currentLiabilities,
        longTermDebt: last.longTermDebt ?? 0,
        operatingCashFlow: last.operatingCashFlow,
        steadyEarnings: earningsRating < 0,
      });
    }
    // Kapitalrendite und Marge als Durchschnitt der letzten fünf Jahre, damit ein Ausreißerjahr nicht entscheidet.
    const five = ten.slice(5);
    const returns = five.map((y) => (y.ebit === null || y.totalAssets === null ? null : y.ebit / (y.totalAssets - (y.cash ?? 0))));
    const margins = five.map((y) => (y.ebit === null || !y.revenue ? null : y.ebit / y.revenue));
    if (allNumbers(returns)) values["risk.returnOnCapital"] = proposeProfitability(mean(returns));
    if (allNumbers(margins)) values["risk.ebitMargin"] = proposeProfitability(mean(margins));
  }

  values["risk.cashFlow"] = proposeCashFlow({
    positiveFreeCashFlowYears: ten.filter((y) => (y.freeCashFlow ?? 0) > 0).length,
    paysOut: divLevel > 0 || buybacks > 0,
    dividendCutInLastTenYears: dividendWasCut(dividends),
  });

  for (const id of MANUAL_FOR_FINANCIALS) if (stock.isFinancial) delete values[`risk.${id}`];
  return { values, details, notes };
}

export interface Valuation {
  /** Geltende Eingaben: manueller Wert, sonst Vorschlag. */
  inputs: InputValues;
  /** Schlüssel, bei denen ein manueller Wert gilt. */
  manual: InputKey[];
  /** Eingaben ohne Wert. Solange eine fehlt, ist die Bewertung unvollständig. */
  missing: InputKey[];
  complete: boolean;
  /** Summe der gesetzten Risikofaktoren; bei fehlenden Faktoren eine Untergrenze. */
  riskScore: number;
  riskClass: RiskClass;
  defaultProbability: number;
  /** Kurs je Aktie in Berichtswährung; `null`, wenn Kurs oder Wechselkurs fehlen. */
  price: number | null;
  /** Innere Rendite mit Bandbreite; bei unvollständiger Bewertung vorläufig (fehlende Risikofaktoren als 0). */
  returns: ScenarioReturns | null;
}

/** Führt Vorschläge und manuelle Werte zusammen und rechnet die innere Rendite. */
export function evaluate(proposals: InputValues, manualValues: InputValues, price: number | null): Valuation {
  const inputs: InputValues = { ...proposals, ...manualValues };
  const manual = INPUT_KEYS.filter((key) => manualValues[key] !== undefined);
  const missing = INPUT_KEYS.filter((key) => inputs[key] === undefined);

  const ratings: RiskRatings = {};
  for (const id of RISK_FACTOR_IDS) {
    const rating = inputs[`risk.${id}`];
    if (rating !== undefined) ratings[id] = rating;
  }
  const risk = assessRisk(ratings);
  const probability = defaultProbability(risk.score);
  const { payoutLevel, growth } = inputs;
  const returns =
    price !== null && payoutLevel !== undefined && growth !== undefined
      ? scenarioReturns(price, { payoutLevel, growth, defaultProbability: probability })
      : null;
  return {
    inputs, manual, missing,
    complete: missing.length === 0 && price !== null && returns?.base != null,
    riskScore: risk.score,
    riskClass: riskClass(risk.score),
    defaultProbability: probability,
    price,
    returns,
  };
}

/** Kurs in Berichtswährung umrechnen; Wechselkurse als Einheiten je Euro. */
export function priceInReportingCurrency(price: number, pricePerEur: number | null, reportingPerEur: number | null): number | null {
  if (pricePerEur === null || reportingPerEur === null) return null;
  return (price / pricePerEur) * reportingPerEur;
}

/**
 * Prüft eine Eingabe von Hand. Rückfluss als Betrag je Aktie, alles andere in Prozent (5 = 5 %, Komma erlaubt).
 * Liefert den Wert als Anteil oder eine Fehlermeldung.
 */
export function parseManualInput(key: InputKey, text: string): { value: number } | { error: string } {
  const entered = Number(text.trim().replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(entered)) return { error: `"${text}" ist keine Zahl.` };
  if (key === "payoutLevel") return entered < 0 ? { error: "Der Rückfluss darf nicht negativ sein." } : { value: entered };
  const value = entered / 100;
  if (key === "growth") {
    return value < -0.2 || value > 0.3 ? { error: "Wachstum: erlaubt sind −20 bis 30 %." } : { value };
  }
  const factor = RISK_FACTORS[key.slice(5) as RiskFactorId];
  if (value > factor.maxDeduction + 1e-9 || value < -factor.bonus - 1e-9) {
    return { error: `${factor.label}: erlaubt sind ${-factor.bonus * 100} bis ${factor.maxDeduction * 100} %.` };
  }
  return { value };
}
