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

// SECURITY: Rate limiting and error sanitization (Issues #7, #10)
import { withRateLimit, RateLimitError } from './rateLimiter';
import { sanitizeErrorMessage } from '../../utils/errorSanitizer';

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
    generate: async (request: AIRequest, apiKey: string): Promise<AIResult> => {
      // SECURITY: Wrap request in rate limiter (Issue #7 fix)
      try {
        return await withRateLimit('openrouter', async () => {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://spriteanvil.com",
              "X-Title": "SpriteAnvil",
            },
            body: JSON.stringify({
              model: "openai/dall-e-3",
              prompt: request.prompt,
              n: 1,
              size: `${request.width}x${request.height}`,
              messages: [
                {
                  role: "user",
                  content: request.prompt,
                }
              ]
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            // SECURITY: Don't expose raw API errors (Issue #10 fix)
            // Log internally but throw sanitized error
            console.error('OpenRouter API Error:', error);
            throw new Error(sanitizeErrorMessage(new Error(`OpenRouter: ${error?.error?.message || response.statusText}`)));
          }

          const data = await response.json();
          const imageUrl = data.choices?.[0]?.message?.content || data.images?.[0];

          if (!imageUrl) {
            throw new Error(sanitizeErrorMessage(new Error('No image generated')));
          }

          return {
            images: [imageUrl],
            provider: "openrouter",
          };
        });
      } catch (error) {
        // Handle rate limit errors specially
        if (error instanceof RateLimitError) {
          const rateLimitError = error as RateLimitError;
          throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(rateLimitError.retryAfterMs / 1000)} seconds.`);
        }
        // Re-throw sanitized errors
        throw error;
      }
    },
  },
];

export function getProvider(id: AIProviderId): AIProvider | undefined {
  return PROVIDERS.find((provider) => provider.id === id);
}
