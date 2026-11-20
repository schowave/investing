// Rückblick auf die Strategie: was das Zielportfolio der Anwendung in den letzten Jahren gebracht hätte, und der Vergleich
// zweier Stände, um eine Änderung an der Strategie zu prüfen (Spezifikation Abschnitt 15).
//
// Aufruf: pnpm run backtest [Optionen]
//           --name <name>        Name des Laufs und der Datei (Standard: lauf), liegt neben der Datenbank in backtest/
//           --start JJJJ-MM      erster Stichtag (Standard: 2016-10)
//           --profil fokussiert|global
//           --tausch 0.03        Tauschschwelle als Anteil (Standard: die des Profils)
//           --jaehrlich          nur einmal im Jahr umschichten
//           --zufall 200         Läufe der Zufallsgegenprobe (0 schaltet sie ab)
//           --fenster 36         Länge der rollenden Fenster in Monaten
//           --ohne-index         ohne Vergleichsindex (kein Abruf bei Yahoo)
//           --neu-laden          Wechselkurse und Index neu abrufen (sonst gilt der Stand von heute)
//           --vergleich <datei>  danach den neuen Lauf mit einem gespeicherten vergleichen (Stand = Datei)
//         pnpm run backtest vergleich <stand.json> <aenderung.json>
//
// Ablauf für eine Änderung an der Strategie: auf main `pnpm run backtest --name main`, dann auf dem Zweig
// `pnpm run backtest --name aenderung --vergleich main`. Beide Läufe müssen im selben Checkout mit derselben Datenbank und am selben
// Tag entstehen (die Läufe liegen in backtest/ neben der Datenbank); der Vergleich bricht ab, wenn Zeitraum oder Enddatum abweichen.
// Schnell (ohne Zufallsgegenprobe und ohne Index): --zufall 0 --ohne-index

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { PriceSeries } from "../src/backtest/benchmark.ts";
import { closeAtOrBefore, DEFAULT_BENCHMARK, fetchChart, parseChart } from "../src/backtest/benchmark.ts";
import { monthEnd } from "../src/backtest/calendar.ts";
import { fetchEcbHistory, parseEcbHistory } from "../src/backtest/fx.ts";
import { compareResults, describeResult } from "../src/backtest/report.ts";
import { DEFAULT_OPTIONS, runBacktest } from "../src/backtest/run.ts";
import { parseSaved } from "../src/backtest/saved.ts";
import { Database } from "../src/data/db.ts";
import { BOND_KEY } from "../src/valuation/portfolioRun.ts";

