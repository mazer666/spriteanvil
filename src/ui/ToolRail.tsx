import React from "react";
import { ToolId } from "../types";
import { TOOL_GROUPS } from "./toolCatalog";

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
      {TOOL_GROUPS.map((group, index) => (
        <React.Fragment key={group.title}>
          {group.collapsible ? (
            <details className="toolgroup" open>
              <summary>{group.title}</summary>
              <div className="toolgroup__body">
                {group.tools.map((toolDef) =>
                  btn(toolDef.id, toolDef.label, toolDef.title)
                )}
              </div>
            </details>
          ) : (
            <>
              <div className="toolrail__sectionTitle">{group.title}</div>
              {group.tools.map((toolDef) =>
                btn(toolDef.id, toolDef.label, toolDef.title)
              )}
            </>
          )}
          {index < TOOL_GROUPS.length - 1 && <div className="toolrail__divider" />}
        </React.Fragment>
      ))}

      <div className="toolrail__spacer" />
    </div>
  );
}
