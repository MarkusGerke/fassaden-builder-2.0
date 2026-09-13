# Fallrohre und Regenrinne

Mehrgeschossige Fallrohre als Gebäude-Fixture plus Dachrinne (Titanzink-Look).

## Verhalten

- Bibliothek **Nischen** → Karte **Fallrohr DN 80**: auf Fassade ziehen oder bei gewählter Wand klicken.
- Ein Fallrohr spannt die **vertikale Wandkette** (`findVerticalAlignedWalls`): alle Etagen mit gleichem Origin/Yaw.
- Default: **rund Ø 8 cm**, **Aufsatz** (einstellbarer Wandabstand, Default **8 cm** vor äußerster Paneelfläche), Fuß **Schräge Gehweg** (72°-Auslauf), Farbe **`#8E8A88`**.
- **Verschieben** wie Öffnungen: Drag auf Rohr/Nische, Pfeiltasten ←/→ (8-cm-Raster), Feld Position X.
- **Wandabstand** (`surfaceGapCm`, nur Aufsatz): Maße-Feld **Wandabstand (cm)** — 0…48, Default 8; bei Nische ausgeblendet.
- Optional **Nische**: Breite 16 cm / Tiefe 12 cm — synchronisierte `cutout`-Öffnungen (`cutoutShape: 'rect'`, `fill.niche`) pro Etage schneiden Schale und Paneele (eckig, nicht Stadion). **Keine Rahmenprofile** an Fallrohr-Cutouts (v2.0.405; normale Einbuchtungen schon). **v2.0.406:** Nischeninneres in Wandfarbe.
- Optional **Fassadenschmuck durchbrechen** (`breakDecor`, Default an): Gesims, Zierbänder und Sockel an der Stelle unterbrechen, Enden links/rechts **bündig geschlossen**.
  - Aufsatz: `fill.flush`-Cutouts (kein Wandloch, nur Schmuck).
  - Nische: dieselben Cutouts wie das Wandloch; bei `breakDecor` aus bleibt das Loch, Schmuck läuft durch.
- **Rohrschellen** (Ring + Lasche zur Wand) entlang der Achse ca. alle 2 m, Aufsatz und Nische. **v2.0.408:** Aufsatz-Lasche geht über den 8-cm-Spalt und den Paneel-/Bossenvorstand bis zum Wandkörper.
- **Dachrinne** bleibt Traufen-Sweep; Farbe wählbar (`roof.gutterColor`, Default wie Fallrohr). Bei aktivem Dach+Rinne: kurzer Ablaufstutzen am Rohrokopf.

## Daten

`Building.downpipes?: DownpipeFixture[]` in [`src/types/facade.ts`](../src/types/facade.ts):

| Feld | Default | Bedeutung |
|---|---|---|
| `anchorWallId` | — | Ankerwand der Etagenkette |
| `localX` | 8-cm-Raster | Position entlang Wand |
| `diameterCm` | 8 | Außendurchmesser |
| `mount` | `surface` | `surface` \| `niche` |
| `surfaceGapCm` | 8 | Aufsatz: Abstand Rohraußenkante → äußerste Paneelfläche (0…48) |
| `nicheWidthCm` / `nicheDepthCm` | 16 / 12 | Nische bzw. Durchbruchbreite |
| `foot` | `shoe` | `shoe` \| `ground` |
| `color` | `#8E8A88` | Titanzink |
| `breakDecor` | `true` | Schmuck an Rohr/Nische unterbrechen |
| `nicheOpeningIds` | — | Cutout-IDs pro Wand-ID |

`RoofConfig.gutterColor` Default `#8E8A88`. Hydrate: [`hydrateDownpipes`](../src/studio/downpipe.ts) (inkl. Cutout-Sync), [`normalizeRoof`](../src/studio/roof.ts).

## Datenfluss

```
Bibliothek Drop → createDownpipeFixture → upsertDownpipeInBuilding
  → syncDownpipeNiches (Nische und/oder breakDecor)
  → FacadeController.rebuildDownpipes → downpipeGroup Mesh (+ Schellen)
Auswahl → toolbar-downpipe (Maße → Farbe → Einbau → Fuß)
Pick: gekoppelte Cutouts → Fallrohr (nicht als eigene Öffnung)
```

PBR: Default-Zink `metalness 0.55`, `roughness 0.45`; andere Farben (Lack) niedriger Metalness. Schmuck-Löcher: `profilePaths` (Gesims/Zierband/Sockel) mit Stirnkappen; Skip-Set wenn `breakDecor === false`.

**Pose Aufsatz (v2.0.408 / v2.0.409):** `face = Wandaußenkante + studioFacadeOutwardDepth` (Paneel + Bosse), dann `+ surfaceGapCm (Default 8) + Radius` nach außen. Schellen-Lasche: `clearance + facadeOut + 1,8 cm` Embed in den Wandkörper.

## Dateien

| Datei | Rolle |
|---|---|
| `src/studio/downpipe.ts` | Normalize, Pose, Geometrie/Schellen, Nischen-Sync |
| `src/utils/profilePaths.ts` | Gesims-/Zierband-/Sockel-Durchbruch |
| `src/FacadeController.ts` | `downpipeGroup`, Rebuild, Pick/Highlight |
| `src/main.ts` / `index.html` | Bibliothek, Toolbar, Drag/Pfeile, Ebenen |
| `src/studio/roof.ts` | `gutterColor` |

**Fallstricke**

- Kein Quadratrohr / Kupfer-Preset in v1.
- Erker-Schenkel: nur flache Studio-Wände der Ankerkette.
- Nische/`breakDecor` aus → gekoppelte Cutouts werden entfernt (IDs in `nicheOpeningIds`); Nische an + breakDecor aus → Loch bleibt, Schmuck ohne Gap.
- Altes Preset „Regenrohr 16×192“ entfällt; Fallrohr ist Fixture, keine reine Nische.
- **`createBuilding` muss `downpipes` mitkopieren** — sonst verwirft `clampFacadeState`/`migrateToBuildings` jedes Commit (v2.0.403 Fix: unsichtbar + Wand-Highlight).
- `downpipeGroup` gehört unter `siteOffset` wie Wände/Dach.
- Nische war kurz `cutoutShape: 'round'` (abgerundeter Fuß) — ab v2.0.404 immer `rect`.
- Gesims-Durchbruch: nicht `openingMaskXRangesAtY` allein (flush → []; Sample auf `y=height` → []) — Decor-Maske + Fallrohr-X-Gaps + Sample innen (v2.0.404 Fix).
