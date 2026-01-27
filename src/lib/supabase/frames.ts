/**
 * Frame Database Operations
 *
 * Functions for managing animation frames within sprites.
 * Each frame can have multiple layers.
 *
 * @module lib/supabase/frames
 */

import { supabase } from "./client"

/**
 * Frame data structure
 */
export interface Frame {
  id: string
  sprite_id: string
  frame_index: number
  duration_ms: number
  is_visible: boolean
  created_at: string
}

/**
 * Layer data structure
 */
export interface Layer {
  id: string
  frame_id: string
  layer_index: number
  name: string
  pixel_data: string // Base64-encoded pixel buffer
  opacity: number
  blend_mode: string
  is_visible: boolean
  is_locked: boolean
  created_at: string
}

/**
 * Data for creating a new frame
 */
export interface CreateFrameData {
  sprite_id: string
  frame_index: number
  duration_ms?: number
  is_visible?: boolean
}

/**
 * Data for creating a new layer
 */
export interface CreateLayerData {
  frame_id: string
  layer_index: number
  name: string
  pixel_data: string
  opacity?: number
  blend_mode?: string
  is_visible?: boolean
  is_locked?: boolean
}

/**
 * Creates a new frame
 *
 * @param data - Frame data
 * @returns Created frame, or null on error
 */
export async function createFrame(data: CreateFrameData): Promise<Frame | null> {
  const { data: frame, error } = await supabase
    .from("frames")
    .insert({
      sprite_id: data.sprite_id,
      frame_index: data.frame_index,
      duration_ms: data.duration_ms || 100,
      is_visible: data.is_visible !== undefined ? data.is_visible : true
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error creating frame:", error)
    return null
  }

  return frame
}

/**
 * Gets all frames for a sprite
 *
 * @param spriteId - Sprite ID
 * @returns Array of frames ordered by frame_index
 */
export async function getFrames(spriteId: string): Promise<Frame[]> {
  const { data, error } = await supabase
    .from("frames")
    .select("*")
    .eq("sprite_id", spriteId)
    .order("frame_index", { ascending: true })

  if (error) {
    console.error("Error fetching frames:", error)
    return []
  }

  return data || []
}

/**
 * Gets a single frame by ID
 *
 * @param frameId - Frame ID
 * @returns Frame, or null if not found
 */
export async function getFrame(frameId: string): Promise<Frame | null> {
  const { data, error } = await supabase.from("frames").select("*").eq("id", frameId).maybeSingle()

  if (error) {
    console.error("Error fetching frame:", error)
    return null
  }

  return data
}

/**
 * Updates a frame
 *
 * @param frameId - Frame ID
 * @param data - Data to update
 * @returns Updated frame, or null on error
 */
export async function updateFrame(
  frameId: string,
  data: Partial<CreateFrameData>
): Promise<Frame | null> {
  const { data: frame, error } = await supabase
    .from("frames")
    .update(data)
    .eq("id", frameId)
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error updating frame:", error)
    return null
  }

  return frame
}

/**
 * Deletes a frame
 *
 * WARNING: This also deletes all layers in the frame (cascade delete).
 *
 * @param frameId - Frame ID
 * @returns true on success
 */
export async function deleteFrame(frameId: string): Promise<boolean> {
  const { error } = await supabase.from("frames").delete().eq("id", frameId)

  if (error) {
    console.error("Error deleting frame:", error)
    return false
  }

  return true
}

/**
 * Creates a new layer
 *
 * @param data - Layer data
 * @returns Created layer, or null on error
 */
export async function createLayer(data: CreateLayerData): Promise<Layer | null> {
  const { data: layer, error } = await supabase
    .from("layers")
    .insert({
      frame_id: data.frame_id,
      layer_index: data.layer_index,
      name: data.name,
      pixel_data: data.pixel_data,
      opacity: data.opacity !== undefined ? data.opacity : 1.0,
      blend_mode: data.blend_mode || "normal",
      is_visible: data.is_visible !== undefined ? data.is_visible : true,
      is_locked: data.is_locked !== undefined ? data.is_locked : false
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error creating layer:", error)
    return null
  }

  return layer
}

/**
 * Gets all layers for a frame
 *
 * @param frameId - Frame ID
 * @returns Array of layers ordered by layer_index
 */
export async function getLayers(frameId: string): Promise<Layer[]> {
  const { data, error } = await supabase
    .from("layers")
    .select("*")
    .eq("frame_id", frameId)
    .order("layer_index", { ascending: true })

  if (error) {
    console.error("Error fetching layers:", error)
    return []
  }

  return data || []
}

/**
 * Gets a single layer by ID
 *
 * @param layerId - Layer ID
 * @returns Layer, or null if not found
 */
export async function getLayer(layerId: string): Promise<Layer | null> {
  const { data, error } = await supabase.from("layers").select("*").eq("id", layerId).maybeSingle()

  if (error) {
    console.error("Error fetching layer:", error)
    return null
  }

  return data
}

/**
 * Updates a layer
 *
 * @param layerId - Layer ID
 * @param data - Data to update
 * @returns Updated layer, or null on error
 */
export async function updateLayer(
  layerId: string,
  data: Partial<CreateLayerData>
): Promise<Layer | null> {
  const { data: layer, error } = await supabase
    .from("layers")
    .update(data)
    .eq("id", layerId)
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error updating layer:", error)
    return null
  }

  return layer
}

/**
 * Deletes a layer
 *
 * @param layerId - Layer ID
 * @returns true on success
 */
export async function deleteLayer(layerId: string): Promise<boolean> {
  const { error } = await supabase.from("layers").delete().eq("id", layerId)

  if (error) {
    console.error("Error deleting layer:", error)
    return false
  }

  return true
}

/**
 * Encodes a pixel buffer to base64 for storage
 *
 * @param buffer - Pixel buffer (RGBA)
 * @returns Base64-encoded string
 */
export function encodePixelData(buffer: Uint8ClampedArray): string {
  // Convert buffer to base64
  let binary = ""
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
}

/**
 * Decodes base64 pixel data back to buffer
 *
 * @param base64 - Base64-encoded pixel data
 * @returns Pixel buffer (RGBA)
 */
export function decodePixelData(base64: string): Uint8ClampedArray {
  const binary = atob(base64)
  const buffer = new Uint8ClampedArray(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}
