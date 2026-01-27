import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ToolRail from "./ToolRail";
import RightPanel from "./RightPanel";
import Timeline from "./Timeline";
import CanvasStage from "./CanvasStage";
import { CanvasSpec, ToolId, UiSettings } from "../types";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;

  tool: ToolId;
  onChangeTool: (tool: ToolId) => void;

  canvasSpec: CanvasSpec;
  buffer: Uint8ClampedArray;
  onStrokeEnd: (before: Uint8ClampedArray, after: Uint8ClampedArray) => void;

  selection: Uint8Array | null;
  onChangeSelection: (selection: Uint8Array | null) => void;

  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  topBar: ReactNode;
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
  onStrokeEnd,
  selection,
  onChangeSelection,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  topBar
}: Props) {
  const [rightWidth, setRightWidth] = useState<number>(() => loadNumber("dock:rightWidth", 280));
  const [timelineHeight, setTimelineHeight] = useState<number>(() =>
    loadNumber("dock:timelineHeight", 160)
  );

  useEffect(() => saveNumber("dock:rightWidth", rightWidth), [rightWidth]);
  useEffect(() => saveNumber("dock:timelineHeight", timelineHeight), [timelineHeight]);

  const sizes = useMemo(() => ({ rightWidth, timelineHeight }), [rightWidth, timelineHeight]);

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
    <div className="dock" onPointerMove={onDragMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      <div className="dock__top">{topBar}</div>

      <div className="dock__body">
        <div className="dock__left">
          <ToolRail tool={tool} onChangeTool={onChangeTool} />
        </div>

        <div className="dock__center">
          <CanvasStage
            settings={settings}
            tool={tool}
            canvasSpec={canvasSpec}
            buffer={buffer}
            onStrokeEnd={onStrokeEnd}
            selection={selection}
            onChangeSelection={onChangeSelection}
          />
        </div>

        <div
          className="splitter splitter--v"
          title="Drag to resize panel"
          onPointerDown={(e) => beginDrag("right", e)}
        />

        <div className="dock__right" style={{ width: sizes.rightWidth }}>
          <RightPanel
            settings={settings}
            onChangeSettings={onChangeSettings}
          />
        </div>
      </div>

      <div
        className="splitter splitter--h"
        title="Drag to resize timeline"
        onPointerDown={(e) => beginDrag("timeline", e)}
      />

      <div className="dock__bottom" style={{ height: sizes.timelineHeight }}>
        <Timeline settings={settings} onChangeSettings={onChangeSettings} />
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
