# Arrivieren — Hauswand-Regelwerk v0.1

Maschinenlesbar: [`src/arrivieren/rules/hauswand-regelwerk.json`](../src/arrivieren/rules/hauswand-regelwerk.json) (Quelle der Wahrheit für Gewichte und Constraints).

## Raster (aus fassaden-builder 2.0)

| Konstante | Wert |
|---|---|
| Planraster (Legacy-Fassade) | 48 cm |
| Mauerwerk-Schritt | 8 cm (`STUDIO_MASONRY`) |
| Geschosshöhe | 448 cm (`WALL_HEIGHT`) |
| Standardfenster | 96 × 192 cm, Brüstung 128 cm |
| Rand-/Zwischenpfeiler | 48 cm |

**Breite bei n Achsen à 96 cm mit 96 cm Zwischenraum und 96 cm Rändern:** `n × 192 + 96` cm. Implementierung: `hauswandWidthCm()` in `src/arrivieren/hauswandGrid.ts`.

## Harte Regeln

**Erker (Rendering, main):** Schenkel ohne Schatten-Cast/Receive; Schenkel-Rahmen/Laibung dimmen wie die Wand (`facadeShadeWallLock`). Nachbarfenster am Mund ohne Fensterbänke (`openingOuterSillConflictsBayMouth`).

