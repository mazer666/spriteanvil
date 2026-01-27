/**
 * Project Database Operations
 *
 * Functions for managing projects in Supabase database.
 * Projects are the top-level containers for sprites and animations.
 *
 * @module lib/supabase/projects
 */

import { supabase } from "./client"

/**
 * Project data structure
 */
export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  thumbnail_url: string | null
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
}

/**
 * Data for updating a project
 */
export interface UpdateProjectData {
  name?: string
  description?: string
  thumbnail_url?: string
  is_archived?: boolean
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
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: data.name,
      description: data.description || null,
      thumbnail_url: data.thumbnail_url || null
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error creating project:", error)
    return null
  }

  return project
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
  let query = supabase.from("projects").select("*").order("updated_at", { ascending: false })

  if (!includeArchived) {
    query = query.eq("is_archived", false)
  }

  const { data, error } = await query

  if (error) {
    console.error("Error fetching projects:", error)
    return []
  }

  return data || []
}

/**
 * Gets a single project by ID
 *
 * @param projectId - Project ID
 * @returns Project, or null if not found
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle()

  if (error) {
    console.error("Error fetching project:", error)
    return null
  }

  return data
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
  const { data: project, error } = await supabase
    .from("projects")
    .update(data)
    .eq("id", projectId)
    .select()
    .maybeSingle()

  if (error) {
    console.error("Error updating project:", error)
    return null
  }

  return project
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
  const { error } = await supabase
    .from("projects")
    .update({ is_archived: true })
    .eq("id", projectId)

  if (error) {
    console.error("Error archiving project:", error)
    return false
  }

  return true
}

/**
 * Restores an archived project
 *
 * @param projectId - Project ID
 * @returns true on success
 */
export async function restoreProject(projectId: string): Promise<boolean> {
  const { error } = await supabase
    .from("projects")
    .update({ is_archived: false })
    .eq("id", projectId)

  if (error) {
    console.error("Error restoring project:", error)
    return false
  }

  return true
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
  const { error } = await supabase.from("projects").delete().eq("id", projectId)

  if (error) {
    console.error("Error deleting project:", error)
    return false
  }

  return true
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
  const { error } = await supabase
    .from("projects")
    .update({ thumbnail_url: thumbnailUrl })
    .eq("id", projectId)

  if (error) {
    console.error("Error updating thumbnail:", error)
    return false
  }

  return true
}
