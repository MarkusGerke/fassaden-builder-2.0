# Bühnen-Umgebung (Himmel / Neutral)

Zwei Bühnenmodi für die 3D-/Oben-Ansicht. Der Landschaftsmodus bleibt unverändert.

## Nutzer

| Modus | UI | Verhalten |
|---|---|---|
| **Himmel** | Viewport-Chrome + Szene → Umgebung | Flache Bodenplatte, Takram-Himmel, Sonne/Horizont, manuelle Szenenfarben |
| **Neutral** | dieselbe Umschaltung | Flacher Boden (**immer größer als das Haus**) in einer **Kugel**; von außen durch die Kugel hindurchschauen; beige tagsüber, nachts nahezu schwarz; Werfschatten auf dem Boden |

- Umschalten: `#stage-env-sky-btn` / `#stage-env-studio-btn` (Chrome) und Side-Buttons unter Szene.
- Persistenz: `localStorage` `fassaden-builder-stage-environment` (`sky` \| `studio`).
- Im Neutralmodus sind die manuellen Szenenfarben ausgeblendet — Farbe folgt der Tageszeit.
- Haus-**Fußboden** bleibt sichtbar, auch wenn die **Decke** ausgeblendet wird (Ebenen → Decke).

## Technik

| Datei | Rolle |
|---|---|
| `src/lighting/studioStage.ts` | Modus, Beige↔Nacht, Boden-/Kugelgröße |
| `src/main.ts` | `studioSphere` (BackSide), flacher `ground` bleibt Empfänger, `syncStageMeshVisibility` |
| `src/FacadeController.ts` | Fußboden unabhängig von `showCeiling` |

### Geometrie

- **Flacher Boden:** bestehende `studioGround`-Plane, Größe `studioFlatFloorSize(landscape, buildingSpan)` ≥ Haus + `STUDIO_FLOOR_MARGIN_CM` (480 cm je Seite). `receiveShadow` an → Werfschatten.
- **Kugel:** `SphereGeometry`, Material `side: BackSide` — von außen gecullt (hindurchschauen), von innen beige Kuppel. Zentrum auf Bodenebene; untere Hälfte unter dem Boden.

### Datenfluss

```
stageEnvironment
  → Himmel: ground + AtmosphereSky
  → Neutral: ground (beige/nacht) + studioSphere, Sky aus
       → studioEnvironmentHex(twilight) → Farbe
       → applySunLighting: Softness/Ambient/Key; Shadow-Map auf Boden
```

## Defaults / Konstanten

| Konstante | Wert |
|---|---|
| `STUDIO_DAY_BEIGE` | `#E8E3DD` |
| `STUDIO_NIGHT_NEAR_BLACK` | `#0C0B0A` |
| `STUDIO_FLOOR_MARGIN_CM` | 480 |
| `STUDIO_SPHERE_RADIUS_FACTOR` | 0,72 |
| `STUDIO_MIN_SHADOW_SOFTNESS` | 5,5 |
| `STUDIO_AMBIENT_BOOST` | 1,12 |
| `STUDIO_KEY_INTENSITY_SCALE` | 0,85 |

## Bekannte Grenzen

- Kugel-Innenfläche empfängt Schatten schwächer als der flache Boden (BackSide); maßgeblich ist der Boden.
- Sehr große Sites → große Kugel (Segmentzahl fest).
