# Fassaden-Builder – Architektur & Funktionsdokumentation

## Überblick

Der Fassaden-Builder ist eine TypeScript/Three.js-Webanwendung zur prozeduralen Erzeugung und Bearbeitung von Fassadenverkleidungen. Er kombiniert eine 2D-Grundrisszeichnung, eine 3D-Vorschau, eine SVG-basierte Bearbeitungsansicht und eine Ortho-Frontansicht.

```
src/
├── credits.ts / version.ts   Quellen, App-Version / RELEASES
├── gallery/                  QA-Galerie
├── main.ts                   Einstieg, App-State, Events, Views
├── FacadeController.ts       Three.js-Szene
├── FacadeSvgView.ts          SVG-Bearbeitung (2D)
├── types/facade.ts           Wall, Opening, FacadeState, …
├── profiles/                 Built-in- & Custom-Querschnitte
├── windows/gruenderzeit.ts   Fenster-/Türteilung, TIMBER
├── studio/                   Paneele, Grundriss, Dach, Erker, Schrift, …
├── ui/                       Dialoge, Galerie, Export, Motion-Editor, …
├── utils/                    Persistenz, Hydrate, Profile-Sweeps, Licht, …
└── constants/presets.ts      WALL_DEPTH, WALL_HEIGHT, …
```

Feature-Docs und Index: [README.md](README.md). Historie: [changelog.md](changelog.md).

**Schichten-Vertrag (v2.0.70+):** dichte Wandschale (A) / Verkleidungszonen (B) / Anbauteile (C); eine Öffnungsmaske; Freiraum nur B; Einbettung ohne Shell-Loch — [facade-layers.md](facade-layers.md).

---

## Kerntypen (`src/types/facade.ts`)

**Quellen der Wahrheit:** vollständiger Feldkatalog = `src/types/facade.ts` + Hydrate (`src/utils/hydrate.ts`, [migration.md](migration.md)). Die Tabellen unten sind ein **Überblick**; verschachtelte Konfigs und UI-Verhalten stehen in den Feature-Docs:

| Thema | Doc |
|---|---|
| Paneele, Gehrung, Bogen-Clip | [panel-geometry.md](panel-geometry.md) |
| Gesims, Sockel, Zierbänder | [wall-decor.md](wall-decor.md) |
| Öffnung: Bogen, Nischen, Bänke, Verdachung, Treppe, Keller | [opening-features.md](opening-features.md) |
| Fenster-/Türteilung, Roadmap | [windows-doors.md](windows-doors.md) |
| Profile / Custom | [profiles.md](profiles.md) |
| Erker / Balkon / Loggia | [bay-windows.md](bay-windows.md) |
| Dach | [roof.md](roof.md) |
| Schriftarten | [fonts.md](fonts.md) |
| Rollladen / Motion | [roller-shutter.md](roller-shutter.md), [opening-motion.md](opening-motion.md) |

### `Wall`

Zentrale Wand-Datenstruktur. Jede Wand ist entweder ein Blender-Modul (`kind: 'module'`) oder eine prozedurale Studio-Wand (`kind: 'studio'`).

| Feld | Typ | Bedeutung |
|---|---|---|
| `id` | `string` | Eindeutige UUID |
| `kind` | `'module' \| 'studio'` | Wand-Typ |
| `x`, `y` | `number` | Position im 2D-Raum (cm) |
| `width`, `height`, `depth` | `number` | Maße (cm) |
| `yawDeg` | `StudioYawDeg` | Ausrichtung im Grundriss (0/45/90/135/…/315°) |
| `originX`, `originZ` | `number` | Fußpunkt der Wandkante in der 3D-Welt (cm) |
| `panelFlip` | `boolean` | Paneele auf Außenseite (z=0) wenn `true`; Standard für Grundriss-Wände |
| `miterStart` | `number` | Gehrungsversatz am Wandanfang (cm), aus `assignMiters` |
| `miterEnd` | `number` | Gehrungsversatz am Wandende (cm) |
| `panel` | `StudioPanelConfig` | Paneel + Sockel-Felder (s. [wall-decor.md](wall-decor.md)) |
| `openings` | `Opening[]` | Türen, Fenster, Cutout, Konche |
| `neighbors` | `WallNeighbors` | Angrenzende Wände (left/right/top/bottom) |
| `planLinked` | `boolean?` | Grundriss-Verknüpfung; `false` = frei. Fehlt → verknüpft |
| `wallColor` / `interiorColor` | `string?` | Außen / Innen (Default Weiß) |
| `claddingColor` / `profileColor` | `string?` | Paneele / Profile |
| `*Finish` | `SurfaceFinish?` | Wand / Paneel / Profil |
| `cornice` | `WallCorniceConfig?` | Gesims oben |
| `trimBands` | `WallTrimBand[]?` | horizontale Zierbänder |
| `label` | `WallLabelConfig?` | Fassadenbeschriftung |
| `bayWindow` / `arcBay` | … | Erker u. Ä. → [bay-windows.md](bay-windows.md) |
| `buildingId` / `groupId` / `hidden` | … | Gebäude, Gruppe, Sichtbarkeit |

