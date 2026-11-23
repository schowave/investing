import { describe, expect, it } from "vitest";
import type { ForwardLogEntry, ForwardRankingEntry } from "../data/db.ts";
import {
  dividendsSinceEur,
  groupRankings,
  groupSnapshots,
  overlap,
  rankingResult,
  snapshotResult,
  splitFactorSince,
} from "./forwardReport.ts";

const entry = (over: Partial<ForwardLogEntry>): ForwardLogEntry => ({
  date: "2026-11-01",
  arm: "zahlen",
  profile: "fokussiert",
  stockId: "A.US",
  weight: 0.5,
  innerReturn: 0.1,
  riskScore: 0.2,
  priceEur: 100,
  calcVersion: 8,
  strategyVersion: "1.0",
  ...over,
});

describe("Vorwärtsprotokoll auswerten", () => {
  const snapshots = groupSnapshots([
    entry({}),
    entry({ stockId: "B.US", weight: 0.3, priceEur: 50 }),
    entry({ arm: "urteil", stockId: "A.US", weight: 0.4 }),
    entry({ date: "2026-12-01" }),
  ]);

  it("fasst die Einträge je Datum, Arm und Profil zusammen", () => {
    expect(snapshots).toHaveLength(3);
    expect(snapshots[0]!.positions.map((p) => p.stockId)).toEqual(["A.US", "B.US"]);
    expect(snapshots[0]!.strategyVersion).toBe("1.0");
  });

  it("rechnet die Kursrendite gewichtet, Bargeld zählt null", () => {
    const result = snapshotResult(snapshots[0]!, (id) => (id === "A.US" ? 120 : 40));
    // 0,5 · 20 % + 0,3 · (−20 %) = 4 %
    expect(result.priceReturn).toBeCloseTo(0.04);
    expect(result.invested).toBeCloseTo(0.8);
    expect(result.covered).toBe(1);
    expect(result.positions).toBe(2);
  });

  it("zählt Titel ohne aktuellen Kurs als null und nennt, wie viel gedeckt ist", () => {
    const result = snapshotResult(snapshots[0]!, (id) => (id === "A.US" ? 120 : null));
    expect(result.priceReturn).toBeCloseTo(0.1);
    expect(result.covered).toBeCloseTo(0.5 / 0.8);
  });

  it("meldet 0 Deckung für ein leeres Portfolio", () => {
    expect(snapshotResult({ date: "d", arm: "a", profile: "p", strategyVersion: "1.0", positions: [] }, () => 1)).toMatchObject({
      covered: 0,
      invested: 0,
    });
  });

  it("misst die Überschneidung zweier Arme als Summe der kleineren Gewichte", () => {
    expect(overlap(snapshots[0]!, snapshots[1]!)).toBeCloseTo(0.4);
    expect(overlap(snapshots[1]!, snapshots[0]!)).toBeCloseTo(0.4);
  });
});

describe("Gesamtrendite mit Ausschüttungen", () => {
  const snapshot = groupSnapshots([entry({}), entry({ stockId: "B.US", weight: 0.3, priceEur: 50 })])[0]!;
  const now = (id: string) => ({ "A.US": 110, "B.US": 40 })[id] ?? null;

  it("zählt Ausschüttungen seit dem Eintrag zur Kursrendite, gewichtet", () => {
    const dividends = (id: string, since: string) => (since === "2026-11-01" ? ({ "A.US": 5, "B.US": 1 }[id] ?? 0) : 0);
    const r = snapshotResult(snapshot, now, dividends);
    expect(r.priceReturn).toBeCloseTo(0.5 * 0.1 + 0.3 * -0.2, 10);
    expect(r.totalReturn).toBeCloseTo(0.5 * 0.15 + 0.3 * -0.18, 10);
  });

  it("lässt Ausschüttungen ohne Angabe weg und rechnet dann Gesamt- gleich Kursrendite", () => {
    const r = snapshotResult(snapshot, now);
    expect(r.totalReturn).toBeCloseTo(r.priceReturn, 12);
  });

  it("zählt Ausschüttungen eines Titels ohne aktuellen Kurs nicht", () => {
    const r = snapshotResult(
      snapshot,
      () => null,
      () => 7,
    );
    expect(r.totalReturn).toBe(0);
  });
});

describe("Ausschüttungen in Euro", () => {
  const perEur = (c: string) => ({ USD: 1.1, GBP: 0.9 })[c] ?? null;
  const payments = [
    { date: "2026-10-01", value: 9, currency: "USD" }, // vor dem Eintrag
    { date: "2026-11-01", value: 9, currency: "USD" }, // Ex-Tag am Tag des Eintrags: der Kurs enthält sie schon nicht mehr dazu
    { date: "2026-11-10", value: 1.1, currency: "USD" },
    { date: "2026-11-12", value: 90, currency: "GBX" }, // Pence
    { date: "2026-11-15", value: 5, currency: "XXX" }, // ohne Wechselkurs
    { date: "2027-02-01", value: 9, currency: "USD" }, // angekündigt, noch nicht gezahlt
  ];

  it("summiert nur Zahlungen nach dem Eintrag bis heute und rechnet Pence und Fremdwährung um", () => {
    expect(dividendsSinceEur(payments, "2026-11-01", "2026-11-20", perEur)).toBeCloseTo(1.1 / 1.1 + 0.9 / 0.9, 10);
  });

  it("liefert 0 ohne Zahlungsreihe", () => {
    expect(dividendsSinceEur(null, "2026-11-01", "2026-11-20", perEur)).toBe(0);
  });
});

