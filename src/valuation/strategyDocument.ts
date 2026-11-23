// Lesen von `docs/STRATEGIE.md`: Version im Kopf und Tabellen. Das Dokument ist für Regeln und Werte maßgeblich; der Test
// daneben vergleicht seine Tabellen mit den Konstanten des Rechenmoduls, die Seite „Strategie“ zeigt Version und Datum.
// Reine Textverarbeitung ohne Datei- und Netzzugriff.

export interface StrategyHead {
  /** z. B. "1.0" */
  version: string;
  /** ISO-Datum der Fassung, z. B. "2026-11-22". */
  date: string;
}

/** Version und Datum aus der Kopfzeile `**Version 1.0** vom 22.11.2026`; `null`, wenn sie fehlt. */
export function strategyHead(markdown: string): StrategyHead | null {
  const match = /^\*\*Version (\d+\.\d+)\*\* vom (\d{2})\.(\d{2})\.(\d{4})\s*$/m.exec(markdown);
  return match ? { version: match[1]!, date: `${match[4]}-${match[3]}-${match[2]}` } : null;
}

export interface MarkdownTable {
  /** Überschrift (`##`, `###`) des Abschnitts, in dem die Tabelle steht, z. B. "10.1 Parametertabelle". */
  section: string;
  header: string[];
  rows: string[][];
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Alle Tabellen im Markdown, in der Reihenfolge des Dokuments. Codeblöcke werden übersprungen. */
export function markdownTables(markdown: string): MarkdownTable[] {
  const tables: MarkdownTable[] = [];
  const lines = markdown.split(/\r?\n/);
  let section = "";
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("```")) inCode = !inCode;
    if (inCode) continue;
    const heading = /^#{2,3} (.+)$/.exec(line);
    if (heading) section = heading[1]!.trim();
    const next = lines[i + 1];
    if (!line.trim().startsWith("|") || next === undefined || !/^\s*\|[\s:|-]+\|\s*$/.test(next)) continue;
    const table: MarkdownTable = { section, header: cells(line), rows: [] };
    i += 2;
    while (i < lines.length && lines[i]!.trim().startsWith("|")) table.rows.push(cells(lines[i++]!));
    i--;
    tables.push(table);
  }
  return tables;
}

/** Einheiten, die ein Wert tragen kann: Muster, Name der Einheit, Faktor. Ein Wert ohne Einheit hat die Einheit "". */
const UNITS: readonly [RegExp, string, number][] = [
  [/^%/, "%", 0.01],
  [/^Prozentpunkte?\b/, "Prozentpunkte", 0.01],
  [/^Mrd\. €/, "Mrd. €", 1e9],
  [/^Mio\. €/, "Mio. €", 1e6],
  [/^-fach\b/, "-fach", 1],
  [/^Jahre?\b/, "Jahre", 1],
  [/^Monate?\b/, "Monate", 1],
  [/^Tage?\b/, "Tage", 1],
  [/^Läufe?\b/, "Läufe", 1],
];

export interface ParsedValue {
  /** Zahl in Grundeinheit (Anteile statt Prozent); `null` für „keine Grenze“ und „–“. */
  value: number | null;
  /** Einheit, z. B. "%", "Jahre", "-fach"; "" ohne Einheit. */
  unit: string;
}

/**
 * Zahl und Einheit aus einer Tabellenzelle in deutscher Schreibweise: „8,5 %“ wird 0.085 mit "%", „−5 %“ −0.05,
 * „1 Prozentpunkt“ 0.01 mit "Prozentpunkte", „20 Mrd. €“ 2e10, „3-fach“ 3 mit "-fach", „10 Jahre“ 10 mit "Jahre".
 * „keine Grenze“ und „–“ sind `null`. Eine unbekannte Einheit und Text ohne Zahl werfen.
 */
export function parseValue(text: string): ParsedValue {
  const cleaned = text.replace(/`/g, "").trim();
  if (cleaned === "–" || cleaned === "-" || /^keine Grenze$/i.test(cleaned)) return { value: null, unit: "" };
  const match = /^(?:höchstens\s+)?([−-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(.*)$/.exec(cleaned);
  if (!match) throw new Error(`Keine Zahl: „${text}“`);
  const [, sign, whole, fraction, rest] = match;
  const value = Number(`${whole!.replace(/\./g, "")}.${fraction ?? "0"}`) * (sign ? -1 : 1);
  // Erläuterungen in Klammern („(Bonus)“) gehören nicht zur Einheit.
  const unit = rest!.replace(/\(.*\)/, "").trim();
  if (unit === "") return { value, unit: "" };
  for (const [pattern, name, factor] of UNITS) if (pattern.test(unit)) return { value: value * factor, unit: name };
  throw new Error(`Unbekannte Einheit in „${text}“`);
}

/** Das Markdown ohne die Kopfzeile mit Version und Datum (die Seite zeigt sie in der Titelzeile). */
export function withoutHead(markdown: string): string {
  return markdown.replace(/^\*\*Version \d+\.\d+\*\* vom \d{2}\.\d{2}\.\d{4}\s*\n/m, "");
}

/**
 * Fließtext eines Abschnitts (`## 1.` bis zur nächsten Überschrift derselben Ebene), ohne Tabellen und Codeblöcke. `number` ist
 * die Abschnittsnummer wie „1“ oder „6.2“.
 */
export function prose(markdown: string, number: string): string {
  const level = number.includes(".") ? "###" : "##";
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${level} ${number}${number.includes(".") ? " " : "."}`));
  if (start < 0) throw new Error(`Abschnitt ${number} fehlt`);
  const result: string[] = [];
  let inCode = false;
  for (const line of lines.slice(start + 1)) {
    if (!inCode && (line.startsWith("## ") || (level === "###" && line.startsWith("### ")))) break;
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || line.trim().startsWith("|")) continue;
    result.push(line);
  }
  return result.join("\n");
}

/** Schlüssel und Wert je Zeile einer Tabelle mit den Spalten „Schlüssel“ und „Wert“. */
export function keyedValues(table: MarkdownTable): Map<string, string> {
  const key = table.header.indexOf("Schlüssel");
  const value = table.header.indexOf("Wert");
  if (key < 0 || value < 0) throw new Error(`Tabelle in „${table.section}“ hat keine Spalten Schlüssel und Wert`);
  const result = new Map<string, string>();
  for (const row of table.rows) {
    const name = row[key]!.replace(/`/g, "").trim();
    if (result.has(name)) throw new Error(`Schlüssel doppelt: ${name}`);
    result.set(name, row[value]!);
  }
  return result;
}
