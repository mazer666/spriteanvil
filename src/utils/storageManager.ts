/**
 * src/utils/storageManager.ts
 * -----------------------------------------------------------------------------
 * ## LOCAL STORAGE SIZE MANAGEMENT (Quota Management)
 * 
 * This module manages localStorage usage to prevent:
 * - QuotaExceededError crashes
 * - Degraded performance from large storage
 * - Data loss when quota is exceeded
 * 
 * ## FEATURES
 * - Size tracking and estimation
 * - Automatic cleanup of old data
 * - Warning thresholds
 * - Graceful degradation
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #11: localStorage Size Limits Not Enforced
 * 
 * @module utils/storageManager
 */

/**
 * Storage limits (in bytes)
 * Most browsers have 5-10MB limit for localStorage
 */
const STORAGE_LIMITS = {
  WARNING_THRESHOLD: 4 * 1024 * 1024, // 4MB - start warning
  MAX_SAFE_SIZE: 4.5 * 1024 * 1024,   // 4.5MB - start cleanup
  CRITICAL_SIZE: 5 * 1024 * 1024,      // 5MB - aggressive cleanup
} as const;

/**
 * Storage keys used by SpriteAnvil
 */
export const STORAGE_KEYS = {
  PROJECTS: 'spriteanvil_local_projects',
  CACHE_PREFIX: 'spriteanvil_cache_',
  SETTINGS: 'spriteanvil_settings',
  AI_KEYS: 'spriteanvil_ai_keys',
  RECENT_COLORS: 'spriteanvil_recent_colors',
} as const;

/**
 * Storage usage info
 */
export interface StorageInfo {
  totalSize: number;
  availableSize: number;
  usagePercentage: number;
  byKey: Record<string, number>;
  isNearLimit: boolean;
  isCritical: boolean;
}

/**
 * Calculate size of a value in bytes (approximate)
 */
function getValueSize(value: string): number {
  // Each character is ~2 bytes in UTF-16
  return value.length * 2;
}

/**
 * Get total localStorage usage
 */
export function getStorageSize(): number {
  let total = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      total += getValueSize(key) + getValueSize(value);
    }
  }
  
  return total;
}

/**
 * Get detailed storage usage info
 */
export function getStorageInfo(): StorageInfo {
  const byKey: Record<string, number> = {};
  let totalSize = 0;

  // Calculate size per key
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      const size = getValueSize(key) + getValueSize(value);
      byKey[key] = size;
      totalSize += size;
    }
  }

  // Estimate available size (most browsers have 5-10MB limit)
  const estimatedLimit = 10 * 1024 * 1024; // 10MB conservative estimate
  const availableSize = Math.max(0, estimatedLimit - totalSize);
  const usagePercentage = (totalSize / estimatedLimit) * 100;

  return {
    totalSize,
    availableSize,
    usagePercentage,
    byKey,
    isNearLimit: totalSize > STORAGE_LIMITS.WARNING_THRESHOLD,
    isCritical: totalSize > STORAGE_LIMITS.CRITICAL_SIZE,
  };
}

/**
 * Check if we can safely store a value
 */
export function canStoreValue(key: string, value: string): boolean {
  const currentSize = getStorageSize();
  const newItemSize = getValueSize(key) + getValueSize(value);
  const projectedSize = currentSize + newItemSize;

  return projectedSize < STORAGE_LIMITS.MAX_SAFE_SIZE;
}

/**
 * Safely set item in localStorage with quota checking
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    // Check if we have space
    if (!canStoreValue(key, value)) {
      console.warn('localStorage near capacity, attempting cleanup...');
      performCleanup();
      
      // Try again after cleanup
      if (!canStoreValue(key, value)) {
        console.error('localStorage full even after cleanup');
        return false;
      }
    }

    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
      performCleanup();
      
      // Try one more time after cleanup
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    
    console.error('Error setting localStorage item:', error);
    return false;
  }
}

/**
 * Clean up old or large cache entries
 */
export function performCleanup(): void {
  console.log('Performing localStorage cleanup...');
  const info = getStorageInfo();
  
  // Sort keys by size (largest first)
  const sortedKeys = Object.entries(info.byKey)
    .sort(([, a], [, b]) => b - a);

  let freedSpace = 0;
  const targetFreed = STORAGE_LIMITS.WARNING_THRESHOLD * 0.2; // Free 20% of warning threshold

  for (const [key, size] of sortedKeys) {
    // Skip critical keys
    if (
      key === STORAGE_KEYS.SETTINGS ||
      key === STORAGE_KEYS.AI_KEYS ||
      key === STORAGE_KEYS.PROJECTS
    ) {
      continue;
    }

    // Remove cache entries
    if (key.startsWith(STORAGE_KEYS.CACHE_PREFIX)) {
      console.log(`Removing cache entry: ${key} (${formatBytes(size)})`);
      localStorage.removeItem(key);
      freedSpace += size;
    }

    // Stop if we've freed enough space
    if (freedSpace >= targetFreed) {
      break;
    }
  }

  console.log(`Cleanup complete. Freed ${formatBytes(freedSpace)}`);
}

/**
 * Clear all cache entries
 */
export function clearCache(): void {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEYS.CACHE_PREFIX)) {
      keys.push(key);
    }
  }

  keys.forEach(key => localStorage.removeItem(key));
  console.log(`Cleared ${keys.length} cache entries`);
}

/**
 * Get human-readable size format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get storage usage warning message
 */
export function getStorageWarning(): string | null {
  const info = getStorageInfo();

  if (info.isCritical) {
    return `Storage critically full (${Math.round(info.usagePercentage)}%). Some features may not work. Please clear cache or remove old projects.`;
  }

  if (info.isNearLimit) {
    return `Storage usage high (${Math.round(info.usagePercentage)}%). Consider clearing cache to free up space.`;
  }

  return null;
}

/**
 * Estimate if a project snapshot can be cached
 */
export function canCacheSnapshot(snapshotSize: number): boolean {
  const info = getStorageInfo();
  const projectedSize = info.totalSize + snapshotSize;
  
  return projectedSize < STORAGE_LIMITS.MAX_SAFE_SIZE;
}

/**
 * Monitor storage usage (call periodically)
 */
export function monitorStorage(): void {
  const info = getStorageInfo();
  
  console.log(`localStorage: ${formatBytes(info.totalSize)} used (${Math.round(info.usagePercentage)}%)`);

  if (info.isCritical) {
    console.error('CRITICAL: localStorage nearly full!');
    performCleanup();
  } else if (info.isNearLimit) {
    console.warn('WARNING: localStorage usage high');
  }
}
