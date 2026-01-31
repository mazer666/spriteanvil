/**
 * src/lib/ai/providers.ts
 * -----------------------------------------------------------------------------
 * ## AI PROVIDERS (Noob Guide)
 * 
 * Think of this as the "AI Translator".
 * 
 * ## JARGON GLOSSARY
 * 1. PROVIDER: A company that runs AI models (like OpenAI or Stability).
 * 2. ENDPOINT: The "Address" where we send our requests.
 * 3. MODEL ID: The name of the specific AI "Worker" (e.g., "dall-e-3").
 * 4. API KEY: A secret password that tells the provider who is 
 *    paying for the generated art.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph LR
 *   REQ[Generic AI Request] --> ROUTE{Check Provider ID}
 *   ROUTE -- OpenAI --> OAPI[Build DALL-E JSON]
 *   ROUTE -- Stability --> SAPI[Build SDXL JSON]
 *   ROUTE -- Other --> HAPI[Build Custom JSON]
 *   OAPI --> FETCH[Fetch API]
 *   SAPI --> FETCH
 *   HAPI --> FETCH
 *   FETCH --> RES[Return Image URL]
 * ```
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
