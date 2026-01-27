export type BackgroundMode =
  | "checker"
  | "solidDark"
  | "solidLight"
  | "greenscreen"
  | "bluescreen";

export type ToolId =
  | "pen"
  | "eraser"
  | "eyedropper"
  | "fill"
  | "line"
  | "rectangle"
  | "rectangleFilled"
  | "circle"
  | "circleFilled"
  | "ellipse"
  | "ellipseFilled"
  | "selectRect"
  | "selectEllipse";

/**
 * UI/Editor Settings (v0.1).
 * Later we extend this with palette management, tool settings, export presets, etc.
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
};

export type CanvasSpec = {
  width: number;
  height: number;
};

export type Frame = {
  id: string;
  pixels: Uint8ClampedArray;
  durationMs: number;
};

export type AnimationData = {
  frames: Frame[];
  currentFrameIndex: number;
};
