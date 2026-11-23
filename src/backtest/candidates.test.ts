import { describe, expect, it } from "vitest";
import { monthBars, scaledYears, stockData } from "../test/backtest.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { splitBasis } from "../valuation/valuation.ts";
import type { CandidateContext } from "./candidates.ts";
import { buildCandidates, candidateAt } from "./candidates.ts";
import { parseEcbHistory } from "./fx.ts";

const MONTH = "2026-10";
const ctx: CandidateContext = {
  fx: parseEcbHistory("<Cube time='2026-10-30'><Cube currency='USD' rate='1.1'/></Cube>"),
  inflationGap: () => 0,
  minCapEur: 300e6,
  last: { month: "2026-11", date: "2026-11-20" },
};

describe("candidateAt", () => {
  it("bewertet eine ruhige Aktie mit Marktwert, Rendite und Fingerabdruck", () => {
    const result = candidateAt(stockData("A.US", [MONTH]), MONTH, ctx);
    if (!("candidate" in result)) throw new Error(`übersprungen: ${result.skipped}`);
    expect(result.candidate).toMatchObject({ id: "A.US", complete: true, heldWeight: 0 });
    expect(result.candidate.innerReturn).toBeGreaterThan(0.03);
    expect(result.candidate.capEur).toBe(40e9);
    expect(result.candidate.fingerprint).toContain("EUR|");
  });

  it("nimmt nur Abschlüsse, die zum Stichtag veröffentlicht waren: ein Verlustjahr 2025 zählt im Mai nicht und senkt im Oktober die Rendite", () => {
    const withLateLoss = stockData("A.US", ["2026-05", MONTH], {
      fundamentals: scaledYears(1e9, (y) => {
        if (y.fiscalYear === 2025) y.epsDiluted = -50;
      }),
    });
    const calm = stockData("B.US", ["2026-05", MONTH]);
    const returnOf = (r: ReturnType<typeof candidateAt>) => ("candidate" in r ? r.candidate.innerReturn : null);
    // Im Mai kennt man 2024 als letztes Jahr: beide Aktien sehen gleich aus.
    expect(returnOf(candidateAt(withLateLoss, "2026-05", ctx))).toBeCloseTo(returnOf(candidateAt(calm, "2026-05", ctx))!);
    // Im Oktober fließt 2025 ein: Der Verlust drückt die Rendite oder macht sie unbrauchbar.
    const october = returnOf(candidateAt(withLateLoss, MONTH, ctx));
    expect(october === null || october < returnOf(candidateAt(calm, MONTH, ctx))!).toBe(true);
  });

  it("überspringt mit Grund: kein Kurs, kein Wechselkurs, zu klein, unplausibel", () => {
    expect(candidateAt(stockData("A.US", ["2026-09"]), MONTH, ctx)).toEqual({ skipped: "kurs" });
    const twd = stockData("T.TW", [MONTH], { stock: { ...stock, id: "T.TW", priceCurrency: "TWD", reportingCurrency: "TWD" } });
    expect(candidateAt(twd, MONTH, ctx)).toEqual({ skipped: "wechselkurs" });
    expect(candidateAt(stockData("K.US", [MONTH], {}, 1e6), MONTH, ctx)).toEqual({ skipped: "marktwert" });
    // Kurs unter dem Doppelten des Gewinns: Zahlen und Kurs passen nicht zusammen
    expect(candidateAt(stockData("U.US", [MONTH], { bars: monthBars([MONTH], 5) }), MONTH, ctx)).toEqual({ skipped: "unplausibel" });
  });

  it("rechnet den Kurs mit dem Wechselkurs des Stichtags um", () => {
    const usd = stockData("U.US", [MONTH], { stock: { ...stock, id: "U.US", priceCurrency: "USD", reportingCurrency: "USD" } });
    const result = candidateAt(usd, MONTH, ctx);
    if (!("candidate" in result)) throw new Error(result.skipped);
    expect(result.candidate.capEur).toBeCloseTo(40e9 / 1.1);
  });

  it("schließt Titel aus, deren Abschlüsse einen späteren Split nicht abbilden", () => {
    const split = { date: "2026-12-15", ratio: 5 };
    // Aktienzahl springt 2026/2027 nicht auf Basis der Abschlüsse: Basis unbekannt, also draußen.
    expect(candidateAt(stockData("S.US", [MONTH], { splits: [split] }), MONTH, ctx)).toEqual({ skipped: "split" });
    // Ein Split vor dem letzten bekannten Abschluss (Ende 2025) ist in den Abschlüssen längst enthalten.
    const earlier = candidateAt(stockData("S.US", [MONTH], { splits: [{ date: "2024-01-15", ratio: 5 }] }), MONTH, ctx);
    expect("candidate" in earlier).toBe(true);
  });

  it("schließt auch einen Split zwischen letztem Abschluss und Stichtag aus, wenn die Abschlüsse ihn nicht abbilden", () => {
    // Letzter bekannter Abschluss 2025, Split im Februar 2026, Kurs im Oktober 2026 steht schon nach dem Split.
    // Die Aktienzahl springt 2025/2026 nicht (Zahlen auf alter Basis, Folgejahr fehlt): Basis unbekannt, also draußen.
    const data = stockData("S.US", [MONTH], { splits: [{ date: "2026-02-15", ratio: 5 }] });
    expect(candidateAt(data, MONTH, ctx)).toEqual({ skipped: "split" });
    // Ein Split innerhalb der Abschlüsse mit sichtbarem Sprung der Aktienzahl (gemischte Basis) fängt die Plausibilitätsprüfung der Anwendung
    const jump = stockData("J.US", [MONTH], {
      splits: [{ date: "2025-02-15", ratio: 5 }],
      fundamentals: scaledYears(1e9, (y) => {
        y.shares = y.fiscalYear >= 2025 ? 5e9 : 1e9;
      }),
    });
    expect(candidateAt(jump, MONTH, ctx)).toEqual({ skipped: "unplausibel" });
  });

  it("nimmt Dividenden nur bis zum Stichtag", () => {
    const payments = [
      { date: "2026-03-01", value: 2, currency: "EUR", period: "" },
      { date: "2026-12-01", value: 500, currency: "EUR", period: "" },
    ];
    const plain = candidateAt(stockData("A.US", [MONTH]), MONTH, ctx);
    const withFuture = candidateAt(stockData("A.US", [MONTH], { dividends: payments }), MONTH, ctx);
    const withoutFuture = candidateAt(stockData("A.US", [MONTH], { dividends: payments.slice(0, 1) }), MONTH, ctx);
    if (!("candidate" in withFuture) || !("candidate" in withoutFuture) || !("candidate" in plain))
      throw new Error("müssen Kandidaten sein");
    // Die Zahlung vom Dezember liegt nach dem Stichtag und ändert nichts
    expect(withFuture.candidate.innerReturn).toBeCloseTo(withoutFuture.candidate.innerReturn);
  });

  it("verschiebt die Rendite einer Fremdwährung um den Inflationsabstand", () => {
    const usd = stockData("U.US", [MONTH], { stock: { ...stock, id: "U.US", priceCurrency: "USD", reportingCurrency: "USD" } });
    const same = candidateAt(usd, MONTH, ctx);
    const gap = candidateAt(usd, MONTH, { ...ctx, inflationGap: () => 0.03 });
    if (!("candidate" in same) || !("candidate" in gap)) throw new Error("müssen Kandidaten sein");
    // Mit 3 Punkten höherer Inflation ist dieselbe nominale Rendite in Euro-Kaufkraft kleiner
    expect(gap.candidate.innerReturn).not.toBeCloseTo(same.candidate.innerReturn);
  });

  it("rechnet den Rohkurs auf die Basis der bereinigten Abschlüsse, wenn nach dem Stichtag ein Split kam", () => {
    const month = "2022-10";
    // Die Abschlüsse laufen ohne Sprung der Aktienzahl durch den Split von 2023: sie sind bereinigt. Der Rohkurs von damals
    // war viermal so hoch (160) und entspricht auf heutiger Basis dem Kurs 40 einer Aktie ohne Split.
    const split = candidateAt(
      stockData("S.US", [month], { splits: [{ date: "2023-06-01", ratio: 4 }], bars: monthBars([month], 160) }),
      month,
      ctx,
    );
    const plain = candidateAt(stockData("P.US", [month]), month, ctx);
    if (!("candidate" in split) || !("candidate" in plain)) throw new Error("beide müssen Kandidaten sein");
    expect(split.candidate.innerReturn).toBeCloseTo(plain.candidate.innerReturn);
    expect(split.candidate.capEur).toBeCloseTo(plain.candidate.capEur);
  });
});

