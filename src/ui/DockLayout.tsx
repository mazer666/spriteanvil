import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ToolRail from "./ToolRail";
import ToolBar from "./ToolBar";
import RightPanel from "./RightPanel";
import Timeline from "./Timeline";
import CanvasStage from "./CanvasStage";
import {
  CanvasSpec,
  ToolId,
  UiSettings,
  Frame,
  LayerData,
  BlendMode,
  FloatingSelection,
  LayoutSettings
} from "../types";
import type { EasingCurve } from "../editor/animation";
import { AnimationTag } from "../lib/supabase/animation_tags";
import { PaletteData } from "../lib/projects/snapshot";
import { isInputFocused } from "../utils/dom";

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
 * We persist panel sizes in user settings so the layout "sticks".
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
  const defaultLayout = useMemo<LayoutSettings>(
    () => ({
      leftPanelVisible: true,
      rightPanelVisible: true,
      timelineVisible: true,
      leftCollapsed: false,
      rightCollapsed: false,
      rightWidth: 280,
      timelineHeight: 160,
      toolRailPosition: { x: 18, y: 84 },
      rightPanelOrder: ["tools", "layers", "colors", "transform", "selection", "ai"],
    }),
    []
  );
  const layout = settings.layout ?? defaultLayout;
  const [rightWidth, setRightWidth] = useState<number>(layout.rightWidth);
  const [timelineHeight, setTimelineHeight] = useState<number>(layout.timelineHeight);
  const [isMobile, setIsMobile] = useState(false);
  const [isToolRailOpen, setIsToolRailOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [isToolRailCollapsed, setIsToolRailCollapsed] = useState(layout.leftCollapsed);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(layout.rightCollapsed);
  const [showLeftPanel, setShowLeftPanel] = useState(layout.leftPanelVisible);
  const [showRightPanel, setShowRightPanel] = useState(layout.rightPanelVisible);
  const [showTimeline, setShowTimeline] = useState(layout.timelineVisible);
  const [isZenMode, setIsZenMode] = useState(false);
  const [toolRailPosition, setToolRailPosition] = useState(layout.toolRailPosition);

  useEffect(() => {
    if (layout.rightWidth !== rightWidth) setRightWidth(layout.rightWidth);
    if (layout.timelineHeight !== timelineHeight) setTimelineHeight(layout.timelineHeight);
    if (layout.leftCollapsed !== isToolRailCollapsed) setIsToolRailCollapsed(layout.leftCollapsed);
    if (layout.rightCollapsed !== isRightPanelCollapsed) setIsRightPanelCollapsed(layout.rightCollapsed);
    if (layout.leftPanelVisible !== showLeftPanel) setShowLeftPanel(layout.leftPanelVisible);
    if (layout.rightPanelVisible !== showRightPanel) setShowRightPanel(layout.rightPanelVisible);
    if (layout.timelineVisible !== showTimeline) setShowTimeline(layout.timelineVisible);
    if (
      layout.toolRailPosition.x !== toolRailPosition.x ||
      layout.toolRailPosition.y !== toolRailPosition.y
    ) {
      setToolRailPosition(layout.toolRailPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const sizes = useMemo(() => ({ rightWidth, timelineHeight }), [rightWidth, timelineHeight]);
  const dockBodyRef = useRef<HTMLDivElement | null>(null);
  const toolRailRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  function updateLayout(patch: Partial<LayoutSettings>) {
    const currentLayout = settings.layout ?? defaultLayout;
    const nextLayout: LayoutSettings = {
      ...currentLayout,
      ...patch,
    };
    const isSame = settings.layout && JSON.stringify(settings.layout) === JSON.stringify(nextLayout);
    if (isSame) return;
    onChangeSettings({ ...settings, layout: nextLayout });
  }

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
  const toolRailDragRef = useRef<
    | null
    | {
        startX: number;
        startY: number;
        originX: number;
        originY: number;
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
      const next = clamp(st.startRightWidth + dx, 240, 500);
      setRightWidth(next);
      updateLayout({ rightWidth: next });
    } else {
      const dy = st.startY - e.clientY; // drag up increases height
      const next = clamp(st.startTimelineHeight + dy, 120, 350);
      setTimelineHeight(next);
      updateLayout({ timelineHeight: next });
    }
  }

  function endDrag() {
    dragStateRef.current = null;
  }

  function beginToolRailDrag(e: React.PointerEvent) {
    if (isMobile) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    toolRailDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: toolRailPosition.x,
      originY: toolRailPosition.y,
    };
  }

  function snapToolRailPosition(pos: { x: number; y: number }) {
    const container = dockBodyRef.current;
    const tool = toolRailRef.current;
    if (!container || !tool) return pos;
    const bounds = container.getBoundingClientRect();
    const toolRect = tool.getBoundingClientRect();
    const maxX = bounds.width - toolRect.width - 8;
    const maxY = bounds.height - toolRect.height - 8;
    const clamped = {
      x: clamp(pos.x, 8, Math.max(8, maxX)),
      y: clamp(pos.y, 8, Math.max(8, maxY)),
    };
    const snapTargetsX = [8, Math.max(8, maxX)];
    if (showRightPanel && rightPanelRef.current) {
      const rightRect = rightPanelRef.current.getBoundingClientRect();
      const leftEdge = rightRect.left - bounds.left - toolRect.width - 12;
      snapTargetsX.push(clamp(leftEdge, 8, Math.max(8, maxX)));
    }
    const snapTargetsY = [8, Math.max(8, maxY)];
    const snapThreshold = 24;
    const snapValue = (value: number, targets: number[]) => {
      for (const target of targets) {
        if (Math.abs(value - target) <= snapThreshold) return target;
      }
      return value;
    };
    return {
      x: snapValue(clamped.x, snapTargetsX),
      y: snapValue(clamped.y, snapTargetsY),
    };
  }

  function moveToolRail(e: React.PointerEvent) {
    if (!toolRailDragRef.current) return;
    const drag = toolRailDragRef.current;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setToolRailPosition({ x: drag.originX + dx, y: drag.originY + dy });
  }

  function endToolRailDrag() {
    if (!toolRailDragRef.current) return;
    toolRailDragRef.current = null;
    const snapped = snapToolRailPosition(toolRailPosition);
    setToolRailPosition(snapped);
    updateLayout({ toolRailPosition: snapped });
  }

  function handlePointerMove(e: React.PointerEvent) {
    onDragMove(e);
    moveToolRail(e);
  }

  function handlePointerUp() {
    endDrag();
    endToolRailDrag();
  }

  function resetLayout() {
    setRightWidth(defaultLayout.rightWidth);
    setTimelineHeight(defaultLayout.timelineHeight);
    setIsToolRailCollapsed(defaultLayout.leftCollapsed);
    setIsRightPanelCollapsed(defaultLayout.rightCollapsed);
    setShowLeftPanel(defaultLayout.leftPanelVisible);
    setShowRightPanel(defaultLayout.rightPanelVisible);
    setShowTimeline(defaultLayout.timelineVisible);
    setToolRailPosition(defaultLayout.toolRailPosition);
    setIsToolRailOpen(false);
    setIsRightPanelOpen(false);
    setIsMinimapVisible(true);
    updateLayout(defaultLayout);
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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        "--leftPanelWidth": `${0}px`,
        "--rightPanelWidth": `${!showRightPanel || isZenMode ? 0 : isRightPanelCollapsed ? 52 : sizes.rightWidth}px`,
        "--timelineHeight": `${!showTimeline || isZenMode ? 0 : sizes.timelineHeight}px`,
        ...(isZenMode ? { "--topbarHeight": "0px", "--statusBarHeight": "0px" } : {}),
      } as React.CSSProperties}
    >
      <div className="dock__top">
        <div className="dock__topbar">{topBar}</div>
        {!isMobile && (
          <div className="dock__panelControls">
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() =>
                setShowLeftPanel((prev) => {
                  const next = !prev;
                  updateLayout({ leftPanelVisible: next });
                  return next;
                })
              }
              title={showLeftPanel ? "Hide left panel" : "Show left panel"}
            >
              {showLeftPanel ? "⟨" : "⟩"} Left
            </button>
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() =>
                setShowTimeline((prev) => {
                  const next = !prev;
                  updateLayout({ timelineVisible: next });
                  return next;
                })
              }
              title={showTimeline ? "Hide timeline" : "Show timeline"}
            >
              {showTimeline ? "⌄" : "⌃"} Timeline
            </button>
            <button
              className="uiBtn uiBtn--ghost"
              onClick={() =>
                setShowRightPanel((prev) => {
                  const next = !prev;
                  updateLayout({ rightPanelVisible: next });
                  return next;
                })
              }
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
            <button className="uiBtn uiBtn--ghost" onClick={resetLayout} title="Reset layout">
              ↺ Reset
            </button>
          </div>
        )}
        {isMobile && (
          <div className="dock__mobileControls">
            <button
              className="uiBtn"
              onClick={() => {
                setShowLeftPanel((prev) => {
                  const next = !prev;
                  updateLayout({ leftPanelVisible: next });
                  return next;
                });
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
              onClick={() =>
                setShowTimeline((prev) => {
                  const next = !prev;
                  updateLayout({ timelineVisible: next });
                  return next;
                })
              }
              title={showTimeline ? "Hide timeline" : "Show timeline"}
            >
              ↕ Timeline
            </button>
            <button
              className="uiBtn"
              onClick={() => {
                setShowRightPanel((prev) => {
                  const next = !prev;
                  updateLayout({ rightPanelVisible: next });
                  return next;
                });
                setIsRightPanelOpen((prev) => !prev);
              }}
              title="Toggle panel"
            >
              ☰ Panel
            </button>
            <button className="uiBtn" onClick={resetLayout} title="Reset layout">
              ↺ Reset
            </button>
          </div>
        )}
      </div>

      <div className="dock__body" ref={dockBodyRef}>
        {showLeftPanel && (
          <div
            className={
              "dock__floatingToolRail" +
              (isToolRailCollapsed ? " dock__floatingToolRail--collapsed" : "") +
              (isToolRailOpen ? " dock__floatingToolRail--open" : "")
            }
            ref={toolRailRef}
            style={
              isMobile
                ? undefined
                : {
                    left: toolRailPosition.x,
                    top: toolRailPosition.y,
                  }
            }
          >
            <div className="dock__floatingToolRailHeader" onPointerDown={beginToolRailDrag}>
              <span className="dock__floatingToolRailGrip">⋮⋮</span>
              <span className="dock__floatingToolRailTitle">Tools</span>
              <button
                className="uiBtn uiBtn--ghost"
                onClick={() =>
                  setIsToolRailCollapsed((prev) => {
                    const next = !prev;
                    updateLayout({ leftCollapsed: next });
                    return next;
                  })
                }
                title={isToolRailCollapsed ? "Expand tools" : "Collapse tools"}
                type="button"
              >
                {isToolRailCollapsed ? "›" : "‹"}
              </button>
            </div>
            <ToolRail tool={tool} onChangeTool={onChangeTool} />
          </div>
        )}

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

        <div
          className={"dock__right" + (isRightPanelCollapsed ? " dock__right--collapsed" : "")}
          ref={rightPanelRef}
        >
          {!isMobile && (
            <button
              className="panel-toggle panel-toggle--right"
              onClick={() =>
                setIsRightPanelCollapsed((prev) => {
                  const next = !prev;
                  updateLayout({ rightCollapsed: next });
                  return next;
                })
              }
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

      {isZenMode && (
        <button
          className="uiBtn dock__zenExit"
          onClick={() => setIsZenMode(false)}
          title="Exit Zen Mode (Tab)"
        >
          Exit Zen
        </button>
      )}
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
