import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../cloud/src/services/adminRedis.js", () => ({
  cacheJson: vi.fn((env, key, ttl, loader) => loader()),
  getCacheVersion: vi.fn(() => Promise.resolve(1)),
}));

import { cacheJson, getCacheVersion } from "../../cloud/src/services/adminRedis.js";
import { getOverview, listModels, listPlans, listUsageRequests, listUsers } from "../../cloud/src/services/adminRepository.js";

function makeStatement(result) {
  return {
    bind: vi.fn(() => ({
      first: vi.fn(() => Promise.resolve(result.first || null)),
      all: vi.fn(() => Promise.resolve({ results: result.all || [] })),
    })),
    first: vi.fn(() => Promise.resolve(result.first || null)),
    all: vi.fn(() => Promise.resolve({ results: result.all || [] })),
  };
}

function makeEnv() {
  const statements = [];
  const env = {
    DB: {
      prepare: vi.fn((sql) => {
        statements.push(sql);
        if (sql.includes("FROM models")) return makeStatement({ all: [{ id: "m1", slug: "m1", name: "Model", provider: "openai", modelId: "gpt", visibility: "visible", accessState: "enabled", allowedPlanSlugs: "[\"free\"]" }] });
        if (sql.includes("FROM plans")) return makeStatement({ all: [{ id: "p1", slug: "free", name: "Free", priceMinor: 0, currency: "IDR", active: 1, visible: 1 }] });
        if (sql.includes("FROM users")) return makeStatement({ first: { totalUsers: 0, newUsersToday: 0, activeUsers24h: 0, proUsers: 0, paygUsers: 0 }, all: [] });
        if (sql.includes("FROM usage_requests")) return makeStatement({ first: { requests: 0, inputTokens: 0, outputTokens: 0, chargedCost: 0, failedRequests: 0, averageLatency: 0 }, all: [] });
        return makeStatement({ first: { count: 0, total: 0, requests: 0, failed: 0 }, all: [] });
      }),
    },
    statements,
  };
  return env;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminRepository cache", () => {
  it("caches overview for 30 seconds", async () => {
    const env = makeEnv();

    await getOverview(env);

    expect(getCacheVersion).toHaveBeenCalledWith(env, "admin:cache:version");
    expect(cacheJson).toHaveBeenCalledWith(env, "admin:cache:v1:overview", 30, expect.any(Function));
  });

  it("caches models per query for 300 seconds", async () => {
    const env = makeEnv();

    await listModels(env, "https://dwipa.test/admin/models?provider=openai");

    expect(cacheJson).toHaveBeenCalledWith(env, "admin:cache:v1:models:provider=openai", 300, expect.any(Function));
  });

  it("caches plans for 300 seconds", async () => {
    const env = makeEnv();

    await listPlans(env);

    expect(cacheJson).toHaveBeenCalledWith(env, "admin:cache:v1:plans", 300, expect.any(Function));
  });

  it("caches users summary for 60 seconds while loading items from DB", async () => {
    const env = makeEnv();

    await listUsers(env, "https://dwipa.test/admin/users");

    expect(cacheJson).toHaveBeenCalledWith(env, "admin:cache:v1:users:summary", 60, expect.any(Function));
  });

  it("caches usage summary and charts for 30 seconds while loading items from DB", async () => {
    const env = makeEnv();

    await listUsageRequests(env, "https://dwipa.test/admin/usage");

    expect(cacheJson).toHaveBeenCalledWith(env, "admin:cache:v1:usage:summary-charts:all", 30, expect.any(Function));
  });
});
