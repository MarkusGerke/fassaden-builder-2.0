# 3D-Schatten (Directional Light)

Sonnenlicht in der 3D-Ansicht nutzt ein **Schichtenmodell** (Key + Himmel + Bodenreflex + Kontakt) — Details in [lighting-mood.md](lighting-mood.md). Key-Light: `DirectionalLight` plus `HemisphereLight`; zusätzlich `bounceDirLight` (ohne Schatten) und Kontakt-RT nur auf dem Boden. Schatten: Ortho-Shadow-Maps (**PCSS** auf `BasicShadowMap`, **4096**, Three.js MIT / Beispiel `webgl_shadowmap_pcss`). Die Map wird nur bei Sonne-/Geometrieänderung neu berechnet (`shadowMap.autoUpdate = false`), nicht beim Orbitieren. Die Szene ist in **Zentimetern**.

**Kein CSM:** Cascaded Shadow Maps sind nicht eingebunden. Stattdessen eigene Frustum-Anpassung: die Shadow-Camera umfasst die Gebäude-AABB **und** die Schnittpunkte der Sonnenstrahlen mit dem Boden (`expandBoxByGroundShadow`), begrenzt auf `SHADOW_GROUND_MAX_LENGTH` (3200 cm), plus Texel-Rasterung der Ortho-Seiten.

Glas-EnvMap: **CubeCamera vor dem Baukörper** (auf der Kameraseite, nicht im Innenraum), PMREM aus der echten 3D-Szene (Nachbarflügel, Boden, Himmelssphäre) — **kein HDRI**, kein `RoomEnvironment`. `scene.environment` bleibt leer; die Karte hängt an Glas, Paneelen/Wänden (`forceExteriorEnv`), Laibungen (**v2.0.186**), Profilen, **Fensterrahmen (v2.0.187)** und Innenflächen. Bake bei Geometrie-/Sonnen-/Hintergrundänderung und wenn die Kamera um ~18° um das Haus wandert. Glas ist standardmäßig **transparent** (Durchsicht in den Raum) mit Fresnel-Spiegelung; physische Transmission nur wenn der Nutzer sie > 0,08 setzt.

Ein Zwei-Pass mit Scratch-RT ist **verworfen** (Viewport wurde leer/1×1). Die Haus-Silhouette kommt aus korrekten Grundrissflächen + Wänden, nicht aus einer zweiten Sonne.

## Lichtdichte Hülle (Sonne)

Die Sonne darf **ausschließlich durch Wandöffnungen und Glas** scheinen.

**Nicht** durch: Wände, Decken, Böden, Fensterrahmen, Sprossen, Türfüllungen, Laibungs-Holz, Gesims, Dach, Sockel, opake Paneele.

| Darf Licht durch | Darf **kein** Licht durch |
|---|---|
| Wandöffnung (Loch in der Shadow-Map) | Wandkörper, Paneele, Mörtel |
| Glas (`castShadow: false`) | Fensterrahmen, Sprossen, Konsolen, Türfüllung |
| | Decken- und Bodenplatten, Dach, Sockel, Gesims |

Glas bleibt ohne Cast, damit die Öffnung hell bleibt. Alles Opake in der Hülle wirft in der Sonnen-Shadow-Map. Geschossplatten bleiben lichtdicht, solange sie sichtbar sind (Ausblenden = bewusstes Oberlicht). **v2.0.100:** Sichtbare Decke/Boden nur Layer 1 (kein Streifen auf der Fassade); unsichtbarer `sunCeilingOccluder` an der Innenkante wirft in Layer 0 und blockiert die Sonne. **v2.0.102:** Bibliotheks-Punktlicht beleuchtet Fassade und Innenraum; Lichtdichte über Cube-Shadows (nicht Shader-Skip) — siehe [scene-lights.md](scene-lights.md).

---
Bloom und Gobo-Schatten: frühere Laub-Gobo-UI entfernt (v0.7.341). **Unreal Bloom** und **Nebel** unter **Szene**, in **3D** und **2D-Front** (nicht Oben/Plan).

### Bloom (3D / 2D-Front)

