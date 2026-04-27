import { errorResponse } from "../utils/jsonResponse.js";
import { incrementCounter, resetCounter } from "./adminRedis.js";

const ADMIN_SESSION_COOKIE = "dwipa_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const fallbackSessions = new Map();

function parseCookieHeader(cookieHeader) {
  const cookies = new Map();
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) continue;
    cookies.set(name, decodeURIComponent(rest.join("=")));
  }

  return cookies;
}

function getAdminSecret(env) {
  const secret = env.ADMIN_SESSION_SECRET || env.API_KEY_SECRET;
  if (secret) return secret;
  if (env.ENVIRONMENT === "development" || env.NODE_ENV === "development") return "dwipa-admin-development-secret";
  throw new Error("ADMIN_SESSION_SECRET is required for admin sessions.");
}

const ADMIN_LOGIN_FAILURE_TTL_SECONDS = 300;
const ADMIN_LOGIN_FAILURE_LIMIT = 5;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function adminLoginFailureKey(email) {
  return `admin:auth:fail:${normalizeEmail(email)}`;
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  if (storedHash.startsWith("sha256:")) {
    return `sha256:${await sha256(password)}` === storedHash;
  }
  return false;
}

async function findAdminCredential(email, env) {
  const normalizedEmail = email.trim().toLowerCase();

  if (env.DB) {
    const row = await env.DB.prepare("SELECT email, passwordHash FROM admin_credentials WHERE lower(email) = ?")
      .bind(normalizedEmail)
      .first();
    if (row) return row;
  }

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH && env.ADMIN_EMAIL.toLowerCase() === normalizedEmail) {
    return {
      email: env.ADMIN_EMAIL,
      passwordHash: env.ADMIN_PASSWORD_HASH
    };
  }

  return null;
}

async function createSessionId(email, env) {
  const random = crypto.randomUUID();
  const signature = await sha256(`${random}:${email}:${getAdminSecret(env)}`);
  return `${random}.${signature.slice(0, 24)}`;
}

function getSessionCookie(request) {
  return parseCookieHeader(request.headers.get("Cookie")).get(ADMIN_SESSION_COOKIE) || null;
}

async function persistSession(sessionId, session, env) {
  if (env.ADMIN_SESSIONS?.put) {
    await env.ADMIN_SESSIONS.put(sessionId, JSON.stringify(session), { expirationTtl: Math.ceil(SESSION_TTL_MS / 1000) });
    return;
  }

  fallbackSessions.set(sessionId, session);
}

async function readSession(sessionId, env) {
  if (!sessionId) return null;

  if (env.ADMIN_SESSIONS?.get) {
    const raw = await env.ADMIN_SESSIONS.get(sessionId);
    return raw ? JSON.parse(raw) : null;
  }

  return fallbackSessions.get(sessionId) || null;
}

async function deleteSession(sessionId, env) {
  if (!sessionId) return;

  if (env.ADMIN_SESSIONS?.delete) {
    await env.ADMIN_SESSIONS.delete(sessionId);
    return;
  }

  fallbackSessions.delete(sessionId);
}

function secureCookiePart(env) {
  return env.ENVIRONMENT === "development" || env.NODE_ENV === "development" ? "" : "; Secure";
}

function buildCookie(sessionId, expiresAt, env) {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secureCookiePart(env)}`;
}

export function clearAdminSessionCookie(env = {}) {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookiePart(env)}`;
}

export async function signInAdmin(email, password, env) {
  const failureKey = adminLoginFailureKey(email);
  const attempts = await incrementCounter(env, failureKey, ADMIN_LOGIN_FAILURE_TTL_SECONDS);
  if (attempts > ADMIN_LOGIN_FAILURE_LIMIT) return { throttled: true };

  const credential = await findAdminCredential(email, env);
  const isValid = credential ? await verifyPassword(password, credential.passwordHash) : false;

  if (!isValid) return null;

  await resetCounter(env, failureKey);

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session = {
    email: credential.email,
    expiresAt
  };
  const sessionId = await createSessionId(credential.email, env);
  await persistSession(sessionId, session, env);

  return {
    sessionId,
    cookie: buildCookie(sessionId, expiresAt, env),
    response: {
      authenticated: true,
      expiresAt,
      admin: {
        email: credential.email
      }
    }
  };
}

export async function getAdminSession(request, env) {
  const sessionId = getSessionCookie(request);
  const session = await readSession(sessionId, env);

  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    if (sessionId) await deleteSession(sessionId, env);
    return {
      authenticated: false,
      expiresAt: null,
      admin: null
    };
  }

  return {
    authenticated: true,
    expiresAt: session.expiresAt,
    admin: {
      email: session.email
    }
  };
}

export async function logoutAdmin(request, env) {
  await deleteSession(getSessionCookie(request), env);
}

export async function requireAdmin(request, env) {
  const session = await getAdminSession(request, env);
  if (!session.authenticated || !session.admin) {
    return {
      session,
      response: errorResponse(401, "admin_unauthorized", "Admin session is required.")
    };
  }

  return { session, response: null };
}
