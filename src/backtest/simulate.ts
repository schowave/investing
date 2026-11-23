// Das Portfolio über die Zeit: je Stichtag das Zielportfolio der Anwendung, dazwischen Kursentwicklung.
// Vereinfachungen: Handel zum Monatsschlusskurs des Stichtags, Kosten je Handelsumsatz, Bargeld mit fester Verzinsung.

import type { Profile } from "../calc/index.ts";
import { targetPortfolio } from "../calc/index.ts";
import { shiftMonth } from "./calendar.ts";
import type { Bar, Candidate } from "./candidates.ts";
import type { FxHistory } from "./fx.ts";
import { fxPerEur } from "./fx.ts";

export type ReturnOf = (id: string, prev: string, month: string) => number | null;

const BAR_LOOKBACK_MONTHS = 12;

/**
 * Monatsrendite in Euro eines Titels: Gesamtrendite aus den bereinigten Kursen, Wechselkurs des Monatsschlusses.
 * Fehlt ein Monatsbalken, gilt der letzte davor. Endet die Reihe, ohne dass der Zeitraum zu Ende ist, wird im dritten Monat
 * ohne Kurs ein Verlust von `delistLoss` angesetzt (Annahme: Einstellung; eine Übernahme gegen bar zählt damit auch als Verlust).
 * `hooks.isDelisted` nimmt Titel aus, deren Tageskurse weiterlaufen (nur die Monatsreihe ist veraltet); `hooks.onDelist` zählt
 * die Abschläge.
 */
