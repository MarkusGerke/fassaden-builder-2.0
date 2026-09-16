# Schicht-Editor (Mauerwerk / Paneele)

Nutzerrelevant ab **v2.0.495**. Branch: `feature/masonry-course-editor`.

## Verhalten

Klassischer Modus bleibt: Bibliothek-Muster gilt für die **ganze Wand** (eine Farbe + Kontraststufen).

Zusätzlich **Schicht setzen** (Checkbox unter Fassade → Maße):

1. Toggle an → Bibliothek-Karte **bewaffnet** den Stein (ändert nicht sofort die ganze Wand).
2. Klick **neben** der Wand → Stein **0°/90°** drehen (Breite ↔ Höhe).
3. Hover auf der Wand → **orangene Reihe** in Modulhöhe.
4. Klick auf die Reihe → **Domino-Animation** (Steine von links nach rechts), dann Persistenz.
5. **Farbstufe 0–7**: wie bestehende Kontrast-Palette (`tileColorVariance` / `tileColorVariety`), nicht freie Hex-Farbe pro Stein.
6. Escape → Editor aus / Bewaffnung weg.

Öffnungen, Sockel-Clip und Gehrung laufen über die **bestehende** Layout-/Clip-Pipeline (`layoutPanelTiles` → `prepareStudioPanelParts`).

## Datenmodell

`Wall.courseOverrides?: MasonryCourseOverride[]`

| Feld | Bedeutung |
|---|---|
| `y` / `height` | Band vom Wandfuß (cm) |
| `pattern` | Muster für diese Schicht |
| `panelWidth` / `panelHeight` | Modul nach 0°/90° |
| `colorStage?` | 0…7 Palette-Index |

Layout: Basis-Tiles aus `wall.panel` (oder Zonen), dann Y-Bänder der Overrides **ersetzen**. Kein Schema-Bump (optionales Feld, Hydrate `[]`).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/studio/masonryCourseEditor.ts` | Staging, Band-Hit, Upsert, State-Patch |
| `src/studio/panelLayout.ts` | `mergeCourseOverrideTiles`, `layoutTilesForCourseOverride` |
| `src/studio/panelGeometry.ts` | `colorStage` in Farb-Buckets |
| `src/FacadeController.ts` | Ghosts Domino; Cladding auch bei Overrides |
| `src/main.ts` | UI, Hover, Klick, Playback, `liveMotion` |
| `index.html` | `#studio-course-editor-enabled`, `#studio-course-color-stage` |

## Noch nicht (spätere Meilensteine)

- Trapez nur links/rechts für 45°-Erker (`taperLR`)
- Echter Eck-Umlauf (ein Stein, zwei Wände)
- Freie Einzelstein-Nachfärbung nach dem Legen (MVP: Stufe beim Setzen der Schicht)
- Dachziegel
- Domino-Overlay ≠ geclippte Reststeine an Öffnungen (bewusst)

## Fallstricke

- Im Schichtmodus darf Bibliothek-Klick **nicht** `applyPanelPresetFromLibrary` aufrufen.
- Domino nur Overlay; Commit einmalig — kein `rebuildCladding` pro Stein.
- Playback setzt `liveMotion`, sonst Idle-Skip.
- Ghosts: `castShadow = false`.
- Zwei-Bänder-`claddingZones` bleiben tot (Hydrate wipe); Overrides sind der Weg für Schichten.
- „Keine“ Paneele löscht auch `courseOverrides` (`updateStudioPanel`).

## Tests

`src/studio/masonryCourseEditor.test.ts` — Normalize, Rotate, Band-Hit, Layout-Merge, Upsert.
