// Risikobewertung (Spezifikation Abschnitt 6).
// Abzüge sind positive Anteile (0.25 = 25 %), Boni negative.

export const RISK_FACTORS = {
  earnings: { label: "Gewinn- und Umsatzentwicklung", maxDeduction: 0.5, bonus: 0.1, manual: false },
  financing: { label: "Finanzierung", maxDeduction: 0.5, bonus: 0, manual: false },
  size: { label: "Größe", maxDeduction: 0.4, bonus: 0, manual: false },
  age: { label: "Existenzdauer", maxDeduction: 0.3, bonus: 0, manual: false },
  sector: { label: "Branche", maxDeduction: 0.25, bonus: 0, manual: true },
  country: { label: "Land", maxDeduction: 0.25, bonus: 0, manual: false },
  moat: { label: "Wettbewerbsvorteile", maxDeduction: 0.2, bonus: 0.2, manual: true },
  returnOnCapital: { label: "Rendite auf eingesetztes Kapital", maxDeduction: 0.15, bonus: 0.05, manual: false },
  ebitMargin: { label: "EBIT-Marge", maxDeduction: 0.15, bonus: 0.05, manual: false },
  management: { label: "Management", maxDeduction: 1, bonus: 0.1, manual: true },
  forecast: { label: "Zuverlässigkeit der Prognosen", maxDeduction: 0.4, bonus: 0, manual: true },
  cashFlow: { label: "Free Cashflow und Ausschüttung", maxDeduction: 0.25, bonus: 0, manual: false },
  dependencies: { label: "Abhängigkeiten", maxDeduction: 0.2, bonus: 0, manual: true },
  currency: { label: "Währung", maxDeduction: 0.1, bonus: 0, manual: false },
  situation: { label: "Aktuelle Situation", maxDeduction: 0.3, bonus: 0, manual: true },
} as const;

export type RiskFactorId = keyof typeof RISK_FACTORS;
export const RISK_FACTOR_IDS = Object.keys(RISK_FACTORS) as RiskFactorId[];

/** Faktoren, die bei Banken und Versicherern keinen Vorschlag bekommen. */
export const MANUAL_FOR_FINANCIALS: readonly RiskFactorId[] = ["financing", "returnOnCapital", "ebitMargin"];

export type RiskRatings = Partial<Record<RiskFactorId, number>>;

export interface RiskAssessment {
  /** Risikowert, mindestens 0. */
  score: number;
  /** Alle 15 Faktoren sind gesetzt. */
  complete: boolean;
  missing: RiskFactorId[];
}

export function assessRisk(ratings: RiskRatings): RiskAssessment {
  let sum = 0;
  const missing: RiskFactorId[] = [];
  for (const id of RISK_FACTOR_IDS) {
    const rating = ratings[id];
    if (rating === undefined) {
      missing.push(id);
      continue;
    }
    const { maxDeduction, bonus, label } = RISK_FACTORS[id];
    if (rating > maxDeduction + 1e-12 || rating < -bonus - 1e-12) {
      throw new Error(`${label}: ${rating} liegt außerhalb von ${-bonus} bis ${maxDeduction}`);
    }
    sum += rating;
  }
  return { score: Math.max(0, sum), complete: missing.length === 0, missing };
}

export type RiskClass = "hervorragend" | "durchschnittlich" | "riskant" | "Spekulation";

/** Ab diesem Risikowert ist eine Aktie ausgeschlossen. */
export const EXCLUSION_SCORE = 0.75;

export function riskClass(score: number): RiskClass {
  if (score <= 0.2) return "hervorragend";
  if (score <= 0.5) return "durchschnittlich";
  if (score < EXCLUSION_SCORE) return "riskant";
  return "Spekulation";
}

export interface DefaultProbabilityParams {
  base: number;
  perScore: number;
}

export const DEFAULT_PROBABILITY_PARAMS: DefaultProbabilityParams = { base: 0.005, perScore: 0.05 };

/** Ausfallwahrscheinlichkeit pro Jahr aus dem Risikowert. */
export function defaultProbability(
  score: number,
  params: DefaultProbabilityParams = DEFAULT_PROBABILITY_PARAMS,
): number {
  return params.base + params.perScore * score;
}

// --- Vorschlagsregeln für die Zahlenfaktoren (Abschnitt 6.2) ---

