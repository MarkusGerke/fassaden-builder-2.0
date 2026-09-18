# Schicht-Editor (Mauerwerk / Paneele)

Nutzerrelevant ab **v2.0.495**. Keil L/R: **v2.0.501**. Branch: `feature/masonry-course-editor`.

## Verhalten

Klassischer Modus bleibt: Bibliothek-Muster gilt für die **ganze Wand** (eine Farbe + Kontraststufen).

Zusätzlich **Aus · Setzen · Bearbeiten** (Segmented Control unter Fassade → Maße):

### Setzen

1. Modus **Setzen** → Bibliothek-Karte **bewaffnet** den Stein (ändert nicht sofort die ganze Wand).
2. Maße, Bossen, Verband-Ebene und Farbstufe vor dem Legen einstellbar.
3. Klick **neben** der Wand → Stein **0°/90°** drehen (Breite ↔ Höhe).
4. Hover auf der Wand → **orangene Reihe** in Modulhöhe.
5. Klick auf die Reihe → **Domino-Animation** (Steine von links nach rechts), dann Persistenz.
6. Escape → Editor aus / Bewaffnung weg.

### Bearbeiten

1. Modus **Bearbeiten** → gesetzte Schicht anklicken oder in der Liste wählen.
2. Änderungen an Form/Maßen/Bossen/Ebene/Farbe gelten **nur** für die Auswahl.
3. **Schicht löschen** entfernt nur dieses Band.

### Bossen / Keil (v2.0.499–501)

Bei **Bossen-Vorstand > 0** erscheinen Profil und Bossenform:

| Bossenform | Wirkung |
|---|---|
| **Trapez (alle Seiten)** | Einzug an allen vier Kanten (klassische Bosse). |
| **Keil (nur links/rechts)** | Verjüngung nur an den vertikalen Kanten; Höhe bleibt voll — spitze/45°-Front. |

Bossen einer Schicht schreiben auf die **Tiles** der Schicht, nicht auf `wall.panel` (sonst würde die ganze Wand spitz).

Öffnungen, Sockel-Clip und Gehrung laufen über die **bestehende** Layout-/Clip-Pipeline (`layoutPanelTiles` → `prepareStudioPanelParts`).

## Datenmodell

`Wall.courseOverrides?: MasonryCourseOverride[]`

| Feld | Bedeutung |
|---|---|
| `y` / `height` | Band vom Wandfuß (cm) |
| `pattern` | Muster für diese Schicht |
| `panelWidth` / `panelHeight` | Modul nach 0°/90° |
| `projectDepth?` | Steintiefe (cm) |
| `coursePhase?` | Verband-Ebene (Läufer gerade/versetzt, …) |
| `colorStage?` | 0…7 Palette-Index |
| `taperDepth?` / `taper?` | Bossen-Vorstand / Profil |
| `taperSides?` | `'all'` (Trapez) oder `'lr'` (Keil) |

Layout: Basis-Tiles aus `wall.panel` (oder Zonen), dann Y-Bänder der Overrides **ersetzen**. Kein Schema-Bump (optionale Felder, Hydrate `[]` für Overrides).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/studio/masonryCourseEditor.ts` | Staging, Band-Hit, Upsert, State-Patch |
| `src/studio/panelLayout.ts` | `mergeCourseOverrideTiles`, Stamp `taperSides` auf Tiles |
| `src/studio/panelGeometry.ts` | `extrudeFrustum`: bei `lr` kein Y-Einzug |
| `src/FacadeController.ts` | Ghosts Domino; Cladding auch bei Overrides |
| `src/main.ts` | UI, Hover, Klick, Playback, `liveMotion` |
| `index.html` | Modus, Maße, `#studio-course-taper-sides` |

## Defaults / Konstanten

- Default `taperSides`: `'all'`
- Bossenform-UI nur sichtbar wenn `taperDepth > 0`
- Domino-Hold / Playback: siehe `masonryCourseEditor.ts` / `main.ts`

## Fallstricke

- Im Schichtmodus darf Bibliothek-Klick **nicht** `applyPanelPresetFromLibrary` aufrufen.
- Domino nur Overlay; Commit einmalig — kein `rebuildCladding` pro Stein.
- Playback setzt `liveMotion`, sonst Idle-Skip.
- Ghosts: `castShadow = false`; nach Rebuild entfernen (sonst Vanish/Flash).
- Bossen **nicht** auf `wall.panel` schreiben — nur Tile-Stamp.
- Keil gilt für Rechteck-Steine im Frustum-Pfad; komplexe Reste (Bogen) nutzen weiter Iso-Fase.
- Zwei-Bänder-`claddingZones` bleiben tot (Hydrate wipe); Overrides sind der Weg für Schichten.
- „Keine“ Paneele löscht auch `courseOverrides` (`updateStudioPanel`).

## Tests

`src/studio/masonryCourseEditor.test.ts` — Normalize, Rotate, Band-Hit, Layout-Merge, Upsert, `taperSides`.
