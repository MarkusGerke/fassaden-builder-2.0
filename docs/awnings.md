# Markisen (Gelenkarm / Fallarm / Markisolette)

## Verhalten für den Nutzer

- **An Öffnungen** (Fenster, Tür, leere Öffnung/Cutout, Konche; nicht Kellerfenster): Reiter **Markise**, Checkbox aus → Optionen weg.
- **Frei an der Wand**: Reiter **Markise** → **Markise hinzufügen**; Auswahl in 3D fokussiert den Teil `awning`.
- **Typen:**
  - **Gelenkarm** — je Seite zwei Glieder **fester Länge**; der Ellbogen klappt in der Tuchebene **zur Mitte** ein (Zwei-Glied-IK), voll ausgefahren fast gestreckt. Breite standardmäßig Öffnung + 2× **16 cm** Seitenüberstand. Schmale Markisen: Arme kreuzen sich, linker Arm liegt eine Profilhöhe tiefer.
  - **Fallarm** — je Seite **ein starrer Arm** an einer Wandkonsole **Konsole unter Kasten (cm)** (Default 144). Eingefahren steht der Arm senkrecht an der Wand (Ausfallprofil direkt unter dem Kasten); beim Ausfahren **fällt** er auf einem Kreisbogen nach vorn bis **Neigung** unter Horizontal. Armlänge = Konsole → Kastenunterkante, unabhängig von der Ausfahrt. Kein Feld **Ausladung** (ergibt sich aus Konsolenhöhe + Neigung). Konsolen min. **8 cm** neben Öffnungskante/Profil.
  - **Markisolette** — Ausfallprofil und Armgleiter laufen in **Führungsschienen**. Phase 1: alles fährt senkrecht bis zum Stoffaustritt (**Senkrecht (cm)**, Default 120). Dort schlägt der Gleiter am **Blockadeelement** (Schienenende) an — eine Armlänge unter dem Austritt. Phase 2: der starre Arm schwenkt um diesen Drehpunkt nach außen (bis 90° + **Neigung**, Default 45° → 135° Öffnungswinkel wie bei realen Systemen). Das Tuch bleibt bis zum Austritt senkrecht in der Schiene und läuft dann gerade zum Profil. **Ausladung** = horizontale Reichweite voll ausgefahren (Default 64) → Armlänge `Ausladung / sin(90° + Neigung)`. Kein Feld **Konsole** (Drehpunkt = Schienenende).
- Bibliothek-Tab **Markisen**: zuerst **Keine**, dann Gelenkarm / Fallarm / Markisolette. **Typwechsel** (Bibliothek oder Typ-Buttons) setzt nur **typgerechte Maße** (`awningKindSwitchPatch` / `awningKindDefaults`): Markisolette Ausladung 64 / Senkrecht 120 / Neigung 45; Fallarm Konsole 144 / Neigung 15; Gelenkarm Ausladung 144 / Neigung 15. **Behalten:** Stoff-/Gestellfarbe, Finish, Ausfahrt (`extension`), Animation/Schedule, Seitenüberstand, `id`. Neu anlegen (noch keine Markise) nutzt volle Defaults. Wand: bei ausgewählter Markise Update statt neuer Instanz.
- **Ausfahrt** 0…100 %; Slider live ohne Mesh-Rebuild.
- **Neigung (°)** — Gelenkarm: Tuchneigung; Fallarm/Markisolette: Endwinkel des Arms unter Horizontal (0…45).
- **Volant** — senkrechter Stoff unter der Vorderkante (0…48 cm, 8er-Raster, Default 16).
- Stoff standardmäßig **grau** (`#9ca3af`); Gestänge darunter, Stoff darüber (kein Durchscheinen). **v2.0.442:** Stoff-`polygonOffset` stärker als Fensterprofil (−32 vs −16), damit Markisolette nicht „durchscheinend“ wirkt.
- Animation: Ausfahren / Einfahren / Zyklus; optional Uhrzeiten.
- **Schatten während Animation (v2.0.427):** Markisenschatten folgt der Pose; übrige Hausschatten bleiben. Live: Shadow-Map mit allen Castern, temporär max. **4096²**, Bake ~alle 48 ms; nach Settle wieder Präsentationsgröße (oft 8192) + voller Bake.
- **Kopieren (v2.0.429):** Rechtsklick auf Markisen-Mesh → **Markise kopieren** / **einfügen** / **ersetzen** (eigene Zwischenablage, nur `AwningConfig`). Öffnungsmenü: **Markise kopieren**, wenn aktiv. Wand-Rechtsklick: **Markise einfügen** an Klickposition. „Fenster kopieren“ enthält weiter die Markise an der Öffnung.
- **Breite (v2.0.430 / v2.0.443):** An Öffnungen immer `Öffnungsbreite + 2×Seitenüberstand` (kein festes Breitenfeld) — **auch Fallarm**. Gilt beim Einfügen, Scope-Toast und wenn die Fensterbreite geändert wird. **Seitenüberstand** in **4‑cm‑Schritten** (0…64, Default 16, v2.0.435); UI für alle Typen inkl. Fallarm (v2.0.443).
- **Gruppe (v2.0.430–v2.0.443):** ≥2 Öffnungen derselben Wand markieren → **Eine Markise über Auswahl** (Kontextmenü oder Button). Eine Wand-Markise mit `openingIds`; Breite = Span links…rechts + Überstand. **Verknüpfung lösen** / **In Einzel-Markisen aufteilen** in der Wand-Markisen-Toolbar bzw. Rechtsklick. Individuelle Öffnungs-Markise und Gruppen-Markise schließen sich aus (Mitglied → Einzel-Markise aus). **UI:** gleiche Felder wie Öffnungs-Markise (inkl. **Seitenüberstand** auch bei Fallarm, Höhe über Sturz, Oberfläche, Zyklus-Animation, Uhrzeiten); Öffnungsauswahl eines Mitglieds bearbeitet die Gruppe. `mountY` relativ zum Span-Sturz.

