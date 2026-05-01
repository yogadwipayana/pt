import { getModelInfoCore } from "open-sse/services/model.js";
import { handleChatCore } from "open-sse/handlers/chatCore.js";
import { errorResponse } from "open-sse/utils/error.js";
import { checkFallbackError, isAccountUnavailable, getUnavailableUntil, getEarliestRateLimitedUntil, formatRetryAfter } from "open-sse/services/accountFallback.js";
import { MAX_RATE_LIMIT_COOLDOWN_MS } from "open-sse/config/errorConfig.js";
import { getComboModelsFromData, handleComboChat } from "open-sse/services/combo.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";
import * as log from "../utils/logger.js";
import { refreshTokenByProvider } from "../services/tokenRefresh.js";
import { parseApiKey, extractBearerToken } from "../utils/apiKey.js";
import { getEnabledModel, modelCatalogHasRows } from "../services/adminRepository.js";
import { getMachineData, saveMachineData } from "../services/storage.js";
import { saveRequestUsage } from "../services/usageDb.js";

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

async function getModelInfo(modelStr, machineId, env) {
  const data = await getMachineData(machineId, env);
  return getModelInfoCore(modelStr, data?.modelAliases || {});
}

/**
 * Handle chat request
 * @param {Request} request
 * @param {Object} env
 * @param {Object} ctx
 * @param {string|null} machineIdOverride - machineId from URL (old format) or null (new format - extract from key)
 */
export async function handleChat(request, env, ctx, machineIdOverride = null) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  // Determine machineId: from URL (old) or from API key (new)
  let machineId = machineIdOverride;
  
  if (!machineId) {
    // New format: extract machineId from API key
    const apiKey = extractBearerToken(request);
    if (!apiKey) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    
    const parsed = await parseApiKey(apiKey);
    if (!parsed) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key format");
    
    if (!parsed.isNewFormat || !parsed.machineId) {
      return errorResponse(HTTP_STATUS.BAD_REQUEST, "API key does not contain machineId. Use /{machineId}/v1/... endpoint for old format keys.");
    }
    
    machineId = parsed.machineId;
  }

  const apiKeyContext = await validateApiKey(request, machineId, env);
  if (!apiKeyContext) {
    return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  log.info("CHAT", `${machineId} | ${body.model}`, { stream: body.stream !== false });

  const modelStr = body.model;
  if (!modelStr) return errorResponse(HTTP_STATUS.BAD_REQUEST, "Missing model");

  // Check if model is a combo
  const data = await getMachineData(machineId, env);
  const comboModels = getComboModelsFromData(modelStr, data?.combos || []);
  
  if (comboModels) {
    log.info("COMBO", `"${modelStr}" with ${comboModels.length} models`);
    return handleComboChat({
      body,
      models: comboModels,
      handleSingleModel: (reqBody, model) => handleSingleModelChat({ ...reqBody, apiKeyContext }, model, machineId, env),
      log
    });
  }

  // Restrict to dwipa (combo) models only
  log.warn("CHAT", "Model not found (dwipa only)", { model: modelStr });
  return errorResponse(HTTP_STATUS.NOT_FOUND, "Model not found");
}

/**
 * Handle single model chat request
 */
