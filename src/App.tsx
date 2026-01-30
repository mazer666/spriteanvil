import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DockLayout from "./ui/DockLayout";
import ExportPanel from "./ui/ExportPanel";
import CommandPalette, { Command } from "./ui/CommandPalette";
import { CanvasSpec, ToolId, UiSettings, Frame, LayerData, BlendMode, FloatingSelection } from "./types";
import { HistoryStack } from "./editor/history";
import { cloneBuffer, createBuffer } from "./editor/pixels";
import { applySmartOutline, OutlineMode } from "./editor/outline";
import { generateTweenFrames, interpolatePixelBuffers, EasingCurve } from "./editor/animation";
import { copySelection, cutSelection, pasteClipboard, ClipboardData } from "./editor/clipboard";
import { compositeLayers, mergeDown, flattenImage } from "./editor/layers";
import { PaletteData, ProjectSnapshot } from "./lib/projects/snapshot";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
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
import { extractPaletteFromPixels } from "./editor/palette";
import {
  createProject,
  getProjects,
  loadProjectSnapshot,
  saveProjectSnapshot,
  deleteProject,
  Project,
  ProjectSnapshotPayload,
} from "./lib/supabase/projects";
import { hasSupabaseConfig } from "./lib/supabase/client";
import { supabase } from "./lib/supabase/client";
import { buildPaletteRamp, exportPaletteFile, importPaletteFile } from "./lib/supabase/palettes";
import { cacheProjectSnapshot, getCachedProjectSnapshot } from "./lib/storage/frameCache";
import ProjectDashboard, { NewProjectRequest } from "./ui/ProjectDashboard";
import ShortcutOverlay, { ShortcutGroup } from "./ui/ShortcutOverlay";
import StatusBar from "./ui/StatusBar";
import { hexToRgb } from "./utils/colors";
import { buildInpaintPayload } from "./lib/ai/inpaint";
import { deleteFrame as deleteFrameRecord } from "./lib/supabase/frames";

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
};

