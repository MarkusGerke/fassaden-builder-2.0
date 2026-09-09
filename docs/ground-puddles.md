# Boden: Steingrau und Pfützen

## Nutzer

- Der **Außenboden** ist dauerhaft **steingrau** (`#7E848C`) — Himmel- und Neutral-Modus.
- Unter **Szene** → **Pfützen (Fassaden-Spiegelung)**: nasse Flecken spiegeln die Fassade.
- Look angelehnt an three.js [`webgpu_materials_retroreflection`](https://threejs.org/examples/#webgpu_materials_retroreflection) (`createFloor`: Reflector + Noise-Pfützen) — hier als **WebGL**-Adaption (ein Reflector-Pass).
- Bei aktivierten Pfützen (`#ground-puddles-options`):
  - **Dichte** 1…8 (`count`) — mehr = mehr Pfützenfläche
  - **Pfützengröße** 0,35…2,5 (`size`) — Größe der Flecken
  - **Zone ums Haus** 0,4…2,5 (`spread`) — Ausdehnung der nassen Fläche
  - **Spiegelung** 0,15…1 (`strength`)
- Defaults: aus, Dichte 5, Größe/Zone 1, Spiegelung 0,75.
- Nur in **3D**; während **Orbit/Zoom** aus. Persistenz: `PersistedAppState.puddles`.

## Technik

| Datei | Rolle |
|---|---|
| `src/lighting/groundPuddles.ts` | `GROUND_STONE_GRAY`, Settings, `GroundPuddleRuntime` + `PuddleReflectorShader` |
| `src/main.ts` | Sync / UI / Persistenz |
| `index.html` | Checkbox + Slider |

### Fallstricke

- Nur **ein** Reflector (nicht N× Discs) — sonst teuer und unsichtbar unter dem Haus.
- Noise in **Welt-XZ** (cm); Schwelle/Scale aus count/size.
- Gruppe in `sceneReflectionHideRoots`.
- WebGPU-TSL (`reflector()`, `hashBlur`) nicht verfügbar — Overlay-Blur entfällt; Pfützen sind scharf.
