# Herbstlaub (Boden)

Flache Herbstblätter auf dem Grundstück, die auf den Mauszeiger als Windzug reagieren.

## Nutzer

1. Viewport-Chrome **Laub** oder unter **Szene → Laub** den Modus aktivieren.
2. Im Modus:
   - **Klick** auf den Boden streut ein Häufchen (~12 Blätter).
   - **Ziehen** streut weiter (Abstand ≥ 36 cm).
   - **Boden streuen**: Zufallsverteilung über den Ground-Bereich (max. Rest bis 800).
   - **Laub entfernen**: alle Blätter löschen.
3. Modus verlassen: Blätter bleiben liegen. **Mausbewegung** über der Bühne (ohne Klick) wirkt als Wind — Blätter rutschen und drehen sich leicht.
4. Licht-Modus und Laub-Modus schließen sich aus.

## Daten

`FacadeState.groundLeaves?: GroundLeaf[]` (siteOffset-Lokal, cm):

| Feld | Bedeutung |
|---|---|
| `id` | UUID |
| `shape` | `0` Ahorn · `1` Oval · `2` Lanze |
| `x` / `z` / `y` | Position; `y` Default `0,8` (über `GROUND_Y = −0,5`) |
| `yawDeg` | Drehung um Y |
| `scale` | 0,4…2,5 |
| `color` | Herbst-Hex (`#C45A1A`, `#D4A017`, `#8B3A1A`, `#A65D2E`) |

Hydrate: `normalizeGroundLeafState` in `hydrate.ts`. Cap: `MAX_GROUND_LEAVES = 800`.

## Runtime

| Datei | Rolle |
|---|---|
| `src/scene/leafShapes.ts` | 3 Extrude-Silhouetten (shared Geometry) |
| `src/scene/groundLeaves.ts` | Normalize, Clump, Scatter, CRUD |
| `src/scene/leafRuntime.ts` | Meshes unter `siteOffset`, Wind-Tick |
| `src/main.ts` | Modus-UI, Platzierung, Cursor→Wind, Persist-Debounce |

Wind: Radius `LEAF_WIND_RADIUS_CM = 100`, Dämpfung, max. Speed; Positionen soft zurück in `state` (ohne History) nach Bewegung.

## UI-IDs

- `#leaf-mode-btn` (Chrome), `#leaf-mode-btn-side` (Szene)
- `#leaf-mode-tools` (nur bei aktivem Modus sichtbar)
- `#leaf-scatter-btn`, `#leaf-clear-btn`

## Fallstricke

- Dirty-Rendering: Wind braucht `markViewportDirty()` / `liveMotion` in `animate()`.
- Platzierung über `pickWorldOnHorizontalPlane` + siteOffset — nicht `pickGroundGridFromClient` (ignoriert Site-Yaw).
- Animationen pausiert (`animationsPaused`): Wind-Tick aus.
