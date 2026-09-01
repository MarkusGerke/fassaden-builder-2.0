# Rollläden

## Verhalten für den Nutzer

Bei **Fenster** und **Tür** (nicht Nische, nicht Kellerfenster) gibt es den Reiter **Rollläden** (`data-settings-section="roller-shutter"`) **immer** in der Tab-Leiste. Die Checkbox **Rollläden anzeigen** ist standardmäßig **aus** — erst dann erscheinen Höhe, Farbe und Animation.

Wenn aktiviert:

- **Höhe (geschlossen):** 0 % = oben offen, 100 % = vollständig geschlossen (`Opening.rollerShutter.drop` 0…1).
- **Lamellen:** leicht gewölbte Querschnitte **in der Leibung** (8 cm hinter der Fassadenaußenfläche, Wölbung nach innen / 180° um Y). Breite = Öffnungsbreite − 2×8 cm. Beim Herunterlassen bleibt ein leichter Spalt zwischen den Ebenen; sobald sie die untere Abdeckung füllen müssen, stapeln sie sich und die Lücken schrumpfen nach unten.
- **Kein Kasten, keine Führungsschienen:** Es gibt keine sichtbare Kasten-Mechanik über der Öffnung und keine Schienen — nur die Lamellen. Standard: Checkbox aus, `drop` 0 (keine sichtbaren Lamellen).
- **Farbe / Oberfläche:** eigene Swatches und Stumpf/Glänzend/Metallisch.
- **Lamellenhöhe / Spalt:** Feinjustierung (cm).
- **Animation:** Phasen **Runterfahren** und **Hochfahren** mit Dauer, Vorlagen Weich/Linear, Abspielen und Zyklus (Runter → kurze Pause → Hoch).

Klick auf die Lamellen in 3D öffnet den Rollläden-Tab (`openingPart: 'rollerShutter'`).

## Konstanten (`src/studio/rollerShutter.ts`)

| Konstante | Default | Bedeutung |
|---|---|---|
| `ROLLER_SHUTTER_INWARD_CM` | 8 | Versatz der Rollladen-Ebene hinter die Fassadenaußenfläche |
| `ROLLER_GUIDE_EDGE_INSET_CM` | 8 | Nur noch für Lamellenbreite (keine Schienen-Meshes) |
## Daten

```typescript
Opening.rollerShutter?: {
  enabled: boolean      // Default false
  drop: number          // 0 = offen, 1 = geschlossen
  color?: string
  finish?: SurfaceFinish
  slatHeightCm?: number // Default 5
  gapCm?: number        // Default 0.85
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
| `src/studio/rollerShutter.ts` | Defaults, Normalize, Lamellen-Layout, Extrude-Geometrie |
| `src/utils/openings.ts` | `updateOpeningRollerShutter` |
| `src/utils/hydrate.ts` | Defaults für Fenster/Tür |
| `src/FacadeController.ts` | `rebuildRollerShutters`, `applyRollerShutterDrop` (ohne Rebuild) |
| `index.html` / `src/main.ts` | Tab, Sync, Playback |

## Fallstricke

- Animation der Flügel (`Opening.motion`) und der Rollläden sind getrennt; gleichzeitiges Abspielen wird vermieden (Rollladen-Play stoppt Flügel-Play).
- Live-Ziehen am Höhen-Slider nutzt `applyRollerShutterDrop` (kein Mesh-Rebuild); Commit speichert `drop`.
- Geteilte Lamellen-Geometrie/Material pro Öffnung — beim Dispose nur einmal freigeben (`sharedGeometry` / `sharedMaterial`); Führungsschienen analog (`sharedGuideGeometry` / `sharedGuideMaterial`).
- `layoutRollerShutterGroup` aktualisiert nur Kinder mit `userData.role === 'slat'`.
- Führungsschienen werden nicht mehr erzeugt (v0.7.202) — `createRollerGuideRailGeometry` bleibt ungenutzt im Modul.
- **Kein Kasten über dem Fenster:** Sturz-Stopfen in `gruenderzeit.ts` und Leibungs-Lippe/Soffit (v0.7.194–238) entfernt. Sturz ist die Oberkante des Leibungs-Tunnels (`panelGeometry.ts`, v0.7.239).