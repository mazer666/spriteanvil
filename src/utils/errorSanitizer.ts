/**
 * src/utils/errorSanitizer.ts
 * -----------------------------------------------------------------------------
 * ## ERROR MESSAGE SANITIZATION (Information Disclosure Prevention)
 * 
 * This module sanitizes error messages before displaying them to users,
 * preventing information disclosure about internal implementation details,
 * API keys, or system architecture.
 * 
 * ## WHY THIS MATTERS
 * Raw error messages can leak:
 * - API endpoint URLs and structure
 * - Database schema information
 * - Authentication token details
 * - Internal file paths
 * - Stack traces with sensitive data
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #10: Insufficient Error Message Sanitization
 * 
 * @module utils/errorSanitizer
 */

/**
 * Error codes for user-facing messages
 */
export enum ErrorCode {
  // AI/Image Generation Errors (E001-E099)
  AI_REQUEST_FAILED = 'E001',
  AI_RATE_LIMIT = 'E002',
  AI_INVALID_KEY = 'E003',
  AI_QUOTA_EXCEEDED = 'E004',
  AI_NETWORK_ERROR = 'E005',
  
  // Authentication/Authorization Errors (E100-E199)
  AUTH_FAILED = 'E100',
  AUTH_SESSION_EXPIRED = 'E101',
  AUTH_INVALID_CREDENTIALS = 'E102',
  AUTH_PERMISSION_DENIED = 'E103',
  
  // Database/Storage Errors (E200-E299)
  DB_CONNECTION_FAILED = 'E200',
  DB_QUERY_FAILED = 'E201',
  DB_CONSTRAINT_VIOLATION = 'E202',
  STORAGE_QUOTA_EXCEEDED = 'E203',
  STORAGE_UNAVAILABLE = 'E204',
  
  // Validation Errors (E300-E399)
  VALIDATION_ERROR = 'E300',
  INVALID_INPUT = 'E301',
  DATA_CORRUPTED = 'E302',
  
  // Network Errors (E400-E499)
  NETWORK_ERROR = 'E400',
  NETWORK_TIMEOUT = 'E401',
  NETWORK_OFFLINE = 'E402',
  
  // File/Import Errors (E500-E599)
  FILE_INVALID_FORMAT = 'E500',
  FILE_TOO_LARGE = 'E501',
  FILE_READ_ERROR = 'E502',
  
  // Unknown/Generic Errors (E999)
  UNKNOWN_ERROR = 'E999',
}

/**
 * User-friendly error messages mapped to error codes
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // AI Errors
  [ErrorCode.AI_REQUEST_FAILED]: 'Unable to generate image. Please try again later.',
  [ErrorCode.AI_RATE_LIMIT]: 'Too many AI requests. Please wait a moment and try again.',
  [ErrorCode.AI_INVALID_KEY]: 'AI API key is invalid. Please check your settings.',
  [ErrorCode.AI_QUOTA_EXCEEDED]: 'AI usage quota exceeded. Please check your API account.',
  [ErrorCode.AI_NETWORK_ERROR]: 'Network error connecting to AI service. Check your connection.',
  
  // Auth Errors
  [ErrorCode.AUTH_FAILED]: 'Authentication failed. Please sign in again.',
  [ErrorCode.AUTH_SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid username or password.',
  [ErrorCode.AUTH_PERMISSION_DENIED]: 'You don\'t have permission to perform this action.',
  
  // Database Errors
  [ErrorCode.DB_CONNECTION_FAILED]: 'Unable to connect to database. Please try again later.',
  [ErrorCode.DB_QUERY_FAILED]: 'Database operation failed. Please try again.',
  [ErrorCode.DB_CONSTRAINT_VIOLATION]: 'Data validation failed. Please check your input.',
  [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please free up space.',
  [ErrorCode.STORAGE_UNAVAILABLE]: 'Storage is temporarily unavailable. Please try again later.',
  
  // Validation Errors
  [ErrorCode.VALIDATION_ERROR]: 'Invalid data. Please check your input.',
  [ErrorCode.INVALID_INPUT]: 'The data you entered is invalid. Please check and try again.',
  [ErrorCode.DATA_CORRUPTED]: 'Data appears to be corrupted. Please refresh and try again.',
  
  // Network Errors
  [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your internet connection.',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.NETWORK_OFFLINE]: 'You appear to be offline. Please check your connection.',
  
  // File Errors
  [ErrorCode.FILE_INVALID_FORMAT]: 'Invalid file format. Please check the file and try again.',
  [ErrorCode.FILE_TOO_LARGE]: 'File is too large. Please use a smaller file.',
  [ErrorCode.FILE_READ_ERROR]: 'Unable to read file. Please try again.',
  
  // Unknown
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

/**
 * Sanitized error result
 */
