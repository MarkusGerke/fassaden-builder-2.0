# Galerie-Ansicht (QA)

## Verhalten für den Nutzer

Button **Galerie** in der Viewport-Chrome (neben Einfach/Komplex) bzw. Deep-Link `#gallery`. Die Szene zeigt systematisch alle Standard-Elemente:

1. Je Paneel-/Mauerwerkstil eine Reihe mit allen Wandlängen (96 → 576 cm)
2. Je Öffnungs-Preset eine Reihe (nur Wände, die breit genug sind)
3. Je Erker-/Balkon-/Loggia-Preset eine Zelle
4. Zum Schluss **Zufall**: 12 Varianten; Button **Zufall neu würfeln**

**Abstand** zwischen Wänden und Reihen: rechts unter Szene → Tab **Galerie** (Default **320 cm**). Nur im Galerie-Modus sichtbar.

**Navigation in der Galerie**

- Beim Öffnen Fokus auf die **erste Reihe** (nicht die gesamte Anlage).
- **Klick** auf eine Wand: Orbit-Mittelpunkt wandert dorthin (drehen um dieses Objekt).
- **Doppelklick**: heranzoomen und neu einrahmen.
- Orbit-Radius max. ~5200 cm; **min. ~12 cm** — Nahzoom bleibt bedienbar (Zoom-Speed steigt mit Nähe).
- **Performance:** Wände weiter als ~3800 cm von der Kamera werden ausgeblendet (die Galerie ist ein Gebäude, LOD greift nicht). `camera.far` folgt dem Orbit-Abstand statt der ganzen Site.
- Orbit freier Polarwinkel (auch unter den Boden); Screen-Space-Pan etwas schneller.

Beim Öffnen wird das aktuelle Projekt in der Session gesichert und **nicht** überschrieben (`localStorage` / `#f=` aus). Beim Verlassen (Button **Galerie aus** / **Galerie verlassen**) kommt das Projekt zurück.

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/gallery/galleryCamera.ts` | Einstiegsfokus, Orbit-Limits |
| `src/gallery/galleryCatalog.ts` | Abschnitte aus Preset-/Pattern-Katalogen |
| `src/gallery/galleryState.ts` | `buildGalleryFacadeState` — Raster, freie Studio-Wände |
| `src/gallery/galleryRandom.ts` | Seed + Zufallsvarianten |
| `src/gallery/gallerySpacing.ts` | Abstand laden/speichern (`fassaden-builder-gallery-spacing`) |
| `src/ui/galleryMode.ts` | enter/exit, Snapshot, Hash `#gallery` |
| `src/main.ts` | Persistenz-Guard, Host, Verdrahtung |
| `index.html` | `#view-gallery-btn`, `#gallery-settings-section` |

## Datenfluss

```
Kataloge (WALL_LENGTH_PRESETS, PATTERN_LABELS, WALL_OPENING_PRESETS, BAY_WINDOW_PRESETS)
  → buildGallerySections / buildGalleryRandomSpecs
  → buildGalleryFacadeState(spacing, seed)
  → applyTransient (ohne persistApp / ohne #f=)
  → FacadeController
```

## Defaults / Konstanten

| Konstante | Wert |
|---|---|
| Abstand Default | 320 cm |
| Abstand Min/Max | 48 … 2000 cm |
| Zufalls-Anzahl | 12 |
| Orbit maxDistance (Galerie) | 5200 cm |
| Orbit minDistance (Galerie) | 12 cm |
| Wand-Cull-Distanz | 3800 cm (+ Hysterese 400) |
| Wandhöhe / Tiefe | `WALL_HEIGHT` / `WALL_DEPTH` |
| Hash | `#gallery` |

## Bekannte Fallstricke

- Galerie-Wände haben **`planLinked: false`** — kein Grundriss-Graph, kein Indoor-Boden/Dach.
- Alle Galerie-Wände liegen in **einem** Gebäude → klassisches Gebäude-LOD hilft nicht; Distanz-Culling übernimmt das Ausblenden entfernter Wände.
- Weit entfernte Reihen können beim Nahzoom kurz fehlen (Cull); Orbit-Ziel per Klick setzen hält die lokale Umgebung sichtbar.
- Neue Presets/Muster erscheinen automatisch, wenn sie in den Katalog-Arrays stehen — **keine ID-Listen in der Galerie hardcoden**.
- Profile/Gesimse/Verdachung/Schrift sind in v1 noch keine eigenen Reihen (Nachzug über denselben Katalog-Hook möglich).


## Bibliothek-Tabs Erker / Balkon / Loggia (v0.7.153)

Galerie/Katalog nutzen weiterhin `BAY_WINDOW_PRESETS`. In der App-Bibliothek sind die Karten nach `kind` auf Tabs **Erker**, **Balkon**, **Loggia** aufgeteilt; der Tab **Wände** zeigt nur Längen, Endstücke und Wände mit Standardöffnung.
