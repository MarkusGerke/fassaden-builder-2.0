# Erker, Balkon, Loggia

Vorsprünge aus der Bibliothek (Tabs **Erker** / **Balkon** / **Loggia**). QA-Raster: [gallery.md](gallery.md). Andocken/Platzieren allgemein: [ux.md](ux.md).

## Verhalten für den Nutzer

- Bibliothek-Karten nach `kind` aufgeteilt; Tab **Wände** zeigt nur Längen, Endstücke und Wände mit Standardöffnung.
- Platzieren: Ghost-Wandgeometrie + orange Andockfläche (kein Thumbnail).
- Formen: U, 45°, rund (Erker). Balkon/Loggia: schmale Front, Seiten volle Höhe, Standalone mit Hauswand-Rückseite.

## Daten

### `Wall.bayWindow` (Parent)

| Feld | Bedeutung |
|---|---|
| `frontWidthCm` / `depthCm` | Frontbreite / Tiefe |
| `shape` | `rect` \| `angled45` \| `round` |
| `kind` | `bay` \| `balcony` \| `loggia` (Default `bay` bei Alt-Saves) |
| `wallIds` | Kind-Wände (3 bei U-Form, mehr bei rundem Erker) |

Kinder: `bayParentId`, `bayRole`: `side` \| `front` \| `return` \| `arc` \| `back`.

### `Wall.arcBay` (runder Erker)

Eine Wand mit Ellipsenbogen-Geometrie (Paneele/Profile folgen der Krümmung): `frontWidthCm`, `depthCm`, optional `inward`.

## Geometrie / Konventionen

- U- und 45°-Formen schließen an der Host-Außenfläche mit **Gehrung**.
- 45°-Seiten: links +45°, rechts +135°.
- `panelFlip` je Wandfläche zur Außenseite (`outwardPerpendicularAtCorner` in `bayWindow.ts`).
- Erker-Wände `planLinked` für Gehrung.
- Balkon/Loggia: Front typisch 96×16 cm; `bayRole: back` = Hauswand.

Presets: `BAY_WINDOW_PRESETS` (Galerie/Katalog).

## Dateien

| Datei | Rolle |
|---|---|
| `src/studio/bayWindow.ts` | Erzeugen, Flip, Geometrie-Helfer |
| `src/constants/presets.ts` | Presets |
| `src/types/facade.ts` | `bayWindow`, `arcBay`, Rollen |
| `src/main.ts` / Bibliothek | Tabs, Drag&Drop |

## Fallstricke

- Ohne korrekte `panelFlip` je Seite zeigen Paneele nach innen.
- Runder Erker = **eine** `arcBay`-Wand, nicht viele Plan-Segmente.
- Kollinear angedockte Bibliothek-Wände können zu einer Wand verschmelzen (`mergeCollinearDockedWalls`) — Erker-Gruppen nicht unbedacht „auflösen“.
