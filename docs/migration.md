# Persistenz-Schema und Element-Hydration

## Problem

Ohne kanonische Hydration entstehen zwei Welten: Bibliothek-Elemente haben alle Felder, Alt-Saves fehlen Nested-Configs → UI-Sektionen fehlen, Renderer füllen Defaults nur flüchtig.

## Pipeline beim Laden

```
JSON (localStorage / Hash / Datei)
  → migrateFacadeSchema (schemaVersion → FACADE_SCHEMA_VERSION)
  → hydrateFacadeState (fehlende Felder, Feature AUS)
  → clampFacadeState (Maße, Raster, Gebäude)
  → repairPlanLinkedWallFronts
  → fitStateWallsToOuterSpine (nur bei Mehrheit `panelFlip: false`)
  → finalizeStudioGeometry (Grundriss-Sync, Öffnungs-Front, Gehrung)
```

Gemeinsamer Einstieg: [`src/utils/facadeLoad.ts`](../src/utils/facadeLoad.ts) `applyFacadeLoadPipeline` (genutzt von Persistenz, Share-Hash, Datei-Import).

| Schritt | Datei | Rolle |
|---|---|---|
| Schema-Leiter | [`src/utils/schemaMigrations.ts`](../src/utils/schemaMigrations.ts) | Dokumentierte Rewrites (dürfen Optik ändern) |
| Hydrate | [`src/utils/hydrate.ts`](../src/utils/hydrate.ts) | Feldkatalog vervollständigen, Feature **aus** |
| Clamp | [`src/utils/walls.ts`](../src/utils/walls.ts) `clampFacadeState` | inkl. Hydrate bei jedem Apply |
| Abgeleitet | [`src/studio/planGeometry.ts`](../src/studio/planGeometry.ts) `finalizeStudioGeometry` | Grundriss, Bank-`flipForward`, Gehrung — **kein** `panelFlip` |
| Außenkante | `fitStateWallsToOuterSpine` wenn `buildingNeedsOuterSpineFit` (Mehrheit `panelFlip: false`) | Origin = Außenecke, Dicke nach innen; v0.7.280 richtet die Außenlinie an der Plan-Kante aus. **v2.0.93:** keine Fit-Heuristik mehr über „unverbundene Ringe“ — die verschob Wände beim Hard-Reload |
| Persistenz | [`src/utils/persistence.ts`](../src/utils/persistence.ts) | Speichert immer `FACADE_SCHEMA_VERSION` |

`APP_VERSION` (Nutzer-Release) und `FACADE_SCHEMA_VERSION` (Datenmodell) sind **getrennt**.

Strukturelle Alt-Formen (`walls[]` → `buildings[]`) bleiben in `migrateToBuildings` innerhalb von `clampFacadeState` (kein Schema-Step).

## Drei Migrationsarten

| Art | Wann | Optik |
|---|---|---|
| **Hydrate** | Jedes Load / Clamp | Unverändert (Feature aus / neutral) |
| **Migrate** | `schemaVersion` N→N+1 | Bewusst, dokumentiert hier + Architecture-Changelog |
| **Rebuild** | Breaking / Major | `needsReview` am Element + Statuszeile; kein stilles Chaos |

### Breaking / `needsReview`

Wenn kein sicherer Auto-Migrate möglich ist:

1. Schema-Step setzt `opening.needsReview` bzw. `wall.needsReview` (Kurzcode/Hinweis).
2. Beim Load: Statuszeile „Projekt aus älterer Version — bitte markierte Elemente prüfen“ (`facadeHasNeedsReview`).
3. UI zeigt Controls weiter (Sichtbarkeit nach Typ, nicht nach Feld-Existenz).
4. Nutzer bestätigt/passt an → Feld entfernen.

## Hydrate-Politik

Fehlende Nested-Objekte anlegen mit `enabled: false` bzw. neutralen Defaults (Trim-Offsets 0, Glas `tint`, Verdachung/Treppe aus). **Nicht** wie ein frisches Bibliothek-Preset einschalten.

Ausnahme: Fensterbänke werden bei fehlenden Keys weiter mit denselben Defaults angelegt wie früher `ensureWindowSills` (Optik-Erhalt alter Projekte). `Opening.motion` (v0.7.165) wird analog hydriert (Fenster-/Tür-Defaultkurven); die Ruhepose der Flügel ändert sich nicht, bis der Nutzer abspielt.

