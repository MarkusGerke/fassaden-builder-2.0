# Änderungsprotokoll

Historische Release-Notizen der Architektur/Features. Nutzer-Release-Notes: `src/version.ts` (`RELEASES`). Aktuelle Feature-Docs: [README.md](README.md).

### Punktlicht-Oklusion (2026-09-01) — v2.0.34

Bibliotheks-Punktlichter: Cube-Shadows in **2D-Front** und **3D** (Render + „Schatten werfen“). Öffnungs-Tunnel, Rahmen/Sprossen und Wandkörper blockieren Licht nach außen; Shadow-Map bei Verschieben. Dateien: `sceneLightRuntime.ts`, `FacadeController.ts`, `main.ts`, Docs.

### Punktlicht in 2D bearbeiten (2026-09-01) — v2.0.33

2D-Front: Drag auf der **Blick-Ebene** (Tiefe bleibt während Ziehens fix); Slider **Tiefe (Blickrichtung)** verschiebt vor/zurück entlang der aktuellen Kamera. Rechtsklick auf die Quelle → **Licht entfernen** (kein Pan). Dateien: `main.ts`, `index.html`, Docs.

### 3D-Ansicht wieder verfügbar (2026-09-01) — v2.0.32

Button **3D** wieder sichtbar; OrbitControls und Scene-Light-Drag wie in 1.x. Start-Default bleibt 2D-Front + Render; gespeicherte `view: '3d'` wird beim Reload wiederhergestellt. Erzwungener `currentView = 'front'`-Override nach `loadInitialState` entfernt. Oben/Entwurf/Galerie/Einfach-Komplex bleiben `hidden`. Dateien: `index.html`, `main.ts`, `version.ts`, Docs.

### Punktlicht aus Bibliothek (2026-09-01) — v2.0.31

**Ursache:** `migrateToBuildings` in `clampFacadeState` hat `sceneLights` nicht übernommen — jedes Einfügen/Drag ging beim nächsten State-Update verloren.

**Fix:** `sceneLights` in beiden Return-Pfaden von `migrateToBuildings`; Drag-Platzierung per `siteOffset.worldToLocal`; größere Marker-Kugel; `selectedSceneLightId` beim Laden persistieren. Dateien: `utils/buildings.ts`, `main.ts`, `lighting/sceneLightRuntime.ts`, `utils/persistence.ts`.

### Grauer Viewport / Haus unsichtbar (2026-09-01) — v2.0.30

**Hauptursache:** In v2.0.29 wurde `isPerfOverlayEnabled()` in `animate()` verwendet, aber der Import aus `perfOverlay.ts` fehlte → `ReferenceError` bei jedem Animationsframe, kein `renderer.render()`, transparenter Canvas (grauer CSS-Hintergrund).

**Zusätzlich:** Startup-Race abgesichert — `await sceneLightingBootstrap` vor Animationsloop; `sceneLightingReady`-Flag verhindert Dirty-Skip bis Bootstrap fertig; `dismissAppLoading` markiert Viewport erneut dirty. Dateien: `main.ts`, `ui/perfOverlay.ts`, `version.ts`, Docs.

### Punktlicht platzieren & verschieben (2026-09-01) — v2.0.28

Drag-and-Drop aus Bibliothek, Klick-Platzierung, 3D-Drag zum Verschieben, größere Pick-Kugel. Dateien: `sceneLightRuntime.ts`, `main.ts`.

### Bibliotheks-Lichter & UI-Fixes (2026-09-01) — v2.0.27

Bibliothek Tab „Licht“: platzierbare Punktlichter (`sceneLights` in `FacadeState`), Runtime in `sceneLightRuntime.ts`, XYZ/Intensität in `#toolbar-scene-light`. Scroll-Fix rechte Sidebar (`#scene-toolbar-panels`, `#selection-toolbar-panels`). Debug-Overlay größer. Bloom in 3D (alle Darstellungsmodi außer Linien). Dateien: `scene/sceneLights.ts`, `lighting/sceneLightRuntime.ts`, `main.ts`, `index.html`, `style.css`.

### Punktlichter sichtbar (2026-09-01) — v2.0.26

Fix: Punktlichter zu schwach / nur Render / falsche Position (jetzt `siteOffset`, Solar-Nacht). Leuchtende Marker-Kugeln, Vorschau+Render in 3D. Dateien: `scenePointLights.ts`, `main.ts`.

### Punktlichter & Tageszeit 23:59 (2026-09-01) — v2.0.25

Render-Modus 3D: warmes Innen- und kühles Außen-Punktlicht (`scenePointLights.ts`, angelehnt an three.js `webgl_shadowmap_pointlight`, MIT) — Intensität/Schatten nachts hoch, tags gedimmt. Tageszeit-Slider 0:00–23:59 in Minutenschritten. Dateien: `main.ts`, `sunLighting.ts`, `celestialSky.ts`, `index.html`, Tests, Docs.

### Eingangstreppe empfängt Schatten (2026-09-01) — v2.0.24

Eingangstreppe: `receiveShadow = true` in 3D (Selbst-/Werfschatten auf Stufen); Material `shadowSide: FrontSide` gegen Acne bei `DoubleSide`. Sync über `syncLabelShadowReceivers`. Dateien: `FacadeController.ts`, `docs/shadows.md`.

### Fenstertiefe pro Öffnung (2026-09-01) — v2.0.23

UI „Frontlage (cm von Außenkante)“ unter Öffnung → Maße: speichert `Opening.depthOffset` pro Fenster/Tür (Gültigkeitsbereich beachten). Anzeige als effektive Tiefe (`openingDepth.ts`); Button „Gebäude-Standard“ löscht Override. Dateien: `openingDepth.ts`, `main.ts`, `index.html`, Tests, Docs.

### Konche-Dekor, Keller-Auswahl, Fassadenfarbe (2026-09-01) — v2.0.22

Konche: Fensterbank, Profile, Verdachung in UI und Render (3D/SVG) wie bei Fenstern — `openingLacksWindowChrome` nur noch für `cutout`. Kellerfenster: `filterOpeningRefsByBasementParity` in `editOpeningTargets`/`editArchOpeningTargets`; Auswahl-Scope nur markierte Öffnungen. Wandfarbe-Swatch setzt `wallColor` und `claddingColor` gemeinsam. Dateien: `openingGeometry.ts`, `editScope.ts`, `main.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, `profilePaths.ts`, Tests, Docs.

### 2D-Navigation schneller & animierter Doppelklick-Zoom (2026-09-01) — v2.0.21

Zoom/Pan in 2D-Front und Oben-Ansicht: gecachtes Front-Kamera-Layout (`FrontViewBase`) statt vollständiger Wand-Bounds-Neuberechnung pro Wheel-/Pan-Frame. Oben-Ansicht rendert während Navigation nur noch `renderer.render` (Orbit-Lite), Raster/Bodenplatte erst nach Stillstand. Doppelklick-Zoom animiert weich (~280 ms, ease-out) zum Klickpunkt. Dateien: `main.ts`, `viewZoom.ts`, Tests, Docs.

### Abstandslinien beim Öffnungs-Verschieben (2026-09-01) — v2.0.20

Ergänzung zu den Ausrichtungs-Hilfslinien: gelbe Maßlinien (Endstriche + cm-Text in 2D) zeigen den Abstand zum nächsten Objekt in links/rechts/oben/unten — Wandkante oder Nachbar-Öffnung. Berechnung in `computeOpeningDistanceLines`; Anzeige in `FacadeController` (3D, wand-lokal) und `FacadeSvgView` (2D, inkl. Aufriss-X über Wandgrenzen). Dateien: `openingGuides.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, `main.ts`, Tests, Docs.

### 2D-Zoom flüssig & Doppelklick (2026-09-01) — v2.0.19

Mausrad-Zoom in 2D-Front/Oben: Wheel-Events pro Frame gebündelt, exponentieller Zoom-Faktor (statt fester 0,9-Stufen), `deltaMode`-Normalisierung. Während Zoomen/Pannen Orbit-Lite (Pixelratio 1); Grundriss-Bodenplatte wird erst nach Navigation neu berechnet. Doppelklick zoomt 2× zum Klickpunkt. Hilfsfunktionen in `viewZoom.ts`. Dateien: `main.ts`, `viewZoom.ts`, Tests, Docs.

### Teilen-Link: Szenenfarben & Kompass (2026-09-01) — v2.0.17

Der URL-Hash `#f=` enthält neben `facade` optional `scene` (`SceneAppearance`: Hintergrund, Bodenfarbe, Himmel, Strichstärke) und `viewYaw` (Kompass-/Seitenansicht, 45°-Raster). Alte Links ohne diese Felder behalten Defaults. Encode/Decode in `share.ts`; Laden in `loadInitialState`. Dateien: `share.ts`, `share.test.ts`, `main.ts`, Docs.

### Etagen ohne Sockel/Gesims: einheitliche Fassade (2026-09-01) — v2.0.18

Zwischendecken lagen fälschlich auf Shadow-Layer 0 (Außen-Sonne) und warfen horizontale Schattenstreifen auf die Fassade — wirkte wie Gesims/Sockel, obwohl deaktiviert. Fix: Decken/Böden nur noch auf Layer 1 (`SHADOW_LAYER_INTERIOR`). Beim Etagen-Kopieren ohne Sockel: `plinthHeight` auf 0 (nicht nur `plinthEnabled: false`). Dateien: `FacadeController.ts`, `walls.ts`, Tests, Docs.

### Shift-Mehrfachauswahl im Viewport (2026-09-01) — v2.0.16

In Front- und Oben-Ansicht hat `Shift+LMB` sofort Pan gestartet und die additive Auswahl blockiert. Pan startet jetzt nur noch auf leerem Hintergrund; Treffer auf Wand/Öffnung/Decke laufen in die normale Auswahl (`pointerDown.additive`). Ebenenbaum-Öffnungen nutzen `selectOpening(..., additive)` statt eigener Toggle-Logik. Dateien: `main.ts`.

### Decke bündig mit Wandoberkante (2026-09-01) — v2.0.15

Die Zwischendecke ragte 8 cm über die Wandoberkante (`ExtrudeGeometry` extrudiert nach oben; Mesh-Y lag auf `storeyTopY`). Fix: Decke bei `storeyTopY − INDOOR_SLAB_THICKNESS`, Oberseite bündig mit `wall.y + wall.height` — analog zum Fußboden (`storeyFloorSurfaceY − Dicke`). Dateien: `FacadeController.ts`, Docs.

### Kellerfenster-Teilung & Einstellungen scrollen (2026-09-01) — v2.0.14

Kellerfenster: Reiter **Teilung** war komplett ausgeblendet — jetzt sichtbar mit Grenzen (`clampGruenderzeitForBasement`: max. 2 Flügel, kein OL/Teilung, Sprosse max. 1). Scroll-Fix: `#selection-toolbar` + `.selection-toolbar-panels` mit `min-height: 0` / `overflow-y: auto`. Dateien: `gruenderzeit.ts`, `main.ts`, `openings.ts`, `style.css`.

### Bogenform: Stichmaß beim Wechsel (2026-09-01) — v2.0.13

Beim Formwechsel (z. B. Stichbogen → Rundbogen) wurde `riseCm` der alten Form übernommen. Am Rundbogen ergab das einen zu kleinen Halbkreis in der Mitte statt voller Spannweite. Fix: `commitOpeningArchPatch` setzt Stichmaß bei Formwechsel auf Auto (`defaultArchRise`). Dateien: `main.ts`, `archForms.test.ts`.

### Fensterschatten nach Reload (2026-09-01) — v2.0.12

Startup-Race: `atmosphereSky.load` rief `applySunLighting({ updateShadowMap: true })` auf, bevor `FacadeController.loadMeshes` Fensterrahmen mit `receiveShadow` gesetzt hatte. Nach Reload fehlten Werfschatten im 2D-Aufriss; Sonnenwinkel-Slider hat die Map neu gebacken. Fix: `whenMeshesReady` + `bootstrapSceneLighting()` wartet auf Atmosphäre, Meshes und Schrift-Font, dann ein Shadow-Map-Bake. Dateien: `FacadeController.ts`, `main.ts`.

### Szenenfarben wieder sichtbar (2026-09-01) — v2.0.11

`renderColorControl` band Events nur an neu erzeugte `<input type="color">` — vorgefertigte Szene-Picker in `index.html` blieben stumm. Jetzt `data-color-control-bound`; Live-Vorschau für Szene-Farben; `atmosphereSky.setGroundAlbedo` nutzt Nutzer-Boden statt festem Erdboden-Albedo. Dateien: `main.ts`, `atmosphereSky.ts`.

### Licht-Standardwerte (2026-09-01) — v2.0.10

Neue Defaults in `DEFAULT_SUN_SETTINGS`: Tageszeit 13:15, Sonnenwinkel 210°, Sonnenlicht 3,9, Umgebungslicht 0,53, Schatten-Kontrast 1,50, Weichheit 5,0, Farbtemperatur 4500 K. `applyTodaySunDate` aktualisiert beim Start nur das Datum, nicht mehr den Solar-Look. Dateien: `sunLighting.ts`, `main.ts`, `index.html`, Docs.

### Fensterschatten nach dem Verschieben (2026-09-01) — v2.0.9

Teil-Rebuild (`setState` mit `rebuildBuildingIds`) hat `syncLabelShadowReceivers` / `syncOpeningReceiveShadows` übersprungen. Neue Gründerzeit-Fenster kommen mit `receiveShadow=false` — im 2D-Aufriss fehlten danach Gesims-Schatten auf **allen** Rahmen des Hauses. Dateien: `FacadeController.ts`, `main.ts`.

### Fensterziehen: Schatten nach Platzieren (2026-09-01) — v2.0.8

Beim Commit nach Öffnungs-Zug erzwingt `applyState` Rebuild der betroffenen Gebäude (State war während Drag schon aktualisiert → sonst kein Diff). Schatten-Tunnel und Shadow-Map werden wieder korrekt. Dateien: `main.ts`, `FacadeController.ts`.

### Ziehen: kein stehender Schatten (2026-09-01) — v2.0.7

Beim ersten Zug: Shadow-Map-Refresh (`applySunLighting({ updateShadowMap: true })`), Schatten-Tunnel der Wand ohne `castShadow`. Ursache: `shadowMap.autoUpdate=false` — alte Textur blieb sichtbar. Dateien: `FacadeController.ts`, `main.ts`.

### Drag-Ghost: Form, Füllung, kein Schatten (2026-09-01) — v2.0.6

Ghost-Geometrie über `openingDragGhostWallLocalPoints` (wandzentrierter Lokalraum, gleiche Z wie Fassadenaußenfläche + 48 cm). Füllung `DoubleSide`, Kontur auf derselben Ebene. Versteckte Öffnungs-Meshes: `castShadow` aus. Dateien: `FacadeController.ts`, `panelGeometry.ts`, `liveDrag.ts`.

### Ziehen: Öffnungsmaske ohne Schatten (2026-09-01) — v2.0.5

Drag-Ghost nutzt `openingMaskPolyline` (flache ShapeGeometry) statt 3D-Box — echte Öffnungsform, `castShadow`/`receiveShadow` aus. Datei: `FacadeController.ts`.

### Fensterziehen: nur Umriss (2026-09-01) — v2.0.4

Beim Verschieben werden Fenster-Detail, Profile, Bänke, Verdachung und Laibung ausgeblendet; nur ein orangefarbener Öffnungs-Umriss (`openingDragGhostGroup`) schwebt 48 cm vor der Wand. Loader: nur vollständige Nikolaus-Pfade, fester 720-ms-Takt, nahtloser Loop ohne Eckpunkte. Dateien: `FacadeController.ts`, `index.html`, Docs.

### Fenster schwebt beim Verschieben (2026-09-01) — v2.0.3

Variante „schwebendes Fenster“ ohne Schatten während des Ziehens: `beginOpeningDragMode` schließt beim ersten Zug einmalig Loch + Paneele (`openingDragOmitByWall` / `wallForBodyMesh`), Fenster schwebt 48 cm vor der Außenseite (`OPENING_DRAG_FLOAT_CM`). pointermove weiter nur Mesh-Translation; Schatten erst beim Loslassen. Dateien: `FacadeController.ts`, `main.ts`, `liveDrag.ts`, `constants/presets.ts`, Docs.

### Objekte flüssig verschieben (2026-09-01) — v2.0.2

Ziehen war langsam, weil selbst die 1×/Frame-Live-Vorschau jedes Mal `rebuildBuilding` (Ziegel, CSG-Löcher, Fenster, Profile) ausgeführt hat. Jetzt: während pointermove nur Mesh-Translation (`applyLiveOpeningOffsets` / `applyLiveWallOffsets` / Trim / Label), State ohne Geometrie-Rebuild. Beim Loslassen volles `applyState` (Löcher + Shadow-Map). Klick-Auswahl weiter `applyEditorSelection`. Dateien: `main.ts`, `FacadeController.ts`, `liveDrag.ts`, Docs.

### Farbtemperatur und Schatten-Weichheit wieder wirksam (2026-09-01) — v2.0.1

`#sun-color-temp` färbte das Key-Light nicht: `applyDisplaySunColor` behielt tagsüber die Takram-Transmittance und ignorierte Kelvin. Jetzt immer `kelvinToColor(celestial.lightColorTemp)`. `#sun-softness` wirkte tot: `PCSS_LIGHT_SIZE_UV` als Shader-`#define` (Three.js cached Standard-Programme ohne Chunk-Inhalt) plus Filter `* NEAR_PLANE / z` mit Near 0,002 auf NDC-Tiefe. Fix: Uniform `pcssLightSizeUv` (live ohne Rebuild) und `PCSS_PENUMBRA_SCALE` 8 für Ortho-Maps. Dateien: `atmosphereSky.ts`, `pcssShadows.ts`, `main.ts`, Docs.

### Fassaden-Builder 2.0 (2026-09-01) — v2.0.0

Neues Repo `fassaden-builder-2.0`. UI reduziert: Ebenen, Oben, 3D, Entwurf, Einfach/Komplex, Galerie per `hidden` ausgeblendet (IDs/Wiring bleiben). Standard: 2D-Front + Render-Modus. Performance: `selectWall`/`selectOpening` nutzen `applyEditorSelection` (nur Editor/Selektion, debounced Persistenz, kein `svgView.setState`/Geometrie-Rebuild). Dateien: `index.html`, `main.ts`, `FacadeController.ts`, `version.ts`, `docs/ux.md`, `docs/views-and-state.md`.

### Weichere PCSS-Penumbra (2026-09-01) — v0.7.346

Weniger pixeliges Poisson-Raster: 32 PCSS-Samples (statt 17). Kleine Sites (≤ 2200 cm Spanne): Shadow-Map **8192** px, größere weiter 4096. Dateien: `pcssShadows.ts`, `sunLighting.ts`, Docs.

### Original-PCSS wiederhergestellt (2026-09-01) — v0.7.345

Zurück auf v0.7.314-PCSS: `BasicShadowMap` + Blocker/Penumbra (hart am Kontakt, weicher mit Abstand), Lichtfläche 0,8…28 cm über `#sun-softness`. Heutige 48…420-cm-/Uniform-Experimente entfernt. Fenster: `syncOpeningReceiveShadows` bleibt. Dateien: `pcssShadows.ts`, `facadeShade.ts`, `groundMood.ts`, `main.ts`, Docs.

### Schatten-Weichheit + Fenster in 2D (2026-09-01) — v0.7.344

PCSS wieder mit sichtbarer Weichheit (48…420 cm, `pcssLightSizeUv`-Uniform, live am Slider). Fensterrahmen/Konsolen: `syncOpeningReceiveShadows` folgt Paneele in 2D-Front. Dateien: `pcssShadows.ts`, `FacadeController.ts`, `facadeShade.ts`, `main.ts`, Docs.

### Schatten zurück auf bewährten PCSS-Stand (2026-09-01) — v0.7.343

Heutige Schatten-Experimente (v0.7.331–342) zurückgenommen: klassisches PCSS (`pcssShadows.ts` mit 0,8…28 cm, `PCSS_NEAR_PLANE`), Boden-Umbra (`groundMood.ts` v5), keine `pcssOpeningSoft`/Fenster-Sonderpfade. Sonnen-Slider-Gedrosselung (~90 ms) bleibt. Dateien: `pcssShadows.ts`, `groundMood.ts`, `facadeShade.ts`, `lightingMood.ts`, `main.ts`, `FacadeController.ts`, Docs.

### Fensterschatten wieder mit weicher PCSS (2026-09-01) — v0.7.342

Rahmen/Konsolen empfangen in 2D wieder Shadow-Map (`syncOpeningReceiveShadows`). Gerastert vermieden durch `pcssOpeningSoft` — Mindest-Filter-Penumbra statt hartem Kontakt auf Vorsprung. Dateien: `pcssShadows.ts`, `FacadeController.ts`, Docs.

### Laubschatten weg, Fenster ohne Gerastert, Sonne flüssig (2026-09-01) — v0.7.341

Laubschatten (Gobo, Overlay, UI, Persistenz) entfernt. Fensterrahmen/Konsolen: `receiveShadow=false` wieder — Werfschatten nur auf Paneeeln. Sonnen-Slider/Animation: `applySunLighting({ live: true })` + gedrosselte Shadow-Map (~90 ms), debounced Persistenz. Dateien: `main.ts`, `FacadeController.ts`, `sunLighting.ts`, Docs; gelöscht: `front2dGobo*.ts`, `gobo-foliage.jpg`.

### 2D-Navigation wie 3D (2026-09-01) — v0.7.340

Pan entlang Kamera-rechts/hoch (`frontPanScreenX/Y`) statt Fassaden-Yaw — gleiche Richtung wie OrbitControls. Rechtsklick panen (wie 3D), Pfeiltasten in 2D. Datei: `main.ts`, Docs.

### Laubschatten sichtbar + Fensterschatten weicher (2026-09-01) — v0.7.339

Laubschatten: Gobo-Ebene senkrecht zur Sonne, Shadow-Frustum um Gobo erweitert, sichtbares Multiply-Overlay (`#front-gobo-overlay`, `front2dGoboOverlay.ts`). Fensterrahmen/Konsolen: `uOpeningShade` weicht empfangene Shadow-Map ab; Pediment-Meshes empfangen wie Rahmen. Dateien: `front2dGobo.ts`, `front2dGoboOverlay.ts`, `facadeShade.ts`, `FacadeController.ts`, `main.ts`, `index.html`, `style.css`.

### Laubschatten-Gobo in 2D (2026-09-01) — v0.7.338

Schwarz-Weiß-Baumfoto als unsichtbare Shadow-Maske vor der Fassade (`Front2dGoboController`, `/textures/gobo-foliage.jpg`). Nur 2D + Farbe; Checkbox `#sun-front2d-gobo`, Persistenz `SunSettings.front2dGobo`. Dateien: `front2dGobo.ts`, `main.ts`, `sunLighting.ts`, `index.html`, Docs.

### Fenster-Schatten wie Gesims in 2D (2026-09-01) — v0.7.337

Fensterrahmen hatten `receiveShadow=false` (Schraffur-Schutz v0.7.191). In 2D-Front empfangen Paneele Werfschatten vom Gesims — Rahmen nicht. Fix: `syncOpeningReceiveShadows` folgt `claddingReceiveShadows` (Fenster/GLTF-Casing, ohne Glas). Dateien: `FacadeController.ts`, Docs.

### 2D-Zoom & Export-Slider (2026-09-01) — v0.7.336

**2D:** Ortho-Front mit `frontZoom` / Pan-Offsets; Mausrad zoomt zum Cursor, **⇧**+Ziehen/Mittelmaus verschiebt; Export-Capture weiterhin `fitOnly`. **Export:** `#export-stage` in `#ui-right`, horizontale Leiste (100 % Höhe, scroll/slide). Dateien: `main.ts`, `index.html`, `style.css`, Docs.

### Schatten-Weichheit: live ohne Shader-Rebuild (2026-09-01) — v0.7.335

Slider wirkte träge: jeder Tick baute den Shader-Chunk neu + Scene-Invalidate. Fix: `pcssLightSizeUv`-Uniform, sofortiges `render3dFrame`, debounced Persist. Dateien: `pcssShadows.ts`, `main.ts`.

### PCSS: ein Schatten (hart + weich vereint) (2026-09-01) — v0.7.334

Doppelter Look: korrekter Hard-Shadow + versetzter PCSS-Weichschatten in Lit-Zonen. Fix: bei hardVis≈1 kein PCSS; sonst min(hard, soft). Datei: `pcssShadows.ts`.

### PCSS: harte Umbra am Sockel (2026-09-01) — v0.7.333

Schwebender Bodenschatten trotz v0.7.332: Mindest-Filter + NormalBias + polygonOffset im Shadow-Pass. Fix: harte Umbra am Kontakt, NormalBias 0, Depth-Bias −0,0018, `customDepthMaterial` für Cast mit Offset. Dateien: `pcssShadows.ts`, `sunLighting.ts`, `threeColors.ts`, `main.ts`, `FacadeController.ts`.

### PCSS: Kontakt an Gebäudekante (2026-09-01) — v0.7.332

Schwebender Bodenschatten: Mindest-Filter galt auch am Kontakt; ohne Blocker → fälschlich hell. Fix: Contact-Hardening (`smoothstep`), Hard-Fallback, PCSS-NormalBias max 0,12 cm. Dateien: `pcssShadows.ts`, `sunLighting.ts`, `main.ts`.

### Schatten-Weichheit: live in Render (2026-09-01) — v0.7.331

Slider wirkte tot: UV-Delta-Filter + WebGL-Programm-Cache an Custom-Shadern (facadeShade, groundMood). Fix: `forcePcss` am Slider, Cache-Suffix, sofortige Invalidierung. Dateien: `pcssShadows.ts`, `facadeShade.ts`, `groundMood.ts`, `main.ts`.

### Schatten: ein Pfad + aufgeräumte Slider (2026-09-01) — v0.7.330

Boden hatte PCSS **und** einen zweiten Umbra-Pass (`getShadow` im Boden-Shader) → gemischter Look. Jetzt nur noch Standard-Shadow-Map (PCSS in Render). Slider: Weichheit nur in Render sichtbar; Schatten-Dunkelheit aus UI (Legacy-Persistenz bleibt). Dateien: `groundMood.ts`, `lightingMood.ts`, `main.ts`, `index.html`.

### PCSS: weniger Punkte, weichere Penumbra (2026-09-01) — v0.7.329

Gepunktete Schatten: 17 PCSS-Samples (statt 12), Mindest-Filterradius (42 % der Licht-UV), Penumbra-Skala 5. Slider-Kompatibilität unverändert: Weichheit → PCSS (Render) + Boden-Umbra; Kontrast/Dunkelheit unabhängig. Dateien: `pcssShadows.ts`, Docs.

### PCSS: weiche Schatten sichtbar + schnellerer Start (2026-09-01) — v0.7.328

Ursache harter Look: Lichtfläche/Frustum-UV und Penumbra-Skala zu klein (cm-Szene) → PCSS ≈ Basic. Fix: größere Lichtfläche, Frustum-Cap, korrekte Filter-Skala; Start ohne frühes PCSS/Doppel-Compile. Entwurf/Vorschau weiter hart. Dateien: `pcssShadows.ts`, `main.ts`.

### Entwurf: scharfes Ziegelmuster bei langen Wänden (2026-08-30) — v0.7.327

Ursache: Entwurf-Atlas war auf 1024 px begrenzt und nutzte Mipmaps — je länger die Wand, desto weniger px/cm („Brei“). Fix: Wände in Atlas-Streifen (~3 px/cm, max. 2048 px), ohne Mipmaps. Dateien: `panelAtlas.ts`, `FacadeController.ts`.

### Start: Studio lädt wieder (2026-08-30) — v0.7.326

Falscher Import (`cloneWall` aus `utils/walls` statt `types/facade`) in `wallSegments.ts` verhinderte das Laden der App (Ladeoverlay blieb stehen).

### Entwurf: Auswahl vor Segment-Tausch (2026-08-30) — v0.7.325

Mit bewaffnetem Wand-Preset blockiert der Segment-Tausch die Wandauswahl nicht mehr: erster Klick wählt (Farben/Mauerwerk), erneuter Klick auf die markierte Wand tauscht das Segment. `main.ts`.

### Entwurf: Segment tauschen (2026-08-30) — v0.7.324

Preset wählen + Klick auf Wandabschnitt ersetzt nur dieses Band (Öffnungen/Blank), Breite unverändert — `wallSegments.ts`, `main.ts`.

### Bibliothek: Klick armt, Ziehen platziert (2026-08-30) — v0.7.323

Wand-Bibliothek: Klick **armt** Preset (Erweitern per Greifer); neue Wand nur per **Drag&Drop**. Entwurf-Fenster-Fix in `FacadeController.ts`.

### Entwurf: Preset nur am Anbau (2026-08-30) — v0.7.322

Bibliothek-Preset bei markierter Wand **armt** nur (kein Überschreiben). Greifer: Öffnungen nur im neuen Abschnitt. `main.ts`.

### Entwurf: Öffnungen mit Preset-Greifer (2026-08-30) — v0.7.321

Preset „Wand + Fenster/Tür“ setzt Öffnungen sofort beim Klick auf die markierte Wand und live beim Greifer-Ziehen (ein Fenster/Tür pro Segment). `main.ts`.

### Entwurf: Greifer + Bibliotheks-Segment (2026-08-30) — v0.7.320

Entwurf ohne +/−-Platzierung: Greifer verlängert **eine** Wand in Schritten des gewählten Bibliothek-Presets (`stretchStudioFacade`); ohne Preset freie Länge. Öffnungen aus Preset pro Segment. Dateien: `main.ts`, Docs.

### Etagen mitziehen beim Ziehen und Abzweigen (2026-08-30) — v0.7.319

Verschieben und Front-Greifer: Wände mit gleichem Fußabdriff auf allen Etagen (auch unterschiedliche Breite). 45°/90°-Abzweig und Entwurf-+/− replizieren auf den Etagen darüber. Dateien: `walls.ts`, `main.ts`.

### Entwurf: Wand-Module per Bibliothek (2026-08-30) — v0.7.318

Im Darstellungsmodus **Entwurf**: Wand-Preset in der Bibliothek wählen, an markierter Wand **+/−** setzt feste Module (kein Längen-Greifer). Preset-Wechsel gilt für weitere Platzierungen. Datei: `main.ts`, Docs.

### Entwurf: Fenster mit Rahmen und Sprossen (2026-08-30) — v0.7.317

Entwurf-Modus nutzt Gründerzeit-Fenster statt LOD-Glas-Rechtecke; Atlas-Wand bleibt. Datei: `FacadeController.ts`.

### Darstellungsmodus: Entwurf, Vorschau, Render (2026-08-30) — v0.7.316

Viewport-Umbenennung und dritter expliziter Modus: **Entwurf** (ehem. Leicht), **Vorschau** (ehem. Arbeit), **Render** (volle Geometrie, ehem. implizites „aus“). Drei Buttons, immer einer aktiv; Persistenz `draft`/`preview`/`render` mit Migration von `light`/`work`/`full`. Dateien: `editPresentation.ts`, `main.ts`, `index.html`, Docs.

### Entwurf: Fenster sichtbar (2026-08-30) — v0.7.315

Entwurf-Modus: LOD-Fenster vor der Atlas-Ebene (`studioLightModeWindowOriginZ`), Atlas `depthWrite` aus, Laibungen pausiert. Dateien: `panelAtlas.ts`, `FacadeController.ts`.

### Sonnenschatten PCSS (2026-09-01) — v0.7.314

Sonnen-Shadow-Map: **Percentage-Closer Soft Shadows** statt `PCFSoftShadowMap` — scharf am Okkluder, weicher mit Abstand (Three.js-Beispiel `webgl_shadowmap_pcss`). Slider Schattenweichheit steuert PCSS-Lichtgröße (cm/Frustum), nicht `shadow.radius`. Entwurf/Vorschau: harte `BasicShadowMap` ohne PCSS. Dateien: `pcssShadows.ts`, `main.ts`, `sunLighting.ts`, `docs/shadows.md`.

### Darstellungsmodus Leicht (2026-08-30) — v0.7.313

Dritte Viewport-Option **Leicht** neben Arbeit: Mauerwerk als **eine Canvas-Atlas-Textur** aus `layoutPanelTiles` (gleiche Maße/Muster/Farben), einfache Fenster (LOD-Low), Profil-Balken; harte Schatten, Himmel aus. Arbeit und Voll bleiben unverändert. Dateien: `editPresentation.ts`, `panelAtlas.ts`, `FacadeController.ts`, `main.ts`, `index.html`.

### Neues Haus und nur weiße Wände (2026-08-29) — v0.7.312

