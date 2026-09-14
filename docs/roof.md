# Dach (Mansarde, Sattel, Walm, Krüppelwalm, Pult)

Dach auf dem **primären Nesting-Outer** der obersten Etage (`planFacesWithHoles` / `topRoofFaceWorld` — Höfe sind Löcher, nicht eigene Outer). Seit **v2.0.472** ein Dachkonfigurator mit mehreren Formen; die Berliner Mansarde bleibt die einzige Form mit Ziegel-Geometrie (MVP „Formen zuerst, Eindeckung danach“).

## Verhalten

- Linke Sidebar **Ebenen**: ohne Dach → Button **Dach hinzufügen**; mit Dach → Zeile mit dem Formnamen (`ROOF_KIND_LABELS`). Klick wählt Dach (`EditorState.selectedRoofBuildingId`), Einstellungen in der **rechten Toolbar** (`#toolbar-roof`). Kontextmenü: **Ausblenden** (`roof.hidden`) und **Löschen** (`enabled: false`).
- Nur aktiv, wenn die oberste Etage einen geschlossenen Ring hat (`planHasClosedRing`).
- **Dachform** (`#roof-kind`): Berliner Mansarde · Satteldach · Walmdach · Krüppelwalm · Pultdach.
- **Kanten** (Sektion „Kanten“, eine Zeile je Traufkante mit Kompass + Länge): **Auto** (Bestand: Wand ohne Paneele → bündig) · **Frei** (Überstand + Rinne) · **Bündig** (kein Überstand, keine Rinne — Nachbardach/Brandwand). Beim **Walm/Krüppelwalm** liefert eine bündige Kante keine Dachebene → die Fläche endet dort **senkrecht** (Giebel an der Wandlinie).
- **Eindeckung** (`#roof-covering`): Ziegel (nur Mansarde) oder Glatt. Bei anderen Formen ist das Select gesperrt und ein Hinweis erscheint; die gespeicherte Wahl bleibt erhalten (Rückwechsel zur Mansarde bringt die Ziegel zurück). Ziegel-Sektion und Ebenen-Zeile „Ziegel“ nur bei wirksamer Ziegel-Eindeckung (`roofEffectiveCovering`).
- **Mansarde:** Untere/Obere Neigung, Firsthöhe; Mansarden-Knick fest bei **55 %** von `ridgeHeight`. Trapez nur für die **Ziegel** (`tileTaper` / `tileTaperDepth`).
- **Sattel/Walm/Krüppelwalm/Pult:** **Neigung (°)**, **Traufüberstand**, abgeleitete **Firsthöhe** (read-only), **Firstrichtung** (Sattel/Krüppelwalm: Auto = längste Traufkante, O–W, N–S, NW–SO, NO–SW) bzw. **Hochseite** (Pult: Auto = gegenüber der längsten Traufe, 8 Kompassrichtungen), **Giebelhöhe bis Walm** (nur Krüppelwalm), Farbe **Giebelwand**.
- Formwechsel setzt die Neigung nur dann neu, wenn sie noch auf dem Default der vorigen Form stand (Steildächer 45°, Pult 15°).
- In **Zeichnung**: Dach weiß + Kantenlinien (wie übrige Szene).
- Noch **ohne** Gauben, Dachfenster und Zwerchgiebel (nächste Stufen, siehe Roadmap unten).

## Daten

`Building.roof` (`RoofConfig` in `src/types/facade.ts`), Defaults/`normalizeRoof` in `src/studio/roof.ts`. Alt-Saves ohne neue Felder werden über `normalizeRoof` hydriert (kein Schema-Step nötig — rein additive Defaults). UI und `facadeHasRoofablePlan` beziehen sich auf das **aktive Gebäude**; `buildMansardRoof` (Name historisch) baut pro sichtbarem Gebäude alle Formen.

