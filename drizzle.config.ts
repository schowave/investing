// drizzle-kit: erzeugt aus src/data/schema.ts die Migrationen in db/migrations (`mise run db:generate <name>`).
// Angewendet werden sie von der App selbst beim Öffnen der Datenbank (src/data/migrate.ts).
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/data/schema.ts",
  out: "./db/migrations",
});
