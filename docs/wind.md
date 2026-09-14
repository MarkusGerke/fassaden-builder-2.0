# Bühnen-Wind

## Verhalten für den Nutzer

Unter Szene → **Animation**: Slider **Wind** (0…1).

| Intensität | Wirkung |
|---|---|
| **0 (Default, v2.0.475)** | windstill — Stoffe stehen |
| ~0,15 | leichter Zug |
| ~0,45 | windig |
| 1 | stürmisch — stärkere, unruhigere Wellen |

Zufällige Gusts (Noise + pro-Stoff-Phase). Gilt zuerst für Markisenstoffe; weitere Stoffe können denselben Kanal nutzen. Master **Animationen pausieren** stoppt Wind. Läuft auch während Orbit (kein sichtbarer Qualitäts-Sprung).

Getrennt vom Cursor-Wind für Herbstlaub ([ground-leaves.md](ground-leaves.md)).

**Idle (v2.0.474):** Markisen wehen während Orbit und anderer Animationen. Steht die Kamera still, stehen die Stoffe — sonst würde jedes Frame die volle PCSS-Szene gerendert. Nicht Wind wieder als Dauer-`liveMotion` anbinden.

Gespeicherte Projekte behalten ihren Wind-Wert; nur neue Defaults / fehlendes Feld starten bei 0.

## Technik

| | |
|---|---|
| Persistenz | `SunSettings.windIntensity` (mit Sonne/Animation speichern) |
| Runtime | `src/scene/windRuntime.ts` — `registerWindFabric` / `tickWindFabrics` |
| Tick | `animate()` in `main.ts` **nach** Idle-Skip, nur wenn der Frame gerendert wird (`tickStageWindFabrics`). Nicht in `liveMotion` (v2.0.474) |

Registry speichert Ruhe-Vertexpositionen; Tick schreibt orthogonale Offsets (vor allem ±Y). Intensität 0 setzt Positionen zurück.

## Defaults

`DEFAULT_SUN_WIND_INTENSITY = 0` in `src/utils/sunLighting.ts` (v2.0.475; zuvor 0,15).
