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
 * Think of App.tsx as the "Brain" or "Conductor" of SpriteAnvil.
 *
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph TD
 *   A[App.tsx] --> B[DockLayout]
 *   B --> C[CanvasStage]
 *   B --> D[ToolRail]
 *   B --> E[RightPanel]
 *   E --> F[LayerPanel]
 *   E --> G[PalettePanel]
 *
 *   D -- Picks Tool --> A
 *   C -- Pointer Event --> A
 *   A -- Algorithm --> H[Pixel Buffer]
 *   H -- Composites --> C
 *   A -- Persistence --> I[Supabase]
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
import { compositeLayers, mergeDown, flattenImage } from "./editor/layers";
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
import {
  adjustHue,
  adjustSaturation,
  adjustBrightness,
  invertColors,
  desaturate,
  posterize,
} from "./editor/tools/coloradjust";
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
  // ORIGIN: New Project Dialog. USAGE: Used to initialize buffers and scale UI. PURPOSE: The "Paper Size" of the art.
  const [canvasSpec, setCanvasSpec] = useState<CanvasSpec>(() => ({
    width: 64,
    height: 64,
  }));
  // ORIGIN: ToolRail 클릭. USAGE: Switches brush math (Pen vs Eraser). PURPOSE: Current active tool.
  const [tool, setTool] = useState<ToolId>("pen");
  const [projectView, setProjectView] = useState<"dashboard" | "editor">(
    "dashboard",
  );
  // ORIGIN: Supabase / Dashboard. USAGE: Loads all frames and layers. PURPOSE: The current active project.
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
  // ORIGIN: CanvasStage Mouse Move. USAGE: Passed to StatusBar. PURPOSE: Shows current pixel coordinates.
  const [cursorPosition, setCursorPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const initialFrameId = useMemo(() => crypto.randomUUID(), []);
  const createEmptyPixels = () =>
    createBuffer(canvasSpec.width, canvasSpec.height, {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    });
  const defaultPivot = useMemo(
    () => ({ x: Math.floor(canvasSpec.width / 2), y: canvasSpec.height - 1 }),
    [canvasSpec.width, canvasSpec.height],
  );

  const [frames, setFrames] = useState<Frame[]>(() => [
    {
      id: initialFrameId,
      pixels: createEmptyPixels(),
      durationMs: 100,
      pivot: defaultPivot,
    },
  ]);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [selectedFrameIndices, setSelectedFrameIndices] = useState<Set<number>>(
    new Set([0]),
  );
  const [selection, setSelection] = useState<Uint8Array | null>(null);
  /* State removed: floatingBuffer, isTransforming */
  const clipboardRef = useRef<ClipboardData | null>(null);
  const paletteImportRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTopbarMenu, setShowTopbarMenu] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(
    null,
  );
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [animationTags, setAnimationTags] = useState<AnimationTag[]>([]);
  const [activeAnimationTagId, setActiveAnimationTagId] = useState<
    string | null
  >(null);
  const [loopTagOnly, setLoopTagOnly] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, { x: number; y: number; color: string }>
  >({});
  const [activeCollaborators, setActiveCollaborators] = useState<
    Array<{ id: string; color: string }>
  >([]);

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

  function createLayer(
    name: string,
    pixels?: Uint8ClampedArray,
  ): LayerData & { pixels: Uint8ClampedArray } {
    return {
      id: crypto.randomUUID(),
      name,
      opacity: 1,
      blend_mode: "normal",
      is_visible: true,
      is_locked: false,
      pixels: pixels ?? createEmptyPixels(),
    };
  }

  const [frameLayers, setFrameLayers] = useState<Record<string, LayerData[]>>(
    {},
  );
  const [frameActiveLayerIds, setFrameActiveLayerIds] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const baseLayer = createLayer("Layer 1");
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

  const [colorAdjustPreview, setColorAdjustPreview] = useState({
    hueShift: 0,
    saturationDelta: 0,
    brightnessDelta: 0,
  });

  const previewLayerPixels = useMemo(() => {
    if (
      colorAdjustPreview.hueShift === 0 &&
      colorAdjustPreview.saturationDelta === 0 &&
      colorAdjustPreview.brightnessDelta === 0
    ) {
      return null;
    }
    let preview = buffer;
    if (colorAdjustPreview.hueShift !== 0) {
      preview = adjustHue(
        preview,
        canvasSpec.width,
        canvasSpec.height,
        colorAdjustPreview.hueShift,
      );
    }
    if (colorAdjustPreview.saturationDelta !== 0) {
      preview = adjustSaturation(
        preview,
        canvasSpec.width,
        canvasSpec.height,
        colorAdjustPreview.saturationDelta,
      );
    }
    if (colorAdjustPreview.brightnessDelta !== 0) {
      preview = adjustBrightness(
        preview,
        canvasSpec.width,
        canvasSpec.height,
        colorAdjustPreview.brightnessDelta,
      );
    }
    return preview;
  }, [
    buffer,
    canvasSpec.height,
    canvasSpec.width,
    colorAdjustPreview.brightnessDelta,
    colorAdjustPreview.hueShift,
    colorAdjustPreview.saturationDelta,
  ]);

  const compositePreviewBuffer = useMemo(() => {
    if (!previewLayerPixels) return compositeBuffer;
    if (!layers.length) return previewLayerPixels;
    const previewLayers = layers.map((layer) =>
      layer.id === activeLayerId
        ? { ...layer, pixels: previewLayerPixels }
        : layer,
    );
    return compositeLayers(previewLayers, canvasSpec.width, canvasSpec.height);
  }, [
    activeLayerId,
    canvasSpec.height,
    canvasSpec.width,
    compositeBuffer,
    layers,
    previewLayerPixels,
  ]);

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

  async function refreshProjects() {
    setProjectLoading(true);
    setProjectError(null);
    try {
      if (!hasSupabaseConfig) {
        setProjects(loadLocalProjects());
        return;
      }
      const list = await getProjects();
      setProjects(list);
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to load projects.",
      );
    } finally {
      setProjectLoading(false);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, []);

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
      const baseLayer = createLayer("Layer 1");
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

  function handleDeselect() {
    handleChangeSelection(null);
  }

  function handleSelectAll() {
    const sel = new Uint8Array(canvasSpec.width * canvasSpec.height);
    sel.fill(1);
    handleChangeSelection(sel);
  }

  function handleInvertSelection() {
    if (!selection) {
      handleSelectAll();
      return;
    }
    const inverted = new Uint8Array(selection);
    invertSelection(inverted);
    handleChangeSelection(inverted);
  }

  function handleGrowSelection() {
    if (!selection) return;
    const grown = new Uint8Array(canvasSpec.width * canvasSpec.height);
    for (let y = 0; y < canvasSpec.height; y++) {
      for (let x = 0; x < canvasSpec.width; x++) {
        const idx = y * canvasSpec.width + x;
        if (selection[idx]) {
          grown[idx] = 1;
          if (x > 0) grown[idx - 1] = 1;
          if (x < canvasSpec.width - 1) grown[idx + 1] = 1;
          if (y > 0) grown[idx - canvasSpec.width] = 1;
          if (y < canvasSpec.height - 1) grown[idx + canvasSpec.width] = 1;
        }
      }
    }
    handleChangeSelection(grown);
  }

  function handleShrinkSelection() {
    if (!selection) return;
    const shrunk = new Uint8Array(canvasSpec.width * canvasSpec.height);
    for (let y = 0; y < canvasSpec.height; y++) {
      for (let x = 0; x < canvasSpec.width; x++) {
        const idx = y * canvasSpec.width + x;
        if (selection[idx]) {
          const hasUnselectedNeighbor =
            x === 0 ||
            !selection[idx - 1] ||
            x === canvasSpec.width - 1 ||
            !selection[idx + 1] ||
            y === 0 ||
            !selection[idx - canvasSpec.width] ||
            y === canvasSpec.height - 1 ||
            !selection[idx + canvasSpec.width];
          if (!hasUnselectedNeighbor) {
            shrunk[idx] = 1;
          }
        }
      }
    }
    handleChangeSelection(shrunk);
  }

  function handleFeatherSelection(_radius: number) {}

  function handleDetectObjectSelection() {
    if (!cursorPosition) {
      setProjectError(
        "Move the cursor over a sprite pixel to detect an object.",
      );
      return;
    }
    const mask = selectConnectedOpaque(
      compositeBuffer,
      canvasSpec.width,
      canvasSpec.height,
      cursorPosition.x,
      cursorPosition.y,
    );
    setSelection(mask);
  }

  async function handleInpaintRequest(payload: {
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

  async function handleSelectProject(project: Project) {
    setProjectLoading(true);
    setProjectError(null);
    try {
      const cached = await getCachedProjectSnapshot(project.id);
      if (cached) {
        applySnapshot(cached);
      } else if (hasSupabaseConfig) {
        const cloudSnapshot = await loadProjectSnapshot(project.id);
        if (cloudSnapshot) {
          const snapshot = deserializeSnapshot(cloudSnapshot);
          applySnapshot(snapshot);
          await cacheProjectSnapshot(project.id, snapshot);
        } else {
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
                    "Layer 1",
                    createBuffer(64, 64, { r: 0, g: 0, b: 0, a: 0 }),
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
          applySnapshot(fallbackSnapshot);
        }
      } else {
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
                  "Layer 1",
                  createBuffer(64, 64, { r: 0, g: 0, b: 0, a: 0 }),
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
        applySnapshot(fallbackSnapshot);
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
  }

  async function handleCreateProject(request: NewProjectRequest) {
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
                "Layer 1",
                createBuffer(request.width, request.height, {
                  r: 0,
                  g: 0,
                  b: 0,
                  a: 0,
                }),
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
      const activeLayerId = newSnapshot.frames[0].layers[0].id;
      newSnapshot.activeLayerIds[newSnapshot.frames[0].id] = activeLayerId;

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
        applySnapshot(newSnapshot);
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
      applySnapshot(newSnapshot);
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
  }

  const autoSaveStateRef = useRef({
    buildSnapshot,
    activeProject,
    saveProjectSnapshot,
    cacheProjectSnapshot,
    serializeSnapshot,
  });
  autoSaveStateRef.current = {
    buildSnapshot,
    activeProject,
    saveProjectSnapshot,
    cacheProjectSnapshot,
    serializeSnapshot,
  };

  const handleAutoSave = useCallback(async () => {
    const currentProject = autoSaveStateRef.current.activeProject;
    if (!currentProject) return;
    const snapshot = autoSaveStateRef.current.buildSnapshot();
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
  }, []);

  const handleReloadProject = useCallback(async () => {
    if (!activeProject) return;
    setProjectLoading(true);
    setProjectError(null);
    try {
      if (hasSupabaseConfig) {
        const cloudSnapshot = await loadProjectSnapshot(activeProject.id);
        if (cloudSnapshot) {
          const snapshot = deserializeSnapshot(cloudSnapshot);
          applySnapshot(snapshot);
          await cacheProjectSnapshot(activeProject.id, snapshot);
        }
      } else {
        const cached = await getCachedProjectSnapshot(activeProject.id);
        if (cached) {
          applySnapshot(cached);
        }
      }
    } catch (error) {
      setProjectError(
        error instanceof Error ? error.message : "Failed to reload project.",
      );
    } finally {
      setProjectLoading(false);
    }
  }, [activeProject, applySnapshot]);

  useEffect(() => {
    if (!activeProject) return;
    const id = window.setInterval(() => {
      handleAutoSave();
    }, 60000);
    return () => window.clearInterval(id);
  }, [activeProject, handleAutoSave]);

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

  function handleDeleteProject(project: Project) {
    setConfirmDialog({
      title: "Delete Project",
      message: `Are you sure you want to permanently delete "${project.name}"? This cannot be undone.`,
      confirmLabel: "Delete Project",
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
  }

  async function handleRenameProject(project: Project) {
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
  }

  async function handleDuplicateProject(project: Project) {
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





  function handleAdjustHue(hueShift: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustHue(
      buffer,
      canvasSpec.width,
      canvasSpec.height,
      hueShift,
    );
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, hueShift: 0 }));
  }

  function handleAdjustSaturation(saturationDelta: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustSaturation(
      buffer,
      canvasSpec.width,
      canvasSpec.height,
      saturationDelta,
    );
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, saturationDelta: 0 }));
  }

  function handleAdjustBrightness(brightnessDelta: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustBrightness(
      buffer,
      canvasSpec.width,
      canvasSpec.height,
      brightnessDelta,
    );
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, brightnessDelta: 0 }));
  }

  const handlePreviewAdjustColor = useCallback(
    (preview: {
      hueShift: number;
      saturationDelta: number;
      brightnessDelta: number;
    }) => {
      setColorAdjustPreview(preview);
    },
    [],
  );

  const handleClearAdjustPreview = useCallback(() => {
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }, []);

  function handleInvert() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = invertColors(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }

  function handleDesaturate() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = desaturate(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }

  function handlePosterize(levels: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = posterize(
      buffer,
      canvasSpec.width,
      canvasSpec.height,
      levels,
    );
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
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
        const layer = createLayer("Tween Frame", frame.pixels);
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
        action: handleSelectAll,
      },
      {
        id: "deselect",
        name: "Deselect",
        shortcut: "Cmd+D",
        category: "Edit",
        action: handleDeselect,
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
        action: handleInvert,
      },
      {
        id: "desaturate",
        name: "Desaturate",
        category: "Color",
        action: handleDesaturate,
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
      handlePaste,
      handleSelectAll,
      handleDeselect,
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
      handleInvert,
      handleDesaturate,
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
      onDelete: handleDeselect,
      onSelectAll: handleSelectAll,
      onDeselect: handleDeselect,
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

  function handleChangeSelection(next: Uint8Array | null) {
    if (transformOperations.floatingBuffer) {
      transformOperations.onCommitTransform();
    }
    setSelection(next);
  }

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
          compositeBuffer={compositePreviewBuffer}
          previewLayerPixels={previewLayerPixels}
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
            onAdjustHue: handleAdjustHue,
            onAdjustSaturation: handleAdjustSaturation,
            onAdjustBrightness: handleAdjustBrightness,
            onPreviewAdjust: handlePreviewAdjustColor,
            onClearPreview: handleClearAdjustPreview,
            onInvert: handleInvert,
            onDesaturate: handleDesaturate,
            onPosterize: handlePosterize,
          }}
          onSelectionOperations={{
            onSelectAll: handleSelectAll,
            onDeselect: handleDeselect,
            onInvertSelection: handleInvertSelection,
            onGrow: handleGrowSelection,
            onShrink: handleShrinkSelection,
            onFeather: handleFeatherSelection,
            onDetectObject: handleDetectObjectSelection,
          }}
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