- **Bloom während Navigation (v2.0.124 / v2.0.125 / v2.0.172):** Default **an** auch bei Orbit-Lite; optional `#bloom-disable-during-motion`. **v2.0.172:** Szene direkt auf den Canvas, Bloom nur additiv (Composer nicht auf den Default-FB); Himmel ohne Depth-Test. **v2.0.125:** Bei Bloom an und „bei Bewegung aus“ nicht gesetzt bleibt die Pixelratio beim Orbit voll.
- **Öffnungs-Zug Commit (v2.0.173):** Nach `endOpeningDrag` kein `applySunLighting({ updateShadowMap: true })` — verzögert via `live` + `scheduleShadowMapUpdate` (sonst Profile kurz dunkelgrau durch Material-Invalidate + Map-Flush).
- Checkbox, Schwelle / Stärke / Radius / Belichtung als Slider **und** Number. Defaults (v2.0.57 / v2.0.104): aus, Schwelle `0,72`, Stärke `0,28`, Radius `0,6`, Belichtung `1,116`. Bereiche: Schwelle `0…1,2`, Stärke `0…1,5`, Radius `0…1`, Belichtung `0,75…1,45`.
- Bei an: `ACESFilmicToneMapping`, `toneMappingExposure = exposure ** 3` (OutputPass). Persistenz: `PersistedAppState.bloom`.
- HDR-Lichtkerne an Punktlichtern bleiben optional (`enableBloomLayer`); Full-Scene-Bloom erfasst sie ohnehin.
- **Schattenseiten Hauptfläche (v2.0.57):** `dimMask = 1 − sideOrTop` — bei Gegenlicht werden auch große Wandflächen (Ost/Nord bei Südsonne) abgedunkelt; Seiten/Oberkanten der Geometrie bleiben hell. Datei: `facadeShade.ts`.
- **Nacht (v2.0.140 / v2.0.184 / v2.0.185 / v2.0.186):** Bei `elevationRad ≤ 0.02` setzt `facadeShadeParamsFromSun` alle Dim-Faktoren auf **1** — sonst dämpft der Gegenlicht-Shader auch Punktlicht und Wände wirken dunkelgrau. **v2.0.184:** Sternennacht ohne Ambient-Mittelgrau; Mondlicht bläulich mit Key-Schatten. **v2.0.185:** Außen-EnvMap (`forceExteriorEnv` / Glas) skaliert mit der Tageszeit; Reflexions-Himmel im Cube-Bake folgt Nacht/Mond. **v2.0.186:** Laibungen nutzen dieselbe Außen-/Innen-EnvMap wie Paneele (kein selektives Schwarz an der Kante).
- **Flackern / harte Orbit-Schatten (v0.7.260 / v2.0.196 / v2.0.197):** Takram-Himmel mit reduzierter Display-Exposure bei Bloom; Glas-CubeCamera-Bake pausiert während Orbit-Lite. **v2.0.196:** Env-Bind nur nach Bake; Cube-Bake stellt Render-Target wieder her. **v2.0.197:** `pcssLite` entfernt; Render-Orbit behält volle Pixelratio — weiche Schatten bleiben weich. **Nicht wieder einführen:** 1-Tap beim Orbit, DPR-Drop im Render (Rule `orbit-visual-stability.mdc`).

### Nebel (3D)

- `THREE.Fog` (linear: near/far) oder `FogExp2` (Dichte). Persistenz: `PersistedAppState.fog`.

---

## Verhalten für den Nutzer

