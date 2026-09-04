# Bibliotheks-Lichter

Platzierbare Lichter aus der Element-Bibliothek — unabhängig von Sonne und automatischen Nachtlichtern. Omni = `PointLight`; gerichtet (unten/oben) = `SpotLight`(s) entlang ±Y.

## Nutzer

1. Unten in der Bibliothek den Tab **Licht** wählen.
2. Eine **Voreinstellung** wählen (**Laterne**, **Deckenlampe**, **Stehlampe**, **Leselampe**, **Fassadenlampe**) — Klick oder Drag in die Szene (3D/Front/Oben).
3. Unter **Anzeige** (Bibliothek) oder **Szene → Licht**: **Alle Lichter an** schaltet alle Punktlichter ein/aus; **Lichtpunkte anzeigen** schaltet nur die Editor-Glühen (Lichtwirkung bleibt).
4. **3D / 2D-Front:** leuchtende Kugel anklicken und **ziehen** — bewegt sich nur **horizontal** (Höhe bleibt; in Front entlang der Bildebene links/rechts). **Shift** halten und ziehen = nur **vertikal** (Höhe).
5. **2D-Front:** zusätzlich **Tiefe (Blickrichtung)** per Slider vor/zurück entlang der Blickachse.
6. **Ebenenbaum (links):** Sektion **Lichter** — Einträge heißen nach Art (`Laterne`, `Blaulicht 2`, …). **Shift+Klick** Mehrfachauswahl → Mehr-Menü **Gruppieren**. Gruppenzeilen aufklappbar; Klick wählt alle Mitglieder. Pro Licht: Ausblenden, Duplizieren, Aus Gruppe lösen, Entfernen. Sektions-Mehr-Menü: **Punktlicht einfügen**, **Alle Lichter an/aus**.
7. **Rechtsklick** in der Szene: **Duplizieren** oder **Licht entfernen**.
8. Rechts in `#toolbar-scene-light`: Voreinstellung, Abstrahlung, Winkel, Position, Farbe, Leistung (Watt LED), Marker, Reichweite, Abfall, Schatten, **Ein-/Ausblenden (ms)**, **Uhrzeiten** Ein/Aus.

Lichter drehen mit dem Grundstück (`siteOffset`).

## Voreinstellungen & Abstrahlung (v2.0.124)

| Preset | Default-Modus | Winkel ↓ / ↑ | Typisch |
|---|---|---|---|
| Laterne | Omni | 70° / 50° | Warm, rundum |
| Deckenlampe | Nur unten | 68° / 40° | Breite Deckenleuchte |
| Stehlampe | Unten + oben | 55° / 72° | Indirekt + Lesen |
| Leselampe | Nur unten | 32° / 25° | Enger Spot |
| Fassadenlampe | Nur unten | 48° / 30° | Wandfluter nach unten |
| Blaulicht | Omni | — | `#0a3dff`, Doppelblitz ~2 Hz (Feuerwehr/Polizei) |

- **Abstrahlung:** Alle Richtungen · nur unten · nur oben · unten und oben (`beamMode`).
- **Winkel:** Spot-Halbwinkel 10…90° (`beamAngleDownDeg` / `beamAngleUpDeg`); Zeilen ausgeblendet, wenn der Modus sie nicht braucht.
- Manuelle Änderung an Abstrahlung/Winkel löst die Preset-Markierung (`preset: undefined`); Preset-Karte setzt Werte neu.
- **Blaulicht:** feste Farbe (kein Kelvin), Animation `animation: 'blaulicht'` (Doppelblitz 500 ms Zyklus); Checkbox **Blaulicht blinken** in der Toolbar; Live-Frames solange aktiv (`sceneLightAnimation.ts`).
- **v2.0.126 — Phasen:** Mehrere aktive Blaulichter teilen den Zyklus gleichmäßig (`blaulichtPhaseOffsetsById`) — gleicher Abstand, versetzt zueinander.
- **v2.0.126 — Gruppen:** `FacadeState.sceneLightGroups` + `SceneLight.groupId`; Ebenenbaum mit Gruppenzeilen.
- Defaults: `src/scene/sceneLightPresets.ts`. Runtime: `src/lighting/sceneLightRuntime.ts` (Group + Point + SpotDown + SpotUp).

