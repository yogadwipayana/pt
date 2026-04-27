const fallbackStore = new Map();
const DEFAULT_VERSION = 1;

function getBinding(env) {
  return env.REDIS || env.ADMIN_CACHE || null;
}

function hasUpstash(env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

function normalizeUpstashUrl(env, path) {
  const base = String(env.UPSTASH_REDIS_REST_URL || "").replace(/\/+$/, "");
  return `${base}/${path}`;
}

async function upstashCommand(env, command, ...parts) {
  const encoded = parts.map((part) => encodeURIComponent(String(part))).join("/");
  const url = normalizeUpstashUrl(env, `${command.toLowerCase()}${encoded ? `/${encoded}` : ""}`);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!response.ok) throw new Error(`Upstash ${command} failed with ${response.status}`);
  const data = await response.json();
  return data?.result ?? null;
}

async function upstashSet(env, key, value, ttlSeconds) {
  await upstashCommand(env, "SET", key, value, "EX", ttlSeconds);
}

function fallbackRead(key) {
  const value = fallbackStore.get(key);
  if (!value) return null;
  if (value.expiresAt && value.expiresAt <= Date.now()) {
    fallbackStore.delete(key);
    return null;
  }
  return value.data;
}

function fallbackWrite(key, value, ttlSeconds) {
  fallbackStore.set(key, { data: value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
}

export async function cacheGet(env, key) {
  try {
    const binding = getBinding(env);
    if (binding?.get) return await binding.get(key);
    if (hasUpstash(env)) return await upstashCommand(env, "GET", key);
  } catch (error) {
    console.warn("Redis cache get failed", error);
  }
  return fallbackRead(key);
}

export async function cachePut(env, key, value, ttlSeconds = 300) {
  try {
    const binding = getBinding(env);
    if (binding?.put) {
      await binding.put(key, value, { expirationTtl: ttlSeconds });
      return;
    }
    if (hasUpstash(env)) {
      await upstashSet(env, key, value, ttlSeconds);
      return;
    }
  } catch (error) {
    console.warn("Redis cache put failed", error);
  }
  fallbackWrite(key, value, ttlSeconds);
}

export async function cacheDelete(env, key) {
  try {
    const binding = getBinding(env);
    if (binding?.delete) {
      await binding.delete(key);
      return;
    }
    if (hasUpstash(env)) {
      await upstashCommand(env, "DEL", key);
      return;
    }
  } catch (error) {
    console.warn("Redis cache delete failed", error);
  }
  fallbackStore.delete(key);
}

export async function cacheJson(env, key, ttlSeconds, callback) {
  const existing = await cacheGet(env, key);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      await cacheDelete(env, key);
    }
  }
  const result = await callback();
  await cachePut(env, key, JSON.stringify(result), ttlSeconds);
  return result;
}

export async function getCacheVersion(env, key) {
  const value = await cacheGet(env, key);
  const version = Number(value || DEFAULT_VERSION);
  return Number.isFinite(version) && version > 0 ? version : DEFAULT_VERSION;
}

export async function incrementCacheVersion(env, key) {
  const next = (await getCacheVersion(env, key)) + 1;
  await cachePut(env, key, String(next), 60 * 60 * 24 * 30);
  return next;
}

export async function incrementCounter(env, key, ttlSeconds) {
  try {
    if (hasUpstash(env)) {
      const next = Number(await upstashCommand(env, "INCR", key));
      if (next === 1) await upstashCommand(env, "EXPIRE", key, ttlSeconds);
      return next;
    }
  } catch (error) {
    console.warn("Redis counter increment failed", error);
  }
  const next = Number(await cacheGet(env, key) || 0) + 1;
  await cachePut(env, key, String(next), ttlSeconds);
  return next;
}

export async function getCounter(env, key) {
  return Number(await cacheGet(env, key) || 0);
}

export async function resetCounter(env, key) {
  await cacheDelete(env, key);
}

export async function readIdempotency(env, key) {
  const value = await cacheGet(env, key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    await cacheDelete(env, key);
    return null;
  }
}

export async function writeIdempotency(env, key, entry, ttlSeconds) {
  await cachePut(env, key, JSON.stringify(entry), ttlSeconds);
}

export async function withIdempotency(env, key, ttlSeconds, callback) {
  const existing = await readIdempotency(env, key);
  if (existing) return existing;
  const result = await callback();
  await writeIdempotency(env, key, result, ttlSeconds);
  return result;
}