Haus-Mehr-Menü (Ebenen): **Neues Haus** neben dem Plan; **Nur weiße Wände** / **Fassade einblenden** (`Building.bareWalls`) — Vollwände weiß ohne Öffnungen, Mauerwerk, Profile, Dach, Decken. Daten bleiben. Dateien: `buildings.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, `main.ts`, `hydrate.ts`.

### Arbeit: einfache Rechtecke, harte Schatten (2026-08-29) — v0.7.311

Mauerwerk nur Rechteck-Quads 2 cm vor der Wand; keine XOR-Wand, kein `clipPolysMinusArches`. Harte Schatten (`BasicShadowMap`, Radius 0, Bloom aus, matte Materialien). Dateien: `panelGeometry.ts`, `main.ts`, `groundMood.ts`, `threeColors.ts`, `FacadeController.ts`.

### Arbeit: geschlossene Mauerwerks-Ebene (2026-08-29) — v0.7.310

Steine + Fugen als Parkettierung auf einer Z-Ebene (keine gestapelten Flächen). Dateien: `panelGeometry.ts`.

### Arbeit: kein Wand-Durchschimmern (2026-08-29) — v0.7.309

Flat-Steine 3 cm vor der Wand, Fugen-Backer in der Wand; Wandaußenfläche nur in Freistreifen. Dateien: `panelGeometry.ts`, `FacadeController.ts`, `pedimentGeometry.ts`.

### Arbeit: Wand/Paneele, Bögen, Himmel (2026-08-29) — v0.7.308

Fenster mit Sprossen behalten; Wandaußenfläche nur in Freistreifen (XOR Paneele); Rundbogen-Clip ohne Restfläche; Profil-Balken flush an Wand; Himmel → Hintergrundfarbe. Dateien: `panelGeometry.ts`, `profilePaths.ts`, `pedimentGeometry.ts`, `FacadeController.ts`, `main.ts`, [performance.md](performance.md).

### Arbeit: flache Fassade (2026-08-29) — v0.7.307

**Arbeit**-Toggle: flache Paneele mit Fugenkontrast und Vertex-Shading, Profile/Gesims/Verdachung als Rechteck-Balken, High-Detail-Rebuild pausiert. Himmel/Bloom/EnvMap unverändert. Dateien: `panelGeometry.ts` (`createStudioPanelFlat*`, `createStudioMortarFlatGeometry`), `profilePaths.ts` (`createSimpleProfileBarGeometry`), `pedimentGeometry.ts`, `FacadeController.ts`, `editPresentation.ts`, `main.ts`, [performance.md](performance.md).

### Arbeitsdarstellung „Arbeit“ (2026-08-29) — v0.7.306

Erste Version (Himmel/Bloom aus, Profile ausblenden) — Verhalten ersetzt durch v0.7.307+.

### Altbau-Fenster-MVPs (2026-08-29) — v0.7.305

Holzmaße (`timber` / `resolveTimber`), profilierte Sprossen, Scharnierseite + Öffnungsart (Dreh/Kipp/Drehkipp), Beschläge, Kasten-Innenfarbe, `Opening.guard`, Tür-Details (`door`), Vorhang/Jalousie (`interiorShade`). Docs: [windows-doors.md](windows-doors.md). Dateien: `gruenderzeit.ts`, `openingExtras.ts`, `facade.ts`, `hydrate.ts`, `FacadeController.ts`, `main.ts`, `index.html`.

### Loader: schnellere Strichanimation (2026-08-29) — v0.7.304

Haus-vom-Nikolaus-Loader: Kanten wachsen per `stroke-dashoffset` (rAF), Eckpunkte als kleine Kreise; ~85 ms je Kante. Datei: `index.html`, [views-and-state.md](views-and-state.md).

### Docs: Changelog ausgelagert (2026-08-29)

Änderungsprotokoll nach [changelog.md](changelog.md) verschoben. `architecture.md` hält Überblick, Kerntypen und Verweise. Neue Releases weiter oben in `docs/changelog.md` eintragen (Kurzform weiterhin auch in `src/version.ts` / RELEASES).

### Docs-Struktur: Feature-Dateien (2026-08-29)

Neue Feature-Docs: `wall-decor.md` (Gesims/Sockel/Zierband), `opening-features.md` (Bogen/Nischen/Bänke/Verdachung/Treppe/Keller), `bay-windows.md`, `profiles.md`. `ux.md` verweist darauf statt langer Duplikate; Technik-Abschnitte hier auf Links gekürzt. Index: `docs/README.md`.

### Loader: Haus vom Nikolaus (2026-08-29) — v0.7.303

Start-Overlay `#app-loading`: statt Spinner zeichnet ein Inline-Skript das Haus vom Nikolaus als Linienzug (alle Eulerwege von unten links/rechts ≈ 88, plus Sackgassen). Bei Fehlversuch kurz Pause und von vorn. Größe wie bisher 2,4 rem. Text „Studio wird geladen …“. Dateien: `index.html`, Docs.

### Bloom standardmäßig aus (2026-08-29) — v0.7.302

`DEFAULT_BLOOM_SETTINGS.enabled = false`; Checkbox in `index.html` uncheckt, `#bloom-options` per Default `hidden`. Persistierte Bloom-Einstellungen bleiben unverändert. Dateien: `bloom.ts`, `index.html`, Docs.

### Fenster/Türen-Dokumentation und Altbau-Roadmap (2026-08-29)

Neue Datei `docs/windows-doors.md`: Ist-Bestand der Individualisierung und Roadmap für Beschläge, Holzmaße, profilierte Stege, Kasten innen/außen, Öffnungsarten, Scharnierseite, Schmuckgitter, Tür-Eigenleben, Vorhang/Jalousie. Verlinkt in `docs/README.md`.

### Ost-Mauerwerk ohne Shadow-Schraffur (2026-08-29) — v0.7.301

Im 2D-Aufriss empfingen Paneele/Mauerwerk Shadow-Maps (v0.7.285, für Nord-Werfschatten). Bei **Ost/West** und typischer **Südsonne** ist die Sonne streifend (|N·L|≈0) — jede Steinkante wirft Mikroschatten → zackige „kaputte“ Fugen, Fenster bleiben sauber. **Fix:** `facadeSunIsGrazing` + `syncCladdingReceiveShadows` — Empfang nur farbiger Aufriss und nicht streifend; Zeichnung immer aus. Nord behält Gesims-Schatten. Dateien: `elevation.ts`, `main.ts`, Docs.

### Gitter/Ornament-Konfigurator entfernt (2026-08-29) — v0.7.300

Das in v0.7.299 eingeführte parametrische Schmiedewerk (`Opening.ornament` / `Wall.ornament`, Motive, UI-Reiter) ist wieder entfernt. Kellerfenster-Gitter weiter über `basementWindow` + `basementWindow.ts`.

### Gitter / Ornament für Öffnung und Wand (2026-08-29) — v0.7.299

Parametrisches Schmiedewerk: Motive (`bars`, `voluteCorner`, `rosette`, `sScroll`) in Zellenmodul 24/48/96 cm, Skalierung tile/uniform/stretchBars. `Opening.ornament` und `Wall.ornament`; Kellerfenster ohne Feld weiter über `basementWindow` → Stabgitter unten. 2D/3D gemeinsame Polylinien. UI: Reiter Gitter/Ornament (Öffnung) und Gitter/Zaun (Wand). Dateien: `src/studio/ornament/*`, `facade.ts`, `hydrate.ts`, `openings.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, `main.ts`, `index.html`, Docs. **Entfernt in v0.7.300.**

### Konche / Kalotten-Nische (2026-08-29) — v0.7.298

Neuer Opening-Typ `conch`: Rundbogen-Maske, Halbzylinder + Viertelkugel-Leibung (`createStudioConchRevealGeometry`). Bibliothek-Tab Nischen mit Presets; Typ-Select Fenster/Tür/Konche. Flache Cutout-Nischen unverändert. Dateien: `facade.ts`, `openingGeometry.ts`, `hydrate.ts`, `openings.ts`, `panelGeometry.ts`, `presets.ts`, `openingPreview.ts`, `main.ts`, Docs.

### Sockelprofil als Sweep minus Öffnungsvolumen (2026-08-29) — v0.7.297

v0.7.295 hat den SVG-Querschnitt pro Wand-X mit horizontalen Y-Löchern gekürzt und die Reste als Spalten geloftet — das zerstört den Profilring (eckig, facettiert). **Jetzt:** voller Sweep wie Gesims (`createProfileSweepGeometry`), danach boolesches Abziehen des Öffnungsprismas (`three-bvh-csg`, Kontur `openingMaskPolyline`). Sturz über einem niedrigeren Kellerfenster bleibt der ungeschnittene Profilteil. Fallback: Fragment-Discard in der Maske, falls CSG leer/ungültig. 2D unverändert Evenodd-ClipPath. Dateien: `profilePaths.ts`, `FacadeController.ts`, Tests, Docs.

### Mauerwerk an 45°-Ecken über Etagen (2026-08-29) — v0.7.296

`diagonalBondEndWidth` hat 0,5/1 an 45°-Knicken über `wall.id < adj.id` verteilt. Nach **Etage duplizieren** oder **Stile einfügen** bekommen Klone neue UUIDs — der Verband auf der kopierten Etage startet mit dem anderen Endstein, die Stoßfugen stehen nicht über denen darunter. Jetzt planstabil über Yaw, dann Origin. Datei: `panelLayout.ts`.

### Sockelprofil als Schnittmaske der Öffnung (2026-08-29) — v0.7.295

Dekoratives SVG-Sockelprofil wurde entlang der Wand extrudiert und an Kellerfenstern in die Laibung gezogen (Sturz-Treppe `plinthLintelSpans` / `sectionClipBelowCm`). Jetzt ein durchgehender Boden-Sweep; auf jedem Wand-X kürzt die **Öffnungsmaske** (`openingMaskYRangesAtX`, dieselbe Kontur wie Mauerwerk) den Querschnitt. Sturz und Zwickel entstehen als Rest über dem Bogen, nicht als gestapelte Lagen. 2D: ClipPath Evenodd. Dateien: `profilePaths.ts`, `openingGeometry.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, Tests, Docs.

### Zeichnung: Öffnungskanten wie Wand (2026-08-29) — v0.7.294

Laibungs-Tunnel und Sockel-Sturz-Treppe (Kellerfenster) zeichneten in der Zeichnung jede Bogenfacette als Eigenkante → Reißverschluss/Doppelkontur. Fix wie Wandkörper bei Paneelen: `skipLineEdges` auf Reveal-Meshes und Plinth-Lintel-Sweeps; Weiß-Fill mit `polygonOffset`. Laibungs-Maske mit `ARCH_MESH_SEGMENTS`. Dateien: `FacadeController.ts`, `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Export-Modus, Fassaden-Yaw-Filter, Freiraum cm (2026-08-29) — v0.7.293

1. **Export:** Ansicht `export` mit Format-Sidebar, wählbaren Aufrissen/Oben, Passepartout, Wallpaper-Safe-Area, PNG/JPG-Grid-Export; Links/Unten einklappen.  
2. **Scope Fassade:** Richtungs-Chips (`editFacadeYawFilter`) filtern `editWallTargets` / Öffnungs-Targets.  
3. **Freiraum:** `panelClearance.cm` in ganzen Zentimetern.  

Dateien: `exportMode.ts`, `main.ts`, `editScope.ts`, `persistence.ts`, `openingGeometry.ts`, `index.html`, Docs.

### Sturz/Laibung hinter dem Mauerwerk (2026-08-29) — v0.7.292

v0.7.291 (0,25 cm Bias) reichte nicht: Fußplatte und Bogen-Stirnkappen ragten weiter als weiße Streifen in den Ziegel. Verstärkung: `PROFILE_FACE_BIAS_CM` 1,5 cm; `PROFILE_BACK_CLEARANCE_CM` 1,2 cm hebt `forward≈0` im Sweep; offene Bogen-Sturz-Pfade ohne `capStart`/`capEnd`; Laibung `REVEAL_OUTER_INSET_CM` 0,6 cm hinter der Paneelfront. Dateien: `walls.ts`, `profilePaths.ts`, Tests, Docs.

### Profil-Z-Fight am Bogenscheitel (2026-08-29) — v0.7.291

Fensterprofil-Sweep (Archivolt) hatte die Fußplatte (`forward = 0`) koplanar auf der Paneelfläche — am Scheitel fast waagerecht im Zwickel → weiße Zacken im Ziegel. Fix: `studioProfileAnchorLocalZ` mit `PROFILE_FACE_BIAS_CM` vor die Fläche; `profileMaterial` mit `polygonOffsetFactor: -1`. Dateien: `walls.ts`, `FacadeController.ts`, Tests, Docs.

### Bloom-Slider wirken wieder (2026-08-29) — v0.7.290

`commitBloomPatch` baute bei jedem Slider-Tick die Fog-Farb-UI neu und setzte alle Bloom-Inputs — der Drag brach ab / Viewport blieb unverändert. Jetzt: nur betroffene Bloom-Felder, `markViewportDirty`, sofort `render3dFrame`. Stärke 0…1,5, Schwelle 0…1,2, Defaults sichtbarer. Dateien: `main.ts`, `bloom.ts`, `index.html`, Docs.

### Verdachung negativ, Laibungsfarben, Sockel-Bogen (2026-08-29) — v0.7.289

1. **Verdachung:** `offsetUp` −96…96 cm; `pedimentBaseLiftCm` / `pedimentGableLayout` ohne Null-Clamp.  
2. **Laibung:** `Opening.revealExteriorColor` / `revealInteriorColor` (Fallback Wand-/Innenwandfarbe); Swatches im Farben-Tab.  
3. **Sockel:** voller SVG-Sweep, Öffnungsvolumen boolesch abgezogen (`createPlinthProfileSweepGeometry`); Box-Sockel extrudiert Outline/`bottomArc`.  

Dateien: `pediment.ts`, `openingProfileLift.ts`, `openings.ts`, `FacadeController.ts`, `profilePaths.ts`, `panelGeometry.ts`, `main.ts`, `index.html`, Docs.

### Gesims-Schatten bei Schrift (2026-08-29) — v0.7.288

Bei extrudierter Schrift schaltete `syncLabelShadowReceivers` `castShadow` an Gesims/Zierband aus (Schutz vor dunklem Rechteck über der Schrift, v0.7.188/198). Folge: Freistreifen ohne Gesims-Schatten, obwohl die Schrift selbst Schatten warf. **Jetzt:** Gesims/Zierband casten immer; Schrift empfängt weiter mit `LABEL_SHADOW_COORD_Z_BIAS`. Dateien: `FacadeController.ts`, Docs.

### Bogenhöhe für Fenster und Türen gemeinsam (2026-08-29) — v0.7.287

Form und Stichmaß (`Opening.arch`) schreiben über `editArchOpeningTargets` auf **Fenster und Türen** im Gültigkeitsbereich (Auswahl → Wand; Typ/Fassade → Haus; Etage → Etage). Glas/Rahmen folgen weiter `riseCm`. Dateien: `editScope.ts`, `main.ts`, Tests, Docs.

### Paneel-Snap für Öffnungen rückgängig (2026-08-29) — v0.7.286

Die Ausrichtung an Paneelfugen/Steinmitten im Einfach-Modus (v0.7.284) ist entfernt — Öffnungen rasten wieder nur auf dem **8-cm-Raster** (Drag, Pfeile, Positionsfeld). `openingPanelSnap.ts` gelöscht. Dateien: `main.ts`, `index.html`, `style.css`, Docs.

### Bogenhöhe / Stichmaß, Korbbogen → Ellipse (2026-08-29) — v0.7.285

`Opening.arch.riseCm` steuert die Kronenhöhe (8er-Raster, Auto = Form-Standard). `resolveArchRiseForOpening` in Mauerwerk, Profilen und Glas (`glazingArchCrown` / `glazingArchGeom` → Gründerzeit/LOD). Legacy `basket` → `ellipse` (`normalizeArchFormId`). UI: `#opening-arch-rise`. Dateien: `archForms.ts`, `openingGeometry.ts`, `gruenderzeit.ts`, `windowLod.ts`, Docs.

### Nord-Aufriss: Werfschatten in 2D-Front (2026-08-29) — v0.7.285

In der 2D-Front wirkte die Nordfassade bei Sonnen-/Azimut-Änderung fast tot, die Westfassade klar. Ursache: Physik (N·L der Nordfront bleibt bei Azimut O→S→W ≤ 0) plus fehlende Werfschatten — Paneele hatten `receiveShadow=false`, und `syncLabelShadowReceivers` schaltete den Wandkörper-Empfang fälschlich nur bei Schrift ein (Regression vs. v0.7.237). Fix: Wandkörper empfängt immer; Paneele/Mörtel empfangen nur in 2D-Front (`setCladdingReceiveShadows`). `facadeOutward`/Front-Kamera für yaw 0 korrekt. Dateien: `FacadeController.ts`, `main.ts`, `sunLighting.test.ts`, Docs.

### Fenster an Paneelfugen, Einfach-Modus (2026-08-29) — v0.7.284

Im UI-Modus **Einfach** rasten Öffnungen horizontal an einem Idealraster der Paneelbreite (gerade Läuferlage ab Wandkante): Laibung auf Fuge oder Fenstermitte auf Steinmitte. Drag (3D/2D), Pfeile und Positionsfeld; Buttons „An Fugen“ / „Auf Steinmitte“. Logik in `openingPanelSnap.ts`. Komplex-Modus und Streifen ohne Vertikalfugen: 8 cm. CSS: `data-ui-level="simple"` nur in Einfach. Dateien: `openingPanelSnap.ts`, `main.ts`, `index.html`, `style.css`, Docs.

### Soft-Max, Zierband-Mitte/Duplikat, Sockel-Overlay (2026-08-29) — v0.7.283

Keine harten Caps mehr für Paneel-/Gesims-/Profil-/Sockel-/Vorsprung-/Fugen-Maße (`STUDIO_PANEL_SOFT_MAX` / `CORNICE_SCALE_MAX` ≈ 10000; HTML-`max` entfernt). Neues Zierband: `yFromBottom` = Wandhöhe/2 (8er-Raster). Selektion via `bandId` am Mesh + `selectedTrimBandId`; Duplikat ±16 cm (Kontextmenü + UI). Drag nur Y, Snap 8 cm. Gesims-Tiefe: `#studio-cornice-offset-forward` step 4 → `sectionScaleForward`. `masonryOriginY` = 0; Sockel clippt weiter (`clipTilesAbovePlinth`). `donorOpeningForStyle`: Fallback anderer Typ / Hauswände. Dateien: `constants.ts`, `cornice.ts`, `trimBands.ts`, `panelLayout.ts`, `openings.ts`, `FacadeController.ts`, `main.ts`, `index.html`, Docs.

### Sockel-Sturz über Kellerfenstern (2026-08-29) — v0.7.282

Dekoratives Sockelprofil schnitt bisher für jede Öffnung im Sockelstreifen die **volle Höhe** als X-Lücke aus (`plinthVisibleXSpans`) — auch wenn das Fenster niedriger als der Sockel war. Ergebnis: vertikaler Schacht über Kellerfenstern.

**Jetzt:** Seiten-Spannen wie bisher; zusätzlich `plinthLintelSpans` für Öffnungen mit Oberkante unter `plinthH`. Sturz-Sweep mit `sectionClipBelowCm` (oberer Profilanteil). Box-Sockel in der Zeichnung: volle Breite + Öffnungsmaske. Dateien: `profilePaths.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, Tests, Docs.

### Läuferverband an Gehrungsecken (2026-08-29) — v0.7.281

Nach v0.7.280 (Außenkante) liefen Paneele bis zur Ecke, aber Vertikalfugen wirkten stapelartig mit schmalen Randstreifen — auch bei reinen 90°-Wänden. Zwei Ursachen:

1. `computeRowColCuts` erzwang an **jeder** Gehrung Forced-Ends und legte in Versatzlagen einen **zweiten** Halbstein hinter den Forced-Start → Doppel-Halbsteine + gedehnte Feldsteine.
2. `useFrontLayout` war auch aktiv, wenn die Paneelfront wegen `projectDepth` **kürzer** als `wall.width` war → Raster auf der kurzen Front, Mapping erzeugte ~4-cm-Versatz und unregelmäßige Enden.

**Jetzt:** Forced-Ends nur an **45°-Knicken** (komplementär 0,5/1). Front-Layout nur wenn `faceLen > wall.width` (Innen-Origin/Keil). An Außenkante Raster auf `wall.width`. Feld hinter Forced-Ends nur volle Läufer. Dateien: `panelLayout.ts`, Tests, Docs.

### Außenkante wie 73dbdc9 (2026-08-29) — v0.7.280

In **73dbdc9** (v0.7.257, nach „Wandstärke an Außenkante“ v0.7.236) lag der Origin auf der **Außenpolyline**, `panelFlip: true`, Dicke nach innen. `applyGlobalWallDepth` rief `fitBuildingWallsToOuterSpine` auf; das Steinraster `0…width` war die sichtbare Front — keine 32–40-cm-Lücke.

Danach (v0.7.270–279) blieb der Innen-Origin (`panelFlip: false`) liegen. Der Load-Fit von v0.7.279 schnitt offene Ketten **gegen** die Planrichtung: aus 1056 cm wurde ein ~40-cm-Stummel (Clamp 48). `fitLoopWalls` richtet die Außenlinie jetzt an der Plan-Kante aus und verwirft Poses, die die Wand auf weniger als die Hälfte kürzen.

Dateien: `planGeometry.ts`, Tests, Docs.

### Mauerwerk an der Außenecke (2026-08-29) — v0.7.279

Ja, die Gehrung. Bei `panelFlip: false` ist der Plan die **Innenkante**; die sichtbare Front ist an 90°-Ecken um `z·tan ≈ Wandstärke` (32–40 cm) länger. Gesims nutzt die Außenecke, das Steinraster `0…width` die Innenlänge — Horizontalfugen bis zur Kante, erste Vertikale erst dahinter. v0.7.278 hat das Raster in den Keil gelegt; am echten Haus (alle Wände `panelFlip: false`, Load-Fit nur bei kaputter Vernetzung) blieb der Innen-Origin.

**Jetzt:** `buildingNeedsOuterSpineFit` erkennt `panelFlip: false` an verknüpften Wänden. Load (`applyFacadeLoadPipeline`) legt Origin auf die Außenecken, Dicke nach innen, `panelFlip: true` — wie nach Änderung der Wandstärke. Dateien: `planGeometry.ts`, `facadeLoad.ts`.

### Mauerwerk auf der Außenfront bis zur Ecke (2026-08-29) — v0.7.278

Ursache des 32–40-cm-Streifens: Die sichtbare Front ist an 90°-Ecken (`panelFlip: false`, Plan = Innenkante) um `z·tan ≈ Wandstärke` länger als der Plan. Raster ab x=0 plus End-Gehrung machte den ersten Stein zu einem Trapez ohne Vertikale; Horizontalfugen liefen bis zur Ecke. Blend in der Endzone (v0.7.277) und Plan-Kürzung (v0.7.270/273) haben das nicht behoben (`version.ts` in 277 war zudem syntaktisch kaputt).

**Jetzt:** `wallLocalX` ist ungehrt `wallX − halfW` und nur auf die Gehrungsebenen geklemmt. Das Raster wird auf der **Außenfront** gelegt; Steine in der Keilzone haben `wallX < 0` bzw. `> width`. Vertikalfugen 0,5/1 von der Außenecke; Feld und Öffnungen bleiben auf Plan-X. Dateien: `wallMiterX.ts`, `panelLayout.ts`, `panelGeometry.ts`.

### Vertikalfugen in der Gehrungszone (2026-08-29) — v0.7.277

Ursache des 32–40-cm-Streifens ohne Vertikalfugen: `wallLocalX` gehrte nur `wallX≈0`/`width`. Feld-Fugen blieben auf Plan-X, die Front an 90°-Ecken (`panelFlip: false`) aber um `z·tan ≈ Wandstärke` länger — Horizontalfugen bis zur Ecke, erste Vertikale erst dahinter. Plan-Verkürzung der Endsteine (v0.7.270/273) wirkte wie eine Lücke zum Gesims; Interpolation über die ganze Wand (v0.7.275) zerstörte Öffnungen.

**Jetzt:** Gehrung linear nur in der **Endzone** (`|miterStart|` bzw. `|miterEnd|`, typisch die Wandstärke). Endpunkte unverändert auf der Bilderrahmen-Ebene. Das Raster wird auf der **sichtbaren Front** mit 0,5/1 gelegt und per Inverse auf Plan-X gemappt. Außerhalb der Zone bleibt X konstant (Fenster unverzerrt). Dateien: `wallMiterX.ts`, `panelGeometry.ts`, `panelLayout.ts`, `walls.ts`.

### Ecken 0,5/1 ohne zerstörte Öffnungen (2026-08-29) — v0.7.276

v0.7.275 interpolierte die Gehrung über die **ganze Wandbreite** — Feld-X wanderte mit `z·tan`, Öffnungen und Paneelraster wurden zerschnitten. Zurück zur End-Gehrung von v0.7.221 (`wallLocalX` nur bei `wallX≈0`/`width`, Feld konstant, Clamp auf die Gehrungskante). 0,5/1 auf der Front: Planbreite der **Endsteine** (`planWidthForFrontTarget`), Raster weiter ab x=0. Bossen-Einzug an der Gehrung entlang der Front. Dateien: `panelGeometry.ts`, `panelLayout.ts`.

### Mauerwerk bis zur Ecke mit 0,5/1 (2026-08-29) — v0.7.275

`wallLocalX` interpolierte die Gehrung über die Wandbreite. Zerstörte Öffnungen; ersetzt durch v0.7.276.

### Bossen-Fase an der Gehrung (2026-08-29) — v0.7.274

Die Gehrung (`wallLocalX`) greift nur bei `wallX ≈ 0`/`width`. Der Bossen-Einzug lag in Plan-X ohne Gehrung — Fase auf der Front zu breit. v0.7.276: Einzug entlang der Front. Dateien: `panelGeometry.ts`.

### Vertikalfugen an 90°-Gehrung (2026-08-29) — v0.7.273

Bei `panelFlip: false` verlängert `wallLocalX` (v0.7.221) die Paneelfront an 90°-Ecken um ~`z·tan`. Volle Plan-Endsteine wirkten dann als ~1,5–2-Steine ohne Vertikalfugen. **Fix:** `panelLayout` kürzt die Planbreite der Endsteine um `frontMiterLengthenCm`, damit die Front wieder 0,5/1 ist; Raster weiter ab x=0 (Bilderrahmen bleibt). Dateien: `panelLayout.ts`, `panelGeometry.ts` (kein Feld-Clamp).

### Mauerwerk bis zur Außenecke (2026-08-29) — v0.7.272

Versuch: Miter auf Paneeltiefe skalieren. Bilderrahmen an Abzweigen brach; eigentliche Ursache der fehlenden Vertikalfugen ist die Front-Verlängerung (→ v0.7.273). Kein Feld-Clamp bleibt.

### Mauerwerk nicht um die Wandstärke kürzen (2026-08-29) — v0.7.271

v0.7.270 hat an 90°-Ecken die **Planbreite** der ersten Steine um `z × tan(45°) ≈ Wandstärke` gekürzt, damit die Front 0,5/1 bleibt. In der Ansicht wirkte das wie eine Lücke links (Gesims voll, Mauerwerk kürzer). Wieder wie vor dieser Kompensation: Raster ab x=0 (Läuferverband), Gehrung nur in 3D (`wallLocalX`). 0,5/1-Planausgleich bleibt auf **45°-Ecken**. Datei: `panelLayout.ts`.

### Mauerwerk bis zur 90°-Ecke (2026-08-29) — v0.7.270

`cornerJoin: 'none'` gehrt Paneele an jeder andockenden Wand, auch wenn der Nachbar kein Mauerwerk hat (vorher nur bei `wallHasPanels`). Sonst bleibt an 90°-Ecken eine Lücke um die Wandstärke, während Gesims weiterläuft. Endsteine: Planbreite so, dass die Front 0,5/1 bleibt; Läuferverband im Feld. Dateien: `walls.ts`, `panelLayout.ts`.

### Läuferverband an 45°-Ecken (2026-08-29) — v0.7.269

45°-Endsteine bleiben komplementär 0,5/1 auf der Front; das Feld dazwischen folgt wieder dem Läuferverband (gerade Lage 1er, versetzte 0,5er, Restbreite gleichmäßig auf die Läufer). Die unterste Reihe sitzt auf der Sockeloberkante in voller Steinhöhe — überlappende Steine werden nicht mehr gekürzt. Datei: `panelLayout.ts`.

### Mauerwerk-Front an 45°-Gehrung (2026-08-29) — v0.7.268

An stumpfen 45°-Außenecken ist die Paneel-Front länger als die Plan-Kante. Die Endsteine werden in der **Planbreite** so verkürzt, dass auf der Front 0,5 und 1 Stein bleiben (nicht 1,5 / 2). Restbreite der Lage in der Mitte, nicht am anderen Wandende. Datei: `panelLayout.ts`.

### Mauerwerk an 45°-Ecken (2026-08-28) — v0.7.267

Läuferlagen an ~45°-Stößen bekommen echte **0,5- und 1-Steine** (komplementär, nächste Lage getauscht) — unabhängig von Ecke Gehrung/Verband. Die Restbreite der Lage sitzt in der Mitte bzw. am freien Ende, nicht als 1,5er/2er an der Ecke. Datei: `panelLayout.ts`.

### Fassade, Gesims-Tiefe, Verband, Sockel (2026-08-28) — v0.7.266

**Gültig für Fassade** = alle Studio-Wände desselben Hauses (alle Winkel, alle Etagen), nicht nur gleiche Yaw. Gesims-**Tiefe** schreibt `sectionScaleForward` (cm am Querschnitt), `offsetForward` bleibt der Versatz. Verband an ~45°-Ecken: erste/letzte Kachel 0,5 oder 1 Stein, komplementär zur Nachbarwand. Sockelhöhe 8-cm-Raster; sichtbare **Sockelfarbe** (`plinthColor` + Profil). Neue Öffnung erbt Stile/Profile gleichen Typs. Rechtsklick: Kopieren Objekt/Stile, Duplizieren links vor rechts. `stretchStudioFacade` streckt vertikale Stapel; `duplicateStorey` auf Gebäudeoberkante. Picking: nächste Fassadenebene gewinnt. `cornerJoin: 'none'` gehrt weiter, wo Paneele/Gesims/Sockel anknüpfen. Fußboden-Oberkante = min. Türkante der Etage. Dateien: `editScope.ts`, `cornice.ts`, `panelLayout.ts`, `openings.ts`, `walls.ts`, `layers.ts`, `FacadeController.ts`, `main.ts`, `index.html`, Docs.

### Haus bleibt beim Zoomen sichtbar (2026-08-28) — v0.7.265

v0.7.264 setzte `SkyMaterial.depthTest = false`. Der Clip-Space-Himmel (renderOrder 1000) übermalte die Szene, sobald Textures geladen und neu gerendert wurden (typisch erster Zoom). `depthTest` wieder an, `depthWrite` aus. Datei: `atmosphereSky.ts`.

### Stabiler Himmel, Bodenfarbe wie Mauerwerk (2026-08-28) — v0.7.264

Bloom-Fireflies: Sonnenscheibe ohne dFdx, weiche HDR-Kappe im Sky-Shader. Boden: keine Glas-EnvMap/SkyLightProbe-Irradiance, Fill = Nutzer-Albedo × Sonnen-Ambient (`ground-mood-v5`). UI-Label „Bodenfarbe“. Dateien: `atmosphereSky.ts`, `groundMood.ts`, `lightingMood.ts`, `threeColors.ts`, `index.html`.

### Bloom mehr Spielraum (2026-08-28) — v0.7.263

v0.7.260 hatte zu enge Bloom-Slider. Wieder breitere Bereiche + Defaults wie v0.7.185; Belichtung `exposure³`. Dateien: `bloom.ts`, `index.html`.

### Boden folgt Licht und Nutzerfarbe (2026-08-28) — v0.7.262

Boden wirkte blau: Hemisphere und Umbra-Shader nutzten `palette.zenith` (`#3A6084`). Jetzt: `hemiSkyColor` und `groundShadowTintColor` aus Nutzer-Untergrund + Horizont + Sonnentemperatur; tiefe Sonne wärmt mit. Shader `ground-mood-v4`. Dateien: `lightingMood.ts`, `groundMood.ts`, `main.ts`.

### Himmel wieder sichtbar (2026-08-28) — v0.7.261

