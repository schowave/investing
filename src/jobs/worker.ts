// Arbeitet die Warteschlange ab, immer nur einen Lauf zur Zeit (Tagesbudget, Schreibzugriffe).
// Läuft als eigener Prozess (scripts/worker.ts), damit lange Läufe die Oberfläche nicht ausbremsen.

import type { Database } from "../data/db.ts";
import { enqueueRecomputeIfOutdated } from "../valuation/recompute.ts";
import { type JobContext, reason } from "./context.ts";
import { isJobKind, JOB_KINDS, runJob } from "./registry.ts";

/** So viele Zeilen Protokoll bleiben je Lauf gespeichert. */
const LOG_LINES = 400;
const FLUSH_MS = 1000;

export interface WorkerDeps {
  token: string | null;
  fetchFn: typeof fetch;
  now: () => Date;
}

/** Führt den ältesten wartenden Lauf aus. `false`, wenn keiner wartet. */
export async function runNextJob(db: Database, deps: WorkerDeps): Promise<boolean> {
  const job = db.claimNextJob();
  if (!job) return false;
  const lines: string[] = [];
  let done: number | null = null;
  let total: number | null = null;
  let flushedAt = 0;
  const text = () => lines.slice(-LOG_LINES).join("\n");
  const flush = (force = false) => {
    const now = deps.now().getTime();
    if (!force && now - flushedAt < FLUSH_MS) return;
    flushedAt = now;
    db.updateJobProgress(job.id, { done, total, log: text() });
  };
  const cancellable = isJobKind(job.kind) && JOB_KINDS[job.kind].cancellable;
  const ctx: JobContext = {
    db,
    token: deps.token,
    fetchFn: deps.fetchFn,
    today: deps.now().toISOString().slice(0, 10),
    log: (line) => {
      lines.push(line);
      flush();
    },
    progress: (d, t) => {
      done = d;
      total = t;
      flush();
    },
    shouldStop: () => cancellable && db.isJobCancelRequested(job.id),
  };
  try {
    const result = await runJob(ctx, job.kind, job.args);
    const status = ctx.shouldStop() ? "cancelled" : result.ok ? "done" : "failed";
    flush(true);
    db.finishJob(job.id, status, result.summary, text());
  } catch (error) {
    lines.push(`Fehler: ${reason(error)}`);
    flush(true);
    db.finishJob(job.id, "failed", reason(error), text());
  }
  return true;
}

/** Wartet auf Läufe, bis `signal` abbricht. */
export async function runWorker(db: Database, deps: WorkerDeps, signal: AbortSignal, pollMs = 2000): Promise<void> {
  const orphans = db.failOrphanedJobs();
  if (orphans > 0) console.log(`${orphans} unterbrochene Läufe als gescheitert markiert`);
  // Neue Version der Rechnung (Deployment): gespeicherte Stände neu rechnen, bevor jemand den Datenvorrat ansieht.
  if (enqueueRecomputeIfOutdated(db)) console.log("Neue Version der Rechnung: Neurechnen eingestellt");
  while (!signal.aborted) {
    const ran = await runNextJob(db, deps);
    if (!ran) await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
