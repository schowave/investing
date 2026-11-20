// Recherche im Netz mit Claude: sammelt datierte Belege zu den Urteilsfaktoren, vergibt aber keine Werte.
// Die Einstufung übernimmt Jev; die Recherche liefert ihm, was nicht in den Zahlen von EODHD steht.

import Anthropic from "@anthropic-ai/sdk";
import { researchWithGemini } from "./researchGemini.ts";

const RESEARCH_MODEL = "claude-opus-5-5";
/** Höchstzahl der Suchen je Titel; jede Suche kostet extra. */
const MAX_SEARCHES = 8;
/** So oft wird eine vom Server unterbrochene Recherche fortgesetzt. */
const MAX_CONTINUATIONS = 4;

interface Source {
  url: string;
  title: string;
  /** Alter der Seite laut Suche, z. B. "3 days ago"; nicht immer bekannt. */
  pageAge: string | null;
}

/** Verbrauch einer Recherche, über alle Runden summiert; Denktokens zählen zur Ausgabe. */
interface ResearchUsage {
  inputTokens: number;
  outputTokens: number;
  searches: number;
}

export interface Research {
  model: string;
  text: string;
  sources: Source[];
  /** Nur bei einer frischen Recherche bekannt, nicht bei einer gespeicherten. */
  usage?: ResearchUsage;
}

const SYSTEM = `You research listed companies for a long-term value investor. You collect evidence; you do not rate or recommend.

Search the web and report dated facts for each of these headings, in this order:
1. Industry: pace of change in the industry (technology shifts, short product cycles, trends); dependence on state subsidies.
2. Competitive position: market share, pricing power, competitors, signs of a durable advantage or of erosion.
3. Management: track record, capital allocation, insider buying or selling, pay, governance, lawsuits, regulatory actions, accounting issues, executive turnover.
4. Predictability: known upcoming events that put future earnings in doubt (patent expiries, expiring concessions or licences, pending regulation or litigation that threatens the core business, a business model in transition); guidance cuts over the last three years.
5. Dependencies: concentration on a single customer, supplier, partner, licence, concession or commodity, with percentages where disclosed (10-K, annual report).
6. Current situation: anything from the last twelve months that changes the picture, such as takeover offers and their status, profit warnings, liquidity, litigation.

Rules:
- Prefer primary sources (annual reports, 10-K/10-Q, company releases, regulators) and reputable financial press.
- Give the date of each fact. Say plainly when you found nothing on a heading; do not fill gaps with general knowledge.
- Write in English, plain text, at most 600 words, with the six headings.`;

/** Testweise: `RESEARCH_LLM=gemini` recherchiert mit Gemini statt mit Claude. */
const geminiChosen = () => process.env.RESEARCH_LLM === "gemini";

/**
 * Recherchiert ein Unternehmen. Benötigt ANTHROPIC_API_KEY oder eine Anmeldung per `ant auth login`,
 * mit RESEARCH_LLM=gemini stattdessen GEMINI_API_KEY.
 */
export async function researchCompany(company: { name: string; ticker: string; country: string; asOf: string }): Promise<Research> {
  const prompt = `Company: ${company.name} (ticker ${company.ticker}, ${company.country}). Today is ${company.asOf}.`;
  if (geminiChosen()) return researchWithGemini(SYSTEM, prompt);
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: prompt }];
  const texts: string[] = [];
  const sources = new Map<string, Source>();
  const usage: ResearchUsage = { inputTokens: 0, outputTokens: 0, searches: 0 };

  for (let round = 0; ; round++) {
    const response = await client.beta.messages
      .stream({
        model: RESEARCH_MODEL,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }],
        messages,
      })
      .finalMessage();

    const u = response.usage;
    usage.inputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    usage.outputTokens += u.output_tokens ?? 0;
    usage.searches += u.server_tool_use?.web_search_requests ?? 0;
    if (response.stop_reason === "refusal") {
      throw new Error(
        `Die Recherche wurde abgelehnt${response.stop_details?.explanation ? `: ${response.stop_details.explanation}` : "."}`,
      );
    }
    for (const block of response.content) {
      if (block.type === "text") texts.push(block.text);
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) sources.set(result.url, { url: result.url, title: result.title, pageAge: result.page_age });
      }
    }
    // Der Server hat die Suche unterbrochen: Antwort anhängen und ohne neue Nachricht fortsetzen.
    if (response.stop_reason === "pause_turn" && round < MAX_CONTINUATIONS) {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "max_tokens") throw new Error("Die Recherche wurde abgeschnitten (max_tokens).");
    return { model: response.model, text: texts.join("").trim(), sources: [...sources.values()], usage };
  }
}

/** Recherche ist möglich, wenn ein Schlüssel für das gewählte Modell gesetzt ist. */
export const researchAvailable = () =>
  geminiChosen()
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);

/** Name des Schlüssels, den die Recherche mit dem gewählten Modell braucht. */
export const researchKeyName = () => (geminiChosen() ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY");
