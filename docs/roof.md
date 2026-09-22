# Dach (Mansarde, Sattel, Walm, Krüppelwalm, Pult)

Dach auf dem **primären Nesting-Outer** der obersten Etage (`planFacesWithHoles` / `topRoofFaceWorld`). Seit **v2.0.472** Dachkonfigurator mit mehreren Formen; **v2.0.473:** Traufe an echter Geschossoberkante, Ziegel-Pipeline aus, Zwerchgiebel. **v2.0.477:** Dach in 3D wählbar, Dachfenster und Gauben. **v2.0.478:** acht Gaubenformen nach Wikipedia. **v2.0.479:** Gauben mit echter Konstruktion — Kehle statt Kasten, alle Maße einstellbar, Traufdurchbruch, Fenster aus der Öffnungs-Logik. **v2.0.481:** Gauben/Dachfenster zuverlässig wählbar & verschiebbar, Traufüberstand ohne First-Anhebung, Rechtsklick-Menü. **v2.0.482:** 8 cm-Raster, Hilfs-/Abstandslinien und Pfeiltasten auf der Schräge (wie Fenster).

## Verhalten

- Linke Sidebar **Ebenen**: **Dach hinzufügen** / Formname; Kontextmenü Ausblenden/Löschen. **v2.0.507:** Löschen setzt ein frisches Default-Dach (`enabled: false`); **Hinzufügen** startet neu (keine alten Gauben/Form). **v2.0.502:** Aufgeklapptes Dach listet gesetzte **Gauben** und **Dachfenster** (Breite · Form); Klick wählt, ⋯/Rechtsklick wie in 3D. **v2.0.503:** Ctrl/Cmd+Klick Mehrfachauswahl; Shift+Klick Bereich zwischen zwei Zeilen.
- **3D-Klick** auf die Dachhaut (oder Giebel/Rinne) wählt das Dach direkt — nicht nur über die Ebenen-Leiste. Priorität: Fassade vor dem Strahl gewinnt; Dach nur wenn klar näher (`roofBeatsFacadeMesh`, eps 6 cm).
- Nur mit geschlossenem Ring auf der obersten Etage.
- **Dachform:** Berliner Mansarde · Satteldach · Walmdach · Krüppelwalm · Pultdach. **v2.0.548:** Stirnkanten der Firstachse (links/rechts zur Fassade) sind immer **bündig** mit der Wand, Schräge nur vorne/hinten. Mansarde läuft an den Stirnseiten nicht ein. **v2.0.575:** **Firstrichtung** auch bei Mansarde und Walm (Automatisch, O–W, N–S, NW–SO, NO–SW) — dieselbe Achse wie beim Sattel, sie dreht welche Kanten Stirn sind. Pult bleibt **Hochseite** (acht Himmelsrichtungen).
- **Kastentraufe (v2.0.575 / v2.0.579):** An Traufen mit Überstand eine waagerechte Untersicht in Giebelwandfarbe, von der Außenwand bis zur **senkrechten** Traufspitze (Wandkante plus Überstand, nicht bis in die Gehrung), auf Höhe der Dachunterkante an der Spitze. Stirnbrett von der Dachoberkante bis zu dieser Untersicht. Steht der Nachbar **nicht** vor der Wand, schließt eine Endkappe in dieser Ebene bis auf die Dachhaut. Steht er vor (Ortgang mit Überstand oder zweite Traufe), füllt ein waagerechtes Eckstück bis zur Dachkante — keine Kappe in der Wandebene, die schneidet die Platte. Giebelfüllung läuft bis an die Dachhaut, 0,4 cm in der Wand; der Plattenrand bleibt auf der Kante. Gauben-Traufdurchbruch und Zwerchgiebel lassen dort eine Lücke. Der Plattenrand endet an der Wandecke (v2.0.580) — die Rückführung dahinter schließt die Endkappe, sonst das Schachbrett. An diesen Kanten bleibt das Traufgesims, Oberkante 1 cm unter der Untersicht. Bündige Giebel behalten Füllwand und das höher sitzende Gesims. Traufhöhe und die 6-cm-Wandkürzung bleiben.
- **Geschlossene Dachplatte (v2.0.576):** Oberseite, Unterseite und ein Rand an jeder Außenkante, die vor der Wand steht. Liegt die Kante auf der Wand, schließt die Füllwand — dort kein zweites Brett (sonst die Linie von v2.0.510). Innenliegende Grate bleiben ohne Brett.
- **Firstrichtung (v2.0.576):** Wechsel schreibt `edgeModes` neu, wie der Formwechsel. Neue Stirnseiten werden bündig, Überstand und Rinne wandern auf die neuen Traufen. Pult: nur die tiefe Traufe, Hochseite bleibt acht Richtungen.
- **Regenrinne (v2.0.576 / v2.0.582):** Halbrund, oben offen, Außendurchmesser 12 cm, Wand 0.5 cm, vorderer Wulst 18 mm auf der bestehenden Vorderkante. Rückseite an der Dachkante, Oberkante auf der Dachhaut der Traufspitze (nicht auf der Untersicht). An jeder Traufe mit Überstand. Ecken auf Gehrung, offene Enden geschlossen. Kurze Rinneneisen etwa alle 60 cm, 10 cm vom Ende und vom Stutzen: Lasche am Stirnbrett ab der Dachkante, Band unter dem Halbrund, Nase über dem Wulst, 0,4 cm neben Rinne und Brett, gleiche Farbe. Kein Gefälle, keine Stöße.
- **Kanten:** Auto / Frei / Bündig (Nachbar/Brandwand).
- **Gesims unter Traufe (v2.0.508 / v2.0.580):** An bündigen Giebeln bleibt das Traufgesims, abgesenkt um `max(trim+2, Profil-Tiefe·tan+2)`. An Traufen mit Überstand bleibt es ebenfalls: Oberkante 1 cm unter der waagerechten Untersicht (`roofEaveCorniceDropCm`, Überstand×tan; Mansarde 11 cm, nicht Überstand×tan). Nicht die ganze Gesims-Logik löschen (507) und es nicht wieder an der Traufe ausblenden (575). Dach ein/aus baut Wände mit (`ROOF_WALL_TOP_TRIM_CM`), kein reiner Dach-only-Pfad.
- **Ziegel aus (MVP):** `ROOF_TILES_ENABLED = false` — immer glatte Dachhaut. Ziegel-UI und Ebenen-Zeile „Ziegel“ ausgeblendet; Farbe **Dachhaut** unter Dachform. Pipeline bleibt im Code für die nächste Stufe.
- **Zwerchgiebel:** An/Aus, Seite (Traufkante), Breite, Tiefe. Schneidet in die Dachhaut, eigenes Quersatteldach. Tiefe wird auf ≤ halbe Breite begrenzt (sonst unter der Haupthaut). **Nicht** Gaube/Dachfenster.
- **Dachfenster / Gauben (v2.0.477 / v2.0.478, realistisch ab v2.0.479, Bedienung v2.0.481–483, Ebenen v2.0.502/503):** Bei Dachwahl Bibliothek-Tabs **Dachfenster** und **Gauben**. Karte klicken → auf die Dachhaut klicken, oder Drag&Drop. Verschieben per Drag mit **8 cm-Raster** und **Hilfs-/Abstandslinien** (bis Boden / Dachende); rechte Leiste Gauben-Maße; bei Gaube mit Fenster die **volle Fenster-Toolbar**; Rechtsklick: Ein-/Ausblenden, Duplizieren links/rechts, Traufdurchbruch/Fenster (Gaube), Löschen. **Mehrfachauswahl** Ctrl/Cmd; in Ebenen **Shift+Bereich**. Daten an `RoofConfig.skylights` / `dormers` (nicht `Wall.openings`).

