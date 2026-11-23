import { describe, expect, it } from "vitest";
import { stock } from "../test/fixtures.ts";
import { Database, sourceOfNote } from "./db.ts";

describe("Herkunft der Bewertung für den Datenvorrat", () => {
  it("nennt Opus vor Hand vor Haiku vor Jev, sonst einen offenen Jev-Vorschlag, und lässt Unbewertete weg", () => {
    const db = new Database(":memory:");
    for (const id of ["OPUS.US", "JEV.US", "HAND.US", "HAIKU.US", "VORSCHLAG.US", "LEER.US"]) db.addStockIfMissing({ ...stock, id });
    db.setManualInput("HAIKU.US", "risk.moat", 0.05, "Jev-Vorschlag vom 2026-11-20 übernommen");
    db.setManualInput("HAIKU.US", "growth", 0.02, "Haiku-Einschätzung vom 2026-11-23");
    expect(db.assessmentSources(["HAIKU.US"], 2).get("HAIKU.US")?.source).toBe("haiku");
    // Eine eigene Notiz, die nur mit „Haiku“ beginnt, ist kein Wert des Vorfilters.
    expect(sourceOfNote("Haiku-Test von Hand")).toBe("hand");
    expect(sourceOfNote("Opus: Restvermögen")).toBe("opus");
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
    const sources = db.assessmentSources(["OPUS.US", "JEV.US", "HAND.US", "VORSCHLAG.US", "LEER.US"], 2);
    expect(sources.get("OPUS.US")?.source).toBe("opus");
    expect(sources.get("JEV.US")?.source).toBe("jev");
    expect(sources.get("HAND.US")?.source).toBe("hand");
    expect(sources.get("VORSCHLAG.US")).toEqual({ source: "vorschlag", date: "2026-11-21" });
    expect(sources.has("LEER.US")).toBe(false);
    expect(db.assessmentSources([], 2)).toEqual(new Map());
    // Ein Jev-Urteil nach einer älteren Fassung der Stufen ist kein offener Vorschlag mehr.
    expect(db.assessmentSources(["VORSCHLAG.US"], 3).has("VORSCHLAG.US")).toBe(false);
  });

  it("filtert den Datenvorrat nach bewertet, mit Opus bewertet und unbewertet", () => {
    const db = new Database(":memory:");
    const ids = ["OPUS.US", "HAND.US", "LEER.US"];
    for (const id of ids) db.addStockIfMissing({ ...stock, id, watched: false });
    db.setManualInput("OPUS.US", "payoutLevel", 2, "Opus-Einschätzung vom 2026-11-23");
    db.setManualInput("HAND.US", "growth", 0.03, "");
    db.saveScreening(
      ids.map((stockId) => ({
        stockId,
        date: "2026-11-23",
        priceDate: "2026-11-20",
        price: 40,
        payoutLevel: 2,
        growth: 0.03,
        riskScore: 0.2,
        innerReturn: 0.1,
        implausible: false,
      })),
    );
    const listed = (assessed?: "bewertet" | "opus" | "haiku" | "offen") =>
      db
        .screening({ assessed }, 10, 0)
        .map((r) => r.stock.id)
        .sort();
    expect(listed()).toEqual(["HAND.US", "LEER.US", "OPUS.US"]);
    expect(listed("bewertet")).toEqual(["HAND.US", "OPUS.US"]);
    expect(listed("opus")).toEqual(["OPUS.US"]);
    expect(listed("haiku")).toEqual([]);
    db.setManualInput("HAND.US", "risk.moat", 0.05, "Haiku-Einschätzung vom 2026-11-23");
    db.setManualInput("OPUS.US", "risk.moat", 0.05, "Haiku-Einschätzung vom 2026-11-23");
    // Mit Opus bewertete zählen nicht mehr als nur vorgefiltert.
    expect(listed("haiku")).toEqual(["HAND.US"]);
    expect(listed("offen")).toEqual(["LEER.US"]);
    expect(db.countScreening({ assessed: "offen" })).toBe(1);
  });
});
