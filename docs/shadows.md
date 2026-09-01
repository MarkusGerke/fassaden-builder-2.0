# 3D-Schatten (Directional Light)

Sonnenlicht in der 3D-Ansicht nutzt ein **Schichtenmodell** (Key + Himmel + Bodenreflex + Kontakt) — Details in [lighting-mood.md](lighting-mood.md). Key-Light: `DirectionalLight` plus `HemisphereLight`; zusätzlich `bounceDirLight` (ohne Schatten) und Kontakt-RT nur auf dem Boden. Schatten: Ortho-Shadow-Maps (**PCSS** auf `BasicShadowMap`, **4096**, Three.js MIT / Beispiel `webgl_shadowmap_pcss`). Die Map wird nur bei Sonne-/Geometrieänderung neu berechnet (`shadowMap.autoUpdate = false`), nicht beim Orbitieren. Die Szene ist in **Zentimetern**.

**Kein CSM:** Cascaded Shadow Maps sind nicht eingebunden. Stattdessen eigene Frustum-Anpassung: die Shadow-Camera umfasst die Gebäude-AABB **und** die Schnittpunkte der Sonnenstrahlen mit dem Boden (`expandBoxByGroundShadow`), begrenzt auf `SHADOW_GROUND_MAX_LENGTH` (3200 cm), plus Texel-Rasterung der Ortho-Seiten.

Glas-EnvMap: **CubeCamera vor dem Baukörper** (auf der Kameraseite, nicht im Innenraum), PMREM aus der echten 3D-Szene (Nachbarflügel, Boden, Himmelssphäre) — **kein HDRI**, kein `RoomEnvironment`. `scene.environment` bleibt leer; die Karte hängt nur an Glas/Glanz. Bake bei Geometrie-/Sonnen-/Hintergrundänderung und wenn die Kamera um ~18° um das Haus wandert. Glas ist standardmäßig **transparent** (Durchsicht in den Raum) mit Fresnel-Spiegelung; physische Transmission nur wenn der Nutzer sie > 0,08 setzt.

Ein Zwei-Pass mit Scratch-RT ist **verworfen** (Viewport wurde leer/1×1). Die Haus-Silhouette kommt aus korrekten Grundrissflächen + Wänden, nicht aus einer zweiten Sonne.

Bloom und Gobo-Schatten: frühere Laub-Gobo-UI entfernt (v0.7.341). **Unreal Bloom** und **Nebel** unter **Szene**, in **3D** und **2D-Front** (nicht Oben/Plan).

### Bloom (3D / 2D-Front)

- `EffectComposer` + `RenderPass` + `UnrealBloomPass` + optional `SMAAPass` + `OutputPass` in `main.ts` (`renderLitSceneFrame`). **v2.0.55:** `syncComposerPixelRatio` setzt auch `composer.setSize` — ohne das blieb der Composer in der Front-Ansicht bei 1×1 px (schwarzes Bild). **Dirty-Rendering (v0.7.74):** idle kein Vollbild-Render. **Bloom während Navigation (v0.7.184):** bleibt an, solange Bloom aktiviert ist (Orbit-Lite schaltet Bloom nicht mehr ab). **Schärfe (v0.7.186 / v0.7.187):** Composer-`setPixelRatio` folgt dem Renderer; Composer-RTs mit bis zu 8× MSAA (SMAA nur ohne GPU-Samples); kein extra Half-Res am Bloom-Pass. Selektion baut Edges/`applyRenderStyle` nicht neu; Shadow-Map-Rebuild nur bei Geometrie/Sonne.
- Checkbox, Schwelle / Stärke / Radius / Belichtung als Slider **und** Number (Schritt 0,001). Defaults (v0.7.290): an, Schwelle `0,85`, Stärke `0,12`, Radius `0,6`, Belichtung `1,116`. Bereiche: Schwelle `0…1,2`, Stärke `0…1,5`, Radius `0…1`, Belichtung `0,75…1,45`. **v0.7.290:** Slider-Änderungen markieren den Viewport dirty und rufen sofort `render3dFrame` auf (ohne Fog-UI-Rebuild während des Ziehens).
- Bei an: `ACESFilmicToneMapping`, `toneMappingExposure = exposure ** 3` (OutputPass). Persistenz: `PersistedAppState.bloom`.
- **Schattenseiten Hauptfläche (v2.0.57):** `dimMask = 1 − sideOrTop` — bei Gegenlicht werden auch große Wandflächen (Ost/Nord bei Südsonne) abgedunkelt; Seiten/Oberkanten der Geometrie bleiben hell. Datei: `facadeShade.ts`.
- **Flackern (v0.7.260):** Takram-Himmel mit reduzierter Display-Exposure bei Bloom; Glas-CubeCamera-Bake pausiert während Orbit-Lite (HDR-Himmel + 6 Extra-Renders blitzten sonst weiß).

