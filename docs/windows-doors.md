# Fenster und Türen

Bestandsaufnahme und Roadmap für parametrische Gründerzeit-Öffnungen.

## Verhalten für den Nutzer

Jedes **Fenster** und jede **Tür** ist eine `Opening` mit Blendrahmen, Flügeln, optionalem Oberlicht, Primärteilung und Sprossen. Dazu kommen Fassaden-Zubehör (Rahmenprofil, Fensterbänke, Verdachung, Rollläden, Bogen) und Animation. Türen teilen die Teilungs-Logik und können eine Holzbrüstung sowie eine Eingangstreppe haben.

## Betroffene Dateien

| Bereich | Dateien |
|---|---|
| Typen | `src/types/facade.ts` (`Opening`, `GruenderzeitWindowConfig`, …) |
| Geometrie | `src/windows/gruenderzeit.ts` (`TIMBER`, `resolveTimber`, Layout, 3D) |
| Extras | `src/windows/openingExtras.ts` (Gitter, Shade, Door-Normalize) |
| Maske/Bogen | `src/utils/openingGeometry.ts`, `src/utils/archForms.ts` |
| Hydrate | `src/utils/hydrate.ts` |
| UI | `index.html`, `src/main.ts` |
| Zubehör | `src/studio/pediment.ts`, Sills, `basementWindow.ts`, `stairs.ts`, Rollläden |

Verwandte Docs: [ux.md](ux.md), [opening-motion.md](opening-motion.md), [roller-shutter.md](roller-shutter.md), [panel-geometry.md](panel-geometry.md).

## Ist-Bestand (Individualisierung)

### Öffnung / Wandloch

- Typ: `window` \| `door` \| `cutout` \| `conch`
- Maße, Position, Laibungstiefe (`depthOffset`)
- Füllmodus, Blendrahmen-Einbettung, Freiraum, Bogen/Keilsteine, Laibungsfarben

### Fenster-/Tür-Element (`gruenderzeit`)

- Presets, 1–3 Flügel, Oberlicht, Primärteilung 1–5, Sprossen je Teil
- Kastenfenster inkl. **Innenfarbe** (`innerFrameColor`) und getrennte Innenwinkel
- Brüstung bei Türen; Öffnungswinkel; Animation
- **Holzmaße** (`timber`: Blend/Flügel/Sprosse/Kämpfer/Stulp)
- **Profilierte Sprossen** (`profiledBars`)
- **Scharnierseite** (`leafHinges`) und **Öffnungsart** (`leafOpenModes`: turn/tilt/turnTilt)
- **Beschläge** (`hardware`: Olive + Bänder)

### Fassaden-Zubehör

Rahmenprofil, Bänke, Verdachung, Rollläden, Keller-Gitter, Treppe, Glas, Rahmenfarbe.

### Neu (v0.7.305)

- `Opening.guard` — Stabgitter oder französischer Balkon
- `Opening.door` — Kassetten, Drücker, Briefschlitz
- `Opening.interiorShade` — Vorhang oder Innenjalousie

## Roadmap

| # | Feature | Status |
|---|---|---|
| **4** | Editierbare Holzmaße | erledigt (v0.7.305) |
| **5** | Profilierte Sprossen/Kämpfer | erledigt |
| **10** | Scharnierseite frei | erledigt |
| **1** | Beschläge | erledigt |
| **6** | Kasten innen/außen | erledigt (Farbe; Winkel-Felder vorhanden) |
| **9** | Öffnungsarten turn/tilt/turnTilt | erledigt |
| **3** | Schmuckgitter / franz. Balkon | erledigt |
| **8** | Tür Eigenleben | erledigt (MVP) |
| **14** | Vorhang / Innenjalousie | erledigt |

### Zurückgestellt

2 Klappläden · 7 Bleiverglasung · 11 Holzmaserung · 12 Erker/Dachfenster · 13 Falz/Kitt · 15 Sonderformen.

## Defaults / Konstanten

`TIMBER` in `gruenderzeit.ts` (cm): blend 5.2, sash 4.4, muntin 2.2, kaempfer 7.2, stulp 2.2. Overrides über `resolveTimber(config.timber)`.

Neue Features default **aus** in Hydrate/Normalize (Altprojekte unverändert), außer Tür-`handle` (true wenn `door` gesetzt).

## Bekannte Fallstricke

- Kellerfenster: kein Rahmenprofil/Bänke/Verdachung.
- `glazingArch` Legacy — Glas folgt `Opening.arch.form`.
- Kipp/Drehkipp: Pivot unten; Animation in `FacadeController.applyOpeningLeafDegrees` muss `openMode` beachten.
- Gitter/Shade sitzen als Kinder am Fenstermesh (lokales Z).
