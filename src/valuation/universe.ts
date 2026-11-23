// Welche Titel zählen für das Zielportfolio aus dem Datenvorrat? Gemeinsame Regeln für das Vorwärtsprotokoll und den Rückblick,
// damit beide dieselbe Auswahl treffen.

import type { Stock } from "../data/db.ts";

/** Marktwert in Euro, unter dem ein Titel nicht zählt (Kleinstwerte und Datenmüll). */
export const MIN_MARKET_CAP_EUR = 300e6;

/** Schuldtitel und Hybridpapiere mit Kürzeln wie „JR SUB NT“, „PERP CAP SECS“, „ELKS“, die der Anbieter nicht als Anleihe erkennt. */
const DEBT_LIKE = /\b(nt|sub|deb|perp|prp|elks|enhcd|subordinated)\b/i;
/** Vorzugsaktien tragen im Kürzel ein „-P“ oder „-PA“. */
const PREFERRED_CODE = /-P[A-Z]?\.[A-Z]+$/;

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));

export type DelistedArtefact = "wertpapier" | "kursfehler" | "fortgesetzt";

/**
 * Erkennt unter den eingestellten Titeln (Survivorship-Daten) solche, die der Rückblick nicht als Aktie zählen darf:
 * - `wertpapier`: Schuld- oder Vorzugstitel (Name, Kürzel oder ein Kurs, der über Jahre in einem Band von 20 % um 20 bis 30 USD
 *   bleibt, wie bei Papieren mit 25 USD Nennwert);
 * - `kursfehler`: ein Monatskurs, der nicht stimmen kann: der bereinigte Kurs springt auf mehr als das Neunfache (meist ein nicht
 *   angepasster Reverse Split), er springt über das Neunfache oder fällt unter ein Zwanzigstel, während der rohe Kurs ruhig bleibt
 *   (Fehler der Anpassung), oder roher und bereinigter Kurs fallen (Split ab 2:1) oder steigen (Reverse Split ab 1:2) gemeinsam im
 *   Verhältnis eines Splits in der Nähe (nicht angepasst). Verglichen werden nur benachbarte Monate; ein echter Anstieg über das
 *   Neunfache in einem Monat (Meme-Spitze) zählt als Fehler, das ist eine bekannte Unschärfe. Ein echter Absturz ohne Split bleibt drin: Das sind die Gescheiterten, die der Rückblick braucht. Dass der rohe Kurs
 *   springt und der bereinigte nicht (Reverse Split), ist richtig bereinigt und kein Fehler;
 * - `fortgesetzt`: Abschlüsse reichen mehr als ein Jahr über die Einstellung hinaus, das Unternehmen besteht unter anderem Kürzel
 *   weiter (Umbenennung) und steht dort schon.
 * Heuristik für Titel mit `delistedOn`; lebende Titel prüft sie nicht.
 */
export function delistedArtefact(
  stock: Pick<Stock, "id" | "name" | "delistedOn">,
  fiscalYears: readonly number[],
  bars: readonly { month: string; close: number; adjustedClose: number }[],
  splits: readonly { date: string; ratio: number }[] = [],
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
    const [prev, bar] = [bars[i - 1]!, bars[i]!];
    // Nur benachbarte Monate vergleichen: Nach einer Lücke ist ein Anstieg kein Monatssprung.
    if (monthIndex(bar.month) - monthIndex(prev.month) !== 1) continue;
    if (prev.adjustedClose <= 0 || prev.close <= 0) continue;
    const adjusted = bar.adjustedClose / prev.adjustedClose;
    const raw = bar.close / prev.close;
    if (adjusted > 9) return "kursfehler";
    if (adjusted < 0.05 && raw > 1 / 3 && raw < 3) return "kursfehler";
    // Roher und bereinigter Kurs bewegen sich im Verhältnis eines Splits desselben Monats (±1) gleich: Der Split ist nicht
    // angepasst, die Bewegung kein Absturz oder Anstieg. Ist der bereinigte Kurs richtig angepasst, fällt der rohe nicht mit.
    const unadjustedSplit = splits.some(
      (s) =>
        Math.abs(monthIndex(s.date) - monthIndex(bar.month)) <= 1 &&
        Math.abs(adjusted * s.ratio - 1) < 0.3 &&
        Math.abs(raw / adjusted - 1) < 0.3 &&
        ((s.ratio >= 2 && adjusted < 0.5) || (s.ratio <= 0.5 && adjusted > 2)),
    );
    if (unadjustedSplit) return "kursfehler";
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
