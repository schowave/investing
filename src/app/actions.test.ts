import { beforeEach, describe, expect, it, vi } from "vitest";
import { Database } from "../data/db.ts";
import { LEVELS_VERSION } from "../judgement/factors.ts";
import { stock } from "../test/fixtures.ts";

// redirect() beendet eine Server Action in Next.js mit einer Ausnahme; hier ebenso, mit dem Ziel als Text.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
let db: Database;
vi.mock("./server.ts", () => ({ database: () => db, today: () => "2026-11-19" }));
// Jev und die Recherche laufen nicht wirklich; der Test entscheidet, ob die Einstufung gelingt.
const judgeStock = vi.fn();
vi.mock("../judgement/judge.ts", () => ({ judgeStock: (...args: unknown[]) => judgeStock(...args) }));

const {
  addStocks,
  cancelJob,
  createPortfolio,
  deletePortfolio,
  refreshStockData,
  requestJudgement,
  saveHoldings,
  saveInputs,
  saveManualPrice,
  setAutoSync,
  setPortfolioSource,
  setWatched,
  startHistory,
  startIndexImport,
  startRefresh,
  startSync,
  startWikifolioSync,
} = await import("./actions.ts");

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const london = { ...stock, id: "IMB.LSE", priceCurrency: "GBP", reportingCurrency: "GBP", priceDivisor: 100 };

beforeEach(() => {
  db = new Database(":memory:");
  db.addStockIfMissing(london);
});

