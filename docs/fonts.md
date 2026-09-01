# Fassaden-Schriften

## Verhalten für den Nutzer

Im Reiter **Schrift**: Textfeld, darunter **Schriftart**-Karten wie die Paneel-Vorschau. Jede Karte ist **16:9**, die Karten stehen **untereinander**. Die Vorschau zeigt denselben Text wie das Feld oben, gesetzt in der jeweiligen Schrift (leer → Platzhalter des Textfelds). Klick wählt die Schrift für die Wandbeschriftung. Standard bleibt **Federo**.

**Quellen** (neben der Versionsnummer) nennt Urheber und Lizenzen. Peter-Wiegel-Schriften unter OFL 1.1 dürfen kommerziell gebündelt werden; **Berlin Email** und **Waschküche** stehen unter **CC BY-NC-SA 3.0 DE** (nicht kommerziell, Namensnennung, ShareAlike).

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/studio/labelFonts.ts` | Katalog (`LABEL_FONTS`), URLs, `@font-face` |
| `src/studio/labelGeometry.ts` | Flache Canvas-Schrift und extrudierte Typefaces je `fontId` |
| `src/utils/wallLabel.ts` | `fontId` hydrieren; Legacy `helvetiker` → Federo |
| `src/main.ts`, `index.html`, `src/style.css` | 16:9-Karten, Live-Vorschau |
| `public/fonts/` | Federo; `peter-wiegel/*.ttf` + `.typeface.json` |
| `public/fonts/peter-wiegel/QUELLEN.md` | Ordner, Copyright, Reserved Font Names |
| `public/fonts/licenses/OFL-1.1.txt` | OFL-Volltext |
| `scripts/ttf-to-typeface.mjs` | TTF → Typeface (inkl. GDEF-Workaround) |
| `src/credits.ts` | Quellen-Dialog |

## Datenfluss

`wall.label.fontId` → `resolveLabelFontId` → TTF (`FontFace`/Canvas) bzw. `*.typeface.json` (`TextGeometry`). Die Karten lesen live `#studio-label-text` (`input`), speichern die Schrift erst beim Klick (`commitLabelPatch({ fontId })`).

## Defaults / Konstanten

- Default `fontId`: `federo`
- CSS-Familien der Wiegel-Schriften: `Fassade <Name>` (kein Reserved-Name als `font-family`, OFL-Bedingung)
- Extrusion lädt Typeface erst bei „Mit Tiefe“

## Bekannte Fallstricke

- **CC-NC:** Berlin Email / Waschküche nicht in kommerziellen Produkten ohne andere Lizenz.
- **Reserved Font Names** nicht für abgeleitete Schnitte verwenden; interne Familien heißen `Fassade …`.
- Lange Kartenliste in der rechten Leiste (19 × 16:9) — gewollt, eine Spalte.
- Manche TTFs brauchen den GDEF-Workaround im Typeface-Skript, sonst fehlt die 3D-Schrift.
