// Dokumente aus `docs/`, die die Oberfläche zeigt. Im Image liegen sie unter /app/docs (siehe Dockerfile).

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Die Strategie und ihr Änderungsprotokoll; andere Dateien aus `docs/` zeigt die Oberfläche nicht. */
export type DocumentName = "STRATEGIE.md" | "STRATEGIE-AENDERUNGEN.md";

export function readDocument(name: DocumentName, root: string = process.cwd()): string {
  return readFileSync(join(root, "docs", name), "utf8");
}
