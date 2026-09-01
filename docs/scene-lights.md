# Bibliotheks-Lichter (Punktlicht)

Platzierbare Punktlichter aus der Element-Bibliothek — unabhängig von Sonne und automatischen Nachtlichtern.

## Nutzer

1. Unten in der Bibliothek den Tab **Licht** wählen.
2. **Punktlicht** anklicken **oder** in die Szene (3D/Front/Oben) **hineinziehen**.
3. **3D:** leuchtende Kugel anklicken und per **Drag** verschieben.
4. **2D-Front:** Kugel per **Drag** in der Bildebene verschieben; **Tiefe (Blickrichtung)** per Slider vor/zurück entlang der Blickachse.
5. Rechtsklick auf die Quelle → **Licht entfernen** (alternativ Button in der Toolbar).
6. Rechts: **Position (cm)** X/Y/Z, Intensität, An/Aus, Schatten.

Lichter drehen mit dem Grundstück (`siteOffset`).

## Datenmodell

| Feld | Default | Beschreibung |
|---|---|---|
| `id` | neu | Eindeutige ID |
| `x`, `y`, `z` | Gebäudezentrum + Offset | Position in cm (Weltkoordinaten) |
| `color` | `#ffaa66` | Lichtfarbe |
| `intensity` | `2800` | Punktlicht-Intensität |
| `enabled` | `true` | Sichtbar / aktiv |
| `castShadow` | `true` | Schatten (nur Render-Modus) |

Persistiert in `FacadeState.sceneLights`. Hydrate: `normalizeSceneLights` in `src/utils/hydrate.ts`.

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/scene/sceneLights.ts` | CRUD, Normalisierung, Default-Position |
| `src/lighting/sceneLightRuntime.ts` | THREE.PointLight + Marker-Mesh |
| `src/main.ts` | Bibliothek, Pick, Toolbar, `syncSceneLightRuntime` |
| `index.html` | Tab „Licht“, `#toolbar-scene-light` |

## Bekannte Grenzen

- Nur Punktlicht (kein Spot/Area).
- Schatten nur im **Render**-Darstellungsmodus; Checkbox **Schatten werfen** muss an sein.
- In **2D-Front** und **3D** blockieren Wand, Rahmen und Sprossen das Licht (Cube-Shadow-Map); durch Fensteröffnungen fällt es sichtbar nach außen — Glas selbst blockiert nicht.
- Marker: orange Kugel (`depthTest: false`) — Editor-Kugel kann vor der Fassade liegen; Lichtwirkung folgt Schatten.