| Feld | Default | Bedeutung |
|---|---|---|
| `enabled` | `false` | Dach anzeigen |
| `hidden` | `false` | Dach temporär ausblenden (Ebenen-Dimmen, kein 3D-Mesh) |
| `kind` | `mansard` | `mansard` \| `gable` \| `hip` \| `halfHip` \| `shed` |
| `pitch` | 45° | Neigung für alle Nicht-Mansarden (10…75) |
| `ridgeDeg` | `null` | Firstachse (Wand-Yaw, 45er-Raster; Sattel/Krüppelwalm mod 180) bzw. Pult-Hochseite; `null` = automatisch |
| `halfHipHeight` | 120 cm | Krüppelwalm: Giebelwand über Traufe bis Walmansatz (0…400, 8er) |
| `covering` | `tiles` | Gespeicherte Eindeckung; wirksam nur bei Mansarde (`roofEffectiveCovering`) |
| `edgeModes` | – | `Record<edgeKey, 'free' \| 'flush'>`; fehlend = `auto`. Key = `roofEdgeKey` (Kantenmittelpunkt cm-gerundet `"mx:mz"`) |
| `gableColor` | Wandweiß | Giebel-/Füllwände über der Traufe |
| `pitchLower` | 70° | Steiler unterer Mansardenmantel |
| `pitchUpper` | 30° | Flacherer oberer Mantel |
| `overhang` | 40 cm | Traufüberstand an **freien** Kanten |
| `ridgeHeight` | 280 cm | Mansarde: Höhe Traufe → First |
| `tileColor` | `#8b3a2a` | Ziegel- bzw. Dachhautfarbe (auch glatt) |
| `gutter` | `true` | Dachrinne (nur freie Traufkanten) |
| `gutterColor` | `#8E8A88` | Rinnenfarbe (Titanzink Default; andere Farben als Lack, v2.0.408) |
| `tileWidth` / `tileHeight` | 32 / 24 cm | Sichtmaß (8-cm-Raster) |
| `tileJoint` | 0,8 cm | Fuge |
| `tilePattern` | `runningBond` | wie Paneel-Muster (`strip`, `runningBond`, …) |
| `tileProfile` | `pantile` | `barrel` (gewölbt) oder `pantile` (S-Schwung) |
| `tileProjectDepth` | 3 cm | Ziegeldicke / Vorstand |
| `tileTaper` | 0,85 | Vorder/Rück (0…1), Zugespitztheit |
| `tileTaperDepth` | 1,5 cm | Trapezhöhe auf der Ziegelfront |

Persistenz über Facade-JSON / URL-Hash (`cloneFacadeState`, `cloneRoof` spreadet alle Felder).

## Geometrie

### Traufe / bündige Seiten (alle Formen)

Pro Outer-Kante (`listRoofEdges`): zugehörige Studio-Wand der obersten Etage (`findWallForEdge`: Endpunkte ±16 cm oder parallel + Mittelpunkt ≤28 cm). Wirksam bündig = Modus `flush`, oder `auto` und Wand ohne Paneele (`wallIsBareForRoof`). Bündig → Kanten-Überstand **0**, keine Rinne. Offset über `offsetPolygonPerEdge`. Der Ring wird zuerst **CCW orientiert** (`orientRingCcw`) — Indizes von Kanten, Modi und Überstand beziehen sich darauf.

### Ebenen-Envelope (`src/studio/roofForms.ts`)

Jede Dachfläche ist eine Ebene `y = a·x + b·z + c`; das Dach ist die **untere Einhüllende** aller Ebenen über dem Traufpolygon. Fläche einer Ebene P = Traufpolygon ∩ {P ≤ Q ∀ Q} (Sutherland–Hodgman je Halbebene).

| Form | Ebenen |
|---|---|
| Sattel | 2 Ebenen quer zur Firstachse (Spannweite aus Projektion des Traufpolygons) |
| Walm | eine Ebene je **freier** Traufkante, steigt nach innen — für konvexe Ringe = Straight Skeleton |
| Krüppelwalm | Sattel + je Firstende eine Ebene ab `eaveY + halfHipHeight` (Ende bündig → keine Endebene → voller Giebel) |
| Pult | eine Ebene, steigt zur Hochseite |

Sattel/Pult sind Prismen (Höhe hängt nur von einer Achse ab) und funktionieren auf **jedem** Polygon inkl. 45°-Knicken. Walm ist auf **konvexen** Ringen exakt; auf L/U-Grundrissen bleibt die Fläche geschlossen, entspricht aber nicht der Kehlen-Konstruktion eines echten Skeletons (später eigener Kernel). Löcher (Höfe) werden bei Nicht-Mansarden **überdacht**.

Geometrie (`buildRoofEnvelopeGeometry`): Platte mit `ROOF_SLAB_THICKNESS_CM` **10** (vertikal `tv = 10 / cos Neigung`), Oberseite + Unterseite + Stirn nur an Traufkanten (innere Grate/Kehlen teilen sich Nachbarflächen). Bündige Kanten: Stirn nur oberhalb `eaveY` (Rest liegt im Wandkörper — kein Z-Fight). **Füllwände** (Giebel / Traufschluss) auf der **Wandlinie** von `eaveY` bis Plattenunterseite, exakt entlang der Einhüllenden (`envelopeAlongSegment`: Knickpunkte = paarweise Ebenenschnitte). Rinne an Kanten, die auf ganzer Länge auf Traufhöhe liegen (`isEave`) und nicht bündig sind; Rinnen-Oberkante direkt unter der Plattenkante (`gutterEaveY = eaveY − tv + 4`).

Für spätere Gauben/Dachfenster: `roofEnvelopeForBuilding`, `roofEnvelopeHeightAt`, `roofEnvelopePlaneAt`.

### Mansarde (Bestand)