v0.7.260: `uSkyDisplayExposure` ohne GLSL-Deklaration in Takram-`RawShaderMaterial` → Shader defekt, Himmel schwarz. Fix: explizites `uniform float`; Exposure 7/8. Dateien: `atmosphereSky.ts`, `roomEnvironment.ts` (try/finally beim Glas-Bake).

### Bloom feiner, kein weißes Flackern (2026-08-28) — v0.7.260

Bloom-Slider auf nutzbare Bereiche begrenzt; Belichtung `exposure²` statt `exposure⁴`. Takram-Himmel: Display-Exposure runtime (`uSkyDisplayExposure`), mit Bloom niedrig (2,2). Glas-EnvMap-Bake pausiert während Orbit-Lite; HDR-Himmel aus CubeCamera ausgeschlossen. Dateien: `bloom.ts`, `atmosphereSky.ts`, `main.ts`, `index.html`.

### Schatten am Haus, heller Taghimmel (2026-08-28) — v0.7.259

Sonnenlicht und SkyLightProbe sind nicht mehr Kinder des Himmels-Roots (der folgte der Kamera) — Schatten bleiben am Gebäude. Taghimmel: Reinhard-Anzeige auf `SkyMaterial` (toneMapped:false). Key-Light wieder display-referred. Dateien: `atmosphereSky.ts`, `main.ts`.

### Takram-Himmel, Kontakt-RT entfernt (2026-08-28) — v0.7.258

Kontaktschatten (Top-Down-RT) entfernt; Boden nur noch Shadow-Map + Umbra-Shader (`groundMood.ts`, `ground-mood-v3`). Himmel und Key-Light über **@takram/three-atmosphere** (MIT, Bruneton): `AtmosphereSky` mit `SkyMaterial`, Sterne, `SunDirectionalLight`, `SkyLightProbe`. Precomputed Textures von CDN. Dateien: `atmosphereSky.ts`, `main.ts`, `docs/celestial-sky.md`, `docs/lighting-mood.md`.

### Bodenschatten wieder sichtbar (2026-08-28) — v0.7.257

Boden-Shader (`applyGroundMoodShader`) rief `getShadowMask()` auf — die Funktion ist in `MeshStandardMaterial` nicht eingebunden (nur in `ShaderLib/shadow`). Der Shader schlug fehl, Umbra und Kontakt-RT wirkten nicht. Fix: `getShadow(directionalShadowMap[0], …)`, Cache `ground-mood-v2`, Kontakt-Uniform als Live-Ref. Datei: `contactShadow.ts`.

### Wände in Farbe wieder sichtbar (2026-08-28) — v0.7.256

Gegenlicht-Shader v7/v8 patchte nach `lights_fragment_end` und ergänzte Bounce-/Innenflächen-Logik — in der Farb-Ansicht wirkten Wände unsichtbar (Zeichnungsmodus mit `MeshBasicMaterial` blieb OK). Fix: zurück auf bewährten Patch nach `lights_fragment_begin` (`facade-backlit-v9`), Label-Dim per Uniforms beibehalten. Dateien: `facadeShade.ts`, Tests.

### Schrift bleibt im Schatten dunkel (2026-08-28) — v0.7.254

Hemi-Fill (0,82) und Bounce-Licht der Schattenseite gelten nur für Wände, nicht für Labels (`uLabelShade`). Sonst machte der Fill die Schrift wieder hell. Dateien: `facadeShade.ts`, Docs.

### Mehrschichtige Lichtstimmung (2026-08-28) — v0.7.253

Bodenschatten wirkten flach (eine harte Shadow-Map). Jetzt: **Key** (PCFSoft + `shadow.radius`), **Himmel** (Hemisphere), **Bounce** (`bounceDirLight`), **Kontakt** (Top-Down-RT nur Boden). Umbra himmelblau getönt; Schattenseite mit Bodenreflex. Slider unverändert. Dateien: `lightingMood.ts`, `contactShadow.ts`, `facadeShade.ts`, `celestialSky.ts`, `main.ts`, `docs/lighting-mood.md`.

### Schrift im Schatten dunkler (2026-08-28) — v0.7.252

Wandbeschriftung blieb im Schatten zu hell: der globale Gegenlicht-Shader dimmte nur Seiten/Oberseiten (Lambert reicht für Wände, nicht für Schrift), flache Labels waren `DoubleSide`+transparent (Rückseite voll Sonne), und Labels empfingen keine Shadow-Map. Jetzt: eigener Schrift-Shade (`labelDirectDim`/`labelHemiDim`, Front mitdimmen), `receiveShadow` mit Shadow-Z-Bias, flache Schrift `FrontSide`. Dateien: `facadeShade.ts`, `FacadeController.ts`, `labelGeometry.ts`, Docs.

### Himmel-Fixes (2026-08-28) — v0.7.251

Sonnenwinkel wieder manuell (`settings.azimuth`/`elevationRad`). Himmelsdom folgt der Kamera innerhalb der Far-Plane; `scene.background` bleibt die Szenenfarbe. Palette nutzt Himmel/Untergrund/Hintergrund. Tageszeit 0–24 h ohne Sunrise-Clamp. Datum immer heute (`todayMonthDay`, `applyTodaySunDate`). Dateien: `celestialSky.ts`, `sunLighting.ts`, `solar.ts`, `main.ts`, Docs.

### Himmel, Sonne und Mond (2026-08-28) — v0.7.250

Sichtbarer Himmelsdom (`CelestialSky`), Tageszeit 0–24 h, Mondlicht nachts, Sterne. Beleuchtung global über `resolveCelestialState`. Dateien: `celestialSky.ts`, `sunLighting.ts`, `main.ts`, `docs/celestial-sky.md`.

### Draufsicht, Szenenfarben, globales Licht (2026-08-28) — v0.7.249

**Oben:** Kamera über `sceneContentMaxY()` + Pad; Decken sichtbar. Navigation wie 3D (⌘/Ctrl-Ziehen = Himmelsrichtung, ⌘/Ctrl+⇧ = Schwenk). Kompass dreht `topViewYawDeg`. **Site-Yaw** in 3D und Oben. **Szenenfarben:** Hemisphere aus `SceneAppearance`; EnvMap-Bake auch in Oben. **Shader:** `facadeShadeParamsFromSun` global für Wände/Paneele/Schrift. Dateien: `floorPlanView.ts`, `facadeShade.ts`, `sunLighting.ts`, `FacadeController.ts`, `main.ts`, Docs.

### Fugen, Stein-Kontrast, Beleuchtung (2026-08-28) — v0.7.248

**UI:** Fugenfarbe eigene Zeile; Stein-Kontrast/Häufigkeit für alle Paneele. **LOD:** Medium zeigt Mörtel + mehrfarbige Low-Meshes. **Shader:** Paneele/Mörtel ohne `facadeShade` (reliefgetreu beleuchtet). Dateien: `FacadeController.ts`, `main.ts`, `index.html`, Docs.

### Fugen, Laibung, Schrift, D&D (2026-08-28) — v0.7.247

**Fugen:** `panel.jointColor`, Mörtel unabhängig von Wandfarbe. **Laibung:** Außen-/Innenhälfte getrennt (`wallColor` / `interiorColor`). **Ziegel:** Häufigkeit auto bei Kontrast; Slider nur bei Mauerwerksmustern. **Bibliothek-D&D:** 50 % Ghost, Raster um Zielwände, `mergeCollinearDockedWalls`. **Pick:** Sichtreihenfolge. **Schrift:** Speichern ohne Positions-Reset, 8-cm-Raster. **Glas:** Default tint. Dateien: `panelGeometry.ts`, `FacadeController.ts`, `walls.ts`, `main.ts`, `openings.ts`, `schemaMigrations.ts`, `style.css`, Docs.

### Innenwand und Decke weiß (2026-08-28) — v0.7.246

Innenwand (`Wall.interiorColor`) und Decke/Boden (`FloorPlan.ceilingColor`) Default **Weiß**. Anpassung im Reiter **Farben**. Wandkörper: Material-Gruppe 0 außen/Mörtel/Kanten (`wallColor`), Gruppe 1 Innenfläche. Schema 12→13 ersetzt alte Decken-Fallbacks `#9a8a7a`/`#8a7a6a`. Dateien: `panelGeometry.ts`, `FacadeController.ts`, `hydrate.ts`, `schemaMigrations.ts`, `main.ts`, `index.html`, Docs.

### Ziegel-Zufallsfarbe, Info-Icons, Laibung = Wandfarbe (2026-08-28) — v0.7.245

**Ziegel:** Kontrast/Häufigkeit wieder unter Mauerwerk (nicht nur Komplex), Häufigkeit erst bei Kontrast > 0. **Hinweise:** Erklärungstexte als `i`-Icon am Feld, Hover-Tipp. **Laibung:** `wall.wallColor` / `wall.wallFinish`, Pick `openingPart: 'group'`. Dateien: `tileColors.ts`/`panelGeometry.ts`/`FacadeController.ts`, `fieldInfo.ts`, `main.ts`, `index.html`, `style.css`, Docs.

### Peter-Wiegel-Schriften, 16:9-Vorschau (2026-08-28) — v0.7.244

Tab Schrift: Karten unter dem Textfeld, **16:9**, eine Spalte; Vorschautext = Eingabe (live). Katalog `LABEL_FONTS` (Federo + Peter Wiegel). Flach/extrudiert laden TTF bzw. Typeface je `fontId`. Quellen/Lizenzen in `credits.ts`, `public/fonts/peter-wiegel/QUELLEN.md`, `docs/fonts.md`. Dateien: `labelFonts.ts`, `labelGeometry.ts`, `main.ts`, `index.html`, `style.css`, Fonts unter `public/fonts/peter-wiegel/`, Docs.

### Glas-Spiegelung, Farbfelder, Himmel (2026-08-28) — v0.7.243

Fensterscheiben nutzen **Transparenz** (echte Durchsicht in den Raum) plus CubeCamera-EnvMap von **außerhalb** des Baukörpers (Nachbarflügel, Boden, Himmelssphäre). Probe folgt der Kamera-Seite, Neu-Bake beim Orbit in ~18°-Schritten. Klarglas-Albedo bleibt dunkel, Specular/Clearcoat hell. Transmission-Default **0** (alte 0,9/0,96/0,42 werden hydriert, Nutzerwerte bleiben). Himmelsfarbe Default `#3A6084`; gespeichertes Weiß gilt als alter Default. Szenen- und Nebel-Color-Picker mit RGB/HSL/HEX. Dateien: `roomEnvironment.ts`, `threeColors.ts`, `glassConfig.ts`, `persistence.ts`, `main.ts`, `index.html`, Docs.

### Scope, Glas, Schatten, Fensterbank (2026-08-28) — v0.7.242

**Gültig für:** Fassade = alle Studio-Wände/Öffnungen **desselben Hauses** (alle Winkel, alle Etagen); Etage = alle der Geschosse; Typ = gleicher `opening.type` (z. B. alle Fenster, unabhängig von Größe); Auswahl = nur Markierung. `scopedOpeningRefs` ohne `filterOpeningRefsByBasementParity`. **Glas:** dunkles Klarglas (`#121820`, Transmission 0,42), CubeCamera der echten Szene als EnvMap (Gebäude/Boden/Himmel), Fresnel. **Schatten:** `ambient` / `shadowContrast` / `shadowDensity` in `SunSettings` und Licht-Toolbar. **Fensterbank:** max. 16 cm Vorstand; Schema 12 + Hydrate ziehen alte Defaults (20/32/36/40/48) nach, Nutzerwerte darunter bleiben. Farbfelder RGB+HSL+HEX. Öffnungen 8-cm-Raster. Selektion während Flügel-/Rollladen-Animation aus. Dateien: `editScope.ts`, `roomEnvironment.ts`, `threeColors.ts`, `hydrate.ts`, `schemaMigrations.ts`, `sunLighting.ts`, `main.ts`, `index.html`, Docs.

### Kopieren, Gesims, Zierband, Glas (2026-08-28) — v0.7.241

Rechtsklick **Kopieren** ist ein Untermenü: **Alles** (Geometrie + alle Stile) oder einzelne Eigenschaften; Einfügen über **Einfügen** bzw. **Stile einfügen**. Traufgesims-Querschnitte neu aus den Silhouetten (PNG-oben = Krone an der Wandoberkante). Zierbänder: X-Löcher über `openingMaskXRangesAtY` (Bogen wie Paneele) plus Rahmenprofil-Outward. Physisches Klarglas fast farblos, Clearcoat + Himmel/Studio-EnvMap. Neue Außenbank: `defaultOuterSillDepth` = Paneel- bzw. Wandtiefe + 16 cm. Dateien: `main.ts`, `uploadedSilhouettes.ts`, `profilePaths.ts`, `openingGeometry.ts`, `glassConfig.ts`/`threeColors.ts`/`roomEnvironment.ts`, `hydrate.ts`, Docs.

### Gesims, Glas, Etage, Zierbänder (2026-08-28) — v0.7.240

Gesims-Vorschau hängt von der Wandkante nach unten (`hangFromWallEdge`). Traufgesims-Querschnitt nicht mehr per `eavesFromSvg` invertiert (Tropfkante unten). Neue Öffnungen: `glassMode: 'physical'` mit Floatglas-Defaults (IOR 1,52, Transmission 0,96, 1,2 cm); Alt-Saves ohne Feld bleiben `tint`. `duplicateStorey` mit `StoreyCopyOptions` und Dialog `#storey-copy-dialog` (Auswahl speichern / Nur Grundriss). Zierbänder-Reiter ohne HTML-`hidden` und ohne JS-`hidden` (sonst fehlt der Tab). Rahmenprofil-Karten ohne `.sidebar-library-picker`, Zuweisung auf alle Kanten. Fensterbank-Brett nicht mehr zusätzlich zum Profil; Oberkante = `layout.yTop`. Rechtsklick-Untermenü **Alles**. Grundriss: `collectPlanDrawGuides`. Dateien: `main.ts`, `index.html`, `glassConfig.ts`, `walls.ts`, `uploadedSilhouettes.ts`, `profilePaths`/`FacadeController`, `buildingGuides.ts`, Docs.

### Laibung nur noch Tunnel (2026-08-28) — v0.7.239

Front-Lippe und Sturz-Soffit entfernt (`createStudioOpeningRevealGeometry`). Beides hing als Extra-Quads in die Öffnung und erzeugte Spitzen, eine schwebende Ebene und doppelte Kanten in Zeichnung/Farbe. Leibung = ein Quad pro Maskenkante von Innenwand bis Fassade. Dateien: `panelGeometry.ts`, Tests, Docs.

### Sturz-Laibung ohne Ecken-Spitzen (2026-08-28) — v0.7.238

Front-Lippe (`addRevealFrontLipQuads`): kantenweiser Normal-Offset statt `openingMaskPolyline(±inflate)` — uniformes Inflate ließ die Seiten-Lippe 2 cm über den Sturz ragen, während das Sturz-Segment fehlte (diagonale Spitzen). Y wird an der Öffnungs-Oberkante geklemmt. Test in `panelGeometry.test.ts`. Dateien: `panelGeometry.ts`, Docs.

### Laibung, Fenster-Animation, Innenlicht (2026-08-28) — v0.7.237

**Sturz-Soffit:** `createStudioOpeningRevealGeometry` — opake Leibungsdecke (~14 cm) an der Öffnungs-Oberkante, ohne Kasten darüber. **Animation:** `leafOpenSignForWall` korrigiert (Flügel nach innen); Kastenfenster Außen-/Innenflügel entgegengesetzt. **Innenraum:** Wandkörper `receiveShadow`; Fußboden-Mesh pro Etage (`storeyBottomY`); `facadeShade` dämpft Innenflächen. Dateien: `panelGeometry.ts`, `walls.ts`, `gruenderzeit.ts`, `FacadeController.ts`, `facadeShade.ts`, `layers.ts`, Docs.

### Außenkante als Bezugsgröße (2026-08-28) — v0.7.236

Verknüpfung, Gehrung und Decke beziehen sich auf die **Außenpolyline**. `fitBuildingWallsToOuterSpine` schneidet die Außenlinien benachbarter Wände und setzt Origin + `panelFlip: true` (Dicke nach innen). Beim Ändern der Wandstärke (`applyGlobalWallDepth`) bleiben diese Außenecken stehen; Gehrungen folgen der neuen Tiefe. Decke: `innerFaceRingWorld(plan, wallDepth)` — 0 cm zur Innenwand, `wallDepth` zur Außenwand. Load repariert Ringe, deren Endpunkte sich nicht mehr treffen. Dateien: `planGeometry.ts`, `walls.ts`, `facadeLoad.ts`, `FacadeController.ts`, Tests, Docs.

### Gehrung bei Wandstärke (2026-08-28) — v0.7.235

`syncBuildingWallMiters` (`planGeometry.ts`): Gehrungen aus `assignMiters` mit `building.wallDepth` + `miterAtWallEnd`. `updateGlobalDepth` skaliert Zwischenwerte, setzt `wall.depth` auf allen Etagen, Origin-Kompensation bei `panelFlip: false`. `wallsFromFloorPlan` erhält `wallDepth`-Parameter. Dateien: `planGeometry.ts`, `utils/walls.ts`, `floorPlan.ts`, `main.ts`, Tests, Docs.

### Decke bündig innen (2026-08-28) — v0.7.234

Decke nutzt `innerFaceRingFromWalls`: Innenpolygon aus Wand-Planlinie + `facadeOutward`-Versatz (`panelFlip true`) bzw. Planlinie direkt (`panelFlip false`); Ecken per Schnittpunkt der Innenkanten. Behebt Lücke zur Innenwand nach Wandstärke-Änderung. Dateien: `panelGeometry.ts`, `FacadeController.ts`, Tests, Docs.

### Start-Fix (2026-08-28) — v0.7.233

Beim Umbenennen Grundriss → Oben blieb `viewBtnPlan` in `viewModeButtons` — `ReferenceError` beim Modul-Load, `#app-loading` wurde nie entfernt. Fix: `viewBtnTop`. Datei: `main.ts`.

### Wandstärke & Decke (2026-08-28) — v0.7.232

**Wandstärke:** `updateGlobalDepth` verschiebt bei `panelFlip: false` den Wand-Origin entlang `facadeOutward` um `(oldDepth − newDepth)`, damit die Außenkante in Weltkoordinaten fix bleibt. Nach der Änderung `finalizeStudioGeometry` (Gehrungen). **Decke:** `rebuildIndoorFloor` positioniert Extrude-Meshes bei `y = storeyTopY` (Unterseite bündig mit Wandoberkante, statt 8 cm darunter). **Defaults:** `panelDepthZs` / `studioWindowDepthForwardSign` nutzen `panelFlip ?? true`. Dateien: `utils/walls.ts`, `main.ts`, `FacadeController.ts`, `panelGeometry.ts`, `studio/walls.ts`, Tests, Docs.

### Sturz-Soffit schließt Schrägblick (2026-08-27) — v0.7.197

Zu flacher Sturz ließ von schräg oben den Blick aufs Glas zu (weißer Streifen). Leibungs-Soffit hängt ~24–32 cm nach unten und bis hinter die Fensterfront; Blendrahmen-Stopfen füllt dieselbe Zone. Dateien: `panelGeometry.ts`, `gruenderzeit.ts`, Docs.

### Draufsicht statt Grundriss-Tab (2026-08-28) — v0.7.231

Tab **Grundriss** → **Oben** (`AppView` `'plan'` → `'top'`). Draufsicht rendert die 3D-Szene mit `topCamera`, nicht das Floor-Plan-Overlay. `isSceneEditView()` vereinheitlicht Pointer-Handler für Oben/2D/3D. `#plan-sidebar` dauerhaft ausgeblendet. Dateien: `main.ts`, `persistence.ts`, `index.html`, `style.css`, Docs.

### Wand-Einstellungen, Decke, Schatten-Fix (2026-08-28) — v0.7.227

Standard-Geschosshöhe wieder **448 cm** (`WALL_HEIGHT`, `#studio-wall-height`). **Wandstärke** gebäudeweit über `#studio-wall-depth` (`building.wallDepth`, 8–80 cm). Schrift-**Versatz** (+ außen / − innen) standardmäßig sichtbar. Paneel-Klick zeigt wieder alle Wand-Reiter. **90°-Drehen** nur noch per Rechtsklick (Overlay entfernt). Decke in 3D markierbar (`userData.kind = 'ceiling'`, Raycast); Löcher/Inset nutzen `innerFaceRingWorld` mit `building.wallDepth`; Y ohne −0,15 cm-Lücke. „Reihen oben ausblenden“: Außenfläche im Freistreifen nicht mehr eingesenkt — Wandschatten bleibt. Dateien: `main.ts`, `FacadeController.ts`, `panelGeometry.ts`, `constants.ts`, `validation.ts`, `walls.ts`, `index.html`, Docs.

### Wand loslösen (2026-08-28) — v0.7.230

Toolbar `#studio-wall-unlink` und Rechtsklick **Wand loslösen** (sichtbar bei `planLinked`). `stretchStudioFacade` und `translateStudioCorner` lassen unverknüpfte Wände (`planLinked: false`) unangetastet bzw. strecken nur die losgelöste Wand allein. Dateien: `studio/walls.ts`, `main.ts`, `index.html`, Docs.

### Decke folgt Wandhöhe (2026-08-28) — v0.7.229

`storeyTopY` (`utils/layers.ts`): Decke/Boden-Mesh bei `max(wall.y + wall.height)` der Etage statt `(fi+1) × wallHeight` — wichtig wenn nur eine Etage höher/niedriger wird oder EG-`wallHeight` abweicht. Dateien: `FacadeController.ts`, `layers.ts`, Docs.

### Wand-Mindestmaß, Öffnungen, Etagen-Verschieben (2026-08-28) — v0.7.228

`STUDIO_MIN_SIZE = 48 cm` (Breite und Höhe). Beim Verkleinern filtert `normalizeStudioWall` Öffnungen, die nicht vollständig in der Wandfläche liegen (`openingFitsWithinWall`). Verschieben: `expandWallMoveIds` zieht Wände mit gleichem Fußabdriff auf allen Etagen mit; **Shift** während des Ziehens = nur aktuelle Etage; Grundrisse/Decke via `syncFloorPlansFromWalls`. Dateien: `constants.ts`, `validation.ts`, `studio/walls.ts`, `main.ts`, Docs.

### Sturz-Stopfen schließt Glas-Spalt (2026-08-27) — v0.7.196

Opaker Blendrahmen-Stopfen greift von der Türfront nach außen in die Leibung; Studio-Öffnungen ~8 cm vertieft. Dateien: `gruenderzeit.ts`, `FacadeController.ts`, Docs.

### Kein weißer Glasstreifen am Sturz (2026-08-27) — v0.7.195

Studio-Fenster/Türen mit `WINDOW_RECESS − 8` nach vorne (~8 cm Vertiefung). Opaker Sturz-Stopfen am Blendrahmen (gruenderzeit) gegen Glas-Saum ohne depthWrite. Sturz-Klotz folgt der Front. Dateien: `FacadeController.ts`, `gruenderzeit.ts`, `panelGeometry.ts`, Docs.

### Sturz ohne weißen Haarspalt (2026-08-27) — v0.7.194

Sichtbarer Leibungs-Stopfen plus Sturz-Klotz (Fassade → Fensterfront). Dateien: `panelGeometry.ts`, `FacadeController.ts`, Docs.

### Leibung bis Innenwand (2026-08-27) — v0.7.193

`studioOpeningRevealInnerZ` nutzt `studioWallInnerLocalZ` (panelFlip-abhängig). Zuvor war bei normaler Ausrichtung fälschlich `wall.depth` (= Außenkante) — die sichtbare Leibung deckte nur die Paneeltiefe, durch die Wandstärke sah man den weißen Himmel am Sturz. Dateien: `walls.ts`, Docs.

### Lichtleck am Türsturz geschlossen (2026-08-27) — v0.7.192

Shadow-Tunnel an Öffnungen reicht bis zur Fassadenaußenfläche (Paneel-Vorstand) und ist 1 cm aufgeweitet — keine hellen Lichtstreifen mehr zwischen Paneelen und Sturz. Dateien: `panelGeometry.ts`, Docs.

### Tür und Treppe ohne Schraffur (2026-08-27) — v0.7.191

Türfüllungen/Rahmen und Eingangstreppen empfangen keine Shadow-Map mehr (`receiveShadow = false`) — Selbstschatten wirkte wie eine leichte Schraffur. Dateien: `gruenderzeit.ts`, `loadWindows.ts`, `FacadeController.ts`, `windowLod.ts`, Docs.

### Rollläden in der Leibung mit Führungsschienen (2026-08-27) — v0.7.190

Lamellen-Geometrie 180° um Y; Ebene 8 cm hinter Fassadenaußenfläche. Zwei transparente Führungsschienen (±8 cm von den Öffnungskanten). Dateien: `rollerShutter.ts`, `FacadeController.ts`, Docs.

### Zierbänder als eigener Tab (2026-08-27) — v0.7.189

Zierbänder sind nicht mehr unter Gesims verschachtelt, sondern eigener Einstellungs-Tab (`data-settings-section="trimBands"`). Pick in 3D setzt `wallPart: 'trimBand'`. Add-Button nur bei Studio-Wand-Auswahl aktiv. Dateien: `index.html`, `main.ts`, `profilePaths.ts`, `FacadeController.ts`, `facade.ts`, Docs.

### Front-Greifer verschiebt die Wand (2026-08-28) — v0.7.226

Mittiger Greifer auf der Fassade (Pfeil nach außen). Ziehen nur entlang der Front (`offsetStudioWallsAlongFront`, Raster `frontMoveStepCm`). Verknüpfte 45°-Nachbarn, die nicht ausgewählt sind → grauer Info-Greifer, kein Drag. 90°-Nachbarn werden am Stoß gestreckt. Dateien: `walls.ts`, `main.ts`, `index.html`, `style.css`, Tests, Docs.

### 45°-Wand folgt dem Raster (2026-08-28) — v0.7.225

Ein Längenschritt ist ein Grundrissfeld: **48 cm** achsparallel, bei 45°/135° die **Diagonale** \(48\sqrt{2}\) ≈ 67,9 cm (`wallWidthStepCm`, `PLAN_DIAGONAL_STEP`). Shift-Abzweig, Greifer und Toolbar-± rasten darauf, damit Endpunkte auf dem 48-cm-Gitter bleiben — wie `planLineLengthCm` im 2D-Grundriss. Dateien: `constants.ts`, `walls.ts`, `main.ts`, Tests, Docs.

### Abzweig schließt den Grundrisspfad (2026-08-28) — v0.7.224

Shift-Greifer: das freie Ende rastet entlang des 45°/90°-Strahls an bestehende Ecken (Ausgangspunkt oder andere Wand) innerhalb von 48 cm. Endpunkte fallen zusammen → `findAdjacentWall` / `miterAtWallEnd` setzen die Gehrung wie an den übrigen Ecken. Trifft der Strahl die Mitte einer Wand, wird sie geteilt (beide Stücke ≥ 48 cm, Öffnungen bleiben am Mittelpunkt). Am T-Stoß zählt der knickende Nachbar für Gehrung und Paneel, nicht das kollineare Gegenstück. Dateien: `walls.ts`, `main.ts`, `wallResize.test.ts`, Docs.

### Bestandsdaten nachziehen (2026-08-28) — v0.7.222 / v0.7.223

Neue Abzweig-Wände lagen richtig, gespeicherte mit zwei Starts an einer Fuge nicht. **Schema 11** (`repairPlanLinkedWallFronts`): Grad-2-Fuge mit zwei Starts/Enden → Blatt 180° (Ende an der Fuge), `panelFlip` an die Bandseite des Nachbarn; Öffnungen lokal gespiegelt. **Jedes Load:** dieselbe Repair nach Clamp (auch wenn `schemaVersion` schon 11 ist), plus `finalizeStudioGeometry` für Bänke/Gehrung/Grundriss aller Gebäude. Bewusst gedrehtes `panelFlip` bleibt, wenn die Topologie schon Ende→Start ist. Dateien: `walls.ts`, `facadeLoad.ts`, `planGeometry.ts`, `floorPlan.ts`, `schemaMigrations.ts`, `docs/migration.md`.

### Abzweig-Front auf der Bandseite (2026-08-28) — v0.7.221

`poseAngledWallFromEnd`: Außenseite = gleiches Vorzeichen von `along × outward` wie an der Quelle. Am Start liegt das **Ende** der neuen Wand an der Fuge. Dateien: `walls.ts`, `wallResize.test.ts`, Docs.

### Sockel-/Gesims-Sweep auf der Plan-Kante (2026-08-28) — v0.7.220

`|z| × |tan|` (immer Front kürzer) schloss 90°-Ecken, ließ stumpfe 45°-Außenecken klaffen (~67 cm). `miterAtWallEnd` liefert wieder vorzeichenbehaftetes `depth × tan(Knick/2)`. `wallLocalX` und Profil-Sweep: `x = s_joint − z × tan`. Load: `finalizeStudioGeometry`. Dateien: `walls.ts`, `panelGeometry.ts`, `profilePaths.ts`, `facadeLoad.ts`, Tests, Docs.

### Abzweig-Wand: Bilderrahmen-Gehrung an der Front (2026-08-28) — v0.7.219

Paneele, Sockel und Gesims sollen an 45°- und 90°-Ecken wie ein Bilderrahmen frontal zusammenlaufen. `wallLocalX`: Versatz `|z| × tan(halber Knick)` von der Plan-Kante — auch bei `panelFlip: false` (Bibliothek). Sockel-/Zierband-Sweep dieselbe Richtung wie Gesims. Tests inkl. Flip-false-90°. Dateien: `panelGeometry.ts`, `profilePaths.ts`, `walls.ts`.

### Abzweig-Wand: Außenseite und Gehrung nach innen (2026-08-28) — v0.7.218

**Links:** Kopiertes `panelFlip` zeigte Paneele/Sockel nach innen. `poseAngledWallFromEnd` legt die neue Wand so, dass `along × outward` dasselbe Vorzeichen hat wie an der Quelle (Bandseite). Am **Start** endet die neue Wand an der Fuge. `panelFlip` der Quelle bleibt; Segment ggf. um 180°. **v0.7.221:** Wenn die Quell-Außennormale parallel zur neuen Wand liegt (typisch 90° an `panelFlip: false`), fällt die Front nicht mehr zur Quelle hin um.

**Gehrung:** `miterAtWallEnd` kürzt die Innenkante bei jedem Knick (45°/90°), nicht nur bei 90° — sonst wurde 45° negativ und schnitt nach außen.

### Wand-Greifer: Ziehen ohne Sprung, Shift = neue Wand (2026-08-28) — v0.7.217

**Anfassen:** Preview erst nach einer kleinen Pointer-Schwelle; Breite aus **relativem** Boden-Delta ab Grab-Punkt (`alongWidthDeltaFromMove`), nicht aus dem Absolutabstand festes Ende → Boden-Hit (der lag vor der Fassade und verkürzte die Wand sofort).

**Shift:** Quelle unverändert; `attachAngledWallFromEnd` + `snapBranchYawDeg` (±45°/±90° zur Wand, nicht kollinear). Neue Wand `planLinked` an der gegriffenen Ecke. Dateien: `studio/walls.ts`, `main.ts`.

### Wand-Greifer an der Außenkante (2026-08-28) — v0.7.213 / v0.7.214 / v0.7.215

**Greifer:** `#wall-resize-gizmos` nur bei genau einer Wand-Auswahl. v0.7.216: ohne Taste nur Achse 0° in 48 cm. Raster 48 cm. (Shift-Schwenken der *selben* Wand ab v0.7.217 durch neue Abzweig-Wand ersetzt.)

### Duplizieren in kollinearer Wandkette (2026-08-28) — v0.7.212

**Verhalten:** Mittlere Wand in A–B–C: Duplizieren links/rechts in Richtung eines Nachbarn → Kopie zwischen Quellwand und Nachbar; kollineare Kette ab dem Nachbarn verschiebt sich um die Klonbreite (`collinearChainFromEnd`, `shiftCollinearNeighborsForInsert` in `utils/walls.ts`). Freies Wandende: unverändert außerhalb anfügen. Einfügen aus Zwischenablage analog.

### Links/Rechts aus Blickrichtung (2026-08-28) — v0.7.211

**Problem:** „Nach links/rechts“ folgte der wandfesten Achse (layout +X), nicht der Kamera — bei gedrehten Wänden wirkte die Richtung vertauscht.

**Lösung:** `viewerSideToAlongSign(wall, side, viewerRightX, viewerRightZ)` mappt Nutzer-links/rechts auf ± entlang der Wand via Skalarprodukt Wandtangente · Kamera-Rechts (`viewerRightXZ()` aus Kamera-Quaternion). Verwendet in `duplicateWalls`, `pasteWallsRelativeToTarget`, `duplicateOpenings`, Bibliotheks-Gizmos, Erker-Platzierung und Endstück-Anbindung. Dateien: `studio/walls.ts`, `utils/walls.ts`, `utils/openings.ts`, `main.ts`, `docs/ux.md`.

