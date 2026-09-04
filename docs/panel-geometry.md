# Paneel-Geometrie – Technische Dokumentation

## Übersicht

`src/studio/panelGeometry.ts` erzeugt die 3D-Geometrie der Studio-Wände und ihrer Paneelverkleidungen. Jede Wand besteht aus:

1. **Wandkörper** — einfacher Quader mit Gehrungsschnitt an den Enden
2. **Paneele** — trapezförmige Platten, die auf der Wand montiert sind und an Ecken ebenfalls mit Gehrung versehen werden

---

## Öffnungen und Reststeine

`cornerJoin: 'none'` ist stumpf nur an **freien** Wandenden. Wo eine andere Wand andockt — auch ohne eigenes Mauerwerk — bleibt die Gehrung. **v0.7.281:** Forced-Ends nur an **45°-Knicken** (komplementär 0,5/1). Front-Layout (`mapFrontCutsToPlan`) nur wenn die sichtbare Front **länger** ist als der Plan (Innen-Origin); an der Außenkante bleibt das Raster auf `wall.width` — auch wenn `projectDepth` die Paneelfront an der Gehrung leicht verkürzt. **v0.7.280:** Load-Fit wie 73dbdc9 — Origin auf der Außenecke, Außenlinie in Planrichtung (kein 40-cm-Stummel). **v0.7.279:** Verknüpfte Wände mit Origin innen (`panelFlip: false`) werden beim Laden auf die Außenkante gelegt. **v0.7.278:** Raster auf der sichtbaren Außenfront; Steine dürfen `wallX < 0` (Keil vor der Plan-Kante). Feld und Öffnungen ungehrt. Der Clip an der Laibung bleibt am Öffnungsmaß.

Aktueller Ablauf:

1. `layoutPanelTiles()` erzeugt das Grundraster (`panelWidth` × `panelHeight`, Fuge).
2. **`strip`:** eine durchgehende Bahn über die volle Wandbreite je Reihe.
3. **`hideRowsBottom` / `hideRowsTop`:** ganzzahlige Anzahl Schichten ohne Steine/Mörtel von unten bzw. oben — nur Paneele/Mörtel ausgeblendet, der Wandkörper (Außenfläche) bleibt in der 3D-Ansicht sichtbar. **v2.0.54:** Außenfläche zeigt nach außen (`wallFaceNormalReverse`) — sonst ist der Freistreifen ein Loch. In der **Zeichnung** werden Kanten des Wandkörpers bei aktiven Paneelen weggelassen, damit Streifen nicht doppelt konturiert sind. **v0.7.294:** dieselbe Logik für Laibung (`skipLineEdges`) — Öffnungskontur besitzen Steine, kein Bogen-Reißverschluss am Kellerfenster. **v0.7.297:** SVG-Sockel als Sweep minus Öffnungsvolumen (gleiche Kontur wie die Wand, keine Sturz-Treppe).
4. `splitTilesAtOpenings()` ist Pass-Through.
4. `snapHoleToTileGrid()`: Y nur auffressen wenn Reststreifen < `MIN_PANEL_REMNANT` (sonst bleiben Steine über/unter Rechteckfenstern). Bei aktivem Freiraum kein Y-Snap. **X bleibt am Öffnungsmaß** (geschnittene Köpfe/Läufer an der Laibung). Zusätzlich wird immer das echte Öffnungsrechteck abgezogen. `sealTilesToOpeningJambs` zieht Steine, die vor der Laibung enden, bis an die Kante. **v2.0.94:** Zeilen, die nur Sturz/Sohlbank anschneiden, werden im Layout nicht als Laibungs-Blocker behandelt — Mittelsteine wie bei der Bogenkappe legen und clippen.
5. `clipTileAgainstHoles()` stanzt dieses Rechteck. Keine Merge-/Drop-Hacks.
6. `extrudeFrustum()` wenn `taperDepth > 0` (**Bossensteine** / Bossenprofil in der UI). **Isotroper** Kantenrücksprung: `min(panelWidth, panelHeight) / 2 × (1 − taper)`, auf Kachelgröße geclampt — gleiche Maße an allen vier Seiten (v0.5.0). Zugeschnittene Steine / Zwickel: Boss = **paralleler Einzug der Restkontur** (`remnantBossOuter` + `extrudeInsetRingFrustum`, v0.7.89) — nie Source-Diamant aus dem Originalfeld. Keilsteine: konzentrischer Polar-Boss (`extrudePolarFrustum`).
7. Wandkörper und Leibung bleiben am **exakten** Öffnungsmaß (kein Raster-Snap).
8. `cornerJoin === 'none'`: stumpf nur an **freien** Enden. `panelMiterEnds` gehrt, sobald eine Wand andockt (auch ohne Mauerwerk). Sockel: Nachbar muss selbst einen Sockel haben. **Sockelprofil-/Gesims-/Zierband-Sweep** (v0.7.220): `x += z × (−tan)` wie `wallLocalX`, vorzeichenbehafteter Knick. **Zierband-Löcher (v0.7.241):** `openingMaskXRangesAtY` — dieselbe Maske wie Paneele/Mauerwerk (inkl. Rundbogen), plus Aufweitung um Rahmenprofil.

**Läuferverband** (`runningBond`): Gerade Reihen `1/1/1…` mit Restbreite **nur am Ende** (v2.0.68 — vorher symmetrisch auf beide Enden → Drift zwischen 24er/48er); versetzte Reihen `0,5/1/…` ebenfalls Start exakt, Rest am Ende. Das Muster gilt **pro Wand**, auch wenn die Steinbreite die Wand- oder Nachbarlänge nicht teilt (v0.7.174). `⅓`/`¼`-Läufer nutzen die echte Endstückbreite, nicht nur ein ½-Raster. An **45°-Ecken** erzwingen `diagonalBondEndWidth` + `buildRunningBondWithForcedEnds` komplementäre Endsteine 0,5/1; das Feld dazwischen nur volle Läufer (kein zweiter Halbstein nach dem Forced-Start). **v0.7.296:** welche Wand den 0,5-Stein in geraden Lagen bekommt, hängt von **Yaw/Origin** ab — nicht von `wall.id`. Sonst kippt der Verband nach Etage duplizieren oder Stil kopieren (neue UUIDs), und die obere Etage wirkt wie ein anderes Raster. **v2.0.31:** Bossen-Einzug und Stirn entfallen an Plan-Kante und Rechteck-Laibung — sonst Reißverschluss in der Zeichnung (Halbstein vs. Vollstein). **v2.0.82:** An der Laibung keine Stummel schmaler als das Verbandmodul (½ Läufer): `absorbJambSlivers` nach `pierceWallCutsToField`.

