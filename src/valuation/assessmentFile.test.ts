import { describe, expect, it } from "vitest";
import { EXCLUSION_SCORE } from "../calc/index.ts";
import { Database } from "../data/db.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import {
  assessmentUpdates,
  dossier,
  hasOpusAssessment,
  PREFILTER_RISK_MARGIN,
  parseAssessment,
  prefilterStock,
  prefilterUpdates,
  prefilterVerdict,
} from "./assessmentFile.ts";
import { assess, computeValuation } from "./run.ts";

/** Datenbank mit der Beispielaktie, Abschlüssen und einem Kurs, sodass eine Bewertung rechenbar ist. */
function withStock(): Database {
  const db = new Database(":memory:");
  db.addStockIfMissing(stock);
  db.saveFundamentals(stock.id, steadyYears(), "eodhd");
  db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 40 }]);
  return db;
}

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

  it("filtert vor: verwirft erst mit Puffer über dem Ausschluss, gemessen ohne Ersatzabzüge", () => {
    const limit = EXCLUSION_SCORE + PREFILTER_RISK_MARGIN;
    const base = { complete: true, missing: [], returns: null };
    expect(prefilterVerdict({ ...base, riskFloor: limit - 0.01 })).toMatchObject({
      verdict: "opus",
      reason: "Risikowert 84.0 % unter 85.0 %",
    });
    expect(prefilterVerdict({ ...base, riskFloor: limit })).toMatchObject({ verdict: "verworfen", reason: "Risikowert 85.0 % ab 85.0 %" });
    expect(prefilterVerdict({ ...base, complete: false, missing: ["risk.age"], riskFloor: 0.2 })).toMatchObject({
      verdict: "opus",
      reason: "unvollständig: risk.age",
    });
    // Ein offener Finanzwert-Faktor mit hohem Ersatzabzug verwirft nichts: Es zählt nur, was gesetzt ist.
    const db = withStock();
    const financial = { ...stock, isFinancial: true };
    db.addStockIfMissing({ ...financial, id: "BANK.US" });
    db.saveFundamentals("BANK.US", steadyYears(), "eodhd");
    db.saveRawCloses("BANK.US", [{ date: "2026-11-18", close: 40 }]);
    const v = computeValuation(db, { ...financial, id: "BANK.US" }, "2026-11-23").valuation;
    expect(v.riskScore).toBeGreaterThan(v.riskFloor);
    expect(prefilterVerdict(v).riskFloor).toBe(v.riskFloor);
    db.close();
  });

  it("setzt im Vorfilter nur fehlende oder von Haiku stammende Werte und lässt Opus-Titel aus", () => {
    const db = withStock();
    const note = "Haiku-Einschätzung vom 2026-11-23";
    db.setManualInput(stock.id, "risk.sector", 0.1, "eigene Recherche");
    db.setManualInput(stock.id, "risk.dependencies", 0.05, "Jev-Vorschlag vom 2026-11-20 übernommen");
    const raw = file({
      judgement: { sector: { value: 0 }, dependencies: { value: 0 }, moat: { value: 0.05 } },
      growth: { value: 0.02 },
    });
    expect(prefilterStock(db, stock, raw, "2026-11-23", note)).toMatchObject({ verdict: "opus" });
    const values = () => Object.fromEntries(db.manualInputs(stock.id).map((i) => [i.key, [i.value, i.note]]));
    expect(values()).toMatchObject({
      "risk.sector": [0.1, "eigene Recherche"],
      "risk.dependencies": [0.05, "Jev-Vorschlag vom 2026-11-20 übernommen"],
      "risk.moat": [0.05, note],
      growth: [0.02, note],
    });
    // Ein Mensch ändert einen Haiku-Wert; ein zweiter Lauf lässt ihn stehen und löscht den Haiku-Wert, den die Datei nicht mehr hat.
    assess(db, stock, [{ key: "risk.moat", value: 0.1 }], "2026-11-23");
    prefilterStock(db, stock, file({ judgement: { moat: { value: 0 } } }), "2026-11-24", note);
    expect(values()["risk.moat"]).toEqual([0.1, ""]);
    expect(values().growth).toBeUndefined();
    // Eine fehlerhafte Datei setzt nichts; ein Titel mit Opus-Bewertung wird übersprungen.
    expect(prefilterStock(db, stock, { stockId: "X" }, "2026-11-24", note)).toMatchObject({
      verdict: "opus",
      reason: expect.stringMatching(/^Datei fehlerhaft/),
      riskFloor: null,
    });
    db.setManualInput(stock.id, "risk.situation", 0, "Opus-Einschätzung vom 2026-11-24");
    expect(prefilterStock(db, stock, raw, "2026-11-24", note)).toEqual({ verdict: "übersprungen", reason: "schon mit Opus bewertet" });
    db.close();
  });

  it("setzt Haiku-Werte mit Notiz, und Opus ersetzt sie samt denen, die es offen lässt", () => {
    const db = withStock();
    const haiku = [
      { key: "risk.moat" as const, value: 0.05 },
      { key: "growth" as const, value: 0.02 },
    ];
    assess(db, stock, prefilterUpdates(db, stock.id, haiku, "Haiku-Einschätzung vom 2026-11-23"), "2026-11-23");
    expect(hasOpusAssessment(db, stock.id)).toBe(false);
    const opus = [{ key: "risk.moat" as const, value: -0.05 }];
    const updates = assessmentUpdates(db, stock.id, opus, "Opus-Einschätzung vom 2026-11-24");
    expect(updates).toEqual([
      { key: "risk.moat", value: -0.05, note: "Opus-Einschätzung vom 2026-11-24" },
      { key: "growth", value: null },
    ]);
    assess(db, stock, updates, "2026-11-24");
    expect(db.manualInputs(stock.id).map((i) => [i.key, i.value, i.note])).toEqual([
      ["risk.moat", -0.05, "Opus-Einschätzung vom 2026-11-24"],
    ]);
    expect(hasOpusAssessment(db, stock.id)).toBe(true);
    db.close();
  });

  it("stellt ein Dossier aus allem zusammen, was zur Bewertung gehört", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    expect(dossier(db, stock.id, "2026-11-23")).toMatchObject({ stock: { id: stock.id }, jev: null, research: null, fundamentals: [] });
    expect(() => dossier(db, "FEHLT.US", "2026-11-23")).toThrow(/Unbekannte Aktie/);
  });
});
