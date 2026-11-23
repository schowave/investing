import { describe, expect, it } from "vitest";
import { type DepotPosition, type Listing, previewBestand } from "./bestand.ts";

const aktie = (isin: string | null, quantity: number, name = `Aktie ${isin}`): DepotPosition => ({
  isin,
  wkn: "A0B1C2",
  name,
  kind: "aktie",
  quantity,
  valueEur: quantity * 10,
});
const current = (shares: Record<string, number> = {}, cashEur = 100, otherEur = 50) => ({
  cashEur,
  otherEur,
  shares: new Map(Object.entries(shares)),
  names: new Map(Object.keys(shares).map((id) => [id, `Name ${id}`])),
});
const listing = (id: string, watched: boolean, extra: Partial<Listing> = {}): Listing => ({
  id,
  watched,
  common: true,
  priced: true,
  ...extra,
});

describe("Vorschau des Bestands aus dem Depot", () => {
  it("ordnet Aktien über die ISIN zu und zeigt neue, geänderte, gleiche und weggefallene Positionen", () => {
    const listings = new Map([
      ["DE0000000001", [listing("NEU.XETRA", true)]],
      ["DE0000000002", [listing("MEHR.XETRA", true)]],
      ["DE0000000003", [listing("GLEICH.XETRA", false)]],
    ]);
    const preview = previewBestand(
      [aktie("DE0000000001", 5, "Neu AG"), aktie("DE0000000002", 12), aktie("DE0000000003", 7)],
      1234.567,
      listings,
      current({ "MEHR.XETRA": 10, "GLEICH.XETRA": 7, "WEG.XETRA": 3 }),
    );
    expect(preview.rows.map((r) => [r.stockId, r.status, r.before, r.after])).toEqual([
      ["NEU.XETRA", "neu", 0, 5],
      ["MEHR.XETRA", "geändert", 10, 12],
      ["WEG.XETRA", "weg", 3, 0],
      ["GLEICH.XETRA", "gleich", 7, 7],
    ]);
    expect(preview.rows[0]).toMatchObject({ name: "Neu AG", isin: "DE0000000001" });
    expect(preview.rows[2]).toMatchObject({ name: "Name WEG.XETRA", isin: null });
    expect(preview.shares).toEqual(
      new Map([
        ["NEU.XETRA", 5],
        ["MEHR.XETRA", 12],
        ["GLEICH.XETRA", 7],
      ]),
    );
    expect(preview.cash).toEqual({ before: 100, after: 1234.57 });
    expect(preview.other).toEqual({ before: 50, after: 0 });
    expect(preview.warnings).toEqual([]);
  });

  it("wählt bei mehreren Notizen die beobachtete, dann die gehaltene, und zählt mehrere Lagerstellen zusammen", () => {
    const listings = new Map([
      ["US0000000001", [listing("A.US", false), listing("A.XETRA", true)]],
      ["US0000000002", [listing("B.US", false), listing("B.F", false)]],
      ["US0000000003", [listing("C.US", false), listing("C.F", false)]],
    ]);
    const preview = previewBestand(
      [aktie("US0000000001", 2), aktie("US0000000001", 3), aktie("US0000000002", 1), aktie("US0000000003", 1)],
      0,
      listings,
      current({ "B.US": 1 }),
    );
    expect(preview.shares).toEqual(
      new Map([
        ["A.XETRA", 5],
        ["B.US", 1],
        ["C.F", 1],
      ]),
    );
  });

  it("zählt Fonds, ETF und noch unbekannte Aktien zu den sonstigen Anlagen und nennt die fehlenden ISINs", () => {
    const etf: DepotPosition = { isin: "IE0000000001", wkn: "ETF001", name: "Welt-ETF", kind: "sonstiges", quantity: 3, valueEur: 300.004 };
    const ohneKurs: DepotPosition = { ...etf, isin: "XS0000000001", name: "Anleihe", valueEur: null };
    const preview = previewBestand(
      [etf, ohneKurs, aktie("DE0000000009", 4, "Fehlt AG"), aktie("DE0000000009", 1, "Fehlt AG"), aktie(null, 2, "Ohne ISIN")],
      null,
      new Map(),
      current(),
    );
    expect(preview.rows).toEqual([]);
    expect(preview.others.map((o) => [o.name, o.pendingImport])).toEqual([
      ["Welt-ETF", false],
      ["Anleihe", false],
      ["Fehlt AG", true],
      ["Fehlt AG", true],
      ["Ohne ISIN", false],
    ]);
    expect(preview.missingIsins).toEqual(["DE0000000009"]);
    expect(preview.other).toEqual({ before: 50, after: 370 });
    // Ohne Verrechnungskonto bleibt der Barbestand.
    expect(preview.cash).toEqual({ before: 100, after: 100 });
    expect(preview.warnings).toEqual([
      "Anleihe (WKN ETF001): kein Kurswert in Euro, zählt mit 0.",
      "Ohne ISIN (WKN A0B1C2): Aktie ohne ISIN, zählt als sonstige Anlage.",
      "Kein Verrechnungskonto zum Depot gefunden; der Barbestand bleibt, wie er ist.",
    ]);
  });

  it("setzt ein Verrechnungskonto im Minus als Barbestand 0 an und sagt es", () => {
    const preview = previewBestand([], -12.5, new Map(), current());
    expect(preview.cash.after).toBe(0);
    expect(preview.warnings).toEqual(["Das Verrechnungskonto ist im Minus; der Barbestand wird 0."]);
  });

  it("zieht die Stammaktie mit Kurs einem CEDEAR oder einer Notiz ohne Kurs vor", () => {
    const listings = new Map([
      [
        "US0378331005",
        [listing("AAPL.BA", false, { common: false }), listing("AAPL.F", false, { priced: false }), listing("AAPL.US", false)],
      ],
    ]);
    expect(previewBestand([aktie("US0378331005", 1)], 0, listings, current()).shares).toEqual(new Map([["AAPL.US", 1]]));
  });

  it("lässt leere Positionen aus und rundet Bruchstücke aus mehreren Lagerstellen", () => {
    const listings = new Map([
      ["DE0000000001", [listing("A.XETRA", true)]],
      ["DE0000000002", [listing("B.XETRA", true)]],
    ]);
    const preview = previewBestand(
      [aktie("DE0000000001", 0.1), aktie("DE0000000001", 0.2), aktie("DE0000000002", 0)],
      0,
      listings,
      current({ "A.XETRA": 0.3 }),
    );
    expect(preview.rows.map((r) => [r.stockId, r.status])).toEqual([["A.XETRA", "gleich"]]);
    expect(preview.shares).toEqual(new Map([["A.XETRA", 0.3]]));
  });

  it("lässt gehaltene Aktien, die nicht im Depot liegen, auch ohne ISIN wegfallen und stößt vergebliche ISINs nicht erneut an", () => {
    const preview = previewBestand(
      [aktie("DE0000000007", 2, "Vorzug AG"), aktie("DE0000000007", 1, "Vorzug AG")],
      0,
      new Map(),
      current({ "HAND.XETRA": 5 }, 0, 0),
      new Set(["DE0000000007"]),
    );
    expect(preview.rows).toEqual([{ stockId: "HAND.XETRA", name: "Name HAND.XETRA", isin: null, before: 5, after: 0, status: "weg" }]);
    expect(preview.shares).toEqual(new Map());
    expect(preview.missingIsins).toEqual([]);
    expect(preview.others.map((o) => [o.pendingImport, o.notFound])).toEqual([
      [false, true],
      [false, true],
    ]);
    expect(preview.warnings).toEqual([
      "Vorzug AG (DE0000000007): Die Aufnahme über die ISIN ist in den letzten 30 Tagen gescheitert (der Anbieter führt keine Notiz mit Abschlüssen); zählt als sonstige Anlage.",
    ]);
  });
});
