# Fassaden-Builder – Dokumentation

## Dokumente

| Datei | Inhalt |
|---|---|
| [architecture.md](architecture.md) | Gesamtarchitektur, Kerntypen-Überblick |
| [facade-layers.md](facade-layers.md) | Schichten A/B/C, Öffnungsvertrag, Freiraum/Einbettung, Verkleidungszonen |
| [changelog.md](changelog.md) | Änderungsprotokoll (Historie) |
| [shadows.md](shadows.md) | 3D-Sonnenlicht, **lichtdichte Hülle** (Sonne nur Öffnung+Glas), Shadow-Camera, Bias; Gesims-Cast; 2D-Front Paneel-Werfschatten |
| [lighting-mood.md](lighting-mood.md) | Mehrschichtige Lichtstimmung: Umbra, Kontakt, Bounce |
| [scene-lights.md](scene-lights.md) | Bibliotheks-Lichter: Presets, Fade, Uhrzeiten, XYZ, Persistenz |
| [celestial-sky.md](celestial-sky.md) | Takram-Himmel, Sonne/Mond, Dämmerung, Tageszeit 0–24 h |
| [stage-environment.md](stage-environment.md) | Bühnenmodus Himmel vs. Neutral (Schalen-Plattform, Beige/Nacht) |
| [ground-leaves.md](ground-leaves.md) | Herbstlaub: Platzieren, Cursor-Wind, Persistenz |
| [panel-geometry.md](panel-geometry.md) | Gehrungsberechnung, `wallLocalX`, Paneelextrusion, 3D-Leibung, Rest-Bossen an Öffnungen (`remnantBoss.ts`) |
| [floor-plan.md](floor-plan.md) | Grundriss-System, Ring-Erkennung, Miter, Etagen, Innenkante Decke/Boden |
| [views-and-state.md](views-and-state.md) | Views, Persistenz, Undo/Redo, Navigation |
| [camera.md](camera.md) | 3D-Kamera, Orbit-Ziel, ⌘/Ctrl-Gesten, Geschwindigkeiten |
| [ux.md](ux.md) | Bedienung: Navigation, Kontextmenü, Farben, Scope; **rechte Einstellungs-Tabs** (Übersicht → Maße → Farben → Formen → Dekor oben→unten) |
| [wall-decor.md](wall-decor.md) | Gesims, Sockel, Zierbänder |
| [opening-features.md](opening-features.md) | Bogen, Nischen/Konche, Freiraum, Bänke, Verdachung, Treppe, Kellerfenster |
| [windows-doors.md](windows-doors.md) | Fenster/Türen: Ist-Bestand Gründerzeit-Teilung, Individualisierung, Altbau-Roadmap |
| [profiles.md](profiles.md) | Profil-Querschnitte, Built-ins, Custom-IDs, SVG-Achsen |
| [bay-windows.md](bay-windows.md) | Erker, Balkon, Loggia |
| [style-templates.md](style-templates.md) | Stil-Vorlagen speichern/anwenden (localStorage) |
| [opening-motion.md](opening-motion.md) | Flügel-Öffnen/Schließen: Kurveneditor, Vorlagen, Uhrzeiten, Datensatz `fassaden-opening-motion/v1` |
| [roller-shutter.md](roller-shutter.md) | Rollläden: Lamellen, Höhe, Stapel, Animation, Uhrzeiten |
| [roof.md](roof.md) | Berliner Mansarde: Ziegel/Trapez, bündige Traufe, Gehrungsrinne |
| [gallery.md](gallery.md) | QA-Galerie: alle Standards im Raster, Abstand, Zufall, Projekt-Schutz |
| [versioning.md](versioning.md) | App-Version, Release Notes, Quellen-Dialog, GitHub-Link, Pflege-Workflow |
| [credits.md](credits.md) | Quellen, Lizenzen, Danksagung |
| [fonts.md](fonts.md) | Fassaden-Schriften, Vorschaukarten, Peter-Wiegel-Lizenzen |
| [migration.md](migration.md) | Fassaden-Schema-Leiter, Hydrate, Migrations-Checkliste |
| [performance.md](performance.md) | LOD, **Entwurf/Vorschau/Render**-Darstellung, Dirty-Rendering/Navigation, Live-Ziehen mit schwebendem Fenster (v2.0.3), Schatten-Optimierung, Debug-Overlay, inkrementeller Rebuild |

## Schnellreferenz

### Wichtige Konstanten (`src/studio/constants.ts`, `src/constants/presets.ts`)

| Konstante | Wert | Bedeutung |
|---|---|---|
| `STUDIO_TILE` | 32 cm | Grundraster für Studio-Wände |
| `STUDIO_MASONRY` | 8 cm | Feines Raster (Streifen, Zierbänder). Läuferverband-Öffnungen: ½ Steinlänge |
| `STUDIO_PANEL_SOFT_MAX` | 10000 cm | Soft-Obergrenze für Paneel-/Maß-Clamps (kein hartes UI-Max) |
| `PLAN_GRID` | 8 cm | Welt-/Grundriss-Raster (Ablegen, Verschieben, Strecken); Schema 15 |
| `PLAN_CLOSE_GAP_CM` | 48 cm | Andock-Magnet / Lücken schließen |
| `DUPLICATE_GAP_CM` | 48 cm | Abstand Kante-zu-Kante beim Duplizieren |
| `WALL_MOVE_SNAP` | 8 cm | SVG-Wandverschieben (= `PLAN_GRID`) |
| `STUDIO_WALL_WIDTH_STEP` | 8 cm | Greifer/Toolbar-Breite; 45°: \(8\sqrt{2}\) |
| `PLAN_DIAGONAL_STEP` | \(48\sqrt{2}\) cm | 45°-Wandschritt (Diagonale eines Rasterfeldes) |
| `PLAN_DRAW_CELLS` | 32 | Zeichenfläche in Gitterzellen |
| `WALL_DEPTH` | 32 cm | Standard-Wandstärke |
| `WALL_HEIGHT` | 448 cm | Standard-Geschosshöhe |
| `WINDOW_RECESS` | 24 cm | Fensterfront hinter der Wandaußenkante (nicht die Leibungswandung) |
| `PANEL_OPENING_CLEARANCE` | 0 | Paneel/Mörtel und Wandloch teilen dieselbe Maskenkontur (`panelGeometry.ts`); Nutzer-Freiraum bleibt ein konzentrischer Offset |
| `GROUND_MARGIN` | 384 cm | Bodenplatte-Überstand |
| `OPENING_MIN_GAP` | 32 cm | Mindestabstand zwischen Öffnungen (`validation.ts`) |