## Raumhülle (lichtdicht)

Ein Raum wird durch **Wände, Boden, Decke und Laibungen** begrenzt. Punktlicht darf nur durch **echte Öffnungen** entweichen:

| Durchlässig | Blockiert |
|---|---|
| Fenster-/Türöffnung in der Wand (Loch) | Wandkörper, Verkleidung, Rahmen, Sprossen |
| Klarglas (Transmission, kein Shadow-Cast) | Sichtbare Geschoss-Boden und -Decke (**Innenkante** + 1 cm Inset, v2.0.129) |
| Geöffnete Fenster/Tür (kein Glas im Weg) | Unsichtbare Außenring-Platten (Backup wenn Platten aus, nur Shadow-Map) |
| | Rollladen (geschlossen), Laibung, **Konche**, Öffnungs-Tunnel |

Im **Render**-Modus (3D/Front) ist die Okklusion **automatisch aktiv**, sobald mindestens ein Punktlicht eingeschaltet ist.

**v2.0.102 — physikalisch:** Punktlicht beleuchtet **Fassade und Innenraum** (beide Layer). Lichtdichte nur über **Cube-Shadows** und Okkluder — nicht mehr über Shader-Skip der Außenflächen. Innenwände/Böden/Decken empfangen wieder Punktlicht-Schatten (Wände, Sprossen, Rahmen).

1. **Cube-Shadows:** Wände, Verkleidung, Rahmen, Laibung, Geschossplatten und unsichtbare Außenring-Okkluder (`SHADOW_LAYER_OCCLUDER`) werfen in die Punktlicht-Cube-Map (`customDistanceMaterial` wo nötig). **v2.0.107:** Okkluder 100 cm dick + Stoßplatte 160 cm zwischen Etagen; `normalBias` 0,25 cm; Indoor-Platten und `sunCeilingOccluder` casten bei Raum-Okklusion immer. **v2.0.111 / v2.0.118 / v2.0.141:** 2D-Front Cube-Map **4096**; Soft-Würfel-Filter entfernt — Hard-Cube; `shadow.camera.far` folgt Reichweite bzw. **Site-Diagonale + Puffer** (nicht mehr 500 m bei unbegrenzter Distanz).
2. **Konche:** sichtbare Kalotte ohne flache Okklusions-Kappen; Dichtung nur im unsichtbaren Shadow-Tunnel (`OPENING_SHADOW_TUNNEL_INFLATE_CM = 2,5`).
3. **Unsichtbare Okkluder** (`SHADOW_LAYER_OCCLUDER = 3`): Boden/Decke auf dem **Grundriss-Außenring**, mit `customDistanceMaterial` in der Punktlicht-Cube-Map.
4. **Sichtbare Böden/Decken (v2.0.92)** reichen bis zur **Fassaden-Außenkante** (Plan-Ring); sie casten bei Raum-Okklusion immer (auch ausgeblendet) und nutzen `customDistanceMaterial`. Nicht durch Kellerfenster angehoben (`storeyFloorSurfaceY`). **v2.0.121:** Kerben an Öffnungen, die die Platte schneiden/berühren (`slabNotches.ts`).
5. **Wände** sind **ein Mesh** mit zwei Materialien (außen/innen). Wandunterseite bleibt neben Bodentüren geschlossen (nur unter der Schwelle offen).
6. **Marker im Render:** kein additives Billboard-Glühen (sticht durch Wände). Stattdessen eine kleine **opake Kugel** mit Tiefentest. Additive Glühen nur in Vorschau/Entwurf.
7. **Innen-Fill:** Bei aktivem Punktlicht im Render zusätzlich schwaches `dirLightIndoor` (nur Layer Innen).
8. **Wand-Normalen:** Außenfläche nach außen, Innenfläche in den Raum (`wallFaceNormalReverse`). Sonst ist der Freistreifen über den Paneelen ein Loch, und Innenwände erscheinen schwarz.
9. **2D-Glas:** Orthografische Front nutzt dünne Alpha-Transparenz (opacity ~0,06) statt Physical-Transmission (`setOrthographicGlassSeeThrough`).
10. **Innen-Schatten:** Innenwände, Böden und Decken empfangen Cube-Shadows (seit v2.0.102; früher `bindSkipPointShadows`-Workaround entfernt). **Sockel (v2.0.103 / v2.0.116)** und **Laibung (v2.0.105 / v2.0.116):** empfangen bei Raum-Okklusion **und** bei Sonnen-Werfschatten (`claddingReceiveShadows`) — sonst schienen Innenlicht bzw. verdeckte Sonne ungefiltert durch.
11. **Decke/Boden:** Innenfläche wie Wände (`createIndoorSlabMaterial`: EnvMap, kein Gegenlicht-Dim). Default weiß; `FloorPlan.ceilingColor` steuert die Albedo.
12. **Legacy:** `uSkipPointLights` / `bindSkipPointLights` bleiben im Code, sind aber standardmäßig **aus** (`setSkipPointLights(false)`).

