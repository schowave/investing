import { describe, expect, it } from "vitest";
import { stock } from "../test/fixtures.ts";
import { Database } from "./db.ts";
import { normalizeSector, SECTORS } from "./sector.ts";

describe("Einheitliche Branchen", () => {
  it("bildet deutsche Namen und Varianten auf die Sektoren des Anbieters ab", () => {
    expect(normalizeSector("Banken")).toBe("Financial Services");
    expect(normalizeSector("Beteiligungen")).toBe("Financial Services");
    expect(normalizeSector("Capital Markets")).toBe("Financial Services");
    expect(normalizeSector("Tabak")).toBe("Consumer Defensive");
    expect(normalizeSector(" Technology ")).toBe("Technology");
    for (const sector of SECTORS) expect(normalizeSector(sector)).toBe(sector);
  });

  it("nimmt für unbekannte Branchen den GICS-Sektor, sonst bleibt „Unbekannt“", () => {
    expect(normalizeSector("Unbekannt", "Consumer Discretionary")).toBe("Consumer Cyclical");
    expect(normalizeSector("Other", "Financials")).toBe("Financial Services");
    expect(normalizeSector("Unbekannt", null)).toBe("Unbekannt");
    expect(normalizeSector(null, "Etwas")).toBe("Unbekannt");
    // Ein bekannter Name geht dem GICS-Sektor vor.
    expect(normalizeSector("Real Estate", "Financials")).toBe("Real Estate");
  });

  it("liefert Titel aus der Datenbank mit einheitlicher Branche", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing({ ...stock, id: "BANK.L", sector: "Banken" });
    db.addStockIfMissing({ ...stock, id: "LOTTO.AT", sector: "Unbekannt" });
    db.setGicSector("LOTTO.AT", "Consumer Discretionary");
    expect(db.stock("BANK.L")?.sector).toBe("Financial Services");
    expect(db.stock("LOTTO.AT")?.sector).toBe("Consumer Cyclical");
    db.close();
  });
});
