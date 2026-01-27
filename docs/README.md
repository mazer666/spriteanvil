# SpriteAnvil Docs

Diese `docs/`-Sektion ist die **Single Source of Truth** für Architektur, Module, Code-Standards und die wichtigsten Arbeitsabläufe.  
Die Pläne/Specs sind so aufgebaut, dass **Einsteiger** das Projekt verstehen und erweitern können, ohne dass die Codequalität leidet.

---

## Schnellstart: Welche Doku zuerst lesen?

1. **Projekt-Roadmap & Vision:** [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)  
2. **Aktueller Integrationsstand + Architektur-Überblick:** [`FEATURE_INTEGRATION_PLAN.md`](./FEATURE_INTEGRATION_PLAN.md)  
3. **System-Architektur (Source of Truth):** [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
4. **Modul-Landkarte & Verantwortlichkeiten:** [`MODULE_GUIDE.md`](./MODULE_GUIDE.md) *(to be created)*  
5. **Coding Standards + Doku-Regeln:** [`CODE_STYLE.md`](./CODE_STYLE.md) *(to be created)*  
6. **Häufige Aufgaben Schritt-für-Schritt:** [`COMMON_TASKS.md`](./COMMON_TASKS.md) *(to be created)*  

---

## Dokumente in diesem Ordner

### Pläne (bereits vorhanden)

- [`PROJECT_PLAN.md`](./PROJECT_PLAN.md)  
  Umfassender Entwicklungsplan: Feature-Parität (Aseprite-like) zuerst, dann Innovation (AI, Symmetrie, UX, Cloud).  
  Definiert außerdem die Mindest-Doku, die in `docs/` existieren muss.

- [`FEATURE_INTEGRATION_PLAN.md`](./FEATURE_INTEGRATION_PLAN.md)  
  Beschreibt, was bereits integriert wurde (z.B. Fill/Shapes/Selection), inklusive Code-Pfaden, Data Flow und Integrationsschritten.

### Core Specs (werden als Nächstes erstellt)

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
  **Ziel:** Ein klarer Überblick über App-Schichten (UI/Editor/Tools/History/Render), Datenfluss und Performance-Prinzipien.  
  **Leser:** Jeder, der verstehen will, *wie* SpriteAnvil intern aufgebaut ist.

- `MODULE_GUIDE.md`  
  **Ziel:** “Landkarte” der Ordner/Module mit Verantwortlichkeiten und Verlinkungen.  
  **Leser:** Jeder, der schnell eine Stelle im Code finden oder ein Feature sauber erweitern will.

- `CODE_STYLE.md`  
  **Ziel:** Einheitliche Regeln für Naming, Typen, JSDoc, Kommentare, Fehlerbehandlung und Architektur-Header in Files.  
  **Leser:** Contributors & “Future You”.

- `COMMON_TASKS.md`  
  **Ziel:** Schritt-für-Schritt Guides für typische Änderungen (z.B. neues Tool hinzufügen, Undo/Redo erweitern, Preview-Overlay, Selection-Operation anschließen).  
  **Leser:** Einsteiger, die “einfach etwas ändern wollen”, ohne das Projekt zu zerlegen.

---

## Dokumentations-Konventionen

Damit die Docs “GitHub-clean” bleiben:

- **Dateinamen:** `UPPER_SNAKE_CASE.md` für Core-Dokumente, konsistent mit bestehenden Files.
- **Markdown:** klare Überschriften-Hierarchie (`#`, `##`, `###`), keine überlangen Absätze.
- **Links:** relative Links (z.B. `./ARCHITECTURE.md`).
- **Codeblöcke:** immer mit Sprache (` ```ts `, ` ```tsx `, ` ```css `).
- **Keine Dopplung:**  
  - Roadmap & Phasen gehören in `PROJECT_PLAN.md`.  
  - “Was ist integriert und wie” gehört in `FEATURE_INTEGRATION_PLAN.md`.  
  - “Wie ist das System gebaut” gehört in `ARCHITECTURE.md`.  
  - “Wie finde ich was” gehört in `MODULE_GUIDE.md`.  
  - “Wie schreibe ich Code hier” gehört in `CODE_STYLE.md`.  
  - “Wie mache ich X” gehört in `COMMON_TASKS.md`.

---

## Nächste Schritte (Docs-Backlog)

1. `ARCHITECTURE.md` ✅ (dieses Dokument)
2. `MODULE_GUIDE.md` erstellen  
3. `CODE_STYLE.md` erstellen  
4. `COMMON_TASKS.md` erstellen  

> Danach folgen feature-spezifische Specs (Selection Model, Export Format, Timeline, etc.), sobald die Core-Doku steht.
