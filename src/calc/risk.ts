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

/**
 * Ersatzabzug für diese drei Faktoren, solange bei einem Finanzwert kein Urteil gesetzt ist (Spezifikation 6.1). Etwa der
 * mittlere Abzug der Nicht-Finanzwerte mit berechenbarer, plausibler Rendite (Finanzierung 9,9 %, Kapitalrendite 4,7 %,
 * EBIT-Marge 2,7 %, Stand 20.11.2026; über alle Nicht-Finanzwerte wären es 16,5 %, 9,1 %, 6,5 %). Vergleichsgruppe sind
 * also die Titel, mit denen ein Finanzwert in der Rangliste konkurriert; fehlende Information zählt nicht wie das beste
 * Ergebnis. Gilt nur für die vorläufige Rechnung; die Bewertung bleibt unvollständig, der Ausschluss prüft ohne ihn.
 */
export const FINANCIAL_STAND_INS: Readonly<Partial<Record<RiskFactorId, number>>> = {
  financing: 0.1,
  returnOnCapital: 0.05,
  ebitMargin: 0.025,
};

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
export function defaultProbability(score: number, params: DefaultProbabilityParams = DEFAULT_PROBABILITY_PARAMS): number {
  return params.base + params.perScore * score;
}

// --- Vorschlagsregeln für die Zahlenfaktoren (Abschnitt 6.2) ---

/** Linear von `worstDeduction` bei `worst` auf 0 bei `good`. */
function interpolate(value: number, worst: number, good: number, worstDeduction: number): number {
  const position = (value - worst) / (good - worst);
  return worstDeduction * (1 - Math.min(1, Math.max(0, position)));
}

/** Ein Jahr gilt als Einbruch, wenn der Gewinn unter diesem Anteil des Mittels der Vorjahre liegt. */
const COLLAPSE = 0.5;
/** Beim operativen Ergebnis genügt ein Rückgang auf diesen Anteil, um einen Einbruch des Gewinns zu bestätigen. */
const OPERATING_COLLAPSE = 0.7;

/** Median der bis zu drei Vorjahre; ein einzelnes Ausnahmejahr verschiebt ihn nicht. `null` ohne Vorjahr. */
function levelBefore(series: readonly (number | null)[], index: number): number | null {
  const before = series
    .slice(Math.max(0, index - 3), index)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (before.length === 0) return null;
  const middle = Math.floor(before.length / 2);
  return before.length % 2 === 1 ? before[middle]! : (before[middle - 1]! + before[middle]!) / 2;
}

/**
 * Faktor 1 aus zehn Jahren Gewinn je Aktie, ältestes zuerst.
 *
 * Das Buch rechnet mit bereinigten Gewinnen. Die Zahlen des Anbieters sind unbereinigt, deshalb zählt ein Verlust oder
 * Einbruch nur, wenn ihn auch das operative Ergebnis zeigt: Steuereffekte und Abschreibungen unterhalb des EBIT (etwa
 * die US-Steuerreform 2017) sind keine Schwäche des Geschäfts. Gemessen wird am Mittel der drei Vorjahre, damit das
 * Jahr nach einem einmaligen Sondergewinn nicht als Einbruch gilt.
 *
 * @param operatingResult EBIT derselben Jahre; `null`, wo es fehlt. Ohne EBIT entscheidet der Gewinn allein.
 */
export function proposeEarnings(earningsPerShare: readonly number[], operatingResult: readonly (number | null)[] = []): number {
  let lossYears = 0;
  let collapsed = false;
  let alwaysRising = true;
  earningsPerShare.forEach((earnings, i) => {
    const previous = earningsPerShare[i - 1];
    if (previous !== undefined && earnings <= previous) alwaysRising = false;

    const operating = operatingResult[i] ?? null;
    const operatingBefore = levelBefore(operatingResult, i);
    const operatingCollapsed = operating !== null && operatingBefore !== null && operating < operatingBefore * OPERATING_COLLAPSE;
    if (earnings < 0) {
      if (operating === null || operating < 0) lossYears++;
      else if (operatingCollapsed) collapsed = true;
      return;
    }
    const before = levelBefore(earningsPerShare, i);
    if (before === null || !(before > 0) || earnings >= before * COLLAPSE) return;
    // Ohne Vergleichswert beim EBIT bleibt es beim Gewinn.
    if (operating === null || operatingBefore === null || operating < 0 || operatingCollapsed) collapsed = true;
  });
  if (lossYears >= 3) return 0.5;
  if (lossYears >= 1) return 0.25;
  if (collapsed) return 0.125;
  return alwaysRising ? -0.1 : 0;
}

