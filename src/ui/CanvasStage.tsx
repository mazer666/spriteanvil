import React, { useEffect, useMemo, useRef, useState } from "react";
import { CanvasSpec, ToolId, UiSettings, LayerData } from "../types";
import { cloneBuffer, drawLine, hexToRgb, getPixel, setPixel } from "../editor/pixels";
import { compositeLayers } from "../editor/layers";
import { floodFill, floodFillWithTolerance } from "../editor/tools/fill";
import { applyFloydSteinbergDither, drawGradient } from "../editor/tools/gradient";
import { drawSymmetryGuides } from "../editor/symmetry";
import {
  drawRectangle,
  fillRectangle,
  drawCircle,
  fillCircle,
  drawEllipse,
  fillEllipse
} from "../editor/tools/shapes";
import {
  getSelectionBounds,
  selectRectangle,
  selectEllipse,
  selectMagicWand,
  selectionIntersection,
  selectionSubtract,
  selectionUnion,
} from "../editor/selection";
import { createLassoSelection, smoothLassoPoints } from "../editor/tools/lasso";
import { copySelection, pasteClipboard, ClipboardData } from "../editor/clipboard";

import { Frame } from "../types";

export default function CanvasStage(props: {
  settings: UiSettings;
  tool: ToolId;
  canvasSpec: CanvasSpec;
  buffer: Uint8ClampedArray;
  compositeBuffer: Uint8ClampedArray;
  layers?: LayerData[];
  activeLayerId?: string | null;
  onStrokeEnd: (before: Uint8ClampedArray, after: Uint8ClampedArray) => void;
  selection: Uint8Array | null;
  onChangeSelection: (selection: Uint8Array | null) => void;
  onColorPick?: (color: string) => void;
  frames?: Frame[];
  currentFrameIndex?: number;
}) {
  const {
    settings,
    tool,
    canvasSpec,
    buffer,
    compositeBuffer,
    layers,
    activeLayerId,
    onStrokeEnd,
    selection,
    onChangeSelection,
    onColorPick,
    frames,
    currentFrameIndex
  } = props;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const bufRef = useRef<Uint8ClampedArray>(buffer);

  const [shapePreview, setShapePreview] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [lassoPreview, setLassoPreview] = useState<{ x: number; y: number }[] | null>(null);
  const [moveSelectionPreview, setMoveSelectionPreview] = useState<Uint8Array | null>(null);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Animation frame counter for marching ants
  const [animFrame, setAnimFrame] = useState(0);
  const isPanningRef = useRef(false);

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
  }, [buffer, compositeBuffer, settings.zoom, settings.showGrid, settings.gridSize, settings.backgroundMode, settings.checkerSize, settings.checkerA, settings.checkerB, shapePreview, lassoPreview, selection, moveSelectionPreview, panOffset, animFrame]);

  useEffect(() => {
    function isInputFocused(): boolean {
      const active = document.activeElement;
      return active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || (active?.hasAttribute("contenteditable") ?? false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " " && !isInputFocused()) {
        isPanningRef.current = true;
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === " ") {
        isPanningRef.current = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
    selectionMode: SelectionMode;
    moveSelection: Uint8Array | null;
    moveClipboard: ClipboardData | null;
    moveBounds: { x: number; y: number; width: number; height: number } | null;
    moveSelectionNext: Uint8Array | null;
    isPanning: boolean;
    panStartX: number;
    panStartY: number;
    panOriginX: number;
    panOriginY: number;
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
    hasSmooth: false,
    selectionMode: "replace",
    moveSelection: null,
    moveClipboard: null,
    moveBounds: null,
    moveSelectionNext: null,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
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

  function applyGradientToBuffer(
    targetBuffer: Uint8ClampedArray,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): boolean {
    const { r: startR, g: startG, b: startB } = hexToRgb(settings.primaryColor);
    const endHex = settings.secondaryColor || "#000000";
    const { r: endR, g: endG, b: endB } = hexToRgb(endHex);
    const startColor = { r: startR, g: startG, b: startB, a: 255 };
    const endColor = { r: endR, g: endG, b: endB, a: 255 };
    const ditherType = settings.ditheringType === "bayer" ? "bayer" : "none";

    const did = drawGradient(
      targetBuffer,
      canvasSpec.width,
      canvasSpec.height,
      startX,
      startY,
      endX,
      endY,
      startColor,
      endColor,
      settings.gradientType,
      ditherType
    );

    if (did && settings.ditheringType === "floyd") {
      const dithered = applyFloydSteinbergDither(
        targetBuffer,
        canvasSpec.width,
        canvasSpec.height,
        [startColor, endColor]
      );
      targetBuffer.set(dithered);
    }

    return did;
  }

  function applyGradientWithSymmetry(
    targetBuffer: Uint8ClampedArray,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): boolean {
    if (settings.symmetryMode === "none") {
      return applyGradientToBuffer(targetBuffer, startX, startY, endX, endY);
    }

    let changedAny = false;
    const transforms = getSymmetryTransforms(canvasSpec.width, canvasSpec.height, settings.symmetryMode);
    const seen = new Set<string>();
    transforms.forEach((transform) => {
      const start = transform(startX, startY);
      const end = transform(endX, endY);
      const key = `${start.x},${start.y},${end.x},${end.y}`;
      if (seen.has(key)) return;
      seen.add(key);
      const did = applyGradientToBuffer(targetBuffer, start.x, start.y, end.x, end.y);
      if (did) changedAny = true;
    });
    return changedAny;
  }

  function applyShapeWithSymmetry(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    drawShape: (sx: number, sy: number, ex: number, ey: number) => boolean
  ): boolean {
    if (settings.symmetryMode === "none") {
      return drawShape(startX, startY, endX, endY);
    }

    let changedAny = false;
    const transforms = getSymmetryTransforms(canvasSpec.width, canvasSpec.height, settings.symmetryMode);
    const seen = new Set<string>();
    transforms.forEach((transform) => {
      const start = transform(startX, startY);
      const end = transform(endX, endY);
      const key = `${start.x},${start.y},${end.x},${end.y}`;
      if (seen.has(key)) return;
      seen.add(key);
      const did = drawShape(start.x, start.y, end.x, end.y);
      if (did) changedAny = true;
    });
    return changedAny;
  }

  function pointerToPixel(e: React.PointerEvent): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;

    const rect = stage.getBoundingClientRect();

    const zoom = settings.zoom;
    const imgW = canvasSpec.width * zoom;
    const imgH = canvasSpec.height * zoom;

    const originX = (rect.width - imgW) / 2 + panOffset.x;
    const originY = (rect.height - imgH) / 2 + panOffset.y;

    const localX = e.clientX - rect.left - originX;
    const localY = e.clientY - rect.top - originY;

    const px = Math.floor(localX / zoom);
    const py = Math.floor(localY / zoom);

    if (px < 0 || py < 0 || px >= canvasSpec.width || py >= canvasSpec.height) return null;
    return { x: px, y: py };
  }

  function isDrawingTool(activeTool: ToolId) {
    return [
      "pen",
      "eraser",
      "fill",
      "gradient",
      "line",
      "rectangle",
      "rectangleFilled",
      "circle",
      "circleFilled",
      "ellipse",
      "ellipseFilled"
    ].includes(activeTool);
  }

  function isActiveLayerLocked() {
    if (!layers || !activeLayerId) return false;
    const layer = layers.find((l) => l.id === activeLayerId);
    return layer?.is_locked ?? false;
  }

  function getCompositePreview(): Uint8ClampedArray {
    if (!layers || layers.length === 0) return compositeBuffer;
    const previewLayers = layers.map((layer) =>
      layer.id === activeLayerId ? { ...layer, pixels: bufRef.current } : layer
    );
    return compositeLayers(previewLayers, canvasSpec.width, canvasSpec.height);
  }

  function beginStroke(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const st = strokeRef.current;
    st.active = true;
    st.changed = false;
    st.beforeSnapshot = cloneBuffer(bufRef.current);
    st.lastX = -1;
    st.lastY = -1;
    st.startX = -1;
    st.startY = -1;
    st.hasSmooth = false;
    st.selectionMode = selectionModeFromEvent(e);
    st.moveSelection = null;
    st.moveClipboard = null;
    st.moveBounds = null;
    st.moveSelectionNext = null;
    st.isPanning = false;

    if (isPanningRef.current) {
      st.isPanning = true;
      st.panStartX = e.clientX;
      st.panStartY = e.clientY;
      st.panOriginX = panOffset.x;
      st.panOriginY = panOffset.y;
      return;
    }

    const p = pointerToPixel(e);
    if (!p) {
      endStroke();
      return;
    }

    st.lastX = p.x;
    st.lastY = p.y;
    st.startX = p.x;
    st.startY = p.y;

    const c = getDrawColor();

    if (tool === "eyedropper") {
      const sampleBuffer = getCompositePreview();
      const rgba = getPixel(sampleBuffer, canvasSpec.width, canvasSpec.height, p.x, p.y);
      if (rgba && onColorPick) {
        const hex = `#${rgba.r.toString(16).padStart(2, "0")}${rgba.g.toString(16).padStart(2, "0")}${rgba.b.toString(16).padStart(2, "0")}`;
        onColorPick(hex);
      }
      endStroke();
      return;
    }

    if (isDrawingTool(tool) && isActiveLayerLocked()) {
      endStroke();
      return;
    }

    if (tool === "fill") {
      const pixelsChanged = settings.fillTolerance > 0
        ? floodFillWithTolerance(
          bufRef.current,
          canvasSpec.width,
          canvasSpec.height,
          p.x,
          p.y,
          c,
          settings.fillTolerance
        )
        : floodFill(
          bufRef.current,
          canvasSpec.width,
          canvasSpec.height,
          p.x,
          p.y,
          c
        );
      if (selection && st.beforeSnapshot) {
        applySelectionMask(bufRef.current, st.beforeSnapshot, selection, canvasSpec.width, canvasSpec.height);
      }
      if (pixelsChanged > 0) st.changed = true;
      draw();
      endStroke();
      return;
    }

    if (tool === "move") {
      if (isActiveLayerLocked()) {
        endStroke();
        return;
      }
      if (!selection || !st.beforeSnapshot) {
        endStroke();
        return;
      }
      const bounds = getSelectionBounds(selection, canvasSpec.width, canvasSpec.height);
      if (!bounds) {
        endStroke();
        return;
      }
      const clipboard = copySelection(bufRef.current, selection, canvasSpec.width, canvasSpec.height);
      if (!clipboard) {
        endStroke();
        return;
      }
      st.moveSelection = new Uint8Array(selection);
      st.moveClipboard = clipboard;
      st.moveBounds = bounds;
      st.moveSelectionNext = new Uint8Array(selection);
      setMoveSelectionPreview(new Uint8Array(selection));
      return;
    }

    if (tool === "selectWand") {
      const sampleBuffer = getCompositePreview();
      const newSelection = selectMagicWand(
        sampleBuffer,
        canvasSpec.width,
        canvasSpec.height,
        p.x,
        p.y,
        settings.wandTolerance
      );
      const mergedSelection = mergeSelection(selection, newSelection, st.selectionMode);
      onChangeSelection(mergedSelection);
      endStroke();
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      const did = drawLineWithSymmetry(
        bufRef.current,
        canvasSpec.width,
        canvasSpec.height,
        p.x,
        p.y,
        p.x,
        p.y,
        c,
        settings.symmetryMode,
        selection ?? undefined
      );
      if (did) st.changed = true;
      draw();
    }

    if (tool === "selectLasso") {
      setLassoPreview([{ x: p.x, y: p.y }]);
      return;
    }

    if (tool === "line" || tool === "rectangle" || tool === "rectangleFilled" || tool === "circle" || tool === "circleFilled" || tool === "ellipse" || tool === "ellipseFilled" || tool === "selectRect" || tool === "selectEllipse" || tool === "gradient") {
      setShapePreview({ startX: p.x, startY: p.y, endX: p.x, endY: p.y });
    }
  }

  function moveStroke(e: React.PointerEvent) {
    const st = strokeRef.current;
    if (!st.active) return;

    if (st.isPanning) {
      const dx = e.clientX - st.panStartX;
      const dy = e.clientY - st.panStartY;
      setPanOffset({ x: st.panOriginX + dx, y: st.panOriginY + dy });
      return;
    }

    const p0 = pointerToPixel(e);
    if (!p0) return;

    if (tool === "pen" || tool === "eraser") {
      const stabilized = applyStabilizer(p0.x + 0.5, p0.y + 0.5);

      const x = Math.floor(stabilized.x);
      const y = Math.floor(stabilized.y);

      if (x === st.lastX && y === st.lastY) return;

      const c = getDrawColor();
      const did = drawLineWithSymmetry(
        bufRef.current,
        canvasSpec.width,
        canvasSpec.height,
        st.lastX,
        st.lastY,
        x,
        y,
        c,
        settings.symmetryMode,
        selection ?? undefined
      );
      if (did) st.changed = true;

      st.lastX = x;
      st.lastY = y;

      draw();
    }

    if (tool === "move") {
      if (!st.beforeSnapshot || !st.moveSelection || !st.moveClipboard || !st.moveBounds) return;
      const dx = p0.x - st.startX;
      const dy = p0.y - st.startY;
      const movedSelection = moveSelectionMask(
        st.moveSelection,
        canvasSpec.width,
        canvasSpec.height,
        dx,
        dy
      );
      const nextBuffer = cloneBuffer(st.beforeSnapshot);
      clearSelectionFromBuffer(nextBuffer, st.moveSelection);
      const movedBuffer = pasteClipboard(
        nextBuffer,
        st.moveClipboard,
        canvasSpec.width,
        canvasSpec.height,
        st.moveBounds.x + dx,
        st.moveBounds.y + dy
      );
      bufRef.current.set(movedBuffer);
      st.changed = dx !== 0 || dy !== 0;
      st.moveSelectionNext = movedSelection;
      setMoveSelectionPreview(movedSelection);
      draw();
      return;
    }

    if (tool === "selectLasso") {
      setLassoPreview((prev) => {
        const next = prev ? [...prev, { x: p0.x, y: p0.y }] : [{ x: p0.x, y: p0.y }];
        return next;
      });
    }

    if (tool === "line" || tool === "rectangle" || tool === "rectangleFilled" || tool === "circle" || tool === "circleFilled" || tool === "ellipse" || tool === "ellipseFilled" || tool === "selectRect" || tool === "selectEllipse" || tool === "gradient") {
      setShapePreview({ startX: st.startX, startY: st.startY, endX: p0.x, endY: p0.y });
    }
  }

  function endStroke() {
    const st = strokeRef.current;
    if (!st.active) return;

    st.active = false;

    if (st.isPanning) {
      st.isPanning = false;
      return;
    }

    const c = getDrawColor();

    if (lassoPreview && tool === "selectLasso") {
      const points = lassoPreview.length > 1
        ? lassoPreview
        : [...lassoPreview, { x: st.lastX, y: st.lastY }];
      const smoothedPoints = smoothLassoPoints(points);
      const newSelection = createLassoSelection(
        canvasSpec.width,
        canvasSpec.height,
        smoothedPoints
      );
      const mergedSelection = mergeSelection(selection, newSelection, st.selectionMode);
      onChangeSelection(mergedSelection);
      setLassoPreview(null);
    }

    if (tool === "move" && st.moveSelection && st.moveSelectionNext) {
      onChangeSelection(st.moveSelectionNext);
      setMoveSelectionPreview(null);
    }

    if (shapePreview) {
      const { startX, startY, endX, endY } = shapePreview;

      if (tool === "line") {
        const did = drawLineWithSymmetry(
          bufRef.current,
          canvasSpec.width,
          canvasSpec.height,
          startX,
          startY,
          endX,
          endY,
          c,
          settings.symmetryMode,
          selection ?? undefined
        );
        if (did) st.changed = true;
      }

      if (tool === "rectangle") {
        const did = applyShapeWithSymmetry(startX, startY, endX, endY, (sx, sy, ex, ey) => {
          const w = Math.abs(ex - sx) + 1;
          const h = Math.abs(ey - sy) + 1;
          const x = Math.min(sx, ex);
          const y = Math.min(sy, ey);
          return drawRectangle(bufRef.current, canvasSpec.width, canvasSpec.height, x, y, w, h, c);
        });
        if (did) st.changed = true;
      }

      if (tool === "rectangleFilled") {
        const did = applyShapeWithSymmetry(startX, startY, endX, endY, (sx, sy, ex, ey) => {
          const w = Math.abs(ex - sx) + 1;
          const h = Math.abs(ey - sy) + 1;
          const x = Math.min(sx, ex);
          const y = Math.min(sy, ey);
          return fillRectangle(bufRef.current, canvasSpec.width, canvasSpec.height, x, y, w, h, c);
        });
        if (did) st.changed = true;
      }

      if (tool === "circle" || tool === "circleFilled") {
        const did = applyShapeWithSymmetry(startX, startY, endX, endY, (sx, sy, ex, ey) => {
          const cx = Math.round((sx + ex) / 2);
          const cy = Math.round((sy + ey) / 2);
          const dx = Math.abs(ex - sx);
          const dy = Math.abs(ey - sy);
          const radius = Math.round(Math.max(dx, dy) / 2);
          if (tool === "circle") {
            return drawCircle(bufRef.current, canvasSpec.width, canvasSpec.height, cx, cy, radius, c);
          }
          return fillCircle(bufRef.current, canvasSpec.width, canvasSpec.height, cx, cy, radius, c);
        });
        if (did) st.changed = true;
      }

      if (tool === "ellipse" || tool === "ellipseFilled") {
        const did = applyShapeWithSymmetry(startX, startY, endX, endY, (sx, sy, ex, ey) => {
          const cx = Math.round((sx + ex) / 2);
          const cy = Math.round((sy + ey) / 2);
          const rx = Math.round(Math.abs(ex - sx) / 2);
          const ry = Math.round(Math.abs(ey - sy) / 2);
          if (tool === "ellipse") {
            return drawEllipse(bufRef.current, canvasSpec.width, canvasSpec.height, cx, cy, rx, ry, c);
          }
          return fillEllipse(bufRef.current, canvasSpec.width, canvasSpec.height, cx, cy, rx, ry, c);
        });
        if (did) st.changed = true;
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

        const mergedSelection = mergeSelection(selection, newSelection, st.selectionMode);
        onChangeSelection(mergedSelection);
      }

      if (tool === "selectEllipse") {
        const cx = Math.round((startX + endX) / 2);
        const cy = Math.round((startY + endY) / 2);
        const rx = Math.round(Math.abs(endX - startX) / 2);
        const ry = Math.round(Math.abs(endY - startY) / 2);

        const newSelection = selectEllipse(
          canvasSpec.width,
          canvasSpec.height,
          cx,
          cy,
          rx,
          ry
        );

        const mergedSelection = mergeSelection(selection, newSelection, st.selectionMode);
        onChangeSelection(mergedSelection);
      }

      if (tool === "gradient") {
        const did = applyGradientWithSymmetry(bufRef.current, startX, startY, endX, endY);
        if (did) {
          st.changed = true;
        }
      }

      if (selection && st.beforeSnapshot && isDrawingTool(tool)) {
        applySelectionMask(bufRef.current, st.beforeSnapshot, selection, canvasSpec.width, canvasSpec.height);
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

    let previewBuffer = getCompositePreview();
    if (shapePreview && tool === "gradient") {
      const { startX, startY, endX, endY } = shapePreview;
      const baseLayer = new Uint8ClampedArray(bufRef.current);
      const previewLayer = new Uint8ClampedArray(bufRef.current);
      applyGradientWithSymmetry(previewLayer, startX, startY, endX, endY);
      if (selection) {
        applySelectionMask(previewLayer, baseLayer, selection, canvasSpec.width, canvasSpec.height);
      }
      if (layers && layers.length > 0) {
        const previewLayers = layers.map((layer) =>
          layer.id === activeLayerId ? { ...layer, pixels: previewLayer } : layer
        );
        previewBuffer = compositeLayers(previewLayers, canvasSpec.width, canvasSpec.height);
      } else {
        previewBuffer = previewLayer;
      }
    }
    const img = new ImageData(
      new Uint8ClampedArray(previewBuffer),
      canvasSpec.width,
      canvasSpec.height
    );

    ctx.imageSmoothingEnabled = false;

    const zoom = settings.zoom;
    const imgW = canvasSpec.width * zoom;
    const imgH = canvasSpec.height * zoom;

    const originX = Math.floor((w - imgW) / 2 + panOffset.x);
    const originY = Math.floor((h - imgH) / 2 + panOffset.y);

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

    if (settings.symmetryMode !== "none") {
      ctx.save();
      ctx.translate(originX, originY);
      drawSymmetryGuides(ctx, canvasSpec.width, canvasSpec.height, settings.symmetryMode, zoom);
      ctx.restore();
    }

    if (settings.symmetryMode !== "none") {
      ctx.save();
      ctx.translate(originX, originY);
      drawSymmetryGuides(ctx, canvasSpec.width, canvasSpec.height, settings.symmetryMode, zoom);
      ctx.restore();
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

      if (tool === "line" || tool === "gradient") {
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

      if (tool === "ellipse" || tool === "ellipseFilled" || tool === "selectEllipse") {
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2;
        const ry = Math.abs(y2 - y1) / 2;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (tool === "ellipseFilled") {
          ctx.fill();
        } else {
          ctx.stroke();
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

    if (lassoPreview && lassoPreview.length > 0) {
      ctx.save();
      ctx.strokeStyle = settings.primaryColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      lassoPreview.forEach((point, index) => {
        const px = originX + point.x * zoom;
        const py = originY + point.y * zoom;
        if (index === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      });
      ctx.stroke();
      ctx.restore();
    }

    const renderSelection = moveSelectionPreview ?? selection;

    // Render selection with marching ants
    if (renderSelection) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -animFrame / 2;

      // Find selection bounds and draw outline
      for (let y = 0; y < canvasSpec.height; y++) {
        for (let x = 0; x < canvasSpec.width; x++) {
          const idx = y * canvasSpec.width + x;
          if (renderSelection[idx]) {
            const left = x === 0 || !renderSelection[idx - 1];
            const right = x === canvasSpec.width - 1 || !renderSelection[idx + 1];
            const top = y === 0 || !renderSelection[idx - canvasSpec.width];
            const bottom = y === canvasSpec.height - 1 || !renderSelection[idx + canvasSpec.width];

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

function drawLineWithSelection(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: { r: number; g: number; b: number; a: number },
  selection: Uint8Array
): boolean {
  let changedAny = false;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    const idx = y0 * width + x0;
    if (selection[idx]) {
      if (setPixel(buf, width, height, x0, y0, rgba)) changedAny = true;
    }
    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return changedAny;
}

function drawLineWithSymmetry(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: { r: number; g: number; b: number; a: number },
  symmetryMode: UiSettings["symmetryMode"],
  selection?: Uint8Array
): boolean {
  if (symmetryMode === "none") {
    return selection
      ? drawLineWithSelection(buf, width, height, x0, y0, x1, y1, rgba, selection)
      : drawLine(buf, width, height, x0, y0, x1, y1, rgba);
  }

  let changedAny = false;
  const transforms = getSymmetryTransforms(width, height, symmetryMode);
  const seenLines = new Set<string>();

  transforms.forEach((transform) => {
    const start = transform(x0, y0);
    const end = transform(x1, y1);
    const key = `${start.x},${start.y},${end.x},${end.y}`;
    if (seenLines.has(key)) return;
    seenLines.add(key);

    const did = selection
      ? drawLineWithSelection(buf, width, height, start.x, start.y, end.x, end.y, rgba, selection)
      : drawLine(buf, width, height, start.x, start.y, end.x, end.y, rgba);
    if (did) changedAny = true;
  });

  return changedAny;
}

function getSymmetryTransforms(
  width: number,
  height: number,
  symmetryMode: UiSettings["symmetryMode"]
): Array<(x: number, y: number) => { x: number; y: number }> {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  const transforms: Array<(x: number, y: number) => { x: number; y: number }> = [];
  const seen = new Set<string>();

  function addTransform(fn: (x: number, y: number) => { x: number; y: number }) {
    const sampleA = fn(0, 0);
    const sampleB = fn(1, 0);
    const key = `${sampleA.x},${sampleA.y}|${sampleB.x},${sampleB.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    transforms.push(fn);
  }

  const identity = (x: number, y: number) => ({ x, y });
  addTransform(identity);

  if (symmetryMode === "horizontal" || symmetryMode === "both") {
    addTransform((x, y) => ({ x: 2 * cx - x, y }));
  }

  if (symmetryMode === "vertical" || symmetryMode === "both") {
    addTransform((x, y) => ({ x, y: 2 * cy - y }));
  }

  if (symmetryMode === "both") {
    addTransform((x, y) => ({ x: 2 * cx - x, y: 2 * cy - y }));
  }

  if (symmetryMode === "radial4" || symmetryMode === "radial8") {
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx - dy, y: cy + dx };
    });
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx - dx, y: cy - dy };
    });
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx + dy, y: cy - dx };
    });
  }

  if (symmetryMode === "radial8") {
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx + dy, y: cy + dx };
    });
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx - dy, y: cy - dx };
    });
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx - dx, y: cy + dy };
    });
    addTransform((x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      return { x: cx + dx, y: cy - dy };
    });
  }

  return transforms;
}

  function applySelectionMask(
    after: Uint8ClampedArray,
    before: Uint8ClampedArray,
    selection: Uint8Array,
    width: number,
    height: number
  ) {
    for (let i = 0; i < width * height; i++) {
      if (!selection[i]) {
        const idx = i * 4;
        after[idx + 0] = before[idx + 0];
        after[idx + 1] = before[idx + 1];
        after[idx + 2] = before[idx + 2];
        after[idx + 3] = before[idx + 3];
      }
    }
  }

  function clearSelectionFromBuffer(
    bufferToClear: Uint8ClampedArray,
    selectionMask: Uint8Array
  ) {
    for (let i = 0; i < selectionMask.length; i++) {
      if (selectionMask[i]) {
        const idx = i * 4;
        bufferToClear[idx + 0] = 0;
        bufferToClear[idx + 1] = 0;
        bufferToClear[idx + 2] = 0;
        bufferToClear[idx + 3] = 0;
      }
    }
  }

  function moveSelectionMask(
    selectionMask: Uint8Array,
    width: number,
    height: number,
    dx: number,
    dy: number
  ): Uint8Array {
    const moved = new Uint8Array(width * height);
    if (dx === 0 && dy === 0) return new Uint8Array(selectionMask);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!selectionMask[idx]) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        moved[ny * width + nx] = 1;
      }
    }

    return moved;
  }

type SelectionMode = "replace" | "union" | "subtract" | "intersect";

function selectionModeFromEvent(e: React.PointerEvent): SelectionMode {
  if (e.shiftKey && e.altKey) return "intersect";
  if (e.shiftKey) return "union";
  if (e.altKey) return "subtract";
  return "replace";
}

function mergeSelection(
  current: Uint8Array | null,
  incoming: Uint8Array,
  mode: SelectionMode
): Uint8Array | null {
  if (!current) {
    if (mode === "subtract" || mode === "intersect") return null;
    return incoming;
  }
  if (mode === "replace") return incoming;
  const merged = new Uint8Array(current);
  switch (mode) {
    case "union":
      selectionUnion(merged, incoming);
      break;
    case "subtract":
      selectionSubtract(merged, incoming);
      break;
    case "intersect":
      selectionIntersection(merged, incoming);
      break;
  }
  return merged;
}