async function handleSingleModelChat(body, modelStr, machineId, env) {
  const startedAt = Date.now();
  const modelInfo = await getModelInfo(modelStr, machineId, env);
  if (!modelInfo.provider) return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid model format");

  const { provider, model } = modelInfo;
  if (await modelCatalogHasRows(env)) {
    const access = await getEnabledModel(env, modelStr, body.apiKeyContext?.planSlug);
    if (!access.allowed) {
      await saveRequestUsage(env, { requestId: crypto.randomUUID(), machineId, ...body.apiKeyContext, provider, model, status: "rejected", errorCode: access.reason, latencyMs: Date.now() - startedAt });
      return errorResponse(HTTP_STATUS.BAD_REQUEST, access.reason);
    }
  }
  log.info("MODEL", `${provider.toUpperCase()} | ${model}`);

  let excludeConnectionId = null;
  let lastError = null;
  let lastStatus = null;

  while (true) {
    const credentials = await getProviderCredentials(machineId, provider, env, excludeConnectionId);
    if (!credentials || credentials.allRateLimited) {
      if (credentials?.allRateLimited) {
        const retryAfterSec = Math.ceil((new Date(credentials.retryAfter).getTime() - Date.now()) / 1000);
        const errorMsg = lastError || credentials.lastError || "Unavailable";
        const msg = `[${provider}/${model}] ${errorMsg} (${credentials.retryAfterHuman})`;
        const status = lastStatus || Number(credentials.lastErrorCode) || HTTP_STATUS.SERVICE_UNAVAILABLE;
        log.warn("CHAT", `${provider.toUpperCase()} | ${msg}`);
        return new Response(
          JSON.stringify({ error: { message: msg } }),
          { status, headers: { "Content-Type": "application/json", "Retry-After": String(Math.max(retryAfterSec, 1)) } }
        );
      }
      if (!excludeConnectionId) {
        return errorResponse(HTTP_STATUS.BAD_REQUEST, `No credentials for provider: ${provider}`);
      }
      log.warn("CHAT", `${provider.toUpperCase()} | no more accounts`);
      return new Response(
        JSON.stringify({ error: lastError || "All accounts unavailable" }),
        { status: lastStatus || HTTP_STATUS.SERVICE_UNAVAILABLE, headers: { "Content-Type": "application/json" } }
      );
    }

    log.debug("CHAT", `account=${credentials.id}`, { provider });

    const refreshedCredentials = await checkAndRefreshToken(machineId, provider, credentials, env);
    
    // Use shared chatCore
    const result = await handleChatCore({
      body,
      modelInfo: { provider, model },
      credentials: refreshedCredentials,
      log,
      onCredentialsRefreshed: async (newCreds) => {
        await updateCredentials(machineId, credentials.id, newCreds, env);
      },
      onRequestSuccess: async () => {
        // Clear error status only if currently has error (optimization)
        await clearAccountError(machineId, credentials.id, credentials, env);
      }
    });

    if (result.success) {
      await saveRequestUsage(env, { requestId: crypto.randomUUID(), machineId, ...body.apiKeyContext, provider, model, status: "success", latencyMs: Date.now() - startedAt });
      return result.response;
    }

    const { shouldFallback } = checkFallbackError(result.status, result.error);

    if (shouldFallback) {
      log.warn("FALLBACK", `${provider.toUpperCase()} | ${credentials.id} | ${result.status}`);
      await markAccountUnavailable(machineId, credentials.id, result.status, result.error, env, result.resetsAtMs);
      excludeConnectionId = credentials.id;
      lastError = result.error;
      lastStatus = result.status;
      continue;
    }

    await saveRequestUsage(env, { requestId: crypto.randomUUID(), machineId, ...body.apiKeyContext, provider, model, status: "failed", errorCode: String(result.status || "provider_error"), latencyMs: Date.now() - startedAt });
    return result.response;
  }
}

async function checkAndRefreshToken(machineId, provider, credentials, env) {
  if (!credentials.expiresAt) return credentials;

  const expiresAt = new Date(credentials.expiresAt).getTime();
  if (expiresAt - Date.now() >= TOKEN_EXPIRY_BUFFER_MS) return credentials;

  log.debug("TOKEN", `${provider.toUpperCase()} | expiring, refreshing`);

  const newCredentials = await refreshTokenByProvider(provider, credentials);
  if (newCredentials?.accessToken) {
    await updateCredentials(machineId, credentials.id, newCredentials, env);
    return {
      ...credentials,
      accessToken: newCredentials.accessToken,
      refreshToken: newCredentials.refreshToken || credentials.refreshToken,
      expiresAt: newCredentials.expiresIn
        ? new Date(Date.now() + newCredentials.expiresIn * 1000).toISOString()
        : credentials.expiresAt
    };
  }

  return credentials;
}

async function validateApiKey(request, machineId, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const apiKey = authHeader.slice(7);
  const data = await getMachineData(machineId, env);
  const machineKey = data?.apiKeys?.find(k => k.key === apiKey && k.isActive !== false && !k.revokedAt);
  if (!machineKey) return null;
  const dbKey = env.DB ? await env.DB.prepare("SELECT k.id, k.userId, u.planSlug FROM api_keys k LEFT JOIN users u ON u.id = k.userId WHERE k.machineId = ? AND (k.maskedKey = ? OR k.label = ?) AND k.revokedAt IS NULL")
    .bind(machineId, machineKey.maskedKey || "", machineKey.label || machineKey.name || "")
    .first() : null;
  if (env.DB && !dbKey) return null;
  return { apiKeyId: dbKey?.id || null, userId: dbKey?.userId || machineKey.userId || null, planSlug: dbKey?.planSlug || machineKey.planSlug || null };
}