1. **Zufall:** Fassaden-Stapel vor dem Setzen **leer** (keine Alt-Öffnungen/Profile) — `applyHauswandGeneration` leert den Stapel, dann nur Plan-Inhalt. **Ansichtsmodus nie wechseln** (Fassade bleibt Fassade).
2. **Eingang Pflicht:** EG mindestens **Tür 96 / 144×320** oder **Tor 288×320** (`hauswandPlanHasEntrance`). Liegt ab 1. OG ein **Fensterpaar 96+96** (96 cm Zwischenraum), dann EG **Tor 288** oder **Tür 96 + Fenster 96** an denselben X-Positionen.
3. **Geschosse Zufall:** nur **2–5**, nie 1; Schwerpunkt **3–4** (`weights.storeys` in JSON).
4. Achsen Soft **3–7** (≈ 3–7×96er-Fenster), Hard max 15 nur explizit.
5. Höchstens eine große Einfahrt (Tor) pro Fassade.
6. EG darf abweichen (Eingang / Einfahrt / Schaufenster / Ladengruppe / Wohnfenster); OGs fluchten, gleicher Fenstertyp pro Achse.
7. Erker: **kein Rund** im Zufall; nie EG, nie oberstes Vollgeschoss; nur wenn ≥4 Geschosse und ≥4 Achsen; **selten**; Frontbreite nur **288 oder 384** (kein 192). Fenster-Raster: **96 cm** zwischen Fenstern; Lücke Erker↔Öffnung **bevorzugt 48 cm**, maximal **128 cm**. Erker entweder **vollständig über einer Tür** oder klar daneben (≥48), nie teilweise. EG und oberstes OG setzen die Fensterfolge **durch die Erker-Spalte** fort. Unter dem Erker im EG: **Schaufenster oder Tor**.
8. Alle Etagen gleiche Gesamtbreite; **keine überlagernden Wände** (Apply ersetzt Studio-Wände vollständig).
9. **Wandenden:** links und rechts **96 cm** vor der ersten bzw. nach der letzten Öffnung; **keine leere Fläche breiter als 128 cm** (Fill ohne unkontrollierte Aufweitung).
10. **OG über Tür:** Fenster horizontal **zentriert** zur EG-Tür; **EG-Standardfenster fluchten** mit OG (gleiche X/Breite).
11. **Abstände:** zwischen Fenstern **96 cm** (Raster), **auch Schaufenster↔Fenster ≥96**; Tür↔Schaufenster **24–96 cm**; max. Öffnungsabstand **128 cm**; **>4 Fenster** in einer Serie → Erker (wenn Gate) sonst **144er** (Türspalte / Erker-Mund unterbrechen die Serie); **keine Überlagerung**.
12. **Apply:** Öffnung nur auf dem Wandstück, das sie vollständig trägt. Stapelwände **bündig**, gleiche Breite je Etage. Zusätzlich **Rechteck-Grundriss**: Seiten- und Rückwände „nach hinten“ (Tiefe aus `HAUSWAND_DEPTH_OPTIONS_CM` 1200–1440 cm, 8er; Orientierung an Gründerzeit-Vorderhaus ~12–14 m / Berliner Mietshaus). **Dach** zufällig (`ROOF_KINDS`), **ohne Gauben**/Zwerchgiebel/Dachfenster; **First immer O–W** (`ridgeDeg: 90`).
13. **UI:** Bühne **Zufall** + **↩** (vorheriger Seed); rechts Arrivieren-Panel (Seed/Feedback); Bibliothek-Reiter **Fassade** (Favoriten demnächst), Paneele → **Paneele & Mauerwerk**. Viewport einrahmen **ohne** Moduswechsel.
14. **Erker:** einheitliche Variante; schmaler/mittlerer Erker mit 96er auf der Front; **45°-Spalte:** mittig 96, links/rechts 48 mit **64 cm** Abstand.
15. **Tor 288:** darüber zwei 96er-Fenster oder Erker mittig über der Tür.
16. **Fenstergrößen:** meist **96** (Zufall ~92 %), seltener **144**; **kein 48er auf der Fassade** außer in der **45°-Erker-Spalte**. Höhe **immer 192 cm** — ausgenommen Schaufenster (**256** hoch, **64 cm** vom Boden) und Kellerfenster. Keller: **y = 0**, mittig unter dem Fenster darüber; **nur ~30 %** der Fassaden; **keine Rahmenprofile** (`applyOpeningProfilesDelta` / Hauswand-Apply).
17. **Nackte Wände:** Fassade **und Erker** ohne Paneel, Sockel, Gesims, Zierbänder (`stripHauswandWallDecor`); **keine seitlichen Fensterbretter** durch die Erker-Front (Schenkel ohne Bänke; Nachbarfenster: `clampOuterSillLayoutForBayMouths`). Innenböden/-decken aus, aber **Erker-Untersicht/Mundblende** bleiben (sonst dunkle Löcher). Seiten-/Rückwände ebenfalls nackt. **Zufallsdach:** kein Pultdach (`shed`) und kein Walmdach (`hip`).
18. **Viewport:** nach Generieren im **aktuellen** Modus einrahmen — **Fassade** (`present`) frontal, Kamera **höher** und Distanz inkl. Firsthöhe (Dach ganz sichtbar); **2D** Front-Fit; **3D** Orbit-Übergang. Niemals `setView` wechseln.
19. **Schaufenster:** unter jedem Erker-Mund (wenn keine Tür den Mund schneidet) **und** immer mit **Tür links oder rechts** (Abstand 24–96 cm; neben Mund ≥48).

## Generator

- `generateHauswand(seed, rules?)` — liest Gewichte aus JSON, liefert Plan + deutschen Snapshot; nach Finalize optional Keller (~30 %) und Serienbruch (Erker/144).
- `finalizeHauswandPlanLayout` / `polishHauswandPlan` in `hauswandFacadeLayout.ts` — Shop-Türen, Erker↔Tür, Fill, EG-Flucht.
- `applyHauswandGeneration(state, plan)` — setzt Plan auf das **aktive Gebäude** (Straßenfassade), ergänzt Rechteck-Hülle + Dach, nutzt echte Öffnungs- und Erker-APIs (`createOpening`, `insertBayAsWallSegment`, `finalizeStudioGeometry`).

## Fallstricke (v2.0.511 / v2.0.510)

