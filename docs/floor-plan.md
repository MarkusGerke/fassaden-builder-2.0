# Grundriss-System – Technische Dokumentation

## Übersicht

Die gezeichnete Linie ist die **Außenkante**; die Wanddicke (`building.wallDepth`) liegt nach innen. Verknüpfung und Gehrung sitzen an den Außenecken. **v0.7.280:** `fitLoopWalls` folgt der Planrichtung (73dbdc9-Verhalten, ohne gegenläufigen 40-cm-Schnitt). **v0.7.279:** Altstände mit Origin innen (`panelFlip: false`) werden beim Laden auf diese Außenkante gelegt. Innenboden und Zwischendecke nutzen die Innenkante (`innerFaceRingWorld`, Inset = aktuelle Wandstärke → 0 cm Fuge zur Innenwand). Die **Oberkante** des Innenbodens liegt auf der unteren Türkante der Etage (`storeyFloorSurfaceY`); ohne Tür auf dem Wandfuß. Die Platte sitzt um `INDOOR_SLAB_THICKNESS` darunter.

---

## Datenstruktur (`src/studio/floorPlan.ts`)

```ts
interface FloorPlan {
  nodes: PlanNode[]   // Gitterpunkte (Knoten)
  edges: PlanEdge[]   // Verbindungen zwischen Knoten
  showCeiling?: boolean
  ceilingColor?: string  // Decke und Fußboden, Default Weiß
  hidden?: boolean
}

interface PlanNode {
  id: string
  gx: number   // Gitter-X (Integer, cm = gx × PLAN_GRID)
  gz: number   // Gitter-Z
}

interface PlanEdge {
  id: string
  fromId: string
  toId: string
}
```

**Gitterauflösung:** `PLAN_GRID = 48 cm` pro Zelle. Eine 45°-Kante über ein Feld hat die Länge \(48\sqrt{2}\) (`planLineLengthCm`, `PLAN_DIAGONAL_STEP`). Derselbe Schritt gilt in 3D für Greifer/Shift-Abzweig (`wallWidthStepCm`).

**Erlaubte Richtungen:** Achsparallel (0°/90°/180°/270°) und diagonal (45°/135°/225°/315°).

**Zeichenfläche:** `PLAN_DRAW_CELLS = 32 Zellen`, entspricht `32 × 48 = 1536 cm = 15,36 m`.

---

## Gebäude wählen, verschieben und drehen

### Auswahl und Verschieben

Im Grundriss (`navigate` / `edit`): Klick auf die Haus-Fläche (AABB) wählt das Haus (`selectBuilding`) und startet bei Drag das Verschieben.

- Offset immer vom **Start-Snapshot** (`planBuildingDrag.startState`) — kein doppeltes Aufaddieren während Preview.
- Snap und Hilfslinien: `collectBuildingGuides` / `snapBuildingOffset` in `src/studio/buildingGuides.ts`.
- Anzeige: Self-Linien cyan, Align-Linien orange (`FloorPlanView.showBuildingGuides`) — analog zu Fenster-Hilfslinien.
- Verschiebung: `offsetBuildingByGrid` (Plan-Knoten + Studio-`originX`/`originZ`).

### Drehen (±45°)

Linke Sidebar **Gebäude drehen**: `+45°` / `−45°`.

- Wenn ein Haus gewählt (oder aktiv) ist: **`rotateBuildingByDeg`** dreht Plan-Knoten und Wand-Origins/Yaw geometrisch um den Haus-Mittelpunkt (Plan-Gitter).
- Sonst Fallback: `rotateStudioBuilding` setzt nur `FacadeState.siteYawDeg` (3D-Site-Illusion; Plan bleibt lokal).

Dateien: `src/studio/rotateBuilding.ts`, `src/main.ts` (`commitBuildingRotate`).

---

## Grundriss zeichnen

### Modi

| Modus | Beschreibung |
|---|---|
| `'navigate'` | Standard; Pan/Zoom, Öffnungen verschieben |
| `'draw'` | Klick setzt Punkte, Ziehen zeichnet Linien |
| `'edit'` | Knoten/Kanten auswählen, verschieben, löschen |

