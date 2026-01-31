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

    // Convert canvas coordinates to screen coordinates for rendering
    const screenX = (floatingBuffer.x * zoom) + panOffset.x;
    const screenY = (floatingBuffer.y * zoom) + panOffset.y;
    const screenW = floatingBuffer.width * zoom;
    const screenH = floatingBuffer.height * zoom;

    useEffect(() => {
        function handlePointerMove(e: PointerEvent) {
            if (!activeHandle || !dragStartRef.current) return;
            e.preventDefault();

            const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
            const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;
            const { initialX, initialY, initialW, initialH } = dragStartRef.current;

            let next = { ...floatingBuffer };

            if (activeHandle === "move") {
                next.x = Math.round(initialX + dx);
                next.y = Math.round(initialY + dy);
            } else {
                let newW = initialW;
                let newH = initialH;

                if (activeHandle === "right") {
                    newW = Math.max(1, Math.round(initialW + dx));
                } else if (activeHandle === "bottom") {
                    newH = Math.max(1, Math.round(initialH + dy));
                } else if (activeHandle === "bottom-right") {
                    newW = Math.max(1, Math.round(initialW + dx));
                    newH = Math.max(1, Math.round(initialH + dy));
                }

                if (newW !== initialW || newH !== initialH) {
                    next.width = newW;
                    next.height = newH;
                    next.pixels = resizeBuffer(dragStartRef.current.initialPixels, initialW, initialH, newW, newH);
                }
            }
            // TODO: Implement other handles (top, left, etc require adjusting x/y too)

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

    const handleStyle = {
        position: "absolute" as const,
        width: "10px",
        height: "10px",
        background: "white",
        border: "1px solid #000",
        pointerEvents: "auto" as const,
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
                pointerEvents: "none", // Let clicks pass through body, but capture on handles
            }}
        >
            {/* Move Area (Invisible fill) */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "auto",
                    cursor: "move",
                }}
                onPointerDown={(e) => handlePointerDown(e, "move")}
            />

            {/* Handles */}
            <div
                style={{ ...handleStyle, right: -5, bottom: -5, cursor: "nwse-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "bottom-right")}
            />
            <div
                style={{ ...handleStyle, right: -5, top: "50%", marginTop: -5, cursor: "ew-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "right")}
            />
            <div
                style={{ ...handleStyle, bottom: -5, left: "50%", marginLeft: -5, cursor: "ns-resize" }}
                onPointerDown={(e) => handlePointerDown(e, "bottom")}
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
