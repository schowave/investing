// Ein Abruf bei der comdirect als Vorgang in Schritten (Spezifikation 6.1): PIN → Sitzungs-TAN → Depot → Vorschau →
// Übernahme. Der Vorgang lebt nur im Speicher des Serverprozesses, mit den Tokens der Bank; die PIN nie.

import { randomUUID } from "node:crypto";
import type { Depot, DepotStand, SessionChallenge } from "./api.ts";
import type { Preview } from "./bestand.ts";

/** Nach dieser Zeit verfällt ein Vorgang, auch wenn die Tokens der Bank noch gelten würden. */
export const VORGANG_MINUTES = 15;

export type Step =
  | { step: "tan"; challenge: SessionChallenge }
  /** TAN freigegeben, aber Depots oder Bestand ließen sich nicht laden; ein neuer Versuch braucht keine TAN. */
  | { step: "freigegeben" }
  | { step: "depot"; depots: Depot[] }
  | { step: "vorschau"; depot: Depot; depots: Depot[]; stand: DepotStand; preview: Preview };

export interface Vorgang {
  id: string;
  portfolioId: number;
  createdAt: number;
  /** Geheimnisse der Sitzung: nie in die Oberfläche, nie ins Protokoll. */
  secret: unknown;
  state: Step;
  /** Ein Schritt läuft gerade; ein zweiter Klick (Neuladen, zweiter Tab) darf ihn nicht doppelt ausführen. */
  busy: boolean;
  /** Beendet die Sitzung bei der Bank; läuft, wenn der Vorgang verfällt, ersetzt oder geschlossen wird. */
  dispose: () => void;
}

const holder = globalThis as { comdirectVorgaenge?: Map<string, Vorgang> };
const store = () => {
  holder.comdirectVorgaenge ??= new Map();
  return holder.comdirectVorgaenge;
};

function drop(vorgang: Vorgang): void {
  store().delete(vorgang.id);
  vorgang.dispose();
}

function sweep(now: number): void {
  for (const vorgang of [...store().values()]) if (now - vorgang.createdAt > VORGANG_MINUTES * 60_000) drop(vorgang);
}

export function openVorgang(portfolioId: number, secret: unknown, state: Step, dispose: () => void, now = Date.now()): Vorgang {
  sweep(now);
  // Je Portfolio nur ein Vorgang: Ein neuer Abruf ersetzt einen liegengebliebenen.
  for (const vorgang of [...store().values()]) if (vorgang.portfolioId === portfolioId) drop(vorgang);
  const vorgang: Vorgang = { id: randomUUID(), portfolioId, createdAt: now, secret, state, busy: false, dispose };
  store().set(vorgang.id, vorgang);
  return vorgang;
}

/** Der Vorgang, wenn er zum Portfolio gehört und nicht verfallen ist. */
export function findVorgang(id: string, portfolioId: number, now = Date.now()): Vorgang | null {
  sweep(now);
  const vorgang = store().get(id);
  return vorgang && vorgang.portfolioId === portfolioId ? vorgang : null;
}

/** Schließt den Vorgang und beendet die Sitzung bei der Bank. */
export function closeVorgang(vorgang: Vorgang): void {
  if (store().get(vorgang.id) === vorgang) drop(vorgang);
}