describe("Rangliste auswerten", () => {
  const ranked = (rank: number, priceEur = 100): ForwardRankingEntry => ({
    date: "2026-11-01",
    arm: "zahlen",
    rank,
    stockId: `S${rank}.US`,
    innerReturn: 0.2 - rank / 1000,
    riskScore: 0.2,
    sector: "Industrie",
    region: "USA",
    priceEur,
    calcVersion: 8,
    strategyVersion: "1.0",
  });

  it("fasst die Rangliste je Tag und Arm zusammen", () => {
    const snapshots = groupRankings([ranked(1), ranked(2), { ...ranked(1), arm: "urteil" }, { ...ranked(1), date: "2026-12-01" }]);
    expect(snapshots.map((s) => `${s.date}|${s.arm}|${s.entries.length}`)).toEqual([
      "2026-11-01|zahlen|2",
      "2026-11-01|urteil|1",
      "2026-12-01|zahlen|1",
    ]);
  });

  it("mittelt die Rendite je Rangbereich gleich gewichtet und zählt nur Titel mit Kurs", () => {
    const snapshot = groupRankings([1, 2, 10, 11, 30, 31, 100].map((r) => ranked(r)))[0]!;
    // Rang 1 +10 %, 2 +20 %, 10 ohne Kurs; 11 +50 %; 31 und 100 je −10 %
    const returns: Record<string, number | null> = {
      "S1.US": 0.1,
      "S2.US": 0.2,
      "S10.US": null,
      "S11.US": 0.5,
      "S30.US": 0.3,
      "S31.US": -0.1,
      "S100.US": -0.1,
    };
    const result = rankingResult(snapshot, (id) => returns[id] ?? null);
    expect(result.map((g) => [g.from, g.to, g.covered])).toEqual([
      [1, 10, 2],
      [11, 30, 2],
      [31, 100, 2],
    ]);
    expect(result[0]!.meanReturn).toBeCloseTo(0.15, 10);
    expect(result[1]!.meanReturn).toBeCloseTo(0.4, 10);
    expect(result[2]!.meanReturn).toBeCloseTo(-0.1, 10);
  });

  it("meldet für einen Rangbereich ohne Titel keine Rendite", () => {
    const snapshot = groupRankings([ranked(1)])[0]!;
    const result = rankingResult(snapshot, () => 0.1);
    expect(result[1]).toEqual({ from: 11, to: 30, covered: 0, meanReturn: null });
  });

  it("überspringt Einträge ohne Kurs am Tag des Eintrags", () => {
    const snapshot = groupRankings([ranked(1, 0), ranked(2)])[0]!;
    expect(rankingResult(snapshot, () => 0.1)[0]!.covered).toBe(1);
  });
});

describe("Splits seit dem Eintrag", () => {
  const splits = [
    { date: "2026-10-01", ratio: 4 }, // vor dem Eintrag
    { date: "2026-11-01", ratio: 4 }, // am Tag des Eintrags: der Kurs von damals ist schon nach dem Split
    { date: "2026-11-10", ratio: 2 },
    { date: "2026-11-15", ratio: 0.1 }, // Zusammenlegung 10:1
    { date: "2027-02-01", ratio: 3 }, // angekündigt
  ];

  it("multipliziert die Verhältnisse nach dem Eintrag bis heute", () => {
    expect(splitFactorSince(splits, "2026-11-01", "2026-11-20")).toBeCloseTo(0.2, 12);
    expect(splitFactorSince([], "2026-11-01", "2026-11-20")).toBe(1);
  });

  it("rechnet den Kurs von damals auf den heutigen Splitstand um, bei Kurs und Gesamtrendite", () => {
    const snapshot = groupSnapshots([entry({ weight: 1, priceEur: 100 })])[0]!;
    // Split 2:1 nach dem Eintrag: der Kurs fällt auf 55, das ist +10 %; dazu 1 Euro Ausschüttung nach Split
    const r = snapshotResult(
      snapshot,
      () => 55,
      () => 1,
      () => 2,
    );
    expect(r.priceReturn).toBeCloseTo(0.1, 10);
    expect(r.totalReturn).toBeCloseTo(0.12, 10);
  });

  it("rechnet auch die Rangbereiche mit dem Splitfaktor", () => {
    const snapshot = { date: "2026-11-01", arm: "zahlen", strategyVersion: "1.0", entries: [{ rank: 1, stockId: "A.US", priceEur: 100 }] };
    const result = rankingResult(snapshot, (_id, entryPrice) => 55 / (entryPrice / 2) - 1);
    expect(result[0]!.meanReturn).toBeCloseTo(0.1, 10);
  });
});
