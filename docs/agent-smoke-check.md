# Agent-Smoke-Check (Live-UI)

Nach **jeder** Änderung an Park/Bridge/Live-Shell (`packages/ui/**`, `src/ui/**`, `index.html`, `src/style.css`) prüft der Agent **selbst**, bevor er „fertig“ meldet. Nicht den Nutzer als ersten Tester nehmen.

## Pflicht (Desktop-Dev)

1. Dev-Server läuft (`npm run dev` / Vite). Seite: `http://127.0.0.1:5173/` (Hard-Reload nach Recipe-/Bridge-Änderungen).
2. Kein `ContextError` / `useScrollAreaScrollbarContext` in der Vite-Konsole.
3. DOM: `html.park-shell`, `#park-live-shell` und `#park-live-library` vorhanden (IDs nicht crash-leer). Desktop **ohne** Auswahl: `.park-library-slide` nicht `data-open=true`. Mit Wand/Fenster: Slide-in, Splitter-Greifer (`[data-part=resize-trigger-indicator]`) sichtbar. Tab Farben: Filter-Chips mit `data-scope=toggle-group`. Start: `#app-loading-root` mit Park Progress bis `app-ready`.
4. Linke Spalte, Bühne, Bibliothek (bei Auswahl) sind gerendert (kein weißer/leerer Bildschirm).

## Bei Touch-/Chrome-Änderungen

- Schmales Viewport oder `html.ui-touch-chrome`: keine linke/rechte Spalte, Bühnen-Chrome aus außer Rückgängig/Wiederholen; Bibliothek bleibt.
- **Bearbeiten** öffnet den Ark-Drawer von unten.

## Build / Codegen

- Panda-Recipe geändert → `npm run codegen`.
- Größere UI-Änderungen → `npx vite build` (Compile reicht; WebGL in Sandbox-Browsern darf fehlen).

## Bei Opening-division / FormMirror-Änderungen

- Fenster wählen (Dev: `__fbDebug.selectOpening(wallId, openingId)` nach `listOpenings()`).
- Sektion **Teilung** öffnen — Accordion bleibt offen, Inhalt sichtbar (Höhe > 0).
- Flügel 1→2 (Park NumberInput-Pfeile); Sprossen senkrecht +1.
- Scharnier/Öffnungsart: Select je Flügel im Adopt-Slot (`[data-park-adopt-slot="window-hinge-modes"]`).
- Nach Flügel-Änderung: Hinge-Host bleibt im Slot; Selects aktualisieren sich.
- Optional: „Profilierte Sprossen“ + ein Holzmaß-Feld ändern.

## ScrollArea (Wiederholungsfehler)

`Thumb` **nur** als Kind von Ark-`Scrollbar` (`ScrollbarWithThumb` mit **ungestyltem** `@ark-ui/solid/scroll-area`). Niemals `defaultProps` auf Thumb, niemals styled `Scrollbar` + styled `Thumb` nesten — sonst leere App.

Siehe [ui-component-library.md](ui-component-library.md), Rule `agent-smoke-check.mdc`.
