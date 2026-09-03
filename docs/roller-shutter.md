# Rollläden

## Verhalten für den Nutzer

Bei **Fenster** und **Tür** (nicht Nische, nicht Kellerfenster) gibt es den Reiter **Rollläden** (`data-settings-section="roller-shutter"`) **immer** in der Tab-Leiste. Die Checkbox **Rollläden anzeigen** ist standardmäßig **aus** — erst dann erscheinen Höhe, Farbe und Animation.

Wenn aktiviert:

- **Höhe (geschlossen):** 0 % = oben offen, 100 % = vollständig geschlossen (`Opening.rollerShutter.drop` 0…1).
- **Lamellen:** leicht gewölbte Querschnitte **in der Leibung** (8 cm hinter der Fassadenaußenfläche, Wölbung nach innen). **v2.0.131:** Breite = volle Öffnungsbreite bis zur Laibung (kein seitlicher Lichtspalt).
- **Absenken:** Vorhang hängt vom Sturz mit freiem Spalt nach unten. Sobald die **unterste** Lamelle die Fensterbank berührt, stapeln sich weitere Lamellen von unten aufeinander, bis der Rollladen vollständig unten ist. **Hochfahren** genau umgekehrt, bis die unterste Lamelle im Sturz verschwunden ist.
- **Lichtdicht:** Sichtbare Lamellen werfen Schatten; unsichtbare Abdeckplatte folgt der abgedeckten Höhe (Spalte zwischen Lamellen).
- **Kein Kasten, keine Führungsschienen:** nur die Lamellen. Standard: Checkbox aus, `drop` 0.
- **Farbe / Oberfläche:** Swatches und Stumpf/Glänzend/Metallisch.
- **Lamellenhöhe / Spalt:** Feinjustierung (cm) — Spalt gilt nur im freihängenden Abschnitt.
- **Animation:** Phasen **Runterfahren** und **Hochfahren** mit Dauer, Vorlagen Weich/Linear, Abspielen und Zyklus.

Klick auf die Lamellen in 3D öffnet den Rollläden-Tab (`openingPart: 'rollerShutter'`).

## Konstanten (`src/studio/rollerShutter.ts`)

| Konstante | Default | Bedeutung |
|---|---|---|
| `ROLLER_SHUTTER_INWARD_CM` | 8 | Versatz der Rollladen-Ebene hinter die Fassadenaußenfläche |
| `ROLLER_GUIDE_EDGE_INSET_CM` | 0 | Seitlicher Einzug (v2.0.131: 0 = volle Laibungsbreite) |
| `ROLLER_STACK_PITCH_FACTOR` | 0.9 | Stapel-Abstand / Lamellenhöhe (Überlappung) |

## Daten

```typescript
Opening.rollerShutter?: {
  enabled: boolean      // Default false
  drop: number          // 0 = offen, 1 = geschlossen
  color?: string
  finish?: SurfaceFinish
  slatHeightCm?: number // Default 5
  gapCm?: number        // Default 0.85 (nur freihängend)
  motion?: {
    raise: MotionCurve  // Hochfahren, v = Fortschritt 0…1
    lower: MotionCurve  // Runterfahren
  }
}
```

Hydrate setzt fehlende Config auf **disabled**. Kein Schema-Step nötig.

## Dateien und Datenfluss

| Datei | Rolle |
|---|---|
| `src/types/facade.ts` | `OpeningRollerShutter`, `OpeningPart: 'rollerShutter'` |
| `src/studio/rollerShutter.ts` | Defaults, Normalize, Lamellen-Layout (Frei + Stapel), Extrude-Geometrie |
| `src/utils/openings.ts` | `updateOpeningRollerShutter` |
| `src/utils/hydrate.ts` | Defaults für Fenster/Tür |
| `src/FacadeController.ts` | `rebuildRollerShutters`, `applyRollerShutterDrop`, Schatten-Okkluder |
| `index.html` / `src/main.ts` | Tab, Sync, Playback |

## Fallstricke

- Animation der Flügel (`Opening.motion`) und der Rollläden sind getrennt; gleichzeitiges Abspielen wird vermieden (Rollladen-Play stoppt Flügel-Play).
- Live-Ziehen am Höhen-Slider nutzt `applyRollerShutterDrop` (kein Mesh-Rebuild); Commit speichert `drop`.
- Geteilte Lamellen-Geometrie/Material pro Öffnung — beim Dispose nur einmal freigeben (`sharedGeometry` / `sharedMaterial`); Okkluder: `sharedOccluderGeometry`.
- `layoutRollerShutterGroup` aktualisiert Kinder mit `userData.role === 'slat'` und die Okkluder-Höhe.
- Führungsschienen werden nicht erzeugt (v0.7.202) — `createRollerGuideRailGeometry` bleibt ungenutzt im Modul.
- **Kein Kasten über dem Fenster:** Sturz ist die Oberkante des Leibungs-Tunnels (`panelGeometry.ts`).
