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
| `voussoir` | Keilstein-Ring am Bogen | geplant (heute noch Öffnungs-Arch-Pfad) |
| `taperedField` | konisch zulaufendes Quader-/Verdachungsfeld | geplant |
| `none` | keine Verkleidung | abgeleitet |

`front`: `flat` \| `frustum` \| `profile` (Profil-Front erst in Rechteckzonen vorgesehen).

Mehrere Zonen mit `rect` ermöglichen z. B. 24er oben / 48er unten ohne globales Dehnen (`layoutPanelTiles` iteriert persistierte `claddingZones`). Ohne persistierte Zonen bleibt der klassische Ein-Panel-Pfad (`Aufruf-panel` maßgeblich; Ableitung liefert nur `kind`/`front`).

`openingCladdingMaskInflateForLayout`: Freiraum-Inflate für Feld-Layout/Siegel; bei Keilstein-Ring ohne taper-Freiraum = 0.

### Zwei Horizontal-Bänder (UI, v2.0.72)

Unter **Paneele**: Checkbox **„Verkleidung in zwei Bänder teilen“** (`#studio-cladding-two-bands`).

- An → persistiert `claddingZones` mit IDs `band-lower` / `band-upper`, Höhe der Teilung (`#studio-cladding-split-y`), Modulbreite unten/oben.
- Aus → `claddingZones` entfernt; Raster folgt wieder nur `wall.panel`.
- Inaktive Felder: `#studio-cladding-two-bands-options` und ggf. die einfache Breitenzeile per `hidden`.
- Helfer: `buildTwoHorizontalCladdingZones`, `applyTwoHorizontalCladdingZones`, `updateTwoHorizontalCladdingBands` (`facadeLayers.ts` / `walls.ts`).
- Renderer: `FacadeController` legt bei persistierten Zonen auch im Low-LOD das echte Kachel-Mesh (nicht die Ein-Platten-LOD), damit die zwei Module sichtbar sind.

## Was bewusst nicht „eine Formel“ ist

- Beliebige Profilquerschnitte auf jedem Clip-Rest am Bogen
- Automatische Naht Rechteckverband ↔ Radialkeile ohne eigenen Generator (`voussoir` / Übergang)
- Lichtdichte allein über Bossen-Meshes ohne Schicht A

## Migration / UX

- Kein Schema-Bump nötig: `claddingZones` optional; Alt-Saves verhalten sich wie bisher über `panel`.
- Hydrate: Zonen bleiben über `cloneWall` erhalten; leeres/fehlendes Feld = Ableitung.
- Renderer: `layoutPanelTiles` → Paneel-/Mörtel-/Atlas-Pfade mit denselben Tiles; bei Zonen kein Low-LOD-Ersatz ohne Raster.

## Dateien

| Datei | Rolle |
|---|---|
| `src/utils/openingGeometry.ts` | Öffnungsvertrag, Maske, Normalize, Legacy-API |
| `src/studio/facadeLayers.ts` | Zonen-Ableitung, Zwei-Bänder-Helfer, Inflate, Re-Exports |
| `src/types/facade.ts` | `CladdingZone*`, `Wall.claddingZones` |
| `src/studio/panelLayout.ts` | Zone-Aware `layoutPanelTiles` |
| `src/studio/panelGeometry.ts` | Shell-Mesh, Shadow-Tunnel, Cladding-Extrude |
| `src/FacadeController.ts` | Mesh-Aufbau inkl. Zonen-Tiles |
| `index.html` / `src/main.ts` | UI Zwei-Bänder |

Verwandt: [panel-geometry.md](panel-geometry.md), [opening-features.md](opening-features.md), [shadows.md](shadows.md), [architecture.md](architecture.md).
