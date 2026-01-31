import { ToolId } from "../types";

export type ToolDefinition = {
  id: ToolId;
  label: string;
  title: string;
};

export type ToolGroup = {
  title: string;
  collapsible?: boolean;
  tools: ToolDefinition[];
};

export const TOOL_GROUPS: ToolGroup[] = [
  {
    title: "Tools",
    collapsible: true,
    tools: [
      { id: "pen", label: "✎", title: "Pen (B)" },
      { id: "smudge", label: "≈", title: "Smudge (S)" },
      { id: "eraser", label: "⌫", title: "Eraser (E)" },
      { id: "eyedropper", label: "💧", title: "Eyedropper (I)" },
      { id: "fill", label: "⛶", title: "Fill (F)" },
      { id: "gradient", label: "◐", title: "Gradient (G)" },
      { id: "line", label: "╱", title: "Line (L)" },
    ],
  },
  {
    title: "Shapes",
    collapsible: true,
    tools: [
      { id: "rectangle", label: "▭", title: "Rectangle (R)" },
      { id: "rectangleFilled", label: "▮", title: "Filled Rectangle (Shift+R)" },
      { id: "circle", label: "○", title: "Circle (C)" },
      { id: "circleFilled", label: "●", title: "Filled Circle (Shift+C)" },
      { id: "ellipse", label: "◯", title: "Ellipse (Shift+O)" },
      { id: "ellipseFilled", label: "⬭", title: "Filled Ellipse (O)" },
    ],
  },
  {
    title: "Selection",
    collapsible: true,
    tools: [
      { id: "selectRect", label: "⬚", title: "Select Rectangle (M)" },
      { id: "selectEllipse", label: "⬭", title: "Select Ellipse (Shift+M)" },
      { id: "selectLasso", label: "⚯", title: "Lasso Selection (W)" },
      { id: "selectWand", label: "🪄", title: "Magic Wand" },
    ],
  },
  {
    title: "View",
    collapsible: true,
    tools: [{ id: "move", label: "✋", title: "Move Selection (V)" }],
  },
];

export const TOOL_LIST: ToolDefinition[] = TOOL_GROUPS.flatMap((group) => group.tools);
