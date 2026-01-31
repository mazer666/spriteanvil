/**
 * src/types/schemas.ts
 * -----------------------------------------------------------------------------
 * ## VALIDATION SCHEMAS (Security Layer)
 * 
 * This module defines Zod validation schemas for all data structures that come
 * from untrusted sources (localStorage, user input, external APIs).
 * 
 * ## WHY VALIDATION MATTERS
 * Without validation, malicious or corrupted data could:
 * - Crash the application
 * - Execute malicious code (prototype pollution)
 * - Corrupt the user's project data
 * - Cause UI glitches or unexpected behavior
 * 
 * ## JARGON GLOSSARY
 * 1. SCHEMA: A blueprint that describes what valid data looks like
 * 2. ZOD: A TypeScript-first validation library with excellent type inference
 * 3. SANITIZE: Remove or fix invalid data before using it
 * 4. SAFE PARSE: Parse data without throwing errors (returns success/failure)
 * 
 * ## SECURITY NOTE
 * This addresses Security Issue #2 from the audit:
 * "Unvalidated JSON Parsing from localStorage"
 * 
 * @module types/schemas
 */

import { z } from 'zod';

/**
 * Project Schema
 * 
 * Validates project objects loaded from localStorage or Supabase.
 * All fields are validated for type, format, and reasonable limits.
 */
export const ProjectSchema = z.object({
  id: z.string().uuid('Invalid project ID format'),
  user_id: z.string().min(1, 'User ID required'),
  name: z.string()
    .min(1, 'Project name required')
    .max(255, 'Project name too long'),
  description: z.string()
    .max(1000, 'Description too long')
    .nullable(),
  thumbnail_url: z.string()
    .url('Invalid thumbnail URL')
    .nullable(),
  created_at: z.string().datetime('Invalid date format'),
  updated_at: z.string().datetime('Invalid date format'),
  is_archived: z.boolean().default(false),
  metadata: z.any().nullable().optional(),
});

/**
 * Array of projects schema
 */
export const ProjectArraySchema = z.array(ProjectSchema);

/**
 * Type inference from schema
 */
export type ValidatedProject = z.infer<typeof ProjectSchema>;

/**
 * Palette Schema
 * 
 * Validates palette data to ensure:
 * - Color values are valid hex codes
 * - Arrays have reasonable length limits
 * - Required fields are present
 */
export const PaletteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  colors: z.array(
    z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format')
  ).min(1).max(256, 'Too many colors in palette'),
  is_default: z.boolean().optional(),
});

export const PaletteArraySchema = z.array(PaletteSchema);

/**
 * Layer Data Schema
 * 
 * Validates layer structure but not pixel data (too large to validate)
 */
export const LayerDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  opacity: z.number().min(0).max(1),
  blend_mode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'add']),
  is_visible: z.boolean(),
  is_locked: z.boolean(),
  // pixel_data validated separately due to size
});

/**
 * Frame Schema
 * 
 * Validates frame metadata
 */
export const FrameSchema = z.object({
  id: z.string().uuid(),
  durationMs: z.number().int().min(1).max(10000),
  pivot: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
  }).optional(),
});

/**
 * Canvas Spec Schema
 * 
 * Validates canvas dimensions to prevent resource exhaustion
 */
export const CanvasSpecSchema = z.object({
  width: z.number().int().min(1).max(4096, 'Canvas width too large'),
  height: z.number().int().min(1).max(4096, 'Canvas height too large'),
});

/**
 * Animation Tag Schema
 */
export const AnimationTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  start_frame: z.number().int().min(0),
  end_frame: z.number().int().min(0),
  sprite_id: z.string().uuid().optional(),
});

/**
 * User Settings Schema (partial)
 * 
 * Validates user settings with safe defaults
 */
export const UserSettingsSchema = z.object({
  zoom: z.number().min(0.1).max(32).default(8),
  brushSize: z.number().int().min(1).max(100).default(1),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#f2ead7'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  // ... other settings can be added as needed
}).partial(); // All fields optional with defaults

/**
 * Export all schemas for easy import
 */
export const schemas = {
  Project: ProjectSchema,
  ProjectArray: ProjectArraySchema,
  Palette: PaletteSchema,
  PaletteArray: PaletteArraySchema,
  Layer: LayerDataSchema,
  Frame: FrameSchema,
  CanvasSpec: CanvasSpecSchema,
  AnimationTag: AnimationTagSchema,
  UserSettings: UserSettingsSchema,
};
