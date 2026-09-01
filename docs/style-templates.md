# Stil-Vorlagen

## Verhalten für den Nutzer

Neben **Stile kopieren** / **Stile einfügen…** können Wand-Stile dauerhaft als Vorlage gespeichert werden:

1. Wand wählen → Rechtsklick → **Stil als Vorlage speichern…**
2. Name eingeben → **Speichern**
3. Auf Ziel-Wand oder Öffnung → Rechtsklick → **Stil-Vorlage anwenden** → Vorlage wählen

Die Vorlage übernimmt alles auf einmal (Paneele, Farben, Gesims, Sockel, Außenseite, Rahmenprofil, Verdachung, Bänke der ersten Öffnung) — ohne den Einfüge-Dialog.

## Persistenz

| Schlüssel | Inhalt |
|---|---|
| `fassaden-builder-style-templates-v1` | JSON-Array von `{ id, name, draft }` |

## Betroffene Dateien

| Datei | Rolle |
|---|---|
| `src/utils/styleTemplates.ts` | Laden/Speichern, Normalisierung, `draftFromWallStyle` |
| `src/main.ts` | Dialog, Kontextmenü, `applyStyleClipboardDirect` |
| `index.html` | `#style-template-dialog` |

## Front-Ausrichtung (v0.7.204)

Beim Anwenden und beim Einfügen mit **Außenseite** gleicht `finalizeWallFrontOrientation` in `walls.ts` die `panelFlip` innerhalb einer Baugruppe (gleiche Yaw) ab und richtet Fensterbänken (`flipForward`) an der Wand-Front aus.
