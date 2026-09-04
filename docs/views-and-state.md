# Views, State & Navigation – Technische Dokumentation

## App-Views

```ts
// src/utils/persistence.ts
type AppView = 'front' | '3d' | 'top' | 'export'
```

| View | Label | Darstellung | Kamera |
|---|---|---|---|
| `'front'` | 2D | Ortho-Canvas (SVG offscreen) | `frontCamera` |
| `'3d'` | 3D | Three.js Perspektiv + OrbitControls | `camera` (perspektiv) |
| `'top'` | Oben | Three.js Ortho von oben auf die 3D-Szene | `topCamera` über Dach (`sceneContentMaxY` + Pad), `viewYawDeg` für Kompass |
| `'export'` | Export | Raster-Vorschau + Format-Sidebar | Captures über Ortho/Top |

Legacy `'plan'` → `'top'`, `'edit'` / `'2d'` → `'front'`.

Wechsel via `setView(mode)` in `src/main.ts`. **Fassaden-Builder 2.0:** App-Start standardmäßig **2D-Front** + **Render**-Modus; **3D** wieder per `#view-btn-3d` wählbar. Gespeicherte `view: '3d'` aus `localStorage` wird beim Reload wiederhergestellt (Hash-Load bleibt `'front'`). Buttons Oben/Entwurf/Galerie/Einfach-Komplex und Ebenen-Panel sind weiter per `hidden` ausgeblendet (Code/Wiring bleibt). **v2.0.38 / v2.0.149:** Ladeoverlay `#app-loading` bleibt bis `bootstrapSceneLighting()` fertig ist (Atmosphäre/Horizont, Fenster-Meshes, erstes Shadow-Map-Bake) plus zwei Animationsframes — nicht mehr sofort in `finally`. Loader: SVG „Haus vom Nikolaus“ (nur vollständige Eulerwege), Strich per `stroke-dashoffset` in 720 ms, nahtloser Loop ohne Eckpunkte, Text „Studio wird geladen …“ (v2.0.4).

Beim Wechsel zur `'top'`-Ansicht wird die Kamera zentriert (`framePlanCameraToContent`, `planZoom = 1`).

**Bearbeitung:** `isSceneEditView()` (`3d` \| `front` \| `top`) nutzt dieselben Pointer-Handler — Pick auf Meshes, Wand-Greifer, Öffnungs-Drag, Kontextmenü. Oben: wie 3D (⌘/Ctrl-Ziehen dreht Himmelsrichtung, ⌘/Ctrl+⇧ schwenkt), zusätzlich **Shift+LMB auf leerem Bereich** / Mittelmaus Pan; **Shift/Ctrl/Cmd+Klick auf Wand/Öffnung/Decke** = Mehrfachauswahl (v2.0.16). Mausrad/`+`/`-` Zoom.

3D- und Oben-Orbit: Cmd/Ctrl+LMB drehen, Cmd/Ctrl+Shift+LMB schwenken, RMB ohne Modifier = Kontextmenü. **`siteYawDeg`** gilt in 3D und Oben (`siteYawForView()`). Kamera ohne Dämpfung, Dirty-Rendering (v0.7.74), Orbit-Lite auch für Mausrad (v0.7.77). Siehe [ux.md](ux.md).

---

## Seitenansichten (geplant)

Neuer View-Filter `ElevationFilter` für `'front'`:

```ts
type ElevationFilter =
  | { kind: 'all' }                // Alle Wände
  | { kind: 'yaw'; yaw: number }   // Nur Wände dieser Ausrichtung (+ 180°-Gegenseite)
  | { kind: 'wall'; wallId: string } // Nur diese eine Wand
```

Toolbar-Buttons (dynamisch aus den vorhandenen `yawDeg`-Werten):

| Button | Bedingung | Yaw |
|---|---|---|
| Alle | immer | — |
| N | yaw = 0° | Nord |
| W | yaw = 90° | West |
| S | yaw = 180° | Süd |
| O | yaw = 270° | Ost |
| *n*° | sonstige Winkel | |
| Diese Wand | genau 1 Studio-Wand gewählt | — |

