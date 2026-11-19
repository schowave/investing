// Rotierende Sicherungen der Datenbank: eine Datei je Tag, die jüngsten `keep` bleiben.

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "./db.ts";

const NAME = /^investing-(\d{4}-\d{2}-\d{2})\.sqlite$/;

/** Sichert die Datenbank als `investing-<date>.sqlite` in `dir` und löscht ältere über `keep` hinaus. Liefert den Pfad. */
export function rotateBackup(db: Database, dir: string, date: string, keep = 7): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Sicherung: ungültiges Datum ${date}`);
  if (keep < 1) throw new Error("Sicherung: mindestens eine muss bleiben");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `investing-${date}.sqlite`);
  // VACUUM INTO schreibt nicht über eine vorhandene Datei; ein zweiter Lauf am selben Tag ersetzt die Sicherung.
  if (existsSync(path)) rmSync(path);
  db.backupTo(path);
  const backups = readdirSync(dir)
    .filter((f) => NAME.test(f))
    .sort()
    .reverse();
  for (const old of backups.slice(keep)) rmSync(join(dir, old));
  return path;
}