/** Linear von `worstDeduction` bei `worst` auf 0 bei `good`. */
function interpolate(value: number, worst: number, good: number, worstDeduction: number): number {
  const position = (value - worst) / (good - worst);
  return worstDeduction * (1 - Math.min(1, Math.max(0, position)));
}

/** Faktor 1 aus zehn Jahren Gewinn je Aktie, ältestes zuerst. */
export function proposeEarnings(earningsPerShare: readonly number[]): number {
  const lossYears = earningsPerShare.filter((e) => e < 0).length;
  if (lossYears >= 3) return 0.5;
  if (lossYears >= 1) return 0.25;
  let halved = false;
  let alwaysRising = true;
  earningsPerShare.forEach((e, i) => {
    const previous = earningsPerShare[i - 1];
    if (previous === undefined) return;
    if (e < previous * 0.5) halved = true;
    if (e <= previous) alwaysRising = false;
  });
  if (halved) return 0.125;
  return alwaysRising ? -0.1 : 0;
}

/**
 * Faktor 2: Verschuldung gemessen an der Ertragskraft statt an der Eigenkapitalquote. Rückkäufe lassen das
 * Eigenkapital schrumpfen, ohne dass ein Unternehmen dadurch schlechter zahlen kann.
 * - Nettoschulden zum EBITDA: bis 1 kein Abzug, ab 4 der volle Abzug von 30 %.
 * - Zinsdeckung (EBIT zu Zinsaufwand): ab 8 kein Abzug, bis 2 der volle Abzug von 20 %.
 * - Kurzfristige Verbindlichkeiten über dem Umlaufvermögen: 10 %.
 */
export function proposeFinancing(args: {
  /** Finanzschulden abzüglich Zahlungsmittel; negativ bei Nettoguthaben. */
  netDebt: number;
  ebitda: number;
  ebit: number;
  /** Zinsaufwand als positive Zahl, 0 wenn keiner anfällt. */
  interestExpense: number;
  currentAssets: number;
  currentLiabilities: number;
}): number {
  let deduction = 0;
  if (args.netDebt > 0) {
    deduction += args.ebitda > 0 ? interpolate(args.netDebt / args.ebitda, 4, 1, 0.3) : 0.3;
  }
  if (args.interestExpense > 0) deduction += interpolate(args.ebit / args.interestExpense, 2, 8, 0.2);
  if (args.currentLiabilities > args.currentAssets) deduction += 0.1;
  return Math.min(0.5, deduction);
}

/** Faktor 3 aus der Bilanzsumme in Euro. */
export function proposeSize(totalAssetsEur: number): number {
  if (!(totalAssetsEur > 0)) return 0.4;
  return interpolate(Math.log10(totalAssetsEur), Math.log10(20e6), Math.log10(20e9), 0.4);
}

/** Faktor 4 aus der Existenzdauer in Jahren. */
export function proposeAge(years: number): number {
  return interpolate(years, 3, 20, 0.3);
}

export type Region = "Europa" | "Nordamerika" | "Japan" | "Asien" | "Südamerika" | "Afrika" | "Ozeanien";

/** Faktor 6. Außerhalb der sicheren Regionen ein Ausgangswert zur manuellen Anpassung. */
export function proposeCountry(region: Region): number {
  return region === "Europa" || region === "Nordamerika" || region === "Japan" ? 0 : 0.125;
}

/** Faktoren 8 und 9: Kapitalrendite bzw. EBIT-Marge als Anteil. */
export function proposeProfitability(ratio: number): number {
  if (ratio >= 0.2) return -0.05;
  return interpolate(ratio, 0.05, 0.1, 0.15);
}

/** Faktor 12. */
export function proposeCashFlow(args: {
  /** Jahre mit positivem freiem Cashflow, von zehn. */
  positiveFreeCashFlowYears: number;
  /** Zahlt Dividende oder kauft netto Aktien zurück. */
  paysOut: boolean;
  dividendCutInLastTenYears: boolean;
}): number {
  if (args.positiveFreeCashFlowYears === 0 && !args.paysOut) return 0.25;
  if (args.positiveFreeCashFlowYears >= 8 && args.paysOut) return args.dividendCutInLastTenYears ? 0.05 : 0;
  return 0.125;
}

const MAJOR_CURRENCIES = new Set(["EUR", "USD", "CHF", "GBP", "JPY"]);

/** Faktor 14 aus der Berichtswährung. */
export function proposeCurrency(reportingCurrency: string): number {
  return MAJOR_CURRENCIES.has(reportingCurrency.toUpperCase()) ? 0 : 0.1;
}
