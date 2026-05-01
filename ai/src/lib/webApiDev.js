import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { deleteOtpChallenge, getOtpChallenge, saveOtpChallenge } from "@/lib/otpChallengeStore";
import { sendOtpEmail } from "@/lib/smtp";

import {
  dbAddAdminUserPaygCredit,
  dbApproveAdminPayment,
  dbCreateAdminModel,
  dbCreateAuthUser,
  dbDisableAdminModel,
  dbEnableAdminModel,
  dbEnsureAuthUserSignupQuota,
  dbCreateManualPayment,
  dbGetAuthUserByEmail,
  dbChangeAdminUserSubscription,
  dbDeleteAdminModel,
  dbDeleteAdminUser,
  dbUpdateAdminModel,
  dbGetAdminAuditEvents,
  dbGetAdminModels,
  dbGetAdminOverview,
  dbGetAdminPayment,
  dbGetAdminPayments,
  dbGetAdminPlans,
  dbGetAdminUser,
  dbGetUserActiveQuota,
  dbGetUserPaygCreditBalance,
  dbGetAdminUsers,
  dbIsDeletedUserEmailReserved,
  dbRejectAdminPayment,
  dbToggleAdminUserBan,
  dbUpdateAdminUser,
} from "@/lib/adminPostgres";
import { createApiKey, deleteApiKey, getApiKeyById, getApiKeys, getSettings, updateApiKey } from "@/lib/localDb";
import { buildPublicModelCatalog } from "./modelCatalogSeed.js";
import { getRequestDetails, resetUsageDb } from "./usageDb.js";
import { resetRequestDetailsDb } from "./requestDetailsDb.js";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { PROVIDER_MODELS } from "@/shared/constants/models";
import { MODEL_PRICING, getPricingForModel, calculateCostFromTokens } from "@/shared/constants/pricing";
import { AI_PROVIDERS } from "@/shared/constants/providers";

const USER_SESSION_COOKIE = "dwipa_user_session";
const ADMIN_SESSION_COOKIE = "dwipa_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dwipa-default-secret-change-me");
const DEFAULT_SIGNUP_CREDIT_USD = 0;
const DEFAULT_SIGNUP_CREDIT_LABEL = `$${DEFAULT_SIGNUP_CREDIT_USD}`;

