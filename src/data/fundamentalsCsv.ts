// CSV-Import für Fundamentaldaten: eine Zeile je Geschäftsjahr.
// Kopfzeile: fiscal_year und beliebige Spalten aus FUNDAMENTAL_FIELDS in snake_case.
// Trennzeichen Komma (Dezimalpunkt) oder Semikolon (Dezimalkomma, wie Excel auf Deutsch).

import { FUNDAMENTAL_FIELDS, toColumn, type FundamentalField, type FundamentalsYear } from "./db.ts";

const FIELD_BY_COLUMN = new Map<string, FundamentalField>(FUNDAMENTAL_FIELDS.map((f) => [toColumn(f), f]));

export const CSV_HEADER = ["fiscal_year", ...FUNDAMENTAL_FIELDS.map(toColumn)].join(",");

export function parseFundamentalsCsv(text: string): FundamentalsYear[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("#"));
  const header = lines.shift();
  if (!header) throw new Error("CSV ist leer");
  const semicolon = header.includes(";");
  const split = (line: string) => line.split(semicolon ? ";" : ",").map((cell) => cell.trim());
  const columns = split(header);
  if (!columns.includes("fiscal_year")) throw new Error("Spalte fiscal_year fehlt");
  for (const column of columns) {
    if (column !== "fiscal_year" && !FIELD_BY_COLUMN.has(column)) throw new Error(`Unbekannte Spalte: ${column}`);
  }

  const parseNumber = (cell: string, where: string): number | null => {
    if (cell === "") return null;
    const normalized = semicolon ? cell.replace(/\./g, "").replace(",", ".") : cell;
    const value = Number(normalized);
    if (!Number.isFinite(value)) throw new Error(`${where}: "${cell}" ist keine Zahl`);
    return value;
  };

  const seen = new Set<number>();
  return lines.map((line, index) => {
    const cells = split(line);
    const where = `Zeile ${index + 2}`;
    if (cells.length !== columns.length) throw new Error(`${where}: ${cells.length} statt ${columns.length} Spalten`);
    const year = { fiscalYear: NaN, ...Object.fromEntries(FUNDAMENTAL_FIELDS.map((f) => [f, null])) } as FundamentalsYear;
    columns.forEach((column, i) => {
      const value = parseNumber(cells[i]!, `${where}, ${column}`);
      if (column === "fiscal_year") {
        if (value === null || !Number.isInteger(value)) throw new Error(`${where}: fiscal_year fehlt oder ist keine Jahreszahl`);
        year.fiscalYear = value;
      } else {
        year[FIELD_BY_COLUMN.get(column)!] = value;
      }
    });
    if (seen.has(year.fiscalYear)) throw new Error(`${where}: Geschäftsjahr ${year.fiscalYear} doppelt`);
    seen.add(year.fiscalYear);
    return year;
  });
}
