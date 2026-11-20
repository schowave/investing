import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Attrappe des SDK: jede Anfrage liefert die nächste vorbereitete Antwort und merkt sich die Parameter.
const replies: unknown[] = [];
const requests: { model: string; config: { systemInstruction?: unknown; tools?: unknown } }[] = [];
vi.mock("@google/genai", () => ({
  ThinkingLevel: { MEDIUM: "MEDIUM" },
  GoogleGenAI: class {
    models = {
      generateContent: async (params: (typeof requests)[number]) => {
        requests.push(params);
        return replies.shift();
      },
    };
  },
}));

const { researchAvailable, researchCompany, researchKeyName } = await import("./research.ts");
const company = { name: "Test", ticker: "TEST.US", country: "US", asOf: "2026-11-20" };
const reply = (text: string | undefined, finishReason: string, chunks: unknown[] = []) => ({
  text,
  modelVersion: "gemini-3.5-flash-lite",
  usageMetadata: { promptTokenCount: 100, toolUsePromptTokenCount: 400, candidatesTokenCount: 50, thoughtsTokenCount: 30 },
  candidates: [{ finishReason, groundingMetadata: { groundingChunks: chunks, webSearchQueries: ["a", "b"] } }],
});

beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
  vi.stubEnv("RESEARCH_LLM", "gemini");
});
afterEach(() => vi.unstubAllEnvs());

describe("researchCompany mit Gemini", () => {
  it("sucht mit Google und sammelt Text und Quellen ohne Doppelte", async () => {
    const web = { web: { uri: "https://a.example", title: "a.example" } };
    replies.push(reply(" Bericht. ", "STOP", [web, web, { retrievedContext: {} }]));
    const research = await researchCompany(company);
    expect(research).toEqual({
      model: "gemini-3.5-flash-lite",
      text: "Bericht.",
      sources: [{ url: "https://a.example", title: "a.example", pageAge: null }],
      usage: { inputTokens: 500, outputTokens: 80, searches: 2 },
    });
    expect(requests[0]!.model).toBe("gemini-3.5-flash-lite");
    expect(requests[0]!.config.tools).toEqual([{ googleSearch: {} }]);
    expect(requests[0]!.config.systemInstruction).toMatch(/You research listed companies/);
  });

  it("meldet eine leere und eine abgeschnittene Antwort", async () => {
    replies.push(reply(undefined, "SAFETY"));
    await expect(researchCompany(company)).rejects.toThrow("Gemini lieferte keinen Text (SAFETY).");
    replies.push(reply("…", "MAX_TOKENS"));
    await expect(researchCompany(company)).rejects.toThrow(/abgeschnitten/);
  });

  it("ist nur mit GEMINI_API_KEY verfügbar", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect(researchAvailable()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(researchAvailable()).toBe(true);
    expect(researchKeyName()).toBe("GEMINI_API_KEY");
  });
});