const publicPlans = [
  {
    slug: "free",
    name: "Free",
    priceLabel: "Rp 0",
    periodLabel: null,
    includedCreditUsd: DEFAULT_SIGNUP_CREDIT_USD,
    windowHours: null,
    discountPercent: 0,
    description: `${DEFAULT_SIGNUP_CREDIT_LABEL} starting balance. Credits are added through manual top-ups.`,
    ctaLabel: "Start free",
    highlighted: false,
    billingType: "free",
    entitlements: [
      { label: "Starting balance", value: DEFAULT_SIGNUP_CREDIT_LABEL },
      { label: "Top-ups", value: "Manual approval" },
      { label: "Model access", value: "Standard catalog" },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    priceLabel: "Rp 50.000",
    periodLabel: "/ month",
    includedCreditUsd: 10,
    windowHours: 12,
    discountPercent: 0,
    description: "$10 credit every 12 hours with monthly billing.",
    ctaLabel: "Go Pro",
    highlighted: true,
    billingType: "recurring",
    entitlements: [
      { label: "Included credit", value: "$10 / 12h" },
      { label: "Billing", value: "Monthly renewal" },
      { label: "Workspace", value: "Priority access" },
    ],
  },
  {
    slug: "payg",
    name: "Pay as you go",
    priceLabel: "Usage based",
    periodLabel: null,
    includedCreditUsd: undefined,
    windowHours: null,
    discountPercent: 50,
    description: "50% discount for every model with top-up based usage.",
    ctaLabel: "Use PayG",
    highlighted: false,
    billingType: "metered",
    entitlements: [
      { label: "Discount", value: "50% per model" },
      { label: "Billing", value: "Manual top-up" },
      { label: "Flexibility", value: "No subscription" },
    ],
  },
];

function formatPrice(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  return `$${value.toFixed(2)} / 1M`;
}

function getProviderInfo(alias) {
  for (const p of Object.values(AI_PROVIDERS)) {
    if (p.alias === alias || p.id === alias) {
      return p;
    }
  }
  return null;
}

function inferCategory(modelId) {
  const id = modelId.toLowerCase();
  if (id.includes("codex") || id.includes("coder") || id.includes("code")) return "coding";
  if (id.includes("vision") || id.includes("vl") || id.includes("multimodal")) return "multimodal";
  if (id.includes("reasoning") || id.includes("thinking") || id.includes("r1")) return "reasoning";
  if (id.includes("haiku") || id.includes("mini") || id.includes("nano") || id.includes("flash")) return "fast";
  if (id.includes("opus") || id.includes("max") || id.includes("pro")) return "frontier";
  return "general";
}

function getContextWindow(modelId) {
  const map = {
    "claude-opus-4-6": "200K",
    "claude-opus-4-5-20251101": "200K",
    "claude-sonnet-4-6": "200K",
    "claude-sonnet-4-5-20250929": "200K",
    "claude-haiku-4-5-20251001": "200K",
    "claude-sonnet-4-20250514": "200K",
    "claude-opus-4-20250514": "200K",
    "claude-haiku-4.5": "200K",
    "claude-opus-4.1": "200K",
    "claude-opus-4.5": "200K",
    "claude-opus-4.6": "200K",
    "claude-sonnet-4": "200K",
    "claude-sonnet-4.5": "200K",
    "claude-sonnet-4.6": "200K",
    "gpt-3.5-turbo": "16K",
    "gpt-4": "128K",
    "gpt-4-turbo": "128K",
    "gpt-4o": "128K",
    "gpt-4o-mini": "128K",
    "gpt-4.1": "128K",
    "gpt-5": "128K",
    "gpt-5-mini": "128K",
    "gpt-5-codex": "128K",
    "gpt-5.1": "128K",
    "gpt-5.1-codex": "128K",
    "gpt-5.1-codex-mini": "128K",
    "gpt-5.1-codex-max": "128K",
    "gpt-5.2": "128K",
    "gpt-5.2-codex": "128K",
    "gpt-5.3-codex": "128K",
    "gpt-5.3-codex-xhigh": "128K",
    "gpt-5.3-codex-high": "128K",
    "gpt-5.3-codex-low": "128K",
    "gpt-5.3-codex-none": "128K",
    "gpt-5.3-codex-spark": "128K",
    "gpt-5.4": "128K",
    "gpt-5.4-mini": "128K",
    "gpt-5.4-nano": "128K",
    "o1": "200K",
    "o1-mini": "128K",
    "gemini-3-flash-preview": "1M",
    "gemini-3-pro-preview": "1M",
    "gemini-3.1-pro-low": "1M",
    "gemini-3.1-pro-high": "1M",
    "gemini-3-flash": "1M",
    "gemini-2.5-pro": "1M",
    "gemini-2.5-flash": "1M",
    "gemini-2.5-flash-lite": "1M",
    "qwen3-coder-plus": "256K",
    "qwen3-coder-flash": "256K",
    "vision-model": "256K",
    "coder-model": "256K",
    "kimi-k2": "256K",
    "kimi-k2-thinking": "256K",
    "kimi-k2.5": "256K",
    "kimi-k2.5-thinking": "256K",
    "kimi-latest": "256K",
    "deepseek-chat": "64K",
    "deepseek-reasoner": "64K",
    "deepseek-r1": "64K",
    "deepseek-v3.2-chat": "64K",
    "deepseek-v3.2-reasoner": "64K",
    "deepseek-v3": "64K",
    "deepseek-v3.1": "64K",
    "deepseek-v3.2": "64K",
    "glm-4.6": "128K",
    "glm-4.6v": "128K",
    "glm-4.7": "128K",
    "glm-5": "128K",
    "grok-code-fast-1": "128K",
    "oswe-vscode-prime": "128K",
    "gpt-oss-120b-medium": "128K",
    "minimax-m2.1": "256K",
    "minimax-m2.5": "256K",
    "minimax-m2.7": "256K",
    "MiniMax-M2.1": "256K",
    "MiniMax-M2.5": "256K",
    "MiniMax-M2.7": "256K",
    "auto": "—",
  };
  return map[modelId] || "128K";
}

function getSummary(modelName, providerName, category) {
  const summaries = {
    coding: "Code-focused model for agentic edits, generation, and tool-heavy flows.",
    reasoning: "Strong reasoning and document analysis for assistant and routing tasks.",
    multimodal: "Multimodal model for synthesis, planning, and vision workloads.",
    fast: "Fast, cost-efficient model for high-throughput and latency-sensitive tasks.",
    frontier: "Frontier-class model for demanding reasoning and production workloads.",
    general: "Balanced model for general-purpose APIs and product workloads.",
  };
  return summaries[category] || summaries.general;
}

function buildPublicModels() {
  const items = [];

  for (const [alias, models] of Object.entries(PROVIDER_MODELS)) {
    const providerInfo = getProviderInfo(alias);
    if (!providerInfo) continue;
    if (providerInfo.deprecated) continue;
    if (providerInfo.hidden) continue;

    // Only include LLM providers (default serviceKinds is ["llm"])
    const kinds = providerInfo.serviceKinds ?? ["llm"];
    if (!kinds.includes("llm")) continue;

    const providerName = providerInfo.name || alias;
    const providerCode = providerInfo.id || alias;

    for (const model of models) {
      if (!model || !model.id) continue;

      const modelIdFull = `${alias}/${model.id}`;
      const category = inferCategory(model.id);
      const pricing = MODEL_PRICING[model.id];

      items.push({
        slug: model.id.replace(/\//g, "-"),
        name: model.name || model.id,
        provider: providerName,
        providerCode: providerCode,
        summary: getSummary(model.name, providerName, category),
        contextWindow: getContextWindow(model.id),
        inputPrice: formatPrice(pricing?.input),
        outputPrice: formatPrice(pricing?.output),
        latency: "Low",
        modelId: modelIdFull,
        category,
      });
    }
  }

  return items;
}

let cachedPublicModels = null;

function getPublicModelCatalog() {
  if (!cachedPublicModels) {
    cachedPublicModels = buildPublicModelCatalog();
  }
  return cachedPublicModels;
}

function buildErrorBody(code, message, details = []) {
  return { error: { code, message, details } };
}

export function jsonResponse(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers });
}

export function errorResponse(status, code, message, details = []) {
  return jsonResponse(buildErrorBody(code, message, details), status);
}

