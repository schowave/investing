import { describe, expect, it } from "vitest";
import { Database } from "./db.ts";

describe("Warteschlange der Läufe", () => {
  it("stellt ein, fasst gleiche Läufe zusammen und arbeitet in Reihenfolge ab", () => {
    const db = new Database(":memory:");
    expect(db.enqueueJob("sync", {})).toEqual({ id: 1, existing: false });
    expect(db.enqueueJob("sync", {})).toEqual({ id: 1, existing: true });
    expect(db.enqueueJob("history", { refresh: false })).toEqual({ id: 2, existing: false });
    expect(db.enqueueJob("history", { refresh: true })).toEqual({ id: 3, existing: false });
    expect(db.activeJobs().map((j) => j.id)).toEqual([1, 2, 3]);

    const first = db.claimNextJob()!;
    expect(first).toMatchObject({ id: 1, status: "running" });
    expect(first.startedAt).not.toBeNull();
    // Läuft er schon, bekommt ein zweiter Klick denselben Lauf.
    expect(db.enqueueJob("sync", {})).toEqual({ id: 1, existing: true });
    db.updateJobProgress(1, { done: 2, total: 5, log: "a\nb" });
    expect(db.job(1)).toMatchObject({ progressDone: 2, progressTotal: 5, log: "a\nb" });
    db.finishJob(1, "done", "fertig", "a\nb\nc");
    expect(db.job(1)).toMatchObject({ status: "done", summary: "fertig" });
    expect(db.enqueueJob("sync", {}).existing).toBe(false);
    expect(db.claimNextJob()!.id).toBe(2);
    expect(db.jobs(2).map((j) => j.id)).toEqual([4, 3]);
  });

  it("bricht wartende sofort ab, laufende auf Anfrage, unterbrochene beim Neustart", () => {
    const db = new Database(":memory:");
    const queued = db.enqueueJob("history", { refresh: false }).id;
    db.requestJobCancel(queued);
    expect(db.job(queued)).toMatchObject({ status: "cancelled" });

    const running = db.enqueueJob("refresh-all", {}).id;
    db.claimNextJob();
    expect(db.isJobCancelRequested(running)).toBe(false);
    db.requestJobCancel(running);
    expect(db.isJobCancelRequested(running)).toBe(true);
    expect(db.job(running)!.status).toBe("running");

    expect(db.failOrphanedJobs()).toBe(1);
    expect(db.job(running)).toMatchObject({ status: "failed", summary: expect.stringContaining("neu gestartet") });
    expect(db.claimNextJob()).toBeNull();
    expect(db.job(999)).toBeNull();
    db.requestJobCancel(999);
  });
});