async function getProviderCredentials(machineId, provider, env, excludeConnectionId = null) {
  const data = await getMachineData(machineId, env);
  if (!data?.providers) return null;

  const providerConnections = Object.entries(data.providers)
    .filter(([connId, conn]) => {
      if (conn.provider !== provider || !conn.isActive) return false;
      if (excludeConnectionId && connId === excludeConnectionId) return false;
      if (isAccountUnavailable(conn.rateLimitedUntil)) return false;
      return true;
    })
    .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999));

  if (providerConnections.length === 0) {
    // Check if accounts exist but all rate limited
    const allConnections = Object.entries(data.providers)
      .filter(([, conn]) => conn.provider === provider && conn.isActive)
      .map(([, conn]) => conn);
    const earliest = getEarliestRateLimitedUntil(allConnections);
    if (earliest) {
      const rateLimitedConns = allConnections.filter(c => c.rateLimitedUntil && new Date(c.rateLimitedUntil).getTime() > Date.now());
      const earliestConn = rateLimitedConns.sort((a, b) => new Date(a.rateLimitedUntil) - new Date(b.rateLimitedUntil))[0];
      return {
        allRateLimited: true,
        retryAfter: earliest,
        retryAfterHuman: formatRetryAfter(earliest),
        lastError: earliestConn?.lastError || null,
        lastErrorCode: earliestConn?.errorCode || null
      };
    }
    return null;
  }

  const [connectionId, connection] = providerConnections[0];

  return {
    id: connectionId,
    apiKey: connection.apiKey,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    projectId: connection.projectId,
    copilotToken: connection.providerSpecificData?.copilotToken,
    providerSpecificData: connection.providerSpecificData,
    // Include current status for optimization check
    status: connection.status,
    lastError: connection.lastError,
    rateLimitedUntil: connection.rateLimitedUntil
  };
}

async function markAccountUnavailable(machineId, connectionId, status, errorText, env, resetsAtMs = null) {
  const data = await getMachineData(machineId, env);
  if (!data?.providers?.[connectionId]) return;

  const conn = data.providers[connectionId];
  const backoffLevel = conn.backoffLevel || 0;
  // Provider-specific precise cooldown (e.g. codex usage_limit_reached) overrides backoff
  let cooldownMs, newBackoffLevel;
  if (resetsAtMs && resetsAtMs > Date.now()) {
    cooldownMs = Math.min(resetsAtMs - Date.now(), MAX_RATE_LIMIT_COOLDOWN_MS);
    newBackoffLevel = 0;
  } else {
    ({ cooldownMs, newBackoffLevel } = checkFallbackError(status, errorText, backoffLevel));
  }
  const rateLimitedUntil = getUnavailableUntil(cooldownMs);
  const reason = typeof errorText === "string" ? errorText.slice(0, 100) : "Provider error";

  data.providers[connectionId].rateLimitedUntil = rateLimitedUntil;
  data.providers[connectionId].status = "unavailable";
  data.providers[connectionId].lastError = reason;
  data.providers[connectionId].errorCode = status || null;
  data.providers[connectionId].lastErrorAt = new Date().toISOString();
  data.providers[connectionId].backoffLevel = newBackoffLevel ?? backoffLevel;
  data.providers[connectionId].updatedAt = new Date().toISOString();

  await saveMachineData(machineId, data, env);
  log.warn("ACCOUNT", `${connectionId} | unavailable until ${rateLimitedUntil} (backoff=${newBackoffLevel ?? backoffLevel})`);
}

async function clearAccountError(machineId, connectionId, currentCredentials, env) {
  // Only update if currently has error status (optimization)
  const hasError = currentCredentials.status === "unavailable" ||
                   currentCredentials.lastError ||
                   currentCredentials.rateLimitedUntil;
  
  if (!hasError) return; // Skip if already clean

  const data = await getMachineData(machineId, env);
  if (!data?.providers?.[connectionId]) return;

  data.providers[connectionId].status = "active";
  data.providers[connectionId].lastError = null;
  data.providers[connectionId].lastErrorAt = null;
  data.providers[connectionId].rateLimitedUntil = null;
  data.providers[connectionId].backoffLevel = 0;
  data.providers[connectionId].updatedAt = new Date().toISOString();

  await saveMachineData(machineId, data, env);
  log.info("ACCOUNT", `${connectionId} | error cleared`);
}

async function updateCredentials(machineId, connectionId, newCredentials, env) {
  const data = await getMachineData(machineId, env);
  if (!data?.providers?.[connectionId]) return;

  data.providers[connectionId].accessToken = newCredentials.accessToken;
  if (newCredentials.refreshToken) data.providers[connectionId].refreshToken = newCredentials.refreshToken;
  if (newCredentials.expiresIn) {
    data.providers[connectionId].expiresAt = new Date(Date.now() + newCredentials.expiresIn * 1000).toISOString();
    data.providers[connectionId].expiresIn = newCredentials.expiresIn;
  }
  data.providers[connectionId].updatedAt = new Date().toISOString();

  await saveMachineData(machineId, data, env);
  log.debug("TOKEN", `credentials updated | ${connectionId}`);
}
