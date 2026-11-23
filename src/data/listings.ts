// Zuordnung von Positionen einer Bestandsquelle (comdirect, wikifolio) zu den Notizen der Datenbank über die ISIN.

import type { Database } from "./db.ts";
import { isinOf } from "./eodhdFundamentals.ts";
import { FUNDAMENTALS_KIND } from "./eodhdSnapshot.ts";

/** Notiz in der Datenbank, die zu einer ISIN passt. */
export interface Listing {
  id: string;
  watched: boolean;
  /** Stammaktie laut Anbieter (kein CEDEAR, keine Vorzugsaktie); unbekannt zählt als ja. */
  common: boolean;
  /** Es gibt einen Kurs. */
  priced: boolean;
}

/**
 * Mehrere Notizen derselben ISIN: die auf der Watchlist, dann die schon gehaltene, dann eine Stammaktie (kein CEDEAR mit
 * eigenem Bezugsverhältnis), dann eine mit Kurs, zuletzt die erste nach Symbol.
 */
export function pickListing(listings: readonly Listing[], held: ReadonlyMap<string, number>): string {
  const rank = (l: Listing) => [Number(l.watched), Number(held.has(l.id)), Number(l.common), Number(l.priced)];
  const sorted = [...listings].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    const diff = ra.map((value, i) => rb[i]! - value).find((d) => d !== 0);
    return diff ?? a.id.localeCompare(b.id);
  });
  return sorted[0]!.id;
}

/** Notizen je ISIN mit allem, was `pickListing` braucht. Unbekannte ISINs fehlen in der Antwort. */
export function listingsFor(db: Database, isins: readonly string[]): Map<string, Listing[]> {
  const ids = db.stockIdsByIsin(isins);
  return new Map(
    [...ids].map(([isin, list]) => [
      isin,
      list.map((id) => {
        const stock = db.stock(id);
        const type = stock?.securityType ?? null;
        return {
          id,
          watched: stock?.watched ?? false,
          common: type === null || type === "Common Stock",
          priced: db.latestPrice(id) !== null,
        };
      }),
    ]),
  );
}

/**
 * Trägt die ISIN gehaltener und beobachteter Aktien aus der gespeicherten Antwort des Anbieters nach. Ältere Einträge
 * haben noch keine; ohne sie fände ein Abgleich die eigenen Positionen nicht und würde sie als weggefallen werten.
 * @returns Zahl der ergänzten ISINs.
 */
export function backfillIsins(db: Database, ids: readonly string[]): number {
  let added = 0;
  for (const id of db.stockIdsWithoutIsin(ids)) {
    const raw = db.rawDocument(id, FUNDAMENTALS_KIND);
    if (!raw) continue;
    try {
      const general = (JSON.parse(raw.body) as { General?: { ISIN?: unknown } }).General;
      const isin = isinOf(typeof general?.ISIN === "string" ? general.ISIN : null);
      if (isin) {
        db.setIsin(id, isin);
        added++;
      }
    } catch {
      // Kaputte Rohantwort: Die Aktie bleibt ohne ISIN; die Suche bei EODHD oder das nächste Auffrischen kann sie noch zuordnen.
    }
  }
  return added;
}