Vollständige Liste inkl. Endstücke: `Wall` in `facade.ts`.

### `StudioPanelConfig`

Paneelverkleidung pro Wand. Kernfelder:

| Feld | Default | Bedeutung |
|---|---|---|
| `panelWidth` / `panelHeight` | 32 cm | Läufer / Schichthöhe; 8-cm-Raster |
| `joint` | 0.8 cm | Fugenbreite |
| `pattern` | `'strip'` | Verlegmuster (s. u.) |
| `cornerJoin` | `'miter'` | Gehrung / stumpf / Verband |
| `projectDepth` | 4 cm | Vorstand |
| `taper` / `taperDepth` / `jointDepth` | … | Trapez / Fugentiefe |
| `alternateFloors` + `recessed*` | … | abwechselnde Ebenen |
| `plinth*` | … | Sockel → [wall-decor.md](wall-decor.md) |
| `endBoss*` / `hideRows*` | … | Bossen / Reihen ausblenden |

Weitere Felder (`tileColorVariance`, `jointColor`, …): `facade.ts`.

### `StudioPanelPattern`

Union in `facade.ts`: `none` \| `strip` \| `runningBond` \| `headerBond` \| `englishBond` \| `englishCrossBond` \| `wildBond` \| `gothicBond` \| `markishBond` \| `dutchBond` \| `silesianBond` \| `flemishBond` \| `runningBondThird` \| `runningBondQuarter` \| `runningBondDiagonal`. UI-Gruppen Paneele vs. Mauerwerk: [ux.md](ux.md) / `panelLayout.ts`. Historie der Teilungs-Migrationen: [changelog.md](changelog.md) / [windows-doors.md](windows-doors.md).

### `StudioCornerJoin`

| Wert | Bedeutung |
|---|---|
| `'miter'` | 45°-Gehrungsschnitt an Außenecken (Bilderrahmen-Prinzip) |
| `'none'` | Stumpf nur an **freien** Enden; anknüpfende Paneele/Sockel/Gesimse bleiben geghert |
| `'bond'` | Mauerwerks-Ecke: Läufer greift um die Ecke, sichtbare Tiefe = `projectDepth` |

### `Opening`

| Feld | Bedeutung |
|---|---|
| `id` | UUID |
| `type` | `'door'` \| `'window'` \| `'cutout'` \| `'conch'` |
| `cutoutShape` | Nur Cutout: `'rect'` \| `'round'` |
| `x`, `y`, `width`, `height` | Lage/Maße (cm) |
| `arch` / `fill` / `revealFrame` / `panelClearance` | Bogen, Nische, Fake-Einbettung, Freiraum → [opening-features.md](opening-features.md) |
| `trim` / `gruenderzeit` | Rahmenprofil / Teilung |
| `sillInner` / `sillOuter` | Fensterbänke |
| `pediment` / `stairs` / `rollerShutter` / `basementWindow` / `motion` | Dekor & Animation |
| `guard` / `door` / `interiorShade` | Gitter/Balkon, Tür-Details, Vorhang/Jalousie → [windows-doors.md](windows-doors.md) |
| Farben / Finish / Glas | `frameColor`, `glassMode`, … |

Vollständige Nested-Typen: `facade.ts`.

### `Building` und `FacadeState`

Mehrere Baukörper pro Projekt: Wände, Etagen, Dach und globale Wandmaße liegen **pro Gebäude**, nicht mehr auf Top-Level.

```ts
interface Building {
  id: string
  name: string
  hidden?: boolean
  bareWalls?: boolean        // nur weiße Vollwände (Darstellung), v0.7.312
  floors: FloorPlan[]
  walls: Wall[]              // buildingId === building.id
  roof?: RoofConfig
  wallHeight: number         // Geschosshöhe (cm), Standard 448 cm
  wallDepth: number          // Wandstärke (cm), Standard 32 cm
  windowDepthOffset?: number
}

interface FacadeState {
  buildings: Building[]
  activeBuildingId: string
  customProfiles?: CustomProfileDef[]
  viewOptions?: ViewOptions
  siteYawDeg?: number        // 3D-Gruppendrehung um den Schwerpunkt, 45°-Raster
}
```