function buildCookie(token, expiresAt) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${USER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${USER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function buildAdminCookie(token, expiresAt) {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function clearAdminSessionCookie() {
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.split("=");
        return [name, decodeURIComponent(rest.join("="))];
      }),
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function formatUsdAmount(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

async function isReservedDeletedEmail(email) {
  try {
    return await dbIsDeletedUserEmailReserved(email);
  } catch {
    return false;
  }
}

function buildUserProfile(email, overrides = {}) {
  const normalizedEmail = normalizeEmail(email);
  const localPart = normalizedEmail.split("@")[0] || "dwipa";
  const fullName = overrides.fullName || process.env.WEB_API_DEV_NAME || localPart;
  const planSlug = overrides.planSlug || process.env.WEB_API_DEV_PLAN || "free";
  const id = overrides.id || `dev_${Buffer.from(normalizedEmail).toString("base64url").slice(0, 16)}`;

  return {
    id,
    name: fullName,
    email: normalizedEmail,
    planSlug,
    creditBalanceUsd: Number.isFinite(Number(overrides.creditBalanceUsd))
      ? Number(overrides.creditBalanceUsd)
      : planSlug === "pro"
        ? 10
        : planSlug === "free"
          ? DEFAULT_SIGNUP_CREDIT_USD
          : 0,
    profile: {
      id,
      fullName,
      email: normalizedEmail,
      username: overrides.username || localPart,
      planSlug,
      avatarUrl: overrides.avatarUrl || null,
      company: overrides.company || null,
      timezone: overrides.timezone || "Asia/Makassar",
      bio: overrides.bio || null,
    },
  };
}

async function getStoredUser(email) {
  try {
    return await dbGetAuthUserByEmail(email);
  } catch {
    return null;
  }
}

async function ensurePersistedUser(email, overrides = {}) {
  const existing = await getStoredUser(email);
  if (existing) return existing;

  const configuredEmail = normalizeEmail(process.env.WEB_API_DEV_EMAIL);
  if (configuredEmail && configuredEmail === normalizeEmail(email)) {
    return dbCreateAuthUser({
      email,
      fullName: overrides.fullName || process.env.WEB_API_DEV_NAME,
      emailVerified: true,
    });
  }

  return dbCreateAuthUser({
    email,
    fullName: overrides.fullName,
    emailVerified: true,
  });
}

async function resolveUserProfile(email, overrides = {}) {
  const storedUser = await getStoredUser(email);
  if (storedUser) {
    return buildUserProfile(storedUser.email, {
      id: storedUser.id,
      fullName: storedUser.name,
      planSlug: storedUser.planSlug || "free",
      creditBalanceUsd: Number(storedUser.creditBalanceUsd || 0),
      username: storedUser.username || undefined,
      company: storedUser.company || undefined,
      timezone: storedUser.timezone || undefined,
      bio: storedUser.bio || undefined,
      avatarUrl: storedUser.avatarUrl || undefined,
      ...overrides,
    });
  }

  return buildUserProfile(email, overrides);
}

async function isValidPassword(email, password) {
  const storedUser = await getStoredUser(email);
  if (storedUser?.passwordHash) {
    return bcrypt.compare(password, storedUser.passwordHash);
  }

  const settings = await getSettings();
  const storedHash = settings?.password;

  if (storedHash) {
    return bcrypt.compare(password, storedHash);
  }

  const initialPassword = process.env.INITIAL_PASSWORD || "123456";
  return password === initialPassword;
}

async function signSession(email) {
  const user = await resolveUserProfile(email);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    planSlug: user.planSlug,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);

  return {
    token,
    expiresAt,
    user,
  };
}

async function signSessionForUser(user) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    planSlug: user.planSlug,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);

  return {
    token,
    expiresAt,
    user,
  };
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isValidAdminPassword(password) {
  const storedHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (!storedHash || !password) return false;

  if (storedHash.startsWith("sha256:")) {
    return storedHash === `sha256:${await sha256Hex(password)}`;
  }

  return false;
}

async function signAdminSession(email) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  const token = await new SignJWT({
    email,
    role: "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(SECRET);

  return {
    token,
    expiresAt,
    admin: {
      email,
    },
  };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email) {
  const [localPart, domain] = normalizeEmail(email).split("@");
  if (!localPart || !domain) return email;
  const visible = localPart.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
}

function shouldExposeDebugOtp(deliveryStatus) {
  if (String(process.env.WEB_API_DEV_EXPOSE_OTP || "").trim().toLowerCase() === "true") {
    return true;
  }
  return deliveryStatus !== "sent";
}

async function createOtpChallenge({ fullName, email, password, replaceChallengeId = null }) {
  const normalizedEmail = normalizeEmail(email);
  const challengeId = crypto.randomUUID();
  const otpCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const displayName = String(fullName || "").trim() || normalizedEmail.split("@")[0] || "dwipa";

  let delivery;
  try {
    delivery = await sendOtpEmail({
      to: normalizedEmail,
      fullName: displayName,
      otpCode,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send verification email.";
    return {
      ok: false,
      error: errorResponse(502, "email_delivery_failed", message),
    };
  }

  const challenge = {
    challengeId,
    fullName: displayName,
    email: normalizedEmail,
    password,
    otpCode,
    expiresAt,
  };
  await saveOtpChallenge(challenge);

  if (replaceChallengeId) {
    await deleteOtpChallenge(replaceChallengeId);
  }

  const response = {
    challengeId,
    channel: "email_otp",
    email: normalizedEmail,
    maskedDestination: maskEmail(normalizedEmail),
    expiresAt,
    retryAfterSeconds: 30,
    redirectTo: "/otp",
    delivery,
  };

  if (shouldExposeDebugOtp(delivery.status)) {
    response.debugOtp = otpCode;
  }

  return {
    ok: true,
    response,
  };
}

export async function getSession(request) {
  const token = parseCookies(request)[USER_SESSION_COOKIE];
  if (!token) {
    return { authenticated: false, expiresAt: null, user: null, profile: null };
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const email = normalizeEmail(payload.email);
    if (!email) {
      return { authenticated: false, expiresAt: null, user: null, profile: null };
    }

    await ensurePersistedUser(email, {
      fullName: typeof payload.name === "string" ? payload.name : undefined,
      planSlug: typeof payload.planSlug === "string" ? payload.planSlug : undefined,
      creditBalanceUsd: DEFAULT_SIGNUP_CREDIT_USD,
    });
    const storedUser = await getStoredUser(email);
    if (storedUser?.id) {
      await dbEnsureAuthUserSignupQuota(storedUser.id);
    }

    const user = await resolveUserProfile(email);
    return {
      authenticated: true,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        planSlug: user.planSlug,
        creditBalanceUsd: user.creditBalanceUsd,
      },
      profile: user.profile,
    };
  } catch {
    return { authenticated: false, expiresAt: null, user: null, profile: null };
  }
}

export async function getAdminSession(request) {
  const token = parseCookies(request)[ADMIN_SESSION_COOKIE];
  if (!token) {
    return { authenticated: false, expiresAt: null, admin: null };
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const email = normalizeEmail(payload.email);
    if (!email || payload.role !== "admin") {
      return { authenticated: false, expiresAt: null, admin: null };
    }

    return {
      authenticated: true,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      admin: { email },
    };
  } catch {
    return { authenticated: false, expiresAt: null, admin: null };
  }
}

export async function signIn(request) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const configuredEmail = normalizeEmail(process.env.WEB_API_DEV_EMAIL);
  let storedUser = await getStoredUser(email);

  if (!email || !password) {
    return errorResponse(400, "invalid_credentials", "Email atau password tidak valid.");
  }

  if (!storedUser && configuredEmail && configuredEmail !== email) {
    return errorResponse(401, "invalid_credentials", "Email atau password tidak valid.");
  }

  const validPassword = await isValidPassword(email, password);
  if (!validPassword) {
    return errorResponse(401, "invalid_credentials", "Email atau password tidak valid.");
  }

  if (!storedUser && configuredEmail && configuredEmail === email) {
    const passwordHash = await bcrypt.hash(password, 10);
    storedUser = await dbCreateAuthUser({
      email,
      fullName: process.env.WEB_API_DEV_NAME,
      passwordHash,
      emailVerified: true,
    });
  }

  const session = storedUser
    ? await signSessionForUser(await resolveUserProfile(storedUser.email))
    : await signSession(email);
  return jsonResponse(
    {
      session: {
        authenticated: true,
        expiresAt: session.expiresAt,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          planSlug: session.user.planSlug,
          creditBalanceUsd: session.user.creditBalanceUsd,
        },
        profile: session.user.profile,
      },
      redirectTo: "/settings/usage",
    },
    200,
    { "Set-Cookie": buildCookie(session.token, session.expiresAt) },
  );
}

export async function adminSignIn(request) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);

  if (!configuredEmail || !email || email !== configuredEmail || !(await isValidAdminPassword(password))) {
    return errorResponse(401, "invalid_admin_credentials", "Email atau password admin tidak valid.");
  }

  const session = await signAdminSession(email);
  return jsonResponse(
    {
      session: {
        authenticated: true,
        expiresAt: session.expiresAt,
        admin: session.admin,
      },
      redirectTo: "/admin",
    },
    200,
    { "Set-Cookie": buildAdminCookie(session.token, session.expiresAt) },
  );
}

