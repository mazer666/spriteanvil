import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
/**
 * src/App.tsx
 * -----------------------------------------------------------------------------
 * ## THE ORCHESTRATOR (Noob Guide)
 *
 * Think of `App.tsx` as the **Brain** or **Conductor** of SpriteAnvil.
 * It holds the "Source of Truth" for your artwork and tells all other parts
 * (the Canvas, the Timeline, the Tools) what to show and do.
 *
 * ### 🟢 Data Flow Legend:
 * 1. **User Action**: You click the canvas or pick a tool.
 * 2. **State Update**: `App.tsx` updates a variable (like `tool` or `pixels`).
 * 3. **Re-render**: React sees the change and updates the screen.
 * 4. **Persistence**: The "Conductor" saves the changes to your browser or the Cloud (Supabase).
 *
 * ### 🗺️ Application Map (Mermaid)
 * This diagram shows how data flows through the different components of the app.
 *
 * ```mermaid
 * graph TD
 *   subgraph UI_Layer [User Interface]
 *     TP[Topbar] -- "Save/Export" --> App
 *     TR[ToolRail] -- "Select Tool" --> App
 *     CS[CanvasStage] -- "Draw Events" --> App
 *     TL[Timeline] -- "Select/Move Frame" --> App
 *     RP[RightPanel] -- "Change Layers/Colors" --> App
 *   end
 *
 *   subgraph Logic_Layer [The Conductor: App.tsx]
 *     App{App.tsx}
 *     H[HistoryStack] -- "Undo/Redo" --> App
 *     K[Keyboard] -- "Shortcuts" --> App
 *   end
 *
 *   subgraph Data_Layer [State & Storage]
 *     App -- "Update Pixels" --> PM[ProjectSnapshot]
 *     PM -- "Auto-save" --> LS[Local Storage]
 *     PM -- "Sync" --> SB[Supabase Cloud]
 *   end
 *
 *   App -- "Drive UI" --> UI_Layer
 * ```
 *
 * ### 🧠 State Management (Mermaid)
 * How we handle pixels and layers across different frames.
 *
 * ```mermaid
 * flowchart LR
 *   P[Project] --> F1[Frame 1]
 *   P --> F2[Frame 2]
 *   F1 --> L1[Layer 1]
 *   F1 --> L2[Layer 2]
 *   L1 -- "Uint8ClampedArray" --> B[Pixel Buffer]
 *   B -- "Algorithm" --> C[Composite Image]
 *   C -- "Render" --> Canvas
 * ```
 */
import DockLayout from "./ui/DockLayout";
import ExportPanel from "./ui/ExportPanel";
import SettingsPanel from "./ui/SettingsPanel";
import CommandPalette, { Command } from "./ui/CommandPalette";
import {
  CanvasSpec,
  ToolId,
  UiSettings,
  Frame,
  LayerData,
  BlendMode,
  FloatingSelection,
} from "./types";
import { HistoryStack } from "./editor/history";
import { cloneBuffer, createBuffer } from "./editor/pixels";
import { applySmartOutline, OutlineMode } from "./editor/outline";
import {
  generateTweenFrames,
  interpolatePixelBuffers,
  EasingCurve,
} from "./editor/animation";
import {
  copySelection,
  cutSelection,
  pasteClipboard,
  ClipboardData,
} from "./editor/clipboard";
import { compositeLayers, mergeDown, flattenImage, createLayer } from "./editor/layers";
import { PaletteData, ProjectSnapshot } from "./lib/projects/snapshot";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  encodePixels,
  decodePixels,
  serializeSnapshot,
  deserializeSnapshot,
  loadLocalProjects,
  saveLocalProjects,
} from "./hooks/useProjectPersistence";
import {
  useAnimationSystem,
  ConfirmDialogConfig,
} from "./hooks/useAnimationSystem";
import { useLayerManager } from "./hooks/useLayerManager";
import { usePaletteManager } from "./hooks/usePaletteManager";
import { useTransformOperations } from "./hooks/useTransformOperations";
import { useColorAdjustments } from "./hooks/useColorAdjustments";
import { useSelectionOperations } from "./hooks/useSelectionOperations";
import { useProjectManagement } from "./hooks/useProjectManagement";
import { AnimationTag } from "./lib/supabase/animation_tags";
import {
  flipHorizontal,
  flipVertical,
  rotate90CW,
  rotate90CCW,
  rotate180,
  scaleNearest,
  applyTransform,
  liftSelection,
  TransformMatrix,
} from "./editor/tools/transform";

import { invertSelection, selectConnectedOpaque } from "./editor/selection";

import {
  createProject,
  getProjects,
  loadProjectSnapshot,
  saveProjectSnapshot,
  deleteProject,
  updateProject,
  Project,
  ProjectSnapshotPayload,
} from "./lib/supabase/projects";
import { hasSupabaseConfig } from "./lib/supabase/client";
import { supabase } from "./lib/supabase/client";

import {
  cacheProjectSnapshot,
  getCachedProjectSnapshot,
} from "./lib/storage/frameCache";
import ProjectDashboard, { NewProjectRequest } from "./ui/ProjectDashboard";
import ShortcutOverlay, { ShortcutGroup } from "./ui/ShortcutOverlay";
import StatusBar from "./ui/StatusBar";

import { hexToRgb } from "./utils/colors";
import { isInputFocused } from "./utils/dom";
import { buildInpaintPayload } from "./lib/ai/inpaint";
import { deleteFrame as deleteFrameRecord } from "./lib/supabase/frames";
import { validateProjects } from "./utils/validation";
import {
  validatePixelUpdate,
  validateCursorPosition,
  isRateLimited,
  clearUserRateLimit,
  logSecurityEvent,
} from "./lib/realtime/validation";

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => Promise<void> | void;
};

