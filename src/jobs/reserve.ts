// Große Läufe lassen dem nächtlichen Abgleich genug Abrufe übrig. Es läuft immer nur ein Lauf; ein Import über
// Mitternacht würde sonst das frische Tageskontingent aufbrauchen, während der Abgleich in der Warteschlange wartet.

import { fetchAccount } from "../data/eodhd.ts";
import type { JobContext } from "./context.ts";

/** Abrufe, die große Läufe für den nächtlichen Abgleich übrig lassen (Kurse aller Titel, Nachzügler). */
export const SYNC_RESERVE = 3000;

/**
 * Kürzt die Liste auf das, was heute ins Budget passt, abzüglich der Reserve. Ist das Konto nicht erreichbar,
 * bleibt die Liste ganz; dann hält wie bisher das Tageslimit des Anbieters den Lauf an.
 */
export async function capToBudget<T>(ctx: JobContext, items: T[], callsPerItem: number): Promise<{ items: T[]; capped: boolean }> {
  if (!ctx.token || items.length === 0) return { items, capped: false };
  let free: number;
  try {
    const account = await fetchAccount(ctx.token, ctx.fetchFn);
    free = account.dailyRateLimit - account.requestsToday - SYNC_RESERVE;
  } catch {
    return { items, capped: false };
  }
  const fits = Math.max(0, Math.floor(free / callsPerItem));
  if (fits >= items.length) return { items, capped: false };
  ctx.log(
    `Budget reicht heute für ${fits} von ${items.length}; ${SYNC_RESERVE} Abrufe bleiben für den nächtlichen Abgleich. Ein neuer Start setzt fort.`,
  );
  return { items: items.slice(0, fits), capped: true };
}
