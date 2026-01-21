import React, { useEffect, useMemo, useRef } from "react";
import { CanvasSpec, ToolId, UiSettings } from "../types";
import { cloneBuffer, drawLine, hexToRgb } from "../editor/pixels";

/**
 * CanvasStage: real drawing canvas.
 *
 * Important goals:
 * - Pixel-correct rendering (no blur): imageSmoothingEnabled = false
 * - Tools: Pen + Eraser (v0.1.1)
 * - Brush Stabilizer toggle: smooths the raw pointer path
 * - History: we only commit undo snapshot on stroke end (if pixels changed)
 */
export default function CanvasStage(props: {
  settings: UiSettings;
  tool: ToolId;
  canvasSpec: CanvasSpec;
  buffer: Uint8ClampedArray;
  onStrokeEnd: (before: Uint8ClampedArray, after: Uint8ClampedArray) => void;
}) {
  const { settings, tool, canvasSpec, buffer, onStrokeEnd } = props;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // We keep a mutable reference so we can draw without forcing React rerenders.
  const bufRef = useRef<Uint8ClampedArray>(buffer);

  // When buffer prop changes (e.g., undo/redo), update our ref and redraw.
  useEffect(() => {
    bufRef.current = buffer;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, settings.zoom, settings.showGrid, settings.gridSize, settings.backgroundMode, settings.checkerSize, settings.checkerA, settings.checkerB]);

  // Stroke state
  const strokeRef = useRef<{
    active: boolean;
    changed: boolean;
    beforeSnapshot: Uint8ClampedArray | null;
    lastX: number;
    lastY: number;

    // Stabilizer state: we keep smoothed floating positions.
    smoothX: number;
    smoothY: number;
    hasSmooth: boolean;
  }>({
    active: false,
    changed: false,
    beforeSnapshot: null,
    lastX: -1,
    lastY: -1,
    smoothX: 0,
    smoothY: 0,
    hasSmooth: false
  });

  const bgClass = useMemo(() => {
    switch (settings.backgroundMode) {
      case "checker":
        return "stage stage--checker";
      case "solidDark":
        return "stage stage--dark";
      case "solidLight":
        return "stage stage--light";
      case "greenscreen":
        return "stage stage--green";
      case "bluescreen":
        return "stage stage--blue";
      default:
        return "stage stage--checker";
    }
  }, [settings.backgroundMode]);

  const stageStyle = useMemo(() => {
    // These CSS variables allow user-custom checkerboard.
    return {
      ["--checkerSize" as any]: `${settings.checkerSize}px`,
      ["--checkerA" as any]: settings.checkerA,
      ["--checkerB" as any]: settings.checkerB
    };
  }, [settings.checkerSize, settings.checkerA, settings.checkerB]);

  function cssPx(n: number) {
    return Math.max(1, Math.floor(n));
  }

  function getDrawColor(): { r: number; g: number; b: number; a: number } {
    if (tool === "eraser") return { r: 0, g: 0, b: 0, a: 0 };
    const { r, g, b } = hexToRgb(settings.primaryColor);
    return { r, g, b, a: 255 };
  }

  function applyStabilizer(rawX: number, rawY: number): { x: number; y: number } {
    // This is a simple exponential smoothing filter.
    // Higher alpha = follows pointer more closely.
    // Lower alpha = smoother but more delayed.
    const alpha = 0.35;

    const st = strokeRef.current;
    if (!settings.brushStabilizerEnabled) {
      st.hasSmooth = false;
      return { x: rawX, y: rawY };
    }

    if (!st.hasSmooth) {
      st.smoothX = rawX;
      st.smoothY = rawY;
      st.hasSmooth = true;
      return { x: rawX, y: rawY };
    }

    st.smoothX = st.smoothX + alpha * (rawX - st.smoothX);
    st.smoothY = st.smoothY + alpha * (rawY - st.smoothY);

    return { x: st.smoothX, y: st.smoothY };
  }

  function pointerToPixel(e: React.PointerEvent): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;

    const rect = stage.getBoundingClientRect();

    // The canvas image is centered in the stage.
    const zoom = settings.zoom;
    const imgW = canvasSpec.width * zoom;
    const imgH = canvasSpec.height * zoom;

    const originX = (rect.width - imgW) / 2;
    const originY = (rect.height - imgH) / 2;

    const localX = e.clientX - rect.left - originX;
    const localY = e.clientY - rect.top - originY;

    const px = Math.floor(localX / zoom);
    const py = Math.floor(localY / zoom);

    if (px < 0 || py < 0 || px >= canvasSpec.width || py >= canvasSpec.height) return null;
    return { x: px, y: py };
  }

  function beginStroke(e: React.PointerEvent) {
    const p = pointerToPixel(e);
    if (!p) return;

    // Capture pointer so we keep getting move events even if cursor leaves the stage.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const st = strokeRef.current;
    st.active = true;
    st.changed = false;
    st.beforeSnapshot = cloneBuffer(bufRef.current);
    st.lastX = p.x;
    st.lastY = p.y;
    st.hasSmooth = false;

    // Draw the initial pixel immediately.
    const c = getDrawColor();
    const did = drawLine(bufRef.current, canvasSpec.width, canvasSpec.height, p.x, p.y, p.x, p.y, c);
    if (did) st.changed = true;

    draw();
  }

  function moveStroke(e: React.PointerEvent) {
    const st = strokeRef.current;
    if (!st.active) return;

    const p0 = pointerToPixel(e);
    if (!p0) return;

    // Stabilizer works on float-space before we quantize to pixels.
    const stabilized = applyStabilizer(p0.x + 0.5, p0.y + 0.5);

    const x = Math.floor(stabilized.x);
    const y = Math.floor(stabilized.y);

    if (x === st.lastX && y === st.lastY) return;

    const c = getDrawColor();
    const did = drawLine(bufRef.current, canvasSpec.width, canvasSpec.height, st.lastX, st.lastY, x, y, c);
    if (did) st.changed = true;

    st.lastX = x;
    st.lastY = y;

    draw();
  }

  function endStroke() {
    const st = strokeRef.current;
    if (!st.active) return;

    st.active = false;

    // Only commit history if pixels actually changed.
    if (st.changed && st.beforeSnapshot) {
      const after = cloneBuffer(bufRef.current);
      onStrokeEnd(st.beforeSnapshot, after);
    }

    st.beforeSnapshot = null;
    st.hasSmooth = false;
  }

  function draw() {
    const cnv = canvasRef.current;
    const stage = stageRef.current;
    if (!cnv || !stage) return;

    const rect = stage.getBoundingClientRect();

    // Match canvas to stage pixels (not image pixels!)
    const w = cssPx(rect.width);
    const h = cssPx(rect.height);
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;

    const ctx = cnv.getContext("2d");
    if (!ctx) return;

    // Clear (transparent so stage background shows through)
    ctx.clearRect(0, 0, w, h);

    // Prepare an ImageData from the buffer (sprite pixels).
    const img = new ImageData(bufRef.current, canvasSpec.width, canvasSpec.height);

    // We draw sprite pixels scaled by zoom in the center.
    ctx.imageSmoothingEnabled = false;

    const zoom = settings.zoom;
    const imgW = canvasSpec.width * zoom;
    const imgH = canvasSpec.height * zoom;

    const originX = Math.floor((w - imgW) / 2);
    const originY = Math.floor((h - imgH) / 2);

    // Offscreen canvas approach (keeps scaling crisp and simple)
    const off = getOffscreen(canvasSpec.width, canvasSpec.height);
    const offCtx = off.getContext("2d")!;
    offCtx.putImageData(img, 0, 0);

    ctx.drawImage(off, 0, 0, canvasSpec.width, canvasSpec.height, originX, originY, imgW, imgH);

    // Optional grid (only draw when zoom is big enough, otherwise it becomes visual noise)
    if (settings.showGrid && zoom >= 6) {
      drawGrid(ctx, originX, originY, canvasSpec.width, canvasSpec.height, zoom, settings.gridSize);
    }

    // Frame outline
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.strokeRect(originX + 0.5, originY + 0.5, imgW - 1, imgH - 1);
  }

  return (
    <div ref={stageRef} className={bgClass} style={stageStyle}>
      <div className="stage__hud">
        <div className="hudpill">
          Tool: <span className="mono">{tool}</span>
        </div>
        <div className="hudpill">
          Canvas:{" "}
          <span className="mono">
            {canvasSpec.width}×{canvasSpec.height}
          </span>
        </div>
        <div className="hudpill">
          Stabilizer: <span className="mono">{settings.brushStabilizerEnabled ? "ON" : "OFF"}</span>
        </div>
      </div>

      {/* The drawing surface (transparent) */}
      <canvas
        ref={canvasRef}
        className="stage__canvas"
        onPointerDown={beginStroke}
        onPointerMove={moveStroke}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
      />
    </div>
  );
}

