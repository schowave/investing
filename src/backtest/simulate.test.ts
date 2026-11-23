import { describe, expect, it } from "vitest";
import { PROFILE_FOCUSED } from "../calc/index.ts";
import { monthEnd } from "./calendar.ts";
import type { Bar, Candidate } from "./candidates.ts";
import { parseEcbHistory } from "./fx.ts";
import { randomScores } from "./report.ts";
import { makeReturnOf, simulate } from "./simulate.ts";

const dateOf = (m: string) => monthEnd(m);
const noFx = parseEcbHistory("<Cube time='2026-01-30'><Cube currency='USD' rate='1'/></Cube>");
const bars = (series: Record<string, [number, number]>): Map<string, Bar> =>
  new Map(Object.entries(series).map(([m, [close, adjustedClose]]) => [m, { close, adjustedClose }]));

describe("makeReturnOf", () => {
  it("rechnet die Gesamtrendite aus den bereinigten Kursen", () => {
    const returnOf = makeReturnOf(
      new Map([["A", bars({ "2026-01": [10, 10], "2026-02": [12, 12.5] })]]),
      new Map(),
      noFx,
      dateOf,
      "2026-06",
      0.5,
    );
    expect(returnOf("A", "2026-01", "2026-02")).toBeCloseTo(0.25);
  });

  it("rechnet die Wechselkursänderung in Euro mit ein", () => {
    const fx = parseEcbHistory(
      "<Cube time='2026-02-27'><Cube currency='USD' rate='1.2'/></Cube><Cube time='2026-01-30'><Cube currency='USD' rate='1.0'/></Cube>",
    );
    const returnOf = makeReturnOf(
      new Map([["A", bars({ "2026-01": [10, 10], "2026-02": [10, 10] })]]),
      new Map([["A", "USD"]]),
      fx,
      dateOf,
      "2026-06",
      0.5,
    );
    // Kurs unverändert, der Dollar verliert 20 % gegen den Euro: 1,0 / 1,2 - 1
    expect(returnOf("A", "2026-01", "2026-02")).toBeCloseTo(1 / 1.2 - 1);
  });

  it("nimmt bei einem fehlenden Monatsbalken den letzten davor", () => {
    const returnOf = makeReturnOf(
      new Map([["A", bars({ "2026-01": [10, 10], "2026-03": [15, 15] })]]),
      new Map(),
      noFx,
      dateOf,
      "2026-06",
      0.5,
    );
    expect(returnOf("A", "2026-01", "2026-02")).toBeCloseTo(0);
    expect(returnOf("A", "2026-02", "2026-03")).toBeCloseTo(0.5);
  });

  it("setzt den Verlust nicht an, wenn die Tageskurse weiterlaufen, und zählt jeden Abschlag", () => {
    const series = new Map([["A", bars({ "2026-01": [10, 10], "2026-02": [10, 10] })]]);
    // Tageskurse laufen weiter: nur die Monatsreihe ist veraltet, kein Abschlag
    const alive = makeReturnOf(series, new Map(), noFx, dateOf, "2026-12", 0.5, { isDelisted: () => false });
    expect(alive("A", "2026-04", "2026-05")).toBeCloseTo(0);
    // Der Abschlag wird gezählt
    const events: string[] = [];
    const dead = makeReturnOf(series, new Map(), noFx, dateOf, "2026-12", 0.5, { onDelist: (id, month) => events.push(`${id} ${month}`) });
    expect(dead("A", "2026-04", "2026-05")).toBe(-0.5);
    expect(events).toEqual(["A 2026-05"]);
  });

  it("rechnet Pence-Notierungen mit dem Wechselkurs des Pfunds", () => {
    const fx = parseEcbHistory(
      "<Cube time='2026-02-27'><Cube currency='GBP' rate='0.9'/></Cube><Cube time='2026-01-30'><Cube currency='GBP' rate='0.8'/></Cube>",
    );
    const returnOf = makeReturnOf(
      new Map([["A", bars({ "2026-01": [100, 100], "2026-02": [100, 100] })]]),
      new Map([["A", "GBX"]]),
      fx,
      dateOf,
      "2026-06",
      0.5,
    );
    expect(returnOf("A", "2026-01", "2026-02")).toBeCloseTo(0.8 / 0.9 - 1);
  });

  it("liefert null, wenn ein bereinigter Kurs null oder negativ ist, statt −100 % anzusetzen", () => {
    const returnOf = makeReturnOf(
      new Map([["A", bars({ "2026-01": [10, 10], "2026-02": [10, 0] })]]),
      new Map(),
      noFx,
      dateOf,
      "2026-06",
      0.5,
    );
    expect(returnOf("A", "2026-01", "2026-02")).toBeNull();
  });

  it("setzt im dritten Monat nach dem Ende der Reihe den Verlust an und liefert null ohne Kurse", () => {
    const returnOf = makeReturnOf(
      new Map([["A", bars({ "2026-01": [10, 10], "2026-02": [10, 10] })]]),
      new Map(),
      noFx,
      dateOf,
      "2026-12",
      0.5,
    );
    expect(returnOf("A", "2026-04", "2026-05")).toBe(-0.5);
    expect(returnOf("A", "2026-03", "2026-04")).toBeCloseTo(0);
    expect(returnOf("B", "2026-01", "2026-02")).toBeNull();
  });
});

