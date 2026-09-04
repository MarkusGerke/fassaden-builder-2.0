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

- **Initial:** `initCameraTarget()` setzt das Ziel über `galleryFocusBounds(getAllWalls(state))` — inkl. `originX`/`originZ` und Wand-Yaw, nicht nur Layout-`x`/`y`.
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

Während Navigation (`nav3d`, OrbitControls `start`/`change`, Pfeiltasten): `orbitLite = true` → LOD pausiert, EnvMap-Bake pausiert (v2.0.100); Pixelratio 1 außer bei aktivem Bloom ohne „bei Bewegung aus“ (v2.0.125); Bloom bleibt an (v2.0.124), außer `#bloom-disable-during-motion`; Sonnenschatten bleibt weich wie Idle (kein adaptives 1-Tap mehr, v2.0.151). Nach Loslassen: `ORBIT_LITE_HOLD_MS` (320 ms), dann wieder volles Pixelratio. Details: [performance.md](performance.md).

---

## Bekannte Fallstricke

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