### Nebel (3D)

- `THREE.Fog` (linear: near/far) oder `FogExp2` (Dichte). Persistenz: `PersistedAppState.fog`.

---

## Verhalten für den Nutzer

- Die Sonne wirft weiche Schatten auf Boden, Wände (innen und außen), Laibungen, Fensterrahmen, Glas und **Fassaden-Schrift**. **v0.7.183 / v0.7.188:** Schrift-Schatten nur auf dem Wandkörper (Freistreifen); Paneele empfangen nicht. **v0.7.198:** Wandkörper castet bei Schrift-Empfang weiter (Bodenschatten); Gesims/Zierband casteten damals nicht auf denselben Freistreifen. **v0.7.288:** Gesims/Zierband casten wieder immer — Schrift empfängt mit Z-Bias. **v0.7.199:** Beschriftung empfing keine Schatten (Lesbarkeit). **v0.7.252:** Schrift empfängt wieder Directional-Schatten; Extra-Z-Bias im Label-Shader (`LABEL_SHADOW_COORD_Z_BIAS`) verhindert, dass die 1–2 cm entfernte Wand die Glyphen frisst. Auf der Schattenseite dimmt ein eigener Schrift-Shade die ganze Glyphe (stärker als bei Wänden). Shadow-Map wird auch bei reinen Schrift-Updates neu berechnet (`consumeWallLabelsShadowDirty`).
- Licht fällt durch Fenster- und Türöffnungen in den Innenraum. Glas blockiert die Shadow-Map nicht.
- **Decke / Boden** (eine Platte pro Geschossgrenze) werfen Schatten in der Form des Grundrisses (`planFacesWithHoles`: Outer + Hof-Löcher).
- **Kein Licht durch die Trennfläche** zur Etage darunter, solange sie sichtbar ist. Ausblenden = bewusstes Oberlicht.
- **Außenschatten** folgt L/U/Hof-Polygon + Wänden mit Fensterlöchern + Dach — kein achsenparalleler Kasten aus falsch gefüllten Ringen.
- **Datum + Tageszeit (Berlin):** realistischer Sonnenstand (`src/utils/solar.ts`, NOAA-Näherung, 52,52°N / 13,405°O). Setzt Azimut, Elevation, Intensität, Weichheit und Farbtemperatur neu (`syncSunSettingsFromSolar` mit `applySolarLook`). **v0.7.251:** Datum immer heute; Tageszeit fest 0–24 h; Sonnenwinkel wieder manuell — siehe [celestial-sky.md](celestial-sky.md).
- Tageszeit-Slider **0:00–23:59** (Minutenschritte; auch Nacht und Dämmerung).
- **Manuelle Overrides:** `#sun-azimuth` (0°=N, 90°=O), Intensität, Weichheit, Farbtemperatur — bleiben, bis Datum/Tageszeit wieder den Solar-Look schreibt. Elevation bleibt beim reinen Azimut-Drehen erhalten.
- **Tagesverlauf:** Mehrfachauswahl **Himmelsrichtung** und/oder **Uhrzeit** (Checkboxen; mindestens eines). Defaults: nur Himmelsrichtung N/O→S, 20 s.
  - Nur Uhrzeit: Sonne interpoliert Von/Bis; Kamera folgt dem tatsächlichen Sonnenazimut in **Grad** (kein 45°-Raster, keine 2D-Aufriss-Sprünge).
  - Nur Himmelsrichtung: Sonne über `timeWhenSunAzimuth`; Kamera interpoliert Von/Bis auf dem kürzesten Bogen (ebenfalls weich in Grad).
  - Beides: Sonne folgt der Uhrzeit, Kamera der Himmelsrichtung (unabhängig).
