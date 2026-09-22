# UI-Komponentenbibliothek (`@fassaden/ui`)

Solid + **Ark UI** + **Park UI** (Panda CSS). **Live-Shell (v2.0.528):** Splitter links/rechts, Bibliothek fix, Viewport-Menus, ScrollArea.

## Grill-Entscheidungen (2026-09-18)

| Thema | Beschluss |
|---|---|
| Sandbox-Rolle | Verbindliche Cutover-Spez |
| Recipes | Gezielt erweiterbar (z. B. ToggleGroup-Items / `tile`) |
| Alt-Composites | Entfernt (`ChipGroup`, `NumberStepper`, `UiTile`, `primitives/`) |
| Stepper | Park `NumberInput` |
| Chips | Single → `SegmentGroup`; Multi/Tiles → `ToggleGroup` |
| FieldRow | Dünner Panda-Layout-Wrapper |
| Sektionen | `Stack` + Heading |
| Library-Kacheln | `ToggleGroup` + `tile` |
| Datei-Menü | `Menu` |
| Summary | `Card` |
| Farben | `ColorPicker` (Ark-Anatomie: Hex + Trigger + Popover) |
| Inaktiv aus | `ConditionalReveal` / `Show` |
| Ebenen | Ark `TreeView` (v2.0.525); ein Haus ohne Wurzel „Haus“ (v2.0.540) |
| Ebenen-Modus | entfällt in Park (v2.0.532): Schmuck + Ebenen gemeinsam |
| Ebenen-Zeile | Label links + Meta rechts |
| Ebenen-Aktionen | Ark Context Menu, nur Rechtsklick (v2.0.540) |
| App-Layout | Ark `Splitter` (v2.0.526) — eine Shell, kein Grid-Overlay |
| Splitter-Greifer | Pill im 8px-Trigger auf der Trennlinie (v2.0.540); nur `RootProvider` |
| Scrollleisten | Scrollen ok, **keine** sichtbaren Bars in `html.park-shell` (v2.0.537) |
| Desktop-Bibliothek | Nur bei Auswahl, Slide-in (v2.0.538); Höhe Tabs + Filterband + 6,5 rem |
| Farb-Filter | `ToggleGroup` outline/sm, eine Kategorie (v2.0.538) |
| App-Loader | Park `Progress` indeterminate (v2.0.538) |
| Viewport-Chrome | Ark `Menu`-Dropdowns (v2.0.528) |

## Live-Shell (v2.0.526 / v2.0.528)

| Panel | Inhalt |
|---|---|
| Links | `LeftChromeApp` in `ScrollArea` |
| Mitte oben | Viewport-Chrome (Menu-Dropdowns) + Canvas |
| Mitte unten | `LibraryDockApp` **feste Höhe** (`11.5rem`), kein Greifer |
| Rechts | Selection / Scene in `ScrollArea` |

**DoD:** Spalten links/rechts ziehbar; Bibliothek fix; Scrollbars = ScrollArea; Ansichts-Chrome = Menu.

Mount: `mountLiveShellApp` → `#park-live-shell`. Adapter: `src/ui/liveShellBridge.ts`. Klasse `html.park-shell`. Vanilla-IDs bleiben (`.vanilla-legacy-park`).

**Noch FormMirror / Tree-Scan:** Domain-Felder und Ebenen-Klicks weiter über Vanilla-IDs. **Geplant:** Export/Plan Park; FormMirror ablösen.

**Park-Restore (v2.0.552):** Bedien-Parität über **Adopt-Slots** (`data-park-adopt`) in Hybrid-FormMirror — siehe [park-restore.md](park-restore.md). Kein zweites sichtbares Vanilla-Chrome.

## Bridge (ältere Inseln / Intern)

Regel: Domäne bleibt in der App; `@fassaden/ui` bekommt nur **View-Models** + Mount-Funktionen. Keine `Wall`/`Opening`/`EditorState`-Imports in der Lib.

