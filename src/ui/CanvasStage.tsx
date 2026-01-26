import React, { useEffect, useMemo, useRef, useState } from "react";
import { CanvasSpec, ToolId, UiSettings } from "../types";
import { PixelBuffer, cloneBuffer, drawLine, floodFill, hexToRgb } from "../editor/pixels";
import {
  SelectionMask,
  magicWandSelect,
  selectionBounds,
  selectionHasAny,
  selectionOutline
} from "../editor/selection";

/**
 * src/ui/CanvasStage.tsx
 * -----------------------------------------------------------------------------
 * CanvasStage: drawing canvas + selection visualization.
 *
 * Tools:
 * - Pen
 * - Eraser
 * - Fill
 * - Magic Wand (creates selection, shows marching-ants outline)
 *
 * IMPORTANT FIX:
 * We run a requestAnimationFrame loop for marching ants.
 * That loop must always draw with the LATEST settings + selection.
 * => We store settings/selection in refs and draw reads from refs.
 *
 * Clipboard:
 * - Ctrl+C copies the selection as PNG (if selection exists)
 * - If no selection: copies full frame as PNG
 * - ESC clears selection
 */
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

  // Refs to always have the latest values inside the animation loop
  const settingsRef = useRef<UiSettings>(settings);
  const toolRef = useRef<ToolId>(tool);
  const canvasSpecRef = useRef<CanvasSpec>(canvasSpec);
  const bufRef = useRef<PixelBuffer>(buffer);

  // Selection state + ref mirror
  const [selection, setSelection] = useState<SelectionMask>(() => new Uint8Array(canvasSpec.width * canvasSpec.height));
  const selectionRef = useRef<SelectionMask>(selection);

  // Marching ants phase
  const antsPhaseRef = useRef<number>(0);

  // Update refs on every render
  useEffect(() => {
    settingsRef.current = settings;
    toolRef.current = tool;
    canvasSpecRef.current = canvasSpec;
    bufRef.current = buffer;

    // If canvas size changes in the future, ensure selection matches size
    const expectedLen = canvasSpec.width * canvasSpec.height;
    if (selectionRef.current.length !== expectedLen) {
      const next = new Uint8Array(expectedLen);
      selectionRef.current = next;
      setSelection(next);
    }

    // When anything changes, we redraw once immediately
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, tool, canvasSpec, buffer]);

  // Keep selection ref in sync
  useEffect(() => {
    selectionRef.current = selection;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  // Animation loop for marching ants (runs once, uses refs for latest values)
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      antsPhaseRef.current = (antsPhaseRef.current + 1) % 8;
      draw();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: Ctrl+C copies selection/frame, ESC clears selection
  useEffect(() => {
    function isTextInput(el: Element | null): boolean {
      if (!el) return false;
      const tag = (el as HTMLElement).tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
    }

    async function onKeyDown(e: KeyboardEvent) {
      if (isTextInput(document.activeElement)) return;

      // Clear selection
      if (e.key === "Escape") {
        if (selectionHasAny(selectionRef.current)) {
          const empty = new Uint8Array(selectionRef.current.length);
          selectionRef.current = empty;
          setSelection(empty);
        }
        return;
      }

      // Copy (Ctrl+C)
      if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        await copyToClipboard();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const s = settingsRef.current;
    const t = toolRef.current;

    if (t === "eraser") return { r: 0, g: 0, b: 0, a: 0 };

    const { r, g, b } = hexToRgb(s.primaryColor);
    return { r, g, b, a: 255 };
  }

  function applyStabilizer(rawX: number, rawY: number): { x: number; y: number } {
    const s = settingsRef.current;
    const alpha = 0.35;

    const st = strokeRef.current;
    if (!s.brushStabilizerEnabled) {
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

    const s = settingsRef.current;
    const spec = canvasSpecRef.current;

    const zoom = s.zoom;
    const imgW = spec.width * zoom;
    const imgH = spec.height * zoom;

    const originX = (rect.width - imgW) / 2;
    const originY = (rect.height - imgH) / 2;

    const localX = e.clientX - rect.left - originX;
    const localY = e.clientY - rect.top - originY;

    const px = Math.floor(localX / zoom);
    const py = Math.floor(localY / zoom);

    if (px < 0 || py < 0 || px >= spec.width || py >= spec.height) return null;
    return { x: px, y: py };
  }

  // Stroke state (for pen/eraser)
  const strokeRef = useRef<{
    active: boolean;
    changed: boolean;
    beforeSnapshot: PixelBuffer | null;
    lastX: number;
    lastY: number;

    // Stabilizer state: smoothed floating positions
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

  function beginStroke(e: React.PointerEvent) {
    const p = pointerToPixel(e);
    if (!p) return;

    const s = settingsRef.current;
    const t = toolRef.current;
    const spec = canvasSpecRef.current;

    // Magic wand: create selection (no stroke)
    if (t === "wand") {
      const sel = magicWandSelect(bufRef.current, spec.width, spec.height, p.x, p.y, s.wandTolerance);
      setSelection(sel);
      return;
    }

    // Fill: one click (no drag)
    if (t === "fill") {
      const before = cloneBuffer(bufRef.current);

      const { r, g, b } = hexToRgb(s.primaryColor);
      const replacement = { r, g, b, a: 255 };

      const changed = floodFill(
        bufRef.current,
        spec.width,
        spec.height,
        p.x,
        p.y,
        replacement,
        s.fillTolerance
      );

      if (changed) {
        const after = cloneBuffer(bufRef.current);
        onStrokeEnd(before, after);
      }
      return;
    }

    // Pen/Eraser: begin drag stroke
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const st = strokeRef.current;
    st.active = true;
    st.changed = false;
    st.beforeSnapshot = cloneBuffer(bufRef.current);
    st.lastX = p.x;
    st.lastY = p.y;
    st.hasSmooth = false;

    const c = getDrawColor();
    const did = drawLine(bufRef.current, spec.width, spec.height, p.x, p.y, p.x, p.y, c);
    if (did) st.changed = true;

    draw();
  }

  function moveStroke(e: React.PointerEvent) {
    const st = strokeRef.current;
    if (!st.active) return;

    const p0 = pointerToPixel(e);
    if (!p0) return;

    const spec = canvasSpecRef.current;

    const stabilized = applyStabilizer(p0.x + 0.5, p0.y + 0.5);
    const x = Math.floor(stabilized.x);
    const y = Math.floor(stabilized.y);

    if (x === st.lastX && y === st.lastY) return;

    const c = getDrawColor();
    const did = drawLine(bufRef.current, spec.width, spec.height, st.lastX, st.lastY, x, y, c);
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

  async function copyToClipboard() {
    const spec = canvasSpecRef.current;
    const buf = bufRef.current;
    const sel = selectionRef.current;

    const hasSel = selectionHasAny(sel);

    // Decide what to copy: selection bounds or full frame
    let xMin = 0;
    let yMin = 0;
    let w = spec.width;
    let h = spec.height;

    if (hasSel) {
      const b = selectionBounds(spec.width, spec.height, sel);
      if (!b) return;
      xMin = b.xMin;
      yMin = b.yMin;
      w = b.width;
      h = b.height;
    }

    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;

    const octx = off.getContext("2d");
    if (!octx) return;

    // Create ImageData for copied pixels
    const img = octx.createImageData(w, h);
    const data = img.data; // Uint8ClampedArray

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = xMin + x;
        const sy = yMin + y;

        const srcIdx = (sy * spec.width + sx) * 4;
        const dstIdx = (y * w + x) * 4;

        const selected = hasSel ? sel[sy * spec.width + sx] === 1 : true;
        if (!selected) {
          // leave transparent
          data[dstIdx + 0] = 0;
          data[dstIdx + 1] = 0;
          data[dstIdx + 2] = 0;
          data[dstIdx + 3] = 0;
          continue;
        }

        data[dstIdx + 0] = buf[srcIdx + 0];
        data[dstIdx + 1] = buf[srcIdx + 1];
        data[dstIdx + 2] = buf[srcIdx + 2];
        data[dstIdx + 3] = buf[srcIdx + 3];
      }
    }

    octx.putImageData(img, 0, 0);

    // Convert to PNG and copy
    const blob: Blob | null = await new Promise((resolve) => off.toBlob(resolve, "image/png"));
    if (!blob) return;

    try {
      // Modern clipboard API (works on https like GitHub Pages)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item = new (window as any).ClipboardItem({ "image/png": blob });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator.clipboard as any).write([item]);
    } catch {
      // Fallback: open PNG in new tab (user can right-click copy/save)
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  }

  function draw() {
    const cnv = canvasRef.current;
    const stage = stageRef.current;
    if (!cnv || !stage) return;

    const rect = stage.getBoundingClientRect();

    const s = settingsRef.current;
    const spec = canvasSpecRef.current;
    const sel = selectionRef.current;

    const w = cssPx(rect.width);
    const h = cssPx(rect.height);
    if (cnv.width !== w) cnv.width = w;
    if (cnv.height !== h) cnv.height = h;

    const ctx = cnv.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    const img = new ImageData(bufRef.current, spec.width, spec.height);

    ctx.imageSmoothingEnabled = false;

    const zoom = s.zoom;
    const imgW = spec.width * zoom;
    const imgH = spec.height * zoom;

    const originX = Math.floor((w - imgW) / 2);
    const originY = Math.floor((h - imgH) / 2);

    const off = getOffscreen(spec.width, spec.height);
    const offCtx = off.getContext("2d")!;
    offCtx.putImageData(img, 0, 0);

    ctx.drawImage(off, 0, 0, spec.width, spec.height, originX, originY, imgW, imgH);

    // Grid
    if (s.showGrid && zoom >= 6) {
      drawGrid(ctx, originX, originY, spec.width, spec.height, zoom, s.gridSize);
    }

    // Selection outline (marching ants)
    if (selectionHasAny(sel) && zoom >= 4) {
      drawSelectionOutline(ctx, originX, originY, spec.width, spec.height, zoom, sel, antsPhaseRef.current);
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
        <div className="hudpill">
          Selection: <span className="mono">{selectionHasAny(selection) ? "YES" : "NO"}</span>
        </div>
        <div className="hudpill">
          Copy: <span className="mono">Ctrl+C</span> · Clear: <span className="mono">ESC</span>
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

/** Offscreen canvas reused for scaling */
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

/**
 * Draw "marching ants" outline for a selection mask.
 */
function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  spriteW: number,
  spriteH: number,
  zoom: number,
  sel: SelectionMask,
  phase: number
) {
  const outline = selectionOutline(spriteW, spriteH, sel);

  for (let y = 0; y < spriteH; y++) {
    for (let x = 0; x < spriteW; x++) {
      const idx = y * spriteW + x;
      if (!outline[idx]) continue;

      const p = (x + y + phase) & 1;
      ctx.fillStyle = p ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.95)";
      ctx.fillRect(originX + x * zoom, originY + y * zoom, zoom, zoom);
    }
  }
}
