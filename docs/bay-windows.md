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
- **Einsetzen (v2.0.226):** Drop auf eine Wand öffnet Dialog — **Als Segment** (Vorlagenbreite an Drop-Position, Reststücke links/rechts) oder **An Wandbreite** (skaliert auf die gesamte Wand). Bibliothek-Klick mit markierter Wand = Segment in der Mitte.
- **Auswahl / Verschieben (v2.0.227):** Klick auf eine Erker-Fläche markiert **alle drei Frontseiten**. Ziehen entlang der Fassade verschiebt den Erker wie ein Fenster: linkes Reststück und rechtes Reststück tauschen Länge (Mundbreite bleibt). Breite der Erker-Wände ist nicht per Greifer änderbar — nur **Löschen** (→ flache Wand über die Mundöffnung, Reststücke verschmelzen) oder **Bibliothek-Klick** (anderes Erker-Preset am gleichen Mundzentrum). Die passende Bibliothek-Karte ist umrandet (inkl. Tiefe).
- **Außenseiten (v2.0.227):** Schenkel-`panelFlip` folgt der Normalen weg vom Erker-Zentrum — auch bei Parent-`panelFlip: false` (früher: Paneele innen bei 90°/45°).
- Runde Erker entfallen in der Bibliothek (Alt-Saves mit `shape: round` / `arcBay` bleiben ladbar).
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

- Ohne korrekte `panelFlip` je Seite zeigen Paneele nach innen.
- **Schenkel Paneele innen bei panelFlip=false (v2.0.226 → Fix v2.0.227).** Symptom: 90°- und 45°-Erker an Wänden mit `panelFlip: false` zeigten auf den Schenkeln Paneele/Sockel innen (Außenseite glatt/schwarz).
  - **Ursache:** Außennormale fest als CW-Drehung der Umlaufrichtung `(along.z, -along.x)` — das passt nur, wenn der Erker nach −Z (typisch `panelFlip: true`) vorsteht. Bei Vorsprung +Z zeigt CW nach innen.
  - **Nicht geholfen / verworfen:** Nur `unifyGroupFrontOrientation` überspringen (v2.0.224) — das Problem trat schon in der Roh-Ausgabe von `buildUShapeWalls` auf.
  - **Fix:** Normale wählen, die vom Erker-Schwerpunkt wegzeigt; `panelFlipForExteriorNormal` setzt das Flip. Tests: `bayWindow.test.ts` (`panelFlip: false` 90°/45°).
- **Schenkel nach innen gekippt (v2.0.222 → Fix v2.0.224).** Symptom: Beim frei abgelegten 90°-Erker war ein Schenkel schwarz (Innenseite außen), der andere zeigte außen die glatte Rückseite ohne Sockel/Paneele; „der Erker ist noch der alte“.
  - **Ursache:** Beide Schenkel liefen Ansatz → Front (gleicher Yaw, gegensätzliches `panelFlip`). `commitNewStudioWalls` → `finalizeWallFrontOrientation` → `unifyGroupFrontOrientation` gleicht in einer Gruppe alle Wände **gleicher Yaw** auf das `panelFlip` des Seeds ab — und kippte damit einen Schenkel.
  - **Nicht die Ursache** (geprüft): Preset-Maße, Skalierung, `buildUShapeWalls` selbst — die Roh-Ausgabe hatte korrekte Außennormalen; erst der Commit-Pfad drehte sie um. Der Replace-Pfad (`applyBayWindowOnWall`) ruft die Vereinheitlichung nicht auf und war nur indirekt betroffen.
  - **Fix:** Umlauf wie Vorlage (rechter Schenkel Front → Ansatz, alle `panelFlip` gleich) **und** Erker-Wände in `unifyGroupFrontOrientation` / `inheritFrontsFromNeighbors` überspringen. Tests: `bayWindow.test.ts` (Außennormalen), `walls.front.test.ts` (Vereinheitlichung lässt Erker aus).
- **Löschen (v2.0.227):** `flattenBayToFlatWall` — nicht `removeWall` pro Fläche (sonst Lücken/Rest-Schenkel).
- Nach **Wand löschen** einer Erker-Gruppe blieben Planlinien im Grundriss stehen (Ablegen am selben Ort → „überlappt bestehende Wand“); Workaround: Grundriss leeren. Nicht Teil von v2.0.224.
- Runder Erker (Legacy) = **eine** `arcBay`-Wand, nicht viele Plan-Segmente.
- 45°-Erker braucht Mund ≥ `2×depthCm + 8` (bei D=96: **200 cm**, bei D=144: **296 cm**).
- Alt-IDs `bay-384-rect` / `bay-384-45` (Tiefe 192) sind aus der Bibliothek entfernt; gespeicherte Baugruppen bleiben als Wände+Öffnungen erhalten.
- Kollinear angedockte Bibliothek-Wände können zu einer Wand verschmelzen (`mergeCollinearDockedWalls`) — Erker-Gruppen nicht unbedacht „auflösen“.
