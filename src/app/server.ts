// Datenbankzugriff der Oberfläche. Nur auf dem Server verwenden.

import { cache } from "react";
import { Database } from "../data/db.ts";
import { type Ranking, rankWatchlist } from "../valuation/ranking.ts";

const holder = globalThis as { investingDb?: Database };

/**
 * Eine Verbindung je Serverprozess. Im Entwicklungsmodus lädt Next.js geänderten Code neu; eine Verbindung aus
 * dem alten Code kennt neue Methoden und Tabellen nicht und wird dann ersetzt.
 */
export function database(): Database {
  if (!(holder.investingDb instanceof Database)) {
    try {
      (holder.investingDb as { close?: () => void } | undefined)?.close?.();
    } catch {
      // Die alte Verbindung war schon geschlossen.
    }
    holder.investingDb = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
  }
  return holder.investingDb;
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Rangliste der Watchlist, einmal je Anfrage gerechnet: Layout (Zähler) und Seite teilen sie sich. */
export const watchlistRanking: () => Ranking = cache(() => rankWatchlist(database(), today()));
