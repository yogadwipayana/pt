import { writeAdminAuditEvent } from "./adminAudit.js";
import { incrementCacheVersion } from "./adminRedis.js";
import { ADMIN_CACHE_VERSION_KEY, formatCurrencyMinor, getPaymentDetail } from "./adminRepository.js";

const REVIEWABLE_PAYMENT_STATUSES = ["submitted", "under_review"];

function creditAccountId(userId) {
  return `credit_${userId}`;
}

function nowIso() {
  return new Date().toISOString();
}

async function invalidateAdminCache(env) {
  await incrementCacheVersion(env, ADMIN_CACHE_VERSION_KEY);
}

function badRequest(code, message) {
  return { status: 400, body: { error: { code, message, details: [] } } };
}

function notFound(message) {
  return { status: 404, body: { error: { code: "not_found", message, details: [] } } };
}

async function first(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).first();
}

async function run(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).run();
}


function creditBatchStatements(env, { account, userId, amountMinor, currency = "USD", reason, sourceType, sourceId, idempotencyKey, adminEmail, createdAt, ledgerId }) {
  return [
    env.DB.prepare("INSERT OR IGNORE INTO credit_accounts (id, userId, currency, balanceMinor, updatedAt) VALUES (?, ?, ?, 0, ?)").bind(account.id, userId, currency, createdAt),
    env.DB.prepare("INSERT INTO credit_ledger_entries (id, userId, accountId, kind, amountMinor, currency, reason, sourceType, sourceId, idempotencyKey, createdByAdminEmail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(ledgerId, userId, account.id, amountMinor >= 0 ? "credit" : "debit", amountMinor, currency, reason, sourceType, sourceId, idempotencyKey || null, adminEmail || null, createdAt),
    env.DB.prepare("UPDATE credit_accounts SET balanceMinor = balanceMinor + ?, updatedAt = ? WHERE id = ?").bind(amountMinor, createdAt, account.id)
  ];
}

async function applyCredit(env, { userId, amountMinor, currency = "USD", reason, sourceType, sourceId, idempotencyKey, adminEmail }) {
  if (idempotencyKey) {
    const existing = await first(env, "SELECT id FROM credit_ledger_entries WHERE idempotencyKey = ?", [idempotencyKey]);
    if (existing) return { ledgerEntryId: existing.id, accountId: creditAccountId(userId), replayed: true };
  }
  const account = await first(env, "SELECT * FROM credit_accounts WHERE userId = ?", [userId]) || { id: creditAccountId(userId), userId, currency, balanceMinor: 0, updatedAt: nowIso() };
  const ledgerId = crypto.randomUUID();
  const createdAt = nowIso();
  await env.DB.batch(creditBatchStatements(env, { account, userId, amountMinor, currency, reason, sourceType, sourceId, idempotencyKey, adminEmail, createdAt, ledgerId }));
  return { ledgerEntryId: ledgerId, accountId: account.id };
}

async function upsertSubscription(env, { userId, planSlug }) {
  const current = await first(env, "SELECT * FROM subscriptions WHERE userId = ? AND status = 'active' ORDER BY createdAt DESC LIMIT 1", [userId]);
  const timestamp = nowIso();
  if (current) {
    await run(env, "UPDATE subscriptions SET planSlug = ?, updatedAt = ? WHERE id = ?", [planSlug, timestamp, current.id]);
    return { previousPlanSlug: current.planSlug, subscriptionId: current.id };
  }
  const subscriptionId = crypto.randomUUID();
  await run(env, "INSERT INTO subscriptions (id, userId, planSlug, status, autoRenew, startedAt, createdAt, updatedAt) VALUES (?, ?, ?, 'active', 0, ?, ?, ?)", [subscriptionId, userId, planSlug, timestamp, timestamp, timestamp]);
  return { previousPlanSlug: null, subscriptionId };
}

export async function approvePayment(env, paymentId, body, adminSession) {
  const payment = await first(env, "SELECT * FROM manual_payments WHERE id = ?", [paymentId]);
  if (!payment) return notFound("Payment not found.");
  if (!REVIEWABLE_PAYMENT_STATUSES.includes(payment.status)) return badRequest("payment_not_reviewable", "Payment is not reviewable.");

  const adminEmail = adminSession?.email || "admin";
  const updatedAt = nowIso();
  const approvalCreditAmountMinor = payment.purpose === "add_funds" ? Number(body?.creditAmountMinor || payment.amountMinor || 0) : null;
  if (payment.purpose === "add_funds" && (!Number.isSafeInteger(approvalCreditAmountMinor) || approvalCreditAmountMinor <= 0)) return badRequest("amount_required", "Positive integer credit amount is required.");
  const claim = await run(env, "UPDATE manual_payments SET status = 'approving', updatedAt = ? WHERE id = ? AND status IN ('submitted','under_review')", [updatedAt, payment.id]);
  if (!claim.meta?.changes) return badRequest("payment_not_reviewable", "Payment is not reviewable.");
  let ledgerEntryId = null;
  let subscriptionId = null;
  const statements = [];

  if (payment.purpose === "add_funds") {
    const amountMinor = approvalCreditAmountMinor;
    const currency = body?.creditCurrency || "USD";
    const account = await first(env, "SELECT * FROM credit_accounts WHERE userId = ?", [payment.userId]) || { id: creditAccountId(payment.userId), userId: payment.userId, currency, balanceMinor: 0, updatedAt };
    ledgerEntryId = crypto.randomUUID();
    statements.push(...creditBatchStatements(env, {
      account,
      userId: payment.userId,
      amountMinor,
      currency,
      reason: body?.reason || `Manual payment ${payment.referenceCode}`,
      sourceType: "manual_payment",
      sourceId: payment.id,
      idempotencyKey: body?.idempotencyKey || null,
      adminEmail,
      createdAt: updatedAt,
      ledgerId: ledgerEntryId
    }));
  }

  if (payment.purpose === "upgrade_plan" && payment.planSlug) {
    const current = await first(env, "SELECT * FROM subscriptions WHERE userId = ? AND status = 'active' ORDER BY createdAt DESC LIMIT 1", [payment.userId]);
    subscriptionId = current?.id || crypto.randomUUID();
    if (current) {
      statements.push(env.DB.prepare("UPDATE subscriptions SET planSlug = ?, updatedAt = ? WHERE id = ?").bind(payment.planSlug, updatedAt, current.id));
    } else {
      statements.push(env.DB.prepare("INSERT INTO subscriptions (id, userId, planSlug, status, autoRenew, startedAt, createdAt, updatedAt) VALUES (?, ?, ?, 'active', 0, ?, ?, ?)").bind(subscriptionId, payment.userId, payment.planSlug, updatedAt, updatedAt, updatedAt));
    }
    statements.push(env.DB.prepare("UPDATE users SET planSlug = ?, updatedAt = ? WHERE id = ?").bind(payment.planSlug, updatedAt, payment.userId));
  }

  statements.unshift(env.DB.prepare("UPDATE manual_payments SET status = 'approved', approvedAt = ?, approvedByAdminEmail = ?, updatedAt = ? WHERE id = ? AND status = 'approving'").bind(updatedAt, adminEmail, updatedAt, payment.id));
  statements.push(env.DB.prepare("INSERT INTO admin_audit_events (id, actorEmail, action, targetType, targetId, summary, metadata, idempotencyKey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
    crypto.randomUUID(),
    adminEmail,
    "payment.approve",
    "payment",
    payment.id,
    `Approved ${formatCurrencyMinor(payment.amountMinor, payment.currency)} payment ${payment.referenceCode}`,
    JSON.stringify({ ledgerEntryId, subscriptionId, purpose: payment.purpose }),
    body?.idempotencyKey || null,
    updatedAt
  ));
  await env.DB.batch(statements);
  await invalidateAdminCache(env);

  return { status: 200, body: (await getPaymentDetail(env, paymentId)).payment };
}

export async function rejectPayment(env, paymentId, body, adminSession) {
  if (!body?.reason) return badRequest("reason_required", "Rejection reason is required.");
  const payment = await first(env, "SELECT * FROM manual_payments WHERE id = ?", [paymentId]);
  if (!payment) return notFound("Payment not found.");
  if (!REVIEWABLE_PAYMENT_STATUSES.includes(payment.status)) return badRequest("payment_not_reviewable", "Payment is not reviewable.");

  const adminEmail = adminSession?.email || "admin";
  const updatedAt = nowIso();
  const transition = await run(env, "UPDATE manual_payments SET status = 'rejected', rejectedAt = ?, rejectedByAdminEmail = ?, rejectionReason = ?, updatedAt = ? WHERE id = ? AND status IN ('submitted','under_review')", [updatedAt, adminEmail, body.reason, updatedAt, payment.id]);
  if (!transition.meta?.changes) return badRequest("payment_not_reviewable", "Payment is not reviewable.");
  await writeAdminAuditEvent(env, {
    actorEmail: adminEmail,
    action: "payment.reject",
    targetType: "payment",
    targetId: payment.id,
    summary: `Rejected payment ${payment.referenceCode}`,
    idempotencyKey: body?.idempotencyKey || null,
    metadata: { reason: body.reason }
  });
  await invalidateAdminCache(env);
  return { status: 200, body: (await getPaymentDetail(env, paymentId)).payment };
}

export async function addPaygCredit(env, userId, body, adminSession) {
  const amountMinor = Number(body?.amountMinor || 0);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return badRequest("amount_required", "Positive integer amountMinor is required.");
  if (!body?.reason) return badRequest("reason_required", "Reason is required.");
  const user = await first(env, "SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return notFound("User not found.");

  const result = await applyCredit(env, {
    userId,
    amountMinor,
    currency: body.currency || "USD",
    reason: body.reason,
    sourceType: "admin_adjustment",
    sourceId: body.idempotencyKey || crypto.randomUUID(),
    idempotencyKey: body.idempotencyKey || null,
    adminEmail: adminSession?.email || "admin"
  });
  const balance = await first(env, "SELECT * FROM credit_accounts WHERE userId = ?", [userId]);
  await writeAdminAuditEvent(env, {
    actorEmail: adminSession?.email || "admin",
    action: "credit.adjust",
    targetType: "user",
    targetId: userId,
    summary: `Adjusted PayG credit by ${formatCurrencyMinor(amountMinor, body.currency || "USD")}`,
    idempotencyKey: body.idempotencyKey || null,
    metadata: { ledgerEntryId: result.ledgerEntryId, reason: body.reason }
  });
  await invalidateAdminCache(env);
  return { status: 200, body: { userId, updatedBalanceDisplay: formatCurrencyMinor(balance?.balanceMinor || 0, balance?.currency || body.currency || "USD"), ledgerEntryId: result.ledgerEntryId } };
}

export async function changeSubscription(env, userId, body, adminSession) {
  if (!body?.targetPlanSlug) return badRequest("plan_required", "targetPlanSlug is required.");
  if (!body?.reason) return badRequest("reason_required", "Reason is required.");
  const user = await first(env, "SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return notFound("User not found.");
  const plan = await first(env, "SELECT * FROM plans WHERE slug = ? AND active = 1", [body.targetPlanSlug]);
  if (!plan) return badRequest("invalid_plan", "Target plan is not active.");

  const changed = await upsertSubscription(env, { userId, planSlug: body.targetPlanSlug });
  const effectiveAt = nowIso();
  await run(env, "UPDATE users SET planSlug = ?, updatedAt = ? WHERE id = ?", [body.targetPlanSlug, effectiveAt, userId]);
  await writeAdminAuditEvent(env, {
    actorEmail: adminSession?.email || "admin",
    action: "subscription.change",
    targetType: "user",
    targetId: userId,
    summary: `Changed subscription from ${changed.previousPlanSlug || user.planSlug || "none"} to ${body.targetPlanSlug}`,
    idempotencyKey: body.idempotencyKey || null,
    metadata: { reason: body.reason, effective: body.effective || "immediate" }
  });
  await invalidateAdminCache(env);
  return { status: 200, body: { userId, previousPlanSlug: changed.previousPlanSlug || user.planSlug || null, currentPlanSlug: body.targetPlanSlug, effectiveAt, subscriptionId: changed.subscriptionId } };
}
