/**
 * src/hooks/useProjectPersistence.ts
 * -----------------------------------------------------------------------------
 * ## PROJECT PERSISTENCE HOOK
 * 
 * This hook encapsulates all project save/load logic including:
 * - Local storage persistence (offline mode)
 * - Snapshot serialization/deserialization
 * - Project state management
 * 
 * WHY THIS EXISTS:
 * Extracted from App.tsx to reduce complexity and improve testability.
 * Part of the Phase 16 refactoring initiative.
 * 
 * USED BY:
 * - src/App.tsx
 */

import { useCallback, useRef } from "react";
import { validateProjects } from "../utils/validation";
import { Project, ProjectSnapshotPayload } from "../lib/supabase/projects";
import { PaletteData, ProjectSnapshot } from "../lib/projects/snapshot";
import { cacheProjectSnapshot, getCachedProjectSnapshot } from "../lib/storage/frameCache";
import { CanvasSpec, UiSettings, Frame, LayerData, BlendMode } from "../types";

const LOCAL_PROJECTS_KEY = "spriteanvil:localProjects";

// ============================================================================
// PIXEL ENCODING/DECODING
// ============================================================================

/**
 * Encode a pixel buffer (Uint8ClampedArray) to base64 string for storage.
 * 
 * @param buffer - RGBA pixel data
 * @returns Base64 encoded string
 */
export function encodePixels(buffer: Uint8ClampedArray): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Decode a base64 string back to pixel buffer.
 * 
 * @param data - Base64 encoded pixel data
 * @returns RGBA pixel buffer
 */
export function decodePixels(data: string): Uint8ClampedArray {
  const binary = atob(data);
  const bytes = new Uint8ClampedArray(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// SNAPSHOT SERIALIZATION
// ============================================================================

/**
 * Convert internal ProjectSnapshot to storage-ready format.
 * Encodes all pixel buffers to base64 strings.
 */
export function serializeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotPayload {
  return {
    version: snapshot.version,
    canvas: snapshot.canvas,
    current_frame_index: snapshot.currentFrameIndex,
    active_layer_ids: snapshot.activeLayerIds,
    palettes: snapshot.palettes,
    active_palette_id: snapshot.activePaletteId,
    recent_colors: snapshot.recentColors,
    settings: snapshot.settings ?? {},
    frames: snapshot.frames.map((frame) => ({
      id: frame.id,
      duration_ms: frame.durationMs,
      pivot: frame.pivot,
      layers: frame.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        blend_mode: layer.blend_mode,
        is_visible: layer.is_visible,
        is_locked: layer.is_locked,
        pixel_data: encodePixels(layer.pixels),
      })),
    })),
  };
}

/**
 * Convert storage format back to internal ProjectSnapshot.
 * Decodes all base64 pixel data back to Uint8ClampedArray.
 */
export function deserializeSnapshot(payload: ProjectSnapshotPayload): ProjectSnapshot {
  return {
    version: payload.version,
    canvas: payload.canvas,
    currentFrameIndex: payload.current_frame_index,
    activeLayerIds: payload.active_layer_ids,
    palettes: payload.palettes,
    activePaletteId: payload.active_palette_id,
    recentColors: payload.recent_colors,
    settings: payload.settings as Partial<UiSettings>,
    frames: payload.frames.map((frame) => ({
      id: frame.id,
      durationMs: frame.duration_ms,
      pivot: frame.pivot,
      layers: frame.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        blend_mode: layer.blend_mode as BlendMode,
        is_visible: layer.is_visible,
        is_locked: layer.is_locked,
        pixels: decodePixels(layer.pixel_data),
      })),
    })),
  };
}

// ============================================================================
// LOCAL STORAGE OPERATIONS
// ============================================================================

/**
 * Load projects from localStorage with Zod validation.
 * 
 * SECURITY: Validates all data to prevent injection attacks,
 * prototype pollution, and data corruption.
 */
export function loadLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    
    const parsed = JSON.parse(raw);
    const validated = validateProjects(parsed);
    
    if (validated.length === 0 && Array.isArray(parsed) && parsed.length > 0) {
      console.error('All projects in localStorage failed validation. Data may be corrupted.');
    }
    
    return validated;
  } catch (error) {
    console.warn("Failed to parse local projects:", error);
    return [];
  }
}

/**
 * Save projects array to localStorage.
 */
export function saveLocalProjects(projects: Project[]): void {
  localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(projects));
}

// ============================================================================
// CACHE OPERATIONS (re-exported for convenience)
// ============================================================================

export { cacheProjectSnapshot, getCachedProjectSnapshot };

// ============================================================================
// HOOK INTERFACE
// ============================================================================

export interface UseProjectPersistenceOptions {
  onError?: (error: Error) => void;
}

export interface UseProjectPersistenceReturn {
  // Pure functions (can be used directly)
  encodePixels: typeof encodePixels;
  decodePixels: typeof decodePixels;
  serializeSnapshot: typeof serializeSnapshot;
  deserializeSnapshot: typeof deserializeSnapshot;
  loadLocalProjects: typeof loadLocalProjects;
  saveLocalProjects: typeof saveLocalProjects;
  
  // Cache operations
  cacheProjectSnapshot: typeof cacheProjectSnapshot;
  getCachedProjectSnapshot: typeof getCachedProjectSnapshot;
}

/**
 * Hook providing project persistence utilities.
 * 
 * Currently exports pure functions - future versions may add
 * stateful persistence features like auto-save.
 * 
 * @example
 * const { serializeSnapshot, deserializeSnapshot, loadLocalProjects } = useProjectPersistence();
 */
export function useProjectPersistence(
  _options?: UseProjectPersistenceOptions
): UseProjectPersistenceReturn {
  return {
    encodePixels,
    decodePixels,
    serializeSnapshot,
    deserializeSnapshot,
    loadLocalProjects,
    saveLocalProjects,
    cacheProjectSnapshot,
    getCachedProjectSnapshot,
  };
}

export default useProjectPersistence;
