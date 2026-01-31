/**
 * src/utils/validation.ts
 * -----------------------------------------------------------------------------
 * ## VALIDATION UTILITIES (Security Layer)
 * 
 * Helper functions for safely validating and sanitizing data from untrusted sources.
 * 
 * ## USAGE PATTERN
 * ```typescript
 * // Instead of:
 * const data = JSON.parse(raw); // UNSAFE!
 * 
 * // Do this:
 * const data = safeParseJSON(raw, ProjectArraySchema, []);
 * ```
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #2: Unvalidated JSON Parsing
 * All localStorage data MUST go through these validators.
 * 
 * @module utils/validation
 */

import { z } from 'zod';
import { ProjectArraySchema, ValidatedProject } from '../types/schemas';

/**
 * Safely parse JSON string with schema validation
 * 
 * @param jsonString - Raw JSON string from untrusted source
 * @param schema - Zod schema to validate against
 * @param defaultValue - Value to return if parsing/validation fails
 * @returns Validated data or default value
 * 
 * @example
 * const projects = safeParseJSON(
 *   localStorage.getItem('projects'),
 *   ProjectArraySchema,
 *   []
 * );
 */
export function safeParseJSON<T>(
  jsonString: string | null,
  schema: z.ZodSchema<T>,
  defaultValue: T
): T {
  if (!jsonString) {
    return defaultValue;
  }

  try {
    // Step 1: Parse JSON
    const parsed = JSON.parse(jsonString);
    
    // Step 2: Validate with schema
    const result = schema.safeParse(parsed);
    
    if (result.success) {
      return result.data;
    } else {
      // Log validation errors for debugging
      console.warn('Validation failed:', result.error.format());
      return defaultValue;
    }
  } catch (error) {
    // JSON.parse failed
    console.error('JSON parsing failed:', error);
    return defaultValue;
  }
}

/**
 * Validate and sanitize project array from localStorage
 * 
 * This function is more lenient - it filters out invalid projects
 * rather than rejecting the entire array.
 * 
 * @param data - Unknown data from localStorage
 * @returns Array of validated projects (may be empty)
 * 
 * @example
 * const projects = validateProjects(JSON.parse(raw));
 */
export function validateProjects(data: unknown): ValidatedProject[] {
  if (!Array.isArray(data)) {
    console.warn('Project data is not an array');
    return [];
  }

  const validated: ValidatedProject[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const result = ProjectArraySchema.element.safeParse(data[i]);
    
    if (result.success) {
      validated.push(result.data);
    } else {
      console.warn(`Invalid project at index ${i}:`, result.error.format());
      // Skip invalid project but continue with others
    }
  }

  return validated;
}

/**
 * Sanitize localStorage data by removing corrupted entries
 * 
 * Use this for critical operations where you want to clean up
 * corrupted data rather than just ignoring it.
 * 
 * @param key - localStorage key
 * @param schema - Validation schema
 * @returns Sanitized and validated data, or null if cleanup failed
 */
export function sanitizeLocalStorage<T>(
  key: string,
  schema: z.ZodSchema<T>
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    // Data is invalid - remove it to prevent future errors
    console.warn(`Removing corrupted data from localStorage: ${key}`);
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error(`Failed to sanitize localStorage key "${key}":`, error);
    // Remove corrupted data
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Validate hex color string
 * 
 * @param color - Color string to validate
 * @param defaultColor - Default to return if invalid
 * @returns Valid hex color
 */
export function validateColor(color: unknown, defaultColor: string = '#000000'): string {
  if (typeof color !== 'string') return defaultColor;
  
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexRegex.test(color) ? color : defaultColor;
}

/**
 * Validate numeric range
 * 
 * @param value - Value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param defaultValue - Default if invalid
 * @returns Valid number within range
 */
export function validateNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Validate string length
 * 
 * @param value - String to validate
 * @param maxLength - Maximum allowed length
 * @param defaultValue - Default if invalid
 * @returns Valid string (truncated if needed)
 */
export function validateString(
  value: unknown,
  maxLength: number,
  defaultValue: string = ''
): string {
  if (typeof value !== 'string') {
    return defaultValue;
  }
  return value.length > maxLength ? value.substring(0, maxLength) : value;
}

/**
 * Check if data looks like it might be malicious
 * 
 * This is a simple heuristic check for obvious attacks.
 * Real validation should use schemas.
 * 
 * @param data - Data to check
 * @returns true if data appears suspicious
 */
export function isSuspiciousData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const str = JSON.stringify(data);
  
  // Check for prototype pollution attempts
  if (str.includes('__proto__') || str.includes('constructor') || str.includes('prototype')) {
    console.warn('Suspicious data detected: potential prototype pollution');
    return true;
  }

  // Check for excessively large data
  if (str.length > 10 * 1024 * 1024) { // 10MB
    console.warn('Suspicious data detected: excessively large payload');
    return true;
  }

  return false;
}
