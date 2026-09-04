# UX: Navigation, Kontextmenü, Farben, Laibung

Bedienung, Toolbar-IDs und Interaktion. **Fachdetails** zu Gesims/Sockel/Zierband → [wall-decor.md](wall-decor.md); Öffnungsdekor (Bogen, Bänke, Verdachung, Treppe, Keller, Nischen) → [opening-features.md](opening-features.md); Erker → [bay-windows.md](bay-windows.md); Profile → [profiles.md](profiles.md).

Dieses Dokument hält Interaktion und die zugehörigen Defaults fest. Code ohne Eintrag hier gilt als unvollständig.

---

## Fassaden-Builder 2.0 (v2.0.0)

Schlanker Produkt-Fokus auf **2D-Front im Render-Modus**; **3D** ist wieder per Button wählbar (OrbitControls, freie Navigation, Scene-Lights verschieben). Aus der Toolbar ausgeblendet (`hidden`, IDs bleiben): **Oben**, **Entwurf**, **Einfach/Komplex**, **Galerie**. **Ebenen**-Panel (linksb) mit **Lichter**-Sektion ist sichtbar (v2.0.58). Vorschau, Render, Export und Zeichnung bleiben.

**Auswahl-Performance (2D):** `selectWall` / `selectOpening` rufen `applyEditorSelection` statt `applyState` — nur `facade.setEditor` + debounced `persistApp` (350 ms), kein `svgView.setState`, kein Geometrie-Rebuild. Voller `applyState` nur bei Geometrie-/Datenänderungen.

---

## 3D-Navigation (`src/main.ts`)

Ausführliche Kamera-/Orbit-Dokumentation: **[camera.md](camera.md)**.

OrbitControls am Canvas. Unmodifizierter Rechtsklick ist **Kontextmenü**, nicht Pan. Polarwinkel unbeschränkt (`0`…`π`) — die Kamera darf unter den Boden.

| Geste | Aktion |
|---|---|
| Linksklick / Ziehen | Auswahl, Öffnung verschieben (v2.0.4: nur orangefarbener Öffnungs-Umriss schwebt; Profile/Bänke aus); OrbitControls dreht **nicht** (Capture-Phase fängt unmodifiziertes LMB ab) |
| **Cmd/Ctrl + Linksklick** ziehen | Orbit um `controls.target` (eigene Rotation via `rotateLeft`/`rotateUp`, nicht Three.js ⌘=Pan) |
| **Cmd/Ctrl + Shift + Linksklick** ziehen | Schwenken (Pan mit `keyPanSpeed`, gleiche Skala wie Pfeiltasten) |
| **Rechtsklick** | Kontextmenü (kein Pan) |
| **Cmd/Ctrl + Rechtsklick** ziehen | Pan (OrbitControls `mouseButtons.RIGHT = PAN`) |
| Mausrad | Zoom (Dolly) |

Unmodifizierter Rechtsklick wird in der **Capture-Phase** mit `stopImmediatePropagation` abgefangen. **Cmd/Ctrl:** `modKeyHeld` über keydown/keyup (Meta/Control) plus `event.metaKey`/`ctrlKey` am Pointer; bei Tab-Wechsel/`blur` zurückgesetzt. Auswahl-Raycast geht über Wand/Fenster/Profile, nicht über die Mauerstein-Geometrie.

**Performance (v0.4.6+):** Schatten-Map nur bei Geometrie-/Sonnenänderung (`shadowMap.autoUpdate=false`), Pixelratio max. 1,5, Muster-SVG-Cache.

**Navigation (v0.7.74 / v0.7.87 / v0.7.184 / v2.0.124):** Kein Orbit-Damping — Kamera folgt 1:1. Dirty-Rendering: Vollbild nur bei Kamera-/State-Änderung. Orbit-Lite markiert „während Navigation“ (LOD-Pause, ggf. Pixelratio); **Bloom bleibt an** während der Bewegung (Default; optional „Bloom bei Kamerabewegung aus“). Bloom selbst Default aus (**v0.7.302**). Shadow-Map-Rebuild und `applyRenderStyle` (Zeichnungslinien) nur bei Geometrieänderung, nicht bei Selektion.

**Cmd-Steuerung (v0.4.10, 3D):** Eigene Navigation statt OrbitControls-Modifier — ⌘/Ctrl+Ziehen bzw. Pfeiltasten **rotieren**, ⌘/Ctrl+⇧ **schwenkt** (Maus und Tastatur). Capture-Phase fängt ⌘/Ctrl+LMB ab, damit Three.js nicht ⌘=Pan erzwingt. Öffnungen verschieben nur mit Pfeiltasten **ohne** Modifier. ⌘+Rechtsklick-Ziehen schaltet Pan ein. Kein `listenToKeyEvents`.

`contextmenu` ruft immer `preventDefault()` auf (kein Browser-Menü). Das App-Menü erscheint nur **ohne** Cmd/Ctrl.

---

## Kontextmenü (`src/ui/contextMenu.ts`)

OS-artiges Textmenü (`position: fixed`), Untermenü nach rechts per Hover, Esc oder Klick außerhalb schließt.

| Ziel | Einträge |
|---|---|
| Wand | **Kopieren** (Untermenü: **Objekt** = Geometrie, **Alles** = Geometrie + Stile, **Stile**, oder Paneele / Farben / Gesims / Sockel / …), **Einfügen** (Untermenü: Nach links / Nach rechts / Darüber; Geometrie-Zwischenablage), **Duplizieren** (Untermenü: Nach links / Nach rechts / Darüber / Separiert bei Studio), Löschen, **Stile kopieren**, **Stil als Vorlage speichern…**, **Stil-Vorlage anwenden** (Untermenü gespeicherter Vorlagen), **Stile einfügen…** (wenn Zwischenablage gefüllt; Dialog `#style-paste-dialog`); bei Studio-Wänden **Wand lösen** (wenn verknüpft) und **Wand verknüpfen** (wenn freie Enden anstoßen); bei Blender-Wänden **Ersetzen durch** (Module) |
| Fenster/Tür | **Kopieren** (Untermenü: **Objekt** (Fenster/Tür/Ausschnitt) oder **Stile**), **Öffnung einfügen**, Duplizieren nach links / rechts, **Ersetzen durch** (`WALL_OPENING_PRESETS`, alle ausgewählten, mittelaxial), **Stile einfügen…** (Öffnungsstile aus der Zwischenablage), Löschen |
| Haus | **Kopieren** / **Haus einfügen**, Duplizieren (Himmelsrichtung), Löschen, … |
| Etage | Duplizieren, Löschen (letzte Etage gesperrt) |
| Leere Bühne (3D/Front) | **Einfügen**, wenn Geometrie-Zwischenablage gefüllt (Fassade/Haus; Öffnung nur mit Wandauswahl) |

**Geometrie kopieren (v0.7.188, Einfügerichtung v0.7.205, Untermenü v0.7.241 / v0.7.266):** Rechtsklick **Kopieren → Objekt** legt nur die Geometrie in die Zwischenablage. **Kopieren → Stile** füllt die Stil-Zwischenablage. **Kopieren → Alles** (Wände) macht beides. **Kopieren → Paneele** (usw.) füllt nur die gewählte Stileigenschaft. **Einfügen** auf einer anderen Wand per Untermenü **Nach links / Nach rechts / Darüber** (`pasteWallsRelativeToTarget` in `src/utils/walls.ts`); auf der leeren Bühne **Fassade einfügen** (versetzt wie bisher). Öffnungen werden in die Zielwand(n) eingefügt; Wände behalten Öffnungen und Profile (`planLinked: false`). Häuser über `insertBuildingClone` nach Osten.

**Wand duplizieren (v0.7.113 / v0.7.115, Ketteneinfügung v0.7.212):** Nach links/rechts = gleiche Etage (`duplicateWalls`). Liegt die Quellwand in einer kollinearen Kette und duplizierst du **in Richtung eines Nachbarn**, wird die Kopie **zwischen** Quellwand und diesem Nachbarn eingefügt; weiter außen liegende Wände rutschen um die Klonbreite (`collinearChainFromEnd`). Am freien Wandende bleibt das Verhalten wie bisher (Kopie außerhalb). **Darüber** = `insertStoreyAbove` — neues Geschoss direkt über der Quell-Etage, höhere Etagen rutschen nach oben; Mehrfachauswahl wird mitkopiert, Treppen an Türen bleiben aus, `groupId` wird gelöscht. Bei mehreren Klonen bleibt `planLinked` untereinander erhalten (v0.7.115); Einzelwand darüber ist unverbunden. **Separiert** (Studio) = senkrechte Parallelkopie im Grundriss (`planLinked: false`).

Richtung **links/rechts** folgt der **Blickrichtung** (Kamera): „links“ ist immer links auf dem Bildschirm, unabhängig von Wand-Yaw oder Himmelsrichtung (`viewerSideToAlongSign` in `src/studio/walls.ts`, `viewerRightXZ()` aus der Kamera). Gilt für Duplizieren, Einfügen, Bibliotheks-Gizmos (+/−), Erker-Anbindung und Endstücke. Studio-Wände verschieben `origin` entlang der Wandachse; Modul-Wände über Layout-`x`. Rechtsklick auf ein bereits ausgewähltes Element behält die Mehrfachauswahl (Löschen/Duplizieren wirkt auf alle).

**Stile kopieren (v0.7.65):** Rechtsklick auf eine Wand kopiert Paneel, Farben, Gesims, Sockel, Außenseite und die Stile der ersten Öffnung (Rahmenprofil aus `wall.profiles`, Verdachung, Bänke). Einfügen per Rechtsklick auf Wand(en) oder Öffnung(en) öffnet `#style-paste-dialog` — Checkboxen steuern, was übernommen wird. Rahmenprofile liegen auf der Wand (`assignProfilesToOpenings`), nicht als Array an der Öffnung.

**Stil-Vorlagen (v0.7.204):** Rechtsklick **Stil als Vorlage speichern…** (`#style-template-dialog`, Name) legt den Snapshot in `localStorage` (`fassaden-builder-style-templates-v1`). **Stil-Vorlage anwenden** übernimmt alle Felder ohne Dialog. Siehe [style-templates.md](style-templates.md).

Haken: Canvas 3D/2D (`pickFromEvent`), SVG (`FacadeSvgView` `contextmenu`), Layer-Zeilen, ⋯-Buttons (dieselbe Item-Liste).

---

## URL-Hash live (`src/utils/share.ts`)

Nach `commitState` (nicht bei Drag-`previewState`) schreibt `scheduleShareHashWrite` den Stand debounced (~1200 ms) nach `#f=`. Generation-Token verhindert, dass ein langsamer Gzip einen neueren Stand überschreibt. localStorage speichert zusätzlich View, Sonne, Auswahl.

**Hash-Inhalt (`SharePayload`):**

| Feld | Typ | Inhalt |
|---|---|---|
| `facade` | `FacadeState` | Gebäude, Wände, Öffnungen (wie bisher) |
| `schemaVersion` | `number` | **v2.0.142:** Schema-Stand (`FACADE_SCHEMA_VERSION`). Ohne Feld (alte Links) startet der Import bei `FACADE_SCHEMA_IMPORT_BASE` = 7 und spielt alle Migrationen erneut |
| `scene` | `SceneAppearance` | Hintergrund, Bodenfarbe, Himmelsfarbe, Strichstärke (optional) |
| `viewYaw` | `number` | Kompass-/Seitenansicht in Grad, 45°-Raster (optional) |

Alte Links ohne Wrapper (`{ facade }`) oder nur mit reiner `FacadeState`-JSON werden weiter gelesen; fehlende `scene`/`viewYaw` → Defaults (`DEFAULT_SCENE_APPEARANCE`, Nord/0°). Datei-Export (`downloadFacadeJson`) schreibt `schemaVersion` neben die Fassade; Import (`loadFacadeFromFile`) liest sie und streift sie ab.

**Reload (v2.0.142):** Ein **fremder/eingefügter** `#f=`-Link hat Vorrang vor localStorage. Der **eigene Live-Hash** (von dieser App geschrieben, Marker `fassaden-builder-live-hash` in localStorage = zuletzt geschriebener Hash) **nicht** — dann lädt localStorage (350 ms Debounce, frischer als der 1200-ms-Hash). Übersteigt der Hash `MAX_LIVE_HASH_CHARS` (12 000), wird ein bestehender `#f=` aus der URL **entfernt** statt veraltet stehen zu bleiben.

**Fallstrick (behoben v2.0.142 — „Fenster nach Reload versetzt“):** Vorher gewann der eigene Hash und lief ohne `schemaVersion` bei jedem Reload durch alle Migrationen ab v7 — u. a. `align-masonry-openings` (13→14), das **alle** Öffnungen auf Läufer-Fugen zog (± 4 cm gegen das 4-cm-Clamp). Zusätzlich konnte ein Reload zwischen 350 ms und 1200 ms bzw. bei zu langem Hash einen **alten** Stand laden. Regressionstest: `src/utils/facadeLoad.idempotent.test.ts`.

---

## Farben und Licht

Defaults in `src/constants/colorPalettes.ts`:

