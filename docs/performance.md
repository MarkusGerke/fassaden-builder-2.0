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
- **Dirty-Rendering:** 3D/2D/Grundriss nur bei Kamera-, State- oder Resize-Änderung. `controls.update()` nicht im Loop. **Startup (v2.0.38 / v2.0.149):** Animationsloop startet nach UI-Wiring; Ladeoverlay erst nach `bootstrapSceneLighting()` (Himmel, Meshes, Shadow-Bake) + 2 Frames. Bis `sceneLightingReady` kein Dirty-Skip.
- **Licht-only (v2.0.141 / v2.0.146 / v2.0.147):** Hinzufügen/Ausblenden/Löschen/Verschieben/Duplizieren von Bibliotheks-Lichtern kein Fassaden-Rebuild (`stabilizeFloorPlanIds` + früher Licht-Schnellpfad ohne `syncFloorPlansFromWalls`). Marker/Licht sofort; Punktlicht-Shadows **verzögert** und **pro Licht** (`shadow.autoUpdate = false`, nur dirty `needsUpdate`) — kein Mit-Bake der Sonne und der übrigen Cubes. Slider: Live-Preview ohne History, Commit bei Loslassen.
- **Sonne live (v2.0.148–v2.0.150 / v2.0.182 / v2.0.201 / v2.0.202):** Tageszeit/Azimut: Himmel+Key sofort. **Manueller Scrub (v2.0.202):** Sonnen-Shadow jedes Lighting-Frame (rAF); Debounce (~120–280 ms) nur noch Tagzyklus — sonst Sprünge. Scrub: Gebäudebox gecacht, Frustum fitten, Map-Größe/EnvMap/Schedule-Actors erst bei `change`. Dämmerung/Schedule: Auto-Lichter soft (`enabled` + `fadeFactor`, kein `applyState`); Okkluder bleiben bei existierenden Lichtern; Re-Enable ohne Cube-Rebake.
- **Orbit-Lite (v2.0.100 / v2.0.124 / v2.0.125 / v2.0.151 / v2.0.170 / v2.0.172 / v2.0.196 / v2.0.197):** Bei **jeder** Kamerageste: EnvMap-Bake pausiert; Gizmo-Update im Loop pausiert. **Pixelratio:** Entwurf/Vorschau → 1 während der Geste; **Render** und Bloom (ohne „bei Bewegung aus“) → volle Pixelratio (sonst wirken weiche Schatten hart). **Bloom:** bleibt standardmäßig **an** beim Orbit — Szene direkt auf den Canvas, Bloom additiv. Hold `ORBIT_LITE_HOLD_MS` (320 ms). **v2.0.197:** kein PCSS-Lite-Pfad mehr im Shader; Cursor-Rule gegen Regression.
- **Grauer Kasten beim Orbit (v2.0.171):** Profile/Bänke/Verdachung ohne Frustum-Culling; Plan-Miter gekappt.
- **PCSS-Shader-Kosten (v2.0.120):** Das Navigieren im **Render**-Modus lief mit ~4 Bilder/s (M1 Max, 1410 × 1090 px). Ursache war **nicht** die Tap-Zahl, sondern der PCSS-Shader selbst: ein globales `vec2 pcssPoissonDisk[32]`, pro Fragment mit 32 × sin/cos/pow gefüllt und in nicht entrollten Schleifen dynamisch indiziert — auf Metal Register-/Occupancy-Killer (~200 ms/Frame; 1-Tap-Referenz 14 ms; Map-Größe 8192 → 1024 brachte nur 190 → 106 ms). Fix in `pcssShadows.ts`: Disk als `const vec2 pcssDisk[32]` (in JS berechnet, gleiche Formel), Zufallsrotation als `mat2`, alle Tap-Schleifen mit Literal-Grenzen (`#pragma unroll_loop_start` — Three.js entrollt nur Literale, keine `#define`s), `step()` statt Branches. Ergebnis: volles PCSS (96 Taps, 8192-Map) im Orbit **≈ 14 ms/Frame** (Vsync), Bild pixelgleich (Mittelwert-Differenz 0,3/255). Die Kosten fielen auch bei ausgeschaltetem Codepfad an: allein die Präsenz des alten Arrays im Shader verdoppelte den 1-Tap-Frame (28 statt 14 ms).
- **PCSS-Lite (entfernt v2.0.197):** Uniform `pcssLite` / 1-Tap beim Orbit — **nicht wieder einführen** (wirkte als harte Schatten und Wandfarben-Flash; Rule `orbit-visual-stability.mdc`).
- **Tag/Nacht & Lichter (v2.0.170):** Live-Uhr ruft `applyWorkModeShadowStyle` ohne Bake; Sonnen-`needsUpdate` erst im Debounce-Timeout (120/280 ms); Studio-Hintergrund ohne EnvMap jedes Tick; `stableLightCount` sobald Lichter existieren; Punktlicht-`castShadow` an `enabled` (nicht Fade); „Alle Lichter an“ soft wie Auto-Sonne; Key-Schatten mit Intensitäts-/Hysterese-Schwelle.
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

## Licht-Modus

Gemessen (v2.0.163, M1 Max, 1260×917 @ DPR 1,5, 10 Lichter, 30 Glas-Materialien mit Transmission): vor dem Fix **10 FPS im Leerlauf** (98 ms/Frame), Orbit mit 100–280-ms-Hängern, Hinzufügen/Duplizieren **3,5–5,8 s** blockierend. Ursachen und Maßnahmen (`src/main.ts`, `src/lighting/sceneLightRuntime.ts`):