**Selective Bloom:** Entfällt seit v2.0.104 — Full-Scene `UnrealBloomPass`. HDR-Kerne an Lichtquellen bleiben optional; Bloom erfasst helle Flächen der ganzen Szene.

## Einstellungen (Toolbar)

| Feld | Default | Beschreibung |
|---|---|---|
| Position X/Y/Z | Gebäudezentrum | cm in `siteOffset`-Lokal |
| Tiefe | — | Verschiebung entlang der aktuellen Blickrichtung (2D/3D) |
| Farbe / Farbtemperatur | Farbe `#ffaa66` · Temp `3000 K` | **Farbe** per Color-Picker; **Farbtemperatur** 2000–6500 K setzt die Farbe aus Kelvin. Manuelle Farbe bleibt, bis die Temperatur erneut bewegt wird. |
| Leistung (Watt LED) | `12` | Helligkeit wie LED-Lampe (10 W ≈ 800 lm); Live-Vorschau beim Tippen, History bei Enter/Fokus-Verlust (v2.0.146) |
| Marker anzeigen | an | Pro Licht: Editor-Glühen ausblenden |
| **Alle Lichter an** (Szene → Licht / Bibliothek → Licht) | an (wenn Lichter existieren) | Schaltet alle `sceneLights[].enabled` gemeinsam (`setAllSceneLightsEnabled`) |
| **Lichtpunkte anzeigen** (Szene → Licht / Bibliothek → Licht) | an | Global alle Glühen ein/aus (`viewOptions.showLightMarkers`) |
| **Bloom an** (Szene → Licht, unter Lichtpunkten) | aus | Full-Scene-Bloom; Optionen ausgeblendet wenn aus |
| **Bloom bei Kamerabewegung aus** | aus (unchecked) | Wenn an: Bloom während Orbit/Zoom aus (wie früher Orbit-Lite). Default: Bloom bleibt auch beim Navigieren an. **v2.0.125:** Bei Bloom an und dieser Option aus bleibt die Pixelratio beim Orbit voll — kein Qualitätswechsel des Glühens. |
| Voreinstellung | — | Laterne / Deckenlampe / Stehlampe / Leselampe / Fassadenlampe / Blaulicht |
| Abstrahlung | `omni` | Omni · unten · oben · unten+oben |
| Winkel unten / oben | `60`° / `55`° | Spot-Halbwinkel; nur sichtbar wenn relevant |
| Blaulicht blinken | aus (außer Preset) | Doppelblitz ~2 Hz; Preset Blaulicht startet an |
| Marker-Größe | `40` cm | Durchmesser des Glühens (8–200 cm) |
| Reichweite | `0` | Three.js `distance` in cm; `0` = unbegrenzt |
| Abfall | `2` | Three.js `decay` (0–3); höher = schnelleres Abklingen mit Entfernung |
| Licht an | an | Zielzustand; Intensität = Watt × Animation × **Fade** |
| Einblenden / Ausblenden (ms) | `800` / `1200` | Weiches An/Aus (`fadeInMs` / `fadeOutMs`); kein Shadow-Rebake pro Frame |
| Uhrzeiten Ein/Aus | leer | `DaySchedule`; parallel zu „Lichter mit Sonne“: `desiredOn = (autoSun && Nacht) \|\| scheduleSaysOn`. Leer = nur Sonne |
| Schatten werfen | an | Cube-Shadows im Render-Modus (2D/3D); Wände, Rahmen, Verkleidung, Geschossplatten |

