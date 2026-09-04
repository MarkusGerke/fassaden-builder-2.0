# Fassaden-Schichten (Shell / Verkleidung / Anbauteile)

Ziel: skalierbare Kombination aus **Öffnungen** (eckig/Bogen, individuelle Maße), **Verkleidung** (Verband, Paneele, Bossen, später Sonderfelder), **Anbauteilen** (Profile, Verdachung, Bänke) und **lichtdichter Wand** mit Schatten — ohne dass Clip-Sonderfälle die Grundlogik zerlegen.

## Drei Schichten

| Schicht | ID | Inhalt | Licht | Schatten |
|---|---|---|---|---|
| **A – Dichte Wandschale** | `shell` | Studio-Wandkörper (`createStudioWallGeometry`), Loch = Öffnungsmaske | opak, kein Durchlass | wirft + empfängt |
| **B – Verkleidung** | `cladding` | Paneele/Mauerwerk/Mörtel, Zonen | nur Dekor vor A | optional werfen |
| **C – Anbauteile** | `attachment` | Gesims, Sockel, Zierband, Rahmenprofil, Verdachung, Bänke | unabhängig | werfen/empfangen |

**Eine Öffnungsmaske** (`openingMaskPolyline` / Rechteck+Bogenform) steuert:

- Loch in A (`cutsShell`)
- Ausschnitt/Dock in B (ggf. mit Freiraum-Inflate)
- CSG/Anbindung in C (Sweep minus Maske wo nötig)

## Öffnungs-Vertrag

Kanonisch: `resolveOpeningLayerContract` in [`src/utils/openingGeometry.ts`](../src/utils/openingGeometry.ts) (Re-Export aus [`facadeLayers.ts`](../src/studio/facadeLayers.ts)).

| Situation | Shell-Loch | Glas | Freiraum (B) | Dekor C |
|---|---|---|---|---|
| Durchbruch (`fill: opening`) | ja | ja | optional | ja |
| Nische (`fill: niche`) | ja | nein | optional | typabhängig |
| Bündig (`fill: flush`) | nein | nein | — | typabhängig |
| **In Wand eingebettet** (`revealFrame.enabled`) | **nein** | **nein** | optional (Dekor) | **ja** (Bänke/Verdachung/Profile) |
| `hidden` | nein | nein | nein | nein |

### Freiraum (`Opening.panelClearance`)

- Vergrößert **nur** die Maske für Schicht B (`claddingMaskInflateCm`).
- **`shellMaskInflateCm` ist immer 0** — das Mauerloch bleibt am Öffnungsmaß.
- `finish: 'empty'` = Band ohne Steine; `taper` = radiale/konische Bandfüllung (nur mit Paneelen).
- `depthCm` = Vorstand (+) / Vertiefung (−) des Freiraum-Bands.

Bestehende Helfer (`openingCutsWall`, `openingPanelClearance`, …) bleiben API-kompatibel und müssen semantisch mit dem Vertrag übereinstimmen (Tests).

## Verkleidungszonen (B)

Typ `CladdingZone` an `Wall.claddingZones` (optional). Fehlt/leer → Ableitung aus `wall.panel` (`deriveCladdingZonesFromPanel` / `claddingZonesForWall`).

| `kind` | Bedeutung | Status |
|---|---|---|
| `bond` | Läufer-/Mauerwerksverband | abgeleitet / aktiv |
| `strip` | Streifenpaneele | abgeleitet / aktiv |
| `boss` | Bossen (Frustum-Front) | abgeleitet wenn `taperDepth > 0` |
| `voussoir` | Keilstein-Ring am Bogen | Zone geplant; **heute** Öffnungs-Arch (`Opening.arch.voussoirs`). v2.0.74: UI-Default an bei neuem Rundbogen. **v2.0.75:** bei Verband Hybrid-Übergang statt Kreis-Extrados-Clip. **v2.0.78:** bei Strip/Verband greifen primär radiale Rustika-Lagen (auch ohne Ring) |
| `taperedField` | separates Trapez-/Verdachungsfeld über der Öffnung | **v2.0.77** eingeführt; **v2.0.78:** klar als optionales Giebelfeld gekennzeichnet (Default aus) — **nicht** die Rustika am Bogen |
| `none` | keine Verkleidung | abgeleitet |

`front`: `flat` \| `frustum` \| `profile` (Profil-Front erst in Rechteckzonen vorgesehen).