- **Sonnenlicht** Default **3,9** (Slider `#sun-intensity` 0,3…**8**). Zusätzlich **Umgebungslicht** (`#sun-ambient`, Default **0,53**), **Schatten-Kontrast** (`#sun-shadow-contrast`, Default **1,50**), **Schatten-Weichheit** (`#sun-softness`, Default **5,0**), **Farbtemperatur** (`#sun-color-temp`, Default **4500 K**), Tageszeit **13:15**, Sonnenwinkel **210°** und Schatten-Dunkelheit (`#sun-shadow-density`, Default 0,55). **v0.7.253:** Diese Slider steuern auch Umbra-Tönung, Kontaktschatten und Bodenreflex — siehe [lighting-mood.md](lighting-mood.md).
- **Sonnen-Slider (v0.7.341):** Azimut/Tageszeit/Intensität: Licht sofort, Shadow-Map gedrosselt (~90 ms). **Weichheit (v2.0.1):** `#sun-softness` → PCSS-Lichtgröße 0,8…28 cm als Uniform `pcssLightSizeUv` (live, hart am Okkluder, weicher mit Abstand). **Farbtemperatur (v2.0.1):** `#sun-color-temp` färbt das Key-Light.
- **Fenster in 2D (v0.7.344):** Rahmen/Konsolen empfangen Werfschatten wenn Paneele empfangen (`syncOpeningReceiveShadows`, ohne Glas). **v2.0.9:** Teil-Rebuild muss `syncLabelShadowReceivers` rufen — sonst bleiben neue Rahmen ohne Empfang. **v2.0.12:** Erstes Shadow-Map-Bake nach `loadMeshes` (`bootstrapSceneLighting`) — ohne Reload-Workaround über Sonnenwinkel-Slider.

## Ein-Pass / Grundriss-Silhouette

```
planFacesWithHoles(plan)
  → Outer + holes (Hof = kleinerer Ring im größeren)
  → Decken-Extrude (INDOOR_SLAB_THICKNESS) castShadow — **nur Layer 1** (v2.0.18: nicht auf Außenfassade)
  + Studio-Wände mit Öffnungslöchern castShadow
  + Dach (Outer+Holes an Firstkappe) castShadow
  → eine DirectionalLight-Shadow-Map
```

| Rolle | castShadow | receiveShadow |
|---|---|---|
| `ceiling` (sichtbar) | ja (Layer 1) | ja |
| `floor` (sichtbar) | nein | ja |
| Wandkörper (Studio) | ja | ja (**v0.7.237** / **v0.7.285**; immer, nicht nur bei Schrift) |
| Öffnungs-Tunnel (unsichtbar) | ja | nein (nur Shadow-Map; bis Fassadenfront inkl. Paneeltiefe, v0.7.192) |
| Punktlicht-Raum-Okkluder (Außenring, Layer 3) | ja (nur Punktlicht-Cube-Map, `customDistanceMaterial`) | nein — unsichtbar für Kamera und Sonne |
| Paneele / Mörtel | ja | **2D-Front: ja** (v0.7.285 Werfschatten); **3D/Oben: nein** (v0.7.183 / v0.7.140 — Empfang = Schraffur) |
| Laibung | ja | **nein** (v0.7.140) |
| Dach | ja | ja |
| Sockel (Platte und Profil) | ja | **nein** (Selbstschatten-Schraffur) |
| Türfüllung / Fensterrahmen (Gründerzeit + GLTF) | ja | **2D-Front: ja** (v0.7.344, wie Paneele/Gesims-Wurf); **3D/Oben: nein** (v0.7.191 — Schraffur) |
| Eingangstreppe | ja | **ja** (v2.0.24 — Stufen-Geometrie; `shadowSide: FrontSide` gegen Acne bei `DoubleSide`) |
| Punktlicht innen/außen (Render) | ja | ja (v2.0.25 — Nacht; Cube-Shadow-Map, siehe [lighting-mood.md](lighting-mood.md)) |
| Flache Fassaden-Schrift | nein | ja (v0.7.252, Z-Bias) |
| Extrudierte Fassaden-Schrift | ja | ja (v0.7.252, Z-Bias) |
| Gesims / Zierband | ja (**v0.7.288** immer, auch bei Schrift) | ja |
| Glas | nein | nein |