describe("Server Actions", () => {
  it("speichert einen Handkurs mit Dezimalkomma in der Einheit der Notiz", async () => {
    await expect(saveManualPrice("IMB.LSE", form({ price: "28,5" }))).rejects.toThrow("redirect:/aktie/IMB.LSE?gespeichert=1");
    expect(db.latestPrice("IMB.LSE")).toEqual({ date: "2026-11-19", close: 28.5 });
  });

  it.each(["0", "-3", "abc", "", "1.2.3"])("weist den Kurs %j zurück", async (price) => {
    await expect(saveManualPrice("IMB.LSE", form({ price }))).rejects.toThrow(/fehler=Der\+Kurs/);
    expect(db.latestPrice("IMB.LSE")).toBeNull();
  });

  it("legt Portfolios an und fällt bei unbekanntem Profil auf fokussiert zurück", async () => {
    await expect(createPortfolio(form({ name: "  ", profile: "global" }))).rejects.toThrow(/fehler=Bitte/);
    await expect(createPortfolio(form({ name: " Depot ", profile: "global" }))).rejects.toThrow("redirect:/portfolio/1");
    await expect(createPortfolio(form({ name: "Zweites", profile: "erfunden" }))).rejects.toThrow("redirect:/portfolio/2");
    expect(db.portfolios().map((p) => [p.name, p.profile])).toEqual([
      ["Depot", "global"],
      ["Zweites", "fokussiert"],
    ]);
    await expect(deletePortfolio(1)).rejects.toThrow("redirect:/portfolio");
    expect(db.portfolios()).toHaveLength(1);
  });

  it("speichert Barbestand, sonstige Anlagen und Stückzahlen; leer heißt 0", async () => {
    const id = db.createPortfolio("Depot", "fokussiert");
    db.setHolding(id, "IMB.LSE", 5);
    await expect(saveHoldings(id, form({ cash: "1.000,5", other: "" }))).rejects.toThrow(/fehler=Barbestand/);
    await expect(saveHoldings(id, form({ cash: "1000,5", other: "", "shares:IMB.LSE": "12" }))).rejects.toThrow(/gespeichert=1/);
    expect(db.portfolio(id)).toMatchObject({ cashEur: 1000.5, otherEur: 0 });
    expect(db.holdings(id).get("IMB.LSE")).toBe(12);
    await expect(saveHoldings(id, form({ "shares:IMB.LSE": "-1" }))).rejects.toThrow(/fehler=IMB.LSE/);
    await expect(saveHoldings(id, form({}))).rejects.toThrow(/gespeichert=1/);
    expect(db.holdings(id).size).toBe(0);
    await expect(saveHoldings(999, form({}))).rejects.toThrow("redirect:/portfolio");
  });

  it("springt nach dem Merken nur innerhalb der Anwendung zurück", async () => {
    await expect(setWatched("IMB.LSE", false, "/vorrat?q=imb")).rejects.toThrow("redirect:/vorrat?q=imb");
    expect(db.stock("IMB.LSE")?.watched).toBe(false);
    await expect(setWatched("IMB.LSE", true, "https://example.com")).rejects.toThrow(/^redirect:\/$/);
    await expect(setWatched("IMB.LSE", true, "//example.com")).rejects.toThrow(/^redirect:\/$/);
    await expect(setWatched("IMB.LSE", true, "/\\example.com")).rejects.toThrow(/^redirect:\/$/);
  });

  it("speichert Eingaben, leert manuelle Werte und meldet ungültige", async () => {
    await expect(saveInputs("UNBEKANNT", form({}))).rejects.toThrow(/^redirect:\/$/);
    db.setManualInput("IMB.LSE", "risk.moat", 0.05, "Notiz bleibt");
    await expect(saveInputs("IMB.LSE", form({ growth: "2,3", "risk.moat": "4" }))).rejects.toThrow(/gespeichert=1/);
    expect(db.manualInputs("IMB.LSE").map((i) => [i.key, i.value, i.note])).toEqual([
      ["growth", 0.023, ""],
      ["risk.moat", 0.04, "Notiz bleibt"],
    ]);
    await expect(saveInputs("IMB.LSE", form({ growth: "viel" }))).rejects.toThrow(/fehler=/);
    await expect(saveInputs("IMB.LSE", form({}))).rejects.toThrow(/gespeichert=1/);
    expect(db.manualInputs("IMB.LSE")).toEqual([]);
  });

  it("holt Jev-Vorschläge und meldet Fehler auf der Aktienseite", async () => {
    await expect(requestJudgement("UNBEKANNT", form({}))).rejects.toThrow(/^redirect:\/$/);
    judgeStock.mockResolvedValueOnce({});
    await expect(requestJudgement("IMB.LSE", form({ research: "off" }))).rejects.toThrow("redirect:/aktie/IMB.LSE#urteil");
    expect(judgeStock.mock.calls.at(-1)?.[3]).toEqual({ research: false, freshResearch: false });
    judgeStock.mockResolvedValueOnce({});
    await expect(requestJudgement("IMB.LSE", form({ research: "on", fresh: "1" }))).rejects.toThrow(/#urteil/);
    expect(judgeStock.mock.calls.at(-1)?.[3]).toEqual({ research: true, freshResearch: true });
    judgeStock.mockRejectedValueOnce(new Error("Jev antwortet mit 503"));
    await expect(requestJudgement("IMB.LSE", form({ research: "on" }))).rejects.toThrow(/fehler=Jev\+antwortet\+mit\+503/);
  });

  it("behält den Ursprung der Aktienseite durch Speichern, Fehler, Jev und Aktualisieren", async () => {
    const von = "/portfolio/2";
    await expect(saveInputs("IMB.LSE", form({ growth: "2", von }))).rejects.toThrow(
      "redirect:/aktie/IMB.LSE?von=%2Fportfolio%2F2&gespeichert=1",
    );
    await expect(saveInputs("IMB.LSE", form({ growth: "viel", von }))).rejects.toThrow(/von=%2Fportfolio%2F2&fehler=/);
    judgeStock.mockResolvedValueOnce({});
    await expect(requestJudgement("IMB.LSE", form({ research: "off", von }))).rejects.toThrow(
      "redirect:/aktie/IMB.LSE?von=%2Fportfolio%2F2#urteil",
    );
    await expect(saveManualPrice("IMB.LSE", form({ price: "12,5", von }))).rejects.toThrow(/von=%2Fportfolio%2F2&gespeichert=1/);
    await expect(refreshStockData("IMB.LSE", form({ von: "/vorrat?q=imb" }))).rejects.toThrow(/von=%2Fvorrat%3Fq%3Dimb&lauf=/);
  });

  it("ignoriert einen fremden Ursprung", async () => {
    await expect(saveInputs("IMB.LSE", form({ growth: "2", von: "https://example.com" }))).rejects.toThrow(
      "redirect:/aktie/IMB.LSE?gespeichert=1",
    );
  });

  it("vermerkt einen unverändert übernommenen Jev-Vorschlag in der Notiz", async () => {
    db.saveJudgement("IMB.LSE", {
      createdAt: "2026-11-18T10:00:00.000Z",
      jevModel: "jev-test",
      researchModel: null,
      research: null,
      researchedAt: null,
      sources: [],
      proposals: {
        moat: { value: -0.1, confidence: 0.7, probabilities: { "1": 1 } },
        management: { value: 0, confidence: 0.6, probabilities: {} },
      },
      levelsVersion: LEVELS_VERSION,
    });
    await expect(saveInputs("IMB.LSE", form({ "risk.moat": "-10", "risk.management": "5" }))).rejects.toThrow(/gespeichert=1/);
    expect(db.manualInputs("IMB.LSE").map((i) => [i.key, i.note])).toEqual([
      ["risk.management", ""],
      ["risk.moat", "Jev-Vorschlag vom 2026-11-18 übernommen"],
    ]);
  });

  it("vermerkt nichts, wenn die Einstufung nach älteren Stufen entstand", async () => {
    db.saveJudgement("IMB.LSE", {
      createdAt: "2026-11-18T10:00:00.000Z",
      jevModel: "jev-test",
      researchModel: null,
      research: null,
      researchedAt: null,
      sources: [],
      proposals: { moat: { value: -0.1, confidence: 0.7, probabilities: { "1": 1 } } },
      levelsVersion: LEVELS_VERSION - 1,
    });
    await expect(saveInputs("IMB.LSE", form({ "risk.moat": "-10" }))).rejects.toThrow(/gespeichert=1/);
    expect(db.manualInputs("IMB.LSE").map((i) => [i.key, i.note])).toEqual([["risk.moat", ""]]);
  });

  it("schaltet den nächtlichen Abgleich aus und wieder ein, der Standard ist an", async () => {
    expect(db.autoSync()).toBe(true);
    await expect(setAutoSync(form({ automatisch: "aus" }))).rejects.toThrow(/^redirect:\/abgleich$/);
    expect(db.autoSync()).toBe(false);
    await expect(setAutoSync(form({ automatisch: "vielleicht" }))).rejects.toThrow(/fehler=/);
    expect(db.autoSync()).toBe(false);
    await expect(setAutoSync(form({ automatisch: "an" }))).rejects.toThrow(/^redirect:\/abgleich$/);
    expect(db.autoSync()).toBe(true);
  });

  it("stellt Läufe ein, fasst Doppelklicks zusammen und bricht sie ab", async () => {
    await expect(startSync("/abgleich")).rejects.toThrow("redirect:/abgleich?lauf=1");
    await expect(startSync("https://example.com")).rejects.toThrow("redirect:/abgleich?lauf=1");
    await expect(refreshStockData("IMB.LSE", form({}))).rejects.toThrow("redirect:/aktie/IMB.LSE?lauf=2");
    await expect(refreshStockData("FEHLT", form({}))).rejects.toThrow(/^redirect:\/$/);
    expect(db.activeJobs().map((j) => [j.kind, j.args])).toEqual([
      ["sync", {}],
      ["stock-refresh", { id: "IMB.LSE" }],
    ]);
    await expect(cancelJob(1)).rejects.toThrow("redirect:/abgleich");
    expect(db.job(1)!.status).toBe("cancelled");
  });

  it("setzt die Bestandsquelle wikifolio, gleicht gleich ab und sperrt die Pflege von Hand", async () => {
    const id = db.createPortfolio("Wikifolio", "fokussiert");
    const page = `/portfolio/${id}`;
    await expect(setPortfolioSource(id, form({ wikifolio: "wf0shysel" }))).rejects.toThrow(`redirect:${page}?lauf=1`);
    expect(db.portfolio(id)!.wikifolio).toBe("WF0SHYSEL");
    expect(db.job(1)!).toMatchObject({ kind: "wikifolio", args: { portfolioId: id, reloadUniverse: false } });

    await expect(saveHoldings(id, form({ cash: "5" }))).rejects.toThrow(/fehler=Der%20Bestand%20kommt%20aus%20wikifolio/);
    expect(db.portfolio(id)!.cashEur).toBe(0);

    await expect(startWikifolioSync(id)).rejects.toThrow(`redirect:${page}?lauf=`);
    await expect(setPortfolioSource(id, form({ wikifolio: "kein symbol" }))).rejects.toThrow(/fehler=Symbol%20des%20Wikifolios/);
    expect(db.portfolio(id)!.wikifolio).toBe("WF0SHYSEL");

    await expect(setPortfolioSource(id, form({ wikifolio: "" }))).rejects.toThrow(`redirect:${page}?gespeichert=1`);
    expect(db.portfolio(id)!.wikifolio).toBeNull();
    await expect(setPortfolioSource(999, form({ wikifolio: "" }))).rejects.toThrow("redirect:/portfolio");
  });

  it("liest ISINs und Symbole aus dem Textfeld", async () => {
    await expect(addStocks(form({ titel: "Depot: GB0004544929 5 Stück; kap.il, KSPI.US" }))).rejects.toThrow("redirect:/vorrat?lauf=1");
    expect(db.job(1)!.args).toEqual({ isins: ["GB0004544929"], symbols: ["KAP.IL", "KSPI.US"], watch: true });
    await expect(addStocks(form({ titel: "nichts Brauchbares" }))).rejects.toThrow(/redirect:\/vorrat\?fehler=Bitte%20mindestens/);
  });

  it("startet kleine Läufe direkt und große nur mit Bestätigung", async () => {
    await expect(startRefresh(form({ umfang: "watchlist" }))).rejects.toThrow("redirect:/abgleich?lauf=1");
    expect(db.job(1)!.args).toEqual({ scope: "watchlist" });
    await expect(startHistory(form({ umfang: "rechenbar", neu: "on" }))).rejects.toThrow("redirect:/abgleich?lauf=2");
    expect(db.job(2)!.args).toEqual({ refresh: true, scope: "rechenbar", monthly: false });
    await expect(startHistory(form({ umfang: "irgendwas" }))).rejects.toThrow(/fehler=Unbekannter/);
    await expect(startRefresh(form({}))).rejects.toThrow(/fehler=Unbekannter/);

    // 201 Titel mit Abschlüssen: alle auffrischen kostet 2.010 Abrufe und braucht das Häkchen.
    for (let i = 0; i < 201; i++) {
      db.addStockIfMissing({ ...stock, id: `V${i}.US`, watched: false });
      db.saveRawDocument(`V${i}.US`, "eodhd-fundamentals", "{}");
    }
    await expect(startRefresh(form({ umfang: "alle" }))).rejects.toThrow(/fehler=Bitte%20best%C3%A4tigen/);
    await expect(startRefresh(form({ umfang: "alle", bestaetigt: "on" }))).rejects.toThrow("redirect:/abgleich?lauf=3");
    await expect(startIndexImport(form({ bestaetigt: "on", indizes: "gspc.indx, STOXX.INDX", boersen: "il" }))).rejects.toThrow(
      "redirect:/abgleich?lauf=4",
    );
    expect(db.job(4)!.args).toEqual({ indices: ["GSPC.INDX", "STOXX.INDX"], exchanges: ["IL"] });
    await expect(startIndexImport(form({ bestaetigt: "on", indizes: "GSPC" }))).rejects.toThrow(/fehler=/);
  });
});