export function makeReturnOf(
  bars: ReadonlyMap<string, ReadonlyMap<string, Bar>>,
  quoteCurrency: ReadonlyMap<string, string>,
  fx: FxHistory,
  dateOf: (month: string) => string,
  lastMonth: string,
  delistLoss: number,
  hooks: { isDelisted?: (id: string) => boolean; onDelist?: (id: string, month: string) => void } = {},
): ReturnOf {
  const lastBarMonth = new Map<string, string>();
  for (const [id, series] of bars) lastBarMonth.set(id, [...series.keys()].sort().at(-1)!);
  const barAt = (id: string, month: string): { month: string; bar: Bar } | null => {
    const series = bars.get(id);
    if (!series) return null;
    for (let k = 0; k <= BAR_LOOKBACK_MONTHS; k++) {
      const bar = series.get(shiftMonth(month, -k));
      if (bar) return { month: shiftMonth(month, -k), bar };
    }
    return null;
  };
  const cache = new Map<string, number | null>();
  return (id, prev, month) => {
    const key = `${id}|${month}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const from = barAt(id, prev);
    const to = barAt(id, month);
    let result: number | null = null;
    if (from && to && from.bar.adjustedClose > 0 && to.bar.adjustedClose > 0) {
      const ended = to.month === lastBarMonth.get(id) && to.month === shiftMonth(month, -3) && to.month < lastMonth;
      if (ended && (hooks.isDelisted?.(id) ?? true)) {
        result = -delistLoss;
        hooks.onDelist?.(id, month);
      } else {
        const currency = quoteCurrency.get(id) ?? "EUR";
        const f0 = fxPerEur(fx, currency, dateOf(prev));
        const f1 = fxPerEur(fx, currency, dateOf(month));
        if (f0 !== null && f1 !== null) result = (to.bar.adjustedClose / from.bar.adjustedClose) * (f0 / f1) - 1;
      }
    }
    cache.set(key, result);
    return result;
  };
}

export interface Trade {
  id: string;
  name: string;
  country: string;
  action: "kaufen" | "verkaufen" | "aufstocken" | "reduzieren" | "halten";
  weightBefore: number;
  weightAfter: number;
  /** Kursentwicklung der Position seit dem Kauf (nur bei Verkäufen und Anpassungen). */
  sinceBuy?: number;
  reason?: string;
}

export interface SimulationInput {
  months: readonly string[];
  /** Stichtage mit Kandidaten, in `months` enthalten. */
  candidates: ReadonlyMap<string, readonly Candidate[]>;
  returnOf: ReturnOf;
  profile: Profile;
  cost: number;
  cashRate: number;
  /** Bargeldzins (des Monatsanfangs, für den Monat) und Hürde (des Stichtags) statt der festen Werte `cashRate` und `profile.minReturn`. */
  cashRateAt?: (month: string) => number;
  minReturnAt?: (month: string) => number;
  /** Erster und letzter Monat als Index in `months`; Standard: die ganze Reihe. */
  from?: number;
  to?: number;
  /** Nur jeden `every`-ten Stichtag umschichten (Standard 1). */
  every?: number;
  /** Würfelt die Rangfolge der Kandidaten statt sie nach innerer Rendite zu ordnen (Zufallsgegenprobe): Wert in [0, 1) je Titel und Monat. */
  random?: (id: string, month: string) => number;
  trades?: boolean;
}

export interface SimulationResult {
  /** Depotwert je Monat von `from` bis `to`, Start 100. */
  values: number[];
  /** Mittlerer Umschlag je Umschichtung ohne den Aufbau, als Anteil des Depots, zweiseitig (Käufe plus Verkäufe; ein voller Austausch zählt 200 %). */
  turnover: number;
  holdings: number;
  trades: Record<string, Trade[]>;
  /** Positionen mit einer Monatsrendite über +100 % oder unter −60 %: oft Datenfehler, die das Ergebnis verzerren. */
  outliers: { month: string; id: string; name: string; monthlyReturn: number }[];
}

const sum = (values: Iterable<number>) => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

export function simulate(input: SimulationInput): SimulationResult {
  const { months, candidates, returnOf, profile } = input;
  const from = input.from ?? 0;
  const to = input.to ?? months.length - 1;
  const every = input.every ?? 1;
  let cash = 100;
  const position = new Map<string, number>();
  /** Kursentwicklung je Position seit dem Kauf, als Faktor. */
  const growth = new Map<string, number>();
  const info = new Map<string, { name: string; country: string }>();
  const values: number[] = [];
  const trades: Record<string, Trade[]> = {};
  const outliers: SimulationResult["outliers"] = [];
  let rebalances = 0;
  let turnoverSum = 0;
  let holdingsSum = 0;

  for (let i = from; i <= to; i++) {
    const month = months[i]!;
    if (i > from) {
      cash *= 1 + (input.cashRateAt?.(months[i - 1]!) ?? input.cashRate) / 12;
      for (const [id, value] of [...position]) {
        const r = returnOf(id, months[i - 1]!, month) ?? 0;
        if (r > 1 || r < -0.6) outliers.push({ month, id, name: info.get(id)?.name ?? id, monthlyReturn: r });
        position.set(id, value * (1 + r));
        growth.set(id, (growth.get(id) ?? 1) * (1 + r));
      }
    }
    let total = cash + sum(position.values());
    const beforeTrades = total;
    const list = candidates.get(month);
    if (list && i < to) {
      if (rebalances % every === 0) {
        const rule = input.minReturnAt ? { ...profile, minReturn: input.minReturnAt(month) } : profile;
        const ranked = list.map((c) => ({
          ...c,
          heldWeight: (position.get(c.id) ?? 0) / total,
          innerReturn: input.random && c.innerReturn >= rule.minReturn ? 0.1 + input.random(c.id, month) * 0.2 : c.innerReturn,
        }));
        const target = targetPortfolio(ranked, rule);
        const weights = new Map<string, number>(target.positions.map((p) => [p.id, p.weight]));
        for (const c of list) info.set(c.id, { name: c.name, country: c.country });
        const ids = new Set([...position.keys(), ...weights.keys()]);
        let turnover = 0;
        for (const id of ids) turnover += Math.abs((weights.get(id) ?? 0) - (position.get(id) ?? 0) / total);
        if (input.trades) {
          const candidateIds = new Set(list.map((c) => c.id));
          trades[month] = [...ids]
            .map((id): Trade => {
              const before = (position.get(id) ?? 0) / total;
              const after = weights.get(id) ?? 0;
              const action =
                before === 0
                  ? "kaufen"
                  : after === 0
                    ? "verkaufen"
                    : after > before + 0.005
                      ? "aufstocken"
                      : after < before - 0.005
                        ? "reduzieren"
                        : "halten";
              return {
                id,
                name: info.get(id)?.name ?? id,
                country: info.get(id)?.country ?? "",
                action,
                weightBefore: before,
                weightAfter: after,
                sinceBuy: before > 0 ? (growth.get(id) ?? 1) - 1 : undefined,
                reason:
                  action === "verkaufen"
                    ? candidateIds.has(id)
                      ? "aus dem Zielportfolio verdrängt (Rang oder Limit)"
                      : "kein Kandidat mehr (Rendite unter der Hürde, Risiko, Daten oder Marktwert)"
                    : undefined,
              };
            })
            .sort((a, b) => a.action.localeCompare(b.action) || b.weightAfter - a.weightAfter);
        }
        if (rebalances > 0) turnoverSum += turnover;
        total *= 1 - input.cost * turnover;
        for (const id of [...growth.keys()]) if (!weights.has(id)) growth.delete(id);
        for (const id of weights.keys()) if (!position.has(id)) growth.set(id, 1);
        position.clear();
        for (const [id, weight] of weights) position.set(id, weight * total);
        cash = total - sum(position.values());
      }
      rebalances++;
    }
    // Der Startwert ist 100 vor den Kosten des Aufbaus, damit sie in die Gesamtrendite eingehen.
    values.push(i === from ? beforeTrades : cash + sum(position.values()));
    holdingsSum += position.size;
  }
  const done = Math.max(1, Math.ceil(rebalances / every) - 1);
  return { values, turnover: turnoverSum / done, holdings: holdingsSum / values.length, trades, outliers };
}
