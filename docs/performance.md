# Performance bei vielen Häusern

## Verhalten für den Nutzer

- **Darstellungsmodus (v0.7.316):** Viewport **Entwurf** | **Vorschau** | **Render** (immer einer aktiv). Persistenz `fassaden-builder-presentation-mode` (`draft`/`preview`/`render`); alte Werte `full`/`work`/`light` werden beim Laden migriert; Legacy-Key `fassaden-builder-edit-presentation` weiter geschrieben.
  - **Entwurf:** Atlas-Textur in Streifen bei langen Wänden (v0.7.327, ~3 px/cm, kein Mipmap-Brei); Preset **armt** per Klick; **Segment tauschen** per Klick auf Abschnitt (v0.7.324); Greifer verlängert in Segment-Schritten; neue Wand nur per Ziehen.
  - **Vorschau:** Steine/Fugen als Rechteck-Meshes 2 cm vor der Wand; Profile als Balken; High-Fenster; Himmel → BG; harte Schatten.
  - **Render:** volle parametrische Geometrie, Takram-Himmel, Bloom, weiche Schatten (wie früher „alles aus“).
- **Detail-Reduktion (LOD):** Optional unter **Szene → Detail-Reduktion**. **Standard: aus** — volle Ziegel, Fenster und Profile wie vor v0.7.0.
- **Presets:** Navigation (alles an, etwas früher vereinfachen) | Ausgewogen (nur Fassaden-Muster + Silhouette) | Alle Details (LOD aus). **v0.7.154:** Preset-Buttons und „Alle Details jetzt laden“ nur sichtbar, wenn die Checkbox aktiv ist.
- **Feineinstellung:** Schwellen in Pixeln (Volle Ziegel / Vereinfachte Fassade / Silhouette) und Checkboxen pro Kategorie.
- **Export:** Button „Alle Details jetzt laden“ erzwingt volle Geometrie ohne Preset zu ändern (in Entwurf/Vorschau wirkungslos bis **Render**).
- **Performance-Debug:** **Szene → Performance-Debug** — Overlay unten rechts (persistiert in `localStorage`).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| [`src/lighting/editPresentation.ts`](../src/lighting/editPresentation.ts) | `PresentationMode`: draft / preview / render; localStorage + Migration |
| [`src/studio/panelAtlas.ts`](../src/studio/panelAtlas.ts) | Entwurf: Canvas-Atlas aus `layoutPanelTiles`; lange Wände → Streifen (v0.7.327) |
| [`src/studio/panelGeometry.ts`](../src/studio/panelGeometry.ts) | `createStudioPanelFlatGeometriesByColorIndex`, `createStudioMortarFlatGeometry` |
| [`src/utils/profilePaths.ts`](../src/utils/profilePaths.ts) | `createSimpleProfileBarGeometry` |
| [`src/studio/pedimentGeometry.ts`](../src/studio/pedimentGeometry.ts) | Verdachung/Konsolen als Balken (`simpleBar`) |
| [`src/lighting/lodSettings.ts`](../src/lighting/lodSettings.ts) | Typ, Defaults (`enabled: false`), Presets, Normalisierung |
| [`src/utils/performanceLod.ts`](../src/utils/performanceLod.ts) | Schwellen, `pixelSize`, Hysterese, `effectiveCategoryLevel` |
| [`src/ui/perfOverlay.ts`](../src/ui/perfOverlay.ts) | Debug-Overlay |
| [`src/FacadeController.ts`](../src/FacadeController.ts) | `setLodSettings`, `setEditPresentation`, flache Rebuilds |
| [`src/main.ts`](../src/main.ts) | UI, Persistenz, `applyEditPresentation` |
| [`index.html`](../index.html) | Button `#edit-presentation-btn`, Akkordeon Detail-Reduktion |

## LOD-Stufen

| Stufe | Kriterium (ca.) | Sichtbar |
|---|---|---|
| **high** | Stein > ~4 px | Volle Ziegel-Geometrie, Gründerzeit-Fenster, Leibung, Sockel |
| **medium** | Stein ~1–4 px | Vereinfachte Fassadenplatte **mit** Mörtel/Fugenfarbe und Stein-Kontrast (Low-Tier, v0.7.248), einfache Fenster/Türen |
| **far** | Haus < ~30 px Bildschirm | Farbige Bounding-Box |

Umschalten mit **Hysterese** (80 %/120 %) und Bewertung alle **6 Frames** — nur wenn sich die Stufe ändert, nicht jedes Frame `mesh.visible` setzen. Während Orbit/Pan keine LOD-Auswertung (kein Geometrie-Nachladen mitten in der Geste).

## Navigation (v0.7.74 / v0.7.77)