export async function signUp(request) {
  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName || "").trim();
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const details = [];

  if (!fullName) {
    details.push({ field: "fullName", message: "Full name is required." });
  }
  if (!email) {
    details.push({ field: "email", message: "Email address is required." });
  }
  if (!password) {
    details.push({ field: "password", message: "Password is required." });
  } else if (password.length < 8) {
    details.push({ field: "password", message: "Password must be at least 8 characters." });
  }

  if (details.length > 0) {
    return errorResponse(400, "invalid_sign_up", "Check the highlighted fields and try again.", details);
  }

  if (await isReservedDeletedEmail(email)) {
    return errorResponse(409, "email_reserved", "This email cannot be used because the account was deleted by admin.");
  }

  if (await getStoredUser(email)) {
    return errorResponse(409, "email_taken", "This email is already registered.", [
      { field: "email", message: "This email is already registered." },
    ]);
  }

  const challenge = await createOtpChallenge({ fullName, email, password });
  if (!challenge.ok) {
    return challenge.error;
  }

  return jsonResponse(challenge.response);
}

export async function verifyOtp(request) {
  const body = await request.json().catch(() => null);
  const challengeId = String(body?.challengeId || "");
  const otpCode = String(body?.otpCode || "").replace(/\D/g, "").slice(0, 6);
  const challenge = await getOtpChallenge(challengeId);

  if (!challenge) {
    return errorResponse(404, "otp_not_found", "Verification code request not found.");
  }

  if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
    await deleteOtpChallenge(challengeId);
    return errorResponse(410, "otp_expired", "This verification code has expired. Request a new one.");
  }

  if (challenge.otpCode !== otpCode) {
    return errorResponse(401, "otp_invalid", "The verification code is not valid.");
  }

  if (await isReservedDeletedEmail(challenge.email)) {
    await deleteOtpChallenge(challengeId);
    return errorResponse(409, "email_reserved", "This email cannot be used because the account was deleted by admin.");
  }

  await deleteOtpChallenge(challengeId);
  const passwordHash = await bcrypt.hash(challenge.password, 10);
  const createdUser = await dbCreateAuthUser({
    email: challenge.email,
    fullName: challenge.fullName,
    passwordHash,
    emailVerified: true,
  });
  const user = await resolveUserProfile(createdUser.email);
  const session = await signSessionForUser(user);

  return jsonResponse(
    {
      session: {
        authenticated: true,
        expiresAt: session.expiresAt,
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          planSlug: session.user.planSlug,
          creditBalanceUsd: session.user.creditBalanceUsd,
        },
        profile: session.user.profile,
      },
      redirectTo: "/settings/usage",
    },
    200,
    { "Set-Cookie": buildCookie(session.token, session.expiresAt) },
  );
}

export async function resendOtp(request) {
  const body = await request.json().catch(() => null);
  const challengeId = String(body?.challengeId || "");
  const challenge = await getOtpChallenge(challengeId);

  if (!challenge) {
    return errorResponse(404, "otp_not_found", "Verification code request not found.");
  }

  if (await isReservedDeletedEmail(challenge.email)) {
    await deleteOtpChallenge(challengeId);
    return errorResponse(409, "email_reserved", "This email cannot be used because the account was deleted by admin.");
  }

  const nextChallenge = await createOtpChallenge({
    fullName: challenge.fullName,
    email: challenge.email,
    password: challenge.password,
    replaceChallengeId: challengeId,
  });
  if (!nextChallenge.ok) {
    return nextChallenge.error;
  }

  return jsonResponse(nextChallenge.response);
}

export function logout() {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export function adminLogout() {
  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearAdminSessionCookie() },
  });
}

export function getPublicPlans() {
  return jsonResponse({ plans: publicPlans });
}

export async function getPublicModels(request) {
  const url = request ? new URL(request.url) : null;
  const q = url?.searchParams.get("q")?.trim().toLowerCase() || "";
  const providerFilter = url?.searchParams.get("provider")?.trim() || "";
  const categoryFilter = url?.searchParams.get("category")?.trim() || "";
  const limit = parseInt(url?.searchParams.get("limit") || "50", 10);

  let items = [];

  try {
    const dbResult = await dbGetAdminModels();
    if (dbResult.items.length > 0) {
      items = dbResult.items
        .filter((m) => m.visibility === "visible" && m.accessState === "enabled")
        .map((m) => ({
          slug: m.slug,
          name: m.name,
          provider: m.provider,
          providerCode: m.providerCode,
          contextWindow: m.contextWindow,
          inputPrice: m.inputPrice,
          outputPrice: m.outputPrice,
          modelId: m.modelId,
        }));
    }
  } catch {
    // Database unavailable or ModelCatalog empty — return empty
  }

  // Admin ModelCatalog is source of truth — no static fallback

  if (q) {
    items = items.filter((m) =>
      [m.name, m.provider, m.modelId, m.category, m.summary].join(" ").toLowerCase().includes(q)
    );
  }

  if (providerFilter) {
    items = items.filter((m) => m.provider === providerFilter);
  }

  if (categoryFilter) {
    items = items.filter((m) => m.category === categoryFilter);
  }

  const total = items.length;
  const limitedItems = Number.isFinite(limit) && limit > 0 ? items.slice(0, limit) : items;

  return jsonResponse({ items: limitedItems, total });
}

