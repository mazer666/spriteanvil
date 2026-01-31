/**
 * src/lib/supabase/sprites.ts
 * -----------------------------------------------------------------------------
 * ## SPRITE MANAGEMENT (Noob Guide)
 * 
 * Think of a Sprite as a "Drawing Canvas" inside a Project.
 * 
 * 1. DIMENSIONS: Unlike Projects, Sprites have fixed Width and Height.
 * 2. HIERARCHY: Projects -> Sprites -> Frames -> Layers.
 * 
 * ## VAR TRACE
 * - `project_id`: (Origin: App.tsx) Links this canvas to a specific project.
 * - `width/height`: (Origin: New Sprite Dialog) Defines the pixel grid.
 */

import { supabase } from "./client"

/**
 * Sprite data structure
 */
export interface Sprite {
  id: string
  project_id: string
  name: string
  width: number
  height: number
  created_at: string
  updated_at: string
}

/**
 * Data for creating a new sprite
 */
export interface CreateSpriteData {
  project_id: string
  name: string
  width: number
  height: number
}

/**
 * Data for updating a sprite
 */
export interface UpdateSpriteData {
  name?: string
  width?: number
  height?: number
}

/**
 * Creates a new sprite
 *
 * @param data - Sprite data
 * @returns Created sprite, or null on error
 *
 * @example
 * const sprite = await createSprite({
 *   project_id: projectId,
 *   name: "Walk Cycle",
 *   width: 64,
 *   height: 64
 * })
 */
export async function createSprite(data: CreateSpriteData): Promise<Sprite | null> {
  const { data: sprite, error } = await supabase
    .from("sprites")
    .insert(data)
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error creating sprite:", error)
    return null
  }

  return sprite
}

/**
 * Gets all sprites for a project
 *
 * @param projectId - Project ID
 * @returns Array of sprites
 */
export async function getSprites(projectId: string): Promise<Sprite[]> {
  const { data, error } = await supabase
    .from("sprites")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching sprites:", error)
    return []
  }

  return data || []
}

/**
 * Gets a single sprite by ID
 *
 * @param spriteId - Sprite ID
 * @returns Sprite, or null if not found
 */
export async function getSprite(spriteId: string): Promise<Sprite | null> {
  const { data, error } = await supabase
    .from("sprites")
    .select("*")
    .eq("id", spriteId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching sprite:", error)
    return null
  }

  return data
}

/**
 * Updates a sprite
 *
 * @param spriteId - Sprite ID
 * @param data - Data to update
 * @returns Updated sprite, or null on error
 */
export async function updateSprite(
  spriteId: string,
  data: UpdateSpriteData
): Promise<Sprite | null> {
  const { data: sprite, error } = await supabase
    .from("sprites")
    .update(data)
    .eq("id", spriteId)
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error updating sprite:", error)
    return null
  }

  return sprite
}

/**
 * Deletes a sprite
 *
 * WARNING: This also deletes all frames and layers (cascade delete).
 *
 * @param spriteId - Sprite ID
 * @returns true on success
 */
export async function deleteSprite(spriteId: string): Promise<boolean> {
  const { error } = await supabase.from("sprites").delete().eq("id", spriteId)

  if (error) {
    console.error("Error deleting sprite:", error)
    return false
  }

  return true
}

/**
 * Duplicates a sprite (including all frames and layers)
 *
 * @param spriteId - Sprite ID to duplicate
 * @param newName - Name for the duplicated sprite
 * @returns New sprite, or null on error
 */
export async function duplicateSprite(spriteId: string, newName: string): Promise<Sprite | null> {
  const original = await getSprite(spriteId)
  if (!original) {
    return null
  }

  const newSprite = await createSprite({
    project_id: original.project_id,
    name: newName,
    width: original.width,
    height: original.height
  })

  if (!newSprite) {
    return null
  }

  // TODO: Copy frames and layers
  // This will be implemented when we have frame operations

  return newSprite
}
