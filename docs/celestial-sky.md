# Himmel, Sonne und Mond

Physikalischer Himmel in **3D** und **Oben** (Bruneton Precomputed Atmospheric Scattering) plus tageszeitabhängige Beleuchtung.

## Nutzer

- **Datum** startet immer mit dem **heutigen Tag** (Berlin-Sonnenstand). Manuell änderbar.
- **Tageszeit** (`#sun-time`): fest **0:00–24:00** — goldene Stunde, blaue Stunde, Nacht.
- **Sonnenwinkel (Himmelsrichtung)** (`#sun-azimuth`): horizontal am Himmelskreis (0°=N, 90°=O). **Sonnenwinkel (Höhe)** (`#sun-elevation`): vertikal über dem Horizont (−12°…70°). Beide manuell; **Datum/Tageszeit** setzt Azimut, Elevation, Intensität, Weichheit und Farbtemperatur aus Berlin wieder. **v2.0.358:** Höhen-Slider zieht Intensität/Weichheit/Farbtemperatur wie Tageszeit mit — sonst nach Abend/Tageszyklus hohe Höhe bei Sonnenlicht ≈ 0. Manuell schaltet den Tageszyklus aus.
- **Dämmerung:** weicher Übergang Tag↔Nacht durch Streuungsmodell (kein harter Sonne/Mond-Pop).
- Bei Nacht: Sterne (Yale BSC5), Mond mit Phase aus Datum.
- **Szenenfarben**
  - **Bodenfarbe** (`#scene-ground-color`) färbt die Bodenplatte (Albedo). Licht folgt der Sonne wie beim Mauerwerk.
  - **Himmel/Hintergrund** steuern Glas-Reflexion bzw. `scene.background` (Fallback).
- **Umgebung Neutral (v2.0.164 / v2.0.209):** Himmel aus; Schalen-Plattform; Farben über Szene-Picker (Default Beige) — siehe [stage-environment.md](stage-environment.md).

## Technik

| Datei | Rolle |
|---|---|
| `src/lighting/atmosphereSky.ts` | `AtmosphereSky`: Takram `SkyMaterial`, Sterne, `SunDirectionalLight`, `SkyLightProbe` — Key-Richtung = `resolveCelestialState` (v2.0.342), nicht physische Sonne unter 0° |
| `src/utils/celestialSky.ts` | `resolveCelestialState`, Mondposition, Schatten-Frustum-Hilfen (ohne Shader-Dom) |
| `src/utils/solar.ts` | Sonnenstand UI, `SOLAR_REF_YEAR`, Berlin |
| `src/utils/sunLighting.ts` | Schatten-Frustum, Kelvin, 24‑h-Sync |
| `src/main.ts` | `atmosphereSky`, `applySunLighting`, `syncAtmosphereSky`, async `load(renderer)` |

### Bibliothek