### Gauben-Bedienung (v2.0.479)

Rechte Leiste, in dieser Reihenfolge:

| Gruppe | Felder | Sichtbar |
|---|---|---|
| Maße | Breite, Front (Wandhöhe über der Dachhaut), Tiefe, Überstand, Wandstärke | Tiefe nur bei Fledermaus/Dachreiter oder wenn das Gaubendach die Haupthaut nicht mehr erreicht (Rückwand) |
| Form | Gaubenform, Neigung, Bogenstich, Wangenneigung | Neigung nur bei `roofDormerUsesPitch`, Bogenstich nur Tonne, Wangenneigung nur Trapez |
| Position | Abstand Traufe, Seitlich (Lauf auf der Traufkante), Traufdurchbruch | Abstand entfällt bei Traufdurchbruch; Durchbruch nicht bei Fledermaus/Dachreiter |
| Fenster | Fenster an/aus, Breite, Höhe, Brüstung, Seitlich | Felder nur bei eingeschaltetem Fenster |

- **Tiefe ist meist abgeleitet:** die Gaube endet in der **Kehle**, wo ihr Dach die Haupthaut trifft — aus Fronthöhe, Gauben- und Hauptdachneigung (**v2.0.486:** Suche nicht an gespeichertem `depthCm` abschneiden). Nur wenn sie die Haut gar nicht mehr erreicht (z. B. Schleppgaube steiler als das Hauptdach), begrenzt `depthCm` und es entsteht eine Rückwand.
- **Fenster = normale Öffnung:** `createOpening` liefert den vollen Feldkatalog (Gründerzeit-Teilung, Glas, Laibung, Bank); beim Platzieren erbt es über `donorWalls` den Stil der vorhandenen Hausfenster. Gebaut mit `createGruenderzeitWindowMesh` wie an der Wand; **Laibung** zusätzlich über `createStudioOpeningRevealGeometry` auf der Gaubenfront (v2.0.484). Die Öffnung wird in die Frontwand eingepasst (Wangen-Abstand, Mindestbrüstung, Abstand zur Gaubenhaut).
- **Traufdurchbruch:** Front rückt auf die Außenwandlinie, Unterkante auf Traufhöhe (zwerchhausartig). Dachhaut, Stirnbrett und Rinne sind im Gaubenbereich unterbrochen (`roofEaveCuts`).

