# Rollläden

## Verhalten für den Nutzer

Bei **Fenster** und **Tür** (nicht Nische, nicht Kellerfenster) gibt es den Reiter **Rollläden** (`data-settings-section="roller-shutter"`) **immer** in der Tab-Leiste. Die Checkbox **Rollläden anzeigen** ist standardmäßig **aus** — erst dann erscheinen Höhe, Farbe und Animation.

Wenn aktiviert:

- **Höhe (geschlossen):** 0 % = oben offen, 100 % = vollständig geschlossen (`Opening.rollerShutter.drop` 0…1).
- **Lamellen:** leicht gewölbte Querschnitte **in der Leibung** (8 cm hinter der Fassadenaußenfläche, Wölbung nach innen). **v2.0.131:** Breite = volle Öffnungsbreite bis zur Laibung (kein seitlicher Lichtspalt). **v2.0.135:** bei Bogen/Stadion wird jede Lamelle an die Öffnungsmaske gekürzt (kein Durchragen in die Wand); Schatten-Okkluder folgt derselben Kontur.
- **Absenken:** Vorhang hängt vom Sturz mit freiem Spalt nach unten. Sobald die **unterste** Lamelle die Fensterbank berührt, stapeln sich weitere Lamellen von unten aufeinander, bis der Rollladen vollständig unten ist. **Hochfahren** genau umgekehrt, bis die unterste Lamelle im Sturz verschwunden ist.
- **Lichtdicht:** Sichtbare Lamellen werfen Schatten; unsichtbare Abdeckplatte folgt der abgedeckten Höhe **und Form** (Spalte zwischen Lamellen).
- **Kein Kasten, keine Führungsschienen:** nur die Lamellen. Standard: Checkbox aus, `drop` 0.
- **Farbe / Oberfläche:** Swatches und Stumpf/Glänzend/Metallisch.
- **Lamellenhöhe / Spalt:** Feinjustierung (cm) — Spalt gilt nur im freihängenden Abschnitt.
- **Animation:** Phasen **Runterfahren** und **Hochfahren** mit Dauer, Vorlagen Weich/Linear, Abspielen und Zyklus.
- **Uhrzeiten (v2.0.150):** in `#roller-shutter-options` Listen **Hoch** / **Runter** (`OpeningRollerShutter.schedule`); nur sichtbar wenn Rollladen an. Crossing der Tageszeit startet Playback.

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
  schedule?: DaySchedule  // on = hoch, off = runter (v2.0.150)
}
```

Hydrate setzt fehlende Config auf **disabled**. Kein Schema-Step nötig.

## Dateien und Datenfluss

| Datei | Rolle |
|---|---|
| `src/types/facade.ts` | `OpeningRollerShutter`, `OpeningPart: 'rollerShutter'` |
| `src/studio/rollerShutter.ts` | Defaults, Normalize, Lamellen-Layout (Frei + Stapel), Extrude-Geometrie, Masken-Spannweite (`rollerShutterSlatLocalSpan`), Okkluder-Polygon |
| `src/utils/openings.ts` | `updateOpeningRollerShutter` |
| `src/utils/hydrate.ts` | Defaults für Fenster/Tür |
| `src/FacadeController.ts` | `rebuildRollerShutters`, `applyRollerShutterDrop`, Schatten-Okkluder an Maske |
| `src/utils/daySchedule.ts` / `src/ui/dayScheduleEditor.ts` | Uhrzeiten |
| `index.html` / `src/main.ts` | Tab, Sync, Playback, Schedule |

## Fallstricke

- Animation der Flügel (`Opening.motion`) und der Rollläden sind getrennt; gleichzeitiges Abspielen wird vermieden (Rollladen-Play stoppt Flügel-Play).
- Live-Ziehen am Höhen-Slider nutzt `applyRollerShutterDrop` (kein Mesh-Rebuild); Commit speichert `drop`.
- Geteilte Lamellen-Geometrie/Material pro Öffnung — beim Dispose nur einmal freigeben (`sharedGeometry` / `sharedMaterial`); Okkluder: `sharedOccluderGeometry` (wird bei Layout neu erzeugt).
- `layoutRollerShutterGroup` aktualisiert Kinder mit `userData.role === 'slat'` (Breite/`scale.x` + `position.x` aus Maske) und die Okkluder-Kontur.
- Führungsschienen werden nicht erzeugt (v0.7.202) — `createRollerGuideRailGeometry` bleibt ungenutzt im Modul.
- **Kein Kasten über dem Fenster:** Sturz ist die Oberkante des Leibungs-Tunnels (`panelGeometry.ts`).
- **Bogenfenster (v2.0.135):** ohne Masken-Clip ragten rechteckige Lamellen oben in die Wand — `openingMaskXRangesAtY` liefert die erlaubte Spannweite je Lamellenhöhe.
