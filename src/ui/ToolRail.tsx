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
  // Track open state for collapsible groups. Default to all open.
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    TOOL_GROUPS.forEach(g => { if (g.collapsible) defaults[g.title] = true; });
    return defaults;
  });

  function toggleGroup(title: string) {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  }

  function btn(id: ToolId, label: string, title: string) {
    const active = tool === id;
    return (
      <button
        key={id}
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
      {TOOL_GROUPS.map((group, index) => {
         const isOpen = group.collapsible ? openGroups[group.title] !== false : true;
         
         return (
          <React.Fragment key={group.title}>
            {group.collapsible ? (
              <div className="toolgroup">
                 <button 
                   className="toolgroup__header" 
                   onClick={() => toggleGroup(group.title)}
                   title={isOpen ? "Collapse" : "Expand"}
                 >
                   <span className="toolgroup__indicator">{isOpen ? "▾" : "▸"}</span>
                   <span className="toolgroup__title">{group.title}</span>
                 </button>
                 
                 {isOpen && (
                   <div className="toolgroup__body">
                     {group.tools.map((toolDef) =>
                       btn(toolDef.id, toolDef.label, toolDef.title)
                     )}
                   </div>
                 )}
              </div>
            ) : (
              // Non-collapsible groups (usually simple lists)
              <>
                 {/* Only show title if it's not the first one, or if explicit */}
                 {group.title && <div className="toolrail__sectionTitle">{group.title}</div>}
                 {group.tools.map((toolDef) =>
                   btn(toolDef.id, toolDef.label, toolDef.title)
                 )}
              </>
            )}
            
            {index < TOOL_GROUPS.length - 1 && <div className="toolrail__divider" />}
          </React.Fragment>
        );
      })}

      <div className="toolrail__spacer" />
    </div>
  );
}