`createOpening` / `createStudioWall` / Modul-Öffnungen rufen dieselbe Hydrate-Basis auf; Presets überschreiben danach.

Gebäude-Flag `Building.bareWalls` (v0.7.312): Hydrate setzt fehlendes Feld auf `false` — nur Darstellung (weiße Vollwände), kein Schema-Step.

## UI-Sichtbarkeit

Sections an **Elementtyp + Kontext** koppeln (`type === 'window'|'door'`, nicht Keller), **nicht** an „Feld schon persistiert“. Nach Hydrate sind die Felder sowieso da.

## Neues persistiertes Feld (Checkliste)

1. Typ in `src/types/facade.ts`
2. Default in `hydrateOpening` / `hydrateWall` (Feature aus)
3. `create*` nutzt Hydrate
4. Optik alter Saves ändern? → neuer Eintrag in `SCHEMA_MIGRATIONS`, `FACADE_SCHEMA_VERSION` +1, Docs
5. Test: Alt-JSON ohne Feld → nach Load Feld vorhanden (`src/utils/schemaHydrate.test.ts`)

## Korrektur an Bestandsdaten (Checkliste)

Wenn ein Bug nur **neue** Elemente richtig macht, Bestandsprojekte aber falsch bleiben: nicht „Nutzer soll neu zeichnen“. Stattdessen eine der drei Schichten — dieselbe Regel für Wände, Fenster, Profile, Sockel, Gesims.

| Schicht | Wann | Darf Optik ändern? | Beispiele |
|---|---|---|---|
| **Hydrate** | Jedes Load | Nein (Feature aus / Feld ergänzen) | neues Nested-Objekt an Opening/Wall |
| **Abgeleitet neu rechnen** | Jedes Load in `finalizeStudioGeometry` | Nur Werte, die **nicht** die Nutzer-Absicht sind | Gehrung aus Nachbarn, Grundriss aus Wandkanten, Fensterbank-`flipForward` aus `panelFlip` |
| **Schema-Step** | Einmal `N → N+1` | Ja, dokumentiert | falsche IDs, invertierte Wand-Pose (`origin`/`yaw`/`panelFlip`) |

**Nicht** jedes Load: `panelFlip`, Yaw oder Origin überschreiben — sonst gehen bewusste Front-Drehungen beim nächsten Öffnen verloren. Ausnahme: **Mehrheit** der verknüpften Wände hat `panelFlip: false` (Innen-Origin-Altstand) → `fitStateWallsToOuterSpine`. Freistehende oder schlecht vernetzte `planLinked`-Wände allein lösen **keinen** Fit aus (v2.0.93).

**Profile / Gesims / Sockel:** Sweep entsteht zur Renderzeit aus Wandzustand. Nach Pose-/Gehrungs-Repair folgen sie von selbst. Nur wenn ein **gespeichertes** Profil-Feld falsch ist (z. B. alte ID), gehört das in einen Schema-Step.

