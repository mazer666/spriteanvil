export type BackgroundMode =
  | "checker"
  | "solidDark"
  | "solidLight"
  | "greenscreen"
  | "bluescreen";

/**
 * Tools (Left Tool Rail)
 */
export type ToolId = "pen" | "eraser" | "fill" | "wand";

/**
 * UI/Editor Settings (v0.1).
 */
export type UiSettings = {
  zoom: number; // 1.0 = 100%
  brushStabilizerEnabled: boolean;

  // Background & checkerboard customization (view-only, never exported)
  backgroundMode: BackgroundMode;
  checkerSize: number; // px (visual squares size)
  checkerA: string; // CSS color
  checkerB: string; // CSS color

  // Grid overlay (view-only)
  showGrid: boolean;
  gridSize: number; // in sprite pixels (1 = pixel grid, 8 = 8px tile grid)

  // Onion skin (later used when we have multiple frames)
  showOnionSkin: boolean;
  onionPrev: number;
  onionNext: number;

  // Drawing
  primaryColor: string; // "#RRGGBB"

  // Fill tool
  fillTolerance: number; // 0..255 (per-channel tolerance)

  // Magic Wand tool
  wandTolerance: number; // 0..255 (per-channel tolerance)
};

export type CanvasSpec = {
  width: number;
  height: number;
};