| Insel | Host (Live) | Model / Mount |
|---|---|---|
| Release Notes | `#ui-island-release` (in Left-Shell) | `ReleaseNotesModel` → `mountReleaseNotesIsland` |
| Datei-Menü | Teil der Left-Shell | `FileMenuIsland` |
| Ansicht / Chrome | Teil Viewport-Shell | `ViewportChromeApp` |
| Licht & Schatten | Teil Scene-Shell | Slider in `SceneToolbarApp` |

Vanilla-IDs der ersetzten Controls bleiben im DOM — siehe `keine-ui-loeschen`.

## Stack

| Schicht | Technik |
|---|---|
| Verhalten / A11y | `@ark-ui/solid` |
| Optik | Park UI Recipes + Theme |
| CSS | Panda (`styled-system/`, `npm run codegen`) |
| Runtime | `solid-js` |
| Icons | `lucide-solid` |

## Start

```bash
npm run codegen
npm run dev:ui
# → http://127.0.0.1:5173/ui-sandbox.html
```

## Sandbox ↔ Live-App

| Live-App (Vanilla) | Park / Lib |
|---|---|
| `view-mode` / Scope (eine Wahl) | `SegmentGroup` |
| Kanten / Multi-Chips | `ToggleGroup` |
| Bibliothek-Kacheln | `ToggleGroup` `tile` |
| Zahl ± | `NumberInput` |
| Einstellungszeile | `FieldRow` |
| Sektionstitel | `Stack` + Text |
| Datei-`<details>` | `Menu` |
| Summary-Tile | `Card` |
| Farbwahl / Swatches | `ColorPicker` (+ `SwatchGroup` im Popover) |
| Strichstärke | `Slider` |
| Version / Release Notes | `ReleaseNotesIsland` (Bridge) |
| Ebenen-Baum | `TreeView` + `NavigationMenu` vertical (Aktionen) |
| Inaktiv ausblenden | `ConditionalReveal` |

## Park UI erweitern

```bash
npx @park-ui/cli add drawer    # einzeln
npm run codegen
```

Nach CLI: Slot-Recipes in `theme/recipes/index.ts` unter `slotRecipes` prüfen.

## Fallstricke

