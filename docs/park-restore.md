# Park-Restore: Bedien-Parität ohne Chaos

Grill-Beschluss (2026-09-20). Ziel: **Funktionen** der Vanilla-Editoren in der Park-Shell wieder erreichbar machen, ohne zwei sichtbare UIs und ohne Post-Ark-UX zurückzudrehen.

**„Verloren“** = (a) Park-unerreichbar bei bestehender Domain/Vanilla-UI **oder** (b) echte Domain-Regression. Coverage-Matrix unten.

## DoD

**Bedien-Parität:** Alles, womit man in Vanilla Werte geändert hat, ist in Park wieder bedienbar. Bewusste Produkt-Cuts bleiben weg.

## Eingefroren (Skip — kein Restore)

| Cut | Grund |
|---|---|
| Farb-Swatches / `.sidebar-library-picker` in der rechten Leiste | Grundgesetz v2.0.455 — Auswahl über Bibliothek |
| Sichtbares Ebenen-⋯ | Nur Rechtsklick (v2.0.540) |
| Segment Ebenen \| Fassadenschmuck | Gemeinsam im Tree (v2.0.532) |
| Nav-Hilfe `?` an der Bühne | Bewusst nicht in Park-Chrome |
| Bibliothek immer sichtbar (Desktop) | Nur bei Auswahl (v2.0.538) |
| Szene-Leiste bei Dach-Auswahl | Gewollt ausgeblendet (v2.0.548) |
| Pultdach / Seed-Zurück / sichtbare Scrollbars | Produkt-Cuts seit Ark |
| Galerie, Laub an der Bühne (bereits `hidden`) | Nicht Ark-Verlust |
| Klappläden, Bleiverglasung, … (`windows-doors.md` Zurückgestellt) | Produkt-Backlog, nicht Park-Kollateralschaden |

## Architektur

- **Eine sichtbare Welt:** Park-Rahmen; Vanilla-Chrome bleibt `.vanilla-legacy-park` (geclippt).
- **Hybrid pro Accordion-Karte:** FormMirror für `id`-Felder **und** `.toolbar-stepper[id]`; **Adopt** für markierte Wrapper (`data-park-adopt`). **Kein Control doppelt.**
- **Adopt:** `data-park-adopt="<slot-id>"` am beschrifteten Wrapper in `index.html`. FormMirror schiebt den Host in einen Park-Slot und lässt einen `data-park-adopt-anchor` an der Originalstelle.
- **Domain:** Vanilla-IDs bleiben Wahrheit (`openingMotionEditor.ts`, `bindToolbarStepper`, …). Kein Domain-Rewrite in dieser Runde.
- **Optik der Adopt-Widgets:** Containment zuerst; Park-Skin = eigener Auftrag (nicht in Funktions-Slices).

## FormMirror-Allowlist (erst Slice 5)

Erlaubt später ohne Adopt: `input[type=text]`, `textarea`, `input[type=time]`.  
**Nicht** über FormMirror: SVG-Editoren, Schedule-DOM, Kartenraster, dynamische Ranges ohne `id`.  
**Seit Slice 2:** `.toolbar-stepper[id]` → Control-Typ `toolbarStepper` (Park `NumberInput` → Vanilla ±/`change`).

## Slices

| # | Inhalt | Status |
|---|---|---|
| 1 | Bewegung Fenster + Rollo: Kurven-SVG, Einzeln öffnen, Schedule, Datensatz | erledigt (v2.0.552+) |
| 2 | **Opening division:** Flügel/Teilung/Sprossen-Stepper, Hinge-Liste, Verhältnis-Chips; Timber-Smoke | erledigt (v2.0.573 / **v2.0.574**) |
| 3 | Schedule-Klasse: Licht, Markise | offen |
| 4 | Drilldowns / Kartenraster: Pediment, Arch-Form-Cards, Licht-Preset-Karten | offen |
| 5 | Allowlist: nackte Textfelder (z. B. Schrift) | offen |
| 6 | Inseln: `SceneToolbarApp` (Von/Bis, Licht-Kanäle, Nebelfarbe, Arrivieren-Feedback), `ChromeExtrasApp` (Fassade-Yaws) | offen |
| — | Look: Adopt an Park-Tokens | eigener Auftrag |

## Coverage-Matrix (Selection / Öffnung — Stand v2.0.573)

