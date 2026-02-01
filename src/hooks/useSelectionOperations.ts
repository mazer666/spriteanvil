/**
 * src/hooks/useSelectionOperations.ts
 * -----------------------------------------------------------------------------
 * ## THE SELECTION TOOLKIT (Noob Guide)
 * 
 * Think of a "Selection" as a **Stencil**. 
 * When you select an area, you're saying "only allow changes inside this shape".
 * 
 * This hook handles:
 * - **Selecting All**: Covering the whole canvas with your stencil.
 * - **Deselecting**: Throwing the stencil away.
 * - **Inverting**: Flipping the stencil so everything *except* what you picked is now picked.
 * - **Growing/Shrinking**: Making the stencil slightly bigger or smaller (Expand/Contract).
 * - **Auto-Detect**: Finding a solid shape and wrapping the stencil around it.
 */
import { useCallback } from "react";
import { CanvasSpec } from "../types";
import { invertSelection, selectConnectedOpaque } from "../editor/selection";

export interface SelectionOperationsConfig {
  selection: Uint8Array | null;
  setSelection: (selection: Uint8Array | null) => void;
  canvasSpec: CanvasSpec;
  compositeBuffer: Uint8ClampedArray;
  cursorPosition: { x: number; y: number } | null;
  setProjectError: (msg: string) => void;
  
  // Interaction with Transform Operations
  floatingBuffer: any | null; // Typed as FloatingSelection in usage, but loose here or import type
  onCommitTransform: () => void;
}

export function useSelectionOperations({
  selection,
  setSelection,
  canvasSpec,
  compositeBuffer,
  cursorPosition,
  setProjectError,
  floatingBuffer,
  onCommitTransform,
}: SelectionOperationsConfig) {
  
  const changeSelection = useCallback((next: Uint8Array | null) => {
    if (floatingBuffer) {
      onCommitTransform();
    }
    setSelection(next);
  }, [floatingBuffer, onCommitTransform, setSelection]);

  // WHAT: Selects every single pixel on the canvas.
  // WHY: Usually done before inverting or if you want to apply a color adjust to the whole image.
  const handleSelectAll = useCallback(() => {
    const sel = new Uint8Array(canvasSpec.width * canvasSpec.height);
    sel.fill(1);
    changeSelection(sel);
  }, [canvasSpec.width, canvasSpec.height, changeSelection]);

  const handleDeselect = useCallback(() => {
    changeSelection(null);
  }, [changeSelection]);

  // WHAT: Flips the selection stencil. 
  // WHY: If you want to delete everything *around* your character, you select the character and then "Invert".
  const handleInvertSelection = useCallback(() => {
    if (!selection) {
      handleSelectAll();
      return;
    }
    const inverted = new Uint8Array(selection);
    invertSelection(inverted);
    changeSelection(inverted);
  }, [selection, handleSelectAll, changeSelection]);

  // WHAT: Makes the selection 1 pixel wider in all directions.
  // WHY: To give your selection a bit of "breathing room" or an outline.
  // HOW: It checks every selected pixel and also selects its neighbors.
  const handleGrowSelection = useCallback(() => {
    if (!selection) return;
    const width = canvasSpec.width;
    const height = canvasSpec.height;
    const grown = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (selection[idx]) {
          grown[idx] = 1;
          if (x > 0) grown[idx - 1] = 1;
          if (x < width - 1) grown[idx + 1] = 1;
          if (y > 0) grown[idx - width] = 1;
          if (y < height - 1) grown[idx + width] = 1;
        }
      }
    }
    changeSelection(grown);
  }, [selection, canvasSpec.width, canvasSpec.height, changeSelection]);

  const handleShrinkSelection = useCallback(() => {
    if (!selection) return;
    const width = canvasSpec.width;
    const height = canvasSpec.height;
    const shrunk = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (selection[idx]) {
          const hasUnselectedNeighbor =
            x === 0 ||
            !selection[idx - 1] ||
            x === width - 1 ||
            !selection[idx + 1] ||
            y === 0 ||
            !selection[idx - width] ||
            y === height - 1 ||
            !selection[idx + width];
          if (!hasUnselectedNeighbor) {
            shrunk[idx] = 1;
          }
        }
      }
    }
    changeSelection(shrunk);
  }, [selection, canvasSpec.width, canvasSpec.height, changeSelection]);

  // WHAT: Automatically selects an entire object (group of pixels).
  // WHY: To quickly pick up a character or item without drawing a box around it.
  // HOW: It uses a "Flood Fill" logic starting from your mouse cursor.
  const handleDetectObjectSelection = useCallback(() => {
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
    // Directly set selection (skips commit? No, should use changeSelection if we want consistency)
    // App.tsx implementation called setSelection directly.
    // However, if we are selecting a new object, we probably want to commit any existing transform first?
    // Let's use changeSelection for consistency.
    changeSelection(mask);
  }, [cursorPosition, compositeBuffer, canvasSpec.width, canvasSpec.height, setProjectError, changeSelection]);

  const handleFeatherSelection = useCallback((_radius: number) => {
    // Not implemented yet
  }, []);

  return {
    onSelectAll: handleSelectAll,
    onDeselect: handleDeselect,
    onInvertSelection: handleInvertSelection,
    onGrow: handleGrowSelection,
    onShrink: handleShrinkSelection,
    onFeather: handleFeatherSelection,
    onDetectObject: handleDetectObjectSelection,
    changeSelection, // Exported for internal use if needed
  };
}
