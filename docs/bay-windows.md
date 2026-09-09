# Erker, Balkon, Loggia

Vorsprünge aus der Bibliothek (Tabs **Erker** / **Balkon** / **Loggia**). QA-Raster: [gallery.md](gallery.md). Andocken/Platzieren allgemein: [ux.md](ux.md).

## Verhalten für den Nutzer

- Bibliothek-Karten nach `kind` aufgeteilt; Tab **Wände** zeigt nur Längen (**v2.0.223:** keine Endstücke / Wand+Öffnung).
- Platzieren: Ghost-Wandgeometrie + orange Andockfläche (kein Thumbnail).
- **Erker (v2.0.225 / v2.0.302):** Bibliothek Frontbreiten **192 / 288 / 384 / 576**. **Schmal = 288**, **breit = 384** (8×48). Wandstärke Front/Schenkel **24 cm** (`BAY_WALL_DEPTH_CM`). **v2.0.301:** Neue Erker ohne Host (und bei Host-Streifen) bekommen **Läufer 48×24**, nicht App-Default Streifen 64 — sonst Fenster-Raster ≠ Paneel-Raster. Keine Auto-Migration bestehender 336er-Breiten.
  - **Fenster auf Front (v2.0.308 / v2.0.311):** 96×192 cm. Regel **Rand 48 / Lücke 96** (`BAY_FRONT_OPENING_MARGIN_CM` / `BAY_FRONT_OPENING_GAP_CM`): so viele wie passen — 192 → 1 (x 48), **288 → 1 zentriert (x 96: 96 | 96 | 96)**, **384 → 2 (x 48 / 240: 48 | 96 | 96 | 96 | 48)**, 576 → 3 (48 / 240 / 432). Mit Paneelen Laibungen auf Läufer-Raster, nur wenn beide Ränder ≥ 48 bleiben — sonst zentriert. Vorher (v2.0.295–307): Rand ≥ 24 / Abstand ≥ 48 → 288: 24/168, 384: 96/240.
  - **Fenster auf Schenkeln:** Tiefe 96 → 48×192; Tiefe 144 → 96×192 (je eines, zentriert, Rand ≥ 24 / Abstand ≥ 48 — `BAY_OPENING_MIN_*`; mit Paneelen ebenfalls Raster-Snap).
  - **Stil + Brüstung (v2.0.308 / v2.0.311):** Rahmenfarbe, Bänke, Glas, Rollladen **und Brüstungshöhe (Vertikal)** kommen von der **Fassade**: Spender sind die Host-Wand **vor dem Teilen** und danach alle Wände **derselben Etage** mit Öffnungen (`bayOpeningDonorWalls`; `baySillYFromDonorOpenings` = häufigste Fenster-Y, 8-cm-Raster). Ohne Spender-Fenster: Brüstung **128** (`WINDOW_SILL_Y`), wie ein neues Bibliotheksfenster. Größe/X-Lage kommen weiter vom Layout (nicht vom Spender). Schema 21 (v2.0.309) setzte Alt-Erker einmalig auf 128 — neue Einsätze folgen wieder den Fassadenfenstern.
  - Fenster sind normale Öffnungen — nach dem Einfügen verschieben, löschen, stilisieren wie jedes andere Fenster.
  - **90°:** Front = Mundöffnung (= ersetztes Segment beim Tausch).
  - **45°:** Schenkel fest (`Tiefe√2`); Front = Mund − 2×Tiefe.
