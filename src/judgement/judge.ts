// Holt Vorschläge für die Urteilsfaktoren: erst die Mitteilungen an die SEC (bei US-Werten) und die Recherche im Netz
// (falls möglich), dann Einstufung durch Jev.

import type { Database, Stock, StoredJudgement } from "../data/db.ts";
import { storedSnapshot } from "../data/eodhdSnapshot.ts";
import type { Filing } from "./edgar.ts";
import { cikOf, fetchFilings } from "./edgar.ts";
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

/** So viele Tage alt darf eine gespeicherte Recherche sein, um sie für ein neues Urteil wiederzuverwenden. */
export const RESEARCH_MAX_AGE_DAYS = 30;

/** Tag der Recherche eines Urteils, wenn sie höchstens `RESEARCH_MAX_AGE_DAYS` alt ist und wiederverwendet würde. */
export function reusableResearchDate(judgement: StoredJudgement | null, asOf: string): string | null {
  if (!judgement?.research || !judgement.researchModel) return null;
  // Urteile von vor der Spalte researched_at haben im selben Lauf recherchiert.
  const researchedAt = judgement.researchedAt ?? judgement.createdAt.slice(0, 10);
  return Date.parse(asOf) - Date.parse(researchedAt) > RESEARCH_MAX_AGE_DAYS * 86_400_000 ? null : researchedAt;
}

/** Die Recherche des letzten Urteils mit ihrem Tag, wenn sie wiederverwendet werden kann. */
function recentResearch(previous: StoredJudgement | null, asOf: string): { research: Research; researchedAt: string } | null {
  const researchedAt = reusableResearchDate(previous, asOf);
  if (!previous?.research || !previous.researchModel || researchedAt === null) return null;
  const sources = previous.sources.filter((source) => source.kind !== "sec").map(({ url, title, pageAge }) => ({ url, title, pageAge }));
  return { research: { model: previous.researchModel, text: previous.research, sources }, researchedAt };
}

/**
 * Stuft die Urteilsfaktoren einer Aktie ein und speichert die Vorschläge.
 * Eine Recherche, die höchstens `RESEARCH_MAX_AGE_DAYS` alt ist, wird wiederverwendet; das spart Suchen und Tokens.
 * @param options.research `false`: nur mit den gespeicherten Daten, ohne Suche im Netz.
 * @param options.freshResearch `true`: auch eine junge Recherche nicht wiederverwenden.
 */
export async function judgeStock(
  db: Database,
  stock: Stock,
  asOf: string,
  options: { research?: boolean; freshResearch?: boolean } = {},
): Promise<StoredJudgement> {
  let research: Research | null = null;
  let researchedAt: string | null = null;
  if (options.research !== false) {
    const recent = options.freshResearch ? null : recentResearch(db.judgement(stock.id), asOf);
    if (recent) ({ research, researchedAt } = recent);
    else if (researchAvailable()) {
      research = await researchCompany({ name: stock.name, ticker: stock.id, country: stock.country, asOf });
      researchedAt = asOf;
    }
  }
  const snapshot = storedSnapshot(db, stock.id);
  const filings = await secFilings(cikOf(snapshot), asOf);
  const evidence = buildEvidence({
    stock,
    years: db.fundamentals(stock.id),
    snapshot,
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
    researchedAt,
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
