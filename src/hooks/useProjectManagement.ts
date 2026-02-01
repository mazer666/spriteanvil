import { useState, useCallback, useEffect, useRef } from "react";
import { Project, ProjectSnapshotPayload } from "../lib/supabase/projects";
import { ProjectSnapshot } from "../lib/projects/snapshot";
import {
  createProject,
  getProjects,
  loadProjectSnapshot,
  saveProjectSnapshot,
  deleteProject,
  updateProject,
} from "../lib/supabase/projects";
import {
  serializeSnapshot,
  deserializeSnapshot,
  loadLocalProjects,
  saveLocalProjects,
} from "./useProjectPersistence";
import { cacheProjectSnapshot, getCachedProjectSnapshot } from "../lib/storage/frameCache";
import { hasSupabaseConfig, supabase } from "../lib/supabase/client";
import { NewProjectRequest } from "../ui/ProjectDashboard";
import { createLayer } from "../editor/layers";
import { createBuffer } from "../editor/pixels";
import { PaletteData } from "../lib/projects/snapshot";

// ConfirmDialogConfig type (reused from where appropriate, or defined here)
export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => Promise<void> | void;
}

export interface ProjectManagementConfig {
  // Callbacks to interact with the Editor State
  onApplySnapshot: (snapshot: ProjectSnapshot) => void;
  onBuildSnapshot: () => ProjectSnapshot;
  
  // Dependencies for default initialization
  palettes: PaletteData[];
  activePaletteId: string;
  recentColors: string[];
  settings: any; // UiSettings
}

