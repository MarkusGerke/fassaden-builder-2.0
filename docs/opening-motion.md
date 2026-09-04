# Öffnungs-Animation (Fenster / Tür)

## Verhalten für den Nutzer

Jedes **Fenster** und jede **Tür** hat den Reiter **Animation** (nicht bei Nischen/Cutouts). Öffnen und Schließen sind getrennte Kurven.

- **Phase:** Öffnen oder Schließen — Editor, Dauer und Punkte gelten nur für die aktive Phase.
- **Vorlagen:** Fenster (leicht überdrehen, ein paar Grad zurück), Haustür (träger Start, zähe letzte Winkel, Pause, schnelleres Zufallen), Linear.
- **Kurve:** Zeit von links (Start) nach rechts (Ende). Senkrecht: zu → offen (Linie „offen“ = Zielwinkel). Werte dürfen leicht über „offen“ oder unter „zu“ (Überdrehen).
- **Punkte:** Ziehen verschiebt; Klick in die Fläche setzt einen Zwischenpunkt; Start- und Endpunkt nur senkrecht (Zeit fest). Gewählter Punkt: **Kurve** (Catmull-Rom) oder **Linie** bis zum nächsten Punkt. Zwischenpunkte löschen.
- **Dauer / Pause / Zielwinkel:** Pause gilt nach dem Öffnen (für „Öffnen → Pause → Schließen“), nur in der Phase Öffnen sichtbar.
- **Abspielen:** Öffnen, Schließen, oder Zyklus. Stopp setzt auf den Ruhewinkel zurück (Slider „Einzeln öffnen“). Nach Ende von Öffnen bleiben die Flügel auf dem Zielwinkel; nach Schließen/Zyklus auf 0°. Während des Abspielens ist die **orange Auswahlmarkierung** ausgeblendet (`setSelectionHighlightSuppressed`).
- **Uhrzeiten (v2.0.150):** unter den Play-Buttons Listen **Öffnen** / **Schließen** (`Opening.schedule`, Dezimalstunden). Crossing der Tageszeit (Slider oder Tagzyklus) startet dieselbe Playback-Kurve. Pausierte Animationen (`animationsPaused`) stoppen auch Schedule-Trigger.
- **Datensatz:** JSON zum Kopieren und späteren Einfügen (oder zum Übergeben an den Assistenten).

Die Slider **Einzeln öffnen** bleiben der Ruhezustand. Die Animation überschreibt die Flügel nur während des Abspielens bzw. schreibt den Ruhewinkel am Ende.

## Datensatz (`fassaden-opening-motion/v1`)

Genau dieses JSON in das Textfeld **Übernehmen**, oder in den Chat legen, damit dieselben Kurven eingebaut werden.

```json
{
  "format": "fassaden-opening-motion/v1",
  "preset": "custom",
  "maxDeg": 80,
  "open": {
    "durationMs": 1400,
    "holdMs": 0,
    "keys": [
      { "t": 0, "v": 0, "ease": "smooth" },
      { "t": 0.48, "v": 0.42, "ease": "smooth" },
      { "t": 0.78, "v": 1.08, "ease": "smooth" },
      { "t": 1, "v": 1, "ease": "smooth" }
    ]
  },
  "close": {
    "durationMs": 1100,
    "holdMs": 0,
    "keys": [
      { "t": 0, "v": 1, "ease": "smooth" },
      { "t": 0.4, "v": 0.58, "ease": "smooth" },
      { "t": 1, "v": 0, "ease": "smooth" }
    ]
  }
}
```

| Feld | Bedeutung |
|---|---|
| `format` | Muss `fassaden-opening-motion/v1` sein, wenn gesetzt |
| `preset` | Hinweis: `window` / `door` / `linear` / `custom` |
| `maxDeg` | Zielwinkel in Grad bei `v = 1` (10…120) |
| `open` / `close` | Je eine Kurve |
| `durationMs` | Länge der Phase (≥ 80) |
| `holdMs` | Pause nach Öffnen, bevor ein Zyklus schließt (ms) |
| `keys` | Mindestens zwei Punkte; erster `t=0`, letzter `t=1` |
| `t` | Zeitanteil 0…1 |
| `v` | Anteil am Zielwinkel; Überdrehen etwa −0,2…1,35 |
| `ease` | `smooth` (Kurve) oder `linear` (Linie) — gilt bis zum nächsten Punkt |

**Öffnen:** Winkel = `v × maxDeg`. **Schließen:** Winkel = `v ×` Winkel zu Beginn des Schließens.

## Defaults

| Vorlage | Öffnen | Schließen |
|---|---|---|
| Fenster | Beschleunigen, `v≈1,08` Überdrehen, zurück auf 1 | Weich zu |
| Haustür | Langsam anschieben, Mitte schneller, Ende zäh; `holdMs` 900 | Kurz zäh, dann schneller fallend |
| Linear | 0→1 bzw. 1→0, `ease: linear` | wie Öffnen rückwärts |

Hydrate: fehlendes `Opening.motion` erhält den Typ-Default (Fenster vs. Tür). Ruhe-Öffnungswinkel (`leafOpenDeg`) bleibt unverändert. Kein Schema-Step.

## Dateien und Datenfluss

| Datei | Rolle |
|---|---|
| `src/types/facade.ts` | `Opening.motion`, `Opening.schedule`, `OpeningMotion`, `MotionCurve`, `MotionKeyframe` |
| `src/utils/openingMotion.ts` | Eval, Defaults, Datensatz parse/serialize, Punkt-Edit |
| `src/utils/hydrate.ts` | `motion` + `schedule` für window/door |
| `src/utils/daySchedule.ts` | Uhrzeit-Eval |
| `src/ui/dayScheduleEditor.ts` | Listen UI |
| `src/utils/openings.ts` | `updateOpeningMotion` |
| `src/windows/gruenderzeit.ts` | Pivot-`userData.leafMotion` |
| `src/FacadeController.ts` | `applyOpeningLeafDegrees` ohne Mesh-Rebuild |
| `src/ui/openingMotionEditor.ts` | SVG-Editor, Play-Buttons, Datensatz-Feld |
| `src/main.ts` | Abspielen im Animate-Loop, Schedule-Crossings, Commit der Ruhewinkel |
| `index.html` | `#opening-motion-section` Reiter Animation |

`cloneWall` kopiert `motion` tief.

## Fallstricke

- Low-LOD-Fenster haben keine Flügel-Pivots — Abspielen erzwingt High-Detail und pausiert LOD.
- Kastenfenster: Innen- und Außenflügel drehen entgegengesetzt (innen nach innen, außen nach außen); sonst synchron mit gleichem Vorzeichen (`leafOpenSignForWall`).
- Oberlichter laufen mit derselben Kurve wie die Flügel.
- Punkte während des Ziehens werden erst beim Loslassen persistiert (kein Rebuild pro Pixel).
- Szenen-Tab **Animation** (Sonnenlauf) ist unabhängig vom Öffnungs-Reiter **Animation**.
