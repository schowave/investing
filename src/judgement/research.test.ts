import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Attrappe des SDK: jede Anfrage liefert die nächste vorbereitete Antwort und merkt sich die Parameter.
const replies: unknown[] = [];
const requests: { messages: unknown[]; fallbacks?: unknown; tools?: unknown }[] = [];
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = {
      messages: {
        stream: (params: { messages: unknown[] }) => {
          requests.push({ ...params, messages: [...params.messages] });
          return { finalMessage: async () => replies.shift() };
        },
      },
    };
  },
}));

const { researchAvailable, researchCompany } = await import("./research.ts");
const company = { name: "Test", ticker: "TEST.US", country: "US", asOf: "2026-11-19" };
const reply = (stop_reason: string, content: unknown[], extra: object = {}) => ({
  model: "claude-opus-5-5",
  stop_reason,
  content,
  ...extra,
});

beforeEach(() => {
  replies.length = 0;
  requests.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

describe("researchCompany", () => {
  it("setzt nach einer Unterbrechung fort und sammelt Text und Quellen", async () => {
    const results = [{ url: "https://a.example", title: "A", page_age: "2 days ago" }];
    replies.push(
      reply("pause_turn", [
        { type: "web_search_tool_result", content: results },
        { type: "text", text: "Teil 1. " },
      ]),
      reply("end_turn", [
        { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
        { type: "text", text: "Teil 2." },
      ]),
    );
    const research = await researchCompany(company);
    expect(research).toEqual({
      model: "claude-opus-5-5",
      text: "Teil 1. Teil 2.",
      sources: [{ url: "https://a.example", title: "A", pageAge: "2 days ago" }],
    });
    expect(requests).toHaveLength(2);
    expect(requests[1]!.messages).toHaveLength(2);
    expect(requests[0]!.fallbacks).toBe("default");
  });

  it("meldet eine Ablehnung und eine abgeschnittene Antwort", async () => {
    replies.push(reply("refusal", [], { stop_details: { type: "refusal", category: null, explanation: "nein" } }));
    await expect(researchCompany(company)).rejects.toThrow("Die Recherche wurde abgelehnt: nein");
    replies.push(reply("max_tokens", [{ type: "text", text: "…" }]));
    await expect(researchCompany(company)).rejects.toThrow(/abgeschnitten/);
  });

  it("ist nur mit Zugangsdaten für Claude verfügbar", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "");
    vi.stubEnv("ANTHROPIC_PROFILE", "");
    expect(researchAvailable()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect(researchAvailable()).toBe(true);
  });
});