- Die Sonne wirft weiche Schatten auf Boden, Wände (innen und außen), Laibungen, Fensterrahmen, Glas und **Fassaden-Schrift**. **v0.7.183 / v0.7.188:** Schrift-Schatten nur auf dem Wandkörper (Freistreifen); Paneele empfangen nicht. **v0.7.198:** Wandkörper castet bei Schrift-Empfang weiter (Bodenschatten); Gesims/Zierband casteten damals nicht auf denselben Freistreifen. **v0.7.288:** Gesims/Zierband casten wieder immer — Schrift empfängt mit Z-Bias. **v0.7.199:** Beschriftung empfing keine Schatten (Lesbarkeit). **v0.7.252:** Schrift empfängt wieder Directional-Schatten; Extra-Z-Bias im Label-Shader (`LABEL_SHADOW_COORD_Z_BIAS`) verhindert, dass die 1–2 cm entfernte Wand die Glyphen frisst. Auf der Schattenseite dimmt ein eigener Schrift-Shade die ganze Glyphe (stärker als bei Wänden). Shadow-Map wird auch bei reinen Schrift-Updates neu berechnet (`consumeWallLabelsShadowDirty`).
- Licht fällt **nur** durch Fenster- und Tür**öffnungen** und **Glas** in den Innenraum. Wände, Decken, Böden und Fensterrahmen bleiben lichtdicht (siehe [Lichtdichte Hülle](#lichtdichte-hülle-sonne)).
- **Decke / Boden** (eine Platte pro Geschossgrenze, **Innenkante** + 1 cm Inset, v2.0.129) werfen und empfangen Schatten; Form aus `planFacesWithHoles` inkl. Hof-Löcher. Lichtdichte über Wand + Außenring-Punktlicht-Okkluder + `sunCeilingOccluder`.
- **Kein Licht durch die Trennfläche** zur Etage darunter, solange sie sichtbar ist. Ausblenden = bewusstes Oberlicht.
- **Außenschatten** folgt L/U/Hof-Polygon + Wänden mit Fensterlöchern + Dach — kein achsenparalleler Kasten aus falsch gefüllten Ringen.
- **Datum + Tageszeit (Berlin):** realistischer Sonnenstand (`src/utils/solar.ts`, NOAA-Näherung, 52,52°N / 13,405°O). Setzt Azimut, Elevation, Intensität, Weichheit und Farbtemperatur neu (`syncSunSettingsFromSolar` mit `applySolarLook`). **v0.7.251:** Datum immer heute; Tageszeit fest 0–24 h; Sonnenwinkel wieder manuell — siehe [celestial-sky.md](celestial-sky.md).
- Tageszeit-Slider **0:00–23:59** (Minutenschritte; auch Nacht und Dämmerung).
- **Manuelle Overrides:** `#sun-azimuth` (0°=N, 90°=O), Intensität, Weichheit, Farbtemperatur — bleiben, bis Datum/Tageszeit wieder den Solar-Look schreibt. Elevation bleibt beim reinen Azimut-Drehen erhalten.
- **Tageszyklus (v2.0.130):** kontinuierlich unter Szene → Animation; Dauer über `#anim-day-cycle-minutes` (`dayCycleRealMinutes`, Default 60). Einmaliger Tagesverlauf-Abspielen entfernt.
- **Sonnenlicht** Default **3,9** (Slider `#sun-intensity` 0,3…**8**). Zusätzlich **Umgebungslicht** (`#sun-ambient`, Default **0,53**), **Schatten-Kontrast** (`#sun-shadow-contrast`, Default **1,40**, Bereich **0,5…5**, v2.0.207), **Schatten-Weichheit** (`#sun-softness`, Default **5,0**), **Farbtemperatur** (`#sun-color-temp`, Default **4500 K**), Tageszeit **13:15**, Sonnenwinkel **210°** und Schatten-Dunkelheit (`#sun-shadow-density`, Default 0,55). **v0.7.253:** Diese Slider steuern auch Umbra-Tönung, Kontaktschatten und Bodenreflex — siehe [lighting-mood.md](lighting-mood.md). **v2.0.207:** Contrast dimmt auch Hemi (`facadeShade`) und Boden-Umbra — Neutral bleibt bei Max nicht mehr blass.
- **Sonnen-Slider (v0.7.341 / v2.0.148 / v2.0.182 / v2.0.201 / v2.0.202):** Azimut/Tageszeit/Intensität: Licht und Himmel **sofort** (max. 1×/Frame). **Scrub (v2.0.202):** Frustum fitten + Sonnen-Shadow **jedes Lighting-Frame** (Debounce ließ Schatten springen); Map-Größe und EnvMap erst beim Loslassen; keine Schedule-Actors während `input`. Tagzyklus weiter Debounce ~120–280 ms. **Nicht zurück zu v2.0.182** (kein Bake) oder reinem Debounce-Scrub (v2.0.201). Live kein EnvMap-Bake und keine Punktlicht-Cubes. Geometrie-Commit weiter `flushSunShadowMap({ sceneLights: true })`. **Weichheit (v2.0.1):** `#sun-softness` → PCSS-Lichtgröße 0,8…28 cm als Uniform `pcssLightSizeUv` (live). **Farbtemperatur (v2.0.1):** `#sun-color-temp` färbt das Key-Light.
- **Fenster in 2D (v0.7.344):** Rahmen/Konsolen empfangen Werfschatten wenn Paneele empfangen (`syncOpeningReceiveShadows`, ohne Glas). **v2.0.9:** Teil-Rebuild muss `syncLabelShadowReceivers` rufen — sonst bleiben neue Rahmen ohne Empfang. **v2.0.12:** Erstes Shadow-Map-Bake nach `loadMeshes` (`bootstrapSceneLighting`) — ohne Reload-Workaround über Sonnenwinkel-Slider.

## Ein-Pass / Grundriss-Silhouette

```
planFacesWithHoles(plan)
  → Outer + holes (Hof = kleinerer Ring im größeren)
  → Decken-Extrude sichtbar (INDOOR_SLAB_THICKNESS) an Innenkante Layer 1 (v2.0.129)
  → unsichtbarer sunCeilingOccluder an Innenkante Layer 0 (v2.0.100 — Sonne lichtdicht, keine Fassadenstreifen)
  → Punktlicht-Okkluder Außenring Layer 3 (Backup / weiche Cube-Schatten)
  + Studio-Wände mit Öffnungslöchern castShadow
  + Dach (Outer+Holes an Firstkappe) castShadow
  → eine DirectionalLight-Shadow-Map
```

| Rolle | castShadow | receiveShadow |
|---|---|---|
| `ceiling` (sichtbar) | ja (Layer 1, Punktlicht) | ja |
| `sunCeilingOccluder` (unsichtbar) | ja (Layer 0, Sonne; Innenkante, v2.0.100) | nein |
| `floor` (sichtbar) | ja (Layer 1) | ja |
| Wandkörper (Studio) | ja | ja (**v0.7.237** / **v0.7.285**; immer, nicht nur bei Schrift) |
| Öffnungs-Tunnel (unsichtbar) | ja | nein (nur Shadow-Map; bis Fassadenfront inkl. Paneeltiefe, v0.7.192) |
| Punktlicht-Raum-Okkluder (Außenring, Layer 3) | ja (nur Punktlicht-Cube-Map, `customDistanceMaterial`; **v2.0.107:** 100 cm + Stoß 160 cm) | nein — unsichtbar für Kamera und Sonne |

**Punktlicht-Cube-Map (v2.0.111 / v2.0.118):** 3D **2048**, 2D-Front **4096**. Soft-Disk-Taps entfernt (zeichneten die Far-Grenze als Würfel auf den Boden); Hard-Cube. Shadow-`far` folgt Lichtreichweite bzw. Site (unbegrenzt → 500 m), nicht mehr auf 48 m gekappt.
| Paneele / Mörtel | ja | **2D-Front: ja** (v0.7.285 Werfschatten); **3D/Oben: nein** (v0.7.183 / v0.7.140 — Empfang = Schraffur) |
| Laibung | ja | **ja** in Farbe/3D wie Paneele (`claddingReceiveShadows`); zusätzlich bei Punktlicht-Okklusion; Nische/Konche immer (v2.0.116; früher dauerhaft aus wegen Moiré) |
| Dach | ja | ja |
| Sockel (Platte und Profil) | ja | **ja** in Farbe/3D wie Paneele; zusätzlich bei Punktlicht-Okklusion (v2.0.116; früher nur Punktlicht / davor dauerhaft aus) |
| Türfüllung / Fensterrahmen (Gründerzeit + GLTF) | ja | **2D-Front: ja** (v0.7.344, wie Paneele/Gesims-Wurf); **3D/Oben: nein** (v0.7.191 — Schraffur) |
| Eingangstreppe | ja | **ja** (v2.0.24 — Stufen-Geometrie; `shadowSide: FrontSide` gegen Acne bei `DoubleSide`) |
| Punktlicht innen/außen (Render) | ja | ja (v2.0.25 — Nacht; Cube-Shadow-Map, siehe [lighting-mood.md](lighting-mood.md)) |
| Flache Fassaden-Schrift | nein | ja (v0.7.252, Z-Bias) |
| Extrudierte Fassaden-Schrift | ja | ja (v0.7.252, Z-Bias) |
| Gesims / Zierband | ja (**v0.7.288** immer, auch bei Schrift) | ja |
| Glas | nein | nein |

**Glatt ohne Moiré (v0.7.111):** Paneele/Mörtel empfangen in **3D/Oben** keine Shadow-Map. Der Wandkörper empfängt seit **v0.7.237** / **v0.7.285** wieder Schatten (Innenflächen, auch ohne Schrift). **v0.7.285:** In der **2D-Front** empfangen Paneele/Mörtel Werfschatten (Gesims, Stein-Vorstand) — nötig für Nord-Aufriss, wo Lambert (N·L) bei typischem Tages-Azimut kaum schwankt; West wechselt Front-/Gegenlicht klar. **v0.7.301:** Empfang nur im **farbigen** Aufriss und **nicht bei Streiflicht** (`facadeSunIsGrazing`: Ost/West bei Südsonne) — sonst Shadow-Acne entlang jeder Steinkante („kaputtes“ Mauerwerk). **v2.0.27:** Streiflicht-Schwelle **14°** statt 28° — Nord/Süd behalten Fenster- und Sohlbank-Schatten morgens/abends; Ost/West bei Südsonne weiter aus. In der **Zeichnung** immer aus. **v2.0.90:** Empfang auch in **3D** (Farbe); Flat-Paneele in Arbeit **werfen** wieder Schatten; nach High-LOD-Fenster-Rebuild erneut `syncOpeningReceiveShadows` (Meshes starten mit `receiveShadow=false`). **v2.0.116:** Laibung und Sockel empfangen ebenfalls Sonnen-Schatten wenn `claddingReceiveShadows` (sonst wirkten sie bei Wand-Okklusion hell); Punktlicht-Okklusion bleibt zusätzlich. **v0.7.249:** Gegenlicht-Shader (`facadeShade.ts`) gilt einheitlich für Wände, Paneele, Mörtel und Schrift; Abdunklungsstärke folgt den Sonnen-Slidern (`facadeShadeParamsFromSun`). **v0.7.252 / v0.7.254:** Schrift hat eigene, stärkere Dim-Faktoren und dimmt die **ganze Glyphe** (nicht nur Seiten); Wand-Bounce/Hemi-Fill gilt nicht für Labels. Plus Shadow-Map-Empfang ohne Wand-Selbstschatten auf den Buchstaben. Hemisphere-Himmel/Untergrund folgen den Szenenfarben.

`dirLightIndoor` bleibt `visible = false` (Zwei-Pass verworfen).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/studio/floorPlan.ts` | `planFacesWithHoles`, `pointInPolygonXZ`, `polygonAreaXZ` |
| `src/FacadeController.ts` | Indoor-Platten mit Holes, Decken casten |
| `src/studio/roof.ts` | `topRoofFaceWorld`, Firstkappe mit Löchern |
| `src/lighting/pcssShadows.ts` | PCSS-ShaderChunk (Blocker-Suche + variable Penumbra, `const`-Poisson-Disk + `mat2`-Rotation, entrollte Taps), Lichtgröße aus Weichheit; **kein** Orbit-1-Tap mehr (v2.0.197) |
| `src/utils/sunLighting.ts` | Weichheit aus Elevation, Shadow-Camera, Kelvin |
| `src/utils/lightingMood.ts` | Schichten-Intensitäten aus Sonne + Szenenfarben |
| `src/lighting/groundMood.ts` | Boden-Fill (`ground-mood-v6`, Albedo × Sonnen-Ambient; Schatten nur Standard-PCSS) |
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
| Softness-Default | 2,5 | ruhiger Kontakt; Slider bis 8 weitet die Penumbra |
| `PCSS_PENUMBRA_SCALE` | 8 | Ortho-Ausgleich statt Perspektiv-`NEAR/z` (sonst Slider tot) |
| `PCSS_NEAR_PLANE` | 0,002 | Blocker-Suchradius (Shadow-Tiefenraum) |
| `MIN_SUN_DISTANCE` | 900 cm | Untergrenze Licht→Ziel |
| `SHADOW_MAP_SIZE` | 4096 | Shadow-Map (große Sites) |
| `SHADOW_MAP_SIZE_HIGH` | 8192 | Shadow-Map wenn Site-Spanne ≤ 4800 cm (v2.0.114; früher 2200) |
| `PCSS_NUM_SAMPLES` | 32 | PCSS-Filter-/Blocker-Taps (v0.7.346; vorher 17) |
| `PCSS_LITE_SLOW_FRAME_MS` / `PCSS_LITE_SLOW_FRAMES` | — | Bis v2.0.150: adaptives 1-Tap beim Orbit. **v2.0.151:** ungenutzt; Orbit behält volles PCSS |
| `INDOOR_SLAB_THICKNESS` | 8 cm | Extrusionsdicke Etagen-Trennfläche |
| `INDOOR_SLAB_VISUAL_INSET_CM` | 1 cm | Sichtbare Platte hinter Innenwand (kein Z-Fight, v2.0.129) |
| `SHADOW_BIAS` | −0.0002 | Tiefen-Bias |
| `SHADOW_NORMAL_BIAS_MIN/MAX` | 0,05 / 0,22 cm | `normalBias` aus Texelgröße (niedrig gegen Lichtspalten an Laibung, v2.0.117) |
| `SHADOW_FRUSTUM_PAD` | 120 cm | Rand um den Shadow-Kasten |
| `SHADOW_FRUSTUM_DEPTH_PAD` | 80 cm | Extra near/far |
| `SHADOW_GROUND_Y` | −0,5 cm | Bodenebene der Projektion |
| `SHADOW_GROUND_MAX_LENGTH` | 3200 cm | Cap der Boden-Schattenlänge (Texel) |

**Boden-Schatten:** Außenboden bei `y = −0,5` cm, neue `PlaneGeometry`, `polygonOffset`. Defaults: Hintergrund, Untergrund und Klar-Glas-Himmel `#555555` (Szene-Farben; einzeln oder über „Alle drei“).

Glas: dunkles Klarglas, CubeCamera-EnvMap der Szene von außerhalb. `transmission` Default 0 (Durchsicht), `castShadow: false`.

## Bekannte Fallstricke

- **Sonnen-Slider: Schatten kleben / springen (v2.0.182 → v2.0.201 → v2.0.202):** Scrub ohne Bake → Schatten bis Loslassen stehen; Debounce-Bake → sichtbare Sprünge. Scrub: sofort 1×/Lighting-Frame; Tagzyklus darf Debounce behalten.
- **Jeder Ring als volle Platte:** Hof + Rechteck → AABB-Kasten. Deshalb Nesting in `planFacesWithHoles`.
- **Doppelte Platten an Geschossgrenzen:** früher separate Boden- und Decken-Meshes — jetzt nur noch eine Trennfläche pro Etage.
- **Zwei-Pass / Scratch-RT:** Viewport 1×1 oder leer — nicht wieder einführen ohne sauberes Viewport-Restore.
- **Glas wirft Schatten:** füllt die Öffnung; Glas bleibt ohne Cast — Sonne nur durch Loch + Glas, nicht durch Rahmen.
- **Etagenstreifen auf Fassade (v2.0.18 / v2.0.100):** Decken auf Layer 0 warfen horizontale Streifen. Sichtbare Platten bleiben Layer 1; Sonne blockiert ein unsichtbarer Okkluder an der Innenkante (Layer 0).
- **Einheiten cm:** Bias-Werte aus Meter-Tutorials sind hier falsch skaliert.
- **Sehr flache Sonne:** Schattenlänge über 3200 cm wird im Frustum gekappt (sonst zu grobe Texel). Der Boden in der 3D-Ansicht ist um dieselbe Reichweite vergrößert.
- **Entwurf / Vorschau:** PCSS aus, harte `BasicShadowMap` (kein Contact-Hardening) — absichtlich.
- **Weichheit-Slider tot (v2.0.1 / v2.0.97):** `#define PCSS_LIGHT_SIZE_UV` cached nicht; Filter `× NEAR/z` mit Near 0,002 auf Ortho-NDC ist unsichtbar. Fix: Uniform + `PCSS_PENUMBRA_SCALE` 8 (**v2.0.98**). Softness-Default 2,5. Slider nur in **Render**.
- **Weichheit-Slider träge (v0.7.335):** Pro Tick Shader-Neubau — jetzt Uniform `pcssLightSizeUv`, sofortiger Frame-Render. PCSS-Filter in Lit-Bereichen erzeugte zweiten Weichschatten. Jetzt ein Pfad: hart am Kontakt, Weichheit nur via min(hard, soft) in der Penumbra.
- **Render + schwebender Schatten (v0.7.333):** Umbra am Kontakt hart; NormalBias 0; Cast-Shadow ohne polygonOffset (`customDepthMaterial`).
- **Render + schwebender Schatten (v0.7.332):** Mindest-Filter und hoher NormalBias wirkten am Kontakt wie Peter-Panning. Contact-Hardening + PCSS-NormalBias ≤ 0,12 cm.
- **Render + „gepunktet“ / pixelig (v0.7.346):** Zu wenige PCSS-Samples (17) ließen das Poisson-Muster sichtbar werden. Jetzt **32 Samples**; kleine Sites zusätzlich **8192** Shadow-Map. Weichheit-Slider unverändert (0,8…28 cm).
- **Wand anfügen → Schatten zerstört (v2.0.114):** `mapSize` wurde nach `fitDirectionalShadowCamera` gesetzt und bei Wechsel 8192↔4096 ohne Dispose — RT und Texel-Snap passten nicht. Reihenfolge: `ensureDirectionalShadowMapSize` → Fit → Bake. Live-Preview ruft `applySunLighting({ live: true })`. 8192 bis Spanne 4800 cm.
- **Render + fransig / langsam (Scale 24 / Softness 5):** zu großer Filterradius. Default Softness 2,5 + Scale 8.
- **Render + gemischt weich / kantiger Außenrand (v2.0.99):** Blocker-Suche war kleiner als der PCSS-Filter → weiche Umbra, harte Texel-Silhouette. Suche nutzt jetzt dieselbe `PCSS_PENUMBRA_SCALE`. Boden sampled `getShadow` nicht mehr ein zweites Mal (ein Pfad).
- **Render + stotternde Navigation (v2.0.98):** Bei Punktlicht setzte `renderLitSceneFrame` jedes Frame `shadowMap.needsUpdate` — teurer Full-Bake. Nur noch bei Geometrie/Licht über `scheduleSunShadowMapUpdate`.
- **Undo nach Licht-Löschen → Paneele dunkelgrau (v2.0.122):** Reine `sceneLights`-Diffs backten die Map nicht (kein Geometrie-Rebuild → kein `applySunLighting({ updateShadowMap: true })`). Frische PointLights mit `castShadow` ohne Cube-Map verdunkelten `receiveShadow`-Flächen. Jetzt Licht-Diff → sofort `flushSunShadowMap`.
- **Nische lässt Licht durch (v2.0.123):** Sichtbare Rückwand nur `nicheDepth` tief; Shadow-Tunnel hatte keine Kappe — Cube-Map leckte durchs Wandloch. Fix: Kappen an Rückwand + Innenkante; `sealedNiche` → `shadowSide: DoubleSide`.
- **Nische schwarz (v2.0.127):** Laibung/`sealedNiche` bekam Fassaden-Gegenlicht-Shader und `FrontSide` — Seiten/Rückwand wirkten schwarz. Fix: `side`+`shadowSide` DoubleSide, `skipFacadeShade`, Rückwand-Winding zur Öffnung.
- **Tiefe Nische ohne Schatten (v2.0.133):** Bei `nicheDepth` > Wanddicke saß die Innenkanten-Kappe mitten in der Nische und schnitt Licht/Schatten ab. Tunnel-Seiten gehen dann bis hinter die Rückwand; Mittelkappe entfällt; Nischen empfangen wieder Shadow-Maps (Kappe 2 cm hinter Rückwand).
- **Render + „sieht hart aus“ (v0.7.328):** Zu kleine Lichtfläche/UV und falsche Near-Skala ließen PCSS wie Basic wirken. Scale 8 + Softness-Slider in **Render** (Boden/lange Schatten).
- **Custom-Shader:** `facadeShade` und Standard-Materialien nutzen PCSS über `getShadow`. Boden (`groundMood`) nur Fill-Override — **kein** zweites Schatten-Sampling (v0.7.330 / v2.0.99).
- Wandkörper empfängt wieder Schatten (**v0.7.237** / **v0.7.285**, auch ohne Schrift). **v2.0.90:** Paneele empfangen auch in **3D** (Farbe); Zeichnung und Streiflicht-Ost/West weiter aus. **2D-Front (v0.7.285):** Paneele empfangen Werfschatten (`setCladdingReceiveShadows`).
- **Nord-Aufriss dunkel/statisch:** Physik — N·L der Nordfront bleibt bei Azimut O→S→W ≤ 0; West wechselt Gegenlicht↔Frontlicht. Ohne Paneel-`receiveShadow` fehlen zusätzlich wandernde Gesims-/Vorstandschatten. `facadeOutward(0)` und Front-Kamera sind korrekt (−Z).
- **Teil-Rebuild ohne Empfang (v2.0.9 / v2.0.90 / v2.0.91):** `setState({ rebuildBuildingIds })` und `finalizeGeometryRebuild` / `ensureBuildingHighDetail` müssen `syncLabelShadowReceivers` **nach** High-Fenstern aufrufen. Gründerzeit-Meshes starten mit `receiveShadow=false`; ohne Sync fehlen Gesims-Schatten auf allen neu gebauten Fenstern. **v2.0.91:** Mörtel (`lodTier: mortar`) ebenso — Empfang beim Erzeugen setzen; High-LOD ersetzt den Wand-Mörtel; Opening-Drag sync’t erneut.
- **Öffnungs-Tunnel (v0.7.138 / v0.7.140 / v0.7.192):** Wandloch ohne Tiefenflächen → Sonne durch die Wandstärke. Tunnel-Quads bleiben für die Shadow-Map, aber als **unsichtbare** Meshes (`colorWrite: false`). **v0.7.192:** Tunnel reicht bis zur Fassadenaußenfläche (Paneel-Vorstand), nicht nur bis zur Wandkörper-Kante — sonst helle Lichtlecks am Sturz über Türen/Fenstern. Kontur +1 cm gegen Bias.
- **Sichtbare Leibung muss bis Innenwand (v0.7.193):** Der Tunnel schließt nur Schatten; der weiße Streifen am Sturz war oft der Himmel durch die offene Wandstärke. `studioOpeningRevealInnerZ` = `studioWallInnerLocalZ` (nicht `wall.depth` bei ungedrehtem Paneel).
- **Front-Lip + Sturz:** ab v0.7.239 entfernt — Leibung ist nur der Tunnel (keine Extra-Kanten in der Zeichnung). Glas ohne `castShadow`.
- **Paneele empfangen nicht in 3D (v0.7.140):** `receiveShadow` auf Paneelen/Mörtel/Laibung erzeugt Zoom-Schraffur; `castShadow` bleibt an für Bodenschatten. **v0.7.285:** Empfang nur in 2D-Front. **v0.7.301:** nur Farbe + nicht streifend (`syncCladdingReceiveShadows` / `facadeSunIsGrazing`); Zeichnung und Ost/West bei Südsonne aus. **v2.0.90:** Empfang wieder in 3D (Farbe); Zeichnung/Streiflicht unverändert aus.
- **Gegenlicht Seiten/Oberseiten (v0.7.202 / v0.7.203 / v0.7.256):** Wenn die Sonne hinter der Fassade steht, bleibt die Front über Lambert dunkel; Seiten und Oberseiten bekamen weiter Direct+Hemisphere. `applyFacadeShadeShader` dämpft Direct/Hemi auf Nicht-Frontflächen (`|n.z|` klein), die Front bleibt ohne Shadow-Map (keine Schraffur). **v0.7.203:** `normalMatrix` nur im Vertex — sonst kompiliert das Fragment nicht und die Wände verschwinden. **v0.7.256:** Patch wieder nach `lights_fragment_begin` (`facade-backlit-v9`) — v7/v8 nach `lights_fragment_end` mit Bounce/Innenblock ließen Wände in Farbe verschwinden. Schrift-Dim über Label-Uniforms bleibt. Datei: `src/utils/facadeShade.ts`.
- **Schrift zu hell im Schatten (v0.7.252 / v0.7.254):** Der Wand-Shader dimmt die Front nicht (Lambert reicht). Glyphen sind Frontflächen + starkes Hemi; flache Schrift war `DoubleSide`/`transparent` (Rückseite voll Sonne); `receiveShadow` war aus, weil die Wand 1–2 cm hinter den Buchstaben die Shadow-Map fraß. Lösung: Label-Shade dimmt die ganze Glyphe stärker; `FrontSide` bei Flachschrift; Empfang mit `LABEL_SHADOW_COORD_Z_BIAS`. **v0.7.254:** Wand-Bounce/Hemi-Fill (0,82) nicht auf Schrift.
- **Türfüllung / Treppe (v0.7.191):** gleiches Muster — Empfang aus, Cast an; sonst Schraffur auf großen ebenen Flächen.
- **normalBias zu groß:** erzeugt helle Spalten an Laibung/Sockel (Peter-Panning); Max 0,22 cm (v2.0.117).
- **Helle Rest-Steine an Öffnungen (v2.0.119):** Umriss-Reste (Bogen, Freiraum, Laibung, Keilstein, Bossen-First) wurden per Earcut immer CCW (+z, in die Wand) trianguliert, Feldsteine per `addQuad` −z. Mit `shadowSide: FrontSide` fielen diese Steine aus der Shadow-Map: kein Schattenwurf (Lichtkanten an der Laibung) und kein Selbstschatten — sie wirkten glatt und heller als das Feld, das das PCSS-/Hard-Shadow-Korn trägt. Fix: `triangulateOutlineRing(…, { front: true })` dreht Front-Dreiecke, Ringe werden vor Seitenquads CCW normiert (`panelGeometry.ts`, siehe [panel-geometry.md](panel-geometry.md)). Diagnose über Normalen-Karte je Sample (nz-Vorzeichen) — nicht Farbe/Material.
- **Navigieren ruckelt im Render (v2.0.120):** ~4 Bilder/s beim Drehen/Schwenken (M1 Max) — der PCSS-Shader füllte pro Fragment ein globales `vec2[32]` (32 × sin/cos/pow) und indizierte es in nicht entrollten Schleifen dynamisch; auf Metal kostete das ~200 ms/Frame (1-Tap-Referenz 14 ms), unabhängig von der Map-Größe. Jetzt `const vec2 pcssDisk[32]` (Formel des Three.js-Beispiels, in JS berechnet), Zufallsrotation als `mat2`, Literal-Schleifen (`#pragma unroll_loop_start` entrollt nur Literale, keine `#define`s), `step()` statt `if`. Bild unverändert, volles PCSS im Orbit bei Vsync. Adaptives `pcssLite` (1 Tap) wurde in v2.0.151 entfernt, in v2.0.170 wieder eingebaut und in **v2.0.197 endgültig aus dem Shader entfernt** — Drehen/Zoomen behält denselben weichen Schatten; Details in [performance.md](performance.md). **Shader-Test-Fallstrick:** `disablePcssShadows()` + `needsUpdate` kompiliert **nicht** neu — der Programm-Cache-Key enthält den Chunk-Text nicht; zum Vergleich `customProgramCacheKey` ändern.
- **Feld-Korn (offen):** Der planare Selbstschatten-Anteil (Blocker-Suche über Lichtgröße × `PCSS_PENUMBRA_SCALE` trifft die eigene, schräg beleuchtete Fläche) dunkelt große Frontflächen leicht und körnig ab; `normalBias`/`bias` (0,4-cm-Texel, ~0,7 cm Tiefen-Bias) reichen dafür nicht. Kandidat: Receiver-Plane-Depth-Bias in `pcssFindBlocker`/`pcssFilter`.
- **Freiraum-Lichtkante (v2.0.117):** Freiraum-Kappe ohne `receiveShadow` blieb im Schatten hell; Sync filterte sie über `openingPart` aus. Jetzt `clearanceCap`-Flag + Empfang wie Paneele. Laibung nur Mini-Inset (0,12 cm) an der Freiraum-Front.