### Sturz-Laibung, Fensterbank, Paneel-UI (2026-08-28) — v0.7.210

**Sturz-Laibung:** Front-Lippe am Sturz wieder aktiv — Skip galt fälschlich auch Segmente an der Öffnungs-Oberkante (`openingTop - 8`), nicht nur oberhalb der Öffnung. **Außenbank:** Brett-Pivot an Oberkante (`opening.y`), Neigung um Oberkante; Profil-Sweep entlang `layout.yTop` statt `yBottom`. **Paneel-Klick:** Rechte Toolbar zeigt Paneele + Fugen + Paneelfarbe ohne Tab-Wechsel. Dateien: `panelGeometry.ts`, `FacadeController.ts`, `profilePaths.ts`, `main.ts`, Docs.

### 3D-Kamera: Orbit und Schwenk (2026-08-28) — v0.7.209

**Orbit um Gebäude:** `initCameraTarget` nutzt `galleryFocusBounds` (Grundriss XZ inkl. `originX`/`originZ`), nicht `getWallBounds` mit Z=0 — sonst drehte ⌘/Ctrl+Ziehen um einen falschen Punkt. Maus-Orbit über `controls.rotateLeft`/`rotateUp` (OrbitControls-Sphäre) statt manueller `Spherical`-Rechnung.

**Schwenk:** ⌘/Ctrl+⇧+Maus nutzt `keyPanSpeed` (≈7) wie die Pfeiltasten, nicht `panSpeed` (1) — war ~7× zu langsam.

**Modifier:** `modKeyHeld` (Meta/Control keydown/keyup, blur) ergänzt `event.metaKey` am Pointerdown. Dateien: `main.ts`, `docs/camera.md`, `docs/ux.md`.

### Fensterflügel und Außenbank (2026-08-28) — v0.7.208

Bei `panelFlip` zeigt das Fenstermesh nach `yaw+π` mit +Z nach außen — Flügel mit `LEAF_OPEN_INWARD = +1` schwenkten in die Leibung. `leafOpenSignForWall` setzt das Vorzeichen auf −1. Außenbank: Pivot an der äußersten Fassadenfläche (`studioFacadeOutwardLocalZ`), Geometrie nach außen (`outerSillBoardPose`), Gefälle senkt die Tropfkante. Leibungs-Lippe am Sturz (6 cm in die Öffnung) entfällt — wirkte wie ein Kasten. Dateien: `walls.ts`, `gruenderzeit.ts`, `FacadeController.ts`, `panelGeometry.ts`.

### Fenster-Stand vor Rollläden (2026-08-28) — v0.7.207

3D-Rendering von Fenstern/Türen und Bänken auf Git-Stand **vor v0.7.180** zurückgesetzt: `studioWindowOriginZ`, `rotation.y + π`, `WINDOW_RECESS` ohne Boost, Außenbank-Pivot `translate(0,0,depth/2)`. Rollläden, Stil-Vorlagen, Kopieren/Einfügen und Front-Vereinheitlichung bleiben. Dateien: `FacadeController.ts` (`rebuildWindowsForWalls`, `rebuildInnerSills`, `rebuildOuterSills`), `walls.ts` (`studioWindowOriginZ`, `studioWindowDepthForwardSign`).

### Fenster, Bänke und Sturz korrigiert (2026-08-28) — v0.7.206

Der sichtbare „Rollladenkasten“ war der **Sturz-Stopfen** in `gruenderzeit.ts` (Holzquader ~27 cm) — nicht die Rollladen-Lamellen. Stopfen entfernt; Leibungs-Soffit in `panelGeometry.ts` auf ~8–14 cm reduziert. Fenster wieder volle `WINDOW_RECESS` (24 cm), Rotation `yaw + π` nur bei `panelFlip: true`. Außenbank-Pivot: `geometry.translate` entlang `windowDepthForwardSign`. Default `panelFlip: true` in Hydrate/`createStudioWall`. Dateien: `gruenderzeit.ts`, `FacadeController.ts`, `panelGeometry.ts`, `walls.ts`, `hydrate.ts`.

### Kopieren/Einfügen mit Richtung (2026-08-28) — v0.7.205

Wand-Zwischenablage: Rechtsklick **Einfügen** mit Untermenü links/rechts/darüber relativ zur Zielwand (`pasteWallsRelativeToTarget` in `utils/walls.ts`). Gizmo +/−: bei gefüllter Zwischenablage einfügen, sonst Duplizieren. Leere Bühne: unverändert versetzt einfügen. Dateien: `walls.ts`, `main.ts`, Docs.

### Kein Kasten am Fenstersturz, Stil-Vorlagen, Front (2026-08-28) — v0.7.204

Sturz-Stopfen am Blendrahmen (`gruenderzeit.ts`) füllt nur noch die Leibung nach innen — keine Vorsprung-Box vor der Fassade (wirkt sonst wie Rollladenkasten). Stil-Vorlagen: `styleTemplates.ts`, Dialog `#style-template-dialog`, Rechtsklick Wand/Öffnung. Front: `alignOpeningElementsToWallFront`, `unifyGroupFrontOrientation`, `finalizeWallFrontOrientation` in `walls.ts`. Dateien: `gruenderzeit.ts`, `styleTemplates.ts`, `walls.ts`, `main.ts`, Docs.

### Wände wieder sichtbar (2026-08-28) — v0.7.203

Gegenlicht-Shader (`facadeShade.ts`) nutzte `normalMatrix` im Fragment — Three.js deklariert das nur im Vertex-Prefix, das Programm schlug fehl und opake Fassaden-Meshes verschwanden (Glas blieb). Fassadenrichtung jetzt im Vertex nach View-Space (`vFacadeView`). Dateien: `facadeShade.ts`, Docs.

### Rollläden ohne Kasten, Front beim Verbinden, Gegenlicht (2026-08-28) — v0.7.202

Kein Rollladenkasten und keine Führungsschienen — nur Lamellen, `enabled` default aus. Beim Andocken/Verbinden: `inheritWallFrontFromNeighbor` übernimmt die Welt-Front der bestehenden Wand (kollinear auch nach 180°-Yaw). Gegenlicht: Shader `facadeShade.ts` dämpft Direct+Hemi auf Seiten/Oberseiten, Front ohne Shadow-Map (keine Schraffur). Dateien: `rollerShutter.ts`, `FacadeController.ts`, `walls.ts`, `main.ts`, `facadeShade.ts`, Docs.

### Schrift zentriert mit 64 cm Abstand von oben (2026-08-28) — v0.7.201

Standard-Anker beim Aktivieren: `defaultWallLabelAnchor` — horizontal zentriert (`x = wall.width/2`), Oberkante 64 cm unter Wandoberkante (`y = wall.height - 64 - heightCm`). `syncWallLabelDefaultPlacement` bei Aktivierung; Freistreifen nutzt dieselbe Position statt Randverschiebung. Dateien: `wallLabel.ts`, `main.ts`, Docs.

### Schrift auf der Wandfläche (2026-08-28) — v0.7.200

Freistreifen: `wallLabelSurfaceLocalZ` nutzt `studioWallOuterFaceLocalZ` statt Bossen-Spitze; Labels in `claddingGroup`. Dateien: `labelGeometry.ts`, `walls.ts`, `FacadeController.ts`, Docs.

### Schrift bleibt sichtbar (2026-08-28) — v0.7.199

Beschriftung `receiveShadow = false` — Wand-/Eigen-Schatten verdunkeln die Schrift nicht. Extrudiert: `polygonOffset` gegen Z-Fight. Dateien: `FacadeController.ts`, `labelGeometry.ts`, Docs.

### Wandschatten mit aktiver Schrift (2026-08-28) — v0.7.198

Bei extrudierter Beschriftung: Wandkörper `castShadow` bleibt an (Bodenschatten); nur Gesims/Zierband ohne Cast auf Freistreifen. Dateien: `FacadeController.ts`, Docs.

### Fenster an den Rand, Schrift-Schatten, Kopieren/Einfügen (2026-08-27) — v0.7.188

`clampOpeningToWall` ohne Kanten-Inset; Slot-Suche ohne Rand-Margin. `syncLabelShadowReceivers`: kein Wand-Selbstschatten und kein Gesims-Cast auf Freistreifen mit Schrift. Rechtsklick-Geometrie-Zwischenablage (Öffnung/Fassade/Haus) inkl. Einfügen auf leere Bühne. Dateien: `validation.ts`, `openings.ts`, `FacadeController.ts`, `buildings.ts`, `main.ts`, Docs.

### Bloom mit echtem MSAA (2026-08-27) — v0.7.187

EffectComposer bekommt ein `WebGLRenderTarget` mit bis zu 8 Samples (`renderer.capabilities.maxSamples`). SMAA nur noch ohne GPU-MSAA. Dateien: `main.ts`, Docs.

### Bloom scharf (Pixel-Ratio + SMAA) (2026-08-27) — v0.7.186

Composer synchronisiert `setPixelRatio` mit dem Renderer (Orbit-Lite hatte die Bloom-RTs oft bei 1× belassen). Half-Res-Override am Bloom-Pass entfernt. `SMAAPass` vor `OutputPass` gegen Treppchen ohne MSAA. Dateien: `main.ts`, Docs.

### Bloom-Defaults und Belichtung (2026-08-27) — v0.7.185

Neue Defaults in `DEFAULT_BLOOM_SETTINGS` / `index.html`. `applyBloomRenderer` setzt bei Bloom wieder ACES + `exposure ** 4` (vorher fest `NoToneMapping` / Exposure 1). `applySceneBackground` überschreibt Tone-Mapping nicht mehr. Dateien: `bloom.ts`, `main.ts`, `roomEnvironment.ts`, Docs.

### Bloom beim Navigieren, 32-cm-Raster, weiße Szene (2026-08-27) — v0.7.184

Bloom bleibt während Orbit-Lite an (`render3dFrame` ohne `!orbitLite`-Gate). Platzierungsraster Boden/Wand und Öffnungs-/Schrift-Position auf `STUDIO_TILE` (32 cm). Szenenfarben Default weiß; UI `#scene-all-color` setzt Hintergrund/Untergrund/Himmel gemeinsam. Dateien: `main.ts`, `placementGrid.ts`, `openings.ts`, `persistence.ts`, `index.html`, Docs.

### Extrudierte Schrift wirft Schatten auf die Fassade (2026-08-27) — v0.7.183 / v0.7.182 / v0.7.181

**Dateien:** `src/FacadeController.ts`, `src/studio/labelGeometry.ts`, `docs/shadows.md`

Schrift castet; `syncLabelShadowReceivers` lässt nur den **Wandkörper** empfangen (Freistreifen). Paneele/Mörtel bleiben ohne Empfang — Empfang auf Paneelen erzeugte wieder die Zoom-Schraffur (v0.7.140) und wirkte dunkler an Wänden mit 3D-Schrift.

### Schrift-Punzen, Rollläden-Tab, negativer Versatz (2026-08-27) — v0.7.180

**Dateien:** `scripts/ttf-to-typeface.mjs`, `public/fonts/Federo-Regular.typeface.json`, `src/studio/labelGeometry.ts`, `src/utils/wallLabel.ts`, `src/main.ts`, `index.html`, `docs/ux.md`, `docs/roller-shutter.md`

Typeface-Konverter sortiert Außenkontur vor Löchern (sonst verliert `ShapePath.toShapes` Punzen wie beim `&`). Rollläden-Reiter bleibt bei Fenster/Tür sichtbar, unabhängig von der Checkbox. Schrift-`offsetForward` erlaubt negativ (nach hinten), Placement ohne Clamp auf die Front.

### Schrift „Mit Tiefe“ auch mit & (2026-08-27) — v0.7.179

**Dateien:** `src/studio/labelGeometry.ts`, `src/studio/labelGeometry.test.ts`, `docs/ux.md`

Texte mit `&` (z. B. „Brot & Brötchen“) fielen bei „Mit Tiefe“ still auf die flache Canvas-Plane. Federo kann `&` extrudieren; der Fallback ist entfernt.

### Schrift „Mit Tiefe“ dreidimensional (2026-08-27) — v0.7.178

**Dateien:** `src/studio/labelGeometry.ts`, `src/FacadeController.ts`, `src/main.ts`, `docs/ux.md`

Extrudierte Beschriftung lag auf der Paneelfläche ohne Bosse und wirkte eingebettet. Placement jetzt über `studioFacadeOutwardLocalZ`; bei fehlendem Typeface kein Flach-Fallback; Font-Retry und Laden vor dem Umschalten auf „Mit Tiefe“.

### Rollläden mit Höhe und Animation (2026-08-27) — v0.7.177

**Dateien:** `src/studio/rollerShutter.ts`, `src/FacadeController.ts`, `src/utils/openings.ts`, `src/utils/hydrate.ts`, `src/types/facade.ts`, `index.html`, `src/main.ts`, `docs/roller-shutter.md`

Neuer Tab **Rollläden** (Default aus) für Fenster/Tür: gewölbte Lamellen, `drop` 0…1, Spalt beim Absenken und Stapel unten, eigene Hoch-/Runter-Kurven und Playback ohne Mesh-Rebuild (`applyRollerShutterDrop`).

### Farbe & Oberfläche pro Element, Seitenspalte (2026-08-27) — v0.7.176

**Dateien:** `index.html`, `src/main.ts`, `src/types/facade.ts`, `src/utils/openings.ts`, `src/utils/cornice.ts`, `src/utils/profilePaths.ts`, `src/utils/wallLabel.ts`, `src/studio/pediment.ts`, `src/studio/labelGeometry.ts`, `src/FacadeController.ts`, `docs/ux.md`

Separates Einfärben und Finish (`matte`/`glossy`/`metal`) für Wand, Paneele, Profile, Gesims, Schrift, Rahmen, Rahmenprofil, Bänke, Verdachung, Treppe. Teil-Selektion in 3D behält Fokus und filtert rechte Tabs; Rahmen/Glas nur bei Öffnungsauswahl.

### Dock 0,5+0,5 visuell, Plus wie Duplizieren (2026-08-27) — v0.7.175

**Dock-Fuge:** Kein geometrisches Überspannen in die Nachbarwand. 0,5+0,5 bleiben zwei Kacheln in ihren Wänden; `flattenDock*` setzt den Chamfer der Innenseiten auf 0 — visuell ein Stein. 1+1 unverändert mit `jointStart`/`jointEnd` und vollem Trapez. Dateien: `panelLayout.ts`, `panelGeometry.ts`, `openingGeometry.ts`.

**Wand-+:** `runDuplicateWalls(side, { wallIds: [Auswahl] })` — identisch zur Toolbar „Duplizieren“, ohne Preset-Platzierung und ohne `planLinked`-Snap.

Dateien: `main.ts`, Docs.

### Läuferverband bei geänderter Steinbreite (2026-08-27) — v0.7.174

**Ursache:** `collinearChainOffset` hat den Reihenversatz nur als Ja/Nein an `buildOffsetStretcherCuts` übergeben. Sobald die Steinbreite die vorherige Wandlänge nicht teilte, nutzten gerade und versetzte Lagen dasselbe Raster — einheitliche Kästchen ohne Versatz.

**Fix:** Jede Wand behält ihr Verbandmuster unabhängig von der Dock-Kette. `courseEndWidth` wickelt den Versatz in eine echte Endstückbreite (½, ⅓, ¼). Schmale Paneel-Reste neben Öffnungen mergen erst unter halber Steinbreite, damit 0,5+0,5 im Pfeiler bleiben.

Dateien: `panelLayout.ts`, Docs.

### Plus dockt wie Duplizieren, Gizmos sofort (2026-08-27) — v0.7.173

**Ursache:** Der laufende Vite-Server blieb auf 0.7.169; Plus rief Duplizieren ohne `planLinked` auf (Kopie nicht im Grundriss); Gizmos nur im Render-Loop.

**+ links/rechts:** `duplicateWalls(..., { planLinked: true })` + `linkStudioWalls` + `finalizeStudioGeometry`. Endstück nur bei bewaffnetem Endstück-Preset.

**Gizmos:** `camera.updateMatrixWorld` vor Projektion; Update direkt in Orbit-`change`, Pfeiltasten und 3D-Nav.

**1+1-Trapez:** Chamfer auch wenn die Kachel an `wall.width − joint/2` endet.

Dateien: `walls.ts`, `main.ts`, `panelGeometry.ts`, Docs.

### 1+1 Bossen-Trapez an Dock-Fuge (2026-08-27) — v0.7.172

1+1-Kacheln mit `jointStart`/`jointEnd` setzen `keepBossChamferStart`/`End`. `extrudeFrustum` glättet Chamfer nur noch bei über die Fuge gespannten Merges (0,5+0,5) und Streifen — nicht bei getrennten 1+1. Dateien: `panelLayout.ts`, `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Dock: 0,5+0,5 wieder ein Stein (2026-08-27) — v0.7.171

`dockHalfHalfMerge` wieder aktiv: zwei Binder-Köpfe an der kollinearen Dock-Fuge werden ein Stein; 1+1 bleiben mit `jointStart`/`jointEnd` und Chamfer getrennt. Dateien: `panelLayout.ts`, Docs.

### Wand-+ wie Duplizieren, Gizmos an Wand (2026-08-27) — v0.7.170

**+ links/rechts:** nutzt dieselbe Versatz-Logik wie Toolbar „Duplizieren“ (`runDuplicateWalls` / `duplicateWalls`). Endstück-Preset weiter über + ansetzbar.

**Gizmos:** `updateWallLibraryGizmos` / `updateSelectionRotateOverlay` auch während Orbit (`orbitLite`), damit die Buttons an der Wand bleiben.

Dateien: `main.ts`, Docs.

### Dock 1+1, Bossen-Vorstand, Wand-+ (2026-08-27) — v0.7.169

**Dock-Fuge:** 1+1 getrennt mit Chamfer. 0,5+0,5 war hier fälschlich mitgetrennt — korrigiert in v0.7.171.

**Bossen-Vorstand:** `extrudeFrustum` skaliert die Gehrung mit `projectDepth + taperDepth`, damit die Bossen-Front bei geändertem Vorstand mitwandert.

Dateien: `panelLayout.ts`, `panelGeometry.ts`, `main.ts`, Docs.

### Bibliothek: Wand +/− bei Auswahl, 1-px-Umrandung (2026-08-27) — v0.7.168

+/− links/rechts/oben an der markierten Studio-Wand immer sichtbar (nicht erst nach Bibliothek-Klick). + nutzt bewaffnetes Preset oder Fallback gleiche Länge; Projektion über `siteOffset.localToWorld`. Aktive Bibliothekskarte: **1 px** schwarz (`.library-card-applied`).

### Bibliothek: Plus/Minus an der Wand, aktive Kachel (2026-08-27) — v0.7.167

Bei markierter Studio-Wand setzt ein Klick auf eine Wand-Karte (ohne Ziehen) das Preset als bewaffnet. An der Auswahl erscheinen +/− links, rechts und oben (`#wall-library-gizmos`). + links/rechts legt das Preset daneben (`buildStudioWallAt`, Optik von der Auswahl, Verknüpfung); + oben ruft `insertStoreyAbove` mit Dialog `#storey-copy-dialog` (Standard: alles). − entfernt den Nachbarn bzw. die Wand darüber. Die Ursprungswand bleibt ausgewählt. Ziehen in die Bühne unverändert.

Bibliothekskarten, die schon zur Auswahl gehören, erhalten `library-card-applied` (2 px schwarz). Ohne Auswahl ist „Keines“ umrandet.

`insertStoreyAbove` akzeptiert `copy?: Partial<StoreyCopyOptions>`. Dateien: `main.ts`, `walls.ts`, `index.html`, `style.css`.

### Dock: 0,5+0,5 wieder ein Stein (2026-08-27) — v0.7.166

**Merge:** Zwei Binder-Köpfe (~½ Läufer) an einer kollinearen Dock-Fuge werden wieder ein Stein (`dockHalfHalfMerge` in `panelLayout.ts`), auch wenn die Versatzlage ein paar cm Rest auf die Köpfe verteilt (bis 0,75× Paneelbreite). 1+1 bleibt zwei Steine mit normaler Fuge. Reste &lt;0,49× Paneelbreite werden weiter vom vollen Nachbarn aufgenommen.

v0.7.164 hatte 0,5+0,5 fälschlich wie 1+1 mit `jointStart`/`jointEnd` getrennt. **v0.7.169:** Merge wieder aufgehoben — getrennte Steine mit Chamfer.

### Öffnungs-Animation, Kurveneditor (2026-08-27) — v0.7.165

**Flügelbewegung:** `Opening.motion` mit getrennten Kurven für Öffnen/Schließen (`t`/`v`/`ease`, Dauer, Pause). Eval in `openingMotion.ts` (linear oder Catmull-Rom). Pivots tragen `userData.leafMotion`; Abspielen dreht ohne Mesh-Rebuild (`FacadeController.applyOpeningLeafDegrees`).

**UI:** Reiter Animation an Fenster/Tür (`#opening-motion-section`): Phasen, Vorlagen Fenster/Haustür/Linear, SVG-Punkteeditor, Play/Zyklus, JSON-Datensatz `fassaden-opening-motion/v1`.

**Persistenz:** Hydrate-Default nach Typ, kein Schema-Step. Ruhewinkel (`leafOpenDeg`) unverändert bis Play-Ende.

Dateien: `openingMotion.ts`, `openingMotionEditor.ts`, `hydrate.ts`, `openings.ts`, `gruenderzeit.ts`, `FacadeController.ts`, `main.ts`, `index.html`, `docs/opening-motion.md`.

### Kompass-Ausrichtung, Erker-Fronten, Edit-Scope (2026-08-27) — v0.7.158

Bibliothek-Wand: `wallDockAxisFromFacadeYaw` + `adjustDockOrientation` mit Kompass-Yaw (`compass.ts`, `main.ts`). Erker: je Wandfläche eigene `panelFlip` (`outwardPerpendicularAtCorner`, `bayWindow.ts`); Erker-Wände `planLinked` für Gehrung. Edit-Scope: „Auswahl“ statt „Element“; Fassade = `wallsForYaw`; Zierbänder scoped per Index + Öffnungs-Ausschnitt (`trimBands.ts`, `profilePaths.ts`).

### Wand-Front zur Kamera, Dock-Fuge, 1er-Steine (2026-08-27) — v0.7.164

**Platzierung:** Freie Bibliothek-Wand in 3D nutzt `viewedFacadeYaw` (Front zur Kamera = entgegengesetzt zur Blickrichtung). Blick S/W → Fassade N/O, Front auf der Nordseite einer Ost-West-Wand (`main.ts`).

**1er-Steine:** Kein Chamfer-Glätten und keine Überlappung bei 1+1; stattdessen normale Fuge (`jointStart`/`jointEnd`). Merge nur wenn der Nachbar &lt;0,49× `panelWidth` ist (Roh-Schnittbreite, nicht fugenbereinigt). **0,5+0,5** war hier fälschlich mitgetrennt — korrigiert in v0.7.166.

**Lücke:** `panelMiterEnds` / `plinthMiterEnds` / `corniceMiterEnds` nicht an kollinearen Docks. Streifen überlappen und ohne Seitenkappen; Sockel ohne Stirnflächen am Dock.

### Dock-Fuge, Merge-Regel, Sockel-Versatz (2026-08-27) — v0.7.163

**Merge-Regel:** Voller Stein + Randstein &lt;0,49 → kleiner Stein entfällt, voller Stein verlängert sich über die Dock-Fuge (`dockRowTileOpts`, `tilesAlongRow`). Zwei volle Steine bleiben getrennt.

**Paneel-Lücke:** Bossen-Chamfer an kollinearen Dock-Kanten immer unterdrückt (auch bei vollen Steinen); `dockPad` = volle Fugenbreite.

**Sockel:** `plinthOffsetForward` standardmäßig 0 cm (`constants.ts`, UI-Fallbacks).

### Dock-Merge, Zierband-UI, Sockel-Freiraum (2026-08-27) — v0.7.162

**Zierband-UI:** `.trim-band-block` / `.trim-band-row` mit `flex-wrap` — Eingabefelder umbrechen statt aus der Sidebar zu ragen (`style.css`, `main.ts`).

**Dock-Merge 0,49:** Voller Stein (~1× `panelWidth`) trifft auf Randstein <0,49× `panelWidth` → ein Stein; zwei volle Steine bleiben getrennt. Nachbar-`colCuts` pro Reihe via `computeRowColCuts` (`panelLayout.ts`).

**Paneel-Dock:** `dockPad` auf 0,85× Fuge vergrößert (`panelGeometry.ts`).

**Bodentür-Linie:** Kein Bodenquad bei Boden-Türen; `groundNotches` nutzt `openingWallFaceMaskPolyline`; Schwelle 8 cm unter y=0 (`openingGeometry.ts`, `panelGeometry.ts`).

**Sockel-Freiraum:** `plinthOpeningXHoles` und `plinthClipOpenings` berücksichtigen `openingPanelClearance` wie Zierbänder (`profilePaths.ts`, `panelGeometry.ts`).

### Dock-Regel, Erker-Breite, Zierband (2026-08-27) — v0.7.161

**Universelle Dock-Fuge:** `findCollinearDockWall` findet Nachbarn rein geometrisch (`ignorePlanLink`); gilt für Wandkörper, Paneele und Bossen. Jede Wand legt den Verband lokal (gerades 1/1 vs. versetztes 0,5/1/…); die Dock-Fuge verschmilzt 0,5+0,5 bzw. hält 1+1 mit Fuge. Randsteine überlappen leicht in 3D (`panelGeometry.ts`, `panelLayout.ts`, `walls.ts`).

**Paneel-Laibung:** `MAX_JAMB_SEAL` vergrößert; `sealTilesToOpeningJambs` schließt schmalere Spalten neben Öffnungen.

**Bodentür-Linie:** Kein Bodenring unter Boden-Türen; Wandloch mit `openingWallFaceMaskPolyline` 3 cm unter die Schwelle verlängert (`openingGeometry.ts`, `panelGeometry.ts`).

**Erker-Front:** Rechteckige Erker nutzen `frontWidthCm` der Presets (192/384) statt gemessener Schenkel-Distanz (`bayWindow.ts`).

**Zierband-UI:** Profilpicker, Höhe (`scale`), Tiefe (`sectionScaleForward`), Vorstand — analog Gesims (`main.ts`, `trimBands.ts`, `facade.ts`).

### Gesims-Anker, Erker-Auswahl, Kamera (2026-08-27) — v0.7.160

**Gesimse:** Studio-Wände nutzen keinen Legacy-`CLADDING_OFFSET_V1` mehr in Profilpfaden; `studioProfileAnchorLocalZ` verankert auf Paneelfläche statt Bossen-Spitze; bei nackter Wand (`hideRowsTop`) `useWallOuterFace` (`profilePaths.ts`, `walls.ts`, `FacadeController.ts`).

**Erker-Auswahl:** `bayWallSelectionIds` — Klick auf Schenkel oder Parent selektiert alle `bayWindow.wallIds` plus Parent (`bayWindow.ts`, `main.ts`).

**Seitenfugen:** Kollineare Dock-Kanten blenden Seitenkappen immer aus, unabhängig von Paneelen (`panelGeometry.ts`).

**Kamera:** `rotateSpeed` 1.35, Bloom bleibt während Orbit-Lite an (v0.7.184), `ORBIT_LITE_HOLD_MS` 320 ms (`main.ts`).

### Dock-Fuge, Freiraum, Dekor-Sync (2026-08-27) — v0.7.159

**Reihen oben ausblenden:** `syncWallDecorToTopBareBand` verschiebt neben Schrift auch Zierbänder aus dem ausgeblendeten oberen Streifen auf die nackte Wand (`wallLabel.ts`, `main.ts`).

**Wand ohne Paneele:** `createStudioWallGeometry(wall, allWalls)` unterdrückt Seitenflächen an kollinearen Dock-Kanten (`panelGeometry.ts`, `FacadeController.ts`).

**Zierband + Freiraum:** `trimBandOpeningXHoles` berücksichtigt `openingPanelClearance`; Freiraum-SVG ohne Sohlbank als U-Band (`profilePaths.ts`, `openingGeometry.ts`, `FacadeSvgView.ts`).

**Dock-Merge:** Nur explizite Halb-Endsteine (`half` / `alternate`-Reihe), nicht `full`; End-Merge prüft Segmentbreite und nutzt `wall.width - header` (`panelLayout.ts`).

**Tür-Sohlbank:** 3D-Freiraum-Kappe ohne Bodenring (`appendClearanceRingFaces`); Wand-Bodenquads schneiden Freiraum mit (`panelGeometry.ts`).

### Layout-Reparatur rechte Spalte (2026-08-26) — v0.7.157

Tür-Toolbar-Fix (v0.7.156) schloss `#opening-measures-section` korrekt, aber ein überzähliges `</div>` vor `#lighting-accordion` beendete `#ui-right` zu früh — `#lighting-accordion` landete als viertes Grid-Kind von `#app` und zerstörte das 3-Spalten-Layout. Entfernt: ein schließendes `</div>` nach `#toolbar-opening`. Datei: `index.html`.

### Platzierungs-Raster, Hilfslinien, Zierbänder (2026-08-26) — v0.7.156

8-cm-Raster beim Verschieben/Platzieren (`placementGrid.ts`): Boden bei Wand-Drag/Drop, Wandfläche bei Öffnungs-Drag. Wand-Hilfslinien (`wallGuides.ts`) für Enden/Mitten. Tür-Toolbar: fehlendes `</div>` in `index.html` behoben. Freiraum-Band ohne Sohlbank-Linie (`openingClearanceBandSvgPath`). Zierbänder (`WallTrimBand`, `trimBands.ts`, `buildTrimBandPaths`). Paneele: halbe Endsteine an Dock-Fuge → ganzer Stein (`panelLayout.ts`).

### Erker-Geometrie, Balkon, Tabs (2026-08-26) — v0.7.155

Bogenlänge numerisch (`partialEllipseArcLength`); `wallSpanAlongYaw` für Ellipsen-Position; 45°-Erker rechte Seite +135°; `panelFlipForExteriorNormal`; Balkon/Loggia-Brüstung 96×16 cm, `bayRole: back`; Öffnungs-Tabs zurück. Dateien: `arcWall.ts`, `bayWindow.ts`, `walls.ts`, `main.ts`.

### Erker-Bogen, Gesims, Schrift, LOD, Öffnungs-Toolbar (2026-08-26) — v0.7.154

Runder Erker: eine `arcBay`-Wand (`src/studio/arcWall.ts`, `createArcBayWallGeometry`) statt Facetten. Gesims nur oben. Wandschrift zentriert/48 cm, kein Sprung beim Speichern, Paneel-Anker. LOD-Presets aus wenn deaktiviert. Öffnungs-Toolbar ohne Tab-Filter. Dateien: `arcWall.ts`, `panelGeometry.ts`, `bayWindow.ts`, `labelGeometry.ts`, `wallLabel.ts`, `cornice.ts`, `main.ts`, `index.html`, Docs.

### Wand-Andocken, Loslösen, Bibliothek-Tabs, Ellipsen-Erker (2026-08-26) — v0.7.153

`insertStoreyAbove` stapelt Fläche-auf-Fläche. Dock-Stil kopiert optional die Höhe. Loslösen trennt Plan-Link und Gruppe. Bibliothek: Tabs Erker/Balkon/Loggia; Wand-Presets mit Öffnung. `bayWindow.ts`: Außenflächen-Ansatz, `planLinked` + Gehrung, runder Erker über `roundBayArcPoints` (Ellipse, 24 Facetten). Dateien: `walls.ts`, `main.ts`, `bayWindow.ts`, `presets.ts`, `index.html`, Docs.

### Weitere Fenster-/Tür-Presets (2026-08-26) — v0.7.152

`WALL_OPENING_PRESETS`: Türen **288×320**, **480×320**; Fenster **396×196**, **192×192**, **96×264**, **48×96** (144×320 und 144×192 waren schon da). Galerie übernimmt den Katalog automatisch. Dateien: `presets.ts`, Docs.

### Szeneneinstellungen ohne Auswahl (2026-08-26) — v0.7.151

`#lighting-accordion` ist wieder **Geschwister** von `#selection-toolbar` unter `#ui-right` (nicht mehr darin genestet). Ohne Auswahl bleibt die Szene-UI sichtbar, weil `selection-toolbar[hidden]` sie nicht mehr mit ausblendet. Dateien: `index.html`, Docs.

### Freie 3D-/Galerie-Navigation (2026-08-26) — v0.7.150

