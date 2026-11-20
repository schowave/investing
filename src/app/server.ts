// Datenbankzugriff der Oberfläche. Nur auf dem Server verwenden.

import { join } from "node:path";
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
    // turbopackIgnore: Ohne den Hinweis verfolgt Turbopack die Datei als Abhängigkeit. Jeder Lesezugriff ändert die
    // WAL-Dateien daneben, und der Entwicklungsserver lädt die Seite dann endlos neu.
    holder.investingDb = new Database(
      process.env.INVESTING_DB ?? join(/*turbopackIgnore: true*/ process.cwd(), "data", "investing.sqlite"),
    );
  }
  return holder.investingDb;
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Rangliste der Watchlist, einmal je Anfrage gerechnet: Layout (Zähler) und Seite teilen sie sich. */
export const watchlistRanking: () => Ranking = cache(() => rankWatchlist(database(), today()));
