// Fundamentaldaten und Historie einzelner Aktien neu laden (Aktienseite, pnpm run import:eodhd).

import type { Database, Stock } from "../data/db.ts";
import { FUNDAMENTAL_FIELDS } from "../data/db.ts";
import type { EodhdFundamentals } from "../data/eodhdFundamentals.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals, stockFromEodhd } from "../data/eodhdFundamentals.ts";
import { fetchDividends, fetchMonthlyCloses, fetchSplits } from "../data/eodhdHistory.ts";
import { FUNDAMENTALS_KIND } from "../data/eodhdSnapshot.ts";
import { valueStock } from "../valuation/run.ts";
import { isDailyLimit, type JobContext, type JobResult, reason, requireToken } from "./context.ts";

/** Die Antwort enthält keine Jahresabschlüsse (Fonds, Hinterlegungsscheine ohne Abschlüsse, falsche Notiz). */
export class NoAnnualReportsError extends Error {
  constructor() {
    super("keine Jahresabschlüsse");
  }
}

/** Wertpapierart für argentinische Zertifikate auf ausländische Aktien; das Screening nimmt nur Stammaktien. */
const CEDEAR = "CEDEAR";

/**
 * In Buenos Aires notieren ausländische Unternehmen als CEDEAR: ein Zertifikat mit eigenem Bezugsverhältnis, die
 * Zahlen gehören aber zur ganzen Aktie des Mutterkonzerns. Der Anbieter führt sie als Stammaktie.
 */
function isCedear(symbol: string, country: string): boolean {
  return symbol.endsWith(".BA") && country !== "" && country !== "AR";
}

/**
 * Der eine Weg, auf dem Fundamentaldaten ins System kommen, ob über den Datenvorrat, eine ISIN, das Auffrischen
 * oder das Archiv: Stammdaten anlegen oder ergänzen, auf Wunsch die Rohantwort bewahren, Abschlüsse speichern.
 * Den Firmensitz überschreibt er nur im Datenvorrat; auf der Watchlist kann er von Hand gesetzt sein.
 * @throws NoAnnualReportsError, bevor etwas gespeichert ist.
 */
export function ingestFundamentals(db: Database, symbol: string, raw: string, options: { keepRaw: boolean }): EodhdFundamentals {
  const parsed = parseEodhdFundamentals(JSON.parse(raw));
  if (parsed.years.length === 0) throw new NoAnnualReportsError();
  const derived = stockFromEodhd(symbol, parsed);
  db.addStockIfMissing(derived);
  db.setSeatInStockpile(symbol, derived.country, derived.region);
  if (parsed.foundedYear !== null) db.setFoundedYearIfMissing(symbol, parsed.foundedYear);
  const securityType = isCedear(symbol, derived.country) ? CEDEAR : parsed.securityType;
  if (securityType !== null) db.setSecurityType(symbol, securityType);
  if (parsed.gicSector !== null) db.setGicSector(symbol, parsed.gicSector);
  if (options.keepRaw) db.saveRawDocument(symbol, FUNDAMENTALS_KIND, raw);
  db.saveFundamentals(symbol, parsed.years, "eodhd");
  return parsed;
}

/** Lädt die Jahresabschlüsse (10 Abrufe je Aktie) oder wertet mit `fromArchive` die gespeicherte Antwort neu aus. */
export async function refreshFundamentals(ctx: JobContext, stocks: readonly Stock[], fromArchive = false): Promise<JobResult> {
  const token = fromArchive ? "" : requireToken(ctx);
  let failed = 0;
  ctx.progress(0, stocks.length);
  for (const [index, stock] of stocks.entries()) {
    if (ctx.shouldStop()) return { summary: `abgebrochen nach ${index} von ${stocks.length} Aktien`, ok: false };
    try {
      const archived = fromArchive ? ctx.db.rawDocument(stock.id, FUNDAMENTALS_KIND) : null;
      if (fromArchive && !archived) throw new Error("keine gespeicherte Rohantwort");
      const raw = archived?.body ?? (await fetchEodhdFundamentalsRaw(stock.id, token, ctx.fetchFn));
      // Die Rohantwort bleibt vollständig erhalten, damit sich später weitere Kennzahlen ohne neuen Abruf gewinnen lassen.
      const { years, reportingCurrency } = ingestFundamentals(ctx.db, stock.id, raw, { keepRaw: !archived });
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
      // Eine leere Antwort ist kein Abbruch: Die gespeicherten Abschlüsse bleiben, Historie und Bewertung folgen.
      if (error instanceof NoAnnualReportsError) {
        ctx.log(`leer   ${stock.id.padEnd(10)} keine Jahresabschlüsse in der Antwort, die gespeicherten bleiben`);
        ctx.progress(index + 1, stocks.length);
        continue;
      }
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
