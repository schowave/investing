import { describe, expect, it } from "vitest";
import { stock } from "../test/fixtures.ts";
import { Database } from "./db.ts";

describe("Herkunft der Bewertung für den Datenvorrat", () => {
  it("nennt Opus vor Hand vor Jev, sonst einen offenen Jev-Vorschlag, und lässt Unbewertete weg", () => {
    const db = new Database(":memory:");
    for (const id of ["OPUS.US", "JEV.US", "HAND.US", "VORSCHLAG.US", "LEER.US"]) db.addStockIfMissing({ ...stock, id });
    db.setManualInput("OPUS.US", "risk.moat", 0.05, "Jev-Vorschlag vom 2026-11-20 übernommen");
    db.setManualInput("OPUS.US", "payoutLevel", 2, "Opus-Einschätzung vom 2026-11-23");
    db.setManualInput("JEV.US", "risk.moat", 0.05, "Jev-Vorschlag vom 2026-11-20 übernommen");
    db.setManualInput("HAND.US", "growth", 0.03, "");
    db.saveJudgement("VORSCHLAG.US", {
      createdAt: "2026-11-21T10:00:00Z",
      jevModel: "jev",
      researchModel: null,
      research: null,
      researchedAt: null,
      sources: [],
      proposals: {},
      levelsVersion: 2,
    });
    const sources = db.assessmentSources(["OPUS.US", "JEV.US", "HAND.US", "VORSCHLAG.US", "LEER.US"]);
    expect(sources.get("OPUS.US")?.source).toBe("opus");
    expect(sources.get("JEV.US")?.source).toBe("jev");
    expect(sources.get("HAND.US")?.source).toBe("hand");
    expect(sources.get("VORSCHLAG.US")).toEqual({ source: "vorschlag", date: "2026-11-21" });
    expect(sources.has("LEER.US")).toBe(false);
    expect(db.assessmentSources([])).toEqual(new Map());
  });
});