**Glatt ohne Moiré (v0.7.111):** Paneele/Mörtel empfangen in **3D/Oben** keine Shadow-Map. Der Wandkörper empfängt seit **v0.7.237** / **v0.7.285** wieder Schatten (Innenflächen, auch ohne Schrift). **v0.7.285:** In der **2D-Front** empfangen Paneele/Mörtel Werfschatten (Gesims, Stein-Vorstand) — nötig für Nord-Aufriss, wo Lambert (N·L) bei typischem Tages-Azimut kaum schwankt; West wechselt Front-/Gegenlicht klar. **v0.7.301:** Empfang nur im **farbigen** Aufriss und **nicht bei Streiflicht** (`facadeSunIsGrazing`: Ost/West bei Südsonne) — sonst Shadow-Acne entlang jeder Steinkante („kaputtes“ Mauerwerk). In der **Zeichnung** immer aus. **v0.7.249:** Gegenlicht-Shader (`facadeShade.ts`) gilt einheitlich für Wände, Paneele, Mörtel und Schrift; Abdunklungsstärke folgt den Sonnen-Slidern (`facadeShadeParamsFromSun`). **v0.7.252 / v0.7.254:** Schrift hat eigene, stärkere Dim-Faktoren und dimmt die **ganze Glyphe** (nicht nur Seiten); Wand-Bounce/Hemi-Fill gilt nicht für Labels. Plus Shadow-Map-Empfang ohne Wand-Selbstschatten auf den Buchstaben. Hemisphere-Himmel/Untergrund folgen den Szenenfarben.

`dirLightIndoor` bleibt `visible = false` (Zwei-Pass verworfen).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/studio/floorPlan.ts` | `planFacesWithHoles`, `pointInPolygonXZ`, `polygonAreaXZ` |
| `src/FacadeController.ts` | Indoor-Platten mit Holes, Decken casten |
| `src/studio/roof.ts` | `topRoofFaceWorld`, Firstkappe mit Löchern |
| `src/lighting/pcssShadows.ts` | PCSS-ShaderChunk (Blocker-Suche + variable Penumbra), Lichtgröße aus Weichheit |
| `src/utils/sunLighting.ts` | Weichheit aus Elevation, Shadow-Camera, Kelvin |
| `src/utils/lightingMood.ts` | Schichten-Intensitäten aus Sonne + Szenenfarben |
| `src/lighting/groundMood.ts` | Boden-Umbra-Shader (**v0.7.264:** `ground-mood-v5`, Albedo × Sonnen-Ambient) |
| `src/utils/facadeShade.ts` | Gegenlicht: Seiten/Oberseiten; Schrift: ganze Glyphe + eigene Dims (v0.7.252/254) |
| `src/main.ts` | Szene-UI, ein Pass, Tagesanimation |
| `src/windows/gruenderzeit.ts` | Glas: kein `castShadow`, `transmission = 0`; Holz/Türfüllung ohne `receiveShadow` (v0.7.191) |
| `src/windows/loadWindows.ts` | GLTF-Fenster: Holz ohne `receiveShadow` |

## Datenfluss

```
State-Änderung / Sonnen-Slider
  → buildingWorldBox(walls)     Welt-AABB inkl. Innenraum und y=0
  → applyYawAroundYToBox        Site-Drehung
  → sunTargetFromBox            Ziel = Gebäude-Zentrum (nicht der Schattenfleck)
  → prepareSunShadowBox         AABB + Bodenprojektion der Sonnenstrahlen
  → sunDistanceForBox           Licht weit genug vor dem erweiterten Kasten
  → applySunSettings            eine DirectionalLight
  → fitDirectionalShadowCamera  Licht-Raum, Texel-Snap, left/right/top/bottom/near/far
  → updatePcssShadowParameters  PCSS-Lichtgröße aus Slider + Frustum-Breite
  → renderer.render             ein Color-Pass
```

## Defaults / Konstanten (`src/utils/sunLighting.ts`)

| Konstante | Wert | Bedeutung |
|---|---|---|
| Softness-Bereich | 0,5 … 8 | Slider → PCSS-Lichtfläche 0,8…28 cm / Frustum-Breite (`pcssLightSizeUv`-Uniform) |
| `PCSS_PENUMBRA_SCALE` | 8 | Ortho-NDC-Ausgleich; ohne ihn ist `NEAR/z` mit Near 0,002 unsichtbar |
| `PCSS_NEAR_PLANE` | 0,002 | Normalisierte Near-Plane für Blocker-Suche (Shadow-Tiefenraum) |
| `MIN_SUN_DISTANCE` | 900 cm | Untergrenze Licht→Ziel |
| `SHADOW_MAP_SIZE` | 4096 | Shadow-Map (große Sites) |
| `SHADOW_MAP_SIZE_HIGH` | 8192 | Shadow-Map wenn Site-Spanne ≤ 2200 cm (v0.7.346) |
| `PCSS_NUM_SAMPLES` | 32 | PCSS-Filter-/Blocker-Taps (v0.7.346; vorher 17) |
| `INDOOR_SLAB_THICKNESS` | 8 cm | Extrusionsdicke Etagen-Trennfläche |
| `SHADOW_BIAS` | −0.0002 | Tiefen-Bias |
| `SHADOW_NORMAL_BIAS_MIN/MAX` | 0,05 / 0,35 cm | `normalBias` aus Texelgröße (niedrig gegen Lichtspalten) |
| `SHADOW_FRUSTUM_PAD` | 120 cm | Rand um den Shadow-Kasten |
| `SHADOW_FRUSTUM_DEPTH_PAD` | 80 cm | Extra near/far |
| `SHADOW_GROUND_Y` | −0,5 cm | Bodenebene der Projektion |
| `SHADOW_GROUND_MAX_LENGTH` | 3200 cm | Cap der Boden-Schattenlänge (Texel) |

**Boden-Schatten:** Außenboden bei `y = −0,5` cm, neue `PlaneGeometry`, `polygonOffset`. Defaults: Hintergrund, Untergrund und Klar-Glas-Himmel `#ffffff` (Szene-Farben; einzeln oder über „Alle drei“).

