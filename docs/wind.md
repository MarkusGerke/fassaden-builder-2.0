# Bühnen-Wind

## Verhalten für den Nutzer

Unter Szene → **Animation**: Slider **Wind** (0…1).

| Intensität | Wirkung |
|---|---|
| 0 | windstill — Stoffe stehen |
| ~0,15 (Default) | leichter Zug |
| ~0,45 | windig |
| 1 | stürmisch — stärkere, unruhigere Wellen |

Zufällige Gusts (Noise + pro-Stoff-Phase). Gilt zuerst für Markisenstoffe; weitere Stoffe können denselben Kanal nutzen. Master **Animationen pausieren** stoppt Wind. Läuft auch während Orbit (kein sichtbarer Qualitäts-Sprung).

Getrennt vom Cursor-Wind für Herbstlaub ([ground-leaves.md](ground-leaves.md)).

## Technik

| | |
|---|---|
| Persistenz | `SunSettings.windIntensity` (mit Sonne/Animation speichern) |
| Runtime | `src/scene/windRuntime.ts` — `registerWindFabric` / `tickWindFabrics` |
| Tick | `animate()` in `main.ts` nach Lights, vor `liveMotion` |

Registry speichert Ruhe-Vertexpositionen; Tick schreibt orthogonale Offsets (vor allem ±Y). Intensität 0 setzt Positionen zurück.

## Defaults

`DEFAULT_SUN_WIND_INTENSITY = 0.15` in `src/utils/sunLighting.ts`.
