-- Migration: Admin domain schema
-- Additive tables for DB-backed admin pages. Re-runnable and non-destructive.

CREATE TABLE IF NOT EXISTS admin_credentials (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_events (
  id TEXT PRIMARY KEY,
  actorEmail TEXT NOT NULL,
  action TEXT NOT NULL,
  targetType TEXT NOT NULL,
  targetId TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata TEXT,
  idempotencyKey TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_idempotency_keys (
  key TEXT PRIMARY KEY,
  actorEmail TEXT NOT NULL,
  scope TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  responseJson TEXT NOT NULL,
  statusCode INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deleted_user_emails (
  normalizedEmail TEXT PRIMARY KEY,
  originalEmail TEXT NOT NULL,
  deletedUserId TEXT NOT NULL,
  reason TEXT,
  deletedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  planSlug TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  lastSeenAt TEXT
);

CREATE TABLE IF NOT EXISTS user_profiles (
  userId TEXT PRIMARY KEY,
  username TEXT,
  company TEXT,
  timezone TEXT,
  bio TEXT,
  avatarUrl TEXT
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  billingType TEXT NOT NULL,
  priceMinor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  interval TEXT,
  includedCreditUsd REAL,
  windowHours INTEGER,
  discountPercent INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  visible INTEGER NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  planSlug TEXT NOT NULL,
  status TEXT NOT NULL,
  autoRenew INTEGER NOT NULL DEFAULT 0,
  renewsAt TEXT,
  startedAt TEXT NOT NULL,
  endedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_accounts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'USD',
  balanceMinor INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  kind TEXT NOT NULL,
  amountMinor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT NOT NULL,
  sourceType TEXT NOT NULL,
  sourceId TEXT NOT NULL,
  idempotencyKey TEXT UNIQUE,
  createdByAdminEmail TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_destinations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  displayName TEXT NOT NULL,
  accountNumber TEXT NOT NULL,
  accountHolderName TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  isActive INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS manual_payments (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL,
  planSlug TEXT,
  amountMinor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  referenceCode TEXT NOT NULL UNIQUE,
  destinationId TEXT,
  senderName TEXT,
  senderReference TEXT,
  notes TEXT,
  submittedAt TEXT,
  transferredAt TEXT,
  approvedAt TEXT,
  approvedByAdminEmail TEXT,
  rejectedAt TEXT,
  rejectedByAdminEmail TEXT,
  rejectionReason TEXT,
  expiresAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  userId TEXT,
  machineId TEXT,
  label TEXT NOT NULL,
  keyHash TEXT,
  maskedKey TEXT NOT NULL,
  usageMode TEXT NOT NULL DEFAULT 'both',
  createdAt TEXT NOT NULL,
  lastUsedAt TEXT,
  revokedAt TEXT
);

CREATE TABLE IF NOT EXISTS usage_requests (
  id TEXT PRIMARY KEY,
  requestId TEXT NOT NULL UNIQUE,
  userId TEXT,
  apiKeyId TEXT,
  machineId TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  appLabel TEXT,
  status TEXT NOT NULL,
  inputTokens INTEGER NOT NULL DEFAULT 0,
  outputTokens INTEGER NOT NULL DEFAULT 0,
  latencyMs INTEGER,
  chargedCostUsd REAL NOT NULL DEFAULT 0,
  countedTowardQuotaUsd REAL NOT NULL DEFAULT 0,
  planSlug TEXT,
  errorCode TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerCode TEXT NOT NULL,
  modelId TEXT NOT NULL UNIQUE,
  summary TEXT NOT NULL DEFAULT '',
  contextWindow TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  latency TEXT NOT NULL DEFAULT '',
  inputPrice TEXT NOT NULL DEFAULT '',
  outputPrice TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'visible',
  accessState TEXT NOT NULL DEFAULT 'enabled',
  allowedPlanSlugs TEXT NOT NULL DEFAULT '["free","pro","payg"]',
  metadata TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_credentials_email ON admin_credentials(email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_events(createdAt, id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_events(targetType, targetId, createdAt);
CREATE INDEX IF NOT EXISTS idx_admin_idempotency_expiry ON admin_idempotency_keys(expiresAt);
CREATE INDEX IF NOT EXISTS idx_deleted_user_emails_deleted_at ON deleted_user_emails(deletedAt, deletedUserId);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(createdAt, id);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(lastSeenAt);
CREATE INDEX IF NOT EXISTS idx_users_plan_status ON users(planSlug, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(userId, status, createdAt);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON credit_ledger_entries(userId, createdAt);
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_ledger_manual_payment_source ON credit_ledger_entries(sourceType, sourceId) WHERE sourceType = 'manual_payment';
CREATE INDEX IF NOT EXISTS idx_manual_payments_status_created ON manual_payments(status, createdAt, id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_user_created ON manual_payments(userId, createdAt, id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_purpose ON manual_payments(purpose, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(userId, revokedAt);
CREATE INDEX IF NOT EXISTS idx_api_keys_machine ON api_keys(machineId, revokedAt);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_requests(createdAt, id);
CREATE INDEX IF NOT EXISTS idx_usage_user_created ON usage_requests(userId, createdAt, id);
CREATE INDEX IF NOT EXISTS idx_usage_status_created ON usage_requests(status, createdAt, id);
CREATE INDEX IF NOT EXISTS idx_usage_model_created ON usage_requests(provider, model, createdAt);
CREATE INDEX IF NOT EXISTS idx_models_provider_visibility ON models(provider, visibility, accessState);
CREATE INDEX IF NOT EXISTS idx_models_category ON models(category, visibility);
CREATE INDEX IF NOT EXISTS idx_plans_visible_active ON plans(visible, active, sortOrder);

INSERT OR IGNORE INTO plans (id, slug, name, description, billingType, priceMinor, currency, interval, includedCreditUsd, windowHours, discountPercent, active, visible, sortOrder, metadata, createdAt, updatedAt)
VALUES
  ('plan_free', 'free', 'Free', '$2 starting balance. Manual top-up enabled.', 'free', 0, 'IDR', NULL, 2, NULL, NULL, 1, 1, 10, '{"manualTopUp":true}', datetime('now'), datetime('now')),
  ('plan_pro', 'pro', 'Pro', '$10 credit every 12 hours, billed monthly.', 'subscription', 50000, 'IDR', 'month', 10, 12, NULL, 1, 1, 20, '{"manualTopUp":true}', datetime('now'), datetime('now')),
  ('plan_payg', 'payg', 'Pay as you go', '50% discount for every model.', 'payg', 0, 'IDR', NULL, NULL, NULL, 50, 1, 1, 30, '{"manualTopUp":true}', datetime('now'), datetime('now'));