export function useProjectManagement({
  onApplySnapshot,
  onBuildSnapshot,
  palettes,
  activePaletteId,
  recentColors,
  settings,
}: ProjectManagementConfig) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectView, setProjectView] = useState<"dashboard" | "editor">("dashboard");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  
  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogConfig | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Auto-save state ref to access latest props in interval
  const autoSaveStateRef = useRef({
    onBuildSnapshot,
    activeProject,
    saveProjectSnapshot,
    cacheProjectSnapshot,
    serializeSnapshot,
  });

  autoSaveStateRef.current = {
    onBuildSnapshot,
    activeProject,
    saveProjectSnapshot,
    cacheProjectSnapshot,
    serializeSnapshot,
  };

  // --- Initial Load ---
  const refreshProjects = useCallback(async () => {
    setProjectLoading(true);
    try {
      if (hasSupabaseConfig) {
        const list = await getProjects();
        setProjects(list);
      } else {
        setProjects(loadLocalProjects());
      }
    } catch (err) {
      console.error(err);
      setProjectError("Failed to load projects.");
    } finally {
      setProjectLoading(false);
    }
  }, []);

  // --- Actions ---

  const selectProject = useCallback(async (project: Project) => {
    setProjectLoading(true);
    setProjectError(null);
    try {
      const cached = await getCachedProjectSnapshot(project.id);
      if (cached) {
        onApplySnapshot(cached);
      } else if (hasSupabaseConfig) {
        const cloudSnapshot = await loadProjectSnapshot(project.id);
        if (cloudSnapshot) {
          const snapshot = deserializeSnapshot(cloudSnapshot);
          onApplySnapshot(snapshot);
          await cacheProjectSnapshot(project.id, snapshot);
        } else {
          // Fallback Default
          const fallbackSnapshot: ProjectSnapshot = {
            version: 1,
            canvas: { width: 64, height: 64 },
            frames: [
              {
                id: crypto.randomUUID(),
                durationMs: 100,
                pivot: { x: 32, y: 63 },
                layers: [
                  createLayer(
                    64, 
                    64, 
                    "Layer 1"
                  ),
                ],
              },
            ],
            currentFrameIndex: 0,
            activeLayerIds: {},
            palettes,
            activePaletteId,
            recentColors,
            settings,
          };
          const frameId = fallbackSnapshot.frames[0].id;
          fallbackSnapshot.activeLayerIds[frameId] =
            fallbackSnapshot.frames[0].layers[0].id;
          onApplySnapshot(fallbackSnapshot);
        }
      } else {
        // Local Fallback Default
        const fallbackSnapshot: ProjectSnapshot = {
          version: 1,
          canvas: { width: 64, height: 64 },
          frames: [
            {
              id: crypto.randomUUID(),
              durationMs: 100,
              pivot: { x: 32, y: 63 },
              layers: [
              createLayer(
                  64, 
                  64, 
                  "Layer 1"
                ),
              ],
            },
          ],
          currentFrameIndex: 0,
          activeLayerIds: {},
          palettes,
          activePaletteId,
          recentColors,
          settings,
        };
        const frameId = fallbackSnapshot.frames[0].id;
        fallbackSnapshot.activeLayerIds[frameId] =
          fallbackSnapshot.frames[0].layers[0].id;
        onApplySnapshot(fallbackSnapshot);
      }
      setActiveProject(project);
      setProjectView("editor");
      localStorage.setItem("spriteanvil:lastProjectId", project.id);
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to load project.",
      );
    } finally {
      setProjectLoading(false);
    }
  }, [hasSupabaseConfig, onApplySnapshot, palettes, activePaletteId, recentColors, settings]);

  const createNewProject = useCallback(async (request: NewProjectRequest) => {
    setProjectLoading(true);
    setProjectError(null);
    try {
      const newSnapshot: ProjectSnapshot = {
        version: 1,
        canvas: { width: request.width, height: request.height },
        frames: [
          {
            id: crypto.randomUUID(),
            durationMs: 100,
            pivot: { x: Math.floor(request.width / 2), y: request.height - 1 },
            layers: [
              createLayer(
                request.width,
                request.height,
                "Layer 1"
              ),
            ],
          },
        ],
        currentFrameIndex: 0,
        activeLayerIds: {},
        palettes,
        activePaletteId,
        recentColors,
        settings,
      };
      
      const frame0 = newSnapshot.frames[0];
      const activeLayerId = frame0.layers[0].id;
      newSnapshot.activeLayerIds[frame0.id] = activeLayerId;

      if (!hasSupabaseConfig) {
        const now = new Date().toISOString();
        const localProject: Project = {
          id: crypto.randomUUID(),
          user_id: "local",
          name: request.name,
          description: null,
          thumbnail_url: null,
          metadata: null,
          created_at: now,
          updated_at: now,
          is_archived: false,
        };
        const nextProjects = [localProject, ...loadLocalProjects()];
        saveLocalProjects(nextProjects);
        setProjects(nextProjects);
        onApplySnapshot(newSnapshot);
        await cacheProjectSnapshot(localProject.id, newSnapshot);
        setActiveProject(localProject);
        setProjectView("editor");
        localStorage.setItem("spriteanvil:lastProjectId", localProject.id);
        return;
      }

      const cloudPayload = serializeSnapshot(newSnapshot);
      const created = await createProject({
        name: request.name,
        metadata: cloudPayload,
      });

      if (!created) throw new Error("Failed to create project.");

      setProjects((prev) => [created, ...prev]);
      onApplySnapshot(newSnapshot);
      await cacheProjectSnapshot(created.id, newSnapshot);
      setActiveProject(created);
      setProjectView("editor");
      localStorage.setItem("spriteanvil:lastProjectId", created.id);
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to create project.",
      );
    } finally {
      setProjectLoading(false);
    }
  }, [hasSupabaseConfig, onApplySnapshot, palettes, activePaletteId, recentColors, settings]);

  const deleteProjectAction = useCallback((project: Project) => {
    setConfirmDialog({
      title: "Delete Project",
      message: `Are you sure you want to permanently delete "${project.name}"? This cannot be undone.`,
      confirmLabel: "Delete Project",
      isDangerous: true,
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          if (hasSupabaseConfig) {
            const ok = await deleteProject(project.id);
            if (!ok) throw new Error("Failed to delete project.");
          } else {
            const nextProjects = loadLocalProjects().filter(
              (p) => p.id !== project.id,
            );
            saveLocalProjects(nextProjects);
          }
          setProjects((prev) => prev.filter((p) => p.id !== project.id));
          if (activeProject?.id === project.id) {
            setActiveProject(null);
            setProjectView("dashboard");
          }
        } catch (error) {
          setProjectError(
            error instanceof Error
              ? error.message
              : "Failed to delete project.",
          );
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  }, [activeProject?.id, hasSupabaseConfig]);

  const renameProjectAction = useCallback(async (project: Project) => {
    const nextName = window.prompt("Rename project", project.name);
    if (!nextName || !nextName.trim() || nextName.trim() === project.name)
      return;
    try {
      if (hasSupabaseConfig) {
        const updated = await updateProject(project.id, {
          name: nextName.trim(),
        });
        if (!updated) throw new Error("Failed to rename project.");
      } else {
        const nextProjects = loadLocalProjects().map((p) =>
          p.id === project.id
            ? {
                ...p,
                name: nextName.trim(),
                updated_at: new Date().toISOString(),
              }
            : p,
        );
        saveLocalProjects(nextProjects);
      }
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, name: nextName.trim() } : p,
        ),
      );
      if (activeProject?.id === project.id) {
        setActiveProject((prev) =>
          prev ? { ...prev, name: nextName.trim() } : prev,
        );
      }
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to rename project.",
      );
    }
  }, [activeProject?.id, hasSupabaseConfig]);

  const duplicateProjectAction = useCallback(async (project: Project) => {
    const nextName = window.prompt(
      "Duplicate project as",
      `${project.name} Copy`,
    );
    if (!nextName || !nextName.trim()) return;
    setProjectLoading(true);
    setProjectError(null);
    try {
      let snapshot: ProjectSnapshot | null = null;
      const cached = await getCachedProjectSnapshot(project.id);
      if (cached) {
        snapshot = cached;
      } else if (hasSupabaseConfig) {
        const cloudSnapshot = await loadProjectSnapshot(project.id);
        snapshot = cloudSnapshot ? deserializeSnapshot(cloudSnapshot) : null;
      }

      if (!hasSupabaseConfig) {
        const now = new Date().toISOString();
        const localProject: Project = {
          id: crypto.randomUUID(),
          user_id: "local",
          name: nextName.trim(),
          description: project.description,
          thumbnail_url: project.thumbnail_url,
          metadata: null,
          created_at: now,
          updated_at: now,
          is_archived: false,
        };
        const nextProjects = [localProject, ...loadLocalProjects()];
        saveLocalProjects(nextProjects);
        setProjects(nextProjects);
        if (snapshot) {
          await cacheProjectSnapshot(localProject.id, snapshot);
        }
        return;
      }

      const created = await createProject({
        name: nextName.trim(),
        description: project.description || undefined,
        thumbnail_url: project.thumbnail_url || undefined,
        metadata: snapshot ? serializeSnapshot(snapshot) : undefined,
      });
      if (!created) throw new Error("Failed to duplicate project.");
      setProjects((prev) => [created, ...prev]);
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to duplicate project.",
      );
    } finally {
      setProjectLoading(false);
    }
  }, [hasSupabaseConfig]);

  const autoSave = useCallback(async () => {
    const currentProject = autoSaveStateRef.current.activeProject;
    if (!currentProject) return;
    const snapshot = autoSaveStateRef.current.onBuildSnapshot();
    await autoSaveStateRef.current.cacheProjectSnapshot(
      currentProject.id,
      snapshot,
    );
    if (hasSupabaseConfig) {
      const payload = autoSaveStateRef.current.serializeSnapshot(snapshot);
      await autoSaveStateRef.current.saveProjectSnapshot(
        currentProject.id,
        payload,
      );
    }
  }, [hasSupabaseConfig]);

  // Handle AutoSave Interval
  useEffect(() => {
    if (!activeProject) return;
    const id = window.setInterval(() => {
      autoSave();
    }, 60000);
    return () => window.clearInterval(id);
  }, [activeProject, autoSave]);

  const reloadProject = useCallback(async () => {
    if (!activeProject) return;
    setProjectLoading(true);
    setProjectError(null);
    try {
      if (hasSupabaseConfig) {
        const cloudSnapshot = await loadProjectSnapshot(activeProject.id);
        if (cloudSnapshot) {
          const snapshot = deserializeSnapshot(cloudSnapshot);
          onApplySnapshot(snapshot);
          await cacheProjectSnapshot(activeProject.id, snapshot);
        }
      } else {
        const cached = await getCachedProjectSnapshot(activeProject.id);
        if (cached) {
          onApplySnapshot(cached);
        }
      }
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to reload project.",
      );
    } finally {
      setProjectLoading(false);
    }
  }, [activeProject, hasSupabaseConfig, onApplySnapshot]);

  return {
    // State
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    projectView,
    setProjectView,
    projectLoading,
    projectError,
    setProjectError,
    confirmDialog,
    setConfirmDialog,
    confirmBusy,
    setConfirmBusy,
    
    // Actions
    refreshProjects,
    selectProject,
    createProject: createNewProject,
    deleteProject: deleteProjectAction,
    renameProject: renameProjectAction,
    duplicateProject: duplicateProjectAction,
    reloadProject,
    autoSave,
  };
}