Hilfsfunktionen: `src/utils/buildings.ts` (`migrateToBuildings`, `findWall`, `getActiveBuilding`, `updateBuilding`, …). Wand-Layout/Neighbors: `src/utils/walls.ts` — Nachbarlogik **nur innerhalb desselben Gebäudes** (`recomputeBuildingLayout`, `rebuildBuildingNeighbors`, `clampBuilding`; State-Wrapper verarbeiten alle `buildings`).

---

## Koordinatensystem

```
           +Y (oben / Höhe)
           |
           |
-----------+-----------> +X (rechts / Breite in 2D)
           |
           |   +Z (nach vorne / Tiefe in 3D, nach links in Grundriss)
```

- **2D/SVG:** `wall.x`/`wall.y` in cm, Y wächst nach oben.
- **3D/Three.js:** `originX`/`originZ` + `yawDeg`-Rotation; Y = Höhe über Boden. Zusätzlich `siteYawDeg` als Gruppenrotation um den Schwerpunkt (nur 3D-Ansicht).
- **Wandlokalraum:** z = 0 = Außenseite (bei `panelFlip: true`); z = `depth` = Innenseite.

---

## Geometrie, Grundriss, Layout, Views

Detail-Dokumentation (nicht hier duplizieren):

| Thema | Doc |
|---|---|
| Gehrung, `wallLocalX`, Extrusion, Bogen-Clip | [panel-geometry.md](panel-geometry.md) |
| Grundriss, Ringe, Miters, Etagen, Overlay | [floor-plan.md](floor-plan.md) |
| Panel-Kacheln / Verbände | `src/studio/panelLayout.ts` + [panel-geometry.md](panel-geometry.md) |
| App-Views, Persistenz, Undo, Edit-Scope | [views-and-state.md](views-and-state.md) |
| 3D-Kamera | [camera.md](camera.md) |
| UX-Navigation | [ux.md](ux.md) |

### Etagen (Kurz)

- `Building.floors` / `wallHeight`; Etagenindex ≈ `wall.y / wallHeight` (`layers.ts`).
- Duplizieren: `duplicateStorey` / Dialog `#storey-copy-dialog` — Details [floor-plan.md](floor-plan.md) / [views-and-state.md](views-and-state.md).

### Öffnungen (Kurz)

`moveOpening` / `updateOpening` in `src/utils/openings.ts`. Maße/Dekor: [opening-features.md](opening-features.md). Raster heute: 8 cm (`STUDIO_MASONRY`) für Studio-Positionen.

### Persistenz (Kurz)

Storage-Key `fassaden-builder-state-v6`; Schema/Hydrate: [migration.md](migration.md). Views/State: [views-and-state.md](views-and-state.md).

---

## Änderungsprotokoll

### Arbeit: einfache Rechtecke, harte Schatten (2026-08-29) — v0.7.311

Rechteck-Mauerwerk 2 cm vor der Wand; harte Schatten (`BasicShadowMap`). Dateien: `panelGeometry.ts`, `main.ts`, `threeColors.ts`.

### Arbeit: geschlossene Mauerwerks-Ebene (2026-08-29) — v0.7.310

Steine + Fugen eine Ebene; Wand nur Freistreifen. Dateien: `panelGeometry.ts`.

### Arbeit: kein Wand-Durchschimmern (2026-08-29) — v0.7.309

Steine vor der Wand, Fugen-Backer innen; Wandaußenfläche nur Freistreifen. Dateien: `panelGeometry.ts`, Docs.

### Arbeit: Wand/Paneele, Bögen, Himmel (2026-08-29) — v0.7.308

Arbeitsmodus: Fenster mit Sprossen; Wand-XOR-Paneele (Freistreifen = Wand); Bogen-Clip/Profile bis Wand; Himmel → BG-Farbe. Dateien: `panelGeometry.ts`, `profilePaths.ts`, `pedimentGeometry.ts`, `FacadeController.ts`, `main.ts`, Docs.

### Arbeit: flache Fassade (2026-08-29) — v0.7.307

Viewport **Arbeit** vereinfacht Geometrie statt Postprocessing: flache Steine + Fugen, Profile/Verdachung als Balken, High-Detail pausiert. Himmel/Bloom/Spiegelung unverändert. Dateien: `panelGeometry.ts`, `profilePaths.ts`, `pedimentGeometry.ts`, `FacadeController.ts`, `editPresentation.ts`, `main.ts`, Docs.

### Arbeitsdarstellung „Arbeit“ (2026-08-29) — v0.7.306

Viewport-Toggle (erste Version): Himmel/Takram und Bloom aus, Profile ausgeblendet — ersetzt durch v0.7.307+.

Das vollständige Protokoll liegt in **[changelog.md](changelog.md)**. Hier nur der Verweis — neue Einträge dort oben einfügen.

