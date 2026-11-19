// Holt Vorschläge für die Urteilsfaktoren: erst Recherche im Netz (falls möglich), dann Einstufung durch Jev.

import type { Database, Stock, StoredJudgement } from "../data/db.ts";
import { buildEvidence } from "./evidence.ts";
import { FACTOR_QUESTIONS, JUDGED_FACTORS, proposalFromScore } from "./factors.ts";
import type { ScoreQuestion } from "./jev.ts";
import { askJev } from "./jev.ts";
import type { Research } from "./research.ts";
import { researchAvailable, researchCompany } from "./research.ts";

const QUESTIONS: Record<string, ScoreQuestion> = Object.fromEntries(
  JUDGED_FACTORS.map((factor) => {
    const { instructions, levels } = FACTOR_QUESTIONS[factor];
    return [factor, { type: "score", instructions, criteria: levels.map((level) => level.criterion) }];
  }),
);

/**
 * Stuft die Urteilsfaktoren einer Aktie ein und speichert die Vorschläge.
 * @param options.research `false`: nur mit den gespeicherten Daten, ohne Suche im Netz.
 */
export async function judgeStock(db: Database, stock: Stock, asOf: string, options: { research?: boolean } = {}): Promise<StoredJudgement> {
  let research: Research | null = null;
  if (options.research !== false && researchAvailable()) {
    research = await researchCompany({ name: stock.name, ticker: stock.id, country: stock.country, asOf });
  }
  const evidence = buildEvidence({
    stock,
    years: db.fundamentals(stock.id),
    fundamentalsJson: db.rawDocument(stock.id, "eodhd-fundamentals")?.body ?? null,
    research: research?.text ?? null,
    asOf,
  });
  const result = await askJev(evidence, QUESTIONS);

  const proposals: StoredJudgement["proposals"] = {};
  for (const factor of JUDGED_FACTORS) {
    const answer = result.answers[factor]!;
    proposals[factor] = proposalFromScore(factor, answer.probabilities, answer.confidence);
  }
  const judgement: StoredJudgement = {
    createdAt: new Date().toISOString(),
    jevModel: result.model,
    researchModel: research?.model ?? null,
    research: research?.text ?? null,
    sources: research?.sources ?? [],
    proposals,
  };
  db.saveJudgement(stock.id, judgement);
  return judgement;
}
