# Schneefall / Winterwetter

## Verhalten für den Nutzer

Unter **Szene → Wetter**:

| Steuerung | Default | Wirkung |
|---|---|---|
| **Schneefall** | aus | Master-Schalter |
| **Lufttemperatur (°C)** | −2 | Unter 0 °C bleibt Schnee liegen und wächst; darüber schmilzt die Decke (bei Wärme binnen Sekunden) |
| **Intensität** | 0,55 | Niederschlagsstärke (Flocken + Wachstumsrate) |
| **Qualität** | Niedrig | Niedrig ≈ 6,5k Flocken; Hoch ≈ 28k — auch beim Orbit |

- In **Vorschau** und **Render**, in **3D** und **Fassade** (`present`) — nicht Entwurf, nicht 2D.
- **Fassade:** Flocken spawnen zwischen Kamera und Hausfront; Wechsel zu Fassade hebt Entwurf auf Vorschau (dort kein Darstellungs-Umschalter).
- Schnee **bleibt liegen** auf: **Dach** (auch steiler), **Boden**, und horizontalen Details **≤ ~15°** (Gesimse, Zierbänder, Fensterbänke, Verdachungen, Rollladenkästen, Erker-Soffit-Oberseite). Senkrechte Fassade bleibt schneefrei.
- Liegende Decke: **Hof** über Ground-Mood (`uGroundSnowCover`, Luma-Mix nach dem Licht — Schatten bleiben). **Dach/Decke/≤15°** über Coverage-Shader v6 (gleicher Luma-Mix). Zusätzlich bleiben Flocken auf Landepads liegen (sichtbare Schicht). Kein Overlay, kein Vertex-Displace, kein Albedo-Lerp auf `groundMat`.
- Innenboden ohne Decke. Landepads exakt auf Mesh-AABB (kein Expand).
- Flocken ~5 cm Weltmaß (`sizeAttenuation`); Spawn über dem Dach, Fassade kamera-nah. Intensität = Falldichte. Mindestens ~40 % bleiben am Fall, bis ~60 % dürfen liegen — Fall versiegt nicht.
- **Kein** Schnee auf Glas, Markisenstoffen, Lamellen.
- **Pfützen** crossfaden mit Temperatur/Decke (kalt → weg, Schmelze → Nässe).
- **Herbstlaub** und Schnee schließen sich aus (Schnee an → Laub unsichtbar).
- Himmel leicht **überzogen** (Sonne gedämpft, Diffus höher), solange Schnee aktiv.
- **Animationen pausieren** gilt **nicht** für Schnee (nur Fenster/Blaulicht/Tageszyklus).
- Persistenz: nur die **Einstellungen**, nicht die aktuelle Deckenhöhe (Reload → Decke 0).

## Technik

| Datei | Rolle |
|---|---|
| [`src/lighting/snowWeather.ts`](../src/lighting/snowWeather.ts) | Settings, Rates, Pfützen-/Overcast-Hilfen, Partikelbudget |
| [`src/lighting/snowCoverage.ts`](../src/lighting/snowCoverage.ts) | Material-`onBeforeCompile`: Neigung + Himmelssicht, Luma-Mix nach dem Licht — **nicht** auf `groundMat` |
| [`src/lighting/groundMood.ts`](../src/lighting/groundMood.ts) | Hof-Schnee: `uGroundSnowCover` nach PCSS (Luma → Schneeweiß, Schatten bleiben) |
| [`src/scene/snowRuntime.ts`](../src/scene/snowRuntime.ts) | Points-Flocken (Fall + liegen), Landepads (ohne Overlay-Meshes), Ortho-Höhenmap |
| [`src/FacadeController.ts`](../src/FacadeController.ts) | `applySnowCoverageMaterials` nach Rebuild (Render) |
| [`src/main.ts`](../src/main.ts) | UI, Tick, Persistenz, Overcast, Pfützen-Scale, Laub-Exklusion |
| [`packages/ui/.../SceneToolbarApp.tsx`](../packages/ui/src/bridge/islands/SceneToolbarApp.tsx) | Park: Accordion **Wetter** (sichtbar ohne Auswahl) |
| [`index.html`](../index.html) | Vanilla-Sektion Wetter (ID-Quelle) |

### Datenfluss

1. Nutzer schaltet Schneefall an → `snowSettings` persistiert, Cover startet bei 0,35.
2. Jeder gerenderte Frame: `snowRuntime.tick` (Akkumulation/Schmelze, Flocken, Landepads).
3. Uniforms `uSnowCover` auf Fassaden-/Dach-Materialien; `uGroundSnowCover` auf dem echten Boden.
4. Occlusion: Ortho-Kamera von oben, Shader schreibt Welt-Y; Flächen unter Überständen bekommen weniger Schnee.

### Defaults / Konstanten

- `SNOW_MAX_SLOPE_DEG = 15`
- `SNOW_FLAKE_SIZE_CM = 5`
- Keine Vertex-Dicke; Decke flach
- Liegende Flocken: max. 60 % des Budgets, mindestens 40 % fallen weiter

