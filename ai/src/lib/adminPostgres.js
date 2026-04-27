import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import { v4 as uuidv4 } from "uuid";

let sqlClient = null;
let adminSchemaReadyPromise = null;
const FAR_FUTURE_WINDOW_END = "2099-12-31T23:59:59.000Z";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for admin PostgreSQL access.");
  }

  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }

  return sqlClient;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatPrice(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `$${Number(value).toFixed(2)} / 1M`;
}

function parsePriceToNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/([\d.]+)/);
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
}

function parseLatencyToMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) {
      const num = Number(match[1]);
      if (Number.isFinite(num)) return num;
    }
  }
  return 0;
}

function parseContextWindow(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    const match = lower.match(/^([\d.]+)\s*(k|m)?$/);
    if (match) {
      let num = Number(match[1]);
      if (Number.isFinite(num)) {
        if (match[2] === "k") num *= 1000;
        if (match[2] === "m") num *= 1000000;
        return num;
      }
    }
  }
  return 0;
}

function formatCurrencyMinor(amountMinor = 0, currency = "IDR") {
  const divisor = currency === "USD" ? 100 : 1;
  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(safeNumber(amountMinor) / divisor);
}

function formatUsd(value = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(safeNumber(value));
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function encodeCursor(row) {
  if (!row?.id || !row?.createdAt) return null;
  return Buffer.from(
    JSON.stringify({
      id: row.id,
      createdAt: toIso(row.createdAt),
    }),
  ).toString("base64url");
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    if (!parsed?.id || !parsed?.createdAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function limitFromRequest(request, defaultLimit = 50, maxLimit = 100) {
  const value = Number(new URL(request.url).searchParams.get("limit") || defaultLimit);
  if (!Number.isFinite(value) || value <= 0) return defaultLimit;
  return Math.min(Math.floor(value), maxLimit);
}

function queryParam(request, name) {
  return new URL(request.url).searchParams.get(name);
}

function nowIso() {
  return new Date().toISOString();
}

function getPlanWindowEnd(plan, startAt) {
  const windowHours = safeNumber(plan?.windowHours);
  if (windowHours > 0) {
    return new Date(new Date(startAt).getTime() + windowHours * 60 * 60 * 1000).toISOString();
  }

  return FAR_FUTURE_WINDOW_END;
}

async function query(text, params = []) {
  return getSql().query(text, params);
}

async function first(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function writeAdminAuditEvent({ actorAdminEmail, action, targetType, targetId, summary, metadata = null, createdAt = nowIso() }) {
  await ensureAdminSchema();
  await query(
    `
      INSERT INTO "AdminAuditEvent" ("id", "actorAdminEmail", "action", "targetType", "targetId", "summary", "metadataJson", "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      crypto.randomUUID(),
      actorAdminEmail,
      action,
      targetType,
      targetId,
      summary,
      metadata ? JSON.stringify(metadata) : null,
      createdAt,
    ],
  );
}

async function getCurrentPlanQuotaWindow(userId, planSlug, updatedAt = nowIso()) {
  if (!userId || !planSlug) return null;

  return first(`
    SELECT
      qw.*,
      ps."id" AS "subscriptionId"
    FROM "QuotaWindow" qw
    JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE
      ps."userId" = $1
      AND pc."slug" = $2
      AND qw."planSlug" = $2
      AND qw."status" = 'active'
      AND (qw."windowEnd" IS NULL OR qw."windowEnd" > $3::timestamp)
    ORDER BY qw."updatedAt" DESC
    LIMIT 1
  `, [userId, planSlug, updatedAt]);
}

async function ensurePlanQuotaWindow(userId, planSlug, updatedAt = nowIso()) {
  if (!userId || !planSlug || planSlug === "payg") return null;

  const plan = await findPlanBySlug(planSlug);
  const includedCreditUsd = safeNumber(plan?.includedCreditUsd);
  if (!plan || includedCreditUsd <= 0) return null;

  // Collapse duplicate / rolled-over active windows for this (user, plan) down
  // to at most one row. We keep the newest active row and expire the rest; the
  // kept row is also expired if it has already rolled past its windowEnd, so
  // the INSERT below can produce a single fresh active row. This guarantees
  // the partial unique index "QuotaWindow_subscription_active_uniq" is upheld.
  await query(`
    UPDATE "QuotaWindow"
    SET "status" = 'expired', "updatedAt" = $2
    WHERE
      "id" IN (
        SELECT t."id"
        FROM (
          SELECT
            qw."id",
            qw."windowEnd",
            ROW_NUMBER() OVER (
              PARTITION BY ps."userId", pc."slug"
              ORDER BY qw."updatedAt" DESC
            ) AS rn
          FROM "QuotaWindow" qw
          JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
          JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
          WHERE
            ps."userId" = $1
            AND pc."slug" = $3
            AND qw."planSlug" = $3
            AND qw."status" = 'active'
        ) t
        WHERE t.rn > 1
           OR (t."windowEnd" IS NOT NULL AND t."windowEnd" <= $2::timestamp)
      )
  `, [userId, updatedAt, planSlug]);

  // Also expire any active window that is still pinned to this user's
  // subscription under a *different* plan slug (e.g. the user just upgraded
  // Free → Pro on the same PlanSubscription row, leaving a stale Free window
  // active). Without this, the partial unique index blocks a fresh Pro window
  // from being inserted and /settings/usage keeps showing the old $2/$2 meter.
  await query(`
    UPDATE "QuotaWindow"
    SET "status" = 'expired', "updatedAt" = $2
    WHERE "id" IN (
      SELECT qw."id"
      FROM "QuotaWindow" qw
      JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
      JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
      WHERE
        ps."userId" = $1
        AND pc."slug" = $3
        AND qw."planSlug" <> $3
        AND qw."status" = 'active'
    )
  `, [userId, updatedAt, planSlug]);

  const existing = await getCurrentPlanQuotaWindow(userId, planSlug, updatedAt);
  if (existing) return existing;

  const subscription = await first(`
    SELECT ps."id"
    FROM "PlanSubscription" ps
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE ps."userId" = $1 AND pc."slug" = $2
    ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
    LIMIT 1
  `, [userId, planSlug]);
  if (!subscription?.id) return null;

  const quotaId = crypto.randomUUID();
  // Insert with a far-future windowEnd as a "timer pending" sentinel. The real
  // countdown is started by dbConsumeUserCredit on the user's first charge so
  // an idle user doesn't burn through their window before they ever use it.
  const [created] = await query(`
    INSERT INTO "QuotaWindow" ("id", "subscriptionId", "planSlug", "windowStart", "windowEnd", "includedCreditUsd", "consumedCreditUsd", "remainingCreditUsd", "status", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6, 0, $6, 'active', $4, $4)
    ON CONFLICT ("subscriptionId") WHERE "status" = 'active' DO NOTHING
    RETURNING *
  `, [quotaId, subscription.id, planSlug, updatedAt, FAR_FUTURE_WINDOW_END, includedCreditUsd]);

  if (created) return created;

  return first(`
    SELECT *
    FROM "QuotaWindow"
    WHERE "subscriptionId" = $1 AND "status" = 'active'
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `, [subscription.id]);
}

async function ensureAdminSchema() {
  if (!adminSchemaReadyPromise) {
    adminSchemaReadyPromise = query(`
      CREATE TABLE IF NOT EXISTS "AdminUserState" (
        "userId" text PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
        "isBanned" boolean NOT NULL DEFAULT false,
        "banReason" text,
        "bannedAt" timestamp without time zone,
        "deletedAt" timestamp without time zone,
        "deleteReason" text,
        "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
      )
    `);
  }

  await adminSchemaReadyPromise;
  await query(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL DEFAULT false,
      "image" text,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "Session" (
      "id" text PRIMARY KEY,
      "expiresAt" timestamp without time zone NOT NULL,
      "token" text NOT NULL UNIQUE,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "Account" (
      "id" text PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "accessTokenExpiresAt" timestamp without time zone,
      "refreshTokenExpiresAt" timestamp without time zone,
      "scope" text,
      "idToken" text,
      "password" text,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Account_providerId_accountId_key"
    ON "Account" ("providerId", "accountId")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "Account_userId_idx"
    ON "Account" ("userId")
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "Profile" (
      "userId" text PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "username" text,
      "avatarUrl" text,
      "company" text,
      "timezone" text,
      "bio" text,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "DeletedUserEmail" (
      "normalizedEmail" text PRIMARY KEY,
      "originalEmail" text NOT NULL,
      "deletedUserId" text NOT NULL,
      "reason" text,
      "deletedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "AdminAuditEvent" (
      "id" text PRIMARY KEY,
      "actorAdminEmail" text NOT NULL,
      "action" text NOT NULL,
      "targetType" text NOT NULL,
      "targetId" text NOT NULL,
      "summary" text NOT NULL,
      "metadataJson" text,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "AdminAuditEvent_createdAt_id_idx"
    ON "AdminAuditEvent" ("createdAt" DESC, "id" DESC)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "DeletedUserEmail_deletedAt_idx"
    ON "DeletedUserEmail" ("deletedAt" DESC, "deletedUserId")
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "BillingManualDestination" (
      "id" text PRIMARY KEY,
      "provider" text NOT NULL,
      "displayName" text NOT NULL,
      "accountNumber" text NOT NULL,
      "accountHolderName" text NOT NULL,
      "instructions" text NOT NULL DEFAULT '',
      "isActive" boolean NOT NULL DEFAULT true,
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE "BillingManualDestination"
    ADD COLUMN IF NOT EXISTS "accountHolderName" text NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE "BillingManualDestination"
    ADD COLUMN IF NOT EXISTS "instructions" text NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE "BillingManualDestination"
    ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
  `);
  await query(`
    ALTER TABLE "BillingManualDestination"
    ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "BillingManualPayment" (
      "id" text PRIMARY KEY,
      "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "purpose" text NOT NULL,
      "status" text NOT NULL,
      "planSlug" text,
      "amountMinor" integer NOT NULL,
      "currency" text NOT NULL DEFAULT 'IDR',
      "referenceCode" text NOT NULL UNIQUE,
      "destinationId" text REFERENCES "BillingManualDestination"("id") ON DELETE SET NULL,
      "senderName" text,
      "senderReference" text,
      "notes" text,
      "submittedAt" timestamp without time zone,
      "transferredAt" timestamp without time zone,
      "approvedAt" timestamp without time zone,
      "approvedByAdminEmail" text,
      "rejectedAt" timestamp without time zone,
      "rejectedByAdminEmail" text,
      "rejectionReason" text,
      "expiresAt" timestamp without time zone,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "destinationId" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "senderName" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "senderReference" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "notes" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "submittedAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "transferredAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "approvedAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "approvedByAdminEmail" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "rejectedAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "rejectedByAdminEmail" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "rejectionReason" text
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "expiresAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
  `);
  await query(`
    ALTER TABLE "BillingManualPayment"
    ALTER COLUMN "planSlug" DROP NOT NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "BillingManualPayment_createdAt_id_idx"
    ON "BillingManualPayment" ("createdAt" DESC, "id" DESC)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "BillingManualPayment_status_idx"
    ON "BillingManualPayment" ("status", "createdAt" DESC)
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS "ModelCatalog" (
      "id" text PRIMARY KEY,
      "slug" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "provider" text NOT NULL,
      "providerCode" text NOT NULL,
      "modelId" text NOT NULL UNIQUE,
      "summary" text NOT NULL DEFAULT '',
      "contextWindow" integer,
      "inputPriceUsdPer1M" double precision,
      "outputPriceUsdPer1M" double precision,
      "latencyMs" integer,
      "category" text NOT NULL DEFAULT 'general',
      "isActive" boolean NOT NULL DEFAULT true,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "providerCode" text NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "summary" text NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "contextWindow" integer
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "inputPriceUsdPer1M" double precision
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "outputPriceUsdPer1M" double precision
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "latencyMs" integer
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT 'general'
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "sortOrder" integer NOT NULL DEFAULT 0
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "createdAt" timestamp without time zone NOT NULL DEFAULT NOW()
  `);
  await query(`
    ALTER TABLE "ModelCatalog"
    ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ModelCatalog_slug_key"
    ON "ModelCatalog" ("slug")
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ModelCatalog_modelId_key"
    ON "ModelCatalog" ("modelId")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "ModelCatalog_sortOrder_name_idx"
    ON "ModelCatalog" ("sortOrder" ASC, "name" ASC)
  `);

  // ApiKey table (shared between local-mode and admin dashboard)
  await query(`
    CREATE TABLE IF NOT EXISTS "ApiKey" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL DEFAULT '',
      "label" text,
      "key" text UNIQUE,
      "keyHash" text,
      "maskedKey" text,
      "machineId" text,
      "userId" text,
      "usageMode" text,
      "isActive" boolean NOT NULL DEFAULT true,
      "status" text,
      "revokedAt" timestamp without time zone,
      "lastUsedAt" timestamp without time zone,
      "createdAt" timestamp without time zone NOT NULL DEFAULT NOW(),
      "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "name" text NOT NULL DEFAULT ''
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "label" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "key" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "keyHash" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "maskedKey" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "machineId" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "usageMode" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "status" text
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "revokedAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "lastUsedAt" timestamp without time zone
  `);
  await query(`
    ALTER TABLE "ApiKey"
    ADD COLUMN IF NOT EXISTS "updatedAt" timestamp without time zone NOT NULL DEFAULT NOW()
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "ApiKey_key_idx"
    ON "ApiKey" ("key")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "ApiKey_machineId_idx"
    ON "ApiKey" ("machineId")
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx"
    ON "ApiKey" ("userId")
  `);

  // QuotaWindow invariant: at most one row with status='active' per subscription.
  // Older builds could leave duplicate active rows behind, which made the usage
  // meter on /settings/usage flicker between rows. Collapse any pre-existing
  // duplicates (keep the newest active row per subscription, expire the rest)
  // before installing the partial unique index that prevents future drift.
  // The QuotaWindow table is owned by another schema migration, so silence
  // failures here in case it isn't provisioned yet (e.g. fresh dev DB).
  try {
    await query(`
      UPDATE "QuotaWindow"
      SET "status" = 'expired'
      WHERE "id" IN (
        SELECT t."id" FROM (
          SELECT
            "id",
            ROW_NUMBER() OVER (
              PARTITION BY "subscriptionId"
              ORDER BY "updatedAt" DESC
            ) AS rn
          FROM "QuotaWindow"
          WHERE "status" = 'active'
        ) t
        WHERE t.rn > 1
      )
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QuotaWindow_subscription_active_uniq"
      ON "QuotaWindow" ("subscriptionId")
      WHERE "status" = 'active'
    `);
  } catch (error) {
    // Table not yet created or owned by another schema; safe to skip — the
    // invariant is also enforced in application code (ensurePlanQuotaWindow).
    console.warn("[adminPostgres] QuotaWindow dedupe/index skipped:", error?.message || error);
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function dbEnsureAuthUserSignupQuota(userId, updatedAt = nowIso()) {
  // Seed every new user with the Free plan's quota straight from PlanCatalog
  // (currently $2 per 24h). If the catalog row is missing or has $0 included
  // credit there is nothing meaningful to seed, so bail out.
  const freePlan = await first(`SELECT * FROM "PlanCatalog" WHERE "slug" = 'free' LIMIT 1`);
  const startingCreditUsd = safeNumber(freePlan?.includedCreditUsd);
  if (!freePlan || startingCreditUsd <= 0) return;

  const existingQuota = await first(`
    SELECT qw."id"
    FROM "QuotaWindow" qw
    JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
    WHERE ps."userId" = $1
    ORDER BY CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END, qw."updatedAt" DESC
    LIMIT 1
  `, [userId]);
  if (existingQuota) return;

  const existingFreeSubscription = await first(`
    SELECT ps.*
    FROM "PlanSubscription" ps
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE ps."userId" = $1 AND pc."slug" = 'free'
    ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
    LIMIT 1
  `, [userId]);

  const subscriptionId = existingFreeSubscription?.id || crypto.randomUUID();
  if (existingFreeSubscription) {
    await query(`
      UPDATE "PlanSubscription"
      SET "status" = 'active', "updatedAt" = $2, "endsAt" = NULL
      WHERE "id" = $1
    `, [subscriptionId, updatedAt]);
  } else {
    await query(`
      INSERT INTO "PlanSubscription" ("id", "userId", "planId", "status", "autoRenew", "startsAt", "renewsAt", "endsAt", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'active', false, $4, NULL, NULL, $4, $4)
    `, [subscriptionId, userId, freePlan.id, updatedAt]);
  }

  // See comment in ensurePlanQuotaWindow: windowEnd starts as a far-future
  // sentinel and is rewritten to (now + windowHours) on the user's first charge.
  const [createdQuota] = await query(`
    INSERT INTO "QuotaWindow" ("id", "subscriptionId", "planSlug", "windowStart", "windowEnd", "includedCreditUsd", "consumedCreditUsd", "remainingCreditUsd", "status", "createdAt", "updatedAt")
    VALUES ($1, $2, 'free', $3, $4, $5, 0, $5, 'active', $3, $3)
    ON CONFLICT ("subscriptionId") WHERE "status" = 'active' DO NOTHING
    RETURNING "id"
  `, [crypto.randomUUID(), subscriptionId, updatedAt, FAR_FUTURE_WINDOW_END, startingCreditUsd]);

  if (createdQuota) return;

  // Another concurrent signup/bootstrap path already created the active quota.
  return;
}

async function ensureDefaultManualDestination() {
  await ensureAdminSchema();
  const updatedAt = nowIso();
  // Keep the legacy ID stable so existing payment rows still resolve the active destination.
  const destinationId = "dest_manual_gopay_dwipa";
  const accountNumber = "087889640714";
  const instructions = "Scan the QRIS image, pay the exact amount, then confirm it through WhatsApp for manual approval.";

  await query(
    `
      INSERT INTO "BillingManualDestination" (
        "id", "provider", "displayName", "accountNumber", "accountHolderName", "instructions", "isActive", "updatedAt"
      )
      VALUES ($1, 'qris', 'QRIS', $2, 'Dwipa', $3, true, $4)
      ON CONFLICT ("id") DO UPDATE SET
        "provider" = EXCLUDED."provider",
        "displayName" = EXCLUDED."displayName",
        "accountNumber" = EXCLUDED."accountNumber",
        "accountHolderName" = EXCLUDED."accountHolderName",
        "instructions" = EXCLUDED."instructions",
        "isActive" = EXCLUDED."isActive",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    [destinationId, accountNumber, instructions, updatedAt],
  );

  return first(`SELECT * FROM "BillingManualDestination" WHERE "id" = $1`, [destinationId]);
}

async function getDeletedEmailReservation(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  return first(`SELECT * FROM "DeletedUserEmail" WHERE "normalizedEmail" = $1`, [normalizedEmail]);
}

export async function dbIsDeletedUserEmailReserved(email) {
  await ensureAdminSchema();
  return Boolean(await getDeletedEmailReservation(email));
}

export async function dbGetAuthUserByEmail(email) {
  await ensureAdminSchema();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const baseUser = await first(`
    SELECT u."id"
    FROM "User" u
    LEFT JOIN "AdminUserState" aus ON aus."userId" = u."id"
    WHERE u."email" = $1 AND aus."deletedAt" IS NULL
    LIMIT 1
  `, [normalizedEmail]);
  if (!baseUser?.id) return null;

  const currentPlan = await first(`
    SELECT pc."slug"
    FROM "PlanSubscription" ps
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE ps."userId" = $1
    ORDER BY
      CASE WHEN pc."slug" = 'payg' THEN 1 ELSE 0 END,
      CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END,
      ps."updatedAt" DESC
    LIMIT 1
  `, [baseUser.id]);

  if (currentPlan?.slug && currentPlan.slug !== "payg") {
    await ensurePlanQuotaWindow(baseUser.id, currentPlan.slug);
  }

  return first(`
    SELECT
      u."id",
      u."name",
      u."email",
      u."emailVerified",
      u."createdAt",
      u."updatedAt",
      p."username",
      p."avatarUrl",
      p."company",
      p."timezone",
      p."bio",
      a."password" AS "passwordHash",
      COALESCE(primary_plan."slug", payg_plan."slug", latest_quota."planSlug", 'free') AS "planSlug",
      COALESCE(payg_quota."remainingCreditUsd", primary_plan_quota."remainingCreditUsd", latest_quota."remainingCreditUsd", 0) AS "creditBalanceUsd"
    FROM "User" u
    LEFT JOIN "AdminUserState" aus ON aus."userId" = u."id"
    LEFT JOIN "Profile" p ON p."userId" = u."id"
    LEFT JOIN "Account" a ON a."userId" = u."id" AND a."providerId" = 'credentials' AND a."accountId" = u."email"
    LEFT JOIN LATERAL (
      SELECT ps.*, pc."slug"
      FROM "PlanSubscription" ps
      JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
      WHERE ps."userId" = u."id"
      ORDER BY
        CASE WHEN pc."slug" = 'payg' THEN 1 ELSE 0 END,
        CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END,
        ps."updatedAt" DESC
      LIMIT 1
    ) primary_plan ON TRUE
    LEFT JOIN LATERAL (
      SELECT pc."slug", ps."id"
      FROM "PlanSubscription" ps
      JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
      WHERE ps."userId" = u."id" AND pc."slug" = 'payg'
      ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
      LIMIT 1
    ) payg_plan ON TRUE
    LEFT JOIN LATERAL (
      SELECT qw."remainingCreditUsd"
      FROM "QuotaWindow" qw
      WHERE payg_plan."id" IS NOT NULL AND qw."subscriptionId" = payg_plan."id"
      ORDER BY CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END, qw."updatedAt" DESC
      LIMIT 1
    ) payg_quota ON TRUE
    LEFT JOIN LATERAL (
      SELECT qw."remainingCreditUsd"
      FROM "QuotaWindow" qw
      WHERE primary_plan."id" IS NOT NULL AND qw."subscriptionId" = primary_plan."id"
      ORDER BY CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END, qw."updatedAt" DESC
      LIMIT 1
    ) primary_plan_quota ON TRUE
    LEFT JOIN LATERAL (
      SELECT qw."planSlug", qw."remainingCreditUsd"
      FROM "QuotaWindow" qw
      JOIN "PlanSubscription" qps ON qps."id" = qw."subscriptionId"
      WHERE qps."userId" = u."id"
      ORDER BY
        CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END,
        qw."updatedAt" DESC
      LIMIT 1
    ) latest_quota ON TRUE
    WHERE u."email" = $1 AND aus."deletedAt" IS NULL
    LIMIT 1
  `, [normalizedEmail]);
}

export async function dbCreateAuthUser({
  email,
  fullName,
  passwordHash = null,
  emailVerified = true,
  image = null,
  username = null,
  company = null,
  timezone = "Asia/Makassar",
  bio = null,
  avatarUrl = null,
}) {
  await ensureAdminSchema();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const name = String(fullName || normalizedEmail.split("@")[0] || "dwipa").trim();
  const now = nowIso();
  const existing = await first(`SELECT * FROM "User" WHERE "email" = $1`, [normalizedEmail]);
  const userId = existing?.id || crypto.randomUUID();
  const isNewUser = !existing;

  if (!existing) {
    await query(
      `
        INSERT INTO "User" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $6)
      `,
      [userId, name, normalizedEmail, emailVerified, image, now],
    );
  } else {
    await query(
      `
        UPDATE "User"
        SET "name" = $2, "emailVerified" = $3, "image" = $4, "updatedAt" = $5
        WHERE "id" = $1
      `,
      [userId, name, emailVerified, image, now],
    );
  }

  await query(
    `
      INSERT INTO "Profile" ("userId", "username", "avatarUrl", "company", "timezone", "bio", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT ("userId") DO UPDATE SET
        "username" = EXCLUDED."username",
        "avatarUrl" = EXCLUDED."avatarUrl",
        "company" = EXCLUDED."company",
        "timezone" = EXCLUDED."timezone",
        "bio" = EXCLUDED."bio",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    [userId, username || normalizedEmail.split("@")[0] || "dwipa", avatarUrl, company, timezone, bio, now],
  );

  if (passwordHash) {
    await query(
      `
        INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
        VALUES ($1, $2, 'credentials', $3, $4, $5, $5)
        ON CONFLICT ("providerId", "accountId") DO UPDATE SET
          "userId" = EXCLUDED."userId",
          "password" = EXCLUDED."password",
          "updatedAt" = EXCLUDED."updatedAt"
      `,
      [existing ? `acct_${userId}` : crypto.randomUUID(), normalizedEmail, userId, passwordHash, now],
    );
  }

  if (isNewUser) {
    await dbEnsureAuthUserSignupQuota(userId, now);
  }

  return dbGetAuthUserByEmail(normalizedEmail);
}

export async function dbEnsureAdminUserMirror(user) {
  await ensureAdminSchema();
  if (!user?.id || !user?.email) {
    throw new Error("User id and email are required.");
  }

  const email = normalizeEmail(user.email);
  const now = nowIso();
  const createdAt = toIso(user.createdAt) || now;
  const updatedAt = toIso(user.updatedAt) || now;
  const name = String(user.fullName || user.name || email.split("@")[0] || "dwipa").trim();

  await query(
    `
      INSERT INTO "User" ("id", "email", "name", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("id") DO UPDATE SET
        "email" = EXCLUDED."email",
        "name" = EXCLUDED."name",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    [user.id, email, name, createdAt, updatedAt],
  );

  const profile = {
    username: typeof user.username === "string" ? user.username : email.split("@")[0] || "dwipa",
    company: user.company ?? null,
    timezone: user.timezone ?? "Asia/Makassar",
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };

  await query(
    `
      INSERT INTO "Profile" ("userId", "username", "company", "timezone", "bio", "avatarUrl")
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT ("userId") DO UPDATE SET
        "username" = EXCLUDED."username",
        "company" = EXCLUDED."company",
        "timezone" = EXCLUDED."timezone",
        "bio" = EXCLUDED."bio",
        "avatarUrl" = EXCLUDED."avatarUrl"
    `,
    [user.id, profile.username, profile.company, profile.timezone, profile.bio, profile.avatarUrl],
  );

  return first(`SELECT * FROM "User" WHERE "id" = $1`, [user.id]);
}

async function reserveDeletedEmail({ userId, email, reason, deletedAt }) {
  const normalizedEmail = normalizeEmail(email);
  await query(
    `
      INSERT INTO "DeletedUserEmail" ("normalizedEmail", "originalEmail", "deletedUserId", "reason", "deletedAt")
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT ("normalizedEmail") DO UPDATE SET
        "originalEmail" = EXCLUDED."originalEmail",
        "deletedUserId" = EXCLUDED."deletedUserId",
        "reason" = EXCLUDED."reason",
        "deletedAt" = EXCLUDED."deletedAt"
    `,
    [normalizedEmail, email, userId, reason || null, deletedAt],
  );
}

function planPriceLabel(plan) {
  if (safeNumber(plan.priceMinor) > 0) {
    return formatCurrencyMinor(plan.priceMinor, plan.priceCurrency);
  }

  if (plan.billingType === "usage") return "Usage based";
  if (plan.billingType === "quota") return formatCurrencyMinor(plan.priceMinor, plan.priceCurrency);
  return formatCurrencyMinor(plan.priceMinor, plan.priceCurrency);
}

function planWindowLabel(plan) {
  if (plan.periodLabel?.startsWith("/")) return plan.periodLabel;
  if (safeNumber(plan.windowHours) > 0) return `/ ${plan.windowHours}h`;
  return null;
}

function mapPlan(plan, entitlements = []) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    billingType: plan.billingType,
    includedCreditUsd: safeNumber(plan.includedCreditUsd),
    windowHours: plan.windowHours === null ? null : safeNumber(plan.windowHours),
    discountPercent: safeNumber(plan.discountPercent),
    priceLabel: planPriceLabel(plan),
    periodLabel: planWindowLabel(plan),
    description: plan.description,
    ctaLabel: plan.ctaLabel,
    highlighted: Boolean(plan.highlighted),
    active: Boolean(plan.isActive),
    visible: Boolean(plan.isActive),
    entitlements: entitlements.map((item) => ({
      label: item.label,
      value: item.value,
    })),
    updatedAt: toIso(plan.updatedAt),
  };
}

function mapModel(model) {
  return {
    id: model.id,
    slug: model.slug,
    name: model.name,
    provider: model.provider,
    providerCode: model.providerCode,
    summary: model.summary || "",
    contextWindow: model.contextWindow ? `${safeNumber(model.contextWindow).toLocaleString("en-US")}` : "",
    inputPrice: formatPrice(model.inputPriceUsdPer1M),
    outputPrice: formatPrice(model.outputPriceUsdPer1M),
    latency: model.latencyMs ? `${safeNumber(model.latencyMs)}ms` : "",
    modelId: model.modelId,
    category: model.category || "general",
    visibility: model.isActive ? "visible" : "hidden",
    accessState: model.isActive ? "enabled" : "disabled",
    allowedPlanSlugs: ["free", "pro", "payg"],
    updatedAt: toIso(model.updatedAt),
  };
}

function mapApiKey(key) {
  return {
    id: key.id,
    label: key.name || key.label,
    maskedKey: key.key ? `${key.key.slice(0, 14)}...` : key.maskedKey,
    usageMode: key.usageMode || "both",
    createdAt: toIso(key.createdAt),
    lastUsedAt: toIso(key.lastUsedAt),
  };
}

function mapUsageRow(row) {
  return {
    id: row.id,
    requestId: row.id,
    userId: row.userId || null,
    userEmail: row.userEmail || null,
    provider: row.provider,
    model: row.model,
    appLabel: null,
    status: row.status,
    costDisplay: formatUsd(row.chargedCostUsd),
    inputTokens: safeNumber(row.inputTokens),
    outputTokens: safeNumber(row.outputTokens),
    latencyMs: row.latencyMs === null ? null : safeNumber(row.latencyMs),
    createdAt: toIso(row.createdAt),
    charge: {
      chargedCostUsd: safeNumber(row.chargedCostUsd),
      countedTowardQuotaUsd: safeNumber(row.countedTowardQuotaUsd),
      planSlug: row.planSlug || null,
    },
  };
}

function mapUserRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    planSlug: row.planSlug || "free",
    status: row.status || "active",
    creditBalanceDisplay: row.creditBalanceDisplay || "$0",
    createdAt: toIso(row.createdAt),
    lastSeenAt: toIso(row.lastSeenAt),
  };
}

async function getPlanEntitlementsMap() {
  const rows = await query(`
    SELECT pe."planId", pe."label", pe."value"
    FROM "PlanEntitlement" pe
    ORDER BY pe."sortOrder" ASC, pe."createdAt" ASC
  `);

  const map = new Map();
  for (const row of rows) {
    const items = map.get(row.planId) || [];
    items.push(row);
    map.set(row.planId, items);
  }
  return map;
}

async function getUserPlanRows(limit = null) {
  await ensureAdminSchema();
  return query(
    `
      SELECT
        u."id",
        u."email",
        u."name",
        u."createdAt",
        u."updatedAt",
        latest_usage."createdAt" AS "lastSeenAt",
        COALESCE(primary_plan."slug", payg_plan."slug", latest_quota."planSlug", 'free') AS "planSlug",
        CASE WHEN aus."isBanned" THEN 'banned' ELSE 'active' END AS "status",
        CASE
          WHEN payg_quota."remainingCreditUsd" IS NOT NULL THEN CONCAT('$', ROUND(payg_quota."remainingCreditUsd"::numeric, 4))
          WHEN latest_quota."remainingCreditUsd" IS NOT NULL THEN CONCAT('$', ROUND(latest_quota."remainingCreditUsd"::numeric, 4))
          ELSE '$0'
        END AS "creditBalanceDisplay"
      FROM "User" u
      LEFT JOIN "AdminUserState" aus ON aus."userId" = u."id"
      LEFT JOIN LATERAL (
        SELECT ur."createdAt"
        FROM "UsageRequest" ur
        WHERE ur."userId" = u."id"
        ORDER BY ur."createdAt" DESC
        LIMIT 1
      ) latest_usage ON TRUE
      LEFT JOIN LATERAL (
        SELECT ps.*, pc."slug"
        FROM "PlanSubscription" ps
        JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
        WHERE ps."userId" = u."id"
        ORDER BY
          CASE WHEN pc."slug" = 'payg' THEN 1 ELSE 0 END,
          CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END,
          ps."updatedAt" DESC
        LIMIT 1
      ) primary_plan ON TRUE
      LEFT JOIN LATERAL (
        SELECT pc."slug", ps."id"
        FROM "PlanSubscription" ps
        JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
        WHERE ps."userId" = u."id" AND pc."slug" = 'payg'
        ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
        LIMIT 1
      ) payg_plan ON TRUE
      LEFT JOIN LATERAL (
        SELECT qw."remainingCreditUsd"
        FROM "QuotaWindow" qw
        WHERE payg_plan."id" IS NOT NULL AND qw."subscriptionId" = payg_plan."id"
        ORDER BY CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END, qw."updatedAt" DESC
        LIMIT 1
      ) payg_quota ON TRUE
      LEFT JOIN LATERAL (
        SELECT qw."planSlug", qw."remainingCreditUsd"
        FROM "QuotaWindow" qw
        JOIN "PlanSubscription" qps ON qps."id" = qw."subscriptionId"
        WHERE qps."userId" = u."id"
        ORDER BY
          CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END,
          qw."updatedAt" DESC
        LIMIT 1
      ) latest_quota ON TRUE
      WHERE aus."deletedAt" IS NULL
      ORDER BY u."createdAt" DESC, u."id" DESC
      ${limit ? `LIMIT ${Number(limit)}` : ""}
    `,
  );
}

export async function dbGetAdminOverview() {
  await ensureAdminSchema();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const [pendingPayments, usersCount, usageToday, approvedRevenueToday, recentPayments, recentUsers, recentRequests, chartRows] = await Promise.all([
    first(`SELECT COUNT(*)::int AS count FROM "BillingManualPayment" WHERE "status" IN ('pending_transfer', 'submitted', 'under_review')`),
    first(`
      SELECT COUNT(*)::int AS count
      FROM "User" u
      LEFT JOIN "AdminUserState" aus ON aus."userId" = u."id"
      WHERE aus."deletedAt" IS NULL
    `),
    first(`
      SELECT
        COUNT(*)::int AS requests,
        COUNT(*) FILTER (WHERE "status" <> 'success')::int AS failed
      FROM "UsageRequest"
      WHERE "createdAt" >= $1
    `, [todayIso]),
    first(`
      SELECT COALESCE(SUM("amountMinor"), 0)::int AS total
      FROM "BillingManualPayment"
      WHERE "status" = 'approved' AND "updatedAt" >= $1
    `, [todayIso]),
    query(`
      SELECT
        p.*,
        u."email" AS "userEmail"
      FROM "BillingManualPayment" p
      JOIN "User" u ON u."id" = p."userId"
      ORDER BY p."createdAt" DESC
      LIMIT 5
    `),
    getUserPlanRows(5),
    query(`
      SELECT
        r.*,
        u."email" AS "userEmail",
        COALESCE(uc."chargedCostUsd", 0) AS "chargedCostUsd",
        COALESCE(uc."countedTowardQuotaUsd", 0) AS "countedTowardQuotaUsd",
        uc."planSlug"
      FROM "UsageRequest" r
      JOIN "User" u ON u."id" = r."userId"
      LEFT JOIN "UsageCharge" uc ON uc."usageRequestId" = r."id"
      ORDER BY r."createdAt" DESC
      LIMIT 5
    `),
    query(`
      SELECT
        TO_CHAR(DATE_TRUNC('day', r."createdAt"), 'YYYY-MM-DD') AS "label",
        COUNT(*)::int AS "requests",
        COALESCE(SUM(COALESCE(uc."chargedCostUsd", 0)), 0) AS "cost",
        COUNT(*) FILTER (WHERE r."status" <> 'success')::int AS "errors"
      FROM "UsageRequest" r
      LEFT JOIN "UsageCharge" uc ON uc."usageRequestId" = r."id"
      WHERE r."createdAt" >= NOW() - INTERVAL '13 days'
      GROUP BY DATE_TRUNC('day', r."createdAt")
      ORDER BY DATE_TRUNC('day', r."createdAt") ASC
    `),
  ]);

  return {
    metrics: [
      { id: "users", label: "Users", value: String(usersCount?.count || 0), description: "Registered accounts in PostgreSQL." },
      { id: "payments", label: "Pending payments", value: String(pendingPayments?.count || 0), description: "Manual payments waiting for review." },
      { id: "requests", label: "Requests today", value: String(usageToday?.requests || 0), description: "Usage requests recorded today." },
      { id: "failed", label: "Failed today", value: String(usageToday?.failed || 0), description: "Failed or rejected requests today." },
      { id: "revenue", label: "Approved revenue", value: formatCurrencyMinor(approvedRevenueToday?.total || 0, "IDR"), description: "Approved manual payment value today." },
    ],
    workQueue: {
      payments: recentPayments.map((row) => ({
        id: row.id,
        userId: row.userId,
        userEmail: row.userEmail,
        purpose: row.purpose,
        status: row.status,
        planSlug: row.planSlug || null,
        amountMinor: safeNumber(row.amountMinor),
        currency: row.currency,
        referenceCode: row.referenceCode,
        senderName: row.senderName || null,
        senderReference: row.senderReference || null,
        submittedAt: toIso(row.submittedAt),
        createdAt: toIso(row.createdAt),
      })),
      users: recentUsers.map(mapUserRow),
      requests: recentRequests.map(mapUsageRow),
    },
    charts: {
      requests: chartRows.map((row) => ({ label: row.label, value: safeNumber(row.requests) })),
      revenue: chartRows.map((row) => ({ label: row.label, value: safeNumber(row.cost) })),
      errors: chartRows.map((row) => ({ label: row.label, value: safeNumber(row.errors) })),
    },
  };
}

export async function dbGetAdminPayments(request) {
  await ensureAdminSchema();
  const limit = limitFromRequest(request);
  const status = queryParam(request, "status");
  const purpose = queryParam(request, "purpose");
  const q = queryParam(request, "q");
  const cursor = decodeCursor(queryParam(request, "cursor"));

  const filters = [];
  const params = [];

  if (status) {
    params.push(status);
    filters.push(`p."status" = $${params.length}`);
  }
  if (purpose) {
    params.push(purpose);
    filters.push(`p."purpose" = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    filters.push(`(LOWER(u."email") LIKE $${params.length} OR LOWER(p."referenceCode") LIKE $${params.length})`);
  }
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    filters.push(`(p."createdAt", p."id") < ($${params.length - 1}::timestamp, $${params.length})`);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const listParams = [...params, limit + 1];
  const rows = await query(`
    SELECT
      p.*,
      u."email" AS "userEmail"
    FROM "BillingManualPayment" p
    JOIN "User" u ON u."id" = p."userId"
    ${whereSql}
    ORDER BY p."createdAt" DESC, p."id" DESC
    LIMIT $${listParams.length}
  `, listParams);

  const summary = await first(`
    SELECT
      COUNT(*) FILTER (WHERE "status" = 'submitted')::int AS "submitted",
      COUNT(*) FILTER (WHERE "status" = 'under_review')::int AS "underReview",
      COUNT(*) FILTER (WHERE "status" = 'pending_transfer')::int AS "pendingTransfer",
      COALESCE(SUM("amountMinor") FILTER (WHERE "status" IN ('pending_transfer', 'submitted', 'under_review')), 0)::int AS "pendingAmountMinor"
    FROM "BillingManualPayment"
  `);

  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    userId: row.userId,
    userEmail: row.userEmail,
    purpose: row.purpose,
    status: row.status,
    planSlug: row.planSlug || null,
    amountMinor: safeNumber(row.amountMinor),
    currency: row.currency,
    referenceCode: row.referenceCode,
    senderName: row.senderName || null,
    senderReference: row.senderReference || null,
    submittedAt: toIso(row.submittedAt),
    createdAt: toIso(row.createdAt),
  }));

  return {
    items,
    nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    summary: {
      submitted: safeNumber(summary?.submitted),
      underReview: safeNumber(summary?.underReview),
      pendingTransfer: safeNumber(summary?.pendingTransfer),
      pendingAmount: formatCurrencyMinor(summary?.pendingAmountMinor, "IDR"),
    },
  };
}

export async function dbCreateManualPayment({ userId, purpose, planSlug = null, amountMinor, currency = "IDR", notes = null }) {
  await ensureAdminSchema();
  const destination = await ensureDefaultManualDestination();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const paymentId = `mp_${crypto.randomUUID()}`;
  const referenceCode = `DWIPA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const [payment] = await query(
    `
      INSERT INTO "BillingManualPayment" (
        "id",
        "userId",
        "purpose",
        "status",
        "planSlug",
        "amountMinor",
        "currency",
        "referenceCode",
        "destinationId",
        "notes",
        "expiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'pending_transfer', $4, $5, $6, $7, $8, $9, $10, $11, $11)
      RETURNING *
    `,
    [
      paymentId,
      userId,
      purpose,
      planSlug,
      amountMinor,
      currency,
      referenceCode,
      destination?.id || null,
      notes,
      expiresAt,
      createdAt,
    ],
  );

  return {
    id: payment.id,
    purpose: payment.purpose,
    status: payment.status,
    planSlug: payment.planSlug || null,
    amountMinor: safeNumber(payment.amountMinor),
    currency: payment.currency,
    referenceCode: payment.referenceCode,
    expiresAt: toIso(payment.expiresAt),
    createdAt: toIso(payment.createdAt),
    destination: destination ? {
      provider: destination.provider,
      displayName: destination.displayName,
      accountNumber: destination.accountNumber,
      accountHolderName: destination.accountHolderName || "",
      instructions: destination.instructions || "",
      isActive: Boolean(destination.isActive),
      updatedAt: toIso(destination.updatedAt),
    } : null,
  };
}

export async function dbGetAdminPayment(paymentId) {
  await ensureAdminSchema();
  const row = await first(`
    SELECT
      p.*,
      u."email" AS "userEmail",
      u."name" AS "userName",
      COALESCE(ps_plan."slug", 'free') AS "userPlanSlug",
      d."provider" AS "destinationProvider",
      d."displayName" AS "destinationDisplayName",
      d."accountNumber" AS "destinationAccountNumber",
      d."accountHolderName" AS "destinationAccountHolderName",
      d."instructions" AS "destinationInstructions",
      d."isActive" AS "destinationIsActive",
      d."updatedAt" AS "destinationUpdatedAt"
    FROM "BillingManualPayment" p
    JOIN "User" u ON u."id" = p."userId"
    LEFT JOIN "BillingManualDestination" d ON d."id" = p."destinationId"
    LEFT JOIN LATERAL (
      SELECT pc."slug"
      FROM "PlanSubscription" ps
      JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
      WHERE ps."userId" = u."id"
      ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
      LIMIT 1
    ) ps_plan ON TRUE
    WHERE p."id" = $1
  `, [paymentId]);

  if (!row) return { payment: null, paymentId };

  return {
    payment: {
      id: row.id,
      userId: row.userId,
      userEmail: row.userEmail,
      purpose: row.purpose,
      status: row.status,
      planSlug: row.planSlug || null,
      amountMinor: safeNumber(row.amountMinor),
      currency: row.currency,
      referenceCode: row.referenceCode,
      senderName: row.senderName || null,
      senderReference: row.senderReference || null,
      submittedAt: toIso(row.submittedAt),
      createdAt: toIso(row.createdAt),
      notes: row.notes || null,
      transferredAt: toIso(row.transferredAt),
      destination: row.destinationProvider ? {
        provider: row.destinationProvider,
        displayName: row.destinationDisplayName,
        accountNumber: row.destinationAccountNumber,
        accountHolderName: row.destinationAccountHolderName || "",
        instructions: row.destinationInstructions || "",
        isActive: Boolean(row.destinationIsActive),
        updatedAt: toIso(row.destinationUpdatedAt),
      } : null,
      user: {
        id: row.userId,
        email: row.userEmail,
        name: row.userName || "",
        planSlug: row.userPlanSlug || "free",
      },
    },
    paymentId,
  };
}

export async function dbApproveAdminPayment(paymentId, actorAdminEmail) {
  await ensureAdminSchema();
  const payment = await first(`
    SELECT *
    FROM "BillingManualPayment"
    WHERE "id" = $1
  `, [paymentId]);
  if (!payment) return null;

  const updatedAt = nowIso();
  const [row] = await query(`
    UPDATE "BillingManualPayment"
    SET "status" = 'approved', "updatedAt" = $2
    WHERE "id" = $1 AND "status" IN ('pending_transfer', 'submitted', 'under_review')
    RETURNING "id", "status", "updatedAt"
  `, [paymentId, updatedAt]);

  if (!row) return null;

  if (payment.purpose === "upgrade_plan" && payment.planSlug) {
    await dbChangeAdminUserSubscription(
      payment.userId,
      {
        targetPlanSlug: payment.planSlug,
        reason: `Approved manual payment ${payment.referenceCode || payment.id}.`,
      },
      actorAdminEmail,
      updatedAt,
    );
  }

  await writeAdminAuditEvent({
    actorAdminEmail,
    action: "payment_approved",
    targetType: "payment",
    targetId: row.id,
    summary: `Approved payment ${row.id}.`,
    metadata: { paymentId: row.id, status: row.status },
    createdAt: updatedAt,
  });
  return {
    paymentId: row.id,
    status: row.status,
    updatedAt: toIso(row.updatedAt),
  };
}

export async function dbRejectAdminPayment(paymentId, body, actorAdminEmail) {
  await ensureAdminSchema();
  const updatedAt = nowIso();
  const [row] = await query(`
    UPDATE "BillingManualPayment"
    SET "status" = 'rejected', "updatedAt" = $2
    WHERE "id" = $1 AND "status" IN ('pending_transfer', 'submitted', 'under_review')
    RETURNING "id", "status", "updatedAt"
  `, [paymentId, updatedAt]);

  if (!row) return null;
  await writeAdminAuditEvent({
    actorAdminEmail,
    action: "payment_rejected",
    targetType: "payment",
    targetId: row.id,
    summary: `Rejected payment ${row.id}.`,
    metadata: { paymentId: row.id, status: row.status, reason: body?.reason || null },
    createdAt: updatedAt,
  });
  return {
    paymentId: row.id,
    status: row.status,
    updatedAt: toIso(row.updatedAt),
  };
}

export async function dbGetAdminUsers(request) {
  await ensureAdminSchema();
  const limit = limitFromRequest(request);
  const q = queryParam(request, "q");
  const plan = queryParam(request, "plan");
  const cursor = decodeCursor(queryParam(request, "cursor"));
  const allRows = await getUserPlanRows();

  const filteredRows = allRows.filter((row) => {
    if (q) {
      const term = q.toLowerCase();
      const matches = row.email.toLowerCase().includes(term) || String(row.name || "").toLowerCase().includes(term);
      if (!matches) return false;
    }
    if (plan && row.planSlug !== plan) return false;
    if (cursor) {
      const createdAt = toIso(row.createdAt);
      if (createdAt > cursor.createdAt) return false;
      if (createdAt === cursor.createdAt && row.id >= cursor.id) return false;
    }
    return true;
  });

  const items = filteredRows.slice(0, limit).map(mapUserRow);
  const summary = {
    totalUsers: allRows.length,
    proUsers: allRows.filter((row) => row.planSlug === "pro").length,
    paygUsers: allRows.filter((row) => row.planSlug === "payg").length,
    freeUsers: allRows.filter((row) => row.planSlug === "free").length,
  };

  return {
    items,
    nextCursor: filteredRows.length > limit ? encodeCursor(filteredRows[limit - 1]) : null,
    summary,
  };
}

export async function dbGetAdminUser(userId) {
  await ensureAdminSchema();
  const user = await first(`
    SELECT
      u.*,
      aus."isBanned",
      aus."deletedAt",
      p."username",
      p."avatarUrl",
      p."company",
      p."timezone",
      p."bio"
    FROM "User" u
    LEFT JOIN "AdminUserState" aus ON aus."userId" = u."id"
    LEFT JOIN "Profile" p ON p."userId" = u."id"
    WHERE u."id" = $1
  `, [userId]);

  if (!user || user.deletedAt) return { user: null, userId };

  const [subscription, quota, paygQuota, apiKeys, usageRows, paymentRows] = await Promise.all([
    first(`
      SELECT
        ps.*,
        pc."slug" AS "planSlug"
      FROM "PlanSubscription" ps
      JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
      WHERE ps."userId" = $1
      ORDER BY CASE WHEN pc."slug" = 'payg' THEN 1 ELSE 0 END, CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
      LIMIT 1
    `, [userId]),
    first(`
      SELECT *
      FROM "QuotaWindow" qw
      JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
      WHERE ps."userId" = $1
      ORDER BY CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END, qw."updatedAt" DESC
      LIMIT 1
    `, [userId]),
    first(`
      SELECT qw.*
      FROM "QuotaWindow" qw
      JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
      JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
      WHERE ps."userId" = $1 AND pc."slug" = 'payg'
      ORDER BY CASE WHEN qw."status" = 'active' THEN 0 ELSE 1 END, qw."updatedAt" DESC
      LIMIT 1
    `, [userId]),
    query(`
      SELECT *
      FROM "ApiKey"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 20
    `, [userId]).then(rows => rows.map(mapApiKey)),
    query(`
      SELECT
        r.*,
        u."email" AS "userEmail",
        COALESCE(uc."chargedCostUsd", 0) AS "chargedCostUsd",
        COALESCE(uc."countedTowardQuotaUsd", 0) AS "countedTowardQuotaUsd",
        uc."planSlug"
      FROM "UsageRequest" r
      JOIN "User" u ON u."id" = r."userId"
      LEFT JOIN "UsageCharge" uc ON uc."usageRequestId" = r."id"
      WHERE r."userId" = $1
      ORDER BY r."createdAt" DESC
      LIMIT 20
    `, [userId]),
    query(`
      SELECT
        p.*,
        u."email" AS "userEmail"
      FROM "BillingManualPayment" p
      JOIN "User" u ON u."id" = p."userId"
      WHERE p."userId" = $1
      ORDER BY p."createdAt" DESC
      LIMIT 20
    `, [userId]),
  ]);

  const usageChart = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') AS "label",
      COUNT(*)::int AS "value"
    FROM "UsageRequest"
    WHERE "userId" = $1 AND "createdAt" >= NOW() - INTERVAL '13 days'
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY DATE_TRUNC('day', "createdAt") ASC
  `, [userId]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name || "",
      planSlug: subscription?.planSlug || quota?.planSlug || "free",
      status: user.isBanned ? "banned" : "active",
      creditBalanceDisplay: paygQuota ? formatUsd(paygQuota.remainingCreditUsd) : quota ? formatUsd(quota.remainingCreditUsd) : "$0",
      createdAt: toIso(user.createdAt),
      lastSeenAt: usageRows[0] ? toIso(usageRows[0].createdAt) : null,
      subscriptionStatus: subscription?.status || "inactive",
      profile: {
        username: user.username || null,
        avatarUrl: user.avatarUrl || null,
        company: user.company || null,
        timezone: user.timezone || null,
        bio: user.bio || null,
      },
      apiKeys,
      usageRequests: usageRows.map(mapUsageRow),
      payments: paymentRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        userEmail: row.userEmail,
        purpose: row.purpose,
        status: row.status,
        planSlug: row.planSlug || null,
        amountMinor: safeNumber(row.amountMinor),
        currency: row.currency,
        referenceCode: row.referenceCode,
        senderName: row.senderName || null,
        senderReference: row.senderReference || null,
        submittedAt: toIso(row.submittedAt),
        createdAt: toIso(row.createdAt),
      })),
      charts: {
        usage: usageChart.map((row) => ({ label: row.label, value: safeNumber(row.value) })),
      },
    },
    userId,
  };
}

