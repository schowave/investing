// Nachgebaute comdirect für Tests: beantwortet die Abrufe des Clients nach der Schnittstellenspezifikation.

export interface FakeBankOptions {
  /** Verfahren, das die Bank ohne Wunsch anbietet. */
  preferred?: string;
  available?: string[];
  /** So oft meldet die Bank PENDING, bevor die pushTAN bestätigt ist; `"abgelehnt"` meldet CANCELED. */
  pendingPolls?: number | "abgelehnt";
  pin?: string;
  tan?: string;
  depots?: unknown[];
  positions?: unknown[];
  paging?: { matches: number };
  balances?: unknown[];
  /** Pfade, die mit diesem Status scheitern. */
  failures?: Record<string, number>;
}

interface FakeCall {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

export const depotRow = (id = "D1", settlement = "K1") => ({
  depotId: id,
  depotDisplayId: `${id}-Nr`,
  clientId: "C",
  defaultSettlementAccountId: settlement,
  settlementAccountIds: [],
});

export const positionRow = (isin: string, quantity: string, type = "SHARE", value = "100.00", name = `Titel ${isin}`) => ({
  depotId: "D1",
  positionId: `P-${isin}`,
  wkn: "A0B1C2",
  quantity: { value: quantity, unit: "XXX" },
  currentValue: { value, unit: "EUR" },
  instrument: { isin, name, shortName: name, staticData: { instrumentType: type, currency: "EUR" } },
});

export const balanceRow = (accountId: string, value: string, type = "CA") => ({
  accountId,
  account: { accountId, accountDisplayId: `${accountId}-Nr`, currency: "EUR", accountType: { key: type, text: type } },
  balance: { value, unit: "EUR" },
  balanceEUR: { value, unit: "EUR" },
  availableCashAmountEUR: { value: "999999", unit: "EUR" },
});

export function fakeComdirect(options: FakeBankOptions = {}) {
  const calls: FakeCall[] = [];
  let polls = 0;
  let validations = 0;
  const preferred = options.preferred ?? "P_TAN_PUSH";
  const available = options.available ?? ["P_TAN_PUSH", "P_TAN"];

  const fetchFn = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    const body = typeof init.body === "string" ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : "";
    calls.push({ method, path: url.pathname + url.search, headers, body });
    const failure = options.failures?.[url.pathname];
    if (failure) return Response.json({ code: "FEHLER", messages: [{ message: "Testfehler" }] }, { status: failure });

    if (url.pathname === "/oauth/token") {
      const form = new URLSearchParams(body);
      const grant = form.get("grant_type");
      if (grant === "password" && form.get("password") !== (options.pin ?? "123456")) return new Response("", { status: 401 });
      return Response.json({ access_token: `access-${grant}`, refresh_token: `refresh-${grant}`, expires_in: 599 });
    }
    if (url.pathname === "/oauth/revoke") return new Response(null, { status: 204 });
    if (url.pathname === "/api/session/clients/user/v1/sessions") {
      return Response.json([{ identifier: "SESSION1", sessionTanActive: false, activated2FA: false }]);
    }
    if (url.pathname === "/api/session/clients/user/v1/sessions/SESSION1/validate") {
      validations++;
      const wanted = headers["x-once-authentication-info"] ? JSON.parse(headers["x-once-authentication-info"]).typ : preferred;
      const info = {
        id: `CH${validations}`,
        typ: wanted,
        availableTypes: available,
        ...(wanted === "P_TAN" ? { challenge: "iVBORw0KGgo=" } : {}),
        ...(wanted === "M_TAN" ? { challenge: "+49-160-99XXXX" } : {}),
        ...(wanted === "P_TAN_PUSH" ? { link: { href: "/api/session/v1/authentications/AUTH1", rel: "related", method: "GET" } } : {}),
      };
      return Response.json({ identifier: "SESSION1" }, { status: 201, headers: { "x-once-authentication-info": JSON.stringify(info) } });
    }
    if (url.pathname === "/api/session/v1/authentications/AUTH1") {
      if (options.pendingPolls === "abgelehnt") return Response.json({ status: "CANCELED" });
      polls++;
      return Response.json({ status: polls > (options.pendingPolls ?? 0) ? "AUTHENTICATED" : "PENDING" });
    }
    if (url.pathname === "/api/session/clients/user/v1/sessions/SESSION1" && method === "PATCH") {
      const tan = headers["x-once-authentication"];
      if (tan !== undefined && tan !== (options.tan ?? "654321")) return Response.json({ code: "TAN_UNGUELTIG" }, { status: 422 });
      return Response.json({ identifier: "SESSION1", sessionTanActive: true, activated2FA: true });
    }
    if (url.pathname === "/api/brokerage/clients/user/v3/depots") {
      return Response.json({ paging: { index: 0, matches: 1 }, values: options.depots ?? [depotRow()] });
    }
    const positions = url.pathname.match(/^\/api\/brokerage\/v3\/depots\/([^/]+)\/positions$/);
    if (positions) {
      const values = options.positions ?? [];
      return Response.json({ paging: options.paging ?? { index: 0, matches: values.length }, values });
    }
    if (url.pathname === "/api/banking/clients/user/v2/accounts/balances") {
      return Response.json({ paging: { index: 0, matches: 1 }, values: options.balances ?? [balanceRow("K1", "1500.25")] });
    }
    return new Response("unbekannt", { status: 404 });
  }) as typeof fetch;

  return { fetchFn, calls };
}
