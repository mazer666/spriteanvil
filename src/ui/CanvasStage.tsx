import React, { useEffect, useMemo, useRef, useState } from "react";
import { CanvasSpec, ToolId, UiSettings, LayerData, FloatingSelection } from "../types";
import Minimap from "./Minimap";
import { cloneBuffer, drawLine, hexToRgb, getPixel, setPixel } from "../editor/pixels";
import { compositeLayers } from "../editor/layers";
import { floodFill, floodFillWithTolerance } from "../editor/tools/fill";
import { applyFloydSteinbergDither, drawGradient } from "../editor/tools/gradient";
import { drawSymmetryGuides, getSymmetryTransforms } from "../editor/symmetry";
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
  floatingBuffer?: FloatingSelection | null;
  onBeginTransform?: () => FloatingSelection | null;
  onUpdateTransform?: (next: FloatingSelection) => void;
  onChangeZoom?: (zoom: number) => void;
  onColorPick?: (color: string) => void;
  onCursorMove?: (position: { x: number; y: number } | null) => void;
  frames?: Frame[];
  currentFrameIndex?: number;
  remoteCursors?: Record<string, { x: number; y: number; color: string }>;
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
    floatingBuffer,
    onBeginTransform,
    onUpdateTransform,
    onChangeZoom,
    onColorPick,
    onCursorMove,
    frames,
    currentFrameIndex,
    remoteCursors
  } = props;

  const shapePreviewTools: ToolId[] = [
    "line",
    "rectangle",
    "rectangleFilled",
    "circle",
    "circleFilled",
    "ellipse",
    "ellipseFilled",
    "selectRect",
    "selectEllipse",
    "gradient",
  ];

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
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [viewRect, setViewRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const viewRectRef = useRef<typeof viewRect>(null);

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

  const floatingRef = useRef<FloatingSelection | null>(floatingBuffer ?? null);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    active: boolean;
    startDistance: number;
    startZoom: number;
    startCenter: { x: number; y: number };
    startPan: { x: number; y: number };
  }>({
    active: false,
    startDistance: 0,
    startZoom: settings.zoom,
    startCenter: { x: 0, y: 0 },
    startPan: { x: 0, y: 0 },
  });

  useEffect(() => {
    floatingRef.current = floatingBuffer ?? null;
  }, [floatingBuffer]);

  useEffect(() => {
    bufRef.current = buffer;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    buffer,
    compositeBuffer,
    settings.zoom,
    settings.showGrid,
    settings.gridSize,
    settings.backgroundMode,
    settings.checkerSize,
    settings.checkerA,
    settings.checkerB,
    settings.symmetryMode,
    settings.symmetryAngle,
    settings.symmetrySegments,
    settings.edgeSnapEnabled,
    settings.edgeSnapRadius,
    settings.showArcGuides,
    settings.showGravityGuides,
    settings.showMotionTrails,
    shapePreview,
    lassoPreview,
    selection,
    floatingBuffer,
    panOffset,
    animFrame,
  ]);

  useEffect(() => {
    function isInputFocused(): boolean {
      const active = document.activeElement;
      return active?.tagName === "INPUT" || active?.tagName === "TEXTAREA" || (active?.hasAttribute("contenteditable") ?? false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === " " && !isInputFocused()) {
        isPanningRef.current = true;
        (window as { __spriteanvilIsPanning?: boolean }).__spriteanvilIsPanning = true;
        e.preventDefault();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === " ") {
        isPanningRef.current = false;
        (window as { __spriteanvilIsPanning?: boolean }).__spriteanvilIsPanning = false;
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
    moveOriginX: number;
    moveOriginY: number;
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
    moveOriginX: 0,
    moveOriginY: 0,
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
    const transforms = getSymmetryTransforms(
      canvasSpec.width,
      canvasSpec.height,
      settings.symmetryMode,
      settings.symmetryAngle,
      settings.symmetrySegments
    );
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
    const transforms = getSymmetryTransforms(
      canvasSpec.width,
      canvasSpec.height,
      settings.symmetryMode,
      settings.symmetryAngle,
      settings.symmetrySegments
    );
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

  function handleGestureStart(e: React.PointerEvent): boolean {
    if (e.pointerType !== "touch") return false;
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (touchPointsRef.current.size >= 2) {
      const points = Array.from(touchPointsRef.current.values());
      const [p0, p1] = points;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      gestureRef.current.active = true;
      gestureRef.current.startDistance = Math.hypot(dx, dy);
      gestureRef.current.startZoom = settings.zoom;
      gestureRef.current.startCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      gestureRef.current.startPan = { ...panOffset };
      return true;
    }
    return false;
  }

  function handleGestureMove(e: React.PointerEvent): boolean {
    if (e.pointerType !== "touch") return false;
    if (!gestureRef.current.active) return false;
    touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const points = Array.from(touchPointsRef.current.values());
    if (points.length < 2) return false;
    const [p0, p1] = points;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const scale = distance / gestureRef.current.startDistance;
    const nextZoom = Math.max(1, Math.min(32, gestureRef.current.startZoom * scale));
    onChangeZoom?.(nextZoom);

    const center = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const deltaX = center.x - gestureRef.current.startCenter.x;
    const deltaY = center.y - gestureRef.current.startCenter.y;
    setPanOffset({
      x: gestureRef.current.startPan.x + deltaX,
      y: gestureRef.current.startPan.y + deltaY,
    });
    return true;
  }

  function handleGestureEnd() {
    if (gestureRef.current.active && touchPointsRef.current.size < 2) {
      gestureRef.current.active = false;
    }
  }

  function handlePointerUpCleanup(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    touchPointsRef.current.delete(e.pointerId);
    handleGestureEnd();
  }

  function beginStroke(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (handleGestureStart(e)) {
      return;
    }

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
      endStroke(e);
      return;
    }
    setHoverPos(p);

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
      endStroke(e);
      return;
    }

    if (isDrawingTool(tool) && isActiveLayerLocked()) {
      endStroke(e);
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
      endStroke(e);
      return;
    }

    if (tool === "move") {
      if (isActiveLayerLocked()) {
        endStroke(e);
        return;
      }
      const floating = onBeginTransform?.();
      if (!floating || !selection) {
        endStroke(e);
        return;
      }
      st.moveOriginX = floating.x;
      st.moveOriginY = floating.y;
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
      endStroke(e);
      return;
    }

    if (tool === "pen" || tool === "eraser") {
      const snapped = snapToEdge(p.x, p.y);
      st.lastX = snapped.x;
      st.lastY = snapped.y;
      st.startX = snapped.x;
      st.startY = snapped.y;
      const did = drawBrushLineWithSymmetry(
        bufRef.current,
        canvasSpec.width,
        canvasSpec.height,
        snapped.x,
        snapped.y,
        snapped.x,
        snapped.y,
        c,
        settings.symmetryMode,
        settings.symmetryAngle,
        settings.symmetrySegments,
        settings.brushSize,
        selection ?? undefined
      );
      if (did) st.changed = true;
      draw();
    }

    if (tool === "selectLasso") {
      setLassoPreview([{ x: p.x, y: p.y }]);
      return;
    }

    if (shapePreviewTools.includes(tool)) {
      setShapePreview({ startX: p.x, startY: p.y, endX: p.x, endY: p.y });
    }
  }

  function moveStroke(e: React.PointerEvent) {
    const st = strokeRef.current;
    if (!st.active) return;

    if (handleGestureMove(e)) {
      return;
    }

    if (st.isPanning) {
      const dx = e.clientX - st.panStartX;
      const dy = e.clientY - st.panStartY;
      setPanOffset({ x: st.panOriginX + dx, y: st.panOriginY + dy });
      return;
    }

    const p0 = pointerToPixel(e);
    if (!p0) return;
    setHoverPos(p0);

    if (tool === "pen" || tool === "eraser") {
      const stabilized = applyStabilizer(p0.x + 0.5, p0.y + 0.5);

      const snapped = snapToEdge(Math.floor(stabilized.x), Math.floor(stabilized.y));
      const x = snapped.x;
      const y = snapped.y;

      if (x === st.lastX && y === st.lastY) return;

      const c = getDrawColor();
      const did = drawBrushLineWithSymmetry(
        bufRef.current,
        canvasSpec.width,
        canvasSpec.height,
        st.lastX,
        st.lastY,
        x,
        y,
        c,
        settings.symmetryMode,
        settings.symmetryAngle,
        settings.symmetrySegments,
        settings.brushSize,
        selection ?? undefined
      );
      if (did) st.changed = true;

      st.lastX = x;
      st.lastY = y;

      draw();
    }

    if (tool === "move") {
      const floating = floatingRef.current;
      if (!floating || !onUpdateTransform) return;
      const dx = p0.x - st.startX;
      const dy = p0.y - st.startY;
      onUpdateTransform({
        ...floating,
        x: st.moveOriginX + dx,
        y: st.moveOriginY + dy,
      });
      return;
    }

    if (tool === "selectLasso") {
      setLassoPreview((prev) => {
        const next = prev ? [...prev, { x: p0.x, y: p0.y }] : [{ x: p0.x, y: p0.y }];
        return next;
      });
    }

    if (shapePreviewTools.includes(tool)) {
      setShapePreview({ startX: st.startX, startY: st.startY, endX: p0.x, endY: p0.y });
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const p0 = pointerToPixel(e);
    if (p0) setHoverPos(p0);
    if (onCursorMove) {
      onCursorMove(p0);
    }
    if (strokeRef.current.active) {
      moveStroke(e);
    }
  }

  function isEdgePixel(pixels: Uint8ClampedArray, x: number, y: number) {
    const idx = (y * canvasSpec.width + x) * 4;
    if (pixels[idx + 3] === 0) return false;
    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];
    return neighbors.some((n) => {
      if (n.x < 0 || n.y < 0 || n.x >= canvasSpec.width || n.y >= canvasSpec.height) return true;
      const nIdx = (n.y * canvasSpec.width + n.x) * 4;
      return pixels[nIdx + 3] === 0;
    });
  }

  function snapToEdge(x: number, y: number): { x: number; y: number } {
    if (!settings.edgeSnapEnabled) return { x, y };
    const radius = Math.max(1, Math.min(12, settings.edgeSnapRadius));
    let best: { x: number; y: number; dist: number } | null = null;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= canvasSpec.width || ny >= canvasSpec.height) continue;
        if (!isEdgePixel(compositeBuffer, nx, ny)) continue;
        const dist = dx * dx + dy * dy;
        if (!best || dist < best.dist) {
          best = { x: nx, y: ny, dist };
        }
      }
    }
    return best ? { x: best.x, y: best.y } : { x, y };
  }

  function endStroke(e?: React.PointerEvent) {
    const st = strokeRef.current;
    if (!st.active) return;

    st.active = false;

    if (st.isPanning) {
      st.isPanning = false;
      return;
    }

    if (st.isPanning) {
      st.isPanning = false;
      return;
    }

    if (e?.pointerType === "touch") {
      handlePointerUpCleanup(e);
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

    if (tool === "move") {
      st.moveOriginX = 0;
      st.moveOriginY = 0;
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
            settings.symmetryAngle,
            settings.symmetrySegments,
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
    const viewX = -originX / zoom;
    const viewY = -originY / zoom;
    const viewW = w / zoom;
    const viewH = h / zoom;
    const nextView = { x: viewX, y: viewY, width: viewW, height: viewH };
    const prevView = viewRectRef.current;
    if (
      !prevView ||
      Math.abs(prevView.x - nextView.x) > 0.5 ||
      Math.abs(prevView.y - nextView.y) > 0.5 ||
      Math.abs(prevView.width - nextView.width) > 0.5 ||
      Math.abs(prevView.height - nextView.height) > 0.5
    ) {
      viewRectRef.current = nextView;
      setViewRect(nextView);
    }

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

    if (floatingBuffer) {
      const floatingImg = new ImageData(
        new Uint8ClampedArray(floatingBuffer.pixels),
        floatingBuffer.width,
        floatingBuffer.height
      );
      const floatingCanvas = getOffscreen(floatingBuffer.width, floatingBuffer.height);
      const floatingCtx = floatingCanvas.getContext("2d")!;
      floatingCtx.putImageData(floatingImg, 0, 0);

      const fx = originX + floatingBuffer.x * zoom;
      const fy = originY + floatingBuffer.y * zoom;
      const fw = floatingBuffer.width * zoom;
      const fh = floatingBuffer.height * zoom;

      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(
        floatingCanvas,
        0,
        0,
        floatingBuffer.width,
        floatingBuffer.height,
        fx,
        fy,
        fw,
        fh
      );
      ctx.restore();
    }

    if (settings.showGrid && zoom >= 6) {
      drawGrid(ctx, originX, originY, canvasSpec.width, canvasSpec.height, zoom, settings.gridSize);
    }

    if (settings.symmetryMode !== "none") {
      ctx.save();
      ctx.translate(originX, originY);
      drawSymmetryGuides(
        ctx,
        canvasSpec.width,
        canvasSpec.height,
        settings.symmetryMode,
        zoom,
        settings.symmetryAngle,
        settings.symmetrySegments
      );
      ctx.restore();
    }

    if (settings.showArcGuides || settings.showGravityGuides) {
      ctx.save();
      ctx.translate(originX, originY);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.globalAlpha = 0.6;

      /**
       * Physics guide math (beginner friendly):
       *
       * A projectile arc can be modeled with a parabola:
       *   y = a(x - h)^2 + k
       * where (h, k) is the apex (highest point). We pick h at mid-width,
       * k at 20% height, and solve for a so the curve passes through both
       * endpoints at the bottom of the canvas.
       */
      if (settings.showArcGuides) {
        ctx.strokeStyle = "rgba(122, 162, 247, 0.9)";
        const w = canvasSpec.width * zoom;
        const h = canvasSpec.height * zoom;
        const apexX = w / 2;
        const apexY = h * 0.2;
        const endY = h * 0.85;
        const a = (endY - apexY) / Math.pow(0 - apexX, 2);
        ctx.beginPath();
        for (let x = 0; x <= w; x += Math.max(1, zoom)) {
          const y = a * Math.pow(x - apexX, 2) + apexY;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      /**
       * Gravity/circular guide math:
       * A circular path follows x = r cos(t), y = r sin(t).
       * We render a circle centered in the canvas to visualize
       * consistent angular motion.
       */
      if (settings.showGravityGuides) {
        ctx.strokeStyle = "rgba(92, 252, 187, 0.9)";
        const radius = Math.min(canvasSpec.width, canvasSpec.height) * zoom * 0.35;
        ctx.beginPath();
        ctx.arc(
          canvasSpec.width * zoom * 0.5,
          canvasSpec.height * zoom * 0.5,
          radius,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    if (settings.showOnionSkin && settings.showMotionTrails && frames && currentFrameIndex !== undefined) {
      const maxTrailFrames = Math.min(frames.length - 1, settings.onionPrev + settings.onionNext);
      if (maxTrailFrames > 0) {
        const trailPoints: Array<{ x: number; y: number }> = [];
        for (let offset = -settings.onionPrev; offset <= settings.onionNext; offset++) {
          const idx = currentFrameIndex + offset;
          if (idx < 0 || idx >= frames.length || idx === currentFrameIndex) continue;
          const centroid = getFrameCentroid(frames[idx].pixels, canvasSpec.width, canvasSpec.height);
          if (centroid) {
            trailPoints.push({
              x: originX + centroid.x * zoom + zoom * 0.5,
              y: originY + centroid.y * zoom + zoom * 0.5,
            });
          }
        }
        if (trailPoints.length > 1) {
          ctx.save();
          ctx.strokeStyle = "rgba(255, 184, 108, 0.65)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
          trailPoints.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    if (remoteCursors && Object.keys(remoteCursors).length > 0) {
      Object.entries(remoteCursors).forEach(([id, cursor]) => {
        const cx = originX + cursor.x * zoom + zoom * 0.5;
        const cy = originY + cursor.y * zoom + zoom * 0.5;
        ctx.save();
        ctx.strokeStyle = cursor.color;
        ctx.fillStyle = cursor.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(3, zoom * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy);
        ctx.lineTo(cx + 6, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 6);
        ctx.lineTo(cx, cy + 6);
        ctx.stroke();
        ctx.font = "10px sans-serif";
        ctx.fillText(id.slice(0, 4), cx + 6, cy - 6);
        ctx.restore();
      });
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

    if (hoverPos && (tool === "pen" || tool === "eraser")) {
      const centerX = originX + (hoverPos.x + 0.5) * zoom;
      const centerY = originY + (hoverPos.y + 0.5) * zoom;
      const radius = Math.max(2, (settings.brushSize * zoom) / 2);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const renderSelection = selection;

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

    if (renderSelection) {
      const bounds = getSelectionBounds(renderSelection, canvasSpec.width, canvasSpec.height);
      if (bounds) {
        const handleSize = Math.max(4, Math.floor(zoom));
        const half = Math.floor(handleSize / 2);
        const x0 = originX + bounds.x * zoom;
        const y0 = originY + bounds.y * zoom;
        const x1 = originX + (bounds.x + bounds.width) * zoom;
        const y1 = originY + (bounds.y + bounds.height) * zoom;

        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;

        const drawHandle = (x: number, y: number) => {
          ctx.fillRect(x - half, y - half, handleSize, handleSize);
          ctx.strokeRect(x - half, y - half, handleSize, handleSize);
        };

        drawHandle(x0, y0);
        drawHandle(x1, y0);
        drawHandle(x0, y1);
        drawHandle(x1, y1);
        ctx.restore();
      }
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
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => {
          handlePointerUpCleanup(e);
          endStroke(e);
        }}
        onPointerCancel={(e) => {
          handlePointerUpCleanup(e);
          endStroke(e);
        }}
        onPointerLeave={() => {
          setHoverPos(null);
          onCursorMove?.(null);
        }}
      />
      <Minimap
        buffer={getCompositePreview()}
        canvasSpec={canvasSpec}
        viewRect={viewRect}
        zoom={settings.zoom}
        onPanTo={(x, y) => setPanOffset({ x, y })}
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

function drawBrushStamp(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgba: { r: number; g: number; b: number; a: number },
  brushSize: number,
  selection?: Uint8Array
): boolean {
  const radius = Math.max(0, Math.floor(brushSize / 2));
  const r2 = radius * radius;
  let changedAny = false;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const px = x + dx;
      const py = y + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      if (selection && !selection[py * width + px]) continue;
      if (setPixel(buf, width, height, px, py, rgba)) changedAny = true;
    }
  }

  return changedAny;
}

function drawBrushLine(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: { r: number; g: number; b: number; a: number },
  brushSize: number,
  selection?: Uint8Array
): boolean {
  let changedAny = false;

  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    if (drawBrushStamp(buf, width, height, x0, y0, rgba, brushSize, selection)) changedAny = true;
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
  symmetryAngle: UiSettings["symmetryAngle"],
  symmetrySegments: UiSettings["symmetrySegments"],
  selection?: Uint8Array
): boolean {
  if (symmetryMode === "none") {
    return selection
      ? drawBrushLine(buf, width, height, x0, y0, x1, y1, rgba, 1, selection)
      : drawLine(buf, width, height, x0, y0, x1, y1, rgba);
  }

  let changedAny = false;
  const transforms = getSymmetryTransforms(width, height, symmetryMode, symmetryAngle, symmetrySegments);
  const seenLines = new Set<string>();

  transforms.forEach((transform) => {
    const start = transform(x0, y0);
    const end = transform(x1, y1);
    const key = `${start.x},${start.y},${end.x},${end.y}`;
    if (seenLines.has(key)) return;
    seenLines.add(key);

    const did = selection
      ? drawBrushLine(buf, width, height, start.x, start.y, end.x, end.y, rgba, 1, selection)
      : drawLine(buf, width, height, start.x, start.y, end.x, end.y, rgba);
    if (did) changedAny = true;
  });

  return changedAny;
}

function drawBrushLineWithSymmetry(
  buf: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: { r: number; g: number; b: number; a: number },
  symmetryMode: UiSettings["symmetryMode"],
  symmetryAngle: UiSettings["symmetryAngle"],
  symmetrySegments: UiSettings["symmetrySegments"],
  brushSize: number,
  selection?: Uint8Array
): boolean {
  if (symmetryMode === "none") {
    return drawBrushLine(buf, width, height, x0, y0, x1, y1, rgba, brushSize, selection);
  }

  let changedAny = false;
  const transforms = getSymmetryTransforms(width, height, symmetryMode, symmetryAngle, symmetrySegments);
  const seenLines = new Set<string>();

  transforms.forEach((transform) => {
    const start = transform(x0, y0);
    const end = transform(x1, y1);
    const key = `${start.x},${start.y},${end.x},${end.y}`;
    if (seenLines.has(key)) return;
    seenLines.add(key);

    const did = drawBrushLine(buf, width, height, start.x, start.y, end.x, end.y, rgba, brushSize, selection);
    if (did) changedAny = true;
  });

  return changedAny;
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

function getFrameCentroid(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): { x: number; y: number } | null {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (pixels[idx + 3] > 0) {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }
  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count };
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