**Modulraster & Felder (v2.0.61–v2.0.64):** `computeRowColCuts` legt das **Verbandmuster wandweit** (klassisch: Läufer `1/1/1…` bzw. versetzt `0,5/1/…/0,5` über `buildStretcherCuts` / `buildOffsetStretcherCuts`; 45°/Dock über `buildRunningBondWithForcedEnds`). `courseFields` liefert nur **Pfeiler** (nicht die Öffnung); `pierceWallCutsToField` schneidet das Raster an den Laibungen — innere Steine behalten die Sollbreite, Fugen fluchten über die ganze Wand. **v2.0.64:** 45°-Halbstein = exakt ½ des (gerasterten) Läufers — `snapMasonryCm(12)` → 16 entfällt, sonst Versatz ~⅓ und Drift der Feldsteinbreite. Bossen-Flush-Laibungen über die **volle** Öffnungshöhe inkl. Bogen. **v2.0.63:** Beim Zusammenführen der Feld-Cuts wird `field.x0` mitgeführt; Steine mit X-Überlappung zur Laibung entfallen (sonst Phantom-Steine durch die Öffnung). `sealTilesToOpeningJambs` nur ≤ `STUDIO_MASONRY` und nicht über `panelWidth`. Ecken-/Bogen-Clip: `extrudeMonotoneArcBoss` pinnt Laibungs-X über `pinInsetXToFlushPlanes`. **v2.0.62:** kein per-Feld-Dehnen mehr; Clip-Mindestbreite für Merge/Split gedeckelt.

**Öffnungen an Fugen (v2.0.66–v2.0.69, v2.0.73, v2.0.82):** `openingPanelSnap.ts` — Kandidaten **Fuge**, **Steinmitte**, **Wandmitte**. Raster = Verbandmodul (Läufer: ½ Stein), nicht 8 cm. Drag rastet immer; Breite so, dass beide Laibungen auf Fugen liegen. Bei Multi-Zone (`claddingZones` mit rect) Modul der Zone an Öffnungsmitte-Y. Alt-Saves: Schema 14. **Schichten (v2.0.70+):** [facade-layers.md](facade-layers.md) — Freiraum nur Verkleidung, Einbettung ohne Shell-Loch.

**Dock-Fuge (kollinear, v0.7.175):** `dockRowTileOpts` in `panelLayout.ts`. Zwei Binder-Köpfe (0,5+0,5): Kacheln bleiben in `[0, wall.width]`; `flattenDockStart`/`End` setzen den Bossen-Chamfer der Innenseiten auf 0 — visuell ein Stein, ohne Überstand in die Nachbarwand oder über Öffnungen. Zwei volle 1er: normale Fuge (`jointStart`/`jointEnd`) plus `keepBossChamfer*` — jedes Trapez bleibt vollständig. `extrudeFrustum` skaliert die Gehrung mit `projectDepth + taperDepth`.

### Muster (v0.4.0+)

Paneele: `strip`, `runningBond`. Mauerwerk: `headerBond`, `englishBond`, `englishCrossBond`, `wildBond`, `gothicBond`, `markishBond`, `dutchBond`, `silesianBond`, `flemishBond`, `runningBondThird`, `runningBondQuarter`, `runningBondDiagonal`. Gemischte Lagen über `buildMixedCourseCuts()` (Abbruch wenn kein Fortschritt am Wandende; Iterations-Cap). `buildCuts` bricht bei Schritt ≤ 0 / NaN ab. SVG-Vorschau: `patternPreview.ts` (gecacht via `clonePatternPreviewSvg`; Toolbar baut Karten nur bei Muster-/Maßwechsel neu).

#### Versatzregeln (v0.4.3, nach Wikipedia/BauNetz)

| Verband | Versatz zwischen Schichten |
| --- | --- |
| Läuferverband (mittler) | ½ Steinlänge |
| Läuferverband schleppend (⅓, ¼) | ⅓ bzw. ¼ Steinlänge |
| Kopfverband | ½ Binderbreite (Kopf) |
| Blockverband | Läufer-Stoßfugen senkrecht übereinander |
| Kreuzverband | jede 2. Läuferschicht um 1 Kopf (Verschiebekopf) |
| Gotischer / Märkischer / Schlesischer | jede 2. Schicht: ½ Binderbreite; Märkisch: 2 Läufer + 1 Kopf; Schlesisch: 3 Läufer + 1 Kopf |
| Flämischer | (½ Stein + ½ Kopf) = (S+H)/2 pro Schicht |
| Holländischer | 3 reine Kopflagen (mittige versetzt), dann Läufer-Kopf-Schicht |

Implementierung: `courseSpec()` / `resolveOffset()` / `courseEndWidth()` in `panelLayout.ts` (`halfStretcher`, `halfHeader`, `halfUnit`, `shiftHeader`, `third`, `quarter`).

---

## Koordinaten

```
         Außenseite (z = 0 bei panelFlip: true)
              |
              |←── projectDepth ──→|
              |                    |
   z = 0 ────┤────────────────────┤──── z = -projectDepth (Vorstand nach außen)
   (backZ)   |                    |     (frontZ)
              Wand-Tiefe (depth)
              |
   z = depth ┘  (Innenseite)
```

**Lokales Koordinatensystem der Wand:**
- X: entlang der Wand (0 = linkes Ende, `width` = rechtes Ende), zentriert bei der Gehrungsberechnung
- Y: Höhe (0 = Unterkante)
- Z: Tiefe — bei `panelFlip: true` (Grundriss-Wände): 0 = Außenseite, negativ = Vorstand; bei `panelFlip: false` (manuelle Wände): `depth` = Außenseite, größer = Vorstand

---

## Gehrung (Miter)

### Konzept

An jedem Wandende, das an eine andere Wand stößt, wird ein diagonaler Schnitt ausgeführt. Die Schnittebene hat 45° (bei rechtem Winkel). Der Versatz `miterStart`/`miterEnd` gibt an, wie weit das Wandende eingerückt wird (in cm entlang der Wand).

```
Draufsicht Außenecke (90°):

    Wand B
    │
    │◄── miterEnd (B)
    │
────┘◄── miterStart (A)
Wand A
```

Bei einer 90°-Ecke mit `depth = 32 cm`:
```
miter = 32 × tan(90° / 2) = 32 × tan(45°) = 32 cm
```

### `wallLocalX(wall, wallX, z, panelDepth?, panelBackZ?)`

Kernfunktion für die Gehrungsberechnung. Gibt den horizontal verschobenen X-Wert für einen Vertex zurück.

