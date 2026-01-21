export type BackgroundMode =
  | "checker"
  | "solidDark"
  | "solidLight"
  | "greenscreen"
  | "bluescreen";

/**
 * UI/Editor Settings (erste Version).
 * Später erweitern wir das um:
 * - Palette
 * - Tool Settings (Pen/Fill/Wand/Gradient)
 * - Timeline/Animation Meta (FPS, Tags)
 * - Export Settings
 */
export type UiSettings = {
  zoom: number; // 1.0 = 100%
  brushStabilizerEnabled: boolean;
  backgroundMode: BackgroundMode;
  showGrid: boolean;
  gridSize: number; // px
  showOnionSkin: boolean;
  onionPrev: number;
  onionNext: number;
};
