/**
 * src/ui/Minimap.tsx
 * -----------------------------------------------------------------------------
 * ## THE MINIMAP (Noob Guide)
 * 
 * The Minimap is a "Bird's Eye View" of your entire drawing.
 * 
 * 1. THE VIEWPORT: The white box shows the part of the canvas you are 
 *    currently looking at.
 * 2. NAVIGATION: You can click and drag inside the Minimap to quickly 
 *    "Fly" to a different part of your huge drawing.
 * 3. ZOOM SLIDER: Use the slider below it to zoom in and out without 
 *    using your mouse wheel.
 */
import React, { useEffect, useRef } from "react";
import { CanvasSpec } from "../types";

type Props = {
  buffer: Uint8ClampedArray;
  canvasSpec: CanvasSpec;
  viewRect: { x: number; y: number; width: number; height: number } | null;
  zoom: number;
  onPanTo: (x: number, y: number) => void;
  onChangeZoom?: (zoom: number) => void;
};

export default function Minimap({ buffer, canvasSpec, viewRect, zoom, onPanTo, onChangeZoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvasSpec.width;
    canvas.height = canvasSpec.height;
    ctx.imageSmoothingEnabled = false;
    const image = new ImageData(new Uint8ClampedArray(buffer), canvasSpec.width, canvasSpec.height);
    ctx.putImageData(image, 0, 0);

    if (viewRect) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(viewRect.x, viewRect.y, viewRect.width, viewRect.height);
    }
  }, [buffer, canvasSpec.height, canvasSpec.width, viewRect, zoom]);

  function panToEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasSpec.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasSpec.height / rect.height);
    const offsetX = (canvasSpec.width / 2 - x) * zoom;
    const offsetY = (canvasSpec.height / 2 - y) * zoom;
    onPanTo(offsetX, offsetY);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    panToEvent(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current) return;
    panToEvent(e);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="minimap__controls">
        <input
          className="minimap__zoom"
          type="range"
          min={1}
          max={32}
          step={0.25}
          value={zoom}
          onChange={(e) => onChangeZoom?.(Number(e.target.value))}
          aria-label="Zoom"
        />
        <span className="minimap__zoom-label">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
