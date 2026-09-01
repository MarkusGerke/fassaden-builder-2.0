# Profile (Querschnitte)

Built-in SVG-Profile für Rahmen, Gesims, Sockel, Verdachung, Fensterbänke und Dachziegel. Sweep-Geometrie und Gehrung: [panel-geometry.md](panel-geometry.md), [wall-decor.md](wall-decor.md).

## Verhalten für den Nutzer

- Bibliothek-Tab **Profile**: Drag auf Fenster/Tür bzw. Wand; Klick nutzt die Auswahl.
- Rahmen-/Gesims-/Sockel-Picker: Farbe, Größe (Faktor oder cm), Drehung/Spiegeln.
- **Profil-zeichnen**-Editor ist aus der UI entfernt; Custom-Profile in alten Saves bleiben über `resolveProfile` nutzbar.

## Built-ins (`src/profiles/registry.ts`)

| ID | Label | Nutzung |
|---|---|---|
| `fensterprofil32x120` / `35x130` / `40x140` | Fensterprofil | Öffnungsrahmen, Verdachung, Außenbank |
| `traufgesims70x150` / `110x135` / `200x200` | Traufgesims | Gesims-Picker, Verdachungskonsolen |
| `sockelprofil` | Sockelprofil 19×196 | ersetzt Box-Sockel; Default |
| `projecting` / `classical` | Dachziegel | nur Dach, nicht in Rahmen-/Gesims-Pickern |

Rahmenprofil-Kacheln in der Öffnungs-UI: nur `FRAME_PROFILE_IDS` (32×120 / 35×130 / 40×140).

Alte IDs ohne SVG (`windowTrim`, `kranzgesims`, `sockelStandard`, …) werden intern gemappt.

## SVG-Achsen

- Links = Wand (`forward = 0`), rechts = Front (`forward`).
- **Fensterprofil:** oben = oben am oberen Holm (`outward` von der Öffnung weg).
- **Traufgesims:** oben = Krone an Wandoberkante (`outward = 0`), unten hängt nach unten.
- **Sockelprofil:** unten = Boden (`outward = 0`), oben = Oberkante.

Silhouetten: `src/profiles/uploadedSilhouettes.ts` (PNG → Querschnitt, mm→cm).

## Datenfluss

- Öffnungsrahmen: `Opening.trim` + Zuweisung über `wall.profiles` (`ProfileAssignment` / `assignProfilesToOpenings`).
- Gesims / Zierband / Sockel: siehe [wall-decor.md](wall-decor.md).
- Verdachung: `Opening.pediment.profileId` — nicht der allgemeine Picker-Eintrag `fensterverdachung` (der bleibt Kanten-Sweep).
- Custom: `FacadeState.customProfiles`; Auflösung nur über **`resolveProfile`**, nicht `getProfile`.

Maße: `#profile-extent-out` / `#profile-extent-forward` überschreiben `#profile-scale` je Achse. Anker: `PROFILE_FACE_BIAS_CM` (1,5 cm vor Paneelfläche), Mindest-Forward `PROFILE_BACK_CLEARANCE_CM` (1,2 cm).

## Dateien

| Datei | Rolle |
|---|---|
| `src/profiles/registry.ts` | Built-in-IDs |
| `src/profiles/uploadedSilhouettes.ts` | SVG/PNG-Querschnitte |
| `src/utils/profilePaths.ts` | Sweep-Pfade |
| `src/types/facade.ts` | `OpeningTrimConfig`, `ProfileAssignment`, `CustomProfileDef` |

## Fallstricke

- Custom-IDs nur `resolveProfile`.
- Gesims-Tiefe = `sectionScaleForward`, Sockel-Default-ID = `sockelprofil`.
- Offene Bogen-Stürze ohne Stirnkappen; Laibung leicht hinter der Front (`REVEAL_OUTER_INSET_CM`).
