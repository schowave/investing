// Abgleich der eigenen Wikifolios (Bestandsquelle wikifolio): Bargeld und Stückzahlen übernehmen, Positionen über die ISIN
// zuordnen, das Anlageuniversum höchstens einmal je Woche laden (Strategie 7.1, Spezifikation 4).

import type { Portfolio, UnmatchedPosition } from "../data/db.ts";
import { backfillIsins, type Listing, listingsFor, pickListing } from "../data/listings.ts";
import { type WikifolioCredentials, type WikifolioPosition, WikifolioSession } from "../data/wikifolio.ts";
import { type JobContext, type JobResult, reason } from "./context.ts";

/** So alt darf das gespeicherte Anlageuniversum werden, bevor der Abgleich es neu lädt (kostet Hunderte Abrufe). */
export const UNIVERSE_MAX_AGE_DAYS = 7;

export interface MatchedPositions {
  /** Stückzahlen je Aktie. */
  holdings: Map<string, number>;
  unmatched: UnmatchedPosition[];
}

/**
 * Ordnet die Positionen eines Wikifolios den Aktien der Datenbank zu; bei mehreren Notizen einer ISIN wie bei der comdirect
 * (`pickListing`). Ohne passende Aktie bleibt die Position nicht zugeordnet und zählt mit ihrem Einstandswert zu den
 * sonstigen Anlagen.
 */
export function matchPositions(
  positions: readonly WikifolioPosition[],
  listings: ReadonlyMap<string, readonly Listing[]>,
  held: ReadonlyMap<string, number>,
): MatchedPositions {
  const holdings = new Map<string, number>();
  const unmatched = new Map<string, UnmatchedPosition>();
  for (const position of positions) {
    if (!(position.quantity > 0)) continue;
    const found = listings.get(position.isin);
    if (found?.length) {
      const id = pickListing(found, held);
      holdings.set(id, (holdings.get(id) ?? 0) + position.quantity);
      continue;
    }
    const value = position.averagePurchasePrice === null ? null : position.averagePurchasePrice * position.quantity;
    const known = unmatched.get(position.isin);
    unmatched.set(position.isin, {
      isin: position.isin,
      quantity: (known?.quantity ?? 0) + position.quantity,
      valueEur: known && known.valueEur === null ? null : value === null ? null : (known?.valueEur ?? 0) + value,
    });
  }
  return { holdings, unmatched: [...unmatched.values()] };
}

const ageInDays = (from: string, now: Date) => (now.getTime() - Date.parse(from)) / 86_400_000;

export interface WikifolioSyncOptions {
  credentials: WikifolioCredentials | null;
  now: Date;
  /** Nur dieses Portfolio (Knopf auf der Portfolioseite); sonst alle mit Bestandsquelle wikifolio. */
  portfolioId?: number;
  /** Anlageuniversum unabhängig vom Alter neu laden. */
  reloadUniverse?: boolean;
}

/** Gleicht alle (oder ein) Portfolio mit Bestandsquelle wikifolio ab. Ein Fehler bei einem Wikifolio hält die anderen nicht auf. */
export async function syncWikifolios(ctx: JobContext, options: WikifolioSyncOptions): Promise<JobResult> {
  const portfolios = ctx.db
    .portfolios()
    .filter((p): p is Portfolio & { wikifolio: string } => p.wikifolio !== null)
    .filter((p) => options.portfolioId === undefined || p.id === options.portfolioId);
  if (portfolios.length === 0) return { summary: "kein Portfolio mit Bestandsquelle wikifolio", ok: true };
  if (!options.credentials) {
    ctx.log("WIKIFOLIO_CLIENT_API_KEY oder WIKIFOLIO_USER_API_KEY fehlt; die Wikifolios behalten ihren letzten Stand.");
    return { summary: "wikifolio übersprungen, Schlüssel fehlen", ok: true };
  }

  const added = backfillIsins(ctx.db, [...ctx.db.stocks().map((s) => s.id), ...ctx.db.heldStockIds()]);
  if (added > 0) ctx.log(`ISIN aus gespeicherten Abschlüssen ergänzt: ${added} Titel`);

  const session = await WikifolioSession.open(options.credentials, ctx.fetchFn);
  let failed = 0;
  const done: string[] = [];
  try {
    for (const portfolio of portfolios) {
      try {
        const snapshot = await session.wikifolio(portfolio.wikifolio);
        if (snapshot.baseCurrency !== "EUR") throw new Error(`Basiswährung ${snapshot.baseCurrency}, erwartet EUR`);
        const listings = listingsFor(ctx.db, [...new Set(snapshot.positions.map((p) => p.isin))]);
        const { holdings, unmatched } = matchPositions(snapshot.positions, listings, ctx.db.holdings(portfolio.id));
        ctx.db.replaceWithWikifolio(portfolio.id, {
          cashEur: snapshot.cash,
          holdings,
          unmatched,
          syncedAt: options.now.toISOString(),
        });
        ctx.log(
          `ok     ${portfolio.wikifolio.padEnd(12)} ${snapshot.status}, bar ${snapshot.cash.toFixed(2)} €, ${holdings.size} Positionen${
            unmatched.length ? `, nicht zugeordnet: ${unmatched.map((u) => u.isin).join(", ")}` : ""
          }`,
        );

        const tradable = ctx.db.tradable(portfolio.id);
        if (options.reloadUniverse || !tradable || ageInDays(tradable.loadedAt, options.now) >= UNIVERSE_MAX_AGE_DAYS) {
          const isins = await session.underlyings(portfolio.wikifolio);
          const byIsin = ctx.db.stocksByIsin();
          const stockIds = [...isins].flatMap((isin) => (byIsin.get(isin) ?? []).map((s) => s.id));
          ctx.db.setTradable(portfolio.id, stockIds, options.now.toISOString(), isins.size);
          ctx.log(
            `ok     ${portfolio.wikifolio.padEnd(12)} Anlageuniversum: ${isins.size} ISINs, davon ${stockIds.length} Notizen bekannt`,
          );
        }
        done.push(portfolio.name);
      } catch (error) {
        failed++;
        ctx.log(`fehlt  ${portfolio.wikifolio.padEnd(12)} ${reason(error)}`);
      }
    }
  } finally {
    await session.close();
  }
  return {
    summary: `${done.length} von ${portfolios.length} Wikifolios abgeglichen${failed ? `, ${failed} fehlgeschlagen` : ""}`,
    ok: failed === 0,
  };
}
