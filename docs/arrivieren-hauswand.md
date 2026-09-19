# Arrivieren — Hauswand-Regelwerk v0.1

Maschinenlesbar: [`src/arrivieren/rules/hauswand-regelwerk.json`](../src/arrivieren/rules/hauswand-regelwerk.json) (Quelle der Wahrheit für Gewichte und Constraints).

## Raster (aus fassaden-builder 2.0)

| Konstante | Wert |
|---|---|
| Planraster (Legacy-Fassade) | 48 cm |
| Mauerwerk-Schritt | 8 cm (`STUDIO_MASONRY`) |
| Geschosshöhe | 448 cm (`WALL_HEIGHT`) |
| Standardfenster | 96 × 192 cm, Brüstung 128 cm |
| Rand links/rechts | 96 cm |
| Zwischenraum Fenster | 96 cm |
| Fensterbreite Zufall | 92 % × 96 cm, 8 % × 144 cm |

**Breite bei n Achsen:** `n × (Fensterbreite + 96) + 96` cm. Implementierung: `hauswandWidthCm(axes, windowWidthCm)` in `src/arrivieren/hauswandGrid.ts`.

**Erker (Rendering):** Schenkel und Rund-Erker ohne Schatten-Cast/Receive (Wand, Fenster, Laibung) — `syncLabelShadowReceivers` darf das nicht wieder anschalten (v2.0.559). Schenkel-Rahmen/Laibung dimmen wie die Wand (`facadeShadeWallLock`, v2.0.560) — sonst bleibt die Sohlbank im Schrägblick sonnenhell. Nachbarfenster am Mund ohne Fensterbänke. Graue Erker-Ränder (eigene Rahmen/Laibung-Farbe): Klärung Runde 2.

## Harte Regeln

1. Vollgeschosse 1–5 (Berlin typisch 4–5).
2. Achsen Soft 3–9, Hard max 15 nur explizit.
3. Höchstens eine große Einfahrt pro Fassade.
4. EG darf abweichen (Eingang / Einfahrt / Schaufenster / Ladengruppe / Wohnfenster); OGs fluchten, gleicher Fenstertyp pro Achse.
5. Erker: nie EG, nie oberstes Vollgeschoss; ein Typ pro Haus; nur gestapelte Achse(n); nur wenn ≥4 Geschosse und ≥4 Achsen.
6. Alle Etagen gleiche Gesamtbreite; EG-Gruppen auf ganzen Achsen; Erker-Spalte durchgängig.

## Generator

- `generateHauswand(seed, rules?)` — liest Gewichte aus JSON, liefert Plan + deutschen Snapshot.
- `applyHauswandGeneration(state, plan)` — setzt Plan auf das **aktive Gebäude** (breiteste EG-Studio-Wand oder neue Wand), nutzt echte Öffnungs- und Erker-APIs (`createOpening`, `insertBayAsWallSegment`, `finalizeStudioGeometry`).

## UI (Szene-Leiste)

Reiter **Arrivieren**: Seed, **Generieren**, Snapshot, optional SVG-Schematik, Feedback **Korrekt** / **Falsch** mit Regel-Tags und Notiz. Export: JSONL in Zwischenablage / Download; Persistenz `localStorage` (`fassaden-arrivieren-hauswand-feedback/v1`).

## Feedback-Schleife

Jede Generierung: Seed + Snapshot + Plan. Nutzer markiert ok/falsch, wählt gebrochene Regeln, optional Notiz / Gewichtsvorschlag. Agent wertet JSONL aus und passt **`weights`** (und bei Bedarf Constraints) in `hauswand-regelwerk.json` an — nicht im TypeScript hardcodieren.

## Bewusst außerhalb v0.1

Volles Arrivieren (Farben, Mauerwerk, Life), Markisen, metallische Ladensäulen. `shopfrontGroup` = Stub (Tür + breite Fenster).

## Dateien

| Datei | Rolle |
|---|---|
| `src/arrivieren/hauswandGrid.ts` | Breitenformel, Achsen-X |
| `src/arrivieren/generateHauswand.ts` | Zufallsplan |
| `src/arrivieren/applyHauswandGeneration.ts` | State anwenden |
| `src/arrivieren/hauswandFeedback.ts` | JSONL / localStorage |
| `src/arrivieren/hauswandSchematic.ts` | SVG-Vorschau |
| `src/ui/arrivierenMode.ts` | DOM-Wiring |
| `src/arrivieren/generateHauswand.test.ts` | Vitest |