Orbit ohne Polar-Limit (`0`…`π`, auch unter den Boden). Galerie: größeres `maxDistance` (~5200) und Cull (~3800), schnelleres Screen-Space-Pan. Dateien: `main.ts`, `galleryCamera.ts`, Docs.

### Mauerwerk-Clip Nicht-Rundbogen (2026-08-26) — v0.7.147

`snapOpeningHolesToTileGrid` / `clipTileAgainstOpenings` stanzen bei Bogenformen wieder das Körper-Rechteck aus `openingClipRects` (nur Stadion-Ausschnitte ohne Rechteckloch). Kronen-Clip bleibt über `clipPolysMinusArches` + `openingArchOutline`. Laibungs-Siegel: `openingArchSpringY` wenn kein `openingArchGeom`. Regression: `archOpeningMasonryClip.test.ts`.

### Bogenformen Öffnung & Verdachung (2026-08-26) — v0.7.146

Gemeinsames Modul `archForms.ts` (`ArchFormId`, Rise-Ratios, `sampleArchCrown`, Preview-SVG). `OpeningArch.form` mit Migration (`enabled` ohne `form` → `round`); Maske/Clip/Profile/Glas über `openingArchOutline`; Voussoirs nur `round`. Verdachung teilt den Sampler; UI-Karten `#opening-arch-form-cards` / `#pediment-form-cards`. Dateien: `archForms.ts`, `openingGeometry.ts`, `pediment.ts`, `windowLod.ts`, `gruenderzeit.ts`, `index.html`, `main.ts`, Docs.

### Galerie Nahzoom flüssig (2026-08-26) — v0.7.145

Distanz-Culling entfernter Galerie-Wände (ein Gebäude ohne LOD), adaptiver Zoom nahe am Orbit-Ziel, engeres `camera.near/far`. Dateien: `galleryCamera.ts`, `FacadeController.ts`, `main.ts`, Docs.

### Sonne: Datum/Zeit vs. manuelle Slider (2026-08-26) — v0.7.144

Datum und Tageszeit schreiben Azimut, Elevation, Intensität, Weichheit und Kelvin aus dem Berlin-Stand. Winkel-/Intensitäts-/Weichheits-/Kelvin-Slider bleiben Overrides bis zum nächsten Solar-Scrub. `SunSettings.elevationRad` persistent; `sunFromTargetDirection` nutzt gespeicherte Elevation. Dateien: `sunLighting.ts`, `main.ts`, `index.html`, Docs.

### Schrift nicht mehr durch Wände (2026-08-26) — v0.7.143

**Dateien:** `src/studio/labelGeometry.ts`, `docs/ux.md`

Flache Wandbeschriftung: `depthTest: true` (mit `polygonOffset`) — kein X-Ray durch andere Wände; bleibt knapp vor der eigenen Fassade.

### Galerie-Navigation um einzelne Wände (2026-08-26) — v0.7.142

**Dateien:** `src/gallery/galleryCamera.ts`, `src/main.ts`, `docs/gallery.md`

Orbit-Ziel folgt der angeklickten Wand; Doppelklick rahmt neu ein. Einstieg nur erste Reihe; `maxDistance` in der Galerie begrenzt (flüssig), `camera.far` bleibt groß.

### Galerie-Ansicht QA (2026-08-26) — v0.7.141

**Dateien:** `src/gallery/*`, `src/ui/galleryMode.ts`, `src/main.ts`, `index.html`, `docs/gallery.md`

Eigener Galerie-Modus (`#gallery`): alle Wandlängen × Paneelstile, Öffnungen, Erker und Zufallsblock im 320-cm-Raster. Projekt-Snapshot beim Eintritt; keine Persistenz der Galerie.

### Laibung bündig, Paneele ohne Schraffur (2026-08-26) — v0.7.140

**Dateien:** `src/studio/panelGeometry.ts`, `src/FacadeController.ts`, `docs/shadows.md`

Öffnungs-Tunnel aus dem sichtbaren Wandkörper in unsichtbare Shadow-Occluder (`colorWrite: false`). Paneele/Mörtel/Laibung ohne `receiveShadow` (weiterhin `castShadow`). Bodenschatten und Licht durch die Wandstärke bleiben.

### Quellen nur Positivliste (2026-08-26) — v0.7.139

**Dateien:** `src/credits.ts`, `src/ui/creditsDialog.ts`, `src/style.css`, `docs/credits.md`

Quellen-Dialog ohne Abschnitt „Nicht verwendet“ — nur Bibliotheken/Schriften und selbst implementierte Verfahren.

### Weniger Lichtlecks, Weichheit, Andock-Orange (2026-08-26) — v0.7.138

**Dateien:** `src/studio/panelGeometry.ts`, `src/FacadeController.ts`, `src/utils/sunLighting.ts`, `src/main.ts`, `docs/shadows.md`, `docs/ux.md`

Öffnungs-Tunnel in der Wandgeometrie + Laibung `shadowSide: DoubleSide` gegen Licht durch die Wandstärke. `shadow.radius` wieder 0,5…8. `normalBias` gesenkt (weniger Peter-Panning). Wand-Verschieben: Andock-Orange an der Etage der gezogenen Wand, pro Ende nur die nächste Fläche.

### Längere, passendere Bodenschatten (2026-08-26) — v0.7.137

**Dateien:** `src/utils/sunLighting.ts`, `src/utils/sunLighting.test.ts`, `src/main.ts`, `src/FacadeController.ts`, `src/studio/windowLod.ts`, `src/credits.ts`, `docs/shadows.md`

Eigenes Shadow-Frustum: Gebäude-AABB plus Bodenprojektion der Sonnenstrahlen (Länge begrenzt), Ortho-Seiten auf Texelraster. Paneele/Mörtel/Sockel/LOD-Rahmen werfen Schatten. PCFShadowMap (Three.js-API, MIT). Kein CSM-Addon, kein kopierter Fremdcode.

### HDRI entfernt, Quellen neben der Version (2026-08-26) — v0.7.136

**Dateien:** `src/studio/roomEnvironment.ts`, `src/credits.ts`, `src/ui/creditsDialog.ts`, `src/utils/persistence.ts`, `index.html`, `src/main.ts`, `src/style.css`, `vite.config.ts`, `docs/credits.md`

HDRI vollständig entfernt (`.hdr`-Datei, RGBELoader, Szene-Schalter, Persistenzfelder). Glas/Glanz nutzen weiter importiertes Three.js-`RoomEnvironment` als Material-EnvMap, `scene.environment` bleibt `null`. Neben der Versionsnummer: Dialog **Quellen** (Bibliotheken, Schriften, Verfahren; ab v0.7.139 nur Positivliste).

### Glanz, Schrift-Freistreifen, Verdachungs-Lift (2026-08-26) — v0.7.135

**Dateien:** `src/utils/surfaceFinish.ts`, `src/utils/threeColors.ts`, `src/studio/hdriEnvironment.ts`, `src/utils/wallLabel.ts`, `src/studio/openingProfileLift.ts`, `src/main.ts`

Glänzend/metallisch: RoomEnvironment-EnvMap am Material (sichtbar ohne HDRI). Schrift: Platzierung im oberen Freistreifen auch wenn Streifen < Schrifthöhe. Verdachungs-Lift = skalierte Outward-Höhe des Sturzprofils (`extentOutCm` / Scale), identisch zum Mesh.

### Schrift-Freistreifen, Profil-Maße, Oberflächen (2026-08-26) — v0.7.134

**Dateien:** `src/utils/wallLabel.ts`, `src/utils/profileSectionExtents.ts`, `src/utils/surfaceFinish.ts`, `src/utils/threeColors.ts`, `src/studio/openingProfileLift.ts`, `src/studio/pedimentGeometry.ts`, `src/FacadeController.ts`, `src/utils/profilePaths.ts`, `index.html`, `src/main.ts`

Aktive Schrift rückt in den nackten Streifen über ausgeblendeten oberen Paneel-Reihen, sobald der Streifen ≥ Schrifthöhe ist. Rahmenprofil/Verdachung: `extentOutCm` / `extentForwardCm` (Höhe/Länge und Tiefe); Lift der Verdachung bevorzugt `extentOutCm`. Wand/Paneele/Profile: `wallFinish` / `claddingFinish` / `profileFinish` (`matte` \| `glossy` \| `metal`) steuern Roughness/Metalness/EnvMap.

### Verdachung über Profil, Canvas-Breite (2026-08-26) — v0.7.133

**Dateien:** `src/studio/openingProfileLift.ts`, `src/studio/pediment.ts`, `src/studio/pedimentGeometry.ts`, `src/utils/openings.ts`, `src/main.ts`, `src/style.css`, `index.html`, `src/FacadeSvgView.ts`

Verdachung: automatische Anhebung um Sturzprofil plus `offsetUp`. Linke Spalte einklappen: Renderer folgt der Viewport-Größe (`ResizeObserver`), keine Lücke rechts. Keilstein-Vorschau nur bei aktivem Ring. `#reset-opening` setzt Öffnung auf Bibliotheks-Defaults (Lage/Größe bleiben).

### Glatte Wände ohne Schraffur (2026-08-26) — v0.7.132

**Dateien:** `src/FacadeController.ts`

Wandkörper empfängt wieder keine Shadow-Map (wie v0.7.111). Sockel (Platte und Profil) weder cast noch receive — Selbstschatten auf der langen Fläche wirkte beim Zoomen wie ein Röhrenmonitor. Materialien `shadowSide: FrontSide`. Schrift-Schatten bleiben auf Paneelen.

### Verdachung an Fensterbreite, Schrift (2026-08-26) — v0.7.131

**Dateien:** `src/studio/pediment.ts`, `src/studio/pedimentGeometry.ts`, `src/studio/openingProfileLift.ts`, `src/studio/labelGeometry.ts`, `scripts/ttf-to-typeface.mjs`, `public/fonts/Federo-Regular.typeface.json`, `src/FacadeController.ts`, `src/main.ts`, `src/FacadeSvgView.ts`

Verdachung immer Öffnungsbreite + Überstand (Giebelbreite/Seitenlinien ignoriert). Geschlossenes Dreieck: Closed-Loop mit Gehrung nach außen; Segment zu: Bogen + Sturz. Lift um oberes Öffnungsprofil. Federo ohne Kontur-Reverse; extrudierte Schrift ohne `rotateZ`, 1,2 cm vor der Fassade, wirft Schatten wie Profile.

### Geschlossene Verdachung, Schrift aufrecht (2026-08-26) — v0.7.125

**Dateien:** `src/studio/pediment.ts`, `src/studio/pedimentGeometry.ts`, `src/studio/labelGeometry.ts`, `scripts/ttf-to-typeface.mjs`, `public/fonts/Federo-Regular.typeface.json`, `index.html`, `src/main.ts`, `src/style.css`

Geschlossene Giebel (`triangleClosed` / `segmentClosed`) spannen nur `gableWidth` × `gableHeight` — `x0`/`x1` = Giebelkanten, keine horizontalen Seitenarme. Federo-Typeface mit Y-Inversion (facetype.js); extrudierte Schrift `DoubleSide`, `rotateZ(π)` aufrecht, Abstand 0,2 cm, wirft Schatten. Textfeld: Button Speichern + Enter.

### Schrift-Kurven und Schatten (2026-08-26) — v0.7.126–v0.7.130

**Dateien:** `scripts/ttf-to-typeface.mjs`, `public/fonts/Federo-Regular.typeface.json`, `src/studio/labelGeometry.ts`, `src/FacadeController.ts`, `src/main.ts`

Typeface-Kurven in typeface.js-Reihenfolge; Kontur-Winding umgekehrt (facetype Reverse) für geschlossene Frontkappen. Extrusion: `rotateZ(π)` damit die Leserichtung der Canvas-Flachschrift entspricht, Facing wie Flachschrift, Rückseite an der Fassade, Shadow-Map bei Label-Updates.

### Schrift-Tiefe, Federo-Fonts, Verdachung (2026-08-26) — v0.7.124

**Dateien:** `vite.config.ts`, `src/studio/labelGeometry.ts`, `src/main.ts`, `src/studio/pedimentGeometry.ts`, `src/utils/profilePaths.ts`, `public/fonts/*`

Dev-Server mit `watch: null` lieferte neue Dateien unter `public/fonts/` als SPA-HTML — Federo-TTF/Typeface und damit „Mit Tiefe“ scheiterten still. Plugin `servePublicFromDisk` liest Public-Dateien frisch; Typeface-Load mit Validierung, Retry und Helvetiker-Fallback. Geschlossene Verdachung: Giebelzug und Sturz getrennt (kein Closed-Loop-Gehrungssliver); Profil-Miter-Scale gedeckelt.

### Streifen und Mauerwerk am Rundbogen (2026-08-26) — v0.7.123

Dünne Kappe über dem Scheitel wird spaltenweise verworfen (`ARCH_REMNANT_CRUMB_CM`), nicht nur wenn die ganze Streifenreihe niedrig ist — sonst blieb ein Dreieck im Bogenloch. `bottomArc`/`topArc` werden auf die Maskenkurve geschnappt (keine Sehne ins Loch). 3D: kein Outline-Fächer für Bogenkanten; Bossen als Band-Einzug entlang der Kurve. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `stripPanelClip.test.ts`.

### Schrift sichtbar auf dem Stein (2026-08-26) — v0.7.122

Anker in Tür-/Fensterlöchern werden beim Laden auf die geschlossene Wandfläche geschoben (`nudgeWallLabelOffOpenings`). Schrift-Meshes zeichnen mit `depthTest: false` vor dem orangen Auswahl-Overlay; Z-Abstand zur Fassade 1,2 cm. Dateien: `wallLabel.ts`, `hydrate.ts`, `labelGeometry.ts`, `FacadeController.ts`.

### Schrift auf dem Mauerwerk (2026-08-26) — v0.7.121

Gespiegelte Studio-Wände (`panelFlip`) drehten die Beschriftung um die Wandmitte — die Schrift lag auf der Rückseite und war von vorn unsichtbar. Ausrichtung jetzt in der Geometrie vor dem Verschieben auf die Paneel-/Bossenfront. Dateien: `labelGeometry.ts`, `FacadeController.ts`.

### Paneele am Rundbogen ohne Treppenstufen (2026-08-26) — v0.7.120

`splitMultiNotchArcPolys` splittet wandbreite Streifen nur noch bei mehreren Kerben. Ein einzelner Rundbogen bleibt ein Restpolygon mit Bogenkante (`bottomArc`/`topArc`), damit die Zeichnung keine vertikalen Stufen je Paneelreihe zeigt. Dateien: `openingGeometry.ts`, `stripPanelClip.test.ts`.

### Schrift einblenden ohne Freeze (2026-08-26) — v0.7.119

„Schrift anzeigen“ ändert nur `wall.label` und ruft `refreshWallLabels()` auf — kein Paneel-/Zeichnungs-Rebuild, kein `applyRenderStyle` auf der ganzen Szene. Font-Load mit Timeout, Canvas 96 px, typeface.json erst bei „Mit Tiefe“. Dateien: `labelGeometry.ts`, `FacadeController.ts`, `main.ts`, `wallLabel.ts`.

### Schema-Hydration für Alt-Elemente (2026-08-26) — v0.7.116

Load-Pipeline: `applyFacadeLoadPipeline` → `migrateFacadeSchema` → `hydrateFacadeState` → `clamp`. `FACADE_SCHEMA_VERSION` **10**; Steps: panelFan→Freiraum, windowDepthOffset −24→0, sockelStandard→sockelprofil. Hash-/Datei-Import nutzen dieselbe Pipeline. Breaking: optional `needsReview` + Statuszeile. Docs: `migration.md`. Dateien: `schemaMigrations.ts`, `facadeLoad.ts`, `hydrate.ts`, `persistence.ts`, `share.ts`.

### Schema-Hydration für Alt-Elemente (2026-08-25) — v0.7.105

Load-Pipeline: `migrateFacadeSchema` → `hydrateFacadeState` → `clamp`. `FACADE_SCHEMA_VERSION` 9; fehlende Opening-/Wand-Felder werden kanonisch nachgezogen (Feature aus). `createOpening` / `createStudioWall` / Modul-Öffnungen nutzen dieselbe Hydrate-Basis. Docs: `migration.md`. Dateien: `schemaMigrations.ts`, `hydrate.ts`, `persistence.ts`, `walls.ts`, `openings.ts`, Docs.

### Tür-Loch, Rundbogen-Glas, Wand-Move-Dock (2026-08-25) — v0.7.104

Bodentüren am Wandrand: Notch in `studioWallFaceShape` wird zum Shape-Loch, wenn die Laibung die Kante berührt (sonst Earcut-Diagonale durch die Öffnung). Glas/Rahmen-Oberlicht: `addArchedRectOutline` immer Y-geclampte Bogen-Polyline statt `absarc`. Wand verschieben: Andock-Overlay auch beim Move (`updateWallMoveDockHighlight`), Magnet-Snap (±`PLAN_GRID`), Early-out und kein Rücksprung bei Kollision; `WALL_MOVE_SNAP` = 48. Dateien: `panelGeometry.ts`, `gruenderzeit.ts`, `main.ts`, `presets.ts`, Docs.

### Leere Bibliothekskacheln und Sockel-Clip (2026-08-25) — v0.7.103

Profil-/Paneel-/Verdachungs-Picker und untere Bibliothek: erste Kachel „Keine/Keines/Keiner“. `layoutPanelTiles` clippt Steine unter `plinthHeight` (`clipTilesAbovePlinth`). Dateien: `main.ts`, `panelLayout.ts`, `constants.ts`, `style.css`, Docs.

### Freiraum-Vertiefung in der Wand (2026-08-25) — v0.7.102

Negative Freiraum-Tiefe: Außenfläche des Wandkörpers im Band ausgeschnitten (`studioWallFaceShape`), Kappe als Rückwand an `studioClearanceRecessZ`, Stufen-Leibung am Außenrand. Positiv bleibt der Rahmen vor der Wand. Dateien: `panelGeometry.ts`, `walls.ts`, `openingGeometry.ts`, `main.ts`, `index.html`, Docs.

### Freiraum-Rahmen ohne Paneele (2026-08-25) — v0.7.101

Freiraum-Kappe unabhängig von Paneelen/Mauerwerk. Ohne Verkleidung: Rahmen vor der Wand (`depthCm` Vorstand, `cm` allseitiger Abstand). Mit Paneelen unverändert das leere Band. Dateien: `FacadeController.ts`, `panelGeometry.ts`, `walls.ts`, `FacadeSvgView.ts`, `main.ts`, Docs.

### Freiraum-Front und Sockelhöhe (2026-08-25) — v0.7.100

Freiraum-Tiefe ist der Vorstand vor der Wandaußenkante (kleiner = weiter innen, 0 = Wand). Kappe extrudiert nur bis zu dieser Front, nicht fest an der Paneelfront. Sockelhöhe in 1-cm-Schritten (`clampPlinthHeight`), nicht mehr 8-cm-Raster. Dateien: `walls.ts`, `panelGeometry.ts`, `constants.ts`, `main.ts`, `index.html`, Docs.

### Freiraum-Tiefe bewegt die Front (2026-08-25) — v0.7.99

Clearance-Kappe: äußere Fläche an `studioClearanceRecessZ` (folgt `depthCm`), nicht an der Paneelfront. Dateien: `panelGeometry.ts`, Docs.

### Fenster-Pick, Freiraum-Tiefe, Keilstein-Alpha (2026-08-25) — v0.7.98

3D-Pick: Öffnung vor Verkleidung; Wandtreffer im Loch zählen als Fenster. Freiraum: `depthCm` plus Abstand; Leibung bündig an der Vertiefung (`studioClearanceRecessZ`). Keilstein-Ring mit Alpha-Badge. Dateien: `main.ts`, `openingGeometry.ts`, `walls.ts`, `panelGeometry.ts`, `FacadeController.ts`, `index.html`, Docs.

### Schenkelsteine gleich hoch, Anzahl wählbar (2026-08-25) — v0.7.97

„Keilsteine bis Sohlbank“: Steine je Laibung mit gleicher Höhe (nicht mehr am Wandraster). Anzahl `jambCount` (1–21) wie bei den Keilsteinen, Auto aus lichter Höhe / Paneelhöhe. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `main.ts`, `index.html`, Docs.

### Zwickel docken an die Keilstein-Außenkante (2026-08-25) — v0.7.96

Raster clippt am polygonalen Extrados der Voussoirs (`voussoirExtradosPolyline`, gleiche Facetten wie das Mesh). Körper/Boss folgen dieser Kontur — keine 4-Punkt-Sehne durch den Ring, keine 8°-Kanten-Suppe. Krümel < 3,2 cm. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `FacadeController.ts`, Docs.

### Paneele münden sichtbar am Extrados (2026-08-25) — v0.7.95

Ursache der „unveränderten“ Zeichnung: `EdgesGeometry` 22° blendet flache Bogenfacetten aus — die Paneele wirkten am Außenbogen gerade abgeschnitten. Studio-Paneele: `lineEdgeThreshold` 8°. Restkontur 4 Clip-Punkte auf dem Extrados. Krümel-Schwelle 1 cm. Dateien: `FacadeController.ts`, `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Zwickel: eine Kontur für Körper und Boss (2026-08-25) — v0.7.94

Körper und Boss aus `remnantOutline` (Clip-Punkte, Douglas-Peucker 0,5 cm, max. 10 Ecken). Diamant-Fallback entfernt. Dateien: `panelGeometry.ts`, Docs.

### Zwickel-Körper folgt der Bogenlinie (2026-08-25) — v0.7.93

Körper = Clip-Polyline am Extrados (Sehne liegt im Loch). `splitFloorFromArch` zurückgenommen (erzeugte ungeschnittene Rechtecke im Ring). Bossen = paralleler Einzug der Restform. Dateien: `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Keine Diagonale durch die Keilsteine (2026-08-25) — v0.7.92

Clip: Bänder mit flachem Steinboden und Extrados-Kappe werden getrennt (`splitFloorFromArch`), damit keine Boden→Bogen-Diagonale durch die Voussoirs entsteht. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, Docs.

### Zwickel docken ohne Sehnen durch die Keile (2026-08-25) — v0.7.91

Körper+Boss am Extrados über dieselbe Clip-Kontur (adaptiv, max. ~8 Bogenpunkte); kein Sehnen-Trapez mehr. Dateien: `panelGeometry.ts`, Docs.

### Saubere Zwickel-Fasen ohne Zacken (2026-08-25) — v0.7.90

Bogen-Reste: Douglas-Peucker-Ausdünnung; Inset 1:1 ohne Resample; konkave L-Outlines per Schwerpunkt-Skalierung. Dateien: `panelGeometry.ts`, Docs.

### Zwickel-Bossen folgen der Restkontur (2026-08-25) — v0.7.89

Öffnungsreste (Bogen/Laibung): Boss immer aus `remnantBossOuter` + parallelem Einzug; `pickSourceAwareDiamond` entfernt. Dateien: `panelGeometry.ts`, Docs.

### Zwickel-Bossen mit paralleler Fase (2026-08-25) — v0.7.88

Zwickel-Front = Kanteneinzug des Rest-Trapezes (gleiche Fase wie volle Steine), keine Schwerpunkt-Kopie. Dateien: `panelGeometry.ts`, Docs.

### Kein 3D-Flackern, Zwickel als Trapez-Körper (2026-08-25) — v0.7.87

Selektion: `applyRenderStyle` nur bei Geometrie-Rebuild. Orbit-Lite ohne Linien-/Bloom-/Pixelratio-Umschaltung. Zwickel: Körper+Boss aus demselben groben Trapez. Dateien: `FacadeController.ts`, `main.ts`, `panelGeometry.ts`, Docs.

### Schatten ohne Flackern, Licht-Default (2026-08-25) — v0.7.86

Orbit-Lite schaltet Shadow-Map nicht mehr aus; Selektion setzt `needsUpdate` nicht. Sonnen-Default wieder 2,0. Dateien: `main.ts`, `sunLighting.ts`, `index.html`, Docs.

### Zwickel-Boss = ähnliche Restform (2026-08-25) — v0.7.85

Zwickel- und Outline-Reste: Bossen-Front per Ähnlichkeits-Skalierung der Restkontur (Trapez→Trapez); Diamant-Fallback entfernt. Dateien: `panelGeometry.ts`, Docs.

### Zwickel als Trapez-Bossen (2026-08-25) — v0.7.84

Zwickel-Bossen = inset-Extrusion der Restkontur (ausgedünntes Trapez/Polygon), nicht abgeschnittener Rechteck-Diamant. Dateien: `panelGeometry.ts`, Docs.

### Keil-Bossen und Zwickel-Diamanten (2026-08-25) — v0.7.83

Keilsteine: polarer Boss füllt den Keil (begrenzter Chamfer, Radial-Quads); keine doppelte Körper-Front. Zwickel wieder mit rastertreuem Diamant statt `extrudeInsetRingFrustum` (gezackter Außenring). Dateien: `panelGeometry.ts`, Docs.

### Einbettung wiederhergestellt (2026-08-25) — v0.7.82

Checkbox „In Wand eingebettet“ (`#opening-reveal-frame-section`) und Wiring in `main.ts` wiederhergestellt — war in v0.7.80 versehentlich aus `index.html` entfernt. Regel: bestehende UI nicht stillschweigend löschen.

### Trapez-Bossen am Zwickel, kein zweiter Bogenring (2026-08-25) — v0.7.81

Zwickel-Bossen als eingesetzter Umriss (`extrudeInsetRingFrustum`), nicht AABB-Diamant. Mit Voussoirs: Freiraum „leer“ expandiert die Dock-Maske nicht und erzeugt keine Clearance-Kappe (kein zweiter Bogen). Dateien: `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Zwickelsteine aus dem Wandraster (2026-08-25) — v0.7.80

Keine Extra-Geometrie in der Bogenkappe: Raster clippt am Extrados (`clipPolysMinusArches`), Voussoirs füllen nur den Ring. Zwickel = geclippte Kacheln mit `bottomArc`; Krümel unter 3,2 cm Höhe entfallen. Bossen als Diamant im Rest, nicht als zweites Prisma. Dateien: `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Zwickel ohne Kasten über dem Bogen (2026-08-25) — v0.7.79

Die Kappe wird nur bis zum Extrados-Scheitel ausgestanzt (nicht bis zur nächsten Schicht). Zwickel als schichtgleiche Steine am Bogen (`archSpandrelCoursePolys`). Dateien: `openingGeometry.ts`, `panelGeometry.ts`, Docs.

### Keilstein-Schenkel und saubere Zwickel (2026-08-25) — v0.7.78

Optional Schenkel des Rings bis zur Sohlbank (`arch.jambs`). Raster in der Bogenkappe durch Zwickel-Strips am Extrados ersetzt (kein zerschnittenes Läuferfeld mit Diamant-Scherben). Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `main.ts`, `index.html`, Docs.

### 3D-Navigation wieder flüssig (2026-08-25) — v0.7.77

Orbit-Lite galt nur für ⌘-Ziehen; Mausrad/`OrbitControls` haben jedes Tick Bloom+Schatten+Zeichnungslinien gerendert (start/end im selben Wheel-Event). Jetzt: Lite an `controls` start/end mit 180 ms Hold, Pixelratio 1, `LineSegments2` aus, `setLineResolution` nicht jedes Frame. 3D-Bögen/Keilsteine: `ARCH_MESH_SEGMENTS` / 6–8 Segmente je Voussoir, Clip bleibt 128. Dateien: `main.ts`, `FacadeController.ts`, `openingGeometry.ts`, `panelGeometry.ts`, `gruenderzeit.ts`, `windowLod.ts`, Docs.

### Keilsteinbogen: echte radiale Voussoirs (2026-08-25) — v0.7.76

Diamant-Bossen in Keil-Outlines und an Bogen-Resten erzeugten in der Zeichnung X-Linien und „verbogene Läufer“. Jetzt: Polar-Keile mit `extrudePolarFrustum`; Raster dockt am Extrados bei unverbreiterter Laibung; SVG mit Kreisbögen. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `main.ts`, Docs.

### Römischer Keilsteinbogen (2026-08-25) — v0.7.75

Optionaler Voussoir-Ring am Fassaden-Rundbogen: gemeinsamer Mittelpunkt, Intrados/Extrados, strikt radiale Fugen. Anzahl und Bogenstärke auto aus Paneelbreite/-höhe; Toolbar mit SVG-Vorschau. Raster clippt am Extrados; Freiraum-Taper außerhalb des Rings; Bossen auf Keil-Outlines. Fake-Box-Keilsteine entfernt. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `main.ts`, `index.html`, `FacadeController.ts`, Docs.

### Navigation ohne Dämpfung und Leerlauf-Render (2026-08-25) — v0.7.74

Orbit-Damping aus (Kamera 1:1 zur Maus). Dirty-Rendering über `viewportDirty`; kein `controls.update()` im Animationsloop. Während ⌘-Orbit/Pan: `shadowMap.enabled` und Bloom aus. LOD: `applyLodVisibility` nur bei Stufenwechsel, nicht jedes Frame; während Navigation keine LOD-Eval. Dateien: `main.ts`, `FacadeController.ts`, Docs.

### Bossen: ein rastertreuer Diamant am Bogen (2026-08-24) — v0.7.73

v0.7.71–0.7.72 haben den Diamanten im Rest neu gelegt (teilweise zwei Seeds / Clip des Originals über das ganze L). Dadurch zwei Zentren am Kämpfer oder Mini-Fronten an der Laibung. Jetzt: `sourceX/Y/Width/Height` vom Kachelfeld; `pickSourceAwareDiamond` behält die originale Front wenn sie noch im Stein liegt, sonst **einen** Diamanten im größten Restbalken. Nichts im Loch. Keilsteine weiter `pickDiamond`. Dateien: `panelGeometry.ts`, `openingGeometry.ts`, Docs.

### Ein Diamant pro Reststein am Bogen (2026-08-24) — v0.7.72

v0.7.71 hat in L-Steinen am Kämpfer zwei Diamanten gelegt (Laibung + Kappe), und Rechtecklöcher zerlegten dieselbe L-Form per `subtractRect` in zwei Kisten. Jetzt: zusammenhängende Reste bleiben ein Polygon (`clipRectMinusBox` / `clipPolyMinusColumnHole`); genau ein Diamant pro Reststein. Dateien: `panelGeometry.ts` (`pickDiamond`), `openingGeometry.ts` (`clipRectMinusBox`), Docs.

### Diamant-Bossen an Bogen und Laibung (2026-08-24) — v0.7.71

v0.7.70 zog die Bounding-Box der Reststeine ein — bei L-Form und Keilsteinen lag das Innenrechteck oft im Loch oder der Fit schlug fehl (flache Prisma-Front trotz Vorstand). Jetzt: größtes Rechteck *im Restpolygon* (optional PCA-gedreht für Keilsteine), Chamfer wie volle Felder, **vier** Schrägseiten (kein Kontur-Fächer). Dateien: `panelGeometry.ts`, Docs.

### Bossenprofil an zugeschnittenen Steinen (2026-08-24) — v0.7.70

`extrudeFrustum` hat Kurven-/L-Steine nur als Prisma tiefer gezogen (flach, ohne Fase). Erster Versuch: achsenparalleles Innenrechteck von der Bounding-Box. Dateien: `panelGeometry.ts`, Docs.

### Bossen-Vorstand am Rundbogen (2026-08-24) — v0.7.69

`clipRectMinusArch` / `clipRectMinusStadium` zerlegen einen Stein nicht mehr an Sohlbank und Kämpfer in mehrere Rechtecke. Links/rechts der Laibung bleibt ein Polygon (optional `bottomArc`/`topArc` für die Kurve). `extrudeFrustum` bei `taperDepth > 0` folgt dieser Kontur statt der Bounding-Box — sonst wirkten Bossen neben dem Bogen wie Scherben. Die Bogenkappe bleibt ohne Split an `boxX0`/`boxX1` (kein Phantom-Kasten). Dateien: `openingGeometry.ts`, `panelGeometry.ts`, Docs.

### Sockel-Gehrung an der Außenecke (2026-08-24) — v0.7.68

Dekoratives Sockelprofil (`buildPlinthProfilePaths`): bis v0.7.218 Plan-Miter umgekehrt zum Gesims. **v0.7.219:** dieselbe Bilderrahmen-Richtung wie Gesims (Front kürzer). **v0.7.220:** Sweep-Versatz `|z| × tan` wie `wallLocalX` (nicht mehr Bias zur Wandaußenkante). Dateien: `profilePaths.ts`, Docs.

### Zeichnung: kein Phantom-Kasten am Rundbogen (2026-08-24) — v0.7.67