export async function dbGetUserPaygCreditBalance(userId) {
  await ensureAdminSchema();
  if (!userId) return 0;

  const paygQuota = await first(`
    SELECT qw."remainingCreditUsd"
    FROM "PlanSubscription" ps
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    LEFT JOIN LATERAL (
      SELECT "remainingCreditUsd"
      FROM "QuotaWindow"
      WHERE "subscriptionId" = ps."id"
      ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "updatedAt" DESC
      LIMIT 1
    ) qw ON TRUE
    WHERE ps."userId" = $1 AND pc."slug" = 'payg'
    ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
    LIMIT 1
  `, [userId]);

  return safeNumber(paygQuota?.remainingCreditUsd);
}

/**
 * Pre-flight check: does `userId` have any quota window with `remainingCreditUsd > 0`
 * that the given `usageMode` is allowed to draw from? Mirrors the WHERE-clauses of
 * `pickActiveQuotaWindow` so the auth gate stays in sync with the deduction path.
 */
export async function dbUserHasRemainingCredit(userId, usageMode = "both") {
  await ensureAdminSchema();
  if (!userId) return false;

  const planClause = (() => {
    if (usageMode === "payg") return "AND pc.\"slug\" = 'payg'";
    if (usageMode === "subscription") return "AND pc.\"slug\" <> 'payg'";
    return "";
  })();

  const row = await first(`
    SELECT 1 AS ok
    FROM "QuotaWindow" qw
    JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE
      ps."userId" = $1
      AND qw."status" = 'active'
      AND (qw."windowEnd" IS NULL OR qw."windowEnd" > $2::timestamp)
      AND qw."remainingCreditUsd" > 0
      ${planClause}
    LIMIT 1
  `, [userId, nowIso()]);

  return Boolean(row);
}