- **Slot-Recipes:** Park-CLI legt oft unter `recipes` ab → nach `slotRecipes` verschieben + codegen.
- **React-JSX in Sandbox:** `resolve.conditions` inkl. `solid`; Solid-Plugin für `@ark-ui` und `lucide-solid`.
- **`server.watch: null`:** nach Config/Sandbox-Änderung Server neu starten.
- **ToggleGroup Stock:** ohne Item-Recipe nur Text — erweitert in `toggle-group.ts` (`variant`, `size`, `tile`).
- **ColorPicker Stock-Recipe:** ohne `channelInput`/`trigger` nur nacktes Hex — Slots in `color-picker.ts` ergänzt; Sandbox wie Ark-Doku.
- **Menu.Trigger:** Park-Trigger unstyled + Stack `alignItems: stretch` → volle Breite; `asChild` + `Button`, Trigger `width: fit-content`.
- **Bridge-Hosts:** Neue Inseln brauchen einen leeren Mount-Div; alte `id=`-Elemente nicht löschen, nur `hidden`.
- **Park in Live-App:** Vanilla-`button` muss in `@layer base` liegen und **`[data-scope]` ausnehmen** (sonst Padding/Border auf Splitter, SegmentGroup, ToggleGroup). `Dialog.ActionTrigger` immer als Park-`Button`. Radii `l1`/`l2`/`l3` in Theme-Tokens.
- **Splitter-Greifer:** Trigger nicht 1px / Indicator nicht `display:none` — 8px + sichtbarer Grip (`ResizeTriggerIndicator`).
- **Ebenen-Aktionen:** Navigation Menu erntet `.os-menu` unsichtbar (`html.fb-harvest-menu`); Vanilla-`.layer-more-btn` bleibt.
- **ScrollArea:** `ScrollbarWithThumb` nur mit **ungestyltem** Ark `Scrollbar` + Kind `Thumb` (Recipe-Klassen als `class`). Gestylte `withContext`-Wrapper für Scrollbar/Thumb nesten den Thumb außerhalb von `ScrollAreaScrollbarProvider` → `ContextError`, leere App (v2.0.529 unzureichend, Fix v2.0.534). Nie `defaultProps` auf Thumb. Smoke-Check: [agent-smoke-check.md](agent-smoke-check.md).
- **FormMirror Accordion:** controlled `value` — nie reaktives `defaultValue` (MutationObserver würde sonst Maße wieder öffnen).
- **FormMirror Accordion Höhe (v2.0.570):** kein `expand-height` beim controlled Mount-Open (sonst `--height: 0`); Park-CSS `open → height:auto`; kein Auto-Open beim ersten Scan.
- **LibraryDock Adopt (v2.0.571 / v2.0.572):** Hosts bei Unmount zurück nach `#library-mode`; Dock nie wegen Auswahl/Stage unmounten (`data-open` / `data-dock-collapsed`).
- **FormMirror Show (v2.0.572):** keine Callback-Accessor auf `section()`/`block()` — sonst stale `<Show>` und Accordion stuck-closed.
- **Bibliothek-Register:** Ark `Tabs` (`variant="line"`), nicht SegmentGroup.
- **Ebenen-⋯:** Ark `Menu` + `Portal` (nicht NavigationMenu in Card mit `overflow:hidden`).
- **Touch (v2.0.533 / v2.0.535):** `html.ui-touch-chrome` + Park: keine linke/rechte Spalte, Bühnen-Chrome aus außer `#history-toolbar`. Bearbeiten → Ark `Drawer` unten mit `snapPoints` (25–100 % vh, Session wie Vanilla), sichtbarem `Backdrop`, Scroll im Content (`draggable={false}`).
- **Drawer-Content:** `background: white` (v2.0.536) — **`bg.default` nicht verwenden** (Token fehlt im Theme → transparentes Panel).
- **Laden:** Ark Progress **Linear** (`LinearIndeterminate`) — Loader, Toast, `#app-loading`, Licht-Modus-Overlay; kein Kreis-Spinner mehr in diesen Pfaden.
- **Linke Leiste (v2.0.532):** Datei neben Titel; Ebenen ohne Card/Titel; kein Segment Ebenen|Fassadenschmuck (beide Listen unter dem Haus).
- **FormMirror:** leere Sektionen (`controls.length === 0`) nicht als Akkordeon zeigen.
- **Viewport-Chrome auf dunkler Bühne:** `Button`/`IconButton` `variant="surface"` + `bg="white"` (Park: surface/subtle/outline — kein separates „white“, surface + weiß ist die helle Variante).
- **Library-Tiles:** Vanilla-Karten mit ToggleGroup-Recipe-Klassen (DnD); kein verschachteltes zweites `ToggleGroup.Root`.
- **FormMirror NumberInput:** immer `Input` + `Control` mit Increment/Decrement — sonst nur Pfeile ohne Wert.
- **Checkbox CSS:** Park-Overrides nur auf `[data-part='root']` — nie auf alle `[data-scope='checkbox']` (Control teilt den Scope; `width: fit-content !important` kollabiert die Box auf ~2 px).
- **Accordion ItemBody:** Padding über Klasse `.accordion__itemBody` (Slot hat oft kein `data-part`); ohne Padding + `overflow:hidden` am Content wirkt die Control-Kante abgeschnitten.
- **FormMirror:** Vanilla ± neben `input[type=number]` nicht spiegeln; `.toolbar-stepper[id]` als `toolbarStepper` (v2.0.573); Write über Vanilla ± (v2.0.574); `.scope-toggle` als `toggleRow`.
- **FormMirror Adopt:** u. a. `window-hinge-modes` (ganzes `#window-hinge-section`-Details); Cleanup ohne Remount-Race (`placedHost`/Registry); Anchor ohne `hidden`.
- **ScrollArea content:** nicht `minW: min-content` (schneidet Checkboxen/Felder links ab).

## Struktur

```
packages/ui/src/
  components/ui/   # Park (CLI)
  theme/           # Tokens, Recipes
  composites/      # FieldRow, UiStack, ConditionalReveal
  bridge/          # View-Models + Live-Inseln (mount*)
  styles/park.css
sandbox/
```

Legacy Vanilla-Tokens: [ui-kit.md](ui-kit.md).
