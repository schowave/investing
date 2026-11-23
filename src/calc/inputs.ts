// Vorschläge für die Eingaben (Strategie 3 und 4).
// Alle Reihen sind Geschäftsjahre, ältestes zuerst: zehn Werte, bei jüngeren Unternehmen mindestens fünf.

import { toLocalTerms } from "./innerReturn.ts";

/** Toleranz beim Vergleich mit dem verschobenen Schwellenwert. */
const GAP_TOLERANCE = 1e-9;

/** Volle Reihe (Buch Kap. 5.2). */
export const FULL_YEARS = 10;
/** Aus weniger Jahren lässt sich weder ein Niveau noch ein Wachstum ablesen. */
export const MIN_YEARS = 5;

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function requireYears(series: readonly number[]): void {
  if (series.length < MIN_YEARS || series.length > FULL_YEARS) {
    throw new Error(`Erwartet ${MIN_YEARS} bis ${FULL_YEARS} Geschäftsjahre, erhalten ${series.length}`);
  }
}

/**
 * Dividenden je Aktie werden aus gezahlter Summe und Aktienzahl gerechnet und schwanken dadurch leicht.
 * Ein Rückgang bis zu diesem Anteil gilt nicht als Kürzung.
 */
const DIVIDEND_NOISE = 0.03;

function neverFalls(series: readonly number[], strictly: boolean): boolean {
  return series.every((v, i) => {
    const previous = series[i - 1];
    return previous === undefined || (strictly ? v > previous : v >= previous * (1 - DIVIDEND_NOISE));
  });
}

/** Die Dividende wurde in der Reihe mindestens einmal gesenkt (kleine Schwankungen zählen nicht). */
export function dividendWasCut(dividendsPerShare: readonly number[]): boolean {
  return !neverFalls(dividendsPerShare, false);
}

/**
 * Wachstum aus dem Vergleich der ersten und der letzten Hälfte der Reihe (bei zehn Jahren je fünf, fünf Jahre
 * auseinander); `null`, wenn nicht bestimmbar. Bei ungerader Länge bleibt das mittlere Jahr außen vor.
 */
export function historicalGrowth(series: readonly number[]): number | null {
  requireYears(series);
  const half = Math.floor(series.length / 2);
  const early = mean(series.slice(0, half));
  const late = mean(series.slice(-half));
  if (!(early > 0) || !(late > 0)) return null;
  return (late / early) ** (1 / (series.length - half)) - 1;
}

/**
 * Niveau aus dem Durchschnitt der ganzen Reihe (`10`) oder der letzten fünf Jahre (`5`), hochgerechnet mit dem
 * Wachstum. Hochgerechnet wird um die halbe Länge der Reihe, abgerundet: bei zehn Jahren fünf wie im Buch, bei fünf
 * Jahren zwei wie in der Kontrollrechnung, sodass beide dort übereinstimmen.
 */
export function levelFromAverage(series: readonly number[], years: 10 | 5): number | null {
  const growth = historicalGrowth(series);
  if (growth === null) return null;
  return years === 10 ? mean(series) * (1 + growth * Math.floor(series.length / 2)) : mean(series.slice(-5)) * (1 + growth * 2);
}

/** Gewinnniveau je Aktie. */
export function earningsLevel(earningsPerShare: readonly number[]): number | null {
  requireYears(earningsPerShare);
  if (neverFalls(earningsPerShare, true)) return earningsPerShare.at(-1)!;
  const fromTen = levelFromAverage(earningsPerShare, 10);
  const fromFive = levelFromAverage(earningsPerShare, 5);
  if (fromTen === null || fromFive === null) return null;
  // Nach einem schwachen ersten Jahrfünft läge die Hochrechnung über jedem erzielten Gewinn.
  return Math.min(fromTen, fromFive, Math.max(...earningsPerShare.slice(-3)));
}

/** Dividendenniveau je Aktie (ohne Sonderdividenden). */
export function dividendLevel(dividendsPerShare: readonly number[]): number {
  requireYears(dividendsPerShare);
  const last = dividendsPerShare.at(-1)!;
  if (neverFalls(dividendsPerShare, false)) return last;
  const fromTen = levelFromAverage(dividendsPerShare, 10) ?? mean(dividendsPerShare);
  // Bei stark fallender Reihe wird die Hochrechnung negativ; eine Dividende ist nie kleiner als 0.
  return Math.max(0, Math.min(fromTen, last));
}

export interface BuybackYear {
  repurchases: number;
  issuance: number;
  stockBasedCompensation: number;
  shares: number;
}