export default function App() {
  // --- 🎨 CANVAS & TOOLS ---
  // ORIGIN: New Project Dialog or Default. 
  // USAGE: Defines the width/height of the drawing area.
  // PURPOSE: The "Paper Size" of your art.
  const [canvasSpec, setCanvasSpec] = useState<CanvasSpec>(() => ({
    width: 64,
    height: 64,
  }));

  // ORIGIN: ToolRail clicks.
  // USAGE: Determines what happens when you click on the canvas (Draw, Erase, Fill).
  // PURPOSE: Tracks which tool you are currently holding.
  const [tool, setTool] = useState<ToolId>("pen");

  // ORIGIN: Internal.
  // USAGE: Shows a helper screen with all the buttons you can press on your keyboard.
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);

  // ORIGIN: Mouse movement on the CanvasStage.
  // USAGE: Displayed in the bottom Status Bar.
  // PURPOSE: Shows exactly which pixel (X, Y) your mouse is over.
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // --- 🎞️ ANIMATION & FRAMES ---
  // Frames are like pages in a flipbook.
  const initialFrameId = useMemo(() => crypto.randomUUID(), []);

  // WHAT: Creates a clear, transparent sheet of pixels.
  // WHY: To start a new layer or frame from scratch.
  const createEmptyPixels = () =>
    createBuffer(canvasSpec.width, canvasSpec.height, {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    });

  // USAGE: The default "Spin Center" for rotating or mirroring your art.
  const defaultPivot = useMemo(
    () => ({ x: Math.floor(canvasSpec.width / 2), y: canvasSpec.height - 1 }),
    [canvasSpec.width, canvasSpec.height],
  );

  // ORIGIN: Project initialization or loading.
  // USAGE: An array of Frame objects. Each frame has timing and pivot info.
  // PURPOSE: The entire flipbook of your animation.
  const [frames, setFrames] = useState<Frame[]>(() => [
    {
      id: initialFrameId,
      pixels: createEmptyPixels(),
      durationMs: 100,
      pivot: defaultPivot,
    },
  ]);

  // ORIGIN: Timeline clicks.
  // USAGE: Tells the renderer which frame to show on the main stage.
  // PURPOSE: Tracks which page of the flipbook we are currently looking at.
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);

  // USAGE: For bulk actions like "Delete selected frames" or "Move selected frames".
  const [selectedFrameIndices, setSelectedFrameIndices] = useState<Set<number>>(
    new Set([0]),
  );

  // --- ✨ SELECTION & CLIPBOARD ---
  // USAGE: Mask that says "only draw here".
  // PURPOSE: Tracks the "Dancing Ants" marquee area.
  const [selection, setSelection] = useState<Uint8Array | null>(null);

  // USAGE: Stores copied pixels so you can paste them later.
  const clipboardRef = useRef<ClipboardData | null>(null);
  const paletteImportRef = useRef<HTMLInputElement | null>(null);

  // --- ▶️ PLAYBACK ---
  // USAGE: Toggles the animation loop on/off.
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);

  // --- 🖼️ UI VISIBILITY ---
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTopbarMenu, setShowTopbarMenu] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // --- 🏷️ TAGS & COLLABORATION ---
  // Tags are named sections of the timeline (e.g., "Run", "Jump").
  const [animationTags, setAnimationTags] = useState<AnimationTag[]>([]);
  const [activeAnimationTagId, setActiveAnimationTagId] = useState<
    string | null
  >(null);
  const [loopTagOnly, setLoopTagOnly] = useState(false);

  // USAGE: Tracks where other people's mice are in Multi-player mode.
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, { x: number; y: number; color: string }>
  >({});
  const [activeCollaborators, setActiveCollaborators] = useState<
    Array<{ id: string; color: string }>
  >([]);

  // --- ⏪ HISTORY (UNDO/REDO) ---
  // USAGE: A stack of "Snapshots" from previous actions.
  const historyRef = useRef<HistoryStack>(new HistoryStack());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /* State removed: transformBeforeRef */

  const currentFrame = frames[currentFrameIndex];
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const lastCursorBroadcastRef = useRef(0);
  const localUserId = useMemo(() => {
    const key = "spriteanvil:collabUserId";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(key, next);
    return next;
  }, []);
  const localUserColor = useMemo(() => {
    const key = "spriteanvil:collabUserColor";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const hue = Math.floor(Math.random() * 360);
    const next = `hsl(${hue}, 70%, 60%)`;
    localStorage.setItem(key, next);
    return next;
  }, []);

  // Note: loadLocalProjects, saveLocalProjects, encodePixels, decodePixels,
  // serializeSnapshot, and deserializeSnapshot are now imported from useProjectPersistence

  // --- 🛠️ PIXEL UTILITIES ---

  // WHAT: Finds the differences between two pixel buffers.
  // WHY: To send only the *changed* pixels over the network, making collaboration fast.
  // HOW: It loops through every pixel and records any that are different.
  function buildPixelPatch(
    before: Uint8ClampedArray,
    after: Uint8ClampedArray,
  ) {
    const changes: number[] = [];
    for (let i = 0; i < after.length; i += 4) {
      if (
        before[i] !== after[i] ||
        before[i + 1] !== after[i + 1] ||
        before[i + 2] !== after[i + 2] ||
        before[i + 3] !== after[i + 3]
      ) {
        changes.push(i, after[i], after[i + 1], after[i + 2], after[i + 3]);
      }
    }
    return changes;
  }

  // WHAT: Applies a "Patch" (set of changes) to a pixel buffer.
  // WHY: To update your drawing based on what a collaborator did.
  function applyPixelPatch(
    layerPixels: Uint8ClampedArray,
    patch: number[],
  ): Uint8ClampedArray {
    const next = cloneBuffer(layerPixels);
    for (let i = 0; i < patch.length; i += 5) {
      const idx = patch[i];
      next[idx] = patch[i + 1];
      next[idx + 1] = patch[i + 2];
      next[idx + 2] = patch[i + 3];
      next[idx + 3] = patch[i + 4];
    }
    return next;
  }




  // --- 📚 LAYER DATA ---
  // USAGE: A map where the Key is the Frame ID and the Value is an array of Layers.
  // PURPOSE: Stores all layers for every frame in the project.
  const [frameLayers, setFrameLayers] = useState<Record<string, LayerData[]>>(
    {},
  );

  // USAGE: A map where Key is Frame ID and Value is the ID of the currently selected layer.
  // PURPOSE: Remembers which layer you were working on for each frame.
  const [frameActiveLayerIds, setFrameActiveLayerIds] = useState<
    Record<string, string>
  >({});


  useEffect(() => {
    const baseLayer = createLayer(canvasSpec.width, canvasSpec.height, "Layer 1");
    setFrameLayers({ [initialFrameId]: [baseLayer] });
    setFrameActiveLayerIds({ [initialFrameId]: baseLayer.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layers = frameLayers[currentFrame.id] || [];
  const activeLayerId =
    frameActiveLayerIds[currentFrame.id] || layers[0]?.id || null;
  const activeLayer =
    layers.find((layer) => layer.id === activeLayerId) || layers[0] || null;
  const buffer = activeLayer?.pixels || createEmptyPixels();
  const compositeBuffer = useMemo(() => {
    if (!layers.length) return currentFrame.pixels;
    return compositeLayers(layers, canvasSpec.width, canvasSpec.height);
  }, [canvasSpec.height, canvasSpec.width, currentFrame.pixels, layers]);
  const isActiveLayerLocked = activeLayer?.is_locked ?? false;



  // useColorAdjustments hook handles Preview logic
  const colorAdjustments = useColorAdjustments({
    canvasSpec,
    activeLayerPixels: buffer,
    layers,
    activeLayerId,
    compositeBuffer,
    updateActiveLayerPixels,
    history: historyRef.current,
    syncHistoryFlags,
    isActiveLayerLocked,
  });

  const [palettes, setPalettes] = useState<PaletteData[]>([
    {
      id: "default",
      name: "Default Palette",
      colors: [
        "#000000",
        "#1a1c2c",
        "#5d275d",
        "#b13e53",
        "#ef7d57",
        "#ffcd75",
        "#a7f070",
        "#38b764",
        "#257179",
        "#29366f",
        "#3b5dc9",
        "#41a6f6",
        "#73eff7",
        "#f4f4f4",
        "#94b0c2",
        "#566c86",
      ],
      is_default: true,
    },
  ]);
  const [activePaletteId, setActivePaletteId] = useState<string>("default");
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const defaultRightPanelOrder = [
    "tools",
    "layers",
    "colors",
    "adjustments",
    "transform",
    "selection",
    "ai",
  ];
  const [settings, setSettings] = useState<UiSettings>(() => ({
    zoom: 8,
    brushStabilizerEnabled: true,
    backgroundMode: "checker", // Default to checker
    checkerSize: 32, // Larger squares reduce noise
    checkerA: "#2a2a2a", // Solid dark grey
    checkerB: "#333333", // Slightly lighter grey (subtle contrast)
    customBackgroundColor: "#2a2a2a",
    showGrid: true,
    gridSize: 32, // Standard tile size, not pixel grid
    showOnionSkin: true,
    onionPrev: 1,
    onionNext: 1,
    primaryColor: "#f2ead7",
    secondaryColor: "#000000",
    fillTolerance: 0,
    fillPattern: "solid",
    gradientType: "linear",
    ditheringType: "none",
    symmetryMode: "none",
    symmetryAngle: 0,
    symmetrySegments: 8,
    edgeSnapEnabled: false,
    edgeSnapRadius: 3,
    showArcGuides: false,
    showGravityGuides: false,
    showMotionTrails: true,
    brushSize: 1,
    brushTexture: "none",
    smudgeStrength: 60,
    wandTolerance: 32,
    pressureMode: "size",
    pressureEasing: 0.25,
    layout: {
      leftPanelVisible: true,
      rightPanelVisible: true,
      timelineVisible: true,
      leftCollapsed: false,
      rightCollapsed: false,
      rightWidth: 280,
      timelineHeight: 160,
      toolRailPosition: { x: 18, y: 84 },
      rightPanelPosition: { x: 24, y: 84 },
      rightPanelOrder: defaultRightPanelOrder,
    },
    brushOpacity: 1,
    selectionMode: "replace",
  }));

  const projectManager = useProjectManagement({
    onApplySnapshot: applySnapshot,
    onBuildSnapshot: buildSnapshot,
    palettes,
    activePaletteId,
    recentColors,
    settings,
  });

  const {
      projects,
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
      refreshProjects,
      selectProject: handleSelectProject,
      createProject: handleCreateProject,
      deleteProject: handleDeleteProject,
      renameProject: handleRenameProject,
      duplicateProject: handleDuplicateProject,
      reloadProject: handleReloadProject,
      autoSave: handleAutoSave,
  } = projectManager;

  const zoomLabel = useMemo(
    () => `${Math.round(settings.zoom * 100)}%`,
    [settings.zoom],
  );
  const colorRgbLabel = useMemo(() => {
    const rgb = hexToRgb(settings.primaryColor);
    if (!rgb) return "rgb(0, 0, 0)";
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }, [settings.primaryColor]);
  const memoryUsageLabel = useMemo(() => {
    const totalBytes = Object.values(frameLayers).reduce((sum, layers) => {
      return (
        sum +
        layers.reduce(
          (layerSum, layer) => layerSum + (layer.pixels?.length ?? 0),
          0,
        )
      );
    }, 0);
    const kb = totalBytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }, [frameLayers]);
  const cursorLabel = cursorPosition
    ? `${cursorPosition.x}, ${cursorPosition.y}`
    : "--";
  const statusInfo = useMemo(
    () => ({
      colorHex: settings.primaryColor.toUpperCase(),
      colorRgb: colorRgbLabel,
      zoomLabel,
      memoryUsage: memoryUsageLabel,
      cursor: cursorLabel,
    }),
    [
      settings.primaryColor,
      colorRgbLabel,
      zoomLabel,
      memoryUsageLabel,
      cursorLabel,
    ],
  );

  function QuickControls({
    showCollaborators = false,
  }: {
    showCollaborators?: boolean;
  }) {
    return (
      <div className="topbar__group">
        {showCollaborators && activeCollaborators.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "#aaa" }}>Active:</span>
            <div style={{ display: "flex", gap: "4px" }}>
              {activeCollaborators.slice(0, 5).map((user) => (
                <span
                  key={user.id}
                  title={`User ${user.id}`}
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "999px",
                    background: user.color,
                    color: "#111",
                    fontSize: "9px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {user.id.slice(0, 2)}
                </span>
              ))}
            </div>
            {activeCollaborators.length > 5 && (
              <span style={{ fontSize: "11px", color: "#aaa" }}>
                +{activeCollaborators.length - 5}
              </span>
            )}
          </div>
        )}
        <label className="ui-row">
          <span>Color</span>
          <input
            className="color"
            type="color"
            value={settings.primaryColor}
            onChange={(e) => handleSelectColor(e.target.value)}
            title="Primary Color"
          />
        </label>
        <label className="ui-row">
          <input
            type="checkbox"
            checked={settings.showGrid}
            onChange={(e) =>
              setSettings((s) => ({ ...s, showGrid: e.target.checked }))
            }
          />
          <span>Grid</span>
        </label>
      </div>
    );
  }

  const shortcutGroups: ShortcutGroup[] = useMemo(
    () => [
      {
        title: "File",
        items: [
          { label: "Command Palette", shortcut: "Cmd+K" },
          { label: "Save Snapshot", shortcut: "Cmd+S" },
          { label: "Export", shortcut: "Cmd+E" },
          { label: "Shortcut Cheat Sheet", shortcut: "Cmd+/" },
        ],
      },
      {
        title: "Edit",
        items: [
          { label: "Undo", shortcut: "Cmd+Z" },
          { label: "Redo", shortcut: "Cmd+Shift+Z / Cmd+Y" },
          { label: "Copy", shortcut: "Cmd+C" },
          { label: "Cut", shortcut: "Cmd+X" },
          { label: "Paste", shortcut: "Cmd+V" },
          { label: "Select All", shortcut: "Cmd+A" },
        ],
      },
      {
        title: "View",
        items: [
          { label: "Zoom In", shortcut: "Cmd+=" },
          { label: "Zoom Out", shortcut: "Cmd+-" },
          { label: "Reset Zoom", shortcut: "Cmd+0" },
          { label: "Toggle Grid", shortcut: "Cmd+'" },
          { label: "Zen Mode", shortcut: "Tab" },
        ],
      },
      {
        title: "Animation",
        items: [
          { label: "Play/Pause", shortcut: "Space" },
          { label: "Delete Frame", shortcut: "Delete" },
          { label: "Next/Prev Frame", shortcut: "Alt+← / Alt+→" },
        ],
      },
      {
        title: "Tools",
        items: [
          { label: "Pen", shortcut: "B" },
          { label: "Eraser", shortcut: "E" },
          { label: "Fill", shortcut: "F" },
          { label: "Eyedropper", shortcut: "I" },
        ],
      },
      {
        title: "Transform",
        items: [
          { label: "Flip Horizontal", shortcut: "Cmd+H" },
          { label: "Flip Vertical", shortcut: "Cmd+Shift+H" },
          { label: "Rotate 90° CW", shortcut: "Cmd+Alt+R" },
          { label: "Rotate 90° CCW", shortcut: "Cmd+Alt+Shift+R" },
        ],
      },
    ],
    [],
  );



  useEffect(() => {
    if (!hasSupabaseConfig || !activeProject) {
      realtimeChannelRef.current?.unsubscribe();
      realtimeChannelRef.current = null;
      setRemoteCursors({});
      setActiveCollaborators([]);
      return;
    }

    const channel = supabase.channel(`project:${activeProject.id}`, {
      config: {
        presence: { key: localUserId },
      },
    });

    // SECURITY: Validate cursor position messages (Issue #5 fix)
    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const validated = validateCursorPosition(
        payload,
        localUserId,
        canvasSpec.width,
        canvasSpec.height,
      );

      if (!validated) {
        return; // Invalid cursor message, silently ignore
      }

      setRemoteCursors((prev) => ({
        ...prev,
        [validated.userId]: {
          x: validated.x,
          y: validated.y,
          color: validated.color || "#4bb8bf",
        },
      }));
    });

    // SECURITY: Validate and rate-limit pixel update messages (Issue #5 fix)
    channel.on("broadcast", { event: "pixel-update" }, ({ payload }) => {
      // Step 1: Check rate limit first (fastest check)
      if (payload && typeof payload === "object" && "userId" in payload) {
        const userId = (payload as any).userId;
        if (typeof userId === "string" && isRateLimited(userId)) {
          logSecurityEvent(
            "rate_limit",
            userId,
            "Pixel update rate limit exceeded",
          );
          return; // Rate limited, drop message
        }
      }

      // Step 2: Validate message structure and content
      const validated = validatePixelUpdate(
        payload,
        localUserId,
        canvasSpec.width,
        canvasSpec.height,
      );

      if (!validated) {
        // Message failed validation
        if (payload && typeof payload === "object" && "userId" in payload) {
          logSecurityEvent(
            "invalid_message",
            (payload as any).userId,
            "Invalid pixel update message",
          );
        }
        return;
      }

      // Step 3: Apply validated update
      const { frameId, layerId, patch } = validated;
      setFrameLayers((prev) => {
        const layersForFrame = prev[frameId];
        if (!layersForFrame) return prev;
        const nextLayers = layersForFrame.map((layer) => {
          if (layer.id !== layerId || !layer.pixels) return layer;
          const nextPixels = applyPixelPatch(layer.pixels, patch);
          return { ...layer, pixels: nextPixels };
        });
        updateCurrentFrameComposite(frameId, nextLayers);
        return { ...prev, [frameId]: nextLayers };
      });
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ color?: string }>
      >;
      const collaborators = Object.keys(state).map((id) => ({
        id,
        color: state[id]?.[0]?.color ?? "#4bb8bf",
      }));
      setActiveCollaborators(collaborators);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ color: localUserColor });
      }
    });

    realtimeChannelRef.current?.unsubscribe();
    realtimeChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
      realtimeChannelRef.current = null;
    };
  }, [activeProject, localUserColor, localUserId]);

  useEffect(() => {
    if (projects.length === 0) return;
    const lastProjectId = localStorage.getItem("spriteanvil:lastProjectId");
    if (!lastProjectId || activeProject) return;
    const match = projects.find((project) => project.id === lastProjectId);
    if (match) {
      handleSelectProject(match);
    }
  }, [projects, activeProject]);

  function syncHistoryFlags() {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }

  const activeTag = useMemo(
    () => animationTags.find((tag) => tag.id === activeAnimationTagId) || null,
    [activeAnimationTagId, animationTags],
  );

  // Animation system hook - handles frame operations and playback
  const animationSystem = useAnimationSystem(
    // State
    {
      frames,
      currentFrameIndex,
      selectedFrameIndices,
      isPlaying,
      frameLayers,
      frameActiveLayerIds,
    },
    // Actions
    {
      setFrames,
      setCurrentFrameIndex,
      setSelectedFrameIndices,
      setIsPlaying,
      setFrameLayers,
      setFrameActiveLayerIds,
    },
    // Config
    {
      canvasSpec,
      defaultPivot,
      activeTag,
      loopTagOnly,
      setConfirmDialog: setConfirmDialog as (
        dialog: ConfirmDialogConfig | null,
      ) => void,
      setConfirmBusy,
      setProjectError,
    },
  );

  // Note: The playback useEffect is now handled inside useAnimationSystem

  // Layer manager hook - handles layer CRUD and properties
  const layerManager = useLayerManager(
    // State
    { currentFrame, layers, activeLayerId },
    // Actions
    { setFrameLayers, setFrameActiveLayerIds, setFrames },
    // Config
    { canvasSpec },
  );

  // Palette manager hook - handles palette operations
  const paletteManager = usePaletteManager(
    // State
    {
      palettes,
      activePaletteId,
      compositeBuffer,
      frameLayers,
      isActiveLayerLocked,
    },
    // Actions
    { setPalettes, setActivePaletteId, setFrameLayers },
    // Config
    {
      canvasSpec,
      settings,
      historyRef,
      rebuildFramesFromLayers,
      syncHistoryFlags,
    },
  );

  useEffect(() => {
    setFrameLayers((prev) => {
      if (prev[currentFrame.id]) return prev;
      const baseLayer = createLayer(canvasSpec.width, canvasSpec.height, "Layer 1");
      setFrameActiveLayerIds((activePrev) => ({
        ...activePrev,
        [currentFrame.id]: baseLayer.id,
      }));
      setFrames((framePrev) =>
        framePrev.map((frame) =>
          frame.id === currentFrame.id
            ? {
                ...frame,
                pixels: compositeLayers(
                  [baseLayer],
                  canvasSpec.width,
                  canvasSpec.height,
                ),
              }
            : frame,
        ),
      );
      return { ...prev, [currentFrame.id]: [baseLayer] };
    });
  }, [canvasSpec.height, canvasSpec.width, currentFrame.id]);

  useEffect(() => {
    if (!loopTagOnly || !activeTag) return;
    if (
      currentFrameIndex < activeTag.start_frame ||
      currentFrameIndex > activeTag.end_frame
    ) {
      setCurrentFrameIndex(activeTag.start_frame);
    }
  }, [activeTag, currentFrameIndex, loopTagOnly]);

  /**
   * WHAT: Goes back in time by one step.
   * WHY: Because everyone makes mistakes!
   * HOW: It pops the "Last State" off the `HistoryStack` and swaps it with the "Current State".
   * USE: CMD+Z or the "Undo" button in the Topbar.
   */
  function handleUndo() {
    const next = historyRef.current.undo(buffer, frameLayers);
    if (!next) return;
    if (next.kind === "buffer") {
      if (activeLayerId) {
        updateActiveLayerPixels(next.snapshot);
      }
    } else {
      setFrameLayers(next.snapshot);
      rebuildFramesFromLayers(next.snapshot);
    }
    syncHistoryFlags();
  }

  /**
   * WHAT: Goes forward in time by one step (if you undo-ed).
   * WHY: If you changed your mind about an undo!
   */
  function handleRedo() {
    const next = historyRef.current.redo(buffer, frameLayers);
    if (!next) return;
    if (next.kind === "buffer") {
      if (activeLayerId) {
        updateActiveLayerPixels(next.snapshot);
      }
    } else {
      setFrameLayers(next.snapshot);
      rebuildFramesFromLayers(next.snapshot);
    }
    syncHistoryFlags();
  }

  function handleCopy() {
    if (transformOperations.floatingBuffer) {
      transformOperations.onCommitTransform();
    }
    if (!selection) return;
    const clip = copySelection(
      buffer,
      selection,
      canvasSpec.width,
      canvasSpec.height,
    );
    if (clip) clipboardRef.current = clip;
  }

  function handleCut() {
    if (transformOperations.floatingBuffer) {
      transformOperations.onCommitTransform();
    }
    if (!selection) return;
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const { clipboardData, modifiedBuffer } = cutSelection(
      buffer,
      selection,
      canvasSpec.width,
      canvasSpec.height,
    );

    if (clipboardData) clipboardRef.current = clipboardData;

    historyRef.current.commit(before);
    updateActiveLayerPixels(modifiedBuffer);
    syncHistoryFlags();
  }

  function handlePaste() {
    if (transformOperations.floatingBuffer) {
      transformOperations.onCommitTransform();
    }
    if (!clipboardRef.current) return;
    if (isActiveLayerLocked) return;

    const before = cloneBuffer(buffer);
    const after = pasteClipboard(
      buffer,
      clipboardRef.current,
      canvasSpec.width,
      canvasSpec.height,
    );

    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }



  function handleInpaintRequest(payload: {
    prompt: string;
    denoiseStrength: number;
    promptInfluence: number;
  }) {
    if (!selection) {
      return "No selection available for inpainting.";
    }
    if (!activeLayer?.pixels) {
      return "No active layer pixels to inpaint.";
    }
    const request = buildInpaintPayload(
      payload.prompt,
      canvasSpec,
      activeLayer.pixels,
      selection,
      payload.denoiseStrength,
      payload.promptInfluence,
    );
    console.info("Inpaint payload prepared", request);
    return "Inpaint payload prepared (see console).";
  }

  async function handleImageToImageRequest(payload: {
    prompt: string;
    denoiseStrength: number;
    promptInfluence: number;
  }) {
    if (!activeLayer?.pixels) {
      return "No active layer pixels available for image-to-image.";
    }
    const request = buildInpaintPayload(
      payload.prompt,
      canvasSpec,
      activeLayer.pixels,
      selection ?? new Uint8Array(canvasSpec.width * canvasSpec.height).fill(1),
      payload.denoiseStrength,
      payload.promptInfluence,
    );
    console.info("Image-to-image payload prepared", request);
    return "Image-to-image payload prepared (see console).";
  }

  function updateCurrentFrameComposite(
    frameId: string,
    nextLayers: LayerData[],
  ) {
    const composite = compositeLayers(
      nextLayers,
      canvasSpec.width,
      canvasSpec.height,
    );
    setFrames((prev) =>
      prev.map((frame) =>
        frame.id === frameId ? { ...frame, pixels: composite } : frame,
      ),
    );
  }

  function updateActiveLayerPixels(newPixels: Uint8ClampedArray) {
    if (!activeLayerId) return;
    const frameId = currentFrame.id;
    setFrameLayers((prev) => {
      const currentLayers = prev[frameId] || [];
      const nextLayers = currentLayers.map((layer) =>
        layer.id === activeLayerId ? { ...layer, pixels: newPixels } : layer,
      );
      updateCurrentFrameComposite(frameId, nextLayers);
      return { ...prev, [frameId]: nextLayers };
    });
  }

  function rebuildFramesFromLayers(
    nextFrameLayers: Record<string, LayerData[]>,
  ) {
    setFrames((prev) =>
      prev.map((frame) => {
        const layersForFrame = nextFrameLayers[frame.id] || [];
        const composite = compositeLayers(
          layersForFrame,
          canvasSpec.width,
          canvasSpec.height,
        );
        return { ...frame, pixels: composite };
      }),
    );
  }

  function buildSnapshot(): ProjectSnapshot {
    const snapshotFrames = frames.map((frame) => ({
      id: frame.id,
      durationMs: frame.durationMs,
      pivot: frame.pivot,
      layers: (frameLayers[frame.id] || []).map((layer) => ({
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        blend_mode: layer.blend_mode,
        is_visible: layer.is_visible,
        is_locked: layer.is_locked,
        pixels: layer.pixels ?? createEmptyPixels(),
      })),
    }));

    return {
      version: 1,
      canvas: canvasSpec,
      frames: snapshotFrames,
      currentFrameIndex,
      activeLayerIds: frameActiveLayerIds,
      palettes,
      activePaletteId,
      recentColors,
      settings,
    };
  }

  function applySnapshot(snapshot: ProjectSnapshot) {
    setCanvasSpec(snapshot.canvas);
    setFrames(
      snapshot.frames.map((frame) => ({
        id: frame.id,
        durationMs: frame.durationMs,
        pixels: compositeLayers(
          frame.layers,
          snapshot.canvas.width,
          snapshot.canvas.height,
        ),
        pivot: frame.pivot,
      })),
    );
    setFrameLayers(() =>
      snapshot.frames.reduce<Record<string, LayerData[]>>((acc, frame) => {
        acc[frame.id] = frame.layers;
        return acc;
      }, {}),
    );
    const activeIds = { ...snapshot.activeLayerIds };
    snapshot.frames.forEach((frame) => {
      if (!activeIds[frame.id] && frame.layers[0]) {
        activeIds[frame.id] = frame.layers[0].id;
      }
    });
    setFrameActiveLayerIds(activeIds);
    setCurrentFrameIndex(
      Math.min(
        snapshot.currentFrameIndex,
        Math.max(snapshot.frames.length - 1, 0),
      ),
    );
    setPalettes(snapshot.palettes);
    setActivePaletteId(snapshot.activePaletteId);
    setRecentColors(snapshot.recentColors);
    if (snapshot.settings) {
      const { layout: snapshotLayout, ...restSettings } = snapshot.settings;
      setSettings((prev) => ({
        ...prev,
        ...restSettings,
        layout: {
          ...prev.layout,
          ...(snapshotLayout ?? {}),
          rightPanelOrder: snapshotLayout?.rightPanelOrder?.length
            ? snapshotLayout.rightPanelOrder
            : prev.layout.rightPanelOrder,
          toolRailPosition:
            snapshotLayout?.toolRailPosition ?? prev.layout.toolRailPosition,
        },
      }));
    }
    historyRef.current = new HistoryStack();
    syncHistoryFlags();
    setSelection(null);
    transformOperations.setFloatingBuffer(null);
  }



  function onStrokeEnd(before: Uint8ClampedArray, after: Uint8ClampedArray) {
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    if (
      hasSupabaseConfig &&
      realtimeChannelRef.current &&
      activeProject &&
      activeLayerId
    ) {
      const patch = buildPixelPatch(before, after);
      if (patch.length > 0) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "pixel-update",
          payload: {
            userId: localUserId,
            frameId: currentFrame.id,
            layerId: activeLayerId,
            patch,
          },
        });
      }
    }
  }



  /**
   * Animation handlers - delegated to useAnimationSystem hook
   * These wrappers maintain the function names for JSX compatibility
   */
  const handleInsertFrame = animationSystem.handleInsertFrame;
  const handleDuplicateFrame = animationSystem.handleDuplicateFrame;
  const handleReorderFrames = animationSystem.handleReorderFrames;
  const handleMultiSelectFrame = animationSystem.handleMultiSelectFrame;
  const handleDeleteFrame = animationSystem.handleDeleteFrame;
  const handleSelectFrame = animationSystem.handleSelectFrame;
  const handleUpdateFrameDuration = animationSystem.handleUpdateFrameDuration;
  const handleTogglePlayback = animationSystem.handleTogglePlayback;

  function handleSelectColor(color: string) {
    setSettings((s) => ({ ...s, primaryColor: color }));
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 20);
    });
  }

  function handleCursorMove(next: { x: number; y: number } | null) {
    setCursorPosition(next);
    if (!next || !hasSupabaseConfig || !realtimeChannelRef.current) return;
    const now = performance.now();
    if (now - lastCursorBroadcastRef.current < 50) return;
    lastCursorBroadcastRef.current = now;
    realtimeChannelRef.current.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        userId: localUserId,
        x: next.x,
        y: next.y,
        color: localUserColor,
      },
    });
  }

  /**
   * Layer handlers - delegated to useLayerManager hook
   */
  const handleCreateLayer = layerManager.handleCreateLayer;
  const handleDeleteLayer = layerManager.handleDeleteLayer;
  const handleDuplicateLayer = layerManager.handleDuplicateLayer;
  const handleToggleLayerVisibility = layerManager.handleToggleLayerVisibility;
  const handleToggleLayerLock = layerManager.handleToggleLayerLock;
  const handleUpdateLayerOpacity = layerManager.handleUpdateLayerOpacity;
  const handleUpdateLayerBlendMode = layerManager.handleUpdateLayerBlendMode;
  const handleRenameLayer = layerManager.handleRenameLayer;
  const handleReorderLayers = layerManager.handleReorderLayers;
  const handleMergeDown = layerManager.handleMergeDown;
  const handleFlattenLayers = layerManager.handleFlattenLayers;

  /**
   * Palette handlers - delegated to usePaletteManager hook
   */
  const handleCreatePalette = paletteManager.handleCreatePalette;
  const handleImportPalette = paletteManager.handleImportPalette;
  const handleExportPalette = paletteManager.handleExportPalette;
  const handleExtractPaletteFromImage =
    paletteManager.handleExtractPaletteFromImage;
  const handleGeneratePaletteRamp = paletteManager.handleGeneratePaletteRamp;
  const handleDeletePalette = paletteManager.handleDeletePalette;
  const handleAddColorToPalette = paletteManager.handleAddColorToPalette;
  const handleRemoveColorFromPalette =
    paletteManager.handleRemoveColorFromPalette;
  const handleSwapColors = paletteManager.handleSwapColors;

  /**
   * Transform handlers - delegated to useTransformOperations hook
   */
  const transformOperations = useTransformOperations({
    canvasSpec,
    activeLayerPixels: buffer,
    isActiveLayerLocked,
    selection,
    setSelection: setSelection,
    updateActiveLayerPixels,
    history: historyRef.current,
    syncHistoryFlags,
    primaryColor: settings.primaryColor,
  });

  const selectionOperations = useSelectionOperations({
    selection,
    setSelection,
    canvasSpec,
    compositeBuffer,
    cursorPosition,
    setProjectError,
    floatingBuffer: transformOperations.floatingBuffer,
    onCommitTransform: transformOperations.onCommitTransform,
  });



  function handleCreateAnimationTag(
    tag: Omit<AnimationTag, "id" | "created_at">,
  ) {
    const newTag: AnimationTag = {
      ...tag,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    setAnimationTags((prev) =>
      [...prev, newTag].sort((a, b) => a.start_frame - b.start_frame),
    );
    setActiveAnimationTagId(newTag.id);
  }

  function handleUpdateAnimationTag(
    tagId: string,
    updates: Partial<AnimationTag>,
  ) {
    setAnimationTags((prev) =>
      prev
        .map((tag) => {
          if (tag.id !== tagId) return tag;
          const next = { ...tag, ...updates };
          if (next.end_frame < next.start_frame) {
            next.end_frame = next.start_frame;
          }
          return next;
        })
        .sort((a, b) => a.start_frame - b.start_frame),
    );
  }

  function handleDeleteAnimationTag(tagId: string) {
    setAnimationTags((prev) => prev.filter((tag) => tag.id !== tagId));
    if (activeAnimationTagId === tagId) {
      setActiveAnimationTagId(null);
    }
  }

  function buildSelectionMaskFromBuffer(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
  ): Uint8Array {
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const alpha = pixels[i * 4 + 3];
      if (alpha > 0) {
        mask[i] = 1;
      }
    }
    return mask;
  }









  function handleGenerateTweens(
    startIndex: number,
    endIndex: number,
    count: number,
    easing: EasingCurve,
  ) {
    if (frames.length < 2 || count <= 0) return;
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    if (start === end) return;

    const startFrame = frames[start];
    const endFrame = frames[end];
    const tweenData = generateTweenFrames(
      startFrame,
      endFrame,
      canvasSpec.width,
      canvasSpec.height,
      count,
      easing,
      defaultPivot,
    );

    const newFrames: Frame[] = tweenData.map((data) => ({
      id: crypto.randomUUID(),
      pixels: data.pixels,
      durationMs: data.durationMs,
      pivot: data.pivot ?? defaultPivot,
    }));

    const startLayers = frameLayers[startFrame.id] || [];
    const endLayers = frameLayers[endFrame.id] || [];
    const nextFrameLayers: Record<string, LayerData[]> = {};
    const nextActiveLayerIds: Record<string, string> = {};

    if (startLayers.length > 0 && startLayers.length === endLayers.length) {
      const layerBuffers = startLayers.map((layer, index) => {
        const startPixels = layer.pixels ?? createEmptyPixels();
        const endPixels = endLayers[index]?.pixels ?? createEmptyPixels();
        return interpolatePixelBuffers(
          startPixels,
          endPixels,
          canvasSpec.width,
          canvasSpec.height,
          count,
          easing,
        );
      });

      newFrames.forEach((frame, tweenIndex) => {
        const layersForFrame = startLayers.map((layer, layerIndex) => ({
          ...layer,
          id: crypto.randomUUID(),
          name: layer.name,
          pixels: layerBuffers[layerIndex]?.[tweenIndex] ?? createEmptyPixels(),
        }));
        frame.pixels = compositeLayers(
          layersForFrame,
          canvasSpec.width,
          canvasSpec.height,
        );
        nextFrameLayers[frame.id] = layersForFrame;
        nextActiveLayerIds[frame.id] = layersForFrame[0]?.id || "";
      });
    } else {
      newFrames.forEach((frame) => {
        const layer = createLayer(canvasSpec.width, canvasSpec.height, "Tween Frame", frame.pixels);
        nextFrameLayers[frame.id] = [layer];
        nextActiveLayerIds[frame.id] = layer.id;
      });
    }

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(start + 1, 0, ...newFrames);
      return updated;
    });
    setFrameLayers((prev) => ({ ...prev, ...nextFrameLayers }));
    setFrameActiveLayerIds((prev) => ({ ...prev, ...nextActiveLayerIds }));
    setCurrentFrameIndex(start + 1);
  }

  const commands: Command[] = useMemo(
    () => [
      {
        id: "undo",
        name: "Undo",
        shortcut: "Cmd+Z",
        category: "Edit",
        action: handleUndo,
        keywords: ["history"],
      },
      {
        id: "redo",
        name: "Redo",
        shortcut: "Cmd+Y",
        category: "Edit",
        action: handleRedo,
        keywords: ["history"],
      },
      {
        id: "copy",
        name: "Copy",
        shortcut: "Cmd+C",
        category: "Edit",
        action: handleCopy,
      },
      {
        id: "cut",
        name: "Cut",
        shortcut: "Cmd+X",
        category: "Edit",
        action: handleCut,
      },
      {
        id: "paste",
        name: "Paste",
        shortcut: "Cmd+V",
        category: "Edit",
        action: handlePaste,
      },
      {
        id: "selectAll",
        name: "Select All",
        shortcut: "Cmd+A",
        category: "Edit",
        action: selectionOperations.onSelectAll,
      },
      {
        id: "deselect",
        name: "Deselect",
        shortcut: "Cmd+D",
        category: "Edit",
        action: selectionOperations.onDeselect,
      },
      {
        id: "newFrame",
        name: "New Frame",
        category: "Animation",
        action: handleInsertFrame,
      },
      {
        id: "duplicateFrame",
        name: "Duplicate Frame",
        category: "Animation",
        action: handleDuplicateFrame,
      },
      {
        id: "deleteFrame",
        name: "Delete Frame",
        shortcut: "Delete",
        category: "Animation",
        action: handleDeleteFrame,
      },
      {
        id: "playPause",
        name: "Play/Pause",
        shortcut: "Space",
        category: "Animation",
        action: handleTogglePlayback,
      },
      {
        id: "export",
        name: "Export",
        shortcut: "Cmd+E",
        category: "File",
        action: () => setShowExportPanel(true),
      },
      {
        id: "saveProject",
        name: "Save Project Snapshot",
        shortcut: "Cmd+S",
        category: "File",
        action: handleAutoSave,
        keywords: ["autosave", "cloud"],
      },
      {
        id: "openDashboard",
        name: "Project Dashboard",
        category: "File",
        action: () => setProjectView("dashboard"),
        keywords: ["projects"],
      },
      {
        id: "importPalette",
        name: "Import Palette",
        category: "Palette",
        action: () => paletteImportRef.current?.click(),
      },
      {
        id: "exportPaletteGpl",
        name: "Export Palette (GPL)",
        category: "Palette",
        action: () => handleExportPalette("gpl"),
      },
      {
        id: "exportPaletteAse",
        name: "Export Palette (ASE)",
        category: "Palette",
        action: () => handleExportPalette("ase"),
      },
      {
        id: "paletteRamp",
        name: "Generate Palette Ramp",
        category: "Palette",
        action: () => handleGeneratePaletteRamp(6),
      },
      {
        id: "colorSwap",
        name: "Swap Primary/Secondary",
        category: "Palette",
        action: () =>
          handleSwapColors(
            settings.primaryColor,
            settings.secondaryColor || "#000000",
          ),
      },
      {
        id: "shortcuts",
        name: "Show Shortcuts",
        shortcut: "Cmd+/",
        category: "Help",
        action: () => setShowShortcutOverlay(true),
      },
      {
        id: "flipH",
        name: "Flip Horizontal",
        shortcut: "Cmd+H",
        category: "Transform",
        action: transformOperations.onFlipHorizontal,
      },
      {
        id: "flipV",
        name: "Flip Vertical",
        shortcut: "Cmd+Shift+H",
        category: "Transform",
        action: transformOperations.onFlipVertical,
      },
      {
        id: "rotate90CW",
        name: "Rotate 90° CW",
        shortcut: "Cmd+Alt+R",
        category: "Transform",
        action: transformOperations.onRotate90CW,
      },
      {
        id: "rotate90CCW",
        name: "Rotate 90° CCW",
        shortcut: "Cmd+Alt+Shift+R",
        category: "Transform",
        action: transformOperations.onRotate90CCW,
      },
      {
        id: "rotate180",
        name: "Rotate 180°",
        category: "Transform",
        action: transformOperations.onRotate180,
      },
      {
        id: "invert",
        name: "Invert Colors",
        category: "Color",
        action: colorAdjustments.handleInvert,
      },
      {
        id: "desaturate",
        name: "Desaturate",
        category: "Color",
        action: colorAdjustments.handleDesaturate,
      },
      {
        id: "newLayer",
        name: "New Layer",
        category: "Layer",
        action: handleCreateLayer,
      },
      {
        id: "toolPen",
        name: "Pen Tool",
        shortcut: "B",
        category: "Tools",
        action: () => handleChangeTool("pen"),
      },
      {
        id: "toolSmudge",
        name: "Smudge Tool",
        shortcut: "S",
        category: "Tools",
        action: () => handleChangeTool("smudge"),
      },
      {
        id: "toolEraser",
        name: "Eraser Tool",
        shortcut: "E",
        category: "Tools",
        action: () => handleChangeTool("eraser"),
      },
      {
        id: "toolFill",
        name: "Fill Tool",
        shortcut: "F",
        category: "Tools",
        action: () => handleChangeTool("fill"),
      },
      {
        id: "toolEyedropper",
        name: "Eyedropper Tool",
        shortcut: "I",
        category: "Tools",
        action: () => handleChangeTool("eyedropper"),
      },
    ],
    [
      handleUndo,
      handleRedo,
      handleCopy,
      handleCut,
      handleCopy,
      handleCut,
      handlePaste,
      selectionOperations.onSelectAll,
      selectionOperations.onDeselect,
      handleInsertFrame,
      handleDuplicateFrame,
      handleDeleteFrame,
      handleTogglePlayback,
      handleAutoSave,
      handleExportPalette,
      handleGeneratePaletteRamp,
      handleSwapColors,
      transformOperations.onFlipHorizontal,
      transformOperations.onFlipVertical,
      transformOperations.onRotate90CW,
      transformOperations.onRotate90CCW,
      transformOperations.onRotate180,
      colorAdjustments.handleInvert,
      colorAdjustments.handleDesaturate,
      handleCreateLayer,
      handleChangeTool,
      settings.primaryColor,
      settings.secondaryColor,
    ],
  );

  useKeyboardShortcuts(
    {
      onUndo: handleUndo,
      onRedo: handleRedo,
      onCopy: handleCopy,
      onCut: handleCut,
      onPaste: handlePaste,
      onDelete: selectionOperations.onDeselect,
      onSelectAll: selectionOperations.onSelectAll,
      onDeselect: selectionOperations.onDeselect,
      onChangeTool: handleChangeTool,
      onSave: handleAutoSave,
      onExport: () => setShowExportPanel(true),
      onZoomIn: () =>
        setSettings((s) => ({ ...s, zoom: Math.min(32, s.zoom + 1) })),
      onZoomOut: () =>
        setSettings((s) => ({ ...s, zoom: Math.max(1, s.zoom - 1) })),
      onZoomReset: () => setSettings((s) => ({ ...s, zoom: 8 })),
      onToggleGrid: () => setSettings((s) => ({ ...s, showGrid: !s.showGrid })),
      onToggleOnionSkin: () =>
        setSettings((s) => ({ ...s, showOnionSkin: !s.showOnionSkin })),
      onFlipHorizontal: transformOperations.onFlipHorizontal,
      onFlipVertical: transformOperations.onFlipVertical,
      onRotate90CW: transformOperations.onRotate90CW,
      onRotate90CCW: transformOperations.onRotate90CCW,
      onOpenCommandPalette: () => setShowCommandPalette(true),
      onToggleShortcutOverlay: () => setShowShortcutOverlay((prev) => !prev),
      onNewFrame: handleInsertFrame,
      onDuplicateFrame: handleDuplicateFrame,
      onDeleteFrame: handleDeleteFrame,
      onNextFrame: () =>
        setCurrentFrameIndex((i) => Math.min(frames.length - 1, i + 1)),
      onPrevFrame: () => setCurrentFrameIndex((i) => Math.max(0, i - 1)),
      onPlayPause: handleTogglePlayback,
    },
    projectView === "editor" && !showCommandPalette && !showShortcutOverlay,
  );

  function handleChangeTool(nextTool: ToolId) {
    if (transformOperations.floatingBuffer) {
      transformOperations.onCommitTransform();
    }
    setTool(nextTool);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && transformOperations.floatingBuffer && !isInputFocused()) {
        e.preventDefault();
        transformOperations.onCommitTransform();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [transformOperations]);

  return (
    <>
      {projectView === "dashboard" ? (
        <ProjectDashboard
          projects={projects}
          onSelect={handleSelectProject}
          onCreate={handleCreateProject}
          onDelete={handleDeleteProject}
          onRename={handleRenameProject}
          onDuplicate={handleDuplicateProject}
          onRefresh={refreshProjects}
          loading={projectLoading}
          error={projectError}
        />
      ) : (
        <DockLayout
          settings={settings}
          onChangeSettings={setSettings}
          tool={tool}
          onChangeTool={handleChangeTool}
          canvasSpec={canvasSpec}
          buffer={buffer}
          compositeBuffer={colorAdjustments.compositePreviewBuffer}
          previewLayerPixels={colorAdjustments.previewLayerPixels}
          onStrokeEnd={onStrokeEnd}
          selection={selection}
          onChangeSelection={setSelection}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          selectedFrameIndices={selectedFrameIndices}
          isPlaying={isPlaying}
          onSelectFrame={(i, mod) => handleMultiSelectFrame(i, mod)}
          onInsertFrame={handleInsertFrame}
          onDuplicateFrame={handleDuplicateFrame}
          onDeleteFrame={handleDeleteFrame}
          onUpdateFrameDuration={handleUpdateFrameDuration}
          onTogglePlayback={handleTogglePlayback}
          onGenerateTweens={handleGenerateTweens}
          animationTags={animationTags}
          activeTagId={activeAnimationTagId}
          loopTagOnly={loopTagOnly}
          onToggleLoopTagOnly={setLoopTagOnly}
          onSelectTag={setActiveAnimationTagId}
          onCreateTag={handleCreateAnimationTag}
          onUpdateTag={handleUpdateAnimationTag}
          onDeleteTag={handleDeleteAnimationTag}
          remoteCursors={remoteCursors}
          layers={layers}
          activeLayerId={activeLayerId}
          onLayerOperations={{
            onSelectLayer: (id) =>
              setFrameActiveLayerIds((prev) => ({
                ...prev,
                [currentFrame.id]: id,
              })),
            onCreateLayer: handleCreateLayer,
            onDeleteLayer: handleDeleteLayer,
            onDuplicateLayer: handleDuplicateLayer,
            onToggleVisibility: handleToggleLayerVisibility,
            onToggleLock: handleToggleLayerLock,
            onUpdateOpacity: handleUpdateLayerOpacity,
            onUpdateBlendMode: handleUpdateLayerBlendMode,
            onRenameLayer: handleRenameLayer,
            onReorderLayers: handleReorderLayers,
            onMergeDown: handleMergeDown,
            onFlatten: handleFlattenLayers,
          }}
          palettes={palettes}
          activePaletteId={activePaletteId}
          recentColors={recentColors}
          onPaletteOperations={{
            onSelectPalette: setActivePaletteId,
            onCreatePalette: handleCreatePalette,
            onDeletePalette: handleDeletePalette,
            onAddColorToPalette: handleAddColorToPalette,
            onRemoveColorFromPalette: handleRemoveColorFromPalette,
            onSelectColor: handleSelectColor,
            onSwapColors: handleSwapColors,
            onExtractPalette: handleExtractPaletteFromImage,
            onImportPalette: handleImportPalette,
            onExportPalette: handleExportPalette,
            onGenerateRamp: handleGeneratePaletteRamp,
          }}
          onTransformOperations={transformOperations}
          onColorAdjustOperations={{
            onAdjustHue: colorAdjustments.handleAdjustHue,
            onAdjustSaturation: colorAdjustments.handleAdjustSaturation,
            onAdjustBrightness: colorAdjustments.handleAdjustBrightness,
            onPreviewAdjust: colorAdjustments.handlePreviewAdjust,
            onClearPreview: colorAdjustments.handleClearPreview,
            onInvert: colorAdjustments.handleInvert,
            onDesaturate: colorAdjustments.handleDesaturate,
            onPosterize: colorAdjustments.handlePosterize,
          }}
          onSelectionOperations={selectionOperations}
          onCursorMove={handleCursorMove}
          onNavigateToDashboard={() => setProjectView("dashboard")}
          topBar={
            <div className="topbar">
              <div className="topbar__left">
                <div className="brand">
                  <div className="brand__name">SpriteAnvil</div>
                  {/* Tagline hidden on smaller screens via CSS likely, or just keep it */}
                </div>
                <div className="topbar__sep" />
                <div className="topbar__project">
                  <span
                    className="topbar__project-label"
                    style={{
                      opacity: 0.5,
                      fontSize: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    Project
                  </span>
                  <span className="topbar__project-name">
                    {activeProject?.name ?? "Untitled"}
                  </span>
                </div>
              </div>

              <div className="topbar__center">
                <button
                  className="uiBtn uiBtn--ghost"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Cmd+Z)"
                >
                  ↩
                </button>
                <button
                  className="uiBtn uiBtn--ghost"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Cmd+Y)"
                >
                  ↪
                </button>

                <div className="topbar__sep" />

                <button
                  className="uiBtn"
                  onClick={() => setShowCommandPalette(true)}
                  title="Command Palette (Cmd+K)"
                >
                  Commands
                </button>

                <button
                  className="uiBtn"
                  onClick={() => setProjectView("dashboard")}
                  title="Project Dashboard"
                >
                  Projects
                </button>

                <div className="topbar__sep" />

                {/* Color Picker Integration */}
                <label className="ui-color-picker-btn" title="Primary Color">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleSelectColor(e.target.value)}
                  />
                  <div
                    className="color-swatch"
                    style={{ backgroundColor: settings.primaryColor }}
                  />
                </label>
              </div>

              <div className="topbar__right">
                <button
                  className={
                    "uiBtn" + (showExportPanel ? " uiBtn--active" : "")
                  }
                  onClick={() => setShowExportPanel((prev) => !prev)}
                  title="Export Sprite (Cmd+E)"
                >
                  Export
                </button>
                <button
                  className={
                    "uiBtn" + (showSettingsPanel ? " uiBtn--active" : "")
                  }
                  onClick={() => setShowSettingsPanel((prev) => !prev)}
                  title="Workspace Settings"
                >
                  Settings
                </button>

                {/* User Avatars / QuickControls simplified */}
                {activeCollaborators.length > 0 && (
                  <div
                    style={{ display: "flex", gap: "4px", marginLeft: "8px" }}
                  >
                    {activeCollaborators.slice(0, 3).map((u) => (
                      <div
                        key={u.id}
                        style={{
                          width: 20,
                          height: 20,
                          background: u.color,
                          borderRadius: "50%",
                        }}
                        title={u.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              <button
                className="uiBtn topbar__menuBtn"
                onClick={() => setShowTopbarMenu((prev) => !prev)}
                title="Toggle topbar menu"
              >
                ☰
              </button>

              {showTopbarMenu && (
                <div className="topbar__menu">
                  <div className="topbar__menu-header">
                    <span>Menu</span>
                    <button
                      className="uiBtn uiBtn--ghost"
                      onClick={() => setShowTopbarMenu(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="topbar__menu-body">
                    <button
                      className="uiBtn"
                      onClick={() => {
                        setShowCommandPalette(true);
                        setShowTopbarMenu(false);
                      }}
                    >
                      Commands
                    </button>
                    <button
                      className="uiBtn"
                      onClick={() => {
                        setProjectView("dashboard");
                        setShowTopbarMenu(false);
                      }}
                    >
                      Projects
                    </button>
                    <button
                      className="uiBtn"
                      onClick={() => {
                        setShowExportPanel((prev) => !prev);
                        setShowTopbarMenu(false);
                      }}
                    >
                      Export
                    </button>
                    <button
                      className="uiBtn"
                      onClick={() => {
                        setShowSettingsPanel((prev) => !prev);
                        setShowTopbarMenu(false);
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          }
          statusBar={<StatusBar info={statusInfo} />}
        />
      )}

      <input
        ref={paletteImportRef}
        type="file"
        accept=".gpl,.ase"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportPalette(file);
          e.currentTarget.value = "";
        }}
      />

      {confirmDialog && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!confirmBusy) setConfirmDialog(null);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{confirmDialog.title}</h2>
              <button
                className="modal-close"
                onClick={() => !confirmBusy && setConfirmDialog(null)}
                title="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>{confirmDialog.message}</p>
            </div>
            <div className="modal-footer">
              <button
                className="uiBtn"
                onClick={() => setConfirmDialog(null)}
                disabled={confirmBusy}
              >
                Cancel
              </button>
              <button
                className="uiBtn uiBtn--primary"
                onClick={confirmDialog.onConfirm}
                disabled={confirmBusy}
              >
                {confirmDialog.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsPanel && (
        <SettingsPanel
          settings={settings}
          onChangeSettings={(next: UiSettings) => {
            setSettings(next);
            // Side effects for grid/onionskin if needed are handled by setSettings state
          }}
          onClose={() => setShowSettingsPanel(false)}
          activeProject={activeProject}
          onSaveSnapshot={handleAutoSave}
          onReloadSnapshot={handleReloadProject}
        />
      )}

      {showExportPanel && projectView === "editor" && (
        <ExportPanel
          frames={frames}
          canvasSpec={canvasSpec}
          animationTags={animationTags}
          onClose={() => setShowExportPanel(false)}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          commands={commands}
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {showShortcutOverlay && (
        <ShortcutOverlay
          isOpen={showShortcutOverlay}
          onClose={() => setShowShortcutOverlay(false)}
          groups={shortcutGroups}
        />
      )}
    </>
  );
}

function toHexFallback(_cssColor: string, fallbackHex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(_cssColor)) return _cssColor;
  return fallbackHex;
}
