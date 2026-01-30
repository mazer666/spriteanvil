import React, { useEffect, useRef } from "react";
import { CanvasSpec } from "../types";

type Props = {
  buffer: Uint8ClampedArray;
  canvasSpec: CanvasSpec;
  viewRect: { x: number; y: number; width: number; height: number } | null;
  zoom: number;
  onPanTo: (x: number, y: number) => void;
};

export default function Minimap({ buffer, canvasSpec, viewRect, zoom, onPanTo }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvasSpec.width / rect.width);
    const y = (e.clientY - rect.top) * (canvasSpec.height / rect.height);
    const offsetX = (canvasSpec.width / 2 - x) * zoom;
    const offsetY = (canvasSpec.height / 2 - y) * zoom;
    onPanTo(offsetX, offsetY);
  }

  return (
    <div className="minimap">
      <canvas ref={canvasRef} onClick={handleClick} />
    </div>
  );
}
