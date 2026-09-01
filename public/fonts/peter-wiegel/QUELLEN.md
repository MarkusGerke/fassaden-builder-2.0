# Peter-Wiegel-Schriften — Quellen und Lizenzen

Eingebunden aus dem Paket `Schriften-Fassaden/Peter Wiegel` (Stand der Ordner, die der App übergeben wurden).
Urheber: **Peter Wiegel**, [www.peter-wiegel.de](https://www.peter-wiegel.de), `wiegel@peter-wiegel.de`.
Einige Schnitte tragen zusätzlich **CAT-Fonts** (`http://www.catfonts.de`).

Es liegt jeweils **eine Schnittleiste** pro Ordner (Regular bzw. die Hauptdatei). Outline-, Schatten- und Extra-Schnitte sind nicht übernommen.

Der OFL-Volltext liegt unter [`../licenses/OFL-1.1.txt`](../licenses/OFL-1.1.txt).
CC-BY-NC-SA 3.0 DE: [creativecommons.org/licenses/by-nc-sa/3.0/de](https://creativecommons.org/licenses/by-nc-sa/3.0/de/).
Die mitgelieferten `Creative Commons Lizenz.txt` sind Latin-1-kodiert; maßgeblich ist der offizielle CC-Text.

## Eingebunden

| App-Name | Ursprungsordner | Originaldatei | Lizenz | Copyright / Reserved Font Name (aus der Lizenzdatei) |
|---|---|---|---|---|
| Berlin Email | `BerlinEmailTT` | `Berlin Email.ttf` | CC BY-NC-SA 3.0 DE | Peter Wiegel |
| Berliner Wand | `Berliner_Wand` | `Berliner_Wand.ttf` | OFL 1.1 | 2018, Reserved „Berliner Wand“ |
| Bombe CAT | `Bombe_CAT` | `Bombe_CAT.ttf` | OFL 1.1 | 2009, Reserved „Bombe CAT“ |
| CAT Neuzeit | `CATNeuzeit` | `CATNeuzeit.ttf` | OFL 1.1 | 2015, CAT-Fonts / Peter Wiegel, Reserved „CAT Neuzeit“ |
| CAT Reporter | `CATReporter` | `CATReporter.ttf` | OFL 1.1 | 2015, CAT-Fonts / Peter Wiegel, Reserved „CAT Reporter“ |
| DIN 1451 breit | `DIN1451breit` | `DIN1451-36breit.ttf` | OFL 1.1 | 2009, Peter Wiegel; Reserved in der OFL-Datei: „Gruenewals VE“ |
| Flottflott | `Flottflott` | `Flottflott.ttf` | OFL 1.1 | 2012, Reserved „Flottflott“ |
| Hardman | `Hardman` | `Hardman.ttf` | OFL 1.1 | 2012, Reserved „Hardman“ |
| Mammut CAT | `MammutCAT` | `MammutCAT.ttf` | OFL 1.1 | 2016, CAT-Fonts / Peter Wiegel, Reserved „Mammut CAT“ |
| Mammut OT CAT | `Mammut_OT_CAT` | `Mammut_OT_CAT.ttf` | OFL 1.1 | 2017, Reserved „Mammut OT CAT“ |
| Osterbar | `Osterbar` | `Osterbar.ttf` | OFL 1.1 | 2018, Reserved „Osterbar“ |
| Phanta Du | `PhantaDu` | `Phanta-Du.ttf` | OFL 1.1 | 2015, CAT-Fonts / Peter Wiegel, Reserved „Phanta Du“ |
| Rumburak | `Rumburak` | `Rumburak.ttf` | OFL 1.1 | 2009, Reserved „Rumburak“ |
| Rundkursiv | `Rundkursiv` | `Rundkursiv.ttf` | OFL 1.1 | 2014, Reserved in `OFL.txt`: „Rundkursivr“ |
| Secession | `Secession` | `HalbfetteSecession.ttf` | OFL 1.1 | 2018, Reserved „Secession“ |
| Vorgang | `Vorgang` | `Vorgang.ttf` | OFL 1.1 | 2016, CAT-Fonts / Peter Wiegel, Reserved „Vorgang“ |
| Waschküche | `WaschkuecheTT` | `Waschkueche.ttf` | CC BY-NC-SA 3.0 DE | Peter Wiegel |
| Waschküche grob | `WaschkuecheTT` | `WaschkuecheGrob.ttf` | CC BY-NC-SA 3.0 DE | Peter Wiegel |

## Nicht eingebunden

| Ordner / Datei | Grund |
|---|---|
| `Email/` | Fontsquirrel-Webfont von Berlin Email (EOT/WOFF/SVG) — Duplikat zu `BerlinEmailTT` |
| Extra-Schnitte in `BerlinEmailTT` | Bold, Heavy, Linie, Outline, Schadow, Serif, Wide, … |
| `CATNeuzeit Schatten.ttf` | Schatten-Schnitt |
| Lose TTFs neben den Ordnern (`Nuernberg.ttf`, `Postamt.ttf`, …) | Nicht in der übergebenen Ordnerliste |

Typefaces (`.typeface.json`) sind mit `scripts/ttf-to-typeface.mjs` erzeugt. Bei Berlin Email, Osterbar und Secession werden `GDEF`/`GPOS`/`GSUB` vor dem Parsen unbenannt, weil opentype.js GDEF-ClassDef-Format 3 nicht liest.