UI-Reihenfolge: Maße → Farbe → Typ → Animation. Typabhängig ausgeblendet: Fallarm ohne *Ausladung*, Markisolette ohne *Konsole unter Kasten*, Gelenkarm ohne beides.

## Daten

```ts
AwningConfig {
  kind: 'foldingArm' | 'dropArm' | 'markisolette'
  extension, widthCm, projectionCm   // projectionCm: Gelenkarm Tuch-Ausladung, Markisolette Reichweite voll; Fallarm ungenutzt
  overhangCm?          // Seitenüberstand, Default 16, Raster 4 cm (v2.0.435)
  frontOverhangCm?     // Volant-Höhe, Default 16
  slopeDeg?            // Neigung unter Horizontal, Default 15
  armInsetCm?          // Wand: Arm von Stoffaußenkante
  armClearanceCm?      // Fallarm/Markisolette an Öffnung: Abstand zu Kante/Profil, min. 8
  armMountYCm?         // Fallarm: Konsole unter Kasten (16…320, Default 144) → Armlänge
  verticalDropCm?      // Markisolette: senkrechter Anteil bis Stoffaustritt (24…320, Default 120)
  fabricColor?         // Default grau
  openingIds?          // Wand: verknüpfte Öffnungen (≥1) → Span-Breite (v2.0.430)
  …
}
```

Hydrate: fehlende Felder → Defaults. Kein Schema-Bump. **Alt-Daten (≤ v2.0.425)** mit `armMountYCm: 24` ergeben beim Fallarm einen 16-cm-Arm — Konsole neu setzen oder Typ neu wählen.

## Kinematik (`src/studio/awning.ts`)

Wand-lokal: X quer, Y hoch, Z nach außen; Kasten bei (0,0), Rolle bei `z = 4,5`.

| Typ | Funktion | Arm | Stoffpfad |
|---|---|---|---|
| Gelenkarm | `computeFoldingArmPose` | Glied `foldingArmSegmentLengthCm(P) = P/2 + 1,5`; Ellbogen `h = √(L² − (d/2)² − drop²)` quer zur Mitte, `below` unter der Tuchebene | Rolle → Vorderkante (gerade, leichte Durchhängung) |
| Fallarm | `computeDropArmPose` | `dropArmLengthCm(armMountYCm)`; `α = (90° + slope) · e` ab senkrecht-oben; `F = Konsole + L·(cos α, sin α)` | Rolle → Profil (gerade) |
| Markisolette | `computeMarkisolettePose` | `markisolettePhaseSplit`: `e1 = V / (V + 2L·sin(αmax/2))`; Phase 1 Gleiter = Profil − L; Phase 2 Drehpunkt `−V − L`, `α = 2·asin(s / 2L)` | Rolle → Austritt (senkrecht) → Profil |