### Formen

- **Giebelgaube:** Sattel + Stirngiebel über dem Gaubendach.
- **Walmdachgaube (mit Firstgrat):** First verkürzt, Stirn abgewalmt.
- **Walmdachgaube (ohne Firstgrat):** Walmspitze liegt auf der Kehle — kein Firstgrat.
- **Schleppgaube:** eine flachere Pultdachfläche, senkrechte Wangen.
- **Schleppgaube (schräg):** Pultfläche zusätzlich quer geneigt, eine Wange höher.
- **Trapezgaube:** Trapez-Grundriss, Wangen als geneigte Dachflächen (≥ 15°).
- **Spitzgaube:** dreieckige Stirn, zwei Dachflächen, kleines Fenster.
- **Tonnendach-Giebelgaube:** Bogen als Sehnen-Ebenen, Bogenstich einstellbar (Default Breite/4, Halbkreis bei Breite/2).
- **Fledermausgaube:** wellenförmiges Heightfield, keine senkrechten Wangen; Auslauf hangauf ≈ 0,9 × Breite.
- **Dachreiter:** kleiner Firstaufbau mit vier Wänden, Fenster vorn (nicht Zwerchgiebel).

**Nicht in dieser Liste:** der **Dachgiebel / Zwerchgiebel** — der sitzt auf der Traufkante und bleibt `RoofConfig.crossGables`.
- Mansarde: Untere/Obere Neigung, Firsthöhe (Knick 55 %).
- Sattel/Walm/Krüppelwalm/Pult: Neigung, Überstand, abgeleitete Firsthöhe, Firstrichtung/Hochseite, Giebelhöhe (Krüppelwalm), Giebelwand-Farbe.

## Daten

`Building.roof` (`RoofConfig`), Defaults/`normalizeRoof` in `src/studio/roof.ts`. Schema **22** (`roof-openings`).

