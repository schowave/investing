// Lädt eingestellte Titel für den Rückblick (Survivorship, Stufe 6 in docs/Selbstlernende-Strategie.md): Abschlüsse, Dividenden und
// Splits von EODHD, 12 Abrufe je Titel. Die Monatskurse kommen aus der Datei neben der Datenbank (survivorship/monthly-prices.jsonl).
// Aufruf: pnpm run import:delisted [Optionen]
//           --ab 20000000     Mindestumsatz je Monat in USD (Standard 20 Mio.)
//           --bis 50000000    Obergrenze des Umsatzes (ausschließlich), um Stufen abzugrenzen
//           --seit 2016-01    Reihe endet an oder nach diesem Monat (Standard 2016-01)
//           --anzahl 500      höchstens so viele Titel (nach fallendem Umsatz)
//           --trocken         nur anzeigen, was geladen würde
// Bricht am Tageslimit (abzüglich der Reserve für den Abgleich) sauber ab; derselbe Befehl setzt fort.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { Database } from "../src/data/db.ts";
import { parseDelistedLines, selectDelisted } from "../src/data/delisted.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { CALLS_PER_DELISTED, delistedTodo, importDelisted } from "../src/jobs/delisted.ts";

const args = process.argv.slice(2);
const VALUE_FLAGS = ["ab", "bis", "seit", "anzahl"];
const SWITCHES = ["trocken"];
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
for (let i = 0; i < args.length; i++) {
  const name = args[i]!.replace(/^--/, "");
  if (!args[i]!.startsWith("--") || !(VALUE_FLAGS.includes(name) || SWITCHES.includes(name))) fail(`Unbekannte Option: ${args[i]}`);
  if (VALUE_FLAGS.includes(name)) {
    if (args[i + 1] === undefined || args[i + 1]!.startsWith("--")) fail(`Option --${name} braucht einen Wert`);
    i++;
  }
}
const parsed = z
  .object({
    ab: z.coerce.number().min(0).default(20e6),
    bis: z.coerce.number().positive().optional(),
    seit: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .default("2016-01"),
    anzahl: z.coerce.number().int().positive().optional(),
  })
  .safeParse({ ab: value("ab"), bis: value("bis"), seit: value("seit"), anzahl: value("anzahl") });
if (!parsed.success) fail(`Ungültige Option: ${parsed.error.issues.map((i) => `--${String(i.path[0])}: ${i.message}`).join("; ")}`);
const cli = parsed.data!;

const dbPath = process.env.INVESTING_DB ?? "data/investing.sqlite";
const file = join(dirname(dbPath), "survivorship", "monthly-prices.jsonl");
if (!existsSync(file)) fail(`Keine Kursdatei: ${file}`);
const all = parseDelistedLines(readFileSync(file, "utf8"));
const selected = selectDelisted(all, { endedSince: `${cli.seit}-01`, minTurnover: cli.ab, maxTurnover: cli.bis });
const chosen = cli.anzahl ? selected.slice(0, cli.anzahl) : selected;

const db = new Database(dbPath);
const ctx = consoleContext(db);
if (args.includes("--trocken")) {
  const { todo, taken } = delistedTodo(ctx, chosen);
  console.log(
    `${all.length} Titel in der Datei, ${selected.length} nach Auswahl, ${chosen.length} mit --anzahl; offen ${todo.length} (${taken} Symbole belegt), rund ${todo.length * CALLS_PER_DELISTED} Abrufe.`,
  );
  db.close();
  process.exit(0);
}
const result = await importDelisted(ctx, chosen);
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
