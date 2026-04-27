import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheDelete,
  cacheGet,
  cacheJson,
  cachePut,
  getCacheVersion,
  incrementCacheVersion,
  incrementCounter,
  readIdempotency,
  writeIdempotency,
} from "../../cloud/src/services/adminRedis.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("adminRedis", () => {
  it("uses binding get/put/delete when env.REDIS is available", async () => {
    const binding = { get: vi.fn(), put: vi.fn(), delete: vi.fn() };
    binding.get.mockResolvedValue("cached");
    const env = { REDIS: binding };

    await expect(cacheGet(env, "key")).resolves.toBe("cached");
    await cachePut(env, "key", "value", 10);
    await cacheDelete(env, "key");

    expect(binding.get).toHaveBeenCalledWith("key");
    expect(binding.put).toHaveBeenCalledWith("key", "value", { expirationTtl: 10 });
    expect(binding.delete).toHaveBeenCalledWith("key");
  });

  it("uses Upstash REST when env has Upstash credentials", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "cached" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "OK" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const env = { UPSTASH_REDIS_REST_URL: "https://redis.example", UPSTASH_REDIS_REST_TOKEN: "token" };

    await expect(cacheGet(env, "key")).resolves.toBe("cached");
    await cachePut(env, "key", "value", 10);
    await cacheDelete(env, "key");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://redis.example/get/key", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://redis.example/set/key/value/EX/10", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://redis.example/del/key", expect.objectContaining({ method: "POST" }));
  });

  it("falls back to in-memory cache when Redis is unavailable", async () => {
    const env = {};

    await cachePut(env, "fallback:key", "value", 60);

    await expect(cacheGet(env, "fallback:key")).resolves.toBe("value");
    await cacheDelete(env, "fallback:key");
    await expect(cacheGet(env, "fallback:key")).resolves.toBeNull();
  });

  it("returns callback result on JSON cache miss and cached value on hit", async () => {
    const env = {};
    const loader = vi.fn().mockResolvedValue({ ok: true });

    await expect(cacheJson(env, "json:key", 60, loader)).resolves.toEqual({ ok: true });
    await expect(cacheJson(env, "json:key", 60, loader)).resolves.toEqual({ ok: true });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("increments namespace version for invalidation", async () => {
    const env = {};

    await expect(getCacheVersion(env, "admin:cache:version")).resolves.toBe(1);
    await incrementCacheVersion(env, "admin:cache:version");
    await expect(getCacheVersion(env, "admin:cache:version")).resolves.toBe(2);
  });

  it("increments counters with ttl", async () => {
    const env = {};

    await expect(incrementCounter(env, "counter:key", 60)).resolves.toBe(1);
    await expect(incrementCounter(env, "counter:key", 60)).resolves.toBe(2);
  });

  it("uses atomic Upstash INCR for counters", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 })));
    vi.stubGlobal("fetch", fetchMock);
    const env = { UPSTASH_REDIS_REST_URL: "https://redis.example", UPSTASH_REDIS_REST_TOKEN: "token" };

    await expect(incrementCounter(env, "counter:key", 60)).resolves.toBe(1);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://redis.example/incr/counter%3Akey", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://redis.example/expire/counter%3Akey/60", expect.objectContaining({ method: "POST" }));
  });

  it("stores and reads idempotency entries", async () => {
    const env = {};

    await writeIdempotency(env, "idem:key", { requestHash: "abc", statusCode: 200, body: { ok: true } }, 60);

    await expect(readIdempotency(env, "idem:key")).resolves.toEqual({ requestHash: "abc", statusCode: 200, body: { ok: true } });
  });
});