## Fallstricke

- **Cover=1, Uniforms=1, trotzdem keine liegende Decke (v2.0.568):** Albedo-Ratio-Remap (`snowColor * lit / albedo`) war bei Cover=1 und `groundMoodCover=1` unsichtbar (Stein bleibt Stein). Ohne Dachmesh (`roofKids: 0`) und ohne liegende Flocken gab es nichts zu sehen. Jetzt Luma-Mix (Hof v8, Coverage v6) **und** Flocken bleiben auf Pads liegen; Fall-Reserve 40 %. Overlays und `groundMat`-Albedo-Lerp bleiben verboten.
- **Cover=1, Hof trotzdem steingrau (v2.0.567):** Ground-Mood-Cover nur in `applySunLighting` — während des Schnees selten. Jetzt im Tick. Pads nicht jeden Frame neu. **Nicht hinreichend** — Uniform allein macht die Decke nicht sichtbar (siehe 568).
- **Fall versiegt / Decke weg / Orbit leer (v2.0.566):** 70 % liegen **ohne** Fall-Reserve → Fall stirbt. Orbit-Budget + unbeleuchteter Weiß-Mix. Kombinierte Lösung (568): liegen ja, aber 40 % fallen weiter; Orbit volle Zahl; kein Weiß-Wash ohne Licht.
- **Boden ohne Schatten und ohne liegenden Schnee (v2.0.565):** Surface-Overlays + `applySnowCoverageShader(groundMat)` (Mix nach unbeleuchtetem Weiß) + Albedo-Lerp. Nicht zurückbauen. Hof-Schnee nur über Ground-Mood-Remap nach dem Licht.
- **Boden ohne Schatten / Geister vor Bänken (v2.0.564):** Overlay-Plane über dem Boden killt PCSS; Pad-Expand 8–12 cm landet Flocken in der Luft. Overlay weg, Pads exakt.
- **Flocken durch Decke/Bänke (v2.0.563):** Tick landete nur auf `groundY`. Decken in `indoorFloorGroup` ohne Pad. Jetzt AABB-Pads; Treffer recycelt die Flocke (v2.0.566: keine liegenden Partikel mehr).
- **Decke unsichtbar trotz weißem Boden-Hex (v2.0.562):** Ground-Mood `irradiance = albedo * ambient` hält den Boden grau; `roofTinted` blieb 0. Jetzt Overlay-Meshes (`syncSettledCover`).
- **Decke unsichtbar trotz cover=1 (v2.0.560):** Ground-Mood-Albedo wurde jeden Frame auf Steingrau gesetzt; Occlusion killte Boden. Jetzt Ground-Lerp + Dach-Tint + Thick ohne Occ.
- **Quadrate / Spawn-Höhe (v2.0.559):** Flocken ohne Map = Quadrate; Fassaden-Spawn an Kamera-Y. Jetzt Kreis-Map, Spawn über Dach.
- **Kein Schnee bei Pause (v2.0.558):** Tick hing an `animationsPaused` → `activeCount` blieb 0 obwohl Schneefall an, Render, 3D/Fassade. Schnee-Tick nutzt `paused: false`.
- **Fassade unsichtbar (v2.0.557):** Spawn war gebäudeweit — im Fassaden-Frustum oft leer. Jetzt kamera-biased Spawn (XZ); Entwurf→Vorschau beim Wechsel zu Fassade.
- **Vorschau „tot“ (v2.0.556):** Schnee nur an Render gekoppelt wirkte in Vorschau unsichtbar. Jetzt Vorschau+Render; Flocken nicht AdditiveBlending. Größe seit v2.0.566 Weltmaß ~5 cm.
- **Park-Shell (v2.0.555):** Sichtbare Szene-UI ist `SceneToolbarApp` (Desktop) bzw. Touch-Kacheln + `FormMirror`. Neue Szenen-Felder: Vanilla-IDs **und** Park-Accordion **und** ggf. `SCENE_LIBRARY_TILES` / `SCENE_EDIT_SECTIONS`.
- **Idle/Dirty:** Fallende Flocken halten den Viewport bewusst dirty (wie sichtbare Animation). Nicht als Idle-Killer „wegoptimieren“, ohne Flocken auszuschalten.
- **Kein WebGPU-Compute-Snow** — WebGL-Partikel + Shader-Decke; passt zum bestehenden PCSS-/Takram-Stack.
- **Orbit:** Partikelzahl **nicht** reduzieren (v2.0.566). Occlusion-Bake darf während Orbit pausieren.
- **Szene-Sektion (v2.0.554):** Bühne heißt `data-settings-section="scene"`, nicht `colors` — sonst trifft das Farben-Hide (v2.0.455) und der Inhalt verschwindet.
- Worktree-Isolation war in der Agent-Umgebung blockiert; Feature liegt auf Branch `Schneefall-iso`.

## Tests

`src/lighting/snowWeather.test.ts` — Normalisierung, Rates, Flächenklassen (`npx vitest run src/lighting/snowWeather.test.ts --environment happy-dom`).