- **Vorschau (v2.0.228):** Axonometrie von **draußen schräg oben-rechts** — Front, beide Schenkel und Dachfläche; Winkel so gewählt, dass 45°-Schenkel nicht kollabieren. (Frühere Kabinett-Projektion wirkte konkav bzw. verdeckte den rechten Schenkel.)
- **Einsetzen (v2.0.226 / v2.0.230):** Drop auf eine Wand öffnet Dialog — **Als Segment** (Vorlagenbreite an Drop-Position, Reststücke links/rechts) oder **An Wandbreite** (skaliert auf die gesamte Wand). Bibliothek-Klick mit markierter Wand = Segment in der Mitte. **v2.0.230:** Mit markierter Wand nur **diese Etage**; ohne Wandauswahl (Drop) weiterhin Etagen-Stapel.
- **Auswahl / Verschieben (v2.0.227 / v2.0.237 / v2.0.242):** Klick auf eine Erker-Fläche (auch Paneel/Sockel/Gesims) markiert **alle drei Frontseiten**. Ziehen entlang der Fassade verschiebt den Erker wie ein Fenster: linkes Reststück und rechtes Reststück tauschen Länge (Mundbreite bleibt). Breite der Erker-Wände ist nicht per Greifer änderbar — nur **Löschen** (→ flache Wand über die Mundöffnung, Reststücke verschmelzen) oder **Bibliothek-Klick** (anderes Erker-Preset am gleichen Mundzentrum). **Mehrfachauswahl:** alle markierten Erker-Gruppen werden gleichzeitig ersetzt (`swapBayPreset` je Host). Die passende Bibliothek-Karte ist umrandet (inkl. Tiefe).
- **Gleiten (v2.0.229 / v2.0.233):** Verschieben rastet in **8-cm-Schritten** (`BAY_SLIDE_STEP_CM`); Reststücke bleiben ≥ 8 cm. Erker anderer Etagen mit gleichem Mund (Etagen-Stapel aus „Als Segment“) gleiten **mit**. Während des Ziehens werden Reststücke live neu gebaut — keine Lücken zwischen Erker und Nachbarwand. **2D-Front:** feste Fassaden-Ebene (`buildBaySlideGuideModel` + Plane-Pick), nicht SVG (in Front ausgeblendet) und nicht nur Mesh-Pick (sonst Abbruch über dem Mund).
- **Außenseiten (v2.0.227):** Schenkel-`panelFlip` folgt der Normalen weg vom Erker-Zentrum — auch bei Parent-`panelFlip: false` (früher: Paneele innen bei 90°/45°).
- Runde Erker entfallen in der Bibliothek (Alt-Saves mit `shape: round` / `arcBay` bleiben ladbar).
- Balkon/Loggia: schmale Front, Seiten volle Höhe, Standalone mit Hauswand-Rückseite.
- **Untersicht / Soffit (item 6 / v2.0.239 / v2.0.258):** Unter jedem echten Erker (kein Balkon/Loggia) wird die Unterseite automatisch geschlossen — man sieht nicht mehr von unten durch den Erker. Erzeugt in `FacadeController.rebuildIndoorFloor()`: Außenpolygon aus Schenkel- + Frontwänden (Planlinie = Außenkante), extrudiert am Erker-Fuß (`host.y`). **Zusätzlich Deckel an der Erker-Oberkante**, wenn darüber kein fortgesetzter Erker sitzt. Farbe = **`wallColor`**. Von außen sichtbar (Exterior-Layer), **wirft und empfängt Schatten** (`userData.kind = 'baySoffit'`) — **v2.0.258:** zuvor `castShadow = false` ließ Sonne durch Boden/Deckel. Zusätzlich bekommen Erker-Wände in `createStudioWallGeometry` **immer** den vollen Boden (keine Türlücken), sonst fehlt die Wandstärke-Unterseite.
- **Nach unten verlängern (item 14 / v2.0.233 / v2.0.234 / v2.0.237 / v2.0.239 / v2.0.276 / v2.0.277 / v2.0.278 / v2.0.294 / v2.0.296):** Checkbox + Feld **Verlängerung (cm)** (16–448, Schritt 16). Oberkante bleibt fix; Fuß wandert um `dropCm`. **Nur soweit Freiraum darunter** (`bayDropClearanceCm` / `bayDropMaxCm`) — sonst geklemmt. **v2.0.296:** Bei bündiger Geschossfuge (Unterwand-OK = Erker-Fuß) ist der Freiraum die Höhe der unteren Fassade, nicht 0 — sonst ließ sich der Rock nicht absenken. Beim **Geschoss-Duplizieren** wird Drop an Klonen entfernt (`stripBayDropFromStoreyClone`): Folgegeschosse starten ohne Rock. **Sockel und Paneele** bleiben auf dem **Etagenfuß** (`bayWallSkirtDropCm` / `clipTilesAbovePlinth` auch ohne Sockel); **v2.0.276:** Paneel-*Raster* startet ebenfalls am Skirt (`visiblePanelRowRange(..., skirt)`). **v2.0.277/278:** Skirt = gemessene Fußdifferenz zur Restwand (gleiche Oberkante); Meta-`dropCm` nur Fallback — auch bei `dropCm: 0` mit noch verlängerter Geometrie. `bayDropCm` = max(Meta, Messung). **v2.0.294:** Blaue Wand-Hilfslinien und Öffnungs-Höhen-Snap brauchen dieselben `allWalls` für den Skirt — sonst Raster am verlängerten Fuß (Linien mitten durch Steine). Darunter nur roher Wandblock in **voller Außen-Tiefe** + Untersicht. Öffnungen/Schrift behalten Welthöhe. `bayWindow.dropCm` am Host; `applyBayDrop` ist idempotent.
- **Wandstärke (v2.0.296):** Erker-Front/Schenkel **24 cm** (`BAY_WALL_DEPTH_CM`), unabhängig vom EG-Default 48 cm. `finalizeWallLayout` / `fitBuildingWallsToOuterSpine` lassen Erker-Tiefen stehen. Obergeschoss-Klone: `UPPER_STOREY_WALL_DEPTH` 24 cm. Mund-Gehrung EG 48 ↔ Erker 24 über jeweiliges `wall.depth`.
- **Paneel-Gehrung Erker (v2.0.303 → v2.0.304 → v2.0.307):** Kurzzeitig stumpf Front↔Schenkel → **Ecken-Lücke**. Wieder **gehrt**; v2.0.304 zwang Erker-Paneele auf **Vorstand 0** — **zurückgenommen in v2.0.307** (Z-Fight, siehe Fallstricke). Erker-Steine haben wieder Vorstand/Bosse des Hosts bzw. des Läufer-Defaults (4 / 1); das Läufer-Raster bleibt trotzdem auf `wall.width` (v2.0.306, `panelLayout.ts`).
- **Löschen / Neu einsetzen (v2.0.297):** `flattenBayToFlatWall` behält Front-Fenster (Stile, Profile) auf der Flachwand; erneutes Preset erbt sie. Drop auf Erker-Fläche löst auf Reststück (`resolveBayPlacementWall`); Segment-Einsetzen unter/über anderem Erker richtet den Mund aus (`stackedBayMouthLocalXOnWall`).
- **Paneel-Verband (v2.0.298 / v2.0.302):** Kein End-Stretch mehr auf Erker-Flächen — Läufer wie an flachen Wänden (Rest nur am Ende). Bibliothek **288 / 384** (statt früherer Zwischenbreite 336).
- **Löschen → flache Wand (v2.0.239):** `flattenBayToFlatWall` setzt `y`/`height`/`storeyIndex` auf Etagenmaß (ohne Rock), damit Grundriss/Decke ohne Erker-Ausschnitt neu gebaut werden.
- **Gesims-Umschließen (item 14):** Sitzt ein Erker (`kind: bay`) auf Etage F>0 und die **darunterliegende** Wand (Etage F−1, kollinear unter der Mundöffnung) hat ein Traufgesims (`edge: 'top'`), läuft dieses Gesims **nicht** mehr gerade durch den Mund. Stattdessen (abgeleitet zur Bauzeit in `buildCornicePaths`):
  1. Das untere Gesims wird über die **Mundbreite unterbrochen** (`subtractCorniceGaps`; äußere Enden behalten Kappe/Gehrung, innere Mund-Kanten werden gekappt).
  2. Auf den **Erker-Wänden** (Schenkel + Front) entstehen **Umlaufpfade** auf der Geschossfuge — Welt-Y = Oberkante der unteren Wand = Erker-Fuß **vor** `dropCm`. Profil, Skalierung, Farbe und Ausrichtung kommen von der unteren Wand; an den Erker-Ecken (Schenkel↔Front) mitert der Umlauf, an den Mund-Enden wird gekappt. Bei `dropCm > 0` sitzt der Umlauf entsprechend höher an den verlängerten Flanken (Fuge bleibt bei F·`wallHeight`).
  - Umsetzung: `buildBayCorniceWraps` / `projectMouthLocalRange` / `subtractCorniceGaps` in `src/utils/profilePaths.ts`; kein persistenter Trim. Tests: `src/utils/profilePaths.test.ts` („Erker-Gesims-Umschluss (item 14)“).
  - **Rest-Lücke:** Nur echte Erker (`kind: bay`) mit **oberem** Gesims der unteren Wand werden umschlossen; Balkon/Loggia sowie ein Umschließen der **Erker-Unterkante** (unter der neuen Fußlinie bei `dropCm`) bleiben offen.