- **Kein Damping:** OrbitControls `enableDamping = false` — sonst hängt die Kamera um viele Frames hinter der Maus, bei niedriger FPS noch stärker.
- **Dirty-Rendering:** 3D/2D/Grundriss nur bei Kamera-, State- oder Resize-Änderung. `controls.update()` nicht im Loop. **Startup (v2.0.38):** Animationsloop startet nach UI-Wiring; Ladeoverlay in `finally`. Atmosphäre, Fenster-Meshes und erstes Shadow-Map-Bake in `bootstrapSceneLighting()` (`startupShadowReady`). Bis `sceneLightingReady` kein Dirty-Skip.
- **Orbit-Lite (v2.0.100 / v2.0.124 / v2.0.125):** Bei **jeder** Kamerageste: EnvMap-Bake pausiert; Gizmo-Update im Loop pausiert. **Pixelratio:** standardmäßig 1 während der Geste; **Ausnahme:** Bloom an und „Bloom bei Kamerabewegung aus“ nicht gesetzt → volle Pixelratio (sonst ändert sich das Bloom-Bild). **Bloom:** bleibt standardmäßig **an** während der Geste; Checkbox schaltet wieder auf den Spar-Pfad (Bloom aus + PR 1). PCSS adaptiv 1 Tap (v2.0.120). Hold `ORBIT_LITE_HOLD_MS` (320 ms).
- **PCSS-Shader-Kosten (v2.0.120):** Das Navigieren im **Render**-Modus lief mit ~4 Bilder/s (M1 Max, 1410 × 1090 px). Ursache war **nicht** die Tap-Zahl, sondern der PCSS-Shader selbst: ein globales `vec2 pcssPoissonDisk[32]`, pro Fragment mit 32 × sin/cos/pow gefüllt und in nicht entrollten Schleifen dynamisch indiziert — auf Metal Register-/Occupancy-Killer (~200 ms/Frame; 1-Tap-Referenz 14 ms; Map-Größe 8192 → 1024 brachte nur 190 → 106 ms). Fix in `pcssShadows.ts`: Disk als `const vec2 pcssDisk[32]` (in JS berechnet, gleiche Formel), Zufallsrotation als `mat2`, alle Tap-Schleifen mit Literal-Grenzen (`#pragma unroll_loop_start` — Three.js entrollt nur Literale, keine `#define`s), `step()` statt Branches. Ergebnis: volles PCSS (96 Taps, 8192-Map) im Orbit **≈ 14 ms/Frame** (Vsync), Bild pixelgleich (Mittelwert-Differenz 0,3/255). Die Kosten fielen auch bei ausgeschaltetem Codepfad an: allein die Präsenz des alten Arrays im Shader verdoppelte den 1-Tap-Frame (28 statt 14 ms).
- **PCSS-Lite adaptiv (v2.0.120):** Uniform `pcssLite` (0/1, geteilt über alle Materialien) schaltet `getShadow` der Sonne ohne Shader-Rebuild auf 1 Tap (`setPcssLiteMode`). Während Orbit-Lite misst `orbitProbeFrame` (`main.ts`) den Abstand gerenderter Frames; liegen netto `PCSS_LITE_SLOW_FRAMES` (4) Frames über `PCSS_LITE_SLOW_FRAME_MS` (30 ms), wird `pcssLiteSticky` gesetzt: Für den Rest der Sitzung navigiert die Sonne mit hartem Schatten, idle wieder PCSS. Auf schneller GPU greift der Schalter nie — kein Weich/Hart-Pop am Gestenende. Frame-Pausen (nicht dirty) setzen die Messung zurück (`orbitProbeReset`). Transmission (Glas) rendert die Szene ein zweites Mal — beide Pässe profitieren. Messung: Playwright headless mit `--use-angle=metal` (echte GPU), synthetische ⌘-Drag-Events, rAF-Abstände.
- **3D-Bögen:** Clip/SVG bleiben bei `ARCH_CURVE_SEGMENTS = 128`; Extrude/Shape und Keilsteine nutzen `ARCH_MESH_SEGMENTS = 32` bzw. 6–8 Segmente je Voussoir.

High-Detail wird **lazy** erzeugt, wenn ein Gebäude nah genug ist und LOD aktiv ist. In **Entwurf/Vorschau** wird High-Detail gar nicht gebaut.

## Nutzer-Einstellungen (`LodSettings`)

| Feld | Default | Bedeutung |
|---|---|---|
| `enabled` | `false` | Master-Schalter |
| `simplify.facadePattern` | `true` | Ziegel → Platte (Farben bleiben) |
| `simplify.windows` | `true` | Gründerzeit → Glas+Rahmen |
| `simplify.profiles` | `true` | Gesimse, Fensterbänke, Verdachung |
| `simplify.reveals` | `true` | Leibungen |
| `simplify.farHull` | `true` | Haus-Box; aus = bei „far“ medium statt Box |
| `thresholds.tileHighPx` | 4 | Volle Ziegel darüber |
| `thresholds.tileMediumPx` | 1 | Vereinfachte Fassade darüber |
| `thresholds.buildingFarPx` | 30 | Silhouette darunter |

