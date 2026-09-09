# Scrollgesteuerte Einstellungs-Sektionen

## Nutzer

Rechte Leiste (Auswahl-Toolbar, Szene-Toolbar): mehrere Sektionen untereinander. **Kein Klick-Akkordeon** — Sichtbarkeit/„Aufklappen“ nur durch Scrollen.

- **Gescrollte** Sektionstitel stapeln sich oben (sticky), lückenlos
- **Kommende** Titel stapeln sich unten (sticky), lückenlos
- **Aktive** Sektion (letzter oben geklebter Kopf) in der Mitte; Inhalt dazwischen
- **Klick** auf Titel scrollt zur Sektion (Stapel oben/unten danach korrekt, auch für die letzte Sektion)
- Genau **eine** Sektion als aktiv markiert (`.settings-section-head-active`)

Referenz: [react-scrollable-accordion](https://github.com/andrii-maglovanyi/react-scrollable-accordion) (`List`/`ListHeader`).

## Technik

| Datei | Rolle |
|---|---|
| `src/ui/scrollableSettingsSections.ts` | Port der Referenz + Korrekturen (siehe unten) |
| `src/main.ts` | `finishRenderUi` → `syncSelectionToolbarTabs` → `syncScrollableSettingsPanel(panel, sortierteSektionen)` |
| `src/style.css` | `.scrollable-settings-wrapper` (Containing Block), `.scrollable-settings-panel`, `.settings-section-end-spacer`, stuck-top/bottom/active |

### Algorithmus (v2.0.333)

Struktur wie Referenz: **Wrapper** (`.right-selection-toolbar`, `position: relative; overflow: hidden`) umschließt das **scrollende Panel** (`.selection-toolbar-panels`, `position: static`). Köpfe werden `position: absolute` relativ zum **Wrapper** geklebt — nicht zum Scroller — und stehen dadurch still, ohne pro Frame nachgezogen zu werden.

- `N[i]` = natürliche Scroll-Y des Kopfes `i` (alle Köpfe im Fluss), einmal gemessen (Sync / Resize / Inhaltsänderung)
- `h[i]` = Kopfhöhe (gemessen; Fallback `SETTINGS_SECTION_HEAD_REM` 2,15 rem)
- **Oben:** `scrollTop + Σh(0..i) ≥ N[i] − 0,5` → `top = Σh(0..i)`
- **Unten:** `scrollTop + (viewH − Σh(i..n)) < N[i]` → `bottom = Σh(i+1..n)`
- **Platzhalter:** geklebte Sektion bekommt `paddingTop = h[i] (+ row-gap bei Flex-Spalten)` — in **beiden** Zuständen
- **Klick:** `scrollTop = ceil(N[i] − Σh(0..i))`
- **End-Spacer:** `.settings-section-end-spacer` am Panel-Ende, Höhe = `max(0, N[last] − Σh(0..last) − maxScrollOhneSpacer)` — die letzte Sektion kann bis unter den Top-Stapel
- **DOM-Reihenfolge = Tab-Reihenfolge:** `orderSectionsInDom` sortiert Geschwister je Elternknoten nach `data-settings-order`-Index (Wrapper wie Fensterbank-Block als Einheit, Rang = kleinster enthaltener Index)
- Scroll → `requestAnimationFrame` → ein Update; alle Layout-Reads **vor** den DOM-Writes
- `ResizeObserver` auf Panel + Inhalts-Kindern der Sektionen → Remeasure
- `syncScrollableSettingsPanel` ist idempotent über eine Signatur (IDs, Sichtbarkeit, Labels) — bei jedem UI-Render aufgerufen, misst aber nur bei Änderung neu

### Bewusste Abweichungen von der Referenz

| Referenz | Hier | Warum |
|---|---|---|
| `initialOffsetTop = offsetTop − Σh(0..i)` und Bedingungen addieren `Σh(0..i)` erneut | `N[i]` direkt | Referenz-Formel ist ab Kopf 1 um Σh(0..i) verschoben: Kopf springt beim Kleben/Lösen (gemessen: Farben 69→34, Animation 976→874) |
| `marginTop` auf nächstes Geschwister, nur oben | `paddingTop` an der Sektion, oben **und** unten, inkl. Flex-`row-gap` | `marginTop` überschreibt vorhandene `margin-top` (`.toolbar-group` 1,5 rem) → Inhalt springt 24 px; ohne Gap-Anteil 4–10 px; ohne Platzhalter unten schwankt `scrollHeight` um Σh → Sprung ans Ende klemmt am momentanen Maximum |
| kein Spacer | End-Spacer | Kurze letzte Sektionen sonst nie „aktiv“ oben |
| DOM-Reihenfolge vorausgesetzt | DOM wird sortiert | Tab-Sortierung (Maße → Farben → …) ≠ HTML-Reihenfolge (Farben ganz unten) → Loch im Stapel |

## Fehlersuche (Chronik)

Symptom (Nutzer): „Lücken zwischen den Tabs, Tabs zittern und wackeln beim Scrollen.“

Verworfen / nicht geholfen:

- **v2.0.330** `position: fixed` mit `panelRect.left/top` — unter `#ui-right` (transformierter Vorfahre) doppelt versetzt → Reiter unsichtbar
- **v2.0.331** `transform: translateY` pro Scroll-Frame + `minHeight` auf allen Sektionen — Zittern (Nachziehen pro Frame), riesiger Weißraum
- **v2.0.332** `position: absolute` relativ zum **Panel** (= Scroller) — absolute Kinder eines Scrollers scrollen mit → weiter Nachziehen/Zittern; `minHeight` nur aktive Sektion → Lücken darunter
- Referenz-Formeln 1:1 (`initialOffsetTop − Σh`) — Köpfe springen um Σh(0..i) beim Übergang (Messung 1-px-Schritte)
- `ResizeObserver` auf den **Sektionen** — deren Höhe ändert sich planmäßig beim Kleben → Remeasure bei jedem Übergang → Spacer kurz 0 → `scrollTop` geklemmt
- `panel.clientWidth` **in** der Stick-Schleife lesen — Layout-Flush mit kurz verkürztem Inhalt → Klemmen am Ende um Σ Gaps (≈45 px)

Funktioniert (**v2.0.333**, nicht zurückdrehen):

- Containing Block = Wrapper (nicht Scroller); Panel/Sektionen `position: static`
- `N[i]` direkt vergleichen; Platzhalter `paddingTop` oben+unten inkl. row-gap; End-Spacer; DOM-Sortierung
- Layout-Reads gebündelt vor den Writes; Spacer bei Messung temporär vergrößern (nie schrumpfen lassen)
- Sync-Signatur (kein Remeasure pro Render); RO nur auf Inhalts-Kindern

Verifiziert (CDP, 1-px-Schritte an allen Übergängen, Sweep 0…max in 40-px-Schritten): 0 Stapel-Lücken (>1,5 px), 0 Kopf-Sprünge, `scrollHeight` konstant, Klicks landen exakt (Smooth-Scroll braucht 1,3–1,9 s für ~3900 px).

### Fallstricke

- Kein positionierter Vorfahre zwischen Kopf und Wrapper einführen (sonst kleben Köpfe am falschen Element)
- Keine Layout-Reads (`getBoundingClientRect`, `clientWidth`, `offsetTop`) innerhalb der Stick-Schleife
- `.scrollable-settings-panel` hat `overflow-anchor: none` (Scroll-Anchoring würde bei Platzhalter-Wechsel springen)
- Flex-`gap`/`padding`/`margin` an Toolbar-Wrappern und Sektionen im Scroll-Modus 0 (`style.css`)
- Neue Sektionen: `data-settings-section`, `data-settings-label`, `data-settings-order` genügen; Kopf-Element wird erzeugt
