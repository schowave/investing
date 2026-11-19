import { afterEach, describe, expect, it, vi } from "vitest";
import { RISK_FACTORS } from "../calc/risk.ts";
import type { Stock } from "../data/db.ts";
import { Database } from "../data/db.ts";
import { parseEodhdSnapshot } from "../data/eodhdSnapshot.ts";
import { buildEvidence } from "./evidence.ts";
import { currentProposals, FACTOR_QUESTIONS, JUDGED_FACTORS, LEVELS_VERSION, proposalFromScore } from "./factors.ts";
import { judgeStock } from "./judge.ts";

const stock: Stock = {
  id: "TEST.US",
  name: "Test",
  sector: "Technology",
  region: "Nordamerika",
  country: "US",
  reportingCurrency: "USD",
  priceCurrency: "USD",
  priceDivisor: 1,
  foundedYear: 1994,
  isFinancial: false,
  watched: true,
};

describe("FACTOR_QUESTIONS", () => {
  it("bleibt in den Grenzen des Rasters und hat höchstens zehn Stufen", () => {
    for (const factor of JUDGED_FACTORS) {
      const { maxDeduction, bonus, manual } = RISK_FACTORS[factor];
      const values = FACTOR_QUESTIONS[factor].levels.map((level) => level.value);
      expect(manual).toBe(true);
      expect(values.length).toBeLessThanOrEqual(10);
      expect(Math.max(...values)).toBe(maxDeduction);
      expect(Math.min(...values)).toBe(-bonus + 0);
      expect([...values].sort((a, b) => a - b)).toEqual(values);
    }
  });

  it("hat je Faktor genau eine Stufe mit 0 %: die erfüllte Anforderung des Buchs", () => {
    for (const factor of JUDGED_FACTORS) {
      expect(FACTOR_QUESTIONS[factor].levels.filter((level) => level.value === 0)).toHaveLength(1);
    }
  });
});

describe("currentProposals", () => {
  const proposals = { moat: { value: -0.1 } };

  it("gibt nur Vorschläge nach den heutigen Stufen weiter", () => {
    expect(currentProposals({ levelsVersion: LEVELS_VERSION, proposals })).toBe(proposals);
    expect(currentProposals({ levelsVersion: LEVELS_VERSION - 1, proposals })).toEqual({});
    expect(currentProposals(null)).toEqual({});
  });
});

describe("proposalFromScore", () => {
  it("gewichtet die Stufen mit ihren Wahrscheinlichkeiten und rundet auf 0,5 Prozentpunkte", () => {
    // Wettbewerbsvorteile: Stufen -20, -10, 0, 10, 20 %.
    expect(proposalFromScore("moat", { "0": 0, "1": 0.06, "2": 0.35, "3": 0.58, "4": 0.01 }, 0.6).value).toBeCloseTo(0.055);
    expect(proposalFromScore("moat", { "0": 1 }, 0.9).value).toBeCloseTo(-0.2);
  });

  it("normiert Wahrscheinlichkeiten, die sich nicht zu 1 summieren", () => {
    expect(proposalFromScore("situation", { "0": 0.5, "3": 0.5 }, 0.5).value).toBeCloseTo(0.15);
    expect(proposalFromScore("situation", { "0": 0.25, "3": 0.25 }, 0.5).value).toBeCloseTo(0.15);
  });

  it("liefert 0 statt -0 und lehnt leere Antworten ab", () => {
    expect(Object.is(proposalFromScore("sector", { "0": 1 }, 1).value, 0)).toBe(true);
    expect(() => proposalFromScore("sector", {}, 1)).toThrow();
  });
});

describe("buildEvidence", () => {
  const raw = JSON.stringify({
    General: { Description: "Sends money abroad.", Industry: "Payments", Officers: { "0": { Name: "A. Boss", Title: "CEO" } } },
    Earnings: {
      History: {
        "2026-09-30": { date: "2026-09-30", epsActual: 0.32, epsEstimate: 0.22, surprisePercent: 45.45 },
        "2026-12-31": { date: "2026-12-31", epsActual: null, epsEstimate: 0.3 },
        "2026-06-30": { date: "2026-06-30", epsActual: 0.17, epsEstimate: 0.51, surprisePercent: -66.67 },
      },
    },
    InsiderTransactions: {
      "0": {
        transactionDate: "2026-03-01",
        ownerName: "A. Boss",
        transactionAcquiredDisposed: "D",
        transactionAmount: 1000,
        transactionPrice: 9,
      },
      "2": { ownerName: "Ohne Datum", transactionAcquiredDisposed: "D", transactionAmount: 7 },
      "1": {
        transactionDate: "2020-03-01",
        ownerName: "Old",
        transactionAcquiredDisposed: "A",
        transactionAmount: 5,
        transactionPrice: 20,
      },
    },
  });

  it("nimmt Beschreibung, gemeldete Quartale und Insidergeschäfte der letzten drei Jahre", () => {
    const evidence = buildEvidence({ stock, years: [], snapshot: parseEodhdSnapshot(raw), research: "notes", asOf: "2026-11-19" });
    expect(evidence.company.description).toBe("Sends money abroad.");
    expect(evidence.company.officers).toEqual(["A. Boss, CEO"]);
    // Die Gewinnüberraschungen des Anbieters mischen Einheiten und gehen nicht an Jev.
    expect(evidence).not.toHaveProperty("earningsSurprises");
    expect(evidence.insiderTransactions).toEqual([
      { date: "2026-03-01", insider: "A. Boss", type: "sell", shares: 1000, price: 9, sharesHeldAfter: null },
    ]);
    expect(evidence.research).toBe("notes");
  });

  it("kommt ohne Rohdaten aus", () => {
    const evidence = buildEvidence({ stock, years: [], snapshot: null, research: null, asOf: "2026-11-19" });
    expect(evidence.company.name).toBe("Test");
    expect(evidence.insiderTransactions).toEqual([]);
  });
});

