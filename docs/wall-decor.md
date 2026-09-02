# Wanddekor: Gesims, Sockel, Zierbänder

Horizontale Profile und Sockel an Studio-Wänden. Geometrie-Details (Gehrung, Clip an Öffnungen): [panel-geometry.md](panel-geometry.md). Bedienung/Toolbar-Überblick: [ux.md](ux.md).

## Verhalten für den Nutzer

| Element | Wo | Kurz |
|---|---|---|
| **Gesims** | Reiter Gesims | Nur an der **oberen** Wandkante; Höhe (8 cm) und Tiefe (4 cm); Profil, Farbe, Finish |
| **Sockel** | Reiter Sockel | Höhe 8 cm, Tiefe/Versatz 1 cm; Farbe setzt Körper + Profil; Profil `sockelprofil` ersetzt die Box |
| **Zierbänder** | Reiter Zierbänder | Beliebige Höhe von unten; Band hinzufügen, Duplikat ±16 cm, in 3D vertikal ziehen (8 cm) |

Teil-Selektion in 3D: `wallPart` `cornice` / `plinth` / `trimBand`. Edit-Scope (Auswahl/Typ/Etage/Fassade) gilt für Wand-Edits inkl. Dekor.

**Darf nicht entfernt werden** ohne explizite Nutzeranweisung (Regel `.cursor/rules/keine-ui-loeschen.mdc`) — insbesondere Zierband-UI.

## Daten

### Gesims — `Wall.cornice` (`WallCorniceConfig`)

| Feld | Default / Hinweis |
|---|---|
| `enabled` | aus |
| `edge` | fest `top` (UI oben/unten ausgeblendet) |
| `profileId` | Traufgesims-IDs aus dem Gesims-Picker |
| `scale` | Höhe über Querschnitt (UI in cm, 8er-Raster) |
| `sectionScaleForward` | **Tiefe** des Querschnitts (UI in cm, 4er-Schritte) — nicht `offsetForward` |
| `offsetForward` | Versatz senkrecht zur Wand |
| `color` / `finish` | optional; Finish fällt auf `profileFinish` zurück |
| `rotationDeg`, `flipOutward`, `flipForward` | Orientierung |

UI: `#studio-cornice-scale` / `#wall-cornice-scale`, `#studio-cornice-offset-forward`.

### Sockel — Felder an `StudioPanelConfig`

| Feld | Default | Bedeutung |
|---|---|---|
| `plinthEnabled` | an | aus oder Höhe 0 = kein Sockel |
| `plinthHeight` | 32 cm | 8-cm-Schritte |
| `plinthDepth` | 8 cm | 1-cm-Schritte; Box und SVG-Tiefe |
| `plinthOffsetForward` | 0 cm | vor der Paneelfläche |
| `plinthColor` | Wandfarbe | sichtbare Farbe; setzt auch `plinthProfileColor` |
| `plinthProfileId` | `sockelprofil` | Legacy `sockelStandard` → gemappt |
| `plinthProfileScale` / Rotation / Flip | — | Querschnitt |

**Geometrie:** SVG-Sweep vom Boden; Aussparung = Öffnungsvolumen (Bogen inkl.) aus dem vollen Sweep (`createPlinthProfileSweepGeometry`, v0.7.297) — nicht Y-Schnitt im Querschnitt und nicht X-Schacht plus Sturz-Treppe. Paneele/Ziegel im Sockelstreifen entfallen (`clipTilesAbovePlinth`); Raster startet am Wandfuß (`masonryOriginY = 0`), Sockel **überlagert**.

UI: `#studio-plinth-depth`, `#studio-plinth-offset`, `#studio-plinth-color-swatches`, Profilkarten (erste Kachel **Keiner**). Vorschau: Links = Wand, unten = Boden.

**Ecken:** `cornerJoin: 'none'` gehrt weiter, wo Sockel an 45°/90° anknüpft. Sockelprofil an Außenecken: nach außen längere 45°-Gehrung (Vorzeichen umgekehrt zum Gesims). **v2.0.33:** lange CSG-Schrägen im Sockelstreifen entfallen auch im Pier zwischen Kellerfenstern. **v2.0.32:** Zeichnungsfilter trifft Rechteckloch (nicht nur Bogenmaske). **v2.0.31:** Tiefenkanten/Kappen aus; Plan-Kanten-Snap. **v2.0.30:** CSG-Schwellwinkel; Filter über die ganze Strecke.

**Schatten:** Sockel wirft/empfängt keine Shadow-Map (v0.7.132, Moiré-Schutz).

### Zierbänder — `Wall.trimBands[]` (`WallTrimBand`)

| | |
|---|---|
| **UI** | Studio-Wand → Reiter **Zierbänder** → **Band hinzufügen** (`#studio-trim-band-add`); Duplikat ↑/↓ (±16 cm) |
| **State** | `wall.trimBands[]`; Selektion `editor.selectedTrimBandId` |
| **Logik** | `src/utils/trimBands.ts` |
| **Default `yFromBottom`** | Wandhöhe/2 (8er-Raster) |
| **3D** | `buildTrimBandPaths` → `bandId` am Mesh; Drag nur Y, Snap 8 cm |

Felder analog Gesims: `profileId`, `scale`, `sectionScaleForward`, `offsetForward`, Farbe, Flip/Rotation. Aussparung an Öffnungen: Maskenkontur wie Paneele (`openingMaskXRangesAtY`) plus Rahmenprofil (`wall.profiles`). Im oberen Freistreifen (`hideRowsTop`) liegen Bänder auf der nackten Wand (`syncWallDecorToTopBareBand`).

## Dateien

| Datei | Rolle |
|---|---|
| `src/utils/cornice.ts` | Gesims-Defaults / Normalize |
| `src/utils/trimBands.ts` | Zierband CRUD |
| `src/utils/profilePaths.ts` | Sweep inkl. Sockel/Gesims/Band |
| `src/studio/panelGeometry.ts` | Sockel-Körper, Clip |
| `src/FacadeController.ts` | 3D-Meshes |
| `src/types/facade.ts` | `WallCorniceConfig`, `WallTrimBand`, Plinth-Felder |

## Fallstricke

- Gesims-**Tiefe** = `sectionScaleForward`, nicht `offsetForward`.
- Sockelprofil-Gehrung ≠ Gesims-Vorzeichen an Außenecken.
- `fensterverdachung` in der allgemeinen Profil-Auswahl ist ein Kanten-Sweep — Verdachung steuert `Opening.pediment` ([opening-features.md](opening-features.md)).
- Soft-Obergrenzen für Maße: `STUDIO_PANEL_SOFT_MAX` / `CORNICE_SCALE_MAX` (~10000); keine harten HTML-`max`.
