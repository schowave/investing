// Zielportfolio (Spezifikation Abschnitt 7). Gewichte sind Anteile am Portfolio (0.08 = 8 %).

import { EXCLUSION_SCORE } from "./risk.ts";

export interface Profile {
  baseLimit: number;
  minPosition: number;
  /** Höchstzahl neuer Titel je Branche und Region; `null` schaltet die Regel ab. */
  maxPerSectorAndRegion: number | null;
  maxSectorShare: number | null;
  maxRegionShare: number | null;
  /** Aufschlag in Prozentpunkten (als Anteil), den gehaltene Titel in der Sortierung erhalten. */
  swapThreshold: number;
  minReturn: number;
}

export const PROFILE_FOCUSED: Profile = {
  baseLimit: 0.15,
  minPosition: 0.03,
  maxPerSectorAndRegion: null,
  maxSectorShare: null,
  maxRegionShare: null,
  swapThreshold: 0.01,
  minReturn: 0.085,
};

export const PROFILE_GLOBAL: Profile = {
  baseLimit: 0.065,
  minPosition: 0.02,
  maxPerSectorAndRegion: 2,
  maxSectorShare: 0.2,
  maxRegionShare: 0.4,
  swapThreshold: 0.02,
  minReturn: 0.085,
};

export interface Stock {
  id: string;
  /** Innere Rendite im Basisfall; `null`, wenn nicht berechenbar. */
  innerReturn: number | null;
  riskScore: number;
  /** Alle Eingaben und alle 15 Risikofaktoren sind gesetzt. */
  complete: boolean;
  sector: string;
  region: string;
  /** Aktuelles Gewicht im Portfolio, 0 wenn nicht gehalten. */
  heldWeight: number;
}

export interface Position {
  id: string;
  weight: number;
}

export interface TargetPortfolio {
  positions: Position[];
  cash: number;
}

/** Positionslimit je Titel. */
export function positionLimit(baseLimit: number, riskScore: number): number {
  return Math.max(0, baseLimit * (1 - riskScore));
}

export function isCandidate(stock: Stock, profile: Profile): boolean {
  return (
    stock.complete &&
    stock.riskScore < EXCLUSION_SCORE &&
    stock.innerReturn !== null &&
    stock.innerReturn >= profile.minReturn
  );
}

const EPSILON = 1e-9;

export function targetPortfolio(stocks: readonly Stock[], profile: Profile): TargetPortfolio {
  const sortKey = (s: Stock) => (s.innerReturn ?? 0) + (s.heldWeight > 0 ? profile.swapThreshold : 0);
  const candidates = stocks
    .filter((s) => isCandidate(s, profile))
    .sort((a, b) => sortKey(b) - sortKey(a) || a.id.localeCompare(b.id));

  const positions: Position[] = [];
  const sectorShare = new Map<string, number>();
  const regionShare = new Map<string, number>();
  const sectorRegionCount = new Map<string, number>();
  let remaining = 1;

  for (const stock of candidates) {
    if (remaining < EPSILON) break;
    const held = stock.heldWeight > 0;
    const sectorRegion = `${stock.sector}|${stock.region}`;

    // Die Zählregel gilt nur für Neuaufnahmen; gehaltene Titel bleiben.
    if (
      !held &&
      profile.maxPerSectorAndRegion !== null &&
      (sectorRegionCount.get(sectorRegion) ?? 0) >= profile.maxPerSectorAndRegion
    ) {
      continue;
    }

    const sectorRoom =
      profile.maxSectorShare === null ? Infinity : profile.maxSectorShare - (sectorShare.get(stock.sector) ?? 0);
    const regionRoom =
      profile.maxRegionShare === null ? Infinity : profile.maxRegionShare - (regionShare.get(stock.region) ?? 0);
    let weight = Math.max(0, Math.min(positionLimit(profile.baseLimit, stock.riskScore), sectorRoom, regionRoom));
    // Limits gelten zum Kaufzeitpunkt: eine gewachsene Position wird nicht gekürzt.
    if (held) weight = Math.max(weight, stock.heldWeight);
    weight = Math.min(weight, remaining);
    if (!held && weight < profile.minPosition - EPSILON) continue;

    positions.push({ id: stock.id, weight });
    remaining -= weight;
    sectorShare.set(stock.sector, (sectorShare.get(stock.sector) ?? 0) + weight);
    regionShare.set(stock.region, (regionShare.get(stock.region) ?? 0) + weight);
    sectorRegionCount.set(sectorRegion, (sectorRegionCount.get(sectorRegion) ?? 0) + 1);
  }

  return { positions, cash: Math.max(0, remaining) };
}

export interface Proposal {
  id: string;
  action: "kaufen" | "verkaufen";
  /** Gewichtsänderung, positiv bei Kauf, negativ bei Verkauf. */
  change: number;
}

/** Kauf- und Verkaufsvorschläge aus Ist-Bestand und Zielportfolio (Abschnitt 7.4). */
export function proposals(stocks: readonly Stock[], target: TargetPortfolio): Proposal[] {
  const targetWeight = new Map(target.positions.map((p) => [p.id, p.weight]));
  const result: Proposal[] = [];
  for (const stock of stocks) {
    const goal = targetWeight.get(stock.id);
    if (goal === undefined) {
      if (stock.heldWeight > 0) result.push({ id: stock.id, action: "verkaufen", change: -stock.heldWeight });
    } else if (goal > stock.heldWeight + EPSILON) {
      result.push({ id: stock.id, action: "kaufen", change: goal - stock.heldWeight });
    }
  }
  return result;
}
