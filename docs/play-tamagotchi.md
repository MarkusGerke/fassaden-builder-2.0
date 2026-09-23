# Fassaden-Einstieg (Tamagotchi Stufe 1, Pivot)

Kreativ-Loop: **weißes Start-Haus → Bibliothek bestücken**. Kein Verfall, kein Streichen-Modus, keine Checkliste, kein Experte-Banner.

## Verhalten für den Nutzer

1. **Bibliothek → Fassaden** (erster Reiter, **nur ohne Objektauswahl**): acht kuratierte weiße Start-Häuser. Aktives Haus ist umrandet; Klick lädt neu. Ohne Auswahl startet die Bibliothek auf diesem Reiter.
2. Wand anklicken (ohne Teil wie Gesims/Sockel) öffnet **Paneele & Mauerwerk**, nicht Farben. Fenster/Tür nur passende Öffnungs-Tabs (kein Wände/Erker/Fassaden).
3. Ohne gespeichertes Projekt und ohne `#f=`-Hash startet die App mit **Stadthaus** (`stadthaus-3`), Sockel **48 cm**.
4. **Farben:** Filterchip **Alle** zuerst (komplette Palette).
5. **Datei → Einführungstour** (Ark Tour, 7 Schritte): Fassade → Paneele → Farben → Fenster → Profile → Sockel → Gesims. Auto-Start einmalig, bis abgeschlossen (`?tour=1` erzwingt erneut).
6. **Datei → Ebenen ein-/ausblenden**: steuert die linke Spalte; Persistenz `fassaden-builder-layers-visible-v1` (Default: aus).

Deep-Link: `?tour=1` startet die Tour.

## Persistenz

| Schlüssel | Inhalt |
|---|---|
| `fassaden-builder-facade-starter-v1` | `{ starterId }` — zuletzt gewähltes Start-Haus |
| `fassaden-builder-tour-completed-v1` | `'1'` wenn Tour fertig/geschlossen |
| `fassaden-builder-layers-visible-v1` | `'1'` / `'0'` — Ebenen sichtbar |

Fassadenfarben/Öffnungen liegen im normalen Fassaden-State. Kein Schema-Bump.

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/play/playTypes.ts` | Starter-Typen / Weiß |
| `src/play/playStarters.ts` | Katalog + Arrivieren-Seed → weiß + Profil |
| `src/play/facadeOnboarding.ts` | Starter-/Tour-/Ebenen-Keys |
| `packages/ui/.../FacadeTourApp.tsx` | Ark Tour |
| `packages/ui/.../ChromeIslands.tsx` | Datei: Ebenen + Tour |
| `src/ui/liveShellBridge.ts` | Mount + File-Actions |
| `src/main.ts` | Bibliothek Fassade, Default-Load, Tour-Host |
| `src/style.css` | Farben-/Fassade-Thumbs, Paneel-SVG, Tour |

## Defaults

| Konstante | Wert |
|---|---|
| Default-Starter | `stadthaus-3` |
| Starter-Rahmen | `fensterprofil32x120` |
| Starter-Farbe | `#ffffff` |
| Ebenen | aus |

## Fallstricke

- Park-Shell: Vanilla-Chrome ist `.vanilla-legacy-park` — sichtbare Menüs leben in der Park-Bridge.
- Tour-Tabs mit `data-library-when="opening"` (Profile) brauchen eine gewählte Öffnung (`ensureOpeningSelected`).
- Alte Keys `fassaden-builder-play-v1` werden nicht mehr gelesen (Streichen/Checkliste entfernt).
- **Tour-`effect`:** Zag erwartet `show()` nach dem Setup — **nicht** `next()` (sonst Stack-Overflow / leere App, kein UI).
- `initLiveShell` braucht `isUiLeftCollapsed` / `setUiLeftCollapsed` / `facadeTourHost` — sonst `TypeError` und Loading bleibt.

## Tests

`src/play/play.test.ts` — Kataloggröße, Weiß-Starter, Default-ID.