- **Fassaden-Kamera ohne Dach:** Framing nur über Wand-AABB schneidet den First ab — immer `contentMaxY: sceneContentMaxY()` + `cameraElevateCm` (v2.0.511).
- **breakLong + Türspalte:** OG-Fenster über EG-Türen unterbrechen die Fensterserie (sonst erzwingt eine durchgehende 7er-Reihe unnötig einen 144er und zerstört die EG-Flucht, Seed 405147048).
- **breakLong + widthCm:** 144er-Platzierung immer auf `plan.widthCm`, nie auf `hauswandWidthCm(axes)` mappen — sonst fehlen Endfenster und der 144er driftet.
- **Fill darf die Wand nicht unkontrolliert aufweiten** — sonst explodiert die Breite in Finalize-Schleifen; begrenztes Grow max. ~1 Fensterraster.
- **breakLong + Finalize:** Erker-Center auf Achsenbreite mappen (`hauswandWidthCm`), sonst liegt der Mund nach Width-Reset außerhalb und wird verworfen.
- **Nackte Wände + Erker:** `buildingShowsBareWalls` überspringt Innenplatten, muss aber `baySoffit` / `bayMouthSunOccluder` weiter bauen.
- **Host nach Rechteck:** `pickHostWall` bevorzugt Wände mit Öffnungen (Straßenfront), nicht die breitere Seitenwand (Tiefe ~13 m).

## Fallstricke (v2.0.510) — siehe oben (v2.0.511)

## Kontrollprotokoll (CI)

`npm test -- --run src/arrivieren/` — u. a. `hauswandAudit.test.ts`: **30** Zufalls-Fassaden (`runHauswandAuditSample`) gegen `auditHauswandPlan` (Eingang, Überlappung, Mindestabstände, Fenster-Lücke ≥96, symmetrische Ränder ≤96, Erker-Gate/Uniform, Schaufenster/Keller). Apply-Test prüft nackte Erker-Wände; `hauswandSeed405147048.test.ts` Regression Flucht + Hülle.

## UI (Szene-Leiste)

Reiter **Arrivieren**: Seed-Feld, **Zufall** (neuer Seed), **Generieren** (leeres Feld = Seed beim Klick), Snapshot, optional SVG-Schematik, Feedback **Korrekt** / **Falsch** mit Regel-Tags und Notiz. Export: JSONL in Zwischenablage / Download; Persistenz `localStorage` (`fassaden-arrivieren-hauswand-feedback/v1`). Nach Generieren: Viewport-Einrahmen mit Transition.

## Feedback-Schleife

Jede Generierung: Seed + Snapshot + Plan. Nutzer markiert ok/falsch, wählt gebrochene Regeln, optional Notiz / Gewichtsvorschlag. Agent wertet JSONL aus und passt **`weights`** (und bei Bedarf Constraints) in `hauswand-regelwerk.json` an — nicht im TypeScript hardcodieren.

## Bewusst außerhalb v0.1

Volles Arrivieren (Farben, Mauerwerk, Life), Markisen, metallische Ladensäulen. `shopfrontGroup` = Stub (Tür + breite Fenster). Seiten-/Rückwände vorerst ohne Öffnungen; Gauben später.

## Dateien

| Datei | Rolle |
|---|---|
| `src/arrivieren/hauswandGrid.ts` | Breitenformel, Achsen-X |
| `src/arrivieren/hauswandFacadeLayout.ts` | Fenster-Raster 96/48 cm, Erker-Mund |
| `src/arrivieren/generateHauswand.ts` | Zufallsplan |
| `src/arrivieren/applyHauswandGeneration.ts` | State anwenden (Fassade, Rechteck-Hülle, Dach) |
| `src/arrivieren/hauswandAudit.ts` | Regel-Audit / Kontrollprotokoll |
| `src/arrivieren/hauswandFeedback.ts` | JSONL / localStorage |
| `src/arrivieren/hauswandSchematic.ts` | SVG-Vorschau |
| `src/ui/arrivierenMode.ts` | DOM-Wiring + Viewport-Frame |
| `src/arrivieren/generateHauswand.test.ts` | Vitest |
| `src/arrivieren/hauswandAudit.test.ts` | 30er-Kontrollprotokoll |
| `src/arrivieren/hauswandSeed405147048.test.ts` | Regression OG-Flucht + Hülle |