export async function getUsage(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const userId = session.user.id;
  const planSlug = session.user.planSlug;
  const isPro = planSlug === "pro";
  const isPayg = planSlug === "payg";

  // Try to read live quota from the database (includes consumption from chat usage).
  let quota = null;
  try {
    quota = await dbGetUserActiveQuota(userId);
  } catch {
    // ignore — fall back to session balance below
  }

  const meters = [];

  // Plan-quota meter (Free / Pro): consumed / included
  if (quota && quota.planSlug !== "payg" && quota.includedCreditUsd > 0) {
    const consumed = quota.consumedCreditUsd;
    const included = quota.includedCreditUsd;
    const percent = Math.min(100, Math.max(0, Math.round((consumed / included) * 100)));
    meters.push({
      id: `${quota.planSlug}-quota`,
      label: quota.planName ? `${quota.planName} credit` : "Plan credit",
      description: quota.windowHours
        ? `Resets every ${quota.windowHours} hours.`
        : "Plan-included credit usage.",
      valueDisplay: formatUsdAmount(consumed),
      totalDisplay: formatUsdAmount(included),
      progressPercent: percent,
      resetsAt: quota.windowEnd,
      countdownText: quota.windowHours ? `Renews every ${quota.windowHours}h` : null,
    });
  }

  // PayG balance meter — value/total = remaining/(consumed+remaining) so progress reflects how much was used.
  let paygBalance = 0;
  try {
    paygBalance = await dbGetUserPaygCreditBalance(userId);
  } catch {
    paygBalance = 0;
  }

  if (isPayg || paygBalance > 0 || (!quota && !isPro)) {
    const sessionBalanceUsd = Number.isFinite(Number(session.user.creditBalanceUsd))
      ? Number(session.user.creditBalanceUsd)
      : 0;
    const remaining = paygBalance > 0 ? paygBalance : sessionBalanceUsd;
    meters.push({
      id: "credit-balance",
      label: isPayg ? "PayG balance" : "Credit balance",
      description: isPayg
        ? "Pay-as-you-go credit. Top up to add more."
        : "Credits added through approved manual payments.",
      valueDisplay: formatUsdAmount(remaining),
      totalDisplay: formatUsdAmount(remaining),
      progressPercent: remaining > 0 ? 100 : 0,
      resetsAt: null,
      countdownText: null,
    });
  }

  // Final fallback so the UI is never empty.
  if (meters.length === 0) {
    const balance = formatUsdAmount(0);
    meters.push({
      id: "credit-balance",
      label: "Credit balance",
      description: "No active plan or credit balance.",
      valueDisplay: balance,
      totalDisplay: balance,
      progressPercent: 0,
      resetsAt: null,
      countdownText: null,
    });
  }

  return jsonResponse({
    planSlug,
    canUpgrade: !isPro,
    meters,
  });
}