/**
 * Faktor 2: Verschuldung gemessen an der Ertragskraft statt an der Eigenkapitalquote. Rückkäufe lassen das
 * Eigenkapital schrumpfen, ohne dass ein Unternehmen dadurch schlechter zahlen kann.
 * - Nettoschulden zum operativen Cashflow (Maß des Buchs): bis 3 kein Abzug, ab 6 der volle Abzug von 30 %.
 * - Zinsdeckung (EBIT zu Zinsaufwand): ab 8 kein Abzug, bis 2 der volle Abzug von 20 %.
 *   Beide messen dieselbe Last; es gilt der höhere Abzug, nicht die Summe.
 * - Kurzfristige Verbindlichkeiten über dem Umlaufvermögen: zusätzlich 10 %.
 * - Das Buch macht die Anforderung von der Stetigkeit der Gewinne abhängig (Wal-Mart: 5 % statt 14 %): Ohne
 *   Verlust und Einbruch in zehn Jahren zählen 70 % des Abzugs, bei stetig steigendem Gewinn 40 %.
 */
export function proposeFinancing(args: {
  /** Finanzschulden abzüglich Zahlungsmittel; negativ bei Nettoguthaben. */
  netDebt: number;
  /** Operativer Cashflow eines Jahres, am besten das Mittel der letzten drei. */
  operatingCashFlow: number;
  ebit: number;
  /** Zinsaufwand als positive Zahl, 0 wenn keiner anfällt. */
  interestExpense: number;
  currentAssets: number;
  currentLiabilities: number;
  /** Bewertung von Faktor 1 (`proposeEarnings`); ohne sie gibt es keinen Nachlass für stetige Gewinne. */
  earningsRating?: number;
}): number {
  let debt = 0;
  if (args.netDebt > 0) debt = args.operatingCashFlow > 0 ? interpolate(args.netDebt / args.operatingCashFlow, 6, 3, 0.3) : 0.3;
  const coverage = args.interestExpense > 0 ? interpolate(args.ebit / args.interestExpense, 2, 8, 0.2) : 0;
  const deduction = Math.max(debt, coverage) + (args.currentLiabilities > args.currentAssets ? 0.1 : 0);
  const rating = args.earningsRating ?? 1;
  return deduction * (rating < 0 ? 0.4 : rating === 0 ? 0.7 : 1);
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
  /** Jahre mit positivem freiem Cashflow. */
  positiveFreeCashFlowYears: number;
  /** Betrachtete Jahre, in der Regel zehn. Verlangt sind acht von zehn. */
  years: number;
  /** Zahlt Dividende oder kauft netto Aktien zurück. */
  paysOut: boolean;
  dividendCutInLastTenYears: boolean;
}): number {
  if (args.positiveFreeCashFlowYears === 0 && !args.paysOut) return 0.25;
  if (args.positiveFreeCashFlowYears >= 0.8 * args.years && args.paysOut) return args.dividendCutInLastTenYears ? 0.05 : 0;
  return 0.125;
}

const MAJOR_CURRENCIES = new Set(["EUR", "USD", "CHF", "GBP", "JPY"]);

/** Faktor 14 aus der Berichtswährung. */
export function proposeCurrency(reportingCurrency: string): number {
  return MAJOR_CURRENCIES.has(reportingCurrency.toUpperCase()) ? 0 : 0.1;
}