### Navigation (Blender-Stil)

| Geste | Aktion |
|---|---|
| `Shift + LMB` ziehen | Pan (Verschieben) |
| `MMB` ziehen | Pan |
| Mausrad | Zoom (zum Cursor) |
| `+` / `-` | Zoom rein/raus |
| `Cmd/Ctrl + 0` oder `Numpad0` | Ansicht zurücksetzen |

---

## Ring-Erkennung

### `extractPlanRings(plan): PlanRing[]`

Analysiert den Graphen und erkennt:
- **Geschlossene Ringe** — Gebäudeumrisse (werden zu Studio-Wänden mit Gehrung an allen Ecken)
- **Offene Ketten** — freistehende Wandlinien (Gehrung nur wo Knoten verbunden sind)

Geschlossene Ringe werden per `ensureCCW` gegen den Uhrzeigersinn orientiert. Das stellt sicher, dass Außenecken positive Miter-Werte erhalten.

Kollineare Zwischenpunkte werden mit `simplifyCollinear` entfernt, um unnötige Wand-Segmente zu vermeiden.

---

## Gehrungsberechnung

### `miterInsetCm(incoming, outgoing, depth)`

Berechnet den Gehrungsversatz für einen Knoten. **Rechtwinklige Ecken** (`|turn| ≈ 90°`) → Inset = `depth` (45°-Schnitt). Flush/stumpf steuert `cornerJoin` an Paneel/Sockel/Gesims, nicht diesen Versatz.

```
miter = depth × tan(Drehwinkel / 2)
```

| Winkel | depth = 32 cm | Ergebnis |
|---|---|---|
| 90° (rechte Außenecke) | 32 cm | **32 cm** (Gehrung) |
| 45° (stumpfe Außenecke) | 32 cm | ~13 cm |
| 135° (spitze Außenecke) | 32 cm | ~77 cm |
| 180° (gerade, kein Knick) | beliebig | 0 cm |

Vorzeichen:
- Positiv = Wand wird am Ende kürzer (Außenecke)
- Negativ = Wand überragt die Ecke (Innenecke)

### Schutz vor zu großen Miters

Falls `|miterStart| + |miterEnd| > 90 % der Wandlänge`, werden beide proportional auf 90 % skaliert. Das verhindert invertierte Wandgeometrie bei sehr kurzen Wand-Segmenten oder spitzen Winkeln.

### `assignMiters(nodes, closed, depth)`

Berechnet `miterStart` und `miterEnd` für jedes Wandsegment in einer Kette/Ring.

- Offene Kettenenden: miter = 0 (kein Schnitt)
- Geschlossene Ringe: alle Knoten haben Nachbarn → miter ≠ 0

---

## Innenkante für Etagen-Trennfläche

Plan-Knoten liegen auf der **Außenlinie** der Wand (`createStudioWallGeometry`: lokale `z = 0` außen, `z = WALL_DEPTH` innen, Dicke nach innen).

`innerFaceRingFromWalls` (in `panelGeometry.ts`) schneidet die Innenkanten der zugeordneten Studio-Wände (Zuordnung per Abstand zur Plankante, nicht nur exakte Rasterpunkte). Ergebnis: 0 cm Fuge zur Innenwand, Abstand zur Außenwand = `wall.depth`. Fallback: `innerFaceRingWorld(nodes, depth)`.

---

## Wände generieren

### `wallsFromFloorPlan(plan, wallY?, panel?)`

Erzeugt `Wall[]` aus einem `FloorPlan`:

1. `extractPlanRings` → Ringe und Ketten
2. `assignMiters(ring, closed, wallDepth)` → Gehrungsversatz pro Segment (Tiefe = `building.wallDepth`, nicht fest 32 cm)
3. Pro Segment: `createStudioWall` mit `originX`/`originZ`/`yawDeg`/`miterStart`/`miterEnd`
4. `panelFlip: true` — Paneele auf der Außenseite (z = 0)
5. `planLinked: true` — Wand gehört zum Grundriss-Graphen
6. `wallY` als y-Offset (Etagenindex × `wallHeight`)