export async function getUsageRequests(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const keys = await getApiKeys();
  const visibleApiKeyIds = [];
  for (const key of keys) {
    if (key.isActive === false) continue;
    if (await canAccessApiKey(session.user, key)) {
      visibleApiKeyIds.push(key.id);
    }
  }

  const url = new URL(request.url);
  const limitParam = parseInt(url.searchParams.get("limit") || "10", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 10;
  const cursor = url.searchParams.get("cursor") || null;
  const hasTokens = url.searchParams.get("hasTokens") === "true";

  return jsonResponse(await listDevUsageRequests({
    userId: session.user.id,
    apiKeyIds: visibleApiKeyIds,
    limit,
    cursor,
    hasTokens,
  }));
}

function formatUsdAmountForUsage(value) {
  const amount = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function mapDevUsageItem(record, context = {}) {
  const userEmail = record.userId ? (context.userEmails?.get(record.userId) || null) : null;
  const keyLabel = record.appLabel || (record.apiKeyId ? (context.apiKeyLabels?.get(record.apiKeyId) || null) : null) || "API key";

  // Fallback: calculate cost from tokens if record.cost is missing or zero
  // but tokens are present (legacy records written before localDb.js fix).
  let chargedCostUsd = Number.isFinite(Number(record.cost)) ? Number(record.cost) : null;
  const hasTokens = record.tokens && (
    (record.tokens.prompt_tokens || record.tokens.input_tokens || 0) > 0 ||
    (record.tokens.completion_tokens || record.tokens.output_tokens || 0) > 0
  );
  if ((chargedCostUsd === null || chargedCostUsd === 0) && hasTokens) {
    const pricing = getPricingForModel(record.provider, record.model);
    if (pricing) {
      const recalculated = calculateCostFromTokens(record.tokens, pricing);
      if (recalculated > 0) chargedCostUsd = recalculated;
    }
  }
  if (chargedCostUsd === null || !Number.isFinite(chargedCostUsd)) {
    chargedCostUsd = 0;
  }

  const countedTowardQuotaUsd = 0;
  return {
    id: record.id,
    provider: record.provider || "dwipa",
    model: record.model || "unknown",
    appLabel: keyLabel,
    userEmail,
    status: record.status || "error",
    costDisplay: formatUsdAmountForUsage(chargedCostUsd),
    chargedCostDisplay: formatUsdAmountForUsage(chargedCostUsd),
    inputTokens: Number(record.tokens?.prompt_tokens || 0),
    outputTokens: Number(record.tokens?.completion_tokens || 0),
    latencyMs: Number(record.latency?.total || 0),
    createdAt: record.timestamp,
    charge: {
      chargedCostUsd,
      countedTowardQuotaUsd,
      planSlug: record.planSlug || undefined,
    },
  };
}

async function buildDevUsageContext(details = []) {
  const keys = await getApiKeys().catch(() => []);
  const apiKeyLabels = new Map(
    keys
      .filter((key) => key?.id)
      .map((key) => [key.id, key.name || key.label || "API key"]),
  );

  const userIds = [...new Set(details.map((detail) => detail?.userId).filter(Boolean))];
  const userEntries = await Promise.all(
    userIds.map(async (id) => {
      try {
        const response = await dbGetAdminUser(id);
        return [id, response?.user?.email || null];
      } catch {
        return [id, null];
      }
    }),
  );

  return {
    apiKeyLabels,
    userEmails: new Map(userEntries.filter((entry) => entry[1])),
  };
}

async function listDevUsageRequests({ userId = null, apiKeyIds = [], status = null, provider = null, model = null, hasTokens = null, limit = 10, cursor = null } = {}) {
  // Pull a generous page from the underlying store; we need to filter+paginate in JS
  // because the lowdb-backed store doesn't support userId filtering or cursor offsets.
  const { details } = await getRequestDetails({
    status,
    provider,
    model,
    page: 1,
    pageSize: 1000,
  });

  const filtered = details.filter((detail) => {
    if (userId) {
      const matchesUser = detail.userId === userId;
      const matchesOwnedKey = detail.apiKeyId && apiKeyIds.includes(detail.apiKeyId);
      if (!matchesUser && !matchesOwnedKey) return false;
    }
    if (status && detail.status !== status) return false;
    if (provider && detail.provider !== provider) return false;
    if (model && detail.model !== model) return false;
    if (hasTokens) {
      const input = Number(detail.tokens?.prompt_tokens || 0);
      const output = Number(detail.tokens?.completion_tokens || 0);
      if (input === 0 && output === 0) return false;
    }
    return true;
  });

  // Cursor = id of the last item from the previous page; skip everything up to and including it.
  let startIndex = 0;
  if (cursor) {
    const idx = filtered.findIndex((detail) => detail.id === cursor);
    startIndex = idx >= 0 ? idx + 1 : 0;
  }

  const pageRecords = filtered.slice(startIndex, startIndex + limit);
  const context = await buildDevUsageContext(filtered);
  const items = pageRecords.map((record) => mapDevUsageItem(record, context));
  const hasMore = startIndex + limit < filtered.length;
  const nextCursor = hasMore && pageRecords.length > 0 ? pageRecords[pageRecords.length - 1].id : null;

  const summary = filtered.reduce((accumulator, detail) => {
    accumulator.requests += 1;
    accumulator.inputTokens += Number(detail.tokens?.prompt_tokens || 0);
    accumulator.outputTokens += Number(detail.tokens?.completion_tokens || 0);
    let cost = Number.isFinite(Number(detail.cost)) ? Number(detail.cost) : null;
    const detailHasTokens = detail.tokens && (
      (detail.tokens.prompt_tokens || detail.tokens.input_tokens || 0) > 0 ||
      (detail.tokens.completion_tokens || detail.tokens.output_tokens || 0) > 0
    );
    if ((cost === null || cost === 0) && detailHasTokens) {
      const pricing = getPricingForModel(detail.provider, detail.model);
      if (pricing) {
        const recalculated = calculateCostFromTokens(detail.tokens, pricing);
        if (recalculated > 0) cost = recalculated;
      }
    }
    accumulator.chargedCost += Number.isFinite(Number(cost)) ? Number(cost) : 0;
    if ((detail.status || "success") !== "success") accumulator.failedRequests += 1;
    return accumulator;
  }, { requests: 0, inputTokens: 0, outputTokens: 0, chargedCost: 0, failedRequests: 0 });

  const chartMap = new Map();
  for (const detail of filtered) {
    const label = String(detail.timestamp || "").slice(0, 10);
    if (!label) continue;
    const current = chartMap.get(label) || { requests: 0, tokens: 0, cost: 0 };
    current.requests += 1;
    current.tokens += Number(detail.tokens?.prompt_tokens || 0) + Number(detail.tokens?.completion_tokens || 0);
    let chartCost = Number.isFinite(Number(detail.cost)) ? Number(detail.cost) : null;
    const chartHasTokens = detail.tokens && (
      (detail.tokens.prompt_tokens || detail.tokens.input_tokens || 0) > 0 ||
      (detail.tokens.completion_tokens || detail.tokens.output_tokens || 0) > 0
    );
    if ((chartCost === null || chartCost === 0) && chartHasTokens) {
      const pricing = getPricingForModel(detail.provider, detail.model);
      if (pricing) {
        const recalculated = calculateCostFromTokens(detail.tokens, pricing);
        if (recalculated > 0) chartCost = recalculated;
      }
    }
    current.cost += Number.isFinite(Number(chartCost)) ? Number(chartCost) : 0;
    chartMap.set(label, current);
  }

  const chartEntries = [...chartMap.entries()].sort(([left], [right]) => left.localeCompare(right));
  return {
    items,
    nextCursor,
    summary: {
      requests: summary.requests,
      inputTokens: summary.inputTokens,
      outputTokens: summary.outputTokens,
      chargedCost: formatUsdAmountForUsage(summary.chargedCost),
      failedRequests: summary.failedRequests,
      averageLatency: "-",
    },
    charts: {
      requests: chartEntries.map(([label, value]) => ({ label, value: value.requests })),
      tokens: chartEntries.map(([label, value]) => ({ label, value: value.tokens })),
      cost: chartEntries.map(([label, value]) => ({ label, value: value.cost })),
    },
  };
}

function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return key;
  return `${key.slice(0, 14)}...`;
}

function mapApiKey(key) {
  return {
    id: key.id,
    label: key.name || "API key",
    maskedKey: maskKey(key.key),
    usageMode: key.usageMode || "both",
    createdAt: key.createdAt || new Date().toISOString(),
    lastUsedAt: key.lastUsedAt || null,
  };
}

async function isLegacySessionUser(user) {
  if (!user?.email) return false;
  const configuredEmail = normalizeEmail(process.env.WEB_API_DEV_EMAIL);
  return Boolean(configuredEmail && normalizeEmail(user.email) === configuredEmail);
}

async function canAccessApiKey(user, key) {
  if (!user || !key) return false;
  if (key.userId === user.id) return true;
  if (!key.userId && (await isLegacySessionUser(user))) return true;
  return false;
}

export async function listKeys(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const keys = await getApiKeys();
  const visibleKeys = [];
  for (const key of keys) {
    if (key.isActive === false) continue;
    if (await canAccessApiKey(session.user, key)) {
      visibleKeys.push(key);
    }
  }

  return jsonResponse({
    keys: visibleKeys.map(mapApiKey),
  });
}

export async function createKey(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const body = await request.json().catch(() => null);
  const label = String(body?.label || "").trim();
  const usageMode = body?.usageMode || "both";

  if (!label) {
    return errorResponse(400, "invalid_key", "Key label is required.", [{ field: "label", message: "Key label is required." }]);
  }

  const machineId = await getConsistentMachineId();
  const created = await createApiKey(label, machineId, session.user.id);
  if (usageMode && usageMode !== "both") {
    await updateApiKey(created.id, { usageMode });
  }

  return jsonResponse({
    key: mapApiKey({ ...created, usageMode }),
    secret: created.key,
  });
}

export async function patchKey(request, keyId) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const body = await request.json().catch(() => null);
  const existing = await getApiKeyById(keyId);
  if (!existing || !(await canAccessApiKey(session.user, existing))) {
    return errorResponse(404, "not_found", "API key not found.");
  }

  const updated = await updateApiKey(keyId, { usageMode: body?.usageMode || "both" });
  return jsonResponse({ key: mapApiKey(updated) });
}

