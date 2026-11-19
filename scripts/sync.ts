// Täglicher Abgleich: Sicherung, Kurse und Wechselkurse laden, Bewertungen und Zielportfolios als Tagesstand speichern.
// Aufruf: pnpm run sync   (ein EODHD-Abruf je Aktie; reicht das Tagesbudget nicht, kommt der Rest am nächsten Tag)
// Im LXC läuft er über die Warteschlange (Seite „Abgleich“, nächtlicher Timer); dies ist der direkte Weg.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "../src/data/db.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { runJob } from "../src/jobs/registry.ts";

const path = process.env.INVESTING_DB ?? "data/investing.sqlite";
// Neben der Datenbank, nicht relativ zum Arbeitsverzeichnis: im Container liegt sie unter /data.
mkdirSync(dirname(path), { recursive: true });
const db = new Database(path);
const result = await runJob(consoleContext(db), "sync", {});
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
