import { describe, expect, it } from "vitest";
import { stock } from "../test/fixtures.ts";
import { Database } from "./db.ts";
import { FUNDAMENTALS_KIND } from "./eodhdSnapshot.ts";
import { backfillIsins } from "./listings.ts";

describe("ISIN aus gespeicherten Abschlüssen", () => {
  it("ergänzt fehlende ISINs ohne Abruf und überspringt ungültige", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing({ ...stock, id: "A.US" });
    db.addStockIfMissing({ ...stock, id: "B.US" });
    db.addStockIfMissing({ ...stock, id: "C.US" });
    db.saveRawDocument("A.US", FUNDAMENTALS_KIND, JSON.stringify({ General: { ISIN: "us0378331005" } }));
    db.saveRawDocument("B.US", FUNDAMENTALS_KIND, JSON.stringify({ General: { ISIN: "kaputt" } }));
    db.saveRawDocument("C.US", FUNDAMENTALS_KIND, "kein JSON");
    expect(backfillIsins(db, ["A.US", "B.US", "C.US"])).toBe(1);
    expect(db.stock("A.US")!.isin).toBe("US0378331005");
    expect(db.stock("B.US")!.isin).toBeNull();
    // Schon vorhandene ISINs bleiben unberührt.
    expect(backfillIsins(db, ["A.US", "B.US", "C.US"])).toBe(0);
  });
});
