import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../cloud/src/services/adminRedis.js", () => ({
  incrementCacheVersion: vi.fn(() => Promise.resolve(2)),
}));

vi.mock("../../cloud/src/services/adminAudit.js", () => ({
  writeAdminAuditEvent: vi.fn(() => Promise.resolve()),
}));

import { incrementCacheVersion } from "../../cloud/src/services/adminRedis.js";
import { ADMIN_CACHE_VERSION_KEY } from "../../cloud/src/services/adminRepository.js";
import { addPaygCredit } from "../../cloud/src/services/billingAdmin.js";

function makeEnv() {
  const prepare = vi.fn((sql) => ({
    bind: (...params) => ({
      first: vi.fn(async () => {
        if (sql.includes("FROM users")) return { id: params[0], email: "user@example.com", planSlug: "payg" };
        if (sql.includes("FROM credit_accounts")) return { id: `credit_${params[0]}`, userId: params[0], balanceMinor: 1000, currency: "USD" };
        if (sql.includes("FROM credit_ledger_entries")) return null;
        return null;
      }),
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
      all: vi.fn(async () => ({ results: [] })),
    }),
  }));
  return {
    DB: {
      prepare,
      batch: vi.fn(async () => ({ success: true })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("billing admin cache invalidation", () => {
  it("bumps admin cache version after PayG credit adjustment", async () => {
    const env = makeEnv();

    const result = await addPaygCredit(env, "user_1", { amountMinor: 1000, reason: "top up", idempotencyKey: "idem_1" }, { email: "admin@example.com" });

    expect(result.status).toBe(200);
    expect(incrementCacheVersion).toHaveBeenCalledWith(env, ADMIN_CACHE_VERSION_KEY);
  });
});