`clipRectMinusArch`: Laibung nur unter der Kämpferlinie; in der Bogenkappe Kurvenschnitt über die volle Kachelbreite (kein Split an `boxX0`/`boxX1` — das zeichnete `EdgesGeometry` als lotrechte Kastenkannten durch die Lagerfugen). Sequenzielle Clips mehrerer Bögen/Stadien setzen `bottomArc`/`topArc` zusammen, statt das Bounding-Rechteck des ersten Rests wieder zu füllen. Analog `clipRectMinusStadium` für runde Nischen. Dateien: `openingGeometry.ts`, Docs.

### Saubere Öffnungsmasken, Nischen (2026-08-24) — v0.7.66

Eine gemeinsame Kontur (`openingMaskPolyline`) für Wandloch, Paneel-Clip, Mörtel, Leibung und SVG. Shape-Löcher mit entgegengesetzter Windung; `PANEL_OPENING_CLEARANCE = 0`. Rundbogen-Reste als `bottomArc`, runde Cutouts als Stadion mit `topArc`/`bottomArc` — kein Rechteck um den Bogen. Cutout-Typ (`Opening.type: 'cutout'`, `cutoutShape`) für eckige/runde Nischen und Durchbrüche; Bibliothek-Tab Nischen. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, `panelLayout.ts`, `FacadeController.ts`, `FacadeSvgView.ts`, `presets.ts`, `openings.ts`, `main.ts`, `index.html`, Docs.

### Andock-Querschnitt, Gehrung, Fake-Öffnung, Profil-Bibliothek, Stile (2026-08-24) — v0.7.65

Wand-Drop: orange Querschnitte (Start/Ende = Wandtiefe, oben = Aufsetzen) an Ghost und bestehender Wand. 90°-Gehrung nach Verknüpfung über Nachbar-Endpunkte (`miterAtWallEnd`), auch Paneel/Sockel/Gesims. „In Wand eingebettet“ schließt die Wand und blendet Rahmen/Glas aus; Bänke/Profile/Verdachung bleiben. Untere Bibliothek-Reiter **Profile** und **Verdachung**, Drag&Drop (`application/x-library-asset`); Sidebar-Karten ausgeblendet. Rechtsklick Stile kopieren/einfügen mit Dialog. Dateien: `main.ts`, `index.html`, `style.css`, `planGeometry.ts`, `walls.ts`, `openingGeometry.ts`, `profilePaths.ts`, Docs.

### Wand-Verknüpfung, Gehrung, Stil-Dialog (2026-08-24) — v0.7.64

Studio-Wände: `planLinked` (Default verknüpft). Unverknüpfte Wände fehlen im Grundriss-Graphen und in `findAdjacentWall`. Neue Bibliothek-Wand ohne Nachbar ist frei; mit Andockknoten werden **beide** Wände sofort verknüpft plus Dreier-Dialog `#wall-dock-style-dialog` (Esc/Abbrechen = keine Stilübernahme). Freie Wand anschieben: Dialog vor der Verknüpfung. Rechtsklick: Verknüpfung lösen / Wand verknüpfen. Verschieben/Drehen/Strecken gesperrt, solange verknüpfte Nachbarn nicht mitselektiert sind. `miterInsetCm` wieder mit 90°-Gehrung (`depth × tan(turn/2)`). Sockel/Gesims/Sockelprofil folgen `cornerJoin` (stumpf oder Gehrung). Dateien: `main.ts`, `index.html`, `walls.ts`, `floorPlan.ts`, `planGeometry.ts`, `panelGeometry.ts`, `profilePaths.ts`, `facade.ts`, Docs.

### Balkon, runder Erker, Loggia (2026-08-26) — v0.7.149

Bibliothek Tab Wände: zusätzliche Baugruppen in 192/384 cm — Balkon (U, 96 cm Tiefe), runder Erker (7 Facetten-Halbkreis), Loggia (U nach innen). Persistenz: `Wall.bayWindow.shape` um `round`, optional `kind` (`bay`|`balcony`|`loggia`), `wallIds: string[]`. Geometrie in `src/studio/bayWindow.ts`. Dateien: `bayWindow.ts`, `facade.ts`, `hydrate.ts`, `main.ts`, Docs.

### Gesims 8 cm, Sockel 19×196, Endstück L/R, Erker, Sonne (2026-08-24) — v0.7.63

Gesimshöhe in 8-cm-Schritten (`STUDIO_MASONRY`). Sockel nur `sockelprofil` aus `public/profiles/19x196-1.svg`; `sockelStandard` bleibt Legacy-Map. Endstück: zwei Bibliothekskarten links/rechts, Standalone-L per Drop in die Fläche (`buildStandaloneEndPieceWalls`), ein Rücksprung nach hinten. Erker: Ghost wie Wand, Standalone-U, Dialog `#bay-window-place-dialog` (ersetzen/links/rechts/darüber). Sonne: Intensität Default 3,5, Slider max. 8. Dateien: `main.ts`, `index.html`, `walls.ts`, `bayWindow.ts`, `presets.ts`, `sunLighting.ts`, `uploadedSilhouettes.ts`, Docs.

### Licht ohne HDRI, Sockel-Tiefe/Vorschau, Gesimshöhe (2026-08-24) — v0.7.62

HDRI default aus; ohne HDRI kein ACES (auch nicht über Bloom). Sockel-Vorschau skaliert SVG wie 3D (`plinthHeight`/`plinthDepth`). Gesims-UI: Höhe in Paneel-/Ziegelhöhe-Schritten (intern weiter `scale`). Dateien: `persistence.ts`, `hdriEnvironment.ts`, `main.ts`, `index.html`, Docs.

### Licht ohne HDRI, Sockel 1 cm, Sockelprofil (2026-08-24) — v0.7.61

Ohne HDRI: `scene.environment = null` (RoomEnvironment nur noch für Glas via `setGlassEnvironment`); Tone-Mapping bleibt `NoToneMapping`, Bloom überschreibt HDRI-Exposure nicht mehr. Sockel: Höhe/Tiefe/Versatz in 1-cm-Schritten (`clampPlinth*`). Sockelprofil-Querschnitt aus Original-SVG neu (`SOCKELPROFIL_SECTION`, links = Wand, unten = Boden). Dateien: `hdriEnvironment.ts`, `main.ts`, `constants.ts`, `uploadedSilhouettes.ts`, `index.html`, `FacadeController.ts`, Docs.

### Treppen-Sync, sichere Saves, Gruppen, 10°-Drehung (2026-08-24) — v0.7.60

Tür/Treppe: `syncStairsToDoorWidth()` bindet `stairs.width` an die Türbreite in `main.ts`, `studio/walls.ts` und `utils/walls.ts` (auch beim Laden/Clamp). Persistenz: `schemaVersion` in `PersistedAppState`; fehlendes `scene.hdriEnabled` bleibt bei Altständen aus, damit 0.7.58 optisch stabil bleibt. Häuser/Geschosse: letztes Haus und letztes Geschoss sind löschbar; Fallback ist ein leeres `createBuilding()` bzw. ein leerer Grundriss. Gruppen: `Building.groups[]`, `Wall.groupId`, Ebenenbaum mit Gruppenzeilen, Mehrfachauswahl kann per Kontextmenü gruppiert werden, Gruppendrehung nutzt gemeinsamen Schwerpunkt. Erker: Drop-Dialog `ersetzen | links | rechts | oben`, Kinderwände werden gruppiert, Auswärtsrichtung folgt `panelFlip`. Wand-Feindrehung: 10° statt 8°. Sockelprofil: dekorative Profile nutzen in `profilePaths.ts` wieder native Tiefe (`sectionScaleForward = 1`); `SOCKELPROFIL_SECTION` geglättet. Dateien: `main.ts`, `stairs.ts`, `persistence.ts`, `buildings.ts`, `studio/walls.ts`, `utils/walls.ts`, `bayWindow.ts`, `uploadedSilhouettes.ts`, Docs.

### HDRI, Glas, Erker, End-Bossen, Endstück L, Sockelprofil (2026-08-24) — v0.7.59

HDRI: `public/hdri/studio_small_09_1k.hdr`, `src/studio/hdriEnvironment.ts` (PMREM, `scene.environment`, optional Hintergrund, ACES + Exposure). Persistenz in `SceneAppearance` (`hdriEnabled`, `hdriIntensity`, `hdriShowBackground`, `hdriExposure`). Physisches Glas: `Opening.glassMode` + IOR/Roughness/Transmission/Thickness, `utils/glassConfig.ts`, `applyGlassLook` mit `transmission`. Erker: `src/studio/bayWindow.ts`, Bibliothek vier Presets, Drop auf Wand, Optik von Parent. End-Bossen: `StudioPanelConfig.endBossStart/End` + Join, Layout in `panelLayout.ts`, Chamfer in `panelGeometry.ts`. Endstück: L-Geometrie (`buildEndPieceArmWalls`), Drag&Drop, Grundriss-Vorschau. Sockel: neuer `SOCKELPROFIL_SECTION` in `uploadedSilhouettes.ts`. Dateien: `main.ts`, `index.html`, `FacadeController.ts`, `windowLod.ts`, `gruenderzeit.ts`, `openings.ts`, Docs.

### Wanddrehung, Endstück, Sockel, Bossen (2026-08-24) — v0.7.58

Feindrehung 8° (`snapYawTo8`, `#studio-wall-yaw`) um Wandmitte; Overlay 90° unverändert. Bibliothek Wände: Vorschau Verhältnis Länge:448. Endstück `wall-end-48` mit `Wall.endPiece` + zwei Schenkeln. Sockel: `plinthDepth` + `plinthOffsetForward` unabhängig (Box + SVG). Bossen-Chamfer an kollinearer Fuge nur für volle Steine. Dateien: `compass.ts`, `walls.ts`, `panelGeometry.ts`, `profilePaths.ts`, `constants.ts`, `main.ts`, `index.html`, `style.css`, Docs.

### Bossen, Ladebildschirm, Sockelleiste, Profile (2026-08-24) — v0.7.57

Bossen-Steuerung sitzt im Tab **Paneele** (unter den Mauerwerk-Karten, auch im Modus Einfach). Start: Overlay `#app-loading` bis erster Render, Ansicht immer `3d`. Sockel-SVG: Sweep am Boden, Höhe = `plinthHeight`, Tiefe = native SVG-Breite (`sectionScaleForward`), liegt auf der Paneelfläche ohne Trapez (`studioPanelFaceLocalZ`). X-Aussparung an allen Öffnungen im Sockelstreifen. Gesims/Fensterprofile: `studioProfileAnchorLocalZ` auf der äußeren Fassade inkl. Bossen (`studioFacadeOutwardLocalZ`), negatives `offsetForward` klammert nicht hinter die Fläche. Dateien: `index.html`, `main.ts`, `walls.ts`, `profilePaths.ts`, `FacadeController.ts`, `pedimentGeometry.ts`, Docs.

### Wände, Stuck, Selektion, Bibliothek-Layout (2026-08-24) — v0.7.56

Bibliothek-Tabs oben (`#library-mode` column, Tabs `order: 0`); Szene-/Auswahl-Tabs volle Spaltenhöhe (`#ui-right` / `#lighting-accordion` flex). Leibung: `studioOpeningRevealOuterZ` wieder max(Paneelfront, Profilebene); Außenbank-Tiefe trackt `taperDepth` wie `projectDepth`. Andocken: Dialog Optik übernehmen (ohne Öffnungen). Overlap: `studioWallsCollideIdentical` bei Place/Move/Rotate/Duplikat. Move Plan robuster + 3D/2D-Wand-Drag. `miterInsetCm`: 90° Flush, Gehrung nur schräg; `finalizeStudioGeometry` nach Dock/Move. 90°-Overlay an Selektion. Paneel orange + Drag; Treppen-Highlight auf Stufen; dekoratives Sockelprofil ersetzt Box. Dateien: `style.css`, `index.html`, `walls.ts`, `floorPlan.ts`, `main.ts`, `FacadeController.ts`, `panelGeometry`/`profilePaths`, Docs.

### Vertikale Register, Paneele-DnD, Wand-Andocken, 3D-Flächen (2026-08-23) — v0.7.55

Rechte Auswahl-Register wieder vertikal (`writing-mode: vertical-rl`, Toolbar `row`). Untere Bibliothek-Tabs gleiches Chrom, horizontal, plus Tab Paneele mit DnD (`application/x-panel-preset` → `panel.pattern`/`enabled`). Wand-Andocken: Ghost in Plan/2D/3D, ±Richtung, T-Stoß erlaubt, Drop legt ab; `dragleave` nur bei echtem Verlassen. Wandkörper-Material `DoubleSide`. Dateien: `index.html`, `src/main.ts`, `src/style.css`, `src/studio/floorPlan.ts`, `src/FacadeController.ts`, `docs/ux.md`.

### Bibliothek unten, Optionen rechts, Wand-Andocken (2026-08-23) — v0.7.54

Untere Leiste (`#opening-library`) bleibt immer die Element-Bibliothek (horizontale Tabs über den Karten). Auswahl-Optionen wieder in `#selection-toolbar` rechts mit horizontalen Register `#selection-right-tabs`. Wand-Preset-Drag: Schatten/Orange-Vorschau, `planSegmentOverlaps` verhindert Überlagerung, Front bündig via Nachbar-`yawDeg`/`panelFlip`, 90°-Drehen + R-Achse. Linke Spalte: `#ui-left-collapse` fixed außerhalb von `#ui`, wieder ausklappbar. Dateien: `index.html`, `src/main.ts`, `src/studio/floorPlan.ts`, `src/studio/floorPlanView.ts`, `src/style.css`, `docs/ux.md`.

### Optionen nur unten, Wand-Andocken, linke Spalte (2026-08-23) — v0.7.53

Auswahl-Optionen ausschließlich in der unteren Leiste (horizontale Register + Panels in `#selection-bottom-panels-slot`); rechte `#selection-toolbar` bei `#app.has-selection` ausgeblendet. Wand-Preset-Drag: `setWallDockPreview` (orange) + Snap `snapPlanGridToNearestNode(..., 2)`. Plan-Navigieren: `pickPlanWall`, Mehrfachauswahl Ctrl/Cmd, `offsetStudioWallsByGrid`. Linke Spalte: `#ui-left-collapse` / `ui-left-collapsed`. Dateien: `index.html`, `src/main.ts`, `src/studio/floorPlanView.ts`, `src/style.css`, `docs/ux.md`.

### Options-Register unten bei Auswahl (2026-08-23) — v0.7.52

Bei Elementauswahl: Options-Gruppen als horizontale Register **unten** (`#selection-options-mode` / `#selection-bottom-tabs`); Bibliothek ausgeblendet. Rechte Auswahl-Toolbar ohne vertikale Tab-Spalte — nur Controls der aktiven Registerkarte; `data-settings-inline-all` bleibt immer sichtbar. Ohne Auswahl: Bibliothek (Wände/Fenster/Türen) unten, Szene rechts. Dateien: `index.html`, `src/main.ts` (`syncSelectionToolbarTabs`, `syncBottomBarMode`), `src/style.css`, `docs/ux.md`.

### Einfach/Komplex und Wand-Bibliothek (2026-08-23) — v0.7.51

UI-Modus `simple`/`complex` (`fassaden-builder-ui-mode`, Default Einfach): `data-ui-mode` am `html`-Root blendet `[data-ui-level=advanced]` per CSS aus — gleiches Fassaden-Datenmodell. Untere Bibliothek mit Tabs Wände/Fenster/Türen; Wand-Presets (`WALL_LENGTH_PRESETS`) per DnD (`application/x-wall-preset`) oder Klick → `insertWallSegmentInPlan` + eine Studio-Wand via `finalizeWallLayout` (kein `generateWallsFromFloorPlan`, Öffnungen bleiben).

### Rundbogen und SVG-Profilachsen (2026-08-23) — v0.7.50

Rundbogen-Blendrahmen: Innenloch konzentrischer Halbkreis (gleiche Mitte, Radius − Holzstärke) statt Extra-Offset, der den Bogen verzerrte. Profil-SVG: links = Wand, rechts = Front; Fensterprofil-oben = oben am oberen Holm; Traufgesims-oben = Traufe, Körper hängt von der Wandoberkante die Fassade hinunter. Alte Profile ohne SVG-Vorlage (windowTrim/v1/v2, Kranz-/Gurt-/Sockel-/Konsolengesims, Fensterverdachung, Sohlbank) aus Picker und Registry entfernt; Alt-IDs werden auf die SVG-Profile gemappt.

### SVG-Profile Fenster/Traufe/Sockel (2026-08-23) — v0.7.48

Neue Querschnitte aus PNG-Silhouetten (`uploadedSilhouettes.ts`): Fensterprofil 32×120/35×130/40×140, Traufgesims 70×150/110×135/200×200, Sockelprofil. Sockel behält Standard-Vertiefung; optionales Profil mit Farbe/Größe/Drehung. Rahmenprofil erhält Profilgröße-Faktor (`OpeningTrimConfig.scale`).

### Paneele-Einstellungen sichtbar (2026-08-23) — v0.7.44

Ursache: Tab-Filter (`selection-tab-filtered-out`) blieb oft auf „Maße“/anderem Tab — Paneele/Mauerwerk wirkten entfernt. Klick auf Paneelfläche setzt Tab „Paneele“; Muster-Karten bleiben auch bei ausgeschalteten Paneelen sichtbar. „Fächer im Zwickel“ unter Rundbogen wieder (mappt auf Freiraum `finish: taper`).

### Toolbar-Tab, Außenbank, Treppe (2026-08-23) — v0.7.47

Auswahl-Register bleibt beim Editieren stabil (Tab-Lock + kein Auto-Sprung auf Paneele). Keilsteine / Fächer-im-Zwickel-UI entfernt. Treppen-`width` folgt Öffnungsbreiten-Delta. Außenbank: Default Überstand 16 cm, Tiefe 32 cm + Paneel-`projectDepth`, Profil Brett; Tiefe trackt `projectDepth`-Änderungen. Verdachungs-Optionen nur bei aktivierter Verdachung.

### Bossen-Terminologie und UI-Fixes (2026-08-23) — v0.7.46

Paneel-Trapez heißt in der UI **Bossensteine** / **Bossenprofil** (Tab „Bossen“). Sockel-Tab bleibt bei Eingaben erhalten (Tab-Wechsel nur noch bei 3D-Klick auf Wandteil). Türbreite synchronisiert Treppenbreite (`stairs.width`, ohne `extend`/`splay`). Wandhöhe: Zahl + ± in Maße; `resizeStoreyHeight` aktualisiert `building.wallHeight` auf EG. Rundbogen-Blendrahmen: Loch-Arch in `createFrameGeometry` korrekt offsetiert. Sprossen ohne Fensterteilungs-Auswahl; Toolbar-Labels über volle Breite.

### Dev-Server: frischer Code trotz Watch aus (2026-08-23) — v0.7.49

`server.watch: null` stoppt iCloud-/Desktop-Reload-Stürme, ließ aber Vites **Module-Graph-Cache** ewig stehen: nach Code-Änderungen ohne Server-Neustart lief im Browser Altcode (z. B. Listener auf entfernte DOM-IDs) → Runtime-Crash, leere Ebenenliste, kein Haus. Plugin `fresh-source-on-request` in `vite.config.ts` invalidiert Module bei mtime-Änderung am Request; `Cache-Control: no-store`. Weiterhin Watch aus (manuell F5), `strictPort`, Host `127.0.0.1`.

### Dev-Server: Watch aus (2026-08-23) — HTML ohne JS

Desktop/iCloud „touch“t Quellbaum und `vite.config.ts` → Vite: Massen-`page reload` + `restarting server` → Browser `ERR_CONNECTION_RESET` / nur HTML-Shell ohne Module. Fix: `server.watch: null` in `vite.config.ts` (kein HMR; nach Code-Änderungen manuell neu laden). Weiterhin `strictPort: true`, Host `127.0.0.1`.

### Dev-Server stabil (2026-08-23) — v0.7.43

Mehrere parallele `npm run dev`-Instanzen (5173 + 5174) und iCloud-Touches an `tsconfig.json`/`package-lock.json` lösten Endlos-Neustarts aus (`Request is outdated` → Browser lädt nur HTML, kein JS). `vite.config.ts`: `strictPort: true`, Watch-Ignore für `tsconfig*.json` und `package-lock.json`.

### Steinfronten wie origin/main (2026-08-23) — v0.7.42

v0.7.39–0.7.41 drehten die Steinfront-Windung (`addFrontCap`: +Z ohne `panelFlip`) und ersetzten Bogen-Reste (`bottomArc`) durch `outline`-Triangulation. `FrontSide` cullte damit die sichtbare Außenseite — alle Kacheln wirkten hohl. Wiederhergestellt: `addQuad(blf, brf, trf, tlf)` und Bogenclip mit `bottomArc` wie origin/main v0.7.33. Vite-Watch-Ignore und Paneele-UI (v0.7.40) bleiben.

### Steinfront-Windung und Vite-Watch (2026-08-23) — v0.7.41

Paneel-/Passstück-Fronten hatten −Z-Windung; mit `FrontSide` und Kamera vor der Fassade wurden sie gecullt (hohle Kacheln, besonders an Öffnungen). Fronten nutzen jetzt +Z ohne `panelFlip` (bzw. −Z mit Flip). Vite `server.watch.ignored`: `.tmp`, `docs`, `*.glb`/Bilder — weniger Full-Page-Reloads durch Desktop/iCloud.

### Paneele-UI bei Wandteil-Fokus (2026-08-23) — v0.7.40

`applyWallPartVisibility`: Sektion **Paneele** (Muster Paneele/Mauerwerk) bleibt bei jeder Studio-Wandauswahl sichtbar — analog zum Sockel. Zuvor verschwand sie bei Klick auf Sockel- oder reine Gesims-Nachbarschaft (`selectedWallPart !== 'group'|'cladding'`), sodass Muster nicht wählbar wirkten.

### Dev-Server IPv4 (2026-08-23)

`vite.config.ts`: `server.host = '127.0.0.1'`, Port 5173 — vermeidet `ERR_CONNECTION_REFUSED`, wenn der Browser `localhost` als IPv4 auflöst, Vite aber nur auf `[::1]` lauscht.

### Streifen-Paneele an mehreren Rundbogen (2026-08-25) — v0.7.106

Wandbreite Streifen mit mehreren Bogenfenstern: Flat-Samples zwischen Öffnungen gingen beim zweiten Clip verloren (`interpolatePolyArc` mit zu großem ε) → Diagonalen/`topArc`-Sehnen. Fix: dichtere X-Abtastung, engeres Arc-ε, `splitMultiNotchArcPolys`, keine konkaven Outline-Fächer/Schwerpunkt-Bossen. Dateien: `openingGeometry.ts`, `panelGeometry.ts`, Tests. Siehe [panel-geometry.md](panel-geometry.md).

### Paneel-Fronten am Rundbogen (2026-08-23) — v0.7.39

Bogen-Passstücke (`outline`) bekamen Seitenflächen, aber die Front zeigte nach innen und wurde von `FrontSide` weggeschnitten — die Form wirkte nach vorne offen. Kappen nutzen jetzt dieselbe Windung wie `addQuad` (−Z). Bei `taperDepth > 0` gibt es denselben Trapez-Vorstand wie bei Rechtecksteinen. Siehe [panel-geometry.md](panel-geometry.md).

### Paneele gegen Öffnungsmaske (2026-08-23) — v0.7.38

Jede Paneele (Streifen/Mauerwerk) wird einzeln gegen die Öffnungsmaske geschnitten (identisch zum Fensterloch). Nur die Überlappung folgt dem Bogen; wandbreite Streifen nicht mehr als ein konkaves Polygon. Siehe [panel-geometry.md](panel-geometry.md).

### Paneel-Bogenzwickel und Modul-Verkleidung (2026-08-23) — v0.7.37

Outline-Extrusion konkav (Bogenclip): `THREE.ShapeUtils.triangulateShape` statt Fächer um den ersten Punkt — sonst füllten Dreiecke das Bogenloch und Streifen-Zwickel blieben leer. Modul-GLB-Verkleidung entfällt bei Fassaden-Rundbogen (rechteckiges Loch im Mesh). Siehe [panel-geometry.md](panel-geometry.md).

### Paneel-Streifen am Rundbogen (2026-08-23) — v0.7.36

Breite Kacheln (Streifen) über die Laibung: ein Umriss mit kurvenförmiger Unterkante statt Links-/Rechts-Rechteck + Passstein (keine vertikale Naht am Kämpfer). Freiraum-Kappe von Wandaußenfläche bis Paneelvorderseite. Siehe [panel-geometry.md](panel-geometry.md).

### Rundbogen-Zwickel und Freiraum-Front (2026-08-23) — v0.7.35

Clip-Reste am Bogen: Mindestgröße 1 cm statt 8 cm (Schichthöhe nach Fuge). Freiraum „leer“: Frontkappe schließt das Clearance-Band. Siehe [panel-geometry.md](panel-geometry.md).

### Freiraum-Modi am Rundbogen (2026-08-23) — v0.7.34

`panelClearance.finish` (`empty` \| `taper`) ersetzt automatischen Bogenring und `arch.panelFan`. Clip unter Kämpfer nur gegen Laibung; Außenbank-Rotation per lokaler `rotateX` nach Wand-Yaw. Siehe [panel-geometry.md](panel-geometry.md), [ux.md](ux.md).

### Paneelfugen am Fassaden-Rundbogen (2026-08-23) — v0.7.33

Automatischer Bogenring mit radialen Keilsteinen; kartesisches Raster dockt am Extrados. Optional `Opening.arch.panelFan` für Fächer im Zwickel. Geometrie in `openingGeometry.ts` / Clip+Extrusion in `panelGeometry.ts`.
*(Ab v0.7.34 durch Freiraum-Modi ersetzt.)*


### Rundbogen Innenkurve (2026-08-23) — v0.7.32

2D/Vorschau: innere Flügelöffnung in Öffnungskoordinaten (`sashInnerArch`), nicht in Blatt-Koordinaten. 3D-Glasleiste: konzentrischer `insetArchGeom` statt verschobenem Bogen.

### Fenster/Tür = Öffnungsform, Einbettungs-Profile, Sehnen-Outward (2026-08-26) — v0.7.148

Blendrahmen und Glas folgen immer `Opening.arch.form` (High-LOD Kronen-Polyline für Nicht-Rundbögen). Checkbox „Rundbogen am Fenster“ entfernt; Legacy-`glazingArch` wird ignoriert. Fake-Einbettung („In Wand eingebettet“) bleibt ohne Wandloch/Glas, aber Profile/Verdachung nutzen weiter die Bogenkrone. Profil-Sweep: Outward = Lot auf die Sehne (vom Öffnungsmittelpunkt weg), `ARCH_MESH_SEGMENTS = 64`. Flügel und Scheiben clippen die **globale** Öffnungskrone (wie beim Rundbogen-ArchGeom-Offset) — keine neu skalierten Mini-Bögen pro Paneel.

### Rundbogen am Fenster / an der Tür (2026-08-23) — v0.7.31

Fenster-/Tür-Konstruktion folgt immer `Opening.arch.form` (High-LOD mit Kronen-Polyline für Nicht-Rundbögen). Dekorative Öffnungsprofile folgen dem Fassadenbogen inkl. Fake-Einbettung. Blendrahmen mit konzentrischer Innenkurve bzw. inset Kronen; Flügel/Glas im Oberlicht bzw. an der Oberkante.

### Mauerwerk an der Laibung + Freiraum (2026-08-23) — v0.7.30

Steine werden bis an die Clip-Kante gezogen (`sealTilesToOpeningJambs`, auch neben der Bogenkappe). X-Snap frisst keine Reste an der Laibung. Optional `Opening.panelClearance`: gleichmäßiges Paneel-/Mörtel-Band (kein Zeilen-Snap), Wandloch unverändert.

### Mauerwerk an der Laibung + Freiraum (2026-08-23) — v0.7.29

Steine werden bis an die Clip-Kante der Öffnung gezogen (`sealTilesToOpeningJambs`); X-Snap frisst keine Reste mehr an der Laibung. Optional `Opening.panelClearance`: zusätzlicher Paneel-/Mörtel-Ausschnitt, Wandloch unverändert.

### Rundbogen Winkelabtastung (2026-08-23) — v0.7.28

Bogen-Polyline gleichmäßig im Winkel (`archPolyline`, 128 Segmente) statt X-Raster — keine langen Sehnen an den Kämpfern. Y-Snap der Paneellöcher endet an der Kämpferlinie.

### Rundbogen glatt (2026-08-23) — v0.7.27

Bogenkappe nicht mehr als Rechteckspalten. Clip über Kreislinie (`clipRectMinusArch`); Studio-Wandlöcher per `Shape.absarc`; Leibung/Trim folgen der Kurve.

### Öffnungen: Blendrahmen, Wand/Nische, Rundbogen, Maße, Sockel-UI (2026-08-23)

Sockel-UI bleibt bei Wandauswahl immer sichtbar. Öffnungen: editierbare Maße/Tiefe; `revealFrame` (Embed/Inset); `fill` flush|niche; `arch` mit Keilsteinen. Clip/Leibung/Trim nutzen `src/utils/openingGeometry.ts`.



### Toolbar: Label→Feld 4px (2026-08-23) — v0.7.25

- `.toolbar-group` gap und `.toolbar-row-2 label` gap auf `4px`; `.toolbar-label` ohne `margin-bottom: 16px`.

### Fensterteilung Equal 1–5 + Verhältnisse (2026-08-22) — v0.7.24

- `GruenderzeitWindowConfig`: `splitVCount`/`splitHCount`/`splitVRatio`/`splitHRatio`; dicke Primärstege; Tür-Brüstung mit diskreten Verhältnissen.
- Toolbar: Anzahl 1–5, Verhältnis nur bei Zweiteilung; Brüstung nur bei Türen.

### Zwei-Ebenen-Fensterteilung (2026-08-22) — v0.7.23

- `GruenderzeitWindowConfig`: `splitV` / `splitH` / `paneMuntins`; Layout erst Primärraster, dann Fein-Sprossen pro Teil.
- Toolbar: Fensterteilung + Mehrfachauswahl in der Vorschau für Sprossen 0–2.

### Fix: Cmd-Navigation hängt (2026-08-22) — v0.4.5

**Dateien:** `src/main.ts`

- OrbitControls mappt Cmd+LMB intern auf Pan und `controls.enabled = false` mittendrin ließ den Drag-State hängen.
- ⌘/Ctrl+LMB rotiert die Kamera direkt; Raycast zur Auswahl ohne `claddingGroup`.

### 3D-Navigation flüssiger (2026-08-22) — v0.4.4

**Dateien:** `src/main.ts`, `src/utils/sunLighting.ts`, `src/studio/roof.ts`, `src/studio/panelGeometry.ts`, `src/FacadeController.ts`

- Shadow-Map nur bei Sonne/Geometrie, nicht beim Orbitieren.
- Pixelratio max. 1,5 (Renderer + EffectComposer synchron); Bloom-Blur intern mip-basiert (kein extra Half-Res der ganzen Szene); Dachziegel 3 statt 6 Samples; Stein ohne Rückfläche.
- OrbitControls: Polarwinkel- und Distanzgrenzen, stärkeres Damping gegen Kameradurchdrehen.

### Fix: Mauerverband-Versatz (2026-08-22) — v0.4.3

**Dateien:** `src/studio/panelLayout.ts`, `docs/panel-geometry.md`

- Versatzregeln an Wikipedia/BauNetz angeglichen: Kopfverband ½ Kopf (nicht ½ Stein), Kreuzverband Verschiebekopf = 1 Kopf, Flämisch (S+H)/2, Schlesisch 3+1 Läufer/Kopf, Holländisch Kopflagen mit Versatz.

### Fix: UI ohne CSS / Start hängt (2026-08-22) — v0.4.2

**Dateien:** `src/studio/panelLayout.ts`, `src/FacadeController.ts`, `src/main.ts`, `index.html`

- **`buildCuts`:** Abbruch bei Schritt ≤ 0 / NaN und harte Schnittobergrenze — sonst blockiert der Hauptthread vor dem ersten Paint (Roh-HTML ohne Styles, kein Haus).
- **`layoutPanelTiles`:** Panel wird zuerst normalisiert; Wilder Verband und gemischte Lagen mit Iterations-Cap.
- **UI:** Muster-Kacheln nur bei sichtbarer Studio-/Dach-Toolbar; kritisches CSS inline in `index.html`.
- **3D:** Paneel-Geometrie in try/catch, Wandkörper bleibt sichtbar.

### Fix: Haus verschwindet (2026-08-22) — v0.4.1

**Dateien:** `src/studio/panelLayout.ts`, `src/utils/buildings.ts`, `src/utils/persistence.ts`, `src/main.ts`

