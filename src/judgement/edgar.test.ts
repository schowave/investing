import { afterEach, describe, expect, it, vi } from "vitest";
import { cikFromFundamentals, excerptFrom, fetchFilings, normalizeCik, selectFilings } from "./edgar.ts";

// Gekürzte Antwort von data.sec.gov/submissions/CIK0001683695.json (International Money Express), Stand 18.11.2026.
const rows: [string, string, string, string, string][] = [
  ["0001104659-26-129822", "2026-11-18", "SCHEDULE 13D/A", "", "xslSCHEDULE_13D_X02/primary_doc.xml"],
  ["0001628280-26-074568", "2026-11-17", "4", "", "xslF345X06/wk-form4_1794952901.xml"],
  ["0001140361-26-043232", "2026-11-12", "8-K", "1.02", "ef20085433_8k.htm"],
  ["0001628280-26-072217", "2026-11-09", "10-Q", "", "imxi-20260930.htm"],
  ["0001140361-26-041709", "2026-11-03", "8-K", "8.01,9.01", "ef20084808_8k.htm"],
  ["0001140361-26-000001", "2026-06-01", "8-K", "9.01", "only-exhibits.htm"],
  ["0001628280-26-028928", "2026-04-30", "10-K/A", "", "imxi-20251231.htm"],
  ["0001140361-25-000002", "2025-11-17", "8-K", "5.02", "too-old.htm"],
];
const submissions = (data = rows) => ({
  cik: "1683695",
  filings: {
    recent: {
      accessionNumber: data.map((r) => r[0]),
      filingDate: data.map((r) => r[1]),
      form: data.map((r) => r[2]),
      items: data.map((r) => r[3]),
      primaryDocument: data.map((r) => r[4]),
    },
    files: [],
  },
});

describe("normalizeCik", () => {
  it("füllt auf zehn Stellen auf und lehnt alles andere ab", () => {
    expect(normalizeCik("0001683695")).toBe("0001683695");
    expect(normalizeCik(1683695)).toBe("0001683695");
    expect(normalizeCik("")).toBeNull();
    expect(normalizeCik("0")).toBeNull();
    expect(normalizeCik("12345678901")).toBeNull();
    expect(normalizeCik(null)).toBeNull();
  });

  it("liest die CIK aus der Rohantwort von EODHD", () => {
    expect(cikFromFundamentals(JSON.stringify({ General: { CIK: "0001683695" } }))).toBe("0001683695");
    expect(cikFromFundamentals(JSON.stringify({ General: { CIK: null } }))).toBeNull();
    expect(cikFromFundamentals(null)).toBeNull();
  });
});

describe("selectFilings", () => {
  it("nimmt aussagekräftige Mitteilungen der letzten zwölf Monate, jüngste zuerst", () => {
    const filings = selectFilings(submissions(), "0001683695", "2026-11-18");
    expect(filings.map((f) => [f.date, f.form, f.description])).toEqual([
      ["2026-11-18", "SCHEDULE 13D/A", "Amendment by an investor holding above 5 % with intent to influence the company"],
      ["2026-11-12", "8-K", "Termination of a Material Definitive Agreement"],
      ["2026-11-03", "8-K", "Other Events"],
      ["2026-04-30", "10-K/A", "Amended annual report"],
    ]);
    expect(filings[1]!.url).toBe("https://www.sec.gov/Archives/edgar/data/1683695/000114036126043232/ef20085433_8k.htm");
  });

  it("lässt Mitteilungen nach dem Stichtag weg", () => {
    expect(selectFilings(submissions(), "0001683695", "2026-11-15").map((f) => f.date)[0]).toBe("2026-11-12");
  });

  it("verlinkt den Ordner, wenn kein Hauptdokument genannt ist", () => {
    const [filing] = selectFilings(submissions([["0000000000-26-000001", "2026-10-01", "8-K/A", "4.02", ""]]), "0000000042", "2026-11-18");
    expect(filing).toEqual({
      date: "2026-10-01",
      form: "8-K/A",
      description: "Amended current report: Non-Reliance on Previously Issued Financial Statements (restatement)",
      url: "https://www.sec.gov/Archives/edgar/data/42/000000000026000001/",
      items: ["4.02"],
    });
  });

  it("lehnt eine unerwartete Antwort ab", () => {
    expect(() => selectFilings({ filings: {} }, "0001683695", "2026-11-18")).toThrow(/unerwartete Antwort/);
    const broken = submissions();
    broken.filings.recent.form.pop();
    expect(() => selectFilings(broken, "0001683695", "2026-11-18")).toThrow(/unerwartete Antwort/);
  });
});

describe("excerptFrom", () => {
  it("beginnt beim ersten Punkt, ohne Deckblatt, Tags und Entitäten", () => {
    const html = `<html><head><style>p{}</style></head><body><ix:header>hidden</ix:header><p>FORM 8-K&nbsp;Cover</p>
      <p><b>Item&#160;8.01</b> Other Events.</p><p>Western Union &amp; the &#x201C;Company&#8221; &bogus;</p></body></html>`;
    expect(excerptFrom(html)).toBe("Item 8.01 Other Events. Western Union & the \u201cCompany\u201d &bogus;");
  });

  it("kürzt an einer Wortgrenze und meldet Texte ohne Punkt", () => {
    const long = excerptFrom(`Item 1.01 ${"word ".repeat(1000)}`)!;
    expect(long.length).toBeLessThanOrEqual(1502);
    expect(long.endsWith("word …")).toBe(true);
    expect(excerptFrom("<p>nothing here</p>")).toBeNull();
  });
});

describe("fetchFilings", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fragt EDGAR mit dem User-Agent ab und liest die gewichtigen 8-Ks", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("https://data.sec.gov/")) return new Response(JSON.stringify(submissions()));
      if (url.endsWith("ef20085433_8k.htm")) return new Response("<p>Cover</p><p><b>Item 1.02</b> Termination of the merger.</p>");
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const filings = (await fetchFilings("0001683695", "2026-11-18", "investing test@example.com"))!;
    expect(filings).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://data.sec.gov/submissions/CIK0001683695.json",
      expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": "investing test@example.com" }) }),
    );
    // Gelesen werden nur die 8-Ks mit 1.02 und 8.01; das zweite ist nicht abrufbar und bleibt ohne Auszug.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(filings.map((f) => f.excerpt)).toEqual([undefined, "Item 1.02 Termination of the merger.", undefined, undefined]);
  });

  it("lässt nur den Auszug weg, wenn ein Dokument nicht lädt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("https://data.sec.gov/")) return new Response(JSON.stringify(submissions()));
        throw new Error("Zeitüberschreitung");
      }),
    );
    const filings = (await fetchFilings("0001683695", "2026-11-18", "ua"))!;
    expect(filings).toHaveLength(4);
    expect(filings.every((f) => f.excerpt === undefined)).toBe(true);
  });

  it("fragt ohne User-Agent nicht und meldet Fehler der SEC", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchFilings("0001683695", "2026-11-18", "")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(fetchFilings("0001683695", "2026-11-18", "ua")).rejects.toThrow(/403/);
  });
});
