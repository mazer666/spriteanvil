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

      <div className="toolrail__divider" />

      {/* Placeholders (coming next) */}
      <button className="toolbtn toolbtn--disabled" title="Fill (coming next)" disabled>
        ⛶
      </button>
      <button className="toolbtn toolbtn--disabled" title="Magic Wand (coming next)" disabled>
        ✦
      </button>
      <button className="toolbtn toolbtn--disabled" title="Selection (coming next)" disabled>
        ▭
      </button>
      <button className="toolbtn toolbtn--disabled" title="Move/Transform (coming next)" disabled>
        ✥
      </button>

      <div className="toolrail__spacer" />

      <div className="toolrail__sectionTitle">View</div>
      <button className="toolbtn toolbtn--disabled" title="Pan (Space) — coming next" disabled>
        ✋
      </button>
    </div>
  );
}
