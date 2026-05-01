import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import { getProviderAlias, isAnthropicCompatibleProvider, isOpenAICompatibleProvider } from "@/shared/constants/providers";
import { getProviderConnections, getCombos } from "@/lib/localDb";
import { dbGetAdminModels } from "@/lib/adminPostgres";

function buildAllowedModelIds(dbItems) {
  const allowed = new Set();
  for (const m of dbItems) {
    if (!m.modelId) continue;
    allowed.add(m.modelId);
    if (m.providerCode) {
      allowed.add(`${m.providerCode}/${m.modelId}`);
    }
    if (m.modelId.includes("/")) {
      allowed.add(m.modelId.split("/").pop());
    }
  }
  return allowed;
}

function isModelAllowed(modelId, allowedModelIds) {
  if (allowedModelIds.size === 0) return true;
  if (allowedModelIds.has(modelId)) return true;
  const baseId = modelId.includes("/") ? modelId.split("/").pop() : modelId;
  if (allowedModelIds.has(baseId)) return true;
  return false;
}

const parseOpenAIStyleModels = (data) => {
  if (Array.isArray(data)) return data;
  return data?.data || data?.models || data?.results || [];
};

// Matches provider IDs that are upstream/cross-instance connections (contain a UUID suffix)
const UPSTREAM_CONNECTION_RE = /[-_][0-9a-f]{8,}$/i;

async function fetchCompatibleModelIds(connection) {
  if (!connection?.apiKey) return [];

  const baseUrl = typeof connection?.providerSpecificData?.baseUrl === "string"
    ? connection.providerSpecificData.baseUrl.trim().replace(/\/$/, "")
    : "";

  if (!baseUrl) return [];

  let url = `${baseUrl}/models`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (isOpenAICompatibleProvider(connection.provider)) {
    headers.Authorization = `Bearer ${connection.apiKey}`;
  } else if (isAnthropicCompatibleProvider(connection.provider)) {
    if (url.endsWith("/messages/models")) {
      url = url.slice(0, -9);
    } else if (url.endsWith("/messages")) {
      url = `${url.slice(0, -9)}/models`;
    }
    headers["x-api-key"] = connection.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers.Authorization = `Bearer ${connection.apiKey}`;
  } else {
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const data = await response.json();
    const rawModels = parseOpenAIStyleModels(data);

    return Array.from(
      new Set(
        rawModels
          .map((model) => model?.id || model?.name || model?.model)
          .filter((modelId) => typeof modelId === "string" && modelId.trim() !== "")
      )
    );
  } catch {
    return [];
  }
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/**
 * GET /v1/models - OpenAI compatible models list
 * Returns Dwipa models in OpenAI format
 */
export async function GET() {
  try {
    // Get active provider connections
    let connections = [];
    try {
      connections = await getProviderConnections();
      // Filter to only active connections
      connections = connections.filter(c => c.isActive !== false);
    } catch (e) {
      // If database not available, return all models
      console.log("Could not fetch providers, returning all models");
    }

    // Get dwipas
    let dwipas = [];
    try {
      dwipas = await getCombos();
    } catch (e) {
      console.log("Could not fetch dwipas");
    }

    // Load enabled model catalog from DB
    let allowedModelIds = new Set();
    try {
      const dbResult = await dbGetAdminModels();
      const activeDbItems = dbResult.items.filter(
        (m) => m.visibility === "visible" && m.accessState === "enabled"
      );
      allowedModelIds = buildAllowedModelIds(activeDbItems);
    } catch {
      // DB unavailable — allow all models
    }

    // Build first active connection per provider (connections already sorted by priority)
    const activeConnectionByProvider = new Map();
    for (const conn of connections) {
      if (!activeConnectionByProvider.has(conn.provider)) {
        activeConnectionByProvider.set(conn.provider, conn);
      }
    }

    // Collect models from active providers (or all if none active)
    const models = [];
    const timestamp = Math.floor(Date.now() / 1000);

    // Add dwipas first (they appear at the top)
    for (const dwipa of dwipas) {
      models.push({
        id: dwipa.name,
        object: "model",
        created: timestamp,
        owned_by: "dwipa",
        permission: [],
        root: dwipa.name,
        parent: null,
      });
    }

    // Add provider models
    if (connections.length === 0) {
      // DB unavailable or no active providers -> return all static models
      for (const [alias, providerModels] of Object.entries(PROVIDER_MODELS)) {
        for (const model of providerModels) {
          const id = `${alias}/${model.id}`;
          if (isModelAllowed(id, allowedModelIds)) {
            models.push({
              id,
              object: "model",
              created: timestamp,
              owned_by: alias,
              permission: [],
              root: model.id,
              parent: null,
            });
          }
        }
      }
    } else {
      for (const [providerId, conn] of activeConnectionByProvider.entries()) {
        const staticAlias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
        const outputAlias = (
          conn?.providerSpecificData?.prefix
          || getProviderAlias(providerId)
          || staticAlias
        ).trim();
        const providerModels = PROVIDER_MODELS[staticAlias] || [];
        const enabledModels = conn?.providerSpecificData?.enabledModels;
        const hasExplicitEnabledModels =
          Array.isArray(enabledModels) && enabledModels.length > 0;
        const isCompatibleProvider =
          isOpenAICompatibleProvider(providerId) || isAnthropicCompatibleProvider(providerId);

        // Default: if no explicit selection, all static models are active.
        // For compatible providers with no explicit selection, fetch remote /models dynamically.
        // If explicit selection exists, expose exactly those model IDs (including non-static IDs).
        let rawModelIds = hasExplicitEnabledModels
          ? Array.from(
              new Set(
                enabledModels.filter(
                  (modelId) => typeof modelId === "string" && modelId.trim() !== "",
                ),
              ),
            )
          : providerModels.map((model) => model.id);

        if (isCompatibleProvider && rawModelIds.length === 0 && !UPSTREAM_CONNECTION_RE.test(providerId)) {
          rawModelIds = await fetchCompatibleModelIds(conn);
        }

        const modelIds = rawModelIds
          .map((modelId) => {
            if (modelId.startsWith(`${outputAlias}/`)) {
              return modelId.slice(outputAlias.length + 1);
            }
            if (modelId.startsWith(`${staticAlias}/`)) {
              return modelId.slice(staticAlias.length + 1);
            }
            if (modelId.startsWith(`${providerId}/`)) {
              return modelId.slice(providerId.length + 1);
            }
            return modelId;
          })
          .filter((modelId) => typeof modelId === "string" && modelId.trim() !== "");

        for (const modelId of modelIds) {
          const id = `${outputAlias}/${modelId}`;
          if (isModelAllowed(id, allowedModelIds)) {
            models.push({
              id,
              object: "model",
              created: timestamp,
              owned_by: outputAlias,
              permission: [],
              root: modelId,
              parent: null,
            });
          }
        }
      }
    }

    return Response.json({
      object: "list",
      data: models,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500 }
    );
  }
}
