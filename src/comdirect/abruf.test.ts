import { beforeEach, describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import { FUNDAMENTALS_KIND } from "../data/eodhdSnapshot.ts";
import { balanceRow, depotRow, fakeComdirect, positionRow } from "../test/comdirect.ts";
import { stock } from "../test/fixtures.ts";
import {
  type AbrufDeps,
  applyVorschau,
  cancelAbruf,
  chooseDepot,
  confirmTan,
  MAX_OPEN_CHALLENGES,
  openChallenges,
  resetOpenChallenges,
  retryLoad,
  startAbruf,
} from "./abruf.ts";
import { closeVorgang, findVorgang, openVorgang, VORGANG_MINUTES } from "./vorgang.ts";

const config = { clientId: "client", clientSecret: "geheim", username: "12345678" };
let db: Database;
let portfolio: number;

function deps(bank: ReturnType<typeof fakeComdirect>, clock = { t: Date.now() }): AbrufDeps {
  return {
    config,
    fetchFn: bank.fetchFn,
    now: () => clock.t,
    sleep: async (ms) => {
      clock.t += ms;
    },
  };
}

beforeEach(() => {
  resetOpenChallenges();
  db = new Database(":memory:");
  db.addStockIfMissing({ ...stock, id: "BAS.XETRA", name: "BASF" });
  db.setIsin("BAS.XETRA", "DE000BASF111");
  db.addStockIfMissing({ ...stock, id: "ALT.XETRA", name: "Alt AG" });
  db.setIsin("ALT.XETRA", "DE000ALT0001");
  portfolio = db.createPortfolio("Depot", "fokussiert");
  db.setHolding(portfolio, "ALT.XETRA", 4);
  db.setCash(portfolio, 10);
  db.setOtherAssets(portfolio, 20);
});

describe("Abruf bei der comdirect", () => {
  it("führt von der PIN über die pushTAN zur Vorschau und übernimmt den Bestand", async () => {
    const bank = fakeComdirect({
      pendingPolls: 2,
      positions: [
        positionRow("DE000BASF111", "12", "SHARE", "500.00", "BASF"),
        positionRow("IE00B4L5Y983", "3", "ETF", "300.00"),
        positionRow("US0000000009", "2", "SHARE", "80.00", "Neu Inc"),
      ],
    });
    const d = deps(bank);
    const vorgang = await startAbruf(portfolio, "123456", d);
    expect(vorgang.state).toMatchObject({ step: "tan", challenge: { typ: "P_TAN_PUSH" } });
    expect(openChallenges()).toBe(1);
    // Der Vorgang hält nur Tokens, nie die PIN.
    expect(JSON.stringify(vorgang)).not.toContain("123456");

    expect(await confirmTan(db, vorgang, null, d)).toBe(true);
    expect(openChallenges()).toBe(0);
    expect(vorgang.state.step).toBe("vorschau");
    if (vorgang.state.step !== "vorschau") return;
    expect(vorgang.state.preview.rows.map((r) => [r.stockId, r.status])).toEqual([
      ["BAS.XETRA", "neu"],
      ["ALT.XETRA", "weg"],
    ]);
    expect(vorgang.state.preview.missingIsins).toEqual(["US0000000009"]);
    // Bis zur Übernahme ändert sich nichts.
    expect(db.holdings(portfolio)).toEqual(new Map([["ALT.XETRA", 4]]));

    expect(await applyVorschau(db, vorgang)).toEqual(["US0000000009"]);
    expect(db.holdings(portfolio)).toEqual(new Map([["BAS.XETRA", 12]]));
    expect(db.portfolio(portfolio)).toMatchObject({ cashEur: 1500.25, otherEur: 380, comdirectDepotId: "D1" });
    expect(bank.calls.at(-1)).toMatchObject({ method: "DELETE", path: "/oauth/revoke" });
    expect(findVorgang(vorgang.id, portfolio)).toBeNull();
  });

  it("wartet nicht endlos auf die pushTAN und beendet eine abgelehnte", async () => {
    const slow = fakeComdirect({ pendingPolls: 100 });
    const d = deps(slow);
    const vorgang = await startAbruf(portfolio, "123456", d);
    expect(await confirmTan(db, vorgang, null, d)).toBe(false);
    expect(vorgang.state.step).toBe("tan");

    const rejected = fakeComdirect({ pendingPolls: "abgelehnt" });
    const other = await startAbruf(portfolio, "123456", deps(rejected));
    await expect(confirmTan(db, other, null, deps(rejected))).rejects.toThrow(/abgelehnt oder ist verfallen/);
    expect(findVorgang(other.id, portfolio)).toBeNull();
  });

  it("beendet den Vorgang nach einer falschen photoTAN, statt sie zu wiederholen", async () => {
    const bank = fakeComdirect({ preferred: "P_TAN" });
    const vorgang = await startAbruf(portfolio, "123456", deps(bank));
    await expect(confirmTan(db, vorgang, "111111", deps(bank))).rejects.toThrow(/TAN_UNGUELTIG/);
    expect(findVorgang(vorgang.id, portfolio)).toBeNull();
  });

  it("hört vor der Sperre durch die Bank auf und prüft die PIN vorher", async () => {
    await expect(startAbruf(portfolio, "", deps(fakeComdirect()))).rejects.toThrow(/PIN bzw. das Passwort/);
    const bank = fakeComdirect();
    for (let i = 0; i < MAX_OPEN_CHALLENGES; i++) await startAbruf(portfolio, "123456", deps(bank));
    await expect(startAbruf(portfolio, "123456", deps(bank))).rejects.toThrow(/Schon 3 TAN-Anforderungen/);
    resetOpenChallenges();
    await expect(startAbruf(portfolio, "123456", deps(bank))).resolves.toBeDefined();
  });

  it("fragt bei mehreren Depots nach, merkt das gewählte und lädt es beim nächsten Mal gleich", async () => {
    const bank = fakeComdirect({
      depots: [depotRow("D1", "K1"), depotRow("D2", "K2")],
      balances: [balanceRow("K1", "1"), balanceRow("K2", "2")],
    });
    const d = deps(bank);
    const vorgang = await startAbruf(portfolio, "123456", d);
    await confirmTan(db, vorgang, null, d);
    expect(vorgang.state).toMatchObject({ step: "depot", depots: [{ id: "D1" }, { id: "D2" }] });
    await expect(chooseDepot(db, vorgang, "D3", d)).rejects.toThrow(/gehört nicht/);
    await expect(confirmTan(db, vorgang, null, d)).rejects.toThrow(/schon freigegeben/);
    await chooseDepot(db, vorgang, "D2", d);
    expect(vorgang.state).toMatchObject({ step: "vorschau", depot: { id: "D2" }, preview: { cash: { after: 2 } } });
    // Auch aus der Vorschau lässt sich wechseln.
    await chooseDepot(db, vorgang, "D1", d);
    expect(vorgang.state).toMatchObject({ step: "vorschau", depot: { id: "D1" } });
    await chooseDepot(db, vorgang, "D2", d);
    await applyVorschau(db, vorgang);

    const again = await startAbruf(portfolio, "123456", d);
    await confirmTan(db, again, null, d);
    expect(again.state).toMatchObject({ step: "vorschau", depot: { id: "D2" } });
    cancelAbruf(again);
    expect(findVorgang(again.id, portfolio)).toBeNull();
    expect(bank.calls.at(-1)).toMatchObject({ method: "DELETE", path: "/oauth/revoke" });
  });

  it("meldet einen Zugang ohne Depot und ein gelöschtes Portfolio; nach der TAN geht ein neuer Versuch ohne neue TAN", async () => {
    const none = fakeComdirect({ depots: [] });
    const vorgang = await startAbruf(portfolio, "123456", deps(none));
    await expect(confirmTan(db, vorgang, null, deps(none))).rejects.toThrow(/kein Depot/);
    expect(findVorgang(vorgang.id, portfolio)!.state).toEqual({ step: "freigegeben" });
    await expect(retryLoad(db, vorgang, deps(none))).rejects.toThrow(/kein Depot/);
    const fixed = fakeComdirect();
    await retryLoad(db, vorgang, deps(fixed));
    expect(vorgang.state.step).toBe("vorschau");
    expect(fixed.calls.some((c) => c.path.includes("/validate"))).toBe(false);
    await expect(retryLoad(db, vorgang, deps(fixed))).rejects.toThrow(/nichts neu zu laden/);

    const bank = fakeComdirect();
    const gone = await startAbruf(portfolio, "123456", deps(bank));
    db.deletePortfolio(portfolio);
    await expect(confirmTan(db, gone, null, deps(bank))).rejects.toThrow(/gibt es nicht mehr/);
    await expect(applyVorschau(db, gone)).rejects.toThrow(/noch keine Vorschau/);
  });
});

describe("Absicherungen des Abrufs", () => {
  /** Ein Bestand aus einer Aktie, deren ISIN noch nicht gespeichert ist (Einträge von vor der Spalte). */
  function holdOnlyWithoutIsin(): void {
    db.addStockIfMissing({ ...stock, id: "ROH.XETRA", name: "Roh AG" });
    db.setHolding(portfolio, "ALT.XETRA", 0);
    db.setHolding(portfolio, "ROH.XETRA", 4);
  }

  it("trägt fehlende ISINs gehaltener Aktien aus der gespeicherten Antwort nach, statt sie als weggefallen zu werten", async () => {
    holdOnlyWithoutIsin();
    db.saveRawDocument("ROH.XETRA", FUNDAMENTALS_KIND, JSON.stringify({ General: { ISIN: "DE000ROH0001" } }));
    const bank = fakeComdirect({ positions: [positionRow("DE000ROH0001", "4")] });
    const vorgang = await startAbruf(portfolio, "123456", deps(bank));
    await confirmTan(db, vorgang, null, deps(bank));
    if (vorgang.state.step !== "vorschau") throw new Error("keine Vorschau");
    expect(vorgang.state.preview.rows.map((r) => [r.stockId, r.status])).toEqual([["ROH.XETRA", "gleich"]]);
    expect(db.stockIdsByIsin(["DE000ROH0001"])).toEqual(new Map([["DE000ROH0001", ["ROH.XETRA"]]]));
  });

  it("schlägt unbekannte ISINs bei EODHD nach und ordnet so gehaltene Titel ohne ISIN in den Stammdaten zu", async () => {
    holdOnlyWithoutIsin();
    const searched: string[] = [];
    const eodhdFetch = (async (url: URL) => {
      const isin = decodeURIComponent(url.pathname.split("/").at(-1)!);
      searched.push(isin);
      if (isin === "US0000000666") return new Response("", { status: 500 });
      const hits = isin === "DE000ROH0001" ? [{ Code: "ROH", Exchange: "XETRA", Name: "Roh AG", Type: "Common Stock", ISIN: isin }] : [];
      return Response.json(hits);
    }) as unknown as typeof fetch;
    const bank = fakeComdirect({
      positions: [
        positionRow("DE000ROH0001", "6"),
        positionRow("US0000000009", "1"),
        positionRow("US0000000666", "1"),
        positionRow("DE000BASF111", "1"),
      ],
    });
    const d = { ...deps(bank), eodhdToken: "t", eodhdFetch };
    const vorgang = await startAbruf(portfolio, "123456", d);
    await confirmTan(db, vorgang, null, d);
    if (vorgang.state.step !== "vorschau") throw new Error("keine Vorschau");
    // BASF ist schon bekannt und wird nicht nachgeschlagen.
    expect(searched).toEqual(["DE000ROH0001", "US0000000009", "US0000000666"]);
    expect(vorgang.state.preview.rows.map((r) => [r.stockId, r.status, r.after])).toEqual([
      ["BAS.XETRA", "neu", 1],
      ["ROH.XETRA", "geändert", 6],
    ]);
    expect(vorgang.state.preview.missingIsins).toEqual(["US0000000009", "US0000000666"]);
    expect(vorgang.state.preview.warnings[0]).toMatch(/1 ISINs ließen sich bei EODHD nicht nachschlagen/);
  });

  it("lässt eine gehaltene Aktie ohne ISIN wegfallen, wenn das Depot sie nicht führt: Die Bank ist führend", async () => {
    holdOnlyWithoutIsin();
    db.saveRawDocument("ROH.XETRA", FUNDAMENTALS_KIND, "kaputt");
    const bank = fakeComdirect();
    const vorgang = await startAbruf(portfolio, "123456", deps(bank));
    await confirmTan(db, vorgang, null, deps(bank));
    if (vorgang.state.step !== "vorschau") throw new Error("keine Vorschau");
    expect(vorgang.state.preview.rows.map((r) => r.status)).toEqual(["weg"]);
    await applyVorschau(db, vorgang);
    expect(db.holdings(portfolio)).toEqual(new Map());
  });

  it("übernimmt nichts, wenn die Bank nicht alle Positionen liefert", async () => {
    const bank = fakeComdirect({ positions: [positionRow("DE000BASF111", "1")], paging: { matches: 2 } });
    const vorgang = await startAbruf(portfolio, "123456", deps(bank));
    await confirmTan(db, vorgang, null, deps(bank));
    await expect(applyVorschau(db, vorgang)).rejects.toThrow(/nicht alle Positionen/);
    expect(db.holdings(portfolio)).toEqual(new Map([["ALT.XETRA", 4]]));
  });

  it("führt einen Schritt nicht doppelt aus, solange er läuft", async () => {
    const bank = fakeComdirect({ pendingPolls: 1 });
    let release: () => void = () => {};
    const d: AbrufDeps = { config, fetchFn: bank.fetchFn, now: () => 0, sleep: () => new Promise((resolve) => (release = resolve)) };
    const vorgang = await startAbruf(portfolio, "123456", d);
    const first = confirmTan(db, vorgang, null, d);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(confirmTan(db, vorgang, null, d)).rejects.toThrow(/läuft noch/);
    release();
    expect(await first).toBe(true);
    expect(bank.calls.filter((c) => c.method === "PATCH")).toHaveLength(1);
  });

  it("gibt auf, wenn die Anmeldung vor der Freigabe abläuft", async () => {
    const clock = { t: 0 };
    const slow = fakeComdirect({ pendingPolls: 1000 });
    const vorgang = await startAbruf(portfolio, "123456", deps(slow, clock));
    clock.t = 9 * 60_000 + 1;
    await expect(confirmTan(db, vorgang, null, deps(slow, clock))).rejects.toThrow(/abgelaufen, bevor die pushTAN/);
    const photo = fakeComdirect({ preferred: "P_TAN" });
    clock.t = 0;
    const other = await startAbruf(portfolio, "123456", deps(photo, clock));
    clock.t = 10 * 60_000;
    await expect(confirmTan(db, other, "654321", deps(photo, clock))).rejects.toThrow(/Anmeldung ist abgelaufen/);
    expect(photo.calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("stößt eine ISIN, deren Aufnahme scheiterte, 30 Tage lang nicht erneut an; Übernehmen allein merkt nichts", async () => {
    const day = Date.UTC(2026, 10, 23);
    db.setSetting("isins-ohne-notiz", JSON.stringify({ US0000000009: "2026-10-23", US0000000008: "2026-11-20" }));
    const bank = fakeComdirect({ positions: [positionRow("US0000000009", "1"), positionRow("US0000000008", "1")] });
    const clock = { t: day };
    const vorgang = await startAbruf(portfolio, "123456", deps(bank, clock));
    await confirmTan(db, vorgang, null, deps(bank, clock));
    if (vorgang.state.step !== "vorschau") throw new Error("keine Vorschau");
    expect(vorgang.state.preview.missingIsins).toEqual(["US0000000009"]);
    await applyVorschau(db, vorgang);
    expect(JSON.parse(db.setting("isins-ohne-notiz")!)).toEqual({ US0000000009: "2026-10-23", US0000000008: "2026-11-20" });
  });
});

describe("Vorgang im Speicher", () => {
  it("gehört zu einem Portfolio, ersetzt einen liegengebliebenen, verfällt und beendet dabei die Sitzung", () => {
    const state = { step: "depot" as const, depots: [] };
    const disposed: string[] = [];
    const first = openVorgang(1, {}, state, () => disposed.push("erster"), 0);
    expect(findVorgang(first.id, 1, 0)).toBe(first);
    expect(findVorgang(first.id, 2, 0)).toBeNull();
    const second = openVorgang(1, {}, state, () => disposed.push("zweiter"), 0);
    expect(findVorgang(first.id, 1, 0)).toBeNull();
    expect(disposed).toEqual(["erster"]);
    expect(findVorgang(second.id, 1, VORGANG_MINUTES * 60_000)).toBe(second);
    expect(findVorgang(second.id, 1, VORGANG_MINUTES * 60_000 + 1)).toBeNull();
    expect(disposed).toEqual(["erster", "zweiter"]);
    closeVorgang(second);
    expect(disposed).toHaveLength(2);
  });
});