## Daten

### `Wall.bayWindow` (Parent)

| Feld | Bedeutung |
|---|---|
| `frontWidthCm` / `depthCm` | Frontbreite / Tiefe |
| `shape` | `rect` \| `angled45` \| `round` |
| `kind` | `bay` \| `balcony` \| `loggia` (Default `bay` bei Alt-Saves) |
| `wallIds` | Kind-Wände (3 bei U-Form, 1 bei rundem Legacy-Erker) |
| `dropCm` | Verlängerung nach unten (cm); Oberkante bleibt fix. Default 0. |

Kinder: `bayParentId`, `bayRole`: `side` \| `front` \| `return` \| `arc` \| `back`.

### `Wall.arcBay` (runder Erker, Legacy)

Eine Wand mit Ellipsenbogen-Geometrie (Paneele/Profile folgen der Krümmung): `frontWidthCm`, `depthCm`, optional `inward`.

## Geometrie / Konventionen

- U- und 45°-Formen schließen an der Host-**Planlinie** (Außenkante) mit **Gehrung** — kein zusätzlicher half-depth-Versatz.
- **Umlauf wie die manuelle Vorlage (v2.0.224):** linker Schenkel **Ansatz → Front**, Front **links → rechts**, rechter Schenkel **Front → Ansatz**. Dadurch haben alle drei Wände **dasselbe `panelFlip`**, die Schenkel-Yaws unterscheiden sich um 180° (90°) bzw. liegen bei ±45° zur Front; kein Schenkelpaar teilt den Yaw.
- **Außennormale (v2.0.227):** ±90° zur Laufrichtung, Richtung **weg vom Erker-Schwerpunkt** (`exteriorNormalAwayFromCentroid`). Fest CW `(az,-ax)` war nur bei `panelFlip: true` korrekt; bei `false` zeigten die Schenkel nach innen.
- **Mundöffnung** (`bayMouthWidthCm`): 90° = Front; 45° = Front + 2×Tiefe.
- **Skalierung auf Segment** (`scaleBayPresetToMouthWidth`): 90° setzt Front = Segment; 45° hält `depthCm`, setzt Front = Segment − 2×Tiefe (sonst `null`).
- 45°-Seiten: Ansatz `W+2D`, Front `W`; Schenkellänge `D/cos(45°) = D√2`.
- `panelFlip` je Wandfläche zur Außenseite (weg vom Erker-Innenraum).
- Erker-Wände (`bayParentId` / `bayWindow`) werden von `unifyGroupFrontOrientation` und `inheritFrontsFromNeighbors` **übersprungen** — ihre Außenseite ist geometrisch festgelegt.
- Fenster: `applyBayPresetOpenings` / `layoutBayOpeningsOnWall`
- **Öffnungen verschieben (v2.0.286):** Auf Erker-Wänden (`bayParentId`/`bayRole`) rastet Drag auf dem **Fugen-Raster** (linke Laibung auf Cut) wie an normalen Wänden — nicht nur auf spärliche Flush-Positionen (beide Laibungen), die bei Forced-Ends oft fehlen. — Außenrand ≥ 24, Abstand ≥ 48; Schenkelbreite nach Tiefe (`baySideWindowWidthCm`).
- Erker-Wände `planLinked` für Gehrung.
- Balkon/Loggia: Front typisch 96×16 cm; `bayRole: back` = Hauswand.