Persistiert in `fassaden-builder-state-v6` unter `lod`.

## Schatten

- **Ziegel-Paneele, Mörtel und Sockel** werfen Schatten (`castShadow = true`) — Silhouette auf dem Boden folgt der Fassade. In **Farbe/3D** empfangen Paneele/Mörtel/Laibung/Sockel Werfschatten (`claddingReceiveShadows`, v2.0.90 / v2.0.116); Zeichnung und Streiflicht-Ost/West aus. In der **2D-Front** ebenfalls Werfschatten (v0.7.285).
- **Entwurf/Vorschau (v0.7.311):** `BasicShadowMap` (hart, kein PCF), Radius 0, Bloom aus. Flache Steine/Fugen empfangen harte Werfschatten der Profil-Balken; Steine selbst werfen nicht (kein Selbstschatten-Acne). Shadow-Maps werden beim Typwechsel verworfen.
- Shadow-Map-Größe: **4096**. Frustum: Gebäude plus Bodenprojektion, Länge cap 3200 cm (`src/utils/sunLighting.ts`).

## Inkrementeller Rebuild

`applyState` vergleicht alte und neue `FacadeState.buildings` (`buildingIdsNeedingRebuild`). Bei Änderung an wenigen Häusern: Rebuild nur diese (`facade.setState(state, { rebuildBuildingIds })`), nicht die ganze Site. **v2.0.2:** Auch bei nur einem Haus liefert die Funktion die ID (nicht `null`) — sonst wurde jedes Fensterziehen zum vollen Site-Rebuild.

**Live-Ziehen (v2.0.4):** `previewMeshDrag` / `previewOpeningDrag` während pointermove: State sofort, Ghost-Meshes nur translatieren (`FacadeController.applyLiveOpeningOffsets`). **Kein** voller `rebuildBuilding` pro Frame, kein `svgView`, keine Persistenz. **Fensterziehen:** Beim ersten Zug schließt `beginOpeningDragMode` einmalig Loch + Paneele; sichtbar ist nur der orangefarbene Öffnungs-Umriss (`openingDragGhostGroup`, 48 cm vor der Außenseite). Fenster, Profile, Bänke, Verdachung und Laibung sind während des Ziehens ausgeblendet; Schatten-Map wird **einmal** beim Drag-Start neu gebaut (v2.0.7), Schatten-Tunnel castet nicht. Nach `pointerup`/`commitState`: betroffene Gebäude werden **immer** neu gebaut (`peekOpeningDragWallIds`, v2.0.8); danach `syncLabelShadowReceivers` (v2.0.9), sonst bleiben neue Fensterrahmen ohne `receiveShadow`. Wand-Greifer nutzen weiter `previewLiveState` (Rebuild max. 1×/Frame).

`buildingIdsNeedingRebuild` liefert auch bei nur einem Haus die ID (nicht `null`) — relevant für Resize-Vorschau und Commit.

## Bekannte Fallstricke

- **Live-Ziehen von Öffnungen:** Beim ersten Zug schließt die Wand einmalig; sichtbar ist nur die orangefarbene Öffnungsmaske (exakte Kontur: Bogen/Stadion/Rechteck, 48 cm vor der Fassade, ohne Werfschatten). Profile, Bänke und Fenster-Detail sind ausgeblendet. Nach `pointerup` sitzt alles wieder passgenau inkl. Schatten.
- Nach async Mesh-Load (`loadMeshes`) werden Fenster/Verkleidung neu aufgebaut; bei LOD **aus** muss danach `finalizeGeometryRebuild()` laufen (High-Cache wird invalidiert).
- Erster Frame nach Load mit LOD **aus**: sofort volle Details (`forceAllHighDetail` via `setLodSettings` bzw. `finalizeGeometryRebuild`).
- Mit LOD **an**: Standard-Stufe **medium** bis Kamera evaluiert — danach High für nahe Häuser.
- `JSON.stringify`-Vergleich pro Gebäude ist grob; Site-weite Änderungen (`siteYawDeg`, neue/ gelöschte Häuser) erzwingen Voll-Rebuild.
- Modul-Wände (GLB-Cladding) haben nur High-Stufe.
- **Dirty-Rendering:** Jede sichtbare 3D-/Grundriss-Änderung muss `markViewportDirty()` aufrufen (oder `applyState` / OrbitControls `change`). Sonst bleibt das Bild stehen. Beim App-Start (v2.0.38): `animate()` direkt nach Fassaden-Setup; Schatten-Map-Bake erst wenn Atmosphäre und Fenster-Meshes bereit sind.
- **Vorschau an:** Keilsteine/Fächer und volle Profilquerschnitte fehlen — Rechteck-Steine/Fugen 2 cm vor der vollen Wand, Profile als Balken; Himmel = BG-Farbe; harte Schatten.
