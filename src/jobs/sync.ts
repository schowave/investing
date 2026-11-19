// Täglicher Abgleich als Lauf: erst sichern, dann Kurse, Wechselkurse, Bewertungen (nächtlicher Timer, Knopf, pnpm run sync).

import { rotateBackup } from "../data/backup.ts";
import { START_WATCHLIST } from "../data/seed.ts";
import { runDailySync, type SyncReport, syncSucceeded } from "../sync/dailySync.ts";
import type { JobContext, JobResult } from "./context.ts";

function describeSyncReport(report: SyncReport): string[] {
  const lines = [
    report.fxError ? `Wechselkurse nicht geladen: ${report.fxError}` : `Wechselkurse vom ${report.fxDate}`,
    `Kurse: ${report.pricesLoaded} geladen, ${report.pricesCurrent} waren aktuell (Tagesbudget ${report.budget} Abrufe).`,
    ...report.priceErrors.map(({ id, error }) => `fehlt  ${id.padEnd(12)} ${error}`),
  ];
  if (report.pricesDeferred.length > 0) lines.push(`Budget erschöpft, folgen beim nächsten Lauf: ${report.pricesDeferred.join(", ")}`);
  for (const error of report.referenceErrors) lines.push(`Bezugsgröße nicht geladen: ${error}`);
  for (const { id, error } of report.valuationErrors ?? []) lines.push(`nicht bewertet ${id.padEnd(12)} ${error}`);
  lines.push(
    `${report.valuations} Bewertungen mit Verlauf, ${report.screened} Titel im Screening, ${report.portfolios} Portfolios gespeichert.`,
  );
  return lines;
}

export async function syncJob(ctx: JobContext, backup: { dir: string; keep: number }): Promise<JobResult> {
  for (const stock of START_WATCHLIST) ctx.db.addStockIfMissing(stock);
  // Vor jedem Abgleich sichern: geht etwas schief, liegt der Stand vom Vortag in den Sicherungen.
  ctx.log(`Gesichert: ${rotateBackup(ctx.db, backup.dir, ctx.today, backup.keep)}`);
  if (!ctx.token) ctx.log("EODHD_API_TOKEN fehlt, Kurse werden nicht geladen.");
  const report = await runDailySync(ctx.db, ctx.token, new Date(), ctx.fetchFn);
  for (const line of describeSyncReport(report)) ctx.log(line);
  const ok = syncSucceeded(report);
  const summary = `${report.pricesLoaded} Kurse geladen, ${report.valuations} Bewertungen${
    report.pricesDeferred.length ? `, ${report.pricesDeferred.length} Titel warten auf Budget` : ""
  }${report.priceErrors.length ? `, ${report.priceErrors.length} Kurse fehlen` : ""}${report.fxError ? ", Wechselkurse fehlen" : ""}`;
  return { summary, ok };
}
