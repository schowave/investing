// Packt die gespeicherten Rohantworten und verkleinert die Datenbankdatei. Aufruf: pnpm run compact

import { statSync } from "node:fs";
import { Database } from "../src/data/db.ts";

const path = process.env.INVESTING_DB ?? "data/investing.sqlite";
const before = statSync(path).size;
const db = new Database(path);
const count = db.compressRawDocuments();
db.close();
console.log(`${count} Rohantworten gepackt: ${(before / 1e6).toFixed(0)} MB auf ${(statSync(path).size / 1e6).toFixed(0)} MB.`);
