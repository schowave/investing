// Anbindung an Jev von TypeSafe AI (https://docs.typesafe.ai). Jev beantwortet Fragen zu einem Zustand mit
// typisierten Werten und Wahrscheinlichkeiten; es schreibt keinen Text und sucht nichts im Netz.

import { z } from "zod";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

export interface ScoreQuestion {
  type: "score";
  instructions: string;
  /** Stufen vom ersten zum letzten; die Position ist der Wert (ab 0). Höchstens zehn. */
  criteria: string[];
}

/** Antwort auf eine Bewertungsfrage: gewichtete Stufe (kann zwischen zwei Stufen liegen), Sicherheit, Wahrscheinlichkeit je Stufe. */
const ScoreAnswer = z.object({
  type: z.literal("score"),
  score: z.number().finite(),
  confidence: z.number().min(0).max(1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});
type ScoreAnswer = z.infer<typeof ScoreAnswer>;

const JevAnswer = z.object({ model: z.string(), answers: z.record(z.string(), z.unknown()) });

export interface JevResult {
  model: string;
  answers: Record<string, ScoreAnswer>;
}

const RETRY_STATUS = new Set([429, 529]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stellt Jev Bewertungsfragen zu einem Zustand. Wiederholt bei Überlastung bis zu dreimal. */
export async function askJev(
  state: unknown,
  questions: Record<string, ScoreQuestion>,
  apiKey = process.env.TYPESAFE_API_KEY,
): Promise<JevResult> {
  if (!apiKey) throw new Error("TYPESAFE_API_KEY fehlt (in .env.local eintragen).");
  const body = JSON.stringify({ model: JEV_MODEL, state, questions });
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    });
    if (response.ok) {
      const data = JevAnswer.safeParse(await response.json());
      if (!data.success) throw new Error("Jev: unerwartete Antwort.");
      const answers: Record<string, ScoreAnswer> = {};
      for (const name of Object.keys(questions)) {
        const answer = ScoreAnswer.safeParse(data.data.answers[name]);
        if (!answer.success) throw new Error(`Jev hat die Frage ${name} nicht beantwortet.`);
        answers[name] = answer.data;
      }
      return { model: data.data.model, answers };
    }
    if (RETRY_STATUS.has(response.status) && attempt < 3) {
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    throw new Error(`Jev antwortet mit ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}
