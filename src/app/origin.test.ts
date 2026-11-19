import { describe, expect, it } from "vitest";
import { navSection, originLabel, safeOrigin, stockPath } from "./origin.ts";

describe("safeOrigin", () => {
  it("lässt Seiten der Anwendung zu, auch den Datenvorrat mit Filtern", () => {
    expect(safeOrigin("/vorrat?q=nestle&region=Europa")).toBe("/vorrat?q=nestle&region=Europa");
    expect(safeOrigin("/portfolio/3")).toBe("/portfolio/3");
    expect(safeOrigin("/abgleich")).toBe("/abgleich");
  });

  it("fällt bei allem anderen auf die Rangliste zurück", () => {
    for (const raw of [undefined, "", "//evil.example", "https://evil.example", "/aktie/X", "/vorrat#x", "/portfolio/abc", 5]) {
      expect(safeOrigin(raw)).toBe("/");
    }
  });
});

describe("stockPath", () => {
  it("lässt den Normalfall ohne Parameter", () => {
    expect(stockPath("NESN.SW")).toBe("/aktie/NESN.SW");
    expect(stockPath("NESN.SW", "/", {}, "#urteil")).toBe("/aktie/NESN.SW#urteil");
  });

  it("trägt den Ursprung samt seiner Filter und weitere Parameter", () => {
    const path = stockPath("KAP.IL", "/vorrat?q=a&region=Asien", { gespeichert: "1" }, "#urteil");
    const url = new URL(path, "http://x");
    expect(url.pathname).toBe("/aktie/KAP.IL");
    expect(url.searchParams.get("von")).toBe("/vorrat?q=a&region=Asien");
    expect(url.searchParams.get("gespeichert")).toBe("1");
    expect(url.hash).toBe("#urteil");
  });
});

describe("originLabel", () => {
  const name = (id: number) => (id === 2 ? "Rente" : undefined);
  it("nennt das Ziel des Rückwegs", () => {
    expect(originLabel("/", name)).toBe("Rangliste");
    expect(originLabel("/vorrat?q=x", name)).toBe("Datenvorrat");
    expect(originLabel("/abgleich", name)).toBe("Abgleich");
    expect(originLabel("/portfolio/2", name)).toBe("Rente");
    expect(originLabel("/portfolio/9", name)).toBe("Portfolio");
    expect(originLabel("/portfolio", name)).toBe("Portfolios");
  });
});

describe("navSection", () => {
  it("ordnet eine Aktienseite der Herkunftsseite zu", () => {
    expect(navSection("/aktie/X", null)).toBe("/");
    expect(navSection("/aktie/X", "/vorrat?q=a")).toBe("/vorrat");
    expect(navSection("/aktie/X", "/portfolio/4")).toBe("/portfolio");
    expect(navSection("/aktie/X", "//evil")).toBe("/");
  });

  it("nimmt sonst den ersten Pfadteil", () => {
    expect(navSection("/", null)).toBe("/");
    expect(navSection("/portfolio/4", null)).toBe("/portfolio");
    expect(navSection("/strategie", null)).toBe("/strategie");
  });
});
