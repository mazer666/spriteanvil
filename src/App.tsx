import React, { useEffect, useMemo, useRef, useState } from "react";
import DockLayout from "./ui/DockLayout";
import ExportPanel from "./ui/ExportPanel";
import CommandPalette, { Command } from "./ui/CommandPalette";
import { CanvasSpec, ToolId, UiSettings, Frame, LayerData, BlendMode } from "./types";
import { HistoryStack } from "./editor/history";
import { cloneBuffer, createBuffer } from "./editor/pixels";
import { copySelection, cutSelection, pasteClipboard, ClipboardData } from "./editor/clipboard";
import { compositeLayers, mergeLayerIntoBelow } from "./editor/layers";
import { PaletteData } from "./ui/PalettePanel";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  flipHorizontal,
  flipVertical,
  rotate90CW,
  rotate90CCW,
  rotate180,
  scaleNearest,
} from "./editor/tools/transform";
import {
  adjustHue,
  adjustSaturation,
  adjustBrightness,
  invertColors,
  desaturate,
  posterize,
} from "./editor/tools/coloradjust";
import {
  invertSelection,
  selectionIntersection,
  selectionSubtract,
  selectionUnion,
} from "./editor/selection";

export default function App() {
  const [canvasSpec] = useState<CanvasSpec>(() => ({ width: 64, height: 64 }));
  const [tool, setTool] = useState<ToolId>("pen");

  const initialFrameId = useMemo(() => crypto.randomUUID(), []);
  const createEmptyPixels = () =>
    createBuffer(canvasSpec.width, canvasSpec.height, { r: 0, g: 0, b: 0, a: 0 });

  const [frames, setFrames] = useState<Frame[]>(() => [
    {
      id: initialFrameId,
      pixels: createEmptyPixels(),
      durationMs: 100
    }
  ]);

  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [selection, setSelection] = useState<Uint8Array | null>(null);
  const previousSelectionRef = useRef<Uint8Array | null>(null);
  const clipboardRef = useRef<ClipboardData | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const playbackTimerRef = useRef<number | null>(null);

  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const historyRef = useRef<HistoryStack>(new HistoryStack());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const currentFrame = frames[currentFrameIndex];

  function createLayer(name: string, pixels?: Uint8ClampedArray): LayerData {
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
  const compositeBuffer = currentFrame.pixels;
  const isActiveLayerLocked = activeLayer?.is_locked ?? false;

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
    gradientType: "linear",
    ditheringType: "none",
    symmetryMode: "none",
    brushSize: 1,
    wandTolerance: 32,
  }));

  const zoomLabel = useMemo(() => `${Math.round(settings.zoom * 100)}%`, [settings.zoom]);

  function syncHistoryFlags() {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }

  useEffect(() => {
    if (!isPlaying) return;

    const advanceFrame = () => {
      setCurrentFrameIndex((prev) => {
        const next = (prev + 1) % frames.length;
        const nextDuration = frames[next].durationMs;
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
  }, [isPlaying, currentFrame.durationMs, frames.length]);

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

  function handleUndo() {
    const next = historyRef.current.undo(buffer);
    if (next !== buffer && activeLayerId) {
      updateActiveLayerPixels(next);
      syncHistoryFlags();
    }
  }

  function handleRedo() {
    const next = historyRef.current.redo(buffer);
    if (next !== buffer && activeLayerId) {
      updateActiveLayerPixels(next);
      syncHistoryFlags();
    }
  }

  function handleCopy() {
    if (!selection) return;
    const clip = copySelection(buffer, selection, canvasSpec.width, canvasSpec.height);
    if (clip) clipboardRef.current = clip;
  }

  function handleCut() {
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

  function handleBooleanUnion() {
    if (!selection || !previousSelectionRef.current) return;
    const merged = new Uint8Array(previousSelectionRef.current);
    selectionUnion(merged, selection);
    previousSelectionRef.current = null;
    handleChangeSelection(merged);
  }

  function handleBooleanSubtract() {
    if (!selection || !previousSelectionRef.current) return;
    const merged = new Uint8Array(previousSelectionRef.current);
    selectionSubtract(merged, selection);
    previousSelectionRef.current = null;
    handleChangeSelection(merged);
  }

  function handleBooleanIntersect() {
    if (!selection || !previousSelectionRef.current) return;
    const merged = new Uint8Array(previousSelectionRef.current);
    selectionIntersection(merged, selection);
    previousSelectionRef.current = null;
    handleChangeSelection(merged);
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

  function onStrokeEnd(before: Uint8ClampedArray, after: Uint8ClampedArray) {
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleInsertFrame() {
    const newFrame: Frame = {
      id: crypto.randomUUID(),
      pixels: createEmptyPixels(),
      durationMs: 100
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, newFrame);
      return updated;
    });
    const newLayer = createLayer("Layer 1");
    setFrameLayers((prev) => ({ ...prev, [newFrame.id]: [newLayer] }));
    setFrameActiveLayerIds((prev) => ({ ...prev, [newFrame.id]: newLayer.id }));

    setCurrentFrameIndex(currentFrameIndex + 1);
  }

  function handleDuplicateFrame() {
    const duplicate: Frame = {
      id: crypto.randomUUID(),
      pixels: cloneBuffer(currentFrame.pixels),
      durationMs: currentFrame.durationMs
    };

    setFrames((prev) => {
      const updated = [...prev];
      updated.splice(currentFrameIndex + 1, 0, duplicate);
      return updated;
    });
    const currentLayers = frameLayers[currentFrame.id] || [];
    const duplicatedLayers = currentLayers.map((layer) => ({
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} copy`,
      pixels: layer.pixels ? cloneBuffer(layer.pixels) : createEmptyPixels(),
    }));
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

    setFrames((prev) => prev.filter((_, i) => i !== currentFrameIndex));
    const frameId = currentFrame.id;
    setFrameLayers((prev) => {
      const { [frameId]: _, ...rest } = prev;
      return rest;
    });
    setFrameActiveLayerIds((prev) => {
      const { [frameId]: _, ...rest } = prev;
      return rest;
    });

    if (currentFrameIndex >= frames.length - 1) {
      setCurrentFrameIndex(Math.max(0, frames.length - 2));
    }
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
    if (index === layers.length - 1) return;
    const above = layers[index];
    const below = layers[index + 1];
    if (!above || !below) return;
    const mergedPixels = mergeLayerIntoBelow(
      below,
      above,
      canvasSpec.width,
      canvasSpec.height
    );
    const updated = [...layers];
    updated.splice(index, 1);
    updated[index] = { ...below, pixels: mergedPixels };
    setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: updated }));
    updateCurrentFrameComposite(currentFrame.id, updated);
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
    const before = cloneBuffer(buffer);
    // Implementation would replace all pixels of fromColor with toColor
    historyRef.current.commit(before);
    syncHistoryFlags();
  }

  function handleFlipHorizontal() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = flipHorizontal(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleFlipVertical() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = flipVertical(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleRotate90CW() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const result = rotate90CW(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }

  function handleRotate90CCW() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const result = rotate90CCW(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }

  function handleRotate180() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = rotate180(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleScale(scaleX: number, scaleY: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const result = scaleNearest(buffer, canvasSpec.width, canvasSpec.height, scaleX, scaleY);
    historyRef.current.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }

  function handleAdjustHue(hueShift: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustHue(buffer, canvasSpec.width, canvasSpec.height, hueShift);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleAdjustSaturation(saturationDelta: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustSaturation(buffer, canvasSpec.width, canvasSpec.height, saturationDelta);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleAdjustBrightness(brightnessDelta: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = adjustBrightness(buffer, canvasSpec.width, canvasSpec.height, brightnessDelta);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleInvert() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = invertColors(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handleDesaturate() {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = desaturate(buffer, canvasSpec.width, canvasSpec.height);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  function handlePosterize(levels: number) {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(buffer);
    const after = posterize(buffer, canvasSpec.width, canvasSpec.height, levels);
    historyRef.current.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }

  const commands: Command[] = useMemo(() => [
    { id: "undo", name: "Undo", shortcut: "Cmd+Z", category: "Edit", action: handleUndo },
    { id: "redo", name: "Redo", shortcut: "Cmd+Y", category: "Edit", action: handleRedo },
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
    { id: "flipH", name: "Flip Horizontal", shortcut: "Cmd+H", category: "Transform", action: handleFlipHorizontal },
    { id: "flipV", name: "Flip Vertical", shortcut: "Cmd+Shift+H", category: "Transform", action: handleFlipVertical },
    { id: "rotate90CW", name: "Rotate 90° CW", shortcut: "Cmd+R", category: "Transform", action: handleRotate90CW },
    { id: "rotate90CCW", name: "Rotate 90° CCW", shortcut: "Cmd+Shift+R", category: "Transform", action: handleRotate90CCW },
    { id: "rotate180", name: "Rotate 180°", category: "Transform", action: handleRotate180 },
    { id: "invert", name: "Invert Colors", category: "Color", action: handleInvert },
    { id: "desaturate", name: "Desaturate", category: "Color", action: handleDesaturate },
    { id: "newLayer", name: "New Layer", category: "Layer", action: handleCreateLayer },
    { id: "toolPen", name: "Pen Tool", shortcut: "B", category: "Tools", action: () => setTool("pen") },
    { id: "toolEraser", name: "Eraser Tool", shortcut: "E", category: "Tools", action: () => setTool("eraser") },
    { id: "toolFill", name: "Fill Tool", shortcut: "F", category: "Tools", action: () => setTool("fill") },
    { id: "toolEyedropper", name: "Eyedropper Tool", shortcut: "I", category: "Tools", action: () => setTool("eyedropper") },
  ], []);

  useKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onDelete: handleDeselect,
    onSelectAll: handleSelectAll,
    onDeselect: handleDeselect,
    onChangeTool: setTool,
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
    onNewFrame: handleInsertFrame,
    onDuplicateFrame: handleDuplicateFrame,
    onDeleteFrame: handleDeleteFrame,
    onNextFrame: () => setCurrentFrameIndex((i) => Math.min(frames.length - 1, i + 1)),
    onPrevFrame: () => setCurrentFrameIndex((i) => Math.max(0, i - 1)),
    onPlayPause: handleTogglePlayback,
  }, !showCommandPalette);

  function handleChangeSelection(next: Uint8Array | null) {
    previousSelectionRef.current = selection ? new Uint8Array(selection) : null;
    setSelection(next);
  }

  return (
    <>
      <DockLayout
        settings={settings}
        onChangeSettings={setSettings}
        tool={tool}
        onChangeTool={setTool}
        canvasSpec={canvasSpec}
        buffer={buffer}
        compositeBuffer={compositeBuffer}
        onStrokeEnd={onStrokeEnd}
        selection={selection}
        onChangeSelection={handleChangeSelection}
        onColorPick={handleSelectColor}
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
        }}
        onTransformOperations={{
          onFlipHorizontal: handleFlipHorizontal,
          onFlipVertical: handleFlipVertical,
          onRotate90CW: handleRotate90CW,
          onRotate90CCW: handleRotate90CCW,
          onRotate180: handleRotate180,
          onScale: handleScale,
        }}
        onColorAdjustOperations={{
          onAdjustHue: handleAdjustHue,
          onAdjustSaturation: handleAdjustSaturation,
          onAdjustBrightness: handleAdjustBrightness,
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
          onBooleanUnion: handleBooleanUnion,
          onBooleanSubtract: handleBooleanSubtract,
          onBooleanIntersect: handleBooleanIntersect,
        }}
        topBar={
          <div className="topbar">
            <div className="brand">
              <div className="brand__name">SpriteAnvil</div>
              <div className="brand__tagline">Forge sprites. Shape motion.</div>
            </div>

            <div className="topbar__group">
              <button className="uiBtn" onClick={handleUndo} disabled={!canUndo} title="Undo (Cmd+Z)">
                Undo
              </button>
              <button className="uiBtn" onClick={handleRedo} disabled={!canRedo} title="Redo (Cmd+Y)">
                Redo
              </button>
            </div>

            <div className="topbar__group">
              <button
                className="uiBtn"
                onClick={() => setShowCommandPalette(true)}
                title="Command Palette (Cmd+K)"
              >
                Commands
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
        }
      />

      {showExportPanel && (
        <ExportPanel
          frames={frames}
          canvasSpec={canvasSpec}
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
    </>
  );
}

function toHexFallback(_cssColor: string, fallbackHex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(_cssColor)) return _cssColor;
  return fallbackHex;
}
