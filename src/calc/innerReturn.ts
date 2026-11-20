// Innere Rendite (Spezifikation Abschnitt 4).

export interface ReturnInputs {
  /** Rückflussniveau R0 je Aktie, erwartet für das kommende Jahr. */
  payoutLevel: number;
  /** Wachstum g0 der Rückflüsse zu Beginn, z. B. 0.023. */
  growth: number;
  /** Ausfallwahrscheinlichkeit p pro Jahr. */
  defaultProbability: number;
  /**
   * Gewinnniveau je Aktie. Mit ihm steigt die Ausschüttungsquote über die Abschmelzphase (`terminalPayoutRatio`);
   * ohne es bleibt sie, wie sie ist.
   */
  earningsLevel?: number | null;
}

export interface ReturnParams {
  /** Jahre, über die das Wachstum auf das Dauerwachstum abschmilzt. */
  fadeYears: number;
  /** Obergrenze für das Dauerwachstum. */
  maxTerminalGrowth: number;
  /** Wachstum aus Preissteigerungen, das kein einbehaltenes Kapital braucht. */
  inflationAllowance: number;
  /** Rendite, die einbehaltene Gewinne bringen müssen, damit sie voll als künftiger Rückfluss zählen. */
  returnOnRetained: number;
  /**
   * Inflationsabstand der Berichtswährung zum Euro. Die Grenzen oben sind dann schon verschoben (`returnParamsFor`);
   * hier steht er für die Schwelle bei 0 (reales Nullwachstum) in der Bandbreite.
   */
  inflationGap: number;
}

export const DEFAULT_RETURN_PARAMS: ReturnParams = {
  fadeYears: 15,
  maxTerminalGrowth: 0.03,
  inflationAllowance: 0.02,
  returnOnRetained: 0.1,
  inflationGap: 0,
};

/**
 * Rechnet einen Wert in Euro-Kaufkraft in die Berichtswährung um (Spezifikation Abschnitt 4.4): `(1 + w) · (1 + Abstand) − 1`.
 * Beim Abstand 0 bleibt der Wert bitgleich.
 */
export function toLocalTerms(euroValue: number, inflationGap: number): number {
  return inflationGap === 0 ? euroValue : (1 + euroValue) * (1 + inflationGap) - 1;
}

/** Umkehrung von `toLocalTerms`: Wachstum in Berichtswährung in Euro-Kaufkraft. */
export function toEuroTerms(localValue: number, inflationGap: number): number {
  return inflationGap === 0 ? localValue : (1 + localValue) / (1 + inflationGap) - 1;
}

/** Parameter der Renditerechnung für eine Währung: die Grenzen gelten in Euro-Kaufkraft und werden um den Abstand verschoben. */
export function returnParamsFor(inflationGap: number, base: ReturnParams = DEFAULT_RETURN_PARAMS): ReturnParams {
  return {
    ...base,
    maxTerminalGrowth: toLocalTerms(base.maxTerminalGrowth, inflationGap),
    inflationAllowance: toLocalTerms(base.inflationAllowance, inflationGap),
    inflationGap,
  };
}

/**
 * Ausschüttungsquote am Ende der Abschmelzphase (Spezifikation Abschnitt 4.3). Wer wächst, behält Gewinn ein; flacht das
 * Wachstum ab, wird dieser Gewinn frei und fließt zurück. Angerechnet wird das nur, soweit die einbehaltenen Gewinne
 * bisher Wachstum gebracht haben: Ein Unternehmen, das einbehält und trotzdem nicht wächst, bleibt bei seiner Quote.
 * Liefert `null`, wenn kein Gewinnniveau vorliegt oder schon mehr als der Gewinn zurückfließt.
 */
export function terminalPayoutRatio(inputs: ReturnInputs, params: ReturnParams = DEFAULT_RETURN_PARAMS): number | null {
  const earnings = inputs.earningsLevel;
  if (earnings == null || !(earnings > 0) || !(inputs.payoutLevel > 0)) return null;
  const ratio = inputs.payoutLevel / earnings;
  if (ratio >= 1) return null;
  const terminalGrowth = Math.min(inputs.growth, params.maxTerminalGrowth);
  // Wachstum über die Preissteigerung hinaus, in Euro-Kaufkraft: Die Rendite des Einbehaltenen gilt dort (beim Abstand 0 teilt
  // `scale` durch 1).
  const scale = 1 + params.inflationGap;
  // Auch das Dauerwachstum braucht noch etwas Kapital; der Rest des Gewinns kann zurückfließen.
  const target = 1 - Math.max(0, (terminalGrowth - params.inflationAllowance) / scale) / params.returnOnRetained;
  if (target <= ratio) return ratio;
  // Rendite der einbehaltenen Gewinne: Wachstum über die Preissteigerung hinaus je einbehaltenem Anteil.
  const earned = (inputs.growth - params.inflationAllowance) / scale / (1 - ratio);
  const credit = Math.min(1, Math.max(0, earned / params.returnOnRetained));
  return ratio + credit * (target - ratio);
}

