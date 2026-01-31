# SpriteAnvil Mental Model

This guide helps you visualize how SpriteAnvil works. If you understand these three diagrams, you understand the engine.

## 1. The "Holy Trinity"

SpriteAnvil is build on the relationship between your mouse, the memory, and the screen.

```mermaid
graph TD
    User([User Action]) -->|Interaction| Events[Browser Events]
    Events -->|Coordinate Mapping| Engine[Editor Engine]
    Engine -->|Mutate| Buffer[(Pixel Buffer - Uint8ClampedArray)]
    Buffer -->|Sync| Canvas[HTML5 Canvas]
    Canvas -->|Visual| User
```

## 2. The Tool Life Cycle

Every tool (Pen, Fill, Rectangle) follows this heartbeat.

```mermaid
sequenceDiagram
    participant U as User
    participant CS as CanvasStage (UI)
    participant E as Editor (Core)
    participant H as History (Undo)

    U->>CS: Pointer Down
    CS->>E: Start Stroke (Capture baseline)
    
    loop Every Frame
        U->>CS: Pointer Move
        CS->>E: Apply Tool Algorithm
        CS->>CS: Render Preview Overlay
    end

    U->>CS: Pointer Up
    CS->>E: Finalize Mutation
    CS->>H: Commit Snapshot (If changed)
    CS->>U: See Final Result
```

## 3. Data Ownership

Who owns what?

```mermaid
graph LR
    subgraph UI [React Layer]
        App[App.tsx] --- Layout[DockLayout.tsx]
        Layout --- Stage[CanvasStage.tsx]
        Layout --- Tools[ToolRail.tsx]
    end

    subgraph Core [Logic Layer]
        Stage -->|Calls| Pixels[pixels.ts]
        Stage -->|Dispatches| Algos[editor/tools/*]
        Algos -->|Write| PixBuffer[(Pixel Buffer)]
    end

    subgraph State [Persistence]
        PixBuffer --- History[history.ts]
    end
```

---

> [!TIP]
> **Key Takeaway**: React handles the "Shell" (buttons, sliders, windows), but the "Heart" (the pixels) lives in raw JavaScript memory for maximum speed.