/**
 * Pick the active quota window for `userId` to deduct from, given the API key's `usageMode`.
 * - "payg"          → only the payg window
 * - "subscription"  → only non-payg windows (free/pro)
 * - "both"/null     → non-payg window first; if none has remaining, fall back to payg
 */
async function pickActiveQuotaWindow(userId, usageMode = "both", updatedAt = nowIso()) {
  if (!userId) return null;

  const planClause = (() => {
    if (usageMode === "payg") return "AND pc.\"slug\" = 'payg'";
    if (usageMode === "subscription") return "AND pc.\"slug\" <> 'payg'";
    return "";
  })();

  const orderByPlan = usageMode === "both" || !usageMode
    ? "CASE WHEN pc.\"slug\" = 'payg' THEN 1 ELSE 0 END,"
    : "";

  return first(`
    SELECT qw.*, pc."slug" AS "planSlug", pc."discountPercent" AS "planDiscountPercent", pc."windowHours"
    FROM "QuotaWindow" qw
    JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE
      ps."userId" = $1
      AND qw."status" = 'active'
      AND (qw."windowEnd" IS NULL OR qw."windowEnd" > $2::timestamp)
      AND qw."remainingCreditUsd" > 0
      ${planClause}
    ORDER BY ${orderByPlan} qw."updatedAt" DESC
    LIMIT 1
  `, [userId, updatedAt]);
}