**2D (SVG):** `FacadeSvgView.setElevation(filter)` filtert die dargestellten Wände. Das SVG-Layout nutzt weiterhin `wall.x`/`wall.y` — bei gefilterten Ansichten werden nur die Wände der Sicht gerendert.

**2D (Ortho):** `applyFrontCameraView(bounds)` nutzt `getWallBounds(wallsForElevation())` statt aller Wände. **Zoom/Pan:** Mausrad zoomt zum Cursor (Wheel-Delta pro Frame gebündelt, exponentiell; Orbit-Lite während Navigation), **Doppelklick** zoomt 2× zum Klickpunkt mit weicher Animation (~280 ms, v2.0.21), **Rechtsklick** / Mittelmaus / **⇧**+Ziehen auf **leerem Bereich** verschiebt (Pan in Bildschirmachsen wie OrbitControls, v0.7.340); **⇧/Ctrl/Cmd+Klick auf Objekt** = Mehrfachauswahl (v2.0.16). Front-Kamera-Layout wird gecacht — Zoom/Pan ohne Wand-Neuberechnung pro Frame (v2.0.21). **+** / **−** / **0** (Einpassen). State: `frontZoom`, `frontPanScreenX`, `frontPanScreenY`. Export-Capture nutzt `fitOnly: true` (immer Einpassen). Gesims- und Fenster-Werfschatten auf Paneeeln/Rahmen in 2D-Front (v0.7.344).

---

## Persistenz (`src/utils/persistence.ts`)

### Storage-Key: `fassaden-builder-state-v6`

```ts
interface PersistedAppState {
  schemaVersion?: number  // Fassaden-Schema, siehe FACADE_SCHEMA_VERSION
  facade: FacadeState
  editor: EditorState
  view: AppView
  sun?: SunSettings
  editScope?: EditScope
  editFacadeYawFilter?: number[] | null
  scene?: SceneAppearance
  bloom?: BloomSettings
  fog?: FogSettings
  lod?: LodSettings
}
```

Laden: `applyFacadeLoadPipeline` (`migrateFacadeSchema` → `clampFacadeState` inkl. `hydrateFacadeState` → ggf. Außenkanten-Fit nur bei Mehrheit `panelFlip: false` → `finalizeStudioGeometry`). Speichern setzt immer `FACADE_SCHEMA_VERSION`. Details: [migration.md](migration.md). Korrekturen an **bestehenden** Wänden: abgeleitete Werte jedes Load; persistierte Fehlstände als Schema-Step (v0.7.222 / Schema 11: invertierte Abzweig-Fugen). **v2.0.93:** Hard-Reload verschiebt keine Wand-Origins mehr über die alte „unverbundene Ringe“-Fit-Heuristik.

