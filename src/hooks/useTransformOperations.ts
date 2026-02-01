
import { useRef, useState, useCallback } from "react";
import { CanvasSpec, FloatingSelection } from "../types";
import { HistoryStack } from "../editor/history";
import { cloneBuffer } from "../editor/pixels";
import {
  flipHorizontal,
  flipVertical,
  rotate90CW,
  rotate90CCW,
  rotate180,
  scaleNearest,
  applyTransform,
  TransformMatrix,
  liftSelection,
} from "../editor/tools/transform";
import { applySmartOutline, OutlineMode } from "../editor/outline";
import { pasteClipboard } from "../editor/clipboard";
import { buildSelectionMaskFromFloating } from "../editor/selection";
import { hexToRgb } from "../utils/colors";

export interface TransformOperationsConfig {
  canvasSpec: CanvasSpec;
  activeLayerPixels: Uint8ClampedArray;
  isActiveLayerLocked: boolean;
  selection: Uint8Array | null;
  setSelection: (selection: Uint8Array | null) => void;
  updateActiveLayerPixels: (pixels: Uint8ClampedArray) => void;
  history: HistoryStack;
  syncHistoryFlags: () => void;
  primaryColor: string;
}

export function useTransformOperations({
  canvasSpec,
  activeLayerPixels,
  isActiveLayerLocked,
  selection,
  setSelection,
  updateActiveLayerPixels,
  history,
  syncHistoryFlags,
  primaryColor,
}: TransformOperationsConfig) {
  const [floatingBuffer, setFloatingBuffer] = useState<FloatingSelection | null>(null);
  const transformBeforeRef = useRef<Uint8ClampedArray | null>(null);

  /**
   * Helper: Begin a transformation by lifting the current selection into a floating buffer
   */
  const beginSelectionTransform = useCallback((): FloatingSelection | null => {
    if (floatingBuffer) return floatingBuffer;
    if (!selection) return null;

    const { floating, cleared } = liftSelection(
      activeLayerPixels,
      selection,
      canvasSpec.width,
      canvasSpec.height
    );
    if (!floating) return null;

    transformBeforeRef.current = cloneBuffer(activeLayerPixels);
    updateActiveLayerPixels(cleared);
    setFloatingBuffer(floating);
    
    // Update selection to match the floating buffer
    setSelection(buildSelectionMaskFromFloating(floating, canvasSpec.width, canvasSpec.height));
    
    return floating;
  }, [
    activeLayerPixels,
    selection,
    canvasSpec.width,
    canvasSpec.height,
    floatingBuffer,
    updateActiveLayerPixels,
    setSelection
  ]);

  /**
   * Helper: Update the floating buffer and sync selection mask
   */
  const updateFloating = useCallback((next: FloatingSelection) => {
    setFloatingBuffer(next);
    setSelection(buildSelectionMaskFromFloating(next, canvasSpec.width, canvasSpec.height));
  }, [setSelection, canvasSpec.width, canvasSpec.height]);

  /**
   * Helper: Apply settings from a matrix transform to the floating buffer
   */
  const applyFloatingTransform = useCallback((
    buildMatrix: (width: number, height: number) => TransformMatrix
  ): boolean => {
    const floating = beginSelectionTransform();
    if (!floating) return false;

    const matrix = buildMatrix(floating.width, floating.height);
    const next = applyTransform(floating, matrix, "nearest");
    updateFloating(next);
    return true;
  }, [beginSelectionTransform, updateFloating]);

  /**
   * Commit the current floating transform to the active layer
   */
  const commitTransform = useCallback(() => {
    if (!floatingBuffer) return;
    if (!transformBeforeRef.current) return;

    const pasted = pasteClipboard(
      activeLayerPixels,
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

    const newSelection = buildSelectionMaskFromFloating(floatingBuffer, canvasSpec.width, canvasSpec.height);
    history.commit(transformBeforeRef.current);
    updateActiveLayerPixels(pasted);
    
    setFloatingBuffer(null);
    setSelection(newSelection);
    transformBeforeRef.current = null;
    syncHistoryFlags();
  }, [
    floatingBuffer,
    activeLayerPixels,
    canvasSpec.width,
    canvasSpec.height,
    history,
    updateActiveLayerPixels,
    setSelection,
    syncHistoryFlags
  ]);

  // --- Handlers ---

  const handleFlipHorizontal = useCallback(() => {
    if (isActiveLayerLocked) return;
    if (
      applyFloatingTransform((width) => ({
        a: -1, b: 0, c: 0, d: 1, e: width - 1, f: 0,
      }))
    ) return;
    
    const before = cloneBuffer(activeLayerPixels);
    const after = flipHorizontal(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }, [isActiveLayerLocked, applyFloatingTransform, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleFlipVertical = useCallback(() => {
    if (isActiveLayerLocked) return;
    if (
      applyFloatingTransform((_width, height) => ({
        a: 1, b: 0, c: 0, d: -1, e: 0, f: height - 1,
      }))
    ) return;

    const before = cloneBuffer(activeLayerPixels);
    const after = flipVertical(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }, [isActiveLayerLocked, applyFloatingTransform, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleRotate90CW = useCallback(() => {
    if (isActiveLayerLocked) return;
    if (
      applyFloatingTransform((_width, height) => ({
        a: 0, b: 1, c: -1, d: 0, e: height - 1, f: 0,
      }))
    ) return;

    const before = cloneBuffer(activeLayerPixels);
    const result = rotate90CW(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }, [isActiveLayerLocked, applyFloatingTransform, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleRotate90CCW = useCallback(() => {
    if (isActiveLayerLocked) return;
    if (
      applyFloatingTransform((width) => ({
        a: 0, b: -1, c: 1, d: 0, e: 0, f: width - 1,
      }))
    ) return;

    const before = cloneBuffer(activeLayerPixels);
    const result = rotate90CCW(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }, [isActiveLayerLocked, applyFloatingTransform, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleRotate180 = useCallback(() => {
    if (isActiveLayerLocked) return;
    if (
      applyFloatingTransform((width, height) => ({
        a: -1, b: 0, c: 0, d: -1, e: width - 1, f: height - 1,
      }))
    ) return;

    const before = cloneBuffer(activeLayerPixels);
    const after = rotate180(activeLayerPixels, canvasSpec.width, canvasSpec.height);
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }, [isActiveLayerLocked, applyFloatingTransform, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleScale = useCallback((scaleX: number, scaleY: number) => {
    if (isActiveLayerLocked) return;
    if (scaleX <= 0 || scaleY <= 0) return;
    if (
      applyFloatingTransform(() => ({
        a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0,
      }))
    ) return;
    
    // Scale entire layer
    const before = cloneBuffer(activeLayerPixels);
    const result = scaleNearest(
      activeLayerPixels,
      canvasSpec.width,
      canvasSpec.height,
      scaleX,
      scaleY
    );
    history.commit(before);
    updateActiveLayerPixels(result.buffer);
    syncHistoryFlags();
  }, [isActiveLayerLocked, applyFloatingTransform, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags]);

  const handleRotateDegrees = useCallback((degrees: number) => {
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
  }, [isActiveLayerLocked, handleRotate90CW, handleRotate180, handleRotate90CCW]);

  const handleSmartOutline = useCallback((mode: OutlineMode) => {
    if (isActiveLayerLocked) return;
    const rgb = hexToRgb(primaryColor);
    if (!rgb) return;
    const outlineColor = { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 };

    const before = cloneBuffer(activeLayerPixels);
    const after = applySmartOutline(activeLayerPixels, canvasSpec.width, canvasSpec.height, outlineColor, mode);
    history.commit(before);
    updateActiveLayerPixels(after);
    syncHistoryFlags();
  }, [isActiveLayerLocked, activeLayerPixels, canvasSpec, history, updateActiveLayerPixels, syncHistoryFlags, primaryColor]);

  return {
    floatingBuffer,
    setFloatingBuffer,
    onBeginTransform: beginSelectionTransform,
    onUpdateTransform: updateFloating,
    onCommitTransform: commitTransform,
    
    onFlipHorizontal: handleFlipHorizontal,
    onFlipVertical: handleFlipVertical,
    onRotate90CW: handleRotate90CW,
    onRotate90CCW: handleRotate90CCW,
    onRotate180: handleRotate180,
    onScale: handleScale,
    onRotate: handleRotateDegrees,
    onSmartOutline: handleSmartOutline,
  };
}