export async function removeKey(request, keyId) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const existing = await getApiKeyById(keyId);
  if (!existing || !(await canAccessApiKey(session.user, existing))) {
    return errorResponse(404, "not_found", "API key not found.");
  }

  const deleted = await deleteApiKey(keyId);
  if (!deleted) {
    return errorResponse(404, "not_found", "API key not found.");
  }

  return new Response(null, { status: 204 });
}

export async function getBilling(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const isPro = session.user.planSlug === "pro";
  const paygBalanceUsd = await dbGetUserPaygCreditBalance(session.user.id).catch(() => 0);
  const paymentDestination = {
    provider: "qris",
    displayName: "QRIS",
    accountNumber: "087889640714",
    accountHolderName: "Dwipa",
    instructions: "Scan the QRIS image, pay the exact amount, then confirm it through WhatsApp for manual approval.",
    isActive: true,
    updatedAt: nowIso(),
  };

  return jsonResponse({
    subscription: isPro
      ? {
          id: "sub_dev_pro",
          planSlug: "pro",
          planName: "Pro",
          status: "active",
          autoRenew: true,
          renewsAt: null,
          price: {
            currency: "IDR",
            amount: 50000,
            interval: "month",
          },
        }
      : null,
    creditBalance: {
      currency: "USD",
      amount: paygBalanceUsd,
      displayValue: formatUsdAmount(paygBalanceUsd),
    },
    paymentDestination,
    availableActions: {
      canManageRenewal: isPro,
      canAddFunds: true,
      canCreateManualPayment: true,
    },
  });
}

export async function updateSubscription(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  if (session.user.planSlug !== "pro") {
    return errorResponse(409, "subscription_unavailable", "An active Dwipa Pro subscription is required.");
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "renew" && action !== "cancel") {
    return errorResponse(400, "invalid_request", "Action must be either renew or cancel.", [
      { field: "action", message: "Action must be either renew or cancel." },
    ]);
  }

  return jsonResponse({
    id: "sub_dev_pro",
    planSlug: "pro",
    planName: "Pro",
    status: action === "cancel" ? "renew_off" : "active",
    autoRenew: action === "renew",
    renewsAt: null,
    price: {
      currency: "IDR",
      amount: 50000,
      interval: "month",
    },
  });
}

export async function createManualPayment(request) {
  const session = await getSession(request);
  if (!session.authenticated || !session.user) {
    return errorResponse(401, "unauthorized", "Session is required.");
  }

  const body = await request.json().catch(() => null);
  const purpose = body?.purpose;

  if (purpose !== "upgrade_plan" && purpose !== "add_funds") {
    return errorResponse(400, "invalid_request", "Purpose must be upgrade_plan or add_funds.", [
      { field: "purpose", message: "Purpose must be upgrade_plan or add_funds." },
    ]);
  }

  if (purpose === "upgrade_plan" && body?.planSlug !== "pro") {
    return errorResponse(400, "invalid_request", "Only the Pro plan can be requested from this flow.", [
      { field: "planSlug", message: "Only the Pro plan can be requested from this flow." },
    ]);
  }

  const parsedAmountMinor = Number(body?.amountMinor);
  const amountMinor =
    purpose === "upgrade_plan"
      ? 50000
      : Number.isInteger(parsedAmountMinor) && parsedAmountMinor > 0
        ? parsedAmountMinor
        : null;

  if (purpose === "add_funds" && amountMinor === null) {
    return errorResponse(400, "invalid_request", "Amount must be a positive integer.", [
      { field: "amountMinor", message: "Amount must be a positive integer." },
    ]);
  }

  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
  try {
    const payment = await dbCreateManualPayment({
      userId: session.user.id,
      purpose,
      planSlug: purpose === "upgrade_plan" ? "pro" : null,
      amountMinor,
      currency: "IDR",
      notes,
    });
    return jsonResponse(
      {
        payment,
      },
      201,
    );
  } catch (error) {
    console.error("Failed to persist manual payment.", {
      userId: session.user.id,
      purpose,
      planSlug: purpose === "upgrade_plan" ? "pro" : null,
      amountMinor,
      error: error instanceof Error ? error.message : String(error),
    });

    return errorResponse(
      503,
      "manual_payment_unavailable",
      "Manual payment could not be created right now. Please try again after the billing service is available.",
    );
  }
}

async function requireAdminSession(request) {
  const session = await getAdminSession(request);
  if (!session.authenticated || !session.admin) {
    return null;
  }
  return session;
}

function nowIso() {
  return new Date().toISOString();
}

export async function getAdminOverview(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminOverview());
}

export async function getAdminPayments(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminPayments(request));
}

export async function getAdminPayment(request, paymentId) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminPayment(paymentId));
}

export async function approveAdminPayment(request, paymentId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const result = await dbApproveAdminPayment(paymentId, adminSession.admin.email);
  if (!result) {
    return errorResponse(404, "not_found", "Payment not found or can no longer be approved.");
  }
  return jsonResponse(result);
}

export async function rejectAdminPayment(request, paymentId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  if (!String(body?.reason || "").trim()) {
    return errorResponse(400, "invalid_request", "Rejection reason is required.");
  }

  const result = await dbRejectAdminPayment(paymentId, body, adminSession.admin.email);
  if (!result) {
    return errorResponse(404, "not_found", "Payment not found or can no longer be rejected.");
  }
  return jsonResponse(result);
}

export async function getAdminUsers(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminUsers(request));
}

export async function getAdminUser(request, userId) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminUser(userId));
}