/** Netto-Rückkäufe je Aktie: Durchschnitt der letzten fünf Jahre, mindestens 0. */
export function netBuybacksPerShare(years: readonly BuybackYear[]): number {
  const recent = years.slice(-5);
  if (recent.length === 0) return 0;
  const perShare = recent.map((y) => (y.repurchases - y.issuance - y.stockBasedCompensation) / y.shares);
  return Math.max(0, mean(perShare));
}

export interface CashFlowLevel {
  /** Cashflow je Aktie im gewählten Fenster (Mittel der letzten fünf Jahre oder Median der Reihe), vor Abzug von Vergütung und Tilgung. */
  cashFlow: number;
  /** Mittel der letzten fünf Jahre. */
  fiveYearAverage: number;
  /** Median der ganzen Reihe auf heutige Kaufkraft hochgerechnet; `null`, wo die Regel nicht gilt oder die Reihe nicht länger ist. */
  longMedian: number | null;
  /** Der Median der ganzen Reihe ist niedriger und gilt. */
  usedLong: boolean;
  /** Jahre im gewählten Fenster (mit Cashflow-Wert). */
  windowYears: number;
  /** Mittel der aktienbasierten Vergütung je Aktie über die Jahre des Fensters, in denen ein Wert vorliegt; 0, wenn sie nicht abgezogen wird oder nie vorliegt. */
  compensation: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/**
 * Tragbarer Cashflow je Aktie aus der Reihe (ältestes Jahr zuerst, fünf bis zehn Werte; `null` = nicht gemeldet).
 * Normal gilt das Mittel der letzten fünf Jahre. Bei Zyklikern (`cyclical`: Faktor 1 hat einen Abzug) gilt der
 * niedrigere Wert aus diesem und dem Median der ganzen Reihe, damit fünf Jahre im Hoch die Rendite nicht
 * überschätzen. Der Median statt des Mittels, weil einzelne stark negative Jahre, die kein Zyklus sind (Buchungsartefakte
 * wie eine Finanzsparte), das Mittel zerstören. Ältere Jahre sind in einer Währung mit höherer Inflation nominal zu klein:
 * Das Jahr, das `k` Jahre vor dem letzten liegt, wird für den Median mit `(1 + Inflationsabstand)^k` hochgerechnet. Fehlen in
 * der längeren Reihe einzelne Jahre, gilt der Median der vorhandenen. `null`, wenn eines der letzten fünf fehlt.
 *
 * @param compensationPerShare Aktienbasierte Vergütung je Aktie derselben Jahre, gleiche Länge; `null` = kein verwertbarer Wert.
 *   Ohne Angabe wird nichts abgezogen. Abgezogen wird das Mittel über die Jahre des gewählten Fensters, in denen ein Wert
 *   vorliegt (bei der ganzen Reihe gleich hochgerechnet wie der Cashflow); liegt keiner vor, 0.
 */
export function sustainableCashFlow(
  cashFlowPerShare: readonly (number | null)[],
  options: { cyclical?: boolean; inflationGap?: number; compensationPerShare?: readonly (number | null)[] } = {},
): CashFlowLevel | null {
  const { cyclical = false, inflationGap = 0, compensationPerShare } = options;
  const n = cashFlowPerShare.length;
  const lastFive = cashFlowPerShare.slice(-5);
  if (lastFive.length < 5 || lastFive.some((v) => v === null)) return null;
  const lift = (i: number, scaled: boolean) => (scaled ? (1 + inflationGap) ** (n - 1 - i) : 1);
  const scaledValues = (indices: readonly number[], series: readonly (number | null)[], scaled: boolean): number[] =>
    indices.flatMap((i) => (series[i] == null ? [] : [series[i]! * lift(i, scaled)]));

  const fiveIndices = [n - 5, n - 4, n - 3, n - 2, n - 1];
  const fiveYearAverage = mean(scaledValues(fiveIndices, cashFlowPerShare, false));
  const allIndices = cashFlowPerShare.flatMap((v, i) => (v === null ? [] : [i]));
  const longMedian = cyclical && allIndices.length > 5 ? median(scaledValues(allIndices, cashFlowPerShare, true)) : null;
  const usedLong = longMedian !== null && longMedian < fiveYearAverage;
  const window = usedLong ? allIndices : fiveIndices;
  const paid = compensationPerShare ? scaledValues(window, compensationPerShare, usedLong) : [];
  return {
    cashFlow: usedLong ? longMedian! : fiveYearAverage,
    fiveYearAverage,
    longMedian,
    usedLong,
    windowYears: window.length,
    compensation: paid.length > 0 ? mean(paid) : 0,
  };
}

/** Ein Jahr mit aktienbasierter Vergütung über diesem Vielfachen des Medians der Reihe gilt als Datenfehler des Anbieters. */
const COMPENSATION_OUTLIER = 100;

/**
 * Aktienbasierte Vergütung je Jahr in Berichtswährung, bereinigt um Fehler des Anbieters. Fehlende, negative
 * (Vorzeichenfehler, Rückbuchung) und um mehr als das Hundertfache über dem Median der positiven Jahre liegende Werte
 * sind kein verwertbarer Wert (`null`); eine gemeldete 0 bleibt 0. Der Ausreißertest gilt erst ab drei positiven Jahren
 * und erkennt nur grobe Fehler wie das Tausendfache (Murphy Oil 2021 und 2022); kleinere Abweichungen bleiben unentdeckt.
 * `flagged` zählt die Jahre, die als Ausreißer ausfielen. Ein Vergleich mit dem Umsatz taugt nicht: Unternehmen ohne Umsatz
 * (Biotechnik) zahlen real mehr Vergütung als sie einnehmen.
 */
export function usableCompensation(compensation: readonly (number | null)[]): {
  values: (number | null)[];
  flagged: number;
  /** Jahre mit negativem Wert, die ebenfalls ausfielen. */
  negative: number;
} {
  const positive = compensation.filter((v): v is number => v !== null && v > 0);
  const typical = positive.length >= 3 ? median(positive) : null;
  let flagged = 0;
  let negative = 0;
  const values = compensation.map((v) => {
    if (v === null) return null;
    if (v < 0) {
      negative++;
      return null;
    }
    if (typical !== null && v > COMPENSATION_OUTLIER * typical) {
      flagged++;
      return null;
    }
    return v;
  });
  return { values, flagged, negative };
}

export interface DebtParams {
  /** Nettoschulden bis zu diesem Vielfachen des EBITDA gelten als tragbar. */
  maxDebtToEbitda: number;
  /** Jahre, in denen der Überhang zu tilgen ist. */
  repaymentYears: number;
}

export const DEFAULT_DEBT_PARAMS: DebtParams = { maxDebtToEbitda: 3, repaymentYears: 10 };

/**
 * Jährliche Tilgung, die nötig ist, um überhöhte Schulden abzubauen. Sie steht den Eigentümern nicht zur
 * Verfügung und mindert den tragbaren Rückfluss. Ohne Überhang 0.
 */
export function requiredDebtRepayment(netDebt: number, ebitda: number, params: DebtParams = DEFAULT_DEBT_PARAMS): number {
  const excess = netDebt - params.maxDebtToEbitda * Math.max(0, ebitda);
  return excess > 0 ? excess / params.repaymentYears : 0;
}

/** Vorsichtigeres von zwei Wachstumswerten; `null`, wenn eines nicht bestimmbar ist. */
export function lowerGrowth(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : Math.min(a, b);
}

export interface PayoutProposal {
  value: number;
  /** Die Deckelung auf den tragbaren Rückfluss hat gegriffen. */
  capped: boolean;
}

/** Rückflussniveau R0, gedeckelt auf den tragbaren Rückfluss. */
export function payoutLevelProposal(args: {
  dividendLevel: number;
  netBuybacksPerShare: number;
  /** Fünfjahresdurchschnitt des freien Cashflows je Aktie; bei Finanzwerten das Gewinnniveau. */
  sustainablePayout: number;
}): PayoutProposal {
  const uncapped = args.dividendLevel + args.netBuybacksPerShare;
  const cap = Math.max(0, args.sustainablePayout);
  return uncapped > cap ? { value: cap, capped: true } : { value: uncapped, capped: false };
}

export interface GrowthParams {
  maxGrowth: number;
  /** Untergrenze für schrumpfende Gewinne; der Rückfluss schrumpft dann dauerhaft mit diesem Satz. */
  minGrowth: number;
  /** Wachstum ohne zusätzliches Kapital (Preissteigerungen). */
  inflationAllowance: number;
  /**
   * Obergrenze, wenn das Gewinnwachstum nicht bestimmbar ist und der Vorschlag aus dem Umsatz kommt: das Dauerwachstum.
   * Die Geschichte sagt dann nichts Verlässliches über überdurchschnittliches Wachstum.
   */
  maxGrowthFromRevenue: number;
  /**
   * Inflationsabstand der Berichtswährung zum Euro. Die Grenzen oben sind dann schon verschoben (`growthParamsFor`);
   * hier steht er für die Schwelle bei 0 (reales Nullwachstum), die Wachsen und Schrumpfen trennt.
   */
  inflationGap: number;
}

export const DEFAULT_GROWTH_PARAMS: GrowthParams = {
  maxGrowth: 0.085,
  minGrowth: -0.05,
  inflationAllowance: 0.02,
  maxGrowthFromRevenue: 0.03,
  inflationGap: 0,
};

/**
 * Parameter des Wachstumsvorschlags für eine Währung: Die Grenzen gelten in Euro-Kaufkraft und werden um den
 * Inflationsabstand verschoben (Strategie 4.6). Beim Abstand 0 bleiben sie unverändert.
 */
export function growthParamsFor(inflationGap: number, base: GrowthParams = DEFAULT_GROWTH_PARAMS): GrowthParams {
  return {
    maxGrowth: toLocalTerms(base.maxGrowth, inflationGap),
    minGrowth: toLocalTerms(base.minGrowth, inflationGap),
    inflationAllowance: toLocalTerms(base.inflationAllowance, inflationGap),
    maxGrowthFromRevenue: toLocalTerms(base.maxGrowthFromRevenue, inflationGap),
    inflationGap,
  };
}

/** Der Durchschnitt der späteren Hälfte der Reihe ist nicht positiv: Das Unternehmen macht heute Verluste. */
export function lossesAtEnd(series: readonly number[]): boolean {
  requireYears(series);
  return !(mean(series.slice(-Math.floor(series.length / 2))) > 0);
}

export interface GrowthProposal {
  /** `null`: kein Vorschlag möglich, der Wert muss manuell gesetzt werden. */
  value: number | null;
  /** Der Gewinn schrumpft; der Vorschlag ist das gemessene, negative Wachstum (höchstens bis `minGrowth`). */
  shrinking: boolean;
  /** Obergrenze aus Einbehaltung; `null` bei negativem Eigenkapital oder fehlendem Gewinnniveau. */
  retentionCap: number | null;
  /** Das Gewinnwachstum war nicht bestimmbar; der Vorschlag kommt aus dem Umsatzwachstum. */
  fromRevenue: boolean;
}

/** Wachstum g0 mit Obergrenzen. */
export function growthProposal(
  args: {
    historicalGrowth: number | null;
    /** Wachstum des Umsatzes je Aktie; `null`, wenn nicht bestimmbar (dann ohne diese Grenze). */
    revenueGrowth?: number | null;
    /** Rückfluss vor jeder Deckelung (Dividendenniveau plus Netto-Rückkäufe): Einbehalten ist, was nicht ausgeschüttet wird, nicht was ein Deckel kappt. */
    payoutLevel: number;
    earningsLevel: number | null;
    equityPerShare: number;
    /** Verluste am Ende der Reihe (`lossesAtEnd`); begrenzt den Vorschlag aus dem Umsatz auf reales 0 (den Inflationsabstand). */
    lossesAtEnd?: boolean;
  },
  params: GrowthParams = DEFAULT_GROWTH_PARAMS,
): GrowthProposal {
  let retentionCap: number | null = null;
  if (args.earningsLevel !== null && args.earningsLevel > 0 && args.equityPerShare > 0) {
    const retention = Math.max(0, 1 - args.payoutLevel / args.earningsLevel);
    retentionCap = retention * (args.earningsLevel / args.equityPerShare) + params.inflationAllowance;
  }
  if (args.historicalGrowth === null) {
    // Verluste am Anfang oder Ende der Reihe: Statt des Gewinns trägt der Umsatz, aber nur bis zum Dauerwachstum,
    // damit Zykliker nicht vom Tief aus hochgerechnet werden. Bei Verlusten am Ende höchstens 0 (vorsichtigste Annahme).
    if (args.revenueGrowth == null) return { value: null, shrinking: false, retentionCap, fromRevenue: false };
    const cap = Math.min(args.lossesAtEnd ? params.inflationGap : params.maxGrowthFromRevenue, retentionCap ?? Infinity);
    const value = Math.max(params.minGrowth, Math.min(args.revenueGrowth, cap));
    return { value, shrinking: false, retentionCap, fromRevenue: true };
  }
  // Schrumpfender Gewinn: Der Rückfluss schrumpft mit, dauerhaft. Das ist die vorsichtigste Annahme; die Obergrenzen
  // greifen hier nicht, sie liegen alle beim Inflationsabstand (reales 0) oder darüber. Schrumpfen heißt: real,
  // also unter dem Inflationsabstand; ein nominal wachsender Gewinn in einer Hochinflationswährung zählt dazu.
  // Die Toleranz fängt Gleitkommarauschen ab: Euro-Wachstum genau 0 wird lokal knapp unter dem Abstand.
  if (args.historicalGrowth < params.inflationGap - GAP_TOLERANCE)
    return { value: Math.max(args.historicalGrowth, params.minGrowth), shrinking: true, retentionCap, fromRevenue: false };
  // Gewinn kann auf Dauer nicht schneller wachsen als der Umsatz; schrumpft dieser, bleibt es bei 0.
  const revenueCap = args.revenueGrowth == null ? Infinity : Math.max(params.inflationGap, args.revenueGrowth);
  const value = Math.min(args.historicalGrowth, params.maxGrowth, retentionCap ?? Infinity, revenueCap);
  return { value, shrinking: false, retentionCap, fromRevenue: false };
}
