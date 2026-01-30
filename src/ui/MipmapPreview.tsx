import React, { useEffect, useRef } from "react";
import { CanvasSpec } from "../types";

const PREVIEW_SIZES = [16, 32, 64];

type Props = {
  canvasSpec: CanvasSpec;
  pixels: Uint8ClampedArray;
};

export default function MipmapPreview({ canvasSpec, pixels }: Props) {
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = canvasSpec.width;
    sourceCanvas.height = canvasSpec.height;
    const sourceCtx = sourceCanvas.getContext("2d");
    if (!sourceCtx) return;

    const img = new ImageData(new Uint8ClampedArray(pixels), canvasSpec.width, canvasSpec.height);
    sourceCtx.putImageData(img, 0, 0);

    PREVIEW_SIZES.forEach((size) => {
      const canvas = canvasRefs.current.get(size);
      if (!canvas) return;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceCanvas, 0, 0, size, size);
    });
  }, [canvasSpec.height, canvasSpec.width, pixels]);

  return (
    <div className="panel" style={{ marginTop: "12px" }}>
      <div className="panel__header">
        <div className="panel__title">Mipmap Preview</div>
      </div>
      <div className="panel__body">
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {PREVIEW_SIZES.map((size) => (
            <div key={size} style={{ textAlign: "center" }}>
              <canvas
                ref={(el) => {
                  if (el) canvasRefs.current.set(size, el);
                }}
                style={{ border: "1px solid #333", background: "#111", imageRendering: "pixelated" }}
                width={size}
                height={size}
              />
              <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
                {size}×{size}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
