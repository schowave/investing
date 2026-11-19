import { describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import { fakeEodhd, status } from "../test/eodhd.ts";
import { stock } from "../test/fixtures.ts";
import { runNextJob, runWorker } from "./worker.ts";

const deps = (fetchFn: typeof fetch) => ({ token: "t", fetchFn, now: () => new Date("2026-11-19T10:00:00Z") });

describe("Worker", () => {
  it("führt einen Lauf aus und speichert Ergebnis, Protokoll und Fortschritt", async () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    const fetchFn = fakeEodhd({ "div/*": [], "splits/*": [], "eod/*": [{ date: "2025-01-31", close: 10 }] });
    expect(await runNextJob(db, deps(fetchFn))).toBe(false);
    const { id } = db.enqueueJob("history", { refresh: false });
    expect(await runNextJob(db, deps(fetchFn))).toBe(true);
    const job = db.job(id)!;
    expect(job).toMatchObject({ status: "done", summary: "3 Historien geladen, 0 fehlgeschlagen", progressDone: 3, progressTotal: 3 });
    expect(job.log).toContain("3 Abrufe für 1 Aktien");
  });

  it("meldet einen gescheiterten Lauf und unbekannte Arten", async () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    const failing = db.enqueueJob("history", { refresh: false }).id;
    await runNextJob(db, deps(fakeEodhd({ "*": status(500) })));
    expect(db.job(failing)).toMatchObject({ status: "failed", summary: expect.stringContaining("3 fehlgeschlagen") });

    const unknown = db.enqueueJob("gibt-es-nicht", {}).id;
    await runNextJob(db, deps(fakeEodhd({})));
    expect(db.job(unknown)).toMatchObject({ status: "failed", summary: "Unbekannte Art von Lauf: gibt-es-nicht" });

    const invalid = db.enqueueJob("stock-refresh", { id: "" }).id;
    await runNextJob(db, deps(fakeEodhd({})));
    expect(db.job(invalid)!.status).toBe("failed");
  });

  it("hört auf Abbruch und markiert den Lauf als abgebrochen", async () => {
    const db = new Database(":memory:");
    for (const id of ["A.US", "B.US", "C.US"]) db.addStockIfMissing({ ...stock, id });
    const { id } = db.enqueueJob("history", { refresh: false });
    const fetchFn = fakeEodhd({
      "*": () => {
        db.requestJobCancel(id);
        return Response.json([]);
      },
    });
    await runNextJob(db, deps(fetchFn));
    expect(db.job(id)!.status).toBe("cancelled");
    expect(fetchFn.calls.length).toBeLessThan(9);
  });

  it("räumt beim Start unterbrochene Läufe auf und endet mit dem Signal", async () => {
    const db = new Database(":memory:");
    const orphan = db.enqueueJob("refresh-all", {}).id;
    db.claimNextJob();
    const stop = new AbortController();
    const running = runWorker(db, deps(fakeEodhd({})), stop.signal, 5);
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop.abort();
    await running;
    expect(db.job(orphan)!.status).toBe("failed");
  });
});