Presets: `BAY_WINDOW_PRESETS` in `src/studio/bayWindow.ts` (Erker generiert aus Front×Tiefe×Form).

## Dateien

| Datei | Rolle |
|---|---|
| `src/studio/bayWindow.ts` | Erzeugen, Fenster-Layout, isometrische Vorschau |
| `src/studio/baySegment.ts` | Segment einsetzen, gleiten, löschen→flach, Preset tauschen |
| `src/constants/presets.ts` | Wand-/Öffnungs-Presets (nicht Erker) |
| `src/types/facade.ts` | `bayWindow`, `arcBay`, Rollen |
| `src/main.ts` / Bibliothek | Tabs, Gruppenzeilen, Drag&Drop |

## Fallstricke

- **Muster „verrutscht“ / Ecken-Lücke (v2.0.303–304).** Stumpf an Erker-Ecken schloss die Gehrung nicht → sichtbare Lücke. Fix v2.0.304: Gehrung wieder an + Erker-Vorstand 0. **Reichte nicht** — siehe nächster Punkt.
- **Front optisch 24 cm breiter je Seite als `wall.width` (v2.0.305).** Symptom: 384er Front rechnerisch 384, optisch 432; Läufer 8×48 ab Planlinie → an beiden Ecken 24-cm-Stummel, „Muster nicht einheitlich“. Bei Außenwänden trat das nicht auf.
  - **Ursache (Probe `bayOuterOrigin.test.ts`):** `buildUShapeWalls` legte die U-Kontur auf die Host-Planlinie und wählte `panelFlip` nur nach Außennormale. Bei Host mit **Innen-Origin** (`panelFlip: false`) bekamen Front/Schenkel ebenfalls `panelFlip: false` → Planlinie = Innenkante, Körper 24 cm nach **außen**, Gehrung verlängert die sichtbare Außenfläche um 2×24. Genau das Problem von v0.7.279 bei Außenwänden — dort per Load-Fit auf die Außenkante gelöst, Erker waren ausgenommen. Erkennbar am Vorzeichen der Körper-Gehrung: Innen-Origin `miterStart +24 / miterEnd −24`, Außen-Origin `−24 / +24`.
  - **Nicht geholfen:** Paneel-Gehrung stumpf (v2.0.303, Lücke); Vorstand 0 (v2.0.304, nur ±4 cm — die 2×24 kamen vom Wandkörper).
  - **Fix:** Umlauf wird **umgedreht** (rechts→links), wenn links→rechts `panelFlip: false` ergäbe → alle drei Wände `panelFlip: true`, Planlinie = Außenkante, Körper nach innen. `bayWindow.wallIds` bleibt in Umlaufreihenfolge (erster Schenkel startet am Mund, letzter endet am Mund — `resolveBaySlideContext`, `bayMouthAnchors`, `stackedBayMouthLocalXOnWall` verlassen sich darauf; `stackedBayHosts` prüft beide Mundpunkte). Schema 19 baut Alt-Erker neu (`docs/migration.md`). **Folge bei Innen-Origin-Host:** Vorsprung ab Host-Planlinie = D; die Host-Außenfläche liegt 24 cm davor, der Erker ragt also D−24 über die sichtbare Hauswand.
  - **Schichthöhe:** `panelForBaySurface` zwingt nur noch die Läufer**breite** auf 48; die Schichthöhe des Hosts bleibt (Schichtflucht Erker↔Restwand, `bayPanelAlign.test.ts`).
