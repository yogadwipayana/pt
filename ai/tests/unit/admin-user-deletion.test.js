import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../cloud/src/services/adminRedis.js", () => ({
  cacheJson: vi.fn((env, key, ttl, loader) => loader()),
  getCacheVersion: vi.fn(() => Promise.resolve(1)),
}));

import { deleteUser, updateUser } from "../../cloud/src/services/adminRepository.js";

function makeEnv() {
  const statements = [];

  return {
    statements,
    DB: {
      prepare: vi.fn((sql) => {
        statements.push(sql);
        return {
          bind: (...params) => ({
            first: vi.fn(async () => {
              if (sql === "SELECT * FROM users WHERE id = ?") {
                return { id: params[0], email: "user@example.com", name: "User", planSlug: "free" };
              }
              if (sql === "SELECT id FROM plans WHERE slug = ?") {
                return { id: "plan_free" };
              }
              if (sql === "SELECT id FROM users WHERE lower(email) = ? AND id != ?") {
                return null;
              }
              if (sql === "SELECT * FROM deleted_user_emails WHERE normalizedEmail = ?") {
                return params[0] === "deleted@example.com" ? { normalizedEmail: params[0], deletedUserId: "user_deleted" } : null;
              }
              return null;
            }),
            all: vi.fn(async () => ({ results: [] })),
            run: vi.fn(async () => ({ meta: { changes: 1 } })),
          }),
        };
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin user deletion", () => {
  it("hard deletes the user and reserves the old email", async () => {
    const env = makeEnv();

    const result = await deleteUser(env, "user_1", { reason: "fraud" });

    expect(result.status).toBe(200);
    expect(result.body.previousEmail).toBe("user@example.com");
    expect(env.statements).toContain("INSERT OR REPLACE INTO deleted_user_emails (normalizedEmail, originalEmail, deletedUserId, reason, deletedAt) VALUES (?, ?, ?, ?, ?)");
    expect(env.statements).toContain("DELETE FROM users WHERE id = ?");
  });

  it("rejects updating another user to an admin-deleted email", async () => {
    const env = makeEnv();

    const result = await updateUser(env, "user_2", {
      name: "Replacement User",
      email: "deleted@example.com",
      planSlug: "free",
      reason: "rename",
    });

    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe("email_reserved");
  });
});