```ts
function wallLocalX(
  wall: Wall,
  wallX: number,    // Position auf der Wand (0…width)
  z: number,        // Tiefe (cm)
  panelDepth?: number,   // Paneeltiefe; wenn gesetzt: Miter auf Paneelmaß skaliert
  panelBackZ?: number,   // Rückseite der Paneelplatte; Nullpunkt für tOut
): number
```

**Paneel/Sockel und Wandkörper (v0.7.278):** Ungehrt `x = wallX − halfW`, Clamp auf die Gehrungsebenen:

```
tanStart = miterStart / wallDepth
x_start(z) = −halfW − z × tanStart
x = clamp(wallX − halfW, x_start, x_end)
```

90°-Außenecke: Front länger als der Plan. `panelLayout` legt 0,5/1 auf dieser Front; die Keilsteine liegen bei wallX < 0 (bzw. > width). Öffnungen im Feld auf Plan-X.

**Profile (Sockelprofil, Gesims, Zierband, v0.7.220):** `createProfileSweepGeometry`: `x += z × planMiter` mit `planMiter = −tan`. Load berechnet die Gehrung neu (`finalizeStudioGeometry` in der Load-Pipeline).

**v0.7.219:** `|z| × |tan|` (immer kürzer) schloss 90°, ließ 45°-Außenecken klaffen.

---

## Paneel-Extrusion

### `extrudeTrapezoidTile(rect, wall, panel, positions, normals, indices)`

Erzeugt ein einzelnes Paneel als 6-seitiges Mesh (5 sichtbare Seiten + Rückseite).

```
backZ ──────── frontZ
  ┌──────────────┐   ← top
  │     rect     │
  └──────────────┘   ← bottom

backZ: z-Position der Paneelrückseite (Wandaußenfläche)
       flip=true  → backZ = 0
       flip=false → backZ = wall.depth
       Kein separater „Luftspalt“ mehr — Tiefe pro Reihe über `rect.depth` / `projectDepth` bzw. `recessedProjectDepth`.

frontZ: z-Position der Steinfront (`bodyFrontZ`)
       flip=true  → frontZ = −projectDepth (bzw. −rect.depth)
       flip=false → frontZ = wall.depth + projectDepth
```

Die vier Eckpunkte in Z-Richtung:

| Punkt | wallX | z | tOut |
|---|---|---|---|
| `leftBack` | `rect.x` | `backZ` | 0 |
| `rightBack` | `rect.x + rect.width` | `backZ` | 0 |
| `leftFront` | `rect.x` | `frontZ` | 1 (Vorstand, Front kürzer) |
| `rightFront` | `rect.x + rect.width` | `frontZ` | 1 |

An Wandenden (`wallX ≈ 0` oder `≈ width`) gilt `offset = |z| × |miter| / depth` (Plan-Kante z = 0).

### Orientierung der Flächen (v2.0.119)

Konvention in Wand-XY (x rechts, y oben, `panelFlip` = true): **Front = −z**. `addQuad(a, b, c, d)` mit CCW gelisteten Ecken liefert Dreiecke `(a, d, c)`, `(a, c, b)` — also −z. Umriss-Reste (`outline`, Bogen-/Keilstein-/Fächer-Polys, Bossen-Firste, Zwickel) laufen über `triangulateOutlineRing(outline, { front: true })`: Earcut (`ShapeUtils.triangulateShape`) gibt **immer CCW (+z)** zurück, unabhängig von der Umriss-Richtung; `front: true` dreht jedes Dreieck. Vor Seitenquads `(back_i, back_j, front_j, front_i)` wird der Ring mit `ringCcw` normiert, damit die Seiten nach außen zeigen. Gilt für `extrudeOutlinePoly` (Steine + Mörtel), `extrudeSpandrelStrip`, `fillRingFront` (Bossen-First-Flächen) und die Flat-Vorschau `addWorkFaceOutlinePoly`. Ohne diese Drehung standen die Rest-Steine mit Rückseite nach vorn: `DoubleSide` zeichnet sie zwar, aber `shadowSide: FrontSide` warf sie aus der Shadow-Map — kein Schatten, kein Selbstschatten, heller als das Feld (siehe [shadows.md](shadows.md)). Test: `panelGeometry.test.ts` › „Rest-Steine an Öffnungen“.

---

## Verband-Ecken (Mauerwerk)

Bei `cornerJoin === 'bond'` greift ein Stein in Läuferlagen um die Ecke (90°). An **45°-Ecken** sind die Endkacheln komplementär **0,5 und 1** auf der Front (`planWidthForFrontTarget`). Raster ab x=0 bis zur Ecke. Das **Feld** bleibt Läuferverband und ungeshert.

```
Draufsicht (Mauerverband-Ecke):

Wand B:
──────────────╔════════╗
              ║  Stein ║ ← Breite = bondCornerW = ceil(projectDepth / 8) × 8
              ║        ║
Wand A:       ╚════════╝ → greift in Wand-B-Richtung um projectDepth
──────────────
```

---

## Wandkörper-Geometrie

`createStudioWallGeometry(wall)` erzeugt den Wandkörper (ohne Paneele). Dieser nutzt `wallLocalX` **ohne** `panelDepth`/`panelBackZ` — `t` von der Außenkante zur Innenkante, Innenkante gekürzt. Zwei Material-Gruppen: **0** Außenfläche, Stirnseiten, Ober-/Unterkante (`wallColor`); **1** Innenwandfläche (`interiorColor`, Default Weiß).

**Dicke-Kappen (v2.0.139):** Top, Start-/End-Stirn und Unterseite mit `addThicknessCapQuad`. Vertex-Order ist für `panelFlip: true` (`outerZ < innerZ`) ausgelegt; bei `panelFlip: false` wird die Windung umgekehrt — sonst cullt `FrontSide` Deckel und Stirn (Wand wirkt oben/seitlich offen). Keine doppelten coplanaren Tris (Z-Fight). Gleiches für `createArcBayWallGeometry`.

**Bogenkappe / Distanz-Zacken (v2.0.166):** Clip liefert weiterhin feine `bottomArc`/`topArc` (~128). Die **sichtbare Front** (Stein, Mörtel, Flat/Arbeit, Bossen-Ring) wird nicht mehr als Spalten-Quads extrudiert, sondern als ein Earcut-Polygon (`arcCapFrontRing`, max. 24 Stützpunkte via `sparsePolyline`). Soffit unter der Kurve bleibt segmentiert (~48). Sonst entstehen beim Rauszoomen vertikale dunkle Zacken (Tiefenpuffer zwischen Spaltennähten und langen Dreiecken bis zur Bandoberkante) — verwandt mit v2.0.158, aber vertikal.

