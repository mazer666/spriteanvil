import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ToolRail from "./ToolRail";
import ToolBar from "./ToolBar";
import RightPanel from "./RightPanel";
import Timeline from "./Timeline";
import CanvasStage from "./CanvasStage";
import { CanvasSpec, ToolId, UiSettings, Frame, LayerData, BlendMode, FloatingSelection } from "../types";
import type { EasingCurve } from "../editor/animation";
import { AnimationTag } from "../lib/supabase/animation_tags";
import { PaletteData } from "../lib/projects/snapshot";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;

  tool: ToolId;
  onChangeTool: (tool: ToolId) => void;

  canvasSpec: CanvasSpec;
  buffer: Uint8ClampedArray;
  compositeBuffer: Uint8ClampedArray;
  previewLayerPixels?: Uint8ClampedArray | null;
  onStrokeEnd: (before: Uint8ClampedArray, after: Uint8ClampedArray) => void;

  selection: Uint8Array | null;
  onChangeSelection: (selection: Uint8Array | null) => void;
  floatingBuffer?: FloatingSelection | null;
  onBeginTransform?: () => FloatingSelection | null;
  onUpdateTransform?: (next: FloatingSelection) => void;
  onColorPick?: (color: string) => void;
  onCursorMove?: (position: { x: number; y: number } | null) => void;
  remoteCursors?: Record<string, { x: number; y: number; color: string }>;
  selectionMask?: Uint8Array | null;
  layerPixels?: Uint8ClampedArray | null;
  onInpaint?: (payload: { prompt: string; denoiseStrength: number; promptInfluence: number }) => Promise<string>;
  onImageToImage?: (payload: { prompt: string; denoiseStrength: number; promptInfluence: number }) => Promise<string>;

  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  frames: Frame[];
  currentFrameIndex: number;
  isPlaying: boolean;
  onSelectFrame: (index: number) => void;
  onInsertFrame: () => void;
  onDuplicateFrame: () => void;
  onDeleteFrame: () => void;
  onUpdateFrameDuration: (index: number, durationMs: number) => void;
  onTogglePlayback: () => void;
  onGenerateTweens: (startIndex: number, endIndex: number, count: number, easing: EasingCurve) => void;
  animationTags: AnimationTag[];
  activeTagId: string | null;
  loopTagOnly: boolean;
  onToggleLoopTagOnly: (next: boolean) => void;
  onSelectTag: (id: string | null) => void;
  onCreateTag: (tag: Omit<AnimationTag, "id" | "created_at">) => void;
  onUpdateTag: (id: string, updates: Partial<AnimationTag>) => void;
  onDeleteTag: (id: string) => void;

  layers?: LayerData[];
  activeLayerId?: string | null;
  onLayerOperations?: {
    onSelectLayer: (id: string) => void;
    onCreateLayer: () => void;
    onDeleteLayer: (id: string) => void;
    onDuplicateLayer: (id: string) => void;
    onToggleVisibility: (id: string) => void;
    onToggleLock: (id: string) => void;
    onUpdateOpacity: (id: string, opacity: number) => void;
    onUpdateBlendMode: (id: string, mode: BlendMode) => void;
    onRenameLayer: (id: string, name: string) => void;
    onReorderLayers: (fromIndex: number, toIndex: number) => void;
    onMergeDown: (id: string) => void;
    onFlatten: () => void;
  };

  palettes?: PaletteData[];
  activePaletteId?: string | null;
  recentColors?: string[];
  onPaletteOperations?: {
    onSelectPalette: (id: string) => void;
    onCreatePalette: (name: string, colors: string[]) => void;
    onDeletePalette: (id: string) => void;
    onAddColorToPalette: (paletteId: string, color: string) => void;
    onRemoveColorFromPalette: (paletteId: string, colorIndex: number) => void;
    onSelectColor: (color: string) => void;
    onSwapColors: (fromColor: string, toColor: string) => void;
    onExtractPalette: () => void;
    onImportPalette: (file: File) => void;
    onExportPalette: (format: "gpl" | "ase") => void;
    onGenerateRamp: (steps: number) => void;
  };

  onTransformOperations?: {
    onFlipHorizontal: () => void;
    onFlipVertical: () => void;
    onRotate90CW: () => void;
    onRotate90CCW: () => void;
    onRotate180: () => void;
    onScale: (scaleX: number, scaleY: number) => void;
    onRotate: (degrees: number) => void;
    onSmartOutline: (mode: import("../editor/outline").OutlineMode) => void;
  };

  onColorAdjustOperations?: {
    onAdjustHue: (hueShift: number) => void;
    onAdjustSaturation: (saturationDelta: number) => void;
    onAdjustBrightness: (brightnessDelta: number) => void;
    onPreviewAdjust: (preview: { hueShift: number; saturationDelta: number; brightnessDelta: number }) => void;
    onClearPreview: () => void;
    onInvert: () => void;
    onDesaturate: () => void;
    onPosterize: (levels: number) => void;
  };

  onSelectionOperations?: {
    onSelectAll: () => void;
    onDeselect: () => void;
    onInvertSelection: () => void;
    onGrow: () => void;
    onShrink: () => void;
    onFeather: (radius: number) => void;
    onDetectObject: () => void;
  };

  topBar: ReactNode;
  statusBar?: ReactNode;
};