// Default discounts per plan slug, used as a fallback when PlanCatalog row
// doesn't have an explicit discountPercent set.
const DEFAULT_PLAN_DISCOUNT_PERCENT = {
  payg: 50,
};

function resolvePlanDiscountPercent(planSlug, planDiscountPercent) {
  const stored = safeNumber(planDiscountPercent);
  if (stored > 0) return Math.min(stored, 100);
  return DEFAULT_PLAN_DISCOUNT_PERCENT[planSlug] || 0;
}

/**
 * Deduct `costUsd` from the most appropriate active quota window for the user.
 * Applies the picked plan's `discountPercent` (PayG defaults to 50%).
 *
 * @returns {Promise<null | {
 *   planSlug: string, discountPercent: number,
 *   originalCost: number, chargedCost: number,
 *   remainingCreditUsd: number, consumedCreditUsd: number
 * }>}
 */
export async function dbConsumeUserCredit(userId, costUsd, usageMode = "both") {
  await ensureAdminSchema();
  const originalCost = safeNumber(costUsd);
  if (!userId || !(originalCost > 0)) return null;

  const updatedAt = nowIso();
  const quota = await pickActiveQuotaWindow(userId, usageMode, updatedAt);
  if (!quota) return null;

  const discountPercent = resolvePlanDiscountPercent(quota.planSlug, quota.planDiscountPercent);
  const chargedCost = originalCost * (1 - discountPercent / 100);
  if (!(chargedCost > 0)) {
    return {
      planSlug: quota.planSlug,
      discountPercent,
      originalCost,
      chargedCost: 0,
      remainingCreditUsd: safeNumber(quota.remainingCreditUsd),
      consumedCreditUsd: safeNumber(quota.consumedCreditUsd),
    };
  }

  // First-charge timer start: if this window has never been charged before
  // (consumedCreditUsd === 0) and the plan has a fixed-length window
  // (windowHours > 0, i.e. Free or Pro), kick off the countdown from now
  // instead of letting it run from signup. PayG has no windowHours so this
  // branch is naturally skipped. Existing windows already past their first
  // use keep their original windowStart/windowEnd via COALESCE on NULL params.
  const planWindowHours = safeNumber(quota.windowHours);
  const isFirstCharge = safeNumber(quota.consumedCreditUsd) === 0;
  const startTimer = isFirstCharge && planWindowHours > 0 && quota.planSlug !== "payg";
  const newWindowStart = startTimer ? updatedAt : null;
  const newWindowEnd = startTimer
    ? new Date(new Date(updatedAt).getTime() + planWindowHours * 60 * 60 * 1000).toISOString()
    : null;

  const [updated] = await query(`
    UPDATE "QuotaWindow"
    SET
      "consumedCreditUsd" = COALESCE("consumedCreditUsd", 0) + LEAST($2, COALESCE("remainingCreditUsd", 0)),
      "remainingCreditUsd" = GREATEST(COALESCE("remainingCreditUsd", 0) - $2, 0),
      "windowStart" = COALESCE($4::timestamp, "windowStart"),
      "windowEnd" = COALESCE($5::timestamp, "windowEnd"),
      "updatedAt" = $3
    WHERE "id" = $1
    RETURNING *
  `, [quota.id, chargedCost, updatedAt, newWindowStart, newWindowEnd]);

  if (!updated) return null;
  return {
    planSlug: quota.planSlug,
    discountPercent,
    originalCost,
    chargedCost,
    remainingCreditUsd: safeNumber(updated.remainingCreditUsd),
    consumedCreditUsd: safeNumber(updated.consumedCreditUsd),
  };
}

