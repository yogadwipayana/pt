import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../cloud/src/services/adminRedis.js", () => ({
  readIdempotency: vi.fn(() => Promise.resolve(null)),
  writeIdempotency: vi.fn(() => Promise.resolve()),
}));

import { readIdempotency, writeIdempotency } from "../../cloud/src/services/adminRedis.js";
import { withAdminIdempotency } from "../../cloud/src/services/adminIdempotency.js";

function makeDb() {
  const rows = new Map();
  return {
    prepare: vi.fn((sql) => ({
      bind: (...params) => ({
        run: vi.fn(async () => {
          if (sql.startsWith("INSERT OR IGNORE")) {
            if (rows.has(params[0])) return { meta: { changes: 0 } };
            rows.set(params[0], { key: params[0], actorEmail: params[1], scope: params[2], requestHash: params[3], responseJson: params[4], statusCode: params[5], expiresAt: params[7] });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("UPDATE")) {
            const row = rows.get(params[2]);
            rows.set(params[2], { ...row, responseJson: params[0], statusCode: params[1] });
          }
          if (sql.startsWith("DELETE")) {
            const row = rows.get(params[0]);
            if (row?.scope === params[1] && row?.requestHash === params[2] && row?.statusCode === params[3] && row?.expiresAt === params[4]) rows.delete(params[0]);
          }
          return { meta: { changes: 1 } };
        }),
        first: vi.fn(async () => rows.get(params[0]) || null),
      }),
    })),
  };
}

async function hashBody(body) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(body || {})));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  readIdempotency.mockResolvedValue(null);
});

describe("admin idempotency redis fast path", () => {
  it("returns cached redis response without running callback", async () => {
    const requestBody = { a: 1 };
    readIdempotency.mockResolvedValue({ scope: "payment.approve", requestHash: await hashBody(requestBody), statusCode: 200, body: { ok: true } });
    const callback = vi.fn();

    const response = await withAdminIdempotency({ DB: makeDb() }, { key: "idem_1", scope: "payment.approve", actorEmail: "admin", requestBody }, callback);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("writes redis idempotency result after callback succeeds", async () => {
    const env = { DB: makeDb() };

    const response = await withAdminIdempotency(env, { key: "idem_2", scope: "payment.approve", actorEmail: "admin", requestBody: { a: 1 } }, async () => ({ status: 201, body: { created: true } }));

    expect(response.status).toBe(201);
    expect(writeIdempotency).toHaveBeenCalledWith(env, "admin:idempotency:idem_2", expect.objectContaining({ scope: "payment.approve", statusCode: 201, body: { created: true } }), 86400);
  });

  it("reclaims expired db idempotency records instead of staying in progress", async () => {
    const env = { DB: makeDb() };
    const requestBody = { a: 1 };

    await withAdminIdempotency(env, { key: "idem_expired", scope: "payment.approve", actorEmail: "admin", requestBody }, async () => ({ status: 202, body: { pending: true } }));
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000 * 60 * 60 * 25);

    const response = await withAdminIdempotency(env, { key: "idem_expired", scope: "payment.approve", actorEmail: "admin", requestBody }, async () => ({ status: 200, body: { ok: true } }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    vi.useRealTimers();
  });
});
