# Öffnungs-Features: Bogen, Nischen, Bänke, Verdachung, Treppe, Keller

Dekor und Öffnungsarten an `Opening`. **Fenster-/Türteilung (Gründerzeit):** [windows-doors.md](windows-doors.md). Flügel-Kurven: [opening-motion.md](opening-motion.md). Rollläden: [roller-shutter.md](roller-shutter.md). Clip/Geometrie: [panel-geometry.md](panel-geometry.md). UI-Navigation: [ux.md](ux.md).

## Typen

| `Opening.type` | Bedeutung |
|---|---|
| `window` / `door` | Öffnung mit Rahmen/Glas (außer Fake-Einbettung) |
| `cutout` | Flache Nische oder Durchbruch; Form `cutoutShape`: `rect` \| `round` |
| `conch` | Konche: Halbzylinder + Viertelkugel-Kalotte; Maske immer Rundbogen |

Typ-Select `#opening-type-select`: Fenster / Tür / Konche (bei flachem Cutout ausgeblendet). Bibliothek-Tab **Nischen**.

## Maße, Einbettung, Freiraum, Bogen

Toolbar **Maße** (Auszug):

| Steuerung | Verhalten |
|---|---|
| Breite / Höhe / Position | 8-cm-Raster (`STUDIO_MASONRY`); Abstand zwischen Öffnungen 32 cm; kein Pflicht-Randabstand zur Wandkante |
| Fenstertiefe | UI **Frontlage (cm von Außenkante)** unter Maße; speichert `Opening.depthOffset` pro Öffnung (Gültigkeitsbereich). Fehlt → `Building.windowDepthOffset`. Standard 24 cm Laibung + Offset |
| Öffnungsart | Fenster/Tür: durchgehend · Wandfläche (bündig) · Nische. Cutout: Durchbruch oder Nische (+ Tiefe). Konche: immer Kalotte, Tiefe steuerbar |
| In Wand eingebettet | `revealFrame.enabled` → kein Wandloch, kein Rahmen/Glas; Bänke/Profile/Bogen/Verdachung bleiben. Nicht bei Cutouts |
| Freiraum | `panelClearance`: Abstand in ganzen cm, Tiefe +/−/0; optional `finish: 'taper'` nur mit Paneelen |
| Bogenform | Karten `#opening-arch-form-cards`: eckig, Rund, Spitz, Stich, Lanzett, Ellipse, Tudor. Legacy `basket` → Ellipse. Stichmaß `#opening-arch-rise-row` (8er-Raster, **Auto** löscht `riseCm`). Form/Stichmaß scoped über `editArchOpeningTargets` (Fenster **und** Türen) |
| Keilstein-Ring | Nur Rundbogen; aus → Felder/Vorschau `hidden`. Optional Schenkel bis Sohlbank |
| Glasbogen | Folgt immer `Opening.arch.form` / `riseCm` — keine separate Checkbox (`glazingArch` Legacy, ignoriert) |

Kern: `src/utils/archForms.ts`, `openingGeometry.ts`. Aktionen: `#duplicate-opening`, `#reset-opening`, `#delete-opening`.

## Fensterbänke

Nur Fenster mit `y > 0`. Hydrate/`ensureWindowSills` ergänzt fehlende Felder. UI `#window-sill-section` nur bei `type === 'window'`.

- **Innen (`sillInner`):** Brett (Tiefe × Stärke), symmetrischer Überstand (`overhang`, Default 8 cm).
- **Außen (`sillOuter`):** `board` (Quader, Tiefe max 16 cm `OUTER_SILL_MAX_CM`, Gefälle) oder `profile` (Sweep `buildSillOuterPaths`). Überstand symmetrisch. Oberkante bündig mit unterer Laibung.

Orientierung: 90°-Drehung, Spiegeln oben/unten und vorne/hinten. Innenbank an Innenkante; Außenbank-Sweep an Oberkante der Bankplatte.

## Verdachung (`Opening.pediment`)

Fenster und Türen, **nicht** Kellerfenster. Unabhängig von `wall.profiles`.

| Feld | Default | Bedeutung |
|---|---|---|
| `enabled` | aus | |
| `form` | `straight` | Gerade / Dreieck / Segment (offen/geschlossen) + Bogenpalette |
| `profileId` | `fensterprofil40x140` | `PEDIMENT_PROFILE_IDS` |
| `overhang` | 8 cm | symmetrisch |
| `gableHeight` | 24 cm | First (bei Gerade ausgeblendet) |
| `extentOutCm` / `extentForwardCm` | auto | Querschnitt cm |
| `offsetUp` | 0 | −96…96, 8er; + über Sturz, − nach unten; plus Auto-Anhebung über Sturzprofil |
| `offsetForward` | 0 | Tiefe |
| `consoles` | aus | unter den Enden; Default 16×8×64 cm |

UI: `#opening-pediment-section`, `#opening-consoles-section`. Normalize: `src/studio/pediment.ts`.

## Eingangstreppe (`Opening.stairs`)

Nur bei **genau einer** gewählten Tür (`#door-stairs-section`). Optionen nur wenn an. Y der Öffnung gesperrt (Schwelle aus Treppe).

| Feld | Raster | Bedeutung |
|---|---|---|
| Stufen | 1–16 | Anzahl |
| Steigung / Auftritt | 8 cm | je Stufe |
| Podesttiefe | 8 cm | oberste Ebene; hinten bis Tür/Innenwand |
| Breite oben / Überstand / Aufweitung | 8 cm | |

Oberste Hinterkante = Innenwand; tiefere Stufen = Außenkante. Aktive Treppe: Sockel clippt Loch von y=0 bis über die Tür. Unteres Türprofil (`bottom`) wird nicht gezeichnet.

Datei: `src/studio/stairs.ts`.

## Kellerfenster (`basementWindow`)

Preset `window-basement-48` bzw. `basementWindow.enabled`. Checkbox „mit Gitter“ nur, wenn Auswahl bereits Kellerfenster ist; nur aktuelle Auswahl (kein Scope).

Kein Rahmenprofil, keine Bänke, keine Verdachung — nur Gitter + Position/Farbe. Ist der Sockel höher als das Fenster, umschließt das Sockelprofil die Öffnung (Sturz), statt einen Schacht auszuschneiden ([wall-decor.md](wall-decor.md)).

Dateien: `src/studio/basementWindow.ts`, FacadeController / SvgView / main.

## Oberflächen-Finish

`SurfaceFinish`: stumpf / glänzend / metallisch an Rahmen, Trim, Bänken, Verdachung, Treppe, … — Mapping und UI-IDs in [ux.md](ux.md) (Abschnitt Farben / Finish). Glas bleibt Tint/physisch.

## Rahmenprofil-Maße

`#profile-extent-out` / `#profile-extent-forward` (cm) überschreiben `#profile-scale` je Achse. Anker vor Paneelfläche (`PROFILE_FACE_BIAS_CM` 1,5 cm); Mindest-Forward `PROFILE_BACK_CLEARANCE_CM` 1,2 cm. Siehe [profiles.md](profiles.md).

## Fallstricke

- Verdachungs-UI ≠ Profil-ID `fensterverdachung` im allgemeinen Picker.
- Keilstein-UI ausblenden wenn Ring aus (nicht nur disabled).
- Fake-Einbettung: Profile folgen weiter der Bogenform, obwohl kein Loch.
