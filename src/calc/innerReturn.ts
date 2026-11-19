// Innere Rendite (Spezifikation Abschnitt 4).

export interface ReturnInputs {
  /** Rückflussniveau R0 je Aktie, erwartet für das kommende Jahr. */
  payoutLevel: number;
  /** Wachstum g0 der Rückflüsse zu Beginn, z. B. 0.023. */
  growth: number;
  /** Ausfallwahrscheinlichkeit p pro Jahr. */
  defaultProbability: number;
}

export interface ReturnParams {
  /** Jahre, über die das Wachstum auf das Dauerwachstum abschmilzt. */
  fadeYears: number;
  /** Obergrenze für das Dauerwachstum. */
  maxTerminalGrowth: number;
}

export const DEFAULT_RETURN_PARAMS: ReturnParams = { fadeYears: 15, maxTerminalGrowth: 0.03 };

/** Barwert aller erwarteten Rückflüsse beim Zinssatz `rate`. */
export function presentValue(
  rate: number,
  inputs: ReturnInputs,
  params: ReturnParams = DEFAULT_RETURN_PARAMS,
): number {
  const n = params.fadeYears;
  const terminalGrowth = Math.min(inputs.growth, params.maxTerminalGrowth);
  const survival = 1 - inputs.defaultProbability;
  const q = (1 + terminalGrowth) * survival;
  if (rate <= q - 1) return Infinity;

  let payout = inputs.payoutLevel;
  let value = 0;
  for (let t = 1; t <= n; t++) {
    if (t > 1) payout *= 1 + inputs.growth + ((terminalGrowth - inputs.growth) * (t - 1)) / n;
    value += (payout * survival ** t) / (1 + rate) ** t;
  }
  return value + (payout * survival ** n * q) / ((1 + rate - q) * (1 + rate) ** n);
}

/** Zinssatz, bei dem der Barwert dem Kurs entspricht; `null`, wenn es keinen gibt. */
export function innerReturn(
  price: number,
  inputs: ReturnInputs,
  params: ReturnParams = DEFAULT_RETURN_PARAMS,
): number | null {
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

/** Bandbreite der inneren Rendite (Abschnitt 4.1). */
export function scenarioReturns(
  price: number,
  inputs: ReturnInputs,
  spread: ScenarioSpread = DEFAULT_SCENARIO_SPREAD,
  params: ReturnParams = DEFAULT_RETURN_PARAMS,
): ScenarioReturns {
  const cautiousGrowth = Math.min(inputs.growth, Math.max(0, inputs.growth - spread.growthPoints));
  return {
    cautious: innerReturn(
      price,
      { ...inputs, payoutLevel: inputs.payoutLevel * (1 - spread.payoutFactor), growth: cautiousGrowth },
      params,
    ),
    base: innerReturn(price, inputs, params),
    optimistic: innerReturn(
      price,
      {
        ...inputs,
        payoutLevel: inputs.payoutLevel * (1 + spread.payoutFactor),
        growth: inputs.growth + spread.growthPoints,
      },
      params,
    ),
  };
}
