# Fassaden-Schriften

## Verhalten für den Nutzer

Im Reiter **Schrift**: Textfeld, darunter **Schriftart**-Karten wie die Paneel-Vorschau. Jede Karte ist **16:9**, die Karten stehen **untereinander**. Die Vorschau zeigt denselben Text wie das Feld oben, gesetzt in der jeweiligen Schrift (leer → Platzhalter des Textfelds). Klick wählt die Schrift für die Wandbeschriftung. Standard bleibt **Federo**.

**v2.0.237:** Mehrere Schriften pro Wand (`Wall.labels[]` mit `id`; Legacy `label` wird hydratisiert). Kopieren → Rechtsklick auf Wand → **Schrift einfügen** legt eine weitere Instanz an (Offset oder Klickpunkt); einzeln verschiebbar.

**v2.0.239:** Auswahl/Bearbeiten/Verschieben über `selectedLabelId` (Highlight, Live-Drag, Toolbar, Guides). Hydrate ändert bestehende Schriften nicht mehr durch Nudge beim Geschoss-Duplikat.

**v2.0.240:** Jede Schrift erscheint in der Ebenenliste unter der Wand (wie Fenster); Klick setzt `selectedLabelId` und öffnet die Schrift-Einstellungen.

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

`wall.labels[].fontId` / Legacy `wall.label.fontId` → `resolveLabelFontId` → TTF (`FontFace`/Canvas) bzw. `*.typeface.json` (`TextGeometry`). Die Karten lesen live `#studio-label-text` (`input`), speichern die Schrift erst beim Klick (`commitLabelPatch({ fontId })`).

## Defaults / Konstanten

- Default `fontId`: `federo`
- CSS-Familien der Wiegel-Schriften: `Fassade <Name>` (kein Reserved-Name als `font-family`, OFL-Bedingung)
- Extrusion lädt Typeface erst bei „Mit Tiefe“

## Bekannte Fallstricke

- **CC-NC:** Berlin Email / Waschküche nicht in kommerziellen Produkten ohne andere Lizenz.
- **Reserved Font Names** nicht für abgeleitete Schnitte verwenden; interne Familien heißen `Fassade …`.
- Lange Kartenliste in der rechten Leiste (19 × 16:9) — gewollt, eine Spalte.
- Manche TTFs brauchen den GDEF-Workaround im Typeface-Skript, sonst fehlt die 3D-Schrift.
