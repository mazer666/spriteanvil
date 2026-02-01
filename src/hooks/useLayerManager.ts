/**
 * src/hooks/useLayerManager.ts
 * -----------------------------------------------------------------------------
 * ## THE LAYER MANAGER (Noob Guide)
 * 
 * Imagine your drawing as a **Stack of Transparent Plastic Sheets**.
 * Each sheet is a "Layer". You can draw on one sheet, and see through it to the ones below.
 * 
 * This hook handles:
 * - **Creating/Deleting** sheets (Layers).
 * - **Visibility**: Hiding a sheet so you can't see it for a moment.
 * - **Locking**: Protecting a sheet so you don't accidentally draw on it.
 * - **Merging**: Gluing two sheets together permanently.
 * - **Reordering**: Moving a sheet to the top or bottom of the stack.
 * 
 * ### 📑 Layer Composition (Mermaid)
 *
 * ```mermaid
 * graph TD
 *   L1[Layer 1 - Top] --> C[Composite Engine]
 *   L2[Layer 2] --> C
 *   L3[Layer 3 - Bottom] --> C
 *   C --> Final[Single Frame Image]
 * ```
 */
import { useCallback } from "react";
import { Frame, LayerData, CanvasSpec, BlendMode } from "../types";
import { cloneBuffer, createBuffer } from "../editor/pixels";
import { compositeLayers, mergeDown, flattenImage } from "../editor/layers";

// ============================================================================
// TYPES
// ============================================================================

export interface LayerState {
  currentFrame: Frame | undefined;
  layers: LayerData[];
  activeLayerId: string | null;
}

export interface LayerActions {
  setFrameLayers: React.Dispatch<React.SetStateAction<Record<string, LayerData[]>>>;
  setFrameActiveLayerIds: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFrames: React.Dispatch<React.SetStateAction<Frame[]>>;
}

export interface LayerConfig {
  canvasSpec: CanvasSpec;
}

