// Monate als "JJJJ-MM"; der Rückblick rechnet in Monatsschlüssen.

export function shiftMonth(month: string, delta: number): string {
  const [year, mo] = month.split("-").map(Number) as [number, number];
  const total = year * 12 + (mo - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Alle Monate von `start` bis `end`, beide eingeschlossen. */
export function monthRange(start: string, end: string): string[] {
  const months: string[] = [];
  for (let m = start; m <= end; m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/** Letzter Kalendertag des Monats; für den letzten Monat der Reihe gilt der Tag des jüngsten Kurses (`lastDate`). */
export function monthEnd(month: string, last?: { month: string; date: string }): string {
  if (last && month === last.month) return last.date;
  const [year, mo] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, mo, 0)).toISOString().slice(0, 10);
}

/**
 * Letztes Geschäftsjahr, dessen Abschluss an einem Stichtag als bekannt gilt: ab Juni gilt das Vorjahr, davor das Vorvorjahr.
 * Die Datenbank kennt kein Veröffentlichungsdatum; die Regel ist bewusst vorsichtig.
 */
export function lastKnownFiscalYear(month: string): number {
  const year = Number(month.slice(0, 4));
  return year - (Number(month.slice(5)) >= 6 ? 1 : 2);
}
