import { afterEach, describe, expect, it, vi } from "vitest";
import { Database } from "../../data/db.ts";

let db: Database | (() => never);
vi.mock("../server.ts", () => ({ database: () => (typeof db === "function" ? db() : db) }));
const { GET } = await import("./route.ts");

afterEach(() => vi.unstubAllEnvs());

describe("/healthz", () => {
  it("meldet Version und letzten Abgleich", async () => {
    vi.stubEnv("INVESTING_VERSION", "abc1234");
    const fresh = new Database(":memory:");
    db = fresh;
    expect(await GET().json()).toEqual({ status: "ok", version: "abc1234", lastSync: null });
    fresh.saveSyncRun(false, {});
    const body = await GET().json();
    expect(body.lastSync.ok).toBe(false);
  });

  it("ist ohne lesbare Datenbank nicht gesund", async () => {
    db = () => {
      throw new Error("database is locked");
    };
    const response = GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "error", version: "dev", error: "database is locked" });
  });
});