Öffnungen werden durch `subtractRect` aus den Außen-/Innenflächen herausgeschnitten. Die **Leibung** liegt in `createStudioOpeningRevealGeometry` (pro Öffnung; **v0.7.247:** Außenhälfte `wall.wallColor`, Innenhälfte `wall.interiorColor`, zwei Material-Gruppen in `FacadeController.rebuildReveals`) und spannt von `studioOpeningRevealInnerZ` (= `studioWallInnerLocalZ`, v0.7.193) bis `studioOpeningRevealOuterZ` — je Maskenkante zwei Quads (Außen-/Innenhälfte, v0.7.239 ohne Lippe/Soffit). Mit Freiraum endet sie an der Vertiefungskante (`studioClearanceRecessZ`) plus nur `REVEAL_CLEARANCE_INSET_CM` (0,12 cm, v2.0.117 — früher 0,6 cm ließ eine Lichtspalte). Freiraum-Kappe empfängt Schatten. **v0.7.292 / v2.0.115:** Mit Paneelen (ohne Freiraum) sitzt `revealOuterZ` `REVEAL_OUTER_INSET_CM` (0,6 cm) hinter der Paneelfront — Steine besitzen die Lochkante. Studio-Fenster/Türen werden 1,5 cm je Seite größer gebaut als das Loch.

**Mörtel/Fugenfarbe (v0.7.247 / v0.7.248):** `panel.jointColor` (Default `#c8c0b8`), unabhängig von `wallColor`. UI Reiter **Fugen**; Mörtel wird im Low-Tier gebaut und ist ab Medium-LOD sichtbar. Stein-Kontrast nutzt im Medium-LOD mehrfarbige Low-Meshes (`createStudioPanelGeometriesByColorIndex`). **v2.0.123:** Fugen nutzen `claddingFinish` und `finishMortarMaterial` (Roughness ≤ 0,42, EnvMap) — sichtbares Glanzlicht vom Punktlicht, nicht nur matte Wandoptik.

| `panelFlip` | Innenende (`zB` / `zA`) | Außenende |
|---|---|---|
| `true` (Grundriss) | `zB = depth` | `zA = revealOuterZ` (typisch negativ, durch die Paneele) |
| `false` | `zA = 0` | `zB = revealOuterZ` (typisch `depth + Vorstand`) |

Ohne Paneele und ohne vorstehendes Profil ist `revealOuterZ` die Wandkörper-Außenkante — gleiches Mesh wie zuvor.

### Paneele an Öffnungen

`clipTileAgainstOpenings` schneidet Steine und Mörtel gegen die **Öffnungsmaske** — dieselbe Kontur wie das Wandloch (`openingMaskPolyline` in `openingGeometry.ts`): Rechteck, Bogenkrone (`openingArchOutline` / `sampleArchCrown` für alle `ArchFormId`s außer `rect`) oder Stadion/Kreis. Mit Keilstein-Ring dockt das Raster an `voussoirExtradosPolyline` (meshgleiche Außenkanten), nicht an einen 128-Punkt-Kreis. `PANEL_OPENING_CLEARANCE` ist **0**, damit kein Wandstreifen (Phantom-Kasten) um den Bogen frei bleibt; optionaler Nutzer-Freiraum (`Opening.panelClearance`) bleibt ein konzentrischer Offset derselben Form. Kurve: keine Rechtecklöcher, nur Band-Clip (`clipPolysMinusArches` / `clipRectMinusStadium`). Eckige Öffnungen: `clipRectMinusBox` hält L-Steine als ein Polygon (kein `subtractRect`-Split an Sohlbank/Kämpfer). Reste oberhalb des Bogens als `bottomArc`, unterhalb runder Nischen als `topArc`. **v0.7.106:** Nach mehreren Bogen-Clips verdichtet `clipPolyMinusColumnHole` die X-Abtastung in Flachbereichen; `interpolatePolyArc` nutzt Laibungs-ε (nicht 0,05 cm), sonst fehlen Flat-Samples zwischen Fenstern. `splitMultiNotchArcPolys` zerlegt wandbreite Streifen nur bei **zwei oder mehr** Kerben (flach | Kerbe | flach | …), damit zwischen Fenstern keine Sehne entsteht. **Ein** Rundbogen bleibt ein Polygon mit `bottomArc`/`topArc` — sonst vertikale Stirnkanten je Reihe (Treppenstufen) und Lücken am Scheitel (v0.7.120). **v2.0.121:** Hat ein Rest **beide** `topArc` und `bottomArc` (z. B. Mörtelband zwischen Kellerfenster und angehobener Tür), wird trotzdem je Kante gesplittet — auch bei nur einer Kerbe — sonst füllt das Band die Türöffnung. **v2.0.121:** Tür mit Treppe: Schalenlöcher (Wand, Paneele, Mörtel, Sockel, Shadow-Tunnel) von y=0 (`openingForShellCut`); Türrahmen bleibt auf der Schwelle. **v0.7.123:** Spalten dünner als `ARCH_REMNANT_CRUMB_CM` (3,2 cm) über/unter dem Loch entfallen, damit wandbreite Streifen keinen Dreiecks-Krümel am Scheitel behalten (die AABB-Höhe der ganzen Reihe ist die Schichthöhe). Nach dem Clip werden `bottomArc`/`topArc` auf die Maskenkurve verdichtet und nach außen geschnappt — Sehnen aus dem X-Raster liegen nicht mehr im Loch. 3D-Körper aus Segment-Quads entlang der Bogenkante (kein Outline-Fächer, der konvexe Sehnen-Reste füllt). Bossen: paralleler Band-Einzug derselben Kurve (`extrudeMonotoneArcBoss`). Konkave Bogen-Reste: kein Outline-Fächer / kein Schwerpunkt-Bossen (Diagonalen in der Zeichnung); Front aus Segment-Quads entlang `topArc`/`bottomArc`. Ein Stein links/rechts der Laibung bleibt **ein** Polygon (nicht an Kämpfer/Sohlbank zerlegt). Shape-Löcher mit **entgegengesetzter Windung**. Bossen-Vorstand (`taperDepth`): volle Rechtecke mit Chamfer-Frustum; zugeschnittene Steine / Zwickel: paralleler Einzug der Restkontur (v0.7.89), kein Source-Diamant. Optional **`openingJoin: 'miter'`** (Checkbox „Gehrung an Öffnungen“): 45°-Abschrägung an rechteckigen Lochkanten analog `wallLocalX` (`applyOpeningMiterX/Y` in `panelGeometry.ts`) — nicht an Bogenkanten.

