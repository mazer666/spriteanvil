import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import ToolRail from "./ToolRail";
import RightPanel from "./RightPanel";
import Timeline from "./Timeline";
import CanvasStage from "./CanvasStage";
import { UiSettings } from "../types";

type Props = {
  settings: UiSettings;
  onChangeSettings: (next: UiSettings) => void;
  topBar: ReactNode;
};

/**
 * DockLayout: Resizable Panels (Dock-Panels) mit Splittern.
 *
 * Layout:
 * - Left: ToolRail (fix)
 * - Center: CanvasStage (flex)
 * - Right: RightPanel (resizable width)
 * - Bottom: Timeline (resizable height)
 *
 * Wir speichern Panel-Größen in localStorage, damit sich die App "merkt",
 * wie der User es eingestellt hat (gute UX).
 */
export default function DockLayout({ settings, onChangeSettings, topBar }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Default sizes
  const [rightWidth, setRightWidth] = useState<number>(() => loadNumber("dock:rightWidth", 360));
  const [timelineHeight, setTimelineHeight] = useState<number>(() =>
    loadNumber("dock:timelineHeight", 200)
  );

  // Persist sizes
  useEffect(() => saveNumber("dock:rightWidth", rightWidth), [rightWidth]);
  useEffect(() => saveNumber("dock:timelineHeight", timelineHeight), [timelineHeight]);

  const sizes = useMemo(() => ({ rightWidth, timelineHeight }), [rightWidth, timelineHeight]);

  // Drag logic for splitters (Pointer Events)
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
      const next = clamp(st.startRightWidth + dx, 260, 700);
      setRightWidth(next);
    } else {
      const dy = st.startY - e.clientY; // drag up increases height
      const next = clamp(st.startTimelineHeight + dy, 140, 420);
      setTimelineHeight(next);
    }
  }

  function endDrag() {
    dragStateRef.current = null;
  }

  return (
    <div
      ref={containerRef}
      className="dock"
      onPointerMove={onDragMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="dock__top">{topBar}</div>

      <div className="dock__body">
        <div className="dock__left">
          <ToolRail />
        </div>

        <div className="dock__center">
          <CanvasStage settings={settings} />
        </div>

        {/* Vertical splitter between center and right */}
        <div
          className="splitter splitter--v"
          title="Drag to resize panel"
          onPointerDown={(e) => beginDrag("right", e)}
        />

        <div className="dock__right" style={{ width: sizes.rightWidth }}>
          <RightPanel settings={settings} onChangeSettings={onChangeSettings} />
        </div>
      </div>

      {/* Horizontal splitter above timeline */}
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
    // ignore (private mode etc.)
  }
}
