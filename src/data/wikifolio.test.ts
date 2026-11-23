import { describe, expect, it } from "vitest";
import { WikifolioError, WikifolioSession, WikifolioSymbol, wikifolioCredentials } from "./wikifolio.ts";

const credentials = { clientApiKey: "client-geheim", userApiKey: "user-geheim" };

type Seen = { method: string; path: string; headers: Record<string, string> };

/** Nachgebaute Trading-API: Antworten je "METHODE /pfad", der Pfad ohne Suchparameter. */
function fakeApi(routes: Record<string, (url: URL) => Response>, seen: Seen[] = []): typeof fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    seen.push({ method, path: url.pathname + url.search, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    const route = routes[`${method} ${url.pathname}`];
    return route ? route(url) : new Response("", { status: 404 });
  }) as typeof fetch;
}

const logon = () => Response.json({ sessionToken: "6ac6fac7-2070-4226-833f-3a3049d11c6e" });

describe("wikifolio-API", () => {
  it("liest die Schlüssel aus der Umgebung und verlangt beide", () => {
    expect(wikifolioCredentials({ WIKIFOLIO_CLIENT_API_KEY: " a ", WIKIFOLIO_USER_API_KEY: "b" })).toEqual({
      clientApiKey: "a",
      userApiKey: "b",
    });
    expect(wikifolioCredentials({ WIKIFOLIO_CLIENT_API_KEY: "a" })).toBeNull();
    expect(wikifolioCredentials({})).toBeNull();
  });

  it("prüft das Symbol eines Wikifolios", () => {
    expect(WikifolioSymbol.parse(" wf0shysel ")).toBe("WF0SHYSEL");
    expect(WikifolioSymbol.safeParse("SHYSEL").success).toBe(false);
    expect(WikifolioSymbol.safeParse("WF0/../x").success).toBe(false);
  });

  it("meldet sich mit beiden Schlüsseln an, liest Bargeld und Positionen und meldet sich ab", async () => {
    const seen: Seen[] = [];
    const fetchFn = fakeApi(
      {
        "POST /sessions": logon,
        "DELETE /sessions": () => new Response("", { status: 200 }),
        "GET /wikifolios/WF0SHYSEL": () =>
          Response.json({
            wikifolioSymbol: "WF0SHYSEL",
            wikifolioStatus: "Test",
            cashAccountCurrentBalance: 1234.5,
            totalValue: 100_000,
            baseCurrency: "EUR",
            positions: [{ underlying: "gb0004544929", quantity: 300, averagePurchasePrice: 29.5 }],
          }),
      },
      seen,
    );
    const session = await WikifolioSession.open(credentials, fetchFn);
    const snapshot = await session.wikifolio("WF0SHYSEL");
    await session.close();

    expect(snapshot).toEqual({
      symbol: "WF0SHYSEL",
      status: "Test",
      baseCurrency: "EUR",
      cash: 1234.5,
      totalValue: 100_000,
      positions: [{ isin: "GB0004544929", quantity: 300, averagePurchasePrice: 29.5 }],
    });
    expect(seen[0]).toMatchObject({ method: "POST", path: "/sessions" });
    expect(seen[0]!.headers).toMatchObject({ clientapikey: "client-geheim", userapikey: "user-geheim" });
    expect(seen[1]!.headers.sessiontoken).toBe("6ac6fac7-2070-4226-833f-3a3049d11c6e");
    expect(seen.at(-1)).toMatchObject({ method: "DELETE", path: "/sessions" });
  });

  it("liest das Anlageuniversum über alle Seiten", async () => {
    const seen: Seen[] = [];
    const pages = [[{ isin: "GB0004544929" }, { isin: null }], [{ isin: "us88160r1014" }]];
    const fetchFn = fakeApi(
      {
        "POST /sessions": logon,
        "GET /wikifolios/WF0SHYSEL/underlyings": (url) => {
          const page = Number(url.searchParams.get("pageNumber"));
          return Response.json({ results: pages[page - 1], pageNumber: page, totalPages: pages.length });
        },
      },
      seen,
    );
    const session = await WikifolioSession.open(credentials, fetchFn);
    expect(await session.underlyings("WF0SHYSEL")).toEqual(new Set(["GB0004544929", "US88160R1014"]));
    expect(seen.filter((s) => s.path.includes("underlyings"))).toHaveLength(2);
  });

  it("bricht ab, wenn das Universum mehr Seiten hat als erlaubt", async () => {
    const fetchFn = fakeApi({
      "POST /sessions": logon,
      "GET /wikifolios/WF0X/underlyings": (url) =>
        Response.json({ results: [], pageNumber: Number(url.searchParams.get("pageNumber")), totalPages: 99 }),
    });
    const session = await WikifolioSession.open(credentials, fetchFn);
    await expect(session.underlyings("WF0X", 3)).rejects.toThrow(/mehr als 3 Seiten/);
  });

  it("meldet Fehler mit Status und Meldung, aber ohne Schlüssel", async () => {
    const refused = WikifolioSession.open(
      credentials,
      fakeApi({ "POST /sessions": () => Response.json({ errorCode: 401, errorMessage: "Invalid api key" }, { status: 401 }) }),
    );
    await expect(refused).rejects.toBeInstanceOf(WikifolioError);
    await expect(refused).rejects.toThrow(/HTTP 401 \(Invalid api key\)/);
    await expect(refused).rejects.not.toThrow(/geheim/);

    const session = await WikifolioSession.open(credentials, fakeApi({ "POST /sessions": logon }));
    await expect(session.wikifolio("WF0UNBEKANNT")).rejects.toThrow(/HTTP 404/);
  });

  it("weist unerwartete Antworten zurück", async () => {
    const fetchFn = fakeApi({
      "POST /sessions": logon,
      "GET /wikifolios/WF0X": () => Response.json({ wikifolioStatus: "Test", positions: [] }),
    });
    const session = await WikifolioSession.open(credentials, fetchFn);
    await expect(session.wikifolio("WF0X")).rejects.toThrow(/unerwartete Antwort/);
    await expect(WikifolioSession.open(credentials, fakeApi({ "POST /sessions": () => Response.json({}) }))).rejects.toThrow(
      /unerwartete Antwort/,
    );
  });
});
