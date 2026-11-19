// Ist-Bestand gegen Zielportfolio (Spezifikation Abschnitt 7). Reine Rechnung.

import { EXCLUSION_SCORE, proposals, targetPortfolio } from "../calc/index.ts";
import type { Profile } from "../calc/index.ts";

export interface PortfolioItem {
  id: string;
  sector: string;
  region: string;
  innerReturn: number | null;
  riskScore: number;
  complete: boolean;
  /** Gehaltene Stückzahl, 0 wenn nicht gehalten. */
  shares: number;
  /** Kurs je Aktie in Euro; `null`, wenn Kurs oder Wechselkurs fehlen. */
  priceEur: number | null;
}

export interface PortfolioRow {
  id: string;
  shares: number;
  /** Wert in Euro; `null`, wenn gehalten, aber ohne Kurs. */
  valueEur: number | null;
  heldWeight: number;
  targetWeight: number;
  action: "kaufen" | "verkaufen" | "halten" | null;
  /** Gewichtsänderung des Vorschlags, 0 ohne Vorschlag. */
  change: number;
  changeEur: number;
  /** Warum der Titel nicht im Zielportfolio steht; `null`, wenn er darin steht. */
  reason: string | null;
}

export interface Share {
  name: string;
  held: number;
  target: number;
}

export interface PortfolioView {
  totalEur: number;
  cashWeight: number;
  targetCashWeight: number;
  /** Gehaltene Titel und Titel des Zielportfolios, Ziel absteigend. */
  rows: PortfolioRow[];
  sectors: Share[];
  regions: Share[];
  /** Gehaltene Titel ohne Kurs; ihr Wert fehlt in der Summe. */
  unpriced: string[];
}

function reasonFor(item: PortfolioItem, profile: Profile): string {
  if (item.riskScore >= EXCLUSION_SCORE) return "Risikowert ab 75 %";
  if (!item.complete) return "Bewertung unvollständig";
  if (item.innerReturn === null || item.innerReturn < profile.minReturn) return "unter der Mindestrendite";
  return "von Titeln mit höherer Rendite verdrängt oder Regelgrenze erreicht";
}

function shares(rows: readonly PortfolioRow[], items: ReadonlyMap<string, PortfolioItem>, pick: (i: PortfolioItem) => string): Share[] {
  const result = new Map<string, Share>();
  for (const row of rows) {
    const name = pick(items.get(row.id)!);
    const share = result.get(name) ?? { name, held: 0, target: 0 };
    share.held += row.heldWeight;
    share.target += row.targetWeight;
    result.set(name, share);
  }
  return [...result.values()].sort((a, b) => b.target - a.target || b.held - a.held);
}

export function buildPortfolioView(profile: Profile, cashEur: number, items: readonly PortfolioItem[]): PortfolioView {
  const value = (item: PortfolioItem) => (item.shares > 0 && item.priceEur !== null ? item.shares * item.priceEur : 0);
  const totalEur = cashEur + items.reduce((sum, item) => sum + value(item), 0);
  const weight = (item: PortfolioItem) => (totalEur > 0 ? value(item) / totalEur : 0);

  const stocks = items.map((item) => ({
    id: item.id, innerReturn: item.innerReturn, riskScore: item.riskScore, complete: item.complete,
    sector: item.sector, region: item.region, heldWeight: weight(item),
  }));
  const target = targetPortfolio(stocks, profile);
  const targetWeight = new Map(target.positions.map((p) => [p.id, p.weight]));
  const proposal = new Map(proposals(stocks, target).map((p) => [p.id, p]));

  const rows = items
    .filter((item) => item.shares > 0 || targetWeight.has(item.id))
    .map((item): PortfolioRow => {
      const suggested = proposal.get(item.id);
      const inTarget = targetWeight.has(item.id);
      return {
        id: item.id,
        shares: item.shares,
        valueEur: item.shares > 0 && item.priceEur === null ? null : value(item),
        heldWeight: weight(item),
        targetWeight: targetWeight.get(item.id) ?? 0,
        action: suggested?.action ?? (inTarget ? "halten" : null),
        change: suggested?.change ?? 0,
        changeEur: (suggested?.change ?? 0) * totalEur,
        reason: inTarget ? null : reasonFor(item, profile),
      };
    })
    .sort((a, b) => b.targetWeight - a.targetWeight || b.heldWeight - a.heldWeight || a.id.localeCompare(b.id));

  const byId = new Map(items.map((item) => [item.id, item]));
  return {
    totalEur,
    cashWeight: totalEur > 0 ? cashEur / totalEur : 0,
    targetCashWeight: target.cash,
    rows,
    sectors: shares(rows, byId, (i) => i.sector),
    regions: shares(rows, byId, (i) => i.region),
    unpriced: items.filter((item) => item.shares > 0 && item.priceEur === null).map((item) => item.id),
  };
}
