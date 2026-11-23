// Datenvorrat: Fundamentaldaten ganzer Indizes, Börsen oder einzelner Symbole laden, alles auffrischen,
// Titel über ISIN aufnehmen (pnpm run import:index, import:isin; Seiten Datenvorrat und Abgleich).

import { z } from "zod";
import { EodhdError } from "../data/eodhd.ts";
import { fetchEodhdFundamentalsRaw, searchEodhd } from "../data/eodhdFundamentals.ts";
import { FUNDAMENTALS_KIND } from "../data/eodhdSnapshot.ts";
import { eachParallel, isDailyLimit, type JobContext, type JobResult, reason, requireToken } from "./context.ts";
import { ingestFundamentals, NoAnnualReportsError } from "./fundamentals.ts";
import { capToBudget } from "./reserve.ts";

/** Abrufe für die Fundamentaldaten einer Aktie. */
export const FUNDAMENTALS_CALLS = 10;

const PARALLEL = 4;
/** Ersatzbörsen für Titel, deren Heimatbörse der Anbieter nicht führt (Mailand). */
const FALLBACK_EXCHANGES = ["XETRA", "F", "STU", "MU"];
/** Einträge eines Objekts oder einer Liste in der erwarteten Form; ein fremder Eintrag fällt weg, nicht die ganze Liste. */
function entries<T>(value: unknown, row: z.ZodType<T>): T[] {
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap((entry) => {
    const parsed = row.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
/** Bestandteil eines Index in dessen Fundamentals-Antwort. */
const Component = z.looseObject({ Code: z.string().min(1), Exchange: z.string().min(1), Name: z.string().catch("") });
/** Zeile der Symbolliste einer Börse. */
const Listed = z.looseObject({ Code: z.string().min(1), Name: z.string().catch(""), Type: z.string().nullish().catch(null) });
const ISIN = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/g;

export interface StockpileRequest {
  /** Indizes wie GSPC.INDX: alle Bestandteile. */
  indices: string[];
  /** Einzelne Symbole wie KAP.IL. */
  symbols: string[];
  /** Börsen wie IL: alle Stammaktien. */
  exchanges: string[];
  /** Alle gespeicherten Titel neu laden (vor einer Kündigung des Tarifs). */
  refreshAll: boolean;
  /** Die angegebenen Symbole auch dann neu laden, wenn sie schon gespeichert sind (Auffrischen einer Auswahl). */
  reload?: boolean;
  /** Geladene Titel auf die Watchlist nehmen. */
  watch: boolean;
}

/** Alle gespeicherten Rohantworten ohne Abruf neu auswerten (nach einer Änderung an der Auswertung). */
export function reparseArchive(ctx: JobContext): JobResult {
  let done = 0;
  for (const id of ctx.db.stockIdsWithRawDocument(FUNDAMENTALS_KIND)) {
    ingestFundamentals(ctx.db, id, ctx.db.rawDocument(id, FUNDAMENTALS_KIND)!.body, { keepRaw: false });
    done++;
  }
  return { summary: `${done} Aktien aus dem Archiv neu ausgewertet`, ok: true };
}

async function fetchWithRetry(ctx: JobContext, symbol: string, token: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchEodhdFundamentalsRaw(symbol, token, ctx.fetchFn);
    } catch (error) {
      const permanent = error instanceof EodhdError && [401, 402, 403, 404].includes(error.status);
      if (permanent || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

/** Sucht dieselbe Aktie an einer deutschen Börse, wenn die Heimatbörse fehlt. */
async function fallbackSymbol(ctx: JobContext, name: string | undefined, token: string): Promise<string | null> {
  if (!name) return null;
  const firstWord = name.split(/\s+/)[0]!.toLowerCase();
  const hits = (await searchEodhd(name, token, ctx.fetchFn)).filter(
    (h) => h.type === "Common Stock" && FALLBACK_EXCHANGES.includes(h.exchange) && h.name.toLowerCase().startsWith(firstWord),
  );
  hits.sort((a, b) => FALLBACK_EXCHANGES.indexOf(a.exchange) - FALLBACK_EXCHANGES.indexOf(b.exchange));
  return hits[0]?.symbol ?? null;
}

/** Symbole mit Namen aus Indizes, Börsen und Einzelangaben. */
async function collectSymbols(ctx: JobContext, request: StockpileRequest, token: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const index of request.indices) {
    const data: unknown = JSON.parse(await fetchEodhdFundamentalsRaw(index, token, ctx.fetchFn));
    const components = entries((data as { Components?: unknown } | null)?.Components, Component);
    for (const c of components) names.set(`${c.Code}.${c.Exchange}`, c.Name);
    ctx.log(`${index}: ${components.length} Bestandteile`);
  }
  for (const symbol of request.symbols) names.set(symbol, "");
  for (const exchange of request.exchanges) {
    const url = new URL(`https://eodhd.com/api/exchange-symbol-list/${encodeURIComponent(exchange)}`);
    url.searchParams.set("api_token", token);
    url.searchParams.set("fmt", "json");
    const response = await ctx.fetchFn(url);
    if (!response.ok) throw new EodhdError(response.status, `exchange-symbol-list/${exchange}`);
    const list = entries(await response.json(), Listed).filter((x) => x.Type === "Common Stock");
    for (const x of list) names.set(`${x.Code}.${exchange}`, x.Name);
    ctx.log(`Börse ${exchange}: ${list.length} Stammaktien`);
  }
  return names;
}

/** Lädt die Fundamentaldaten neuer Titel (10 Abrufe je Titel); mit `refreshAll` auch alle schon gespeicherten. */
export async function importStockpile(ctx: JobContext, request: StockpileRequest): Promise<JobResult> {
  const token = requireToken(ctx);
  const names = await collectSymbols(ctx, request, token);
  // Ein Kürzel, das einem eingestellten Titel gehört (Survivorship-Daten), darf nicht von einem neuen Listing überschrieben werden.
  for (const id of ctx.db.delistedStockIds()) names.delete(id);
  const known = ctx.db.stockIdsWithRawDocument(FUNDAMENTALS_KIND);
  const wanted = request.refreshAll
    ? [...new Set([...known, ...names.keys()])].sort()
    : [...names.keys()].filter((s) => !known.has(s) || request.watch || request.reload).sort();
  // Was schon gespeichert ist und nur auf die Watchlist soll, kostet nichts; der Rest zählt gegen das Budget.
  const free = request.watch && !request.reload ? wanted.filter((s) => known.has(s)) : [];
  const toFetch = wanted.filter((s) => !free.includes(s));
  // Ausdrücklich aufgenommene Titel (Watchlist) sind wenige und gewollt: Sie laufen bis zum Tageslimit, ohne Reserve.
  const paid = request.watch ? { items: toFetch, capped: false } : await capToBudget(ctx, toFetch, FUNDAMENTALS_CALLS);
  const todo = [...free, ...paid.items];
  ctx.log(
    `${todo.length} Aktien zu laden${request.refreshAll || request.reload ? " (Auffrischen)" : `, ${names.size - wanted.length} schon vorhanden`}`,
  );

  const stored: string[] = [];
  const result = await eachParallel(ctx, todo, PARALLEL, async (symbol) => {
    if (request.watch && known.has(symbol) && !request.reload) {
      stored.push(symbol);
      return;
    }
    let target = symbol;
    let raw: string;
    try {
      raw = await fetchWithRetry(ctx, symbol, token);
    } catch (error) {
      if (!(error instanceof EodhdError && error.status === 404)) throw error;
      const alternative = await fallbackSymbol(ctx, names.get(symbol), token);
      if (!alternative) throw error;
      if (known.has(alternative)) {
        stored.push(alternative);
        return;
      }
      raw = await fetchWithRetry(ctx, alternative, token);
      target = alternative;
      ctx.log(`ersatz ${symbol.padEnd(12)} als ${alternative}`);
    }
    ingestFundamentals(ctx.db, target, raw, { keepRaw: true });
    stored.push(target);
  });
  if (request.watch) {
    for (const id of stored) {
      ctx.db.setWatched(id, true);
      ctx.log(`ok     ${id.padEnd(12)} ${ctx.db.stock(id)?.name ?? ""} auf der Watchlist`);
    }
  }
  const rest = result.limitReached || result.stopped || paid.capped ? ", Rest offen" : "";
  return {
    summary: `${result.done} Aktien geladen, ${result.failed} fehlgeschlagen${rest}`,
    ok: result.failed === 0 && !result.limitReached && !result.stopped && !paid.capped,
  };
}

/** Der Anbieter führt zu einer ISIN keine Notiz mit Jahresabschlüssen (kein vorübergehender Fehler). */
class NoListingError extends Error {}

/** Einstellung: ISINs, deren Aufnahme scheiterte, mit dem Tag des Versuchs. */
const FAILED_ISINS = "isins-ohne-notiz";
const FailedIsins = z.record(z.string(), z.string()).catch({});

function readFailedIsins(db: JobContext["db"]): Record<string, string> {
  try {
    return FailedIsins.parse(JSON.parse(db.setting(FAILED_ISINS) ?? "{}"));
  } catch {
    return {};
  }
}

/** ISINs, deren Aufnahme seit `since` (ISO-Datum) gescheitert ist und seither nicht gelang. */
export function failedIsinsSince(db: JobContext["db"], since: string): Set<string> {
  return new Set(Object.entries(readFailedIsins(db)).flatMap(([isin, date]) => (date >= since ? [isin] : [])));
}

function markIsin(db: JobContext["db"], isin: string, failedOn: string | null): void {
  const failed = readFailedIsins(db);
  if (failedOn === null) {
    if (!(isin in failed)) return;
    delete failed[isin];
  } else failed[isin] = failedOn;
  db.setSetting(FAILED_ISINS, JSON.stringify(failed));
}

/** ISINs aus beliebigem Text (eine Depotliste, kopierte Tabelle). */
export const isinsIn = (text: string) => [...new Set(text.toUpperCase().match(ISIN) ?? [])];

/**
 * Lädt Titel über ihre ISIN (Suche plus 10 Abrufe), merkt die ISIN an der Notiz und nimmt sie auf die Watchlist; mit
 * `watch: false` bleiben sie im Datenvorrat (Positionen aus dem Depot).
 */
export async function addByIsin(ctx: JobContext, isins: readonly string[], options: { watch?: boolean } = {}): Promise<JobResult> {
  const token = requireToken(ctx);
  const known = ctx.db.stockIdsWithRawDocument(FUNDAMENTALS_KIND);
  let failed = 0;
  ctx.progress(0, isins.length);
  for (const [index, isin] of isins.entries()) {
    if (ctx.shouldStop()) return { summary: `abgebrochen nach ${index} von ${isins.length} ISINs`, ok: false };
    try {
      const hits = (await searchEodhd(isin, token, ctx.fetchFn)).filter((h) => h.isin === isin && h.type === "Common Stock");
      if (hits.length === 0) throw new NoListingError("beim Anbieter nicht gefunden");
      // Zuerst eine Notiz, die schon gespeichert ist, dann die Hauptnotiz, dann die übrigen.
      hits.sort((a, b) => Number(known.has(b.symbol)) - Number(known.has(a.symbol)) || Number(b.isPrimary) - Number(a.isPrimary));
      let stored: string | null = null;
      for (const hit of hits) {
        if (known.has(hit.symbol)) {
          stored = hit.symbol;
          break;
        }
        try {
          const raw = await fetchEodhdFundamentalsRaw(hit.symbol, token, ctx.fetchFn);
          ingestFundamentals(ctx.db, hit.symbol, raw, { keepRaw: true });
          if (hit.previousClose !== null && hit.previousCloseDate !== null) {
            ctx.db.saveRawCloses(hit.symbol, [{ date: hit.previousCloseDate, close: hit.previousClose }]);
          }
          known.add(hit.symbol);
          stored = hit.symbol;
          break;
        } catch (error) {
          if (error instanceof NoAnnualReportsError) continue;
          if (!(error instanceof EodhdError && error.status === 404)) throw error;
        }
      }
      if (!stored) throw new NoListingError("keine Notiz mit Jahresabschlüssen");
      ctx.db.setIsin(stored, isin);
      markIsin(ctx.db, isin, null);
      if (options.watch ?? true) ctx.db.setWatched(stored, true);
      ctx.log(`ok     ${isin}  ${stored.padEnd(12)} ${ctx.db.stock(stored)!.name} (${ctx.db.fundamentals(stored).length} Jahre)`);
    } catch (error) {
      if (isDailyLimit(error)) return { summary: `Tageslimit erreicht nach ${index} von ${isins.length} ISINs`, ok: false };
      failed++;
      // Nur ein klares Nein des Anbieters sperrt die ISIN; ein Netzfehler oder 5xx nicht.
      if (error instanceof NoListingError) markIsin(ctx.db, isin, ctx.today);
      ctx.log(`fehlt  ${isin}  ${reason(error)}`);
    }
    ctx.progress(index + 1, isins.length);
  }
  return {
    summary: `${isins.length - failed} von ${isins.length} Titeln aufgenommen${failed ? `, ${failed} fehlgeschlagen` : ""}`,
    ok: failed === 0,
  };
}
