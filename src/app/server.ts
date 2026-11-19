// Datenbankzugriff der Oberfläche. Nur auf dem Server verwenden.

import { Database } from "../data/db.ts";

const holder = globalThis as { investingDb?: Database };

/**
 * Eine Verbindung je Serverprozess. Im Entwicklungsmodus lädt Next.js geänderten Code neu; eine Verbindung aus
 * dem alten Code kennt neue Methoden und Tabellen nicht und wird dann ersetzt.
 */
export function database(): Database {
  if (!(holder.investingDb instanceof Database)) {
    try {
      holder.investingDb?.close();
    } catch {
      // Die alte Verbindung war schon geschlossen.
    }
    holder.investingDb = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
  }
  return holder.investingDb;
}

export const today = () => new Date().toISOString().slice(0, 10);
