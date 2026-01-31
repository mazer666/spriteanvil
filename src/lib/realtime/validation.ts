/**
 * src/lib/realtime/validation.ts
 * -----------------------------------------------------------------------------
 * ## REAL-TIME COLLABORATION SECURITY (DoS Prevention)
 * 
 * This module validates ALL incoming real-time messages from collaborators
 * to prevent Denial of Service (DoS) attacks and application crashes.
 * 
 * ## ATTACK VECTORS THIS PREVENTS
 * 1. **Memory Exhaustion**: Sending huge pixel patches to crash the app
 * 2. **Buffer Overflow**: Invalid pixel indices causing out-of-bounds access
 * 3. **Rate Limiting Bypass**: Flooding the app with updates
 * 4. **Malformed Data**: Corrupted messages causing application errors
 * 
 * ## HOW IT WORKS
 * - Token Bucket Algorithm for rate limiting (allows bursts, prevents sustained floods)
 * - Strict validation of all message fields (type, range, format)
 * - Size limits on patches (max 10,000 pixels per update)
 * - Pixel index bounds checking
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #5: Real-time Collaboration Message Validation
 * 
 * @module lib/realtime/validation
 */

/**
 * Maximum number of pixels that can be updated in a single patch
 * Each pixel is 5 values: [index, r, g, b, a]
 */
const MAX_PATCH_SIZE = 10000; // pixels
const MAX_PATCH_VALUES = MAX_PATCH_SIZE * 5; // values

/**
 * Rate limiting configuration
 */
const MAX_UPDATES_PER_SECOND = 30;
const RATE_LIMIT_WINDOW_MS = 1000;

/**
 * Token bucket for rate limiting
 * 
 * Allows bursts of activity (up to MAX_UPDATES_PER_SECOND)
 * but prevents sustained flooding beyond that rate.
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

class TokenBucketRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private readonly maxTokens: number;
  private readonly refillRate: number;
  
  constructor(maxTokens: number = MAX_UPDATES_PER_SECOND, refillPerSecond: number = MAX_UPDATES_PER_SECOND) {
    this.maxTokens = maxTokens;
    this.refillRate = refillPerSecond;
  }

  /**
   * Check if user can make an update
   * 
   * @param userId - User ID to check
   * @returns true if update allowed, false if rate limited
   */
  allowUpdate(userId: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(userId) || { 
      tokens: this.maxTokens, 
      lastRefill: now 
    };

    // Refill tokens based on time elapsed
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    bucket.tokens = Math.min(
      this.maxTokens,
      bucket.tokens + elapsed * this.refillRate
    );
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(userId, bucket);
      return true;
    }

    // Rate limited
    return false;
  }

  /**
   * Get time (in ms) until user can make next update
   */
  getTimeUntilNextSlot(userId: string): number {
    const bucket = this.buckets.get(userId);
    if (!bucket) return 0;

    const now = Date.now();
    const tokensNeeded = Math.max(0, 1 - bucket.tokens);
    const timeNeeded = (tokensNeeded / this.refillRate) * 1000;
    
    return Math.ceil(timeNeeded);
  }

  /**
   * Clear rate limit data for user (call on disconnect)
   */
  clearUser(userId: string): void {
    this.buckets.delete(userId);
  }

  /**
   * Clear all rate limit data (call when channel reconnects)
   */
  clearAll(): void {
    this.buckets.clear();
  }
}

/**
 * Global rate limiter instance
 */
export const pixelUpdateRateLimiter = new TokenBucketRateLimiter();

/**
 * Pixel update payload structure
 */
export interface PixelUpdatePayload {
  userId: string;
  frameId: string;
  layerId: string;
  patch: number[];
}

/**
 * Cursor position payload structure
 */
export interface CursorPositionPayload {
  userId: string;
  x: number;
  y: number;
  color?: string;
  name?: string;
}

/**
 * Validate pixel update message
 * 
 * @param payload - Unknown payload from real-time channel
 * @param localUserId - Current user's ID (to filter out own updates)
 * @param canvasWidth - Canvas width for bounds checking
 * @param canvasHeight - Canvas height for bounds checking
 * @returns Validated payload or null if invalid
 */
