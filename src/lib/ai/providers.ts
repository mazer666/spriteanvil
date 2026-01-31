/**
 * src/lib/ai/providers.ts
 * -----------------------------------------------------------------------------
 * ## AI PROVIDERS (Noob Guide)
 * 
 * Think of this as the "AI Translator".
 * 
 * 1. PLUGS: Different AI services (OpenAI, Stability, etc.) speak 
 *    different languages. This file provides "Plugs" (interfaces) 
 *    that let SpriteAnvil talk to any of them.
 * 2. CAPABILITIES: It tracks which AI can do "Inpaint" (fix parts 
 *    of art) and which can do "Variations" (remix art).
 * 
 * ## VAR TRACE
 * - `PROVIDERS`: (Origin: Constant) The list of all supported AI plugins.
 * - `AIProviderId`: (Origin: Type) The unique name for each AI service.
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
