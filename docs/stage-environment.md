# Bühnen-Umgebung (Himmel / Neutral)

Zwei Bühnenmodi für die 3D-/Oben-Ansicht. Der Landschaftsmodus bleibt unverändert.

## Nutzer

| Modus | UI | Verhalten |
|---|---|---|
| **Himmel** | Viewport-Chrome **Himmel \| Neutral** | Flache Bodenplatte, Takram-Himmel, Sonne/Horizont |
| **Neutral** | dieselbe Umschaltung | Flacher Boden (**immer größer als das Haus**) in einer **Kugel**; von außen durch die Kugel hindurchschauen; Werfschatten auf dem Boden; Farben über Szene → **Hintergrund** / **Bodenfarbe** |

- Umschalten: `#stage-env-sky-btn` / `#stage-env-studio-btn` (Chrome). Side-Buttons unter Szene (`#stage-env-*-btn-side`) sind ab **v2.0.209** ausgeblendet (IDs/Wiring bleiben).
- Persistenz: `localStorage` `fassaden-builder-stage-environment` (`sky` \| `studio`).
- **Neutral-Farben (v2.0.209):** `#scene-bg-color` → Kuppel/Hintergrund, `#scene-ground-color` → Boden. Default `#E8E3DD` (Studio-Beige). Nachts Abdunkelung Richtung `#0C0B0A` über `studioTintHex` / Tageszeit. Picker nur im Neutral-Modus sichtbar.
- Haus-**Fußboden** bleibt sichtbar, auch wenn die **Decke** ausgeblendet wird (Ebenen → Decke).

## Technik

| Datei | Rolle |
|---|---|
| `src/lighting/studioStage.ts` | Modus, `studioTintHex` / `studioEnvironmentHex`, Boden-/Kugelgröße |
| `src/main.ts` | `studioSphere` (BackSide), flacher `ground`, `sceneColorsForLighting`, `syncStudioSceneColorVisibility` |
| `src/FacadeController.ts` | Fußboden unabhängig von `showCeiling` |
| `src/utils/persistence.ts` | `DEFAULT_SCENE_APPEARANCE` = Beige; Migration alter `#555555`/Weiß-Defaults |

### Geometrie

- **Flacher Boden:** bestehende `studioGround`-Plane, Größe `studioFlatFloorSize(landscape, buildingSpan)` ≥ Haus + `STUDIO_FLOOR_MARGIN_CM` (480 cm je Seite). `receiveShadow` an → Werfschatten.
- **Kugel:** `SphereGeometry`, Material `side: BackSide` — von außen gecullt (hindurchschauen), von innen getönte Innenfläche. Zentrum auf Bodenebene; untere Hälfte unter dem Boden.

### Datenfluss

```
stageEnvironment
  → Himmel: ground + AtmosphereSky; manuellen Neutral-Farben ausgeblendet
  → Neutral: ground + studioSphere, Sky aus
       → sceneAppearance.background/ground → studioTintHex(twilight) → Farbe
       → applySunLighting: Softness/Ambient/Key; Shadow-Map auf Boden
```

## Defaults / Konstanten

| Konstante | Wert |
|---|---|
| `STUDIO_DAY_BEIGE` / Scene-Default | `#E8E3DD` |
| `STUDIO_NIGHT_NEAR_BLACK` | `#0C0B0A` |
| `STUDIO_FLOOR_MARGIN_CM` | 480 |
| `STUDIO_SPHERE_RADIUS_FACTOR` | 0,72 |
| `STUDIO_MIN_SHADOW_SOFTNESS` | 5,5 |
| `STUDIO_AMBIENT_BOOST` | 1,12 |
| `STUDIO_KEY_INTENSITY_SCALE` | 0,85 |

## Bekannte Grenzen

- Kugel-Innenfläche empfängt Schatten schwächer als der flache Boden (BackSide); maßgeblich ist der Boden.
- Sehr große Sites → große Kugel (Segmentzahl fest).
