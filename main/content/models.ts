type ModelDirectoryEntry = {
  slug: string;
  name: string;
  provider: string;
  providerCode: string;
  contextWindow: string;
  inputPrice: string;
  outputPrice: string;
  modelId: string;
};

export const modelDirectory: ModelDirectoryEntry[] = [
  {
    slug: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    providerCode: "OA",
    contextWindow: "128,000",
    inputPrice: "$5.00",
    outputPrice: "$15.00",
    modelId: "gpt-4o-2024-05-13",
  },
  {
    slug: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    providerCode: "AN",
    contextWindow: "200,000",
    inputPrice: "$3.00",
    outputPrice: "$15.00",
    modelId: "claude-3-5-sonnet-20240620",
  },
  {
    slug: "llama-3-70b",
    name: "Llama 3 70B",
    provider: "Meta",
    providerCode: "ME",
    contextWindow: "8,192",
    inputPrice: "$0.50",
    outputPrice: "$1.50",
    modelId: "meta-llama/Meta-Llama-3-70B-Instruct",
  },
  {
    slug: "mistral-large",
    name: "Mistral Large",
    provider: "Mistral AI",
    providerCode: "MI",
    contextWindow: "32,768",
    inputPrice: "$4.00",
    outputPrice: "$12.00",
    modelId: "mistral-large-latest",
  },
  {
    slug: "gemma-7b-it",
    name: "Gemma 7B IT",
    provider: "Google",
    providerCode: "GO",
    contextWindow: "8,192",
    inputPrice: "$0.15",
    outputPrice: "$0.15",
    modelId: "google/gemma-7b-it",
  },
  {
    slug: "mixtral-8x7b",
    name: "Mixtral 8x7B",
    provider: "Mistral AI",
    providerCode: "MX",
    contextWindow: "32,768",
    inputPrice: "$0.60",
    outputPrice: "$1.80",
    modelId: "mistralai/Mixtral-8x7B-Instruct-v0.1",
  },
];