**Hash- und Datei-Import** tragen seit **v2.0.142** eine `schemaVersion` (`SharePayload.schemaVersion`, Export-JSON `schemaVersion` neben der Fassade) und starten dort. **Ohne** Feld (alte Links/Dateien) starten sie bei `FACADE_SCHEMA_IMPORT_BASE` (7) und spielen alle Steps erneut. Schema-Steps müssen daher **idempotent** sein, sobald die Daten schon stimmen — `align-masonry-openings` (13→14) ist es gegen das 4-cm-Clamp **nicht** exakt (Steinmitte-Kandidaten), weshalb der Mehrfachlauf die Fenster um 4 cm verschob. Der eigene Live-Hash lädt deshalb nicht mehr beim Reload (siehe [ux.md](ux.md#url-hash-live-srcutilssharets)); Regressionstest `src/utils/facadeLoad.idempotent.test.ts`.

Idempotente Bestands-Repairs (z. B. invertierte Plan-Fugen) laufen in `applyFacadeLoadPipeline` **nach Clamp zusätzlich immer**, nicht nur im Schema-Step — sonst überspringt eine schon gespeicherte `schemaVersion` den Repair. Orientierung per BFS vom Samen aus (jede Wand höchstens einmal umkehren), damit eine Abzweig-Wand nicht zwischen zwei Fugen hin- und herkippt.

Checkliste für den nächsten Fix:

1. Ist der Wert abgeleitet? → in `finalizeStudioGeometry` (alle Gebäude, nicht nur das aktive).
2. Ist ein persistierter Wert falsch (Pose, Flip, ID)? → `SCHEMA_MIGRATIONS`, `FACADE_SCHEMA_VERSION` +1, Fixture-Test mit Alt-Stand, Eintrag hier + Architecture-Changelog.
3. Öffnungen an der Wand: lokales `x` mitdrehen, wenn die Wand 180° umgekehrt wird (`width − x − opening.width`).
4. Erker-/Endstück-Wände nicht automatisch umdrehen.

## Aktuelle Schema-Version

Siehe `FACADE_SCHEMA_VERSION` in `schemaMigrations.ts` (aktuell **14**).

| Step | id | Wirkung |
|---|---|---|
| 8 → 9 | `panel-fan-to-clearance` | Legacy `arch.panelFan` → `panelClearance.finish: 'taper'` |
| 9 → 10 | `depth-offset-neg24-and-sockel-id` | `windowDepthOffset`/`depthOffset` −24 → 0; `sockelStandard` → `sockelprofil` |
| 10 → 11 | `repair-linked-wall-inverted-joints` | Plan-Fuge mit zwei Starts oder zwei Enden (Grad 2): Blatt-Wand 180° (Ende an der Fuge), Bandseite an den Nachbarn; Öffnungen bleiben am Ort. Derselbe Repair läuft in `applyFacadeLoadPipeline` nach Clamp immer (v0.7.223). |
| 11 → 12 | `unchanged-defaults-sill-glass` | Außenbank-Tiefe: alte Code-Defaults (20/32/36/40/48) und Werte über 16 cm → 16 cm Maximum; Nutzerwerte darunter bleiben. Klarglas: `tint`+transparent → `physical`; Transmission 0,9/0,96/0,42 → **0** (echte Durchsicht + Spiegelung). **Regel:** geänderte Code-Defaults gelten für Bestands-Elemente, solange der gespeicherte Wert noch dem alten Default entspricht. |
| 12 → 13 | `indoor-white-defaults` | Innenwand `interiorColor` Default Weiß. Decke/Boden: fehlende Farbe und alte Fallbacks `#9a8a7a` / `#8a7a6a` → Weiß; abweichende Nutzerfarben bleiben. |
| 13 → 14 | `align-masonry-openings` | Bei Läufer-/Mauerwerksverband: Öffnungs-`x`/`y`/`width`/`height` auf Fugen und Schichten (`alignOpeningToMasonry`). Idempotent. Bei Überlappung nach Snap bleibt die Öffnung. Rundbogen: Stichmaß folgt der neuen Breite, wenn es zuvor ein Halbkreis war. |

**Hydrate ohne Schema-Step (v0.7.247):**

- `panel.jointColor`: optional; fehlt → Mörtel `#c8c0b8`.
- `normalizeStudioPanel`: bei `tileColorVariance > 0` und `tileColorVariety <= 0` → Häufigkeit 40.
- Neue Öffnungen: `glassMode: 'tint'` (kein erzwungenes `physical` mehr in `migrateOpeningUnchangedDefaults` für Klarglas).

Alte `hdri*`-Felder in `PersistedAppState.scene` werden ignoriert (HDRI entfernt, v0.7.136).

### Hydrate ohne Schema-Step (v0.7.285) — Bogenhöhe / Korbbogen

- `Opening.arch.riseCm`: optional; fehlt → Form-Standard (`resolveArchRiseForOpening`). Normalize rastert und speichert nur positive Werte.
- Legacy `arch.form: 'basket'` → `'ellipse'` in `normalizeArchFormId` / `normalizeOpeningArch` (kein Schema-Bump; Optik ≈ Ellipse).
- Verdachung: gleiche Basket→Ellipse-Map in `pediment.ts`.

### Hydrate ohne Schema-Step (v2.0.150) — Fade / DaySchedule

- `SceneLight.fadeInMs` / `fadeOutMs` / `schedule`, `Opening.schedule`, `OpeningRollerShutter.schedule`: Defaults beim Normalize/Hydrate (leere Zeiten, Fade 800/1200 ms). Kein `FACADE_SCHEMA_VERSION`-Bump.