| Bereich | Vanilla | Park | Status |
|---|---|---|---|
| Maße (Breite/Höhe/… number+id) | `input[type=number][id]` | FormMirror `number` | ok |
| Flügel-Anzahl | `#window-casement-stepper` | FormMirror `toolbarStepper` | ok (Slice 2) |
| Teilung v/h + OL-Teilung | `#window-split-*-stepper`, `#window-transom-split-*-stepper` | FormMirror `toolbarStepper` | ok (Slice 2) |
| Sprossen v/h | `#window-muntin-*-stepper` | FormMirror `toolbarStepper` | ok (Slice 2) |
| Verhältnis-Chips 1:n | `.preset-group` Buttons | FormMirror `buttonEl` (wenn Gruppe sichtbar) | ok / abhängig Count=2 |
| Scharnier / Öffnungsart | `#window-hinge-section` (`details`) | Adopt `window-hinge-modes` | ok (Slice 2 / v2.0.574) |
| Holzmaße / profilierte Sprossen | `input[id]` / checkbox | FormMirror | Smoke (Slice 2) |
| Einzeln öffnen + Motion/Rollo-Editoren | Adopt Slice 1 | Adopt | ok |
| Bogen-Form-Karten | `#opening-arch-form-cards` | — | Lücke → Slice 4 |
| Pediment-Karten / Konsolen | `#pediment-*-cards` | — | Lücke → Slice 4 |
| Farben rechts (Swatches) | Legacy | — | Cut (Bibliothek) |
| Zurückgestellte Domain (Klappläden …) | — | — | Cut/Backlog |

## Slice 1 — Adopt-Slots

| `data-park-adopt` | Inhalt |
|---|---|
| `opening-leaf-open` | `#window-open-group` inkl. Label |
| `opening-motion-editor` | Kurve: Hinweis, Phase, Vorlage, SVG, Dauer/Pause/Winkel, Punkt-Ease |
| `opening-motion-schedule` | Uhrzeiten-Editor |
| `opening-motion-dataset` | Label, Hinweis, Textarea (nicht nochmal FormMirror) |
| `roller-motion-editor` | Rollo-Animation: Phase, Vorlage, SVG, Dauer, Ease |
| `roller-shutter-schedule` | Rollo-Uhrzeiten |

Play / Kopieren / Übernehmen bleiben FormMirror (`button.preset-btn[id]`).

## Slice 2 — Opening division

| Mechanismus | Inhalt |
|---|---|
| FormMirror `toolbarStepper` | 7× `.toolbar-stepper[id]` (Flügel, Teilung, Sprossen, OL-Teilung) |
| Adopt `window-hinge-modes` | ganzes `#window-hinge-section`-`<details open>` (Summary + Liste) |
| `isNumberStepperButton` | nur ± neben `input[type=number]`, **nicht** `.toolbar-stepper` |
| `bindToolbarStepper` | behält `id` am ersetzten Wert-`input` |
| Write-Pfad (v2.0.574) | Park-Trigger → Vanilla ± (`nudgeToolbarStepper`); Adopt-Cleanup ohne Remount-Race |

Smoke: [agent-smoke-check.md](agent-smoke-check.md) (Opening division). Feature-Doc: [windows-doors.md](windows-doors.md).

## Fallstricke

- FormMirror-Remount darf Adopt-Hosts nicht flackern lassen — For keyed über stabile Block-`key`-Strings; Adopt nur verschieben wenn `parent !== slot`.
- Beim Unmount: Host zurück an `data-park-adopt-anchor` — **nur** wenn kein anderer Slot ihn hält; `placedHost`/Registry (v2.0.574). Anchor **ohne** `hidden`-Attribut (sonst droppt `hasHiddenAncestor` den Slot nach dem ersten Place → Host weg).
- SVG `getScreenCTM` braucht sichtbaren Layout-Slot (`min-width: 0`, volle Breite).
- Hosts in `[hidden]` (z. B. `#roller-shutter-options`) erst scannen wenn sichtbar — wie andere Controls. `#window-style-section` startet `hidden` bis Fenster-Auswahl (`syncWindowStyleSection`).
- **v2.0.530:** „Stepper-Buttons überspringen“ galt für NumberInput-Paare — ohne Ausnahme für `.toolbar-stepper` wirkte Teilung in Park tot (behoben Slice 2 / v2.0.573).
- **v2.0.574:** Ark-`onValueChange` allein schreibt `.toolbar-stepper` nicht zuverlässig — immer Vanilla ±. Smoke mit echter Auswahl (`__fbDebug.selectOpening`), nicht nur `#app.has-selection`.
- **Accordion (v2.0.569–572):** Signatur/Höhe/stale-Show — siehe Changelog.
- **Bibliothek-Hosts (v2.0.571 / v2.0.572):** Dock nie wegen Auswahl/Stage unmounten.
- **Rechts-Layout (v2.0.569):** Mit Auswahl nur Inspector; Szene/Zufall nur ohne Auswahl — nicht parallel.
- Nach Park/Bridge: [agent-smoke-check.md](agent-smoke-check.md).

## Betroffene Dateien

| Slice | Dateien |
|---|---|
| 1 | `index.html`, `FormMirror.tsx`, `style.css`, `opening-motion.md`, `roller-shutter.md` |
| 2 | `FormMirror.tsx`, `index.html` (hinge adopt), `main.ts` (`bindToolbarStepper` id), Docs |

Siehe auch [ui-component-library.md](ui-component-library.md).