export interface UseLayerManagerReturn {
  handleCreateLayer: () => void;
  handleDeleteLayer: (id: string) => void;
  handleDuplicateLayer: (id: string) => void;
  handleToggleLayerVisibility: (id: string) => void;
  handleToggleLayerLock: (id: string) => void;
  handleUpdateLayerOpacity: (id: string, opacity: number) => void;
  handleUpdateLayerBlendMode: (id: string, blend_mode: BlendMode) => void;
  handleRenameLayer: (id: string, name: string) => void;
  handleReorderLayers: (fromIndex: number, toIndex: number) => void;
  handleMergeDown: (id: string) => void;
  handleFlattenLayers: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function createLayer(
  name: string,
  width: number,
  height: number,
  pixels?: Uint8ClampedArray
): LayerData & { pixels: Uint8ClampedArray } {
  return {
    id: crypto.randomUUID(),
    name,
    opacity: 1,
    blend_mode: "normal" as BlendMode,
    is_visible: true,
    is_locked: false,
    pixels: pixels ?? createBuffer(width, height, { r: 0, g: 0, b: 0, a: 0 }),
  };
}

function createEmptyPixels(width: number, height: number): Uint8ClampedArray {
  return createBuffer(width, height, { r: 0, g: 0, b: 0, a: 0 });
}

// ============================================================================
// HOOK
// ============================================================================

export function useLayerManager(
  state: LayerState,
  actions: LayerActions,
  config: LayerConfig
): UseLayerManagerReturn {
  const { currentFrame, layers, activeLayerId } = state;
  const { setFrameLayers, setFrameActiveLayerIds, setFrames } = actions;
  const { canvasSpec } = config;

  // WHAT: Glues all the transparent sheets (layers) together into one image.
  // WHY: To show the final result on the canvas.
  // HOW: It looks at every layer from the bottom up and stacks the colors.
  const updateCurrentFrameComposite = useCallback(
    (frameId: string, nextLayers: LayerData[]) => {
      setFrames((prev) =>
        prev.map((frame) =>
          frame.id === frameId
            ? { ...frame, pixels: compositeLayers(nextLayers, canvasSpec.width, canvasSpec.height) }
            : frame
        )
      );
    },
    [canvasSpec.height, canvasSpec.width, setFrames]
  );

  // WHAT: Adds a new blank transparent sheet to the stack.
  // WHY: So you can draw different parts of your art (like "Background" and "Character") separately.
  const handleCreateLayer = useCallback(() => {
    if (!currentFrame) return;
    const newLayer = createLayer(`Layer ${layers.length + 1}`, canvasSpec.width, canvasSpec.height);
    const frameId = currentFrame.id;
    const nextLayers = [newLayer, ...layers];
    setFrameLayers((prev) => ({ ...prev, [frameId]: nextLayers }));
    setFrameActiveLayerIds((prev) => ({ ...prev, [frameId]: newLayer.id }));
    updateCurrentFrameComposite(frameId, nextLayers);
  }, [currentFrame, layers, canvasSpec, setFrameLayers, setFrameActiveLayerIds, updateCurrentFrameComposite]);

  // WHAT: Removes a sheet from the stack.
  // WHY: If you don't need that part of your drawing anymore.
  const handleDeleteLayer = useCallback(
    (id: string) => {
      if (layers.length === 1 || !currentFrame) return;
      const frameId = currentFrame.id;
      const nextLayers = layers.filter((layer) => layer.id !== id);
      setFrameLayers((prev) => ({ ...prev, [frameId]: nextLayers }));
      if (activeLayerId === id) {
        const nextActive = nextLayers[0]?.id || null;
        setFrameActiveLayerIds((prev) => ({ ...prev, [frameId]: nextActive || "" }));
      }
      updateCurrentFrameComposite(frameId, nextLayers);
    },
    [layers, currentFrame, activeLayerId, setFrameLayers, setFrameActiveLayerIds, updateCurrentFrameComposite]
  );

  const handleDuplicateLayer = useCallback(
    (id: string) => {
      if (!currentFrame) return;
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      const newLayer: LayerData = {
        ...layer,
        id: crypto.randomUUID(),
        name: `${layer.name} copy`,
        pixels: layer.pixels ? cloneBuffer(layer.pixels) : createEmptyPixels(canvasSpec.width, canvasSpec.height),
      };
      const index = layers.findIndex((l) => l.id === id);
      const nextLayers = [...layers];
      nextLayers.splice(index, 0, newLayer);
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
      updateCurrentFrameComposite(currentFrame.id, nextLayers);
    },
    [currentFrame, layers, canvasSpec, setFrameLayers, updateCurrentFrameComposite]
  );

  const handleToggleLayerVisibility = useCallback(
    (id: string) => {
      if (!currentFrame) return;
      const nextLayers = layers.map((layer) =>
        layer.id === id ? { ...layer, is_visible: !layer.is_visible } : layer
      );
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
      updateCurrentFrameComposite(currentFrame.id, nextLayers);
    },
    [currentFrame, layers, setFrameLayers, updateCurrentFrameComposite]
  );

  const handleToggleLayerLock = useCallback(
    (id: string) => {
      if (!currentFrame) return;
      const nextLayers = layers.map((layer) =>
        layer.id === id ? { ...layer, is_locked: !layer.is_locked } : layer
      );
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
    },
    [currentFrame, layers, setFrameLayers]
  );

  const handleUpdateLayerOpacity = useCallback(
    (id: string, opacity: number) => {
      if (!currentFrame) return;
      const nextLayers = layers.map((layer) =>
        layer.id === id ? { ...layer, opacity } : layer
      );
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
      updateCurrentFrameComposite(currentFrame.id, nextLayers);
    },
    [currentFrame, layers, setFrameLayers, updateCurrentFrameComposite]
  );

  const handleUpdateLayerBlendMode = useCallback(
    (id: string, blend_mode: BlendMode) => {
      if (!currentFrame) return;
      const nextLayers = layers.map((layer) =>
        layer.id === id ? { ...layer, blend_mode } : layer
      );
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
      updateCurrentFrameComposite(currentFrame.id, nextLayers);
    },
    [currentFrame, layers, setFrameLayers, updateCurrentFrameComposite]
  );

  const handleRenameLayer = useCallback(
    (id: string, name: string) => {
      if (!currentFrame) return;
      const nextLayers = layers.map((layer) =>
        layer.id === id ? { ...layer, name } : layer
      );
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: nextLayers }));
    },
    [currentFrame, layers, setFrameLayers]
  );

  const handleReorderLayers = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!currentFrame) return;
      const updated = [...layers];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: updated }));
      updateCurrentFrameComposite(currentFrame.id, updated);
    },
    [currentFrame, layers, setFrameLayers, updateCurrentFrameComposite]
  );

  // WHAT: Glues a layer into the one directly below it.
  // WHY: To simplify your stack once you're happy with two layers.
  const handleMergeDown = useCallback(
    (id: string) => {
      if (!currentFrame) return;
      const index = layers.findIndex((l) => l.id === id);
      const updated = mergeDown(layers, index, canvasSpec.width, canvasSpec.height);
      if (updated === layers) return;
      setFrameLayers((prev) => ({ ...prev, [currentFrame.id]: updated }));
      updateCurrentFrameComposite(currentFrame.id, updated);
    },
    [currentFrame, layers, canvasSpec, setFrameLayers, updateCurrentFrameComposite]
  );

  const handleFlattenLayers = useCallback(() => {
    if (!currentFrame || !layers.length) return;
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
  }, [currentFrame, layers, canvasSpec, setFrameLayers, setFrameActiveLayerIds, updateCurrentFrameComposite]);

  return {
    handleCreateLayer,
    handleDeleteLayer,
    handleDuplicateLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleUpdateLayerOpacity,
    handleUpdateLayerBlendMode,
    handleRenameLayer,
    handleReorderLayers,
    handleMergeDown,
    handleFlattenLayers,
  };
}

export default useLayerManager;