**v2.0.96:** Fase entlang der Bogenkante bekam eine Normale mit nx und ny — Lambert + Gegenlicht-Shader behandelten sie wie eine Sonnenseite, Reststeine wirkten heller als das Feld. `biasArchCutChamferNormals` zieht diese Normalen zur Wandaußenrichtung. PCSS unverändert (kein Min-Filter-Experiment).

**Arbeit/Vorschau (Flat-LOD):** `buildStudioPanelFlatTileGeometry` und `buildStudioPanelFlatJointGeometry` nutzen dieselbe Pipeline wie High-LOD (`snapOpeningHolesToTileGrid` → `clipPolysMinusArches` → `mergeNarrowClipParts` → `flushClipPartsToOpeningJambs`); Bogen-Reste als Trapez-Spalten entlang `bottomArc`/`topArc` (`addWorkFaceArcPart`) plus `outline`. **v2.0.88:** Keine Zwickel-Spalten mehr — `subdivideLargeTilesAtArchCaps` (v2.0.81, 16-cm-Spalten + Schnitt an Kämpfer/Scheitel für Steine ≥ 14 cm hoch oder ≥ 40 cm breit) ist entfernt; die Roh-Kacheln gehen direkt in `clipRectMinusArch`. Damit verhalten sich die Reihen zwischen Kämpfer und Scheitel wie die Reihe über dem Scheitel: ganzer Stein, vom Bogen maskiert (`bottomArc` bis zur Schichtoberkante, seitlich an der Kurve endend), unabhängig von der Paneelbreite. Legitime Eck-Reste (Stein ragt neben der Schulter über den Bogen) bleiben als kleine Stücke ≥ `ARCH_REMNANT_CRUMB_CM`. **v2.0.87:** Rest-Boss als **Dachfläche** (`src/studio/remnantBoss.ts`, `buildRemnantBossSurface(ring, chamfer, { pin })`): Fasenbreite `chamfer` und Tiefe sind bei jeder Restform identisch mit vollen Steinen — kein Skalieren, kein steilerer Winkel. Deckflächen = exakter Innen-Offset der Kontur (`offsetLoops`: Miter-Rohoffset, Kreuzungen nicht benachbarter Offset-Kanten, Teilstücke behalten deren Mitte innen und ≥ `chamfer` vom Rand liegt, per Objektidentität verkettet; umgedrehte Offset-Kanten kurzer Konturkanten werden übersprungen und die Nachbarn um 3·`chamfer` verlängert, sonst reißt die Kette an Ecken mit 1–2-cm-Kanten). Fasenstreifen pro Konturkante aus Normalenstrahlen (Miter an Ecken, Zwischenstrahlen alle ~0,75·`chamfer` außerhalb der Eckzonen, plus Fußpunkte der Offset-Kreuzungen), jeder Strahl endet bei `chamfer` **oder** an der Mittelachse (`ridgeT`: Abstand zum Rand = gelaufene Weite, 16 Bisektionsschritte) — schmale Reste bekommen so einen First (`t < chamfer`, Höhe `depth·t/chamfer`), die Front teilt sich bei Bedarf (Scheitelstein: links/rechts der Kerbe). Nicht-einfache Konturen (`ringIsSimple`) → kein Boss. `extrudeInsetRingFrustum` in `panelGeometry.ts` baut daraus Quads + Deckflächen-Triangulation; Band-Boss-Rückfall entfernt (hatte eine andere Fase), bei Bogen-Resten ohne Boss bleibt `fillMonotoneArcFront`. **v2.0.86:** Steine bleiben in Größe/Lage im Verband, die Öffnung maskiert nur (`radializeArchCapPolys` entfernt, keine Strahlen). Bossen der Restform: `extrudeInsetRingFrustum` zieht die ganze Kontur (auch konkav: Bogenkerbe, L) parallel ein — Einzug **und** Höhe mit demselben Faktor (`REMNANT_BOSS_SCALE_STEPS` 1…0,2, Winkel wie volle Steine), Ring muss einfach bleiben (`ringIsSimple`) und im Außenring liegen; darunter flache Front (`REMNANT_BOSS_MIN_SIDE_CM` 1,5). Bogen-Reste: erst Kontur-Einzug, dann Band-Boss, dann flach. Schmale Rechteck-Reste an der Laibung (< 2·Fase) laufen ebenfalls über den skalierten Kontur-Einzug (statt steiler Fase). Kein Laibungs-Flush mehr — Fase auch zur Öffnung, bündig nur am Wandende. **v2.0.85:** Schulter `maxDx` bis 80 cm (zurückgenommen in 2.0.86); rechteckige Laibungssteine nicht mehr über den steilen Rest-Einzug (Innenquadrat); Bossen-Zeichnung `lineEdgeThreshold` 48°. **v2.0.84:** Schultersteine ebenfalls radial (`maxDx` bis 40 cm); Zeichnung filtert die ganze Bossen-Platte vor der Steinfront, nicht nur exaktes `bossZ`. **v2.0.83:** Kappensteine über dem Bogen mit radialen Seiten (`radializeArchCapPolys`) — Trapez statt Rechteck auf der Rundung; Zeichnung ohne Bossen-Front-Quadrate (`studioDrawingBossFrontLocalZ`). **v2.0.81:** Große Paneele/Streifen in der Bogenkappe als Zwickel-Spalten (`subdivideLargeTilesAtArchCaps`, max. 16 cm), dann Kurven-Clip — wie kleine Ziegel auf die Rundung. Unter dem Kämpfer ungeteilt. **v2.0.80:** Zeichnungsfilter an der Bogenmaske (`filterStudioDrawingSegments`); Arbeitsmodus überspringt `bottomArc` nicht mehr; explizite Silhouette `drawingArchPolylines`; Flush-Kämpfer über `openingArchSpringY`. **v2.0.28:** zuvor nur Rechtecklöcher (`workModeRectHoles`) — Bögen blieben ungeschnitten, Linienmodus zeigte Mauerwerk durch Fenster. **v2.0.29:** `mergeNarrowClipParts` nur bei anliegenden Rechtecken (Lücke ≤ 1 cm), sonst Rest verwerfen. Bogen-Extrusion überspringt Spalten, in denen die Kurve außerhalb des Steins liegt (Kellerfenster-Scheitel über der Reihe). **v2.0.30:** Zeichnung filtert Kanten, die die Öffnung **kreuzen** (`claddingEdgeHitsOpening`); Stirnflächen an Gehrung und Laibung ohne extra Kontur; Rechteck-Reste unter der Kämpferlinie auf eine gemeinsame Vertikale. **v2.0.31:** `filterStudioDrawingSegment` — keine Tiefenkanten, Plan-Kanten-Snap, Gesims/Zierband mitgefiltert; Bossen an Laibung/Wandende ohne X-Einzug. **v2.0.32:** `claddingEdgeHitsOpening` am Rechteckloch (nicht nur Bogenmaske). **v2.0.33:** `isSpuriousPlinthDrawingDiagonal` entfernt lange CSG-Schrägen im Sockelstreifen auch zwischen Öffnungen; `DRAWING_DEPTH_EDGE_CM` 0,4 cm filtert Bossen-Fasen. **v2.0.34:** Clip-Pipeline läuft **einmal pro Wand** (`prepareStudioPanelParts` / `clipFlatPanelTiles`), erst danach werden die Teile per `bucketPartsByColorIndex` (Schlüssel `sourceX/sourceY`) auf Farbstufen verteilt — vorher verschwanden schmale Endsteine, die allein in einem Bucket lagen. Bogen-/Ring-Teile gehen nur in den ersten nicht-leeren Bucket. `isMergeableNarrowClip` verschont ungeschnittene Rastersteine (`width ≥ sourceWidth`). `flushClipPartsToOpeningJambs` zieht nur den Stein direkt vor der Laibung (`gapIsFree`: kein anderer Teil derselben Zeile in der Lücke). `hidePanelReturnFace` nur mit `coverStart/coverEnd` aus `panelMiterWithReturnCover` (Paneel-Nachbar an der Gehrung), an Laibungen nie.