export async function updateAdminUser(request, userId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const name = String(body?.name || "").trim();
  const planSlug = String(body?.planSlug || "").trim();
  const reason = String(body?.reason || "").trim();

  if (!email) {
    return errorResponse(400, "invalid_request", "Email is required.");
  }
  if (!name) {
    return errorResponse(400, "invalid_request", "Name is required.");
  }
  if (!planSlug) {
    return errorResponse(400, "invalid_request", "Plan is required.");
  }
  if (!reason) {
    return errorResponse(400, "invalid_request", "Reason is required.");
  }

  let result;
  try {
    result = await dbUpdateAdminUser(userId, { email, name, planSlug, reason }, adminSession.admin.email);
  } catch (error) {
    if (error?.code === "email_reserved") {
      return errorResponse(409, "email_reserved", error.message);
    }
    throw error;
  }
  if (!result?.user) {
    return errorResponse(404, "not_found", "User not found.");
  }
  return jsonResponse({ user: result.user });
}

export async function addAdminUserPaygCredit(request, userId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  if (!Number.isFinite(body?.amountMinor) || body.amountMinor <= 0) {
    return errorResponse(400, "invalid_request", "Credit amount must be positive.");
  }
  if (!String(body?.reason || "").trim()) {
    return errorResponse(400, "invalid_request", "Reason is required.");
  }

  try {
    const result = await dbAddAdminUserPaygCredit(userId, body, adminSession.admin.email);
    if (!result) {
      return errorResponse(404, "not_found", "User not found.");
    }
    return jsonResponse(result);
  } catch (error) {
    return errorResponse(400, "invalid_request", error instanceof Error ? error.message : "Unable to adjust PayG credit.");
  }
}

export async function changeAdminUserSubscription(request, userId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  if (!String(body?.targetPlanSlug || "").trim()) {
    return errorResponse(400, "invalid_request", "Target plan is required.");
  }
  if (!String(body?.reason || "").trim()) {
    return errorResponse(400, "invalid_request", "Reason is required.");
  }

  const result = await dbChangeAdminUserSubscription(userId, body, adminSession.admin.email);
  if (!result) {
    return errorResponse(404, "not_found", "User or target plan not found.");
  }
  return jsonResponse(result);
}

export async function banAdminUser(request, userId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  const reason = String(body?.reason || "").trim();
  if (!reason) {
    return errorResponse(400, "invalid_request", "Reason is required.");
  }

  const result = await dbToggleAdminUserBan(userId, reason, adminSession.admin.email);
  if (!result) {
    return errorResponse(404, "not_found", "User not found.");
  }
  return jsonResponse(result);
}

export async function deleteAdminUser(request, userId) {
  const adminSession = await requireAdminSession(request);
  if (!adminSession) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  const reason = String(body?.reason || "").trim();
  if (!reason) {
    return errorResponse(400, "invalid_request", "Reason is required.");
  }

  const result = await dbDeleteAdminUser(userId, reason, adminSession.admin.email);
  if (!result) {
    return errorResponse(404, "not_found", "User not found.");
  }
  return jsonResponse(result);
}

export async function getAdminUsageRequests(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const url = new URL(request.url);
  return jsonResponse(await listDevUsageRequests({
    userId: url.searchParams.get("userId") || null,
    status: url.searchParams.get("status") || null,
    provider: url.searchParams.get("provider") || null,
    model: url.searchParams.get("model") || null,
    hasTokens: url.searchParams.get("hasTokens") === "true",
    limit: Number(url.searchParams.get("limit") || 10),
  }));
}

export async function resetAdminUsage(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const [usageOk, detailsOk] = await Promise.all([
    resetUsageDb(),
    resetRequestDetailsDb(),
  ]);

  return jsonResponse({
    success: usageOk && detailsOk,
    usageReset: usageOk,
    detailsReset: detailsOk,
  });
}

export async function getAdminModels(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  try {
    const dbResult = await dbGetAdminModels();
    if (dbResult.items.length > 0) {
      return jsonResponse(dbResult);
    }
  } catch {
    // Database unavailable or ModelCatalog empty — fall back to config catalog
  }

  const items = getPublicModelCatalog().map((m) => ({
    id: m.slug,
    slug: m.slug,
    name: m.name,
    provider: m.provider,
    providerCode: m.providerCode,
    summary: "",
    contextWindow: m.contextWindow,
    inputPrice: m.inputPrice,
    outputPrice: m.outputPrice,
    latency: "",
    modelId: m.modelId,
    category: "general",
    visibility: "visible",
    accessState: "enabled",
    allowedPlanSlugs: ["free", "pro", "payg"],
    updatedAt: new Date().toISOString(),
  }));

  return jsonResponse({
    items,
    nextCursor: null,
    summary: {
      totalModels: items.length,
      visibleModels: items.length,
      hiddenModels: 0,
      enabledModels: items.length,
      disabledModels: 0,
      providersCount: new Set(items.map((m) => m.provider)).size,
      missingPricing: items.filter((m) => m.inputPrice === "—" || m.outputPrice === "—").length,
    },
  });
}

export async function createAdminModel(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  const result = await dbCreateAdminModel(body);
  if (!result) return errorResponse(400, "invalid_model", "Model payload is incomplete.");
  return jsonResponse({ model: result, modelId: result.id }, 201);
}

export async function deleteAdminModel(request, modelId) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const result = await dbDeleteAdminModel(modelId);
  if (!result) return errorResponse(404, "not_found", "Model not found.");
  return jsonResponse(result);
}

export async function updateAdminModel(request, modelId) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const body = await request.json().catch(() => null);
  const result = await dbUpdateAdminModel(modelId, body);
  if (!result) return errorResponse(404, "not_found", "Model not found.");
  return jsonResponse({ model: result, modelId: result.id }, 200);
}

export async function enableAdminModel(request, modelId) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const result = await dbEnableAdminModel(modelId);
  if (!result) return errorResponse(404, "not_found", "Model not found.");
  return jsonResponse({ model: result, modelId: result.id }, 200);
}

export async function disableAdminModel(request, modelId) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  const result = await dbDisableAdminModel(modelId);
  if (!result) return errorResponse(404, "not_found", "Model not found.");
  return jsonResponse({ model: result, modelId: result.id }, 200);
}

export async function getAdminPlans(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminPlans());
}

export async function getAdminAuditEvents(request) {
  if (!(await requireAdminSession(request))) {
    return errorResponse(401, "admin_unauthorized", "Admin session is required.");
  }

  return jsonResponse(await dbGetAdminAuditEvents(request));
}
