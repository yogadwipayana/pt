// Real pricing and context windows sourced from https://openrouter.ai/models (OpenRouter API)
// Only includes: openai, deepseek, minimax, moonshotai (mapped to kimi)

const OPENROUTER_MODELS = [
  // --- OpenAI ---
  {
    slug: "gpt-5-5",
    name: "GPT 5.5",
    provider: "openai",
    modelId: "gpt-5.5",
    contextWindow: 1050000,
    inputPriceUsdPer1M: 5.0,
    outputPriceUsdPer1M: 30.0,
  },
  {
    slug: "gpt-5-4",
    name: "GPT 5.4",
    provider: "openai",
    modelId: "gpt-5.4",
    contextWindow: 1050000,
    inputPriceUsdPer1M: 2.5,
    outputPriceUsdPer1M: 15.0,
  },
  {
    slug: "gpt-5-4-mini",
    name: "GPT 5.4 Mini",
    provider: "openai",
    modelId: "gpt-5.4-mini",
    contextWindow: 400000,
    inputPriceUsdPer1M: 0.75,
    outputPriceUsdPer1M: 4.5,
  },
  {
    slug: "gpt-5-3-codex",
    name: "GPT 5.3 Codex",
    provider: "openai",
    modelId: "gpt-5.3-codex",
    contextWindow: 400000,
    inputPriceUsdPer1M: 1.75,
    outputPriceUsdPer1M: 14.0,
  },
  {
    slug: "gpt-5-2",
    name: "GPT 5.2",
    provider: "openai",
    modelId: "gpt-5.2",
    contextWindow: 400000,
    inputPriceUsdPer1M: 1.75,
    outputPriceUsdPer1M: 14.0,
  },
  // --- DeepSeek ---
  {
    slug: "deepseek-v3-2",
    name: "DeepSeek V3.2",
    provider: "deepseek",
    modelId: "deepseek-v3.2",
    contextWindow: 163840,
    inputPriceUsdPer1M: 0.25,
    outputPriceUsdPer1M: 0.37,
  },
  // --- MiniMax ---
  {
    slug: "minimax-m2-7",
    name: "MiniMax M2.7",
    provider: "minimax",
    modelId: "minimax-m2.7",
    contextWindow: 196608,
    inputPriceUsdPer1M: 0.3,
    outputPriceUsdPer1M: 1.2,
  },
  {
    slug: "minimax-m2-5",
    name: "MiniMax M2.5",
    provider: "minimax",
    modelId: "minimax-m2.5",
    contextWindow: 196608,
    inputPriceUsdPer1M: 0.15,
    outputPriceUsdPer1M: 1.5,
  },
  {
    slug: "qwen-3.5",
    name: "Qwen 3.5",
    provider: "Qwen",
    modelId: "qwen-3.5",
    contextWindow: 196608,
    inputPriceUsdPer1M: 0.16,
    outputPriceUsdPer1M: 1.3,
  },
];

function formatPrice(value) {
  if (value === undefined || value === null || Number.isNaN(value))
    return "\u2014";
  return `$${Number(value).toFixed(2)} / 1M`;
}

export function buildModelCatalogSeedRows() {
  return OPENROUTER_MODELS.map((m, index) => ({
    slug: m.slug,
    name: m.name,
    provider: m.provider,
    providerCode: m.provider,
    modelId: m.modelId,
    summary: "",
    contextWindow: m.contextWindow,
    inputPriceUsdPer1M: m.inputPriceUsdPer1M,
    outputPriceUsdPer1M: m.outputPriceUsdPer1M,
    latencyMs: null,
    category: "general",
    isActive: true,
    sortOrder: index,
  }));
}

export function buildPublicModelCatalog() {
  return buildModelCatalogSeedRows().map((row) => ({
    slug: row.slug,
    name: row.name,
    provider: row.provider,
    providerCode: row.providerCode,
    contextWindow: row.contextWindow
      ? row.contextWindow.toLocaleString("en-US")
      : "",
    inputPrice: formatPrice(row.inputPriceUsdPer1M),
    outputPrice: formatPrice(row.outputPriceUsdPer1M),
    modelId: row.modelId,
  }));
}
