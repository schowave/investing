// Alle Arten von Hintergrundläufen: Parameter (mit zod geprüft, beim Einstellen und beim Ausführen), Bezeichnung,
// geschätzte Kosten und der Lauf selbst.

import { z } from "zod";
import type { Database } from "../data/db.ts";
import type { JobContext, JobResult } from "./context.ts";
import { RAW_KIND, refreshStock } from "./fundamentals.ts";
import { historyTodo, loadHistory } from "./history.ts";
import { addByIsin, importStockpile } from "./stockpile.ts";
import { syncJob } from "./sync.ts";

const TickerSymbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9.\-_]*\.[A-Z0-9]+$/, "Symbol mit Börse, z. B. IMB.LSE");
const Isin = z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/);

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
    label: "Historie laden",
    args: z.object({ refresh: z.boolean() }),
    cancellable: true,
    run: (ctx: JobContext, args: { refresh: boolean }) => loadHistory(ctx, args.refresh),
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
  "refresh-all": {
    label: "Alle Titel auffrischen",
    args: z.object({}),
    cancellable: true,
    run: (ctx: JobContext) => importStockpile(ctx, { indices: [], symbols: [], exchanges: [], refreshAll: true, watch: false }),
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

/** Geschätzte EODHD-Abrufe, bevor jemand einen Lauf startet. */
export function estimateCalls(db: Database, kind: JobKind): number {
  switch (kind) {
    case "sync":
      return db.stocks().length;
    case "stock-refresh":
      return 13;
    case "history":
      return historyTodo({ db }, false).length;
    case "refresh-all":
      return db.stockIdsWithRawDocument(RAW_KIND).size * 10;
    default:
      return 0;
  }
}