## Datenmodell

Persistiert in `FacadeState.sceneLights`. Hydrate: `normalizeSceneLights` / `normalizeSceneLight` (inkl. Fade + Schedule, **kein** Schema-Bump).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/scene/sceneLightPresets.ts` | Preset-IDs, Beam-Modi, Default-Winkel/Leistung |
| `src/scene/sceneLightAnimation.ts` | Blaulicht-Doppelblitz-Faktor, Live-Frame-Erkennung |
| `src/scene/sceneLights.ts` | CRUD, Duplizieren, Normalisierung, Preset anwenden |
| `src/FacadeController.ts` | Wandkörper, Indoor-Böden, Okkluder-Gruppe, Distance-Material |
| `src/lighting/skipPointLights.ts` | Legacy-Shader-Maske (Default aus) |
| `src/lighting/pointLightRoomOccluders.ts` | Unsichtbare Außenring-Platten (Layer 3) |
| `src/studio/panelGeometry.ts` | Öffnungs-Shadow-Tunnel (Konche, Keller) |
| `src/utils/layers.ts` | `effectiveStoreyFloorCapY` (Kellerfenster-Oberkante) |
| `src/lighting/selectiveBloom.ts` | `enableBloomLayer` (optional HDR-Kerne); Bloom selbst in `main.ts` |
| `src/lighting/sceneLightUnits.ts` | Watt ↔ Three.js-Intensität (cm-Maßstab) |
| `src/lighting/lightGlowMarker.ts` | Weiches Glühen (Sprite, depthTest für Okklusion) |
| `src/lighting/sceneLightRuntime.ts` | Point- und SpotLight(s) + Marker/Pick + Fade |
| `src/utils/daySchedule.ts` | Uhrzeit-Schedule Eval |
| `src/ui/dayScheduleEditor.ts` | Ein-/Aus-Listen in der Toolbar |
| `src/main.ts` | Bibliothek, Pick, Toolbar, Kontextmenü, Soft-Auto-Sonne |
| `index.html` | Tab „Licht“, `#toolbar-scene-light` |

## Mögliche spätere Erweiterungen

Noch **nicht** umgesetzt — bei Bedarf separat planen:

| Idee | Nutzen |
|---|---|
| **Spot-/Flutlicht** | Gerichtetes Licht, Öffnungs-Spot für Deckenstrahler |
| **Name / Ebenenliste** | erledigt (v2.0.126): Art + Nummer |
| **Animierter Verlauf** | Helligkeit/Farbe über Zeit (Szene-Animation) |
| **An Fenster/Decke binden** | Licht folgt Öffnung oder Geschoss |
| **Gruppe / Szene-Preset** | Lichtgruppen erledigt (v2.0.126); Szene-Presets offen |
| **IES-Profile** | Realistische Leuchten-Abstrahlcharakteristik |

## Bekannte Grenzen

