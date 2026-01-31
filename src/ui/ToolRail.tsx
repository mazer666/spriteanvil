/**
 * src/ui/ToolRail.tsx
 * -----------------------------------------------------------------------------
 * ## TOOL RAIL (Noob Guide)
 * 
 * This is your "Toolbox". It sits on the left side of the screen.
 * 
 * ## JARGON GLOSSARY
 * 1. TOOL CATALOG: The central list of all tools and their icons.
 * 2. HOTKEY: A single keyboard key (like 'G') that picks a tool instantly.
 * 3. COLLAPSIBLE: A section that can be "folded up" to save space.
 * 
 * ## VISUAL FLOW (Mermaid)
 * ```mermaid
 * graph LR
 *   Click[Click Tool] --> Set[Update Global Tool ID]
 *   Set --> UI[Highlight Button]
 *   UI --> Cursor[Change Map Cursor]
 *   Cursor --> Canvas[Ready to Draw]
 * ```
 */
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

/**
 * WHAT: Toggles the "Open/Closed" state of a tool group folder.
 * 
 * 🛠️ NOOB CHALLENGE: Can you change this so only one group can be open at a time? 
 * (Hint: Set all others to false when a new one is opened.)
 */
  function toggleGroup(title: string) {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  }

/**
 * WHAT: A helper that creates a single Tool Button (e.g., the Pen icon).
 * WHY: To avoid repeating the same complex HTML/CSS classes for every tool.
 */
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
