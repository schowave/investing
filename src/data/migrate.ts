// Wendet offene Migrationen aus db/migrations an (erzeugt von drizzle-kit aus schema.ts).
// Buchführung in __drizzle_migrations. Neue Migration: Schema ändern, dann `mise run db:generate <name>`.

import { join } from "node:path";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

/** Standardordner: db/migrations im Arbeitsverzeichnis, abweichend über INVESTING_MIGRATIONS. */
function migrationsDir(): string {
  // turbopackIgnore: die SQL-Dateien werden zur Laufzeit gelesen, nicht gebündelt; ohne den Hinweis
  // nähme Turbopack das ganze Projekt in die Server-Ausgabe auf.
  return process.env.INVESTING_MIGRATIONS ?? join(/*turbopackIgnore: true*/ process.cwd(), "db", "migrations");
}

export function migrateDatabase<S extends Record<string, unknown>>(db: NodeSQLiteDatabase<S>, migrationsFolder = migrationsDir()): void {
  try {
    migrate(db, { migrationsFolder });
  } catch (error) {
    // Öffnen Oberfläche und Abgleich die Datenbank gleichzeitig, wenden womöglich beide dieselbe Migration an;
    // der zweite scheitert dann an der schon angelegten Tabelle. Beim zweiten Versuch ist nichts mehr offen.
    // Ein echter Fehler tritt erneut auf und wird gemeldet.
    try {
      migrate(db, { migrationsFolder });
    } catch {
      throw error;
    }
  }
}
