# Erker, Balkon, Loggia

Vorsprünge aus der Bibliothek (Tabs **Erker** / **Balkon** / **Loggia**). QA-Raster: [gallery.md](gallery.md). Andocken/Platzieren allgemein: [ux.md](ux.md).

## Verhalten für den Nutzer

- Bibliothek-Karten nach `kind` aufgeteilt; Tab **Wände** zeigt nur Längen (**v2.0.223:** keine Endstücke / Wand+Öffnung).
- Platzieren: Ghost-Wandgeometrie + orange Andockfläche (kein Thumbnail).
- **Erker (v2.0.225):** Bibliothek mit **16 Vorlagen** — 90° und 45°, Frontbreiten **192 / 288 / 384 / 576**, Tiefen **96 / 144**. IDs `bay-f{Front}-d{Tiefe}-{rect|45}`.
  - **Fenster auf Front:** 96×192 cm, Brüstung 128 cm; so viele wie passen bei Außenrand ≥ 24 cm und Abstand ≥ 48 cm (192→1, 288/384→2, 576→4).
  - **Fenster auf Schenkeln:** Tiefe 96 → 48×192; Tiefe 144 → 96×192 (je eines, zentriert).
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
- **Nach unten verlängern (item 14 / v2.0.233 / v2.0.234 / v2.0.237 / v2.0.239):** Checkbox + Feld **Verlängerung (cm)** (16–448, Schritt 16). Oberkante bleibt fix; Fuß wandert um `dropCm`. **Nur soweit Freiraum darunter** (`bayDropClearanceCm` / `bayDropMaxCm`) — sonst geklemmt. Beim **Geschoss-Duplizieren** wird Drop an Klonen entfernt (`stripBayDropFromStoreyClone`): Folgegeschosse starten ohne Rock. **Sockel und Paneele** bleiben auf dem **Etagenfuß** (`bayWallSkirtDropCm` / `clipTilesAbovePlinth` auch ohne Sockel); darunter nur roher Wandblock in **voller Außen-Tiefe** + Untersicht. Öffnungen/Schrift behalten Welthöhe. `bayWindow.dropCm` am Host; `applyBayDrop` ist idempotent.
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
- Fenster: `applyBayPresetOpenings` / `layoutBayOpeningsOnWall` — Außenrand ≥ 24, Abstand ≥ 48; Schenkelbreite nach Tiefe (`baySideWindowWidthCm`).
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
- Kollinear angedockte Bibliothek-Wände können zu einer Wand verschmelzen (`mergeCollinearDockedWalls`) — Erker-Gruppen nicht unbedacht „auflösen“.