/** A small offscreen canvas reused for every draw call. */
let _offscreen: HTMLCanvasElement | null = null;
function getOffscreen(w: number, h: number): HTMLCanvasElement {
  if (!_offscreen) _offscreen = document.createElement("canvas");
  if (_offscreen.width !== w) _offscreen.width = w;
  if (_offscreen.height !== h) _offscreen.height = h;
  return _offscreen;
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  spriteW: number,
  spriteH: number,
  zoom: number,
  gridSize: number
) {
  const step = Math.max(1, gridSize) * zoom;

  // Minor grid
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= spriteW; x += gridSize) {
    const px = originX + x * zoom + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, originY);
    ctx.lineTo(px, originY + spriteH * zoom);
    ctx.stroke();
  }

  for (let y = 0; y <= spriteH; y += gridSize) {
    const py = originY + y * zoom + 0.5;
    ctx.beginPath();
    ctx.moveTo(originX, py);
    ctx.lineTo(originX + spriteW * zoom, py);
    ctx.stroke();
  }

  // A slightly stronger grid every 8*gridSize (helps orientation)
  const majorEvery = 8 * gridSize;
  if (majorEvery > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    for (let x = 0; x <= spriteW; x += majorEvery) {
      const px = originX + x * zoom + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, originY);
      ctx.lineTo(px, originY + spriteH * zoom);
      ctx.stroke();
    }
    for (let y = 0; y <= spriteH; y += majorEvery) {
      const py = originY + y * zoom + 0.5;
      ctx.beginPath();
      ctx.moveTo(originX, py);
      ctx.lineTo(originX + spriteW * zoom, py);
      ctx.stroke();
    }
  }

  // Keep ts happy for now
  void step;
}
