import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetOpenChallenges } from "../comdirect/abruf.ts";
import { findVorgang } from "../comdirect/vorgang.ts";
import { Database } from "../data/db.ts";
import { fakeComdirect, positionRow } from "../test/comdirect.ts";
import { stock } from "../test/fixtures.ts";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let db: Database;
vi.mock("./server.ts", () => ({ database: () => db, today: () => "2026-11-23" }));

const { applyComdirect, cancelComdirect, chooseComdirectDepot, confirmComdirectTan, retryComdirect, startComdirect } = await import(
  "./comdirectActions.ts"
);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
/** Ziel der Weiterleitung, die eine Server Action auslöst. */
async function target(action: Promise<void>): Promise<URL> {
  const error = await action.then(
    () => null,
    (e: unknown) => e,
  );
  const message = error instanceof Error ? error.message : "";
  if (!message.startsWith("redirect:")) throw new Error(`keine Weiterleitung: ${message}`);
  return new URL(message.slice("redirect:".length), "http://app");
}

let portfolio: number;
beforeEach(() => {
  resetOpenChallenges();
  vi.stubEnv("COMDIRECT_CLIENT_ID", "client");
  vi.stubEnv("COMDIRECT_CLIENT_SECRET", "geheim");
  vi.stubEnv("COMDIRECT_USERNAME", "12345678");
  db = new Database(":memory:");
  db.addStockIfMissing({ ...stock, id: "BAS.XETRA", name: "BASF" });
  db.setIsin("BAS.XETRA", "DE000BASF111");
  portfolio = db.createPortfolio("Depot", "fokussiert");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Server Actions für die comdirect", () => {
  it("führt mit photoTAN bis zur Übernahme und stellt die Aufnahme fehlender Aktien ein", async () => {
    const bank = fakeComdirect({
      preferred: "P_TAN",
      positions: [positionRow("DE000BASF111", "3"), positionRow("US0000000009", "1")],
    });
    vi.stubGlobal("fetch", bank.fetchFn);
    const started = await target(startComdirect(portfolio, form({ pin: "123456" })));
    expect(started.pathname).toBe(`/portfolio/${portfolio}/comdirect`);
    const vorgang = started.searchParams.get("vorgang")!;

    const short = await target(confirmComdirectTan(portfolio, vorgang, form({ tan: "12" })));
    expect(short.searchParams.get("hinweis")).toBe("Die TAN hat sechs Ziffern.");
    const confirmed = await target(confirmComdirectTan(portfolio, vorgang, form({ tan: "654321" })));
    expect(confirmed.searchParams.get("vorgang")).toBe(vorgang);
    expect(findVorgang(vorgang, portfolio)!.state.step).toBe("vorschau");
    // Doppelt abgeschickt: zurück zur Vorschau, keine zweite Freigabe.
    expect((await target(confirmComdirectTan(portfolio, vorgang, form({ tan: "654321" })))).searchParams.get("vorgang")).toBe(vorgang);

    const applied = await target(applyComdirect(portfolio, vorgang));
    expect(applied.pathname).toBe(`/portfolio/${portfolio}`);
    expect(applied.searchParams.get("gespeichert")).toBe("comdirect");
    const job = db.job(Number(applied.searchParams.get("lauf")))!;
    expect(job).toMatchObject({ kind: "add-stocks", args: { isins: ["US0000000009"], symbols: [], watch: false } });
    expect(db.holdings(portfolio)).toEqual(new Map([["BAS.XETRA", 3]]));
  });

  it("meldet fehlende Zugangsdaten, falsche Eingaben und abgelaufene Vorgänge auf der Seite des Abrufs", async () => {
    vi.stubGlobal("fetch", fakeComdirect().fetchFn);
    expect((await target(startComdirect(portfolio, form({ pin: "12ab" })))).searchParams.get("fehler")).toMatch(/nur Ziffern/);
    expect((await target(startComdirect(portfolio, form({ pin: "000000" })))).searchParams.get("fehler")).toMatch(/PIN stimmt nicht/);
    expect((await target(startComdirect(9999, form({ pin: "123456" })))).pathname).toBe("/portfolio");
    expect((await target(confirmComdirectTan(portfolio, "weg", form({})))).searchParams.get("fehler")).toMatch(/abgelaufen/);
    expect((await target(applyComdirect(portfolio, "weg"))).searchParams.get("fehler")).toMatch(/abgelaufen/);
    expect((await target(retryComdirect(portfolio, "weg"))).searchParams.get("fehler")).toMatch(/abgelaufen/);
    vi.stubEnv("COMDIRECT_CLIENT_ID", "");
    expect((await target(startComdirect(portfolio, form({ pin: "123456" })))).searchParams.get("fehler")).toMatch(/Zugangsdaten/);
  });

  it("verbirgt unerwartete Fehler und setzt den Zähler der TAN-Anforderungen nur auf Wunsch zurück", async () => {
    vi.stubGlobal("fetch", (async () => {
      throw new TypeError("geheimes Detail");
    }) as unknown as typeof fetch);
    const failed = await target(startComdirect(portfolio, form({ pin: "123456" })));
    expect(failed.searchParams.get("fehler")).toBe("comdirect: Anmeldung nicht erreichbar.");

    vi.stubGlobal("fetch", fakeComdirect({ pendingPolls: 1000 }).fetchFn);
    for (let i = 0; i < 3; i++) await target(startComdirect(portfolio, form({ pin: "123456" })));
    expect((await target(startComdirect(portfolio, form({ pin: "123456" })))).searchParams.get("fehler")).toMatch(/Schon 3/);
    const again = await target(startComdirect(portfolio, form({ pin: "123456", zaehler: "on" })));
    expect(again.searchParams.get("vorgang")).toBeTruthy();
  });

  it("wählt ein Depot und bricht ab", async () => {
    const bank = fakeComdirect({
      depots: [
        { depotId: "D1", depotDisplayId: "111", defaultSettlementAccountId: "K1" },
        { depotId: "D2", depotDisplayId: "222", defaultSettlementAccountId: "K2" },
      ],
    });
    vi.stubGlobal("fetch", bank.fetchFn);
    const vorgang = (await target(startComdirect(portfolio, form({ pin: "123456" })))).searchParams.get("vorgang")!;
    await target(confirmComdirectTan(portfolio, vorgang, form({})));
    expect(findVorgang(vorgang, portfolio)!.state.step).toBe("depot");
    expect((await target(chooseComdirectDepot(portfolio, vorgang, form({})))).searchParams.get("hinweis")).toBe("Bitte ein Depot wählen.");
    expect((await target(chooseComdirectDepot(portfolio, vorgang, form({ depot: "D9" })))).searchParams.get("fehler")).toMatch(
      /gehört nicht/,
    );
    // Ein Fehler beendet den Vorgang nicht, und die Seite behält ihn.
    expect((await target(chooseComdirectDepot(portfolio, vorgang, form({ depot: "D9" })))).searchParams.get("vorgang")).toBe(vorgang);
    expect((await target(retryComdirect(portfolio, vorgang))).searchParams.get("fehler")).toMatch(/nichts neu zu laden/);
    await target(chooseComdirectDepot(portfolio, vorgang, form({ depot: "D2" })));
    expect(findVorgang(vorgang, portfolio)!.state).toMatchObject({ step: "vorschau", depot: { id: "D2" } });

    expect((await target(cancelComdirect(portfolio, vorgang))).pathname).toBe(`/portfolio/${portfolio}`);
    expect(findVorgang(vorgang, portfolio)).toBeNull();
    expect(bank.calls.at(-1)!.path).toBe("/oauth/revoke");
    expect((await target(cancelComdirect(portfolio, vorgang))).pathname).toBe(`/portfolio/${portfolio}`);
  });
});
