import { describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import { runJob } from "../jobs/registry.ts";
import { fakeEodhd, testContext } from "../test/eodhd.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { enqueueRecomputeIfOutdated, RECOMPUTE_JOB, recomputeAll, stalePrice } from "./recompute.ts";
import { assess, CALC_VERSION, computeValuation, storedBaseline } from "./run.ts";

describe("Split nach dem letzten Abschluss", () => {
  it("meldet ihn, solange nicht erkennbar ist, ob die Zahlen bereinigt sind", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 5 }]);
    expect(computeValuation(db, stock, "2026-11-19").proposals.details.unadjustedSplit).toBeNull();
    db.saveSplits(stock.id, [{ date: "2026-11-01", ratio: 8 }]);
    const { proposals } = computeValuation(db, stock, "2026-11-19");
    expect(proposals.details.unadjustedSplit).toEqual({ date: "2026-11-01", ratio: 8 });
    expect(proposals.notes).toContainEqual(expect.stringMatching(/nach dem letzten Abschluss \(2025\)/));
    // Ein Split, der erst nach dem Stichtag liegt, zählt nicht.
    expect(computeValuation(db, stock, "2026-10-31").proposals.details.unadjustedSplit).toBeNull();
  });
});

function prepared() {
  const db = new Database(":memory:");
  db.addStockIfMissing(stock);
  db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
  db.addStockIfMissing({ ...stock, id: "GEHALTEN.US", watched: false });
  for (const id of [stock.id, "VORRAT.US", "GEHALTEN.US"]) {
    db.saveFundamentals(id, steadyYears(), "eodhd");
    db.saveRawCloses(id, [{ date: "2026-11-18", close: 40 }]);
  }
  db.setHolding(db.createPortfolio("Depot", "fokussiert"), "GEHALTEN.US", 5);
  return db;
}

describe("veralteter Kurs im Datenvorrat", () => {
  it("gilt mehr als 30 Tage hinter dem jüngsten Kurs derselben Börse als unbrauchbar", () => {
    expect(stalePrice("2026-10-20", "2026-11-19")).toBe(false);
    expect(stalePrice("2026-10-19", "2026-11-19")).toBe(true);
    expect(stalePrice(null, "2026-11-19")).toBe(false);
    expect(stalePrice("2026-10-19", undefined)).toBe(false);
    const db = prepared();
    db.addStockIfMissing({ ...stock, id: "ALT.US", watched: false });
    db.saveFundamentals("ALT.US", steadyYears(), "eodhd");
    db.saveRawCloses("ALT.US", [{ date: "2026-06-18", close: 40 }]);
    recomputeAll(db, "2026-11-19");
    expect(db.screening({}, 10, 0).map((r) => r.stock.id)).not.toContain("ALT.US");
    // Veralten alle Kurse einer Börse gemeinsam (Abgleich ausgesetzt, alte Kopie), ist das kein Datenfehler.
    recomputeAll(db, "2027-03-01");
    expect(db.screening({}, 10, 0).map((r) => r.stock.id)).toContain("VORRAT.US");
  });
});

describe("recomputeAll", () => {
  it("speichert Tagesstände für beobachtete und gehaltene Titel, Screening für alle und die Portfolios", () => {
    const db = prepared();
    expect(recomputeAll(db, "2026-11-19")).toEqual({ valuations: 2, screened: 3, portfolios: 1, valuationErrors: [] });
    expect(db.valuationHistory(stock.id, 5).map((v) => v.date)).toEqual(["2026-11-19"]);
    expect(db.valuationHistory("GEHALTEN.US", 5)).toHaveLength(1);
    expect(db.valuationHistory("VORRAT.US", 5)).toEqual([]);
    expect(
      db
        .screening({}, 10)
        .map((r) => r.stock.id)
        .sort(),
    ).toEqual(["GEHALTEN.US", "TEST.US", "VORRAT.US"]);
    expect(db.portfolioSnapshots(db.portfolios()[0]!.id, 5)).toHaveLength(1);
    expect(db.setting("calc-version")).toBe(String(CALC_VERSION));
    db.close();
  });

  it("wird nach einer neuen Version der Rechnung einmal eingestellt", async () => {
    const db = prepared();
    expect(enqueueRecomputeIfOutdated(db)).toBe(true);
    expect(db.activeJobs().map((j) => j.kind)).toEqual([RECOMPUTE_JOB]);
    // Schon eingestellt: kein zweiter Lauf.
    enqueueRecomputeIfOutdated(db);
    expect(db.activeJobs()).toHaveLength(1);

    const result = await runJob(testContext(db, fakeEodhd({})).ctx, RECOMPUTE_JOB, {});
    expect(result).toEqual({ summary: "2 Bewertungen, 3 Titel im Screening, 1 Portfolios neu gerechnet", ok: true });
    expect(enqueueRecomputeIfOutdated(db)).toBe(false);
    db.close();
  });

  it("merkt sich bei leerer Datenbank nur die Version", () => {
    const db = new Database(":memory:");
    expect(enqueueRecomputeIfOutdated(db)).toBe(false);
    expect(db.activeJobs()).toEqual([]);
    expect(db.setting("calc-version")).toBe(String(CALC_VERSION));
    db.close();
  });

  it("lässt den Prüfstand von heute aus einer älteren Rechnung stehen", () => {
    const db = prepared();
    assess(db, stock, [{ key: "risk.moat", value: 0.05 }], "2026-11-19");
    // Vor dem Deployment gespeichert: andere Version, anderer Rückfluss.
    const old = computeValuation(db, stock, "2026-11-19").proposals;
    db.saveValuation(stock.id, "2026-11-19", {
      complete: true,
      price: 40,
      riskScore: 0,
      innerReturn: null,
      innerReturnCautious: null,
      innerReturnOptimistic: null,
      details: { calcVersion: CALC_VERSION - 1, proposals: { ...old, values: { ...old.values, payoutLevel: 9 } } },
    });
    expect(recomputeAll(db, "2026-11-19").valuations).toBe(1);
    expect(storedBaseline(db.valuationDetailsAsOf(stock.id, "2026-11-19"))?.calcVersion).toBe(CALC_VERSION - 1);
    expect(computeValuation(db, stock, "2026-11-19").review).toMatchObject({
      calcChanged: true,
      changes: [expect.stringMatching(/^Rückfluss/)],
    });
    db.close();
  });

  it("rechnet weiter, wenn ein Titel scheitert, und meldet ihn", async () => {
    const db = prepared();
    const fundamentals = db.fundamentals.bind(db);
    db.fundamentals = (id: string) => {
      if (id === "VORRAT.US") throw new Error("kaputt");
      return fundamentals(id);
    };
    const report = recomputeAll(db, "2026-11-19");
    expect(report.valuationErrors).toEqual([{ id: "VORRAT.US", error: "kaputt" }]);
    expect(report.screened).toBe(2);
    expect(db.setting("calc-version")).toBe(String(CALC_VERSION));
    const job = await runJob(testContext(db, fakeEodhd({})).ctx, RECOMPUTE_JOB, {});
    expect(job).toMatchObject({ ok: false, summary: expect.stringMatching(/1 nicht bewertet$/) });
    db.close();
  });
});