| Token | Hex | Nutzung |
|---|---|---|
| `DEFAULT_WALL_COLOR` | `#ffffff` | Wand / Sockel |
| `DEFAULT_FRAME_COLOR` | `#ffffff` | Fensterrahmen |
| `DEFAULT_DOOR_COLOR` | `#ffffff` | Türblatt/-rahmen beim Anlegen |
| `DEFAULT_GLASS_COLOR` | `transparent` | Glas (Klarglas; physisch `#ffffff` + EnvMap) |
| `DEFAULT_PROFILE_COLOR` | `#c4b49a` | Gesims/Profile |

Sonne (`DEFAULT_SUN_SETTINGS`): **heutiges Datum**, **13:15** (13,25 h), Sonnenwinkel **210°**, Sonnenlicht **3,9**, Umgebungslicht **0,53**, Schatten-Kontrast **1,50**, Schatten-Weichheit **5,0**, Farbtemperatur **4500 K**. Beim Start setzt `applyTodaySunDate` nur Monat/Tag auf heute — die Standard-Lichtwerte bleiben erhalten. **Datum + Tageszeit** (0:00–23:59) setzen beim manuellen Anpassen Azimut, Elevation, Intensität, Weichheit und Farbtemperatur aus dem Berlin-Sonnenstand (`applySolarLook: true`). **Sonnenwinkel**, **Sonnenlicht**, **Umgebungslicht**, **Schatten-Kontrast**, **Schatten-Dunkelheit**, **Schatten-Weichheit** und **Farbtemperatur** sind sonst manuell. Slider Intensität 0,3…**8**. Schatten-Dunkelheit (Legacy) Default **0,55**. Persistierte Saves behalten eigene Lichtwerte; das Datum wird beim Laden auf heute gesetzt.

### Szene-Farben (`SceneAppearance`, `src/utils/persistence.ts`)

Im Akkordeon **Szene** (rechte Leiste) drei Farb-Inputs, gespeichert unter `PersistedAppState.scene`:

| Input | Feld | Default | Wirkung |
|---|---|---|---|
| `#scene-all-color` | alle drei | `#ffffff` | Setzt Hintergrund, Untergrund und Himmelsfarbe gemeinsam. |
| `#scene-bg-color` | `background` | `#ffffff` | Viewport-Hintergrund (Aufriss, Entwurf/Vorschau). In **Render**/3D liegt der physikalische Himmel davor — dort wirkt die Farbe nur am Rand außerhalb der Zeichenfläche. |
| `#scene-ground-color` | `ground` | `#ffffff` | Bodenplatte (Albedo) und atmosphärischer Horizont unter dem Himmel. |
| `#scene-sky-color` | `skyReflection` | `#3A6084` | Hemisphere-Himmel, Glas-EnvMap und Lichtstimmung. Alter Default `#ffffff` wird beim Laden ersetzt, sofern nicht bewusst eine andere Farbe gesetzt wurde. |
| `#scene-line-stroke` / `#view-line-stroke-row` | `lineStrokeScale` | `1` | Multiplikator für Linienstärke im Stil **Zeichnung** (2D-SVG, 3D-Kanten via `LineSegments2`, Grundriss-Kanten). Steuerung oben links in der Zeichenfläche (`#view-line-stroke-row`), sichtbar nur bei aktivem Stil Zeichnung. |

Anwendung über `applySceneAppearance()` — setzt Hintergrund, Boden, Glas-EnvMap und aktualisiert die Hemisphere-Lichter. Farb-Picker (auch vorgefertigte `<input type="color">` in `index.html`) haben Live-Vorschau während des Ziehens (v2.0.11).

Rahmen-/Glas-Farben in der **Öffnungs-Toolbar** (`#frame-color-swatches`) über `<input type="color">` plus **RGB-, HSL- und HEX-Felder untereinander** (kein Format-Dropdown). Gleiches gilt für **Szene** (Alle drei / Hintergrund / Untergrund / Himmel) und **Nebel**. Bei Glas zusätzlich Button **Transparent**. Wand-, Fugen-, Profil-, Gesims- und Dachziegel-Farben ebenfalls. Die Inputs werden bei UI-Sync **wiederverwendet**; während eines aktiven Pickers (`activeColorPickerCount`) wird `renderUi` nicht für Farb-Hosts aufgerufen. Hover-Livevorschau (`previewSelectionColor`) aktualisiert nur 3D/2D, kein vollständiges `renderUi`.

**Studio:** **Wandfarbe** färbt die Außenfläche (`wallColor`). **Laibung außen/innen** (`revealExteriorColor` / `revealInteriorColor` am Öffnung, Farben-Tab) sind unabhängig — fehlen sie, Fallback Wand-/Innenwandfarbe. **Verkleidung** (`claddingColor`) steuert Steine/Paneele. **Fugenfarbe** (`panel.jointColor`, unter Tab Paneele) unabhängig davon. **Innenwandfarbe** (`interiorColor`, Default Weiß) nur die Raumseite.

Wand-Batch färbt Fenster **und** Türen.

2D-Farbmodus: Laibungs-Fill `rgba(0,0,0,0.06)`, Gesims mit SVG-`feDropShadow` (`#cornice-shadow`), Viewport `#e8e8e8`.

---

## Öffnungs-Vorlagen

Unter **Bibliothek** (sticky unten, Tabs Wände/Fenster/Türen): bei Fenster/Türen Presets links, danach ein **vertikaler Trennstrich**, gespeicherte Vorlagen, rechts **Neue Vorlage**. Dialog mit Karten-Vorschaubildern (Typ, Größe, Fenstertyp, Profil, Banken) und großer Live-Vorschau. Speichern schließt den Dialog (`dialog.close`, nicht Form-`close`). Persistenz: localStorage `fassaden-builder-opening-templates-v1` (`src/utils/openingTemplates.ts`). Wand-Tab: Längen-Presets ohne Vorlagen-Dialog (siehe Abschnitt Bibliothek unten).

## Öffnungs-Mindestabstand

`OPENING_MIN_GAP = 32` cm (`src/utils/validation.ts`); Slot-Suche und Verschieben in `openings.ts` nutzen denselben Wert.

## Paneel-Zufallsfarben

Unter **Paneele** (wenn Paneele/Mauerwerk aktiv): **Stein-Kontrast** und **Stein-Häufigkeit** (0–100 %) — für **alle** Muster (Streifen, Ziegel, Klinker …), nicht nur Mauerwerk. Kontrast steuert Hell/Dunkel um die Paneelfarbe (`claddingColor`, HSL). Häufigkeit mappt auf 1…8 Farbstufen, zufällig auf die Steine verteilt. Bei Kontrast 0 ist Häufigkeit ausgeblendet; der erste Kontrast > 0 setzt Häufigkeit auf 40, falls sie noch 0 war. Beim Laden setzt `normalizeStudioPanel` Häufigkeit ebenfalls auf 40, wenn Kontrast > 0 aber Häufigkeit 0 ist. Seed pro Wand-ID + Config + **Rasterposition (x/y)** → stabile Zuordnung auch nach Jamb-Siegel; eine Mesh-Gruppe pro Stufe (`tileColors.ts`, `createStudioPanelGeometriesByColorIndex`). **v0.7.248:** Kontrast wirkt auch in der Gesamtansicht (Medium-LOD baut mehrfarbige Low-Meshes). Felder gehören zum Edit-Scope „Typ“ (`panelConfigKey`).

**3D-Steine (v2.0.25):** Reststeine an Öffnungen (Outline nach Clip) nutzen Ear-Clipping-Triangulation — keine Fächer-Diagonalen in der Fensterecke.

**3D-Steine (v0.7.42):** Vorderseiten nutzen wieder die Windung von GitHub v0.7.33 (`addQuad(blf, brf, trf, tlf)`). v0.7.41 hatte die Fronten umgedreht (`addFrontCap` ohne `panelFlip` → +Z); `FrontSide` blendete sie aus — Kacheln wirkten hohl. Bogen-Reste wieder `bottomArc`, nicht `outline`.

---

## Fenster-/Türlaibung 24 cm

`WINDOW_RECESS = 24` in `src/constants/presets.ts`.

`studioWindowOriginZ` in `src/studio/walls.ts`:

- Anker = Wandkörper-Außenkante (`z = 0` bei `panelFlip`, sonst `z = depth`), nicht Paneel-Front
- Front der Verglasung = Außenkante + 24 cm nach innen
- `windowDepthOffset` ist **Zusatz** dazu (`+` = außen). Default `0`
- Alter gespeicherter Wert `-24` wird in `normalizeWindowDepthOffset` auf `0` gemappt (sonst 48 cm)

Vorzeichen wie Profile: `panelFlip ? -1 : 1`. Mesh-Rotation bleibt `yaw + π`; Pivot so, dass die Front auf der Laibungsebene liegt.

### 3D-Leibungswandung bis zum Profil

Die 24 cm gelten nur für die **Fensterlage**. Die sichtbare Leibung (Seiten, Sturz, Sohlbank) ist eine **eigene Geometry** pro Öffnung (`createStudioOpeningRevealGeometry`), nicht mehr Teil des Wandmeshes:

- Sie läuft von der **Innenwand** (`studioOpeningRevealInnerZ` → `studioWallInnerLocalZ`, panelFlip-sicher) bis zur **Profilebene** bzw. zur Paneelfront (`studioOpeningRevealOuterZ`). **v0.7.193:** Innenkante war bei normaler Ausrichtung fälschlich die Außenkante — Himmel-Streifen am Sturz. **v0.7.239:** nur noch der Tunnel (keine Front-Lippe, kein Soffit-Kasten in der Öffnung) — Sturz = Oberkante der Maske, ohne Extra-Linien.
- Mit **Freiraum um die Öffnung**: äußeres Ende = Vertiefungskante (`studioClearanceRecessZ`) minus `REVEAL_CLEARANCE_INSET_CM` (0,12 cm, v2.0.117) — Freiraum-Kappe empfängt Schatten (keine Lichtkante).
- **Farbe (v0.7.247):** Tunnel halbiert in Außen- und Innenhälfte — **Außenhälfte** = `wall.wallColor`, **Innenhälfte** = `wall.interiorColor` (jeweils `wallFinish`). Zwei Material-Gruppen in `createStudioOpeningRevealGeometry`. Pick als Öffnung (`openingPart: 'group'`).
- Ohne Fensterprofil: Ende = äußerste Fassadenfläche (`projectDepth` + `taperDepth`).
- Mit Profil: max/min zur Profilebene (`offsetForward`), nie kürzer als die Paneelfront.
- Paneele und Mörtel folgen derselben Maskenkontur wie das Wandloch (`PANEL_OPENING_CLEARANCE = 0`). Optionaler Nutzer-Freiraum bleibt ein gleichmäßiger Offset derselben Form. **v0.7.159:** Zierbänder werden an Freiraum-Öffnungen wie an Öffnungskonturen durchtrennt; Freiraum-Band an Boden-Türen ohne Sohlbank-Linie (SVG U-Band, 3D ohne Bodenring).
- Gesims/Trim sitzen auf `studioFacadeOutwardLocalZ` (Paneel inkl. Bossen); negatives `offsetForward` zieht nicht hinter die Fläche. Sockelprofil liegt auf `studioPanelFaceLocalZ` (Wand-/Paneelfläche ohne Trapez).
- **Zierbänder (v0.7.156 / v0.7.189 / v0.7.240 / v0.7.241):** Horizontale Profile auf beliebiger Höhe (`wall.trimBands[]`, cm von unten). Eigener Einstellungs-Tab **Zierbänder**. Studio-Wand auswählen → Tab → **Band hinzufügen**. Klick auf ein Band in 3D öffnet denselben Tab. Rendering über `buildTrimBandPaths` wie Gesims-Sweep (`role: 'trimBand'`, `wallPart: 'trimBand'`). Aussparung an Öffnungen über die Maskenkontur (`openingMaskXRangesAtY`, Rundbogen wie Paneele) und zusätzlich um das Rahmenprofil (`wall.profiles`).
- Außenbank-Tiefe: Default und Maximum **16 cm** Vorstand vor der äußeren Fassadenfläche (`OUTER_SILL_DEFAULT_CM` / `OUTER_SILL_MAX_CM`). Alte Code-Defaults (20/32/36/40/48) und Werte über 16 cm werden hydriert; kleinere Nutzerwerte bleiben.
- 2D-SVG bleibt unverändert.

Das Fenster bleibt 24 cm hinter der Wandkörper-Außenkante; die Leibung holt die Wandung nach außen zum Profil.

---

## Etagen-Trennfläche (Decke / Boden)

`FacadeController.rebuildIndoorFloor`: **Decke und Fußboden** je Etage aus `planFacesWithHoles`. **v2.0.140:** Polygon an der **echten Wandinnenkante** (`innerFaceRingFromWalls` + 1 cm Inset) — kein Durchscheinen/Flackern und keine Lücke ≈ Wandstärke bei `panelFlip: false`. **v2.0.121:** An Öffnungen, die die Platte schneiden/berühren, Kerbe weiter nach innen (`src/studio/slabNotches.ts`). Meshes sind `ExtrudeGeometry` mit Dicke `INDOOR_SLAB_THICKNESS` (8 cm).