**Teilen-Link (`#f=`):** Zusätzlich zu `facade` optional `scene` (Szene-Farben) und `viewYaw` (Kompass). Siehe [ux.md](ux.md#url-hash-live-srcutilssharets).

`scene` steuert die Szene-Farben (3D-Hintergrund, Untergrund, Glas-Himmelsreflexion). Defaults in `DEFAULT_SCENE_APPEARANCE` (alle drei `#ffffff`), normalisiert über `normalizeSceneAppearance`. UI: einzeln oder `#scene-all-color` für alle drei zugleich.

Ansicht (`#view-mode-select`) und Darstellung (`#render-style-select`) sind Dropdowns; der Gründerzeit-Typ wird über `#window-preset-select` gewählt.

Migration:
- v4 und v5 werden automatisch geladen und in v6-Format überführt
- `floors`-Array wird validiert (`isFloorPlanArray`) bevor es übernommen wird
- `Wall.planLinked` fehlt → Hydrate schreibt `true` (bisher verknüpft)
- Schema-Leiter und Hydrate: [migration.md](migration.md)

### `loadPersistedState(): PersistedAppState | null`

Lädt und validiert aus localStorage. Migriert Legacy-Saves (v4/v5). Gibt `null` bei fehlenden oder defekten Daten zurück.

### `savePersistedState(state)`

Speichert den gesamten App-State als JSON inkl. aktueller `schemaVersion`. Fehler (Quota, Private Mode) werden stillschweigend ignoriert.

---

## Editor-State (`src/types/facade.ts`)

```ts
interface EditorState {
  selectedWallIds: string[]
  selectedOpenings: OpeningRef[]
  selectedEdges: OpeningEdge[]
  selectedOpeningPart?: OpeningPart
  selectedWallPart?: 'group' | 'cornice' | 'plinth' | 'cladding'
  selectedRoofBuildingId?: string
  selectedRoofPart?: 'group' | 'shell' | 'tiles' | 'gutter'
  selectedCeiling?: { buildingId: string; floorIndex: number }
  selectedBuildingId?: string
}
```

Wird nicht in `FacadeState` gespeichert, sondern separat in `PersistedAppState`. Wird bei `commitState` immer auf die aktuell gültigen IDs bereinigt (gelöschte Wände werden aus der Selektion entfernt).

### Multi-Building-Zugriff

Renderer und State-Utils nutzen `src/utils/buildings.ts`:

| Funktion | Verwendung |
|---|---|
| `getAllWalls` | Lesen aller Wände (Profilpfade, Layout, Nachbarschaft) |
| `getVisibleWalls` | Rendering ohne `building.hidden` / `floor.hidden` / `wall.hidden` |
| `buildProfilePaths` | Gesims, vorstehende Profile, Sohlbank — nur sichtbare Wände; `opening.hidden` übersprungen |
| `findWall` / `findBuildingForWall` | Lookup nach Wand-ID |
| `mapAllWalls` / `updateBuilding` | Öffnungen, Gesimse, gebäudeweise Patches |

2D (`FacadeSvgView`) und 3D (`FacadeController`) filtern sichtbare Wände; Dach und Innenböden pro Gebäude.

---

## Undo/Redo (`src/utils/history.ts`)

`EditHistory` — Stack-basiertes Undo/Redo.

- `record(snapshot)` — speichert aktuellen Zustand
- `undo(current)` / `redo(current)` — gibt vorherigen/nächsten Zustand zurück
- `beginDragUndo()` / `finishDragUndo()` — verhindert Undo-Einträge bei jedem Drag-Tick; ein Eintrag für die gesamte Drag-Bewegung

Tastatur:
- `Cmd/Ctrl + Z` → Undo
- `Cmd/Ctrl + Shift + Z` → Redo

---

## Grundriss-Kamera-Navigation (`src/main.ts`)

Variablen:

```ts
let planZoom = 1          // Zoom-Faktor (0.3…5)
let planOffsetX = 0       // Pan-Offset Welt-X (cm)
let planOffsetZ = 0       // Pan-Offset Welt-Z (cm)
let planPanActive = false
```

`syncPlanCamera(camera, aspect, zoom, offsetX, offsetZ)`:

```
Frustum-Halbbreite  = span / (2 × zoom)
Frustum-Halbhöhe   = halfW / aspect
Kamera-Mitte        = (PLAN_VIEW_SIZE/2 + offsetX, PLAN_VIEW_SIZE/2 + offsetZ)
```

**Zoom-to-Cursor** im Wheel-Handler: Vor dem Zoom wird der Weltpunkt unter dem Cursor berechnet, nach dem Zoom wird `planOffsetX/Z` so korrigiert, dass derselbe Weltpunkt wieder unter dem Cursor liegt.

---

## Edit-Scope: Element / Typ / Etage / Fassade

In `src/main.ts` / `src/studio/editScope.ts`:

```ts
function commitStudioPanelPatch(patch) {
  const ids = editWallTargets(state, editor, editScope, editFacadeYawFilter)
  commitState(updateStudioPanel(state, ids, patch))
}
```

Buttons `#edit-scope-element|type|floor|facade` in `#edit-scope-bar`. Bei Fassade: `#edit-scope-facade-yaws` (Himmelsrichtungen). Persistiert als `editScope` / `editFacadeYawFilter`. Ersetzt die frühere Checkbox `#studio-apply-all` (nur Paneele).

Gilt analog für Gesims, Wandfarben, Öffnungs-Profil, Fensterbank, Treppe, Rahmen/Glas — jeweils über `editWallTargets` oder `editOpeningTargets` / `scopedOpeningRefs()`.

Bei Scope **Etage** werden alle `floorIndex`-Werte aus der aktuellen Auswahl gesammelt (nicht nur der erste Anker), sodass Multi-Etagen-Auswahl alle betroffenen Geschosse trifft.

Bei Scope **Typ** werden alle Öffnungen mit gleichem `type` (Fenster bzw. Tür) im ganzen Gebäude getroffen — nicht mehr nach Breite/Höhe/Keller gefiltert. Wand-Edits unter Typ folgen weiter der Paneel-Konfiguration.

**v0.7.293:** Scope **Fassade** optional auf gewählte Yaws gefiltert (`editFacadeYawFilter`).

**v0.7.243:** Glas-EnvMap von einer CubeCamera *vor* dem Haus; Szenen-/Nebel-Farbfelder mit RGB/HSL/HEX.

**v0.7.242:** Scope **Fassade** trifft alle Öffnungen der Hausseiten ohne Keller-Ausnahme. `scopedOpeningRefs()` filtert nicht mehr nach Keller-Parität.

---

## Öffnungen: Größe ändern

In `#toolbar-opening` (sichtbar wenn Öffnung selektiert):

- `#opening-width` — Breite-Input, step = 16 cm
- `#opening-height` — Höhe-Input, step = 16 cm

Bei Auswahl einer Öffnung werden die Inputs mit den aktuellen Werten befüllt. Bei Breitenänderung bleibt die Öffnung **mittig** zur bisherigen Position (z. B. +8 cm → je 4 cm links und rechts); X wird mit `centeredOpeningX` auf halbem Maß-Raster berechnet. Höhe ändert nur `height` (Türen bleiben unten bei y = 0).

---

## Etagen in 3D duplizieren (v0.7.240)

Dialog `#storey-copy-dialog` (Etagen-⋯ **Duplizieren**, Bibliothek **+ oben**):

- Checkboxen: Paneele, Öffnungen, Wand-/Bekleidungs-/Profilfarbe, Gesims, Sockel
- **Auswahl speichern** — übernimmt die Häkchen und merkt sie (`fassaden-builder-storey-copy`)
- **Nur Grundriss übernehmen** — Wände ohne Optik und Öffnungen (`STOREY_COPY_PLAN_ONLY`)
- Abbrechen

`duplicateStorey(state, sourceFloorIndex, { copyOpenings, copy?, wallIds? })`:
- Klont Wände mit neuen UUIDs und `y += wallHeight` **am Dach** (höchste Etage + 1)
- `copy.openings` steuert Öffnungen; Treppen werden abgestreift
- Erweitert `state.floors` um Kopie des Quell-Grundrisses

`insertStoreyAbove(state, sourceFloorIndex, { copyOpenings, copy?, wallIds? })` (v0.7.113 / v0.7.115):
- Fügt Geschoss **direkt über** `sourceFloorIndex` ein
- Wände mit `floorIndex > source`: `y += wallHeight`; `floors[]` wird an Index `source+1` eingeschoben
- Wand-Kontextmenü **Darüber**; Etagen-⋯-Menü nutzt `duplicateStorey` (Ans Ende)
- Mehrere Klone: `planLinked` untereinander behalten; Einzelklon: `planLinked: false`

---

## Ebenen-Panel (`src/utils/layers.ts`)

Die Ebenen-Liste in der Sidebar gruppiert alle Wände nach Etage.

| Funktion | Beschreibung |
|---|---|
| `floorIndex(wall, wallHeight)` | Gibt den Etagenindex zurück: `round(wall.y / wallHeight)` |
| `floorLabel(index)` | `'Erdgeschoss'` / `'n. Obergeschoss'` |
| `groupWallsByFloor(state)` | `Map<number, Wall[]>` — Wände nach Etage |
| `buildLayerOrder(state)` | Flache Liste aller Wände, sortiert nach Etage (oben zuerst) |
| `layerIndexForWall(state, wallId)` | Position einer Wand in der sortierten Liste |