Mehrere Zonen mit `rect` ermöglichen z. B. 24er oben / 48er unten ohne globales Dehnen (`layoutPanelTiles` iteriert persistierte `claddingZones`). Ohne persistierte Zonen bleibt der klassische Ein-Panel-Pfad (`Aufruf-panel` maßgeblich; Ableitung liefert nur `kind`/`front`).

`openingCladdingMaskInflateForLayout`: Freiraum-Inflate für Feld-Layout/Siegel; bei Keilstein-Ring ohne taper-Freiraum = 0.

### Hybrid-Übergang Rechteckverband ↔ Radialkeile (v2.0.75)

Ziel (Referenz echter Steinbogen): keine Rechteck-Clip-Splitter an der Kurve und kein isolierter Kreis-Ring, an den Paneele „stoßen“. Stattdessen **Hybridsteine**:

- Innenseite: Intrados + radiale Fugen (Keilform)
- Außenseite: Abschluss an der nächsten **Lagerfuge** des Wandrasters; Schultern oft **L-förmig** bis ±Extrados-X
- Unter Kämpfer: kartesischer Verband in den Pfeilern unverändert
- Über der obersten Hybrid-Abschlusskante: Verband setzt normal fort
- **v2.0.76:** Steine sind **schichtweise** (Sektor × Lagerfugenband), nicht ein Keil bis zu einer Dock-Y. Kartesisches Raster wird nur im **Winkelsektor** entfernt (kein AABB-Loch ~30 % leer).

**Wann aktiv:** `openingArchHybridMasonryEnabled` = Rundbogen + `voussoirs` an + Paneel-Pattern weder `strip` noch `none` (also Läufer-/Mauerwerksverbände) **und** keine Rustika (v2.0.78 hat Vorrang bei Strip/Verband). Streifenpaneele und Alt-Saves ohne Voussoir → Rustika bzw. Extrados-Clip.

**Generator:** `archHybridVoussoirPolysFromSpec` / `archHybridCourseYs` / `cartesianPartOverlapsHybridSector` in `openingGeometry.ts`; Einbindung in `prepareStudioPanelParts` (`panelGeometry.ts`).

**Empfohlene Maße (sonst wirkt der Übergang weiter „kaputt“):**
- Stichmaß (Bogenhöhe) ≈ **ganzzahliges Vielfaches** der Schichthöhe (`panelHeight`), mind. **3 Schichten** im Bogen
- Schichthöhe eher **8–24 cm**; sehr hohe Module (z. B. 48 cm) bei kleinem Stich → zu wenige Lagen
- Pattern **Läufer-/Mauerwerk**, nicht Streifen; **Keilstein-Ring an**
- Ungerade Keilstein-Anzahl (Default/Auto)

**MVP-Grenzen:** nur `form === 'round'`; Stoßfugen der Wand greifen noch nicht in die Keil-Außenkanten; Springer an flachen Winkeln genähert; keine echte L-Schulter wie im Naturstein-Foto über mehrere Module seitlich.

### Radiale Rustika-Lagen am Rundbogen (v2.0.78 / **aus ab v2.0.79**)

v2.0.78 hat Spandrillen ausgestanzt und fehlerhaft gefüllt. **Ab v2.0.79:** nur noch mit `Opening.archRustication.enabled === true` (kein UI, Default aus). Generator `archRustication.ts` bleibt für die nächste Iteration.

**Das ist das geforderte Verhalten** (Referenzfoto): horizontale Strip-/Verband-Lagen knicken nahe der Laibung radial zum Bogenmittelpunkt ab → trapez-/keilförmige Quader, die den Bogen umschließen. Kein schwebendes Trapez über dem Scheitel.

- Unter Kämpfer: normales Raster
- Im Bogenband (Kämpfer → Scheitel + Puffer): pro Schichtband links/rechts ein Poly mit vertikaler Knickkante (~ Laibung ± `knuckleOffsetCm`), radialen Lagerfugen und Bogen-Innenkante
- Scheitel: immer ein schließender Keilstein; bei `voussoirs` an ebenfalls (Default 1)
- **Ohne Voussoir-Pflicht**; aktiv bei Pattern `strip` und allen Verbänden (`openingArchRusticationEnabled`)
- Primär Rundbogen; greift auch bei Tudor/Stich o. Ä. (Kronen-Polyline + Kämpferzentrum), damit Strip-Fassaden nicht mit Clip-Resten enden
- Generator: `src/studio/archRustication.ts`; Clip am Intrados (Rund) bzw. Outline + kartesische Spandrillen-Reste entfernt in `prepareStudioPanelParts`
- Parameter: Knick-Abstand Default aus `panelHeight`/`panelWidth` (mind. 8 cm)

