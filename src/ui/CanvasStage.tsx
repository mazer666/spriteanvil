import React, { useEffect, useMemo, useRef, useState } from "react";
import { CanvasSpec, ToolId, UiSettings } from "../types";
import { cloneBuffer, drawLine, hexToRgb } from "../editor/pixels";
import { floodFill } from "../editor/tools/fill";
import {
  drawRectangle,
  fillRectangle,
  drawCircle,
  fillCircle
} from "../editor/tools/shapes";
import { selectRectangle } from "../editor/selection";

import { Frame } from "../types";

export default function CanvasStage(props: {
  settings: UiSettings;
  tool: ToolId;
  canvasSpec: CanvasSpec;
  buffer: Uint8ClampedArray;
  onStrokeEnd: (before: Uint8ClampedArray, after: Uint8ClampedArray) => void;
  selection: Uint8Array | null;
  onChangeSelection: (selection: Uint8Array | null) => void;
  frames?: Frame[];
  currentFrameIndex?: number;
}) {
  const { settings, tool, canvasSpec, buffer, onStrokeEnd, selection, onChangeSelection, frames, currentFrameIndex } = props;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bufRef = useRef<Uint8ClampedArray>(buffer);

  const [shapePreview, setShapePreview] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  // Animation frame counter for marching ants
  const [animFrame, setAnimFrame] = useState(0);

  // Animate marching ants when there's an active selection
  useEffect(() => {
    if (!selection) return;

    const interval = setInterval(() => {
      setAnimFrame((f) => (f + 1) % 60);
    }, 50);

    return () => clearInterval(interval);
  }, [selection]);

  useEffect(() => {
    bufRef.current = buffer;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, settings.zoom, settings.showGrid, settings.gridSize, settings.backgroundMode, settings.checkerSize, settings.checkerA, settings.checkerB, shapePreview, selection, animFrame]);

  const strokeRef = useRef<{
    active: boolean;
    changed: boolean;
    beforeSnapshot: Uint8ClampedArray | null;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    smoothX: number;
    smoothY: number;
    hasSmooth: boolean;
  }>({
    active: false,
    changed: false,
    beforeSnapshot: null,
    lastX: -1,
    lastY: -1,
    startX: -1,
    startY: -1,
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
    if (!settings.brushStabilizerEnabled || tool !== "pen") {
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
    st.startX = p.x;
    st.startY = p.y;
    st.hasSmooth = false;

    const c = getDrawColor();

    if (tool === "fill") {
      const pixelsChanged = floodFill(
        bufRef.current,
        canvasSpec.width,
        canvasSpec.height,
        p.x,
        p.y,
        c
      );
      if (pixelsChanged > 0) st.changed = true;
      draw();
      endStroke();
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      const did = drawLine(bufRef.current, canvasSpec.width, canvasSpec.height, p.x, p.y, p.x, p.y, c);
      if (did) st.changed = true;
      draw();
    }

    if (tool === "line" || tool === "rectangle" || tool === "rectangleFilled" || tool === "circle" || tool === "circleFilled" || tool === "selectRect") {
      setShapePreview({ startX: p.x, startY: p.y, endX: p.x, endY: p.y });
    }
  }

  function moveStroke(e: React.PointerEvent) {
    const st = strokeRef.current;
    if (!st.active) return;

    const p0 = pointerToPixel(e);
    if (!p0) return;

    if (tool === "pen" || tool === "eraser") {
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

    if (tool === "line" || tool === "rectangle" || tool === "rectangleFilled" || tool === "circle" || tool === "circleFilled" || tool === "selectRect") {
      setShapePreview({ startX: st.startX, startY: st.startY, endX: p0.x, endY: p0.y });
    }
  }

  function endStroke() {
    const st = strokeRef.current;
    if (!st.active) return;

    st.active = false;

    const c = getDrawColor();

    if (shapePreview) {
      const { startX, startY, endX, endY } = shapePreview;

      if (tool === "line") {
        const did = drawLine(
          bufRef.current,
          canvasSpec.width,
          canvasSpec.height,
          startX,
          startY,
          endX,
          endY,
          c
        );
        if (did) st.changed = true;
      }

      if (tool === "rectangle") {
        const w = Math.abs(endX - startX) + 1;
        const h = Math.abs(endY - startY) + 1;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const did = drawRectangle(bufRef.current, canvasSpec.width, canvasSpec.height, x, y, w, h, c);
        if (did) st.changed = true;
      }

      if (tool === "rectangleFilled") {
        const w = Math.abs(endX - startX) + 1;
        const h = Math.abs(endY - startY) + 1;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const did = fillRectangle(bufRef.current, canvasSpec.width, canvasSpec.height, x, y, w, h, c);
        if (did) st.changed = true;
      }

      if (tool === "circle" || tool === "circleFilled") {
        const cx = Math.round((startX + endX) / 2);
        const cy = Math.round((startY + endY) / 2);
        const dx = Math.abs(endX - startX);
        const dy = Math.abs(endY - startY);
        const radius = Math.round(Math.max(dx, dy) / 2);

        if (tool === "circle") {
          const did = drawCircle(bufRef.current, canvasSpec.width, canvasSpec.height, cx, cy, radius, c);
          if (did) st.changed = true;
        } else {
          const did = fillCircle(bufRef.current, canvasSpec.width, canvasSpec.height, cx, cy, radius, c);
          if (did) st.changed = true;
        }
      }

      if (tool === "selectRect") {
        const x1 = Math.min(startX, endX);
        const y1 = Math.min(startY, endY);
        const x2 = Math.max(startX, endX);
        const y2 = Math.max(startY, endY);

        const newSelection = selectRectangle(
          canvasSpec.width,
          canvasSpec.height,
          {
            x: x1,
            y: y1,
            width: x2 - x1 + 1,
            height: y2 - y1 + 1
          }
        );

        onChangeSelection(newSelection);
      }

      setShapePreview(null);
    }

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

    const img = new ImageData(
      new Uint8ClampedArray(bufRef.current),
      canvasSpec.width,
      canvasSpec.height
    );

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

    if (settings.showOnionSkin && frames && currentFrameIndex !== undefined) {
      const prevCount = settings.onionPrev;
      const nextCount = settings.onionNext;

      for (let i = 1; i <= prevCount; i++) {
        const frameIndex = currentFrameIndex - i;
        if (frameIndex >= 0 && frameIndex < frames.length) {
          const frame = frames[frameIndex];
          const opacity = 0.3 * (1 - (i - 1) / prevCount);
          drawOnionFrame(ctx, frame.pixels, canvasSpec, originX, originY, imgW, imgH, opacity, "#4bb8bf");
        }
      }

      for (let i = 1; i <= nextCount; i++) {
        const frameIndex = currentFrameIndex + i;
        if (frameIndex >= 0 && frameIndex < frames.length) {
          const frame = frames[frameIndex];
          const opacity = 0.3 * (1 - (i - 1) / nextCount);
          drawOnionFrame(ctx, frame.pixels, canvasSpec, originX, originY, imgW, imgH, opacity, "#f2a03d");
        }
      }
    }

    if (settings.showGrid && zoom >= 6) {
      drawGrid(ctx, originX, originY, canvasSpec.width, canvasSpec.height, zoom, settings.gridSize);
    }

    if (shapePreview) {
      const { startX, startY, endX, endY } = shapePreview;

      ctx.strokeStyle = settings.primaryColor;
      ctx.fillStyle = settings.primaryColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;

      const x1 = originX + startX * zoom;
      const y1 = originY + startY * zoom;
      const x2 = originX + endX * zoom;
      const y2 = originY + endY * zoom;

      if (tool === "line") {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      if (tool === "rectangle" || tool === "rectangleFilled" || tool === "selectRect") {
        const w = x2 - x1;
        const h = y2 - y1;
        if (tool === "rectangleFilled") {
          ctx.fillRect(x1, y1, w, h);
        } else {
          ctx.strokeRect(x1, y1, w, h);
        }
      }

      if (tool === "circle" || tool === "circleFilled") {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const radius = Math.max(dx, dy) / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        if (tool === "circleFilled") {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
    }

    // Render selection with marching ants
    if (selection) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -animFrame / 2;

      // Find selection bounds and draw outline
      for (let y = 0; y < canvasSpec.height; y++) {
        for (let x = 0; x < canvasSpec.width; x++) {
          const idx = y * canvasSpec.width + x;
          if (selection[idx]) {
            const left = x === 0 || !selection[idx - 1];
            const right = x === canvasSpec.width - 1 || !selection[idx + 1];
            const top = y === 0 || !selection[idx - canvasSpec.width];
            const bottom = y === canvasSpec.height - 1 || !selection[idx + canvasSpec.width];

            const px = originX + x * zoom;
            const py = originY + y * zoom;

            ctx.beginPath();
            if (top) {
              ctx.moveTo(px, py);
              ctx.lineTo(px + zoom, py);
            }
            if (bottom) {
              ctx.moveTo(px, py + zoom);
              ctx.lineTo(px + zoom, py + zoom);
            }
            if (left) {
              ctx.moveTo(px, py);
              ctx.lineTo(px, py + zoom);
            }
            if (right) {
              ctx.moveTo(px + zoom, py);
              ctx.lineTo(px + zoom, py + zoom);
            }
            ctx.stroke();
          }
        }
      }

      ctx.restore();
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
        {(tool === "pen" || tool === "eraser") && (
          <div className="hudpill">
            Stabilizer: <span className="mono">{settings.brushStabilizerEnabled ? "ON" : "OFF"}</span>
          </div>
        )}
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
  const step = Math.max(1, gridSize) * zoom;

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

  void step;
}

function drawOnionFrame(
  ctx: CanvasRenderingContext2D,
  pixels: Uint8ClampedArray,
  canvasSpec: CanvasSpec,
  originX: number,
  originY: number,
  imgW: number,
  imgH: number,
  opacity: number,
  tintColor: string
) {
  const off = getOffscreen(canvasSpec.width, canvasSpec.height);
  const offCtx = off.getContext("2d")!;

  const img = new ImageData(
    new Uint8ClampedArray(pixels),
    canvasSpec.width,
    canvasSpec.height
  );

  offCtx.clearRect(0, 0, canvasSpec.width, canvasSpec.height);
  offCtx.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(off, 0, 0, canvasSpec.width, canvasSpec.height, originX, originY, imgW, imgH);
  ctx.restore();
}
