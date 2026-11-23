// Lädt eingestellte Titel für den Rückblick: Abschlüsse (10 Abrufe), Dividenden und Splits (je 1); die Monatskurse stehen schon
// in der Kursdatei (Schritt A). Die Titel tragen `delistedOn`; Abgleich und Bewertung überspringen sie.

import type { DelistedCandidate } from "../data/delisted.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals } from "../data/eodhdFundamentals.ts";
import { fetchDividends, fetchSplits } from "../data/eodhdHistory.ts";
import { eachParallel, type JobContext, type JobResult, requireToken } from "./context.ts";
import { ingestFundamentals, NoAnnualReportsError } from "./fundamentals.ts";
import { capToBudget } from "./reserve.ts";

const PARALLEL = 4;
/** Abrufe je Titel: Abschlüsse 10, Dividenden 1, Splits 1. */
export const CALLS_PER_DELISTED = 12;
/** Titel ohne Jahresabschlüsse oder mit abweichendem Namen in der Antwort; sie noch einmal zu laden kostet zehn Abrufe ohne Ertrag. */
const NO_REPORTS_KEY = "delisted-ohne-abschluss";

function noReports(ctx: Pick<JobContext, "db">): Set<string> {
  const raw = ctx.db.setting(NO_REPORTS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

/** Erstes Wort des Namens ohne Satzzeichen und Rechtsform; genügt, um ein neu vergebenes Kürzel zu erkennen. */
function firstWord(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .find((w) => w !== "" && w !== "the") ?? ""
  );
}

/** Titel, die noch etwas zu laden haben: neu, oder angelegt, aber ohne Monatskurse, Dividenden oder Splits. */
export function delistedTodo(ctx: Pick<JobContext, "db">, candidates: readonly DelistedCandidate[]) {
  const { db } = ctx;
  const skip = noReports(ctx);
  const withDividends = db.stockIdsWithHistory("dividends");
  const withSplits = db.stockIdsWithHistory("splits");
  const withMonthly = db.stockIdsWithHistory("monthly_prices");
  let taken = 0;
  const todo = candidates.filter((c) => {
    if (skip.has(c.id)) return false;
    const existing = db.stock(c.id);
    if (!existing) return true;
    // Ein Symbol, das schon einem lebenden Titel gehört (Kürzel wiederverwendet), lässt sich nicht zuordnen.
    if (!existing.delistedOn) {
      taken++;
      return false;
    }
    return !withDividends.has(c.id) || !withSplits.has(c.id) || !withMonthly.has(c.id);
  });
  return { todo, taken };
}

export async function importDelisted(ctx: JobContext, candidates: readonly DelistedCandidate[], limit?: number): Promise<JobResult> {
  const token = requireToken(ctx);
  const { todo: open, taken } = delistedTodo(ctx, candidates);
  const wanted = limit === undefined ? open : open.slice(0, limit);
  const { items: todo, capped } = await capToBudget(ctx, wanted, CALLS_PER_DELISTED);
  ctx.log(
    `${todo.length} Titel zu laden (${open.length} offen, ${taken} Symbole belegt) mit rund ${todo.length * CALLS_PER_DELISTED} Abrufen`,
  );
  const skip = noReports(ctx);
  let empty = 0;
  let mismatched = 0;
  const result = await eachParallel(
    ctx,
    todo,
    PARALLEL,
    async (c) => {
      const { db } = ctx;
      if (!db.stock(c.id)) {
        const raw = await fetchEodhdFundamentalsRaw(c.id, token, ctx.fetchFn);
        // Ist das Kürzel inzwischen neu vergeben, gehören die Abschlüsse einem anderen Unternehmen als die Kurse der Datei.
        const answered = parseEodhdFundamentals(JSON.parse(raw)).name;
        if (answered !== null && firstWord(answered) !== firstWord(c.name)) {
          mismatched++;
          skip.add(c.id);
          db.setSetting(NO_REPORTS_KEY, JSON.stringify([...skip]));
          ctx.log(`fremd  ${c.id.padEnd(10)} Name weicht ab: Datei „${c.name}“, Anbieter „${answered}“`);
          return;
        }
        try {
          // Die Rohantwort (rund 700 KB) bleibt nicht liegen: bei tausenden Titeln wäre das mehrere GB.
          ingestFundamentals(db, c.id, raw, { keepRaw: false, delistedOn: c.lastDate });
        } catch (error) {
          if (!(error instanceof NoAnnualReportsError)) throw error;
          empty++;
          skip.add(c.id);
          db.setSetting(NO_REPORTS_KEY, JSON.stringify([...skip]));
          return;
        }
      }
      if (!db.stockIdsWithHistory("monthly_prices").has(c.id)) db.saveMonthlyPrices(c.id, c.bars);
      if (!db.stockIdsWithHistory("dividends").has(c.id)) db.saveDividends(c.id, await fetchDividends(c.id, token, ctx.fetchFn));
      if (!db.stockIdsWithHistory("splits").has(c.id)) db.saveSplits(c.id, await fetchSplits(c.id, token, ctx.fetchFn));
    },
    (c) => c.id,
  );
  const rest = result.limitReached || result.stopped || capped ? ", Rest offen" : "";
  return {
    summary: `${result.done - empty - mismatched} eingestellte Titel geladen, ${empty} ohne Abschlüsse, ${mismatched} mit abweichendem Namen, ${result.failed} fehlgeschlagen${rest}`,
    ok: result.failed === 0 && !result.limitReached && !result.stopped && !capped,
  };
}
