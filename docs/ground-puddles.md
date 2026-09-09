# Boden: Steingrau und Pfützen

## Nutzer

- Der **Außenboden** ist dauerhaft **steingrau** (`#7E848C`) — Himmel- und Neutral-Modus.
- Unter **Szene** → **Pfützen (Fassaden-Spiegelung)** (`#ground-puddles-enabled`): elliptische nasse Stellen vor den Fassaden spiegeln die 3D-Szene (Reflector).
- Pfützen nur in **3D**; während **Orbit/Zoom** ausgeblendet (Performance). Persistenz: `PersistedAppState.puddles`.

## Technik

| Datei | Rolle |
|---|---|
| `src/lighting/groundPuddles.ts` | `GROUND_STONE_GRAY`, `GroundPuddleSettings`, `GroundPuddleRuntime` (Three.js `Reflector`) |
| `src/main.ts` | `groundMat` erzwungen Steingrau; `syncGroundPuddles` nach Boden-/Orbit-/Ansicht |
| `src/utils/persistence.ts` | Default-Boden Steingrau; Migration `#E8E3DD`; Feld `puddles` |

### Fallstricke

- Reflector = Extra-Render pro Pfütze — nicht während Orbit aktiv lassen.
- Pfützen-Gruppe in `sceneReflectionHideRoots`, sonst EnvMap-Bake der Spiegel.
- Neutral-„Bodenfarbe“-Picker ändert den sichtbaren Außenboden nicht mehr (immer Steingrau).