`sampleFabricRows` verteilt die Tuchzeilen nach Bogenlänge über den Pfad und hebt sie um `AWNING_FABRIC_NORMAL_LIFT_CM` (3,2) entlang der lokalen Normalen ab (nach oben, bei senkrechtem Tuch nach außen). `awningArmSegmentSpecs`: Gelenkarm 4 Segmente, Fallarm/Markisolette **2** (ein starres je Seite). Scharnier-Meshes: Gelenkarm Ellbogen + Vorderkante, Fallarm/Markisolette Drehpunkt + Vorderkante. Schienen der Markisolette sitzen auf Arm-X und reichen bis `guideBottomY` (Drehpunkt).

## Dateien

| Datei | Rolle |
|---|---|
| `src/types/facade.ts` | `AwningConfig`, `AwningKind` |
| `src/studio/awning.ts` | Normalize, Kinematik, Stoff/Volant, `awningKindDefaults`, `awningKindSwitchPatch` |
| `src/utils/awnings.ts` | CRUD; Clipboard; Span-Layout; Gruppen (`createGroupAwningForOpenings`, …) |
| `src/FacadeController.ts` | Rebuild, Depth/RenderOrder, Schienen, Scharniere |
| `src/ui/awningUi.ts` | Sync, kind-abhängige Felder; Bibliothek/`placeLibraryAwning` = Typwechsel-Patch (Stil behalten); `settleAwningLiveShadow` nach Playback |
| `index.html` / `main.ts` | UI + Bibliothek; `flushAwningLiveShadowBake` / `settleAwningLiveShadow` |
| `src/studio/awning.test.ts` | Kinematik-Tests (Armlängen, Phasen, Ellbogen) |

## Fallstricke

- **Ausfahrrichtung:** `group.scale.z = windowDepthForwardSign(wall)`.
- **Schatten live (v2.0.427):** `shadowMap.autoUpdate = false` → ohne Bake bleibt der Schatten auf der Startpose. **Verworfen:** kein Bake; Voll-Bake 8192 jedes ~200 ms (ruckelig); globale 1024-Map (Haus pixelig); Nicht-Markisen-Caster aus (Hausschatten weg); zweites Directional-/Spot-Licht nur Markise (füllt Umbras auf). **Richtig:** ein Licht, alle Caster, Map temporär ≤4096, ~20×/s; Settle stellt Map-Größe wieder her.
- **Gelenkarme nach unten:** Ellbogen müssen in **X zur Mitte** klappen, nicht stark in −Y hängen. Heuristiken mit variabler Gliedlänge (v2.0.424/425) verworfen — nur echte IK mit fester Länge sieht beim Einklappen richtig aus.
- **Gestänge durch Stoff:** Stoff-Leitkurve um `AWNING_FABRIC_ABOVE_ARMS_CM` plus Normalen-Offset über den Armen; Volant vor dem Frontrohr (+Z); `polygonOffset` Stoff negativ, Gestänge positiv; `renderOrder` Stoff höher.
- **Fallarm (v2.0.426):** **kein** Gelenk. Versuche: Länge mit `extension` skalieren (v2.0.424, falsch), zwei-gliedrige IK `twoLinkElbowYZ` (v2.0.425, „Stütze aus einem Segment ohne Gelenk“ gefordert). Richtig: starrer Arm auf Kreisbogen um die Konsole, Länge aus `armMountYCm`.
- **Markisolette (v2.0.426):** Versuch mit Wandgelenk unter dem Kasten + IK (v2.0.425) war mechanisch falsch. Referenz (Montageanleitung Typ 103 „Blockadeelement der Arme in der Führungsschiene“, markilux 740, Mobau 120 R „Öffnungswinkel max. 135°“): Gleiter in der Schiene, fester Anschlag = Drehpunkt, starrer Arm. Physik: in Phase 2 ist die horizontale Reichweite bei waagerechtem Arm größer als bei 135° — kein Bug.
- **Halterung:** Immer auf der Fassade; Abstand = Öffnungskante + Profil-Outward + `armClearanceCm` (min. 8).
- Seitenüberstand ändert bei Öffnungs-Markise die Breite (`updateOpeningAwning`).
- **Typwechsel:** immer `awningKindSwitchPatch` / `awningKindDefaults(kind)` mitpatchen, sonst bleibt z. B. Ausladung 144 an der Markisolette (Arm 204 cm) oder Konsole 24 am Fallarm. **Nicht** `defaultAwningConfig` neu spreaden (löscht Farbe/Ausfahrt).
