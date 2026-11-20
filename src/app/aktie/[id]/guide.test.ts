import { describe, expect, it } from "vitest";
import { FACTOR_QUESTIONS, JUDGED_FACTORS } from "../../../judgement/factors.ts";
import { guideFor } from "./guide.ts";

describe("guideFor", () => {
  it.each(JUDGED_FACTORS)("zeigt für %s jede Stufe von Jev mit ihrem Wert", (factor) => {
    const guide = guideFor(`risk.${factor}`, true);
    expect(guide?.sources.length).toBeGreaterThan(0);
    expect(guide?.levels?.map((level) => level.value)).toEqual(FACTOR_QUESTIONS[factor].levels.map((level) => level.value));
    for (const level of guide?.levels ?? []) expect(level.text).not.toBe("");
  });

  it("hilft bei Rückfluss und Wachstum mit Quellen", () => {
    expect(guideFor("payoutLevel", true)?.sources.length).toBeGreaterThan(0);
    expect(guideFor("growth", true)?.sources.length).toBeGreaterThan(0);
  });

  it("hilft bei Faktoren aus Zahlen nur, wenn sie Urteil sind (Finanzwerte)", () => {
    expect(guideFor("risk.financing", false)).toBeNull();
    expect(guideFor("risk.financing", true)?.sources[0]).toContain("CET1");
    expect(guideFor("risk.size", true)).toBeNull();
  });
});
