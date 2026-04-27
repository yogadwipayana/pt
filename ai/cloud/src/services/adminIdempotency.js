import { errorResponse, jsonResponse } from "../utils/jsonResponse.js";
import { readIdempotency, writeIdempotency } from "./adminRedis.js";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;

async function hashRequestBody(body) {
  const payload = JSON.stringify(body || {});
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function redisIdempotencyKey(key) {
  return `admin:idempotency:${key}`;
}

function statusFromResponse(response) {
  return Number(response?.status || 200);
}

function bodyFromResponse(response) {
  return response?.body === undefined ? response : response.body;
}

export async function withAdminIdempotency(env, { key, scope, actorEmail, requestBody }, callback) {
  if (!key) return errorResponse(400, "idempotency_key_required", "Idempotency key is required.");
  if (!env.DB) return callback();

  const requestHash = await hashRequestBody(requestBody);
  const redisKey = redisIdempotencyKey(key);
  const cached = await readIdempotency(env, redisKey);
  if (cached) {
    if (cached.scope !== scope || cached.requestHash !== requestHash) {
      return errorResponse(409, "idempotency_conflict", "Idempotency key was already used for a different request.");
    }
    if (cached.statusCode === 202) {
      return errorResponse(409, "idempotency_in_progress", "Idempotent request is still being processed.");
    }
    return jsonResponse(cached.body, cached.statusCode);
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_TTL_MS).toISOString();
  const reservedBody = JSON.stringify({ pending: true });
  const reserved = await env.DB.prepare("INSERT OR IGNORE INTO admin_idempotency_keys (key, actorEmail, scope, requestHash, responseJson, statusCode, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(key, actorEmail || "admin", scope, requestHash, reservedBody, 202, now.toISOString(), expiresAt)
    .run();

  if (!reserved.meta?.changes) {
    const existing = await env.DB.prepare("SELECT key, scope, requestHash, responseJson, statusCode, expiresAt FROM admin_idempotency_keys WHERE key = ?")
      .bind(key)
      .first();
    if (!existing) {
      return errorResponse(409, "idempotency_conflict", "Idempotency key could not be reserved.");
    }
    if (new Date(existing.expiresAt).getTime() <= Date.now()) {
      await env.DB.prepare("DELETE FROM admin_idempotency_keys WHERE key = ? AND scope = ? AND requestHash = ? AND statusCode = ? AND expiresAt = ?")
        .bind(key, existing.scope, existing.requestHash, existing.statusCode, existing.expiresAt)
        .run();
      return withAdminIdempotency(env, { key, scope, actorEmail, requestBody }, callback);
    }
    if (existing.scope !== scope || existing.requestHash !== requestHash) {
      return errorResponse(409, "idempotency_conflict", "Idempotency key was already used for a different request.");
    }
    if (existing.statusCode === 202) {
      return errorResponse(409, "idempotency_in_progress", "Idempotent request is still being processed.");
    }
    return jsonResponse(JSON.parse(existing.responseJson), existing.statusCode);
  }

  const response = await callback();
  const statusCode = statusFromResponse(response);
  const body = bodyFromResponse(response);
  await env.DB.prepare("UPDATE admin_idempotency_keys SET responseJson = ?, statusCode = ? WHERE key = ?")
    .bind(JSON.stringify(body), statusCode, key)
    .run();
  await writeIdempotency(env, redisKey, { scope, requestHash, statusCode, body }, Math.ceil(DEFAULT_TTL_MS / 1000));

  return jsonResponse(body, statusCode);
}
