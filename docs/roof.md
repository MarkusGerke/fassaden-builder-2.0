# Dach (Berliner Mansarde)

Mansarddach auf dem **primären Nesting-Outer** der obersten Etage (`planFacesWithHoles` / `topRoofFaceWorld` — Höfe sind Löcher, nicht eigene Outer).

## Verhalten

- Linke Sidebar **Ebenen**: ohne Dach → Button **Dach hinzufügen**; mit Dach → Zeile wie Wand/Fenster. Klick wählt Dach (`EditorState.selectedRoofBuildingId`), Einstellungen in der **rechten Toolbar** (`#toolbar-roof`). Kontextmenü: **Ausblenden** (`roof.hidden`) und **Löschen** (`enabled: false`).
- Nur aktiv, wenn die oberste Etage einen geschlossenen Ring hat (`planHasClosedRing`).
- **Seiten ohne Paneele** (`!wallHasPanels`): Traufe **bündig** zur Wandaußenlinie, **keine** Rinne an dieser Kante (Öffnungen/Gesims allein halten den Überstand nicht).
- Sonst: globaler `overhang` und Rinne (wenn aktiviert).
- Mansarden-Knick bleibt fest bei **55 %** von `ridgeHeight` (kein UI-Knick). Trapez gilt nur für die **Ziegel** (`tileTaper` / `tileTaperDepth`), analog Paneele — Inset aus Kachelmaß × `(1 − tileTaper)`, Frustum immer bei `tileTaperDepth > 0`.
- In **Zeichnung**: Dach weiß + Kantenlinien (wie übrige Szene).
- Ohne Gauben. Kranzgesims bleibt unabhängig unter der Traufe nutzbar.

## Daten

`Building.roof` (`RoofConfig` in `src/types/facade.ts`), Defaults/`normalizeRoof` in `src/studio/roof.ts`. UI und `facadeHasRoofablePlan` beziehen sich auf das **aktive Gebäude**; `buildMansardRoof` baut pro sichtbarem, nicht verstecktem Gebäude (FacadeController ruft es pro Gebäude auf).

| Feld | Default | Bedeutung |
|---|---|---|
| `enabled` | `false` | Dach anzeigen |
| `hidden` | `false` | Dach temporär ausblenden (Ebenen-Dimmen, kein 3D-Mesh) |
| `pitchLower` | 70° | Steiler unterer Mantel |
| `pitchUpper` | 30° | Flacherer oberer Mantel |
| `overhang` | 40 cm | Traufüberstand an **belegten** Seiten |
| `ridgeHeight` | 280 cm | Höhe Traufe → First |
| `tileColor` | `#8b3a2a` | Ziegelfarbe |
| `gutter` | `true` | Dachrinne (nur belegte Kanten) |
| `tileWidth` / `tileHeight` | 32 / 24 cm | Sichtmaß (8-cm-Raster) |
| `tileJoint` | 0,8 cm | Fuge |
| `tilePattern` | `runningBond` | wie Paneel-Muster (`strip`, `runningBond`, …) |
| `tileProfile` | `pantile` | `barrel` (gewölbt) oder `pantile` (S-Schwung) |
| `tileProjectDepth` | 3 cm | Ziegeldicke / Vorstand |
| `tileTaper` | 0,85 | Vorder/Rück (0…1), Zugespitztheit |
| `tileTaperDepth` | 1,5 cm | Trapezhöhe auf der Ziegelfront |

Persistenz über Facade-JSON / URL-Hash (`cloneFacadeState`).

## Geometrie

### Traufe / bündige Seiten

Pro Outer-Kante: zugehörige Studio-Wand der obersten Etage (Endpunkte ±16 cm oder parallel + Mittelpunkt ≤28 cm). Ohne Paneele → Kanten-Überstand **0**. Offset über `offsetPolygonPerEdge`.

### Ziegel

Jede Mansarden-Facette (unteres/oberes Band je Outer-Kante) als UV-Fläche (u entlang Traufe, v hangaufwärts). Layout via `layoutPanelTiles` mit Fake-Wand und Dach-Tile-Config. Eine `BufferGeometry` für alle Ziegel; Profile:

- **barrel**: abwechselnd konvex/konkav (Halbwelle)
- **pantile**: S-Querschnitt (Mulde + Wulst)

Darauf optional Trapez-Frustum (`tileTaperDepth` / `tileTaper`). First: flache Kappe (Earcut) + Barrel-Firstziegel-Reihe.

### Rinne

Geschlossenes U-/Kastenprofil (Boden + Außen + Innenlippe), Sweep entlang belegter Traufkanten mit **Gehrung** an Ecken (`miterOutward`). An Übergängen zu bündigen Seiten: **Endkappen**. Offene L-Segmente entfallen.

## Datenfluss

```
floors[top] → planFacesWithHoles → Outer (+ Hof-Löcher)
  → per-Kanten-Überstand (leer = 0)
  → unterer Mantel / oberer Mantel (Knick 55 % ridgeHeight)
  → Ziegel-Layout je Facette + Firstziegel
  → Firstkappe (Earcut inkl. Löcher)
  → optional gehrungene Rinne (nur aktive Kanten)
  → FacadeController.rebuildRoof → roofGroup
```

## Dateien

| Datei | Rolle |
|---|---|
| `src/studio/roof.ts` | Defaults, Offset, Ziegel, Rinne, Mansarde |
| `src/studio/panelLayout.ts` | `layoutPanelTiles` für Dachziegel |
| `src/studio/floorPlan.ts` | `planFacesWithHoles` |
| `src/FacadeController.ts` | `rebuildRoof`, `roofGroup` |
| `src/types/facade.ts` | `RoofConfig`, `RoofTileProfile` |
| `src/main.ts` / `index.html` | UI links unter „Dach“ |

## Fallstricke

- Traufhöhe = `floors.length × wallHeight` (Oberkante oberstes Geschoss).
- Plan-Knoten = Wandaußenlinie; Überstand nur an belegten Kanten weiter nach außen.
- Wand-Zuordnung zur Dachkante: Endpunkte ±8 cm, sonst Mittelpunkt-zu-Segment ≤12 cm.
- Zu hohe Firsthöhe / steile Neigung auf schmalen Grundrissen schrumpft den First stark.
- Schwerpunkt-Fan für die Firstkappe würde bei U/L/Hof den Innenraum füllen — deshalb Earcut.
- Viele kleine Ziegel → eine Geometry; extreme Raster/Grundrisse können die Vertexzahl hochtreiben.
