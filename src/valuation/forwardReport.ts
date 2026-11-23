// Auswertung des Vorwärtsprotokolls: Kursrendite jedes protokollierten Zielportfolios bis heute und der Vergleich der Arme.
// Reine Rechnung; die aktuellen Kurse reicht der Aufrufer herein.

import type { ForwardLogEntry, ForwardRankingEntry } from "../data/db.ts";
import { MINOR_UNIT } from "./valuation.ts";

export interface ForwardSnapshot {
  date: string;
  arm: string;
  profile: string;
  /** Strategieversion des Eintrags; innerhalb eines Eintrags für alle Positionen gleich. */
  strategyVersion: string;
  positions: { stockId: string; weight: number; priceEur: number }[];
}

export function groupSnapshots(entries: readonly ForwardLogEntry[]): ForwardSnapshot[] {
  const byKey = new Map<string, ForwardSnapshot>();
  for (const e of entries) {
    const key = `${e.date}|${e.arm}|${e.profile}`;
    const snapshot = byKey.get(key) ?? { date: e.date, arm: e.arm, profile: e.profile, strategyVersion: e.strategyVersion, positions: [] };
    snapshot.positions.push({ stockId: e.stockId, weight: e.weight, priceEur: e.priceEur });
    byKey.set(key, snapshot);
  }
  return [...byKey.values()];
}

export interface SnapshotResult {
  date: string;
  arm: string;
  profile: string;
  positions: number;
  /** Summe der Gewichte, in Prozent des Portfolios investiert (der Rest ist Bargeld). */
  invested: number;
  /** Anteil des investierten Gewichts, für das ein aktueller Kurs vorliegt. */
  covered: number;
  /** Kursrendite des Portfolios seit dem Eintrag, ohne Dividenden; Bargeld und Titel ohne aktuellen Kurs zählen 0. */
  priceReturn: number;
  /** Wie `priceReturn`, dazu die Ausschüttungen seit dem Eintrag (nicht wiederangelegt, ohne Steuern). */
  totalReturn: number;
}

/**
 * @param priceNowEur aktueller Kurs in Euro
 * @param dividendsSinceEur Ausschüttungen je Aktie in Euro mit Stichtag nach `since`; ohne Angabe zählen keine
 * @param splitFactorSince Produkt der Splitverhältnisse seit `since` (2 bei einem Split 2:1); der Kurs von damals wird darauf umgerechnet
 */
export function snapshotResult(
  snapshot: ForwardSnapshot,
  priceNowEur: (stockId: string) => number | null,
  dividendsSinceEur: (stockId: string, since: string) => number = () => 0,
  splitFactorSince: (stockId: string, since: string) => number = () => 1,
): SnapshotResult {
  let invested = 0;
  let covered = 0;
  let priceReturn = 0;
  let totalReturn = 0;
  for (const p of snapshot.positions) {
    invested += p.weight;
    const now = priceNowEur(p.stockId);
    if (now === null || !(p.priceEur > 0)) continue;
    covered += p.weight;
    const entry = p.priceEur / splitFactorSince(p.stockId, snapshot.date);
    priceReturn += p.weight * (now / entry - 1);
    totalReturn += p.weight * ((now + dividendsSinceEur(p.stockId, snapshot.date)) / entry - 1);
  }
  return {
    date: snapshot.date,
    arm: snapshot.arm,
    profile: snapshot.profile,
    positions: snapshot.positions.length,
    invested,
    covered: invested > 0 ? covered / invested : 0,
    priceReturn,
    totalReturn,
  };
}

/** Wie viel vom Portfolio beide Arme gemeinsam halten (Summe der kleineren Gewichte), 0 bis 1. */
export function overlap(a: ForwardSnapshot, b: ForwardSnapshot): number {
  const other = new Map(b.positions.map((p) => [p.stockId, p.weight]));
  return a.positions.reduce((sum, p) => sum + Math.min(p.weight, other.get(p.stockId) ?? 0), 0);
}

