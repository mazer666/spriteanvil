/**
 * src/utils/inputValidation.ts
 * -----------------------------------------------------------------------------
 * ## INPUT LENGTH VALIDATION (Resource Exhaustion Prevention)
 * 
 * This module provides validation utilities for user input fields to prevent:
 * - Memory exhaustion from excessively long strings
 * - Database constraint violations
 * - UI rendering issues
 * - Storage quota problems
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #12: No Input Length Limits on Text Fields
 * 
 * @module utils/inputValidation
 */

/**
 * Maximum field lengths (matched to database constraints)
 */
export const MAX_LENGTHS = {
  PROJECT_NAME: 255,
  PROJECT_DESCRIPTION: 1000,
  LAYER_NAME: 100,
  FRAME_TAG_NAME: 100,
  PALETTE_NAME: 100,
  USER_NAME: 100,
  AI_PROMPT: 2000,
  GENERIC_SHORT: 255,
  GENERIC_LONG: 1000,
} as const;

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  trimmed?: string;
}

/**
 * Validate and sanitize text input
 * 
 * @param value - Input value to validate
 * @param maxLength - Maximum allowed length
 * @param fieldName - Name of field (for error messages)
 * @param required - Whether field is required
 * @returns Validation result
 */
export function validateTextInput(
  value: string,
  maxLength: number,
  fieldName: string = 'Field',
  required: boolean = false
): ValidationResult {
  // Trim whitespace
  const trimmed = value.trim();

  // Check if required
  if (required && trimmed.length === 0) {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // Check length
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} must be ${maxLength} characters or less (currently ${trimmed.length})`,
    };
  }

  return {
    valid: true,
    trimmed,
  };
}

/**
 * Truncate text to maximum length
 * 
 * @param value - Text to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - Whether to add "..." at end
 * @returns Truncated text
 */
export function truncateText(
  value: string,
  maxLength: number,
  ellipsis: boolean = true
): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.substring(0, maxLength);
  return ellipsis ? truncated + '...' : truncated;
}

/**
 * Validate project name
 */
export function validateProjectName(name: string): ValidationResult {
  return validateTextInput(name, MAX_LENGTHS.PROJECT_NAME, 'Project name', true);
}

/**
 * Validate project description
 */
export function validateProjectDescription(description: string): ValidationResult {
  return validateTextInput(description, MAX_LENGTHS.PROJECT_DESCRIPTION, 'Description', false);
}

/**
 * Validate layer name
 */
export function validateLayerName(name: string): ValidationResult {
  return validateTextInput(name, MAX_LENGTHS.LAYER_NAME, 'Layer name', true);
}

/**
 * Validate AI prompt
 */
export function validateAIPrompt(prompt: string): ValidationResult {
  return validateTextInput(prompt, MAX_LENGTHS.AI_PROMPT, 'AI prompt', true);
}

/**
 * Validate palette name
 */
export function validatePaletteName(name: string): ValidationResult {
  return validateTextInput(name, MAX_LENGTHS.PALETTE_NAME, 'Palette name', true);
}

/**
 * Get character count display
 * 
 * @param current - Current character count
 * @param max - Maximum allowed
 * @returns Formatted string like "45/255"
 */
export function getCharacterCount(current: number, max: number): string {
  return `${current}/${max}`;
}

/**
 * Check if approaching character limit
 * 
 * @param current - Current character count
 * @param max - Maximum allowed
 * @param threshold - Warning threshold (default 0.8 = 80%)
 * @returns true if approaching limit
 */
export function isApproachingLimit(
  current: number,
  max: number,
  threshold: number = 0.8
): boolean {
  return current / max >= threshold;
}

/**
 * Sanitize input by removing potentially problematic characters
 * 
 * @param value - Input to sanitize
 * @param allowNewlines - Whether to allow newline characters
 * @returns Sanitized string
 */
export function sanitizeInput(
  value: string,
  allowNewlines: boolean = false
): string {
  let sanitized = value;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters except tab and newline
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  } else {
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  return sanitized;
}

/**
 * React hook helper for input validation
 * Returns [value, setValue, error, isValid]
 */
export function useValidatedInput(
  initialValue: string,
  maxLength: number,
  fieldName: string,
  required: boolean = false
): [
  string,
  (value: string) => void,
  string | undefined,
  boolean
] {
  let currentValue = initialValue;
  let currentError: string | undefined;
  let isValid = true;

  const setValue = (value: string) => {
    currentValue = value;
    const result = validateTextInput(value, maxLength, fieldName, required);
    currentError = result.error;
    isValid = result.valid;
  };

  return [currentValue, setValue, currentError, isValid];
}
