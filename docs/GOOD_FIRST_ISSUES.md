# Good First Issues: Contributor Roadmap 🚀

Welcome! We are thrilled that you want to help make SpriteAnvil better. Here are some "bitesized" tasks to help you get familiar with the codebase.

## 🟢 Easy (UI/UX)

- [ ] **Add a "Zen Mode" Shortcut Hint**: Add a small label in the bottom bar reminding users that `Tab` toggles Zen Mode.
- [ ] **Custom Color Palette**: Create a new `.gpl` file in `public/palettes/` with your favorite color scheme.
- [ ] **Improve Tooltips**: Check `ToolRail.tsx` and ensure all tooltips have shortcut keys listed (e.g., "Brush (B)").

## 🟡 Medium (Logic/Algorithms)

- [ ] **Implement a "Horizontal Flip" Tool**: Create a simple transformation that mirrors the current frame.
- [ ] **Add a "Checkerboard" Background Toggle**: Let users toggle between the dark theme and a classic transparent checkerboard.
- [ ] **New Shape: Isosceles Triangle**: Add a triangle generator to `shapes.ts` using integer math.

## 🔴 Focused (Performance/Architecture)

- [ ] **Optimize History Snapshots**: Implement a simple delta-compression for undo states to save memory on large canvases.
- [ ] **Canvas Zoom Centering**: Improve the zoom logic in `CanvasStage.tsx` so it zooms relative to the mouse cursor position.

---

### Where to start?

1. Check out the [Mental Model](docs/MENTAL_MODEL.md) guide.
2. Run the **CodeTour** (install the VS Code extension).
3. Reach out in the issues if you need help!