| Geschossgrenze | Y-Position |
|---|---|
| Decke EG / Boden OG1 | Wandoberkante der Etage (`storeyTopY`, max. `wall.y + wall.height`) — **Oberseite** der 8-cm-Platte (`y = storeyTopY − INDOOR_SLAB_THICKNESS`) |
| Fußboden EG / OG | Untere Türkante der Etage (`storeyFloorSurfaceY`) — **Unterseite** der 8-cm-Platte (`y = surfaceY − INDOOR_SLAB_THICKNESS`); ohne Tür: Wandunterkante |

Meshes sind per `userData.indoorRole` (`ceiling` \| `floor`) und `userData.kind` getaggt sowie `buildingId` / `floorIndex`. **3D-Render (v2.0.56):** Decke und Fußboden hell wie Innenwände (`createIndoorSlabMaterial`: EnvMap, kein Gegenlicht-Dim). Default **Weiß**; `FloorPlan.ceilingColor` gilt für die 3D-Albedo (Farb-Toolbar).

**Auswahl:** Linksklick auf die Decke in 3D setzt `selectedCeiling` (orange Highlight); Toolbar `#toolbar-ceiling` mit Farbe (`FloorPlan.ceilingColor`, Default Weiß). Dieselbe Farbe steht im Wand-Reiter **Farben**. Ebenenliste wie bisher.

**Sichtbarkeit (3D):** `floors[fi].showCeiling !== false && !floors[fi].hidden` — die Platte trennt die Etage darüber von der darunter. **v2.0.145:** Ohne geschlossenen Grundrissring gibt es keine Meshes — nach Extrusion konnten Wandenden 1 Rasterzelle auseinander landen (`floorPlanFromWalls` → `sealNearClosedPlanGaps` schließt das). Ebenen „Einblenden“ ruft zusätzlich `rebuildIndoorFloor` auf.

Versteckte Gebäude (`building.hidden`), Wände (`wall.hidden`) und Öffnungen (`opening.hidden`) werden nicht gerendert.

`FacadeController.rebuildIndoorFloor` iteriert alle nicht-versteckten Gebäude mit eigenem `wallHeight` und `floors[]`.

**Schatten / Licht:** Sichtbare Platten **werfen und empfangen** Schatten wenn sichtbar; mit Punktlicht zusätzlich `customDistanceMaterial` für Cube-Shadows. Wandunterseite bleibt neben Bodentüren geschlossen (nur unter der Schwelle offen). Details: [shadows.md](shadows.md), [scene-lights.md](scene-lights.md).

---

## Kompass

`src/studio/compass.ts`: Wandnamen N/O/S/W bzw. 45°-Kombinationen (`N/O`, `N/W`, …). HUD `#view-compass` / `#view-compass-svg`.

Yaw-Konvention überall gleich: **0=N, 90=W, 180=S, 270=O** (gegen Uhrzeigersinn). `viewedFacadeYaw` rechnet Kamera-Heading (CW: 0=N, 90=O) mit `180 − heading` um — nicht `heading + 180` (sonst spiegeln O/W und S/O↔S/W).

- **Cardinals N/O/S/W:** Klick setzt Yaw 0/270/180/90 (`data-yaw`). Text ist nicht markierbar (`user-select: none` auf Labels + `preventDefault`).
- **Ring / Nadel:** Klick relativ zur SVG-Mitte → Winkel rastet auf **45°** (`yawFromCompassSvgPoint`, `snapYawTo45`) → `setCompassYaw` (gleiche Wirkung wie Cardinal).
- **2D:** … Fensterrahmen empfangen in 2D Werfschatten wie Paneele (v0.7.344). Details: [shadows.md](shadows.md).
- **3D:** Kamera dreht um den bestehenden Orbit-Mittelpunkt (`orbitCameraToYaw`) — Abstand und Höhe bleiben, nur die Blickrichtung ändert sich. Erst bei fehlender Orbit-Position wird einmalig eingerahmt (`focusCameraOnYaw`).
- Default-Ansicht: **N (0°)**. Nadel folgt der Kamera; aktives Cardinal nur bei exakt 0/90/180/270.
- **Neue Bibliothek-Wand in 3D:** Front zeigt zur Kamera (`viewedFacadeYaw`) — entgegengesetzt zur Blickrichtung. Blick S/W → Fassade N/O, Front auf der Nordseite einer Ost-West-Wand. Am Nachbar gilt weiter Front-Flush.

---

## Edit-Scope (Auswahl / Typ / Etage / Fassade)

**Schwebend unten mittig** im Viewport (`#edit-scope-bar`, sichtbar bei Wand- oder Öffnungsauswahl, nicht im Grundriss). Gilt für **alle Edits am gewählten Typ**, solange die Auswahl aktiv ist:

- Wand-Edits (Paneele, Sockel, Gesims, Zierbänder, Farben, Wandmaße mitziehen): `editWallTargets` in `src/studio/editScope.ts`
- Öffnungs-Edits (Profil, Fensterbank, Treppe, Rahmen/Glas, Gründerzeit, **Position/Nudge/Drag**): `editOpeningTargets` / `scopedOpeningRefs()`
- Beim Verschieben: Delta gilt für alle Scoped-Refs. Türen mit aktiver Treppe behalten Auto-Y aus Stufen.

| Scope | Wände | Öffnungen |
|---|---|---|
| Auswahl | nur markierte Studio-Wände | nur markierte |
| Typ | Studio: alle Wände im **aktiven Gebäude** mit gleicher Paneel-Konfiguration (`panelConfigKey`); Modul-Wände: gleiches `claddingId` + `moduleName` | alle Öffnungen desselben **Typs** im Gebäude (Fenster bzw. Tür — ohne Maße/Keller-Filter) |
| Etage | alle Studio-Wände aller `floorIndex`-Werte der Auswahl (Multi-Etagen) | alle Öffnungen dieser Etagen |
| Fassade | alle Studio-Wände **desselben Hauses** (0°/45°/90°, jede Etage); optional gefiltert auf gewählte Himmelsrichtungen (`#edit-scope-facade-yaws`) | **alle** Öffnungen auf diesen Wänden (gleicher Yaw-Filter) |

Wenn **Fassade** aktiv ist: Chip-Leiste daneben mit **Alle** plus den im Haus vorhandenen Richtungen (`wallCompassLabel`). Kein Chip / Alle = gesamtes Haus. Mehrfachauswahl möglich. Persistenz: `editFacadeYawFilter` neben `editScope`.

Nicht verknüpfte Wände unter **Auswahl** werden nie still über Nachbarschaft oder Gruppe mitbearbeitet — nur explizit markierte IDs.

Zierbänder unter Etage/Typ/Fassade: Patch/Löschen per Band-Index bzw. `yFromBottom` der Anker-Wand, nicht nur per `band.id`.

Gesims-Höhe/Tiefe (cm) unter Etage/Fassade/Typ: letzte Eingabe gilt für alle Zielwände — Umrechnung in `scale`/`sectionScaleForward` **pro Wand** aus dem jeweiligen Profil-Querschnitt (`updateWallCorniceHeightCm` / `updateWallCorniceDepthCm`).

Profil-Assign (`#profile-select-cards`, Kanten-Buttons, Draft-Save) und Öffnungs-Modell nutzen `scopedOpeningRefs()` — nicht nur `editor.selectedOpenings`. Rahmenprofil-Kacheln: nur `FRAME_PROFILE_IDS` (Fensterprofil 32×120 / 35×130 / 40×140).

Persistiert als `editScope` / `editFacadeYawFilter` in localStorage (`PersistedAppState`).

---

## Export-Modus

Viewport-Chrome **Export** (`#view-btn-export`, `AppView` `'export'`).

- Linke Spalte und untere Bibliothek werden eingeklappt (Zustand beim Verlassen wiederhergestellt).
- Rechte Leiste: oben `#export-sidebar` (Orientierung Hoch/Quer, Seitenverhältnisse 1:1 / 3:4 / 2:3 / 9:16 (Quer = 1:1 / 4:3 / 3:2 / 16:9), Ansichten ein/aus (vorhandene Fassaden-Yaw + optional Oben), Wallpaper-Safe-Area oben, Passepartout (Rand % + Farbe) für die fokussierte Ansicht, Export PNG/JPG).
- Vorschau darunter in `#export-stage`: Ansichten **nebeneinander**, **100 % Spaltenhöhe**, horizontal scrollen/sliden (`src/ui/exportMode.ts`, Capture über WebGL `preserveDrawingBuffer`).
- Download = ein zusammengesetztes Bild aller sichtbaren Slots (`fassade-export-…png|jpg`).

JSON-/Link-Export unter Datei bleibt unverändert.

---

## Fensterteilung und Sprossen

Toolbar **Fensterteilung** / **Sprossen** (`#window-style-section`), gilt für Fenster und Türen (gleiche `Opening.gruenderzeit`-Config). Oberlicht (`transomBars`) bleibt separat.

**Ebene A – dicke Rahmen-Teilung** (ganzer Flügel unter dem Kämpfer), je Achse:

| Steuerung | Werte | Bedeutung |
|---|---|---|
| **Anzahl** (`#window-split-v-count-group` / `#window-split-h-count-group`) | `1`–`5` | gleichmäßige Teile |
| **Verhältnis** (nur bei Anzahl `2`) | `1:1` … `1:6` | Gewichte `[1, n]` unten→oben bzw. links→rechts |

Primärstege nutzen Flügelholz (`TIMBER.sash`). Wechsel der Teilung setzt `paneMuntins` auf Defaults und leert die Vorschau-Auswahl.

**Ebene B – Sprossen je Teil** (`#window-muntin-section`, nur bei Auswahl):

| Steuerung | Werte | Bedeutung |
|---|---|---|
| Senkrecht / waagerecht | `0`, `1`, `2` | Anzahl Sprossen → gleichmäßiges Raster `(v+1) × (h+1)` im Teil |

**Vorschau:** Klick auf ein Fensterteil toggelt die **Mehrfachauswahl** (orange); Buttons setzen Sprossen für alle selektierten Indizes. Leere Auswahl → Sprossen-Gruppe ausgeblendet.

**Türen – Brüstung** (`#window-panel-section`, nur bei `type === 'door'`):

| Steuerung | Werte | Bedeutung |
|---|---|---|
| Checkbox Brüstung | an/aus | untere Holzfüllung ohne Glas |
| Verhältnis Brüstung : Glas | `1:1` … `1:4` | Höhe unten = `a/(a+b)` der Innenhöhe |

Daten: `splitVCount` / `splitVRatio` / `splitHCount` / `splitHRatio` / `paneMuntins[]` / `bottomPanel` / `bottomPanelRatio`. Legacy `splitV`/`splitH`/`sashSplitV`/`paneCols` und numerisches `bottomPanelRatio` werden in `normalizeGruenderzeitConfig` migriert. Layout: `subdividePrimaryThenMuntins` in `src/windows/gruenderzeit.ts`.


## Gebäude im Grundriss

- Klick auf die Haus-Fläche wählt das Haus; Ziehen verschiebt es (Gitter + Align-Snap).
- Hilfslinien: Self (cyan) und Align (orange), analog zu Fenster-Guides.
- ±45°-Buttons: geometrische Drehung des gewählten/aktiven Hauses; ohne Auswahl Site-Yaw (nur 3D).

## Kellerfenster / Fenstergitter