/**
 * Read the active quota window for the user, used by /me/usage to render the meter.
 * Picks the user's primary (non-payg) window if any; otherwise falls back to payg.
 */
export async function dbGetUserActiveQuota(userId) {
  await ensureAdminSchema();
  if (!userId) return null;
  const updatedAt = nowIso();

  const quota = await first(`
    SELECT qw.*, pc."slug" AS "planSlug", pc."name" AS "planName", pc."windowHours"
    FROM "QuotaWindow" qw
    JOIN "PlanSubscription" ps ON ps."id" = qw."subscriptionId"
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE
      ps."userId" = $1
      AND qw."status" = 'active'
      AND (qw."windowEnd" IS NULL OR qw."windowEnd" > $2::timestamp)
    ORDER BY CASE WHEN pc."slug" = 'payg' THEN 1 ELSE 0 END, qw."updatedAt" DESC
    LIMIT 1
  `, [userId, updatedAt]);

  if (!quota) return null;
  return {
    planSlug: quota.planSlug,
    planName: quota.planName,
    windowHours: quota.windowHours === null ? null : safeNumber(quota.windowHours),
    windowStart: toIso(quota.windowStart),
    windowEnd: toIso(quota.windowEnd),
    includedCreditUsd: safeNumber(quota.includedCreditUsd),
    consumedCreditUsd: safeNumber(quota.consumedCreditUsd),
    remainingCreditUsd: safeNumber(quota.remainingCreditUsd),
  };
}

