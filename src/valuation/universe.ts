// Welche Titel zählen für das Zielportfolio aus dem Datenvorrat? Gemeinsame Regeln für das Vorwärtsprotokoll und den Rückblick,
// damit beide dieselbe Auswahl treffen.

import type { Stock } from "../data/db.ts";

/** Marktwert in Euro, unter dem ein Titel nicht zählt (Kleinstwerte und Datenmüll). */
export const MIN_MARKET_CAP_EUR = 300e6;

/** Schuldtitel und Hybridpapiere mit Kürzeln wie „JR SUB NT“, „PERP CAP SECS“, „ELKS“, die der Anbieter nicht als Anleihe erkennt. */
const DEBT_LIKE = /\b(nt|sub|deb|perp|prp|elks|enhcd|subordinated|fixed|floating)\b/i;
/** Vorzugsaktien tragen im Kürzel ein „-P“ oder „-PA“. */
const PREFERRED_CODE = /-P[A-Z]?\.[A-Z]+$/;

export type DelistedArtefact = "wertpapier" | "kursfehler" | "fortgesetzt";

/**
 * Erkennt unter den eingestellten Titeln (Survivorship-Daten) solche, die der Rückblick nicht als Aktie zählen darf:
 * - `wertpapier`: Schuld- oder Vorzugstitel (Name, Kürzel oder ein Kurs, der über Jahre in einem Band von 20 % um 20 bis 30 USD
 *   bleibt, wie bei Papieren mit 25 USD Nennwert);
 * - `kursfehler`: ein Monat mit mehr als dem Neunfachen oder weniger als einem Zwanzigstel des Vormonats (bereinigt), fast immer ein
 *   Datenfehler oder ein Umtausch;
 * - `fortgesetzt`: Abschlüsse reichen mehr als ein Jahr über die Einstellung hinaus, das Unternehmen besteht unter anderem Kürzel
 *   weiter (Umbenennung) und steht dort schon.
 * Heuristik für Titel mit `delistedOn`; lebende Titel prüft sie nicht.
 */
export function delistedArtefact(
  stock: Pick<Stock, "id" | "name" | "delistedOn">,
  fiscalYears: readonly number[],
  bars: readonly { close: number; adjustedClose: number }[],
): DelistedArtefact | null {
  if (!stock.delistedOn) return null;
  if (DEBT_LIKE.test(stock.name) || PREFERRED_CODE.test(stock.id)) return "wertpapier";
  const closes = bars
    .slice(-60)
    .map((b) => b.close)
    .sort((a, b) => a - b);
  if (closes.length >= 36) {
    const median = closes[Math.floor(closes.length / 2)]!;
    const spread = closes[Math.floor(closes.length * 0.95)]! / closes[Math.floor(closes.length * 0.05)]!;
    if (median >= 20 && median <= 30 && spread < 1.2) return "wertpapier";
  }
  for (let i = 1; i < bars.length; i++) {
    const before = bars[i - 1]!.adjustedClose;
    const ratio = before > 0 ? bars[i]!.adjustedClose / before : 1;
    if (ratio > 9 || ratio < 0.05) return "kursfehler";
  }
  if (fiscalYears.some((y) => y > Number(stock.delistedOn!.slice(0, 4)) + 1)) return "fortgesetzt";
  return null;
}

/** Anleihen, die der Anbieter als Stammaktie führt (z. B. „DTE Energy Company 2020 Series G“). */
const NOT_A_SHARE = /\b(series|notes?|debentures?|preferred)\b/i;

export function isCommonShare(stock: Pick<Stock, "securityType" | "name">): boolean {
  return (stock.securityType == null || stock.securityType === "Common Stock") && !NOT_A_SHARE.test(stock.name);
}

/**
 * Gleiche Zahlen unter verschiedenen Symbolen sind dasselbe Unternehmen (ADR, Zweitnotiz): gleiche Berichtswährung, gleicher
 * Gewinn und gleiche Aktienzahl. Ohne Gewinn je Aktie gibt es keinen belastbaren Fingerabdruck; dann steht der Titel für sich.
 */
export function fingerprint(stockId: string, reportingCurrency: string, eps: number | null | undefined, shares: number): string {
  return eps != null && Number.isFinite(Number(eps))
    ? `${reportingCurrency}|${Number(eps).toPrecision(5)}|${shares.toPrecision(5)}`
    : `id|${stockId}`;
}