/** Barwert aller erwarteten Rückflüsse beim Zinssatz `rate`. */
export function presentValue(rate: number, inputs: ReturnInputs, params: ReturnParams = DEFAULT_RETURN_PARAMS): number {
  const n = params.fadeYears;
  const terminalGrowth = Math.min(inputs.growth, params.maxTerminalGrowth);
  const survival = 1 - inputs.defaultProbability;
  const q = (1 + terminalGrowth) * survival;
  if (rate <= q - 1) return Infinity;

  // Der Gewinn wächst mit g_t; der Rückfluss ist sein ausgeschütteter Anteil. `level` ist der Rückfluss bei heutiger
  // Quote, `lift` das Verhältnis der Quote im Jahr t zur heutigen (1, wenn die Quote bleibt).
  const ratio = inputs.earningsLevel ? inputs.payoutLevel / inputs.earningsLevel : 1;
  const terminalLift = (terminalPayoutRatio(inputs, params) ?? ratio) / ratio;
  let level = inputs.payoutLevel;
  let value = 0;
  for (let t = 1; t <= n; t++) {
    if (t > 1) level *= 1 + inputs.growth + ((terminalGrowth - inputs.growth) * (t - 1)) / n;
    const lift = 1 + ((terminalLift - 1) * (t - 1)) / n;
    value += (level * lift * survival ** t) / (1 + rate) ** t;
  }
  return value + (level * terminalLift * survival ** n * q) / ((1 + rate - q) * (1 + rate) ** n);
}

/** Zinssatz, bei dem der Barwert dem Kurs entspricht; `null`, wenn es keinen gibt. */
export function innerReturn(price: number, inputs: ReturnInputs, params: ReturnParams = DEFAULT_RETURN_PARAMS): number | null {
  if (!(price > 0) || !(inputs.payoutLevel > 0)) return null;
  const terminalGrowth = Math.min(inputs.growth, params.maxTerminalGrowth);
  let low = (1 + terminalGrowth) * (1 - inputs.defaultProbability) - 1 + 1e-9;
  let high = 10;
  if (presentValue(high, inputs, params) > price) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (presentValue(mid, inputs, params) > price) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export interface ScenarioSpread {
  /** Relativer Abstand des Rückflussniveaus, z. B. 0.1 für ±10 %. */
  payoutFactor: number;
  /** Abstand des Wachstums in Prozentpunkten als Anteil, z. B. 0.01. */
  growthPoints: number;
}

export const DEFAULT_SCENARIO_SPREAD: ScenarioSpread = { payoutFactor: 0.1, growthPoints: 0.01 };

export interface ScenarioReturns {
  cautious: number | null;
  base: number | null;
  optimistic: number | null;
}

/** Rückfluss und Gewinnniveau um denselben Faktor verschoben; die Ausschüttungsquote bleibt. */
function scaled(inputs: ReturnInputs, factor: number): Pick<ReturnInputs, "payoutLevel" | "earningsLevel"> {
  return { payoutLevel: inputs.payoutLevel * factor, earningsLevel: inputs.earningsLevel == null ? null : inputs.earningsLevel * factor };
}

/** Bandbreite der inneren Rendite (Abschnitt 4.1). */
export function scenarioReturns(
  price: number,
  inputs: ReturnInputs,
  spread: ScenarioSpread = DEFAULT_SCENARIO_SPREAD,
  params: ReturnParams = DEFAULT_RETURN_PARAMS,
): ScenarioReturns {
  // Vorsichtig: ein Prozentpunkt weniger, aber nicht unter 0, es sei denn, das Wachstum ist schon negativ. Prozentpunkte
  // und die 0 gelten in Euro-Kaufkraft (beim Abstand 0 dasselbe wie nominal).
  const gap = params.inflationGap;
  const real = toEuroTerms(inputs.growth, gap);
  const cautiousGrowth = toLocalTerms(real < -1e-9 ? real - spread.growthPoints : Math.max(0, real - spread.growthPoints), gap);
  const optimisticGrowth = toLocalTerms(real + spread.growthPoints, gap);
  return {
    cautious: innerReturn(price, { ...inputs, ...scaled(inputs, 1 - spread.payoutFactor), growth: cautiousGrowth }, params),
    base: innerReturn(price, inputs, params),
    optimistic: innerReturn(
      price,
      {
        ...inputs,
        ...scaled(inputs, 1 + spread.payoutFactor),
        growth: optimisticGrowth,
      },
      params,
    ),
  };
}

/**
 * Macht eine Rendite in fremder Währung mit einer in Euro vergleichbar: Die höhere Inflation einer Währung
 * steckt im nominalen Wachstum, geht aber über die Abwertung wieder verloren.
 * @param inflationGap Erwartete Inflation der Währung minus die des Euro, z. B. 0.043.
 */
export function comparableReturn(localReturn: number | null, inflationGap: number): number | null {
  return localReturn === null ? null : (1 + localReturn) / (1 + inflationGap) - 1;
}
