import React, { useEffect, useRef, useState } from "react";
import { FloatingSelection } from "../types";
import { resizeBuffer } from "../editor/pixels";

type Props = {
    zoom: number;
    panOffset: { x: number; y: number };
    floatingBuffer: FloatingSelection;
    onUpdateTransform: (next: FloatingSelection) => void;
    onCommit: () => void;
};

type DragHandle =
    | "top-left" | "top" | "top-right"
    | "left" | "right"
    | "bottom-left" | "bottom" | "bottom-right"
    | "rotate"
    | "move";

export default function SelectionTransformOverlay({
    zoom,
    panOffset,
    floatingBuffer,
    onUpdateTransform,
    onCommit
}: Props) {
    const [activeHandle, setActiveHandle] = useState<DragHandle | null>(null);
    const dragStartRef = useRef<{
        mouseX: number;
        mouseY: number;
        initialX: number;
        initialY: number;
        initialW: number;
        initialH: number;
        initialPixels: Uint8ClampedArray;
    } | null>(null);

    // --- COORDINATE CONVERSION (Noob Guide) ---
    // The 'floatingBuffer' uses "Canvas Coordinates" (the actual pixel position in your art).
    // But the screen uses "CSS Pixels". we need to map them:
    // 1. Multiply by 'zoom' (if zoom is 10x, 1 pixel on canvas = 10 pixels on screen).
    // 2. Add 'panOffset' (if the user has moved the view, we must offset our overlay).
    const screenX = (floatingBuffer.x * zoom) + panOffset.x;
    const screenY = (floatingBuffer.y * zoom) + panOffset.y;
    
    // Width and height only need zoom (they don't care about the pan position).
    const screenW = floatingBuffer.width * zoom;
    const screenH = floatingBuffer.height * zoom;

    useEffect(() => {
        function handlePointerMove(e: PointerEvent) {
            if (!activeHandle || !dragStartRef.current) return;
            e.preventDefault();

            const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
            const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
            const { initialX, initialY, initialW, initialH, initialPixels } = dragStartRef.current;

            let next = { ...floatingBuffer };

            if (activeHandle === "move") {
                next.x = Math.round(initialX + dx);
                next.y = Math.round(initialY + dy);
            } else {
                // --- RESIZING LOGIC (Noob Guide) ---
                // 'dx' and 'dy' are how far the mouse has moved.
                // If we grab the LEFT handle and move left, 'dx' is negative.
                // We must shrink/grow the WIDTH and offset the X position
                // so the right side stays pinned.
                let newX = initialX;
                let newY = initialY;
                let newW = initialW;
                let newH = initialH;

                // Horizontal resizing
                if (activeHandle.includes("left")) {
                    newW = Math.max(1, Math.round(initialW - dx));
                    newX = initialX + (initialW - newW);
                } else if (activeHandle.includes("right")) {
                    newW = Math.max(1, Math.round(initialW + dx));
                }

                // Vertical resizing
                if (activeHandle.includes("top")) {
                    newH = Math.max(1, Math.round(initialH - dy));
                    newY = initialY + (initialH - newH);
                } else if (activeHandle.includes("bottom")) {
                    newH = Math.max(1, Math.round(initialH + dy));
                }

                if (newW !== initialW || newH !== initialH) {
                    next.x = newX;
                    next.y = newY;
                    next.width = newW;
                    next.height = newH;
                    // 'resizeBuffer' takes the old pixel grid and creates a new one
                    // with the new dimensions (nearest neighbor).
                    next.pixels = resizeBuffer(initialPixels, initialW, initialH, newW, newH);
                }
            }

            onUpdateTransform(next);
        }

        function handlePointerUp() {
            setActiveHandle(null);
            dragStartRef.current = null;
        }

        if (activeHandle) {
            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp);
        }

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [activeHandle, floatingBuffer, onUpdateTransform, zoom]);

    const handlePointerDown = (e: React.PointerEvent, handle: DragHandle) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setActiveHandle(handle);
        dragStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            initialX: floatingBuffer.x,
            initialY: floatingBuffer.y,
            initialW: floatingBuffer.width,
            initialH: floatingBuffer.height,
            initialPixels: floatingBuffer.pixels
        };
    };

    const handleStyle: React.CSSProperties = {
        position: "absolute",
        width: "10px",
        height: "10px",
        background: "white",
        border: "1px solid #000",
        pointerEvents: "auto",
        zIndex: 100,
    };

    return (
        <div
            style={{
                position: "absolute",
                left: screenX,
                top: screenY,
                width: screenW,
                height: screenH,
                border: "1px solid #00f",
                boxSizing: "border-box",
                pointerEvents: "none",
            }}
        >
            {/* Move Area */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "auto",
                    cursor: "move",
                }}
                onPointerDown={(e) => handlePointerDown(e, "move")}
            />

            {/* Corner Handles */}
            <div
                style={{ ...handleStyle, left: -5, top: -5, cursor: "nwse-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "top-left")}
            />
            <div
                style={{ ...handleStyle, right: -5, top: -5, cursor: "nesw-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "top-right")}
            />
            <div
                style={{ ...handleStyle, right: -5, bottom: -5, cursor: "nwse-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "bottom-right")}
            />
            <div
                style={{ ...handleStyle, left: -5, bottom: -5, cursor: "nesw-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "bottom-left")}
            />

            {/* Side Handles */}
            <div
                style={{ ...handleStyle, left: "50%", top: -5, marginLeft: -5, cursor: "ns-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "top")}
            />
            <div
                style={{ ...handleStyle, right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "right")}
            />
            <div
                style={{ ...handleStyle, left: "50%", bottom: -5, marginLeft: -5, cursor: "ns-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "bottom")}
            />
            <div
                style={{ ...handleStyle, left: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "left")}
            />

            {/* Confirm Button */}
            <button
                style={{
                    position: "absolute",
                    bottom: -40,
                    left: "50%",
                    transform: "translateX(-50%)",
                    pointerEvents: "auto",
                    background: "#222",
                    color: "#fff",
                    border: "1px solid #555",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer"
                }}
                onPointerDown={(e) => { e.stopPropagation(); onCommit(); }}
            >
                Done (Enter)
            </button>
        </div>
    );
}
