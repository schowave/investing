// Bewertung einer Aktie: Vorschläge aus den Fundamentaldaten, manuelle Übersteuerung, innere Rendite.
// Reine Rechnung ohne Datenbank- und Netzzugriff (Spezifikation Abschnitte 4 bis 6).

import type { Region, RiskClass, RiskFactorId, RiskRatings, ScenarioReturns } from "../calc/index.ts";
import {
  assessRisk,
  comparableReturn,
  defaultProbability,
  dividendLevel,
  dividendWasCut,
  earningsLevel,
  growthProposal,
  historicalGrowth,
  lowerGrowth,
  MANUAL_FOR_FINANCIALS,
  netBuybacksPerShare,
  payoutLevelProposal,
  proposeAge,
  proposeCashFlow,
  proposeCountry,
  proposeCurrency,
  proposeEarnings,
  proposeFinancing,
  proposeProfitability,
  proposeSize,
  RISK_FACTOR_IDS,
  RISK_FACTORS,
  requiredDebtRepayment,
  riskClass,
  scenarioReturns,
  terminalPayoutRatio,
} from "../calc/index.ts";
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
    /** Gewinnwachstum: das niedrigere aus je Aktie und Gesamtunternehmen. */
    historicalGrowth: number | null;
    /** Umsatzwachstum: das niedrigere aus je Aktie und Gesamtunternehmen. */
    revenueGrowth: number | null;
    earningsGrowthPerShare: number | null;
    earningsGrowthTotal: number | null;
    /** Jährliche Tilgung je Aktie für überhöhte Schulden; mindert den tragbaren Rückfluss. */
    debtRepaymentPerShare: number | null;
    retentionCap: number | null;
    /** Die Dividenden stammen aus der Dividendenhistorie statt aus gezahlter Summe und Aktienzahl. */
    dividendsFromHistory: boolean;
    /** Aktiensplit, um den die Reihen offenbar nicht bereinigt sind. */
    unadjustedSplit: { date: string; ratio: number } | null;
  };
  /** Hinweise für die Oberfläche, z. B. gegriffene Deckelung oder fehlende Daten. */
  notes: string[];
}

export interface History {
  /** Regelmäßige Dividende je Aktie nach Kalenderjahr des Ex-Tags, in Berichtswährung; `null`, wenn nicht nutzbar. */
  dividendsByYear: Map<number, number> | null;
  splits: readonly { date: string; ratio: number }[];
}

const MINOR_UNIT: Record<string, { currency: string; divisor: number }> = {
  GBX: { currency: "GBP", divisor: 100 },
  ILA: { currency: "ILS", divisor: 100 },
  ZAC: { currency: "ZAR", divisor: 100 },
};

/**
 * Summiert regelmäßige Dividenden je Kalenderjahr des Ex-Tags. Sonderdividenden und angekündigte, noch nicht
 * fällige Zahlungen zählen nicht. Liefert `null`, wenn eine Zahlung in einer anderen Währung als der
 * Berichtswährung vorliegt (Hinterlegungsscheine); dann bleibt es bei der Rechnung aus der gezahlten Summe.
 */
export function dividendsByYear(
  payments: readonly { date: string; value: number; currency: string; period: string }[],
  reportingCurrency: string,
  today: string,
): Map<number, number> | null {
  const result = new Map<number, number>();
  for (const payment of payments) {
    if (payment.date > today || /special|extra/i.test(payment.period)) continue;
    const minor = MINOR_UNIT[payment.currency.toUpperCase()];
    const currency = minor?.currency ?? payment.currency.toUpperCase();
    if (currency !== reportingCurrency.toUpperCase()) return null;
    const year = Number(payment.date.slice(0, 4));
    result.set(year, (result.get(year) ?? 0) + payment.value / (minor?.divisor ?? 1));
  }
  return result;
}

