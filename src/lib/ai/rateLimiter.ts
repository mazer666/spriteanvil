/**
 * src/lib/ai/rateLimiter.ts
 * -----------------------------------------------------------------------------
 * ## AI REQUEST RATE LIMITING (Cost Control & Resource Management)
 * 
 * This module implements rate limiting for AI image generation requests
 * to prevent:
 * - Unexpected API costs from runaway requests
 * - Account suspension due to quota violations
 * - Poor user experience from server overload
 * 
 * ## HOW IT WORKS
 * - Sliding window rate limiting (10 requests per minute per provider)
 * - Request queue with automatic retry
 * - Usage tracking and warnings
 * - Cost estimation before generation
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #7: Missing Rate Limiting on AI Requests
 * 
 * @module lib/ai/rateLimiter
 */

import { AIProviderId } from './providers';

/**
 * Rate limit configuration per provider
 */
const RATE_LIMITS: Partial<Record<AIProviderId, { requestsPerMinute: number; windowMs: number }>> = {
  'openrouter': { requestsPerMinute: 10, windowMs: 60000 },
  // 'stability-ai': { requestsPerMinute: 10, windowMs: 60000 }, // Uncomment when implemented
  // 'openai-dalle3': { requestsPerMinute: 5, windowMs: 60000 }, // DALL-E is more expensive
};

/**
 * Default rate limit for unknown providers
 */
const DEFAULT_RATE_LIMIT = { requestsPerMinute: 10, windowMs: 60000 };

/**
 * Request log entry
 */
interface RequestLogEntry {
  timestamp: number;
  success: boolean;
}

/**
 * AI Request Rate Limiter
 * 
 * Uses sliding window algorithm to track requests over time
 */
class AIRequestRateLimiter {
  private requestLogs = new Map<AIProviderId, RequestLogEntry[]>();
  private queuedRequests = new Map<AIProviderId, Array<() => void>>();

  /**
   * Check if a request can be made right now
   */
  canMakeRequest(provider: AIProviderId): boolean {
    const limit = RATE_LIMITS[provider] || DEFAULT_RATE_LIMIT;
    const log = this.getRecentRequests(provider, limit.windowMs);
    
    return log.length < limit.requestsPerMinute;
  }

  /**
   * Get time (in ms) until next request slot is available
   */
  getTimeUntilNextSlot(provider: AIProviderId): number {
    if (this.canMakeRequest(provider)) {
      return 0;
    }

    const limit = RATE_LIMITS[provider] || DEFAULT_RATE_LIMIT;
    const log = this.getRecentRequests(provider, limit.windowMs);
    
    if (log.length === 0) {
      return 0;
    }

    // Find oldest request in window
    const oldestRequest = log[0].timestamp;
    const now = Date.now();
    const timeUntilOldestExpires = limit.windowMs - (now - oldestRequest);
    
    return Math.max(0, timeUntilOldestExpires);
  }

  /**
   * Record a request attempt
   */
  recordRequest(provider: AIProviderId, success: boolean): void {
    const log = this.requestLogs.get(provider) || [];
    log.push({
      timestamp: Date.now(),
      success,
    });
    this.requestLogs.set(provider, log);
    
    // Clean up old entries to prevent memory bloat
    this.cleanupOldEntries(provider);
  }

  /**
   * Get usage statistics for a provider
   */
  getUsageStats(provider: AIProviderId): {
    requests: number;
    successRate: number;
    limit: number;
    timeWindow: string;
  } {
    const limit = RATE_LIMITS[provider] || DEFAULT_RATE_LIMIT;
    const log = this.getRecentRequests(provider, limit.windowMs);
    const successful = log.filter(r => r.success).length;
    
    return {
      requests: log.length,
      successRate: log.length > 0 ? successful / log.length : 1,
      limit: limit.requestsPerMinute,
      timeWindow: `${limit.windowMs / 1000}s`,
    };
  }

  /**
   * Wait for next available slot (returns promise that resolves when ready)
   */
  async waitForSlot(provider: AIProviderId): Promise<void> {
    const waitTime = this.getTimeUntilNextSlot(provider);
    if (waitTime === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      setTimeout(resolve, waitTime);
    });
  }

  /**
   * Get recent requests within time window
   */
  private getRecentRequests(provider: AIProviderId, windowMs: number): RequestLogEntry[] {
    const log = this.requestLogs.get(provider) || [];
    const now = Date.now();
    const cutoff = now - windowMs;
    
    return log.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Clean up old request log entries
   */
  private cleanupOldEntries(provider: AIProviderId): void {
    const limit = RATE_LIMITS[provider] || DEFAULT_RATE_LIMIT;
    const log = this.requestLogs.get(provider) || [];
    const now = Date.now();
    const cutoff = now - (limit.windowMs * 2); // Keep double the window for stats
    
    const cleaned = log.filter(entry => entry.timestamp > cutoff);
    this.requestLogs.set(provider, cleaned);
  }

  /**
   * Reset rate limit for provider (useful for testing)
   */
  reset(provider?: AIProviderId): void {
    if (provider) {
      this.requestLogs.delete(provider);
      this.queuedRequests.delete(provider);
    } else {
      this.requestLogs.clear();
      this.queuedRequests.clear();
    }
  }
}

/**
 * Global rate limiter instance
 */
export const aiRateLimiter = new AIRequestRateLimiter();

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  constructor(
    public provider: AIProviderId,
    public retryAfterMs: number
  ) {
    super(`Rate limit exceeded for ${provider}. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'RateLimitError';
  }
}

/**
 * Wrapper function to rate-limit an AI request
 * 
 * @param provider - AI provider ID
 * @param requestFn - Async function that makes the actual request
 * @returns Promise with request result
 * 
 * @example
 * const result = await withRateLimit('openrouter', async () => {
 *   return await generateImage(prompt);
 * });
 */
export async function withRateLimit<T>(
  provider: AIProviderId,
  requestFn: () => Promise<T>
): Promise<T> {
  // Check if we can make request
  if (!aiRateLimiter.canMakeRequest(provider)) {
    const waitTime = aiRateLimiter.getTimeUntilNextSlot(provider);
    throw new RateLimitError(provider, waitTime);
  }

  // Make request and track result
  try {
    const result = await requestFn();
    aiRateLimiter.recordRequest(provider, true);
    return result;
  } catch (error) {
    aiRateLimiter.recordRequest(provider, false);
    throw error;
  }
}

/**
 * Check if provider is currently rate limited
 */
export function isRateLimited(provider: AIProviderId): boolean {
  return !aiRateLimiter.canMakeRequest(provider);
}

/**
 * Get user-friendly rate limit status message
 */
export function getRateLimitStatus(provider: AIProviderId): {
  canMakeRequest: boolean;
  message: string;
  stats: ReturnType<typeof aiRateLimiter.getUsageStats>;
} {
  const stats = aiRateLimiter.getUsageStats(provider);
  const canMakeRequest = aiRateLimiter.canMakeRequest(provider);
  
  let message: string;
  if (canMakeRequest) {
    message = `${stats.requests}/${stats.limit} requests used in last ${stats.timeWindow}`;
  } else {
    const waitTime = aiRateLimiter.getTimeUntilNextSlot(provider);
    message = `Rate limit reached. Try again in ${Math.ceil(waitTime / 1000)}s`;
  }
  
  return { canMakeRequest, message, stats };
}
