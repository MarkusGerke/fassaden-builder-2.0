# Erker, Balkon, Loggia

Vorsprünge aus der Bibliothek (Tabs **Erker** / **Balkon** / **Loggia**). QA-Raster: [gallery.md](gallery.md). Andocken/Platzieren allgemein: [ux.md](ux.md).

## Verhalten für den Nutzer

- Bibliothek-Karten nach `kind` aufgeteilt; Tab **Wände** zeigt nur Längen, Endstücke und Wände mit Standardöffnung.
- Platzieren: Ghost-Wandgeometrie + orange Andockfläche (kein Thumbnail).
- **Erker (v2.0.137):** nur zwei Presets — **384 cm Front** mit 90°-Schenkeln (`bay-384-rect`) bzw. **45°-Schenkeln** (`bay-384-45`), Tiefe 144 cm. Beim 45°-Erker ist `frontWidthCm` die **vordere** Wand; der Ansatz am Parent ist breiter (`W + 2×D`). Runde Erker entfallen in der Bibliothek (Alt-Saves mit `shape: round` / `arcBay` bleiben ladbar).
- Balkon/Loggia: schmale Front, Seiten volle Höhe, Standalone mit Hauswand-Rückseite.

## Daten

### `Wall.bayWindow` (Parent)

| Feld | Bedeutung |
|---|---|
| `frontWidthCm` / `depthCm` | Frontbreite / Tiefe |
| `shape` | `rect` \| `angled45` \| `round` |
| `kind` | `bay` \| `balcony` \| `loggia` (Default `bay` bei Alt-Saves) |
| `wallIds` | Kind-Wände (3 bei U-Form, 1 bei rundem Legacy-Erker) |

Kinder: `bayParentId`, `bayRole`: `side` \| `front` \| `return` \| `arc` \| `back`.

### `Wall.arcBay` (runder Erker, Legacy)

Eine Wand mit Ellipsenbogen-Geometrie (Paneele/Profile folgen der Krümmung): `frontWidthCm`, `depthCm`, optional `inward`.

## Geometrie / Konventionen

- U- und 45°-Formen schließen an der Host-**Planlinie** (Außenkante) mit **Gehrung** — kein zusätzlicher half-depth-Versatz.
- Aufbau wie manuell: Front in der Mitte, Schenkel vom Parent-Ansatz zur Front („nach hinten“).
- 45°-Seiten: Ansatz `W+2D`, Front `W`; Schenkellänge `D/cos(45°)`.
- `panelFlip` je Wandfläche zur Außenseite (weg vom Erker-Innenraum).
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
- Runder Erker (Legacy) = **eine** `arcBay`-Wand, nicht viele Plan-Segmente.
- 45°-Erker braucht am Parent mindestens `frontWidthCm + 2×depthCm` Platz.
- Kollinear angedockte Bibliothek-Wände können zu einer Wand verschmelzen (`mergeCollinearDockedWalls`) — Erker-Gruppen nicht unbedacht „auflösen“.