/** Die Rangliste eines Arms zu einem Tag. */
export interface RankingSnapshot {
  date: string;
  arm: string;
  strategyVersion: string;
  entries: { rank: number; stockId: string; priceEur: number }[];
}

export function groupRankings(entries: readonly ForwardRankingEntry[]): RankingSnapshot[] {
  const byKey = new Map<string, RankingSnapshot>();
  for (const e of entries) {
    const key = `${e.date}|${e.arm}`;
    const snapshot = byKey.get(key) ?? { date: e.date, arm: e.arm, strategyVersion: e.strategyVersion, entries: [] };
    snapshot.entries.push({ rank: e.rank, stockId: e.stockId, priceEur: e.priceEur });
    byKey.set(key, snapshot);
  }
  return [...byKey.values()];
}

/** Rangbereiche, die verglichen werden: die Auswahl der Strategie, die Titel dahinter und der Rest der Rangliste. */
const RANK_GROUPS: readonly (readonly [number, number])[] = [
  [1, 10],
  [11, 30],
  [31, 100],
];

export interface RankGroupResult {
  from: number;
  to: number;
  /** Titel im Rangbereich, für die ein aktueller Kurs vorliegt. */
  covered: number;
  /** Durchschnitt der Renditen seit dem Eintrag, gleich gewichtet; `null` ohne Titel mit Kurs. */
  meanReturn: number | null;
}

/**
 * Gleich gewichtete Rendite je Rangbereich seit dem Eintrag. Ist die Strategie gut, liegt die Rendite im Bereich 1 bis 10 über der
 * im Bereich 31 bis 100 (über viele Monate, nicht in einem).
 * @param returnSince Rendite seit dem Eintrag (Kurs, Ausschüttung); `null` ohne aktuellen Kurs
 */
export function rankingResult(
  snapshot: RankingSnapshot,
  returnSince: (stockId: string, entryPriceEur: number, since: string) => number | null,
): RankGroupResult[] {
  return RANK_GROUPS.map(([from, to]) => {
    const returns = snapshot.entries
      .filter((e) => e.rank >= from && e.rank <= to)
      .map((e) => (e.priceEur > 0 ? returnSince(e.stockId, e.priceEur, snapshot.date) : null))
      .filter((r): r is number => r !== null);
    return {
      from,
      to,
      covered: returns.length,
      meanReturn: returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
    };
  });
}

/**
 * Ausschüttungen je Aktie in Euro, deren Ex-Tag nach `since` und höchstens `today` liegt. Nebenwährungen (Pence) werden in die
 * Hauptwährung umgerechnet, Zahlungen in einer Währung ohne Wechselkurs zählen nicht. Umgerechnet wird zum heutigen Kurs.
 */
export function dividendsSinceEur(
  payments: readonly { date: string; value: number; currency: string }[] | null,
  since: string,
  today: string,
  perEur: (currency: string) => number | null,
): number {
  let sum = 0;
  for (const p of payments ?? []) {
    if (p.date <= since || p.date > today) continue;
    const minor = MINOR_UNIT[p.currency.toUpperCase()];
    const rate = perEur(minor?.currency ?? p.currency.toUpperCase());
    if (rate && rate > 0) sum += p.value / (minor?.divisor ?? 1) / rate;
  }
  return sum;
}

/**
 * Produkt der Splitverhältnisse mit Stichtag nach `since` und höchstens `today`: um so viel ist der Kurs seither geteilt worden (2 bei
 * einem Split 2:1, 0,1 bei einer Zusammenlegung 10:1). Der Kurs von damals ist roh gespeichert, der heutige nach dem Split.
 */
export function splitFactorSince(splits: readonly { date: string; ratio: number }[], since: string, today: string): number {
  let factor = 1;
  for (const split of splits) if (split.date > since && split.date <= today && split.ratio > 0) factor *= split.ratio;
  return factor;
}