Glas: dunkles Klarglas, CubeCamera-EnvMap der Szene von außerhalb. `transmission` Default 0 (Durchsicht), `castShadow: false`.

## Bekannte Fallstricke

- **Jeder Ring als volle Platte:** Hof + Rechteck → AABB-Kasten. Deshalb Nesting in `planFacesWithHoles`.
- **Doppelte Platten an Geschossgrenzen:** früher separate Boden- und Decken-Meshes — jetzt nur noch eine Trennfläche pro Etage.
- **Zwei-Pass / Scratch-RT:** Viewport 1×1 oder leer — nicht wieder einführen ohne sauberes Viewport-Restore.
- **Glas wirft Schatten:** füllt die Öffnung; Glas bleibt ohne Cast.
- **Einheiten cm:** Bias-Werte aus Meter-Tutorials sind hier falsch skaliert.
- **Sehr flache Sonne:** Schattenlänge über 3200 cm wird im Frustum gekappt (sonst zu grobe Texel). Der Boden in der 3D-Ansicht ist um dieselbe Reichweite vergrößert.
- **Entwurf / Vorschau:** PCSS aus, harte `BasicShadowMap` (kein Contact-Hardening) — absichtlich.
- **Weichheit-Slider tot (v2.0.1):** `#define PCSS_LIGHT_SIZE_UV` ändert den Program-Cache von `MeshStandardMaterial` nicht (shaderID `standard`). Dazu Filter `* NEAR_PLANE / zReceiver` mit Near 0,002 auf NDC-z ≈ 0. Fix: Uniform + `PCSS_PENUMBRA_SCALE` 8. Slider nur in **Render** sichtbar.
- **Weichheit-Slider träge (v0.7.335):** Pro Tick Shader-Neubau — jetzt Uniform `pcssLightSizeUv`, sofortiger Frame-Render. PCSS-Filter in Lit-Bereichen erzeugte zweiten Weichschatten. Jetzt ein Pfad: hart am Kontakt, Weichheit nur via min(hard, soft) in der Penumbra.
- **Render + schwebender Schatten (v0.7.333):** Umbra am Kontakt hart; NormalBias 0; Cast-Shadow ohne polygonOffset (`customDepthMaterial`).
- **Render + schwebender Schatten (v0.7.332):** Mindest-Filter und hoher NormalBias wirkten am Kontakt wie Peter-Panning. Contact-Hardening + PCSS-NormalBias ≤ 0,12 cm.
- **Render + „gepunktet“ / pixelig (v0.7.346):** Zu wenige PCSS-Samples (17) ließen das Poisson-Muster sichtbar werden. Jetzt **32 Samples**; kleine Sites zusätzlich **8192** Shadow-Map. Weichheit-Slider unverändert (0,8…28 cm).
- **Render + „sieht hart aus“ (v0.7.328):** Zu kleine Lichtfläche/UV und falsche Near-Skala ließen PCSS wie Basic wirken. Jetzt größere Lichtfläche + Penumbra-Skala; Weichheit-Slider in **Render** prüfen (Boden/lange Schatten).
- **Custom-Shader:** `facadeShade` und Standard-Materialien nutzen PCSS über `getShadow`. Boden (`groundMood`) nur Fill-Override — **kein** zweites Schatten-Sampling (v0.7.330).
- Wandkörper empfängt wieder Schatten (**v0.7.237** / **v0.7.285**, auch ohne Schrift); Paneele in 3D weiterhin nicht — bei Moiré an nackten Wänden ggf. prüfen. **2D-Front (v0.7.285):** Paneele empfangen Werfschatten (`setCladdingReceiveShadows`).
- **Nord-Aufriss dunkel/statisch:** Physik — N·L der Nordfront bleibt bei Azimut O→S→W ≤ 0; West wechselt Gegenlicht↔Frontlicht. Ohne Paneel-`receiveShadow` fehlen zusätzlich wandernde Gesims-/Vorstandschatten. `facadeOutward(0)` und Front-Kamera sind korrekt (−Z).
- **Teil-Rebuild ohne Empfang (v2.0.9):** `setState({ rebuildBuildingIds })` muss `syncLabelShadowReceivers` aufrufen. Gründerzeit-Meshes starten mit `receiveShadow=false`; ohne Sync fehlen Gesims-Schatten auf allen neu gebauten Fenstern.
- **Öffnungs-Tunnel (v0.7.138 / v0.7.140 / v0.7.192):** Wandloch ohne Tiefenflächen → Sonne durch die Wandstärke. Tunnel-Quads bleiben für die Shadow-Map, aber als **unsichtbare** Meshes (`colorWrite: false`). **v0.7.192:** Tunnel reicht bis zur Fassadenaußenfläche (Paneel-Vorstand), nicht nur bis zur Wandkörper-Kante — sonst helle Lichtlecks am Sturz über Türen/Fenstern. Kontur +1 cm gegen Bias.
- **Sichtbare Leibung muss bis Innenwand (v0.7.193):** Der Tunnel schließt nur Schatten; der weiße Streifen am Sturz war oft der Himmel durch die offene Wandstärke. `studioOpeningRevealInnerZ` = `studioWallInnerLocalZ` (nicht `wall.depth` bei ungedrehtem Paneel).
- **Front-Lip + Sturz:** ab v0.7.239 entfernt — Leibung ist nur der Tunnel (keine Extra-Kanten in der Zeichnung). Glas ohne `castShadow`.
- **Paneele empfangen nicht in 3D (v0.7.140):** `receiveShadow` auf Paneelen/Mörtel/Laibung erzeugt Zoom-Schraffur; `castShadow` bleibt an für Bodenschatten. **v0.7.285:** Empfang nur in 2D-Front. **v0.7.301:** nur Farbe + nicht streifend (`syncCladdingReceiveShadows` / `facadeSunIsGrazing`); Zeichnung und Ost/West bei Südsonne aus.
- **Gegenlicht Seiten/Oberseiten (v0.7.202 / v0.7.203 / v0.7.256):** Wenn die Sonne hinter der Fassade steht, bleibt die Front über Lambert dunkel; Seiten und Oberseiten bekamen weiter Direct+Hemisphere. `applyFacadeShadeShader` dämpft Direct/Hemi auf Nicht-Frontflächen (`|n.z|` klein), die Front bleibt ohne Shadow-Map (keine Schraffur). **v0.7.203:** `normalMatrix` nur im Vertex — sonst kompiliert das Fragment nicht und die Wände verschwinden. **v0.7.256:** Patch wieder nach `lights_fragment_begin` (`facade-backlit-v9`) — v7/v8 nach `lights_fragment_end` mit Bounce/Innenblock ließen Wände in Farbe verschwinden. Schrift-Dim über Label-Uniforms bleibt. Datei: `src/utils/facadeShade.ts`.
- **Schrift zu hell im Schatten (v0.7.252 / v0.7.254):** Der Wand-Shader dimmt die Front nicht (Lambert reicht). Glyphen sind Frontflächen + starkes Hemi; flache Schrift war `DoubleSide`/`transparent` (Rückseite voll Sonne); `receiveShadow` war aus, weil die Wand 1–2 cm hinter den Buchstaben die Shadow-Map fraß. Lösung: Label-Shade dimmt die ganze Glyphe stärker; `FrontSide` bei Flachschrift; Empfang mit `LABEL_SHADOW_COORD_Z_BIAS`. **v0.7.254:** Wand-Bounce/Hemi-Fill (0,82) nicht auf Schrift.
- **Türfüllung / Treppe (v0.7.191):** gleiches Muster — Empfang aus, Cast an; sonst Schraffur auf großen ebenen Flächen.
- **normalBias zu groß:** erzeugt helle Spalten an Laibung/Sockel (Peter-Panning); Max 0,35 cm.
