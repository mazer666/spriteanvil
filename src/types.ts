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
  | "gradient"
  | "line"
  | "rectangle"
  | "rectangleFilled"
  | "circle"
  | "circleFilled"
  | "ellipse"
  | "ellipseFilled"
  | "selectRect"
  | "selectEllipse"
  | "selectLasso"
  | "selectWand"
  | "move"
  | "rotate"
  | "scale"
  | "flip";

export type GradientType = "linear" | "radial" | "angle" | "reflected" | "diamond";
export type DitheringType = "none" | "bayer" | "floyd";
export type SymmetryMode = "none" | "horizontal" | "vertical" | "both" | "radial4" | "radial8";

/**
 * UI/Editor Settings.
 */
export type UiSettings = {
  zoom: number;
  brushStabilizerEnabled: boolean;

  // Background & checkerboard customization (view-only, never exported)
  backgroundMode: BackgroundMode;
  checkerSize: number;
  checkerA: string;
  checkerB: string;

  // Grid overlay (view-only)
  showGrid: boolean;
  gridSize: number;

  // Onion skin
  showOnionSkin: boolean;
  onionPrev: number;
  onionNext: number;

  // Drawing
  primaryColor: string;
  secondaryColor?: string;

  // Tool-specific settings
  fillTolerance: number;
  gradientType: GradientType;
  ditheringType: DitheringType;
  symmetryMode: SymmetryMode;
  brushSize: number;
  wandTolerance: number;
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
