import React from "react";
import { ToolId } from "../types";
import { TOOL_GROUPS } from "./toolCatalog";

type Props = {
  tool: ToolId;
  onChangeTool: (tool: ToolId) => void;
};

export default function ToolBar({ tool, onChangeTool }: Props) {
  return (
    <div className="toolbar">
      {TOOL_GROUPS.map((group) => (
        <div key={group.title} className="toolbar__group" aria-label={group.title}>
          {group.tools.map((toolDef) => {
            const active = tool === toolDef.id;
            return (
              <button
                key={toolDef.id}
                className={"toolbtn" + (active ? " toolbtn--active" : "")}
                title={toolDef.title}
                onClick={() => onChangeTool(toolDef.id)}
              >
                {toolDef.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
