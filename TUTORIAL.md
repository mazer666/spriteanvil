# SpriteAnvil: The Golden Path (Code Tour)

Welcome, brave coder! If you are new to the SpriteAnvil codebase, this guide will show you the "Golden Path"—the 5 most important files that make the whole app work. Read them in this order to become a pro!

## 1. [pixels.ts](file:///Users/volker/Downloads/SpriteAnvil/spriteanvil/src/editor/pixels.ts)

**The Foundation.**

Everything starts here. This file defines how we store image data in memory. If you understand how `Uint8ClampedArray` stores colors as a list of numbers, you understand 50% of the engine.

## 2. [history.ts](file:///Users/volker/Downloads/SpriteAnvil/spriteanvil/src/editor/history.ts)

**The Time Machine.**

This file manages Undo and Redo. It shows you how we take "snapshots" of the canvas so you can jump back in time if you make a mistake.

## 3. [CanvasStage.tsx](file:///Users/volker/Downloads/SpriteAnvil/spriteanvil/src/ui/CanvasStage.tsx)

**The Window.**

This is the bridge between your mouse and the code. It handles zooming, panning, and detecting where you click. It's the "Camera" that looks at your artwork.

## 4. [App.tsx](file:///Users/volker/Downloads/SpriteAnvil/spriteanvil/src/ui/App.tsx)

**The Brain.**

This is the conductor of the orchestra. It connects the tools (like the Pen) to the history (Undo) and the UI (Panels). If you want to see how a "Click" becomes a "Line," look here.

## 5. [brush.ts](file:///Users/volker/Downloads/SpriteAnvil/spriteanvil/src/editor/tools/brush.ts)

**The Artisan.**

This is an example of a real tool. It uses Bresenham's algorithm to draw lines. Once you understand how the Brush works, you'll understand how all other tools (Fill, Shapes, Eraser) are built.

---

### Pro Tip: Look for "Noob" Comments

Throughout the code, look for headers like:

- `## NOOB GUIDE`: Big picture explanations.
- `🛠️ NOOB CHALLENGE`: Small tasks to help you learn.
- `⚠️ WATCH OUT`: Common mistakes to avoid.