### Sockel

`createStudioPlinthGeometry` nur wenn `plinthEnabled !== false`, `plinthHeight > 0` und Profil **`sockelStandard`** (Legacy). Default ist **`sockelprofil`** (`19x196-1.svg`): dekoratives Profil **ersetzt** die Box. Sweep vom Boden, Höhe = `plinthHeight` (`sectionScale`), **Tiefe = `plinthDepth`** relativ zur nativen SVG-Breite (`sectionScaleForward = plinthDepth / nativeDepth`), **Versatz = `plinthOffsetForward`** von `studioPanelFaceLocalZ`. Maße: Höhe in **8-cm-Schritten**, Tiefe/Versatz in **1-cm-Schritten**. **v0.7.297:** voller SVG-Sweep wie Gesims, danach boolesches Abziehen des Öffnungsvolumens (`createPlinthProfileSweepGeometry` / `three-bvh-csg`, Kontur `openingMaskPolyline`) — gleicher Schnitt wie Mauerwerk, nicht Y-Löcher im Querschnitt und nicht `plinthVisibleXSpans` plus Sturz-Treppe. Fallback: Fragment-Discard in der Maske. Box-Sockel: Outline/`bottomArc` wie Mauerwerk. Paneel-/Ziegel-Layout: Raster startet am **Wandfuß** (`masonryOriginY = 0`); der Sockel **überlagert** — `clipTilesAbovePlinth` entfernt Steine unter der Sockelhöhe, ohne das Y-Raster zu verschieben (Sockelhöhe ändert Paneel-Y nicht).

**Bossen an Fugen (v0.7.58):** `extrudeFrustum` unterdrückt den Chamfer an Wandenden nur bei 90°-Ecken oder **0,5er**-Köpfen; **volle Steine** an kollinear fortgeführten Nachbarwänden behalten die Zylinderform (`isCollinearWallContinuation`).

**Bossen an Wandenden (v0.7.59):** Optional an freien Enden (`endBossStart` / `endBossEnd`: `off` | `full` | `half` | `alternate`). `layoutPanelTiles` passt Spalten-Schnitte an (volle/halbe Steine, abwechselnd pro Reihe). Mit Nachbar: `endBossStartJoin` / `endBossEndJoin` (`flush` | `miter`) steuert Chamfer über `shouldSuppressBossChamferAtEnd`.

### Schmale Paneel-Reste

Zwischen zwei Öffnungen (oder Öffnung und Wandende) darf kein sichtbarer Rest **schmaler als die Steinbreite der Lage** stehen.

- `mergeNarrowPanelGaps` in `panelLayout.ts`: verschmilzt benachbarte **Kacheln** in schmalen Zwischenräumen zu einem Stein (zwischen Fenstern, zur Wandkante). **Paneele:** Schwelle = halbe Steinbreite (`headerSize`, mind. Raster). **Mauerwerk:** Schwelle = kleinste Kachelbreite der Reihe (z. B. 16 cm bei Köpfen).
- Öffnungslöcher bleiben **pro Fenster getrennt** — kein Zusammenlegen der Löcher (das würde den Zwischenstreifen komplett entfernen).
- `snapHoleToTileGrid`: Y nur bei Rest < Rastermaß auffressen (v2.0.94; früher immer volle Zeile → Lücken über/unter Rechteckfenstern). X am Öffnungsmaß. Zusätzlich Clip gegen das echte Öffnungsrechteck. Geschnittene Reste an der Laibung bleiben stehen; fehlende Stücke bis zur Kante werden per `sealTilesToOpeningJambs` geschlossen. Layout: `rowJambBlockers` überspringt Kopf-/Sohlbank-Schnittzeilen.
- Optional **`Opening.panelClearance`**: extra Ausschnitt in Paneelen/Mörtel (Default Abstand 8 cm). **Tiefe positiv** = Rahmen vor der Wand, **0** = Wandfläche, **negativ** = Vertiefung in die Wand (Außenfläche im Band ausgeschnitten, Rückwand an `studioClearanceRecessZ`). `finish`: `empty` oder `taper` (nur mit Paneelen). Wandloch am Öffnungsmaß, außer der Außenfläche bei Vertiefung.


## Öffnungslöcher (Clip)

`studioWallFaceShape` (`panelGeometry.ts`): Bodentüren (`y === 0`, eckig) als **Boden-Notch** in der Außenkontur; berührt die Laibung die Wandkante (≤ 0,05 cm), wird die Öffnung stattdessen als **Shape-Loch** behandelt — sonst trianguliert Earcut eine Diagonale durchs Türloch. Kein doppeltes Schließen der Kontur, Y ≥ 0 ohne 2-cm-Hairline.

