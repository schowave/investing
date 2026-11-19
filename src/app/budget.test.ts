import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const account = (used: number) => (async () => Response.json({ dailyRateLimit: 100000, apiRequests: used })) as unknown as typeof fetch;

describe("Tagesbudget", () => {
  it("fragt das Konto höchstens einmal pro Minute ab", async () => {
    vi.stubEnv("EODHD_API_TOKEN", "t");
    const { eodhdBudget } = await import("./budget.ts");
    expect(await eodhdBudget(0, account(5))).toMatchObject({ requestsToday: 5 });
    expect(await eodhdBudget(30_000, account(9))).toMatchObject({ requestsToday: 5 });
    expect(await eodhdBudget(61_000, account(9))).toMatchObject({ requestsToday: 9 });
    const broken = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await eodhdBudget(200_000, broken)).toBeNull();
  });

  it("liefert ohne Token nichts", async () => {
    vi.stubEnv("EODHD_API_TOKEN", "");
    const { eodhdBudget } = await import("./budget.ts");
    expect(await eodhdBudget(0, account(1))).toBeNull();
  });
});
