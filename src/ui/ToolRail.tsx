import React from "react";
import { ToolId } from "../types";

type Props = {
  tool: ToolId;
  onChangeTool: (tool: ToolId) => void;
};

/**
 * ToolRail (left).
 * v0.1: Pen + Eraser.
 * Next: Fill, Wand, Selection, Transform, Gradient+Dither, etc.
 */
export default function ToolRail({ tool, onChangeTool }: Props) {
  function btn(id: ToolId, label: string, title: string) {
    const active = tool === id;
    return (
      <button
        className={"toolbtn" + (active ? " toolbtn--active" : "")}
        title={title}
        onClick={() => onChangeTool(id)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="toolrail">
      <div className="toolrail__sectionTitle">Tools</div>

      {btn("pen", "✎", "Pen (B)")}
      {btn("eraser", "⌫", "Eraser (E)")}
      {btn("eyedropper", "💧", "Eyedropper (I)")}
      {btn("fill", "⛶", "Fill (F)")}
      {btn("line", "╱", "Line (L)")}

      <div className="toolrail__divider" />

      {btn("rectangle", "▭", "Rectangle (R)")}
      {btn("rectangleFilled", "▮", "Filled Rectangle (Shift+R)")}
      {btn("circle", "○", "Circle (C)")}
      {btn("circleFilled", "●", "Filled Circle (Shift+C)")}
      {btn("ellipse", "◯", "Ellipse (Shift+O)")}
      {btn("ellipseFilled", "⬭", "Filled Ellipse (O)")}

      <div className="toolrail__divider" />

      {btn("selectRect", "⬚", "Select Rectangle (M)")}
      {btn("selectEllipse", "⬭", "Select Ellipse (Shift+M)")}

      <div className="toolrail__spacer" />

      <div className="toolrail__sectionTitle">View</div>
      <button className="toolbtn toolbtn--disabled" title="Pan (Space) — coming next" disabled>
        ✋
      </button>
    </div>
  );
}
