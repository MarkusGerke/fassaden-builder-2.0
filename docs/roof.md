# Dach (Mansarde, Sattel, Walm, Krüppelwalm, Pult)

Dach auf dem **primären Nesting-Outer** der obersten Etage (`planFacesWithHoles` / `topRoofFaceWorld`). Seit **v2.0.472** Dachkonfigurator mit mehreren Formen; **v2.0.473:** Traufe an echter Geschossoberkante, Ziegel-Pipeline aus, Zwerchgiebel.

## Verhalten

- Linke Sidebar **Ebenen**: **Dach hinzufügen** / Formname; Kontextmenü Ausblenden/Löschen.
- Nur mit geschlossenem Ring auf der obersten Etage.
- **Dachform:** Berliner Mansarde · Satteldach · Walmdach · Krüppelwalm · Pultdach.
- **Kanten:** Auto / Frei / Bündig (Nachbar/Brandwand).
- **Ziegel aus (MVP):** `ROOF_TILES_ENABLED = false` — immer glatte Dachhaut. Ziegel-UI und Ebenen-Zeile „Ziegel“ ausgeblendet; Farbe **Dachhaut** unter Dachform. Pipeline bleibt im Code für die nächste Stufe.
- **Zwerchgiebel:** An/Aus, Seite (Traufkante), Breite, Tiefe. Schneidet in die Dachhaut, eigenes Quersatteldach. Tiefe wird auf ≤ halbe Breite begrenzt (sonst unter der Haupthaut). **Nicht** Gaube/Dachfenster.
- Mansarde: Untere/Obere Neigung, Firsthöhe (Knick 55 %).
- Sattel/Walm/Krüppelwalm/Pult: Neigung, Überstand, abgeleitete Firsthöhe, Firstrichtung/Hochseite, Giebelhöhe (Krüppelwalm), Giebelwand-Farbe.
- Noch **ohne** Gauben und Dachfenster (nächste Stufe nach Eindeckung).

## Daten

`Building.roof` (`RoofConfig`), Defaults/`normalizeRoof` in `src/studio/roof.ts`.

| Feld | Default | Bedeutung |
|---|---|---|
| `kind` | `mansard` | Form |
| `pitch` / `ridgeDeg` / `halfHipHeight` | 45° / `null` / 120 | Nicht-Mansarde |
| `covering` | `smooth` | Gespeichert; wirksam immer glatt solange `ROOF_TILES_ENABLED` false |
| `edgeModes` | – | `free` / `flush` je `roofEdgeKey` |
| `crossGables` | `[]` | `{ edgeKey, widthCm, depthCm }` |
| `gableColor` / `tileColor` | Wandweiß / Ziegelrot | Füllwand / Dachhaut |
| … | | Mansarden- und Ziegel-Felder unverändert (für spätere Stufe) |

## Geometrie

### Traufe (v2.0.473)

`eaveY = storeyTopY(building, topFloor)` — echte Wandoberkante der obersten Etage. **Nicht** `floors.length × wallHeight` (sonst Lücke bei kürzeren OGs, z. B. 352 cm statt 448).

### Ebenen-Envelope / Zwerchgiebel

Nicht-Mansarden: untere Einhüllende von Dachebenen (`src/studio/roofForms.ts`). Zwerchgiebel: Fußabdruck auf Traufkante nach innen → Loch in Haupthaut → Sattel mit First nach innen; Frontgiebelwand. Tiefe `min(depth, width/2)`.

## Fallstricke

- Traufe immer über `storeyTopY`, nie `floors × wallHeight`.
- Ziegel-Flag nicht ohne Absprache wieder auf true — Performance (~10⁵ Vertices).
- Zwerchgiebel-Tiefe > Breite/2 bei gleicher Neigung → Quergiebel unter der Haut (intern geclampt).
- Gauben ≠ Zwerchgiebel.

## Roadmap

1. Formen + bündige Kanten + Zwerchgiebel (v2.0.472/473) ✓
2. Eindeckung / Ziegel auf allen Formen
3. Gauben und Dachfenster
4. Straight-Skeleton für Walm auf L/U