describe("judgeStock", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fragt Jev nach allen sechs Faktoren und speichert die Vorschläge", async () => {
    const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
      const { questions } = JSON.parse(init.body) as { questions: Record<string, { criteria: string[] }> };
      const answers = Object.fromEntries(
        Object.entries(questions).map(([name, q]) => [
          name,
          {
            type: "score",
            score: 0,
            confidence: 0.8,
            probabilities: { "0": 1, ...Object.fromEntries(q.criteria.slice(1).map((_, i) => [String(i + 1), 0])) },
          },
        ]),
      );
      return new Response(JSON.stringify({ model: "jev-test", answers, usage: { input_tokens: 1, output_tokens: 0 } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    // Unabhängig davon, ob lokal ein echter Schlüssel gesetzt ist (im CI ist keiner gesetzt).
    vi.stubEnv("TYPESAFE_API_KEY", "test");

    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    const judgement = await judgeStock(db, stock, "2026-11-19", { research: false });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(Object.keys(judgement.proposals).sort()).toEqual([...JUDGED_FACTORS].sort());
    expect(judgement.proposals.moat!.value).toBeCloseTo(-0.2);
    expect(judgement.proposals.management!.value).toBeCloseTo(-0.1);
    expect(db.judgement(stock.id)?.jevModel).toBe("jev-test");
    expect(db.judgement(stock.id)?.levelsVersion).toBe(LEVELS_VERSION);
    expect(db.judgement(stock.id)?.research).toBeNull();
  });

  it("gibt Jev bei US-Werten die Mitteilungen an die SEC und speichert sie als Quellen", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test");
    vi.stubEnv("SEC_USER_AGENT", "investing test@example.com");
    const submissions = {
      filings: {
        recent: {
          accessionNumber: ["0001140361-26-043232"],
          filingDate: ["2026-11-12"],
          form: ["8-K"],
          items: ["1.02"],
          primaryDocument: ["8k.htm"],
        },
      },
    };
    let state: { secFilings: unknown } | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body?: string }) => {
        if (url.startsWith("https://data.sec.gov/")) return new Response(JSON.stringify(submissions));
        if (url.startsWith("https://www.sec.gov/")) return new Response("<p>Item 1.02 Termination of the merger with Western Union.</p>");
        const body = JSON.parse(init.body!) as { state: { secFilings: unknown }; questions: Record<string, unknown> };
        state = body.state;
        const answers = Object.fromEntries(
          Object.keys(body.questions).map((name) => [name, { type: "score", score: 0, confidence: 0.5, probabilities: { "0": 1 } }]),
        );
        return new Response(JSON.stringify({ model: "jev-test", answers }));
      }),
    );
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveRawDocument(stock.id, "eodhd-fundamentals", JSON.stringify({ General: { CIK: "0001683695" } }));

    const judgement = await judgeStock(db, stock, "2026-11-19", { research: false });

    expect(state!.secFilings).toEqual([
      {
        date: "2026-11-12",
        form: "8-K",
        description: "Termination of a Material Definitive Agreement",
        excerpt: "Item 1.02 Termination of the merger with Western Union.",
      },
    ]);
    expect(judgement.sources).toEqual([
      {
        url: "https://www.sec.gov/Archives/edgar/data/1683695/000114036126043232/8k.htm",
        title: "8-K: Termination of a Material Definitive Agreement",
        pageAge: "2026-11-12",
        kind: "sec",
      },
    ]);
  });

  it("stuft auch ein, wenn EDGAR nicht antwortet", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test");
    vi.stubEnv("SEC_USER_AGENT", "investing test@example.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body?: string }) => {
        if (url.startsWith("https://data.sec.gov/")) return new Response("", { status: 503 });
        const { questions } = JSON.parse(init.body!) as { questions: Record<string, unknown> };
        const answers = Object.fromEntries(
          Object.keys(questions).map((name) => [name, { type: "score", score: 0, confidence: 0.5, probabilities: { "0": 1 } }]),
        );
        return new Response(JSON.stringify({ model: "jev-test", answers }));
      }),
    );
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveRawDocument(stock.id, "eodhd-fundamentals", JSON.stringify({ General: { CIK: "1683695" } }));

    const judgement = await judgeStock(db, stock, "2026-11-19", { research: false });
    expect(judgement.sources).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/EDGAR.*503/));
  });

  it("weist eine unvollständige Antwort von Jev zurück, statt mit fehlenden Werten zu rechnen", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test");
    const answers = { sector: { type: "score", score: 0, confidence: 2, probabilities: { "0": 1 } } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ model: "jev-test", answers }))),
    );
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    await expect(judgeStock(db, stock, "2026-11-19", { research: false })).rejects.toThrow(/nicht beantwortet/);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]")),
    );
    await expect(judgeStock(db, stock, "2026-11-19", { research: false })).rejects.toThrow(/unerwartete Antwort/);
    expect(db.judgement(stock.id)).toBeNull();
  });
});
