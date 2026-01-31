import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ToolRail from "./ToolRail";
import ToolBar from "./ToolBar";
import RightPanel from "./RightPanel";
import MobileHeader from "./MobileHeader";
import MobileBottomDock from "./MobileBottomDock";
import MobileSheet from "./MobileSheet";
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
  onCommitTransform?: () => void;
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
  onReorderFrames?: (fromIndex: number, toIndex: number) => void;

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

  onNavigateToDashboard?: () => void;

  topBar: ReactNode;
  statusBar?: ReactNode;
};

/**
 * DockLayout: Resizable Panels (Dock-Panels) with splitters.
 * Now defaulting to Floating Panels for a "Desktop App" feel.
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
  onCommitTransform,
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
  onReorderFrames,
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
  onNavigateToDashboard,
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
      rightPanelPosition: { x: 24, y: 84 },
      rightPanelOrder: ["tools", "layers", "colors", "transform", "selection", "ai"],
    }),
    []
  );
  
  const layout = settings.layout ?? defaultLayout;
  const [rightWidth, setRightWidth] = useState<number>(layout.rightWidth);
  const [timelineHeight, setTimelineHeight] = useState<number>(layout.timelineHeight);
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  
  // Panel Visibility
  const [isToolRailOpen, setIsToolRailOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  
  // Collapse States (kept for legacy grid, less used in floating)
  const [isToolRailCollapsed, setIsToolRailCollapsed] = useState(layout.leftCollapsed);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(layout.rightCollapsed);
  
  // Master Toggles
  const [showLeftPanel, setShowLeftPanel] = useState(layout.leftPanelVisible);
  const [showRightPanel, setShowRightPanel] = useState(layout.rightPanelVisible);
  const [showTimeline, setShowTimeline] = useState(layout.timelineVisible);
  
  const [isZenMode, setIsZenMode] = useState(false);
  
  // Floating Positions
  const [toolRailPosition, setToolRailPosition] = useState(layout.toolRailPosition);
  const [rightPanelPosition, setRightPanelPosition] = useState(
    layout.rightPanelPosition ?? { x: 24, y: 84 }
  );
  const [timelinePosition, setTimelinePosition] = useState<{ x: number; y: number } | null>(null); // null = centered

  // Force floating mode for desktop
  const isPanelFloating = true; 

  // --- Effects ---

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
    if (layout.rightPanelPosition) {
      if (
        layout.rightPanelPosition.x !== rightPanelPosition.x ||
        layout.rightPanelPosition.y !== rightPanelPosition.y
      ) {
        setRightPanelPosition(layout.rightPanelPosition);
      }
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
    const tabletMedia = window.matchMedia("(max-width: 1024px)");
    const update = () => {
      setIsMobile(media.matches);
      setIsTablet(tabletMedia.matches);
      // On mobile/tablet, defaults might change
      if (!media.matches) {
        setIsMinimapVisible(true);
      } else {
        setIsMinimapVisible(false);
      }
    };
    update();
    media.addEventListener("change", update);
    tabletMedia.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
      tabletMedia.removeEventListener("change", update);
    };
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

  // --- Drag & Drop Logic ---

  const dragStateRef = useRef<{
      kind: "right" | "timeline";
      startX: number;
      startY: number;
      startRightWidth: number;
      startTimelineHeight: number;
    } | null>(null);

  const toolRailDragRef = useRef<{
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    } | null>(null);

  const rightPanelDragRef = useRef<{
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    } | null>(null);

  const toolRailRafRef = useRef<number | null>(null);
  const rightPanelRafRef = useRef<number | null>(null);
  const pendingToolRailRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRightPanelRef = useRef<{ x: number; y: number } | null>(null);

  // Timeline drag for MOVE
  const timelineDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

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
      const dx = st.startX - e.clientX; 
      const next = clamp(st.startRightWidth + dx, 240, 500);
      setRightWidth(next);
      updateLayout({ rightWidth: next });
    } else {
      const dy = st.startY - e.clientY; 
      const next = clamp(st.startTimelineHeight + dy, 120, 350);
      setTimelineHeight(next);
      updateLayout({ timelineHeight: next });
    }
  }

  function endDrag() {
    dragStateRef.current = null;
  }

  // --- Timeline Move (separate from resize) ---
  function beginTimelineMove(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const origin = timelinePosition ?? { x: window.innerWidth / 2, y: window.innerHeight - 150 };
    timelineDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: origin.x,
      originY: origin.y,
    };
  }

  function moveTimeline(e: React.PointerEvent) {
    if (!timelineDragRef.current) return;
    const drag = timelineDragRef.current;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setTimelinePosition({ x: drag.originX + dx, y: drag.originY + dy });
  }

  function endTimelineMove() {
    timelineDragRef.current = null;
  }

  // --- Tool Rail Drag ---
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
    return clamped;
  }

  function moveToolRail(e: React.PointerEvent) {
    if (!toolRailDragRef.current) return;
    const drag = toolRailDragRef.current;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    pendingToolRailRef.current = { x: drag.originX + dx, y: drag.originY + dy };
    if (toolRailRafRef.current !== null) return;
    toolRailRafRef.current = window.requestAnimationFrame(() => {
      if (pendingToolRailRef.current) {
        setToolRailPosition(pendingToolRailRef.current);
      }
      toolRailRafRef.current = null;
    });
  }

  function endToolRailDrag() {
    if (!toolRailDragRef.current) return;
    toolRailDragRef.current = null;
    const snapped = snapToolRailPosition(toolRailPosition);
    setToolRailPosition(snapped);
    updateLayout({ toolRailPosition: snapped });
  }

  // --- Right Panel Drag ---
  function beginRightPanelDrag(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    rightPanelDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rightPanelPosition.x,
      originY: rightPanelPosition.y,
    };
  }

  function snapRightPanelPosition(pos: { x: number; y: number }) {
    const container = dockBodyRef.current;
    const panel = rightPanelRef.current;
    if (!container || !panel) return pos;
    const bounds = container.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const maxX = bounds.width - panelRect.width - 8;
    const maxY = bounds.height - panelRect.height - 8;
    const clamped = {
      x: clamp(pos.x, 8, Math.max(8, maxX)),
      y: clamp(pos.y, 8, Math.max(8, maxY)),
    };
    return clamped;
  }

  function moveRightPanel(e: React.PointerEvent) {
    if (!rightPanelDragRef.current) return;
    const drag = rightPanelDragRef.current;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    pendingRightPanelRef.current = { x: drag.originX + dx, y: drag.originY + dy };
    if (rightPanelRafRef.current !== null) return;
    rightPanelRafRef.current = window.requestAnimationFrame(() => {
      if (pendingRightPanelRef.current) {
        setRightPanelPosition(pendingRightPanelRef.current);
      }
      rightPanelRafRef.current = null;
    });
  }

  function endRightPanelDrag() {
    if (!rightPanelDragRef.current) return;
    rightPanelDragRef.current = null;
    const snapped = snapRightPanelPosition(rightPanelPosition);
    setRightPanelPosition(snapped);
    updateLayout({ rightPanelPosition: snapped });
  }

  function handlePointerMove(e: React.PointerEvent) {
    onDragMove(e);
    moveToolRail(e);
    moveRightPanel(e);
  }

  function handlePointerUp() {
    endDrag();
    endToolRailDrag();
    endRightPanelDrag();
  }

  function toggleLeftPanel() {
    setShowLeftPanel((prev) => {
      const next = !prev;
      updateLayout({ leftPanelVisible: next });
      // Also ensure it's "open" in local state if we are showing it
      setIsToolRailOpen(next);
      return next;
    });
  }

  function toggleRightPanel() {
    setShowRightPanel((prev) => {
      const next = !prev;
      updateLayout({ rightPanelVisible: next });
      setIsRightPanelOpen(next);
      return next;
    });
  }

  function toggleTimeline() {
    setShowTimeline((prev) => {
      const next = !prev;
      updateLayout({ timelineVisible: next });
      return next;
    });
  }

  function resetLayout() {
    updateLayout(defaultLayout);
  }

  // Mobile Sheet State
  const [activeMobileSheet, setActiveMobileSheet] = useState<"tools" | "layers" | "palette" | "options" | null>(null);

  // Mobile Render
  if (isMobile || isTablet) {
    return (
      <div className="dock dock--mobile">
        {/* Slim Top Bar for Gallery/Branding */}
        <div className="dock__top" style={{ height: 44 }}>
          <button
            className="uiBtn uiBtn--ghost"
            onClick={() => {
              if (onNavigateToDashboard) onNavigateToDashboard();
            }}
            style={{ marginLeft: 8 }}
          >
            ☰ <span className="mobile-label">Gallery</span>
          </button>
        </div>

        {/* Canvas Body - Room for top and bottom dock */}
        <div className="dock__body" style={{ top: 44, height: "calc(100vh - 44px - 64px)" }}>
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
            showMinimap={isTablet && !isMobile}
          />
        </div>

        {/* Bottom Dock */}
        <MobileBottomDock
          tool={tool}
          onChangeTool={onChangeTool}
          settings={settings}
          onChangeSettings={onChangeSettings}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenSheet={setActiveMobileSheet}
        />

        {/* Tool Picker Sheet */}
        <MobileSheet
          isOpen={activeMobileSheet === "tools"}
          title="Select Tool"
          onClose={() => setActiveMobileSheet(null)}
        >
          <ToolRail tool={tool} onChangeTool={(t) => { onChangeTool(t); setActiveMobileSheet(null); }} />
        </MobileSheet>

        {/* Layers Sheet */}
        <MobileSheet
          isOpen={activeMobileSheet === "layers"}
          title="Layers"
          onClose={() => setActiveMobileSheet(null)}
        >
          {layers && activeLayerId && onLayerOperations && (
            <RightPanel
              tool={tool}
              settings={settings}
              onChangeSettings={onChangeSettings}
              canvasSpec={canvasSpec}
              collapsed={false}
              layers={layers}
              activeLayerId={activeLayerId}
              onLayerOperations={onLayerOperations}
              palettes={palettes}
              activePaletteId={activePaletteId}
              recentColors={recentColors}
              onPaletteOperations={onPaletteOperations}
              onTransformOperations={onTransformOperations}
              onColorAdjustOperations={onColorAdjustOperations}
              onSelectionOperations={onSelectionOperations}
            />
          )}
        </MobileSheet>

        {/* Palette Sheet */}
        <MobileSheet
          isOpen={activeMobileSheet === "palette"}
          title="Colors"
          onClose={() => setActiveMobileSheet(null)}
        >
          {/* Render only palette section if needed - For now using RightPanel */}
          {palettes && activePaletteId && onPaletteOperations && (
            <RightPanel
              tool={tool}
              settings={settings}
              onChangeSettings={onChangeSettings}
              canvasSpec={canvasSpec}
              collapsed={false}
              layers={layers}
              activeLayerId={activeLayerId}
              onLayerOperations={onLayerOperations}
              palettes={palettes}
              activePaletteId={activePaletteId}
              recentColors={recentColors}
              onPaletteOperations={onPaletteOperations}
              onTransformOperations={onTransformOperations}
              onColorAdjustOperations={onColorAdjustOperations}
              onSelectionOperations={onSelectionOperations}
            />
          )}
        </MobileSheet>

        {/* Tool Options Sheet */}
        <MobileSheet
          isOpen={activeMobileSheet === "options"}
          title="Tool Settings"
          onClose={() => setActiveMobileSheet(null)}
        >
          <RightPanel
            tool={tool}
            settings={settings}
            onChangeSettings={onChangeSettings}
            canvasSpec={canvasSpec}
            collapsed={false}
            layers={layers}
            activeLayerId={activeLayerId}
            onLayerOperations={onLayerOperations}
            palettes={palettes}
            activePaletteId={activePaletteId}
            recentColors={recentColors}
            onPaletteOperations={onPaletteOperations}
            onTransformOperations={onTransformOperations}
            onColorAdjustOperations={onColorAdjustOperations}
            onSelectionOperations={onSelectionOperations}
          />
        </MobileSheet>

        {/* Tablet Floating Tool Rail */}
        {isTablet && !isMobile && (
          <div className="dock__floatingToolRail" style={{ left: 12, top: 56, bottom: 'auto', maxHeight: 'calc(100vh - 130px)' }}>
            <ToolRail tool={tool} onChangeTool={onChangeTool} />
          </div>
        )}
      </div>
    );
  }

  // Desktop Floating Layout
  return (
    <div
      className={
        "dock dock--floating-panels" +
        (isToolRailOpen ? " dock--left-open" : "") +
        (isRightPanelOpen ? " dock--right-open" : "") +
        (!showLeftPanel ? " dock--left-hidden" : "") +
        (!showRightPanel ? " dock--right-hidden" : "") +
        (!showTimeline ? " dock--timeline-collapsed" : "") +
        (isZenMode ? " dock--zen" : "")
      }
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        "--leftPanelWidth": "0px",
        "--rightPanelWidth": "0px",
        "--timelineHeight": "0px",
        "--vSplitterWidth": "0px",
        "--hSplitterHeight": "0px",
      } as React.CSSProperties}
    >
      {isZenMode && (
         <button className="zen-exit-btn" onClick={() => setIsZenMode(false)}>
           Exit Zen Mode (Tab)
         </button>
      )}

      <div className="dock__top">
        <div className="dock__topbar">{topBar}</div>
        <div className="dock__panelControls">
          <button
            className="uiBtn uiBtn--ghost"
            onClick={toggleLeftPanel}
          >
            {showLeftPanel ? "Close Tools" : "Tools"}
          </button>
          
          <button
            className="uiBtn uiBtn--ghost"
            onClick={toggleTimeline}
          >
            Timeline
          </button>

          <button
            className="uiBtn uiBtn--ghost"
            onClick={toggleRightPanel}
          >
            {showRightPanel ? "Close Panel" : "Panel"}
          </button>
          
          <button
            className="uiBtn uiBtn--ghost"
            onClick={() => setIsZenMode((prev) => !prev)}
            title="Toggle Zen Mode (Tab)"
          >
            {isZenMode ? "◼" : "◻"} Zen
          </button>
        </div>
      </div>

      <div className="dock__body" ref={dockBodyRef}>
        
        {/* Floating Tool Rail */}
        {showLeftPanel && (
           <div 
             className="dock__floatingToolRail" 
             ref={toolRailRef}
             style={{ 
               left: toolRailPosition.x, 
               top: toolRailPosition.y,
               height: 'auto',
               maxHeight: 'calc(100vh - 100px)'
             }}
           >
             <div 
               className="dock__floatingToolRailHeader"
               onPointerDown={beginToolRailDrag}
             >
               <span className="dock__floatingToolRailGrip">:::</span>
               <span className="dock__floatingToolRailTitle">Tools</span>
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
            onCommitTransform={onCommitTransform}
            onChangeZoom={(zoom) => onChangeSettings({ ...settings, zoom })}
            onColorPick={onColorPick}
            onCursorMove={onCursorMove}
            remoteCursors={remoteCursors}
            frames={frames}
            currentFrameIndex={currentFrameIndex}
            showMinimap={true}
          />
          
          {/* Zoom Controls Overlay (Under Minimap usually, bottom right area) */}
          <div className="canvas-controls" style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px', // Assuming minimap is top-right? No, minimap is inside CanvasStage usually.
            // User said "Directly under MiniMap". CanvasStage handles minimap position.
            // If I can't easily put it INSIDE CanvasStage without opening it, I'll put it bottom right floating.
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <button className="uiBtn uiBtn--icon" onClick={() => onChangeSettings({ ...settings, zoom: Math.min(64, settings.zoom * 1.5) })}>+</button>
            <button className="uiBtn uiBtn--icon" onClick={() => onChangeSettings({ ...settings, zoom: Math.max(0.1, settings.zoom / 1.5) })}>-</button>
            <div className="uiBtn uiBtn--active" style={{ fontSize: '10px' }}>{Math.round(settings.zoom * 100)}%</div>
          </div>
        </div>

        {/* Floating Right Panel */}
        {showRightPanel && (
           <div 
             className="dock__right"
             ref={rightPanelRef}
             style={{
               position: 'absolute',
               left: rightPanelPosition.x,
               top: rightPanelPosition.y,
               width: rightWidth,
               height: 'auto',
               maxHeight: 'calc(100vh - 100px)',
               zIndex: 250,
               display: 'flex',
               flexDirection: 'column'
             }}
           >
             <div 
               className="dock__floatingPanelHeader"
               onPointerDown={beginRightPanelDrag}
             >
               <span className="dock__floatingPanelGrip">:::</span>
               <span className="dock__floatingPanelTitle">Panel</span>
               <div 
                 className="splitter splitter--v" 
                 style={{ width: '12px', right: 0, position: 'absolute', height: '100%', cursor: 'ew-resize', opacity: 0 }}
                 onPointerDown={(e) => beginDrag("right", e)}
               />
             </div>
             
             <RightPanel
               tool={tool}
               settings={settings}
               onChangeSettings={onChangeSettings}
               canvasSpec={canvasSpec}
               previewBuffer={previewLayerPixels ?? undefined}
               selectionMask={selectionMask}
               layerPixels={layerPixels}
               onInpaint={onInpaint}
               onImageToImage={onImageToImage}
               collapsed={isRightPanelCollapsed}
               layers={layers}
               activeLayerId={activeLayerId}
               palettes={palettes}
               activePaletteId={activePaletteId}
               recentColors={recentColors}
               onLayerOperations={onLayerOperations}
               onPaletteOperations={onPaletteOperations}
               onTransformOperations={onTransformOperations}
               onColorAdjustOperations={onColorAdjustOperations}
               onSelectionOperations={onSelectionOperations}
             />
           </div>
        )}

        {/* Floating Timeline */}
        {showTimeline && (
          <div 
             className="dock__bottom"
             style={{
               position: 'absolute',
               ...(timelinePosition 
                 ? { left: timelinePosition.x, top: timelinePosition.y, transform: 'translate(-50%, -50%)' }
                 : { left: '50%', bottom: '20px', transform: 'translateX(-50%)' }
               ),
               width: '80%',
               maxWidth: '800px',
               height: timelineHeight,
               zIndex: 240,
               borderRadius: '8px',
               boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
               border: '1px solid var(--border-strong)',
               display: 'flex',
               flexDirection: 'column'
             }}
             onPointerMove={moveTimeline}
             onPointerUp={endTimelineMove}
             onPointerCancel={endTimelineMove}
          >
             <div 
                className="dock__floatingPanelHeader" 
                style={{ justifyContent: 'center', background: 'var(--bg-1)', cursor: 'grab' }}
                onPointerDown={beginTimelineMove}
             >
                <span>Timeline</span>
             </div>
             <Timeline
                settings={settings}
                onChangeSettings={onChangeSettings}
                timelineVisible={showTimeline}
                onToggleTimeline={toggleTimeline}
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
                onReorderFrames={onReorderFrames}
                dragDropEnabled
             />
             {/* Corner Resize Handle */}
             <div 
               className="resize-handle resize-handle--corner"
               style={{
                 position: 'absolute',
                 right: 0,
                 bottom: 0,
                 width: '16px',
                 height: '16px',
                 cursor: 'nwse-resize',
                 background: 'linear-gradient(135deg, transparent 50%, var(--border-strong) 50%)',
                 borderRadius: '0 0 8px 0'
               }}
               onPointerDown={(e) => beginDrag("timeline", e)}
               onPointerMove={onDragMove}
               onPointerUp={endDrag}
               onPointerCancel={endDrag}
             />
          </div>
        )}
      </div>

       {!isZenMode && statusBar && (
        <div className="dock__status">
          {statusBar}
        </div>
      )}
    </div>
  );
}
