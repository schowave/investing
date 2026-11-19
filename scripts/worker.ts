// Arbeitet die Warteschlange der Hintergrundläufe ab (zweiter Container im LXC, lokal neben `pnpm run dev`).
// Aufruf: pnpm run worker

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "../src/data/db.ts";
import { runWorker } from "../src/jobs/worker.ts";

const path = process.env.INVESTING_DB ?? "data/investing.sqlite";
mkdirSync(dirname(path), { recursive: true });
const db = new Database(path);
const stop = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  // Ein laufender Lauf endet mit dem Prozess; der nächste Start markiert ihn als unterbrochen.
  process.on(signal, () => {
    stop.abort();
    db.close();
    process.exit(0);
  });
}
console.log(`Worker bereit (${path})`);
await runWorker(db, { token: process.env.EODHD_API_TOKEN ?? null, fetchFn: fetch, now: () => new Date() }, stop.signal);
