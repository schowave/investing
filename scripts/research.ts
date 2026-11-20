// Nur die Recherche im Netz, ohne Einstufung und ohne Speichern: zum Ausprobieren und Vergleichen der Modelle.
// Aufruf: pnpm run research IMXI.US            mit Claude
//         RESEARCH_LLM=gemini pnpm run research IMXI.US   mit Gemini

import { Database } from "../src/data/db.ts";
import { researchAvailable, researchCompany, researchKeyName } from "../src/judgement/research.ts";

/** Listenpreise in US-Dollar: je Million Tokens Eingabe und Ausgabe, je Suche (Stand November 2026). */
const PRICES: { prefix: string; input: number; output: number; search: number; note?: string }[] = [
  { prefix: "claude-opus-5-5", input: 4, output: 20, search: 0.01 },
  { prefix: "gemini-3.5-flash-lite", input: 0.3, output: 2.5, search: 0.014, note: "die ersten 5.000 Suchen im Monat frei" },
];

const id = process.argv[2];
if (!id) {
  console.error("Aufruf: pnpm run research <Aktie>");
  process.exit(1);
}
if (!researchAvailable()) {
  console.error(`${researchKeyName()} fehlt.`);
  process.exit(1);
}
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const stock = db.stock(id);
db.close();
if (!stock) {
  console.error(`${id}: unbekannt`);
  process.exit(1);
}
const started = Date.now();
const research = await researchCompany({
  name: stock.name,
  ticker: stock.id,
  country: stock.country,
  asOf: new Date().toISOString().slice(0, 10),
});
console.log(`${research.model}, ${((Date.now() - started) / 1000).toFixed(1)} s, ${research.sources.length} Quellen`);
const usage = research.usage!;
const price = PRICES.find((p) => research.model.startsWith(p.prefix));
const tokens = price ? (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1e6 : null;
console.log(
  `${usage.inputTokens} Tokens Eingabe, ${usage.outputTokens} Ausgabe (mit Denken), ${usage.searches} Suchen` +
    (price && tokens !== null
      ? `; etwa ${(tokens * 100).toFixed(2)} Cent für Tokens und ${(usage.searches * price.search * 100).toFixed(1)} Cent für Suchen${price.note ? ` (${price.note})` : ""}`
      : "; Preis für dieses Modell unbekannt"),
);
console.log("");
console.log(research.text);
console.log(`\nQuellen:\n${research.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`);
