# UI-Kit (Design-Tokens & Primitives)

Einheitliche Schicht für Abstände, Typo und Controls in der rechten Einstellungsleiste (und schrittweise weiteren UI-Flächen). **Kein Look-Redesign** — dieselbe visuelle Sprache (Chips dunkel aktiv, Tabs Unterstrich, Sektionsköpfe orange Inset), einmal definiert.

## Dateien

| Datei | Rolle |
|---|---|
| `src/style.css` (`:root` + Block „UI Kit“) | Tokens und `.ui-*`-Primitives; bestehende Klassen als Alias |
| `src/ui/fieldInfo.ts` | `installFieldSteppers`, `inferFieldUnit`, `stripUnitFromNearbyLabel` |
| `index.html` | Pilot: Öffnung Maße/Farben, Studio Maße/Farben mit `.ui-stack` / `.ui-field-inline` |

## Tokens (`:root`)

| Token | Wert | Zweck |
|---|---|---|
| `--fs-tab` / `--fs-label` / `--fs-body` / `--fs-check` | 0.68 / 0.72 / 0.78 / 0.8 rem | Tabs, Labels, Body, Checkboxen |
| `--fw-label` / `--fw-head` | 600 / 700 | |
| `--c-label` / `--c-text` / `--c-muted` / `--c-active` | #666 / #333 / #888 / #333 | |
| `--c-section-head-bg` / `--c-border` / `--c-border-strong` | #e4e4e4 / #ccc / #c8c8c8 | |
| `--space-1` / `--space-2` / `--space-3` / `--space-4` | **4 / 8 / 16 / 32 px** | Label→Feld, eng, **Zeilen in Sektion**, **zwischen Sektionen** |
| `--radius-control` / `--control-h` / `--input-narrow` | 0.4rem / 1.75rem / **5ch** | Controls; Stepper-Wert max. 5 Stellen |

**Do:** Neue Abstände nur über `--space-*`. **Don’t:** Gap **plus** `margin-top` auf denselben Kindern; andere Werte als 16px (innen) / 32px (Sektionen).

## Abstände

- Innerhalb einer Sektion: **16px** (`gap: var(--space-3)` auf `.settings-section`).
- Zwischen Sektionen: **32px** (`gap: var(--space-4)` auf `#toolbar-opening` / Studio / `.scrollable-settings-panel`).
- Horizontaler Inhalts-Inset: `margin-left/right: var(--space-3)`.
- `#opening-actions-section`: Padding `--space-3`, Gap `--space-2`.

## Primitives

| Klasse | Zweck |
|---|---|
| `.ui-stack` | Spalte mit `gap: var(--space-3)`; Kinder **ohne** `margin-top` |
| `.ui-label` (+ `.toolbar-label`) | Feldtitel |
| `.ui-field` | vollbreites Input/Select |
| `.ui-field-inline` | Titel links / Control rechts |
| `.ui-stepper` (+ Alias `.field-stepper`) | − / Feld / + (Einheit im Titel) |
| `.ui-chip` / `.ui-chip-group` (+ `.preset-btn` active) | Toggle-Chips |
| `.ui-tab` (+ `.library-tab`) | Register mit Unterstrich |
| `.ui-tile` (+ `.tpl-card`) | Form-/Profil-Kacheln |
| `.ui-check` (+ `.toolbar-check`) | Checkbox-Zeile |

Bestehende Klassen bleiben im Markup; Werte kommen aus Tokens.

## Pflicht: Feldlayout

**Titel links, Eingabe rechts, alles untereinander** — eine Spalte, keine Maß-Grids. Siehe Cursor-Rule `.cursor/rules/ui-feldlayout.mdc`.

**Einheit** steht im Titel in Klammern (`Höhe (cm)`), nicht im Stepper.

**Stepper-Wert:** max. **5 Stellen** (`--input-narrow: 5ch`). Sektionen: `max-width: 100%` (kein Rechts-Overflow).

**Teilüberschriften:** Mehrere Gruppen in einer Sektion → `.settings-subheading.settings-subheading-nested` (Farbe, Maße, Position, Profil, …).

## Buttons

Stil überall wie **„Öffnung löschen“**: `.preset-btn` / Basis-`button` mit `--btn-radius` (kein Pill), horizontal **`--btn-pad-x` = 8px**.

## Stepper

- `installFieldSteppers` wrappt `#ui-right` / `.right-selection-toolbar` `input[type=number]` als `.ui-stepper`.
- Einheit im Label belassen/ergänzen (`ensureUnitInNearbyLabel`) — nicht im Feld.
- **Nicht** wrappen: `.toolbar-stepper`, bereits `.ui-stepper`, Studio-± in `.preset-group` (`hasManualPlusMinusNeighbors`).
- Richtung ←→ bei Öffnungsbreite bleibt **außerhalb** des Steppers.
- Wertbreite max. 5 Stellen; `.toolbar-stepper` optisch gleich.

## Sektions-Padding

Scrollbare Panels und Toolbars nutzen **32px Gap** zwischen Sektionen (nicht `padding-bottom` am letzten Kind). Sektionsinhalt: Flex-`gap` 16px; kein `padding: 0`, das den Abstand killt.

## Pilot

- `#opening-measures-section`, `#opening-colors-section` → `.ui-stack`
- `#sill-inner-accordion`, `#sill-outer-accordion` → `.ui-stack` + Inline-Zeilen (kein `toolbar-row-2`)
- Studio `#toolbar-studio` Maße/Farben analog
- IDs unverändert (Regel `keine-ui-loeschen`)

## Follow-ups

- Viewport-Chrome / Bibliothek-Markup voll migrieren
- Stylelint-Enforcement gegen Hardcode-Abstände
