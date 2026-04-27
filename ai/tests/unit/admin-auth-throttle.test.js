import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../cloud/src/services/adminRedis.js", () => ({
  incrementCounter: vi.fn(() => Promise.resolve(1)),
  resetCounter: vi.fn(() => Promise.resolve()),
}));

import { incrementCounter, resetCounter } from "../../cloud/src/services/adminRedis.js";
import { signInAdmin } from "../../cloud/src/services/adminAuth.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin auth throttling", () => {
  it("increments failed login counter on invalid credentials", async () => {
    const env = { ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD_HASH: "sha256:notmatching" };

    await expect(signInAdmin("admin@example.com", "wrong", env)).resolves.toBeNull();

    expect(incrementCounter).toHaveBeenCalledWith(env, "admin:auth:fail:admin@example.com", 300);
  });

  it("returns throttled result before checking credentials after too many failures", async () => {
    incrementCounter.mockResolvedValue(6);
    const env = { ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD_HASH: "sha256:notmatching" };

    await expect(signInAdmin("admin@example.com", "secret", env)).resolves.toEqual({ throttled: true });
    expect(incrementCounter).toHaveBeenCalledWith(env, "admin:auth:fail:admin@example.com", 300);
  });

  it("resets failed login counter after successful sign in", async () => {
    incrementCounter.mockResolvedValue(1);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("secret"));
    const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const env = { ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD_HASH: `sha256:${hash}`, ADMIN_SESSION_SECRET: "secret" };

    const result = await signInAdmin("admin@example.com", "secret", env);

    expect(result.response.authenticated).toBe(true);
    expect(resetCounter).toHaveBeenCalledWith(env, "admin:auth:fail:admin@example.com");
  });
});
