// Bringt die Datenbank auf den neuesten Stand (offene Migrationen aus db/migrations).
// Aufruf: pnpm run migrate   (passiert auch bei jedem Öffnen der Datenbank durch Oberfläche und Skripte)

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "../src/data/db.ts";

const path = process.env.INVESTING_DB ?? "data/investing.sqlite";
mkdirSync(dirname(path), { recursive: true });
new Database(path).close();
console.log(`${path} ist auf dem neuesten Stand.`);
