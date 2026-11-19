// Woher man auf eine Aktie gekommen ist, damit „zurück“ dorthin führt und nicht immer in die Rangliste.

/** Seiten, von denen aus eine Aktie geöffnet wird. Mit Suchparametern nur der Datenvorrat (Filter bleiben erhalten). */
const ORIGIN = /^\/(?:vorrat(?:\?[^#]*)?|portfolio(?:\/\d+)?|abgleich)?$/;

/** Prüft einen Rücksprung aus der Adresse oder einem Formular; alles Unbekannte ist die Rangliste. */
export function safeOrigin(raw: unknown): string {
  return typeof raw === "string" && ORIGIN.test(raw) ? raw : "/";
}

/** Adresse einer Aktienseite. Die Rangliste ist der Normalfall und bleibt ohne Parameter. */
export function stockPath(id: string, from: string = "/", extra: Record<string, string> = {}, hash = ""): string {
  const params = new URLSearchParams();
  if (from !== "/") params.set("von", from);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const query = params.toString();
  return `/aktie/${encodeURIComponent(id)}${query ? `?${query}` : ""}${hash}`;
}

/** Beschriftung des Wegs zurück. `portfolioName` löst die Nummer eines Portfolios auf. */
export function originLabel(from: string, portfolioName: (id: number) => string | undefined): string {
  if (from === "/") return "Rangliste";
  if (from.startsWith("/vorrat")) return "Datenvorrat";
  if (from === "/abgleich") return "Abgleich";
  const portfolio = /^\/portfolio\/(\d+)$/.exec(from);
  if (portfolio) return portfolioName(Number(portfolio[1])) ?? "Portfolio";
  return "Portfolios";
}

/** Welcher Punkt der Hauptnavigation zur Seite gehört; eine Aktienseite gehört zu der Seite, von der man kam. */
export function navSection(pathname: string, von: string | null): string {
  if (pathname.startsWith("/aktie")) {
    const origin = safeOrigin(von);
    return origin === "/" ? "/" : `/${origin.split(/[/?]/)[1]}`;
  }
  return pathname === "/" ? "/" : `/${pathname.split("/")[1]}`;
}
