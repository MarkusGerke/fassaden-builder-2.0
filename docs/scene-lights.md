# Bibliotheks-Lichter (Punktlicht)

Platzierbare Punktlichter aus der Element-Bibliothek — unabhängig von Sonne und automatischen Nachtlichtern.

## Nutzer

1. Unten in der Bibliothek den Tab **Licht** wählen.
2. **Punktlicht** anklicken **oder** in die Szene (3D/Front/Oben) **hineinziehen**.
3. Unter **Anzeige** (Bibliothek) oder **Szene → Licht**: **Lichtpunkte anzeigen** schaltet alle Editor-Glühen global ein/aus (Lichtwirkung bleibt).
4. **3D:** leuchtende Kugel anklicken und per **Drag** verschieben.
4. **2D-Front:** Kugel per **Drag** in der Bildebene verschieben; **Tiefe (Blickrichtung)** per Slider vor/zurück entlang der Blickachse.
5. **Rechtsklick:** **Duplizieren** oder **Licht entfernen**.
6. Rechts in `#toolbar-scene-light`: Position, Farbe, Leistung (Watt LED), Marker, Reichweite, Abfall, Schatten.

Lichter drehen mit dem Grundstück (`siteOffset`).

## Raumhülle (lichtdicht)

Ein Raum wird durch **Wände, Boden, Decke und Laibungen** begrenzt. Punktlicht darf nur durch **echte Öffnungen** entweichen:

| Durchlässig | Blockiert |
|---|---|
| Fenster-/Türöffnung in der Wand (Loch) | Wandkörper, Verkleidung, Rahmen, Sprossen |
| Klarglas (Transmission, kein Shadow-Cast) | Sichtbare Geschoss-Boden und -Decke (Innenkante) |
| Geöffnete Fenster/Tür (kein Glas im Weg) | Unsichtbare Außenring-Platten (Wandstärke, nur Shadow-Map) |
| | Rollladen (geschlossen), Laibung, **Konche**, Öffnungs-Tunnel |

Im **Render**-Modus (3D/Front) ist die Okklusion **automatisch aktiv**, sobald mindestens ein Punktlicht eingeschaltet ist.

**Warum keine Layer-Trennung fürs Licht:** Three.js WebGLRenderer beleuchtet jedes sichtbare Mesh mit jedem Licht, das die **Kamera** sieht. Objekt-Layer steuern das nicht. Deshalb:

1. **Shader-Maske** (`skipPointLights.ts`): Außen-Materialien (Paneele, Sockel, Gesimse, äußere Fensterbänke, Wand-Außenmaterial, Fensterrahmen, **Konche/Nische-Außenmaterial**) bekommen **kein Punktlicht**. **Innenwand** (Materialgruppe 1), Böden, Decken, Glas und Laibungs-Innenseite schon — sichtbar durch Fenster in 2D/Front. Innenwände nutzen **kein** Gegenlicht-Shader (`applyFacadeShadeShader`). Der Patch sitzt in `getPointLightInfo` (Three.js-Lichtfunktion), nicht nur im Fragment-Include.
2. **Konche:** sichtbare Kalotte ohne flache Okklusions-Kappen; Dichtung nur im unsichtbaren Shadow-Tunnel (`OPENING_SHADOW_TUNNEL_INFLATE_CM = 2,5`).
3. **Unsichtbare Okkluder** (`SHADOW_LAYER_OCCLUDER = 3`): Boden/Decke auf dem **Grundriss-Außenring**, mit `customDistanceMaterial` in der Punktlicht-Cube-Map.
4. **Sichtbare Böden** bleiben auf der Innenkante und der echten Fußbodenhöhe (`storeyFloorSurfaceY`) — nicht durch Kellerfenster angehoben.
5. **Wände** sind **ein Mesh** mit zwei Materialien (außen/innen).
6. **Marker im Render:** kein additives Billboard-Glühen (sticht durch Wände). Stattdessen eine kleine **opake Kugel** mit Tiefentest. Additive Glühen nur in Vorschau/Entwurf.
7. **Innen-Fill:** Bei aktivem Punktlicht im Render zusätzlich schwaches `dirLightIndoor` (nur Layer Innen).
8. **Wand-Normalen:** Außenfläche nach außen, Innenfläche in den Raum (`wallFaceNormalReverse`). Sonst ist der Freistreifen über den Paneelen ein Loch, und Innenwände erscheinen schwarz.
9. **2D-Glas:** Orthografische Front nutzt dünne Alpha-Transparenz (opacity ~0,06) statt Physical-Transmission (`setOrthographicGlassSeeThrough`).
10. **Innen-Schatten:** Innenwände bekommen Punktlicht, aber keine Cube-Selbstabschattung (`bindSkipPointShadows`).
11. **Decke/Boden:** Im 3D-Render immer weiße Innenfläche wie Wände (`createIndoorRoomSurfaceMaterial`).

