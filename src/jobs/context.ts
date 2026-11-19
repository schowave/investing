// Gemeinsamer Rahmen der Hintergrundläufe: Protokoll, Fortschritt, Abbruch. Derselbe Lauf geht über den Worker
// (Oberfläche, nächtlicher Timer) oder direkt über die Kommandozeile (scripts/).

import type { Database } from "../data/db.ts";
import { EodhdError } from "../data/eodhd.ts";

export interface JobContext {
  db: Database;
  /** EODHD-Token; `null`, wenn keiner gesetzt ist. */
  token: string | null;
  log(line: string): void;
  progress(done: number, total: number): void;
  /** `true`, sobald jemand den Lauf abbrechen will; Läufe prüfen das zwischen zwei Titeln. */
  shouldStop(): boolean;
  fetchFn: typeof fetch;
  /** Heutiges Datum (ISO), für Bewertungen und Sicherungen. */
  today: string;
}

export interface JobResult {
  /** Ein Satz für die Liste der Läufe. */
  summary: string;
  /** `false`, wenn etwas nicht geklappt hat (einzelne Titel, Tageslimit); der Lauf gilt dann als gescheitert. */
  ok: boolean;
}

/** Läufe, die das Tagesbudget von EODHD brauchen, brechen ohne Token sofort ab. */
export function requireToken(ctx: JobContext): string {
  if (!ctx.token) throw new Error("EODHD_API_TOKEN fehlt (in .env.local bzw. /opt/investing/.env eintragen).");
  return ctx.token;
}

/** Kurzer Grund für eine Zeile im Protokoll; nennt nie den Token. */
export function reason(error: unknown): string {
  if (error instanceof EodhdError) {
    if (error.status === 402) return "HTTP 402 (Tageslimit erreicht)";
    if (error.status === 403) return "HTTP 403 (Tarif enthält diese Daten nicht)";
    return `HTTP ${error.status}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export const isDailyLimit = (error: unknown) => error instanceof EodhdError && error.status === 402;

/**
 * Arbeitet `items` mit `parallel` gleichzeitigen Abrufen ab. Hört auf, wenn das Tageslimit erreicht ist oder
 * jemand abbricht; meldet den Fortschritt.
 */
export async function eachParallel<T>(
  ctx: JobContext,
  items: readonly T[],
  parallel: number,
  work: (item: T) => Promise<void>,
  label: (item: T) => string = String,
): Promise<{ done: number; failed: number; limitReached: boolean; stopped: boolean }> {
  let done = 0;
  let failed = 0;
  let next = 0;
  let limitReached = false;
  let stopped = false;
  ctx.progress(0, items.length);
  async function worker(): Promise<void> {
    while (next < items.length && !limitReached && !stopped) {
      if (ctx.shouldStop()) {
        stopped = true;
        return;
      }
      const item = items[next++]!;
      try {
        await work(item);
        done++;
      } catch (error) {
        if (isDailyLimit(error)) {
          limitReached = true;
          return;
        }
        failed++;
        ctx.log(`fehlt  ${label(item).padEnd(14)} ${reason(error)}`);
      }
      ctx.progress(done + failed, items.length);
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));
  if (limitReached) ctx.log(`Tageslimit erreicht nach ${done + failed} von ${items.length}. Später erneut starten setzt fort.`);
  if (stopped) ctx.log(`Abgebrochen nach ${done + failed} von ${items.length}.`);
  return { done, failed, limitReached, stopped };
}

/** Kontext für die Kommandozeile: Protokoll auf die Konsole, kein Abbruch. */
export function consoleContext(db: Database): JobContext {
  return {
    db,
    token: process.env.EODHD_API_TOKEN ?? null,
    log: (line) => console.log(line),
    progress: () => {},
    shouldStop: () => false,
    fetchFn: fetch,
    today: new Date().toISOString().slice(0, 10),
  };
}
