# 3D-Kamera und Orbit

Dieses Dokument beschreibt Perspektivkamera, OrbitControls und die eigene ⌘/Ctrl-Navigation in der 3D-Ansicht. Code: `src/main.ts`, Hilfsfunktionen in `src/gallery/galleryCamera.ts`.

---

## Komponenten

| Teil | Rolle |
|---|---|
| `THREE.PerspectiveCamera` | 3D-Ansicht, FOV 50°, near/far dynamisch |
| `OrbitControls` | Zoom (Mausrad), ⌘/Ctrl+Rechtsklick-Pan, interne Sphäre für Rotation |
| `nav3d` / `rotateCameraByPixels` | Eigene ⌘/Ctrl+Linksklick-Orbit (Three.js würde sonst schwenken) |
| `controls.target` | Orbit-Mittelpunkt — Gebäude-Schwerpunkt im Grundriss XZ |
| `galleryFocusBounds` | AABB-Mitte (cx, cy, cz) aller Studio-Wände für Ziel und Einrahmen |
| `sitePivot` / `siteOffset` | Gebäude-Drehung (`siteYawDeg`) um den Schwerpunkt |

---

## Orbit-Mittelpunkt (`controls.target`)

- **Initial / Reload (v2.0.203):** `focusCameraExterior()` rahmt das **gesamte** Gebäude (volle Grundriss-Spannweite). Früher deckelte `galleryFocusBounds` `span` auf 900 cm → bei größeren Häusern wirkte die Startkamera wie „eine Wand nah“. Vor dem Frame: `syncCameraDistanceLimits`, damit OrbitControls nicht auf 4000 cm klemmt.
- **3D-Ansicht:** `focusCameraExterior()` rahmt beim Wechsel nach 3D ein und setzt target/position.
- **Galerie / Doppelklick:** `focusGalleryOnWalls()` verschiebt nur das Ziel oder rahmt neu ein.
- **Kompass:** `orbitCameraToYaw()` dreht die Kamera um das bestehende Ziel, Abstand bleibt.
- **Auswahl (v2.0.155–157):** Normale Objektwahl bewegt Orbit-/Aufriss-Kamera **nicht**. 2D-Aufriss: bei gleichem Fassaden-Inhalt friert `computeFrontViewBase` **px/cm** ein (`frontViewScaleFreeze` / `viewportW`/`viewW`, `contentKey`) — kein Re-Fit, der das Haus horizontal skaliert. Fehlendes `wall.kind` wird in Hydrate zu `studio` (sonst keine Aufriss-Base). Rechte Spalte fest 340px; Bibliothek `min-height` + `scrollbar-gutter: stable`.

Der Nutzer orbitiert immer um `controls.target`. Liegt das Ziel außerhalb des Gebäudes (z. B. nur X/Y aus dem 2D-Layout, Z=0), wirkt die Drehung wie „Kamera dreht, Objekt nicht im Mittelpunkt“.

---

## Gesten (3D)

| Geste | Aktion | Implementierung |
|---|---|---|
| Linksklick / Ziehen | Auswahl, Verschieben | Bubble-`pointerdown`, OrbitControls aus |
| **⌘/Ctrl + Linksklick** ziehen | Orbit (um `controls.target`) | Capture-Phase → `beginNav3d` → `rotateCameraByPixels` → `controls.rotateLeft/Up` |
| **⌘/Ctrl + ⇧ + Linksklick** ziehen | Schwenken (Pan) | `nav3d.mode === 'pan'` → `controls.pan` mit **`keyPanSpeed`** (≈7), nicht `panSpeed` (1) |
| Rechtsklick | Kontextmenü | Capture stoppt OrbitControls |
| **⌘/Ctrl + Rechtsklick** ziehen | Schwenken | OrbitControls `RIGHT = PAN`, `enablePan` temporär |
| Mausrad | Zoom | OrbitControls Dolly |
| **⌘/Ctrl + Pfeile** | Orbit | `controls.rotateLeft/Up` |
| **⌘/Ctrl + ⇧ + Pfeile** | Schwenken | `controls.pan` mit `keyPanSpeed` |

**Warum eigene ⌘-Navigation:** OrbitControls mappt ⌘/Ctrl+Linksklick intern auf **Pan**, nicht Rotation. Die Capture-Phase auf `#three-canvas` fängt ⌘/Ctrl+LMB ab (`stopImmediatePropagation`), damit Three.js nicht schwenkt.

**Modifier-Fallback:** `modKeyHeld` (keydown/keyup Meta/Control, `blur` → false), falls `event.metaKey` beim Pointerdown fehlt.

---

## Geschwindigkeiten

| Konstante | Default (Three.js) | Nutzung |
|---|---|---|
| `rotateSpeed` | 1,35 (App) | Maus-Orbit und Pfeil-Rotation (über Viewport-Höhe skaliert) |
| `keyPanSpeed` | 7 | Tastatur-Schwenk **und** ⌘/Ctrl+⇧+Maus-Schwenk |
| `panSpeed` | 1 | Nur OrbitControls-Rechtsklick-Pan (ohne Modifier) |

Mausschwenk mit ⌘/Ctrl+⇧ nutzt bewusst dieselbe Skala wie die Pfeiltasten — `panSpeed` wäre ~7× langsamer.

---

## Performance (Orbit-Lite)

Während Navigation (`nav3d`, OrbitControls `start`/`change`, Pfeiltasten): `orbitLite = true` → LOD pausiert, EnvMap-Bake pausiert (v2.0.100); Pixelratio 1 nur in Entwurf/Vorschau — im **Render** volle Pixelratio (v2.0.197, sonst wirken weiche Schatten hart); Bloom behält ebenfalls volle Pixelratio wenn an und „bei Bewegung aus“ nicht gesetzt (v2.0.125). Bloom bleibt an (v2.0.124), außer `#bloom-disable-during-motion`. Sonnenschatten immer volles PCSS (kein 1-Tap; v2.0.151 / endgültig v2.0.197). Nach Loslassen: `ORBIT_LITE_HOLD_MS` (320 ms). Details: [performance.md](performance.md), Rule `orbit-visual-stability.mdc`.

---

## Bekannte Fallstricke

- **Startkamera in einer Wand (v2.0.203):** `galleryFocusBounds` darf die Spannweite nicht auf 900 cm kappen — das war für Galerie-Einstieg gedacht, betraf aber auch normales 3D-Einrahmen.
- **`controls.enabled = false`** während Auswahl-Drag — ⌘-Orbit deaktiviert Controls nur in `nav3d`, nicht dauerhaft.
- **Rechtsklick ohne ⌘:** kein Pan (Kontextmenü); Pan nur mit ⌘/Ctrl+Rechtsklick oder ⌘/Ctrl+⇧+Links.
- **Galerie:** engere `minDistance`/`maxDistance`, `screenSpacePanning = true`, höheres `panSpeed` (1,35) — siehe [gallery.md](gallery.md).

---

## Betroffene Dateien

| Datei | Inhalt |
|---|---|
| `src/main.ts` | Kamera, Controls, `nav3d`, Gesten, `initCameraTarget`, `focusCameraExterior` |
| `src/gallery/galleryCamera.ts` | `galleryFocusBounds`, Galerie-Limits |
| `docs/ux.md` | Kurzreferenz Navigation (verlinkt hierher) |