Hat Vorrang vor Hybrid (v2.0.75) für dieselben Öffnungen.

### Separates Trapez-Verdachungsfeld (`Opening.taperedField`, v2.0.77 / klargestellt v2.0.78)

Optionales **Giebel-/Verdachungs-Trapez über** der Öffnung — **anderes Feature** als die Rustika am Bogen:

- Mehrere Lagen (`courses` × `panelHeight`), jede Lage ein Trapez-Polygon (`outline`)
- Default: **aus**; untere Breite = Öffnung + 2×`overhangCm`, oben schmaler (`topWidthRatio`); `invert` = nach unten verjüngend
- Basis-Y: Extrados (mit Voussoir) → sonst Bogenscheitel → sonst Sturz
- UI: `#opening-tapered-field-section` unter Verdachung, Label „Separates Trapezfeld…“; Optionen `hidden` wenn aus
- Generator: `src/studio/taperedField.ts`

### Zwei Horizontal-Bänder (UI, v2.0.72)

Unter **Paneele**: Checkbox **„Verkleidung in zwei Bänder teilen“** (`#studio-cladding-two-bands`).

- An → persistiert `claddingZones` mit IDs `band-lower` / `band-upper`, Höhe der Teilung (`#studio-cladding-split-y`), Modulbreite unten/oben.
- Aus → `claddingZones` entfernt; Raster folgt wieder nur `wall.panel`.
- Inaktive Felder: `#studio-cladding-two-bands-options` und ggf. die einfache Breitenzeile per `hidden`.
- Helfer: `buildTwoHorizontalCladdingZones`, `applyTwoHorizontalCladdingZones`, `updateTwoHorizontalCladdingBands` (`facadeLayers.ts` / `walls.ts`).
- Renderer: `FacadeController` legt bei persistierten Zonen auch im Low-LOD das echte Kachel-Mesh (nicht die Ein-Platten-LOD), damit die zwei Module sichtbar sind.

### Y-bewusstes Öffnungs-Snap + Stil-Vorlagen (v2.0.73)

Bei persistierten Zonen mit `rect` nutzt der Öffnungs-Snap das Paneel der Zone an der **Öffnungsmitte-Y** (`claddingZoneAtY` / `effectivePanelAtY` → Cuts über `masonryPatternCuts`). Ohne Zonen-Rects unverändert `wall.panel`. Gestapelte Etagen: weiterhin kgV der Modul-Einheiten (Fokus-Wand Y-bewusst, Nachbar-Etagen über deren `wall.panel`).

Stil-Vorlagen / Stile kopieren-einfügen nehmen `claddingZones` mit dem Paneel-Stil mit (`draftFromWallStyle`, `applyPanelStyleToWall`).

### Call-Site-Audit (v2.0.73)

| Stelle | `wall.panel` vs. Zonen | Status |
|---|---|---|
| `panelLayout.layoutPanelTiles` | iteriert `claddingZones` | ok (v2.0.71) |
| `openingPanelSnap` | Cuts/Kandidaten | **fixiert** Y-bewusst |
| Stil-Vorlagen / Clipboard | nur `panel` | **fixiert** inkl. `claddingZones` |
| `cloneWall` / Etage duplizieren | klont `claddingZones`; Paneel aus → Zonen weg | ok |
| `FacadeSvgView`, Mörtel, Validierung | oft globales `wall.panel` | bewusst (UI/Optik); Layout 3D zonenbasiert |
| Voussoir / Rustika / taperedField | **Rustika v2.0.78** (`archRustication.ts`); Hybrid MVP; taperedField optional | Rustika ok; Hybrid Fallback |

## Tiefen-Reihenfolge der Schichten (v2.0.158)

Die Schale A bleibt **immer** unter der Verkleidung B (`createStudioWallGeometry`: Außenfläche 0,15 cm nach innen versetzt, im oberen Freistreifen volle Tiefe). Geometrisch liegen dann in lokalem Z: Stein-Front (`projectDepth`, Default 4 cm) → Mörtel-Front (`jointDepth`, Default 0,8 cm) → Stein-Rücken (0) → Schale (−0,15 cm).

