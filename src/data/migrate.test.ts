import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { Database, FUNDAMENTAL_FIELDS, toColumn } from "./db.ts";

const dirs: string[] = [];
const scratch = () => {
  const dir = mkdtempSync(join(tmpdir(), "investing-migrate-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  delete process.env.INVESTING_MIGRATIONS;
});

const names = (client: DatabaseSync, type: "table" | "index") =>
  (client.prepare("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name").all(type) as { name: string }[]).map((r) => r.name);
const columns = (client: DatabaseSync, table: string) =>
  client.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[];
const migrationFolders = readdirSync(join(process.cwd(), "db", "migrations"));

describe("Migrationen", () => {
  it("legen eine neue Datenbank vollständig an und laufen nur einmal", () => {
    const path = join(scratch(), "neu.sqlite");
    new Database(path).close();
    new Database(path).close();
    const client = new DatabaseSync(path);
    expect(client.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual({ n: migrationFolders.length });
    expect(names(client, "table")).toEqual(expect.arrayContaining(["stocks", "prices", "fundamentals", "raw_documents", "screening"]));
    expect(names(client, "index")).toEqual(
      expect.arrayContaining(["fx_rates_currency_date", "screening_inner_return", "history_loaded_kind", "raw_documents_kind"]),
    );
    expect(columns(client, "fundamentals").map((c) => c.name)).toEqual(expect.arrayContaining(FUNDAMENTAL_FIELDS.map(toColumn)));
    client.close();
  });

  it("übernehmen eine Datenbank aus der Zeit vor Drizzle ohne Datenverlust", () => {
    const path = join(scratch(), "alt.sqlite");
    const legacy = new DatabaseSync(path);
    // Aufbau wie vor den Migrationen: Spalten per ALTER nachgerüstet, Rohantworten gepackt in einer TEXT-Spalte,
    // dazu die Buchführung von dbmate.
    legacy.exec(`
      CREATE TABLE stocks (id TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL, region TEXT NOT NULL,
        country TEXT NOT NULL, reporting_currency TEXT NOT NULL, price_currency TEXT NOT NULL,
        price_divisor REAL NOT NULL DEFAULT 1, founded_year INTEGER, is_financial INTEGER NOT NULL DEFAULT 0);
      ALTER TABLE stocks ADD COLUMN watched INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE stocks ADD COLUMN security_type TEXT;
      CREATE TABLE raw_documents (stock_id TEXT NOT NULL REFERENCES stocks(id), kind TEXT NOT NULL,
        fetched_at TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY (stock_id, kind));
      CREATE TABLE schema_migrations (version VARCHAR(128) PRIMARY KEY);
      INSERT INTO stocks VALUES ('IMB.LSE', 'Imperial Brands', 'Tabak', 'Europa', 'GB', 'GBP', 'GBP', 100, 1901, 0, 1, 'Common Stock');
    `);
    legacy.prepare("INSERT INTO raw_documents VALUES ('IMB.LSE', 'eodhd-fundamentals', '2026-11-01', ?)").run(gzipSync('{"General":{}}'));
    legacy.close();

    const db = new Database(path);
    expect(db.stock("IMB.LSE")).toMatchObject({ name: "Imperial Brands", priceDivisor: 100, foundedYear: 1901, watched: true });
    expect(db.rawDocument("IMB.LSE", "eodhd-fundamentals")?.body).toBe('{"General":{}}');
    db.close();

    const client = new DatabaseSync(path);
    expect(names(client, "table")).not.toContain("schema_migrations");
    expect(
      columns(client, "raw_documents")
        .find((c) => c.name === "body")
        ?.type.toLowerCase(),
    ).toBe("blob");
    client.close();
  });

  it("melden eine fehlerhafte Migration und lassen die Datenbank unverändert", () => {
    const folder = scratch();
    mkdirSync(join(folder, "20260101000000_kaputt"));
    writeFileSync(
      join(folder, "20260101000000_kaputt", "migration.sql"),
      "CREATE TABLE a (x);\n--> statement-breakpoint\nINSERT INTO fehlt VALUES (1);",
    );
    process.env.INVESTING_MIGRATIONS = folder;
    const path = join(scratch(), "kaputt.sqlite");
    expect(() => new Database(path)).toThrow(/fehlt/);
    const client = new DatabaseSync(path);
    expect(names(client, "table")).not.toContain("a");
    client.close();
  });
});