/**
 * DockLayout: Resizable Panels (Dock-Panels) with splitters.
 *
 * Layout:
 * - Left: ToolRail (fixed)
 * - Center: CanvasStage (flex)
 * - Right: RightPanel (resizable width)
 * - Bottom: Timeline (resizable height)
 *
 * We persist panel sizes in localStorage so the layout "sticks".
 */
export default function DockLayout({
  settings,
  onChangeSettings,
  tool,
  onChangeTool,
  canvasSpec,
  buffer,
  compositeBuffer,
  previewLayerPixels,
  onStrokeEnd,
  selection,
  onChangeSelection,
  floatingBuffer,
  onBeginTransform,
  onUpdateTransform,
  onColorPick,
  onCursorMove,
  remoteCursors,
  selectionMask,
  layerPixels,
  onInpaint,
  onImageToImage,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  frames,
  currentFrameIndex,
  isPlaying,
  onSelectFrame,
  onInsertFrame,
  onDuplicateFrame,
  onDeleteFrame,
  onUpdateFrameDuration,
  onTogglePlayback,
  onGenerateTweens,
  animationTags,
  activeTagId,
  loopTagOnly,
  onToggleLoopTagOnly,
  onSelectTag,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  layers,
  activeLayerId,
  onLayerOperations,
  palettes,
  activePaletteId,
  recentColors,
  onPaletteOperations,
  onTransformOperations,
  onColorAdjustOperations,
  onSelectionOperations,
  topBar,
  statusBar
}: Props) {
  const [rightWidth, setRightWidth] = useState<number>(() => loadNumber("dock:rightWidth", 280));
  const [timelineHeight, setTimelineHeight] = useState<number>(() =>
    loadNumber("dock:timelineHeight", 160)
  );
  const [isMobile, setIsMobile] = useState(false);
  const [isToolRailOpen, setIsToolRailOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [isToolRailCollapsed, setIsToolRailCollapsed] = useState(() =>
    loadBoolean("dock:leftCollapsed", false)
  );
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(() =>
    loadBoolean("dock:rightCollapsed", false)
  );
  const [showLeftPanel, setShowLeftPanel] = useState(() =>
    loadBoolean("dock:leftVisible", true)
  );
  const [showRightPanel, setShowRightPanel] = useState(() =>
    loadBoolean("dock:rightVisible", true)
  );
  const [showTimeline, setShowTimeline] = useState(() =>
    loadBoolean("dock:timelineVisible", true)
  );
  const [isZenMode, setIsZenMode] = useState(false);

  useEffect(() => saveNumber("dock:rightWidth", rightWidth), [rightWidth]);
  useEffect(() => saveNumber("dock:timelineHeight", timelineHeight), [timelineHeight]);
  useEffect(() => saveBoolean("dock:leftCollapsed", isToolRailCollapsed), [isToolRailCollapsed]);
  useEffect(() => saveBoolean("dock:rightCollapsed", isRightPanelCollapsed), [isRightPanelCollapsed]);
  useEffect(() => saveBoolean("dock:leftVisible", showLeftPanel), [showLeftPanel]);
  useEffect(() => saveBoolean("dock:rightVisible", showRightPanel), [showRightPanel]);
  useEffect(() => saveBoolean("dock:timelineVisible", showTimeline), [showTimeline]);

  const sizes = useMemo(() => ({ rightWidth, timelineHeight }), [rightWidth, timelineHeight]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) {
        setIsToolRailOpen(false);
        setIsRightPanelOpen(false);
        setIsMinimapVisible(true);
      } else {
        setIsMinimapVisible(false);
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    function isInputFocused(): boolean {
      const active = document.activeElement;
      return (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        (active?.hasAttribute("contenteditable") ?? false)
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Tab" && !isInputFocused()) {
        e.preventDefault();
        setIsZenMode((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const dragStateRef = useRef<
    | null
    | {
        kind: "right" | "timeline";
        startX: number;
        startY: number;
        startRightWidth: number;
        startTimelineHeight: number;
      }
  >(null);

  function beginDrag(kind: "right" | "timeline", e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    dragStateRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startRightWidth: rightWidth,
      startTimelineHeight: timelineHeight
    };
  }

  function onDragMove(e: React.PointerEvent) {
    if (!dragStateRef.current) return;
    const st = dragStateRef.current;

    if (st.kind === "right") {
      const dx = st.startX - e.clientX; // drag left increases width
      setRightWidth(clamp(st.startRightWidth + dx, 240, 500));
    } else {
      const dy = st.startY - e.clientY; // drag up increases height
      setTimelineHeight(clamp(st.startTimelineHeight + dy, 120, 350));
    }
  }

  function endDrag() {
    dragStateRef.current = null;
  }

  return (
    <div
      className={
        "dock" +
        (isMobile ? " dock--mobile" : "") +
        (isToolRailOpen ? " dock--left-open" : "") +
        (isRightPanelOpen ? " dock--right-open" : "") +
        (isToolRailCollapsed ? " dock--left-collapsed" : "") +
        (isRightPanelCollapsed ? " dock--right-collapsed" : "") +
        (!showLeftPanel ? " dock--left-hidden" : "") +
        (!showRightPanel ? " dock--right-hidden" : "") +
        (!showTimeline ? " dock--timeline-collapsed" : "") +
        (isZenMode ? " dock--zen" : "")
      }
      onPointerMove={onDragMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        "--leftPanelWidth": `${!showLeftPanel || isZenMode ? 0 : isToolRailCollapsed ? 48 : 72}px`,
        "--rightPanelWidth": `${!showRightPanel || isZenMode ? 0 : isRightPanelCollapsed ? 52 : sizes.rightWidth}px`,
        "--timelineHeight": `${!showTimeline || isZenMode ? 0 : sizes.timelineHeight}px`,
        ...(isZenMode ? { "--topbarHeight": "0px", "--statusBarHeight": "0px" } : {}),
      } as React.CSSProperties}
    >
      <div className="dock__top">
        {topBar}
        {!isMobile && (
          <div className="dock__panelControls">
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() => setShowLeftPanel((prev) => !prev)}
              title={showLeftPanel ? "Hide left panel" : "Show left panel"}
            >
              {showLeftPanel ? "⟨" : "⟩"} Left
            </button>
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() => setShowTimeline((prev) => !prev)}
              title={showTimeline ? "Hide timeline" : "Show timeline"}
            >
              {showTimeline ? "⌄" : "⌃"} Timeline
            </button>
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() => setShowRightPanel((prev) => !prev)}
              title={showRightPanel ? "Hide right panel" : "Show right panel"}
            >
              {showRightPanel ? "⟩" : "⟨"} Right
            </button>
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() => setIsZenMode((prev) => !prev)}
              title="Toggle Zen Mode (Tab)"
            >
              {isZenMode ? "◼" : "◻"} Zen
            </button>
          </div>
        )}
        {isMobile && (
          <div className="dock__mobileControls">
            <button
              className="uiBtn"
              onClick={() => {
                setShowLeftPanel(true);
                setIsToolRailOpen((prev) => !prev);
              }}
              title="Toggle tools"
            >
              ☰ Tools
            </button>
            <button
              className="uiBtn"
              onClick={() => setIsMinimapVisible((prev) => !prev)}
              title="Toggle minimap"
            >
              ◳ Map
            </button>
            <button
              className="uiBtn"
              onClick={() => setShowTimeline((prev) => !prev)}
              title={showTimeline ? "Hide timeline" : "Show timeline"}
            >
              ↕ Timeline
            </button>
            <button
              className="uiBtn"
              onClick={() => {
                setShowRightPanel(true);
                setIsRightPanelOpen((prev) => !prev);
              }}
              title="Toggle panel"
            >
              ☰ Panel
            </button>
          </div>
        )}
      </div>

      <div className="dock__body">
        <div className={"dock__left" + (isToolRailCollapsed ? " dock__left--collapsed" : "")}>
          {!isMobile && (
            <button
              className="panel-toggle panel-toggle--left"
              onClick={() => setIsToolRailCollapsed((prev) => !prev)}
              title={isToolRailCollapsed ? "Expand tools" : "Collapse tools"}
            >
              {isToolRailCollapsed ? "›" : "‹"}
            </button>
          )}
          <ToolRail tool={tool} onChangeTool={onChangeTool} />
        </div>

        <div className="dock__center">
          <CanvasStage
            settings={settings}
            tool={tool}
            canvasSpec={canvasSpec}
            buffer={buffer}
            compositeBuffer={compositeBuffer}
            previewLayerPixels={previewLayerPixels}
            layers={layers}
            activeLayerId={activeLayerId}
            onStrokeEnd={onStrokeEnd}
            selection={selection}
            onChangeSelection={onChangeSelection}
            floatingBuffer={floatingBuffer}
            onBeginTransform={onBeginTransform}
            onUpdateTransform={onUpdateTransform}
            onChangeZoom={(zoom) => onChangeSettings({ ...settings, zoom })}
            onColorPick={onColorPick}
            onCursorMove={onCursorMove}
            remoteCursors={remoteCursors}
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            showMinimap={!isMobile || isMinimapVisible}
          />
        </div>

        <div
          className="splitter splitter--v"
          title="Drag to resize panel"
          onPointerDown={(e) => beginDrag("right", e)}
        />

        <div className={"dock__right" + (isRightPanelCollapsed ? " dock__right--collapsed" : "")}>
          {!isMobile && (
            <button
              className="panel-toggle panel-toggle--right"
              onClick={() => setIsRightPanelCollapsed((prev) => !prev)}
              title={isRightPanelCollapsed ? "Expand panel" : "Collapse panel"}
            >
              {isRightPanelCollapsed ? "‹" : "›"}
            </button>
          )}
          <RightPanel
            tool={tool}
            settings={settings}
            onChangeSettings={onChangeSettings}
            canvasSpec={canvasSpec}
            previewBuffer={compositeBuffer}
            selectionMask={selectionMask}
            layerPixels={layerPixels}
            onInpaint={onInpaint}
            onImageToImage={onImageToImage}
            collapsed={isRightPanelCollapsed}
            layers={layers}
            activeLayerId={activeLayerId}
            onLayerOperations={onLayerOperations}
            palettes={palettes}
            activePaletteId={activePaletteId}
            recentColors={recentColors}
            onPaletteOperations={onPaletteOperations}
            onTransformOperations={onTransformOperations}
            onColorAdjustOperations={onColorAdjustOperations}
            hasSelection={selection !== null}
            onSelectionOperations={onSelectionOperations}
          />
        </div>
      </div>

      <div
        className="splitter splitter--h"
        title="Drag to resize timeline"
        onPointerDown={(e) => beginDrag("timeline", e)}
      />

      <div className="dock__bottom">
        <Timeline
          settings={settings}
          onChangeSettings={onChangeSettings}
          canvasSpec={canvasSpec}
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          isPlaying={isPlaying}
          onSelectFrame={onSelectFrame}
          onInsertFrame={onInsertFrame}
          onDuplicateFrame={onDuplicateFrame}
          onDeleteFrame={onDeleteFrame}
          onUpdateFrameDuration={onUpdateFrameDuration}
          onTogglePlayback={onTogglePlayback}
          onGenerateTweens={onGenerateTweens}
          animationTags={animationTags}
          activeTagId={activeTagId}
          loopTagOnly={loopTagOnly}
          onToggleLoopTagOnly={onToggleLoopTagOnly}
          onSelectTag={onSelectTag}
          onCreateTag={onCreateTag}
          onUpdateTag={onUpdateTag}
          onDeleteTag={onDeleteTag}
        />
      </div>

        {isMobile && (
          <div className="dock__toolbar">
            <ToolBar tool={tool} onChangeTool={onChangeTool} />
          </div>
        )}

      <div className="dock__status">
        {statusBar}
      </div>
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
}

function saveBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}
