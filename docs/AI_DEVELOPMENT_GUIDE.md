# AI Development Guide for SpriteAnvil

This guide explains how to effectively use AI models (ChatGPT, Claude, etc.) to extend SpriteAnvil.

## 1. Context Injection
When starting a chat with an AI about SpriteAnvil, provide it with the content of `llms.txt` and `docs/ARCHITECTURE.md`. This gives the model the "Ground Truth".

## 2. Prompting for New Tools
SpriteAnvil tools follow a strict pattern. Use this prompt template:

> "I want to create a new tool for SpriteAnvil called [TOOL_NAME]. 
> 1. Create a pure function in `src/editor/tools/[TOOL_NAME].ts` that operates on a `Uint8ClampedArray` (RGBA).
> 2. Use integer math only.
> 3. Provide the integration steps for `src/types.ts` and `src/ui/CanvasStage.tsx`.
> 4. Ensure it respects the selection mask if provided."

## 3. Prompting for UI Components
SpriteAnvil uses a floating UI system. When asking for a new panel:

> "Create a new floating panel for SpriteAnvil that [DESCRIPTION]. 
> 1. Use React and Tailwind (if version 3+ confirmed).
> 2. Wrap it in the `<FloatingPanel>` component.
> 3. Ensure it doesn't exceed 400 lines.
> 4. Use the custom hooks in `src/hooks/` for state if needed."

## 4. Debugging with AI
If the canvas isn't rendering correctly, provide the AI with your `src/ui/CanvasStage.tsx` and the specific tool file. Ask:
"I'm seeing [ISSUE] when using the [TOOL]. Check for coordinate mapping errors between Screen coordinates and Pixel coordinates."

## 5. Performance Checklist for AI-generated Code
- [ ] No `useState` for pixel buffers?
- [ ] No floating point numbers in `setPixel`?
- [ ] Bounds checks on every buffer access?
- [ ] JSDoc added with "Why" comments?
