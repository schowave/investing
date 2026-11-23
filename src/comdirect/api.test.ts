import { describe, expect, it } from "vitest";
import { balanceRow, depotRow, fakeComdirect, positionRow } from "../test/comdirect.ts";
import { activate, ComdirectError, comdirectConfig, depotStand, depots, login, pushStatus, revoke } from "./api.ts";

const config = { clientId: "client", clientSecret: "geheim", username: "12345678" };
const NOW = Date.UTC(2026, 10, 23, 14, 1, 13, 250);
const noop = () => {};

async function activated(bank: ReturnType<typeof fakeComdirect>) {
  const { session, challenge } = await login(config, "123456", noop, bank.fetchFn, NOW);
  await activate(config, session, challenge, null, bank.fetchFn, NOW);
  return session;
}

describe("comdirect-Client", () => {
  it("liest die Zugangsdaten aus der Umgebung und bietet ohne sie nichts an", () => {
    expect(comdirectConfig({ COMDIRECT_CLIENT_ID: " a ", COMDIRECT_CLIENT_SECRET: "b", COMDIRECT_USERNAME: "c" })).toEqual({
      clientId: "a",
      clientSecret: "b",
      username: "c",
    });
    expect(comdirectConfig({ COMDIRECT_CLIENT_ID: "a", COMDIRECT_CLIENT_SECRET: "b" })).toBeNull();
    expect(comdirectConfig({ COMDIRECT_CLIENT_ID: "$(creds read id)", COMDIRECT_CLIENT_SECRET: "b", COMDIRECT_USERNAME: "c" })).toBeNull();
  });

  it("meldet sich an, fordert die pushTAN an und schickt Kennungen nach der Spezifikation", async () => {
    const bank = fakeComdirect();
    let challenges = 0;
    const { session, challenge } = await login(config, "123456", () => challenges++, bank.fetchFn, NOW);
    expect(challenge).toEqual({ id: "CH1", typ: "P_TAN_PUSH", image: null, statusPath: "/api/session/v1/authentications/AUTH1" });
    expect(challenges).toBe(1);
    expect(bank.calls[0]!.body).toBe("client_id=client&client_secret=geheim&grant_type=password&username=12345678&password=123456");
    const info = JSON.parse(bank.calls[1]!.headers["x-http-request-info"]!);
    expect(info.clientRequestId.sessionId).toMatch(/^[0-9a-f]{32}$/);
    // HHmmssSSS, je Abruf eindeutig, auch in derselben Millisekunde.
    expect(info.clientRequestId.requestId).toBe("140113250");
    expect(JSON.parse(bank.calls[2]!.headers["x-http-request-info"]!).clientRequestId.requestId).toBe("140113251");
    expect(session.identifier).toBe("SESSION1");

    expect(await pushStatus(session, challenge, bank.fetchFn, NOW)).toBe("confirmed");
    await activate(config, session, challenge, null, bank.fetchFn, NOW);
    const patch = bank.calls.find((c) => c.method === "PATCH")!;
    expect(patch.headers["x-once-authentication-info"]).toBe('{"id":"CH1"}');
    expect(patch.headers["x-once-authentication"]).toBeUndefined();
    expect(bank.calls.at(-1)!.body).toContain("grant_type=cd_secondary&token=access-password");
    expect(session).toMatchObject({ activated: true, tokens: { access: "access-cd_secondary" } });
  });

  it("weicht von mobileTAN auf photoTAN aus und schickt die TAN mit", async () => {
    const bank = fakeComdirect({ preferred: "M_TAN", available: ["M_TAN", "P_TAN"] });
    let challenges = 0;
    const { session, challenge } = await login(config, "123456", () => challenges++, bank.fetchFn, NOW);
    expect(challenges).toBe(2);
    expect(challenge).toMatchObject({ typ: "P_TAN", image: "iVBORw0KGgo=", statusPath: null });
    expect(await pushStatus(session, challenge, bank.fetchFn, NOW)).toBe("confirmed");
    await expect(activate(config, session, challenge, "12345", bank.fetchFn, NOW)).rejects.toThrow(/sechs Ziffern/);
    await expect(activate(config, session, challenge, "111111", bank.fetchFn, NOW)).rejects.toThrow(/HTTP 422.*TAN_UNGUELTIG/);
    await activate(config, session, challenge, "654321", bank.fetchFn, NOW);
    expect(bank.calls.filter((c) => c.method === "PATCH").at(-1)!.headers["x-once-authentication"]).toBe("654321");
  });

  it("lehnt Verfahren ab, die die Oberfläche nicht abschließen kann", async () => {
    let challenges = 0;
    const onlySms = fakeComdirect({ preferred: "M_TAN", available: ["M_TAN"] });
    await expect(login(config, "123456", () => challenges++, onlySms.fetchFn, NOW)).rejects.toThrow(/M_TAN wird hier nicht unterstützt/);
    expect(challenges).toBe(1);
  });

  it("nennt eine falsche PIN, ohne sie zu wiederholen, und meldet Ausfälle verständlich", async () => {
    const error = await login(config, "999999", noop, fakeComdirect().fetchFn, NOW).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ComdirectError);
    expect((error as Error).message).toMatch(/Anmeldung fehlgeschlagen \(HTTP 401\).*PIN stimmt nicht/);
    expect((error as Error).message).not.toContain("999999");

    const down = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await expect(login(config, "123456", noop, down, NOW)).rejects.toThrow("comdirect: Anmeldung nicht erreichbar.");
    const busy = fakeComdirect({ failures: { "/api/session/clients/user/v1/sessions": 429 } });
    await expect(login(config, "123456", noop, busy.fetchFn, NOW)).rejects.toThrow(/HTTP 429\): FEHLER: Testfehler\. Zu viele/);
    const oauth = (async () =>
      Response.json({ error: "invalid_grant", error_description: "Bad credentials" }, { status: 403 })) as unknown as typeof fetch;
    await expect(login(config, "123456", noop, oauth, NOW)).rejects.toThrow(/HTTP 403\): invalid_grant: Bad credentials\. Zugangsnummer/);
    const garbage = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    await expect(login(config, "123456", noop, garbage, NOW)).rejects.toThrow(/kein JSON/);
    const wrongShape = (async () => Response.json({ access_token: "" })) as unknown as typeof fetch;
    await expect(login(config, "123456", noop, wrongShape, NOW)).rejects.toThrow(/unerwartete Antwort/);
  });

  it("meldet eine abgelehnte pushTAN und eine, die noch aussteht", async () => {
    const pending = fakeComdirect({ pendingPolls: 1 });
    const first = await login(config, "123456", noop, pending.fetchFn, NOW);
    expect(await pushStatus(first.session, first.challenge, pending.fetchFn, NOW)).toBe("pending");
    expect(await pushStatus(first.session, first.challenge, pending.fetchFn, NOW)).toBe("confirmed");
    const rejected = fakeComdirect({ pendingPolls: "abgelehnt" });
    const second = await login(config, "123456", noop, rejected.fetchFn, NOW);
    expect(await pushStatus(second.session, second.challenge, rejected.fetchFn, NOW)).toBe("failed");
  });

  it("liest Depots, Positionen und den Saldo des Verrechnungskontos", async () => {
    const bank = fakeComdirect({
      depots: [{ ...depotRow("D1", "1234567890"), settlementAccountIds: ["K9"] }],
      positions: [
        positionRow("de000basf111", "10", "SHARE", "450.50", "BASF"),
        positionRow("IE00B4L5Y983", "2.5", "ETF", "250.00"),
        { ...positionRow("XS0000000001", "1000", "BONDS"), currentValue: { value: "990.00", unit: "USD" } },
        { wkn: "ABC123", quantity: { value: "1", unit: "XXX" }, instrument: null },
      ],
      paging: { matches: 5 },
      // Das Depot nennt das Konto hier mit seiner Kontonummer, nicht mit der Kennung.
      balances: [
        balanceRow("K0", "5.00", "SA"),
        balanceRow("1234567890X", "1.00"),
        { ...balanceRow("UUID", "1500.25"), account: { accountDisplayId: "1234567890" } },
      ],
    });
    const session = await activated(bank);
    const list = await depots(config, session, bank.fetchFn, NOW);
    expect(list).toEqual([{ id: "D1", displayId: "D1-Nr", settlementAccountIds: ["1234567890", "K9"] }]);
    const stand = await depotStand(config, session, list[0]!, bank.fetchFn, NOW);
    expect(bank.calls.find((c) => c.path.includes("/positions"))!.path).toBe("/api/brokerage/v3/depots/D1/positions?with-attr=instrument");
    expect(stand.positions).toEqual([
      { isin: "DE000BASF111", wkn: "A0B1C2", name: "BASF", kind: "aktie", quantity: 10, valueEur: 450.5 },
      { isin: "IE00B4L5Y983", wkn: "A0B1C2", name: "Titel IE00B4L5Y983", kind: "sonstiges", quantity: 2.5, valueEur: 250 },
      { isin: "XS0000000001", wkn: "A0B1C2", name: "Titel XS0000000001", kind: "sonstiges", quantity: 1000, valueEur: null },
      { isin: null, wkn: "ABC123", name: "WKN ABC123", kind: "sonstiges", quantity: 1, valueEur: null },
    ]);
    expect(stand.cashEur).toBe(1500.25);
    expect(stand.warnings).toEqual(["Die Bank meldet 5 Positionen, geliefert hat sie 4. Unvollständig lässt sich nichts übernehmen."]);
    // Authorization mit dem Token nach der TAN.
    expect(bank.calls.at(-1)!.headers.authorization).toBe("Bearer access-cd_secondary");
  });

  it("findet kein Verrechnungskonto und weist kaputte Beträge zurück", async () => {
    const bank = fakeComdirect({ balances: [balanceRow("ANDERES", "10")], positions: [positionRow("DE0000000001", "1,5")] });
    const session = await activated(bank);
    await expect(depotStand(config, session, { id: "D1", displayId: "", settlementAccountIds: ["K1"] }, bank.fetchFn, NOW)).rejects.toThrow(
      /Unerwarteter Betrag in der Stückzahl/,
    );
    const empty = fakeComdirect({ balances: [balanceRow("ANDERES", "10")] });
    const other = await activated(empty);
    expect(
      (await depotStand(config, other, { id: "D1", displayId: "", settlementAccountIds: ["K1"] }, empty.fetchFn, NOW)).cashEur,
    ).toBeNull();
  });

  it("verlängert die Tokens vor Ablauf und verlangt vorher die TAN", async () => {
    const bank = fakeComdirect();
    const { session } = await login(config, "123456", noop, bank.fetchFn, NOW);
    await expect(depots(config, session, bank.fetchFn, NOW)).rejects.toThrow(/noch nicht mit einer TAN/);
    const ready = await activated(bank);
    await depots(config, ready, bank.fetchFn, NOW + 8 * 60_000);
    expect(bank.calls.some((c) => c.body.includes("grant_type=refresh_token&refresh_token=refresh-cd_secondary"))).toBe(true);
    expect(ready.tokens.access).toBe("access-refresh_token");
  });

  it("beendet die Sitzung und schluckt Fehler dabei", async () => {
    const bank = fakeComdirect();
    const session = await activated(bank);
    await revoke(session, bank.fetchFn, NOW);
    expect(bank.calls.at(-1)).toMatchObject({ method: "DELETE", path: "/oauth/revoke" });
    const down = (async () => {
      throw new Error("weg");
    }) as unknown as typeof fetch;
    await expect(revoke(session, down, NOW)).resolves.toBeUndefined();
  });
});