async function findPlanBySlug(slug) {
  return first(`SELECT * FROM "PlanCatalog" WHERE "slug" = $1`, [slug]);
}

export async function dbUpdateAdminUser(userId, body, actorAdminEmail) {
  await ensureAdminSchema();
  const plan = body.planSlug ? await findPlanBySlug(body.planSlug) : null;
  const updatedAt = nowIso();
  const state = await first(`SELECT * FROM "AdminUserState" WHERE "userId" = $1`, [userId]);
  if (state?.deletedAt) return null;
  const reservedEmail = await getDeletedEmailReservation(body.email);
  if (reservedEmail) {
    const error = new Error("This email cannot be used because the account was deleted by admin.");
    error.code = "email_reserved";
    throw error;
  }

  const [user] = await query(`
    UPDATE "User"
    SET "email" = $2, "name" = $3, "updatedAt" = $4
    WHERE "id" = $1
    RETURNING *
  `, [userId, body.email, body.name, updatedAt]);

  if (!user) return null;

  if (plan) {
    const subscription = await first(`
      SELECT *
      FROM "PlanSubscription"
      WHERE "userId" = $1
      ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "updatedAt" DESC
      LIMIT 1
    `, [userId]);

    if (subscription) {
      await query(`
        UPDATE "PlanSubscription"
        SET "planId" = $2, "updatedAt" = $3
        WHERE "id" = $1
      `, [subscription.id, plan.id, updatedAt]);
      await ensurePlanQuotaWindow(userId, body.planSlug, updatedAt);
    }
  }

  await writeAdminAuditEvent({
    actorAdminEmail,
    action: "user_updated",
    targetType: "user",
    targetId: userId,
    summary: `Updated user ${userId}.`,
    metadata: {
      userId,
      email: body.email,
      name: body.name,
      planSlug: body.planSlug,
      reason: body.reason,
    },
    createdAt: updatedAt,
  });
  return dbGetAdminUser(userId);
}

export async function dbChangeAdminUserSubscription(userId, body, actorAdminEmail, updatedAt = nowIso()) {
  await ensureAdminSchema();
  const plan = await findPlanBySlug(body.targetPlanSlug);
  if (!plan) return null;

  const state = await first(`SELECT * FROM "AdminUserState" WHERE "userId" = $1`, [userId]);
  if (state?.deletedAt) return null;
  const existing = await first(`
    SELECT *
    FROM "PlanSubscription"
    WHERE "userId" = $1
    ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "updatedAt" DESC
    LIMIT 1
  `, [userId]);
  const previousPlan = existing ? await first(`SELECT "slug" FROM "PlanCatalog" WHERE "id" = $1`, [existing.planId]) : null;

  if (existing) {
    await query(`
      UPDATE "PlanSubscription"
      SET "planId" = $2, "status" = 'active', "updatedAt" = $3
      WHERE "id" = $1
    `, [existing.id, plan.id, updatedAt]);
    // Plan changed on an existing subscription row: expire any active QuotaWindow
    // still attached to it under the *previous* plan. Without this, the partial
    // unique index "QuotaWindow_subscription_active_uniq" blocks the fresh
    // window insert in ensurePlanQuotaWindow, so the user keeps seeing the old
    // (e.g. Free $2/$2) meter on /settings/usage after upgrading to Pro.
    if (previousPlan?.slug && previousPlan.slug !== body.targetPlanSlug) {
      await query(`
        UPDATE "QuotaWindow"
        SET "status" = 'expired', "updatedAt" = $2
        WHERE "subscriptionId" = $1
          AND "status" = 'active'
          AND "planSlug" <> $3
      `, [existing.id, updatedAt, body.targetPlanSlug]);
    }
    await ensurePlanQuotaWindow(userId, body.targetPlanSlug, updatedAt);
    await writeAdminAuditEvent({
      actorAdminEmail,
      action: "subscription_changed",
      targetType: "user",
      targetId: userId,
      summary: `Changed subscription for user ${userId} to ${body.targetPlanSlug}.`,
      metadata: {
        userId,
        previousPlanSlug: previousPlan?.slug || null,
        currentPlanSlug: body.targetPlanSlug,
        reason: body.reason || null,
      },
      createdAt: updatedAt,
    });
    return {
      userId,
      previousPlanSlug: previousPlan?.slug || null,
      currentPlanSlug: body.targetPlanSlug,
      effectiveAt: updatedAt,
      subscriptionId: existing.id,
    };
  }

  const subscriptionId = crypto.randomUUID();
  await query(`
    INSERT INTO "PlanSubscription" ("id", "userId", "planId", "status", "autoRenew", "startsAt", "renewsAt", "endsAt", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, 'active', true, $4, NULL, NULL, $4, $4)
  `, [subscriptionId, userId, plan.id, updatedAt]);
  await ensurePlanQuotaWindow(userId, body.targetPlanSlug, updatedAt);
  await writeAdminAuditEvent({
    actorAdminEmail,
    action: "subscription_changed",
    targetType: "user",
    targetId: userId,
    summary: `Changed subscription for user ${userId} to ${body.targetPlanSlug}.`,
    metadata: {
      userId,
      previousPlanSlug: null,
      currentPlanSlug: body.targetPlanSlug,
      reason: body.reason || null,
    },
    createdAt: updatedAt,
  });

  return {
    userId,
    previousPlanSlug: null,
    currentPlanSlug: body.targetPlanSlug,
    effectiveAt: updatedAt,
    subscriptionId,
  };
}

export async function dbGetAdminUsageRequests(request) {
  await ensureAdminSchema();
  const limit = limitFromRequest(request);
  const status = queryParam(request, "status");
  const provider = queryParam(request, "provider");
  const model = queryParam(request, "model");
  const userId = queryParam(request, "userId");
  const cursor = decodeCursor(queryParam(request, "cursor"));

  const filters = [];
  const params = [];

  for (const [value, column] of [[status, `r."status"`], [provider, `r."provider"`], [model, `r."model"`], [userId, `r."userId"`]]) {
    if (value) {
      params.push(value);
      filters.push(`${column} = $${params.length}`);
    }
  }
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    filters.push(`(r."createdAt", r."id") < ($${params.length - 1}::timestamp, $${params.length})`);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = await query(`
    SELECT
      r.*,
      u."email" AS "userEmail",
      COALESCE(uc."chargedCostUsd", 0) AS "chargedCostUsd",
      COALESCE(uc."countedTowardQuotaUsd", 0) AS "countedTowardQuotaUsd",
      uc."planSlug"
    FROM "UsageRequest" r
    JOIN "User" u ON u."id" = r."userId"
    LEFT JOIN "UsageCharge" uc ON uc."usageRequestId" = r."id"
    ${whereSql}
    ORDER BY r."createdAt" DESC, r."id" DESC
    LIMIT $${params.length + 1}
  `, [...params, limit + 1]);

  const [summary, charts] = await Promise.all([
    first(`
      SELECT
        COUNT(*)::int AS "requests",
        COALESCE(SUM(r."inputTokens"), 0)::int AS "inputTokens",
        COALESCE(SUM(r."outputTokens"), 0)::int AS "outputTokens",
        COALESCE(SUM(uc."chargedCostUsd"), 0) AS "chargedCost",
        COUNT(*) FILTER (WHERE r."status" <> 'success')::int AS "failedRequests",
        COALESCE(AVG(r."latencyMs"), 0) AS "averageLatency"
      FROM "UsageRequest" r
      LEFT JOIN "UsageCharge" uc ON uc."usageRequestId" = r."id"
    `),
    query(`
      SELECT
        TO_CHAR(DATE_TRUNC('day', r."createdAt"), 'YYYY-MM-DD') AS "label",
        COUNT(*)::int AS "requests",
        COALESCE(SUM(r."inputTokens" + r."outputTokens"), 0)::int AS "tokens",
        COALESCE(SUM(uc."chargedCostUsd"), 0) AS "cost"
      FROM "UsageRequest" r
      LEFT JOIN "UsageCharge" uc ON uc."usageRequestId" = r."id"
      WHERE r."createdAt" >= NOW() - INTERVAL '13 days'
      GROUP BY DATE_TRUNC('day', r."createdAt")
      ORDER BY DATE_TRUNC('day', r."createdAt") ASC
    `),
  ]);

  const items = rows.slice(0, limit).map(mapUsageRow);
  return {
    items,
    nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    summary: {
      requests: safeNumber(summary?.requests),
      inputTokens: safeNumber(summary?.inputTokens),
      outputTokens: safeNumber(summary?.outputTokens),
      chargedCost: formatUsd(summary?.chargedCost),
      failedRequests: safeNumber(summary?.failedRequests),
      averageLatency: safeNumber(summary?.averageLatency) ? `${Math.round(safeNumber(summary.averageLatency))}ms` : "-",
    },
    charts: {
      requests: charts.map((row) => ({ label: row.label, value: safeNumber(row.requests) })),
      tokens: charts.map((row) => ({ label: row.label, value: safeNumber(row.tokens) })),
      cost: charts.map((row) => ({ label: row.label, value: safeNumber(row.cost) })),
    },
  };
}