- **Immer noch Stummel nach v2.0.305 (v2.0.306).** Bestehende Erker mit `projectDepth: 4`: Paneelfront an der Außen-Origin-Gehrung 392 statt 384 (Steine stehen vor der Kante, Gehrungsebenen laufen auseinander) → `computeRowColCuts` nahm das Front-Layout (`faceLen > width`) → `[8×48, 9.6]` / `[23.6, …, 33.6]`. Fix in `panelLayout.ts`: Front-Layout nur bei Innen-Origin oder 45°-Knick; bei Außen-Origin + 90° bleibt das Raster auf `wall.width`. Diagnose: `__fbDebug.dumpBays()` (nur Vite-Dev) liefert je Erker Pose, `panelFlip`, Gehrung, Paneel, Fenster und die Steinbreiten der ersten/letzten Lagen.
- **Erker-Steine flackern weiß/beige (v2.0.304 → Fix v2.0.307).** Symptom: Auf Bibliothek-Erkern (seit v2.0.304 eingesetzt) breite helle/dunkle **Streifen** über die Steine, die beim Orbitieren wandern; Fugen unsichtbar; Front wirkt wie eine flache Platte. Nutzerfrage: „Wand zu nah hinter den Paneelen? Wände ausblenden? Liegt es an den Fugen?“
  - **Ursache:** `panelForBaySurface` / `defaultBayLibraryPanel` erzwangen `projectDepth: 0` + `taperDepth: 0`. Steine ohne Dicke lagen exakt auf der Planlinie, die Wandschale sitzt bei Paneelen nur **0,15 cm** dahinter (`studioWallOuterFaceLocalZ`). Polygon-Offset (Stein 1 / Mörtel 4 / Schale 8 Units) reicht ab ~10 m Kameraabstand nicht mehr gegen die Depth-Buffer-Auflösung (near 1, far 61 000) → **Z-Fight** Stein↔Schale. Die Fugen (Mörtel, `jointDepth` 0,8) lagen dabei **hinter** der Schale und waren nur verdeckt, nicht Ursache.
  - **Nicht die Lösung:** Wandschale ausblenden, wenn Paneele vergeben sind — die Schale trägt Laibungen, Innenseite, Öffnungs-Ränder und den Untergrund der Fugen; bei normalem Vorstand (≥ 1 cm) gibt es keinen Konflikt. Auch nicht: Offsets vergrößern (verschiebt Kontaktschatten).
  - **Fix:** Vorstand/Bosse nicht mehr nullen; Bibliothek-Erker bekommen Läufer-Default 4 / 1, Host-Paneele behalten ihren Vorstand. Schema **20** (`bay-panel-depth`) setzt Alt-Erker mit 0/0 auf die Muster-Defaults zurück. Das ursprüngliche Motiv (Stummel-Raster) löst seit v2.0.306 `computeRowColCuts`. Test: `bayOuterOrigin.test.ts` („Steine mit Dicke“, „Migration Schema 20“).
