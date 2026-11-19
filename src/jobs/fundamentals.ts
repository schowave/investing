// Fundamentaldaten und Historie einzelner Aktien neu laden (Aktienseite, pnpm run import:eodhd).

import type { Stock } from "../data/db.ts";
import { FUNDAMENTAL_FIELDS } from "../data/db.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals } from "../data/eodhdFundamentals.ts";
import { fetchDividends, fetchMonthlyCloses, fetchSplits } from "../data/eodhdHistory.ts";
import { valueStock } from "../valuation/run.ts";
import { isDailyLimit, type JobContext, type JobResult, reason, requireToken } from "./context.ts";

export const RAW_KIND = "eodhd-fundamentals";

/** Lädt die Jahresabschlüsse (10 Abrufe je Aktie) oder wertet mit `fromArchive` die gespeicherte Antwort neu aus. */
export async function refreshFundamentals(ctx: JobContext, stocks: readonly Stock[], fromArchive = false): Promise<JobResult> {
  const token = fromArchive ? "" : requireToken(ctx);
  let failed = 0;
  ctx.progress(0, stocks.length);
  for (const [index, stock] of stocks.entries()) {
    if (ctx.shouldStop()) return { summary: `abgebrochen nach ${index} von ${stocks.length} Aktien`, ok: false };
    try {
      const archived = fromArchive ? ctx.db.rawDocument(stock.id, RAW_KIND) : null;
      if (fromArchive && !archived) throw new Error("keine gespeicherte Rohantwort");
      const raw = archived?.body ?? (await fetchEodhdFundamentalsRaw(stock.id, token, ctx.fetchFn));
      // Die Rohantwort bleibt vollständig erhalten, damit sich später weitere Kennzahlen ohne neuen Abruf gewinnen lassen.
      if (!archived) ctx.db.saveRawDocument(stock.id, RAW_KIND, raw);
      const { years, reportingCurrency } = parseEodhdFundamentals(JSON.parse(raw));
      ctx.db.saveFundamentals(stock.id, years, "eodhd");
      const lastTen = years.slice(-10);
      const gaps = FUNDAMENTAL_FIELDS.filter((f) => lastTen.some((y) => y[f] === null));
      const complete = lastTen.filter((y) => FUNDAMENTAL_FIELDS.every((f) => y[f] !== null)).length;
      const currency =
        reportingCurrency && reportingCurrency !== stock.reportingCurrency
          ? `, Währung ${reportingCurrency} statt ${stock.reportingCurrency}`
          : "";
      ctx.log(
        `ok     ${stock.id.padEnd(10)} ${years.length} Jahre (${years[0]?.fiscalYear} bis ${years.at(-1)?.fiscalYear}), ${complete} von 10 vollständig${currency}${gaps.length ? `; Lücken: ${gaps.join(", ")}` : ""}`,
      );
    } catch (error) {
      if (isDailyLimit(error)) return { summary: `Tageslimit erreicht nach ${index} von ${stocks.length} Aktien`, ok: false };
      failed++;
      ctx.log(`fehlt  ${stock.id.padEnd(10)} ${reason(error)}`);
    }
    ctx.progress(index + 1, stocks.length);
  }
  const loaded = stocks.length - failed;
  return { summary: `${loaded} von ${stocks.length} Aktien geladen${failed ? `, ${failed} fehlgeschlagen` : ""}`, ok: failed === 0 };
}

/** Lädt Dividenden, Splits und Monatskurse einer Aktie (3 Abrufe). */
async function loadStockHistory(ctx: JobContext, stockId: string): Promise<void> {
  const token = requireToken(ctx);
  ctx.db.saveDividends(stockId, await fetchDividends(stockId, token, ctx.fetchFn));
  ctx.db.saveSplits(stockId, await fetchSplits(stockId, token, ctx.fetchFn));
  ctx.db.saveMonthlyPrices(stockId, await fetchMonthlyCloses(stockId, token, ctx.fetchFn));
}

/** Aktienseite „Daten aktualisieren“: Abschlüsse und Historie neu laden, dann neu bewerten (13 Abrufe). */
export async function refreshStock(ctx: JobContext, stockId: string): Promise<JobResult> {
  const stock = ctx.db.stock(stockId);
  if (!stock) throw new Error(`Unbekannte Aktie ${stockId}`);
  const fundamentals = await refreshFundamentals(ctx, [stock]);
  if (!fundamentals.ok) return fundamentals;
  try {
    await loadStockHistory(ctx, stock.id);
    ctx.log(`ok     ${stock.id.padEnd(10)} Dividenden, Splits und Monatskurse`);
  } catch (error) {
    // Ohne Kurs-Tarif gibt es keine Historie; die Bewertung nimmt dann die Dividenden aus den Abschlüssen.
    ctx.log(`fehlt  ${stock.id.padEnd(10)} Historie: ${reason(error)}`);
  }
  const { valuation } = valueStock(ctx.db, stock, ctx.today);
  const rate = valuation.returns?.base;
  return { summary: `${stock.name} aktualisiert${rate == null ? "" : `, innere Rendite ${(rate * 100).toFixed(1)} %`}`, ok: true };
}
