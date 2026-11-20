import { describe, expect, it } from "vitest";
import { fxPerEur, parseEcbHistory } from "./fx.ts";

const XML = `<?xml version="1.0"?><gesmes:Envelope><Cube>
<Cube time='2026-11-20'><Cube currency='USD' rate='1.1000'/><Cube currency='GBP' rate='0.8400'/></Cube>
<Cube time='2026-11-18'><Cube currency='USD' rate='1.0500'/><Cube currency='GBP' rate='0.8300'/></Cube>
</Cube></gesmes:Envelope>`;

describe("EZB-Historie", () => {
  const history = parseEcbHistory(XML);

  it("liest alle Tage je Währung aufsteigend", () => {
    expect(history.get("USD")).toEqual([
      { date: "2026-11-18", rate: 1.05 },
      { date: "2026-11-20", rate: 1.1 },
    ]);
  });

  it("nimmt den Kurs des Tages oder den letzten davor", () => {
    expect(fxPerEur(history, "USD", "2026-11-20")).toBe(1.1);
    expect(fxPerEur(history, "USD", "2026-11-19")).toBe(1.05);
    expect(fxPerEur(history, "USD", "2026-11-30")).toBe(1.1);
  });

  it("liefert für den Euro 1 und für Unterwährungen den Kurs der Hauptwährung", () => {
    expect(fxPerEur(history, "EUR", "2026-11-20")).toBe(1);
    expect(fxPerEur(history, "GBX", "2026-11-20")).toBe(0.84);
  });

  it("liefert null ohne Kurs, vor dem ersten Tag und bei zu altem Kurs", () => {
    expect(fxPerEur(history, "TWD", "2026-11-20")).toBeNull();
    expect(fxPerEur(history, "USD", "2026-11-01")).toBeNull();
    expect(fxPerEur(history, "USD", "2026-12-31")).toBeNull();
    expect(fxPerEur(history, "USD", "2026-12-31", 60)).toBe(1.1);
  });

  it("überspringt einzelne Währungen ohne Kurs, statt alles zu verwerfen", () => {
    const partial = parseEcbHistory(
      "<Cube time='2026-11-20'><Cube currency='USD' rate='1.1'/><Cube currency='BGN' rate='N/A'/><Cube currency='XYZ' rate='-1'/></Cube>",
    );
    expect([...partial.keys()]).toEqual(["USD"]);
  });

  it("wirft bei leerem Inhalt und bei einem unbrauchbaren Datum", () => {
    expect(() => parseEcbHistory("<xml/>")).toThrow(/keine Kurse/);
    expect(() => parseEcbHistory("<Cube time='gestern'><Cube currency='USD' rate='1'/></Cube>")).toThrow();
  });
});
