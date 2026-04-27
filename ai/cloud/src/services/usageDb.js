function nowIso() {
  return new Date().toISOString();
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function all(env, sql, params = []) {
  if (!env.DB) return [];
  const result = await env.DB.prepare(sql).bind(...params).all();
  return result?.results || [];
}

export async function saveRequestUsage(env, usage = {}) {
  if (!env.DB) return null;
  const createdAt = usage.createdAt || nowIso();
  const id = usage.id || crypto.randomUUID();
  const requestId = usage.requestId || id;
  await env.DB.prepare(`INSERT OR IGNORE INTO usage_requests
    (id, requestId, userId, apiKeyId, machineId, provider, model, appLabel, status, inputTokens, outputTokens, latencyMs, chargedCostUsd, countedTowardQuotaUsd, planSlug, errorCode, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id,
    requestId,
    usage.userId || null,
    usage.apiKeyId || null,
    usage.machineId || null,
    usage.provider || "unknown",
    usage.model || "unknown",
    usage.appLabel || null,
    usage.status || "success",
    safeNumber(usage.inputTokens),
    safeNumber(usage.outputTokens),
    usage.latencyMs === undefined || usage.latencyMs === null ? null : safeNumber(usage.latencyMs),
    safeNumber(usage.chargedCostUsd),
    safeNumber(usage.countedTowardQuotaUsd),
    usage.planSlug || null,
    usage.errorCode || null,
    createdAt
  ).run();
  return { id, requestId, createdAt };
}

export async function appendRequestLog(env, usage = {}) {
  return saveRequestUsage(env, usage);
}

export function trackPendingRequest() {}

export async function getUsageHistory(env, filters = {}) {
  const limit = Math.min(Number(filters.limit || 50), 100);
  const params = [];
  const where = [];
  for (const [key, column] of [["userId", "userId"], ["machineId", "machineId"], ["status", "status"], ["provider", "provider"], ["model", "model"]]) {
    if (filters[key]) {
      where.push(`${column} = ?`);
      params.push(filters[key]);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return all(env, `SELECT * FROM usage_requests ${whereSql} ORDER BY createdAt DESC, id DESC LIMIT ?`, [...params, limit]);
}

export async function getUsageStats(env, filters = {}) {
  const history = await getUsageHistory(env, { ...filters, limit: filters.limit || 1000 });
  return history.reduce((stats, item) => {
    stats.requests += 1;
    stats.inputTokens += safeNumber(item.inputTokens);
    stats.outputTokens += safeNumber(item.outputTokens);
    stats.chargedCostUsd += safeNumber(item.chargedCostUsd);
    if (item.status !== "success") stats.failedRequests += 1;
    return stats;
  }, { requests: 0, inputTokens: 0, outputTokens: 0, chargedCostUsd: 0, failedRequests: 0 });
}

export async function getRecentLogs(env, filters = {}) {
  return getUsageHistory(env, filters);
}

export async function getUsageDb(env) {
  return { data: { history: await getUsageHistory(env) } };
}