`openingClipRects` in `src/utils/openingGeometry.ts` liefert rechteckige CSG-Löcher nur für **eckige** Masken (beim Rundbogen den Körper unter der Kämpferlinie). Runde Nischen haben kein Rechteckloch. Die Bogenkappe bzw. das Stadion wird mit `clipRectMinusArch` / `clipRectMinusStadium` als Kreislinie geschnitten. Die Kurve wird **gleichmäßig im Winkel** abgetastet (`archPolyline` / `stadiumPolyline`, `ARCH_CURVE_SEGMENTS = 128` für Clip/SVG) — nicht im X-Raster, sonst entstehen lange Sehnen an den Kämpfern. 3D-Extrude/Shape nutzen `ARCH_MESH_SEGMENTS = 32` (v0.7.77). Wandflächen nutzen `THREE.Shape` + Polylinie mit Loch-Windung entgegen der Außenkontur (nicht `absarc` mit gleicher Windung — das füllt die Bounding-Box und erzeugt den Phantom-Kasten um den Bogen). `snapHoleToTileGrid` darf die Bogenkappe nicht als volle Ziegelzeile auffressen (Y-Snap endet an der Kämpferlinie; Stadion-Siegel nur im geraden Mittelstück).

**Laibungsnaht am Kämpfer (v2.0.95):** Ein Stein, der Kämpferlinie **und** Laibung überspannt (Rest links + Zwickel über dem Bogenansatz), trägt in `bottomArc` eine lotrechte Stufe bei `x = Laibung − JAMB_SEAM` → `x = Laibung`. `refinePolyArcToCurve` behält die Original-Stützpunkte exakt und mischt nur die Kurven-Zusatzsamples dazu (Abstand > 0,2 cm). Früher wurden alle X mit 0,2 cm zusammengelegt — die Stufen-Ecke fiel weg und in der Zeichnung lief eine Sehne vom Steinboden schräg zum Bogenansatz. Regression: `archOpeningMasonryClip.test.ts`.

**Rechteck-Sturz in Streifen (v2.0.151 / v2.0.152):** `clipRectMinusBox` schneidet Achsen-Rechtecke (links/rechts/Sturz/Sohlbank) — keine `emitMonotone`-Sehne und keine zusammenhängende Outline, die beim zweiten Loch wieder als BBox aufgefüllt würde. Bögen mit `bottomArc`/`topArc` bleiben auf dem Column-Hole-Pfad. Regression: `rectStripClip.test.ts`.

**Zeichnung / Phantom-Kasten (v0.7.67):** `THREE.EdgesGeometry` macht jede 90°-Seitenfläche sichtbar. Deshalb darf ein Stein oder die Mörtelplatte in der **Bogenkappe** nicht an `boxX0`/`boxX1` (Bounding-Box der Öffnung) gespalten werden — das wäre eine lotrechte Kante durch die Zwickel und die Lagerfugen über dem Bogen. Unter der Kämpferlinie bleibt die echte Laibung. In der Kappe: Kurvenschnitt über die **volle Kachelbreite**, Rest als `bottomArc`. Mehrere Bögen nacheinander: vorhandene `bottomArc`/`topArc` mit der neuen Maske per `max`/`min` zusammensetzen; sonst füllt der zweite Clip das Bounding-Rechteck des ersten Rests und das erste Bogenloch läuft wieder zu.

**Keile über der Bogenkappe (v2.0.61):** `clipPolyMinusColumnHole` verwirft Spalten nicht mehr einzeln, wenn ihr Rest über dem Bogen dünner als `ARCH_REMNANT_CRUMB_CM` (3,2 cm) ist. Das erzeugte am auslaufenden Keil zwischen Bogen und Schichtoberkante eine flache Stufe — sichtbar als dunkler „Kasten“ über dem Scheitel (Streifenmuster, breite Steine). Jetzt entscheidet die **zusammenhängende Gruppe**: Stücke unter dem Loch (Sohlbank-Zwickel), die nirgends 3,2 cm erreichen, fallen weg; Stücke **über** dem Loch (`ClipBand.aboveHole`) bleiben immer und laufen dem Bogen folgend bis zur Schichtoberkante aus. `emitMonotone` überspringt für solche Keile den AABB-Höhen-Krümelfilter. **v2.0.62:** `minClipRemnantWidth` max. 16 cm; Multi-Notch-Split mit `MIN_ARCH_CLIP_REMNANT` — große Paneele (64×32) behalten Zwickel.

