import { describe, expect, it } from "vitest";
import type { ForwardLogEntry } from "../data/db.ts";
import { groupSnapshots, overlap, snapshotResult } from "./forwardReport.ts";

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