Kurz: Preset `window-basement-48` setzt `basementWindow.enabled` (Gitter an). Checkbox **Fenstergitter** (`#window-basement-enabled`) bei jedem Fenster; Default **aus**, außer Kellerfenster-Preset. Gitterhöhe-Slider nur wenn aktiv. Kein Profil/Bänke/Verdachung bei aktivem Gitter/Keller. Franz. Balkon-Gitter dann ausgeblendet. **Teilung (v2.0.14):** Reiter sichtbar — max. 2 Flügel, kein Oberlicht, keine Fensterteilung (Raster), Sprosse max. 1 je Richtung (`clampGruenderzeitForBasement`). **v2.0.90:** Neue Fenster default 1 Flügel ohne Oberlicht. Details: [opening-features.md](opening-features.md#kellerfenster-basementwindow).

---

## Abwechselnde Paneel-Ebenen

Bei Muster **Streifen** + **Abwechselnde Ebenen** (`panel.alternateFloors`):

| Ebene | Reihen | Felder | Default |
|---|---|---|---|
| **Ebene 1** | gerade | `projectDepth`, `taperDepth`, `taper` | wie bisher (4 cm / 0 / 1) |
| **Ebene 2** | ungerade | `recessedProjectDepth`, `recessedTaperDepth`, `recessedTaper` | **0** / 0 / 1 |

UI: `#studio-alternate-layers` mit zwei Akkordeons. Ohne abwechselnde Ebenen: ein Feld „Vorstand / Steintiefe“ und Sektion **Bossen** (Bossen-Vorstand + Bossenprofil).

- Ebene 2 mit Vorstand **0**: kein Stein-Mesh auf ungeraden Reihen (nur Wand/Mörtel).
- Vorstand Ebene 2 > 0: mindestens `jointDepth + 0,1 cm` (Auto-Korrektur in `normalizeStudioPanel`).
- Altes Save-Feld `recessedDepth` wird beim Laden nach `recessedProjectDepth` migriert.

Z-Fighting: Beide Ebenen teilen `backZ = 0` an der Wandaußenfläche — zu flache zurückgesetzte Steine würden mit Mörtel/Wand flimmern; deshalb Default 0 und Mindesttiefe.

### Paneel-Reihen ausblenden (v0.7.108)

Unter **Höhe** im Tab Paneele: **Reihen unten ausblenden** / **Reihen oben ausblenden** (`#studio-hide-rows-bottom`, `#studio-hide-rows-top`). Ganzzahlige Schichten (0 = alle sichtbar); 1 = eine Reihe ohne Paneele/Mörtel, nur nackter Wandkörper. Unabhängig vom Sockel (Sockel clippt weiterhin cm-basiert von unten). Maximalwert = Gesamtreihen − 1. **v0.7.227:** Im oberen Freistreifen bleibt die Außenfläche auf voller Tiefe — der Wandkörper wirft weiter Schatten (keine Einsenkung der Außenfläche). **v0.7.134/135:** Ist die Wandbeschriftung aktiv, rückt sie in den oberen Freistreifen — auch wenn der Streifen niedriger als die Schrifthöhe ist (dann an der Wandoberkante). **v0.7.159:** Zierbänder im ausgeblendeten oberen Streifen werden ebenfalls auf die nackte Wand gelegt (`syncWallDecorToTopBareBand`).

### Wandbeschriftung (v0.7.109)

Tab **Schrift** (`data-settings-section="label"`): Checkbox, Textfeld mit **Speichern** (`#studio-label-text-save`) bzw. Enter, **Schriftart**-Karten darunter (`#studio-label-font-cards`, 16:9, eine Spalte). Die Vorschau setzt denselben Text wie das Feld oben in der jeweiligen Schrift; Klick speichert `label.fontId`. Standard **Federo**; weitere Schnitte von Peter Wiegel (`docs/fonts.md`). Höhe, Position X/Y (cm von links/unten), Ausrichtung, Farbe, **Flach** vs. **Mit Tiefe** (Extrusion in cm). **Versatz (cm, + außen / − innen)** (`#studio-label-offset-forward`) verschiebt die Schrift senkrecht zur Fassade. Klick auf die Schrift in 3D öffnet den Tab; Schrift per Drag auf der Fassade verschiebbar. **v0.7.180:** Schrift-Vorstand auch negativ (nach hinten, −80…80 cm). **v0.7.227:** Versatz-Feld standardmäßig sichtbar (nicht nur im Komplex-Modus). **v0.7.244:** Schriftwahl mit Live-Vorschau. **v0.7.252 / v0.7.254:** In der 3D-Ansicht folgt die Schrift dem Fassadenschatten (Schattenseite und Gebäudeschatten dunkler; Wand-Bounce-Fill gilt nicht für Schrift). **v0.7.288:** Gesims und Zierband werfen wieder Schatten auf den Freistreifen unter der Schrift.

## Teil-Selektion von Öffnungen und Wand-Teilen (v0.5.0)

`OpeningPart` in `EditorState.selectedOpeningPart`: `group` | `frame` | `trim` | `sillInner` | `sillOuter` | `pediment` | `consoles` | `stairs` | `grille` | `rollerShutter`.

`selectedWallPart` (nur ohne Öffnungswahl): `group` | `cornice` | `plinth` | `cladding` | `label`.

- 3D: Raycast inkl. `claddingGroup` (Treppe) und `profileGroup`; Gesims-Meshes mit `wallPart: 'cornice'`, Sockel mit `plinth`, Paneele mit `cladding` (orange inkl. LOD-Kacheln).
- Bei Teil-Fokus (`part !== 'group'`): rechte Toolbar zeigt **nur** den passenden Reiter (andere `.settings-section` per `hidden`; verschachtelte Sektionen zählen nur wenn kein Vorfahre ausgeblendet ist). Maße/Aktionen und irrelevante Farben ausgeblendet. **Ausnahme Paneele (`cladding`):** ab **v0.7.227** wieder **alle** Wand-Reiter sichtbar (Maße, Schrift, Gesims, …) — nur 3D-Highlight bleibt auf dem Paneel.
- **v0.7.176:** Anklicken in 3D behält Teil-Fokus für Profil, Bänke, Verdachung, Konsolen, Treppe, Gesims, Sockel, Paneele, Schrift. Rahmen/Glas → Ganz-Öffnung (`group`) mit Tab Farben. Rahmen-/Glasfarbe nur bei Öffnungsauswahl.
- 3D-Highlight: Treppe = Stufen-Meshes orange (kein flaches Overlay in der Sockelzone); Wand-Teil = markierte Meshes + Overlay.

- 3D: `tagPickable(..., { openingPart })` an Rahmen, Profil-Sweeps, Leibung (`trim`), Bänke, Verdachung, Treppe, Gitter, Freiraum-Kappe; Raycast inkl. `profileGroup`. Pick-Priorität: **Treppe vor Öffnung vor Verkleidung**; Treffer im Öffnungsloch auf Paneel/Wand zählen als Fenster.
- 2D: Bank/Treppe/Verdachung mit `data-opening-part` pickbar; Öffnungspfade `pointer-events: all`.
- **Verschieben** (3D/SVG/Nudge) bleibt immer die **ganze Öffnungsgruppe**; Drag auf Paneel/Wand verschiebt die Studio-Wand.

---

## Verdachung (Fenster & Tür)

UI: `#opening-pediment-section`, `#opening-consoles-section` (nicht unter Fensterbänken). Feldkatalog und Maße: [opening-features.md](opening-features.md#verdachung-openingpediment).

### Oberflächen-Reflexion (v0.7.134 / v0.7.135 / v0.7.176)

**Stumpf** / **Glänzend** / **Metallisch** (`SurfaceFinish`) pro Element:

| Element | Farbe | Finish-Feld / UI |
|---|---|---|
| Wand | `wallColor` / `#wall-color-swatches-studio` | `wallFinish` / `#studio-wall-finish` |
| Paneele | `claddingColor` / `#cladding-color-swatches-studio` | `claddingFinish` / `#studio-cladding-finish` |
| Profile (Wand) | `profileColor` | `profileFinish` / `#studio-profile-finish` |
| Gesims | `cornice.color` | `cornice.finish` / `#studio-cornice-finish` |
| Schrift | `label.color` | `label.finish` / `#studio-label-finish` |
| Rahmen | `frameColor` | `frameFinish` / `#opening-frame-finish` |
| Rahmenprofil | `trim.color` | `trim.finish` / `#opening-trim-finish` |
| Fensterbrett / Fensterbank | `sillInner/Outer.color` | `….finish` |
| Verdachung | `pediment.color` | `pediment.finish` / `#pediment-finish` |
| Treppe | `stairs.color` | `stairs.finish` / `#stairs-finish` |

Fehlendes Element-Finish fällt auf die passende Wand-Oberfläche zurück (`wallFinish` / `profileFinish`). Glänzend/metallisch nutzen die Studio-EnvMap (`RoomEnvironment`) am Material. Glas bleibt eigenes System (Tint / physisch).

### Rahmenprofil-Maße

UI-Felder und Konstanten: [profiles.md](profiles.md) / [opening-features.md](opening-features.md#rahmenprofil-maße).

---

## Register-Navigation (Auswahl, v0.7.55+)

Bei Wand-, Öffnungs-, Studio-, Dach- oder Decken-Auswahl:

- **Unten** (`#library-dock` / `#opening-library` / `#library-mode`): immer die **Element-Bibliothek** (Wände / Fenster / Türen / **Paneele**). Tabs horizontal **oberhalb** der Kartenleiste (`#library-dock > .library-chrome`), Text **waagerecht** lesbar; kein Titel „Bibliothek“.
- **Rechts** (`#selection-toolbar`): Werte, Farben, ±, Löschen. Register (`#selection-right-tabs` / `.selection-toolbar-tabs`) **vertikal** gestapelt mit `writing-mode: vertical-rl`; Toolbar `flex-direction: row`. **v0.7.56:** Szene- und Auswahl-Tab-Leiste strecken sich über die volle rechte Spaltenhöhe bis zum unteren Fensterrand (`#ui-right` / `#lighting-accordion` mit `flex: 1`). **v2.0.65:** Auswahl-Toolbar ohne Höhen-Deckel (früher `max-height: min(52vh, 520px)`); `#selection-toolbar-panels` füllt die Restfläche und scrollt vertikal.
- Ohne Auswahl: rechts **immer** die Szeneneinstellungen (`#lighting-accordion`, Geschwister von `#selection-toolbar` unter `#ui-right` — nicht darin verschachtelt, sonst verschwindet die Szene mit `[hidden]` der Auswahl-Toolbar).
- **`data-settings-inline-all`**: kein eigener Reiter, im aktiven rechten Panel mit sichtbar (Modell/Aktionen).
- Tab-Wechsel filtert per CSS-Klasse `selection-tab-filtered-out` — bestehende `hidden`-Logik bleibt maßgeblich.
- Wechsel der Auswahl setzt den Tab auf **Übersicht** (bzw. die erste verfügbare Sektion, falls Übersicht fehlt).
- **Einfach/Komplex:** Sektionen mit `data-ui-level="advanced"` erscheinen nur im Modus Komplex auch als Reiter. **Bossensteine** stehen im Tab Paneele (unter Mauerwerk), auch im Modus Einfach.
- **Keine Akkordeons** in den Auswahl-Panels; Navigation über rechte Register + Überschriften.

### Tab-Reihenfolge rechts (für alle Objekte)

Gilt für die **rechten Einstellungs-Register** bei jeder Objektauswahl (Wand, Öffnung, Dach, Decke, Licht, …) und analog für die **Szene** ohne Auswahl. Nur Tabs, die für das aktuelle Objekt **sichtbar** sind (`hidden` / UI-Level / fehlende Features), erscheinen.

| Position | Tab | Inhalt / Beispiele |
|---|---|---|
| **1. immer** | **Übersicht** | Alle sichtbaren Einstellungsblöcke untereinander (wie Szene-Tab `all`) |
| **2.** | **Maße** / Größenangaben | Breite, Höhe, Tiefe, Position, Geschosshöhe, Wandstärke, … (`dimensions`, `measures`) |
| **3.** | **Farben** | Flächen-, Rahmen-, Glas-, Fugenfarben, … (`colors`) |
| **4.** | **Formen** / Profile | Querschnitte, Profilwahl, Teilung/Stil wenn formgebend (`profile`, ggf. Dachform) |
| **danach** | Dekor & Anbauteile **von oben nach unten** am Objekt | Reihenfolge wie an der Fassade gelesen |

**Von oben nach unten** (nur wenn vorhanden; `data-settings-order` bzw. DOM-Reihenfolge danach ausrichten):

1. Gesims (`cornice`)
2. Zierband / Zierbänder (`trimBands`)
3. Schrift (`label`) — oben an der Wand
4. Paneele / Verkleidung inkl. Fugen (`panels`) — Fugen kein eigener Tab
5. Öffnungs-Anbauten von Sturz zu Sohlbank: Verdachung → Verdachungsfeld → Konsolen → Rollläden → Fensterbank außen → Fensterbrett innen → Treppe (`pediment`, `taperedField`, `consoles`, `roller-shutter`, `sill-outer`, `sill-inner`, `stairs`)
6. Sockel (`plinth`) — unten
7. Sonstiges (Animation, Modul, Debug, …) ans Ende

**Technik:** Sichtbare Tabs aus `.settings-section[data-settings-section]` sortiert nach `data-settings-order` (aufsteigend). Neue Sektionen müssen Order und Label so setzen, dass die Tabelle oben gilt. Übersicht = synthetischer Tab (Szene: `sceneToolbarTab === 'all'`; Auswahl: gleiches Muster).

**Nicht:** alphabetisch; nicht „was zufällig im HTML zuerst steht“, wenn Order fehlt — dann Order nachtragen.

### Keine Auswahl

- **Unten:** Bibliothek (`#library-mode`) mit Tabs Wände / Fenster / Türen / Paneele und Preset-/Vorlagen-Karten.
- **Rechts:** Szeneneinstellungen (`#lighting-accordion`) immer sichtbar (Geschwister von `#selection-toolbar`), inkl. vertikaler Szene-Register (volle Höhe).

### Linke Spalte einklappbar (v0.7.54 / v0.7.133)

Button `#ui-left-collapse` als **Fixed-Overlay** am linken Viewport-Rand (`grid-column: 1` mit `#ui`, damit keine vierte Grid-Spalte entsteht). Zustand in `localStorage` (`fassaden-builder-ui-left-collapsed`). Eingeklappt: Grid-Spalte 0, Griff „›“ bleibt sichtbar und klickbar. **v0.7.133:** `ResizeObserver` auf `#viewport-stage` setzt Canvas und Kamera auf die neue Breite — keine Lücke rechts in der Größe der Ebenenleiste.

### Inaktive Einstellungen ausblenden (v0.7.133)

Checkbox oder Aktion aus → zugehörige Felder, Hinweise und Vorschauen `hidden`, nicht nur disabled. Steuerndes Element bleibt. Beispiel: Keilstein-Ring aus → SVG-Vorschau, Anzahl, Bogenstärke, Schenkel weg (`#opening-arch-voussoir-opts`).

### Wände andocken, verschieben & drehen (v0.7.55–0.7.56)

- Wand-Presets aus der Bibliothek: Live-Vorschau in **Plan, 2D und 3D**. Beim Ziehen markiert die App die **Andockflächen orange** (Querschnitt links/rechts = Wandtiefe, oder die obere Fläche beim Aufsetzen) — `dockFacesForSegment`, Ghost-Kappen und Overlay auf bestehenden Wänden; im Grundriss optionale Endkappen.
- Am Andock-Knoten werden **beide Richtungen** (± Achse) geprüft; gültige, cursor-nähere Richtung gewinnt. Taste **R** wechselt die Achse.
- Überlappung: Kreuzung und kollineare Überdeckung bleiben verboten; **T-Stöße** erlaubt. Zusätzlich `studioWallsCollideIdentical` blockiert 1:1-Überlagerung bei Ablegen, Verschieben, Drehen, Duplizieren.
- Nach Dock/Move/Rotate: `finalizeStudioGeometry` → `recomputeStudioWallMiters` aus **Nachbar-Endpunkten** (`miterAtWallEnd`), nicht aus dem Grundriss-Walk (der die Wand entgegen `yawDeg` durchlaufen kann). **45°- und 90°-Ecken:** Paneele, Sockel und Gesims als Bilderrahmen an der Front (`cornerJoin`). v0.7.220: vorzeichenbehaftetes `z × tan(Knick/2)` — auch stumpfe 45°-Außenecken.
- Andocken: Front-Flush (`yawDeg`/`panelFlip`); Dialog **Wände verbinden** mit drei Optionen — **Auswahl auf Nachbarn**, **Nachbarn auf Auswahl**, **Nur verbinden** (Paneel, Farben, Gesims, Sockel, `panelFlip`; keine Öffnungen). **Ablegen am Nachbar:** Verbindung entsteht sofort (auch die bisher freie Nachbarwand wird verknüpft); Abbrechen oder Esc überspringt nur die Stilübernahme. **Freie Wand anschieben:** Dialog vor der Verknüpfung; Abbrechen lässt sie frei.
- **Verknüpfung / Loslösen:** `Wall.planLinked` (`false` = frei). **Wand lösen** (Toolbar `#studio-wall-unlink` oder Rechtsklick) setzt `planLinked: false`, entfernt `groupId` und Gehrung — die Wand ist danach **unabhängig** verschieb- und streckbar (nur sie selbst, Nachbarn bleiben). Verknüpfte Wände mit nicht mitselektierten Nachbarn lassen sich erst nach Loslösen bewegen. Beim erneuten Anstoßen Dialog wie beim Andocken, oder Rechtsklick **Wand verknüpfen**.
- **Verschieben:** Plan-Navigieren sowie Drag auf Wand/Paneel in 3D/2D (`offsetStudioWallsByGrid`); Öffnungen/Gesims/Sockel/Treppen bleiben an der Wand. Wände mit gleichem Fußabdriff auf **allen Etagen** ziehen mit (**Shift** = nur die aktuelle Etage). Grundrisse/Decke folgen über `syncFloorPlansFromWalls`. Verknüpfte Einzelwände rasten nicht aus dem Grundriss — Statuszeile **Zuerst Wand lösen (Rechtsklick)**. **v2.0.140 — Front-Pfeil:** verschiebt nur die Auswahl (+ kollinear verknüpfte Flucht, Etagen), **nicht** den ganzen Grundriss-Ring (`expandWallMoveIds(..., { planLinked: false })` + `offsetStudioWallsAlongFront`). Während des Ziehens: **orange Andockkappen** an Nachbar-Wandseiten (`updateWallMoveDockHighlight`, auch im Grundriss) — auf der **Etage der gezogenen Wand**, pro Ende nur die **nächste** Fläche (keine höheren Etagen). Raster **48 cm** (`PLAN_GRID` / `WALL_MOVE_SNAP`); Endpunkte in ±48 cm springen magnetisch an Nachbarenden. Kollision belässt die letzte gültige Position (kein Rücksprung zum Start). **v0.7.159:** Ohne Paneele/Mauerwerk keine sichtbaren Seitenfugen an kollinear angedockten Wänden (`createStudioWallGeometry`).
- **Drehen:** **90°** nur per Rechtsklick auf die Wand → **Drehen** → im/gegen Uhrzeigersinn. **Feindrehung** in den Wand-Einstellungen (`#studio-wall-yaw`, 1°-Schritte, nur Eingabefeld). Mehrfachauswahl bzw. Gruppen drehen gemeinsam um einen Schwerpunkt.
- **Maße (Gebäude):** Tab **Maße** — **Breite** `#studio-wall-width` (live beim Ziehen), Geschosshöhe `#studio-wall-height` (Standard **448 cm**, Schritt 16) und Wandstärke `#studio-wall-depth` (8–80 cm, Schritt 8). Die **Außenkante** bleibt stehen; Innenseite, Gehrung und Decke folgen der neuen Stärke. Decke: 0 cm Abstand zur Innenwand, Abstand zur Außenwand = Wandstärke.
- **Duplizieren:** Wände und Öffnungen mit **48 cm** Kante-zu-Kante-Abstand (`DUPLICATE_GAP_CM`).
- **Leere Öffnung:** Bibliothek Fenster → **Keines (leer)** (`opening-empty-96`) bzw. Typ **Keines (leer)** — Loch ohne Fenster/Tür-Chrome (`type: 'cutout'`, `fill.mode: 'opening'`).
- **Endstück 48** (Bibliothek Tab Wände, v0.7.63): zwei Karten **links** / **rechts**. Drag in die Fläche setzt ein sichtbares L (Front 48 cm + Rücksprung 48 cm nach hinten). Links: Außenseite vorne+links; rechts: vorne+rechts. Drop auf eine Wand hängt nur den Rücksprung am freien Ende an. Winkel `#studio-end-piece-angle` (40–140°, Schritt 10°).
- **Erker / Balkon / Loggia** (Bibliothek): Tab **Erker** mit zwei Karten — **384 cm Front**, 90° (`bay-384-rect`) bzw. **45°** (`bay-384-45`), Tiefe 144 cm. Beim 45°-Erker ist die Front 384 cm, der Ansatz am Parent `384 + 2×144`. Tabs **Balkon** / **Loggia** weiter 192/384. Drag zeigt Ghost wie eine Wand; Drop in die Fläche setzt die Baugruppe eigenständig. Drop auf eine (markierte) Wand öffnet Dialog `#bay-window-place-dialog`: **Ersetzen** oder **Links / Rechts / Darüber** angliedern. Gruppe in den Ebenen; Ausrichtung folgt der Fassadenaußenseite.

### Wand-Gruppen (v0.7.60)

- Mehrfachauswahl von Wänden per Ctrl/Cmd/Shift.
- Rechtsklick auf eine der selektierten Wände: **Gruppieren → Neue Gruppe** oder **zu vorhandener Gruppe**.
- Gruppen erscheinen im Ebenenbaum als eigene Zeile; Klick auf die Gruppe selektiert alle Mitglieder.
- **Aus Gruppe lösen** entfernt die aktuellen Wände wieder aus der persistenten Gruppe.

### Kein HDRI (v0.7.136)

Kein Foto-Himmel, keine `.hdr`-Datei, keine HDRI-Schalter. Hintergrund ist die Volltonfarbe `#scene-bg-color`. Reflexionen auf Glas und glänzenden/metallischen Oberflächen kommen von der importierten Three.js-`RoomEnvironment`-Karte am Material (`src/studio/roomEnvironment.ts`), nicht von `scene.environment`. Quellen und Danksagung: Button **Quellen** neben der Versionsnummer (`docs/credits.md`).

### Physisches Glas (v0.7.59)

Bei Öffnungs-Auswahl unter Glasfarbe: Checkbox **Physisches Glas (3D)** + IOR, Rauheit, Transmission, Dicke. Modus `tint` = Farbe/Transparenz (2D-SVG unverändert). Standard (`transmission` 0): echte Durchsicht plus Fresnel-Spiegelung der **CubeCamera-EnvMap** (Nachbarflügel, Boden, Himmel, von außerhalb des Hauses). Transmission > 0,08 = physische Transmission. Klarglas ist dunkel getönt (`#1a242e`), von vorn eher dunkel/durchscheinend, im Streiflicht stärkere Spiegelung.

### Bossen an Wandenden (v0.7.59)

Tab **Paneele** (nur bei Bossen-Vorstand > 0): Muster je sichtbarem Ende — aus, 1/1, 0,5/0,5, abwechselnd. Mit Nachbarwand: Stoß **bündig** oder **Gehrung** (`endBossStartJoin` / `endBossEndJoin`). Layout: `layoutPanelTiles`; Geometrie: `extrudeFrustum` / `shouldSuppressBossChamferAtEnd`. Zugeschnittene Steine an Öffnungen: ein Diamant (rastergleiche Front wenn sie noch im Stein liegt) — nicht zwei Erhebungen in einem L-Stein und nichts im Loch. **v0.7.175:** An der Dock-Fuge behalten 1+1 jeweils das volle Bossen-Trapez; 0,5+0,5 glätten nur die Innenseiten (Chamfer 0) und bleiben in ihrer Wand — kein Überstand über Öffnungen.

### Wand-Vorschau Bibliothek (v0.7.58)

Karten Tab **Wände**: SVG ohne cm-Zahl über der Box; Thumb füllt die Höhe, Seitenverhältnis **Länge : 448** (`WALL_HEIGHT`). Klasse `.opening-library-thumb-wall`.

### Paneele in der Bibliothek (v0.7.55)

- Tab **Paneele**: Karten aus `PANEL_KIND_PATTERNS` / `MASONRY_KIND_PATTERNS` (Labels `PATTERN_LABELS`), erste Kachel **Keine**.
- Drag MIME `application/x-panel-preset`; Drop auf Wand setzt `panel.pattern` + `enabled` (Mehrfachauswahl wie bei Öffnungen, wenn die getroffene Wand Teil der Auswahl ist).
- Klick ohne Drag: auf ausgewählte Wand(en); ohne Auswahl Hinweis in der Statuszeile.
- Rechte Paneele-Sektion bleibt die Feineinstellung (Maße, Gehrung, …); dort ebenfalls erste Kachel **Keine**.
- **v0.7.56:** Paneelfläche (`wallPart: 'cladding'`) orange inkl. Overlay; Drag auf Paneel verschiebt die Wand.
- **v0.7.103:** Profil-/Verdachungs-Gruppen in der Bibliothek und Sidebar-Picker beginnen mit **Keine/Keines/Keiner**.

### Treppen-Selektion (v0.7.56)

- Pick mit `openingPart: 'stairs'` setzt den Teil-Fokus (nicht immer `group`). Highlight auf Stufen-Meshes; Pick-Priorität Treppe vor Sockel.

### Wandflächen in 3D (v0.7.55)

- Wandkörper-Material (`FacadeController`): **`DoubleSide`**.
- Neu eingefügte Wände: Geometrie + Defaults; Optik optional per Andock-Dialog.

### UI-Modus Einfach / Komplex (v0.7.51)

Oben links in der Viewport-Chrome: Segmented Control **Einfach | Komplex** (`#ui-mode-simple` / `#ui-mode-complex`). Default **Einfach**, Persistenz `localStorage` Key `fassaden-builder-ui-mode`. Setzt `document.documentElement.dataset.uiMode`. In Einfach sind Blöcke mit `data-ui-level="advanced"` per CSS ausgeblendet (Bloom/LOD/Debug/Nebel, Fugen/Bossen-Details, Gesims-Orientierung/Vorstand-Zahlen, Paneel-Trapez/Alternierende Ebenen, Konsolen, Bank-Profil-Orientierung, manuelle Offsets). Preset-Karten, ±-Maße, Profilkarten und Rundbogen bleiben sichtbar. Kein separates Speichernformat.

### Bibliothek: Wände / Fenster / Türen / Nischen / Paneele / Profile / Verdachung (v0.7.65–v0.7.66)

Tabs in `#opening-library`: **Wände** | **Fenster** | **Türen** | **Nischen** | **Paneele** | **Profile** | **Verdachung** (`libraryTab` in `main.ts`).

| Tab | Inhalt | Ablegen |
|---|---|---|
| Wände | `WALL_LENGTH_PRESETS` (**v2.0.142:** 48 / 96 / 144 / 192 / 288 / 384 / 576 cm), Endstücke, Wände mit Öffnung; erste Kachel **Keines** | Drag (`application/x-wall-preset`) in die Bühne. **Mit Wandauswahl:** +/− links/rechts/oben an der Wand (folgen der Wand beim Orbit). + links/rechts/oben: bei gefüllter Wand-Zwischenablage **Einfügen** in diese Richtung, sonst **Duplizieren** (bzw. Etage darüber). **Ohne Auswahl (v2.0.142):** Breite anklicken → über eine bestehende Wand fahren zeigt ein **oranges Segment** (alle Etagen), Klick löst es als eigene Wand heraus — siehe [Wandsegment herauslösen](#wandsegment-herauslösen-srcstudiowallsplitts-v20142). |
| Fenster | Fenster-Presets (`WALL_OPENING_PRESETS`: u. a. 48×96, 48×192, 96×128/192/264, 144×192, 192×192, 396×196, Keller 48×64) + Vorlagen + „Neue Vorlage“ | auf Wand droppen / bei Wandauswahl klicken |
| Türen | Tür-Presets (96/144/288/480×320) + Vorlagen + „Neue Vorlage“ | wie Fenster |
| Nischen | Cutout-Presets (eckig/rund, Regenrohr, Durchbruch) plus **Konche** (Kalotte, Presets 96×128 / 64×96) | auf Wand droppen / bei Wandauswahl klicken; kein Glas, kein Blendrahmen; Konche: Rundbogen-Loch + Halbzylinder/Viertelkugel |
| Paneele | Muster-Karten | auf Wand droppen (`application/x-panel-preset`) |
| Profile | Rahmen, Gesims, Sockel, Fensterbank | Drag (`application/x-library-asset`) auf Fenster/Tür bzw. Wand; Klick nutzt die Auswahl |
| Verdachung | Form, Verdachungsprofil, Konsolen | auf Fenster/Tür droppen |

Profil- und Form-Karten in der **rechten Seitenleiste** sind ausgeblendet (`.sidebar-library-picker`); **Ausnahme:** `#profile-select-cards` in der Öffnungs-Toolbar (Rahmenprofile) bleibt sichtbar. Zahlen, Checkboxen und Farben bleiben in den Einstellungen. MIME `application/x-library-asset` plus `activeLibraryAssetDrag` (Dragover hat oft leere Custom-MIME).

**Aktive Kachel (v0.7.167–v0.7.175):** Die Karte, die bereits zur Auswahl gehört, hat einen **1 px schwarzen** Rahmen (`.library-card-applied`). Ohne Auswahl ist **Keines** so umrandet. Bei Wandauswahl erscheinen +/− an der Wand (folgen der Wand auch beim Orbit); + links/rechts/oben fügt aus der Zwischenablage ein oder dupliziert die Auswahl. Drag auf die Bühne bleibt.

Unter **Datei**: „Exportieren als .json“, „Importieren einer .json“, „Link kopieren“.

Bloom und Gobo-Schatten sind entfernt; `render3dFrame()` nutzt direkt `renderer.render`.

Navigation: Button **?** unten rechts in der Bühne öffnet ein Dialog mit der Tastatur-/Maus-Hilfe (nicht mehr in der Sidebar).

### Ansicht & Darstellung

Oben links in der Zeichenfläche: Segmented Controls — **Oben | 2D | 3D** (Ansicht), **Farbe | Zeichnung** (Darstellung), **Entwurf | Vorschau | Render** (Darstellungsmodus, v0.7.316), **Einfach | Komplex** (UI-Dichte, v0.7.51) und **Galerie** (QA-Übersicht aller Standards, v0.7.141, siehe [gallery.md](gallery.md)). Unabhängig voneinander. Bei **Zeichnung** erscheint daneben **Strichstärke** (Slider + Zahl).

**Entwurf / Vorschau / Render (v0.7.316):** `#light-presentation-btn` / `#edit-presentation-btn` / `#render-presentation-btn` — immer genau einer aktiv. **Entwurf (v0.7.325):** Preset **anklicken** → Wand **anklicken** wählt aus (Farben/Mauerwerk); **nochmal klicken** auf die markierte Wand tauscht das Segment; **Greifer** verlängert; **Ziehen** platziert neue Wand. **Vorschau:** Flat-Meshes, detaillierte Fenster. **Render:** volle Geometrie, Himmel, Bloom. Details: [performance.md](performance.md).

**Oben (v0.7.231 / v0.7.249):** Draufsicht auf die 3D-Szene von **über** dem Gebäude — Decken und Dächer sichtbar. Navigation wie 3D: **⌘/Ctrl+LMB** dreht die Himmelsrichtung (`topViewYawDeg`, Kompass), **⌘/Ctrl+⇧+LMB** schwenkt, **Shift+LMB auf leerem Bereich** / Mittelmaus = Pan, **Shift/Ctrl/Cmd+Klick auf Objekt** = Mehrfachauswahl (v2.0.16), Mausrad/`+`/`-` = Zoom, Pfeiltasten = Schwenk/Drehung. Wände, Öffnungen und Greifer wie in 3D.

**2D und 3D:** dieselbe Bearbeitung wie Oben (Wand ziehen, Öffnungen verschieben, Kontextmenü, Greifer). **2D (v0.7.336 / v0.7.340):** Mausrad/`+`/`-` = Zoom (zum Cursor); Pan wie 3D (**Rechtsklick**, Mittelmaus, **⇧**+Ziehen, Pfeiltasten), **0** = Einpassen. SVG-Aufriss bleibt für interne Logik; die Zeichenfläche nutzt die Ortho-Front-Kamera.

**Zeichnung:** reines Schwarz/Weiß (keine Grautöne); Fensterrahmen und Sprossen als weiße Füllung mit schwarzem Stroke (ca. halbe Linienstärke); in 3D weißes Material + `EdgesGeometry` als Kinder der Meshes (nicht Welt-Kopie in `lineGroup`, sonst verdoppelt `sitePivot` die Transformation). Studio-Kanten 22°. **v0.7.294:** Laibung ohne Eigenkanten (`skipLineEdges`) — wie Wandkörper bei Paneelen; Öffnungskontur über Steine. **v0.7.297:** SVG-Sockel als Sweep minus Öffnungsvolumen (Bogen inkl.). Weiß-Fill mit `polygonOffset`. Paneele am Rundbogen docken an die Keilstein-Außenkante (gleiche Facetten), damit die Mündung in der Zeichnung mit den Voussoirs zusammenfällt. **v2.0.88:** Bogenkappe ohne 16-cm-Spalten — Schulter- und Kellerfenster-Steine bleiben ganze, nur maskierte Steine wie die Reihe über dem Scheitel. **v2.0.87:** Rest-Bossen am Bogen als Dachfläche — Fasenbreite/-tiefe überall wie im Feld, schmale Reste mit First statt Mini-Pyramide, geteilte Front am Scheitelstein (`remnantBoss.ts`). **v2.0.86:** Kappensteine ohne Strahlen — Stein bleibt im Verband, nur maskiert; jede Restform (auch über dem Scheitel, an der Laibung, L/Zwickel) mit Bossen-Trapez rundum, schmale Reste kleiner skaliert bei gleichem Winkel. **v2.0.85:** Trapez bis zur Laibungs-Schulter (zurückgenommen in 2.0.86); Laibungssteine gleiche Fase wie das Feld; Bossen-Kanten 48° — kein Innenquadrat und kein Rechteckgitter über den Zwickeln. **v2.0.84:** Trapez auch an der Bogenschulter; Zeichnung ohne inneres Bossen-Quadrat ums Fenster (Filter der ganzen Platte vor der Steinfront). **v2.0.83:** Steine über dem Bogen trapezförmig (radiale Fugen); Bossen-Front (inneres Quadrat ums Fenster) in der Zeichnung ausgeblendet. **v2.0.81:** große Paneele in der Bogenkappe als Zwickel auf die Rundung. **v2.0.80:** Fugenfilter an der Bogenmaske (nicht Bounding-Box); Strecke durchs Glas wird geteilt; Bogen-Silhouette extra. Farbe kommt nach Klick/Rebuild **nicht** zurück — erst beim Wechsel zurück auf **Farbe**. Orange Selektion im Farbmodus als Overlay (Wand + Öffnung, `depthTest: false`); während Farb-Hover unterdrückt.

**Ebenen** in der linken Sidebar immer eingeblendet. **Datei** (JSON speichern/öffnen, Link) ist ein Dropdown unter dem Titel „Fassaden-Konfigurator“.

**Gültig für** (Element / Typ / Etage / Fassade) ist oben in der rechten Toolbar sticky.

### Paneele abwechselnd

Checkbox **Abwechselnde Ebenen** (`panel.alternateFloors`): nur bei Muster **Streifen**. Zwei Blöcke **Ebene 1** / **Ebene 2** (`#studio-alternate-layers`) mit je Vorstand, Bossen-Vorstand und Bossenprofil. Siehe Abschnitt „Abwechselnde Paneel-Ebenen“.

### Animation / Tageszyklus

Unter **Szene → Animation** (v2.0.130):

- **Animationen pausieren** — Master-Stop für Blaulicht-Blinken, Fenster-/Tür-Abspielen, Rollläden-Lauf und Tageszyklus.
- **Tageszyklus** — Uhrzeit und Sonne laufen kontinuierlich (Default an).
- **Tagesdauer (Min.)** — Echtzeit-Minuten für einen Szene-Tag (`dayCycleRealMinutes`, Default **60** = 1 Stunde). Bereich 1…1440.
- **Lichter mit Sonne** — bei Sonnenuntergang Bibliotheks-Lichter an, bei Sonnenaufgang aus (Default an; kein Undo-Eintrag; soft mit Fade, v2.0.150). **Uhrzeiten** pro Licht parallel (`desiredOn = Sonne-Nacht || Schedule`). Öffnungen/Rollläden nur Schedule.

Der frühere einmalige **Tagesverlauf abspielen** (Himmelsrichtung/Uhrzeit-Kanäle) ist entfernt.

### Bühnenmodus (v2.0.132 / v2.0.133)

URL-Parameter **`?stage=1`** (oder `?view=stage`): nur die 3D-Zeichenfläche, der **Tageszeit**-Slider und **Animationen pausieren** — fürs Handy im lokalen Netz. Bloom ist an. Start: `npm run dev:lan`, dann `http://<LAN-IP>:5173/?stage=1`.

---

## Ausrichtungs-Hilfslinien

### Platzierungs-Raster (v2.0.89 / v0.7.184)

Beim **Verschieben oder Platzieren** von Wänden und Öffnungen erscheint ein blaues Raster (`src/studio/placementGrid.ts`):

- **Wand aus Bibliothek / Wand verschieben:** **32-cm**-Gitter auf dem **Boden** der Ziel-Etage (Oben, 2D, 3D) — unverändert `STUDIO_TILE`.
- **Öffnung verschieben (v2.0.89):** Gitter auf der **Zielwand** = **Stoßfugen und Schichtgrenzen** des Paneels/Mauerwerks (`wallFaceGridXs` / `wallFaceGridYs`, gleiche Cuts wie `openingPanelSnap`). Streifen: nur Laibungen vertikal; ohne Modul: 32 cm.
- Nach **Ablegen** oder Abbruch wird das Raster ausgeblendet (`clearPlacementGridOverlay`).
- Öffnungs-**Position** (Drag, Nudge, Zahlenfelder): bei Modulverband Drag = Fuge + Wandmitte; Nudge = Fuge / Steinmitte / Wandmitte, Schrittweite **8·n** cm (Numpad 1–9); bei Zwei-Bändern je Zone Y-bewusst; sonst **8 cm**. Schrift-Position bleibt 32 cm.
- **Orangene Drag-Vorschau:** unter `siteOffset` (dreht mit dem Haus); bei Breiten-/Höhen-Snap wird der Ghost neu gebaut.

### Öffnungen (`src/studio/openingGuides.ts`)

Während Drag von Öffnungen:

- Toleranz **0,5 cm** (Anzeige); Snap der Position **32 cm**.
- **Eigene Hilfslinien** des verschobenen Elements (links/rechts/Mitte, oben/unten) immer sichtbar — vertikal und horizontal, dezentes Cyan.
- **Ausrichtung** an anderen Öffnungen: alle Kanten und Mitten (cyan/orange), auch **über Wandgrenzen** auf derselben Etage (vertikal im Aufriss).
- **Wand-Referenzen** bei Annäherung: **1/4, 1/3, 1/2, 2/3, 3/4** der Wandbreite bzw. -höhe (orange).
- Linien spannen weit über die Fassade (Boden–Himmel / volle Aufrissbreite).
- Mehrfachauswahl: Hilfslinien aller verschobenen Öffnungen (je Wand).
- **Abstandslinien** (v2.0.20): gelbe Maßlinien mit Endstrichen und cm-Label zum nächsten Objekt in vier Richtungen (links, rechts, oben, unten) — Wandkante oder Nachbar-Öffnung; horizontal ggf. über Wandgrenzen im Aufriss (`elevationX`, nur SVG).
- 3D: `depthTest: false`; SVG: gestrichelte Linien im Aufriss. Nach Drop entfernt.

### Wände (`src/studio/wallGuides.ts`, v0.7.156 / v2.0.140)

Beim **Verschieben** und **Zeichnen/Abzweigen** von Studio-Wänden: Hilfslinien für **Start-, End- und Mittelpunkt** (Plan X/Z), Ausrichtung an anderen Wänden derselben Etage (Toleranz `WALL_GUIDE_SNAP_CM` = 4 cm). Abzweig (Shift) und Bibliothek-Ghost: freies Ende snappt bündig (`snapPointToWallEdges` / `computeSegmentAlignGuides`). Grundriss: `floorPlanView.showWallMoveGuides`.

### Wandsegment herauslösen (`src/studio/wallSplit.ts`, v2.0.142)

**Nutzer:** Tab **Wände**, **nichts markiert**, eine Breite-Karte anklicken (48 … 576). In **3D** und **2D-Front** zeigt Hover über einer Studio-Wand ein **oranges Segment** dieser Breite (volle Höhe, mit Schnittkanten in `0xff5500`) — auf **allen Etagen** mit gleichem Fußabdruck (gleicher Ursprung + Richtung, `wallSplitStack` = `findVerticalAlignedWalls` ohne 180°-Gegenrichtung). Statuszeile: „Klick: Segment 96 cm herauslösen (2 Etagen)“. Klick teilt jede Etage in `links | Segment | rechts` (bis zu drei kollineare, `planLinked` Wände); das Mittelstück der getroffenen Etage ist danach **ausgewählt** → **Links/Rechts ±** verlängert es (Stapel folgt über `stretchStudioFacade`), Paneele/Farben/Gesims gelten nur für dieses Stück (andere Etagen per Shift dazu wählen oder Gültig-für „Etage/Fassade“).

**Raster:** Segment liegt mittig unter dem Cursor, gerastet auf `wallWidthStepCm(yaw)` (48 cm, 45°: Diagonale) und in die Wand geklemmt (`wallSplitRangeAt`). Segment = ganze Wand → „nichts zu teilen“. Reststücke unter 48 cm, Erker- und Endstück-Wände (`isProtectedFromPoseReverse`) → kein Split, Hinweis in der Statuszeile. Schmalere Etagen, in die das Segment nicht passt, bleiben unverändert.

**Öffnungen** bleiben in Weltlage: `splitStudioWallAt` partitioniert nach Mittelpunkt und rechnet `opening.x` auf das jeweilige Stück um; Profile folgen über `openingId`. Stil (`panel`, Farben, Gesims, `panelFlip`) wird per `cloneWall` geerbt; das linke Stück behält die alte Wand-ID (Mittelstück bei Segment am Wandanfang ebenfalls).

**Modus** (`wallSplitModeActive` in `main.ts`): `libraryTab === 'walls'` ∧ `armedLibraryWallPresetId` mit Länge (kein Endstück) ∧ keine Wand-/Öffnungs-/Licht-Auswahl ∧ Ansicht 3D/Front ∧ Gebäude editierbar. Hover in `pointermove` (nur ohne gedrückte Taste, `updateWallSplitHover` → `wallDockGhostGroup`), Klick in `pointerdown` **vor** der normalen Wand-Auswahl (`tryWallSplitAtEvent` → `splitWallStackRange` → `finalizeStudioGeometry` → `commitState`). Marker verschwindet bei Auswahl, Tabwechsel, „Keines“, `pointerleave`. Draft-Modus „Segment tauschen“ (`trySwapDraftWallSegmentAtClick`) bleibt unverändert — der braucht eine bereits markierte Wand. Tests: `src/studio/wallSplit.test.ts`.

**Bibliothek-Karte (v2.0.143):** Die angeklickte Breite-Karte ist **schwarz umrandet** (`library-card-applied`/`active`, auch ohne Auswahl — `isLibraryCardApplied` prüft `armedLibraryWallPresetId` zuerst); die Karte bleibt gleichzeitig ziehbar (Greifer-Cursor).

#### Segment extrudieren (blauer Front-Pfeil, v2.0.143)

Der Front-Pfeil eines markierten Segments verschiebt **nur die Auswahl (+ Etagen-Stapel)** — nicht mehr die kollineare Flucht (`offsetStudioWallsAlongFront(..., { collinear: false, returnWalls: true })`, `frontMoveSeedIds` = markierte Studio-Wände). Wo ein bewegtes Wandende **nur kollineare** Nachbarn hat (kein Nachbar mit Achsanteil in Front-Richtung), entsteht automatisch eine **Rückwand** (`buildReturnWall`): 90° von der alten zur neuen Ecke, Breite = Verschiebung, Stil der bewegten Wand, `planLinked`, Außenseite zeigt vom Segment weg. Beim nächsten Ziehen werden diese Rückwände wie 90°-Nachbarn **gestreckt** (kein Duplikat). Shift = nur aktuelle Etage (wie bisher). Tests: `wallResize.test.ts` („extrudiert ein Mittelsegment“).

**v2.0.144 — Gehrung/Verbund:** Die Gehrungs-Vorzeichen (`miterInsetAgainstNeighbor`) hängen von der **Laufrichtung** im Ring ab, nicht von `panelFlip`. Rückwände übernehmen deshalb `panelFlip` der bewegten Wand und werden **ring-konsistent** orientiert: am Segment-**Start** alte → neue Ecke, am Segment-**Ende** neue → alte Ecke (Auswahl über „Außenseite zeigt vom Segment weg“ — ergibt dieselbe Richtung). Vorher lief die rechte Rückwand gegen den Ring → Gehrung an zwei Ecken gespiegelt, Front wirkte um die Wandstärke versetzt. **Zurückschieben:** Fällt eine Rückwand (ohne Öffnungen) beim Fixen auf 0 cm, wird sie **entfernt** statt stehen zu bleiben (`poseWallEndAt` lieferte `null` → Seitenwände blieben, nur die Front wanderte). Weiter nach innen geschoben kippt die Rückwand (Yaw +180°) und bildet eine **Nische**, Außenseite zeigt in die Nische.

#### „Wand verknüpfen“ auf Segmenten (Rechtsklick, v2.0.143)

Kontextmenü einer Wand: Sind kollinear angedockte Stücke vorhanden (`canMergeWallSegments`), zeigt **Wand verknüpfen** und verschmilzt sie zu **einer Wandgeometrie ohne Schnitte** (`mergeWallSegments` → `mergeCollinearDockedWalls`, `finalizeStudioGeometry`). Regeln (`mergeWallSegmentCandidates`): **ein** markiertes Segment → ganze kollineare Kette an beiden Enden (`collinearChainFromEnd`); **mehrere** markierte → nur die Auswahl. Immer inklusive **Etagen-Stapel** (`wallSplitStack`). Öffnungen wandern mit korrektem `x` in die Zielwand, der behaltene Seed behält seine ID und bleibt ausgewählt. Das bisherige „Wand verknüpfen“ (planLinked-Dock mit Stil-Abfrage) erscheint nur noch, wenn es nichts zu verschmelzen gibt.

#### Greifer + Shift entlang der Achse (v2.0.143)

Links/Rechts-Greifer eines Segments zwischen zwei Wänden: ohne Shift streckt das Segment und der Nachbar wird kürzer (`stretchStudioFacade` → `translateStudioCorner`). **Shift + Ziehen entlang der Wandachse** streckt das Segment (+ Stapel) und **rückt alles jenseits dieses Wandendes mit** (`shiftWallsBeyondEnd`): Wände komplett hinter der Ebene am Wandende werden um Δ verschoben (auch Ecken/Rückwände, alle Etagen), **parallele** Wände, die die Ebene kreuzen (z. B. die Rückwand des Grundrisses), werden am jenseitigen Ende gestreckt/gekürzt; schräge Kreuzer bleiben. Raster wie ohne Shift (`clampWallResizeDelta`). Shift + **schräg** ziehen bleibt „neue Wand 45°/90°“ (`snapBranchYawDeg`). Statuszeile: „Shift: Segment +48 cm, Folgewände rücken mit“. Tests: `wallSplit.test.ts` („shiftWallsBeyondEnd“).

### Grundriss zeichnen (v0.7.240)

Während eine Wandlinie gezogen wird (`floorPlanDrawPreview`): orangene Hilfslinien, sobald Cursor-X oder -Z mit einem anderen Plan-Knoten oder Wandende bündig ist (`collectPlanDrawGuides`, `floorPlanView.showAlignGuides`). Der Startpunkt der aktuellen Linie zählt nicht als Treffer.

---

## Profile

Built-ins, Achsen, Custom-IDs: [profiles.md](profiles.md).

---

## Fensterbänke

Nur Fenster (`#window-sill-section`). Innenbrett / Außenbrett oder -profil, Überstand, Orientierung: [opening-features.md](opening-features.md#fensterbänke).

---

## Öffnungen: Maße, Blendrahmen, Wand/Nische, Rundbogen

Toolbar-Maße, Fake-Einbettung, Freiraum, Bogenformen, Keilsteine, Konche/Cutout: [opening-features.md](opening-features.md#maße-einbettung-freiraum-bogen).

## Sockel und Gesims

Feldkatalog, Sweep, UI-IDs: [wall-decor.md](wall-decor.md). Kurz: Sockelhöhe 8 cm, Tiefe/Versatz 1 cm; Gesims nur oben, Tiefe = `sectionScaleForward` (4-cm-Schritte).

---

## Rechte Seitenleiste

Struktur bei Wandauswahl: Wand → Sockel → Gesims → Fenstertiefe → Paneele (Paneele/Mauerwerk-Kacheln, darunter Bossensteine und Fugen). Bei Öffnungen: **Fensterteilung** (inkl. **Sprossen** ohne Feld-Auswahl) → **Rahmenprofil** …

### Toolbar-Layout (v0.7.14)

- **Abstände:** Label→Feld `4px` (`.toolbar-group` gap; `.toolbar-label` ohne Extra-Margin); Abstand oberhalb einer Gruppe/Sektion `1.5rem` (erstes Kind ausgenommen).
- **Register (Auswahl):** unten horizontale Tabs (`#selection-bottom-tabs`); rechts nur die aktive Sektion — **Ausnahme Fenster/Tür:** `#toolbar-opening` zeigt alle Sektionen ohne Tabs.
- **Labels:** Jedes Eingabefeld und jede Farbgruppe hat eine eigene `.toolbar-label`-Zeile (z. B. „Horizontal (cm)“, „Verdachungsfarbe“).
- **Hinweise:** Erklärungstexte an Slider, Feldern und Dropdowns als rundes **i**-Icon hinter dem Label; Text nur bei Hover/Fokus auf dem Icon (`.field-info`, Tipp `.field-info-tip`). Abschnitts-Hinweise ohne zugehöriges Feld (z. B. Zierbänder-Intro) bleiben grauer Text. Status-/Fehlerzeilen (Validierung, Dach-Hinweis, Animation-Status) bleiben sichtbarer Text. `.toolbar-hint` im Markup bleibt im DOM (`hidden`), damit IDs weiter funktionieren.
- **Gültig für:** Label links neben den Scope-Buttons (eine Zeile).
- **Undo/Redo:** `#history-toolbar` ohne Hintergrund — nur die beiden Buttons.
- **Kompass:** Klick/Drehen aktualisiert die Nadel sofort in 2D und Zeichnung (`updateViewCompass` in `setCompassYaw` / `applyElevation`).

### Paneele vs. Mauerwerk

UI: `#studio-pattern-panel-cards` (Streifen, Läuferverband) und `#studio-pattern-masonry-cards` (Blockverband, Kopfverband, Kreuzverband, Wilde/Gotische/Märkische/Holländische/Schlesische/Flämische Verbände, Läufer-Varianten). Jede Kachel zeigt eine SVG-Kontur-Vorschau (`drawPatternPreviewSvg`), gebaut erst wenn die Studio- bzw. Dach-Toolbar sichtbar ist (nicht beim App-Start). Layout: `src/studio/panelLayout.ts`, Typen in `StudioPanelPattern`. **v0.7.280:** wie 73dbdc9 an der Außenkante (Fit folgt der Planrichtung). **v0.7.279:** Verknüpfte Wände mit Innen-Origin werden beim Laden auf die Außenkante gelegt — sonst fehlen an 90°-Ecken 32–40 cm Vertikalfugen (Gehrung). **v0.7.278:** Raster auf der Außenfront inkl. Keilzone (`wallX` darf < 0); 0,5/1 von der Außenecke. **v0.7.270:** Paneele gehren an andockenden Wänden. **v0.7.269:** 45°-Endsteine 0,5/1 auf der Front, dazwischen Läuferverband. **v0.7.296:** 0,5/1 an 45°-Ecken bleibt nach Etage duplizieren / Stile kopieren gleich (nicht mehr per neuer Wand-ID gekippt).

**v2.0.72 — Zwei Bänder:** Checkbox `#studio-cladding-two-bands` teilt die Verkleidung horizontal (`claddingZones` `band-lower`/`band-upper`). Felder Höhe/Modulbreiten in `#studio-cladding-two-bands-options` nur sichtbar wenn an; einfache `#studio-panel-width-row` dann ausgeblendet. Details: [facade-layers.md](facade-layers.md).

---

## Fensterflügel

Flügel und Türen öffnen **immer nach innen** (`LEAF_OPEN_INWARD` in `gruenderzeit.ts`). Kein UI für Außenöffnung.

Ruhewinkel: Slider **Einzeln öffnen** (`leafOpenDeg` / `transomOpenDeg`). Zeitliche Bewegung: Reiter **Animation** — getrennte Kurven für Öffnen und Schließen, Vorlagen Fenster/Haustür/Linear, SVG-Punkteeditor, Abspielen, JSON-Datensatz. Details und das Format zum Wiederverwenden: [opening-motion.md](opening-motion.md).

### Rollläden (v0.7.177)

Reiter **Rollläden** bei Fenster/Tür **immer** sichtbar; Checkbox standardmäßig aus. Nur Lamellen, kein Kasten und keine Schienen. Höhe `drop` 0…1; freier Spalt bis die unterste Lamelle die Bank berührt, danach Stapel; volle Laibungsbreite; lichtdicht. Details: [roller-shutter.md](roller-shutter.md).

---

## Standardfarben

Neue Elemente: Wand, Paneele, Profile, Rahmen, Türen → `#ffffff`. Neue Fenster/Türen: **physisches Glas** (`glassMode: 'physical'`, IOR 1,52, Transmission 0, dunkles Klarglas plus Szenen-EnvMap). Alt-Saves: Hydrate setzt unveränderte Defaults nach (Klarglas-Transmission 0,9/0,96/0,42 → 0; Fensterbank 20/32/… → 16 cm). Gespeicherte **abweichende** Nutzerwerte bleiben.

---

## Fenster verschieben

Studio-Öffnungen: rastet an **Fuge**, **Stein-/Paneelmitte** oder **Wandmitte** (`openingPlacementCandidateXs`) — Raster ist das **Verbandmodul** (Läufer: halbe Steinlänge), kein festes 8-cm-Schrittmaß. **Ziehen (v2.0.82):** nur Fugen-bündig + Wandmitte, **immer** der nächste Kandidat (kein Freilauf mehr); Breite so, dass **beide** Laibungen auf Fugen liegen. **Pfeile / Tastatur (v2.0.89):** Standard **8 cm**; Numpad- oder Zifferntaste **1–9 halten** = Vielfaches (3 → 24 cm). Auf Modulverband so viele Kandidaten weiter, bis die Strecke ≥ dem Schritt ist. 45°-Wände: Wandmitte mit Magnet ±8 cm. Streifen/ohne Modul: 8 cm. Abstand **zwischen** Öffnungen 32 cm. Beim Laden älterer Projekte rückt Schema 14 vorhandene Öffnungen einmalig auf dieses Raster.

---

## Eingangstreppe

Nur bei einer Tür (`#door-stairs-section`); Optionen nur wenn an. Maße und Sockel-Clip: [opening-features.md](opening-features.md#eingangstreppe-openingstairs).

---

## Wand verbreitern (links/rechts)

**Greifer (v0.7.213–0.7.226):** An der **äußeren Fassadenkante** erscheinen bei markierten Studio-Wänden Drag-Greifer (`#wall-resize-gizmos`). Klick neben die Wand blendet sie aus. **Links/rechts/oben** nur bei genau einer Wand. **Mitte:** runder Pfeil-Greifer in Front-Richtung (Außennormale). Ist eine **verknüpfte 45°-Wand** nicht mitmarkiert, ist der Greifer grau mit Info-Zeichen; Hover: „Zuerst die verknüpften 45°-Wände markieren“. Nach Mehrfachauswahl der Schrägen: Verschieben nur entlang der Front (48 cm bzw. Diagonale), 90°-Nachbarn strecken am Stoß mit. Die Bibliotheks-+/− (`#wall-library-gizmos`) bleiben im DOM, sind aber ausgeblendet.

**Ziehen:** Ohne Taste: **ein Rasterfeld** entlang der Wandachse (**48 cm** achsparallel, bei **45°** die Diagonale eines 48×48-Feldes ≈ 67,9 cm), damit die Endpunkte auf dem Grundrissgitter bleiben. Mindestlänge/-höhe **48 cm** (`STUDIO_MIN_SIZE`). Beim Verkleinern werden Öffnungen entfernt, die nicht mehr vollständig auf der Wand liegen. Die Wand ändert sich erst, wenn der Greifer wirklich gezogen wird (nicht schon beim Anfassen). **Shift halten:** am Greifer = neue Abzweig-Wand (45°/90°, **v0.7.319** auf allen Etagen mit gleichem Fußabdriff); beim **Verschieben** der Wand = nur die aktuelle Etage (ohne Shift ziehen gleiche Wände auf allen Etagen mit, auch bei unterschiedlicher Breite; Grundriss/Decke folgen). Kommt das freie Ende wieder am **Ausgangspunkt** oder an einer **anderen Wand** an (Magnet ein Rasterschritt entlang des Strahls), schließt sich der Grundrisspfad: Endpunkte fallen zusammen, **Gehrung** wie an den anderen Ecken. **v2.0.137:** Bei 45°-Abzweigen gilt eine größere Quer-Toleranz (~24 cm) am Strahl; der Endpunkt wird auf die Ziel-Ecke gezogen (leichter Yaw-Ausgleich), damit kein sichtbarer Versatz bleibt. Achsparallele Stoßpunkte bleiben bei 2 cm. Trifft der Strahl die **Mitte** einer anderen Wand, wird diese geteilt (T-Stoß, beide Stücke mindestens 48 cm). Paneele/Sockel bleiben auf derselben **Außenseite** wie die Kette (`along × outward`); am freien Start endet die neue Wand an der Fuge (v0.7.221). **Bestehende** falsch gedrehte Abzweig-Wände (zwei Starts an einer Ecke) werden beim nächsten Öffnen des Projekts nachgezogen (v0.7.222, Schema 11). **Gehrung** an der Ecke wie ein Bilderrahmen (45° und 90°). Höhe: **24 cm** pro Etage. Bodenraster 48 cm beim Ziehen.

`stretchStudioFacade` + `translateStudioCorner` in `src/studio/walls.ts` verlängert die gewählte Wand; **alle Wand-Endpunkte an der bewegten Ecke** (alle Etagen) werden mitverschoben, Gehrungen via `finalizeStudioGeometry` neu berechnet. Keine Lücken an verbundenen Wänden.

---

## Grundriss bearbeiten (Verschieben)

Modus **Bearbeiten** im Grundriss:

| Ziel | Aktion |
|---|---|
| **Punkt** | Anklicken und auf Gitter ziehen → beim Loslassen `commitState` über `movePlanCornerInState` (Ecke auf **allen Etagen**, 3D/2D/SVG synchron) |
| **Wand (Kante)** | Anklicken (selektiert zugehörige 3D-Wand) und ziehen → beide Endpunkte als Segment verschoben (`movePlanEdgeInState`) |
| **Entf** | Knoten oder Kante löschen |

Während des Ziehens: Vorschau im Plan (`previewPlanNodeMove` / `previewPlanEdgeMove`). Kantenwinkel bleiben 0°/45°/90° (`canMovePlanNode`). Implementierung: `src/studio/planGeometry.ts`.

---

## Glasfarbe und Spiegelung

Swatch `transparent` (`TRANSPARENT_GLASS`) macht Klarverglasung. 3D-Glas (`applyGlassLook`): Opacity ~0,28, `envMapIntensity` ~2,45, sehr niedrige Rauheit — Umgebungsreflexion aus `RoomEnvironment`. `transmission` bleibt 0 (Shadow-Map). Siehe [shadows.md](shadows.md).


## Ebenen-Baum (Multi-Haus)

- `FacadeState.buildings[]` + `activeBuildingId`; Legacy-Saves werden beim Laden in ein Gebäude „Haus 1“ migriert (`migrateToBuildings`).
- Ebenen-Liste: **Lichter** (Szene, aufklappbar) → **Haus** → **Dach** (Sektion, aufklappbar) → **Geschosse** → **Decke / Boden** / Wände / Öffnungen / **Treppe** (Unterzeile unter Tür).
- **Lichter:** Alle platzierten Punktlichter (`FacadeState.sceneLights`) als eigene Sektion oben im Ebenenbaum. Namen nach Art + Nummer (`Blaulicht 2`, `Laterne`, …). **Shift+Klick** Mehrfachauswahl → Mehr-Menü **Gruppieren** (persistente `sceneLightGroups`). Gruppenzeile wählt alle Mitglieder; Mehr-Menü: ein-/ausblenden, umbenennen, auflösen. Pro Licht: Klick wählt (`selectedSceneLightId` / `selectedSceneLightIds`), Mehr-Menü **Ausblenden/Einblenden** (`enabled`), **Duplizieren**, **Licht entfernen**. Sektions-Mehr-Menü: **Punktlicht einfügen**, **Alle Lichter an/aus**. Globaler Toggle auch unter Bibliothek → Licht und Szene → Licht. Ausgeschaltete Lichter gedimmt (`.layer-dimmed`).
- Zeilen-Labels: nur **Typ** (`Wand`, `Fenster`, `Tür`, `Treppe`, `Decke / Boden`, `Dach`, `Ziegel`, `Rinne`) + **Meta** (Breite in cm oder Stufenanzahl). Keine Himmelsrichtung, kein Fenstermodell-String, keine x/y-Position. **v2.0.140:** Wand-/Öffnungs-Maße in den Ebenen aktualisieren **live** beim Ziehen (`syncLiveLayerListMetrics`).
- Haus-Zeile: Klick **aktiviert** das Haus und setzt `selectedBuildingId` (Grundriss-Umriss orange). Mehr-Menü: **Neues Haus**, **Nur weiße Wände** / **Fassade einblenden** (`Building.bareWalls`), Umbenennen, Ausblenden, **Duplizieren** (Ost/West/Nord/Süd), Löschen (mind. ein Haus). Bei `bareWalls` zeigt die Hauszeile „· nur Wände“; 3D/2D nur weiße Vollwände (keine Öffnungen/Mauerwerk/Profile/Dach/Decken), Projektdaten unverändert.
- **Decke / Boden** pro Geschoss: Zeile wie Wand (`selectedCeiling`, Toolbar `#toolbar-ceiling`, Farbe `FloorPlan.ceilingColor`, Default **Weiß** `#ffffff`). Farbe auch im Wand-Reiter **Farben**. **v0.7.227:** per Klick auf die Decke in 3D auswählbar. Mehr-Menü: Ein-/Ausblenden (`FloorPlan.showCeiling`). Alte braune Defaults (`#9a8a7a` / `#8a7a6a`) werden beim Laden weiß (Schema 13), eigene Farben bleiben.
- **Dach**: Sektion wie Geschoss (`expandedRoofs`, `selectedRoofPart`: `group` | `shell` | `tiles` | `gutter`). Toolbar zeigt bei Teilwahl nur passenden Abschnitt.
- Mehr-Menü **Ausblenden/Einblenden** für Haus, Geschoss, Wand, Öffnung, Dach (`RoofConfig.hidden`). Ausgeblendete Einträge gedimmt (`.layer-dimmed`).
- **Neues Haus**: Haus-Mehr-Menü und `#building-add` in der Grundriss-Toolbar — leeres Gebäude neben bestehenden (Gitter-Offset +X).
- **Haus verschieben** (Grundriss, Navigate/Edit): bei selektiertem Haus Ziehen innerhalb der AABB; Hilfslinien (`buildingGuides.ts`) an Nachbar-Häusern; andere Häuser im Plan gedimmt.
- **Viewport Multi-Haus:** Untergrund und Plan-Zentrum (`sitePlanBounds`) umfassen alle sichtbaren Häuser; Grundriss-Zoom-Minimum skaliert mit Fläche/Hausanzahl; 3D-`maxDistance` und `camera.far` wachsen mit Site-Radius; Plan-Ortho near/far eng um Overlay-Höhe (kein Clipping beim Rauszoomen).

## Wand-Toolbar (Reihenfolge)

1. Maße/Farben → 2. Gesims → 3. **Zierbänder** → 4. Paneele (Fugen + Bossen) → 5. Sockel → 6. Schrift.
- **Fenster-/Türtiefe** nur in der Öffnungs-Toolbar (`#opening-window-depth-offset`).

Zierbänder (Pflicht-Referenz): [wall-decor.md](wall-decor.md). Nicht ohne Nutzeranweisung entfernen (`.cursor/rules/keine-ui-loeschen.mdc`).

## Wand-Andocken, Bibliothek und Erker

Andocken, lösen, Etage darüber, Ghost-Platzierung: Abschnitte oben („Wände andocken…“). Erker/Balkon/Loggia: [bay-windows.md](bay-windows.md). Bibliothek-Tabs und Galerie: [gallery.md](gallery.md).

## Fugen, Schrift, Bibliothek-D&D, Pick (Kurz)

- **Fugenfarbe:** `panel.jointColor`, Default `#c8c0b8`; UI `#joint-color-swatches-studio` sobald Paneele an; Tiefe-Block nur bei `joint > 0`.
- **Schrift speichern:** ändert nur Text/`enabled` (Position bleibt). Drag/X/Y auf 8-cm-Raster. Schriften: [fonts.md](fonts.md).
- **Bibliothek-DnD:** Ghost 50 % opacity; Raster an Dock-Zielen; kollinear → `mergeCollinearDockedWalls`.
- **3D-Pick:** nächste Fassadenebene gewinnt (keine Auswahl durch Öffnung hindurch). Cursor Pfeil; Greifer nur an `.wall-resize-grip`.
- **Glas-Default:** neue Öffnungen `glassMode: 'tint'`.