**Bossen-Vorstand (v0.7.69 / v0.7.73):** Ein Stein, der Laibung und Bogenkappe zugleich trifft, bleibt ein Polygon (`clipPolyMinusColumnHole`: L/[ als `outline`, C/O weiter getrennt). Der Vorstand ist **ein** Diamant: originale Front bleibt im Raster, wenn sie noch im Reststein liegt (`sourceX/Y/Width/Height` über `copyPolyProps`); sonst ein Diamant im größten eingeschriebenen Balken — nicht zwei Erhebungen in Laibung und Kappe, nicht AABB-Shrink ins Loch.

### Freiraum-Modi am Rundbogen (v0.7.34–v0.7.36)

`Opening.panelClearance.finish`: `empty` (Default) oder `taper`. Kein automatischer Bogenring; `Opening.arch.panelFan` entfernt (Migration: `panelFan === true` → Freiraum an + `finish: 'taper'`).

1. **Freiraum aus:** Kartesisches Raster dockt an der Innenkurve. Clip-Mindestrest 1 cm (`MIN_ARCH_CLIP_REMNANT`).
2. **Freiraum leer:** Clip am Band-Außenrand; Frontkappe vom Wandaußen bis `studioClearanceRecessZ` (Vorstand) bzw. Rückwand in der Wand plus Maske in der Außenfläche (Vertiefung, Tiefe < 0). Ohne Paneele: Rahmen vor der Wand. Leibung bündig dort.
3. **Freiraum zulaufen:** Polar-Tiles nur im Clearance-Band (`archVoussoirPolys` / `archFanPolys`); Raster dockt am Extrados des Bands.
4. **Clip / Maske (v0.7.38, Clip-Pfad v0.7.42):** Jede Kachel (Streifen **und** Mauerwerk) wird einzeln gegen die **Öffnungsmaske** geschnitten — dieselbe Kontur wie das Wandloch. Links/rechts der Maske bleiben Rechtecke; nur die Überlappung folgt der Bogenkurve und wird als `bottomArc` extrudiert (wie origin/main v0.7.33). Nicht als `outline` triangulieren: die v0.7.41-Frontkappen drehten die Windung und cullten `FrontSide`.
5. **Extrusion:** Rechtecksteine und Bogen-Reste: `addQuad(blf, brf, trf, tlf)` (feste −Z-Windung wie v0.7.33). Keilsteine/`outline` nur für konvexe Polar-Tiles (Fächer um den ersten Punkt). Bossen-Vorstand (`taperDepth`): volle Rechtecke mit Chamfer-Frustum; zugeschnittene Steine / Zwickel: paralleler Einzug der Restkontur (`remnantBossOuter`, v0.7.89). Polar-Keile: `extrudePolarFrustum` (konzentrischer Einsatz).

### Keilstein-Ring / römischer Halbkreisbogen (v0.7.75–0.7.76)

`Opening.arch.voussoirs` legt einen echten Voussoir-Ring um das Bogenloch:

- **Intrados** = Öffnungshalbkreis (`openingArchGeom`); **Extrados** = Intrados + `ringThicknessCm` (fehlt → `archRingThickness(panelHeight)`), **gleicher Mittelpunkt**.
- Anzahl: `keystoneCount` oder Auto `archVoussoirCount` aus Bogenlänge / `panelWidth` (ungerade 5–21).
- Fugen: Winkellücke aus `panel.joint`; Keile als Polar-Polygone (`archVoussoirPolysFromSpec`, Feld `polar`).
- Kartesisches Raster clippt gegen den **Extrados** (Außenlinie des Rings). Die Zwickel sind dieselben Rastersteine, an der Kurve maskiert (`bottomArc`) — keine Rechteck-Kappe, keine Extra-Polygone. Mörtel clippt am **Intrados**, damit die Fugen zwischen den Keilen Mörtel zeigen.
- Freiraum `taper` startet **außerhalb** des Rings (`archFanPolys(..., ringT, ...)`).
- Bossen (v0.7.76 / v0.7.89): konzentrischer Keil (`extrudePolarFrustum`) — radiale Seiten bleiben radial, Bögen konzentrisch. Am Bogen-Rest (Zwickel): paralleler Einzug der Clip-Kontur, kein Source-Diamant.
- `spandrel: 'rect'`: Rechteckband über dem Extrados-Scheitel; Raster dort entfernt. Default beim **Neu-Wählen** von Rundbogen+Voussoir in der UI: `rect` (glattere Zwickel); gespeichertes `bond` bzw. fehlendes Feld bei Alt-Saves bleibt Verband bis Extrados (`bond`).
- Spec/SVG: `buildSemicircularArchSpec`, `archVoussoirSvg` (Kreisbogen-Pfade + radiale Fugen, optional Schenkel) in `openingGeometry.ts`.
- **v2.0.74 / v2.0.89:** UI-Default: Rundbogen **ohne** Auto-Keilstein (`voussoirs` nur per Checkbox); `normalizeOpeningArch` setzt fehlendes `voussoirs` **nicht** auf true (Alt-Saves).- 3D-Tessellation (v0.7.77 / v0.7.96): `voussoirMeshSegments` 6–8 je Keil; Paneel-Clip nutzt dieselbe Extrados-Polyline (`voussoirExtradosPolyline`), nicht den 128-Punkt-Kreis.
- **Schenkel (v0.7.78 / v0.7.97):** `Opening.arch.jambs` — Steine gleicher Höhe von Sohlbank bis Kämpfer (`archJambPolysFromSpec`); Anzahl `jambCount` (1–21, Auto aus lichter Höhe / Paneelhöhe). Raster wird aus den Schenkelstreifen ausgeschnitten.
- **Zwickel (v0.7.80–0.7.96):** Raster läuft bis an den **Extrados** (Außenkante der Keilsteine, meshgleiche Facetten). Körper und Boss teilen die Clip-Kontur mit paralleler Fase. Krümel unter 3,2 cm Höhe entfallen. Mit Voussoirs + Freiraum „leer“: Dock am Extrados ohne Clearance-Kappe.
- **Keil-Bossen (v0.7.83):** `extrudePolarFrustum` mit begrenztem Chamfer (~22 % Ringstärke / 18 % Winkel), Radial-Quads statt Fächer; Körper-Front entfällt wenn Polar-Boss die Front übernimmt (kein „Paneel im Keil“).
- **3D-Flackern (v0.7.87):** Selektion ruft `applyRenderStyle` nicht mehr auf (Linien blieben sonst neu gebaut). Orbit-Lite ändert Pixelratio/Linien/Bloom nicht mehr.
- **Hybrid-Übergang (v2.0.75/76):** Bei Rundbogen + Voussoir + Mauerwerk/Läuferverband (`openingArchHybridMasonryEnabled`) liefern `archHybridVoussoirPolysFromSpec` **schichtweise** Sektor×Lagerfuge-Polygone; kartesisches Raster nur im Winkelsektor entfernt (`cartesianPartOverlapsHybridSector`). Details/Maße: [facade-layers.md](facade-layers.md).
- **Radiale Rustika (v2.0.78):** Bei Strip oder Verband + Rundbogen (auch ohne Voussoir) ersetzen `archRusticatedCoursePolys` die kaputten Clip-Reste am Bogen: Knick ~ Laibung ± Überstand, radiale Lagerfugen, Scheitelstein. Hat Vorrang vor Hybrid. Optionales `taperedField` bleibt separates Verdachungs-Trapez.

### Modul-GLB-Verkleidung vs. Fassadenbogen (v0.7.37)

Studio-Paneele clippen den Bogen prozedural. **Modul-Verkleidung** (`resolveCladding` / GLB unter `src/assets/cladding/`) hat ein **rechteckiges** Fensterloch. Sobald eine öffnende Wandöffnung `arch.enabled` hat, wird die GLB-Instanz in `rebuildCladding` übersprungen — sonst bleiben Schultern/Ecken neben dem Bogenfenster sichtbar. Die Wandgeometrie mit Bogenloch bleibt.

**Fallstrick:** Testlinks mit Modulwand + Fassadenbogen zeigen ohne diesen Skip oft „eckige“ Aussparungen — das ist die GLB, nicht die Paneel-Triangulation.

- **flush** (`Opening.fill.mode`): kein Loch
- **revealFrame.enabled**: Loch = Öffnung + `embedCm` je Seite (Default 8)
- **arch.enabled**: Rechteckkörper bis Kämpferlinie + glatter Halbkreis, keine Spaltenapproximation

Blendrahmen/Flügel/Glas (`createFrameGeometry` in `gruenderzeit.ts`, v0.7.50): Innenbogen **konzentrisch** zur Außenkante (gleiche Mitte, Radius − Holzstärke). Ein Extra-Offset um die Rahmenstärke verschiebt die Bogenmitte und verzerrt den Halbkreis.

Leibung: `createStudioOpeningRevealGeometry` (Nische mit Rückwand bei `fill.mode === 'niche'`). **Konche** (`type: 'conch'`): `createStudioConchRevealGeometry` — Halbzylinder unter der Kämpferlinie + Viertelkugel-Kalotte; Wandloch über erzwungene Rundbogen-Maske (`openingArchForm` → `round`).
