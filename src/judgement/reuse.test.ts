import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Stock, StoredJudgement } from "../data/db.ts";
import { Database } from "../data/db.ts";

// Recherche als Attrappe: zählt die Aufrufe, statt im Netz zu suchen.
const researchCompany = vi.fn(async () => ({
  model: "recherche-neu",
  text: "Neue Recherche.",
  sources: [{ url: "https://neu.example", title: "Neu", pageAge: null }],
}));
vi.mock("./research.ts", () => ({ researchAvailable: () => true, researchCompany }));

const { judgeStock, reusableResearchDate } = await import("./judge.ts");

const stock: Stock = {
  id: "TEST.DE",
  name: "Test",
  sector: "Industrials",
  region: "Europa",
  country: "DE",
  reportingCurrency: "EUR",
  priceCurrency: "EUR",
  priceDivisor: 1,
  foundedYear: 1990,
  isFinancial: false,
  watched: true,
};
const previous = (researchedAt: string | null, createdAt = "2026-11-01T08:00:00.000Z"): StoredJudgement => ({
  createdAt,
  jevModel: "jev-test",
  researchModel: "recherche-alt",
  research: "Alte Recherche.",
  researchedAt,
  sources: [
    { url: "https://alt.example", title: "Alt", pageAge: "3 days ago" },
    { url: "https://www.sec.gov/x", title: "8-K", pageAge: "2026-10-30", kind: "sec" },
  ],
  proposals: {},
  levelsVersion: 1,
});

beforeEach(() => {
  researchCompany.mockClear();
  vi.stubEnv("TYPESAFE_API_KEY", "test");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      const { questions } = JSON.parse(init.body) as { questions: Record<string, unknown> };
      const answers = Object.fromEntries(
        Object.keys(questions).map((name) => [name, { type: "score", score: 0, confidence: 0.5, probabilities: { "0": 1 } }]),
      );
      return new Response(JSON.stringify({ model: "jev-test", answers }));
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function databaseWith(judgement: StoredJudgement | null) {
  const db = new Database(":memory:");
  db.addStockIfMissing(stock);
  if (judgement) db.saveJudgement(stock.id, judgement);
  return db;
}

describe("Wiederverwendung der Recherche", () => {
  it("nimmt eine höchstens 30 Tage alte Recherche samt Quellen und Tag, ohne neu zu suchen", async () => {
    const db = databaseWith(previous("2026-10-21"));
    const judgement = await judgeStock(db, stock, "2026-11-20");
    expect(researchCompany).not.toHaveBeenCalled();
    expect(judgement).toMatchObject({ research: "Alte Recherche.", researchModel: "recherche-alt", researchedAt: "2026-10-21" });
    expect(judgement.sources).toEqual([{ url: "https://alt.example", title: "Alt", pageAge: "3 days ago" }]);
  });

  it("recherchiert neu, wenn die Recherche älter als 30 Tage ist oder es verlangt wird", async () => {
    let judgement = await judgeStock(databaseWith(previous("2026-10-20")), stock, "2026-11-20");
    expect(judgement).toMatchObject({ research: "Neue Recherche.", researchedAt: "2026-11-20" });
    judgement = await judgeStock(databaseWith(previous("2026-11-19")), stock, "2026-11-20", { freshResearch: true });
    expect(judgement.research).toBe("Neue Recherche.");
    expect(researchCompany).toHaveBeenCalledTimes(2);
  });

  it("nimmt bei Urteilen ohne Tag der Recherche den Tag des Urteils", () => {
    expect(reusableResearchDate(previous(null), "2026-11-20")).toBe("2026-11-01");
    expect(reusableResearchDate(previous(null, "2026-09-01T08:00:00.000Z"), "2026-11-20")).toBeNull();
    expect(reusableResearchDate({ ...previous("2026-11-19"), research: null }, "2026-11-20")).toBeNull();
    expect(reusableResearchDate(null, "2026-11-20")).toBeNull();
  });

  it("verwendet ohne Recherche auch keine alte", async () => {
    const judgement = await judgeStock(databaseWith(previous("2026-11-19")), stock, "2026-11-20", { research: false });
    expect(judgement).toMatchObject({ research: null, researchModel: null, researchedAt: null });
  });
});
