// Stufen der Urteilsfaktoren für Jev (Spezifikation Abschnitt 6.4).
// Jev wählt keine Prozentzahl, sondern schätzt für jede Stufe eine Wahrscheinlichkeit. Der Vorschlag ist der
// danach gewichtete Abzug. Die Stufen stehen auf Englisch, weil Jev und die Unterlagen englisch sind.

import { RISK_FACTORS } from "../calc/risk.ts";

/** Urteilsfaktoren, für die Jev einen Vorschlag macht. */
export const JUDGED_FACTORS = ["sector", "moat", "management", "forecast", "dependencies", "situation"] as const;
export type JudgedFactor = (typeof JUDGED_FACTORS)[number];

interface Level {
  /** Abzug als Anteil (0.1 = 10 %), negativ als Bonus. */
  value: number;
  criterion: string;
}

export interface FactorQuestion {
  instructions: string;
  /** Vom besten zum schlechtesten Fall; Jev nummeriert ab 0. */
  levels: Level[];
}

export const FACTOR_QUESTIONS: Record<JudgedFactor, FactorQuestion> = {
  sector: {
    instructions:
      "Rate the company's industry for a long-term investor: does the business depend on subsidies or regulation that can be withdrawn, and how fast does the industry change (technology shifts, short product cycles, fashion)?",
    levels: [
      { value: 0, criterion: "Stable, slow-changing industry; no dependence on subsidies or favourable regulation" },
      {
        value: 0.08,
        criterion: "Some regulatory dependence or moderate pace of change, but the business model has been stable for decades",
      },
      {
        value: 0.15,
        criterion: "Noticeable dependence on subsidies/regulation, or a fast-changing industry where incumbents are regularly displaced",
      },
      { value: 0.25, criterion: "Heavily subsidized or very fast-moving industry; today's business model may not exist in ten years" },
    ],
  },
  moat: {
    instructions:
      "Rate the company's durable competitive advantages (brand, network effects, switching costs, cost advantages, scale, licences). Use the multi-year margins and returns as evidence: a moat shows up as stable, above-average profitability.",
    levels: [
      { value: -0.2, criterion: "Wide moat: dominant, durable advantage, consistently high returns over many years" },
      { value: -0.1, criterion: "Narrow but durable advantage, clearly better than average competitors" },
      { value: 0, criterion: "Average competitive position, comparable to typical peers" },
      { value: 0.1, criterion: "Below average: weak pricing power, losing share or margins under pressure" },
      { value: 0.2, criterion: "No advantage: commodity-like business, price taker, easily replaced" },
    ],
  },
  management: {
    instructions:
      "Rate management quality and integrity: capital allocation, shareholder orientation, honesty of communication, insider behaviour, accounting quality, governance, legal or regulatory problems.",
    levels: [
      { value: -0.1, criterion: "Outstanding: long, proven record of excellent capital allocation and candour, owner-oriented" },
      { value: 0, criterion: "Solid: no signs of poor or dishonest management" },
      {
        value: 0.1,
        criterion: "Minor concerns: e.g. heavy insider selling, aggressive pay, frequent turnover in key roles, promotional communication",
      },
      {
        value: 0.35,
        criterion:
          "Serious concerns: questionable related-party dealings, value-destroying acquisitions, regulatory sanctions, misleading statements",
      },
      {
        value: 1,
        criterion: "Strong evidence of dishonesty: fraud, accounting restatements from manipulation, criminal charges against leadership",
      },
    ],
  },
  forecast: {
    instructions:
      "Rate how reliable the company's own guidance and the consensus estimates have been: compare past expectations with what was actually reported.",
    levels: [
      { value: 0, criterion: "Results usually meet or beat guidance and estimates; misses are rare and small" },
      { value: 0.1, criterion: "Occasional misses, mostly moderate" },
      { value: 0.25, criterion: "Frequent or large misses, guidance repeatedly cut" },
      { value: 0.4, criterion: "Forecasts are unreliable: results swing far from expectations most of the time" },
    ],
  },
  dependencies: {
    instructions: "Rate concentration risk: dependence on a single customer, supplier, commodity price, licence, partner or product.",
    levels: [
      { value: 0, criterion: "Diversified: no single customer, supplier or commodity matters much" },
      {
        value: 0.1,
        criterion:
          "Moderate concentration: one customer, supplier, partner or commodity is important (roughly 10–25 % of revenue or costs)",
      },
      {
        value: 0.2,
        criterion: "Strong dependence: losing one customer, supplier, licence or a commodity price move would hit the business hard",
      },
    ],
  },
  situation: {
    instructions:
      "Rate the company's current situation as of the given date: is it in a crisis (collapsing results, liquidity problems, failed transaction, major litigation, loss of key business)?",
    levels: [
      { value: 0, criterion: "No crisis; business as usual" },
      { value: 0.1, criterion: "Headwinds: a weak year, temporary problems, uncertainty that is likely to pass" },
      {
        value: 0.2,
        criterion: "Serious difficulties: sharp decline in results, strategic upheaval, significant legal or regulatory threat",
      },
      { value: 0.3, criterion: "Acute crisis: survival or the core business is at stake" },
    ],
  },
};

export interface FactorProposal {
  /** Gewichteter Abzug, auf 0,5 Prozentpunkte gerundet. */
  value: number;
  /** Sicherheit laut Jev, 0 bis 1. */
  confidence: number;
  /** Wahrscheinlichkeit je Stufe, Schlüssel wie bei Jev ("0", "1", …). */
  probabilities: Record<string, number>;
}

/**
 * Abzug aus den Wahrscheinlichkeiten der Stufen: der erwartete Abzug, gerundet auf 0,5 Prozentpunkte und auf den
 * erlaubten Bereich des Faktors begrenzt.
 */
export function proposalFromScore(factor: JudgedFactor, probabilities: Record<string, number>, confidence: number): FactorProposal {
  const { levels } = FACTOR_QUESTIONS[factor];
  let total = 0;
  let expected = 0;
  levels.forEach((level, index) => {
    const p = probabilities[String(index)] ?? 0;
    total += p;
    expected += p * level.value;
  });
  if (!(total > 0)) throw new Error(`Jev lieferte keine Wahrscheinlichkeiten für ${factor}.`);
  const { maxDeduction, bonus } = RISK_FACTORS[factor];
  const rounded = Math.round((expected / total) * 200) / 200;
  const value = Math.min(maxDeduction, Math.max(-bonus, rounded)) + 0; // + 0 macht aus -0 eine 0
  return { value, confidence, probabilities };
}