- Omni = PointLight; gerichtet = SpotLight(s) entlang Welt-Y (kein horizontaler Wand-Spot / Area).
- Fassadenlampe flutet aktuell nach **unten**, nicht horizontal aus der Wand.
- Schatten nur im **Render**-Darstellungsmodus; Checkbox **Schatten werfen** muss an sein.
- In **2D-Front** und **3D** bleibt Licht im Raum bzw. vor der Fassade: Wände, Böden, Decken und Laibungen sind lichtdicht. Durch Fensteröffnungen und Glas sieht man den **Innenraum**; Außenlicht erhellt die Fassade sichtbar.
- Marker aus: Pick-Kugel bleibt unsichtbar, Auswahl per Klick in der Nähe weiter möglich.
- Im **Render** (Raumhülle an): kein additives Billboard-Glühen — das sticht durch Wände. Stattdessen eine kleine opake Kugel. Additive Glühen nur in Vorschau/Entwurf, dort weiterhin `depthTest` gegen opake Geometrie; **Klarglas** schreibt keine Tiefe.
- **Streifen-Fugen:** Tiefe Fugen (`jointDepth`) liegen im Schatten der vorstehenden Bahnen — bei Punktlicht wirken die Nuten deutlich dunkler als die Bahnflächen (physikalisch korrekt). Läuferverband wirkt heller, weil die Fugen schmaler und unterbrochen sind.
- **v2.0.122:** Änderung an `sceneLights` (einfügen, löschen, Undo) bäckt die Shadow-Map **sofort**. Vorher nur verzögert bei Raum-Okklusion — frische Punktlichter ohne Cube-Map dunkelten Paneele/Fugen dauerhaft ab.
- **v2.0.141:** Licht-only ohne Fassaden-Rebuild (`stabilizeFloorPlanIds`); Bake nur Shadow-Maps (`flushShadowMapsOnly`), kein Sonnen-/EnvMap-Pfad; Occluder nur bei Okklusion an/aus; `shadow.camera.far` an Site-Diagonale statt 50 000 cm; Auswahl backt keine Maps.
- **v2.0.146:** Licht-Ops wieder **sofort** spürbar: früher Pfad ohne Grundriss-Sync; Schatten nur noch `scheduleShadows` (kein Sync-Flush, kein `flushSunShadowMap` am Drag-Ende); Toolbar-Felder live per `previewSelectedSceneLight`, History bei `change`.
- **v2.0.147:** Duplizieren backt nur noch das **neue** Licht (und verschobene), nicht Sonne + alle Cubes — `shadow.autoUpdate = false` / per-light `needsUpdate`.
- **v2.0.149:** Auto-Lichter bei Dämmerung ohne Hitch: Soft-Toggle ohne `applyState`; Raum-Okkluder bleiben solange Lichter existieren; Re-Enable nutzt vorhandene Cube-Maps.
- **v2.0.123:** Nischen (`fill.mode === 'niche'`) bekommen Shadow-Tunnel-Kappen an Rückwand und Innenkante — kein Lichtleck durchs Wandloch mehr. Fugen nutzen Paneel-Finish + glattere Roughness für sichtbares Glanzlicht.
- **v2.0.124:** Licht-Voreinstellungen + Spot-Abstrahlung; Bloom bleibt beim Navigieren an (optional aus).
- **v2.0.125:** Bloom-Pixelratio stabil bei Orbit; Preset Blaulicht mit Doppelblitz-Animation.
- **v2.0.126:** Blaulicht-Phasen versetzt; Ebenen-Namen nach Art; Lichtgruppen.
- **v2.0.127:** Auto an/aus mit Sonne (`autoSceneLightsWithSun`); Master-Pause / Tageszyklus unter Szene → Animation.
- **v2.0.130:** Tagesdauer einstellbar (`dayCycleRealMinutes`); einmaliger Tagesverlauf entfernt; Ebenen ohne Badge „Licht“, nur Typname; Nischen/Konchen ohne Selbstschatten.
