# SpriteAnvil Docs

Willkommen in der Dokumentation von **SpriteAnvil** – einem Pixel-Art Sprite- & Animation-Builder mit Fokus auf einen klaren Workflow:
Frames zeichnen, modulare Parts wiederverwenden, mit Anchors riggen, und nach **Godot 4.5** (und generische Formate) exportieren.

> **Status:** Early development (v0.1). Dock-UI-Shell steht, Editor-Tools folgen als Nächstes.

---

## Inhaltsverzeichnis

- [Schnellstart](#schnellstart)
- [Dokumente (Docs Map)](#dokumente-docs-map)
- [Begriffe (Mini-Glossar)](#begriffe-mini-glossar)
- [Docs-Konventionen](#docs-konventionen)
- [Wie du an der Doku mitarbeitest](#wie-du-an-der-doku-mitarbeitest)

---

## Schnellstart

Wenn du nur wissen willst, **worum es geht**:

- Ziel: Pixel-first, grid-friendly, nearest-neighbor
- Workflow: Animation (Frames/Timeline) + modulare Parts + Rig/Anchors + Pixel-Overrides
- Export: Spritesheet PNG + JSON-Metadaten, später Godot-Import Helper

Siehe auch die Projektübersicht im Repository-README.

---

## Dokumente (Docs Map)

> **Hinweis:** Diese Liste ist das “Docs-Rückgrat”. Jedes neue Doku-Thema bekommt eine eigene Datei hier.

### 1) Vision & Scope

- **`vision-and-scope.md`**
  - Ziele, Non-Goals, Zielgruppe, Release-Meilensteine

### 2) UX / UI

- **`ux-ui.md`**
  - Dock Panels: Top Bar, Tool Rail, Canvas, Right Tabs, Timeline
  - Panel-Persistenz (localStorage)
  - Interaktionsregeln (Zoom, Grid, Selection, Drag/Drop, Shortcuts)

### 3) Datenmodell & Projektstruktur

- **`data-model.md`**
  - Kernobjekte: Project, Sprite, Animation, Frame, Layer, Palette, Part, Anchor/Rig
  - IDs, Referenzen, Versionierung/Migration (falls nötig)

### 4) Editor Tools

- **`editor-tools.md`**
  - Pen/Eraser/Fill
  - Rect + Lasso Selection
  - Transform (flip/rotate/scale) mit nearest-neighbor
  - Eyedropper, Magic Wand (Tolerance)
  - Stabilizer, Symmetry/Mirror
  - Replace Color, Outline, Gradient+Dither

### 5) Animation & Timeline

- **`animation-timeline.md`**
  - FPS + per-frame duration
  - Onion Skin (range + intensity)
  - Markers (Contact/Impact/Hold)
  - Diff View (Frame-to-frame, First↔Last Loop-Check)

### 6) Export & Godot 4.6

- **`export.md`**
  - Spritesheet PNG + JSON (Rects, Durations, Pivot/Origin, Offsets, Tags)
  - Auto-trim + korrekte Offsets
  - Optional: Einzel-Frames + JSON

- **`godot-4-6-integration.md`**
  - Empfohlene Import-Settings in Godot
  - Geplantes Import-Helper-Script (Format/Mapping)

### 7) Entwicklung / Beiträge

- **`dev-setup.md`**
  - Node.js 20+
  - `npm install`, `npm run dev`, `npm run build`, `npm run preview`
  - Branching: `main` (stable/pages), `dev` (active)
  - GitHub Pages base path (`/spriteanvil/`)

- **`contributing.md`**
  - Branch/PR-Flow
  - Code Style / Naming / TypeScript Regeln
  - Commit-Konventionen
  - “Definition of Done” (Tests, Lint, Doku-Update)

---

## Begriffe (Mini-Glossar)

- **Frame**: Ein Einzelbild innerhalb einer Animation (mit eigener Dauer möglich).
- **Onion Skin**: Überlagerung vorheriger/nächster Frames zum besseren Animieren.
- **Marker**: Zeitmarken für Animation (z.B. Contact/Impact/Hold).
- **Part**: Wiederverwendbares, modulares Sprite-Element (z.B. Hand, Kopf, Waffe).
- **Anchor**: Fixpunkt für Parts/Rigging (pixel-snapped).

---

## Docs-Konventionen

Damit alles “GitHub-clean” bleibt:

- **Dateinamen:** kebab-case (`editor-tools.md`, nicht `EditorTools.md`)
- **Überschriften:** genau ein `#` pro Datei, darunter `##`, `###` …
- **Links:** relative Links verwenden (`./export.md`)
- **Screenshots/Assets:** unter `docs/assets/` ablegen (wenn genutzt)
- **Diagramme:** bevorzugt **Mermaid** (wenn sinnvoll), ansonsten ASCII/Markdown

---

## Wie du an der Doku mitarbeitest

1. Neues Thema? → Datei in `docs/` anlegen (siehe Docs Map)
2. In **dieser** `docs/README.md` unter “Dokumente” verlinken
3. Kurz prüfen:
   - Ist es verständlich für Einsteiger?
   - Sind Begriffe konsistent (Frame/Part/Anchor etc.)?
   - Verweist es auf die “Source of Truth” (z.B. Export-Format)?

---

## Nächste sinnvolle Doku (Empfehlung)

Wenn wir nach diesem Index direkt die “wertvollste” Doku schreiben wollen:

1) `export.md` (weil Export “Outputs that work” zentral ist)  
2) `data-model.md` (damit Features & UI sauber daran andocken)  
3) `editor-tools.md` (weil “Editor tools come next” im Status steht)
