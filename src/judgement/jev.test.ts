import { afterEach, describe, expect, it, vi } from "vitest";
import { askJev } from "./jev.ts";

const question = { q: { type: "score" as const, instructions: "?", criteria: ["gut", "schlecht"] } };
const ok = { model: "jev-test", answers: { q: { type: "score", score: 0, confidence: 0.9, probabilities: { "0": 1 } } } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("askJev", () => {
  it("verlangt einen Schlüssel", async () => {
    await expect(askJev({}, question, "")).rejects.toThrow(/TYPESAFE_API_KEY fehlt/);
  });

  it("wiederholt bei Überlastung und meldet andere Fehler mit dem Status", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 529 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ok)));
    vi.stubGlobal("fetch", fetchMock);
    const answer = askJev({}, question, "k");
    await vi.runAllTimersAsync();
    expect((await answer).answers.q?.confidence).toBe(0.9);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("kaputt", { status: 400 })),
    );
    await expect(askJev({}, question, "k")).rejects.toThrow("Jev antwortet mit 400: kaputt");
  });
});