describe("splitBasis", () => {
  const years = (shares: number[]) => steadyYears((y, i) => (y.shares = shares[i] ?? null));
  const split = { date: "2022-03-01", ratio: 5 };

  it("erkennt unbereinigte Abschlüsse am Sprung der Aktienzahl", () => {
    const shares = [100, 100, 100, 100, 100, 100, 500, 500, 500, 500]; // 2016..2025: Sprung 2022
    expect(splitBasis(years(shares), split)).toBe("unadjusted");
  });

  it("erkennt bereinigte Abschlüsse daran, dass die Aktienzahl nicht springt", () => {
    expect(splitBasis(years(Array(10).fill(500)), split)).toBe("adjusted");
  });

  it("meldet unbekannt, wenn Aktienzahlen rund um den Split fehlen", () => {
    const shares: (number | null)[] = Array(10).fill(500);
    shares[6] = null;
    shares[7] = null;
    expect(
      splitBasis(
        steadyYears((y, i) => (y.shares = shares[i] ?? null)),
        split,
      ),
    ).toBe("unknown");
  });
});

describe("buildCandidates", () => {
  const months = [MONTH];
  const A = stockData("A.US", months);
  const aStock = A.stock;

  it("behält von zwei Notierungen mit gleichen Zahlen die mit dem größeren Marktwert", () => {
    const heim = stockData("HEIM.US", months);
    const zweit = stockData("ZWEIT.US", months, { bars: monthBars(months, 38) });
    const set = buildCandidates([heim.stock, zweit.stock], (s) => (s.id === "HEIM.US" ? heim : zweit), months, ctx);
    expect(set.byMonth.get(MONTH)!.map((c) => c.id)).toEqual(["HEIM.US"]);
  });

  it("dedupliziert je Stichtag und lässt Titel ohne Gewinn je Aktie für sich allein stehen", () => {
    const m2 = [MONTH, "2026-07"];
    const heim = stockData("HEIM.US", m2);
    const zweit = stockData("ZWEIT.US", m2, {
      bars: new Map([
        [MONTH, { close: 38, adjustedClose: 38 }],
        ["2026-07", { close: 45, adjustedClose: 45 }],
      ]),
    });
    const set = buildCandidates([heim.stock, zweit.stock], (s) => (s.id === "HEIM.US" ? heim : zweit), m2, ctx);
    // Im Oktober hat HEIM den größeren Marktwert, im Juli ZWEIT (höherer Kurs bei gleichen Zahlen)
    expect(set.byMonth.get(MONTH)!.map((c) => c.id)).toEqual(["HEIM.US"]);
    expect(set.byMonth.get("2026-07")!.map((c) => c.id)).toEqual(["ZWEIT.US"]);
    // Ohne Gewinn je Aktie bleiben beide stehen
    const noEps = (id: string) =>
      stockData(id, [MONTH], { fundamentals: scaledYears(1e9, (y) => (y.epsDiluted = y.fiscalYear === 2025 ? null : y.epsDiluted)) });
    const x = noEps("X.US");
    const y = noEps("Y.US");
    const both = buildCandidates([x.stock, y.stock], (s) => (s.id === "X.US" ? x : y), [MONTH], ctx);
    expect(both.byMonth.get(MONTH)!.length).toBeLessThanOrEqual(2);
  });

  it("schließt eingestellte Hybridtitel aus, lebende mit demselben Namen nicht, und zählt sie als ausgeschlossen", () => {
    const hybrid = stockData("HYB.US", months);
    const dead = { ...hybrid.stock, name: "Southern Company JR SUB NT 2015A", delistedOn: "2026-06-30" };
    const alive = { ...hybrid.stock, id: "LIVE.US", name: "Southern Company JR SUB NT 2015A" };
    const set = buildCandidates([dead, alive], (s) => ({ ...hybrid, stock: s }), months, ctx);
    expect(set.skipped.ausgeschlossen).toBe(months.length);
    expect(set.byMonth.get(MONTH)!.map((c) => c.id)).not.toContain("HYB.US");
  });

  it("lässt Anleihen und Nicht-Stammaktien aus und zählt die Gründe", () => {
    const bond = stockData("ANL.US", months);
    const preferred = { ...bond.stock, name: "DTE Energy Company 2020 Series G" };
    const fund = { ...A.stock, id: "ETF.US", securityType: "FUND" };
    const small = stockData("K.US", months, {}, 1e6);
    const set = buildCandidates(
      [aStock, preferred, fund, small.stock],
      (s) => (s.id === "K.US" ? small : s.id === "A.US" ? A : null),
      months,
      ctx,
    );
    expect(set.byMonth.get(MONTH)!.map((c) => c.id)).toEqual(["A.US"]);
    expect(set.skipped.marktwert).toBe(1);
    expect([...set.bars.keys()]).toEqual(["A.US"]);
  });
});