export function validatePixelUpdate(
  payload: unknown,
  localUserId: string,
  canvasWidth: number = 0,
  canvasHeight: number = 0
): PixelUpdatePayload | null {
  // Type guard: must be object
  if (!payload || typeof payload !== 'object') {
    console.warn('Invalid pixel update: not an object');
    return null;
  }

  const p = payload as Record<string, unknown>;

  // Validate userId
  if (typeof p.userId !== 'string' || !p.userId) {
    console.warn('Invalid pixel update: missing or invalid userId');
    return null;
  }

  // Ignore own updates
  if (p.userId === localUserId) {
    return null;
  }

  // Validate frameId
  if (typeof p.frameId !== 'string' || !p.frameId) {
    console.warn('Invalid pixel update: missing or invalid frameId');
    return null;
  }

  // Validate layerId
  if (typeof p.layerId !== 'string' || !p.layerId) {
    console.warn('Invalid pixel update: missing or invalid layerId');
    return null;
  }

  // Validate patch
  if (!Array.isArray(p.patch)) {
    console.warn('Invalid pixel update: patch is not an array');
    return null;
  }

  // Check patch size
  if (p.patch.length > MAX_PATCH_VALUES) {
    console.warn(`Invalid pixel update: patch too large (${p.patch.length} values, max ${MAX_PATCH_VALUES})`);
    return null;
  }

  // Validate patch structure: [index, r, g, b, a, index, r, g, b, a, ...]
  if (p.patch.length % 5 !== 0) {
    console.warn('Invalid pixel update: patch length not divisible by 5');
    return null;
  }

  // Validate each pixel in patch
  for (let i = 0; i < p.patch.length; i += 5) {
    const pixelIndex = p.patch[i];
    
    // Index must be a non-negative integer
    if (typeof pixelIndex !== 'number' || !Number.isInteger(pixelIndex) || pixelIndex < 0) {
      console.warn(`Invalid pixel update: invalid pixel index at position ${i}`);
      return null;
    }

    // Optional: bounds check if canvas dimensions provided
    if (canvasWidth > 0 && canvasHeight > 0) {
      const maxIndex = canvasWidth * canvasHeight;
      if (pixelIndex >= maxIndex) {
        console.warn(`Invalid pixel update: pixel index ${pixelIndex} out of bounds (max ${maxIndex - 1})`);
        return null;
      }
    }

    // Validate RGBA values (0-255)
    for (let j = 1; j <= 4; j++) {
      const colorValue = p.patch[i + j];
      if (typeof colorValue !== 'number' || !Number.isInteger(colorValue) || colorValue < 0 || colorValue > 255) {
        console.warn(`Invalid pixel update: invalid color value at position ${i + j}`);
        return null;
      }
    }
  }

  return {
    userId: p.userId,
    frameId: p.frameId,
    layerId: p.layerId,
    patch: p.patch as number[],
  };
}

/**
 * Validate cursor position message
 * 
 * @param payload - Unknown payload from real-time channel
 * @param localUserId - Current user's ID
 * @param canvasWidth - Canvas width for bounds checking
 * @param canvasHeight - Canvas height for bounds checking
 * @returns Validated payload or null if invalid
 */
export function validateCursorPosition(
  payload: unknown,
  localUserId: string,
  canvasWidth: number = 0,
  canvasHeight: number = 0
): CursorPositionPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as Record<string, unknown>;

  // Validate userId
  if (typeof p.userId !== 'string' || !p.userId) {
    return null;
  }

  // Ignore own cursor
  if (p.userId === localUserId) {
    return null;
  }

  // Validate x coordinate
  if (typeof p.x !== 'number' || !Number.isFinite(p.x)) {
    return null;
  }

  // Validate y coordinate
  if (typeof p.y !== 'number' || !Number.isFinite(p.y)) {
    return null;
  }

  // Optional bounds checking
  if (canvasWidth > 0 && canvasHeight > 0) {
    if (p.x < 0 || p.x > canvasWidth * 100 || p.y < 0 || p.y > canvasHeight * 100) {
      // Allow some margin for zoomed out views
      console.warn('Cursor position out of reasonable bounds');
      return null;
    }
  }

  // Validate optional color (hex format)
  if (p.color !== undefined && p.color !== null) {
    if (typeof p.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(p.color)) {
      console.warn('Invalid cursor color format');
      // Don't reject, just omit color
      p.color = undefined;
    }
  }

  // Validate optional name
  if (p.name !== undefined && p.name !== null) {
    if (typeof p.name !== 'string' || p.name.length > 100) {
      p.name = undefined;
    }
  }

  return {
    userId: p.userId,
    x: p.x,
    y: p.y,
    color: p.color as string | undefined,
    name: p.name as string | undefined,
  };
}

/**
 * Check if user is rate limited for pixel updates
 * 
 * @param userId - User ID to check
 * @returns true if user should be rate limited
 */
export function isRateLimited(userId: string): boolean {
  return !pixelUpdateRateLimiter.allowUpdate(userId);
}

/**
 * Clear rate limit for user (call on disconnect)
 */
export function clearUserRateLimit(userId: string): void {
  pixelUpdateRateLimiter.clearUser(userId);
}

/**
 * Security event logging helper
 * 
 * In production, this should send to a logging service.
 * For now, it logs to console.
 */
export function logSecurityEvent(
  eventType: 'rate_limit' | 'invalid_message' | 'suspicious_activity',
  userId: string,
  details: string
): void {
  const timestamp = new Date().toISOString();
  console.warn(`[SECURITY] ${timestamp} - ${eventType.toUpperCase()} - User: ${userId} - ${details}`);
  
  // TODO: Send to logging service in production
  // Example: sendToLoggingService({ timestamp, eventType, userId, details });
}
