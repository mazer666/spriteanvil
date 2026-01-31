/**
 * src/lib/projects/snapshot.ts
 * -----------------------------------------------------------------------------
 * ## PROJECT SNAPSHOTS (Noob Guide)
 * 
 * Think of this file as the "Save File Blueprint". It defines 
 * exactly what information we need to store to recreate your 
 * entire project later.
 * 
 * 1. LAYERS & PIXELS: Every layer's name, opacity, and its raw color 
 *    data (pixels) are bundled together.
 * 2. FRAMES: Animations are just a list of these snapshots played 
 *    in order, like a flipbook.
 * 3. METADATA: We also store things like which palette you were 
 *    using and your recent colors so the UI looks the same when 
 *    you reopen the app.
 * 
 * ## VAR TRACE
 * - `pixels`: (Origin: pixels.ts -> Memory) The raw Uint8ClampedArray of image data.
 * - `canvas`: (Origin: New Project Dialog) Defines the overall width/height limits.
 * - `activeLayerIds`: (Origin: UI State) Remembers which layer was selected for each frame.
 */
import { BlendMode, CanvasSpec, UiSettings } from "../../types";

export type PaletteData = {
  id: string;
  name: string;
  colors: string[];
  is_default: boolean;
};

export type ProjectLayerSnapshot = {
  id: string;
  name: string;
  opacity: number;
  blend_mode: BlendMode;
  is_visible: boolean;
  is_locked: boolean;
  pixels: Uint8ClampedArray;
};

export type ProjectFrameSnapshot = {
  id: string;
  durationMs: number;
  pivot?: { x: number; y: number };
  layers: ProjectLayerSnapshot[];
};

export type ProjectSnapshot = {
  version: number;
  canvas: CanvasSpec;
  frames: ProjectFrameSnapshot[];
  currentFrameIndex: number;
  activeLayerIds: Record<string, string>;
  palettes: PaletteData[];
  activePaletteId: string;
  recentColors: string[];
  settings?: Partial<UiSettings>;
};