/**
 * Findet einen Aktiensplit, um den die Aktienzahl offenbar nicht bereinigt ist: Die Aktienzahl springt im Jahr
 * des Splits ungefähr um dessen Verhältnis. Dann passen Gewinn je Aktie und Kurs nicht zusammen.
 */
export function unadjustedSplit(
  years: readonly { fiscalYear: number; shares: number | null }[],
  splits: readonly { date: string; ratio: number }[],
): { date: string; ratio: number } | null {
  for (const split of splits) {
    if (Math.abs(split.ratio - 1) < 0.2) continue;
    const year = Number(split.date.slice(0, 4));
    for (const candidate of [year, year + 1]) {
      const now = years.find((y) => y.fiscalYear === candidate)?.shares;
      const before = years.find((y) => y.fiscalYear === candidate - 1)?.shares;
      if (now && before && Math.abs(now / before / split.ratio - 1) < 0.25) return split;
    }
  }
  return null;
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
  history: History = { dividendsByYear: null, splits: [] },
): Proposals {
  const values: InputValues = {};
  const notes: string[] = [];
  const details: Proposals["details"] = {
    fiscalYears: [],
    earningsLevel: null,
    dividendLevel: null,
    netBuybacksPerShare: null,
    sustainablePayout: null,
    historicalGrowth: null,
    revenueGrowth: null,
    earningsGrowthPerShare: null,
    earningsGrowthTotal: null,
    debtRepaymentPerShare: null,
    retentionCap: null,
    dividendsFromHistory: false,
    unadjustedSplit: null,
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
  // Dividenden: bevorzugt aus der Dividendenhistorie (echte Beträge je Aktie, ohne Sonderzahlungen). Sie gilt nur,
  // wenn sie zur Rechnung aus gezahlter Summe und Aktienzahl passt; sonst beziehen sich beide auf verschiedene Stückelungen.
  const paid = ten.map((y) => y.dividendPerShare ?? 0);
  let dividends = paid;
  details.unadjustedSplit = unadjustedSplit(ten, history.splits);
  if (history.dividendsByYear !== null) {
    const listed = ten.map((y) => history.dividendsByYear!.get(y.fiscalYear) ?? 0);
    const ratios = paid
      .map((value, i) => (value > 0 && listed[i]! > 0 ? value / listed[i]! : null))
      .filter((r): r is number => r !== null)
      .sort((x, y) => x - y);
    const ratio = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)]! : 1;
    if (ratio >= 0.5 && ratio <= 2) {
      dividends = listed;
      details.dividendsFromHistory = true;
    } else {
      // Entspricht der Abstand einem Aktiensplit, sind die Zahlen je Aktie nicht um ihn bereinigt.
      details.unadjustedSplit ??= history.splits.findLast((split) => Math.abs(ratio / split.ratio - 1) < 0.25) ?? null;
      if (!details.unadjustedSplit) {
        notes.push(
          `Dividendenhistorie und Abschlusszahlen beziehen sich auf verschiedene Stückelungen (Faktor ${ratio.toFixed(1)}); es gilt die Rechnung aus den Abschlüssen.`,
        );
      }
    }
  }
  if (details.unadjustedSplit) {
    notes.push(
      `Aktiensplit vom ${details.unadjustedSplit.date} ist in den Zahlen offenbar nicht bereinigt; Werte je Aktie und Kurs passen nicht zusammen.`,
    );
  }
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
  // Schulden über dem Dreifachen des EBITDA müssen getilgt werden; das Geld steht den Eigentümern nicht zu.
  let repayment = 0;
  if (!stock.isFinancial && last.netDebt !== null && last.ebitda !== null) {
    repayment = requiredDebtRepayment(last.netDebt, last.ebitda) / last.shares!;
    details.debtRepaymentPerShare = repayment;
    if (repayment > 0)
      notes.push(`Hohe Schulden: ${repayment.toFixed(2)} je Aktie und Jahr sind für die Tilgung angesetzt und zählen nicht als Rückfluss.`);
  }
  const sustainable = stock.isFinancial ? level : allNumbers(fcfPerShare) ? Math.max(0, mean(fcfPerShare) - repayment) : null;
  Object.assign(details, { earningsLevel: level, dividendLevel: divLevel, netBuybacksPerShare: buybacks, sustainablePayout: sustainable });

  let payout: number | null = null;
  if (sustainable === null) {
    notes.push(
      stock.isFinancial
        ? "Gewinnniveau nicht bestimmbar, daher kein Vorschlag für den Rückfluss."
        : "Freier Cashflow fehlt, daher kein Vorschlag für den Rückfluss.",
    );
  } else {
    const proposal = payoutLevelProposal({ dividendLevel: divLevel, netBuybacksPerShare: buybacks, sustainablePayout: sustainable });
    payout = proposal.value;
    values.payoutLevel = payout;
    if (proposal.capped)
      notes.push(`Rückfluss auf den tragbaren Wert gedeckelt (${(divLevel + buybacks).toFixed(2)} auf ${payout.toFixed(2)}).`);
    if (payout === 0) notes.push("Rückflussniveau ist 0, eine innere Rendite lässt sich daraus nicht rechnen.");
  }

  // Wachstum
  // Rückkäufe stehen schon im Rückfluss. Das Wachstum je Aktie enthält sie ein zweites Mal, deshalb gilt das
  // niedrigere aus je Aktie und Gesamtunternehmen (bei Verwässerung ist das der Wert je Aktie).
  const perShareGrowth = historicalGrowth(eps);
  const totalGrowth = historicalGrowth(eps.map((e, i) => e * shares[i]!));
  const growthHistory = lowerGrowth(perShareGrowth, totalGrowth);
  Object.assign(details, { historicalGrowth: growthHistory, earningsGrowthPerShare: perShareGrowth, earningsGrowthTotal: totalGrowth });
  const equityPerShare = last.equity === null ? null : last.equity / last.shares!;
  if (payout !== null && equityPerShare !== null) {
    const revenuePerShare = ten.map((y, i) => (y.revenue === null ? null : y.revenue / shares[i]!));
    const revenueGrowth = allNumbers(revenuePerShare)
      ? lowerGrowth(historicalGrowth(revenuePerShare), historicalGrowth(revenuePerShare.map((r, i) => r * shares[i]!)))
      : null;
    details.revenueGrowth = revenueGrowth;
    const growth = growthProposal({
      historicalGrowth: growthHistory,
      revenueGrowth,
      payoutLevel: payout,
      earningsLevel: level,
      equityPerShare,
    });
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
    const netDebt = last.netDebt ?? (last.longTermDebt === null ? null : last.longTermDebt - (last.cash ?? 0));
    const ebitda = last.ebitda ?? last.ebit;
    if (netDebt !== null && ebitda !== null && last.ebit !== null && last.currentAssets !== null && last.currentLiabilities !== null) {
      values["risk.financing"] = proposeFinancing({
        netDebt,
        ebitda,
        ebit: last.ebit,
        interestExpense: last.interestExpense ?? 0,
        currentAssets: last.currentAssets,
        currentLiabilities: last.currentLiabilities,
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
  /**
   * Innere Rendite mit Bandbreite, mit dem Euro vergleichbar gemacht; bei unvollständiger Bewertung vorläufig
   * (fehlende Risikofaktoren als 0).
   */
  returns: ScenarioReturns | null;
  /** Innere Rendite im Basisfall in Berichtswährung, vor dem Währungsabgleich. */
  localReturn: number | null;
  /** Erwartete Inflation der Berichtswährung minus die des Euro. */
  inflationGap: number;
  /**
   * Ausschüttungsquote heute und am Ende der Abschmelzphase, wenn die Rechnung eine steigende Quote annimmt;
   * sonst `null` (kein Gewinnniveau, schon volle Ausschüttung oder einbehaltene Gewinne ohne Wachstum).
   */
  payoutRatio: { now: number; terminal: number } | null;
}

/**
 * Führt Vorschläge und manuelle Werte zusammen und rechnet die innere Rendite.
 * @param earningsLevel Gewinnniveau je Aktie aus den Vorschlägen; ohne es bleibt die Ausschüttungsquote in der Rechnung fest.
 */
export function evaluate(
  proposals: InputValues,
  manualValues: InputValues,
  price: number | null,
  inflationGap = 0,
  earningsLevel: number | null = null,
): Valuation {
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
  const returnInputs =
    payoutLevel !== undefined && growth !== undefined ? { payoutLevel, growth, defaultProbability: probability, earningsLevel } : null;
  const local = price !== null && returnInputs ? scenarioReturns(price, returnInputs) : null;
  const terminalRatio = returnInputs && terminalPayoutRatio(returnInputs);
  const ratioNow = returnInputs && earningsLevel ? returnInputs.payoutLevel / earningsLevel : null;
  const returns = local && {
    cautious: comparableReturn(local.cautious, inflationGap),
    base: comparableReturn(local.base, inflationGap),
    optimistic: comparableReturn(local.optimistic, inflationGap),
  };
  return {
    inputs,
    manual,
    missing,
    complete: missing.length === 0 && price !== null && returns?.base != null,
    riskScore: risk.score,
    riskClass: riskClass(risk.score),
    defaultProbability: probability,
    price,
    returns,
    localReturn: local?.base ?? null,
    inflationGap,
    payoutRatio:
      terminalRatio != null && ratioNow !== null && terminalRatio > ratioNow + 1e-9 ? { now: ratioNow, terminal: terminalRatio } : null,
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

/** Rückfluss über diesem Anteil des Kurses gilt als Datenfehler. */
const MAX_PAYOUT_YIELD = 0.2;
/** Ein Kurs unter diesem Vielfachen des Gewinnniveaus gilt als Datenfehler. */
const MIN_PRICE_TO_EARNINGS = 3;

/**
 * Grobe Prüfung, ob Kurs und Fundamentaldaten zusammenpassen. Sie fängt vor allem Hinterlegungsscheine, deren
 * Zahlen sich auf eine andere Stückelung oder Währung beziehen. Echte Sonderfälle fallen auch darunter.
 */
export function looksImplausible(price: number | null, payoutLevel: number | undefined, earningsLevel: number | null): boolean {
  return implausibleReason(price, payoutLevel, earningsLevel) !== null;
}

function implausibleReason(price: number | null, payoutLevel: number | undefined, earningsLevel: number | null): string | null {
  if (price === null || !(price > 0)) return null;
  if (payoutLevel !== undefined && payoutLevel / price > MAX_PAYOUT_YIELD) {
    return `Rückfluss ist ${Math.round((payoutLevel / price) * 100)} % des Kurses.`;
  }
  if (earningsLevel !== null && earningsLevel > 0 && price / earningsLevel < MIN_PRICE_TO_EARNINGS) {
    return `Kurs ist nur das ${(price / earningsLevel).toFixed(1).replace(".", ",")}-Fache des Gewinnniveaus.`;
  }
  return null;
}

/**
 * Warum Zahlen und Kurs nicht zusammenpassen, oder `null`. Dann ist die Rendite nicht ernst zu nehmen.
 * Eine Prüfung für Rangliste, Datenvorrat, Aktien- und Portfolioseite.
 */
export function doubtfulNumbers(valuation: Valuation, proposals: Proposals): string | null {
  const split = proposals.details.unadjustedSplit;
  if (split) return `Aktiensplit vom ${split.date} ist in den Zahlen nicht bereinigt.`;
  return implausibleReason(valuation.price, valuation.inputs.payoutLevel, proposals.details.earningsLevel);
}
