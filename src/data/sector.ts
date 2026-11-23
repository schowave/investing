// Einheitliche Branchen: die elf Sektoren, die EODHD für die meisten Titel liefert. Ältere Einträge tragen deutsche Namen aus der
// Anfangszeit („Banken“, „Beteiligungen“) oder Varianten anderer Quellen („Financials“, „Capital Markets“). Ohne Vereinheitlichung
// zählte die Höchstgrenze je Branche (Strategie 7.3) jeden Namen für sich: Banken, Beteiligungen und Financial Services lagen im
// globalen Profil am 23.11.2026 zusammen bei 31,6 % statt höchstens 20 %.

/** Die Sektoren des Anbieters, auf die alle Namen abgebildet werden. */
export const SECTORS = [
  "Basic Materials",
  "Communication Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Energy",
  "Financial Services",
  "Healthcare",
  "Industrials",
  "Real Estate",
  "Technology",
  "Utilities",
] as const;

const UNKNOWN_SECTOR = "Unbekannt";

/** Andere Namen für dieselben Sektoren: deutsche Einträge, Varianten und GICS-Sektoren. */
const ALIASES: Readonly<Record<string, (typeof SECTORS)[number]>> = {
  Banken: "Financial Services",
  Beteiligungen: "Financial Services",
  Financials: "Financial Services",
  Financial: "Financial Services",
  "Capital Markets": "Financial Services",
  Telekommunikation: "Communication Services",
  Tabak: "Consumer Defensive",
  "Consumer Non-Cyclicals": "Consumer Defensive",
  "Consumer Staples": "Consumer Defensive",
  Gesundheitswesen: "Healthcare",
  "Health Care": "Healthcare",
  Chemie: "Basic Materials",
  Materials: "Basic Materials",
  "Information Technology": "Technology",
  "Consumer Discretionary": "Consumer Cyclical",
};

function known(name: string | null | undefined): (typeof SECTORS)[number] | null {
  if (!name) return null;
  const trimmed = name.trim();
  if ((SECTORS as readonly string[]).includes(trimmed)) return trimmed as (typeof SECTORS)[number];
  return ALIASES[trimmed] ?? null;
}

/**
 * Sektor eines Titels in der einheitlichen Form. Ist der gespeicherte Name unbekannt („Unbekannt“, „Other“), hilft der
 * GICS-Sektor des Anbieters aus; sonst bleibt „Unbekannt“.
 */
export function normalizeSector(sector: string | null | undefined, gicSector?: string | null): string {
  return known(sector) ?? known(gicSector) ?? UNKNOWN_SECTOR;
}
