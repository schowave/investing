// Vorwärtsprotokoll: hält zum Monatsanfang fest, welches Zielportfolio die Anwendung vorgeschlagen hätte.
//
// Zwei Arme je Profil, damit sich später ohne Rückschaufehler messen lässt, was die Urteile bringen:
// - "zahlen": der ganze Datenvorrat, nur Zahlenfaktoren (wie der Rückblick und das Screening),
// - "urteil": die Watchlist mit allen Risikofaktoren (Jev und Handeingaben), so wie die Anwendung sie vorschlägt.
// Gehaltene Titel (Aufschlag der Tauschschwelle) sind die des letzten Eintrags im selben Arm und Profil.

import type { Profile } from "../calc/index.ts";
import { PROFILE_FOCUSED, PROFILE_GLOBAL, targetPortfolio, withHurdle } from "../calc/index.ts";
import type { Database } from "../data/db.ts";
import { BOND_KEY } from "./portfolioRun.ts";
import type { StockValuation } from "./run.ts";
import { CALC_VERSION, computeValuation } from "./run.ts";
import { doubtfulNumbers } from "./valuation.ts";

const FORWARD_ARMS = ["zahlen", "urteil"] as const;

const PROFILES: readonly { name: string; profile: Profile }[] = [
  { name: "fokussiert", profile: PROFILE_FOCUSED },
  { name: "global", profile: PROFILE_GLOBAL },
];

/** Marktwert, unter dem ein Titel im Arm „zahlen“ nicht zählt (Kleinstwerte und Datenmüll, wie im Rückblick). */
export const MIN_MARKET_CAP_EUR = 300e6;
/** Anleihen, die der Anbieter als Stammaktie führt. */
const NOT_A_SHARE = /\b(series|notes?|debentures?|preferred)\b/i;

interface Candidate {
  id: string;
  innerReturn: number;
  riskScore: number;
  complete: true;
  sector: string;
  region: string;
  heldWeight: number;
  priceEur: number;
}

/** Kurs in Euro aus dem letzten Schlusskurs; `null` ohne Kurs oder Wechselkurs. */
function priceEurOf(db: Database, result: StockValuation): number | null {
  const price = db.latestPrice(result.stock.id);
  const perEur = db.latestFxRate(result.stock.priceCurrency);
  return price && perEur ? price.close / perEur : null;
}

/** Ein Kandidat für das Zielportfolio; `null`, wenn Rendite oder Kurs in Euro fehlen (dann käme er nicht ins Protokoll). */
function candidateOf(db: Database, result: StockValuation, held: ReadonlyMap<string, number>): Candidate | null {
  const { stock, valuation } = result;
  const base = valuation.returns?.base;
  const priceEur = priceEurOf(db, result);
  if (base == null || priceEur === null) return null;
  return {
    id: stock.id,
    innerReturn: base,
    riskScore: valuation.riskScore,
    complete: true,
    sector: stock.sector,
    region: stock.region,
    heldWeight: held.get(stock.id) ?? 0,
    priceEur,
  };
}

/**
 * Gleiche Zahlen unter verschiedenen Symbolen sind dasselbe Unternehmen (ADR, Zweitnotiz); der Fingerabdruck erkennt sie.
 * Ohne Gewinn je Aktie gibt es keinen belastbaren Fingerabdruck; dann steht der Titel für sich.
 */
function marketCapAndFingerprint(db: Database, result: StockValuation): { capEur: number; fingerprint: string } | null {
  const { stock, valuation } = result;
  const last = db.fundamentals(stock.id).at(-1);
  const perEur = db.latestFxRate(stock.reportingCurrency);
  if (!last?.shares || last.shares <= 0 || valuation.price === null || !perEur) return null;
  const eps = last.epsDiluted == null ? Number.NaN : Number(last.epsDiluted);
  return {
    capEur: (last.shares * valuation.price) / perEur,
    fingerprint: Number.isFinite(eps)
      ? `${stock.reportingCurrency}|${eps.toPrecision(5)}|${Number(last.shares).toPrecision(5)}`
      : `id|${stock.id}`,
  };
}

