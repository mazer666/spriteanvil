/**
 * AI provider abstraction layer.
 *
 * Add new providers by implementing AIProvider and registering in PROVIDERS.
 * This file intentionally keeps the interface small so alternative backends
 * (e.g. local Ollama servers) can be added with minimal changes.
 */

export type AIProviderId = "openai-dalle3" | "stability-ai" | "hugging-face" | "openrouter";

export type AIRequest = {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;
};

export type AIResult = {
  images: string[];
  provider: AIProviderId;
};

export type AIProvider = {
  id: AIProviderId;
  label: string;
  supportsInpaint: boolean;
  supportsVariations: boolean;
  generate: (request: AIRequest, apiKey: string) => Promise<AIResult>;
};

function notImplemented(provider: AIProviderId): never {
  throw new Error(`Provider ${provider} is not implemented yet.`);
}

export const PROVIDERS: AIProvider[] = [
  {
    id: "openai-dalle3",
    label: "OpenAI DALL·E 3",
    supportsInpaint: true,
    supportsVariations: true,
    generate: async () => notImplemented("openai-dalle3"),
  },
  {
    id: "stability-ai",
    label: "Stability AI",
    supportsInpaint: true,
    supportsVariations: true,
    generate: async () => notImplemented("stability-ai"),
  },
  {
    id: "hugging-face",
    label: "Hugging Face",
    supportsInpaint: false,
    supportsVariations: true,
    generate: async () => notImplemented("hugging-face"),
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    supportsInpaint: true,
    supportsVariations: true,
    generate: async () => notImplemented("openrouter"),
  },
];

export function getProvider(id: AIProviderId): AIProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
