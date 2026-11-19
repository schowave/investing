// Sichert die Datenbank nach data/backups (eine Datei je Tag, die letzten 7 bleiben). Aufruf: pnpm run backup

import { rotateBackup } from "../src/data/backup.ts";
import { Database } from "../src/data/db.ts";

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const path = rotateBackup(db, process.env.INVESTING_BACKUPS ?? "data/backups", new Date().toISOString().slice(0, 10));
db.close();
console.log(`Gesichert: ${path}`);