**Selective Bloom:** Nur Objekte auf **BLOOM_LAYER (2)** erzeugen Bloom — im Render mit Raum-Okklusion eine kleine **HDR-Kugel** am Licht (Tiefentest, kein Billboard durch Wände). **EnvMap** nur aus dem Außen-Layer. Sonne/Hemisphere auf der Außenfassade bleiben unbeeinflusst von `uSkipPointLights`.

## Einstellungen (Toolbar)

| Feld | Default | Beschreibung |
|---|---|---|
| Position X/Y/Z | Gebäudezentrum | cm in `siteOffset`-Lokal |
| Tiefe | — | Verschiebung entlang der aktuellen Blickrichtung (2D/3D) |
| Farbe / Farbtemperatur | `3000 K` | Slider 2000–6500 K (warm → kalt); steuert Licht- und Markerfarbe live |
| Leistung (Watt LED) | `12` | Helligkeit wie LED-Lampe (10 W ≈ 800 lm); **Übernahme erst bei Enter oder Fokus-Verlust** |
| Marker anzeigen | an | Pro Licht: Editor-Glühen ausblenden |
| **Lichtpunkte anzeigen** (Szene → Licht / Bibliothek → Licht) | an | Global alle Glühen ein/aus (`viewOptions.showLightMarkers`) |
| Marker-Größe | `40` cm | Durchmesser des Glühens (8–200 cm) |
| Reichweite | `0` | Three.js `distance` in cm; `0` = unbegrenzt |
| Abfall | `2` | Three.js `decay` (0–3); höher = schnelleres Abklingen mit Entfernung |
| Licht an | an | Intensität 0 wenn aus |
| Schatten werfen | an | Cube-Shadows im Render-Modus (2D/3D); Wände, Rahmen, Verkleidung, Geschossplatten |

## Datenmodell

Persistiert in `FacadeState.sceneLights`. Hydrate: `normalizeSceneLights` in `src/utils/hydrate.ts`.

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/scene/sceneLights.ts` | CRUD, Duplizieren, Normalisierung |
| `src/FacadeController.ts` | Wandkörper, Indoor-Böden, Okkluder-Gruppe, Shader-Maske |
| `src/lighting/skipPointLights.ts` | Außen-Materialien ohne Punktlicht (WebGL-Limit) |
| `src/lighting/pointLightRoomOccluders.ts` | Unsichtbare Außenring-Platten (Layer 3) |
| `src/studio/panelGeometry.ts` | Öffnungs-Shadow-Tunnel (Konche, Keller) |
| `src/utils/layers.ts` | `effectiveStoreyFloorCapY` (Kellerfenster-Oberkante) |
| `src/lighting/selectiveBloom.ts` | Bloom nur auf BLOOM_LAYER (Licht-Marker) |
| `src/lighting/sceneLightUnits.ts` | Watt ↔ Three.js-Intensität (cm-Maßstab) |
| `src/lighting/lightGlowMarker.ts` | Weiches Glühen (Sprite, depthTest für Okklusion) |
| `src/lighting/sceneLightRuntime.ts` | THREE.PointLight + Marker/Pick |
| `src/main.ts` | Bibliothek, Pick, Toolbar, Kontextmenü |
| `index.html` | Tab „Licht“, `#toolbar-scene-light` |

## Mögliche spätere Erweiterungen

Noch **nicht** umgesetzt — bei Bedarf separat planen:

| Idee | Nutzen |
|---|---|
| **Spot-/Flutlicht** | Gerichtetes Licht, Öffnungs-Spot für Deckenstrahler |
| **Name / Ebenenliste** | Mehrere Lichter in der Ebenen-Panel-Liste verwalten |
| **Animierter Verlauf** | Helligkeit/Farbe über Zeit (Szene-Animation) |
| **An Fenster/Decke binden** | Licht folgt Öffnung oder Geschoss |
| **Gruppe / Szene-Preset** | Mehrere Lichter als Set speichern |
| **IES-Profile** | Realistische Leuchten-Abstrahlcharakteristik |

## Bekannte Grenzen

- Nur Punktlicht (kein Spot/Area).
- Schatten nur im **Render**-Darstellungsmodus; Checkbox **Schatten werfen** muss an sein.
- In **2D-Front** und **3D** bleibt Licht im Raum: Wände, Böden, Decken und Laibungen sind lichtdicht. Durch Fensteröffnungen und Glas sieht man den **Innenraum**; Paneele, Sockel und Gesimse werden vom Innenlicht nicht direkt angestrahlt.
- Three.js-Layer allein isolieren Punktlicht **nicht** — Isolation über Shader-Maske und Shadow-Okkluder.
- Marker aus: Pick-Kugel bleibt unsichtbar, Auswahl per Klick in der Nähe weiter möglich.
- Im **Render** (Raumhülle an): kein additives Billboard-Glühen — das sticht durch Wände. Stattdessen eine kleine opake Kugel. Additive Glühen nur in Vorschau/Entwurf, dort weiterhin `depthTest` gegen opake Geometrie; **Klarglas** schreibt keine Tiefe.
