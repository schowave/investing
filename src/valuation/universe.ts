// Welche Titel zählen für das Zielportfolio aus dem Datenvorrat? Gemeinsame Regeln für das Vorwärtsprotokoll und den Rückblick,
// damit beide dieselbe Auswahl treffen.

import type { Stock } from "../data/db.ts";

/** Marktwert in Euro, unter dem ein Titel nicht zählt (Kleinstwerte und Datenmüll). */
export const MIN_MARKET_CAP_EUR = 300e6;

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
