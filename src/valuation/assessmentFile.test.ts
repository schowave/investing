import { describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import { stock } from "../test/fixtures.ts";
import { dossier, parseAssessment } from "./assessmentFile.ts";

const file = (extra: Record<string, unknown> = {}) => ({
  stockId: stock.id,
  reportingCurrency: stock.reportingCurrency,
  judgement: { moat: { value: -0.05, reason: "Marke" }, situation: { value: 0.1, reason: "Gewinnwarnung" } },
  payoutLevel: { value: 1.5, proposal: 2, reason: "Rückkäufe gestoppt" },
  growth: null,
  ...extra,
});

describe("Bewertung als Datei", () => {
  it("übersetzt eine Ergebnisdatei in Werte von Hand, wie die Aktienseite sie annimmt", () => {
    const parsed = parseAssessment(file({ growth: { value: 0.03 } }), stock.reportingCurrency, 0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields).toEqual([
      { key: "risk.moat", value: -0.05 },
      { key: "risk.situation", value: 0.1 },
      { key: "payoutLevel", value: 1.5 },
      { key: "growth", value: 0.03 },
    ]);
  });

  it("nimmt Faktoren auch mit dem Schlüssel aus dem Dossier an und weist doppelte ab", () => {
    const judgement = { "risk.moat": { value: -0.05 }, situation: { value: 0.1 } };
    expect(parseAssessment(file({ judgement }), stock.reportingCurrency, 0).fields.slice(0, 2)).toEqual([
      { key: "risk.moat", value: -0.05 },
      { key: "risk.situation", value: 0.1 },
    ]);
    const twice = { moat: { value: 0 }, "risk.moat": { value: 0.05 } };
    expect(parseAssessment(file({ judgement: twice }), stock.reportingCurrency, 0).errors).toEqual(["risk.moat: doppelt angegeben"]);
    expect(parseAssessment(file({ judgement: { "risk.risk.moat": { value: 0 } } }), stock.reportingCurrency, 0).errors).toEqual([
      "risk.risk.moat: unbekannte Eingabe",
    ]);
  });

  it("weist falsche Währung, unbekannte Faktoren, Werte außerhalb der Grenzen und falsche Form ab", () => {
    expect(parseAssessment(file({ reportingCurrency: "XXX" }), stock.reportingCurrency, 0).errors[0]).toMatch(/Berichtswährung XXX/);
    expect(parseAssessment(file({ judgement: { mood: { value: 0 } } }), stock.reportingCurrency, 0).errors).toEqual([
      "risk.mood: unbekannte Eingabe",
    ]);
    expect(parseAssessment(file({ growth: { value: -0.55 } }), stock.reportingCurrency, 0).errors[0]).toMatch(/^growth=-55: Wachstum/);
    expect(parseAssessment({ stockId: "X" }, stock.reportingCurrency, 0).errors[0]).toMatch(/erwartete Form/);
  });

  it("stellt ein Dossier aus allem zusammen, was zur Bewertung gehört", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    expect(dossier(db, stock.id, "2026-11-23")).toMatchObject({ stock: { id: stock.id }, jev: null, research: null, fundamentals: [] });
    expect(() => dossier(db, "FEHLT.US", "2026-11-23")).toThrow(/Unbekannte Aktie/);
  });
});
