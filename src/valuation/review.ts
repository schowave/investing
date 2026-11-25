// Wann eine Bewertung wieder angesehen werden muss (Strategie 7.5). Reine Rechnung.
//
// Der Autor versieht jede Bewertung mit einem Datum und gleicht monatlich ab, ob sich die Zahlen seither verschoben
// haben: Bei wenigen Prozent bleibt die Bewertung stehen, bei mehr sieht er sich das Unternehmen im Ganzen wieder an
// (Interview, `docs/Interview.md`). Hier ist die Schwelle die Bandbreite aus Strategie 5.2: Was über sie hinausgeht,
// deckt die Bewertung nicht mehr ab. Dazu kommt der Kurs: Fällt er stark, hinterfragt der Autor seine Fundamentaldaten
// (Webinar, `docs/webinar.md`); verkauft wird deshalb nicht.

import { DEFAULT_SCENARIO_SPREAD, RISK_FACTOR_IDS, RISK_FACTORS, toEuroTerms } from "../calc/index.ts";

/** Nach so vielen Monaten ist eine Bewertung überfällig (Buch: jährliche Prüfung). */
export const REVIEW_MONTHS = 12;
/** Der Risikowert aus Zahlen hat sich um mindestens so viele Punkte verschoben. */
const RISK_SHIFT = 0.05;
/** Der Kurs ist seit der Bewertung um mehr als diesen Anteil gefallen (Strategie 7.5, `pruefung.kursrueckgang`). */
export const PRICE_DROP = 0.25;

/** Die Zahlen, auf denen eine Bewertung steht: Vorschläge aus den Abschlüssen, ohne das Urteil des Nutzers. */
export interface Basis {
  payoutLevel: number | null;
  growth: number | null;
  earningsLevel: number | null;
  /** Summe der Vorschläge für die Risikofaktoren aus Zahlen. */
  numberRisk: number;
}

const NUMBER_FACTORS = RISK_FACTOR_IDS.filter((id) => !RISK_FACTORS[id].manual);

export function basisOf(proposals: {
  values: Readonly<Record<string, number | undefined>>;
  details: { earningsLevel?: number | null };
}): Basis {
  return {
    payoutLevel: proposals.values.payoutLevel ?? null,
    growth: proposals.values.growth ?? null,
    earningsLevel: proposals.details.earningsLevel ?? null,
    numberRisk: NUMBER_FACTORS.reduce((sum, id) => sum + (proposals.values[`risk.${id}`] ?? 0), 0),
  };
}

export interface Review {
  /** Tag, an dem zuletzt eine Eingabe von Hand gesetzt oder bestätigt wurde; `null` ohne Eingabe von Hand. */
  assessedOn: string | null;
  /** Die Bewertung ist älter als `REVIEW_MONTHS`. */
  overdue: boolean;
  /** Was sich an den Vorschlägen seit der Bewertung über die Bandbreite hinaus verschoben hat, als Sätze. */
  changes: string[];
  /** Die Rechnung hat sich seit der Bewertung geändert; die Verschiebungen können auch daher kommen. */
  calcChanged: boolean;
  /** Kursrückgang seit der Bewertung als Anteil (0,3 = 30 % gefallen), wenn er über `PRICE_DROP` liegt; sonst `null`. */
  priceDrop: number | null;
}

const number = (value: number, digits: number) =>
  value.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number) => `${value > 0 ? "+" : "−"}${number(Math.abs(value) * 100, 0)} %`;

function levelChange(label: string, before: number | null, now: number | null, threshold: number): string | null {
  if (before === null && now === null) return null;
  if (before === null || now === null) return `${label}: ${before === null ? "neu" : "kein Vorschlag mehr"}`;
  if (before === 0 && now === 0) return null;
  // Am Betrag gemessen, damit das Vorzeichen auch bei negativem Niveau die Richtung zeigt.
  const shift = before === 0 ? Infinity : (now - before) / Math.abs(before);
  if (Math.abs(shift) <= threshold + 1e-9) return null;
  return `${label} ${number(before, 2)} → ${number(now, 2)}${Number.isFinite(shift) ? ` (${signed(shift)})` : ""}`;
}

/** @param inflationGap Verglichen wird in Euro-Kaufkraft (Strategie 4.6); angezeigt werden die nominalen Werte. */
function pointChange(
  label: string,
  before: number | null,
  now: number | null,
  threshold: number,
  digits: number,
  inflationGap = 0,
): string | null {
  if (before === null && now === null) return null;
  if (before === null || now === null) return `${label}: ${before === null ? "neu" : "kein Vorschlag mehr"}`;
  if (Math.abs(toEuroTerms(now, inflationGap) - toEuroTerms(before, inflationGap)) <= threshold + 1e-9) return null;
  return `${label} ${number(before * 100, digits)} % → ${number(now * 100, digits)} %`;
}

function monthsLater(date: string, months: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result.toISOString().slice(0, 10);
}

/**
 * @param before Grundlage am Tag der Bewertung; `null`, wenn kein Tagesstand aus dieser Zeit vorliegt.
 * @param now Grundlage heute.
 * @param inflationGap Inflationsabstand der Berichtswährung (heutiger Wert für beide Stände); das Wachstum wird in Euro-Kaufkraft verglichen.
 * @param calcChanged Der Tagesstand von damals ist mit einer anderen Version der Rechnung entstanden.
 */
export function reviewOf(args: {
  assessedOn: string | null;
  today: string;
  before: Basis | null;
  now: Basis;
  calcChanged?: boolean;
  inflationGap?: number;
  /** Kurs am Tag der Bewertung, um spätere Splits bereinigt, und Kurs heute; beide in derselben Währung. */
  priceBefore?: number | null;
  priceNow?: number | null;
}): Review {
  const { assessedOn, before, now } = args;
  if (assessedOn === null) return { assessedOn, overdue: false, changes: [], calcChanged: false, priceDrop: null };
  const { priceBefore, priceNow } = args;
  const drop = priceBefore && priceNow && priceBefore > 0 && priceNow > 0 ? 1 - priceNow / priceBefore : 0;
  const spread = DEFAULT_SCENARIO_SPREAD;
  const changes =
    before === null
      ? []
      : [
          levelChange("Rückflussniveau", before.payoutLevel, now.payoutLevel, spread.payoutFactor),
          levelChange("Gewinnniveau", before.earningsLevel, now.earningsLevel, spread.payoutFactor),
          pointChange("Wachstum", before.growth, now.growth, spread.growthPoints, 1, args.inflationGap),
          pointChange("Risiko aus Zahlen", before.numberRisk, now.numberRisk, RISK_SHIFT, 0),
        ].filter((change): change is string => change !== null);
  return {
    assessedOn,
    overdue: monthsLater(assessedOn, REVIEW_MONTHS) < args.today,
    changes,
    calcChanged: before !== null && (args.calcChanged ?? false),
    priceDrop: drop > PRICE_DROP + 1e-9 ? drop : null,
  };
}

/** Die Bewertung sollte wieder angesehen werden. */
export function needsReview(review: Review): boolean {
  return review.overdue || review.changes.length > 0 || review.priceDrop !== null;
}