const dbPath = process.env.INVESTING_DB ?? "data/investing.sqlite";
const outDir = join(dirname(dbPath), "backtest");
const args = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Unbekannte Optionen und fehlende Werte laut ablehnen: ein Tippfehler darf keinen Lauf mit Standardwerten ergeben.
const VALUE_FLAGS = ["name", "start", "profil", "tausch", "zufall", "fenster", "vergleich"];
const SWITCHES = ["jaehrlich", "ohne-index", "neu-laden"];
if (args[0] !== "vergleich") {
  for (let i = 0; i < args.length; i++) {
    const name = args[i]!.replace(/^--/, "");
    if (!args[i]!.startsWith("--") || !(VALUE_FLAGS.includes(name) || SWITCHES.includes(name))) fail(`Unbekannte Option: ${args[i]}`);
    if (VALUE_FLAGS.includes(name)) {
      if (args[i + 1] === undefined || args[i + 1]!.startsWith("--")) fail(`Die Option --${name} braucht einen Wert.`);
      i++;
    }
  }
}
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
/** Ein Name wie "main" liegt in backtest/ neben der Datenbank; nur ein Pfad (mit / oder .json) gilt als Datei. */
const load = (ref: string) => {
  const file = ref.includes("/") || ref.endsWith(".json") ? ref : join(outDir, `${ref}.json`);
  if (!existsSync(file)) fail(`Kein gespeicherter Lauf: ${file}`);
  return parseSaved(JSON.parse(readFileSync(file, "utf8")));
};
const compare = (a: ReturnType<typeof load>, b: ReturnType<typeof load>) => {
  try {
    return compareResults(a, b).join("\n");
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
};

if (args[0] === "vergleich") {
  if (!args[1] || !args[2]) fail("Aufruf: pnpm run backtest vergleich <stand> <aenderung>   (Name aus backtest/ oder Pfad zur .json)");
  console.log(compare(load(args[1]), load(args[2])));
  process.exit(0);
}

const Options = z.object({
  name: z
    .string()
    .regex(/^[\w.-]+$/)
    .default("lauf"),
  start: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .default("2016-10"),
  profil: z.enum(["fokussiert", "global"]).default("fokussiert"),
  tausch: z.coerce.number().min(0).max(0.2).optional(),
  zufall: z.coerce.number().int().min(0).max(5000).default(DEFAULT_OPTIONS.randomRuns),
  fenster: z.coerce.number().int().min(12).max(120).default(DEFAULT_OPTIONS.windowMonths),
});
const parsed = Options.safeParse({
  name: value("name"),
  start: value("start"),
  profil: value("profil"),
  tausch: value("tausch"),
  zufall: value("zufall"),
  fenster: value("fenster"),
});
if (!parsed.success) fail(`Ungültige Option: ${parsed.error.issues.map((i) => `--${String(i.path[0])}: ${i.message}`).join("; ")}`);
const cli = parsed.data;

mkdirSync(join(outDir, "cache"), { recursive: true });

/**
 * Text aus dem Zwischenspeicher (höchstens einen Tag alt) oder frisch abgerufen. Geschrieben wird erst, wenn er sich parsen lässt;
 * ein beschädigter Zwischenspeicher wird verworfen, statt einen Tag lang weiterverwendet zu werden.
 */
async function cached<T>(
  file: string,
  fetchText: () => Promise<string>,
  parse: (text: string) => T,
  accept: (value: T) => boolean = () => true,
): Promise<T> {
  const fresh = !flag("neu-laden") && existsSync(file) && Date.now() - statSync(file).mtimeMs < 864e5;
  if (fresh) {
    try {
      const value = parse(readFileSync(file, "utf8"));
      if (accept(value)) return value;
    } catch {
      // Zwischenspeicher unbrauchbar: neu abrufen.
    }
  }
  const text = await fetchText();
  const value = parse(text);
  writeFileSync(file, text);
  return value;
}

const db = new Database(dbPath);
const latest = [...db.latestPriceDates().values()].sort().at(-1);
if (!latest) fail("Die Datenbank hat keine Kurse.");

const fx = await cached(join(outDir, "cache", "ecb-hist.xml"), fetchEcbHistory, parseEcbHistory).catch((error) =>
  fail(
    `EZB-Wechselkurse nicht verfügbar: ${error instanceof Error ? error.message : String(error)} (Option --neu-laden versucht es erneut)`,
  ),
);

let benchmark: PriceSeries | null = null;
if (!flag("ohne-index")) {
  try {
    benchmark = await cached(
      join(outDir, "cache", `index-${DEFAULT_BENCHMARK}.json`),
      async () => JSON.stringify(await fetchChart(DEFAULT_BENCHMARK, cli.start)),
      (text) => parseChart(DEFAULT_BENCHMARK, JSON.parse(text)),
      // Ein Zwischenspeicher, der erst nach dem Start beginnt, stammt von einem Lauf mit späterem Start.
      (series) => closeAtOrBefore(series, monthEnd(cli.start)) !== null,
    );
    if (closeAtOrBefore(benchmark, monthEnd(cli.start)) === null)
      console.warn(`Ohne Vergleichsindex: ${DEFAULT_BENCHMARK} beginnt erst am ${benchmark.points[0]!.date}, nach dem Start ${cli.start}.`);
  } catch (error) {
    console.warn(`Ohne Vergleichsindex: ${error instanceof Error ? error.message : String(error)} (Option --neu-laden versucht es erneut)`);
  }
}

const bondYield = db.referenceRate(BOND_KEY);
if (bondYield === null) console.warn("Keine Anleiherendite in der Datenbank: die Hürde steht auf 3 %.");
const file = join(outDir, `${cli.name}.json`);
if (existsSync(file)) console.warn(`Überschreibt den früheren Lauf ${file}.`);

console.error("Rechnet (mehrere Minuten bei vollem Datenvorrat) ...");
const result = runBacktest(
  db,
  {
    ...DEFAULT_OPTIONS,
    start: cli.start,
    end: latest.slice(0, 7),
    endDate: latest,
    profile: cli.profil,
    swap: cli.tausch,
    every: flag("jaehrlich") ? 4 : 1,
    randomRuns: cli.zufall,
    windowMonths: cli.fenster,
    hurdle: bondYield ?? 0.03,
  },
  { name: cli.name, fx, benchmark },
);
db.close();
if (benchmark && result.benchmark === null) console.warn("Der Vergleichsindex deckt nicht den ganzen Zeitraum ab und fehlt im Ergebnis.");

writeFileSync(file, JSON.stringify(result));
console.log(describeResult(result).join("\n"));
console.log(`\nGespeichert: ${file}`);
const against = value("vergleich");
if (against) console.log(`\n${compare(load(against), result)}`);