| Feld | Default | Bedeutung |
|---|---|---|
| `kind` | `mansard` | Form |
| `pitch` / `ridgeDeg` / `halfHipHeight` | 45° / `null` / 120 | Nicht-Mansarde |
| `covering` | `smooth` | Gespeichert; wirksam immer glatt solange `ROOF_TILES_ENABLED` false |
| `edgeModes` | – | `free` / `flush` je `roofEdgeKey` |
| `crossGables` | `[]` | `{ edgeKey, widthCm, depthCm }` |
| `skylights` | `[]` | `{ id, x, z, widthCm, heightCm, hidden? }` Welt-XZ; `hidden` blendet Mesh/Loch aus (v2.0.481) |
| `dormers` | `[]` | `{ id, kind, x, z, widthCm, depthCm, heightCm, roofPitchDeg?, overhangCm?, wallThicknessCm?, riseCm?, cheekTiltDeg?, eaveBreak?, hidden?, window?, wallColor?, roofColor?, trimColor? }`. `kind`: `gable\|hip\|hipNoRidge\|shedStraight\|shedSkew\|shedTrapez\|pointed\|barrel\|bat\|turret`, alt `shed` → `shedStraight`. `x`/`z` = Welt-XZ der **Frontwand-Mitte** (seit v2.0.479; vorher Fußabdruck-Mitte). Defaults: Überstand 15, Wandstärke 20, Wangenneigung 20°. `hidden` blendet Mesh/Loch aus (v2.0.481). |
| `gableColor` / `tileColor` | Wandweiß / Ziegelrot | Füllwand / Dachhaut |
| … | | Mansarden- und Ziegel-Felder unverändert (für spätere Stufe) |

## Geometrie

### Traufe (v2.0.473 / v2.0.487 / v2.0.493 / v2.0.494 / v2.0.504 / v2.0.506)

`wallTopY = storeyTopY`. **v2.0.510:** Giebelfüllung bis zur Dachhaut (`planeY`). Eine vorstehende Stirn auf noch versetztem Überstand wurde eine Stufe — der Rand von **v2.0.576** liegt auf der Kante und ist nur die Plattenstärke. **v2.0.509:** Giebel ohne Wandkürzung; Füllung ab `wallTopY`; kein Kronendeckel auf der Giebelfassade. **v2.0.506 / 504:** `eaveY = wallTop + tv` — Ebenen am Wandring (`outer`); Soffit an der Wand = `eaveY − tv`. **Nicht** zusätzlich `− oh·tan` (v2.0.505). **v2.0.494:** Trauf-Wände um `ROOF_WALL_TOP_TRIM_CM` (6) kürzen.

### Ebenen-Envelope / Zwerchgiebel / Öffnungen

Nicht-Mansarden: untere Einhüllende von Dachebenen (`src/studio/roofForms.ts`). **v2.0.481:** Ebenen am **Außenwand-Ring** (First folgt der Gebäudebreite); Clip und Rinne am Traufpolygon (Überstand verlängert, hebt nicht). Traufkante = flach und niedrigste Kante. Zwerchgiebel: Fußabdruck auf Traufkante nach innen → Loch in Haupthaut → Sattel mit First nach innen; Frontgiebelwand. Tiefe `min(depth, width/2)`.

Dachfenster/Gauben: Fußabdruck über `roofSurfaceFrameAt` / `roofRectFootprint` (`src/studio/roofOpenings.ts`) → Löcher in der Haut (`extraHoles` an `buildRoofEnvelopeGeometry` bzw. Mansarden-Bänder) + Fixture-Meshes in `FacadeController.rebuildRoof`. Rebuild nur Dach (`forceRoofOnlyIds`). **v2.0.482/485:** Verschieben/Platzieren snappen über `snapRoofFixturePlacement` (Trauf-`alongCm` + `distanceCm`, 8 cm); Hilfslinien `computeRoofFixtureGuides` → `FacadeController.setRoofFixtureGuides` (Boden unter Gaubenkante, Trauf-u-Vorzeichen); Pfeiltasten likewise.

### Gauben-Engine (v2.0.479)

Lokales System an der Frontwand-Mitte auf der Dachhaut: `u` quer (Betrachter-rechts), `v` hangaufwärts, `y` Welt-Höhe; Hauptdach `g(v) = y0 + tanM·v`. Jede geneigte Gaubenfläche ist eine Ebene `y = a·u + b·v + c`, die Gaubenhaut ist das **Minimum** aller Ebenen (wie `roofForms` beim Hauptdach). Flächen = Bounding-Rechteck ∩ {P_i ≤ P_j} ∩ {P_i ≥ g}; die **Kehle** ist die Linie `P_i = g`. Loch in der Haupthaut = Innen-Rechteck ∩ ⋂{P_i ≥ g + τ} (bleibt konvex). Tonne = Sehnen-Ebenen des Bogens, Fledermaus ein Heightfield, Dachreiter vier Wände auf dem First.

