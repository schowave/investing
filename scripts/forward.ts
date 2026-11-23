// Zeigt das Vorwärtsprotokoll: Was die Anwendung zum Monatsanfang vorgeschlagen hätte und was daraus bis heute wurde.
// Aufruf: pnpm run forward [--ohne-index]
// Der Abgleich schreibt je Arm ("zahlen", "urteil") und Profil einmal im Monat einen Eintrag (src/valuation/forwardLog.ts) und je
// Arm die Rangliste der besten Kandidaten. Der Vergleichsindex kommt von Yahoo (wie im Rückblick); ohne Netz läuft die Ausgabe ohne ihn.

import type { PriceSeries } from "../src/backtest/benchmark.ts";
import { closeAtOrBefore, DEFAULT_BENCHMARK, fetchChart, parseChart } from "../src/backtest/benchmark.ts";
import { Database } from "../src/data/db.ts";
import {
  dividendsSinceEur,
  groupRankings,
  groupSnapshots,
  overlap,
  rankingResult,
  snapshotResult,
  splitFactorSince,
} from "../src/valuation/forwardReport.ts";

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const snapshots = groupSnapshots(db.forwardLog());
if (snapshots.length === 0) {
  console.log("Das Vorwärtsprotokoll ist leer. Der nächste Abgleich legt den ersten Eintrag an.");
  db.close();
  process.exit(0);
}

const priceNow = (stockId: string): number | null => {
  const stock = db.stock(stockId);
  const price = db.latestPrice(stockId);
  const perEur = stock && db.latestFxRate(stock.priceCurrency);
  return price && perEur ? price.close / perEur : null;
};
const todayDate = new Date().toISOString().slice(0, 10);
const dividendsSince = (stockId: string, since: string) =>
  dividendsSinceEur(db.dividends(stockId), since, todayDate, (currency) => db.latestFxRate(currency));
const splitFactor = (stockId: string, since: string) => splitFactorSince(db.splits(stockId), since, todayDate);
const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits).replace(".", ",")} %`;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${percent(value)}`;
const today = Date.now();

let index: PriceSeries | null = null;
if (!process.argv.includes("--ohne-index")) {
  try {
    index = parseChart(DEFAULT_BENCHMARK, await fetchChart(DEFAULT_BENCHMARK, snapshots[0]!.date.slice(0, 7)));
  } catch (error) {
    console.warn(`Ohne Vergleichsindex: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/** Rendite des Vergleichsindex (MSCI World, thesaurierend) vom Tag des Eintrags bis zum letzten Kurs; `null` ohne Index. */
const indexSince = (date: string): number | null => {
  const last = index?.points.at(-1);
  const entry = index ? closeAtOrBefore(index, date) : null;
  return last && entry ? last.close / entry - 1 : null;
};

console.log(
  "Rendite seit dem Eintrag in Euro: Kurs plus Ausschüttungen (nicht wiederangelegt), ohne Kosten und Steuern; Bargeld zählt 0, Dividenden zum heutigen Wechselkurs.",
);
console.log("Arm zahlen = Datenvorrat ohne Urteile, urteil = Watchlist mit Urteilen. Index = MSCI World (EUNL.DE), voll investiert.");
console.log("Datum       Profil      Arm     Version  Titel  investiert  Kurse da  Alter   nur Kurs   mit Dividende   Index");
for (const s of snapshots) {
  const r = snapshotResult(s, priceNow, dividendsSince, splitFactor);
  const days = Math.round((today - Date.parse(s.date)) / 864e5);
  const benchmark = indexSince(s.date);
  console.log(
    `${s.date}  ${s.profile.padEnd(10)}  ${s.arm.padEnd(6)}  ${s.strategyVersion.padEnd(7)}  ${String(r.positions).padStart(5)}  ${percent(r.invested, 0).padStart(10)}  ${percent(r.covered, 0).padStart(8)}  ${`${days} T`.padStart(5)}  ${signed(r.priceReturn).padStart(9)}  ${signed(r.totalReturn).padStart(14)}  ${benchmark === null ? "–".padStart(7) : signed(benchmark).padStart(7)}`,
  );
}

console.log("\nÜberschneidung der Arme (Anteil des Portfolios, den beide halten):");
for (const a of snapshots.filter((s) => s.arm === "zahlen")) {
  const b = snapshots.find((s) => s.arm === "urteil" && s.date.slice(0, 7) === a.date.slice(0, 7) && s.profile === a.profile);
  if (b) console.log(`${a.date}  ${a.profile.padEnd(10)}  ${percent(overlap(a, b), 0)}`);
}

const rankings = groupRankings(db.forwardRanking());
if (rankings.length > 0) {
  console.log(
    "\nRangliste: gleich gewichtete Rendite seit dem Eintrag je Rangbereich (nach innerer Rendite). Trägt das Ranking, liegt Rang 1 bis 10 über 31 bis 100, und zwar über viele Monate; ein Monat sagt nichts.",
  );
  console.log("Datum       Arm     Version  Rang 1–10        Rang 11–30       Rang 31–100      Index");
  for (const r of rankings) {
    const groups = rankingResult(r, (stockId, entryPrice, since) => {
      const now = priceNow(stockId);
      return now === null ? null : (now + dividendsSince(stockId, since)) / (entryPrice / splitFactor(stockId, since)) - 1;
    });
    const cell = (g: (typeof groups)[number]) => (g.meanReturn === null ? "–" : `${signed(g.meanReturn)} (${g.covered})`).padEnd(15);
    const benchmark = indexSince(r.date);
    console.log(
      `${r.date}  ${r.arm.padEnd(6)}  ${r.strategyVersion.padEnd(7)}  ${groups.map(cell).join("  ")}  ${benchmark === null ? "–" : signed(benchmark)}`,
    );
  }
}
db.close();