Diese Abstände sind kleiner als die Tiefenpuffer-Auflösung ab ~40–60 m Kameraabstand (perspektivisch, 24 Bit, near 1 cm: Δz ≈ z²·6·10⁻⁸ cm → bei 60 m ≈ 2 cm). Ohne Gegenmaßnahme gewinnen zufällig Mörtel oder Schale gegen die Steine → dunkle Streifen beim Rauszoomen („fragmentierte Oberfläche“).

**Lösung:** distanzunabhängiger Tiefenrang über `polygonOffsetUnits` (in `FacadeController.ts`):

| Schicht | Material | `polygonOffsetUnits` |
|---|---|---|
| Steine / Basis-Material | `DEPTH_LAYER_TILE_UNITS` | 1 |
| Mörtel (Low- und High-LOD) | `DEPTH_LAYER_MORTAR_UNITS` | 4 |
| Wandschale außen (`syncWallBodyMaterials`) | `DEPTH_LAYER_WALL_SHELL_UNITS` | 8 |

Fallstricke:

- `applyDepthLayerOffset` **nach** `finishExteriorMaterial` / `finishMortarMaterial` / `applyWorkModeSurfaceLook` aufrufen — die setzen Factor/Units auf 1/1 zurück.
- Kein `logarithmicDepthBuffer`: schreibt `gl_FragDepth` und hebelt sämtliche `polygonOffset`-Regeln aus (Laibung −1, Profile, Schrift).
- Der Flat-Pfad (Vorschau) ist nicht betroffen: Fugen und Steine sind dort disjunkte Polygone auf einer Ebene.
- Zuvor beobachtbar: v2.0.156-Screenshots mit Streifen nur auf Wänden mit `joint > 0` und `jointDepth > 0`.

## Was bewusst nicht „eine Formel“ ist

- Beliebige Profilquerschnitte auf jedem Clip-Rest am Bogen
- ~~Automatische Naht Rechteckverband ↔ Radialkeile ohne eigenen Generator~~ → **v2.0.75 MVP** für Rundbogen+Verband (andere Bogenformen / Streifen offen)
- Lichtdichte allein über Bossen-Meshes ohne Schicht A

## Migration / UX

- Kein Schema-Bump nötig: `claddingZones` optional; Alt-Saves verhalten sich wie bisher über `panel`.
- Hydrate: Zonen bleiben über `cloneWall` erhalten; leeres/fehlendes Feld = Ableitung.
- Renderer: `layoutPanelTiles` → Paneel-/Mörtel-/Atlas-Pfade mit denselben Tiles; bei Zonen kein Low-LOD-Ersatz ohne Raster.

## Dateien

| Datei | Rolle |
|---|---|
| `src/utils/openingGeometry.ts` | Öffnungsvertrag, Maske, Normalize, Legacy-API |
| `src/studio/facadeLayers.ts` | Zonen-Ableitung, Zwei-Bänder-Helfer, `claddingZoneAtY` / `effectivePanelAtY`, Inflate, Re-Exports |
| `src/types/facade.ts` | `CladdingZone*`, `Wall.claddingZones` |
| `src/studio/panelLayout.ts` | Zone-Aware `layoutPanelTiles` |
| `src/utils/openingPanelSnap.ts` | Y-bewusstes Modul bei Multi-Zone |
| `src/utils/styleTemplates.ts` | Vorlagen inkl. `claddingZones` |
| `src/studio/panelGeometry.ts` | Shell-Mesh, Shadow-Tunnel, Cladding-Extrude |
| `src/studio/archRustication.ts` | Radiale Rustika-Lagen am Rundbogen (v2.0.78) |
| `src/studio/taperedField.ts` | Optionales separates Trapez-Verdachungsfeld (`Opening.taperedField`) |
| `src/FacadeController.ts` | Mesh-Aufbau inkl. Zonen-Tiles |
| `index.html` / `src/main.ts` | UI Zwei-Bänder, Stil-Zwischenablage, Quaderfeld |

Verwandt: [panel-geometry.md](panel-geometry.md), [opening-features.md](opening-features.md), [shadows.md](shadows.md), [architecture.md](architecture.md).