export async function dbGetAdminModels() {
  await ensureAdminSchema();
  const rows = await query(`
    SELECT *
    FROM "ModelCatalog"
    ORDER BY "sortOrder" ASC, "name" ASC
  `);

  return {
    items: rows.map(mapModel),
    nextCursor: null,
    summary: {
      totalModels: rows.length,
      enabledModels: rows.filter((row) => row.isActive).length,
      disabledModels: rows.filter((row) => !row.isActive).length,
      providersCount: new Set(rows.map((row) => row.provider)).size,
    },
  };
}

export async function dbGetAdminModelPricing(modelId) {
  try {
    await ensureAdminSchema();
    const row = await first(
      `SELECT "inputPriceUsdPer1M", "outputPriceUsdPer1M" FROM "ModelCatalog" WHERE "modelId" = $1 OR "slug" = $1 LIMIT 1`,
      [modelId]
    );
    if (!row) return null;
    return {
      input: safeNumber(row.inputPriceUsdPer1M),
      output: safeNumber(row.outputPriceUsdPer1M),
    };
  } catch {
    return null;
  }
}

export async function dbCreateAdminModel(body) {
  await ensureAdminSchema();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const provider = typeof body?.provider === "string" ? body.provider.trim() : "";
  const providerCode = typeof body?.providerCode === "string" ? body.providerCode.trim() : provider;
  const modelId = typeof body?.modelId === "string" ? body.modelId.trim() : "";
  if (!name || !slug || !provider || !providerCode || !modelId) {
    return null;
  }

  const id = crypto.randomUUID();
  const now = nowIso();
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "general";
  const isActive = body?.visibility !== "hidden" && body?.accessState !== "disabled";
  const contextWindow = parseContextWindow(body?.contextWindow);
  const inputPriceUsdPer1M = parsePriceToNumber(body?.inputPrice);
  const outputPriceUsdPer1M = parsePriceToNumber(body?.outputPrice);
  const latencyMs = parseLatencyToMs(body?.latency);
  const sortOrder = Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0;

  await query(
    `
    INSERT INTO "ModelCatalog" (
      "id", "slug", "name", "provider", "providerCode", "modelId", "summary",
      "contextWindow", "inputPriceUsdPer1M", "outputPriceUsdPer1M", "latencyMs",
      "category", "isActive", "sortOrder", "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `,
    [id, slug, name, provider, providerCode, modelId, summary, contextWindow, inputPriceUsdPer1M, outputPriceUsdPer1M, latencyMs, category, isActive, sortOrder, now, now],
  );

  const row = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1`, [id]);
  return row ? mapModel(row) : null;
}

export async function dbDeleteAdminModel(modelId) {
  await ensureAdminSchema();
  const model = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1 OR "slug" = $1 OR "modelId" = $1`, [modelId]);
  if (!model) return null;
  await query(`DELETE FROM "ModelCatalog" WHERE "id" = $1`, [model.id]);
  return { modelId: model.id, deletedAt: nowIso() };
}

export async function dbUpdateAdminModel(modelId, body) {
  await ensureAdminSchema();
  const model = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1 OR "slug" = $1 OR "modelId" = $1`, [modelId]);
  if (!model) return null;

  const updates = [];
  const values = [];
  let idx = 1;

  if (typeof body?.name === "string") { updates.push(`"name" = $${idx++}`); values.push(body.name.trim()); }
  if (typeof body?.slug === "string") { updates.push(`"slug" = $${idx++}`); values.push(body.slug.trim()); }
  if (typeof body?.provider === "string") { updates.push(`"provider" = $${idx++}`); values.push(body.provider.trim()); }
  if (typeof body?.providerCode === "string") { updates.push(`"providerCode" = $${idx++}`); values.push(body.providerCode.trim()); }
  if (typeof body?.modelId === "string") { updates.push(`"modelId" = $${idx++}`); values.push(body.modelId.trim()); }
  if (typeof body?.summary === "string") { updates.push(`"summary" = $${idx++}`); values.push(body.summary.trim()); }
  if (typeof body?.category === "string") { updates.push(`"category" = $${idx++}`); values.push(body.category.trim()); }
  if (body?.contextWindow !== undefined) { updates.push(`"contextWindow" = $${idx++}`); values.push(parseContextWindow(body.contextWindow)); }
  if (body?.inputPrice !== undefined) { updates.push(`"inputPriceUsdPer1M" = $${idx++}`); values.push(parsePriceToNumber(body.inputPrice)); }
  if (body?.outputPrice !== undefined) { updates.push(`"outputPriceUsdPer1M" = $${idx++}`); values.push(parsePriceToNumber(body.outputPrice)); }
  if (body?.latency !== undefined) { updates.push(`"latencyMs" = $${idx++}`); values.push(parseLatencyToMs(body.latency)); }
  if (typeof body?.visibility === "string" || typeof body?.accessState === "string") {
    const isActive = (body?.visibility === "hidden" || body?.accessState === "disabled") ? false : true;
    updates.push(`"isActive" = $${idx++}`); values.push(isActive);
  }

  if (updates.length === 0) return mapModel(model);

  const now = nowIso();
  updates.push(`"updatedAt" = $${idx++}`);
  values.push(now);
  values.push(model.id);

  await query(`UPDATE "ModelCatalog" SET ${updates.join(", ")} WHERE "id" = $${idx}`, values);

  const row = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1`, [model.id]);
  return row ? mapModel(row) : null;
}

export async function dbEnableAdminModel(modelId) {
  await ensureAdminSchema();
  const model = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1 OR "slug" = $1 OR "modelId" = $1`, [modelId]);
  if (!model) return null;
  await query(`UPDATE "ModelCatalog" SET "isActive" = true, "updatedAt" = $1 WHERE "id" = $2`, [nowIso(), model.id]);
  const row = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1`, [model.id]);
  return row ? mapModel(row) : null;
}

export async function dbDisableAdminModel(modelId) {
  await ensureAdminSchema();
  const model = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1 OR "slug" = $1 OR "modelId" = $1`, [modelId]);
  if (!model) return null;
  await query(`UPDATE "ModelCatalog" SET "isActive" = false, "updatedAt" = $1 WHERE "id" = $2`, [nowIso(), model.id]);
  const row = await first(`SELECT * FROM "ModelCatalog" WHERE "id" = $1`, [model.id]);
  return row ? mapModel(row) : null;
}

export async function dbSeedAdminModelCatalog(rows = []) {
  await ensureAdminSchema();
  const sourceRows = Array.isArray(rows) ? rows : [];
  const sourceModelIds = new Set(sourceRows.map((row) => row?.modelId).filter(Boolean));
  let inserted = 0;
  let updated = 0;
  let deleted = 0;

  for (const row of sourceRows) {
    if (!row?.slug || !row?.name || !row?.provider || !row?.providerCode || !row?.modelId) continue;

    const existing = await first(
      `SELECT * FROM "ModelCatalog" WHERE "modelId" = $1 OR "slug" = $2 LIMIT 1`,
      [row.modelId, row.slug],
    );
    const now = nowIso();

    if (existing) {
      await query(
        `
          UPDATE "ModelCatalog"
          SET
            "slug" = $2,
            "name" = $3,
            "provider" = $4,
            "providerCode" = $5,
            "modelId" = $6,
            "summary" = $7,
            "contextWindow" = $8,
            "inputPriceUsdPer1M" = $9,
            "outputPriceUsdPer1M" = $10,
            "latencyMs" = $11,
            "category" = $12,
            "sortOrder" = $13,
            "updatedAt" = $14
          WHERE "id" = $1
        `,
        [
          existing.id,
          row.slug,
          row.name,
          row.provider,
          row.providerCode,
          row.modelId,
          row.summary || "",
          row.contextWindow ?? null,
          row.inputPriceUsdPer1M ?? null,
          row.outputPriceUsdPer1M ?? null,
          row.latencyMs ?? null,
          row.category || "general",
          Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
          now,
        ],
      );
      updated += 1;
      continue;
    }

    await query(
      `
        INSERT INTO "ModelCatalog" (
          "id", "slug", "name", "provider", "providerCode", "modelId", "summary",
          "contextWindow", "inputPriceUsdPer1M", "outputPriceUsdPer1M", "latencyMs",
          "category", "isActive", "sortOrder", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
      `,
      [
        crypto.randomUUID(),
        row.slug,
        row.name,
        row.provider,
        row.providerCode,
        row.modelId,
        row.summary || "",
        row.contextWindow ?? null,
        row.inputPriceUsdPer1M ?? null,
        row.outputPriceUsdPer1M ?? null,
        row.latencyMs ?? null,
        row.category || "general",
        row.isActive !== false,
        Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
        now,
      ],
    );
    inserted += 1;
  }

  const existingRows = await query(`SELECT "id", "modelId" FROM "ModelCatalog"`);
  for (const row of existingRows) {
    if (!sourceModelIds.has(row.modelId)) {
      await query(`DELETE FROM "ModelCatalog" WHERE "id" = $1`, [row.id]);
      deleted += 1;
    }
  }

  return { inserted, updated, deleted, total: sourceRows.length };
}

export async function dbGetAdminPlans() {
  await ensureAdminSchema();
  const [plans, entitlementsMap] = await Promise.all([
    query(`
      SELECT *
      FROM "PlanCatalog"
      ORDER BY "sortOrder" ASC, "slug" ASC
    `),
    getPlanEntitlementsMap(),
  ]);

  return {
    plans: plans.map((plan) => mapPlan(plan, entitlementsMap.get(plan.id) || [])),
  };
}

export async function dbGetAdminAuditEvents(request) {
  await ensureAdminSchema();
  const limit = limitFromRequest(request);
  const cursor = decodeCursor(queryParam(request, "cursor"));
  const actorEmail = queryParam(request, "actorEmail");
  const action = queryParam(request, "action");
  const targetType = queryParam(request, "targetType");
  const targetId = queryParam(request, "targetId");

  const filters = [];
  const params = [];

  for (const [value, column] of [[actorEmail, `"actorAdminEmail"`], [action, `"action"`], [targetType, `"targetType"`], [targetId, `"targetId"`]]) {
    if (value) {
      params.push(value);
      filters.push(`${column} = $${params.length}`);
    }
  }
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    filters.push(`("createdAt", "id") < ($${params.length - 1}::timestamp, $${params.length})`);
  }

  const whereSql = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = await query(`
    SELECT *
    FROM "AdminAuditEvent"
    ${whereSql}
    ORDER BY "createdAt" DESC, "id" DESC
    LIMIT $${params.length + 1}
  `, [...params, limit + 1]);
  const summary = await first(`SELECT COUNT(*)::int AS total FROM "AdminAuditEvent"`);
  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    actorAdminEmail: row.actorAdminEmail,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    summary: row.summary,
    createdAt: toIso(row.createdAt),
    metadata: parseJson(row.metadataJson, null),
  }));
  return {
    items,
    nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null,
    summary: { total: safeNumber(summary?.total) },
  };
}

async function getUserState(userId) {
  await ensureAdminSchema();
  return first(`SELECT * FROM "AdminUserState" WHERE "userId" = $1`, [userId]);
}

async function upsertUserState(userId, values) {
  await ensureAdminSchema();
  const updatedAt = values.updatedAt || nowIso();
  await query(
    `
      INSERT INTO "AdminUserState" ("userId", "isBanned", "banReason", "bannedAt", "deletedAt", "deleteReason", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ("userId") DO UPDATE SET
        "isBanned" = EXCLUDED."isBanned",
        "banReason" = EXCLUDED."banReason",
        "bannedAt" = EXCLUDED."bannedAt",
        "deletedAt" = EXCLUDED."deletedAt",
        "deleteReason" = EXCLUDED."deleteReason",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    [userId, values.isBanned, values.banReason || null, values.bannedAt || null, values.deletedAt || null, values.deleteReason || null, updatedAt],
  );
}

async function revokeUserSessionsAndKeys(userId, updatedAt) {
  await query(`DELETE FROM "Session" WHERE "userId" = $1`, [userId]);
  await query(`UPDATE "ApiKey" SET "isActive" = false, "revokedAt" = $2, "status" = 'revoked', "updatedAt" = $2 WHERE "userId" = $1 AND ("isActive" = true OR "status" IS NULL OR "status" <> 'revoked')`, [userId, updatedAt]);
}

async function ensurePaygSubscription(userId, updatedAt) {
  const plan = await findPlanBySlug("payg");
  if (!plan) return null;

  const existing = await first(`
    SELECT ps.*
    FROM "PlanSubscription" ps
    JOIN "PlanCatalog" pc ON pc."id" = ps."planId"
    WHERE ps."userId" = $1 AND pc."slug" = 'payg'
    ORDER BY CASE WHEN ps."status" = 'active' THEN 0 ELSE 1 END, ps."updatedAt" DESC
    LIMIT 1
  `, [userId]);

  if (existing) {
    if (existing.status !== "active") {
      await query(`
        UPDATE "PlanSubscription"
        SET "status" = 'active', "updatedAt" = $2, "endsAt" = NULL
        WHERE "id" = $1
      `, [existing.id, updatedAt]);
    }
    return existing.id;
  }

  const subscriptionId = crypto.randomUUID();
  await query(`
    INSERT INTO "PlanSubscription" ("id", "userId", "planId", "status", "autoRenew", "startsAt", "renewsAt", "endsAt", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, 'active', false, $4, NULL, NULL, $4, $4)
  `, [subscriptionId, userId, plan.id, updatedAt]);
  return subscriptionId;
}

export async function dbAddAdminUserPaygCredit(userId, body, actorAdminEmail) {
  await ensureAdminSchema();
  const user = await first(`SELECT * FROM "User" WHERE "id" = $1`, [userId]);
  const state = await getUserState(userId);
  if (!user || state?.deletedAt) return null;

  const currency = String(body.currency || "USD").toUpperCase();
  if (currency !== "USD") {
    throw new Error("Only USD PayG credit adjustments are supported by the current PostgreSQL billing schema.");
  }

  const amountUsd = safeNumber(body.amountMinor) / 100;
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Credit amount must be positive.");
  }

  const updatedAt = nowIso();
  const subscriptionId = await ensurePaygSubscription(userId, updatedAt);
  if (!subscriptionId) {
    throw new Error("Pay as you go plan is unavailable.");
  }

  const quota = await first(`
    SELECT *
    FROM "QuotaWindow"
    WHERE "subscriptionId" = $1 AND "planSlug" = 'payg'
    ORDER BY CASE WHEN "status" = 'active' THEN 0 ELSE 1 END, "updatedAt" DESC
    LIMIT 1
  `, [subscriptionId]);

  let quotaId = quota?.id || crypto.randomUUID();
  let nextRemaining = amountUsd;

  if (quota) {
    nextRemaining = safeNumber(quota.remainingCreditUsd) + amountUsd;
    await query(`
      UPDATE "QuotaWindow"
      SET
        "includedCreditUsd" = COALESCE("includedCreditUsd", 0) + $2,
        "remainingCreditUsd" = COALESCE("remainingCreditUsd", 0) + $2,
        "status" = 'active',
        "updatedAt" = $3
      WHERE "id" = $1
    `, [quota.id, amountUsd, updatedAt]);
  } else {
    const farFuture = "2099-12-31T23:59:59.000Z";
    await query(`
      INSERT INTO "QuotaWindow" ("id", "subscriptionId", "planSlug", "windowStart", "windowEnd", "includedCreditUsd", "consumedCreditUsd", "remainingCreditUsd", "status", "createdAt", "updatedAt")
      VALUES ($1, $2, 'payg', $3, $4, $5, 0, $5, 'active', $3, $3)
    `, [quotaId, subscriptionId, updatedAt, farFuture, amountUsd]);
  }

  await writeAdminAuditEvent({
    actorAdminEmail,
    action: "payg_credit_added",
    targetType: "user",
    targetId: userId,
    summary: `Added PayG credit to user ${userId}.`,
    metadata: {
      userId,
      amountMinor: body.amountMinor,
      currency,
      amountUsd,
      updatedBalanceDisplay: formatUsd(nextRemaining),
      reason: body.reason || null,
    },
    createdAt: updatedAt,
  });
  return {
    userId,
    updatedBalanceDisplay: formatUsd(nextRemaining),
    ledgerEntryId: quotaId,
  };
}

