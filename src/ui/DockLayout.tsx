import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ToolRail from "./ToolRail";
import ToolBar from "./ToolBar";
import RightPanel from "./RightPanel";
import MobileHeader from "./MobileHeader";
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
  
  onNavigateToDashboard?: () => void;

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
  const [rightPanelPosition, setRightPanelPosition] = useState(
    layout.rightPanelPosition ?? { x: 24, y: 84 }
  );
  // Force floating mode for desktop too, as requested
  const isPanelFloating = true; 

  // ... (previous effects)

  // Zen Mode Exit Button
  const zenExitButton = isZenMode ? (
    <button className="zen-exit-btn" onClick={() => setIsZenMode(false)}>
      Exit Zen Mode (Tab)
    </button>
  ) : null;

  // Desktop Figma-style Mode (Now Floating)
  return (
    <div
      className={
        "dock" +
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
        "--leftPanelWidth": "0px", // Floating means no grid space
        "--rightPanelWidth": "0px",
        "--timelineHeight": "0px",
        // Focus the grid entirely on center
        "--vSplitterWidth": "0px",
        "--hSplitterHeight": "0px",
      } as React.CSSProperties}
    >
      {zenExitButton}
      
      <div className="dock__top">
        <div className="dock__topbar">{topBar}</div>
        <div className="dock__panelControls">
          <button
            className="uiBtn uiBtn--ghost"
            onClick={toggleLeftPanel}
            title={leftPanelTitle}
          >
            {isToolRailOpen ? "Close Tools" : "Tools"}
          </button>
          
          <button
            className="uiBtn uiBtn--ghost"
            onClick={toggleTimeline}
            title={showTimeline ? "Hide timeline" : "Show timeline"}
          >
            Timeline
          </button>

          <button
            className="uiBtn uiBtn--ghost"
            onClick={toggleRightPanel}
            title={rightPanelTitle}
          >
            {isRightPanelOpen ? "Close Panel" : "Panel"}
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
               left: '50%',
               bottom: '20px',
               transform: 'translateX(-50%)',
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
          >
             {/* Simple drag handle for timeline could be added here if needed, or drag via header */}
             <div className="dock__floatingPanelHeader" style={{ justifyContent: 'center', background: 'var(--bg-1)' }}>
                <span>Timeline</span>
             </div>
             <Timeline
                settings={settings}
                onChangeSettings={onChangeSettings}
                frames={frames}
                currentFrameIndex={currentFrameIndex}
                isPlaying={isPlaying}
                onSelectFrame={onSelectFrame}
                onInsertFrame={onInsertFrame}
                onDuplicateFrame={onDuplicateFrame}
                onDeleteFrame={onDeleteFrame}
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
             />
          </div>
        )}
      </div>
    </div>
  );              onLayerOperations={onLayerOperations}
              palettes={palettes}
              activePaletteId={activePaletteId}
              recentColors={recentColors}
              onPaletteOperations={onPaletteOperations}
              onTransformOperations={onTransformOperations}
              onColorAdjustOperations={onColorAdjustOperations}
              hasSelection={selection !== null}
              onSelectionOperations={onSelectionOperations}
            />
          </>
        )}
      </div>

      {showTimeline && (
        <>
          <div
            className="splitter splitter--h"
            title="Drag to resize timeline"
            onPointerDown={(e) => beginDrag("timeline", e)}
          />
          <div className="dock__bottom">
            <Timeline
              settings={settings}
              onChangeSettings={onChangeSettings}
              timelineVisible={showTimeline}
              onToggleTimeline={(next) => {
                setShowTimeline(next);
                updateLayout({ timelineVisible: next });
              }}
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
          </div>
        </>
      )}

      {!isZenMode && statusBar && (
        <div className="dock__status">
          {statusBar}
        </div>
      )}
    </div>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
