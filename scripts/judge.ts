// Holt Jev-Vorschläge für die Urteilsfaktoren.
// Aufruf: ppnpm run judge IMXI.US IMB.LSE          diese Titel
//         ppnpm run judge --offen                  alle Titel der Watchlist ohne Vorschläge nach den heutigen Stufen
//         ppnpm run judge IMXI.US --ohne-recherche  nur aus den gespeicherten Daten, ohne Suche im Netz
// Die Vorschläge gelten erst, wenn du sie auf der Aktienseite speicherst.

import { Database } from "../src/data/db.ts";
import { LEVELS_VERSION } from "../src/judgement/factors.ts";
import { judgeStock } from "../src/judgement/judge.ts";
import { researchAvailable } from "../src/judgement/research.ts";

const args = process.argv.slice(2);
const research = !args.includes("--ohne-recherche");
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const today = new Date().toISOString().slice(0, 10);

const ids = args.includes("--offen")
  ? db
      .stocks()
      .filter((s) => db.judgement(s.id)?.levelsVersion !== LEVELS_VERSION)
      .map((s) => s.id)
  : args.filter((a) => !a.startsWith("--"));
if (ids.length === 0) {
  console.error("Aufruf: ppnpm run judge <Aktie> [weitere] | --offen [--ohne-recherche]");
  process.exit(1);
}
if (research && !researchAvailable()) {
  // Ohne Recherche sieht Jev keine Nachrichten; das soll eine bewusste Wahl sein, kein stiller Rückfall.
  console.error("ANTHROPIC_API_KEY fehlt. Schlüssel setzen (im LXC: mise run deploy:env) oder --ohne-recherche angeben.");
  process.exit(1);
}

let failed = 0;
for (const id of ids) {
  const stock = db.stock(id);
  if (!stock) {
    console.error(`${id}: unbekannt`);
    failed++;
    continue;
  }
  try {
    const judgement = await judgeStock(db, stock, today, { research });
    const summary = Object.entries(judgement.proposals)
      .map(([factor, p]) => `${factor} ${(p.value * 100).toFixed(1)} % (${Math.round(p.confidence * 100)} %)`)
      .join(", ");
    const filings = judgement.sources.filter((source) => source.kind === "sec").length;
    const web = judgement.sources.length - filings;
    console.log(
      `${id}: ${summary}${filings > 0 ? `; ${filings} Mitteilungen an die SEC` : ""}${judgement.research ? `; ${web} Quellen` : ""}`,
    );
  } catch (error) {
    console.error(`${id}: ${error instanceof Error ? error.message : error}`);
    failed++;
  }
}
db.close();
process.exit(failed > 0 ? 1 : 0);