Senkrechte Bauteile (Front, Wangen, Rückwand) werden als (s, y)-Profile entlang `v = 0`, `u = ±W/2`, `v = D` abgetastet und mit der Wandstärke extrudiert. Position relativ zur Traufe: `dormerEavePlacement` schießt einen Strahl gegen `v` auf das Traufpolygon (Abstand + Lauf auf der Kante), `dormerAnchorForEavePlacement` rechnet zurück (iterativ, weil `v` von der getroffenen Fläche abhängt).

## Fallstricke

- Traufe: Wandkörper unter **Traufe** kürzen (`ROOF_WALL_TOP_TRIM_CM` 6, v2.0.494); **nicht** am Giebel (v2.0.509). Giebelfüllung bis **Dachhaut**, aber 0,4 cm in der Wand (`ROOF_FILL_ONWALL_INSET_CM`, v2.0.579) — auf der Kante flackert die Schräge (Pult). Plattenrand auch auf der Wand, nur die Stärke; kein vorstehendes weißes Brett (Linie v2.0.510). Stirnseiten behalten Überstand 0, solange `mode === 'flush'`. `flush` allein (nackte Wand, Stirnmaske) schaltet die Rinne nicht aus (v2.0.579). Firstrichtungswechsel muss `edgeModes` neu setzen, sonst bleibt die alte Traufe. Rinne nicht wieder als Kasten mit Abstand unter die Kante hängen. Oberkante nicht wieder auf die Untersicht legen (`tipY − tv` bzw. Mansarde `eaveY − 10`, v2.0.582). Rinneneisen nicht auf die Rinne oder über die Dachhaut legen (0,4 cm Luft, Lasche ab der Dachkante, v2.0.581 / v2.0.582). Schwanenhals nur an der Traufwand; den kurzen Stutzen auf der Rohrachse nicht zurückholen. **Kastentraufe (v2.0.575 / v2.0.579)** auf echten Traufen mit geometrischem Überstand (Wand→Spitze ≥ 1 cm). Untersicht und Stirnbrett an der **senkrechten** Spitze, nicht an der Gehrung. Endkappe in der Wandebene nur bis auf die Dachhaut und nur wenn der Nachbar nicht übersteht; sonst schneidet sie die Platte. Eckstück waagerecht, sobald der Nachbar vor der Wand steht. Explizit bündig (`mode === 'flush'`) hat Überstand 0 und keine Untersicht. Untersicht im Giebel-Sink (Wandfarbe), Höhe = Dachunterkante an der Spitze. Gesims an der Traufe nicht weglassen: Oberkante 1 cm unter der Untersicht (`roofEaveCorniceDropCm`). Plattenrand nicht über die Wandecke in die Gehrung ziehen (v2.0.580, Schachbrett mit der Endkappe). Mansardenstirn nicht über die Lauflänge als lotrecht erkennen (`run < 1` verfehlt die Stirn, Unterseite liegt dann auf der Außenhaut); Seitenrand nicht in die Stirnebene legen. Traufhöhe nicht wieder mit Clearance/Embed/`oh·tan` anheben (487–506). **Firstrichtung** für Mansarde und Walm nicht wieder ausblenden — `ridgeDeg` dreht die Stirnkanten (`ridgeEndEdgeMask`). Pult bleibt Hochseite. Mansarden-Stirnbrett nicht wieder auf die Dachkante legen. Rinnenring nicht wieder ohne letzte Kante bauen; Endkappe nicht nur über die Blechstärke.
- Gauben-Auswahl: kein Opening-Overlay für virtuelle Wand `__rdw:…` (liegt bei Ursprung → Kasten am Boden, v2.0.487).
- Ziegel-Flag nicht ohne Absprache wieder auf true — Performance (~10⁵ Vertices).
- Ruckeln im Idle nach Dach-Arbeit war **nicht** die glatte Dachhaut (v2.0.474: Wind → `liveMotion`).
- Zwerchgiebel-Tiefe > Breite/2 bei gleicher Neigung → Quergiebel unter der Haut (intern geclampt).
- **Gauben ≠ Zwerchgiebel.** Gaube sitzt auf der Schräge; Zwerchgiebel („Dachgiebel“) an der Traufkante. Dachreiter sitzt auf der Firstlinie, bleibt aber eine Gaube (`dormers`), kein `crossGables`.
- **Gaubenwände enden an der Dach-Unterseite** (`topAt − DORMER_ROOF_THICKNESS_CM`). Auf `topAt` hochgezogen liegen Wandoberkante und Dachfläche deckungsgleich → Z-Fighting-Streifen auf Gaubendach und Wangen (v2.0.479). Gilt auch für die Dachreiter-Wände.
- **Gaubentiefe nicht „festnageln“:** außer bei Fledermaus/Dachreiter ergibt sie sich aus der Kehle. Ein fester Wert erzeugt entweder eine Rückwand oder eine Gaube, die unter der Haupthaut verschwindet. **v2.0.486:** Kehlen-Suche nicht an `depthCm` abschneiden (Bibliothek 120 cm → stumpfe Rückwand, Dachziegel durchs Fenster).
- **Gaubenfenster im Frontprofil:** Spitz/Trapez/Fledermaus ohne senkrechte Wangen — Fenster und `ExtrudeGeometry`-Loch müssen unter `topAt` liegen, sonst bricht die Front (v2.0.486).
- Fledermaus-Auslauf hängt an der Breite (0,9 ×). Mit dem generischen Default 400 cm wurde die Welle zur flachen Rampe.
- Keine Auswahl durch Fassaden: Dachhaut nur wenn `roofBeatsFacadeMesh`. **Gauben/Dachfenster** (v2.0.481): Plane-Filter der Fassade gilt nicht (Dach liegt hinter der Wandebene); Ablehnung nur bei näherem Fassaden-**Mesh**.
- Traufüberstand nicht wieder an den Ebenen-Anker koppeln — sonst hebt sich der First mit (v2.0.481).
- Circular Import vermeiden: Löcher werden in `FacadeController` berechnet und an `buildMansardRoof(..., openingHoles)` übergeben — `roof.ts` importiert nicht `roofOpenings.ts`.
- **Hilfslinien nicht an der Traufe zum Boden fallen lassen** — Boden-Fuß muss dieselbe XZ wie die Gaubenkante haben, sonst wirken die Linien in 3D seitlich versetzt (v2.0.485). Trauf-along → `frame.u` mit Vorzeichen (`frame.u · eaveDir` oft −1).