`floorPlanFromWalls` / `syncFloorPlansFromWalls` lassen Wände mit `planLinked: false` weg. Freie Wände liegen nur in 3D; Gehrung zu Nachbarn erst nach Verknüpfen.

### `wallYawDegFromSegment(from, to)`

Berechnet den Yaw-Winkel einer Wand aus zwei Gitterpunkten. Nutzt `atan2(-dz, dx)` — der negative dz-Term entspricht der Three.js-Konvention, bei der positive Z-Achse nach hinten zeigt.

---

## Etagen

### Speicherung

```ts
// FacadeState
floors?: FloorPlan[]   // Index 0 = Erdgeschoss, 1 = 1. OG, …
wallHeight: number     // Geschosshöhe in cm (Standard: 448 cm)
```

### Etagenindex aus Wandposition

```ts
// src/utils/layers.ts
function floorIndex(wall: Wall, wallHeight = WALL_HEIGHT): number {
  return Math.round(wall.y / wallHeight)
}
```

### Wände generieren (alle Etagen)

```ts
// src/main.ts
const walls = floors.flatMap((plan, i) =>
  wallsFromFloorPlan(plan, i * state.wallHeight, existingPanel)
)
```

### Etage hinzufügen / duplizieren

**`duplicateStorey` / `insertStoreyAbove` (v0.7.240):** Klont Wände einer Etage mit `y += wallHeight`. Dialog `#storey-copy-dialog`: Checkboxen, **Auswahl speichern** oder **Nur Grundriss übernehmen**. Hilfslinien beim Zeichnen: `collectPlanDrawGuides` (orangene Linien bei bündigem Cursor).

---

## Grundriss-Overlay in 3D

### `FloorPlanView` (`src/studio/floorPlanView.ts`)

Three.js-Objekt, das den Grundriss als 3D-Overlay im Plan-View rendert.

**Gruppen:**
- `nodesGroup` — Knoten-Meshes (Zylinder)
- `edgesGroup` — Kanten-Meshes (Boxen)
- `wallOverlayGroup` — Halb-transparente Wand- und Öffnungs-Overlays

### `rebuildWallOverlay(walls, activeFloor?)`

Zeichnet vorhandene Studio-Wände als blaue halbtransparente Rechtecke in der Draufsicht.

- Optional: `activeFloor` filtert auf eine Etage (`floorIndex(wall) === activeFloor`)
- Pro Öffnung: oranges halbtransparentes Mesh mit `userData.wallId` + `userData.openingId`
- Position via `wallAlongDelta(yawDeg)` — konsistentes Vorzeichen mit der 3D-Darstellung

### `pickPlanOpening(raycaster)`

Gibt `{ wallId, openingId }` zurück wenn ein Öffnungs-Mesh getroffen wurde. Wird im `navigate`-Modus genutzt für Selektion und Drag.

### `syncPlanCamera(camera, aspect, zoom, offsetX, offsetZ)`

Setzt die Orthokamera für die Grundriss-Ansicht. Berücksichtigt Zoom-Faktor und X/Z-Offset (Pan).

---

## Öffnungen im Grundriss verschieben

Im `navigate`-Modus können Öffnungen per Drag entlang der Wand verschoben werden:

1. `pointerdown` → `pickPlanOpening` → Öffnung selektieren, `planNavDragStart` speichern
2. `pointermove` → akkumuliertes Delta vom Startpunkt projiziert auf Wandachse via `wallAlongDelta`
3. `state` wird temporär aktualisiert (kein Undo-Eintrag pro Tick)
4. `pointerup` → `commitState` (ein Undo-Eintrag für die gesamte Drag-Bewegung)

**Pfeiltasten im Plan-View:**
- Links/Rechts: Öffnung entlang der Wand (dx ±16 cm)
- Hoch/Runter: Öffnung vertikal (dy ±16 cm)
