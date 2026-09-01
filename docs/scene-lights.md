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
- In **2D-Front** und **3D** blockieren Wand, Rahmen, Sprossen, **Decken, Böden und Geschoss-Vollplatten** das Licht (Cube-Shadow-Map); durch Fensteröffnungen fällt es sichtbar nach außen — Glas blockiert nicht und filtert Klarglas nicht.
- Marker aus: Pick-Kugel bleibt unsichtbar, Auswahl per Klick in der Nähe weiter möglich.
- Glühen nutzt **depthTest** — Wände, Rahmen und Sprossen verdecken den Schein; **Klarglas** und **offene Öffnungen** nicht (`depthWrite: false`, Transmission ohne Farbfilter).
