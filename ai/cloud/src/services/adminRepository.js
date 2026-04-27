import { cacheJson, getCacheVersion } from "./adminRedis.js";

export const ADMIN_CACHE_VERSION_KEY = "admin:cache:version";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function rows(result) {
  return result?.results || [];
}

function todayIsoStart() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeUrl(input) {
  if (input instanceof URL) return input;
  return new URL(String(input || "http://local"));
}

async function adminCacheKey(env, suffix) {
  const version = await getCacheVersion(env, ADMIN_CACHE_VERSION_KEY);
  return `admin:cache:v${version}:${suffix}`;
}

function stableSearchParams(urlInput) {
  const url = normalizeUrl(urlInput);
  return [...url.searchParams.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&") || "all";
}

export function limitFromUrl(urlInput, defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT) {
  const url = normalizeUrl(urlInput);
  const limit = Number(url.searchParams.get("limit") || defaultLimit);
  if (!Number.isFinite(limit) || limit <= 0) return defaultLimit;
  return Math.min(Math.floor(limit), maxLimit);
}

export function cursorFromUrl(urlInput) {
  const url = normalizeUrl(urlInput);
  const cursor = url.searchParams.get("cursor");
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(atob(cursor));
    if (!decoded?.createdAt || !decoded?.id) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function encodeCursor(row) {
  if (!row?.createdAt || !row?.id) return null;
  return btoa(JSON.stringify({ createdAt: row.createdAt, id: row.id }));
}

export function dateRangeFromUrl(urlInput) {
  const url = normalizeUrl(urlInput);
  return {
    from: url.searchParams.get("from") || null,
    to: url.searchParams.get("to") || null
  };
}

export function formatCurrencyMinor(amountMinor = 0, currency = "IDR") {
  const divisor = currency === "USD" ? 100 : 1;
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2
  }).format(Number(amountMinor || 0) / divisor);
}

export function formatUsd(value = 0) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(value || 0));
}

function cursorClause(cursor, params) {
  if (!cursor) return "";
  params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  return " AND (createdAt < ? OR (createdAt = ? AND id < ?))";
}

function likeTerm(value) {
  return `%${String(value || "").trim().toLowerCase()}%`;
}

function paymentStatusLabel(status) {
  return String(status || "").replace(/_/g, " ");
}

