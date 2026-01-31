/**
 * src/utils/fileValidator.ts
 * -----------------------------------------------------------------------------
 * ## IMPORT FILE VALIDATION (File Upload Security)
 * 
 * This module validates imported files to prevent:
 * - Malicious file uploads
 * - Memory exhaustion from huge files
 * - Data corruption from invalid formats
 * - XSS attacks via SVG or other file types
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #14: No Integrity Checking on Imported Files
 * 
 * @module utils/fileValidator
 */

import { z } from 'zod';

/**
 * File size limits (in bytes)
 */
const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024,    // 10MB for images
  PALETTE: 1 * 1024 * 1024,   // 1MB for palette files
  PROJECT: 50 * 1024 * 1024,  // 50MB for project exports
} as const;

/**
 * Allowed MIME types
 */
const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  PALETTE: ['application/json', 'text/plain'],
  PROJECT: ['application/json'],
} as const;

/**
 * Validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  metadata?: {
    size: number;
    type: string;
    name: string;
  };
}

/**
 * Palette file schema (from existing code)
 */
const ColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  a: z.number().int().min(0).max(255),
});

const PaletteSchema = z.object({
  name: z.string().max(100),
  colors: z.array(ColorSchema).max(256), // Max 256 colors
  description: z.string().max(500).optional(),
  created_at: z.string().optional(),
});

/**
 * Validate file basics (size, type)
 * 
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes
 * @param allowedTypes - Allowed MIME types
 * @returns Validation result
 */
export function validateFileBasics(
  file: File,
  maxSize: number,
  allowedTypes: readonly string[]
): FileValidationResult {
  const warnings: string[] = [];

  // Check file name
  if (file.name.length > 255) {
    return {
      valid: false,
      error: 'File name too long (max 255 characters)',
    };
  }

  // Check for suspicious file names
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\\\')) {
    return {
      valid: false,
      error: 'Invalid file name (contains suspicious characters)',
    };
  }

  // Check file size
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File too large (${formatBytes(file.size)}, max ${formatBytes(maxSize)})`,
    };
  }

  // Warn if file is suspiciously large
  if (file.size > maxSize * 0.8) {
    warnings.push(`File is quite large (${formatBytes(file.size)})`);
  }

  // Check MIME type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type (${file.type}). Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
    metadata: {
      size: file.size,
      type: file.type,
      name: file.name,
    },
  };
}

/**
 * Validate palette JSON file
 * 
 * @param file - Palette file to validate
 * @returns Validation result with parsed data
 */
export async function validatePaletteFile(
  file: File
): Promise<FileValidationResult & { data?: z.infer<typeof PaletteSchema> }> {
  // Basic validation
  const basicCheck = validateFileBasics(
    file,
    FILE_SIZE_LIMITS.PALETTE,
    ALLOWED_MIME_TYPES.PALETTE
  );

  if (!basicCheck.valid) {
    return basicCheck;
  }

  try {
    // Read file content
    const content = await file.text();

    // Check for null bytes (binary file masquerading as text)
    if (content.includes('\0')) {
      return {
        valid: false,
        error: 'File appears to be binary, not JSON',
      };
    }

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid JSON format',
      };
    }

    // Validate against schema
    const result = PaletteSchema.safeParse(parsed);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return {
        valid: false,
        error: `Invalid palette structure: ${firstError?.message || 'Validation failed'}`,
      };
    }

    // Additional security checks
    const warnings = basicCheck.warnings || [];

    // Check for excessive colors
    if (result.data.colors.length > 128) {
      warnings.push(`Large palette (${result.data.colors.length} colors)`);
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: basicCheck.metadata,
      data: result.data,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate image file
 * 
 * @param file - Image file to validate
 * @returns Validation result
 */
export async function validateImageFile(
  file: File
): Promise<FileValidationResult & { dimensions?: { width: number; height: number } }> {
  // Basic validation
  const basicCheck = validateFileBasics(
    file,
    FILE_SIZE_LIMITS.IMAGE,
    ALLOWED_MIME_TYPES.IMAGE
  );

  if (!basicCheck.valid) {
    return basicCheck;
  }

  try {
    // Verify it's actually an image by trying to load it
    const bitmap = await createImageBitmap(file);
    const dimensions = {
      width: bitmap.width,
      height: bitmap.height,
    };

    const warnings = basicCheck.warnings || [];

    // Warn about very large images
    const pixelCount = dimensions.width * dimensions.height;
    if (pixelCount > 4096 * 4096) {
      warnings.push('Very large image dimensions, may impact performance');
    }

    // Check aspect ratio (extremely wide/tall images might be suspicious)
    const aspectRatio = dimensions.width / dimensions.height;
    if (aspectRatio > 10 || aspectRatio < 0.1) {
      warnings.push('Unusual aspect ratio detected');
    }

    // Clean up
    bitmap.close();

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: basicCheck.metadata,
      dimensions,
    };
  } catch (error) {
    return {
      valid: false,
      error: 'File is not a valid image or is corrupted',
    };
  }
}

/**
 * Sanitize file name for storage
 * 
 * @param fileName - Original file name
 * @returns Sanitized file name
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path components
  const baseName = fileName.split('/').pop()?.split('\\\\').pop() || 'file';

  // Remove or replace dangerous characters
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 255);

  return sanitized || 'file';
}

/**
 * Check if file extension matches MIME type
 * 
 * @param fileName - File name
 * @param mimeType - MIME type
 * @returns true if they match
 */
export function extensionMatchesMimeType(fileName: string, mimeType: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  const mimeToExt: Record<string, string[]> = {
    'image/png': ['png'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'application/json': ['json'],
    'text/plain': ['txt'],
  };

  const expectedExts = mimeToExt[mimeType];
  return expectedExts ? expectedExts.includes(ext || '') : true;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Quick file validation (synchronous, basic checks only)
 * Use before async validation for immediate feedback
 */
export function quickValidateFile(
  file: File,
  fileType: 'image' | 'palette' | 'project'
): FileValidationResult {
  let maxSize: number;
  let allowedTypes: readonly string[];

  switch (fileType) {
    case 'image':
      maxSize = FILE_SIZE_LIMITS.IMAGE;
      allowedTypes = ALLOWED_MIME_TYPES.IMAGE;
      break;
    case 'palette':
      maxSize = FILE_SIZE_LIMITS.PALETTE;
      allowedTypes = ALLOWED_MIME_TYPES.PALETTE;
      break;
    case 'project':
      maxSize = FILE_SIZE_LIMITS.PROJECT;
      allowedTypes = ALLOWED_MIME_TYPES.PROJECT;
      break;
  }

  return validateFileBasics(file, maxSize, allowedTypes);
}
