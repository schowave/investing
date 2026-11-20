// Vorschläge für die Eingaben (Spezifikation Abschnitt 5).
// Alle Reihen sind Geschäftsjahre, ältestes zuerst: zehn Werte, bei jüngeren Unternehmen mindestens fünf.

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
}

export const DEFAULT_GROWTH_PARAMS: GrowthParams = { maxGrowth: 0.085, minGrowth: -0.05, inflationAllowance: 0.02 };

export interface GrowthProposal {
  /** `null`: kein Vorschlag möglich, der Wert muss manuell gesetzt werden. */
  value: number | null;
  /** Der Gewinn schrumpft; der Vorschlag ist das gemessene, negative Wachstum (höchstens bis `minGrowth`). */
  shrinking: boolean;
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
  if (args.historicalGrowth === null) return { value: null, shrinking: false, retentionCap };
  // Schrumpfender Gewinn: Der Rückfluss schrumpft mit, dauerhaft. Das ist die vorsichtigste Annahme; die Obergrenzen
  // greifen hier nicht, sie liegen alle bei 0 oder darüber.
  if (args.historicalGrowth < 0) return { value: Math.max(args.historicalGrowth, params.minGrowth), shrinking: true, retentionCap };
  // Gewinn kann auf Dauer nicht schneller wachsen als der Umsatz; schrumpft dieser, bleibt es bei 0.
  const revenueCap = args.revenueGrowth == null ? Infinity : Math.max(0, args.revenueGrowth);
  const value = Math.min(args.historicalGrowth, params.maxGrowth, retentionCap ?? Infinity, revenueCap);
  return { value, shrinking: false, retentionCap };
}
