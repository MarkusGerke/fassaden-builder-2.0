# Fallrohre und Regenrinne

Mehrgeschossige Fallrohre als Gebäude-Fixture plus Dachrinne (Titanzink-Look).

## Verhalten

- Bibliothek **Nischen** → Karte **Fallrohr DN 80**: auf Fassade ziehen oder bei gewählter Wand klicken.
- Ein Fallrohr spannt die **vertikale Wandkette** (`findVerticalAlignedWalls`): alle Etagen mit gleichem Origin/Yaw.
- Default: **rund Ø 8 cm**, **Aufsatz** (3 cm Wandabstand), Fuß **Schräge Gehweg** (72°-Auslauf), Farbe **`#8E8A88`**.
- Optional **Nische**: Breite 16 cm / Tiefe 12 cm — synchronisierte `cutout`-Öffnungen (`cutoutShape: 'round'`, `fill.niche`) pro Etage schneiden Schale und Paneele.
- **Dachrinne** bleibt Traufen-Sweep; Farbe wählbar (`roof.gutterColor`, Default wie Fallrohr). Bei aktivem Dach+Rinne: kurzer Ablaufstutzen am Rohrokopf.

## Daten

`Building.downpipes?: DownpipeFixture[]` in [`src/types/facade.ts`](../src/types/facade.ts):

| Feld | Default | Bedeutung |
|---|---|---|
| `anchorWallId` | — | Ankerwand der Etagenkette |
| `localX` | 8-cm-Raster | Position entlang Wand |
| `diameterCm` | 8 | Außendurchmesser |
| `mount` | `surface` | `surface` \| `niche` |
| `nicheWidthCm` / `nicheDepthCm` | 16 / 12 | nur bei Nische |
| `foot` | `shoe` | `shoe` \| `ground` |
| `color` | `#8E8A88` | Titanzink |
| `nicheOpeningIds` | — | Cutout-IDs pro Wand-ID |

`RoofConfig.gutterColor` Default `#8E8A88`. Hydrate: [`hydrateDownpipes`](../src/studio/downpipe.ts), [`normalizeRoof`](../src/studio/roof.ts).

## Datenfluss

```
Bibliothek Drop → createDownpipeFixture → upsertDownpipeInBuilding
  → syncDownpipeNiches (Cutouts bei mount=niche)
  → FacadeController.rebuildDownpipes → downpipeGroup Mesh
Auswahl → toolbar-downpipe (Maße → Farbe → Einbau → Fuß)
```

PBR: `metalness 0.55`, `roughness 0.45` (wie Rinne).

## Dateien

| Datei | Rolle |
|---|---|
| `src/studio/downpipe.ts` | Normalize, Pose, Geometrie, Nischen-Sync |
| `src/FacadeController.ts` | `downpipeGroup`, Rebuild, Pick/Highlight |
| `src/main.ts` / `index.html` | Bibliothek, Toolbar, Ebenen |
| `src/studio/roof.ts` | `gutterColor` |

**Fallstricke**

- Kein Quadratrohr / Kupfer-Preset in v1.
- Erker-Schenkel: nur flache Studio-Wände der Ankerkette.
- Nische aus → gekoppelte Cutouts werden entfernt (IDs in `nicheOpeningIds`).
- Altes Preset „Regenrohr 16×192“ entfällt; Fallrohr ist Fixture, keine reine Nische.
- **`createBuilding` muss `downpipes` mitkopieren** — sonst verwirft `clampFacadeState`/`migrateToBuildings` jedes Commit (v2.0.403 Fix: unsichtbar + Wand-Highlight).
- `downpipeGroup` gehört unter `siteOffset` wie Wände/Dach.
