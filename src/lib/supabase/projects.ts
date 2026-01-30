/**
 * Project Database Operations
 *
 * Functions for managing projects in Supabase database.
 * Projects are the top-level containers for sprites and animations.
 *
 * @module lib/supabase/projects
 */

import { supabase } from "./client"
import { withRetry } from "./retry"

/**
 * Project data structure
 */
export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
  metadata?: ProjectSnapshotPayload | null
  created_at: string
  updated_at: string
  is_archived: boolean
}

/**
 * Data for creating a new project
 */
export interface CreateProjectData {
  name: string
  description?: string
  thumbnail_url?: string
  metadata?: ProjectSnapshotPayload
}

/**
 * Data for updating a project
 */
export interface UpdateProjectData {
  name?: string
  description?: string
  thumbnail_url?: string
  is_archived?: boolean
  metadata?: ProjectSnapshotPayload | null
}

export type ProjectSnapshotPayload = {
  /** Versioned, cloud-ready representation of the editor state. */
  version: number
  canvas: { width: number; height: number }
  current_frame_index: number
  active_layer_ids: Record<string, string>
  palettes: Array<{
    id: string
    name: string
    colors: string[]
    is_default: boolean
  }>
  active_palette_id: string
  recent_colors: string[]
  settings?: Record<string, unknown>
  frames: Array<{
    id: string
    duration_ms: number
    pivot?: { x: number; y: number }
    layers: Array<{
      id: string
      name: string
      opacity: number
      blend_mode: string
      is_visible: boolean
      is_locked: boolean
      pixel_data: string
    }>
  }>
}

/**
 * Persisted project snapshot.
 *
 * Sync logic:
 * - The editor calls saveProjectSnapshot on a 60s cadence.
 * - Each snapshot contains frames, layers, and editor metadata so a reload can
 *   reconstruct the full workspace without additional fetches.
 */
export async function saveProjectSnapshot(
  projectId: string,
  snapshot: ProjectSnapshotPayload
): Promise<boolean> {
  try {
    await withRetry(async () => {
      const { error } = await supabase
        .from("projects")
        .update({ metadata: snapshot, updated_at: new Date().toISOString() })
        .eq("id", projectId)
      if (error) throw error
    })
    return true
  } catch (error) {
    console.error("Error saving project snapshot:", error)
    return false
  }
}

export async function loadProjectSnapshot(projectId: string): Promise<ProjectSnapshotPayload | null> {
  try {
    const project = await withRetry(() => getProject(projectId))
    return project?.metadata ?? null
  } catch (error) {
    console.error("Error loading project snapshot:", error)
    return null
  }
}

/**
 * Creates a new project
 *
 * @param data - Project data
 * @returns Created project, or null on error
 *
 * @example
 * const project = await createProject({
 *   name: "Character Sprites",
 *   description: "Main character animations"
 * })
 */
export async function createProject(data: CreateProjectData): Promise<Project | null> {
  try {
    const { data: project, error } = await withRetry(async () => {
      const response = await supabase
        .from("projects")
        .insert({
          name: data.name,
          description: data.description || null,
          thumbnail_url: data.thumbnail_url || null,
          metadata: data.metadata || null
        })
        .select()
        .maybeSingle()
      return response
    })

    if (error) {
      console.error("Error creating project:", error)
      return null
    }

    return project
  } catch (error) {
    console.error("Error creating project:", error)
    return null
  }
}

/**
 * Gets all projects for the current user
 *
 * @param includeArchived - Whether to include archived projects
 * @returns Array of projects
 *
 * @example
 * const projects = await getProjects()
 * console.log(`You have ${projects.length} projects`)
 */
export async function getProjects(includeArchived = false): Promise<Project[]> {
  try {
    const result = await withRetry(async () => {
      let query = supabase.from("projects").select("*").order("updated_at", { ascending: false })

      if (!includeArchived) {
        query = query.eq("is_archived", false)
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    })

    return result
  } catch (error) {
    console.error("Error fetching projects:", error)
    return []
  }
}

/**
 * Gets a single project by ID
 *
 * @param projectId - Project ID
 * @returns Project, or null if not found
 */
export async function getProject(projectId: string): Promise<Project | null> {
  try {
    const { data, error } = await withRetry(async () => {
      const response = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle()
      return response
    })

    if (error) {
      console.error("Error fetching project:", error)
      return null
    }

    return data
  } catch (error) {
    console.error("Error fetching project:", error)
    return null
  }
}

/**
 * Updates a project
 *
 * @param projectId - Project ID
 * @param data - Data to update
 * @returns Updated project, or null on error
 *
 * @example
 * await updateProject(projectId, {
 *   name: "Updated Name",
 *   description: "New description"
 * })
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectData
): Promise<Project | null> {
  try {
    const { data: project, error } = await withRetry(async () => {
      const response = await supabase.from("projects").update(data).eq("id", projectId).select().maybeSingle()
      return response
    })

    if (error) {
      console.error("Error updating project:", error)
      return null
    }

    return project
  } catch (error) {
    console.error("Error updating project:", error)
    return null
  }
}

/**
 * Archives a project (soft delete)
 *
 * Archived projects are hidden from the main list but not deleted.
 * They can be restored later.
 *
 * @param projectId - Project ID
 * @returns true on success
 */
export async function archiveProject(projectId: string): Promise<boolean> {
  try {
    await withRetry(async () => {
      const { error } = await supabase
        .from("projects")
        .update({ is_archived: true })
        .eq("id", projectId)
      if (error) throw error
    })
    return true
  } catch (error) {
    console.error("Error archiving project:", error)
    return false
  }
}

/**
 * Restores an archived project
 *
 * @param projectId - Project ID
 * @returns true on success
 */
export async function restoreProject(projectId: string): Promise<boolean> {
  try {
    await withRetry(async () => {
      const { error } = await supabase
        .from("projects")
        .update({ is_archived: false })
        .eq("id", projectId)
      if (error) throw error
    })
    return true
  } catch (error) {
    console.error("Error restoring project:", error)
    return false
  }
}

/**
 * Permanently deletes a project
 *
 * WARNING: This cannot be undone! All sprites, frames, and layers
 * in this project will also be deleted (cascade delete).
 *
 * @param projectId - Project ID
 * @returns true on success
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    await withRetry(async () => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId)
      if (error) throw error
    })
    return true
  } catch (error) {
    console.error("Error deleting project:", error)
    return false
  }
}

/**
 * Duplicates a project (including all sprites, frames, and layers)
 *
 * @param projectId - Project ID to duplicate
 * @param newName - Name for the duplicated project
 * @returns New project, or null on error
 */
export async function duplicateProject(
  projectId: string,
  newName: string
): Promise<Project | null> {
  // Get original project
  const original = await getProject(projectId)
  if (!original) {
    return null
  }

  // Create new project
  const newProject = await createProject({
    name: newName,
    description: original.description || undefined
  })

  if (!newProject) {
    return null
  }

  // TODO: Copy sprites, frames, and layers
  // This will be implemented when we have sprite operations

  return newProject
}

/**
 * Updates project thumbnail
 *
 * @param projectId - Project ID
 * @param thumbnailUrl - URL of thumbnail image
 * @returns true on success
 */
export async function updateProjectThumbnail(
  projectId: string,
  thumbnailUrl: string
): Promise<boolean> {
  try {
    await withRetry(async () => {
      const { error } = await supabase
        .from("projects")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("id", projectId)
      if (error) throw error
    })
    return true
  } catch (error) {
    console.error("Error updating thumbnail:", error)
    return false
  }
}