export default function App() {
  const LOCAL_PROJECTS_KEY = "spriteanvil:localProjects";
  const [canvasSpec, setCanvasSpec] = useState<CanvasSpec>(() => ({ width: 64, height: 64 }));
  const [tool, setTool] = useState<ToolId>("pen");
  const [projectView, setProjectView] = useState<"dashboard" | "editor">("dashboard");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);

  const initialFrameId = useMemo(() => crypto.randomUUID(), []);
  const createEmptyPixels = () =>
    createBuffer(canvasSpec.width, canvasSpec.height, { r: 0, g: 0, b: 0, a: 0 });
  const defaultPivot = useMemo(
    () => ({ x: Math.floor(canvasSpec.width / 2), y: canvasSpec.height - 1 }),
    [canvasSpec.width, canvasSpec.height]
  );

  const [frames, setFrames] = useState<Frame[]>(() => [
    {
      id: initialFrameId,
      pixels: createEmptyPixels(),
      durationMs: 100,
      pivot: defaultPivot
    }
  ]);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [selection, setSelection] = useState<Uint8Array | null>(null);
  const [floatingBuffer, setFloatingBuffer] = useState<FloatingSelection | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const clipboardRef = useRef<ClipboardData | null>(null);
  const paletteImportRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTopbarMenu, setShowTopbarMenu] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [animationTags, setAnimationTags] = useState<AnimationTag[]>([]);
  const [activeAnimationTagId, setActiveAnimationTagId] = useState<string | null>(null);
  const [loopTagOnly, setLoopTagOnly] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number; color: string }>>({});
  const [activeCollaborators, setActiveCollaborators] = useState<Array<{ id: string; color: string }>>([]);

  const historyRef = useRef<HistoryStack>(new HistoryStack());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const transformBeforeRef = useRef<Uint8ClampedArray | null>(null);

  const currentFrame = frames[currentFrameIndex];
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
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

  function loadLocalProjects(): Project[] {
    try {
      const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Project[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Failed to parse local projects:", error);
      return [];
    }
  }

  function saveLocalProjects(next: Project[]) {
    localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(next));
  }

  function buildPixelPatch(before: Uint8ClampedArray, after: Uint8ClampedArray) {
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
    patch: number[]
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
    pixels?: Uint8ClampedArray
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

  function encodePixels(buffer: Uint8ClampedArray): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buffer.length; i += chunkSize) {
      binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function decodePixels(data: string): Uint8ClampedArray {
    const binary = atob(data);
    const bytes = new Uint8ClampedArray(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function serializeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotPayload {
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

  function deserializeSnapshot(payload: ProjectSnapshotPayload): ProjectSnapshot {
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

  const [frameLayers, setFrameLayers] = useState<Record<string, LayerData[]>>({});
  const [frameActiveLayerIds, setFrameActiveLayerIds] = useState<Record<string, string>>({});

  useEffect(() => {
    const baseLayer = createLayer("Layer 1");
    setFrameLayers({ [initialFrameId]: [baseLayer] });
    setFrameActiveLayerIds({ [initialFrameId]: baseLayer.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layers = frameLayers[currentFrame.id] || [];
  const activeLayerId = frameActiveLayerIds[currentFrame.id] || layers[0]?.id || null;
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) || layers[0] || null;
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
      preview = adjustHue(preview, canvasSpec.width, canvasSpec.height, colorAdjustPreview.hueShift);
    }
    if (colorAdjustPreview.saturationDelta !== 0) {
      preview = adjustSaturation(
        preview,
        canvasSpec.width,
        canvasSpec.height,
        colorAdjustPreview.saturationDelta
      );
    }
    if (colorAdjustPreview.brightnessDelta !== 0) {
      preview = adjustBrightness(
        preview,
        canvasSpec.width,
        canvasSpec.height,
        colorAdjustPreview.brightnessDelta
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
      layer.id === activeLayerId ? { ...layer, pixels: previewLayerPixels } : layer
    );
    return compositeLayers(previewLayers, canvasSpec.width, canvasSpec.height);
  }, [activeLayerId, canvasSpec.height, canvasSpec.width, compositeBuffer, layers, previewLayerPixels]);

  const [palettes, setPalettes] = useState<PaletteData[]>([
    {
      id: "default",
      name: "Default Palette",
      colors: [
        "#000000", "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764",
        "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86",
      ],
      is_default: true,
    }
  ]);
  const [activePaletteId, setActivePaletteId] = useState<string>("default");
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const [settings, setSettings] = useState<UiSettings>(() => ({
    zoom: 8,
    brushStabilizerEnabled: true,
    backgroundMode: "solidDark",
    checkerSize: 24,
    checkerA: "rgba(255,255,255,0.08)",
    checkerB: "rgba(0,0,0,0.10)",
    showGrid: true,
    gridSize: 1,
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
  }));

  const zoomLabel = useMemo(() => `${Math.round(settings.zoom * 100)}%`, [settings.zoom]);
  const colorRgbLabel = useMemo(() => {
    const rgb = hexToRgb(settings.primaryColor);
    if (!rgb) return "rgb(0, 0, 0)";
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }, [settings.primaryColor]);
  const memoryUsageLabel = useMemo(() => {
    const totalBytes = Object.values(frameLayers).reduce((sum, layers) => {
      return (
        sum +
        layers.reduce((layerSum, layer) => layerSum + (layer.pixels?.length ?? 0), 0)
      );
    }, 0);
    const kb = totalBytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  }, [frameLayers]);
  const cursorLabel = cursorPosition ? `${cursorPosition.x}, ${cursorPosition.y}` : "--";
  const statusInfo = useMemo(
    () => ({
      colorHex: settings.primaryColor.toUpperCase(),
      colorRgb: colorRgbLabel,
      zoomLabel,
      memoryUsage: memoryUsageLabel,
      cursor: cursorLabel,
    }),
    [settings.primaryColor, colorRgbLabel, zoomLabel, memoryUsageLabel, cursorLabel]
  );

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
    ],
    []
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
      setProjectError(error instanceof Error ? error.message : "Failed to load projects.");
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

    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      if (!payload || payload.userId === localUserId) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [payload.userId]: { x: payload.x, y: payload.y, color: payload.color || "#4bb8bf" },
      }));
    });

    channel.on("broadcast", { event: "pixel-update" }, ({ payload }) => {
      if (!payload || payload.userId === localUserId) return;
      const { frameId, layerId, patch } = payload as {
        userId: string;
        frameId: string;
        layerId: string;
        patch: number[];
      };
      if (!frameId || !layerId || !Array.isArray(patch)) return;
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
      const state = channel.presenceState() as Record<string, Array<{ color?: string }>>;
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
    [activeAnimationTagId, animationTags]
  );

  useEffect(() => {
    if (!isPlaying) return;

    const advanceFrame = () => {
      setCurrentFrameIndex((prev) => {
        const tagStart = activeTag?.start_frame ?? 0;
        const tagEnd = activeTag?.end_frame ?? frames.length - 1;
        const loopRange = loopTagOnly && activeTag ? { start: tagStart, end: tagEnd } : null;
        const next = loopRange
          ? (prev + 1 > loopRange.end ? loopRange.start : prev + 1)
          : (prev + 1) % frames.length;
        const nextDuration = frames[next]?.durationMs ?? currentFrame.durationMs;
        playbackTimerRef.current = window.setTimeout(advanceFrame, nextDuration);
        return next;
      });
    };

    playbackTimerRef.current = window.setTimeout(advanceFrame, currentFrame.durationMs);

    return () => {
      if (playbackTimerRef.current !== null) {
        clearTimeout(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [activeTag, currentFrame.durationMs, frames, isPlaying, loopTagOnly]);

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
                pixels: compositeLayers([baseLayer], canvasSpec.width, canvasSpec.height),
              }
            : frame
        )
      );
      return { ...prev, [currentFrame.id]: [baseLayer] };
    });
  }, [canvasSpec.height, canvasSpec.width, currentFrame.id]);

  useEffect(() => {
    if (!loopTagOnly || !activeTag) return;
    if (currentFrameIndex < activeTag.start_frame || currentFrameIndex > activeTag.end_frame) {
      setCurrentFrameIndex(activeTag.start_frame);
    }
  }, [activeTag, currentFrameIndex, loopTagOnly]);

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
    if (isTransforming) {
      commitTransform();
    }
    if (!selection) return;
    const clip = copySelection(buffer, selection, canvasSpec.width, canvasSpec.height);
    if (clip) clipboardRef.current = clip;
  }

  function handleCut() {
    if (isTransforming) {
      commitTransform();
    }
    if (!selection) return;
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const { clipboardData, modifiedBuffer } = cutSelection(buffer, selection, canvasSpec.width, canvasSpec.height);

    if (clipboardData) clipboardRef.current = clipboardData;

    historyRef.current.commit(before);
    updateActiveLayerPixels(modifiedBuffer);
    syncHistoryFlags();
  }

  function handlePaste() {
    if (isTransforming) {
      commitTransform();
    }
    if (!clipboardRef.current) return;
    if (isActiveLayerLocked) return;

    const before = cloneBuffer(buffer);
    const after = pasteClipboard(buffer, clipboardRef.current, canvasSpec.width, canvasSpec.height);

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
            (x === 0 || !selection[idx - 1]) ||
            (x === canvasSpec.width - 1 || !selection[idx + 1]) ||
            (y === 0 || !selection[idx - canvasSpec.width]) ||
            (y === canvasSpec.height - 1 || !selection[idx + canvasSpec.width]);
          if (!hasUnselectedNeighbor) {
            shrunk[idx] = 1;
          }
        }
      }
    }
    handleChangeSelection(shrunk);
  }

  function handleFeatherSelection(_radius: number) {
  }

  function handleDetectObjectSelection() {
    if (!cursorPosition) {
      setProjectError("Move the cursor over a sprite pixel to detect an object.");
      return;
    }
    const mask = selectConnectedOpaque(
      compositeBuffer,
      canvasSpec.width,
      canvasSpec.height,
      cursorPosition.x,
      cursorPosition.y
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
      payload.promptInfluence
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
      payload.promptInfluence
    );
    console.info("Image-to-image payload prepared", request);
    return "Image-to-image payload prepared (see console).";
  }

  function updateCurrentFrameComposite(frameId: string, nextLayers: LayerData[]) {
    const composite = compositeLayers(nextLayers, canvasSpec.width, canvasSpec.height);
    setFrames((prev) =>
      prev.map((frame) => (frame.id === frameId ? { ...frame, pixels: composite } : frame))
    );
  }

  function updateActiveLayerPixels(newPixels: Uint8ClampedArray) {
    if (!activeLayerId) return;
    const frameId = currentFrame.id;
    setFrameLayers((prev) => {
      const currentLayers = prev[frameId] || [];
      const nextLayers = currentLayers.map((layer) =>
        layer.id === activeLayerId ? { ...layer, pixels: newPixels } : layer
      );
      updateCurrentFrameComposite(frameId, nextLayers);
      return { ...prev, [frameId]: nextLayers };
    });
  }

  function rebuildFramesFromLayers(nextFrameLayers: Record<string, LayerData[]>) {
    setFrames((prev) =>
      prev.map((frame) => {
        const layersForFrame = nextFrameLayers[frame.id] || [];
        const composite = compositeLayers(layersForFrame, canvasSpec.width, canvasSpec.height);
        return { ...frame, pixels: composite };
      })
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
        pixels: compositeLayers(frame.layers, snapshot.canvas.width, snapshot.canvas.height),
        pivot: frame.pivot,
      }))
    );
    setFrameLayers(() =>
      snapshot.frames.reduce<Record<string, LayerData[]>>((acc, frame) => {
        acc[frame.id] = frame.layers;
        return acc;
      }, {})
    );
    const activeIds = { ...snapshot.activeLayerIds };
    snapshot.frames.forEach((frame) => {
      if (!activeIds[frame.id] && frame.layers[0]) {
        activeIds[frame.id] = frame.layers[0].id;
      }
    });
    setFrameActiveLayerIds(activeIds);
    setCurrentFrameIndex(
      Math.min(snapshot.currentFrameIndex, Math.max(snapshot.frames.length - 1, 0))
    );
    setPalettes(snapshot.palettes);
    setActivePaletteId(snapshot.activePaletteId);
    setRecentColors(snapshot.recentColors);
    if (snapshot.settings) {
      setSettings((prev) => ({ ...prev, ...snapshot.settings }));
    }
    historyRef.current = new HistoryStack();
    syncHistoryFlags();
    setSelection(null);
    setFloatingBuffer(null);
    setIsTransforming(false);
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
                  createLayer("Layer 1", createBuffer(64, 64, { r: 0, g: 0, b: 0, a: 0 })),
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
          fallbackSnapshot.activeLayerIds[frameId] = fallbackSnapshot.frames[0].layers[0].id;
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
                createLayer("Layer 1", createBuffer(64, 64, { r: 0, g: 0, b: 0, a: 0 })),
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
        fallbackSnapshot.activeLayerIds[frameId] = fallbackSnapshot.frames[0].layers[0].id;
        applySnapshot(fallbackSnapshot);
      }
      setActiveProject(project);
      setProjectView("editor");
      localStorage.setItem("spriteanvil:lastProjectId", project.id);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Failed to load project.");
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
                createBuffer(request.width, request.height, { r: 0, g: 0, b: 0, a: 0 })
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
      setProjectError(error instanceof Error ? error.message : "Failed to create project.");
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
    await autoSaveStateRef.current.cacheProjectSnapshot(currentProject.id, snapshot);
    const payload = autoSaveStateRef.current.serializeSnapshot(snapshot);
    await autoSaveStateRef.current.saveProjectSnapshot(currentProject.id, payload);
  }, []);

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
            const nextProjects = loadLocalProjects().filter((p) => p.id !== project.id);
            saveLocalProjects(nextProjects);
          }
          setProjects((prev) => prev.filter((p) => p.id !== project.id));
          if (activeProject?.id === project.id) {
            setActiveProject(null);
            setProjectView("dashboard");
          }
        } catch (error) {
          setProjectError(error instanceof Error ? error.message : "Failed to delete project.");
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  }

  function handleInsertFrame() {
    const newLayer = createLayer("Layer 1");
    const composite = compositeLayers([newLayer], canvasSpec.width, canvasSpec.height);
    const newFrame: Frame = {
      id: crypto.randomUUID(),
      pixels: composite,
      durationMs: 100,
      pivot: defaultPivot
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, newFrame);
      return updated;
    });
    setFrameLayers((prev) => ({ ...prev, [newFrame.id]: [newLayer] }));
    setFrameActiveLayerIds((prev) => ({ ...prev, [newFrame.id]: newLayer.id }));

    setCurrentFrameIndex(currentFrameIndex + 1);
  }

  function handleDuplicateFrame() {
    const currentLayers = frameLayers[currentFrame.id] || [];
    const duplicatedLayers = currentLayers.map((layer) => ({
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} copy`,
      pixels: layer.pixels ? cloneBuffer(layer.pixels) : createEmptyPixels(),
    }));
    const composite = compositeLayers(duplicatedLayers, canvasSpec.width, canvasSpec.height);
    const duplicate: Frame = {
      id: crypto.randomUUID(),
      pixels: composite,
      durationMs: currentFrame.durationMs,
      pivot: currentFrame.pivot ?? defaultPivot
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, duplicate);
      return updated;
    });
    setFrameLayers((prev) => ({ ...prev, [duplicate.id]: duplicatedLayers }));
    const activeIndex = currentLayers.findIndex((layer) => layer.id === activeLayerId);
    const nextActive = duplicatedLayers[Math.max(0, activeIndex)]?.id || duplicatedLayers[0]?.id || "";
    setFrameActiveLayerIds((prev) => ({
      ...prev,
      [duplicate.id]: nextActive,
    }));

    setCurrentFrameIndex(currentFrameIndex + 1);
  }

  function handleDeleteFrame() {
    if (frames.length <= 1) return;
    const frameId = currentFrame.id;
    const frameIndex = currentFrameIndex;

    setConfirmDialog({
      title: "Delete Frame",
      message: `Delete frame ${frameIndex + 1}? This cannot be undone.`,
      confirmLabel: "Delete Frame",
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          if (hasSupabaseConfig) {
            const ok = await deleteFrameRecord(frameId);
            if (!ok) {
              throw new Error("Failed to delete frame.");
            }
          }
          setFrames((prev) => prev.filter((_, i) => i !== frameIndex));
          setFrameLayers((prev) => {
            const { [frameId]: _, ...rest } = prev;
            return rest;
          });
          setFrameActiveLayerIds((prev) => {
            const { [frameId]: _, ...rest } = prev;
            return rest;
          });

          if (frameIndex >= frames.length - 1) {
            setCurrentFrameIndex(Math.max(0, frames.length - 2));
          }
        } catch (error) {
          console.error(error);
          setProjectError(error instanceof Error ? error.message : "Failed to delete frame.");
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  }

  function handleSelectFrame(index: number) {
    if (isPlaying) setIsPlaying(false);
    setCurrentFrameIndex(index);
  }

  function handleUpdateFrameDuration(index: number, durationMs: number) {
    setFrames((prev) =>
      prev.map((f, i) => (i === index ? { ...f, durationMs } : f))
    );
  }

  function handleTogglePlayback() {
    setIsPlaying(!isPlaying);
  }

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

  function handleCreateLayer() {
    if (!currentFrame) return;
    const newLayer = createLayer(`Layer ${layers.length + 1}`);
    const frameId = currentFrame.id;
    const nextLayers = [newLayer, ...layers];
    setFrameLayers((prev) => ({ ...prev, [frameId]: nextLayers }));
    setFrameActiveLayerIds((prev) => ({ ...prev, [frameId]: newLayer.id }));
    updateCurrentFrameComposite(frameId, nextLayers);
  }

  function handleDeleteLayer(id: string) {
    if (layers.length === 1) return;
    const frameId = currentFrame.id;
    const nextLayers = layers.filter((layer) => layer.id !== id);
    setFrameLayers((prev) => ({ ...prev, [frameId]: nextLayers }));
    if (activeLayerId === id) {
      const nextActive = nextLayers[0]?.id || null;
      setFrameActiveLayerIds((prev) => ({ ...prev, [frameId]: nextActive || "" }));
    }
    updateCurrentFrameComposite(frameId, nextLayers);
  }

  function handleDuplicateLayer(id: string) {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const newLayer: LayerData = {
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} copy`,
      pixels: layer.pixels ? cloneBuffer(layer.pixels) : createEmptyPixels(),
    };
    const index = layers.findIndex((l) => l.id === id);
    const nextLayers = [...layers];
    nextLayers.splice(index, 0, newLayer);
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
    updateCurrentFrameComposite(currentFrame.id, nextLayers);
  }

  function handleToggleLayerVisibility(id: string) {
    const nextLayers = layers.map((layer) =>
      layer.id === id ? { ...layer, is_visible: !layer.is_visible } : layer
    );
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
    updateCurrentFrameComposite(currentFrame.id, nextLayers);
  }

  function handleToggleLayerLock(id: string) {
    const nextLayers = layers.map((layer) =>
      layer.id === id ? { ...layer, is_locked: !layer.is_locked } : layer
    );
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
  }

  function handleUpdateLayerOpacity(id: string, opacity: number) {
    const nextLayers = layers.map((layer) =>
      layer.id === id ? { ...layer, opacity } : layer
    );
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
    updateCurrentFrameComposite(currentFrame.id, nextLayers);
  }

  function handleUpdateLayerBlendMode(id: string, blend_mode: BlendMode) {
    const nextLayers = layers.map((layer) =>
      layer.id === id ? { ...layer, blend_mode } : layer
    );
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
    updateCurrentFrameComposite(currentFrame.id, nextLayers);
  }

  function handleRenameLayer(id: string, name: string) {
    const nextLayers = layers.map((layer) =>
      layer.id === id ? { ...layer, name } : layer
    );
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
  }

  function handleReorderLayers(fromIndex: number, toIndex: number) {
    const updated = [...layers];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: updated }));
    updateCurrentFrameComposite(currentFrame.id, updated);
  }

  function handleMergeDown(id: string) {
    const index = layers.findIndex((l) => l.id === id);
    const updated = mergeDown(layers, index, canvasSpec.width, canvasSpec.height);
    if (updated === layers) return;
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: updated }));
    updateCurrentFrameComposite(currentFrame.id, updated);
  }

  function handleFlattenLayers() {
    if (!layers.length) return;
    const flattenedPixels = flattenImage(layers, canvasSpec.width, canvasSpec.height);
    const baseLayer: LayerData = {
      id: crypto.randomUUID(),
      name: "Flattened Layer",
      opacity: 1,
      blend_mode: "normal",
      is_visible: true,
      is_locked: false,
      pixels: flattenedPixels,
    };
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: [baseLayer] }));
    setFrameActiveLayerIds((prev) => ({ ...prev, [currentFrame.id]: baseLayer.id }));
    updateCurrentFrameComposite(currentFrame.id, [baseLayer]);
  }

  function handleCreatePalette(name: string, colors: string[]) {
    const newPalette: PaletteData = {
      id: `palette-${Date.now()}`,
      name,
      colors,
      is_default: false,
    };
    setPalettes((prev) => [newPalette, ...prev]);
    setActivePaletteId(newPalette.id);
  }

  async function handleImportPalette(file: File) {
    try {
      const { name, colors } = await importPaletteFile(file);
      if (colors.length === 0) return;
      handleCreatePalette(name, colors);
    } catch (error) {
      console.error("Palette import failed:", error);
    }
  }

  function handleExportPalette(format: "gpl" | "ase") {
    const palette = palettes.find((p) => p.id === activePaletteId);
    if (!palette) return;
    const blob = exportPaletteFile(palette.name, palette.colors, format);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${palette.name}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleExtractPaletteFromImage() {
    const colors = extractPaletteFromPixels(
      compositeBuffer,
      canvasSpec.width,
      canvasSpec.height
    );
    if (colors.length === 0) return;
    const newPalette: PaletteData = {
      id: `palette-${Date.now()}`,
      name: `Extracted ${new Date().toLocaleTimeString()}`,
      colors,
      is_default: false,
    };
    setPalettes((prev) => [newPalette, ...prev]);
    setActivePaletteId(newPalette.id);
  }

  function handleGeneratePaletteRamp(steps: number) {
    const ramp = buildPaletteRamp(settings.primaryColor, settings.secondaryColor || "#000000", steps);
    if (ramp.length === 0) return;
    if (!activePaletteId) return;
    setPalettes((prev) =>
      prev.map((palette) =>
        palette.id === activePaletteId
          ? { ...palette, colors: [...palette.colors, ...ramp] }
          : palette
      )
    );
  }

  function handleDeletePalette(id: string) {
    setPalettes((prev) => prev.filter((p) => p.id !== id));
    if (activePaletteId === id) {
      setActivePaletteId(palettes.find((p) => p.id !== id)?.id || "default");
    }
  }

  function handleAddColorToPalette(paletteId: string, color: string) {
    setPalettes((prev) =>
      prev.map((p) =>
        p.id === paletteId ? { ...p, colors: [...p.colors, color] } : p
      )
    );
  }

  function handleRemoveColorFromPalette(paletteId: string, colorIndex: number) {
    setPalettes((prev) =>
      prev.map((p) =>
        p.id === paletteId
          ? { ...p, colors: p.colors.filter((_, i) => i !== colorIndex) }
          : p
      )
    );
  }

  function handleSwapColors(fromColor: string, toColor: string) {
    if (isActiveLayerLocked) return;
    const from = hexToRgb(fromColor);
    const to = hexToRgb(toColor);
    if (!from || !to) return;

    historyRef.current.commitLayers(frameLayers);
    const next: Record<string, LayerData[]> = {};
    Object.entries(frameLayers).forEach(([frameId, layers]) => {
      next[frameId] = layers.map((layer) => {
        if (!layer.pixels) return layer;
        const updated = new Uint8ClampedArray(layer.pixels);
        for (let i = 0; i < updated.length; i += 4) {
          if (
            updated[i] === from.r &&
            updated[i + 1] === from.g &&
            updated[i + 2] === from.b
          ) {
            updated[i] = to.r;
            updated[i + 1] = to.g;
            updated[i + 2] = to.b;
          }
        }
        return { ...layer, pixels: updated };
      });
    });
    setFrameLayers(next);
    rebuildFramesFromLayers(next);
    syncHistoryFlags();
  }

  function handleCreateAnimationTag(tag: Omit<AnimationTag, "id" | "created_at">) {
    const newTag: AnimationTag = {
      ...tag,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    setAnimationTags((prev) => [...prev, newTag].sort((a, b) => a.start_frame - b.start_frame));
    setActiveAnimationTagId(newTag.id);
  }

  function handleUpdateAnimationTag(tagId: string, updates: Partial<AnimationTag>) {
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
        .sort((a, b) => a.start_frame - b.start_frame)
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
    height: number
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

  function buildSelectionMaskFromFloating(floating: FloatingSelection): Uint8Array | null {
    const mask = new Uint8Array(canvasSpec.width * canvasSpec.height);
    const floatingMask = buildSelectionMaskFromBuffer(
      floating.pixels,
      floating.width,
      floating.height
    );

    for (let y = 0; y < floating.height; y++) {
      for (let x = 0; x < floating.width; x++) {
        const maskIdx = y * floating.width + x;
        if (!floatingMask[maskIdx]) continue;
        const canvasX = floating.x + x;
        const canvasY = floating.y + y;
        if (
          canvasX < 0 ||
          canvasY < 0 ||
          canvasX >= canvasSpec.width ||
          canvasY >= canvasSpec.height
        ) {
          continue;
        }
        mask[canvasY * canvasSpec.width + canvasX] = 1;
      }
    }

    const hasSelection = mask.some((value) => value !== 0);
    return hasSelection ? mask : null;
  }

  function beginSelectionTransform(): FloatingSelection | null {
    if (isActiveLayerLocked) return null;
    if (floatingBuffer) {
      if (!isTransforming) setIsTransforming(true);
      return floatingBuffer;
    }
    if (!selection) return null;

    const { floating, cleared } = liftSelection(
      buffer,
      selection,
      canvasSpec.width,
      canvasSpec.height
    );
    if (!floating) return null;

    transformBeforeRef.current = cloneBuffer(buffer);
    updateActiveLayerPixels(cleared);
    setFloatingBuffer(floating);
    setIsTransforming(true);
    setSelection(buildSelectionMaskFromFloating(floating));
    return floating;
  }

  function updateFloating(next: FloatingSelection) {
    setFloatingBuffer(next);
    setIsTransforming(true);
    setSelection(buildSelectionMaskFromFloating(next));
  }

  function commitTransform() {
    if (!floatingBuffer) return;
    if (!transformBeforeRef.current) return;

    const pasted = pasteClipboard(
      buffer,
      {
        pixels: floatingBuffer.pixels,
        width: floatingBuffer.width,
        height: floatingBuffer.height,
      },
      canvasSpec.width,
      canvasSpec.height,
      floatingBuffer.x,
      floatingBuffer.y
    );
    const newSelection = buildSelectionMaskFromFloating(floatingBuffer);
    historyRef.current.commit(transformBeforeRef.current);
    updateActiveLayerPixels(pasted);
    setFloatingBuffer(null);
    setIsTransforming(false);
    setSelection(newSelection);
    transformBeforeRef.current = null;
    syncHistoryFlags();
  }

  function applyFloatingTransform(buildMatrix: (width: number, height: number) => TransformMatrix): boolean {
    const floating = beginSelectionTransform();
    if (!floating) return false;

    const matrix = buildMatrix(floating.width, floating.height);
    const next = applyTransform(floating, matrix, "nearest");
    updateFloating(next);
    return true;
  }

  function handleFlipHorizontal() {
    if (isActiveLayerLocked) return;
    if (applyFloatingTransform((width) => ({
      a: -1,
      b: 0,
      c: 0,
      d: 1,
      e: width - 1,
      f: 0,
    }))) return;
    const before = cloneBuffer(buffer);
    const after = flipHorizontal(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleFlipVertical() {
    if (isActiveLayerLocked) return;
    if (applyFloatingTransform((_width, height) => ({
      a: 1,
      b: 0,
      c: 0,
      d: -1,
      e: 0,
      f: height - 1,
    }))) return;
    const before = cloneBuffer(buffer);
    const after = flipVertical(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleRotate90CW() {
    if (isActiveLayerLocked) return;
    if (applyFloatingTransform((_width, height) => ({
      a: 0,
      b: 1,
      c: -1,
      d: 0,
      e: height - 1,
      f: 0,
    }))) return;
    const before = cloneBuffer(buffer);
    const result = rotate90CW(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }

  function handleRotate90CCW() {
    if (isActiveLayerLocked) return;
    if (applyFloatingTransform((width) => ({
      a: 0,
      b: -1,
      c: 1,
      d: 0,
      e: 0,
      f: width - 1,
    }))) return;
    const before = cloneBuffer(buffer);
    const result = rotate90CCW(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }

  function handleRotate180() {
    if (isActiveLayerLocked) return;
    if (applyFloatingTransform((width, height) => ({
      a: -1,
      b: 0,
      c: 0,
      d: -1,
      e: width - 1,
      f: height - 1,
    }))) return;
    const before = cloneBuffer(buffer);
    const after = rotate180(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleScale(scaleX: number, scaleY: number) {
    if (isActiveLayerLocked) return;
    if (scaleX <= 0 || scaleY <= 0) return;
    if (applyFloatingTransform(() => ({
      a: scaleX,
      b: 0,
      c: 0,
      d: scaleY,
      e: 0,
      f: 0,
    }))) return;
    const before = cloneBuffer(buffer);
    const result = scaleNearest(buffer, canvasSpec.width, canvasSpec.height, scaleX, scaleY);
    historyRef.current.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }

  function handleRotateDegrees(degrees: number) {
    if (isActiveLayerLocked) return;
    const snapped = Math.round(degrees / 90) * 90;
    const normalized = ((snapped % 360) + 360) % 360;
    if (normalized === 0) return;
    if (normalized === 90) {
      handleRotate90CW();
      return;
    }
    if (normalized === 180) {
      handleRotate180();
      return;
    }
    if (normalized === 270) {
      handleRotate90CCW();
      return;
    }
  }

  function handleAdjustHue(hueShift: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustHue(buffer, canvasSpec.width, canvasSpec.height, hueShift);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, hueShift: 0 }));
  }

  function handleAdjustSaturation(saturationDelta: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustSaturation(buffer, canvasSpec.width, canvasSpec.height, saturationDelta);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, saturationDelta: 0 }));
  }

  function handleAdjustBrightness(brightnessDelta: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustBrightness(buffer, canvasSpec.width, canvasSpec.height, brightnessDelta);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, brightnessDelta: 0 }));
  }

  function handlePreviewAdjustColor(preview: {
    hueShift: number;
    saturationDelta: number;
    brightnessDelta: number;
  }) {
    setColorAdjustPreview(preview);
  }

  function handleClearAdjustPreview() {
    setColorAdjustPreview({ hueShift: 0, saturationDelta: 0, brightnessDelta: 0 });
  }

  function handleInvert() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = invertColors(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({ hueShift: 0, saturationDelta: 0, brightnessDelta: 0 });
  }

  function handleDesaturate() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = desaturate(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({ hueShift: 0, saturationDelta: 0, brightnessDelta: 0 });
  }

  function handlePosterize(levels: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = posterize(buffer, canvasSpec.width, canvasSpec.height, levels);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({ hueShift: 0, saturationDelta: 0, brightnessDelta: 0 });
  }

  function handleSmartOutline(mode: OutlineMode) {
    if (isActiveLayerLocked) return;
    const rgb = hexToRgb(settings.primaryColor);
    if (!rgb) return;
    const outlineColor = { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 };
    const before = cloneBuffer(buffer);
    const after = applySmartOutline(buffer, canvasSpec.width, canvasSpec.height, outlineColor, mode);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleGenerateTweens(
    startIndex: number,
    endIndex: number,
    count: number,
    easing: EasingCurve
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
      defaultPivot
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
          easing
        );
      });

      newFrames.forEach((frame, tweenIndex) => {
        const layersForFrame = startLayers.map((layer, layerIndex) => ({
          ...layer,
          id: crypto.randomUUID(),
          name: layer.name,
          pixels: layerBuffers[layerIndex]?.[tweenIndex] ?? createEmptyPixels(),
        }));
        frame.pixels = compositeLayers(layersForFrame, canvasSpec.width, canvasSpec.height);
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

  const commands: Command[] = useMemo(() => [
    { id: "undo", name: "Undo", shortcut: "Cmd+Z", category: "Edit", action: handleUndo, keywords: ["history"] },
    { id: "redo", name: "Redo", shortcut: "Cmd+Y", category: "Edit", action: handleRedo, keywords: ["history"] },
    { id: "copy", name: "Copy", shortcut: "Cmd+C", category: "Edit", action: handleCopy },
    { id: "cut", name: "Cut", shortcut: "Cmd+X", category: "Edit", action: handleCut },
    { id: "paste", name: "Paste", shortcut: "Cmd+V", category: "Edit", action: handlePaste },
    { id: "selectAll", name: "Select All", shortcut: "Cmd+A", category: "Edit", action: handleSelectAll },
    { id: "deselect", name: "Deselect", shortcut: "Cmd+D", category: "Edit", action: handleDeselect },
    { id: "newFrame", name: "New Frame", category: "Animation", action: handleInsertFrame },
    { id: "duplicateFrame", name: "Duplicate Frame", category: "Animation", action: handleDuplicateFrame },
    { id: "deleteFrame", name: "Delete Frame", category: "Animation", action: handleDeleteFrame },
    { id: "playPause", name: "Play/Pause", shortcut: "Space", category: "Animation", action: handleTogglePlayback },
    { id: "export", name: "Export", shortcut: "Cmd+E", category: "File", action: () => setShowExportPanel(true) },
    { id: "saveProject", name: "Save Project Snapshot", shortcut: "Cmd+S", category: "File", action: handleAutoSave, keywords: ["autosave", "cloud"] },
    { id: "openDashboard", name: "Project Dashboard", category: "File", action: () => setProjectView("dashboard"), keywords: ["projects"] },
    { id: "importPalette", name: "Import Palette", category: "Palette", action: () => paletteImportRef.current?.click() },
    { id: "exportPaletteGpl", name: "Export Palette (GPL)", category: "Palette", action: () => handleExportPalette("gpl") },
    { id: "exportPaletteAse", name: "Export Palette (ASE)", category: "Palette", action: () => handleExportPalette("ase") },
    { id: "paletteRamp", name: "Generate Palette Ramp", category: "Palette", action: () => handleGeneratePaletteRamp(6) },
    { id: "colorSwap", name: "Swap Primary/Secondary", category: "Palette", action: () => handleSwapColors(settings.primaryColor, settings.secondaryColor || "#000000") },
    { id: "shortcuts", name: "Show Shortcuts", shortcut: "Cmd+/", category: "Help", action: () => setShowShortcutOverlay(true) },
    { id: "flipH", name: "Flip Horizontal", shortcut: "Cmd+H", category: "Transform", action: handleFlipHorizontal },
    { id: "flipV", name: "Flip Vertical", shortcut: "Cmd+Shift+H", category: "Transform", action: handleFlipVertical },
    { id: "rotate90CW", name: "Rotate 90° CW", shortcut: "Cmd+R", category: "Transform", action: handleRotate90CW },
    { id: "rotate90CCW", name: "Rotate 90° CCW", shortcut: "Cmd+Shift+R", category: "Transform", action: handleRotate90CCW },
    { id: "rotate180", name: "Rotate 180°", category: "Transform", action: handleRotate180 },
    { id: "invert", name: "Invert Colors", category: "Color", action: handleInvert },
    { id: "desaturate", name: "Desaturate", category: "Color", action: handleDesaturate },
    { id: "newLayer", name: "New Layer", category: "Layer", action: handleCreateLayer },
    { id: "toolPen", name: "Pen Tool", shortcut: "B", category: "Tools", action: () => handleChangeTool("pen") },
    { id: "toolSmudge", name: "Smudge Tool", shortcut: "S", category: "Tools", action: () => handleChangeTool("smudge") },
    { id: "toolEraser", name: "Eraser Tool", shortcut: "E", category: "Tools", action: () => handleChangeTool("eraser") },
    { id: "toolFill", name: "Fill Tool", shortcut: "F", category: "Tools", action: () => handleChangeTool("fill") },
    { id: "toolEyedropper", name: "Eyedropper Tool", shortcut: "I", category: "Tools", action: () => handleChangeTool("eyedropper") },
  ], [
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
    handleFlipHorizontal,
    handleFlipVertical,
    handleRotate90CW,
    handleRotate90CCW,
    handleRotate180,
    handleInvert,
    handleDesaturate,
    handleCreateLayer,
    handleChangeTool,
    settings.primaryColor,
    settings.secondaryColor,
  ]);

  useKeyboardShortcuts({
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
    onZoomIn: () => setSettings((s) => ({ ...s, zoom: Math.min(32, s.zoom + 1) })),
    onZoomOut: () => setSettings((s) => ({ ...s, zoom: Math.max(1, s.zoom - 1) })),
    onZoomReset: () => setSettings((s) => ({ ...s, zoom: 8 })),
    onToggleGrid: () => setSettings((s) => ({ ...s, showGrid: !s.showGrid })),
    onToggleOnionSkin: () => setSettings((s) => ({ ...s, showOnionSkin: !s.showOnionSkin })),
    onFlipHorizontal: handleFlipHorizontal,
    onFlipVertical: handleFlipVertical,
    onRotate90CW: handleRotate90CW,
    onRotate90CCW: handleRotate90CCW,
    onOpenCommandPalette: () => setShowCommandPalette(true),
    onToggleShortcutOverlay: () => setShowShortcutOverlay((prev) => !prev),
    onNewFrame: handleInsertFrame,
    onDuplicateFrame: handleDuplicateFrame,
    onDeleteFrame: handleDeleteFrame,
    onNextFrame: () => setCurrentFrameIndex((i) => Math.min(frames.length - 1, i + 1)),
    onPrevFrame: () => setCurrentFrameIndex((i) => Math.max(0, i - 1)),
    onPlayPause: handleTogglePlayback,
  }, projectView === "editor" && !showCommandPalette && !showShortcutOverlay);

  function handleChangeSelection(next: Uint8Array | null) {
    if (isTransforming) {
      commitTransform();
    }
    setSelection(next);
  }

  function handleChangeTool(nextTool: ToolId) {
    if (isTransforming) {
      commitTransform();
    }
    setTool(nextTool);
  }

  useEffect(() => {
    function isInputFocused(): boolean {
      const active = document.activeElement;
      return active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || (active?.hasAttribute("contenteditable") ?? false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter" && isTransforming && !isInputFocused()) {
        e.preventDefault();
        commitTransform();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTransforming]);

  return (
    <>
      {projectView === "dashboard" ? (
        <ProjectDashboard
          projects={projects}
          onSelect={handleSelectProject}
          onCreate={handleCreateProject}
          onDelete={handleDeleteProject}
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
          onChangeSelection={handleChangeSelection}
          floatingBuffer={floatingBuffer}
          onBeginTransform={beginSelectionTransform}
          onUpdateTransform={updateFloating}
          onColorPick={handleSelectColor}
          selectionMask={selection}
          layerPixels={activeLayer?.pixels ?? null}
          onInpaint={handleInpaintRequest}
          onImageToImage={handleImageToImageRequest}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          isPlaying={isPlaying}
          onSelectFrame={handleSelectFrame}
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
              setFrameActiveLayerIds((prev) => ({ ...prev, [currentFrame.id]: id })),
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
          onTransformOperations={{
            onFlipHorizontal: handleFlipHorizontal,
            onFlipVertical: handleFlipVertical,
            onRotate90CW: handleRotate90CW,
            onRotate90CCW: handleRotate90CCW,
            onRotate180: handleRotate180,
            onScale: handleScale,
            onRotate: handleRotateDegrees,
            onSmartOutline: handleSmartOutline,
          }}
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
          topBar={
            <div className="topbar">
              <div className="topbar__main">
                <div className="brand">
                  <div className="brand__name">SpriteAnvil</div>
                  <div className="brand__tagline">Forge sprites. Shape motion.</div>
                </div>

                <div className="topbar__group topbar__group--primary">
                  <button className="uiBtn" onClick={handleUndo} disabled={!canUndo} title="Undo (Cmd+Z)">
                    Undo
                  </button>
                  <button className="uiBtn" onClick={handleRedo} disabled={!canRedo} title="Redo (Cmd+Y)">
                    Redo
                  </button>
                </div>
              </div>

              <div className="topbar__groups">
                <div className="topbar__group">
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
                  <button
                    className="uiBtn uiBtn--primary"
                    onClick={() => setShowExportPanel(true)}
                    title="Export Sprite (Cmd+E)"
                  >
                    Export
                  </button>
                </div>

                <div className="topbar__group">
                  {activeCollaborators.length > 0 && (
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
                    <span>Zoom</span>
                    <input
                      className="zoom"
                      type="range"
                      min={1}
                      max={32}
                      step={0.25}
                      value={settings.zoom}
                      onChange={(e) => setSettings((s) => ({ ...s, zoom: Number(e.target.value) }))}
                    />
                    <span className="mono">{zoomLabel}</span>
                  </label>
                </div>

                <div className="topbar__group">
                  <label className="ui-row">
                    <span>Background</span>
                    <select
                      value={settings.backgroundMode}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, backgroundMode: e.target.value as any }))
                      }
                    >
                      <option value="checker">Checkerboard</option>
                      <option value="solidDark">Solid (Dark)</option>
                      <option value="solidLight">Solid (Light)</option>
                      <option value="greenscreen">Greenscreen</option>
                      <option value="bluescreen">Bluescreen</option>
                    </select>
                  </label>

                  <label className="ui-row">
                    <input
                      type="checkbox"
                      checked={settings.showGrid}
                      onChange={(e) => setSettings((s) => ({ ...s, showGrid: e.target.checked }))}
                    />
                    <span>Grid</span>
                  </label>
                </div>
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
                    <span>Quick Controls</span>
                    <button
                      className="uiBtn uiBtn--ghost"
                      onClick={() => setShowTopbarMenu(false)}
                      title="Close menu"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="topbar__menu-body">
                    <div className="topbar__group">
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
                      <button
                        className="uiBtn uiBtn--primary"
                        onClick={() => setShowExportPanel(true)}
                        title="Export Sprite (Cmd+E)"
                      >
                        Export
                      </button>
                    </div>

                    <div className="topbar__group">
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
                        <span>Zoom</span>
                        <input
                          className="zoom"
                          type="range"
                          min={1}
                          max={32}
                          step={0.25}
                          value={settings.zoom}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, zoom: Number(e.target.value) }))
                          }
                        />
                        <span className="mono">{zoomLabel}</span>
                      </label>
                    </div>

                    <div className="topbar__group">
                      <label className="ui-row">
                        <span>Background</span>
                        <select
                          value={settings.backgroundMode}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, backgroundMode: e.target.value as any }))
                          }
                        >
                          <option value="checker">Checkerboard</option>
                          <option value="solidDark">Solid (Dark)</option>
                          <option value="solidLight">Solid (Light)</option>
                          <option value="greenscreen">Greenscreen</option>
                          <option value="bluescreen">Bluescreen</option>
                        </select>
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
