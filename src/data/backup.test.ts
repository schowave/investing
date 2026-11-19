import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stock } from "../test/fixtures.ts";
import { rotateBackup } from "./backup.ts";
import { Database } from "./db.ts";

let dir = "";
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("Sicherung", () => {
  it("schreibt eine vollständige Kopie und behält nur die jüngsten", () => {
    dir = mkdtempSync(join(tmpdir(), "investing-backup-"));
    for (const day of ["01", "02", "03", "04"]) writeFileSync(join(dir, `investing-2026-11-${day}.sqlite`), "");
    writeFileSync(join(dir, "notiz.txt"), "bleibt");

    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    const path = rotateBackup(db, dir, "2026-11-05", 3);
    // Zweiter Lauf am selben Tag ersetzt die Sicherung, statt zu scheitern.
    rotateBackup(db, dir, "2026-11-05", 3);
    db.close();

    expect(path).toBe(join(dir, "investing-2026-11-05.sqlite"));
    expect(readdirSync(dir).sort()).toEqual([
      "investing-2026-11-03.sqlite",
      "investing-2026-11-04.sqlite",
      "investing-2026-11-05.sqlite",
      "notiz.txt",
    ]);
    const copy = new Database(path);
    expect(copy.stock(stock.id)?.name).toBe(stock.name);
    copy.close();
  });

  it("lehnt ein ungültiges Datum und keep unter 1 ab", () => {
    const db = new Database(":memory:");
    expect(() => rotateBackup(db, "unbenutzt", "heute")).toThrow(/Datum/);
    expect(() => rotateBackup(db, "unbenutzt", "2026-11-05", 0)).toThrow(/mindestens/);
    db.close();
  });
});
