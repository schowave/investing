// Recherche im Netz mit Claude: sammelt datierte Belege zu den Urteilsfaktoren, vergibt aber keine Werte.
// Die Einstufung übernimmt Jev; die Recherche liefert ihm, was nicht in den Zahlen von EODHD steht.

import Anthropic from "@anthropic-ai/sdk";

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

export interface Research {
  model: string;
  text: string;
  sources: Source[];
}

const SYSTEM = `You research listed companies for a long-term value investor. You collect evidence; you do not rate or recommend.

Search the web and report dated facts for each of these headings, in this order:
1. Industry: subsidies or regulation the business depends on; pace of change in the industry.
2. Competitive position: market share, pricing power, competitors, signs of a durable advantage or of erosion.
3. Management: track record, capital allocation, insider buying or selling, pay, governance, lawsuits, regulatory actions, accounting issues, executive turnover.
4. Forecast reliability: the company's own guidance over the last three years compared with actual results; guidance cuts.
5. Dependencies: concentration on customers, suppliers, partners, licences or commodities, with percentages where disclosed (10-K, annual report).
6. Current situation: anything from the last twelve months that changes the picture, such as takeover offers and their status, profit warnings, liquidity, litigation.

Rules:
- Prefer primary sources (annual reports, 10-K/10-Q, company releases, regulators) and reputable financial press.
- Give the date of each fact. Say plainly when you found nothing on a heading; do not fill gaps with general knowledge.
- Write in English, plain text, at most 600 words, with the six headings.`;

/** Recherchiert ein Unternehmen. Benötigt ANTHROPIC_API_KEY oder eine Anmeldung per `ant auth login`. */
export async function researchCompany(company: { name: string; ticker: string; country: string; asOf: string }): Promise<Research> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Company: ${company.name} (ticker ${company.ticker}, ${company.country}). Today is ${company.asOf}.`,
    },
  ];
  const texts: string[] = [];
  const sources = new Map<string, Source>();

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
    return { model: response.model, text: texts.join("").trim(), sources: [...sources.values()] };
  }
}

/** Recherche ist möglich, wenn ein Schlüssel für Claude gesetzt ist. */
export const researchAvailable = () =>
  Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