| Ursache | Kosten | Maßnahme |
| --- | --- | --- |
| Um 00:00 wirft der **Mond** Schatten (`keyCastShadow`): PCSS mit 96 Taps auf einer 8192²-Map für jedes Fragment — bei Intensität 0,01 unsichtbar | 98 → 3 ms/Frame | `applySunLighting`: `castShadow: mood.keyCastShadow && !lightEditMode` |
| **EnvMap-Bake** (6 Cube-Renders + PMREM) nach jedem Orbit-Ende / View-Bucket-Wechsel | ≈ 1 s Hänger | `renderLitSceneFrame`: kein Bake im Licht-Modus; vorhandene EnvMap bleibt gebunden, beim Verlassen wird neu gebacken |
| **Shader-Neukompilierung** aller ~90–160 Programme, sobald sich die Anzahl sichtbarer Punkt-/Spotlichter ändert (Three.js-Programm-Key): jedes Hinzufügen, Duplizieren, Löschen, jeder Blaulicht-Blitz, jede Abstrahlrichtung | 3,5–5,8 s pro Änderung | `stableLightCount`: inaktive Lichter bleiben `visible` mit Intensität 0; Reserve-Lichter (`sceneLightSparePoint/Spot`, Intensität 0) füllen auf ein Vielfaches von `STABLE_LIGHT_COUNT_STEP = 4` (mind. eine Reserve, Hysterese nach oben). Rebuild nur noch alle 4 neuen Lichter |
| Fragment-Kosten ∝ Lichtanzahl × Pixelzahl; **Glas-Transmission** rendert die Szene ein zweites Mal | 16 Lichter: 33 ms, 24 Lichter: 82 ms bei DPR 1,5 | Pixel-Ratio **1** (`applyRendererPixelRatio`) und `renderer.transmissionResolutionScale = 0.5` im Modus |
| Licht-Drag: zusätzlicher synchroner `render3dFrame()` pro `pointermove` (bis 120 Hz) neben `animate()` | 50–80-ms-Hänger | nur `markViewportDirty()`; ein Frame pro rAF |
| Übergang: neue Programm-Varianten (Sonnenschatten aus, Lichtanzahl) | 0,7–4 s | **Ladescreen** `#light-mode-loading` (`toggleLightEditMode`): Overlay 2 Frames zeichnen → `setLightEditMode` → `renderer.compileAsync` → erster Frame → Overlay weg. `animate()` pausiert über `lightModeTransition`, Doppelklick abgefangen (`lightModeToggleBusy`) |

Ergebnis: Leerlauf, Orbit und Licht-Drag bei 60 FPS ohne Long-Tasks; Hinzufügen/Duplizieren/Löschen 20–40 ms; Ein-/Austritt 0,3–1,3 s hinter dem Overlay. `syncAutoSceneLightsWithSun` läuft im Modus nicht (alle Lichter erzwungen an).

**Fallstricke:** `lightEditMode` ist früh deklariert (vor `applyRendererPixelRatio()` beim Modul-Start). Reserve-Lichter kosten wie echte Lichter — der Schritt 4 ist ein Kompromiss zwischen Rebuild-Häufigkeit und Frame-Kosten. Beim Verlassen setzt `syncSpareLights(false)` alle Reserven unsichtbar; `keepCounted` fällt zurück auf „nur aktive Lichter sichtbar“. Dev-Hook: `window.__fbDebug = { renderer, scene, camera, THREE }` (nur `import.meta.env.DEV`) für Konsolen-Diagnose.

## Inkrementeller Rebuild

`applyState` vergleicht alte und neue `FacadeState.buildings` (`buildingIdsNeedingRebuild`). Bei Änderung an wenigen Häusern: Rebuild nur diese (`facade.setState(state, { rebuildBuildingIds })`), nicht die ganze Site. **v2.0.2:** Auch bei nur einem Haus liefert die Funktion die ID (nicht `null`) — sonst wurde jedes Fensterziehen zum vollen Site-Rebuild.

**Live-Ziehen (v2.0.4 / v2.0.171):** `previewMeshDrag` / `previewOpeningDrag` während pointermove: State sofort, Ghost-Meshes nur translatieren (`FacadeController.applyLiveOpeningOffsets`). **Kein** voller `rebuildBuilding` pro Frame, kein `svgView`, keine Persistenz. **Fensterziehen:** Beim ersten Zug schließt `beginOpeningDragMode` einmalig Loch + Paneele (Sockel bleibt stehen); sichtbar ist nur der orangefarbene Öffnungs-Umriss (`openingDragGhostGroup`, 48 cm vor der Außenseite). Fenster, Profile, Bänke, Verdachung und Laibung sind während des Ziehens ausgeblendet; Schatten-Map nur **gedrosselt** (`scheduleShadowMapUpdate`, v2.0.171 — kein Flush → kein Sockel/Gesims-Farbflash). Nach `pointerup`/`commitState`: betroffene Gebäude werden **immer** neu gebaut (`peekOpeningDragWallIds`, v2.0.8); danach `syncLabelShadowReceivers` (v2.0.9), sonst bleiben neue Fensterrahmen ohne `receiveShadow`. Wand-Greifer nutzen weiter `previewLiveState` (Rebuild max. 1×/Frame).

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
