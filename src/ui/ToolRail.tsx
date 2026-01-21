import React from "react";

/**
 * ToolRail (links):
 * Wir starten bewusst minimal: nur Platzhalter-Buttons.
 * Später kommen echte Tools (Pen/Fill/Wand/Gradient+Dither/Selection/Transform).
 */
export default function ToolRail() {
  return (
    <div className="toolrail">
      <div className="toolrail__sectionTitle">Tools</div>

      <button className="toolbtn" title="Pen (B)">
        ✎
      </button>
      <button className="toolbtn" title="Eraser (E)">
        ⌫
      </button>
      <button className="toolbtn" title="Fill (G)">
        ⛶
      </button>
      <button className="toolbtn" title="Magic Wand (W)">
        ✦
      </button>
      <button className="toolbtn" title="Selection (S)">
        ▭
      </button>
      <button className="toolbtn" title="Move/Transform (V)">
        ✥
      </button>

      <div className="toolrail__spacer" />

      <div className="toolrail__sectionTitle">View</div>
      <button className="toolbtn" title="Pan (Space)">
        ✋
      </button>
    </div>
  );
}