export async function dbToggleAdminUserBan(userId, reason, actorAdminEmail) {
  await ensureAdminSchema();
  const user = await first(`SELECT * FROM "User" WHERE "id" = $1`, [userId]);
  const state = await getUserState(userId);
  if (!user || state?.deletedAt) return null;

  const updatedAt = nowIso();
  const nextBanned = !Boolean(state?.isBanned);
  await upsertUserState(userId, {
    isBanned: nextBanned,
    banReason: nextBanned ? reason : null,
    bannedAt: nextBanned ? updatedAt : null,
    deletedAt: state?.deletedAt || null,
    deleteReason: state?.deleteReason || null,
    updatedAt,
  });

  if (nextBanned) {
    await revokeUserSessionsAndKeys(userId, updatedAt);
  }

  await writeAdminAuditEvent({
    actorAdminEmail,
    action: nextBanned ? "user_banned" : "user_unbanned",
    targetType: "user",
    targetId: userId,
    summary: `${nextBanned ? "Banned" : "Unbanned"} user ${userId}.`,
    metadata: { userId, reason },
    createdAt: updatedAt,
  });
  const result = await dbGetAdminUser(userId);
  if (!result.user) return null;
  return {
    user: result.user,
    action: nextBanned ? "banned" : "unbanned",
  };
}

export async function dbDeleteAdminUser(userId, reason, actorAdminEmail) {
  await ensureAdminSchema();
  const user = await first(`SELECT * FROM "User" WHERE "id" = $1`, [userId]);
  const state = await getUserState(userId);
  if (!user || state?.deletedAt) return null;

  const updatedAt = nowIso();
  await reserveDeletedEmail({ userId, email: user.email, reason, deletedAt: updatedAt });

  await revokeUserSessionsAndKeys(userId, updatedAt);
  await query(`UPDATE "ApiKey" SET "userId" = NULL, "isActive" = false, "revokedAt" = $2, "status" = 'revoked', "updatedAt" = $2 WHERE "userId" = $1`, [userId, updatedAt]);
  await query(`UPDATE "UsageRequest" SET "userId" = NULL WHERE "userId" = $1`, [userId]);
  await query(`DELETE FROM "Account" WHERE "userId" = $1`, [userId]);
  await query(`DELETE FROM "Profile" WHERE "userId" = $1`, [userId]);
  await query(`
    DELETE FROM "QuotaWindow"
    WHERE "subscriptionId" IN (
      SELECT "id" FROM "PlanSubscription" WHERE "userId" = $1
    )
  `, [userId]);
  await query(`DELETE FROM "PlanSubscription" WHERE "userId" = $1`, [userId]);
  await query(`DELETE FROM "AdminUserState" WHERE "userId" = $1`, [userId]);
  await query(`DELETE FROM "User" WHERE "id" = $1`, [userId]);

  await writeAdminAuditEvent({
    actorAdminEmail,
    action: "user_deleted",
    targetType: "user",
    targetId: userId,
    summary: `Deleted user ${userId}.`,
    metadata: {
      userId,
      previousEmail: user.email,
      deleteReason: reason,
    },
    createdAt: updatedAt,
  });

  return {
    userId,
    deletedAt: updatedAt,
  };
}

/* ------------------------------------------------------------------
   Local-mode API Key persistence (migrated from db.json to Postgres)
   ------------------------------------------------------------------ */

export async function getApiKeys() {
  await ensureAdminSchema();
  const rows = await query(`SELECT * FROM "ApiKey" WHERE "revokedAt" IS NULL AND ("status" IS NULL OR "status" <> 'revoked') ORDER BY "createdAt" DESC`);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    key: row.key,
    machineId: row.machineId,
    userId: row.userId,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    revokedAt: toIso(row.revokedAt),
  }));
}

export async function getApiKeyById(id) {
  await ensureAdminSchema();
  const row = await first(`SELECT * FROM "ApiKey" WHERE "id" = $1`, [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    machineId: row.machineId,
    userId: row.userId,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    revokedAt: toIso(row.revokedAt),
  };
}

export async function getApiKeyByValue(key) {
  await ensureAdminSchema();
  const row = await first(`SELECT * FROM "ApiKey" WHERE "key" = $1`, [key]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    key: row.key,
    machineId: row.machineId,
    userId: row.userId,
    isActive: row.isActive,
    createdAt: toIso(row.createdAt),
    revokedAt: toIso(row.revokedAt),
  };
}

export async function createApiKey(name, machineId, userId = null) {
  await ensureAdminSchema();
  const now = nowIso();
  const id = uuidv4();
  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);
  const key = result.key;
  const maskedKey = key ? `${key.slice(0, 14)}...` : "";
  const hashedSecret = crypto.createHash("sha256").update(key).digest("hex");
  const usageMode = "both";
  await query(
    `INSERT INTO "ApiKey" (
      "id", "userId", "label", "keyPrefix", "hashedSecret", "maskedKey",
      "status", "createdAt", "updatedAt", "usageMode", "name",
      "key", "machineId", "isActive"
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7::"ApiKeyStatus", $8, $9, $10::"ApiKeyUsageMode", $11, $12, $13, $14)`,
    [
      id,
      userId || "",
      name || "",
      result.keyId || "",
      hashedSecret,
      maskedKey,
      "active",
      now,
      now,
      usageMode,
      name || "",
      key,
      machineId || null,
      true,
    ],
  );
  return {
    id,
    name: name || "",
    key,
    machineId: machineId || null,
    userId: userId || null,
    isActive: true,
    createdAt: now,
  };
}

export async function updateApiKey(id, data) {
  await ensureAdminSchema();
  const existing = await getApiKeyById(id);
  if (!existing) return null;
  const setClauses = [];
  const params = [];
  let idx = 1;
  const allowed = ["name", "isActive", "usageMode", "userId"];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      setClauses.push(`"${key}" = $${idx++}`);
      params.push(data[key]);
    }
  }
  if (setClauses.length === 0) return existing;
  params.push(id);
  await query(
    `UPDATE "ApiKey" SET ${setClauses.join(", ")} WHERE "id" = $${idx}`,
    params,
  );
  return getApiKeyById(id);
}

export async function deleteApiKey(id) {
  await ensureAdminSchema();
  const result = await query(`DELETE FROM "ApiKey" WHERE "id" = $1`, [id]);
  return (result?.rowCount ?? result?.length ?? 0) > 0;
}

export async function validateApiKey(key) {
  await ensureAdminSchema();
  const row = await first(
    `SELECT * FROM "ApiKey" WHERE "key" = $1 AND "isActive" = true AND "revokedAt" IS NULL AND ("status" IS NULL OR "status" <> 'revoked')`,
    [key],
  );
  return Boolean(row);
}