- **Endlosschleife:** `buildMixedCourseCuts()` konnte am Wandende hängen bleiben → `FacadeController.rebuild()`/`rebuildCladding()` blockierte den Browser komplett (Studio-Wände mit Mauerwerksmustern).
- **Migration:** `migrateToBuildings()` übernimmt Legacy-`walls[]`, wenn `buildings[].walls` leer sind; `loadPersistedState()` fällt bei 0 Wänden auf v5-Backup zurück (localStorage wird nicht gelöscht).

### Toolbar, Profile, Paneele/Mauerwerk (2026-08-22) — v0.4.0

**Dateien:** `src/types/facade.ts`, `src/studio/panelLayout.ts`, `src/studio/patternPreview.ts`, `src/studio/constants.ts`, `src/studio/editScope.ts`, `src/studio/pediment.ts`, `src/profiles/windowTrim.ts`, `src/utils/openings.ts`, `src/utils/profilePaths.ts`, `src/FacadeController.ts`, `index.html`, `src/main.ts`, `src/style.css`, `src/version.ts`, `docs/*.md`

- **Szene:** `#lighting-accordion` nur ohne Auswahl sichtbar.
- **Überstand:** symmetrisch (`overhang`) für Innenbank, Außenbank, Verdachung.
- **Außenbank:** Brett-Modus vs. Profil-Kacheln; Winkel in 3D; `SILL_OUTER_PROFILE_IDS`.
- **Profilausrichtung** im Rahmenprofil-Block; Keller-Scope in `scopedOpeningRefs`.
- **Profile:** Kacheln für Gesims, Bank, Dach-Muster; `CORNICE_PROFILE_IDS`.
- **Paneele/Mauerwerk:** 15 Verbandmuster, Kontur-Vorschau, `buildMixedCourseCuts`.

### Streifen-Ebenen, Sichtbarkeit, Dach, Scope, Paneel-Regeln (2026-08-22) — v0.3.0

**Dateien:** `src/types/facade.ts`, `src/studio/constants.ts`, `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`, `src/studio/editScope.ts`, `src/studio/roof.ts`, `src/utils/profilePaths.ts`, `src/FacadeSvgView.ts`, `index.html`, `src/main.ts`, `src/style.css`, `src/version.ts`, `docs/*.md`

- **Ebene 1/2:** `recessedProjectDepth`, `recessedTaperDepth`, `recessedTaper`; Migration von `recessedDepth`; UI `#studio-alternate-layers`.
- **Z-Fighting:** Ebene-2-Default 0; bei Vorstand > 0 mindestens `jointDepth + 0,1 cm`.
- **Etage ausblenden:** `buildProfilePaths` / Gesims / Sohlbank nur für `getVisibleWalls`; `opening.hidden` übersprungen.
- **Dach:** `normalizeRoof` persistiert `hidden`; Kontextmenü „Löschen“.
- **Scope Typ Wände:** `panelConfigKey` / `wallsMatchByPanelConfig` in `editScope.ts`.
- **Türprofil unten:** nicht gerendert (3D + 2D).
- **Schmale Paneel-Reste:** `mergeNarrowPanelGaps` — Paneele min. halbe Steinbreite (`headerSize`), Mauerwerk min. Kachelbreite der Reihe.
- **Fix Paneele neben Fenstern:** `snapHoleToTileGrid` 8 cm nur Paneele; Mauerwerk Loch-X exakt an Öffnung.
- **Toolbar-Padding** rechte Leiste.

### Fix: Stottern + Köpfe an Öffnungen (2026-08-22, v0.4.6)

**Dateien:** `src/main.ts`, `src/studio/patternPreview.ts`, `src/studio/panelGeometry.ts`, `src/studio/panelLayout.ts`, `src/FacadeController.ts`, `src/version.ts`, `docs/*.md`

- **Dirty-Rendering:** 3D nur bei Kamera/Sonne/State/Bloom/Fog; Kompass max. 1×/Frame.
- **Muster-SVG-Cache;** Toolbar-Karten nur bei Muster-/Maßwechsel; Mörtel-Tiles = Stein-Tiles.
- **Kopfverband/Mauerwerk:** Öffnungsloch in X ohne 8-cm-Snap; `mergeNarrowPanelGaps` mit Steinbreite der Lage.

### Fix: Volle Details bei LOD aus (2026-08-22, v0.7.2)

**Dateien:** `src/FacadeController.ts`

- `loadMeshes()` baute nach async GLB-Load nur Low-Detail neu, ohne `highDetailBuilt` zu invalidieren → High-Meshes fehlten bei LOD aus.
- `rebuildWindows`/`rebuildCladding` leeren jetzt den High-Cache; `finalizeGeometryRebuild()` nach Rebuilds ruft bei LOD aus `forceAllHighDetail()`.

### Fix: Ziegel an der Laibung (2026-08-22, v0.7.20)

**Dateien:** `src/studio/panelGeometry.ts`

- X-Aufweitung der Öffnungslöcher (v0.7.19) zurückgenommen — ganze Lagen neben Fenstern wurden weggefressen.
- Clip immer auch gegen das echte Öffnungsrechteck; Öffnungs-Gehrung inset vom Loch weg.
- Farb-Teilmengen nutzen das volle Kachellayout für die Lochberechnung.

### Fix: Ziegel an Öffnungen (2026-08-22, v0.7.19)

**Dateien:** `src/studio/panelGeometry.ts`

- `snapHoleToTileGrid`: Steine, die die Öffnungs-Laibung schneiden, werden in X ganz ins Loch gelegt (nicht mehr halb stehen bleiben).

### Strichstärke wirksam & Szene-Register (2026-08-22, v0.7.18)

**Dateien:** `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/studio/floorPlanView.ts`, `src/main.ts`, `index.html`, `src/style.css`

- 3D-Zeichnung: `LineSegments2`/`LineMaterial` statt `LineBasicMaterial.linewidth` (WebGL ignoriert letzteres).
- Grundriss reagiert auf Strichstärke und Zeichnungsmodus (Kantendicke, schwarze Linien).
- Szene: Register-Layout wie Auswahl-Toolbar; Bloom/LOD/Nebel/Debug als eigene Reiter statt verschachtelter Akkordeons.

### Grundriss-Sidebar & Strichstärke-Chrome (2026-08-22, v0.7.17)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`

- `#plan-toolbar` aus dem Viewport in Akkordeon `#plan-sidebar` (rechte Leiste); Szene (`#lighting-accordion`) bei `currentView === 'plan'` ausgeblendet.
- Strichstärke-Steuerung von Szene nach `#view-line-stroke-row` im Viewport-Chrome (sichtbar bei Stil Zeichnung).
- Einheitlichere Formular-Abstände in Szene (Tagesverlauf Von/Bis als `toolbar-row-2`).

### Decke / Boden vereint (2026-08-22, v0.7.21)

**Dateien:** `src/FacadeController.ts`, `src/main.ts`, `index.html`, `src/style.css`, `docs/ux.md`, `docs/shadows.md`, `docs/floor-plan.md`

- `rebuildIndoorFloor`: nur noch eine Platte pro Geschossgrenze (`indoorRole = 'ceiling'`), keine separaten EG-/OG-Böden mehr.
- UI: Ebenen-Zeile und Toolbar-Überschrift „Decke / Boden“.
- Formular: 16px Abstand unter Überschriften; Checkbox-Labels linksbündig.

### UX-Feinschliff und Paneel-Clipping (2026-08-22, v0.7.14)

**Dateien:** `src/main.ts`, `src/utils/persistence.ts`, `src/FacadeSvgView.ts`, `src/FacadeController.ts`, `src/studio/panelGeometry.ts`, `index.html`, `src/style.css`

- Kompass: `updateViewCompass()` in `setCompassYaw` / `applyElevation` — Nadel folgt in 2D/Zeichnung.
- `SceneAppearance.lineStrokeScale` (Persistenz) + Szene-UI; skaliert SVG-`stroke-width` und 3D-Linienmaterial.
- `snapHoleToTileGrid`: Öffnungslöcher an Fugen (Y immer volle Zeile; X nur Paneele bei Rest &lt; 8 cm). Schmale Clipp-Reste (&lt; 8 cm) werden verworfen. Sockel wieder mit direktem Öffnungs-Clip.

### Keine Akkordeons in Auswahl-Toolbar (2026-08-22, v0.7.13)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`

- `<details>` in `#selection-toolbar-panels` durch flache Überschriften ersetzt; Sektions-Trennlinien entfernt.

### Checkboxen & Verdachungs-UI (2026-08-22, v0.7.12)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`

- Verdachung ohne `<details>`-Akkordeon; Unterüberschrift Fenster-/Türverdachung; einheitliche `.toolbar-check`-Checkboxen mit beschreibenden Labels.

### Register-Optik & Sektionsüberschriften (2026-08-22, v0.7.11)

**Dateien:** `src/style.css`, `index.html`

- Register-Leiste: grauer Hintergrund, Trennlinien, aktiver Reiter mit weißem Panel-Hintergrund.
- Sektionsüberschriften in `#selection-toolbar-panels` vergrößert.

### Opening-Toolbar: Register verfeinert (2026-08-22, v0.7.10)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`

- Modell/Aktionen nur in Tab „Alles“ (`data-settings-inline-all`); Maße = Tiefe + Position; Kanten in Profil; Farben-Hub mit Duplikat-Swatch-Containern; vertikale Reiter-Beschriftung; Tab-Sortierung via `data-settings-order`.

### Toolbar-Tabs, Verdachung für Türen (2026-08-22, v0.7.9)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`, `src/studio/pedimentGeometry.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/types/facade.ts`, `src/utils/openings.ts`

- `#selection-toolbar-tabs` + `#selection-toolbar-panels`: vertikales Register für alle Auswahl-Toolbars; `syncSelectionToolbarTabs()` filtert `.settings-section`.
- Verdachung/Konsolen aus `#window-sill-section` in `#opening-pediment-section` / `#opening-consoles-section`; Rendering für `door` wie `window` (ohne Kellerfenster).
- Rechte Spalte breiter; Profil-Kacheln 2-spaltig mit Textumbruch.

### Fix: Öffnungs-Toolbar beim Fenster-Klick (2026-08-22, v0.7.8)

**Dateien:** `src/main.ts`

- Klick in 3D/2D setzte `selectedOpeningPart` auf den getroffenen Mesh-Teil (`frame`, `trim`, …) → Profil, Bänke und Verdachung blieben ausgeblendet.
- `selectOpening()` wählt beim Anklicken immer `group` (volle Toolbar); Teil-Fokus nur über Ebenenliste (z. B. Treppe).
- Grundriss: `syncPlanView`/`setView('plan')` blendeten die rechte Toolbar dauerhaft aus — jetzt `renderUi()` mit Selektion.

### Fix: Öffnungs-Toolbar wieder sichtbar (2026-08-22, v0.7.7)

**Dateien:** `src/main.ts`

- `toolbarOpening` wurde ausgeblendet, wenn parallel Dach/Decke selektiert war (z. B. nach Klick in Ebenen).
- Toolbar-Sichtbarkeit priorisiert jetzt Öffnungen; Ebenen-Klick räumt Dach/Decke ab.

### Sonne und Schatten wie zuvor (2026-08-22, v0.7.6)

**Dateien:** `src/main.ts`, `src/utils/threeColors.ts`, `src/utils/sunLighting.ts`

- Glas-EnvMap wieder `RoomEnvironment` (keine runde Sonnenscheibe); Glas-Look und Hemisphere wie vor v0.7.3.
- `shadowMap.autoUpdate = false`; Shadow-Map fest 4096. `glassEnvironment.ts` entfernt.

### Fix: Schatten, Helligkeit, Glasreflexion (2026-08-22, v0.7.5)

**Dateien:** `src/utils/sunLighting.ts`, `src/main.ts`, `src/utils/threeColors.ts`, `src/lighting/glassEnvironment.ts`

- v0.7.4 hatte Glas zu dunkel (EnvMap/Clearcoat zu niedrig) und Shadow-Map teils 1024 px → sichtbares Raster.
- Shadow-Map wieder 4096; `autoUpdate = true`; Glas-EnvMap mit Sonnenscheibe und höherer Intensität.

### Layout, Glas, Treppen, Datei-Menü (2026-08-22, v0.7.4)

**Dateien:** `index.html`, `src/style.css`, `src/main.ts`, `src/lighting/glassEnvironment.ts`, `src/utils/threeColors.ts`, `src/studio/stairs.ts`, `src/FacadeController.ts`

- `#opening-library` in `#viewport` (Flex-Spalte); `#viewport-stage` für Canvas-Größe; Seitenleisten volle Höhe.
- Datei-Menü umbenannt; Glas-EnvMap ohne Sonnenkugel, Specular vom DirectionalLight.
- Treppen: oberste Stufe bis Wandinnenseite; Material `DoubleSide`.

### Glasreflexion, Treppen, Öffnungen-Leiste (2026-08-22, v0.7.3)

**Dateien:** `src/lighting/glassEnvironment.ts`, `src/utils/threeColors.ts`, `src/studio/stairs.ts`, `src/style.css`, `src/main.ts`

- Fenster-EnvMap: Himmel + Sonnenscheibe statt `RoomEnvironment`; geringere `envMapIntensity` → schmaler Glanzpunkt.
- Treppen: Quad-Winding wie `panelGeometry` (Trittflächen nach oben sichtbar).
- `#opening-library` nur Spalte 2 (zwischen Seitenleisten).

### Detail-Reduktion steuerbar (2026-08-22, v0.7.1)

**Dateien:** `src/lighting/lodSettings.ts`, `src/FacadeController.ts`, `src/main.ts`, `index.html`, `docs/performance.md`

- `LodSettings` persistiert; UI unter Szene; Standard `enabled: false`.
- Presets, Schwellen, Kategorie-Flags; `forceAllHighDetail()` für Export.

### Performance LOD (2026-08-22, v0.7.0)

**Dateien:** `src/utils/performanceLod.ts`, `src/FacadeController.ts`, `src/studio/panelGeometry.ts`, `src/studio/windowLod.ts`, `src/ui/perfOverlay.ts`, `src/main.ts`

- Bildschirmgrößen-LOD (high/medium/far) mit Hysterese; lazy High-Detail; inkrementeller Rebuild pro Haus.
- Ziegel ohne Shadow-Cast; dynamische Shadow-Map; Debug-Overlay.

### Fix: Viewport schrumpft beim Rauszoomen (2026-08-22, v0.6.3)

**Dateien:** `src/main.ts`, `src/studio/floorPlanView.ts`

- 3D: `camera.far` und linearer Nebel skaliert mit Site-Radius und `controls.maxDistance` (nicht mehr fest 5000).
- Grundriss: Ortho-Kamera bei y≈100, near=1, far=200 — bessere Tiefenpräzision beim Zoom-out.
- Plan: Untergrund `depthWrite=false`, Overlays `renderOrder>0`; Bodengröße folgt zusätzlich dem sichtbaren Plan-Frustum.

### Fix: Häuser beim Rauszoomen (2026-08-22, v0.6.2)

**Dateien:** `src/main.ts`, `src/studio/floorPlanView.ts`

- `framePlanCameraToContent` zentriert auf Site-Mitte (nicht 0/0); Zoom-Minimum passt zur Site-Spanne; Auto-Zentrieren beim Rauszoomen.

### Multi-Haus Viewport (2026-08-22, v0.6.1)

**Dateien:** `src/main.ts`, `src/studio/floorPlanView.ts`

- `sitePlanBounds` über alle Häuser für Untergrund und Plan-Zentrierung; dynamisches Grundriss-Zoom-Minimum; 3D-`maxDistance` skaliert mit Spanne.
- Haus-Duplikat: alle Ebenen bleiben eingeklappt.

### Ebenen, Haus-Duplikat & Regression (2026-08-22, v0.6.0)

**Dateien:** `src/studio/stairs.ts`, `src/utils/profilePaths.ts`, `src/FacadeSvgView.ts`, `src/ui/layerListHelpers.ts`, `src/main.ts`, `src/types/facade.ts`, `src/studio/floorPlan.ts`, `src/FacadeController.ts`, `src/utils/buildings.ts`, `src/studio/buildingGuides.ts`, `src/studio/floorPlanView.ts`, `index.html`

- Treppe: Podest/Setzstufen entfernt (Türblatt sichtbar); Tür-`bottom`-Profil wieder übersprungen.
- Ebenen: Labels nur Typ + Breite; Treppe unter Tür; Decke/Dach wie Wand/Geschoss; `selectedCeiling`, `selectedRoofPart`, `selectedBuildingId`.
- Haus: `duplicateBuilding` mit Himmelsrichtung; Verschieben im Plan mit `buildingGuides`.

### Geometrie, Schatten, UI & Teil-Selektion (2026-08-22, v0.5.0)

**Dateien:** `src/studio/panelGeometry.ts`, `src/studio/stairs.ts`, `src/studio/pedimentGeometry.ts`, `src/utils/profilePaths.ts`, `src/utils/sunLighting.ts`, `src/main.ts`, `src/FacadeController.ts`, `src/types/facade.ts`, `index.html`, `src/style.css`, `docs/*.md`

- Isotroper Paneel-Trapez-Inset; PCFSoft + 4096 Shadow Map; Sonnen-Defaults 4000 K / 2.0 / Weichheit 2.5.
- Treppe geschlossen (Podest, Setzstufen, Sockel-Loch); Tür-bottom-Profil; Konsolen als Profil-Sweep.
- HEX-Farbfeld; Color-Picker ohne renderUi während Pick; Teil-Selektion Treppe/Gesims.

### Fix: ⌘⇧ schwenken in 3D (2026-08-22, v0.4.10)

**Dateien:** `src/main.ts`, `index.html`, `src/version.ts`, `docs/ux.md`

- Eigene Cmd-Navigation (Maus + Pfeiltasten): ⌘/Ctrl rotiert, ⌘/Ctrl+⇧ schwenkt.
- `listenToKeyEvents` entfernt — OrbitControls behandelte ⌘ und ⌘⇧ gleich (beides rotieren).

### Fix: Navigation wie v0.3.0 (2026-08-22, v0.4.8)

**Dateien:** `src/main.ts`, `src/version.ts`, `docs/ux.md`

- Custom-Orbit und Dirty-Rendering entfernt; Damping-OrbitControls wie v0.3.0.
- v0.4.6/0.4.7-Experimente (scene3dDirty, orbit3d) verworfen — brachen Zoom/Orbit.

### Fix: Orbit hakelt auch ohne Paneele (2026-08-22, v0.4.7)

**Dateien:** `src/main.ts`, `src/version.ts`, `docs/ux.md`, `docs/shadows.md`

- **Kein `controls.update()` im 3D-Loop:** Damping ist aus; der Aufruf schrieb die Kamera jedes Frame neu und feuerte `change` → dauerhaftes Vollbild-Render (unabhängig vom Wandmuster).
- **Pixelratio:** `applyRendererPixelRatio()` (max. 1,5) auch bei Resize/Front/Grundriss — nicht mehr `devicePixelRatio` roh.
- **Cmd-Orbit:** Shadow-Map und Bloom aus, nach Loslassen wieder an.

### Scope, Ebenen, Bloom/Fog, Sockel, Dach (2026-08-22)

**Dateien:** `src/studio/floorPlan.ts`, `src/utils/buildings.ts`, `src/FacadeSvgView.ts`, `index.html`, `src/main.ts`, `src/style.css`, `src/lighting/fog.ts`, `src/studio/panelGeometry.ts`, `src/studio/walls.ts`, `src/utils/profilePaths.ts`, `src/types/facade.ts`, `src/utils/persistence.ts`, `src/version.ts`, `src/ui/releaseNotes.ts`, `docs/*.md`

- **Bugfix Decke/Ausblenden:** `syncFloorPlansFromWalls` erhält `showCeiling`/`hidden`; `getVisibleWalls` filtert ausgeblendete Etagen.
- **Gültig für:** schwebend unten mittig im Viewport.
- **Studio-Wand duplizieren:** Ebenen-Mehr-Menü, Gitter-Offset senkrecht (`duplicateStudioWallAtGrid`).
- **Dach:** Ebenen-Zeile + rechte Toolbar; `selectedRoofBuildingId`.
- **Paneele:** `openingJoin` flush|miter; Sockelhöhe in Paneel-Schritten; Türprofil auf Sockel.
- **Bloom/Fog:** EffectComposer in 3D, UI unter Szene, Persistenz `bloom`/`fog`.
- **Versionierung:** `v0.2.0` unter Titel, Release-Notes-Dialog mit GitHub-Link.

### Fix: Import-Zyklus Verdachung + Grundriss-Button (2026-08-21)

**Dateien:** `src/studio/pediment.ts`, `src/studio/pedimentGeometry.ts`, `src/FacadeController.ts`, `index.html`, `src/main.ts`, `docs/ux.md`

- Normalize/Outline in `pediment.ts` ohne `profilePaths` — verhindert TDZ/`BLENDER_WALL_MODULES` beim App-Start (leerer Viewport).
- 3D-Geometrie in `pedimentGeometry.ts`.
- Viewport-Ansicht wieder **Grundriss | 2D | 3D**.

### Öffnungs-Toolbar: Rahmenprofil und Verdachung sichtbar (2026-08-21)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`, `docs/ux.md`

- Gründerzeit-Block standardmäßig zugeklappt; **Rahmenprofil** inkl. Kanten direkt darunter; **Fensterverdachung**/Bänke vor der langen Profil-Ausrichtung (zugeklappt).
- Form/Konsolen der Verdachung sichtbar (gedimmt bis „Anzeigen“).

### Fensterverdachung mit Formen und Konsolen (2026-08-21)

**Dateien:** `src/types/facade.ts`, `src/studio/pediment.ts`, `src/profiles/windowTrim.ts`, `src/utils/openings.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/main.ts`, `index.html`, `docs/ux.md`

- Eigenes Feature `Opening.pediment` (An/Aus, Form gerade/Dreieck/Segment, Profil, Überstände, Firsthöhe, Farbe, optionale Konsolen) — unabhängig vom umlaufenden Fensterprofil.
- 3D: Sweep über Sturz (`createProfileSweepGeometry` + `fensterverdachung`), Konsolen als Extrusion (`konsolgesims`); pickable `openingPart: 'pediment'`.
- 2D: Umriss + Konsolen-Rechtecke in `FacadeSvgView`.
- UI: Akkordeon **Verdachung** neben den Fensterbänken; Vorlage-Checkbox + Form.

### 3D-Zeichnung: Kanten folgen Meshes (2026-08-21)

**Dateien:** `src/FacadeController.ts`, `docs/ux.md`

`EdgesGeometry` hängt als Kind am Mesh statt Weltpose in `lineGroup`. Vorher lagen Linien falsch, weil `lineGroup` bereits unter `siteOffset` sitzt.

### Szene-Layout, Ansichts-Buttons, Glas-Color-Picker (2026-08-21)

**Dateien:** `src/style.css`, `index.html`, `src/main.ts`, `docs/ux.md`

- Rechte Leiste: Auswahl scrollt separat, Szene fix unten ohne Overlay mit „Gültig für“.
- Viewport: 2D / 3D / Zeichnung als Button-Gruppe.
- Glas-Color-Input nie disabled (Transparent → Farbe wählbar).

### Öffnungsbreite zentriert (2026-08-25)

**Dateien:** `src/utils/openings.ts`, `src/main.ts`, `docs/views-and-state.md`

`centeredOpeningX` berechnet die neue X-Position bei Breitenänderung um die bisherige Mitte. `#opening-width` und Modell-Select nutzen dieselbe Logik. X rastet auf **halbem** Maß-Raster (4 cm bei Studio), damit ±8 cm Breite je 4 cm links und rechts geht — nicht mehr nur nach links wachsen bzw. rechts schrumpfen.

### Fix: Schrift einblenden ohne Freeze (2026-08-26)

**Dateien:** `src/studio/labelGeometry.ts`, `src/FacadeController.ts`, `src/main.ts`, `src/utils/wallLabel.ts`

„Schrift anzeigen“ ändert nur `wall.label` → `refreshWallLabels()`, kein Paneel-/Zeichnungs-Rebuild. Font-Load: Timeout 2,5 s, Gewicht 400, typeface.json erst bei „Mit Tiefe“. Kein verschachteltes `setState` nach Font-Load.

### Fix: Schrift/Paneel-LOD und Zeichnungs-Doppelkanten (2026-08-26)

**Dateien:** `src/FacadeController.ts`, `src/studio/labelGeometry.ts`, `src/studio/panelGeometry.ts`

Font-Reload nach Beschriftung darf `rebuildCladding()` nicht ohne `finalizeGeometryRebuild()` lassen (sonst bleiben nur unsichtbare Low-LOD-Paneele). `wallLabelNeedsFont` nur bei extrudierter Schrift. In der Zeichnung keine Kanten vom Wandkörper, solange Paneele aktiv sind (ausgeblendete Reihen bleiben als weiße Fläche).

### Fix: Verdachung geschlossen vs. offen (2026-08-26)

**Dateien:** `src/studio/pediment.ts`, `src/studio/pedimentGeometry.ts`, `src/main.ts`

Geschlossene Formen ignorieren Überstand und Seitenlinien (Spannweite = Öffnungsbreite bzw. `gableWidth`). Offene Formen: Checkbox Seitenlinien. Geschlossener Sweep ohne Extra-Endkappen.

### Paneel-Reihen ausblenden (2026-08-25)

**Dateien:** `src/types/facade.ts`, `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`, `index.html`, `src/main.ts`

`hideRowsBottom` / `hideRowsTop` an `StudioPanelConfig`: ganzzahlige Schichten ohne Paneele/Mörtel von unten/oben. Layout filtert per `rowIndex`; Mörtel und LOD folgen `visiblePanelRowRect`. Bei `hideRowsTop` verschiebt `syncWallDecorToTopBareBand` Schrift und Zierbänder aus dem Freistreifen auf die nackte Wandfläche (`wallLabel.ts`).

### Wandbeschriftung (2026-08-25)

**Dateien:** `src/types/facade.ts`, `src/utils/wallLabel.ts`, `src/studio/labelGeometry.ts`, `FacadeController.ts`, `index.html`, `src/main.ts`

`Wall.label` mit flacher Canvas-Textur oder extrudiertem Text (**Federo**, `fontId: federo`). Assets: `public/fonts/Federo-Regular.ttf`, `Federo-Regular.typeface.json`; Preload in `labelGeometry.ts` (`FontFace` + `FontLoader`). Tab **Schrift** in der Studio-Toolbar; Pick-Teil `wallPart: 'label'`.

### Verdachung: Giebelmaße und geschlossene Formen (2026-08-25)

**Dateien:** `src/types/facade.ts`, `src/studio/pediment.ts`, `src/studio/pedimentGeometry.ts`, `index.html`, `src/main.ts`

`gableWidth`, `sideArmWidth`; Formen `triangleClosed` / `segmentClosed`. Geschlossene Formen: nur Giebel (keine Seitenlinien). Offene Dreieck/Segment: Seitenlinien links/rechts symmetrisch über ein Feld.

### Wand duplizieren: Untermenü (2026-08-26)

**Dateien:** `src/utils/walls.ts`, `src/main.ts`, `src/studio/walls.ts`

`insertStoreyAbove`; Kontextmenü Duplizieren mit links/rechts/darüber/separiert; `groupId` beim Duplizieren löschen; `planLinked` bei Mehrfachklon darüber behalten (v0.7.115).

### Wandbeschriftung: Federo (2026-08-26)

**Dateien:** `public/fonts/Federo-Regular.ttf`, `public/fonts/Federo-Regular.typeface.json`, `scripts/ttf-to-typeface.mjs`, `src/studio/labelGeometry.ts`, `src/style.css`, `src/utils/wallLabel.ts`

Flache und extrudierte Fassaden-Schrift nutzen Federo; `@font-face` + `FontFace`-Preload für Canvas; typeface.json für `TextGeometry`. Default `fontId: federo`; Alt-`helvetiker` wird beim Laden auf Federo gemappt.

### Andocken: Orientierung & Verknüpfung (2026-08-26)

**Dateien:** `src/studio/walls.ts` (`adjustDockOrientation`, `expandPlanLinkedWallIds`), `src/main.ts`

Beim Andocken: Segment-Yaw vs. Nachbar; Differenz **> 91°** → +180°. Kollinear: Front der Nachbarwand (`inheritWallFrontFromNeighbor` / `adjustDockOrientation`). Verknüpfte Wände werden beim Verschieben über `expandPlanLinkedWallIds` mitgenommen; Dialog `askDockStyleCopy` / `promptJoinIfTouching` beim Ablegen an Schnittkanten.

### Wandfläche ohne Moiré / Paneele sichtbar (2026-08-26)

**Dateien:** `src/studio/panelGeometry.ts`, `FacadeController.ts`

Wandkörper: keine Shadow-Map-Empfang. Außenfläche bleibt auch bei aktiven Paneelen erhalten (0,15 cm nach innen versetzt), damit ausgeblendete Reihen und Streifen die Wandfarbe zeigen — kein Z-Fighting mit Mörtel.

### Wandbeschriftung: Drag (2026-08-26)

**Dateien:** `src/main.ts`, `src/studio/labelGeometry.ts`

Schrift ist auf der Fassade pick- und verschiebbar (`wallPart: 'label'`); Position speichert `label.x`/`label.y` in Wandkoordinaten und folgt der Wand bei Verschieben/Drehen.

### Treppe: Podesttiefe (2026-08-25)

**Dateien:** `src/types/facade.ts`, `src/studio/stairs.ts`, `index.html`, `src/main.ts`

`OpeningStairs.landingDepth` — oberste Ebene unabhängig vom Auftritt; Hinterkante bis Innenwand.

### Ersetzen: Mehrfachauswahl + Mittelachse (2026-08-21)

**Dateien:** `src/utils/openings.ts`, `src/main.ts`, `docs/ux.md`

`replaceOpeningsWithPreset` ersetzt alle ausgewählten Öffnungen; neue Maße werden um die Mitte des jeweiligen Vorgängers zentriert (Raster + Clamp).

### Vorlagen-UI, Duplizieren-Richtung, Mehrfach-Rechtsklick (2026-08-21)

**Dateien:** `src/main.ts`, `src/utils/openings.ts`, `src/utils/walls.ts`, `index.html`, `src/style.css`, `docs/ux.md`

- Vorlagen speichern über `dialog` `close`; Karten-UI + Live-Vorschau; Bibliothek Presets | Vorlagen | Neue Vorlage.
- Duplizieren links/rechts korrigiert; Rechtsklick behält Mehrfachauswahl.

### UI-Fixes: Color-Picker, Paneelfarbe, Öffnungs-Padding (2026-08-21)

**Dateien:** `src/main.ts`, `src/style.css`, `index.html`, `docs/ux.md`

- Color-Picker-Inputs werden bei Sync wiederverwendet (bleiben offen).
- Wand-/Paneelfarbe gemeinsam; Abwechselnde Ebenen nur bei Streifen; Öffnungs-Toolbar mit Padding (`display:flex` statt `contents`).

### Vorlagen-Bibliothek, Color-Picker, Öffnungsabstand 32, Kachel-Zufallsfarben (2026-08-21)

**Dateien:** `src/utils/openingTemplates.ts`, `src/utils/validation.ts`, `src/utils/openings.ts`, `src/studio/tileColors.ts`, `src/studio/panelGeometry.ts`, `src/studio/constants.ts`, `src/FacadeController.ts`, `src/types/facade.ts`, `src/main.ts`, `index.html`, `src/style.css`, `docs/ux.md`

- Öffnungs-Vorlagen (Gruppierung bestehender Optionen) in localStorage; Dialog „Neue Vorlage“; Bibliothek + Drag/Drop.
- `OPENING_MIN_GAP` 16 → 32 cm.
- Paneel: `tileColorVariance` / `tileColorVariety`; stabile Zufallsstufen, Mesh pro Farbe.
- UI-Farben: freie Color-Picker statt Swatch-Paletten (Glas: Transparent behalten).

### Gründerzeit-Profile, Selektion, abwechselnde Ebenen (2026-08-21)

**Dateien:** `src/profiles/gruenderzeit.ts`, `src/profiles/registry.ts`, `src/profiles/windowTrim.ts`, `src/FacadeController.ts`, `src/main.ts`, `src/utils/cornice.ts`, `index.html`, `docs/ux.md`

- Neue Gesims-/Fensterprofile: Kranz-, Gurt-, Sockel-, Konsolengesims, Fensterverdachung, Sohlbankprofil.
- 3D-Selektion: oranger Overlay (Wand + Öffnung) mit `depthTest: false`; Line-Backup speichert keine Transient-Materials.
- Abwechselnde Paneel-Ebenen (Streifen): `alternateFloors` in `normalizeStudioPanel`; UI nur bei Muster Streifen.