function judgedCandidates(db: Database, valued: ReadonlyMap<string, StockValuation>, held: ReadonlyMap<string, number>): Candidate[] {
  const result: Candidate[] = [];
  for (const entry of valued.values()) {
    if (!entry.stock.watched || !entry.valuation.complete) continue;
    const candidate = candidateOf(db, entry, held);
    if (candidate) result.push(candidate);
  }
  return result;
}

/**
 * Bewertungen nur aus Zahlen: Titel mit Eingaben von Hand (also auch übernommenen Jev-Urteilen) werden ohne sie neu
 * gerechnet, damit der Arm „zahlen“ nichts von den Urteilen erbt, die der Arm „urteil“ messen soll.
 */
function numbersOnly(db: Database, valued: ReadonlyMap<string, StockValuation>, date: string): StockValuation[] {
  return [...valued.values()].flatMap((result) => {
    if (db.manualInputs(result.stock.id).length === 0) return [result];
    // Scheitert die Rechnung ohne Urteile, fehlt nur dieser Titel; mit Urteilen darf er nicht hinein.
    try {
      return [computeValuation(db, result.stock, date, { manual: false })];
    } catch {
      return [];
    }
  });
}

function numberCandidates(
  db: Database,
  unjudged: readonly StockValuation[],
  held: ReadonlyMap<string, number>,
  minReturn: number,
): Candidate[] {
  const best = new Map<string, { capEur: number; candidate: Candidate }>();
  for (const result of unjudged) {
    const { stock, valuation, proposals } = result;
    const base = valuation.returns?.base;
    if (stock.securityType != null && stock.securityType !== "Common Stock") continue;
    if (NOT_A_SHARE.test(stock.name) || base == null || base < minReturn) continue;
    if (doubtfulNumbers(valuation, proposals) !== null) continue;
    const info = marketCapAndFingerprint(db, result);
    if (!info || info.capEur < MIN_MARKET_CAP_EUR) continue;
    const candidate = candidateOf(db, result, held);
    if (!candidate) continue;
    const known = best.get(info.fingerprint);
    if (!known || info.capEur > known.capEur) best.set(info.fingerprint, { capEur: info.capEur, candidate });
  }
  return [...best.values()].map((b) => b.candidate);
}

/**
 * Schreibt, wo noch nichts steht, das Zielportfolio dieses Monats in das Vorwärtsprotokoll (je Arm und Profil höchstens ein
 * Eintrag pro Monat, der erste Abgleich des Monats zählt). Der Aufruf ist billig, wenn der Monat schon steht.
 * Kandidaten ohne Kurs in Euro kommen gar nicht erst ins Zielportfolio, damit kein Gewicht stillschweigend verloren geht.
 * @returns Anzahl der Positionen, die neu protokolliert wurden.
 */
export function logForward(db: Database, date: string, valued: ReadonlyMap<string, StockValuation>): number {
  const month = date.slice(0, 7);
  const bond = db.referenceRate(BOND_KEY);
  let unjudged: StockValuation[] | null = null;
  let logged = 0;
  for (const arm of FORWARD_ARMS) {
    for (const { name, profile } of PROFILES) {
      const key = `forward-log:${arm}:${name}`;
      if (db.setting(key) === month) continue;
      const withBond = withHurdle(profile, bond);
      const held = db.forwardLogWeights(arm, name, date);
      let candidates: Candidate[];
      if (arm === "urteil") candidates = judgedCandidates(db, valued, held);
      else {
        unjudged ??= numbersOnly(db, valued, date);
        candidates = numberCandidates(db, unjudged, held, withBond.minReturn);
      }
      const byId = new Map(candidates.map((c) => [c.id, c]));
      const rows = targetPortfolio(candidates, withBond).positions.map((position) => {
        const candidate = byId.get(position.id)!;
        return {
          stockId: position.id,
          weight: position.weight,
          innerReturn: candidate.innerReturn,
          riskScore: candidate.riskScore,
          priceEur: candidate.priceEur,
        };
      });
      db.saveForwardLog(date, arm, name, CALC_VERSION, rows, { key, value: month });
      logged += rows.length;
    }
  }
  return logged;
}
