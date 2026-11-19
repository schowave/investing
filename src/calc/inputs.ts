// Vorschläge für die Eingaben (Spezifikation Abschnitt 5).
// Alle Reihen sind Geschäftsjahre, ältestes zuerst, und müssen zehn Werte haben.

const YEARS = 10;

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function requireTenYears(series: readonly number[]): void {
  if (series.length !== YEARS) throw new Error(`Erwartet ${YEARS} Geschäftsjahre, erhalten ${series.length}`);
}

/**
 * Dividenden je Aktie werden aus gezahlter Summe und Aktienzahl gerechnet und schwanken dadurch leicht.
 * Ein Rückgang bis zu diesem Anteil gilt nicht als Kürzung.
 */
export const DIVIDEND_NOISE = 0.03;

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

/** Wachstum aus dem Vergleich der ersten und letzten fünf Jahre; `null`, wenn nicht bestimmbar. */
export function historicalGrowth(series: readonly number[]): number | null {
  requireTenYears(series);
  const early = mean(series.slice(0, 5));
  const late = mean(series.slice(5));
  if (!(early > 0) || !(late > 0)) return null;
  return (late / early) ** (1 / 5) - 1;
}

/** Niveau aus dem Durchschnitt der letzten 10 oder 5 Jahre, hochgerechnet mit dem Wachstum. */
export function levelFromAverage(series: readonly number[], years: 10 | 5): number | null {
  const growth = historicalGrowth(series);
  if (growth === null) return null;
  return years === 10 ? mean(series) * (1 + growth * 5) : mean(series.slice(5)) * (1 + growth * 2);
}

/** Gewinnniveau je Aktie. */
export function earningsLevel(earningsPerShare: readonly number[]): number | null {
  requireTenYears(earningsPerShare);
  if (neverFalls(earningsPerShare, true)) return earningsPerShare[YEARS - 1]!;
  const fromTen = levelFromAverage(earningsPerShare, 10);
  const fromFive = levelFromAverage(earningsPerShare, 5);
  if (fromTen === null || fromFive === null) return null;
  // Nach einem schwachen ersten Jahrfünft läge die Hochrechnung über jedem erzielten Gewinn.
  return Math.min(fromTen, fromFive, Math.max(...earningsPerShare.slice(-3)));
}

/** Dividendenniveau je Aktie (ohne Sonderdividenden). */
export function dividendLevel(dividendsPerShare: readonly number[]): number {
  requireTenYears(dividendsPerShare);
  const last = dividendsPerShare[YEARS - 1]!;
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
  /** Wachstum ohne zusätzliches Kapital (Preissteigerungen). */
  inflationAllowance: number;
}

export const DEFAULT_GROWTH_PARAMS: GrowthParams = { maxGrowth: 0.085, inflationAllowance: 0.02 };

export interface GrowthProposal {
  /** `null`: kein Vorschlag möglich, der Wert muss manuell gesetzt werden. */
  value: number | null;
  /** Obergrenze aus Einbehaltung; `null` bei negativem Eigenkapital oder fehlendem Gewinnniveau. */
  retentionCap: number | null;
}

/** Wachstum g0 mit Obergrenzen. */
export function growthProposal(
  args: {
    historicalGrowth: number | null;
    /** Wachstum des Umsatzes je Aktie; `null`, wenn nicht bestimmbar (dann ohne diese Grenze). */
    revenueGrowth?: number | null;
    payoutLevel: number;
    earningsLevel: number | null;
    equityPerShare: number;
  },
  params: GrowthParams = DEFAULT_GROWTH_PARAMS,
): GrowthProposal {
  let retentionCap: number | null = null;
  if (args.earningsLevel !== null && args.earningsLevel > 0 && args.equityPerShare > 0) {
    const retention = Math.max(0, 1 - args.payoutLevel / args.earningsLevel);
    retentionCap = retention * (args.earningsLevel / args.equityPerShare) + params.inflationAllowance;
  }
  if (args.historicalGrowth === null || args.historicalGrowth < 0) return { value: null, retentionCap };
  // Gewinn kann auf Dauer nicht schneller wachsen als der Umsatz; schrumpft dieser, bleibt es bei 0.
  const revenueCap = args.revenueGrowth == null ? Infinity : Math.max(0, args.revenueGrowth);
  const value = Math.min(args.historicalGrowth, params.maxGrowth, retentionCap ?? Infinity, revenueCap);
  return { value, retentionCap };
}