const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
const candidate = (id: string, innerReturn: number, over: Partial<Candidate> = {}): Candidate => ({
  id,
  name: `Firma ${id}`,
  country: "DE",
  sector: "Chemie",
  region: "Europa",
  innerReturn,
  riskScore: 0,
  complete: true,
  heldWeight: 0,
  capEur: 1e9,
  fingerprint: id,
  ...over,
});
const eight = (a = 0.2) => ["A", "B", "C", "D", "E", "F", "G", "H"].map((id, i) => candidate(id, a - i * 0.01));
const profile = { ...PROFILE_FOCUSED, minReturn: 0.03 };
const base = { months, profile, cost: 0, cashRate: 0 };

describe("simulate", () => {
  const monthly = (r: number) => () => r;

  it("verzinst über die Monate und startet bei 100", () => {
    const run = simulate({ ...base, candidates: new Map([["2026-01", eight()]]), returnOf: monthly(0.01) });
    expect(run.values[0]).toBe(100);
    // Sieben Positionen zu je 15 % (Limit 15 %), der Rest ist Bargeld ohne Zins: 105 % gedeckelt auf 100 %.
    expect(run.values.at(-1)!).toBeCloseTo(100 * 1.01 ** 6, 5);
    expect(run.holdings).toBeGreaterThan(5);
  });

  it("zieht die Kosten vom Umsatz ab und mittelt den Umschlag ohne den Aufbau", () => {
    const candidates = new Map([
      ["2026-01", eight()],
      ["2026-04", eight()],
    ]);
    const free = simulate({ ...base, candidates, returnOf: monthly(0) });
    const paid = simulate({ ...base, candidates, returnOf: monthly(0), cost: 0.01 });
    expect(free.values.at(-1)).toBeCloseTo(100);
    // Aufbau: Umsatz 100 % (Kosten 1 %); zweite Umschichtung ohne Änderung: kein Umsatz.
    expect(paid.values.at(-1)!).toBeCloseTo(99, 3);
    expect(paid.turnover).toBeCloseTo(0, 3);
  });

  it("verzinst Bargeld", () => {
    const run = simulate({ ...base, candidates: new Map([["2026-01", [candidate("A", 0.2)]]]), returnOf: monthly(0), cashRate: 0.12 });
    // Eine Position mit 15 %, 85 % Bargeld mit 1 % im Monat
    expect(run.values.at(-1)!).toBeGreaterThan(100 + 85 * (1.01 ** 6 - 1) - 0.01);
  });

  it("verzinst Bargeld je Monat mit dem Zins des Monats", () => {
    const candidates = new Map([["2026-01", [candidate("A", 0.2)]]]);
    // Der Zins vom 2026-01 gilt für den Monat bis Februar; ein späterer Zins darf nicht zurückwirken.
    const rate = (m: string) => (m === "2026-01" ? 0.12 : 0);
    const run = simulate({ ...base, candidates, returnOf: monthly(0), cashRate: 0.5, cashRateAt: rate });
    // Nur der Februar bringt 1 % auf das Bargeld (85 %); der feste Zins von 50 % gilt nicht.
    expect(run.values.at(-1)!).toBeCloseTo(100 + 85 * 0.01, 5);
  });

  it("wendet die Hürde des Stichtags an", () => {
    const candidates = new Map([
      ["2026-01", eight(0.2)],
      ["2026-04", eight(0.2)],
    ]);
    // Im Januar liegt die Hürde unter allen Kandidaten (Aufbau), im April darüber (alles wird verkauft).
    const run = simulate({ ...base, candidates, returnOf: monthly(0), trades: true, minReturnAt: (m) => (m === "2026-04" ? 0.5 : 0) });
    expect(run.trades["2026-01"]!.every((t) => t.action === "kaufen")).toBe(true);
    expect(run.trades["2026-04"]!.every((t) => t.action === "verkaufen")).toBe(true);
  });

  it("protokolliert Käufe, Verkäufe und Halten und rechnet die Rendite seit dem Kauf mit dem Kursverlauf", () => {
    const first = eight(0.2);
    const second = [...eight(0.2).slice(1), candidate("X", 0.5, { sector: "Öl" })]; // A fällt heraus, X kommt, B bis H bleiben
    const returnOf = (id: string) => (id === "A" ? 0.1 : 0);
    const run = simulate({
      ...base,
      candidates: new Map([
        ["2026-01", first],
        ["2026-04", second.map((c) => ({ ...c, innerReturn: c.id === "A" ? 0.01 : c.innerReturn }))],
      ]),
      returnOf,
      trades: true,
    });
    const january = run.trades["2026-01"]!;
    expect(january.every((t) => t.action === "kaufen")).toBe(true);
    const april = run.trades["2026-04"]!;
    const sold = april.find((t) => t.id === "A")!;
    expect(sold.action).toBe("verkaufen");
    // drei Monate je +10 % seit dem Kauf
    expect(sold.sinceBuy).toBeCloseTo(1.1 ** 3 - 1, 6);
    expect(sold.reason).toContain("kein Kandidat mehr");
    expect(april.find((t) => t.id === "X")!.action).toBe("kaufen");
    expect(april.some((t) => t.action === "halten" || t.action === "aufstocken" || t.action === "reduzieren")).toBe(true);
  });

  it("rechnet die Rendite seit dem Kauf auch nach dem Aufstocken über den Kurs und nicht über den Einsatz", () => {
    // Eine Position wächst im Gewicht (andere fallen heraus), der Kurs steigt aber nur um 10 %.
    const first = [candidate("A", 0.2), candidate("B", 0.19)];
    const second = [candidate("A", 0.2)];
    const run = simulate({
      ...base,
      candidates: new Map([
        ["2026-01", first],
        ["2026-04", second],
        ["2026-07", [candidate("A", 0.01)]],
      ]),
      returnOf: (id) => (id === "A" ? 0.1 : 0),
      trades: true,
      months: [...months, "2026-08"],
    });
    const sale = run.trades["2026-07"]!.find((t) => t.id === "A")!;
    expect(sale.action).toBe("verkaufen");
    expect(sale.sinceBuy).toBeCloseTo(1.1 ** 6 - 1, 6);
  });

  it("schichtet nur jeden n-ten Stichtag um", () => {
    const candidates = new Map([
      ["2026-01", [candidate("A", 0.2)]],
      ["2026-02", [candidate("B", 0.3)]],
      ["2026-03", [candidate("C", 0.4)]],
    ]);
    const run = simulate({ ...base, candidates, returnOf: monthly(0), every: 2, trades: true });
    expect(Object.keys(run.trades)).toEqual(["2026-01", "2026-03"]);
  });

  it("rechnet ein Fenster von bis und schichtet im letzten Monat nicht mehr um", () => {
    const candidates = new Map([
      ["2026-01", eight()],
      ["2026-04", eight()],
    ]);
    const run = simulate({ ...base, candidates, returnOf: monthly(0.02), from: 1, to: 3, trades: true });
    // Der Stichtag April ist der letzte Monat des Fensters: dort wird nicht mehr umgeschichtet.
    expect(run.values).toHaveLength(3);
    expect(Object.keys(run.trades)).toEqual([]);
  });

  it("ordnet ohne Zufall nach innerer Rendite und würfelt sonst reproduzierbar, aber nie unter die Untergrenze", () => {
    const strong = Array.from({ length: 40 }, (_, i) => candidate(`S${String(i).padStart(2, "0")}`, 0.5 - i * 0.005));
    const weak = [candidate("SCHWACH1", 0.01), candidate("SCHWACH2", 0.02)];
    const picks = (random?: (id: string, month: string) => number) =>
      Object.values(
        simulate({ ...base, candidates: new Map([["2026-01", [...weak, ...strong]]]), returnOf: monthly(0), random, trades: true }).trades,
      )[0]!.map((t) => t.id);
    // Limit 15 %: genau sieben Positionen, die sieben besten
    expect(new Set(picks())).toEqual(new Set(["S00", "S01", "S02", "S03", "S04", "S05", "S06"]));
    expect(picks(randomScores(1))).toEqual(picks(randomScores(1)));
    expect(new Set(picks(randomScores(1)))).not.toEqual(new Set(picks()));
    for (let seed = 1; seed <= 20; seed++) expect(picks(randomScores(seed)).some((id) => id.startsWith("SCHWACH"))).toBe(false);
  });

  it("zählt Umschlag zweiseitig: ein voller Austausch bewegt 200 % und kostet zweimal den Satz", () => {
    const a = eight().slice(0, 7);
    const b = ["X1", "X2", "X3", "X4", "X5", "X6", "X7"].map((id, i) => candidate(id, 0.2 - i * 0.001));
    const candidates = new Map([
      ["2026-01", a],
      ["2026-04", b],
    ]);
    const run = simulate({ ...base, candidates, returnOf: monthly(0), cost: 0.01 });
    // Sieben Positionen zu 15 % = 105 % gedeckelt auf 100 %: Aufbau 100 %, Austausch 100 % raus und 100 % rein
    expect(run.turnover).toBeCloseTo(2, 5);
    // Aufbau: 1 % von 100; Austausch: 2 % von 99
    expect(run.values.at(-1)!).toBeCloseTo(100 * 0.99 * 0.98, 4);
  });

  it("schichtet nur an Stichtagen mit Kandidaten um und zählt `every` nur über diese", () => {
    const candidates = new Map([
      ["2026-01", [candidate("A", 0.2)]],
      ["2026-04", [candidate("B", 0.2)]],
      ["2026-07", [candidate("C", 0.2)]],
    ]);
    // Die Monate dazwischen haben keine Kandidaten und zählen nicht
    const run = simulate({ ...base, months: [...months, "2026-08"], candidates, returnOf: monthly(0), every: 2, trades: true });
    expect(Object.keys(run.trades)).toEqual(["2026-01", "2026-07"]);
  });

  it("sammelt Positionsmonate mit extremer Rendite als Ausreißer", () => {
    const run = simulate({
      ...base,
      candidates: new Map([["2026-01", [candidate("A", 0.2), candidate("B", 0.19)]]]),
      returnOf: (id, _prev, month) => (id === "A" && month === "2026-03" ? 1.5 : 0.01),
      trades: true,
    });
    expect(run.outliers).toEqual([{ month: "2026-03", id: "A", name: "Firma A", monthlyReturn: 1.5 }]);
  });
});