- **[@takram/three-atmosphere](https://www.npmjs.com/package/@takram/three-atmosphere)** (MIT) — Light-source lighting mit bestehenden `MeshStandardMaterial`-Flächen.
- Precomputed Textures + `stars.bin` werden beim Start von der Takram-CDN geladen (`DEFAULT_PRECOMPUTED_TEXTURES_URL`).
- Peer: `postprocessing` (für künftigen Aerial-Perspective-Pass; aktuell nicht aktiv).

### Lichtquellen

1. **Sonne:** `SunDirectionalLight` (`dirLight`) — **Farbe aus dem Kelvin-Slider** (`#sun-color-temp` / `SunSettings.colorTemperature`); Intensität × Nutzer-Slider. Der Himmel bleibt physikalisch (Takram-Transmittance), das Key-Light nicht.
2. **Mond (v2.0.184 / v2.0.340 / v2.0.343):** Wenn die Sonne unter dem Horizont ist und der Mond scheint (`moonIllumination > 0,08`): Key aus Mondrichtung, **~8200 K**; `moonMix` nur in der Dämmerungszone (Sonnenhöhe etwa −4°…+2°). **v2.0.343:** `exteriorKeyDimAfterSunset` dämpft Key/IBL nach Untergang (Sonnenhöhe −1,5°…−11°) — Fassade nicht bis ~20:40 hell nur wegen Mond-Key. **v2.0.340:** `twilightFactor` über `1 - smoothstep(−12°, +6°)`; `skyAmbientFactor` ein Kurvenzug über `twilightFactor`. **leichte Schatten** ab Mondhöhe ≈ 3,5° und Illumination ≈ 0,12.
3. **Sternennacht (v2.0.184 / v2.0.185):** Kein Mond / zu schwach → Key-Intensität **0**, Ambient ≈ 0,01. **v2.0.185:** Paneel-/Glas-EnvMap wird mitgedämpft (`exteriorEnvFillFromCelestial` ≈ 0,05) und die CubeCamera-Himmelskugel folgt der Nachtpalette — sonst wirkten Flächen weiter Mittelgrau trotz schwarzer Laibung.
4. **Himmels-Fill:** `SkyLightProbe` + reduziertes `HemisphereLight` (Nutzer-Umgebungslicht; nachts stark gedämpft).
5. **Bodenreflex:** `bounceDirLight` (Tag; Mond nur minimal).
6. **Innen:** `dirLightIndoor` unverändert (Layer Interior).
7. **EnvMap-Bake (v2.0.185):** Während des Cube-Bakes `envMapIntensity` temporär 0 — verhindert, dass graue Paneele sich selbst als IBL einbrennen.

Schatten: weiter ortho Shadow-Map auf `dirLight`; Nacht/Mond über `resolveCelestialState` → `keyCastShadow`.

### Himmel

- Screen-Quad mit `SkyMaterial` (Clip-Space, folgt nicht der Kamera), Sterne als `Points`. **v2.0.172:** `depthTest` aus, `depthWrite` aus, `renderOrder` −1000 (Himmel) / −999 (Sterne) — vor der Geometrie. Früher: `depthTest` an + `renderOrder` 1000; im Bloom-Composer (HalfFloat-Depth) fiel der Far-Plane-Test aus → `scene.background` (#616161) als flächiger „grauer Kasten“ statt Himmel.
- **Sonnenlicht liegt nicht im Himmels-Root** — sonst wandert der Schatten mit der Orbit-Kamera.
- Welt→ECEF: Szene-Ursprung = Berlin; Basis **+X Ost, +Y oben, −Z Nord** (wie `directionFromSolar`).
- Sonnenrichtung aus UI-Azimut/Elevation (Welt), dann in ECEF.
- SkyMaterial ist `toneMapped: false` — Anzeige über Uniform `uSkyDisplayExposure` (**RawShaderMaterial:** muss im GLSL deklariert sein). Mit Bloom **7**, ohne **8**. Sonnenscheibe mit fester AA (`SKY_SUN_FRAGMENT_ANGLE`), HDR-Kappe gegen Bloom-Flackern. Himmel bleibt unsichtbar, bis Textures geladen sind.
- CDN-Textures mit Fallback: `PrecomputedTexturesGenerator` auf der GPU.
- Planetboden im Himmel: erdfarbenes Albedo, nicht die Studio-Bodenfarbe (sonst weiße Scheibe).
- Stil **Zeichnung**: Himmel aus; Licht bleibt an.
- **2D-Aufriss** (Landschaft/Himmel, v2.0.347): Licht/Fassade wie 3D (`applySunLighting`, Ortho-`frontCamera`). **Himmel:** Takram-Dom liegt auf Layer **`ATMOSPHERE_SKY_LAYER` (4)** — Ortho zeigt den Sky-Shader oft nicht; daher **Zwei-Pass**: `frontSkyCamera` (Perspektive, gleiche Pose) malt nur Layer 4, danach Gebäude + `FrontUndergroundCap` unter **Welt-Y = 0**. Bis `atmosphereSky.ready`: nur `scene.background` (flache Stimmungsfarbe, kein Verlauf). Neutral-Studio / Zeichnung: ohne Himmel.

## Bekannte Grenzen

- Erstes Laden der Atmosphären-Textures braucht Netzwerk (~35 MB entpackt, CDN).
- Kein `AerialPerspectiveEffect` (Bloom-Composer bleibt Three.js-eigen).
- Mondphase nicht als Sichel am Himmel (nur Helligkeitsskala).
- Sterne nur in Perspektiv-Kamera sinnvoll (Oben: Ortho).
