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
- **Dirty-Rendering:** 3D/2D/Grundriss nur bei Kamera-, State- oder Resize-Änderung. `controls.update()` nicht im Loop.
- **Orbit-Lite:** Bei **jeder** Kamerageste (⌘-Drehen/Schwenken, OrbitControls inkl. Mausrad/Trackpad, Pfeiltasten): Shadow-Map-Sampling und Zeichnungskanten (`LineSegments2`) aus, Pixelratio 1 (Renderer **und** EffectComposer via `setPixelRatio`); **Bloom bleibt an**, wenn in der Szene aktiviert. Bloom-Composer mit bis zu 8× MSAA (v0.7.187). Mausrad: Three.js `start`+`end` im selben Tick — Lite bleibt 180 ms nach dem letzten Event (`ORBIT_LITE_HOLD_MS`). Nach Ende wieder volles Shadow-Sampling und volle Pixelratio (bestehende Shadow-Map, kein Rebuild). `setLineResolution` nur bei Resize/Stil, nicht jedes Frame.
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

- **Ziegel-Paneele, Mörtel und Sockel** werfen Schatten (`castShadow = true`) — Silhouette auf dem Boden folgt der Fassade. In **3D/Oben** empfangen Paneele/Mörtel/Laibung/Sockel nicht (Shadow-Map-Schraffur). In der **2D-Front** empfangen Paneele/Mörtel Werfschatten (v0.7.285).
- **Entwurf/Vorschau (v0.7.311):** `BasicShadowMap` (hart, kein PCF), Radius 0, Bloom aus. Flache Steine/Fugen empfangen harte Werfschatten der Profil-Balken; Steine selbst werfen nicht (kein Selbstschatten-Acne). Shadow-Maps werden beim Typwechsel verworfen.
- Shadow-Map-Größe: **4096**. Frustum: Gebäude plus Bodenprojektion, Länge cap 3200 cm (`src/utils/sunLighting.ts`).

## Inkrementeller Rebuild

`applyState` vergleicht alte und neue `FacadeState.buildings` (`buildingIdsNeedingRebuild`). Bei Änderung an wenigen Häusern: Rebuild nur diese (`facade.setState(state, { rebuildBuildingIds })`), nicht die ganze Site.

## Bekannte Fallstricke

- Nach async Mesh-Load (`loadMeshes`) werden Fenster/Verkleidung neu aufgebaut; bei LOD **aus** muss danach `finalizeGeometryRebuild()` laufen (High-Cache wird invalidiert).
- Erster Frame nach Load mit LOD **aus**: sofort volle Details (`forceAllHighDetail` via `setLodSettings` bzw. `finalizeGeometryRebuild`).
- Mit LOD **an**: Standard-Stufe **medium** bis Kamera evaluiert — danach High für nahe Häuser.
- `JSON.stringify`-Vergleich pro Gebäude ist grob; Site-weite Änderungen (`siteYawDeg`, neue/ gelöschte Häuser) erzwingen Voll-Rebuild.
- Modul-Wände (GLB-Cladding) haben nur High-Stufe.
- **Dirty-Rendering:** Jede sichtbare 3D-/Grundriss-Änderung muss `markViewportDirty()` aufrufen (oder `applyState` / OrbitControls `change`). Sonst bleibt das Bild stehen.
- **Vorschau an:** Keilsteine/Fächer und volle Profilquerschnitte fehlen — Rechteck-Steine/Fugen 2 cm vor der vollen Wand, Profile als Balken; Himmel = BG-Farbe; harte Schatten.