### Streifen: Abwechselnde Ebenen (2026-08-21)

**Dateien:** `src/studio/panelGeometry.ts`, `src/studio/constants.ts`, `src/FacadeController.ts`, `src/main.ts`, `index.html`, `docs/ux.md`

`alternateFloors` wird persistiert; bei Muster `strip` entfällt jede zweite Reihe in `layoutPanelTiles`. Checkbox unter Muster, nur bei Streifen sichtbar. Tagesverlauf: Kamera nur bei Kanal „Himmelsrichtung“.

### Fixes: Öffnungen-Sticky, Selektion, Dach, Zeichnung, Views (2026-08-21)

**Dateien:** `index.html`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/studio/roof.ts`, `src/main.ts`, `src/utils/persistence.ts`, `src/windows/gruenderzeit.ts`, `docs/ux.md`, `docs/roof.md`, `docs/views-and-state.md`

- `#opening-library` wieder direkt unter `#app` (volle Breite, grid-row 2).
- Orange Selektion wieder nach Stil; nur Farb-Hover unterdrückt; Zeichnung bleibt S/W inkl. Dach bis explizit „Farbe“.
- Dach bündig ohne Paneele; `tileTaper` sichtbar; Viewport-Ansicht „Bearbeiten“ entfernt (Legacy → 2D).

### Dach: Ziegel, Trapez, bündige Traufe, Gehrungsrinne (2026-08-21)

**Dateien:** `src/studio/roof.ts`, `src/types/facade.ts`, `src/main.ts`, `index.html`, `docs/roof.md`

- `RoofConfig` um Ziegel-Muster/Profil/Maße und Trapez (`tileTaper`/`tileTaperDepth`); UI unter Dach.
- Per-Kanten-Überstand: leere Wände bündig, ohne Rinne; geschlossene U-Rinne mit Gehrung und Endkappen.
- Ziegel auf Mansarden-Facetten (`barrel`/`pantile`) via `layoutPanelTiles`, eine BufferGeometry. Siehe [roof.md](roof.md).

### Viewport/Szene-Feinschliff (2026-08-21)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `docs/ux.md`

- Szenenfarben für alle Views; Undo/Redo oben rechts, Kompass unten links; Gültig-für sticky ohne Lücke; Ansicht+Tagesverlauf+Softness in Szene; Farb-Hover-Livevorschau ohne Orange.

### UI/Szene Cleanup: Softness, Paneele, Zeichnung S/W (2026-08-21)

**Dateien:** `index.html`, `src/main.ts`, `src/style.css`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/windows/gruenderzeit.ts`, `src/utils/sunLighting.ts`, `src/utils/threeColors.ts`, `src/utils/openings.ts`, `src/utils/persistence.ts`, `docs/shadows.md`, `docs/ux.md`

- Softness automatisch aus Elevation (0,5…8); Bloom/Gobo entfernt.
- Viewport-Dropdowns, Datei-Menü, Nav-?-Dialog, Ebenen immer offen, Gültig-für sticky.
- Abwechselnde Paneel-Ebenen; Innenbank fest weiß + 8 cm; Zeichnung reines S/W mit Linien; Fenstertyp-Select; Labels über Feldern.

### UI-Umbau: Szene-Farben statt Bloom/Gobos, Selects für Ansicht/Stil/Fenstertyp (2026-08-21)

**Dateien:** `index.html`, `src/main.ts`, `src/utils/persistence.ts`, `src/utils/threeColors.ts`, `src/utils/profilePaths.ts`, `docs/views-and-state.md`, `docs/ux.md`, `docs/shadows.md`

- **Entfernt:** Unreal-Bloom (EffectComposer/UnrealBloomPass/OutputPass) inkl. UI und Persistenz; Gobo-Schatten-UI und `GoboController`-Nutzung in `main.ts`; Innenbank-Profil-UI (Innenbank ist fixe weiße Platte, siehe `FacadeController`); Profil-Zeichnen-Editor-UI (`#profile-draft-*`); Softness-Slider.
- `render3dFrame()` rendert wieder direkt `renderer.render(scene, camera)` ohne Postprocessing.
- **Szene-Farben** als neuer Persistenz-Block `scene` (`SceneAppearance`: `background`, `ground`, `skyReflection`) in `fassaden-builder-state-v6`. Defaults in `DEFAULT_SCENE_APPEARANCE`. Farb-Inputs `#scene-bg-color` / `#scene-ground-color` / `#scene-sky-color` in der Sidebar „Szene“. Himmelsfarbe setzt `setGlassSkyReflectionColor` und baut die Fassade neu auf (Klarglas-Reflexion).
- **Selects statt Button-Gruppen:** `#view-mode-select` (front/3d/plan/edit → `setView`), `#render-style-select` (color/line → `setRenderStyle`), `#window-preset-select` (Gründerzeit-Typ). Navigation-Hilfe als `#nav-help-dialog` (`showModal()`).
- Schatten-Weichheit ist read-only (`#sun-softness-value`), wird aus dem Sonnenstand in `applyDirectionalSun` berechnet.
- Paneele: neue Checkbox `#studio-panels-alternate` (`panel.alternateFloors`).
- Gebäude-Drehung-Buttons in die Sidebar „Szene“ verschoben (unverändert `#building-rotate-ccw` / `#building-rotate-cw`).
- `profilePaths.ts`: toter Code `buildSillInnerPaths` / `sillOffsetToInnerFace` entfernt (Innenbank ohne Profil).

### Weiche Sonnen-Kamera, Site-Drehung, Animations-Kanäle (2026-08-20)

**Dateien:** `src/utils/sunLighting.ts`, `src/studio/rotateBuilding.ts`, `src/studio/compass.ts`, `src/types/facade.ts`, `src/main.ts`, `src/lighting/GoboController.ts`, `index.html`, `docs/shadows.md`, `docs/ux.md`, `docs/floor-plan.md`

- Tagesverlauf: Checkboxen Himmelsrichtung und/oder Uhrzeit (nicht mehr exklusiv). Beides: Sonne = Zeit, Kamera = Richtung.
- 3D-Kamera während der Animation in Grad ohne 45°-Snap und ohne 2D-Aufriss-Sprünge.
- Gebäude ±45° als `siteYawDeg` an einer Three-Gruppe (Meshes + Boden + Gobos), ohne Wände neu zu bauen. Nur in der 3D-Ansicht sichtbar.

### createId unter HTTP (2026-08-20)

**Dateien:** `src/utils/id.ts` (+ Aufrufer)

- `crypto.randomUUID` fehlt in Nicht-Secure-Contexts (reines `http://`). Ohne Fallback stürzt der Start ab — leeres HTML ohne Ebenen/Öffnungen.
- `createId()` nutzt `randomUUID` wenn verfügbar, sonst `getRandomValues` / Fallback.

### Unreal Bloom unter Beleuchtung (2026-08-20)

**Dateien:** `src/lighting/bloom.ts`, `src/main.ts`, `src/utils/persistence.ts`, `index.html`, `docs/shadows.md`

- Checkbox „Unreal Bloom“ plus Stärke / Radius / Schwelle / Belichtung in der 3D-Sidebar „Beleuchtung“.
- `EffectComposer` + `UnrealBloomPass` + `OutputPass` nur in der 3D-Ansicht; Front/Plan bleiben ohne Postprocessing.
- Bei aktivem Bloom: `ACESFilmicToneMapping` und Belichtung wie im three.js-Beispiel (`exposure^4`). Aus = bisheriges Rendering ohne Tone-Mapping.
- Persistenz unter `bloom` in `fassaden-builder-state-v6`.

### Paneel-Löcher am Fugenraster (2026-08-20)

**Dateien:** `src/studio/panelGeometry.ts`

- Rechengrundlage: `panelWidth` / `panelHeight` / Fuge aus `layoutPanelTiles`.
- Paneel- und Mörtel-Loch: getroffene Zeilen werden ganz aufgenommen; in X wächst das Loch nur bei Rest &lt; 8 cm bis zur Fuge. Keine Schlitze, keine Mini-Reihen, keine Merge-/Drop-Hacks.
- Wandkörper und Leibung bleiben am exakten Öffnungsmaß.

### Schmale Paneel-Reste an Nachbarn anbinden (2026-08-20)

### Paneel-Lücken an Öffnungen (Rest-Verschlucken rückgängig) (2026-08-20)

**Dateien:** `src/studio/panelGeometry.ts`

- Reste &lt; 8 cm nicht mehr verwerfen/erweitern — das ließ bei Läuferverband und niedriger Reihenhöhe treppige Fehlstellen neben Fenstern.
- Clip wieder exakt am Öffnungsrechteck; X/Y-Vorschnitt bleibt aus.

### Paneel-Splitter an Öffnungen entfernt (2026-08-20)

**Dateien:** `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`

- X/Y-Vorschnitt an Öffnungen entfernt (erzeugte ~7–8-cm-Splitter, wenn Kante nicht auf dem Fugenraster lag).
- Clip nimmt Reststücke &lt; 8 cm (`STUDIO_MASONRY`) in die Öffnung auf.
- Trapez-Kantenrücksprung weiter fest aus `panelWidth`/`panelHeight`.

### Einheitliches Paneel-Trapez, Öffnungsschnitt (XY), Außenbank-Sweep (2026-08-20)

**Dateien:** `src/studio/panelGeometry.ts`, `src/studio/panelLayout.ts`, `src/utils/profilePaths.ts`, `src/FacadeController.ts`

- `splitTilesAtOpenings`: zuerst X, dann Y nur auf noch überlappenden Mittelstücken — keine horizontal fragmentierten Steine neben dem Fenster.
- Trapez-Kantenrücksprung fest aus `panelWidth`/`panelHeight` (nicht proportional zur Reststein-Größe); `squareFront`-Sonderfall entfernt.
- Außenbank-Profil: kein separates U-Mesh mehr; Sweep wie unteres Fensterprofil (`role: 'sillOuter'`), Bankplatte bleibt Quader in `rebuildOuterSills`.

### Paneel-Y-Schnitt, Außenbank nach unten, Hilfslinien, UI-Akkordeons (2026-08-20)

**Dateien:** `src/studio/panelLayout.ts`, `src/utils/profilePaths.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `index.html`, `src/style.css`

- Paneele werden an Öffnungen auch horizontal (Sturz/Sohlbank) geteilt (später auf XY-Überlapp eingeschränkt, s. oben).
- Außenbank-Profil hängt unter der Platte nach unten; Orientierungs-Buttons nutzen `transformProfileSection`.
- Hilfslinien über volle Fassadenhöhe/-breite.
- Einstellungssektionen als eingeklappte Akkordeons; keine Caps; Pfeile 12px; Titel ohne „MVP“.

### Streifen, Läuferverband, Außenbank-Profil, Kompass-45°-Fallback (2026-08-20)

**Dateien:** `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`, `src/utils/profilePaths.ts`, `src/studio/elevation.ts`, `src/FacadeSvgView.ts`, `src/main.ts`

- Strip wieder eine Bahn pro Reihe; Läuferverband mit symmetrischen Enden (`1/1/1` / `0,5/1/…/0,5`).
- Trapez (`taperDepth`) auf allen Reststeinen → gemeinsame Frontebene.
- Außenbank-U in der Front-Ebene der Platte (wie 2D-Aufriss).
- `wallsForYaw`: bei fehlender exakter 45°-Wand nächste vorhandene Fassade.

### Gobo-Schatten, prozedurale Texturen (2026-08-20)

**Dateien:** `src/lighting/GoboController.ts`, `src/lighting/goboTextures.ts`, `src/utils/persistence.ts`, `src/main.ts`, `index.html`

Unsichtbare Shadow-Only-Meshes (`colorWrite: false`, `castShadow: true`) mit prozeduralen alphaMap-Texturen. Presets: Baum, Blätter, Wolken, Jalousie. UI im Akkordeon „Gobo-Schatten": Hinzufügen, Ein/Ausblenden, Versatz, Höhe, Abstand, Größe, Seed-Würfel. Persistiert als `gobos` in `PersistedAppState`.

### Kompass 45°, Teil-Selektion, Scope-Position, Leibungsfarbe, Paneel-Strip, Hilfslinien (2026-08-20)

**Dateien:** `src/studio/compass.ts`, `src/studio/openingGuides.ts`, `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`, `src/types/facade.ts`, `src/utils/openings.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/main.ts`, `src/style.css`, `index.html`

- Kompass-Text nicht markierbar; Ring/Nadel rasten auf 45° (inkl. N/O).
- `OpeningPart`-Picking: Toolbar folgt Bank/Rahmen/Profil/Treppe/Gitter; Verschieben bleibt Gruppen-Delta.
- Scope Etage/Fassade gilt auch für Position; Außenbank als Überstand links/rechts statt Gesamtbreite.
- Leibung eigene Meshes in Profilfarbe.
- Strip-Reihen in `panelWidth`-Steine; Frustum nur bei `taperDepth > 0`; `cornerJoin: none` ohne Paneel-Gehrung.
- Hilfslinien Kante/Mitte beim Öffnungs-Drag (3D + SVG).

### Außenbank-Profil unter der Bank (2026-08-20)

**Dateien:** `src/utils/profilePaths.ts`, `src/FacadeController.ts`

U-Profil-Punkte lagen in Wand-Ursprung-Koordinaten, der Sweep erwartet Wandmitte — Profile hingen versetzt in der Szene. 3D jetzt eigener Sweep unter der Bank (links/vorne/rechts); 2D-Aufriss mit korrigiertem Ursprung.

### Treppe, Türprofil, Paneel-Split, Fensterbank-Spiegelung, Kellerfenster (2026-08-20)

**Dateien:** `src/utils/openings.ts`, `src/studio/stairs.ts`, `src/utils/profilePaths.ts`, `src/studio/walls.ts`, `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`, `src/studio/basementWindow.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/main.ts`, `src/types/facade.ts`, `src/constants/presets.ts`, `index.html`

- Treppe leitet die Tür-Schwelle automatisch aus `count × rise` ab; aktive Treppen sperren das manuelle Y-Feld.
- Tür-Seitenprofile laufen bis zum Boden; Sockel-Boost greift auch bei angehobener Tür.
- Paneelreihen werden vor dem Öffnungs-Clip an Öffnungskanten geteilt; Trapezfront nur noch für ungeschnittene Steine.
- Innen- und Außenbank unterstützen verankerte Querschnitts-Transformationen für echtes vertikales Spiegeln.
- Neues EG-Kellerfenster (`window-basement-48`) mit Gitter-Geometrie und SVG-Darstellung.

### Sockel-Leibung, Fensterbank, Beleuchtung (2026-08-20)

**Dateien:** `src/studio/walls.ts`, `src/studio/panelGeometry.ts`, `src/utils/profilePaths.ts`, `src/FacadeController.ts`, `src/utils/sunLighting.ts`, `index.html`

Leibung über volle Wandstärke; Türprofil wächst per `forwardBoost`. Außenbank bündig an Fassade; unteres Fensterprofil ausgeblendet bei Fensterbank. Beleuchtungs-Defaults: Azimut 320°, 15:45, Intensität 2.0, Weichheit 7.0, 5000 K.

### Sockel optional, Türprofil, Innenöffnung, Außenbank, Sidebar, Weiß-Defaults (2026-08-20)

**Dateien:** `src/types/facade.ts`, `src/studio/constants.ts`, `src/studio/walls.ts`, `src/studio/panelGeometry.ts`, `src/utils/profilePaths.ts`, `src/utils/openings.ts`, `src/FacadeController.ts`, `src/windows/gruenderzeit.ts`, `src/constants/colorPalettes.ts`, `index.html`, `src/main.ts`, `src/style.css`

Sockel pro Wand mit `plinthEnabled` und eigener UI-Sektion; Gehrung nur über `cornerJoin`. Türprofile mindestens bis Sockelfront. Flügel öffnen nach innen (`LEAF_OPEN_INWARD`). Äußere Fensterbank als 3D-Platte mit U-Profil und einstellbarer Breite/Tiefe/Stärke/Winkel. Rechte Leiste strukturiert (Akkordeons, Abstände). Neue Defaults: alles weiß, Glas transparent.

### Innenwand DoubleSide, Sockeltiefe, Kastenflügel, Fensterbänke (2026-08-20)

**Dateien:** `src/FacadeController.ts`, `src/studio/panelGeometry.ts`, `src/windows/gruenderzeit.ts`, `src/utils/profilePaths.ts`, `src/utils/openings.ts`

Wandmaterial `DoubleSide`, damit Innenflächen an Gehrungswänden sichtbar bleiben. Sockel hat `plinthDepth` nach außen. Kastenfenster-Flügel (innen und außen) öffnen nach innen. Fensterbänke: Defaults für alte Fenster, Innenbrett an der Innenkante plus Profil, Außenprofil.

### Tagesverlauf folgt Kompass/Kamera (2026-08-20)

**Dateien:** `src/studio/compass.ts`, `src/main.ts`, `docs/shadows.md`, `docs/ux.md`

Animation dreht die Ansicht auf die beschienene Fassade (`orbitViewToSunAzimuth`).

### Grundriss-Schatten Ein-Pass (2026-08-21)

**Dateien:** `src/studio/floorPlan.ts`, `src/FacadeController.ts`, `src/studio/roof.ts`, `src/main.ts`, `docs/shadows.md`, `docs/ux.md`, `docs/roof.md`

`planFacesWithHoles`: Outer + Hof-Löcher. Nur Decken casten (eine Platte pro Geschossgrenze). Wände mit Fensterlöchern. Kein Zwei-Pass. Siehe [shadows.md](shadows.md).

### Decken dicht, Außenschatten Hausform (2026-08-20)

**Dateien:** `src/utils/sunLighting.ts`, `src/main.ts`, `src/FacadeController.ts`, `src/studio/roof.ts`, `docs/shadows.md`, `docs/ux.md`

Zwei Directionals (Layer 0 Außen / Layer 1 Innen), Zwei-Pass-3D-Render, Indoor-Platten als Extrusion mit Cast nur in der Innen-Map. Dach-Firstkappe Earcut; äußerster Ring nach Fläche. Siehe [shadows.md](shadows.md).

### Boden-Schatten Haus-Silhouette (2026-08-20)

**Dateien:** `src/FacadeController.ts`, `docs/shadows.md`

Innenböden werfen keine Schatten. Nur die oberste Decke (und nur ohne Dach), damit der Außenboden die Wand-/Dach-Form zeigt statt eines rotierenden Prismas.

### Tagesverlauf Von/Bis und Boden-Schatten (2026-08-20)

**Dateien:** `src/utils/solar.ts`, `src/utils/sunLighting.ts`, `src/main.ts`, `index.html`, `docs/shadows.md`

- Animation: Modus Zeit/Kompass, Von/Bis, Dauer 5…120 s; `timeWhenSunAzimuth`
- Außenboden: y=−0,5 cm, Geometrie statt Scale, polygonOffset

### Sonne nach Datum, Tagesanimation, Gebäude drehen (2026-08-20)

**Dateien:** `src/utils/solar.ts`, `src/utils/sunLighting.ts`, `src/studio/rotateBuilding.ts`, `src/main.ts`, `index.html`, `docs/shadows.md`, `docs/ux.md`, `docs/floor-plan.md`

- Berlin-Sonnenstand aus Datum + Uhrzeit; Azimut Anzeige; Tagesverlauf-Animation 20 s
- Gebäude ±45° um Schwerpunkt inkl. Grundriss-Sync

### Berliner Mansarddach v1 (2026-08-20)

**Dateien:** `src/studio/roof.ts`, `src/FacadeController.ts`, `src/types/facade.ts`, `src/utils/walls.ts`, `src/main.ts`, `index.html`, `docs/roof.md`

`FacadeState.roof`: Mansarde auf oberstem geschlossenen Ring (Neigungen, Überstand, First, Ziegel, Rinne). Siehe [roof.md](roof.md).

### EG-Fußboden an Türschwelle (2026-08-20)

**Dateien:** `src/FacadeController.ts`, `docs/ux.md`

EG-Innenboden-Y = `max(0,15, höchste EG-Türschwelle)` mit Schwelle = `wall.y + opening.y`.

### Duplizieren links/rechts (2026-08-20)

**Dateien:** `src/utils/openings.ts`, `src/utils/walls.ts`, `src/main.ts`, `docs/ux.md`

Kontextmenü: „Duplizieren nach rechts/links“; Studio-Wände entlang Wandachse, Öffnungen mit `preferredSide`.

### Edit-Scope Profil + Multi-Etagen (2026-08-20)

**Dateien:** `src/studio/editScope.ts`, `src/main.ts`, `docs/ux.md`, `docs/views-and-state.md`

- Profil-Assign und Öffnungs-Modell über `scopedOpeningRefs()`
- Scope „Etage“: alle `floorIndex`-Werte der Auswahl, nicht nur der erste Anker

### Kompass, Ebenen-Maße, Sill/Treppe-Sichtbarkeit (2026-08-20)

**Dateien:** `src/studio/compass.ts`, `src/main.ts`, `docs/ux.md`

- `viewedFacadeYaw`: `180 − lookHeading` (CW→CCW), damit S/O und O/W nicht spiegeln
- Ebenen-Liste: Maße ganzzahlig (`fmtCm` / `Math.round`)
- Fensterbank nur bei Fenstern, Eingangstreppe nur bei Türen (`applyOpeningPartVisibility`)

### Kompass, Treppe, Scope, Decken (2026-08-20)

**Dateien:** `src/main.ts`, `src/studio/editScope.ts`, `src/studio/walls.ts`, `src/studio/stairs.ts`, `src/studio/compass.ts`, `src/studio/elevation.ts`, `src/FacadeController.ts`, `src/utils/threeColors.ts`, `src/types/facade.ts`, `src/utils/persistence.ts`, `index.html`

- Kompass N/O/S/W klickbar; Elevation-Toolbar entfernt; Default-Ansicht N (0°)
- Edit-Scope Element/Typ/Etage/Fassade für Wand- und Öffnungs-Edits
- Scope **Typ**: baugleiche Öffnungen (type/width/height/Keller) im ganzen Gebäude
- Rechte Leiste: eine Scrollspur für Auswahl + Szene
- Abwechselnde Paneel-Ebenen: 0,5 cm Luftspalt zur Wand
- Kellerfenster: kein Profil/Bank/Verdachung; Checkbox nur bei aktivem Kellerfenster
- `stretchStudioFacade`: Wand links/rechts verbreitern, Gebäude/Etagen mitziehen
- Treppe: symmetrischer Überstand/Aufweitung, Stufen bis Wandaußenkante, Sockel-Boost bei angehobener Tür
- Außen-Fensterbank-Profil dreh-/spiegelbar wie Fensterprofil
- Klarglas: stärkere EnvMap-Spiegelung (`opacity` ~0,28)
- EG-Boden bei y=0,15 cm; Decke/Zwischendecken ausblendbar (`viewOptions`)
- Siehe [ux.md](ux.md)

### Eingangstreppe und Öffnungs-Raster 8 cm (2026-08-20)

**Dateien:** `src/studio/walls.ts`, `src/studio/stairs.ts`, `src/FacadeController.ts`, `src/main.ts`, `src/types/facade.ts`

`normalizeStudioWall` rastete Öffnungen auf 32 cm (`STUDIO_TILE`); jedes `setState` machte 8-cm-Ziehen rückgängig. Jetzt `STUDIO_MASONRY` (8 cm). Türen können eine Treppe vor der Fassade bekommen (Stufen, Steigung/Auftritt 8 cm, Breite, Überstand und Aufweitung links/rechts). Siehe [ux.md](ux.md).

### Fenster-Raster 8 cm, Sockel-Overlay, Klar-Glas (2026-08-20)

**Dateien:** `src/FacadeSvgView.ts`, `src/utils/validation.ts`, `src/studio/panelLayout.ts`, `src/utils/threeColors.ts`, `src/windows/gruenderzeit.ts`, `src/main.ts`, `src/constants/colorPalettes.ts`

Öffnungen ziehen und per Pfeiltaste in 8-cm-Schritten. Paneelmuster über die volle Wand; der Sockel liegt nur davor. Glas-Swatch „transparent“ plus EnvMap-Spiegelung ohne `transmission`. Siehe [ux.md](ux.md).

### Profilgenerator, Fensterbänke, Sockel, nüchterne Defaults (2026-08-20)

**Dateien:** `src/profiles/custom.ts`, `src/profiles/registry.ts`, `src/utils/profilePaths.ts`, `src/studio/panelLayout.ts`, `src/studio/panelGeometry.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/main.ts`, `src/constants/colorPalettes.ts`, `src/utils/sunLighting.ts`

Eigene Profile (mm, 45°/90°, Rundung/Invert) in `FacadeState.customProfiles`, Auflösung über `resolveProfile`. Innere Fensterbank als Quader, äußere als eigener Unterkanten-Sweep. Sockelzone vor den Paneelen in 8-cm-Schritten. Neue-Fassade-Defaults wieder Weiß/Grau/`#e8e8e8`, Sonne Azimut 75° / 13:00. Siehe [ux.md](ux.md), [panel-geometry.md](panel-geometry.md).

### 3D-Schatten: Frustum, Bias, Glas, Decke (2026-08-20)

**Dateien:** `src/utils/sunLighting.ts`, `src/main.ts`, `src/FacadeController.ts`, `src/windows/gruenderzeit.ts`, `src/windows/loadWindows.ts`

Die Shadow-Camera nutzte 2D-`getWallBounds()` (Fassaden-XY, Ziel `z = 0`) als Ortho-Frustum — unabhängig von der Sonnenrichtung. Innenraum und Fenster lagen oft außerhalb der Map; `normalBias = 1,2` cm fraß Kontakt- und Laibungsschatten. Glas mit `transmission` plus `castShadow` blockierte Öffnungen; Decken empfingen nur, warfen aber nicht.

Fit jetzt über die 3D-Welt-AABB im Licht-Raum, Lichtabstand an die Box, Map 4096, `normalBias` aus Texelgröße. Glas wirft nicht, Decke/OG-Boden werfen. Details: [shadows.md](shadows.md).

### Leibung bis Profil / Paneele im Öffnungsschacht (2026-08-20)

**Dateien:** `src/studio/walls.ts` (`studioOpeningRevealOuterZ`), `src/studio/panelGeometry.ts`

Die 3D-Leibung endete bisher an der Wandkörper-Außenkante (`z = 0…depth`). Paneele stehen davor (`projectDepth` / Trapez); ihre Schnittkanten waren im Fensterloch sichtbar. Die Leibungsquads laufen jetzt bis zur Paneelfront bzw. zur Fensterprofilebene (was weiter außen liegt). Paneel und Mörtel werden 0,12 cm größer ausgeschnitten als das Loch. `WINDOW_RECESS` (24 cm Fenstertiefe) unverändert. Siehe [ux.md](ux.md), [panel-geometry.md](panel-geometry.md).

### Zwischendecke an Innenwand (2026-08-20)

**Dateien:** `src/studio/floorPlan.ts` (`innerFaceRingWorld`), `src/FacadeController.ts` (`rebuildIndoorFloor`)

Plan-Knoten = Außenkante. Decken- und OG-Boden-Meshes folgten bisher diesem Ring und ragten bis zur Fassade — von außen eine dünne waagerechte Kante. Inset um `WALL_DEPTH` (32 cm) mit Wand-Gehrung, bündig an der Innenfläche. EG ohne Boden unverändert.

### Cmd+Rechtsklick-Pan vs. Kontextmenü

**Datei:** `src/main.ts`

OrbitControls `mouseButtons.RIGHT` bleibt `PAN`. Rechter Klick ohne Cmd öffnet das Kontextmenü und wird vor OrbitControls abgefangen. Cmd/Ctrl + Rechtsklick panned wieder.

### Studio-UX (Laibung, Farben, Hash, EG-Boden)

Siehe [ux.md](ux.md). Kurz: 24-cm-Laibung an der Wandkörper-Außenkante; Live-`#f=`-Hash nach `commitState`; Rahmen-/Glasfarbe in der Öffnungs-Toolbar; kein EG-Fußboden.

### Gehrungsfix (früher)

**Datei:** `src/studio/panelGeometry.ts`

**Problem:** `tEdge = z < 0 ? Math.abs(t) : tInner` kehrte die Gehrungsrichtung für den Vorstand nach außen um. Bei `z = -projectDepth`, `t = -1` wurde `tEdge = 1` statt `-1`, was die Vorderkante nach innen zog → klaffende V-Lücke an Außenecken.

**Fix:**
```ts
// vorher (falsch):
const t = z / refDepth
const tEdge = z < 0 ? Math.abs(t) : tInner

// nachher (korrekt):
const origin = panelBackZ !== undefined ? panelBackZ : 0
const t = (z - origin) / refDepth
const tEdge = panelDepth !== undefined ? t : tInner  // signed für Paneele
```

**v0.7.219:** Paneel-Fronten müssen **kürzer** sein (`tOut`), damit sie sich am Schnitt der Front-Ebenen treffen. Signed `t < 0` (Front länger) war der sichtbare Fehler an Abzweig-Ecken.

### Plan-Navigation (letzte Session)

**Datei:** `src/main.ts`, `src/studio/floorPlanView.ts`

- `syncPlanCamera` akzeptiert `zoom`, `offsetX`, `offsetZ`
- Zoom-to-Cursor: Welt-Punkt unter dem Mauszeiger bleibt beim Zoomen fixiert
- Drei Modi statt zwei: `'navigate' | 'draw' | 'edit'`
- `rebuildWallOverlay` zeichnet Wand-Overlays + orange Öffnungs-Meshes
- `pickPlanOpening` gibt `{ wallId, openingId }` zurück

### Etagen (letzte Session)

**Datei:** `src/main.ts`, `src/types/facade.ts`

- `FacadeState.floors?: FloorPlan[]`
- `getFloors()`, `currentFloorPlan()`, `setFloorPlan()` als Zugriffs-Helfer
- `floorSelect`, `floorAddBtn`, `floorRemoveBtn` in der Grundriss-Toolbar
- Wände werden mit `y = i × wallHeight` generiert

### Mauerverband-Muster (frühere Session)

**Datei:** `src/studio/panelLayout.ts`

Fünf Muster implementiert: Streifen, Läufer, Binder, Blockverband, Kreuzverband. Mauerverband-Ecken via `bondCornerW` basierend auf `projectDepth`.

### Multi-Building FacadeState (2026-08)

**Dateien:** `src/types/facade.ts`, `src/utils/buildings.ts`, `src/utils/walls.ts`, `src/utils/openings.ts`, `src/utils/cornice.ts`, `src/utils/profilePaths.ts`, `src/utils/persistence.ts`, `src/studio/floorPlan.ts`, `src/studio/planGeometry.ts`, `src/studio/walls.ts`, `src/studio/rotateBuilding.ts`, `src/studio/editScope.ts`, `src/studio/roof.ts`, `src/blender/wallModules.ts`, `src/FacadeController.ts`, `src/FacadeSvgView.ts`, `src/main.ts`

- `FacadeState` enthält `buildings[]` und `activeBuildingId`; Top-Level `walls`/`floors`/`roof`/`wallHeight` entfallen.
- `migrateToBuildings` normalisiert Legacy-State beim Laden (`clampFacadeState`).
- Wand-Nachbarn und Layout (`recomputeLayout`, `rebuildNeighbors`, `finalizeWallLayout`) laufen pro Gebäude; Storey-Operationen (`duplicateStorey`, `removeStorey`, …) betreffen das aktive Gebäude.
- Grundriss-Sync (`syncFloorPlansFromWalls`, `applyFloorPlanToState`, `recomputeStudioWallMiters`) und Studio-Wand-Ops (`addStudioWall`, `translateStudioCorner`, …) nutzen `updateActiveBuilding` / `mapAllWalls` / `updateBuilding`.
- `getWall` delegiert an `findWall` (Suche über alle Gebäude).
- Renderer/Utils lesen Wände über `getAllWalls` / `getVisibleWalls`; Mutationen über `mapAllWalls`, `updateBuilding`, `findBuildingForWall`.
- `FacadeController.rebuildIndoorFloor` / `rebuildRoof`: Schleife pro sichtbarem Gebäude (`building.floors`, `building.wallHeight`, `building.walls`, `building.roof`).
- Innen-Decke: Sichtbarkeit pro Etage `floors[fi].showCeiling !== false && !floors[fi].hidden` (nicht mehr global über `viewOptions`).

### Gehrung für Paneele (frühere Session)

**Datei:** `src/studio/panelGeometry.ts`

`wallLocalX` bekommt optionalen `panelDepth`-Parameter. Miter-Skalierung: `scale = panelDepth / wallDepth` statt fester Wandstärke, damit Paneele nur um ihren eigenen Vorstand gegliedert werden.
