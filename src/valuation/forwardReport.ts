// Auswertung des Vorwärtsprotokolls: Kursrendite jedes protokollierten Zielportfolios bis heute und der Vergleich der Arme.
// Reine Rechnung; die aktuellen Kurse reicht der Aufrufer herein.

import type { ForwardLogEntry } from "../data/db.ts";

export interface ForwardSnapshot {
  date: string;
  arm: string;
  profile: string;
  positions: { stockId: string; weight: number; priceEur: number }[];
}

export function groupSnapshots(entries: readonly ForwardLogEntry[]): ForwardSnapshot[] {
  const byKey = new Map<string, ForwardSnapshot>();
  for (const e of entries) {
    const key = `${e.date}|${e.arm}|${e.profile}`;
    const snapshot = byKey.get(key) ?? { date: e.date, arm: e.arm, profile: e.profile, positions: [] };
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
}

export function snapshotResult(snapshot: ForwardSnapshot, priceNowEur: (stockId: string) => number | null): SnapshotResult {
  let invested = 0;
  let covered = 0;
  let priceReturn = 0;
  for (const p of snapshot.positions) {
    invested += p.weight;
    const now = priceNowEur(p.stockId);
    if (now === null || !(p.priceEur > 0)) continue;
    covered += p.weight;
    priceReturn += p.weight * (now / p.priceEur - 1);
  }
  return {
    date: snapshot.date,
    arm: snapshot.arm,
    profile: snapshot.profile,
    positions: snapshot.positions.length,
    invested,
    covered: invested > 0 ? covered / invested : 0,
    priceReturn,
  };
}

/** Wie viel vom Portfolio beide Arme gemeinsam halten (Summe der kleineren Gewichte), 0 bis 1. */
export function overlap(a: ForwardSnapshot, b: ForwardSnapshot): number {
  const other = new Map(b.positions.map((p) => [p.stockId, p.weight]));
  return a.positions.reduce((sum, p) => sum + Math.min(p.weight, other.get(p.stockId) ?? 0), 0);
}