export interface SanitizedError {
  code: ErrorCode;
  message: string;
  timestamp: string;
  canRetry: boolean;
}

/**
 * Patterns to detect in error messages (for categorization)
 */
const ERROR_PATTERNS = {
  ai: /openrouter|dall-e|stability|anthropic|image.generation|api.key/i,
  auth: /auth|login|session|credential|permission|unauthorized|forbidden/i,
  database: /supabase|postgres|database|query|sql/i,
  network: /network|fetch|timeout|cors|connection|offline/i,
  validation: /validation|invalid|schema|parse/i,
  rateLimit: /rate.limit|too.many.requests|429/i,
  quota: /quota|limit.exceeded|usage/i,
};

/**
 * Sanitize error and return user-friendly message
 * 
 * @param error - Error object or unknown error
 * @returns Sanitized error with code and user-friendly message
 */
export function sanitizeError(error: unknown): SanitizedError {
  // Log full error for debugging (server-side in production)
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    error: error,
    stack: error instanceof Error ? error.stack : undefined,
  });

  let code = ErrorCode.UNKNOWN_ERROR;
  let canRetry = true;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Categorize error based on message content
    if (ERROR_PATTERNS.rateLimit.test(message)) {
      code = ErrorCode.AI_RATE_LIMIT;
      canRetry = true;
    } else if (ERROR_PATTERNS.quota.test(message)) {
      code = ErrorCode.AI_QUOTA_EXCEEDED;
      canRetry = false;
    } else if (ERROR_PATTERNS.ai.test(message)) {
      if (message.includes('key') || message.includes('auth')) {
        code = ErrorCode.AI_INVALID_KEY;
        canRetry = false;
      } else {
        code = ErrorCode.AI_REQUEST_FAILED;
        canRetry = true;
      }
    } else if (ERROR_PATTERNS.auth.test(message)) {
      if (message.includes('session') || message.includes('expired')) {
        code = ErrorCode.AUTH_SESSION_EXPIRED;
        canRetry = false;
      } else if (message.includes('permission') || message.includes('forbidden')) {
        code = ErrorCode.AUTH_PERMISSION_DENIED;
        canRetry = false;
      } else {
        code = ErrorCode.AUTH_FAILED;
        canRetry = false;
      }
    } else if (ERROR_PATTERNS.database.test(message)) {
      code = ErrorCode.DB_QUERY_FAILED;
      canRetry = true;
    } else if (ERROR_PATTERNS.network.test(message)) {
      if (message.includes('timeout')) {
        code = ErrorCode.NETWORK_TIMEOUT;
      } else if (message.includes('offline')) {
        code = ErrorCode.NETWORK_OFFLINE;
      } else {
        code = ErrorCode.NETWORK_ERROR;
      }
      canRetry = true;
    } else if (ERROR_PATTERNS.validation.test(message)) {
      code = ErrorCode.VALIDATION_ERROR;
      canRetry = false;
    }
  }

  return {
    code,
    message: ERROR_MESSAGES[code],
    timestamp: new Date().toISOString(),
    canRetry,
  };
}

/**
 * Quick sanitize - just returns user-friendly message string
 */
export function sanitizeErrorMessage(error: unknown): string {
  return sanitizeError(error).message;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return sanitizeError(error).canRetry;
}

/**
 * Create a sanitized error object for throwing
 */
export class SanitizedErrorClass extends Error {
  public readonly code: ErrorCode;
  public readonly canRetry: boolean;
  public readonly timestamp: string;

  constructor(sanitized: SanitizedError) {
    super(sanitized.message);
    this.name = 'SanitizedError';
    this.code = sanitized.code;
    this.canRetry = sanitized.canRetry;
    this.timestamp = sanitized.timestamp;
  }
}
