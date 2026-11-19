// Holt Vorschläge für die Urteilsfaktoren: erst die Mitteilungen an die SEC (bei US-Werten) und die Recherche im Netz
// (falls möglich), dann Einstufung durch Jev.

import type { Database, Stock, StoredJudgement } from "../data/db.ts";
import type { Filing } from "./edgar.ts";
import { cikFromFundamentals, fetchFilings } from "./edgar.ts";
import { buildEvidence } from "./evidence.ts";
import { FACTOR_QUESTIONS, JUDGED_FACTORS, LEVELS_VERSION, proposalFromScore } from "./factors.ts";
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
 * Mitteilungen an die SEC, falls der Titel eine CIK hat. Ein Ausfall von EDGAR verhindert die Einstufung nicht;
 * dann fehlen die Mitteilungen, und das Protokoll nennt den Grund.
 */
async function secFilings(cik: string | null, asOf: string): Promise<Filing[] | null> {
  if (cik === null) return null;
  try {
    return await fetchFilings(cik, asOf);
  } catch (error) {
    console.warn(`EDGAR (CIK ${cik}): ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

/**
 * Stuft die Urteilsfaktoren einer Aktie ein und speichert die Vorschläge.
 * @param options.research `false`: nur mit den gespeicherten Daten, ohne Suche im Netz.
 */
export async function judgeStock(db: Database, stock: Stock, asOf: string, options: { research?: boolean } = {}): Promise<StoredJudgement> {
  let research: Research | null = null;
  if (options.research !== false && researchAvailable()) {
    research = await researchCompany({ name: stock.name, ticker: stock.id, country: stock.country, asOf });
  }
  const fundamentalsJson = db.rawDocument(stock.id, "eodhd-fundamentals")?.body ?? null;
  const filings = await secFilings(cikFromFundamentals(fundamentalsJson), asOf);
  const evidence = buildEvidence({
    stock,
    years: db.fundamentals(stock.id),
    fundamentalsJson,
    research: research?.text ?? null,
    secFilings: filings,
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
    // Die Mitteilungen stehen bei den Quellen; ihr Datum dort, wo die Recherche das Alter der Seite nennt.
    sources: [
      ...(filings ?? []).map((f) => ({ url: f.url, title: `${f.form}: ${f.description}`, pageAge: f.date, kind: "sec" as const })),
      ...(research?.sources ?? []),
    ],
    proposals,
    levelsVersion: LEVELS_VERSION,
  };
  db.saveJudgement(stock.id, judgement);
  return judgement;
}
