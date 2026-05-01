const SENSITIVE_KEYS = ["password", "passwordHash", "token", "secret", "apiKey", "authorization", "cookie", "proofUrl"];

export function redactAdminValue(value) {
  if (Array.isArray(value)) return value.map(redactAdminValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const normalizedKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => normalizedKey.includes(sensitive.toLowerCase()))) {
        return [key, "[redacted]"];
      }
      return [key, redactAdminValue(entry)];
    })
  );
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function encodeCursor(row) {
  if (!row?.createdAt || !row?.id) return null;
  return btoa(JSON.stringify({ createdAt: row.createdAt, id: row.id }));
}

function cursorFromUrl(url) {
  const value = url.searchParams.get("cursor");
  if (!value) return null;
  try {
    return JSON.parse(atob(value));
  } catch {
    return null;
  }
}

export async function writeAdminAuditEvent(env, event) {
  const safeEvent = {
    ...event,
    metadata: redactAdminValue(event.metadata || {}),
    createdAt: event.createdAt || new Date().toISOString()
  };

  if (env.DB) {
    await env.DB.prepare(
      "INSERT INTO admin_audit_events (id, actorEmail, action, targetType, targetId, summary, metadata, idempotencyKey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(
        crypto.randomUUID(),
        safeEvent.actorEmail,
        safeEvent.action,
        safeEvent.targetType,
        safeEvent.targetId,
        safeEvent.summary,
        JSON.stringify(safeEvent.metadata),
        safeEvent.idempotencyKey || null,
        safeEvent.createdAt
      )
      .run();
  }

  return safeEvent;
}

export async function listAdminAuditEvents(env, urlInput = "http://local", defaultLimit = 50) {
  if (!env.DB) {
    return { items: [], nextCursor: null, summary: { eventsToday: 0, paymentApprovalsToday: 0, paymentRejectionsToday: 0, catalogChangesToday: 0 } };
  }

  const url = urlInput instanceof URL ? urlInput : new URL(String(urlInput || "http://local"));
  const limit = Math.min(Number(url.searchParams.get("limit") || defaultLimit), 100);
  const cursor = cursorFromUrl(url);
  const params = [];
  const where = [];
  for (const [key, column] of [["targetType", "targetType"], ["targetId", "targetId"], ["actorEmail", "actorEmail"], ["action", "action"]]) {
    const value = url.searchParams.get(key);
    if (value) {
      where.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (url.searchParams.get("date") === "today") {
    const todayFilter = new Date();
    todayFilter.setUTCHours(0, 0, 0, 0);
    where.push("createdAt >= ?");
    params.push(todayFilter.toISOString());
  }
  if (!url.searchParams.get("action") && url.searchParams.get("group") === "payment_approvals") {
    where.push("action IN ('payment_approved', 'payment.approve')");
  }
  if (!url.searchParams.get("action") && url.searchParams.get("group") === "payment_rejections") {
    where.push("action IN ('payment_rejected', 'payment.reject')");
  }
  if (!url.searchParams.get("targetType") && url.searchParams.get("group") === "catalog") {
    where.push("(targetType IN ('model','plan') OR action LIKE 'model.%' OR action LIKE 'plan.%')");
  }
  if (cursor) {
    where.push("(createdAt < ? OR (createdAt = ? AND id < ?))");
    params.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const result = await env.DB.prepare(
    `SELECT id, actorEmail, action, targetType, targetId, summary, metadata, idempotencyKey, createdAt FROM admin_audit_events ${whereSql} ORDER BY createdAt DESC, id DESC LIMIT ?`
  )
    .bind(...params, limit + 1)
    .all();
  const rows = result.results || [];
  const items = rows.slice(0, limit);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const summary = await env.DB.prepare(`SELECT COUNT(*) AS eventsToday,
    SUM(CASE WHEN action IN ('payment_approved', 'payment.approve') THEN 1 ELSE 0 END) AS paymentApprovalsToday,
    SUM(CASE WHEN action IN ('payment_rejected', 'payment.reject') THEN 1 ELSE 0 END) AS paymentRejectionsToday,
    SUM(CASE WHEN targetType IN ('model','plan') OR action LIKE 'model.%' OR action LIKE 'plan.%' THEN 1 ELSE 0 END) AS catalogChangesToday
    FROM admin_audit_events WHERE createdAt >= ?`).bind(today.toISOString()).first();

  return {
    items: items.map((row) => ({
      id: row.id,
      actorAdminEmail: row.actorEmail,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      summary: row.summary,
      metadata: redactAdminValue(parseJson(row.metadata)),
      idempotencyKey: row.idempotencyKey || null,
      createdAt: row.createdAt
    })),
    nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    summary: {
      eventsToday: Number(summary?.eventsToday || 0),
      paymentApprovalsToday: Number(summary?.paymentApprovalsToday || 0),
      paymentRejectionsToday: Number(summary?.paymentRejectionsToday || 0),
      catalogChangesToday: Number(summary?.catalogChangesToday || 0)
    }
  };
}
