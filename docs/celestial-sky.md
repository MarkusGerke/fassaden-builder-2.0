# Himmel, Sonne und Mond

Physikalischer Himmel in **3D** und **Oben** (Bruneton Precomputed Atmospheric Scattering) plus tageszeitabhängige Beleuchtung.

## Nutzer

- **Datum** startet immer mit dem **heutigen Tag** (Berlin-Sonnenstand). Manuell änderbar.
- **Tageszeit** (`#sun-time`): fest **0:00–24:00** — goldene Stunde, blaue Stunde, Nacht.
- **Sonnenwinkel** (`#sun-azimuth`): manuell; dreht Licht und Sonne am Himmel. Datum/Tageszeit setzt den realistischen Stand wieder.
- **Dämmerung:** weicher Übergang Tag↔Nacht durch Streuungsmodell (kein harter Sonne/Mond-Pop).
- Bei Nacht: Sterne (Yale BSC5), Mond mit Phase aus Datum.
- **Szenenfarben**
  - **Bodenfarbe** (`#scene-ground-color`) färbt die Bodenplatte (Albedo). Licht folgt der Sonne wie beim Mauerwerk.
  - **Himmel/Hintergrund** steuern Glas-Reflexion bzw. `scene.background` (Fallback).

## Technik

| Datei | Rolle |
|---|---|
| `src/lighting/atmosphereSky.ts` | `AtmosphereSky`: Takram `SkyMaterial`, Sterne, `SunDirectionalLight`, `SkyLightProbe` |
| `src/utils/celestialSky.ts` | `resolveCelestialState`, Mondposition, Schatten-Frustum-Hilfen (ohne Shader-Dom) |
| `src/utils/solar.ts` | Sonnenstand UI, `SOLAR_REF_YEAR`, Berlin |
| `src/utils/sunLighting.ts` | Schatten-Frustum, Kelvin, 24‑h-Sync |
| `src/main.ts` | `atmosphereSky`, `applySunLighting`, `syncAtmosphereSky`, async `load(renderer)` |

### Bibliothek

- **[@takram/three-atmosphere](https://www.npmjs.com/package/@takram/three-atmosphere)** (MIT) — Light-source lighting mit bestehenden `MeshStandardMaterial`-Flächen.
- Precomputed Textures + `stars.bin` werden beim Start von der Takram-CDN geladen (`DEFAULT_PRECOMPUTED_TEXTURES_URL`).
- Peer: `postprocessing` (für künftigen Aerial-Perspective-Pass; aktuell nicht aktiv).

### Lichtquellen

1. **Sonne:** `SunDirectionalLight` (`dirLight`) — Farbe/Transmittance aus Atmosphäre, Intensität × Nutzer-Slider.
2. **Himmels-Fill:** `SkyLightProbe` + reduziertes `HemisphereLight` (Nutzer-Umgebungslicht).
3. **Bodenreflex:** `bounceDirLight` unverändert.
4. **Innen:** `dirLightIndoor` unverändert (Layer Interior).

Schatten: weiter ortho Shadow-Map auf `dirLight`; Nacht/Mond über `resolveCelestialState` → `keyCastShadow`.

### Himmel

- Screen-Quad mit `SkyMaterial` (Clip-Space, folgt nicht der Kamera), Sterne als `Points`. `depthTest` an, `depthWrite` aus — sonst übermalt der Himmel das Haus.
- **Sonnenlicht liegt nicht im Himmels-Root** — sonst wandert der Schatten mit der Orbit-Kamera.
- Welt→ECEF: Szene-Ursprung = Berlin; Basis **+X Ost, +Y oben, −Z Nord** (wie `directionFromSolar`).
- Sonnenrichtung aus UI-Azimut/Elevation (Welt), dann in ECEF.
- SkyMaterial ist `toneMapped: false` — Anzeige über Uniform `uSkyDisplayExposure` (**RawShaderMaterial:** muss im GLSL deklariert sein). Mit Bloom **7**, ohne **8**. Sonnenscheibe mit fester AA (`SKY_SUN_FRAGMENT_ANGLE`), HDR-Kappe gegen Bloom-Flackern. Himmel bleibt unsichtbar, bis Textures geladen sind.
- CDN-Textures mit Fallback: `PrecomputedTexturesGenerator` auf der GPU.
- Planetboden im Himmel: erdfarbenes Albedo, nicht die Studio-Bodenfarbe (sonst weiße Scheibe).
- 2D-Front und Stil Zeichnung: Himmel aus (`setVisible(false)`); Licht bleibt an.

## Bekannte Grenzen

- Erstes Laden der Atmosphären-Textures braucht Netzwerk (~35 MB entpackt, CDN).
- Kein `AerialPerspectiveEffect` (Bloom-Composer bleibt Three.js-eigen).
- Mondphase nicht als Sichel am Himmel (nur Helligkeitsskala).
- Sterne nur in Perspektiv-Kamera sinnvoll (Oben: Ortho).
