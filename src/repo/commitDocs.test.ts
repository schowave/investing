import { describe, expect, it } from "vitest";
import { type CommitInput, commitProblems, isStrategyCode, isToolCode, NO_EFFECT_TRAILER, newVersionFromDiff } from "./commitDocs.ts";

const m = (path: string) => ({ path, status: "M" });
const a = (path: string) => ({ path, status: "A" });
const d = (path: string) => ({ path, status: "D" });
const commit = (input: Partial<CommitInput>): string[] => commitProblems({ files: [], message: "Titel\n", newVersion: null, ...input });
const FIGURES = "Median der Fenster +70 %, in 72 % der Fenster besser, Güte 0,8, Umschlag 60 %, größter Rückgang −30 %";

describe("Einordnung der Pfade", () => {
  it("trennt Regel-Code, Werkzeuge und den Rest; Tests zählen nicht", () => {
    for (const path of ["src/calc/portfolio.ts", "src/valuation/run.ts", "src/valuation/portfolioView.ts", "src/judgement/factors.ts"])
      expect(isStrategyCode(path), path).toBe(true);
    for (const path of ["src/backtest/simulate.ts", "src/valuation/forwardLog.ts", "scripts/backtest.ts"])
      expect(isToolCode(path), path).toBe(true);
    for (const path of ["src/calc/calc.test.ts", "src/valuation/strategyDocument.ts", "src/app/page.tsx"]) {
      expect(isStrategyCode(path), path).toBe(false);
      expect(isToolCode(path), path).toBe(false);
    }
  });
});

describe("commitProblems", () => {
  it("lässt Commits ohne Regel-Code durch", () => {
    expect(commit({ files: [m("src/app/page.tsx"), m("README.md")] })).toEqual([]);
  });

  it("verlangt bei Regel-Code die Strategie, die Spezifikation allein genügt nicht", () => {
    expect(commit({ files: [m("src/calc/risk.ts")] })[0]).toContain("src/calc/risk.ts");
    expect(commit({ files: [m("src/calc/risk.ts"), m("docs/SPEZIFIKATION.md")] })).toHaveLength(1);
    expect(commit({ files: [m("src/calc/risk.ts"), m("docs/STRATEGIE.md")] })).toEqual([]);
  });

  it("verlangt bei Werkzeugen eines der beiden Dokumente", () => {
    expect(commit({ files: [m("scripts/forward.ts")] })[0]).toContain("Werkzeug");
    expect(commit({ files: [m("scripts/forward.ts"), m("docs/SPEZIFIKATION.md")] })).toEqual([]);
    expect(commit({ files: [m("src/backtest/run.ts"), m("docs/STRATEGIE.md")] })).toEqual([]);
  });

  it("nimmt die Kennzeichnung ohne Wirkung an, aber nicht in einer Kommentarzeile", () => {
    const files = [m("src/calc/risk.ts")];
    expect(commit({ files, message: `Umbau\n\n${NO_EFFECT_TRAILER}: nur umbenannt\n` })).toEqual([]);
    expect(commit({ files, message: `Umbau\n# ${NO_EFFECT_TRAILER}\n` })).toHaveLength(1);
    expect(commit({ files, message: `Umbau\n; ${NO_EFFECT_TRAILER}\n`, commentChar: ";" })).toHaveLength(1);
    const scissors = `Umbau\n# ------------------------ >8 ------------------------\n${NO_EFFECT_TRAILER}\n`;
    expect(commit({ files, message: scissors })).toHaveLength(1);
  });

  it("lässt Merges und fixup/squash durch, prüft aber Reverts", () => {
    const files = [m("src/calc/risk.ts")];
    expect(commit({ files, merge: true })).toEqual([]);
    for (const message of ["fixup! z", "squash! z"]) expect(commit({ files, message })).toEqual([]);
    expect(commit({ files, message: 'Revert "y"' })).toHaveLength(1);
  });

  it("verlangt bei neuer Version Strategie, Protokoll, den Abdruck genau dieser Version und alle Kennzahlen", () => {
    const problems = commit({
      files: [m("src/valuation/run.ts"), m("docs/STRATEGIE.md"), a("src/valuation/imprints/strategie-1.2.json")],
      newVersion: "1.1",
    }).join(" ");
    expect(problems).toContain("STRATEGIE-AENDERUNGEN.md");
    expect(problems).toContain("strategie-1.1.json ist nicht neu");
    expect(problems).toContain("Median, besser, Güte, Umschlag, Rückgang");
    expect(
      commit({
        files: [
          m("src/valuation/run.ts"),
          m("docs/STRATEGIE.md"),
          m("docs/STRATEGIE-AENDERUNGEN.md"),
          a("src/valuation/imprints/strategie-1.1.json"),
        ],
        message: `Neue Regel\n\n${FIGURES}\n`,
        newVersion: "1.1",
      }),
    ).toEqual([]);
  });

  it("verlangt für einen neu geschriebenen Abdruck ohne neue Version die Kennzeichnung", () => {
    const files = [m("src/valuation/imprints/strategie-1.0.json"), m("src/valuation/valuation.ts"), m("docs/STRATEGIE.md")];
    expect(commit({ files })[0]).toContain("ohne dass die Version steigt");
    expect(commit({ files, message: `Fix\n\n${NO_EFFECT_TRAILER}\n` })).toEqual([]);
  });

  it("lehnt gelöschte Abdrücke ab", () => {
    expect(commit({ files: [d("src/valuation/imprints/strategie-1.0.json")], message: `x\n\n${NO_EFFECT_TRAILER}\n` })[0]).toContain(
      "gelöscht",
    );
  });
});

describe("newVersionFromDiff", () => {
  it("liest die neue Version aus der hinzugefügten Zeile", () => {
    expect(newVersionFromDiff('-export const STRATEGY_VERSION = "1.0";\n+export const STRATEGY_VERSION = "1.1";\n')).toBe("1.1");
    expect(newVersionFromDiff("+export const CALC_VERSION = 10;\n")).toBeNull();
    expect(newVersionFromDiff("")).toBeNull();
  });
});