- **Erker-Fenster weiß statt Fassaden-Stil, Fenster 96/240 statt 48/240 (Fix v2.0.308).** Symptom: Nach „Als Segment“ bekamen die Erker-Fenster weiße Rahmen mit Brett-Bank, obwohl die Fassade dunkelgrüne Rahmen mit Profilbank hat; Front 384 mit Rändern 96 und Lücke 48; Nutzer hatte Fenster manuell auf 48/240 und die Brüstung verschoben.
  - **Ursache Stil:** `insertBayAsWallSegment` → `splitWallStackRange` → `replaceWallWithBayPreset(mid)` gab **nur das Mittelstück** als `styleFrom` weiter. Liegen die Haus-Fenster außerhalb des Erker-Munds, hat das Mittelstück keine Öffnungen → `applyBayPresetOpenings` ohne Spender → `createOpening`-Defaults. Vor dem Split stand die Optik noch an der Host-Wand.
  - **Ursache Lage:** `layoutBayFrontOpenings` nutzte die Schenkel-Regel (Rand ≥ 24 / Abstand 48): 384 → Inhalt 240, Rand 72 → Raster-Snap 96/240.
  - **Fix:** `bayOpeningDonorWalls` (Host **vor** dem Split + Wände derselben Etage mit Öffnungen) wird pro Etage an `replaceWallWithBayPreset(opts.openingDonors)` → `buildBayWindowAtPose(opts.openingDonors)` durchgereicht. Front-Regel `BAY_FRONT_OPENING_MARGIN_CM` 48 / `BAY_FRONT_OPENING_GAP_CM` 96. Brüstung: ab **v2.0.311** wieder von den Spender-Fenstern (`baySillYFromDonorOpenings`); v2.0.308–310 erzwangen fest 128. Test: `bayOpeningStyle.test.ts`.
  - **Konsequenz 288:** Zwei 96er mit Rand 48 und Lücke 96 brauchen 384 → schmaler Erker bekommt **ein** zentriertes Fenster (96 | 96 | 96). Wer zwei will, setzt das zweite manuell.
- **Erker-Front Brüstung 72 vs. 128 (v2.0.309 → Produkt v2.0.311).** Symptom damals: Front 72, Schenkel 128 — uneinheitlich. Schema 21 setzte alles auf 128. **Nutzerwunsch danach:** Erker soll die Brüstung der Fassade übernehmen (72), neue normale Fenster weiter 128. **Jetzt:** `openingsFromLayouts` nutzt Spender-Y; ohne Spender 128.
- **Licht durch Erker-Boden/Deckel (v2.0.239 → Fix v2.0.258 → Regression Fix v2.0.263).** Symptom: Sonne scheint durch die Untersicht oder den oberen Deckel in den Erker / die Rückwand-Öffnung — **oder** (v2.0.263) helle Flecken an der **Außenwand unter dem Erker**.
  - **Ursache (258):** `baySoffit` war nur Empfänger (`castShadow = false`), damit kein extra Bodenschatten unter dem Vorsprung — lichtdicht war das nicht.
  - **Ursache (263):** Tagsüber ohne Punktlicht-Okklusion setzte `applyIndoorShadowCasting` den Soffit nur auf den Innen-Layer — Sonne (Layer 0) ignorierte ihn.
  - **Nicht:** Nur sichtbare Geschossplatte reicht (liegt oft hinter der Mundlinie / Layer 1). Bias/Dicke ändern half nicht (Cast war schon an).
  - **Fix:** Soffit wirft Schatten auf Layer 0+1; `applyIndoorShadowCasting` lässt `baySoffit` unangetastet (wie `applyPointLightOccluders`).