export function mapPaymentRow(row) {
  const userEmail = row.userEmail || "Unknown user";
  return {
    id: row.id,
    userId: row.userId,
    userEmail,
    userName: row.userName || "",
    purpose: row.purpose,
    status: row.status,
    statusLabel: paymentStatusLabel(row.status),
    planSlug: row.planSlug || null,
    amountMinor: row.amountMinor,
    amountDisplay: formatCurrencyMinor(row.amountMinor, row.currency),
    currency: row.currency,
    referenceCode: row.referenceCode,
    senderName: row.senderName || null,
    senderReference: row.senderReference || null,
    notes: row.notes || null,
    submittedAt: row.submittedAt || null,
    transferredAt: row.transferredAt || null,
    approvedAt: row.approvedAt || null,
    rejectedAt: row.rejectedAt || null,
    rejectionReason: row.rejectionReason || null,
    expiresAt: row.expiresAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function mapPaymentDetailRow(row) {
  if (!row) return null;
  return {
    ...mapPaymentRow(row),
    approvedByAdminEmail: row.approvedByAdminEmail || null,
    rejectedByAdminEmail: row.rejectedByAdminEmail || null,
    destination: row.destinationId ? {
      id: row.destinationId,
      provider: row.destinationProvider,
      displayName: row.destinationDisplayName,
      accountNumber: row.destinationAccountNumber,
      accountHolderName: row.destinationAccountHolderName,
      instructions: row.destinationInstructions || "",
      isActive: Boolean(row.destinationIsActive),
      updatedAt: row.destinationUpdatedAt || null
    } : null,
    user: {
      id: row.userId,
      email: row.userEmail || "",
      name: row.userName || "",
      planSlug: row.userPlanSlug || row.planSlug || "free",
      status: row.userStatus || "active"
    }
  };
}

export function mapUserRow(row) {
  const balanceMinor = Number(row.balanceMinor || 0);
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    planSlug: row.planSlug,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastSeenAt: row.lastSeenAt || null,
    creditBalanceMinor: balanceMinor,
    creditBalanceDisplay: formatCurrencyMinor(balanceMinor, row.creditCurrency || "USD"),
    requestCount: Number(row.requestCount || 0),
    chargedCostDisplay: formatUsd(row.chargedCostUsd || 0)
  };
}

export function mapUsageRow(row) {
  return {
    id: row.id,
    requestId: row.requestId,
    userId: row.userId || null,
    userEmail: row.userEmail || null,
    apiKeyId: row.apiKeyId || null,
    machineId: row.machineId || null,
    provider: row.provider,
    model: row.model,
    appLabel: row.appLabel || null,
    status: row.status,
    inputTokens: Number(row.inputTokens || 0),
    outputTokens: Number(row.outputTokens || 0),
    latencyMs: row.latencyMs === null || row.latencyMs === undefined ? null : Number(row.latencyMs),
    chargedCostUsd: Number(row.chargedCostUsd || 0),
    chargedCostDisplay: formatUsd(row.chargedCostUsd || 0),
    countedTowardQuotaUsd: Number(row.countedTowardQuotaUsd || 0),
    planSlug: row.planSlug || null,
    errorCode: row.errorCode || null,
    createdAt: row.createdAt
  };
}

export function mapModelRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    provider: row.provider,
    providerCode: row.providerCode,
    modelId: row.modelId,
    summary: row.summary || "",
    contextWindow: row.contextWindow || "",
    category: row.category || "general",
    latency: row.latency || "",
    inputPrice: row.inputPrice || "",
    outputPrice: row.outputPrice || "",
    visibility: row.visibility,
    accessState: row.accessState,
    allowedPlanSlugs: parseJson(row.allowedPlanSlugs, ["free", "pro", "payg"]),
    metadata: parseJson(row.metadata, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function mapPlanRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    billingType: row.billingType,
    priceMinor: row.priceMinor,
    priceDisplay: formatCurrencyMinor(row.priceMinor, row.currency),
    currency: row.currency,
    interval: row.interval || null,
    includedCreditUsd: row.includedCreditUsd === null || row.includedCreditUsd === undefined ? null : Number(row.includedCreditUsd),
    windowHours: row.windowHours === null || row.windowHours === undefined ? null : Number(row.windowHours),
    discountPercent: row.discountPercent === null || row.discountPercent === undefined ? null : Number(row.discountPercent),
    active: Boolean(row.active),
    visible: Boolean(row.visible),
    sortOrder: Number(row.sortOrder || 0),
    metadata: parseJson(row.metadata, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

async function all(env, sql, params = []) {
  const statement = env.DB.prepare(sql);
  return rows(await statement.bind(...params).all());
}

async function first(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).first();
}

async function run(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).run();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function findDeletedEmailReservation(env, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return first(env, "SELECT * FROM deleted_user_emails WHERE normalizedEmail = ?", [normalizedEmail]);
}

async function reserveDeletedEmail(env, user, reason) {
  const deletedAt = new Date().toISOString();
  await run(
    env,
    "INSERT OR REPLACE INTO deleted_user_emails (normalizedEmail, originalEmail, deletedUserId, reason, deletedAt) VALUES (?, ?, ?, ?, ?)",
    [normalizeEmail(user.email), user.email, user.id, reason || null, deletedAt]
  );
  return deletedAt;
}

async function loadOverview(env) {
  const today = todayIsoStart();
  const [pending, submittedToday, approvedToday, activeUsers, requestSummary, workPayments, workUsers, workRequests, chartRows] = await Promise.all([
    first(env, "SELECT COUNT(*) AS count FROM manual_payments WHERE status IN ('submitted','under_review')"),
    first(env, "SELECT COUNT(*) AS count FROM manual_payments WHERE createdAt >= ?", [today]),
    first(env, "SELECT COALESCE(SUM(amountMinor), 0) AS total FROM manual_payments WHERE status = 'approved' AND approvedAt >= ?", [today]),
    first(env, "SELECT COUNT(*) AS count FROM users WHERE status = 'active'"),
    first(env, "SELECT COUNT(*) AS requests, SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failed FROM usage_requests WHERE createdAt >= ?", [today]),
    all(env, "SELECT p.*, u.email AS userEmail, u.name AS userName FROM manual_payments p LEFT JOIN users u ON u.id = p.userId WHERE p.status IN ('submitted','under_review') ORDER BY p.createdAt ASC LIMIT 5"),
    all(env, "SELECT * FROM users ORDER BY createdAt DESC LIMIT 5"),
    all(env, "SELECT r.*, u.email AS userEmail FROM usage_requests r LEFT JOIN users u ON u.id = r.userId ORDER BY r.createdAt DESC LIMIT 5"),
    all(env, "SELECT substr(createdAt, 1, 10) AS label, COUNT(*) AS requests, COALESCE(SUM(chargedCostUsd), 0) AS cost, SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS errors FROM usage_requests WHERE createdAt >= datetime('now', '-13 days') GROUP BY substr(createdAt, 1, 10) ORDER BY label ASC")
  ]);

  return {
    metrics: [
      { id: "pending-payments", label: "Pending payments", value: String(pending?.count || 0), description: "Payments waiting for review" },
      { id: "submitted-today", label: "Submitted today", value: String(submittedToday?.count || 0), description: "Manual payments submitted today" },
      { id: "approved-revenue", label: "Approved revenue", value: formatCurrencyMinor(approvedToday?.total || 0, "IDR"), description: "Approved manual payment value today" },
      { id: "active-users", label: "Active users", value: String(activeUsers?.count || 0), description: "Users currently active" },
      { id: "requests", label: "API requests", value: String(requestSummary?.requests || 0), description: "Requests today" },
      { id: "failed", label: "Failed requests", value: String(requestSummary?.failed || 0), description: "Failed or rejected requests today" }
    ],
    workQueue: {
      payments: workPayments.map(mapPaymentRow),
      users: workUsers.map(mapUserRow),
      requests: workRequests.map(mapUsageRow)
    },
    charts: {
      requests: chartRows.map((row) => ({ label: row.label, value: Number(row.requests || 0) })),
      revenue: chartRows.map((row) => ({ label: row.label, value: Number(row.cost || 0) })),
      errors: chartRows.map((row) => ({ label: row.label, value: Number(row.errors || 0) }))
    }
  };
}

export async function getOverview(env) {
  return cacheJson(env, await adminCacheKey(env, "overview"), 30, () => loadOverview(env));
}

export async function listPayments(env, urlInput) {
  const url = normalizeUrl(urlInput);
  const limit = limitFromUrl(url);
  const cursor = cursorFromUrl(url);
  const params = [];
  const where = [];
  const status = url.searchParams.get("status");
  const purpose = url.searchParams.get("purpose");
  const q = url.searchParams.get("q");

  if (status) {
    where.push("p.status = ?");
    params.push(status);
  }
  if (purpose) {
    where.push("p.purpose = ?");
    params.push(purpose);
  }
  if (q) {
    where.push("(lower(u.email) LIKE ? OR lower(p.referenceCode) LIKE ? OR lower(COALESCE(p.senderName, '')) LIKE ?)");
    params.push(likeTerm(q), likeTerm(q), likeTerm(q));
  }
  if (cursor) {
    where.push("(p.createdAt < ? OR (p.createdAt = ? AND p.id < ?))");
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const list = await all(env, `SELECT p.*, u.email AS userEmail, u.name AS userName FROM manual_payments p LEFT JOIN users u ON u.id = p.userId ${whereSql} ORDER BY p.createdAt DESC, p.id DESC LIMIT ?`, [...params, limit + 1]);
  const summary = await first(env, "SELECT SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted, SUM(CASE WHEN status = 'under_review' THEN 1 ELSE 0 END) AS underReview, COALESCE(SUM(CASE WHEN status IN ('submitted','under_review') THEN amountMinor ELSE 0 END), 0) AS totalAmountSubmitted, MIN(CASE WHEN status IN ('submitted','under_review') THEN createdAt ELSE NULL END) AS oldestPending FROM manual_payments");
  const items = list.slice(0, limit);

  return {
    items: items.map(mapPaymentRow),
    nextCursor: list.length > limit ? encodeCursor(items[items.length - 1]) : null,
    summary: {
      submitted: Number(summary?.submitted || 0),
      underReview: Number(summary?.underReview || 0),
      totalAmountSubmitted: formatCurrencyMinor(summary?.totalAmountSubmitted || 0, "IDR"),
      oldestPendingAge: summary?.oldestPending || "-"
    }
  };
}

export async function getPaymentDetail(env, paymentId) {
  const row = await first(env, `SELECT p.*, u.email AS userEmail, u.name AS userName, u.planSlug AS userPlanSlug, u.status AS userStatus,
    d.provider AS destinationProvider, d.displayName AS destinationDisplayName, d.accountNumber AS destinationAccountNumber,
    d.accountHolderName AS destinationAccountHolderName, d.instructions AS destinationInstructions, d.isActive AS destinationIsActive,
    d.updatedAt AS destinationUpdatedAt
    FROM manual_payments p
    LEFT JOIN users u ON u.id = p.userId
    LEFT JOIN payment_destinations d ON d.id = p.destinationId
    WHERE p.id = ?`, [paymentId]);
  return { payment: mapPaymentDetailRow(row), paymentId };
}

async function loadUserSummary(env) {
  const summary = await first(env, `SELECT COUNT(*) AS totalUsers,
    SUM(CASE WHEN createdAt >= ? THEN 1 ELSE 0 END) AS newUsersToday,
    SUM(CASE WHEN lastSeenAt >= datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS activeUsers24h,
    SUM(CASE WHEN planSlug = 'pro' THEN 1 ELSE 0 END) AS proUsers,
    SUM(CASE WHEN planSlug = 'payg' THEN 1 ELSE 0 END) AS paygUsers
    FROM users`, [todayIsoStart()]);
  return {
    totalUsers: Number(summary?.totalUsers || 0),
    newUsersToday: Number(summary?.newUsersToday || 0),
    activeUsers24h: Number(summary?.activeUsers24h || 0),
    proUsers: Number(summary?.proUsers || 0),
    paygUsers: Number(summary?.paygUsers || 0)
  };
}

async function getCachedUserSummary(env) {
  return cacheJson(env, await adminCacheKey(env, "users:summary"), 60, () => loadUserSummary(env));
}

export async function listUsers(env, urlInput) {
  const url = normalizeUrl(urlInput);
  const limit = limitFromUrl(url);
  const cursor = cursorFromUrl(url);
  const params = [];
  const where = [];
  const q = url.searchParams.get("q");
  const plan = url.searchParams.get("plan");
  const status = url.searchParams.get("status");

  if (q) {
    where.push("(lower(u.email) LIKE ? OR lower(u.name) LIKE ?)");
    params.push(likeTerm(q), likeTerm(q));
  }
  if (plan) {
    where.push("u.planSlug = ?");
    params.push(plan);
  }
  if (status) {
    where.push("u.status = ?");
    params.push(status);
  }
  if (cursor) {
    where.push("(u.createdAt < ? OR (u.createdAt = ? AND u.id < ?))");
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const list = await all(env, `SELECT u.*, ca.balanceMinor, ca.currency AS creditCurrency, COUNT(r.id) AS requestCount, COALESCE(SUM(r.chargedCostUsd), 0) AS chargedCostUsd
    FROM users u
    LEFT JOIN credit_accounts ca ON ca.userId = u.id
    LEFT JOIN usage_requests r ON r.userId = u.id
    ${whereSql}
    GROUP BY u.id
    ORDER BY u.createdAt DESC, u.id DESC LIMIT ?`, [...params, limit + 1]);
  const summary = await getCachedUserSummary(env);
  const items = list.slice(0, limit);
  return {
    items: items.map(mapUserRow),
    nextCursor: list.length > limit ? encodeCursor(items[items.length - 1]) : null,
    summary
  };
}

export async function getUserDetail(env, userId) {
  const user = await first(env, "SELECT u.*, ca.id AS creditAccountId, ca.balanceMinor, ca.currency AS creditCurrency, p.username, p.company, p.timezone, p.bio, p.avatarUrl FROM users u LEFT JOIN credit_accounts ca ON ca.userId = u.id LEFT JOIN user_profiles p ON p.userId = u.id WHERE u.id = ?", [userId]);
  if (!user) return { user: null, userId };
  const [subscription, apiKeys, recentUsage, recentPayments, chartRows] = await Promise.all([
    first(env, "SELECT * FROM subscriptions WHERE userId = ? ORDER BY createdAt DESC LIMIT 1", [userId]),
    all(env, "SELECT id, label, maskedKey, usageMode, createdAt, lastUsedAt, revokedAt FROM api_keys WHERE userId = ? ORDER BY createdAt DESC LIMIT 20", [userId]),
    all(env, "SELECT * FROM usage_requests WHERE userId = ? ORDER BY createdAt DESC LIMIT 20", [userId]),
    all(env, "SELECT * FROM manual_payments WHERE userId = ? ORDER BY createdAt DESC LIMIT 20", [userId]),
    all(env, "SELECT substr(createdAt, 1, 10) AS label, COUNT(*) AS value FROM usage_requests WHERE userId = ? AND createdAt >= datetime('now', '-13 days') GROUP BY substr(createdAt, 1, 10) ORDER BY label ASC", [userId])
  ]);

  return {
    user: {
      ...mapUserRow(user),
      profile: {
        username: user.username || null,
        company: user.company || null,
        timezone: user.timezone || null,
        bio: user.bio || null,
        avatarUrl: user.avatarUrl || null
      },
      subscription: subscription ? { ...subscription, autoRenew: Boolean(subscription.autoRenew) } : null,
      apiKeys,
      recentUsage: recentUsage.map(mapUsageRow),
      recentPayments: recentPayments.map(mapPaymentRow),
      charts: { usage: chartRows.map((row) => ({ label: row.label, value: Number(row.value || 0) })) }
    },
    userId
  };
}

export async function updateUser(env, userId, body) {
  const user = await first(env, "SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return { status: 404, body: { error: { code: "not_found", message: "User not found.", details: [] } } };
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body?.email);
  const planSlug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!name || !email || !planSlug || !reason) {
    return { status: 400, body: { error: { code: "invalid_request", message: "Name, email, planSlug, and reason are required.", details: [] } } };
  }

  const plan = await first(env, "SELECT id FROM plans WHERE slug = ?", [planSlug]);
  if (!plan) return { status: 400, body: { error: { code: "invalid_plan", message: "Plan not found.", details: [] } } };

  const existingEmail = await first(env, "SELECT id FROM users WHERE lower(email) = ? AND id != ?", [email, userId]);
  if (existingEmail) {
    return { status: 409, body: { error: { code: "email_taken", message: "Another user already uses this email.", details: [] } } };
  }
  const reservedEmail = await findDeletedEmailReservation(env, email);
  if (reservedEmail) {
    return { status: 409, body: { error: { code: "email_reserved", message: "This email cannot be used because the account was deleted by admin.", details: [] } } };
  }

  const updatedAt = new Date().toISOString();
  await run(env, "UPDATE users SET email = ?, name = ?, planSlug = ?, updatedAt = ? WHERE id = ?", [email, name, planSlug, updatedAt, userId]);
  return { status: 200, body: await getUserDetail(env, userId) };
}

export async function setUserBanState(env, userId, body, nextStatus) {
  const user = await first(env, "SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return { status: 404, body: { error: { code: "not_found", message: "User not found.", details: [] } } };
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return { status: 400, body: { error: { code: "reason_required", message: "Reason is required.", details: [] } } };

  const updatedAt = new Date().toISOString();
  await run(env, "UPDATE users SET status = ?, updatedAt = ? WHERE id = ?", [nextStatus, updatedAt, userId]);
  return { status: 200, body: { ...(await getUserDetail(env, userId)), action: nextStatus === "banned" ? "banned" : "unbanned" } };
}

export async function deleteUser(env, userId, body) {
  const user = await first(env, "SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return { status: 404, body: { error: { code: "not_found", message: "User not found.", details: [] } } };
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return { status: 400, body: { error: { code: "reason_required", message: "Reason is required.", details: [] } } };

  const deletedAt = await reserveDeletedEmail(env, user, reason);
  await run(env, "UPDATE api_keys SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL", [deletedAt, userId]);
  await run(env, "DELETE FROM user_profiles WHERE userId = ?", [userId]);
  await run(env, "DELETE FROM subscriptions WHERE userId = ?", [userId]);
  await run(env, "DELETE FROM credit_ledger_entries WHERE userId = ?", [userId]);
  await run(env, "DELETE FROM credit_accounts WHERE userId = ?", [userId]);
  await run(env, "DELETE FROM api_keys WHERE userId = ?", [userId]);
  await run(env, "DELETE FROM users WHERE id = ?", [userId]);

  return { status: 200, body: { userId, deletedAt, previousEmail: user.email } };
}

async function loadUsageSummaryAndCharts(env, whereSql, params, from, to) {
  const summary = await first(env, `SELECT COUNT(*) AS requests, COALESCE(SUM(inputTokens), 0) AS inputTokens, COALESCE(SUM(outputTokens), 0) AS outputTokens, COALESCE(SUM(chargedCostUsd), 0) AS chargedCost, SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) AS failedRequests, AVG(latencyMs) AS averageLatency FROM usage_requests r ${whereSql}`, params);
  const chartDateWhere = "r.createdAt >= datetime('now', '-13 days')";
  const chartWhereSql = whereSql ? `${whereSql} AND ${chartDateWhere}` : `WHERE ${chartDateWhere}`;
  const chartRows = await all(env, `SELECT substr(r.createdAt, 1, 10) AS label, COUNT(*) AS requests, COALESCE(SUM(r.inputTokens + r.outputTokens), 0) AS tokens, COALESCE(SUM(r.chargedCostUsd), 0) AS cost FROM usage_requests r ${chartWhereSql} GROUP BY substr(r.createdAt, 1, 10) ORDER BY label ASC`, params);
  return {
    summary: {
      requests: Number(summary?.requests || 0),
      inputTokens: Number(summary?.inputTokens || 0),
      outputTokens: Number(summary?.outputTokens || 0),
      chargedCost: formatUsd(summary?.chargedCost || 0),
      failedRequests: Number(summary?.failedRequests || 0),
      averageLatency: summary?.averageLatency ? `${Math.round(summary.averageLatency)}ms` : "-"
    },
    charts: {
      requests: chartRows.map((row) => ({ label: row.label, value: Number(row.requests || 0) })),
      tokens: chartRows.map((row) => ({ label: row.label, value: Number(row.tokens || 0) })),
      cost: chartRows.map((row) => ({ label: row.label, value: Number(row.cost || 0) }))
    }
  };
}

async function getCachedUsageSummaryAndCharts(env, filterSuffix, whereSql, params, from, to) {
  return cacheJson(env, await adminCacheKey(env, `usage:summary-charts:${filterSuffix}`), 30, () => loadUsageSummaryAndCharts(env, whereSql, params, from, to));
}

export async function listUsageRequests(env, urlInput) {
  const url = normalizeUrl(urlInput);
  const limit = limitFromUrl(url);
  const cursor = cursorFromUrl(url);
  const params = [];
  const where = [];
  const filterParams = [];
  const filterWhere = [];
  const { from, to } = dateRangeFromUrl(url);
  for (const [key, column] of [["userId", "r.userId"], ["status", "r.status"], ["provider", "r.provider"], ["model", "r.model"]]) {
    const value = url.searchParams.get(key);
    if (value) {
      where.push(`${column} = ?`);
      params.push(value);
      filterWhere.push(`${column} = ?`);
      filterParams.push(value);
    }
  }
  if (from) {
    where.push("r.createdAt >= ?");
    params.push(from);
    filterWhere.push("r.createdAt >= ?");
    filterParams.push(from);
  }
  if (to) {
    where.push("r.createdAt <= ?");
    params.push(to);
    filterWhere.push("r.createdAt <= ?");
    filterParams.push(to);
  }
  if (cursor) {
    where.push("(r.createdAt < ? OR (r.createdAt = ? AND r.id < ?))");
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  if (url.searchParams.get("hasTokens") === "true") {
    where.push("(r.inputTokens > 0 OR r.outputTokens > 0)");
    filterWhere.push("(r.inputTokens > 0 OR r.outputTokens > 0)");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const filterWhereSql = filterWhere.length ? `WHERE ${filterWhere.join(" AND ")}` : "";
  const list = await all(env, `SELECT r.*, u.email AS userEmail FROM usage_requests r LEFT JOIN users u ON u.id = r.userId ${whereSql} ORDER BY r.createdAt DESC, r.id DESC LIMIT ?`, [...params, limit + 1]);
  const filterSearch = new URLSearchParams();
  for (const [key] of [["userId", "r.userId"], ["status", "r.status"], ["provider", "r.provider"], ["model", "r.model"]]) {
    const value = url.searchParams.get(key);
    if (value) filterSearch.set(key, value);
  }
  if (from) filterSearch.set("from", from);
  if (to) filterSearch.set("to", to);
  if (url.searchParams.get("hasTokens") === "true") filterSearch.set("hasTokens", "true");
  const filterSuffix = [...filterSearch.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") || "all";
  const summaryAndCharts = await getCachedUsageSummaryAndCharts(env, filterSuffix, filterWhereSql, filterParams, from, to);
  const items = list.slice(0, limit);
  return {
    items: items.map(mapUsageRow),
    nextCursor: list.length > limit ? encodeCursor(items[items.length - 1]) : null,
    ...summaryAndCharts
  };
}

async function loadModels(env, urlInput) {
  const url = normalizeUrl(urlInput);
  const params = [];
  const where = [];
  for (const [key, column] of [["provider", "provider"], ["category", "category"], ["visibility", "visibility"], ["accessState", "accessState"]]) {
    const value = url.searchParams.get(key);
    if (value) {
      where.push(`${column} = ?`);
      params.push(value);
    }
  }
  const plan = url.searchParams.get("plan");
  if (plan) {
    where.push("allowedPlanSlugs LIKE ?");
    params.push(`%\"${plan}\"%`);
  }
  const q = url.searchParams.get("q");
  if (q) {
    where.push("(lower(name) LIKE ? OR lower(modelId) LIKE ? OR lower(provider) LIKE ?)");
    params.push(likeTerm(q), likeTerm(q), likeTerm(q));
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const list = await all(env, `SELECT * FROM models ${whereSql} ORDER BY provider ASC, name ASC`, params);
  const summary = await first(env, "SELECT COUNT(*) AS totalModels, SUM(CASE WHEN visibility = 'visible' THEN 1 ELSE 0 END) AS visibleModels, SUM(CASE WHEN visibility != 'visible' THEN 1 ELSE 0 END) AS hiddenModels, COUNT(DISTINCT provider) AS providersCount, SUM(CASE WHEN inputPrice = '' OR outputPrice = '' THEN 1 ELSE 0 END) AS missingPricing FROM models");
  return {
    items: list.map(mapModelRow),
    nextCursor: null,
    summary: {
      totalModels: Number(summary?.totalModels || 0),
      visibleModels: Number(summary?.visibleModels || 0),
      hiddenModels: Number(summary?.hiddenModels || 0),
      providersCount: Number(summary?.providersCount || 0),
      missingPricing: Number(summary?.missingPricing || 0)
    }
  };
}

export async function listModels(env, urlInput) {
  return cacheJson(env, await adminCacheKey(env, `models:${stableSearchParams(urlInput)}`), 300, () => loadModels(env, urlInput));
}

export async function getModelDetail(env, modelId) {
  const row = await first(env, "SELECT * FROM models WHERE id = ? OR modelId = ? OR slug = ?", [modelId, modelId, modelId]);
  return { model: row ? mapModelRow(row) : null, modelId };
}

function normalizeAllowedPlanSlugs(input) {
  if (Array.isArray(input)) return input.map((value) => String(value).trim()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map((value) => value.trim()).filter(Boolean);
  return ["free", "pro", "payg"];
}

function normalizeModelPayload(body, fallback = null) {
  const name = typeof body?.name === "string" ? body.name.trim() : fallback?.name || "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : fallback?.slug || "";
  const provider = typeof body?.provider === "string" ? body.provider.trim() : fallback?.provider || "";
  const providerCode = typeof body?.providerCode === "string" ? body.providerCode.trim() : fallback?.providerCode || provider;
  const modelId = typeof body?.modelId === "string" ? body.modelId.trim() : fallback?.modelId || "";
  if (!name || !slug || !provider || !providerCode || !modelId) return null;

  return {
    name,
    slug,
    provider,
    providerCode,
    modelId,
    summary: typeof body?.summary === "string" ? body.summary.trim() : fallback?.summary || "",
    contextWindow: typeof body?.contextWindow === "string" ? body.contextWindow.trim() : fallback?.contextWindow || "",
    category: typeof body?.category === "string" ? body.category.trim() : fallback?.category || "general",
    latency: typeof body?.latency === "string" ? body.latency.trim() : fallback?.latency || "",
    inputPrice: typeof body?.inputPrice === "string" ? body.inputPrice.trim() : fallback?.inputPrice || "",
    outputPrice: typeof body?.outputPrice === "string" ? body.outputPrice.trim() : fallback?.outputPrice || "",
    visibility: typeof body?.visibility === "string" ? body.visibility.trim() : fallback?.visibility || "visible",
    accessState: typeof body?.accessState === "string" ? body.accessState.trim() : fallback?.accessState || "enabled",
    allowedPlanSlugs: normalizeAllowedPlanSlugs(body?.allowedPlanSlugs ?? fallback?.allowedPlanSlugs),
    metadata: body?.metadata ?? fallback?.metadata ?? null,
  };
}

export async function createModel(env, body) {
  const payload = normalizeModelPayload(body);
  if (!payload) return { status: 400, body: { error: { code: "invalid_model", message: "Model payload is incomplete.", details: [] } } };
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await run(
    env,
    "INSERT INTO models (id, slug, name, provider, providerCode, modelId, summary, contextWindow, category, latency, inputPrice, outputPrice, visibility, accessState, allowedPlanSlugs, metadata, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, payload.slug, payload.name, payload.provider, payload.providerCode, payload.modelId, payload.summary, payload.contextWindow, payload.category, payload.latency, payload.inputPrice, payload.outputPrice, payload.visibility, payload.accessState, JSON.stringify(payload.allowedPlanSlugs), JSON.stringify(payload.metadata), now, now]
  );
  return { status: 201, body: await getModelDetail(env, id) };
}

export async function updateModel(env, modelId, body) {
  const existing = (await getModelDetail(env, modelId)).model;
  if (!existing) return { status: 404, body: { error: { code: "not_found", message: "Model not found.", details: [] } } };
  const payload = normalizeModelPayload(body, existing);
  if (!payload) return { status: 400, body: { error: { code: "invalid_model", message: "Model payload is incomplete.", details: [] } } };
  const now = new Date().toISOString();
  await run(
    env,
    "UPDATE models SET slug = ?, name = ?, provider = ?, providerCode = ?, modelId = ?, summary = ?, contextWindow = ?, category = ?, latency = ?, inputPrice = ?, outputPrice = ?, visibility = ?, accessState = ?, allowedPlanSlugs = ?, metadata = ?, updatedAt = ? WHERE id = ?",
    [payload.slug, payload.name, payload.provider, payload.providerCode, payload.modelId, payload.summary, payload.contextWindow, payload.category, payload.latency, payload.inputPrice, payload.outputPrice, payload.visibility, payload.accessState, JSON.stringify(payload.allowedPlanSlugs), JSON.stringify(payload.metadata), now, existing.id]
  );
  return { status: 200, body: await getModelDetail(env, existing.id) };
}

export async function setModelAccessState(env, modelId, accessState) {
  const existing = (await getModelDetail(env, modelId)).model;
  if (!existing) return { status: 404, body: { error: { code: "not_found", message: "Model not found.", details: [] } } };
  const now = new Date().toISOString();
  await run(env, "UPDATE models SET accessState = ?, updatedAt = ? WHERE id = ?", [accessState, now, existing.id]);
  return { status: 200, body: await getModelDetail(env, existing.id) };
}

export async function deleteModel(env, modelId) {
  const existing = (await getModelDetail(env, modelId)).model;
  if (!existing) return { status: 404, body: { error: { code: "not_found", message: "Model not found.", details: [] } } };
  await run(env, "DELETE FROM models WHERE id = ?", [existing.id]);
  return { status: 200, body: { modelId: existing.id, deletedAt: new Date().toISOString() } };
}

async function loadPlans(env) {
  const list = await all(env, "SELECT * FROM plans ORDER BY sortOrder ASC, slug ASC");
  return { plans: list.map(mapPlanRow) };
}

export async function listPlans(env) {
  return cacheJson(env, await adminCacheKey(env, "plans"), 300, () => loadPlans(env));
}

export async function getPlanDetail(env, planId) {
  const row = await first(env, "SELECT * FROM plans WHERE id = ? OR slug = ?", [planId, planId]);
  return { plan: row ? mapPlanRow(row) : null, planId };
}

export async function updatePlan(env, planId, body) {
  const existing = (await getPlanDetail(env, planId)).plan;
  if (!existing) return { status: 404, body: { error: { code: "not_found", message: "Plan not found.", details: [] } } };

  const name = typeof body?.name === "string" ? body.name.trim() : existing.name;
  const description = typeof body?.description === "string" ? body.description.trim() : existing.description;
  const billingType = typeof body?.billingType === "string" ? body.billingType.trim() : existing.billingType;
  const currency = typeof body?.currency === "string" ? body.currency.trim() : existing.currency;
  const interval = typeof body?.interval === "string" ? body.interval.trim() : existing.interval;
  const priceMinor = Number.isFinite(Number(body?.priceMinor)) ? Number(body.priceMinor) : existing.priceMinor;
  const includedCreditUsd = body?.includedCreditUsd === null || body?.includedCreditUsd === "" ? null : (Number.isFinite(Number(body?.includedCreditUsd)) ? Number(body.includedCreditUsd) : existing.includedCreditUsd);
  const windowHours = body?.windowHours === null || body?.windowHours === "" ? null : (Number.isFinite(Number(body?.windowHours)) ? Number(body.windowHours) : existing.windowHours);
  const discountPercent = body?.discountPercent === null || body?.discountPercent === "" ? null : (Number.isFinite(Number(body?.discountPercent)) ? Number(body.discountPercent) : existing.discountPercent);
  const active = body?.active === undefined ? existing.active : normalizeBoolean(body.active, existing.active);
  const visible = body?.visible === undefined ? existing.visible : normalizeBoolean(body.visible, existing.visible);
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : existing.sortOrder;
  const metadata = body?.metadata ?? existing.metadata ?? null;

  const updatedAt = new Date().toISOString();
  await run(
    env,
    "UPDATE plans SET name = ?, description = ?, billingType = ?, priceMinor = ?, currency = ?, interval = ?, includedCreditUsd = ?, windowHours = ?, discountPercent = ?, active = ?, visible = ?, sortOrder = ?, metadata = ?, updatedAt = ? WHERE id = ?",
    [name, description, billingType, priceMinor, currency, interval || null, includedCreditUsd, windowHours, discountPercent, active ? 1 : 0, visible ? 1 : 0, sortOrder, JSON.stringify(metadata), updatedAt, existing.id]
  );
  return { status: 200, body: await getPlanDetail(env, existing.id) };
}

export async function modelCatalogHasRows(env) {
  if (!env.DB) return false;
  const row = await first(env, "SELECT COUNT(*) AS count FROM models");
  return Number(row?.count || 0) > 0;
}

export async function getEnabledModel(env, modelId, planSlug = null) {
  if (!env.DB) return { allowed: true, reason: null };
  const row = await first(env, "SELECT * FROM models WHERE modelId = ? OR slug = ?", [modelId, modelId]);
  if (!row) return { allowed: false, reason: "Unknown model" };
  if (row.visibility !== "visible" || row.accessState !== "enabled") return { allowed: false, reason: "Model disabled" };
  const allowedPlans = parseJson(row.allowedPlanSlugs, []);
  if (planSlug && allowedPlans.length > 0 && !allowedPlans.includes(planSlug)) return { allowed: false, reason: "Plan cannot access model" };
  return { allowed: true, model: mapModelRow(row) };
}
