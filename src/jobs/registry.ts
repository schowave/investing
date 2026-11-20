// Alle Arten von Hintergrundläufen: Parameter (mit zod geprüft, beim Einstellen und beim Ausführen), Bezeichnung,
// geschätzte Kosten und der Lauf selbst.

import { z } from "zod";
import type { Database } from "../data/db.ts";
import { FUNDAMENTALS_KIND } from "../data/eodhdSnapshot.ts";
import { RECOMPUTE_JOB, recomputeAll } from "../valuation/recompute.ts";
import type { JobContext, JobResult } from "./context.ts";
import { refreshStock } from "./fundamentals.ts";
import { type HistoryOptions, historyTodo, loadHistory } from "./history.ts";
import { addByIsin, FUNDAMENTALS_CALLS, importStockpile } from "./stockpile.ts";
import { syncJob } from "./sync.ts";

const TickerSymbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.\-_]*\.[A-Z0-9]+$/, "Symbol mit Börse, z. B. IMB.LSE");
const Isin = z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/);

/** Welche Abschlüsse "Abschlüsse auffrischen" neu lädt. */
export type RefreshScope = "watchlist" | "veraltet" | "alle";

/** Titel mit gespeicherten Abschlüssen für einen Umfang: Watchlist und Bestand, oder die wahrscheinlich veralteten. */
export function refreshIds(db: Database, scope: Exclude<RefreshScope, "alle">, today: string): string[] {
  const known = db.stockIdsWithRawDocument(FUNDAMENTALS_KIND);
  if (scope === "veraltet") return db.staleFundamentals(FUNDAMENTALS_KIND, today);
  return [...new Set([...db.stocks().map((s) => s.id), ...db.heldStockIds()])].filter((id) => known.has(id)).sort();
}

export const JOB_KINDS = {
  sync: {
    label: "Abgleich",
    args: z.object({}),
    cancellable: false,
    run: (ctx: JobContext) =>
      syncJob(ctx, {
        dir: process.env.INVESTING_BACKUPS ?? "data/backups",
        keep: Number(process.env.INVESTING_BACKUP_KEEP ?? 7),
      }),
  },
  "stock-refresh": {
    label: "Aktie aktualisieren",
    args: z.object({ id: z.string().min(1) }),
    cancellable: false,
    run: (ctx: JobContext, args: { id: string }) => refreshStock(ctx, args.id),
  },
  "add-stocks": {
    label: "Titel aufnehmen",
    args: z
      .object({ isins: z.array(Isin).max(200), symbols: z.array(TickerSymbol).max(200) })
      .refine((a) => a.isins.length + a.symbols.length > 0, "Bitte mindestens eine ISIN oder ein Symbol angeben."),
    cancellable: true,
    run: async (ctx: JobContext, args: { isins: string[]; symbols: string[] }) => {
      const results: JobResult[] = [];
      if (args.isins.length) results.push(await addByIsin(ctx, args.isins));
      if (args.symbols.length && !ctx.shouldStop()) {
        results.push(await importStockpile(ctx, { indices: [], symbols: args.symbols, exchanges: [], refreshAll: false, watch: true }));
      }
      return { summary: results.map((r) => r.summary).join("; "), ok: results.every((r) => r.ok) };
    },
  },
  history: {
    label: "Dividenden und Splits laden",
    args: z.object({
      refresh: z.boolean(),
      // Ältere Läufe in der Warteschlange haben nur `refresh`; sie laden Dividenden und Splits für alle, ohne Monatskurse.
      scope: z.enum(["watchlist", "rechenbar", "alle"]).default("alle"),
      monthly: z.boolean().default(false),
    }),
    cancellable: true,
    run: (ctx: JobContext, args: HistoryOptions) => loadHistory(ctx, args),
  },
  "index-import": {
    label: "Indizes laden",
    args: z
      .object({
        indices: z
          .array(
            z
              .string()
              .trim()
              .toUpperCase()
              .regex(/^[A-Z0-9^._-]+\.INDX$/),
          )
          .max(20),
        exchanges: z
          .array(
            z
              .string()
              .trim()
              .toUpperCase()
              .regex(/^[A-Z0-9]{1,8}$/),
          )
          .max(5),
      })
      .refine((a) => a.indices.length + a.exchanges.length > 0, "Bitte einen Index (z. B. GSPC.INDX) oder eine Börse angeben."),
    cancellable: true,
    run: (ctx: JobContext, args: { indices: string[]; exchanges: string[] }) =>
      importStockpile(ctx, { ...args, symbols: [], refreshAll: false, watch: false }),
  },
  [RECOMPUTE_JOB]: {
    label: "Neu rechnen",
    args: z.object({}),
    cancellable: false,
    run: async (ctx: JobContext) => {
      const report = recomputeAll(ctx.db, ctx.today);
      for (const { id, error } of report.valuationErrors) ctx.log(`fehlt  ${id.padEnd(12)} ${error}`);
      const failed = report.valuationErrors.length;
      return {
        summary: `${report.valuations} Bewertungen, ${report.screened} Titel im Screening, ${report.portfolios} Portfolios neu gerechnet${failed ? `, ${failed} nicht bewertet` : ""}`,
        ok: failed === 0,
      };
    },
  },
  "refresh-all": {
    label: "Abschlüsse auffrischen",
    args: z.object({ scope: z.enum(["watchlist", "veraltet", "alle"]).default("alle") }),
    cancellable: true,
    run: (ctx: JobContext, args: { scope: RefreshScope }) =>
      args.scope === "alle"
        ? importStockpile(ctx, { indices: [], symbols: [], exchanges: [], refreshAll: true, watch: false })
        : importStockpile(ctx, {
            indices: [],
            symbols: refreshIds(ctx.db, args.scope, ctx.today),
            exchanges: [],
            refreshAll: false,
            reload: true,
            watch: false,
          }),
  },
} as const;

export type JobKind = keyof typeof JOB_KINDS;
export const isJobKind = (kind: string): kind is JobKind => Object.hasOwn(JOB_KINDS, kind);

/** Prüft die Parameter und führt den Lauf aus. */
export async function runJob(ctx: JobContext, kind: string, args: unknown): Promise<JobResult> {
  if (!isJobKind(kind)) throw new Error(`Unbekannte Art von Lauf: ${kind}`);
  const definition = JOB_KINDS[kind];
  const parsed = definition.args.parse(args);
  return (definition.run as (ctx: JobContext, args: unknown) => Promise<JobResult>)(ctx, parsed);
}

/** Ab so vielen Abrufen muss ein Lauf ausdrücklich bestätigt werden. */
export const CONFIRM_CALLS = 2000;

/** Geschätzte EODHD-Abrufe für das Auffrischen von Abschlüssen. */
export function estimateRefresh(db: Database, scope: RefreshScope, today: string): number {
  const count = scope === "alle" ? db.stockIdsWithRawDocument(FUNDAMENTALS_KIND).size : refreshIds(db, scope, today).length;
  return count * FUNDAMENTALS_CALLS;
}

/** Geschätzte EODHD-Abrufe für Dividenden und Splits (je fehlender Art und Aktie einer). */
export function estimateHistory(db: Database, options: HistoryOptions): number {
  return historyTodo({ db }, options).length;
}
