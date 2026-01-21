import React, { useEffect, useMemo, useRef } from "react";
import { CanvasSpec, ToolId, UiSettings } from "../types";
import { PixelBuffer, cloneBuffer, drawLine, hexToRgb } from "../editor/pixels";

export default function CanvasStage(props: {
  settings: UiSettings;
  tool: ToolId;
  canvasSpec: CanvasSpec;
  buffer: PixelBuffer;
  onStrokeEnd: (before: PixelBuffer, after: PixelBuffer) => void;
}) {
  const { settings, tool, canvasSpec, buffer, onStrokeEnd } = props;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // mutable ref for fast drawing
  const bufRef = useRef<PixelBuffer>(buffer);

  useEffect(() => {
    bufRef.current = buffer;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buffer,
    settings.zoom,
    settings.showGrid,
    settings.gridSize,
    settings.backgroundMode,
    settings.checkerSize,
    settings.checkerA,
    settings.checkerB
  ]);

  const strokeRef = useRef<{
    active: boolean;
    changed: boolean;
    beforeSnapshot: PixelBuffer | null;
    lastX: number;
    lastY: number;
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

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const st = strokeRef.current;
    st.active = true;
    st.changed = false;
    st.beforeSnapshot = cloneBuffer(bufRef.current);
    st.lastX = p.x;
    st.lastY = p.y;
    st.hasSmooth = false;

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

    const w = cssPx(rect.width);
    const h = cssPx(rect.height);
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;

    const ctx = cnv.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    // ✅ This now matches TypeScript's DOM typing expectations.
    const img = new ImageData(bufRef.current, canvasSpec.width, canvasSpec.height);

    ctx.imageSmoothingEnabled = false;

    const zoom = settings.zoom;
    const imgW = canvasSpec.width * zoom;
    const imgH = canvasSpec.height * zoom;

    const originX = Math.floor((w - imgW) / 2);
    const originY = Math.floor((h - imgH) / 2);

    const off = getOffscreen(canvasSpec.width, canvasSpec.height);
    const offCtx = off.getContext("2d")!;
    offCtx.putImageData(img, 0, 0);

    ctx.drawImage(off, 0, 0, canvasSpec.width, canvasSpec.height, originX, originY, imgW, imgH);

    if (settings.showGrid && zoom >= 6) {
      drawGrid(ctx, originX, originY, canvasSpec.width, canvasSpec.height, zoom, settings.gridSize);
    }

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
}
