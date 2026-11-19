// Datenbankzugriff der Oberfläche. Nur auf dem Server verwenden.

import { Database } from "../data/db.ts";

const holder = globalThis as { investingDb?: Database };

/** Eine Verbindung je Serverprozess; bleibt auch beim Neuladen im Entwicklungsmodus erhalten. */
export function database(): Database {
  holder.investingDb ??= new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
  return holder.investingDb;
}

export const today = () => new Date().toISOString().slice(0, 10);
