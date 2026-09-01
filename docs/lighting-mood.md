# Mehrschichtige Lichtstimmung

Außenbeleuchtung in **3D** und **Oben** als Schichtenmodell — näher an realer Architektur-Fotografie als eine einzelne Shadow-Map.

## Nutzer

- **Bodenschatten:** eine Shadow-Map (PCSS in Render); kein zweiter Umbra-Pass am Boden (v0.7.330).
- **Dämmerung:** goldene/blaue Stunde über physikalischen Himmel (Takram), kein harter Lichtwechsel.
- **Schattenfassade:** kühles Himmelslicht + warmes Bodenreflex-Licht von unten (nicht pechschwarz).
- **Slider:**
  - **Umgebungslicht** → Himmel-Fill (Hemisphere + SkyLightProbe)
  - **Schatten-Kontrast** → Licht/Schatten an Fassade und Himmel
  - **Schatten-Weichheit** → PCSS-Randschärfe (**nur Render**)
  - **Schatten-Dunkelheit** → aus UI entfernt (Legacy in gespeicherten Projekten)

## Schichten

| Schicht | Quelle | Schatten |
|---|---|---|
| Key (Sonne/Mond) | `SunDirectionalLight` (`dirLight`) | Ortho-Map, PCSS (`BasicShadowMap`) |
| Himmel | `SkyLightProbe` + `HemisphereLight` | — |
| Bodenreflex | `bounceDirLight` (2. Directional, Index 1) | nein |
| Boden-Umbra | Shader auf Bodenplatte | Albedo×Ambient-Fill; Schatten wie überall (PCSS) |

```mermaid
flowchart LR
  key[SunDirectionalLight]
  sky[SkyLightProbe_Hemisphere]
  bounce[Bounce]
  groundShader[Boden_Umbra_Shader]
  key --> ground[Boden]
  sky --> ground
  bounce --> facade[Fassade_Rückseite]
  groundShader --> ground
```

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/utils/lightingMood.ts` | `resolveLightingMood` — Intensitäten/Farben aus Sonne + Szenenfarben |
| `src/lighting/groundMood.ts` | Boden-Umbra-Shader (`ground-mood-v5`, Albedo × Sonnen-Ambient) |
| `src/lighting/pcssShadows.ts` | PCSS-ShaderChunk |
| `src/lighting/atmosphereSky.ts` | Takram-Himmel + Key-Light |
| `src/utils/facadeShade.ts` | Bounce auf Schattenseite nicht mitdimmen; mehr Hemisphere |
| `src/main.ts` | `applySunLighting`, `renderLitSceneFrame` |

## Datenfluss

```
sunSettings + Szenenfarben
  → resolveCelestialState (Schatten-Entscheidung)
  → resolveLightingMood
  → atmosphereSky.update (SunDirectionalLight am Gebäudeziel, SkyMaterial, Sterne)
  → hemiLight (Horizont + Nutzer-Boden, volle Mood-Intensität) + bounceDirLight
  → groundMat: Albedo = Bodenfarbe, Irradiance = Sonnen-Ambient (`ground-mood-v5`)
```

## Slider-Mapping

| Slider | Wirkung |
|---|---|
| `#sun-intensity` | Key-Intensität (× Takram-Transmittance) |
| `#sun-ambient` | Hemisphere + SkyLightProbe |
| `#sun-shadow-contrast` | Fassaden-Gegenlicht, Himmel-Fill |
| `#sun-softness` | PCSS-Lichtgröße (nur Render; UI ausgeblendet in Entwurf/Vorschau) |

## Bekannte Grenzen

- Kein Full-GI / kein SSAO (Performance, Bloom, Orbit-Lite).
- Paneele empfangen weiter keine Shadow-Map (Moiré).
- Kein Kontakt-RT mehr unter dem Gebäude (nur Shadow-Map-Umbra).
- **Boden-Shader (v0.7.343):** wieder `ground-mood-v5` — Albedo×Ambient-Fill plus Umbra-Sampling in der Shadow-Map (wie vor den heutigen Schatten-Experimenten).
- **Boden-Shader (v0.7.264):** `ground-mood-v5`, ersetzt Light-Probe/Hemisphere-Irradiance durch `uGroundAlbedo * uGroundAmbient`. EnvMap-Intensität 0.
