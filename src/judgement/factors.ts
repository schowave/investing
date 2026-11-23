// Stufen der Urteilsfaktoren (Strategie 6.3) und wie Jev sie vorschlägt (Spezifikation Abschnitt 3).
// Jev wählt keine Prozentzahl, sondern schätzt für jede Stufe eine Wahrscheinlichkeit. Der Vorschlag ist der
// danach gewichtete Abzug. Die Stufen stehen auf Englisch, weil Jev und die Unterlagen englisch sind.
//
// Maßstab ist das Buch (Kap. 5.8, Abb. 32): Wer die Anforderung erfüllt, bekommt 0 %. Ein Abzug braucht einen
// benannten Befund; fehlende Information ist keiner. Was andere Faktoren schon messen (Regulierung, Zyklik,
// Verschuldung, Land), zählt hier nicht noch einmal. Geeicht an Titeln, die das Buch selbst einstuft
// (Wal-Mart, BASF), und an Qualitätswerten: Deren Urteilsfaktoren ergeben zusammen etwa 0 %.

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
      "Rate only how fast the company's industry changes and whether it lives on state subsidies. Do not rate regulation, cyclicality, leverage, country or the company's current results: other factors cover them. Banks, insurers, utilities, telecoms, healthcare providers, tobacco, energy, retail, industrials and consumer staples are ordinary industries here. Choose the first level unless the description shows a fast-changing, trend-driven or subsidised business.",
    levels: [
      { value: 0, criterion: "Ordinary industry: products and business model change slowly; no dependence on subsidies" },
      {
        value: 0.08,
        criterion:
          "Faster-changing or trend-dependent industry, but the company sells several products and has kept its position through earlier shifts (e.g. established diversified software or internet platforms)",
      },
      {
        value: 0.15,
        criterion:
          "Fast-changing industry where leaders are regularly displaced (e.g. hardware, semiconductors, consumer electronics, fashion), or a business that materially depends on state subsidies",
      },
      {
        value: 0.25,
        criterion: "Essentially one product in a fast-changing industry, or a business that would not exist without subsidies",
      },
    ],
  },
  moat: {
    instructions:
      "Rate the company's durable competitive advantages (brand, network effects, switching costs, cost advantages, scale, licences, local monopoly) against its competitors. Use the multi-year margins and returns as evidence. Most companies are average; choose another level only when the evidence clearly shows it. A weak recent year or a low share price is not evidence of a weak position.",
    levels: [
      {
        value: -0.2,
        criterion:
          "Extraordinary advantage and pricing power: no real competition or dominant for many years, with consistently high returns",
      },
      { value: -0.1, criterion: "Durable advantage, clearly stronger than its competitors" },
      { value: 0, criterion: "Average company, comparable to typical competitors" },
      { value: 0.1, criterion: "Weaker than its competitors: persistently lower margins or steadily losing market share" },
      { value: 0.2, criterion: "Clearly below average: no advantage at all, price taker in a commodity-like business, easily replaced" },
    ],
  },
  management: {
    instructions:
      "Rate whether there are indications of poor or dishonest management. Absence of information is not an indication: choose 'no indications' unless the evidence names a specific event. Routine insider sales, ordinary executive pay, a departing CEO or CFO, a weak year and ordinary lawsuits or fines of a large company are not indications.",
    levels: [
      {
        value: -0.1,
        criterion:
          "Specific evidence of exceptionally capable and committed management: long record of excellent capital allocation, founders or managers holding a large stake",
      },
      { value: 0, criterion: "No indications of poor or dishonest management" },
      {
        value: 0.15,
        criterion:
          "Specific indications of poor management: repeated value-destroying acquisitions or repeated strategic failures, reported profits that never reach the owners",
      },
      {
        value: 0.4,
        criterion:
          "Serious indications: dealings that favour insiders over owners, sanctions for misconduct attributable to management, statements to investors that proved misleading",
      },
      {
        value: 1,
        criterion: "Suspicion of dishonesty or corruption: fraud, manipulated or restated accounts, criminal charges against leadership",
      },
    ],
  },
  forecast: {
    instructions:
      "Rate how reliably the company's earnings level and growth over the coming years can be estimated. Judge the business, not analysts or quarterly results: is the multi-year record steady enough to read a level from it, and is there a known upcoming event that puts future earnings in doubt (patent expiry, expiring concession or licence, pending regulation or litigation that threatens the core business, a business model in transition)? Country and currency are rated elsewhere.",
    levels: [
      { value: 0, criterion: "Largely reliable: steady record and no known event that puts future earnings in doubt" },
      {
        value: 0.05,
        criterion: "Somewhat harder to estimate: cyclical or lumpy earnings, but the level over a cycle is clear",
      },
      {
        value: 0.12,
        criterion:
          "Noticeable uncertainty: a known structural shift or upcoming event will move earnings, but within a limited range (e.g. a slowly shrinking core business with stable cash flows)",
      },
      {
        value: 0.25,
        criterion:
          "High uncertainty: a business in transition with an open outcome, a short or broken record, or an event that could remove a large part of earnings",
      },
      {
        value: 0.4,
        criterion: "Large uncertainty about the company's value: the future earnings level cannot be estimated with any confidence",
      },
    ],
  },
  dependencies: {
    instructions:
      "Rate strong dependence on a single commodity (on the revenue or the cost side), a single supplier or a single customer. Dependence on a country, on regulation or on the economy is rated elsewhere. Choose 'no dependence' unless the evidence names the commodity, supplier, customer, licence or concession.",
    levels: [
      { value: 0, criterion: "No dependence: no single customer, supplier or commodity matters much" },
      {
        value: 0.1,
        criterion: "Noticeable dependence: one customer, supplier, partner or commodity stands for a large part of revenue or costs",
      },
      {
        value: 0.2,
        criterion:
          "Strong dependence: the business rests on one commodity price, customer, supplier, licence or concession, and losing it would be devastating",
      },
    ],
  },
  situation: {
    instructions:
      "Rate whether the company is in an immediately recognisable crisis as of the given date. A weaker year, cost pressure, a soft market, a fallen share price or an ordinary lawsuit is not a crisis.",
    levels: [
      { value: 0, criterion: "No crisis: business as usual, including ordinary headwinds" },
      {
        value: 0.1,
        criterion:
          "Serious difficulties: results have dropped sharply, or a significant legal, regulatory or strategic threat is unresolved",
      },
      { value: 0.2, criterion: "Crisis: losses, forced restructuring, covenant or refinancing problems" },
      { value: 0.3, criterion: "Severe crisis: survival or the core business is at stake" },
    ],
  },
};

/**
 * Fassung der Stufen. Bei jeder Änderung an Stufen oder Anweisungen erhöhen: Gespeicherte Vorschläge einer
 * älteren Fassung beziehen sich auf andere Stufen und gelten nicht mehr (`currentProposals`).
 * 1: erste Fassung. 2: am Buch geeicht, Prognosen als Planbarkeit statt als Treffsicherheit der Analysten.
 */
export const LEVELS_VERSION = 2;

/** Vorschläge einer Einstufung, sofern sie nach den heutigen Stufen entstanden ist; sonst keine. */
export function currentProposals<P>(judgement: { levelsVersion: number; proposals: Record<string, P> } | null): Record<string, P> {
  return judgement !== null && judgement.levelsVersion === LEVELS_VERSION ? judgement.proposals : {};
}

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