## Prüfen

- `npx vitest run src/studio/roofForms.test.ts` — Envelope, Traufüberstand ohne First-Anhebung, isEave
- `npx vitest run src/studio/roofOpenings.test.ts` — Formen, Kehle, Löcher, Traufdurchbruch, Fenster-Fit, Traufposition.
- `npx vitest run src/studio/roofFixtureGuides.test.ts` — 8‑cm-Snap Trauf-along/distance; Boden-Fuß unter Gaubenkante (v2.0.485).
- `node scripts/verify-dormers.mjs` (Dev-Server läuft, `E2E_URL` setzen) — App startet fehlerfrei, alle Felder der rechten Leiste da, Formliste vollständig.
- Für die Optik half ein Offline-Raster der Geometrie (three + pngjs, eigener Z-Buffer) statt des IDE-Browsers; so fielen die Z-Fighting-Streifen auf.

## Roadmap

1. Formen + bündige Kanten + Zwerchgiebel (v2.0.472/473) ✓
2. Direktwahl + Dachfenster + acht Gaubenformen (v2.0.477/478) ✓
3. Gauben mit echter Konstruktion, Maßen, Traufposition und Fensterlogik (v2.0.479) ✓
4. Gauben-Auswahl/Verschieben, Traufüberstand ohne First-Anhebung, Rechtsklick (v2.0.481) ✓
5. Gauben-Drag 8 cm + Hilfslinien auf der Schräge (v2.0.482) ✓
6. Hilfslinien bis Boden/Dachende, Pfeilrichtung, volle Fenster-UI an Gaube (v2.0.483) ✓
7. Hilfslinien an Gaubenkante ausgerichtet, nicht seitlich versetzt (v2.0.485) ✓
8. Gauben bis Kehle + Dachöffnung; Spitz/Trapez/Fledermaus-Fenster (v2.0.486) ✓
9. Eindeckung / Ziegel auf allen Formen
10. Straight-Skeleton für Walm auf L/U
