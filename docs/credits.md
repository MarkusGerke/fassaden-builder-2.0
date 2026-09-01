# Quellen und Danksagung

## Verhalten für den Nutzer

Neben der Versionsnummer steht **Quellen**. Der Dialog listet nur, was eingebunden ist: Bibliotheken, Schriften und selbst nachgebaute Verfahren — jeweils mit Kurzbeschreibung und Danke.

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/credits.ts` | Texte der Quellenliste (einzige Quelle der Wahrheit) |
| `src/ui/creditsDialog.ts` | Rendert den Dialog |
| `index.html` | `#app-credits-btn`, `#credits-dialog` |
| `src/main.ts` | `initCreditsUi` |
| `src/studio/roomEnvironment.ts` | Studio-EnvMap via importiertem `RoomEnvironment` |

## Datenfluss

Klick **Quellen** → `renderCredits` schreibt Artikel aus `LIBRARY_CREDITS` und `METHOD_CREDITS` in `#credits-body`.

## Defaults / Konstanten

Keine Persistenz. Der Dialog ist nur Anzeige.

## Bekannte Fallstricke

- **Import ≠ Kopie:** Three.js-Addons (OrbitControls, RoomEnvironment, …) kommen aus dem npm-Paket `three`. Wir kopieren deren Quelldateien nicht ins Repo. Boolesche Sockel-Schnitte: `three-bvh-csg` / `three-mesh-bvh` ebenfalls nur als Import.
- **RoomEnvironment ist kein Foto-HDRI:** Kleine programmierte Studio-Szene → PMREM-EnvMap an Glas- und Glanz-Materialien; `scene.environment` bleibt `null`.
- **Nur Positivliste:** Der Dialog zählt nicht auf, was fehlt oder früher entfernt wurde.
- **Peter Wiegel:** OFL-Schriften vs. CC-BY-NC-SA (Berlin Email, Waschküche) — Details in [fonts.md](fonts.md) und `public/fonts/peter-wiegel/QUELLEN.md`.