Jede Mansarden-Facette (unteres/oberes Band je Outer-Kante) als UV-Fläche (u entlang Traufe, v hangaufwärts). Ziegel-Layout via `layoutPanelTiles` mit Fake-Wand und Dach-Tile-Config, eine `BufferGeometry`; Profile **barrel** (abwechselnd konvex/konkav) / **pantile** (S-Querschnitt); optional Trapez-Frustum; First: flache Kappe (Earcut) + Barrel-Firstziegel-Reihe. Eindeckung **glatt** → Bänder als Quads, keine Firstziegel, Kappe bleibt.

### Rinne

Geschlossenes U-/Kastenprofil (Boden + Außen + Innenlippe), Sweep entlang aktiver Traufkanten mit **Gehrung** an Ecken (`miterOutward`). An Übergängen zu bündigen Seiten: **Endkappen**. Farbe: `roof.gutterColor`. Anschluss an Fallrohre: [downpipes.md](downpipes.md).

## Datenfluss

```
floors[top] → planFacesWithHoles → Outer (+ Hof-Löcher) → orientRingCcw
  → listRoofEdges (Kompass, Wand, Modus auto/free/flush → flush[])
  → offsetPolygonPerEdge (bündig = 0)
  → kind = mansard: Mantel unten/oben (Knick 55 %) → Ziegel oder glatt → Kappe → Rinne
  → sonst: buildRoofPlanes → envelopeFaces → Platte + Füllwände → Rinne (isEave ∧ ¬flush)
  → FacadeController.rebuildRoof → roofGroup (tiles | shell (Giebel) | gutter)
```

## Dateien

| Datei | Rolle |
|---|---|
| `src/studio/roof.ts` | Defaults, Normalize, Kanten-Modell, Offset, Mansarde, Rinne, Dispatch |
| `src/studio/roofForms.ts` | Ebenen-Envelope, Platte, Füllwände, Kompass/Kanten-Keys |
| `src/studio/roofForms.test.ts` | Rechteck/45°, bündige Kanten, Krüppelwalm, Pult, Normalize |
| `src/studio/panelLayout.ts` | `layoutPanelTiles` für Mansarden-Ziegel |
| `src/studio/floorPlan.ts` | `planFacesWithHoles` |
| `src/FacadeController.ts` | `rebuildRoof`, `roofGroup`, Giebel-Mesh (`roofPart: 'shell'`) |
| `src/types/facade.ts` | `RoofConfig`, `RoofKind`, `RoofCovering`, `RoofEdgeMode` |
| `src/main.ts` / `index.html` | Toolbar `#toolbar-roof`, Kantenliste `#roof-edge-list`, Ebenen-Zeile |

## Fallstricke

- Traufhöhe = `floors.length × wallHeight` (Oberkante oberstes Geschoss).
- Plan-Knoten = Wandaußenlinie; Überstand nur an freien Kanten weiter nach außen.
- **`isEave` nicht nur an den Endpunkten prüfen** — Ecken liegen auch an Giebelkanten auf Traufhöhe, der First sitzt in der Mitte. Ganzes Profil (`envelopeAlongSegment`) prüfen, sonst bekommen Giebelseiten eine Rinne (v2.0.472, erster Versuch).
- **Krüppelwalm ändert nicht die Firsthöhe**, nur die Firstlänge — Endebenen kappen die Firstenden.
- Kanten-Key hängt am Kantenmittelpunkt: Grundriss verschieben → Modi verfallen auf `auto` (bewusst, keine Wand-IDs nötig).
- Ring **vor** dem Ableiten von Indizes orientieren; im Envelope nicht mehr drehen (sonst `flush[]` verdreht).
- Pult mit 45° auf 12 m Tiefe = 12 m First — daher Default 15° beim Formwechsel.
- Zu hohe Firsthöhe / steile Neigung auf schmalen Grundrissen schrumpft den Mansarden-First stark.
- Schwerpunkt-Fan für die Firstkappe würde bei U/L/Hof den Innenraum füllen — deshalb Earcut.
- Viele kleine Ziegel → eine Geometry; extreme Raster/Grundrisse können die Vertexzahl hochtreiben.

## Roadmap (abgestimmt 2026-09-14)

1. **Formen ohne Ziegel** (diese Version) — Formcheck auf 45°-Grundrissen und mit bündigen Seiten.
2. **Zwerchgiebel**: Fassadengiebel als Dach-Cut (Formkatalog wie Bogenformen, Clip gegen Envelope/Mansarde).
3. **Eindeckung** auf allen Formen: Ziegel-Asset mit Deckmaß/Überdeckung statt Mauerverband, Profil-Upload (Querschnitt + Dicke), First-/Ortgangziegel getrennt; Instancing + LOD.
4. **Gauben und Dachfenster** als Dach-Objekte auf `roofEnvelopePlaneAt`.
5. Echter Straight-Skeleton-Kernel für Walm auf L/U/Hof.
