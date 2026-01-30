export type BackgroundMode =
  | "checker"
  | "solidDark"
  | "solidLight"
  | "greenscreen"
  | "bluescreen";

export type ToolId =
  | "pen"
  | "smudge"
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

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "add"
  | "subtract"
  | "darken"
  | "lighten"
  | "difference"
  | "exclusion";

export type LayerData = {
  id: string;
  name: string;
  opacity: number;
  blend_mode: BlendMode;
  is_visible: boolean;
  is_locked: boolean;
  pixels?: Uint8ClampedArray;
};

export type GradientType = "linear" | "radial" | "angle" | "reflected" | "diamond";
export type DitheringType = "none" | "bayer" | "floyd";
export type SymmetryMode = "none" | "horizontal" | "vertical" | "both" | "radial";

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
  fillPattern: "solid" | "checker" | "dither" | "noise";
  gradientType: GradientType;
  ditheringType: DitheringType;
  symmetryMode: SymmetryMode;
  symmetryAngle: number;
  symmetrySegments: number;
  edgeSnapEnabled: boolean;
  edgeSnapRadius: number;
  showArcGuides: boolean;
  showGravityGuides: boolean;
  showMotionTrails: boolean;
  brushSize: number;
  brushTexture: "none" | "noise" | "dither";
  smudgeStrength: number;
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
  pivot?: { x: number; y: number };
};

export type AnimationData = {
  frames: Frame[];
  currentFrameIndex: number;
};

export type FloatingSelection = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  x: number;
  y: number;
};
