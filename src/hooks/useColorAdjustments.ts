import { useState, useMemo, useCallback } from "react";
import { CanvasSpec, LayerData } from "../types";
import { HistoryStack } from "../editor/history";
import {
  adjustHue,
  adjustSaturation,
  adjustBrightness,
  invertColors,
  desaturate,
  posterize,
} from "../editor/tools/coloradjust";
import { cloneBuffer } from "../editor/pixels";
import { compositeLayers } from "../editor/layers";

export interface ColorAdjustmentsConfig {
  canvasSpec: CanvasSpec;
  activeLayerPixels: Uint8ClampedArray;
  layers: LayerData[];
  activeLayerId: string | null;
  compositeBuffer: Uint8ClampedArray;
  updateActiveLayerPixels: (pixels: Uint8ClampedArray) => void;
  history: HistoryStack;
  syncHistoryFlags: () => void;
  isActiveLayerLocked: boolean;
}

export function useColorAdjustments({
  canvasSpec,
  activeLayerPixels,
  layers,
  activeLayerId,
  compositeBuffer,
  updateActiveLayerPixels,
  history,
  syncHistoryFlags,
  isActiveLayerLocked,
}: ColorAdjustmentsConfig) {
  const [colorAdjustPreview, setColorAdjustPreview] = useState({
    hueShift: 0,
    saturationDelta: 0,
    brightnessDelta: 0,
  });

  // Calculate the buffer with COLOR adjustments applied (for preview)
  const previewLayerPixels = useMemo(() => {
    if (
      colorAdjustPreview.hueShift === 0 &&
      colorAdjustPreview.saturationDelta === 0 &&
      colorAdjustPreview.brightnessDelta === 0
    ) {
      // If no adjustments, return null so we don't need to re-composite
      return null;
    }
    
    // Start with the current active layer
    let preview = activeLayerPixels;

    if (colorAdjustPreview.hueShift !== 0) {
      preview = adjustHue(
        preview,
        canvasSpec.width,
        canvasSpec.height,
        colorAdjustPreview.hueShift
      );
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
    activeLayerPixels,
    canvasSpec.height,
    canvasSpec.width,
    colorAdjustPreview.brightnessDelta,
    colorAdjustPreview.hueShift,
    colorAdjustPreview.saturationDelta,
  ]);

  // Composite the entire image using the preview layer (if active)
  const compositePreviewBuffer = useMemo(() => {
    // If no specific preview pixels, use the main composite buffer
    if (!previewLayerPixels) return compositeBuffer;
    
    // If no layers (weird state), just return the preview itself
    if (!layers.length) return previewLayerPixels;
    
    // Create a temporary list of layers where the active layer is replaced by the preview
    const previewLayers = layers.map((layer) =>
      layer.id === activeLayerId
        ? { ...layer, pixels: previewLayerPixels }
        : layer
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

  // --- Handlers (Commit Adjustments) ---

  const handleAdjustHue = useCallback((hueShift: number) => {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(activeLayerPixels);
    const after = adjustHue(
      activeLayerPixels,
      canvasSpec.width,
      canvasSpec.height,
      hueShift
    );
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, hueShift: 0 }));
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleAdjustSaturation = useCallback((saturationDelta: number) => {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(activeLayerPixels);
    const after = adjustSaturation(
      activeLayerPixels,
      canvasSpec.width,
      canvasSpec.height,
      saturationDelta
    );
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, saturationDelta: 0 }));
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleAdjustBrightness = useCallback((brightnessDelta: number) => {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(activeLayerPixels);
    const after = adjustBrightness(
      activeLayerPixels,
      canvasSpec.width,
      canvasSpec.height,
      brightnessDelta
    );
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview((prev) => ({ ...prev, brightnessDelta: 0 }));
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleInvert = useCallback(() => {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(activeLayerPixels);
    const after = invertColors(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    // Reset preview sliders just in case, though unrelated to invert (unless we wanted to invert the preview?)
    // Existing code reset them, so we do too.
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleDesaturate = useCallback(() => {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(activeLayerPixels);
    const after = desaturate(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handlePosterize = useCallback((levels: number) => {
    if (isActiveLayerLocked) return;
    const before = cloneBuffer(activeLayerPixels);
    const after = posterize(
      activeLayerPixels,
      canvasSpec.width,
      canvasSpec.height,
      levels
    );
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handlePreviewAdjustColor = useCallback(
    (preview: {
      hueShift: number;
      saturationDelta: number;
      brightnessDelta: number;
    }) => {
      setColorAdjustPreview(preview);
    },
    []
  );

  const handleClearAdjustPreview = useCallback(() => {
    setColorAdjustPreview({
      hueShift: 0,
      saturationDelta: 0,
      brightnessDelta: 0,
    });
  }, []);

  return {
    // Computed Preview State
    previewLayerPixels,
    compositePreviewBuffer,
    
    // Handlers
    handleAdjustHue,
    handleAdjustSaturation,
    handleAdjustBrightness,
    handleInvert,
    handleDesaturate,
    handlePosterize,
    handlePreviewAdjust: handlePreviewAdjustColor,
    handleClearPreview: handleClearAdjustPreview,
  };
}
