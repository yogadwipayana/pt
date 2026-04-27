import json

models = [
  # --- OpenAI ---
  {"slug": "gpt-5-5-pro", "name": "GPT 5.5 Pro", "provider": "openai", "modelId": "gpt-5.5-pro", "contextWindow": 1050000, "inputPriceUsdPer1M": 30.0, "outputPriceUsdPer1M": 180.0},
  {"slug": "gpt-5-5", "name": "GPT 5.5", "provider": "openai", "modelId": "gpt-5.5", "contextWindow": 1050000, "inputPriceUsdPer1M": 5.0, "outputPriceUsdPer1M": 30.0},
  {"slug": "gpt-5-4-pro", "name": "GPT 5.4 Pro", "provider": "openai", "modelId": "gpt-5.4-pro", "contextWindow": 1050000, "inputPriceUsdPer1M": 30.0, "outputPriceUsdPer1M": 180.0},
  {"slug": "gpt-5-4", "name": "GPT 5.4", "provider": "openai", "modelId": "gpt-5.4", "contextWindow": 1050000, "inputPriceUsdPer1M": 2.5, "outputPriceUsdPer1M": 15.0},
  {"slug": "gpt-5-4-mini", "name": "GPT 5.4 Mini", "provider": "openai", "modelId": "gpt-5.4-mini", "contextWindow": 400000, "inputPriceUsdPer1M": 0.75, "outputPriceUsdPer1M": 4.5},
  {"slug": "gpt-5-4-nano", "name": "GPT 5.4 Nano", "provider": "openai", "modelId": "gpt-5.4-nano", "contextWindow": 400000, "inputPriceUsdPer1M": 0.2, "outputPriceUsdPer1M": 1.25},
  {"slug": "gpt-5-4-image-2", "name": "GPT 5.4 Image 2", "provider": "openai", "modelId": "gpt-5.4-image-2", "contextWindow": 272000, "inputPriceUsdPer1M": 8.0, "outputPriceUsdPer1M": 15.0},
  {"slug": "gpt-5-3-codex", "name": "GPT 5.3 Codex", "provider": "openai", "modelId": "gpt-5.3-codex", "contextWindow": 400000, "inputPriceUsdPer1M": 1.75, "outputPriceUsdPer1M": 14.0},
  {"slug": "gpt-5-3-chat", "name": "GPT 5.3 Chat", "provider": "openai", "modelId": "gpt-5.3-chat", "contextWindow": 128000, "inputPriceUsdPer1M": 1.75, "outputPriceUsdPer1M": 14.0},

  # --- DeepSeek ---
  {"slug": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "provider": "deepseek", "modelId": "deepseek-v4-pro", "contextWindow": 1048576, "inputPriceUsdPer1M": 0.435, "outputPriceUsdPer1M": 0.87},
  {"slug": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "provider": "deepseek", "modelId": "deepseek-v4-flash", "contextWindow": 1048576, "inputPriceUsdPer1M": 0.14, "outputPriceUsdPer1M": 0.28},
  {"slug": "deepseek-v3-2", "name": "DeepSeek V3.2", "provider": "deepseek", "modelId": "deepseek-v3.2", "contextWindow": 131072, "inputPriceUsdPer1M": 0.252, "outputPriceUsdPer1M": 0.378},
  {"slug": "deepseek-v3-2-exp", "name": "DeepSeek V3.2 Exp", "provider": "deepseek", "modelId": "deepseek-v3.2-exp", "contextWindow": 163840, "inputPriceUsdPer1M": 0.27, "outputPriceUsdPer1M": 0.41},
  {"slug": "deepseek-v3-2-speciale", "name": "DeepSeek V3.2 Speciale", "provider": "deepseek", "modelId": "deepseek-v3.2-speciale", "contextWindow": 163840, "inputPriceUsdPer1M": 0.4, "outputPriceUsdPer1M": 1.2},
  {"slug": "deepseek-v3-1-terminus", "name": "DeepSeek V3.1 Terminus", "provider": "deepseek", "modelId": "deepseek-v3.1-terminus", "contextWindow": 163840, "inputPriceUsdPer1M": 0.21, "outputPriceUsdPer1M": 0.79},
  {"slug": "deepseek-chat-v3-1", "name": "DeepSeek Chat V3.1", "provider": "deepseek", "modelId": "deepseek-chat-v3.1", "contextWindow": 32768, "inputPriceUsdPer1M": 0.15, "outputPriceUsdPer1M": 0.75},

  # --- MiniMax ---
  {"slug": "minimax-m2-7", "name": "MiniMax M2.7", "provider": "minimax", "modelId": "minimax-m2.7", "contextWindow": 196608, "inputPriceUsdPer1M": 0.3, "outputPriceUsdPer1M": 1.2},
  {"slug": "minimax-m2-5", "name": "MiniMax M2.5", "provider": "minimax", "modelId": "minimax-m2.5", "contextWindow": 196608, "inputPriceUsdPer1M": 0.15, "outputPriceUsdPer1M": 1.15},
  {"slug": "minimax-m2", "name": "MiniMax M2", "provider": "minimax", "modelId": "minimax-m2", "contextWindow": 196608, "inputPriceUsdPer1M": 0.255, "outputPriceUsdPer1M": 1.0},
  {"slug": "minimax-m2-1", "name": "MiniMax M2.1", "provider": "minimax", "modelId": "minimax-m2.1", "contextWindow": 196608, "inputPriceUsdPer1M": 0.29, "outputPriceUsdPer1M": 0.95},
  {"slug": "minimax-m2-her", "name": "MiniMax M2-her", "provider": "minimax", "modelId": "minimax-m2-her", "contextWindow": 65536, "inputPriceUsdPer1M": 0.3, "outputPriceUsdPer1M": 1.2},

  # --- MoonshotAI (Kimi) ---
  {"slug": "kimi-k2-6", "name": "Kimi K2.6", "provider": "kimi", "modelId": "kimi-k2.6", "contextWindow": 256000, "inputPriceUsdPer1M": 0.7448, "outputPriceUsdPer1M": 4.655},
  {"slug": "kimi-k2-5", "name": "Kimi K2.5", "provider": "kimi", "modelId": "kimi-k2.5", "contextWindow": 262144, "inputPriceUsdPer1M": 0.44, "outputPriceUsdPer1M": 2.0},
  {"slug": "kimi-k2-thinking", "name": "Kimi K2 Thinking", "provider": "kimi", "modelId": "kimi-k2-thinking", "contextWindow": 262144, "inputPriceUsdPer1M": 0.6, "outputPriceUsdPer1M": 2.5},
  {"slug": "kimi-k2-0905", "name": "Kimi K2 0905", "provider": "kimi", "modelId": "kimi-k2-0905", "contextWindow": 262144, "inputPriceUsdPer1M": 0.4, "outputPriceUsdPer1M": 2.0},
]

header = '''// Real pricing and context windows sourced from https://openrouter.ai/models (OpenRouter API)
// OpenAI: GPT 5.5, GPT 5.4, GPT 5.3 only (5.2 and below removed)
// Also includes: deepseek, minimax, moonshotai (mapped to kimi)
'''

js = header + '\nconst OPENROUTER_MODELS = ' + json.dumps(models, indent=2) + ';\n\n'

js += '''function formatPrice(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return "\u2014";
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
'''

with open('src/lib/modelCatalogSeed.js', 'w', encoding='utf-8') as f:
    f.write(js)

print(f"Wrote {len(models)} models to src/lib/modelCatalogSeed.js")
