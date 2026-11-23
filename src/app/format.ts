// Zahlenformate der Oberfläche (deutsch).

const MISSING = "–";

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return MISSING;
  return `${(value * 100).toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

export function amount(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return MISSING;
  return value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Wert für ein Eingabefeld: Prozentzahl bzw. Betrag mit Dezimalkomma, ohne Tausenderpunkte. */
export function fieldValue(value: number | undefined, asPercent: boolean): string {
  if (value === undefined) return "";
  const shown = asPercent ? value * 100 : value;
  return String(Math.round(shown * 100) / 100).replace(".", ",");
}

/** Bezeichnung der Herkunft einer Bewertung (Datenvorrat, Aktienseite). */
export const SOURCE_LABEL = { opus: "Opus", haiku: "Haiku", jev: "Jev", hand: "von Hand", vorschlag: "Jev-Vorschlag" } as const;

export function isoDate(date: string | null): string {
  if (!date) return MISSING;
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}