- **Helle Flecken an der Wand unter dem Erker — „besser, aber immer noch“ (v2.0.263 → Fix v2.0.264).** Symptom: Nach 263 blieben zwei weiche helle Flecken direkt unter der Untersicht (einer je Erker-Frontfenster), nach unten auslaufend.
  - **Ursache (gemessen in der Shadow-Map):** Glas wirft keinen Schatten (gewollt — Sonne in den Raum). Die Sonne sieht durch die Erker-Fenster in den Raum dahinter; diese **Loch-Texel** (Tiefe hinter der Wandebene) liegen in Map-UV nur **56 cm** von der Fuge Wand/Untersicht entfernt (Sonne steil, Fenster über der Fuge zusammengeschoben). Der PCSS-Weichfilter nimmt dort die Erker-Front als Blocker (~1,5 m vor der Wand, Near-Plane nah → `(zR−zB)/zB` groß) und greift mit dem Filterradius in die Löcher → „lit“-Taps im Kernschatten.
  - **Nicht geholfen / verworfen:**
    - Shader-Lochfilter (Taps hinter der Empfängerebene ignorieren, `pcssTapOnPlane`, Toleranz-Uniform): funktional, aber Look-Änderung an allen Silhouetten (Laibungen), mehr Shader-Kosten, im Testszenario kein messbarer Effekt → **zurückgenommen** (`schatten-qualitaet-soll.mdc`: kein Look-Umbau).
    - Brüstung 80/120 cm in der Mundöffnung: nächstes Loch rückt nur von 56 auf 78 cm — Radien um 1 m bleiben erreichbar.
    - Near-Plane-Hack (Shadow-Kamera dichter) reproduziert nur den Penumbra-Wash, nicht die Flecken.
  - **Fix:** `bayMouthSunOccluder` — unsichtbare Blende (`colorWrite: false`, Layer 0, `castShadow`, kein Raycast) 10 cm hinter der Wandebene im Erker, **volle Geschosshöhe** über die Mundöffnung (erster ↔ letzter Ringpunkt). Glas-Loch-Texel im Erkerbereich: **0** (vorher ~9500 in 40–80 cm). Nebenwirkung: kein Sonnenfleck im Raum hinter dem Erker; Erker-Innenraum bleibt besonnt; Punktlichter unberührt (kein Distance-Material). Konstante `BAY_MOUTH_SUN_OCCLUDER_INSET_CM` (`sunLighting.ts`).
- Ohne korrekte `panelFlip` je Seite zeigen Paneele nach innen.
- **Schenkel Paneele innen bei panelFlip=false (v2.0.226 → Fix v2.0.227).** Symptom: 90°- und 45°-Erker an Wänden mit `panelFlip: false` zeigten auf den Schenkeln Paneele/Sockel innen (Außenseite glatt/schwarz).
  - **Ursache:** Außennormale fest als CW-Drehung der Umlaufrichtung `(along.z, -along.x)` — das passt nur, wenn der Erker nach −Z (typisch `panelFlip: true`) vorsteht. Bei Vorsprung +Z zeigt CW nach innen.
  - **Nicht geholfen / verworfen:** Nur `unifyGroupFrontOrientation` überspringen (v2.0.224) — das Problem trat schon in der Roh-Ausgabe von `buildUShapeWalls` auf.
  - **Fix:** Normale wählen, die vom Erker-Schwerpunkt wegzeigt; `panelFlipForExteriorNormal` setzt das Flip. Tests: `bayWindow.test.ts` (`panelFlip: false` 90°/45°).
- **Schenkel nach innen gekippt (v2.0.222 → Fix v2.0.224).** Symptom: Beim frei abgelegten 90°-Erker war ein Schenkel schwarz (Innenseite außen), der andere zeigte außen die glatte Rückseite ohne Sockel/Paneele; „der Erker ist noch der alte“.
  - **Ursache:** Beide Schenkel liefen Ansatz → Front (gleicher Yaw, gegensätzliches `panelFlip`). `commitNewStudioWalls` → `finalizeWallFrontOrientation` → `unifyGroupFrontOrientation` gleicht in einer Gruppe alle Wände **gleicher Yaw** auf das `panelFlip` des Seeds ab — und kippte damit einen Schenkel.
  - **Nicht die Ursache** (geprüft): Preset-Maße, Skalierung, `buildUShapeWalls` selbst — die Roh-Ausgabe hatte korrekte Außennormalen; erst der Commit-Pfad drehte sie um. Der Replace-Pfad (`applyBayWindowOnWall`) ruft die Vereinheitlichung nicht auf und war nur indirekt betroffen.
  - **Fix:** Umlauf wie Vorlage (rechter Schenkel Front → Ansatz, alle `panelFlip` gleich) **und** Erker-Wände in `unifyGroupFrontOrientation` / `inheritFrontsFromNeighbors` überspringen. Tests: `bayWindow.test.ts` (Außennormalen), `walls.front.test.ts` (Vereinheitlichung lässt Erker aus).