### Wo liegt was?

| Frage | Datei |
|---|---|
| Typen für Wall, Opening, FacadeState | `src/types/facade.ts` |
| 3D-Geometrie (Wand, Paneele, Leibung bis Profil) | `src/studio/panelGeometry.ts` |
| Kachel-Layout (Muster) | `src/studio/panelLayout.ts` |
| Grundriss zeichnen/auswerten, Innenkanten-Ring | `src/studio/floorPlan.ts` |
| Indoor-Platten-Kerben an Öffnungen | `src/studio/slabNotches.ts` |
| Grundriss 3D-Overlay | `src/studio/floorPlanView.ts` |
| Studio-Wand erstellen/normalisieren | `src/studio/walls.ts` |
| Three.js Szene, Innenboden/Zwischendecke, Dach | `src/FacadeController.ts` |
| Berliner Mansarde | `src/studio/roof.ts` |
| Sonne und 3D-Schatten | `src/utils/sunLighting.ts`, `src/utils/solar.ts` |
| Gebäude drehen (`siteYawDeg`) | `src/studio/rotateBuilding.ts`, `src/main.ts` |
| SVG-Bearbeitungsansicht | `src/FacadeSvgView.ts` |
| Öffnungen: erstellen, verschieben | `src/utils/openings.ts` |
| Fenster-/Tür-Öffnungskurven | `src/utils/openingMotion.ts`, `src/ui/openingMotionEditor.ts`, `docs/opening-motion.md` |
| Uhrzeit-Schedule | `src/utils/daySchedule.ts`, `src/ui/dayScheduleEditor.ts` |
| Wände: Bounds, Neighbors, Duplizieren | `src/utils/walls.ts` |
| Etagen-Gruppierung | `src/utils/layers.ts` |
| Multi-Building-Helfer | `src/utils/buildings.ts` |
| Persistenz, AppView | `src/utils/persistence.ts` |
| Undo/Redo | `src/utils/history.ts` |
| App-Loop, Event-Handler, Views | `src/main.ts` |
| Fassaden-Schriften (Katalog, Vorschau) | `src/studio/labelFonts.ts`, `src/studio/labelGeometry.ts`, `docs/fonts.md` |
| 3D-Kamera, Orbit, Gesten | `src/main.ts`, `docs/camera.md` |
| Kontextmenü | `src/ui/contextMenu.ts` |
| URL-Hash / Teilen (Live-Hash-Marker, `schemaVersion`) | `src/utils/share.ts`, [ux.md](ux.md#url-hash-live-srcutilssharets) |
| Farben | `src/constants/colorPalettes.ts` |
| Gesims / Zierbänder / Sockel | `src/utils/cornice.ts`, `trimBands.ts`, `profilePaths.ts`, [wall-decor.md](wall-decor.md) |
| Profile | `src/profiles/registry.ts`, [profiles.md](profiles.md) |
| Eingangstreppe | `src/studio/stairs.ts`, [opening-features.md](opening-features.md) |
| Fensterverdachung | `src/studio/pediment.ts`, [opening-features.md](opening-features.md) |
| Radiale Rustika am Bogen | `src/studio/archRustication.ts`, [facade-layers.md](facade-layers.md), [opening-features.md](opening-features.md) |
| Separates Trapez-Verdachungsfeld (taperedField) | `src/studio/taperedField.ts`, [opening-features.md](opening-features.md), [facade-layers.md](facade-layers.md) |
| Kellerfenster-Gitter | `src/studio/basementWindow.ts`, [opening-features.md](opening-features.md) |
| Erker / Balkon / Loggia | `src/studio/bayWindow.ts`, [bay-windows.md](bay-windows.md) |
| Edit-Scope (Element/Typ/Etage/Fassade) | `src/studio/editScope.ts` |
| Ausrichtungs-Hilfslinien (Öffnungen) | `src/studio/openingGuides.ts` |
| Wand verbreitern / Front verschieben | `src/studio/walls.ts` (`stretchStudioFacade`, `attachAngledWallFromEnd`, `offsetStudioWallsAlongFront`) |
| Wandsegment herauslösen (Hover/Klick, alle Etagen) · extrudieren (Front-Pfeil + Rückwände) · „Wand verknüpfen“ verschmelzen · Greifer + Shift rückt Folgewände | `src/studio/wallSplit.ts`, `offsetStudioWallsAlongFront` in `src/studio/walls.ts`, [ux.md](ux.md#wandsegment-herauslösen-srcstudiowallsplitts-v20142) |
| Plan-Geometrie verschieben (Knoten/Kante → 3D) | `src/studio/planGeometry.ts` |
