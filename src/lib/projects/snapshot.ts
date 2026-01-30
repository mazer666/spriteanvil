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