- **Lücken beim Verschieben (v2.0.227 → Fix v2.0.229).** Symptom: Nach dem Ziehen eines Segment-Erkers standen die Nachbarwände getrennt vom Erker; Lücken links/rechts.
  - **Ursache:** Der Gleit-Pfad nutzte `previewMeshDrag` + `applyLiveWallOffsets` (nur Erker-Meshes translatiert). Die **gestreckten Reststücke** bekamen kein neues Mesh — und beim Loslassen war `prevState === state`, sodass `applyState` kein Gebäude neu baute (`buildingIdsNeedingRebuild` = leer). Zusätzlich glitt nur die Seed-Etage; Erker im Etagen-Stapel blieben stehen.
  - **Nicht geholfen:** `commitDragFromBase(startState)` allein — der Undo-Snapshot stimmt dann, aber `applyState` vergleicht weiterhin gegen den schon gegleiteten `state` → kein Rebuild.
  - **Fix:** Gleiten über `previewLiveState` (Rebuild ≤ 1×/Frame wie beim Wand-Greifer), `syncSiteTransform` während `drag3dWallMove` aussetzen; beim Loslassen `state = startState` setzen und `commitState(slid)` → Rebuild-Diff und Undo-Snapshot korrekt (`drag3dWallMove.baySlid`). `slideBaySegmentAlong` verschiebt alle Erker des Stapels (`stackedBayHosts`, `bayStackWallIds`) mit gemeinsam begrenztem Delta.
- **Sockel auf Schenkeln zu hoch / Rock schwarz (v2.0.233 → Fix v2.0.234).** Symptom: Nach „Nach unten verlängern“ saß der Sockel auf linker/rechter Erkerseite über dem Restwand-Sockel; der verlängerte Rock wirkte schwarz statt in Wandfarbe.
  - **Ursache:** Rock-Zone blieb auf der paneel-eingesunkenen Außenfläche (wirkt unter Licht schwarz); Skirt-Offset allein aus `dropCm` konnte von der realen Y-Verlängerung abweichen.
  - **Nicht geholfen:** Nur Host-Sockel / nur Meta-`dropCm` ohne Messung.
  - **Fix:** `bayWallSkirtDropCm` (und Profil-Pendant) = Abstand Restwand-Fuß bei gleicher Oberkante; bei Skirt Außenfläche volle Tiefe; Soffit `wallColor`.
- **Löschen (v2.0.227):** `flattenBayToFlatWall` — nicht `removeWall` pro Fläche (sonst Lücken/Rest-Schenkel).
- Nach **Wand löschen** einer Erker-Gruppe blieben Planlinien im Grundriss stehen (Ablegen am selben Ort → „überlappt bestehende Wand“); Workaround: Grundriss leeren. Nicht Teil von v2.0.224.
- Runder Erker (Legacy) = **eine** `arcBay`-Wand, nicht viele Plan-Segmente.
- 45°-Erker braucht Mund ≥ `2×depthCm + 8` (bei D=96: **200 cm**, bei D=144: **296 cm**).
- Alt-IDs `bay-384-rect` / `bay-384-45` (Tiefe 192) sind aus der Bibliothek entfernt; gespeicherte Baugruppen bleiben als Wände+Öffnungen erhalten.
- **Wandstärke Erker → 48 nach Finalize (v2.0.296).** Symptom: `buildBayWindowAtPose` setzte 24 cm, nach Einsetzen wirkten Erker wie EG-48.
  - **Ursache:** `recomputeBuildingLayout` / `clampBuilding` und `fitBuildingWallsToOuterSpine` schrieben allen Studio-Wänden `building.wallDepth` zu.
  - **Fix:** Vorhandene `wall.depth` behalten; Erker-Flächen in Outer-Spine-Fit nicht auf Gebäude-Default setzen.
- Bestehende Erker in Alt-Projekten: Fenster-Positionen und Tiefe erst nach **neuem Einsetzen** / Geschoss-Klon auf v2.0.296-Defaults.
