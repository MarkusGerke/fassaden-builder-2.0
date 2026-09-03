/**
 * App-Versionierung und Release Notes — bei jeder nutzerrelevanten Änderung aktualisieren
 * (siehe `.cursor/rules/dokumentation.mdc` und `docs/versioning.md`).
 */

export const GITHUB_REPO = 'https://github.com/MarkusGerke/fassaden-builder-2.0'

/** Aktuelle SemVer-Version (wird unter dem Titel angezeigt). */
export const APP_VERSION = '2.0.123'

export interface ReleaseNote {
  version: string
  date: string
  title?: string
  changes: string[]
  /** Optional: GitHub-Release-Tag für direkten Link (z. B. `v0.2.0`). */
  githubTag?: string
}

/** Neueste Version zuerst. */
export const RELEASES: ReleaseNote[] = [
  {
    version: '2.0.123',
    date: '2026-09-03',
    title: 'Lichtfarbe, Nischen dicht, Fugen-Glanz',
    changes: [
      'Punktlicht: eigene Farbe zusätzlich zur Farbtemperatur wählbar',
      'Nischen lassen kein Licht mehr durch die Wand — nur Empfang auf der Rückwand',
      'Fugen spiegeln Licht wie die Paneele (nicht mehr matt-schwarz in den Nuten)',
      'Bitte hart neu laden, bis v2.0.123 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.122',
    date: '2026-09-03',
    title: 'Licht-Undo ohne dunkle Paneele',
    changes: [
      'Nach Entfernen eines Punktlichts und Rückgängig bleiben Paneele und Fugen hell — die Schatten-Map wird sofort neu berechnet',
      'Bitte hart neu laden, bis v2.0.122 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.121',
    date: '2026-09-03',
    title: 'Treppe ohne falschen Sockel und Türfläche',
    changes: [
      'Mit aktiver Treppe bleibt die Tür unten offen — kein Mauerwerk/Mörtel mehr in der unteren Hälfte',
      'Der Innenboden läuft nicht mehr als „zweiter Sockel“ durch Kellerfenster und Tür',
      'Bitte hart neu laden, bis v2.0.121 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.120',
    date: '2026-09-03',
    title: 'Flüssiges Navigieren in 3D',
    changes: [
      'Drehen, Schwenken und Zoomen im Render-Modus laufen wieder flüssig (vorher ca. 4 Bilder/s, jetzt Bildwiederholrate)',
      'Weiche Sonnenschatten bleiben dabei an — bei schwacher Grafik schaltet die Sonne beim Navigieren automatisch auf harten Schatten',
      'Bitte hart neu laden, bis v2.0.120 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.119',
    date: '2026-09-03',
    title: 'Keine hellen Steine an Öffnungen',
    changes: [
      'Steine direkt an Fenstern, Türen und Bögen sind nicht mehr heller als das Feld — in Render und Vorschau',
      'Diese Rest-Steine werfen jetzt auch wieder Schatten (Rückseite zeigte bisher nach vorn)',
      'Bitte hart neu laden, bis v2.0.119 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.118',
    date: '2026-09-03',
    title: 'Punktlicht ohne Würfel-Grenze',
    changes: [
      'Kein imaginärer Würfel mehr um Punktlichter — Licht und Reflexion gehen wieder durchgehend',
      'Bitte hart neu laden, bis v2.0.118 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.117',
    date: '2026-09-03',
    title: 'Keine Lichtkanten an der Laibung',
    changes: [
      'Helle Blitzer an Freiraum- und Paneelkanten der Laibung sind weg — auch wenn die Sonne von einer Wand verdeckt wird',
      'Bitte hart neu laden, bis v2.0.117 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.116',
    date: '2026-09-03',
    title: 'Laibung und Sockel im Schatten',
    changes: [
      'Laibung und Sockel bleiben dunkel, wenn eine Wand die Sonne verdeckt — kein helles Durchscheinen mehr',
      'Bitte hart neu laden, bis v2.0.116 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.115',
    date: '2026-09-03',
    title: 'Laibung hinter Freiraum',
    changes: [
      'Mit „Freiraum um die Öffnung“ endet die Laibung wieder hinter der Freiraum-Front — nicht mehr minimal davor',
      'Bitte hart neu laden, bis v2.0.115 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.114',
    date: '2026-09-03',
    title: 'Schatten nach Wand-Erweiterung repariert',
    changes: [
      'Sonnen-Schatten bleiben korrekt, wenn du weitere Wände anfügst',
      'Neue Wandflügel werfen und empfangen wieder Schatten',
      'Bitte hart neu laden, bis v2.0.114 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.113',
    date: '2026-09-03',
    title: 'Wand löschen ohne Phantom',
    changes: [
      'Gelöschte Wände verschwinden vollständig inkl. Sockel und Wandkörper (keine Geister-Meshes mehr)',
      'Bitte hart neu laden, bis v2.0.113 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.112',
    date: '2026-09-03',
    title: 'Licht wieder horizontal ziehbar',
    changes: [
      'Punktlicht ohne Shift wieder nach links/rechts (und in 3D vor/zurück) verschieben',
      'Shift + Ziehen bleibt für die Höhe',
      'Bitte hart neu laden, bis v2.0.112 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.111',
    date: '2026-09-03',
    title: 'Weichere Punktlicht-Schatten in 2D',
    changes: [
      'Punktlicht-Schatten in der 2D-Ansicht sind weniger pixelig (höhere Shadow-Map, weicherer Filter)',
      'Bitte hart neu laden, bis v2.0.111 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.110',
    date: '2026-09-03',
    title: 'Bloom unter Licht, Bibliotheks-Tabs oben',
    changes: [
      '„Bloom an“ steht jetzt unter Szene → Licht bei „Lichtpunkte anzeigen“',
      'Bibliotheks-Register (Wände, Fenster, …) liegen oberhalb der Kartenleiste',
      'Bitte hart neu laden, bis v2.0.110 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.109',
    date: '2026-09-03',
    title: 'Alle Lichter mit einem Klick',
    changes: [
      'Unter Licht: „Alle Lichter an“ schaltet alle Punktlichter gemeinsam ein oder aus',
      'Auch im Ebenenbaum unter Lichter → Mehr-Menü',
      'Bitte hart neu laden, bis v2.0.109 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.108',
    date: '2026-09-03',
    title: 'Licht ziehen: horizontal oder mit Shift vertikal',
    changes: [
      'Punktlicht per Drag nur noch horizontal verschieben',
      'Shift gedrückt halten und ziehen verschiebt das Licht in der Höhe',
      'Bitte hart neu laden, bis v2.0.108 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.107',
    date: '2026-09-03',
    title: 'Geschosse lichtdicht gegen Punktlicht',
    changes: [
      'Licht aus dem Untergeschoss scheint nicht mehr durch Decke/Boden in die Etage darüber',
      'Dickerer Geschoss-Verschluss und geringeres Schatten-Bias für weiche Punktlicht-Schatten',
      'Bitte hart neu laden, bis v2.0.107 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.106',
    date: '2026-09-03',
    title: 'Weiche Punktlicht-Schatten, dichtere Geschosse',
    changes: [
      'Schatten-Weichheit gilt jetzt auch für Punktlichter (nicht nur Sonne)',
      'Licht aus dem Untergeschoss scheint nicht mehr an der Sockelhöhe der Etage darüber durch',
      'Bitte hart neu laden, bis v2.0.106 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.105',
    date: '2026-09-03',
    title: 'Laibung ohne Innenlicht-Leak',
    changes: [
      'Punktlicht hinter der Wand erhellt die Laibung nicht mehr — Wandschatten greifen an der Laibung',
      'Bitte hart neu laden, bis v2.0.105 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.104',
    date: '2026-09-03',
    title: 'Bloom wirkt wieder auf der ganzen Szene',
    changes: [
      'Bloom (Schwelle/Stärke/Radius) gilt wieder für helle Flächen in der gesamten Ansicht — nicht nur Lichtkugeln',
      'Bitte hart neu laden, bis v2.0.104 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.103',
    date: '2026-09-03',
    title: 'Sockel ohne Innenlicht-Durchschein',
    changes: [
      'Innenliegendes Punktlicht erhellt den äußeren Sockel nicht mehr — Wandschatten greifen am Sockel',
      'Bitte hart neu laden, bis v2.0.103 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.102',
    date: '2026-09-03',
    title: 'Punktlicht beleuchtet Fassade, Schatten im Raum',
    changes: [
      'Punktlicht vor der Außenwand erhellt Fassade und Reflexion — scheint nicht mehr durch die Wand',
      'Innen: Schatten von Wänden, Sprossen und Rahmen wieder sichtbar',
      'Bitte hart neu laden, bis v2.0.102 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.101',
    date: '2026-09-03',
    title: 'Fenstergitter, Fugen unter Paneele',
    changes: [
      '„Kellerfenster mit Gitter“ heißt jetzt „Fenstergitter“ — standardmäßig aus, außer beim Kellerfenster',
      'Fugen-Einstellungen stehen im Tab Paneele (kein eigener Reiter mehr)',
      'Bitte hart neu laden, bis v2.0.101 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.100',
    date: '2026-09-03',
    title: 'Decke lichtdicht, flüssigere Navigation',
    changes: [
      'Sonne scheint nicht mehr durch Zwischendecken (ohne Streifen auf der Fassade)',
      'Beim Orbitieren: Bloom aus und weniger UI-Arbeit — Navigation flüssiger',
      'Bitte hart neu laden, bis v2.0.100 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.99',
    date: '2026-09-03',
    title: 'Ein weicher Schattenrand, lichtdichte Hülle',
    changes: [
      'Sonnenschatten: weicher Außenrand statt harter Texelkante über einer weichen Umbra',
      'Sonne scheint nur durch Wandöffnungen und Glas — nicht durch Wände, Decken, Böden oder Fensterrahmen',
      'Bitte hart neu laden, bis v2.0.99 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.98',
    date: '2026-09-03',
    title: 'Weichheit-Slider + flüssigere Navigation',
    changes: [
      'Schatten-Weichheit steuert die Penumbra wieder sichtbar (Ortho-Skala 8, Default 2,5)',
      'Kein Shadow-Map-Neubake mehr bei jedem Frame mit Punktlicht — Orbit und Verschieben stottern weniger',
      'Bitte hart neu laden, bis v2.0.98 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.97',
    date: '2026-09-03',
    title: 'Schatten wie v0.7.347',
    changes: [
      'Sonnenschatten wieder mit der klassischen PCSS-Formel (× Near/z) — hart am Kontakt, weich mit Abstand wie in v0.7.347',
      'Weichheit-Default wieder 2,5 (statt 5); künstliche Penumbra-Skala entfernt',
      'Bitte hart neu laden, bis v2.0.97 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.96',
    date: '2026-09-03',
    title: 'Gleich helle Steine am Bogen, Schatten wie bisher',
    changes: [
      'Paneele direkt am Rundbogen bleiben so hell wie die Steine im Feld (Fase fängt nicht mehr extra Sonne)',
      'Sonnenschatten unverändert: bewährtes weiches PCSS (kein Mindest-Filter, Scale 8) — Experiment mit fransigen/langsamen Schatten zurückgenommen',
      'Bitte hart neu laden, bis v2.0.96 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.95',
    date: '2026-09-03',
    title: 'Keine schräge Kante am Bogenansatz',
    changes: [
      'Steine, die Kämpferlinie und Laibung überspannen, zeigen in der Zeichnung keine Diagonale mehr — die Laibungskante bleibt lotrecht',
      'Bitte hart neu laden, bis v2.0.95 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.94',
    date: '2026-09-03',
    title: 'Paneele über und unter Rechteckfenstern',
    changes: [
      'Fehlende Steine direkt über dem Sturz und unter der Sohlbank bei Rechtecköffnungen sind wieder da (mit und ohne Freiraum)',
      'Verhalten wie bei Rundbögen: angeschnittene Schichten werden geschnitten, nicht weggelassen',
      'Bitte hart neu laden, bis v2.0.94 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.93',
    date: '2026-09-03',
    title: 'Wände bleiben beim Neuladen stehen',
    changes: [
      'Hard-Reload verschiebt keine Wand-Origins mehr (Außenkanten-Fit nur noch bei Altstand mit Innen-Origin)',
      'Bitte hart neu laden, bis v2.0.93 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.92',
    date: '2026-09-03',
    title: 'Decken und Böden lichtdicht bis zur Fassade',
    changes: [
      'Geschossdecken und -böden reichen bis zum Fassadenrand und lassen kein Licht mehr durch die Wandstärke',
      'Wandunterseite bleibt neben Türen geschlossen — nur unter der Schwelle offen',
      'Bitte hart neu laden, bis v2.0.92 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.91',
    date: '2026-09-03',
    title: 'Schatten auch auf Fugen/Mörtel',
    changes: [
      'Mörtelplatten in den Fugen empfangen wieder Sonnen-Schatten (wie die Steine)',
      'Bitte hart neu laden, bis v2.0.91 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.90',
    date: '2026-09-03',
    title: 'Weiße Rahmen, Fassaden-Schatten, einfaches Fenster, Keller-Gitter',
    changes: [
      'Fensterrahmen: Default und Alt-Saves mit unverändertem Grau (#4a4a4a) werden weiß',
      '3D: Fassadenpaneele empfangen und werfen wieder Sonnen-Schatten; Arbeit-Modus wirft ebenfalls',
      '2D-Aufriss: Schatten auf Fensterrahmen nach High-LOD-Rebuild wieder sichtbar',
      'Neue Fenster ohne Oberlicht/Mehrflügel-Raster; Kellerfenster-Gitter an jedem Fenster zuschaltbar inkl. Gitterhöhe',
      'Bitte hart neu laden, bis v2.0.90 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.89',
    date: '2026-09-03',
    title: 'Fassaden-Raster = Verband, Snap-Vorschau, Nudge-Numpad, kein Auto-Keilstein',
    changes: [
      'Blaues Raster beim Verschieben von Öffnungen folgt den Stoßfugen und Schichten des Paneels/Mauerwerks — nicht mehr einem festen 32-cm-Gitter',
      'Orangene Drag-Vorschau hängt am Haus (siteOffset) und wird bei Breiten-Snap neu gebaut — sie sitzt dort, wo die Öffnung nach dem Loslassen landet',
      'Maße-Pfeile und Tastatur: Standard 8 cm; Numpad-/Zifferntaste 1–9 halten = Vielfaches (z. B. 3 → 24 cm)',
      'Rundbogen aktivieren schaltet den Keilstein-Ring nicht mehr automatisch ein',
      'Bitte hart neu laden, bis v2.0.89 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.88',
    date: '2026-09-02',
    title: 'Bogenkappe: Schulter- und Kellerfenster-Steine bleiben ganze Steine',
    changes: [
      'Die Reihen zwischen Kämpfer und Scheitel verhalten sich jetzt wie die Reihe über dem Scheitel: Jeder Stein bleibt in Größe und Lage im Verband und wird vom Bogen nur maskiert',
      'Keine 16-cm-Spalten und kein waagerechter Schnitt am Scheitel mehr — die „merkwürdig gebrochenen“ Steine an der Bogenschulter und über Kellerfenstern sind weg',
      'Gilt für alle Paneelbreiten; Bossen-Fase folgt weiterhin jeder Kante der Restform',
      'Bitte hart neu laden, bis v2.0.88 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.87',
    date: '2026-09-02',
    title: 'Bossen an Bogen-Resten: gleiche Fase wie im Feld, First statt Mini-Pyramide',
    changes: [
      'Reststeine am Bogen bekommen exakt dieselbe Fasenbreite und -tiefe wie volle Steine — nichts wird kleiner skaliert oder steiler',
      'Wo ein Rest schmaler als zwei Fasen ist (über dem Scheitel, an der Schulter), laufen die Fasen in einen First zusammen, wie bei einem echten behauenen Stein',
      'Die Front des Scheitelsteins teilt sich sauber links und rechts der Kerbe; keine flachen Steine ohne Boss und keine schiefen Fronten mehr',
      'Bitte hart neu laden, bis v2.0.87 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.86',
    date: '2026-09-02',
    title: 'Bossen: Steine bleiben im Verband, Restform wird Trapez',
    changes: [
      'Keine Strahlen mehr über dem Bogen — jeder Stein bleibt in Größe und Lage im Verband und wird von der Öffnung nur maskiert',
      'Die übrig bleibende Form (3, 4 oder mehr Ecken, auch mit Bogenkante) bekommt rundum dasselbe Bossen-Trapez wie volle Steine; schmale Reste ein kleineres, gleich steiles',
      'Auch die Steine direkt über dem Scheitel und an der Laibung haben jetzt eine Bossen-Front — vorher flach',
      'Bitte hart neu laden, bis v2.0.86 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.85',
    date: '2026-09-02',
    title: 'Trapez bis zur Schulter, Zeichnung ohne Innenquadrat',
    changes: [
      'Bossen über dem Bogen sind bis zur Schulter trapezförmig — nicht mehr als Rechteckgitter über der Rundung',
      'In der Zeichnung kein inneres Quadrat mehr in den Steinen ums Fenster',
      'Bitte hart neu laden, bis v2.0.85 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.84',
    date: '2026-09-02',
    title: 'Trapez-Bossen an der Schulter, Zeichnung ohne Innenquadrat',
    changes: [
      'Auch die Steine an der Bogenschulter sind trapezförmig — nicht nur am Scheitel; Fugen laufen zum Bogenmittelpunkt',
      'In der Zeichnung entfällt das innere Quadrat in den Bossensteinen ums Fenster',
      'Bitte hart neu laden, bis v2.0.84 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.83',
    date: '2026-09-02',
    title: 'Trapez-Bossen am Bogen, Zeichnung ohne Innenquadrat',
    changes: [
      'Steine über dem Bogen sind trapezförmig: die Fugen laufen zum Bogenmittelpunkt, nicht mehr als gestapelte Rechtecke auf der Rundung',
      'In der Zeichnung entfällt das innere Quadrat in den Bossensteinen ums Fenster — nur noch die Steinumrisse',
      'Bitte hart neu laden, bis v2.0.83 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.82',
    date: '2026-09-02',
    title: 'Läuferverband und Fenstermaße',
    changes: [
      'Fenster und Türen sitzen im Läuferverband auf den Steinfugen (halbe Steinlänge) — nicht mehr als 8-cm-Stummel neben dem Verband',
      'Ziehen rastet immer ein; Breite so, dass beide Laibungen auf Fugen liegen. Bestehende Projekte werden einmalig ausgerichtet',
      'Bitte hart neu laden, bis v2.0.82 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.81',
    date: '2026-09-02',
    title: 'Große Paneele als Zwickel am Bogen',
    changes: [
      'Breite Streifen und große Verbandssteine werden in der Bogenkappe in schmale Zwickel geteilt und laufen auf die Rundung zu — wie kleine Ziegel, nicht mehr als abgeschrägtes Riesenrechteck',
      'Unter der Kämpferlinie bleiben große Paneele ungeteilt bis zur lotrechten Laibung',
      'Bitte hart neu laden, bis v2.0.81 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.80',
    date: '2026-09-02',
    title: 'Streifen in der Zeichnung am Bogen',
    changes: [
      'Horizontale Streifen und Paneele folgen in der Zeichnung der Bogenkurve — nicht mehr als leeres Rechteck um den Bogen und nicht durchs Glas',
      'Gilt für Rund-, Segment- und Tudorbogen; kleine Ziegel bleiben das Referenzbild',
      'Bitte hart neu laden (ohne Cache), falls noch v2.0.79 in der Titelleiste steht',
    ],
  },
  {
    version: '2.0.79',
    date: '2026-09-02',
    title: 'Notfall: kaputte Bogen-Rustika aus',
    changes: [
      'Die automatische radiale Rustika (v2.0.78) ist abgeschaltet — sie hat große Löcher und schwebende Fächer erzeugt',
      'Bogenöffnungen nutzen wieder den bisherigen Clip-/Keilstein-Pfad',
      'Quaderfeld-Reiter bleibt optional (Default aus); ggf. manuell ausschalten falls noch an',
    ],
  },
  {
    version: '2.0.78',
    date: '2026-09-02',
    title: 'Radiale Rustika-Lagen am Rundbogen',
    changes: [
      'Bei Strip oder Mauerwerksverband umschließen die Wandlagen den Rundbogen jetzt radial: horizontale Fugen knicken nahe der Laibung zum Bogenmittelpunkt ab (trapez-/keilförmige Quader)',
      'Funktioniert ohne Keilstein-Ring; mit Ring bleibt ein Scheitel-Keilstein. Unter dem Kämpfer unverändertes Raster',
      'Das optionale „Separates Trapezfeld“ unter Verdachung ist ein anderes Feature (Default aus) — nicht die Rustika am Bogen',
    ],
  },
  {
    version: '2.0.77',
    date: '2026-09-02',
    title: 'Trapez-Quaderfeld über der Öffnung',
    changes: [
      'Neues Quader-/Verdachungsfeld: mehrlagige Trapez-Quader über Fenster oder Tür — ohne Keilstein-Ring',
      'Funktioniert bei eckiger Öffnung und bei Bogen (Feld sitzt über Scheitel bzw. Extrados)',
      'Unter Verdachung: Checkbox „Trapez-Quaderfeld“ mit Lagen, Überstand, Verjüngung und Option „nach unten verjüngend“',
    ],
  },
  {
    version: '2.0.76',
    date: '2026-09-02',
    title: 'Bogen-Mauerwerk schichtweise (wie Lagerfugen)',
    changes: [
      'Hybridsteine am Rundbogen folgen jetzt den horizontalen Schichten des Verbands — nicht mehr ein Keil bis zu einer Kante mit Löchern daneben',
      'Rechtecksteine bleiben neben dem Bogen erhalten; nur der Winkelsektor wird ersetzt',
      'Wirkt am besten, wenn Stichmaß und Schichthöhe zusammenpassen (siehe Release-Hinweis in den Docs)',
    ],
  },
  {
    version: '2.0.75',
    date: '2026-09-02',
    title: 'Bogensteine als Hybrid am Verband',
    changes: [
      'Rundbogen mit Keilstein + Mauerwerk/Läuferverband: Steine am Bogen sind Hybridstücke — innen radial, außen an Lagerfugen des Wandverbands (keine Dreiecksreste)',
      'Schultersteine greifen L-förmig ins Raster; oberhalb der Abschlusskante läuft der normale Verband weiter',
      'Streifenpaneele und Alt-Projekte ohne Keilstein-Ring unverändert; andere Bogenformen wie bisher',
    ],
  },
  {
    version: '2.0.74',
    date: '2026-09-02',
    title: 'Öffnungs-Ziehen ruhiger; Rundbogen mit Keilstein',
    changes: [
      'Ziehen einer Öffnung rastet nur noch an Fugen (plus Wandmitte) — kein Springen zwischen Steinmitten mehr; Magnet ±7 cm',
      'Pfeiltasten behalten Fuge, Steinmitte und Wandmitte wie bisher',
      'Rundbogen neu gewählt: Keilstein-Ring standardmäßig an (Alt-Projekte ohne Ring bleiben ohne)',
    ],
  },
  {
    version: '2.0.73',
    date: '2026-09-02',
    title: 'Öffnungen rasten am richtigen Band; Stil mit zwei Bändern',
    changes: [
      'Bei Verkleidung in zwei Bändern (z. B. 48 cm unten / 24 cm oben) rastet die Öffnung am Modul der Höhe, in der sie liegt',
      'Stil-Vorlagen und Stile kopieren/einfügen übernehmen die Zwei-Bänder-Einstellung mit',
      'Ohne geteilte Bänder unverändertes Snap-Verhalten',
    ],
  },
  {
    version: '2.0.72',
    date: '2026-09-02',
    title: 'Zwei Verkleidungs-Bänder mit eigener Modulbreite',
    changes: [
      'Unter Paneele: „Verkleidung in zwei Bänder teilen“ — Höhe der Teilung sowie Modulbreite unten und oben (z. B. 48 cm / 24 cm)',
      'Im 3D sichtbar unterschiedliche Steine oben und unten; ausgeschaltet wieder ein einheitliches Raster',
      'Einstellung bleibt in der Fassade gespeichert (keine Schema-Migration nötig)',
    ],
  },
  {
    version: '2.0.71',
    date: '2026-09-02',
    title: 'Verkleidung: Zonen-Layout verdrahtet',
    changes: [
      'Mehrere Verkleidungszonen mit eigenem Modul und Rechteck (z. B. 48 cm unten, 24 cm oben) — Layout clippt je Zone',
      'Freiraum und Keilstein-Ring steuern einheitlich den Verkleidungs-Ausschnitt; Shell-Loch bleibt am Öffnungsmaß',
      'Ohne gespeicherte Zonen unverändert: ein Paneel-Raster wie bisher',
    ],
  },
  {
    version: '2.0.70',
    date: '2026-09-02',
    title: 'Fassaden-Schichten: Shell, Verkleidung, Anbauteile',
    changes: [
      'Architektur-Vertrag: dichte Wandschale (lichtdicht), Verkleidungszonen, Anbauteile — eine Öffnungsmaske für alle',
      'Freiraum vergrößert nur die Verkleidung; „In Wand eingebettet“ schließt Loch und Glas, Dekor bleibt',
      'Grundlage für spätere Sonderzonen (Keilsteine, konische Felder) ohne die Clip-Logik weiter zu überladen',
    ],
  },
  {
    version: '2.0.69',
    date: '2026-09-02',
    title: 'Öffnungen: Fuge, Steinmitte oder Wandmitte',
    changes: [
      'Platzierung rastet an Fuge (Laibung bündig), Stein-/Paneelmitte oder Wandmitte — kein festes 8-cm-Schrittmaß mehr',
      'An 45°-Wänden lässt sich die Öffnung exakt auf die gelbe Wandmitte setzen (Magnet ±8 cm)',
      'Pfeile springen zum nächsten Kandidaten; Ziehen wählt den nächsten Absolut-Kandidaten ohne Springen',
    ],
  },
  {
    version: '2.0.68',
    date: '2026-09-02',
    title: '24/48-Raster bündig, Öffnungs-Drag ohne Springen',
    changes: [
      'Läuferlagen: Restbreite nur am Wandende — 24er- und 48er-Muster fluchten wieder auf gemeinsamen Fugen',
      'Öffnung ziehen: rastet sauber an der nächsten Fuge zur Mausposition (kein Hin-und-Her mehr)',
      'Pfeiltasten/Nudge springen weiter in 0,5er-/1er-Schritten des Musters',
    ],
  },
  {
    version: '2.0.67',
    date: '2026-09-02',
    title: 'Fenster-Snap über Etagen mit unterschiedlichem Modul',
    changes: [
      'Gestapelte Fassaden (z. B. 24er Ziegel über 48er Paneelen): Öffnungen rasten auf dem gemeinsamen Fugenmaß (kgV der Modul-Einheiten)',
      'So bleiben Laibungen auf beiden Geschossen einpassbar — ohne den Verband zu dehnen; unterschiedliche Fugenbreiten stören das Cut-Raster nicht',
      'Eine Etage allein: weiterhin echte Lagen-Cuts inkl. Halbstein-Versatz',
    ],
  },
  {
    version: '2.0.66',
    date: '2026-09-02',
    title: 'Öffnungen schließen an Mauerwerksfugen ab',
    changes: [
      'Studio mit Läufer-/Modulverband: Drag, Pfeile und Positionsfeld rasten Laibungen an echte Steinfugen (gerade + versetzte Lage)',
      'Höhe an Ziegelschichten; Maße ändern richtet beide Laibungen bzw. Ober-/Unterkante mit aus',
      'Streifen/Wildverband/ohne Paneele: weiterhin 8-cm-Raster — Verband-Logik unverändert',
    ],
  },
  {
    version: '2.0.65',
    date: '2026-09-02',
    title: 'Auswahl-Toolbar rechts: volle Höhe, Paneele scrollbar',
    changes: [
      'Rechte Auswahl-Leiste (`#selection-toolbar`) füllt die Spalte bis unten — kein Deckel mehr bei 520 px / 52 vh',
      'Register (`#selection-right-tabs`) und Panelbereich strecken sich mit; Paneele-Inhalt vertikal scrollbar',
    ],
  },
  {
    version: '2.0.64',
    date: '2026-09-02',
    title: 'Läuferverband: echtes 0,5∶1 an 45°-Ecken',
    changes: [
      '45°-Forced-Ends: Halbstein bleibt exakt ½ Läufer (bei 24 cm: 12, nicht auf 16 gerastert) — Stoßfugen wieder mittig statt ~⅓/⅔',
      'Feldsteinbreite je Lage identisch — kein Fugen-Drift über die Fassadenbreite',
      'Bossen-Flush an Öffnungen über die volle Höhe inkl. Bogenkappe (kein Einzug oberhalb der Kämpferlinie)',
    ],
  },
  {
    version: '2.0.63',
    date: '2026-09-02',
    title: 'Paneele an Öffnungen: kein Durchschuss, bündige Bögen',
    changes: [
      'Läuferverband: keine Phantom-Steine mehr quer durch Fenster (Feldanfang an der Laibung + Filter); Steine enden an der Laibung statt hineinzuragen',
      'Laibungs-Siegel begrenzt auf echte Rasterlücken (≤ 8 cm) und max. Steinbreite — keine aufgeblasenen Endsteine neben Öffnungen',
      'Bossen an Bogen-/Laibungsresten bleiben in der Laibungs-X bündig (kein Einzug „nach innen“)',
    ],
  },
  {
    version: '2.0.62',
    date: '2026-09-02',
    title: 'Mauerverbände: klassisches 0,5/1-Muster, Streifen bei großen Steinen',
    changes: [
      'Läuferverband wieder wandweit: gerade Lagen 1/1/1…, versetzte 0,5/1/…/0,5 — Fugen fluchten über alle Pfeiler; Laibungen schneiden nur ab (Ecken/Bögen unverändert)',
      'Kein gleichmäßiges Dehnen aller Steine pro Feld mehr — innere Steine behalten die Sollbreite (auch bei 64×32 cm)',
      'Streifen/Zwickel bei großen Paneelen: Clip-Reste werden nicht mehr bis ½ Steinbreite (bei 64 cm: 32 cm) verworfen oder verschmolzen',
    ],
  },
  {
    version: '2.0.61',
    date: '2026-09-02',
    title: 'Mauerwerk: Modulraster an Laibungen, Ecken und Dock-Nähten',
    changes: [
      'Jede Steinlage wird feldweise (Wandende ↔ Laibung ↔ Wandende) im Modulraster gelegt: Endsteine sind immer 1 oder 0,5 (Läufer) — keine 1,5er, keine Splitter, exakter 0,5-Versatz zwischen den Lagen',
      'Gilt für alle Verbände: Läufer-/Binderlagen gehen in ½-Läufer-Schritten auf — Läuferlage endet nicht mehr mit ¼-Stein',
      'Dock-Nähte: der erste Stein einer Wand spiegelt den letzten der Vorgängerwand (0,5+0,5 wird ein Stein, 1+1 eine Fuge)',
      '45°-Ecken: kein Reststück neben dem wechselnden Endstein — Feld wird minimal gedehnt',
      'Bogen: Steine/Streifen über der Bogenkappe laufen als Keil bis zur Schichtoberkante — kein flacher dunkler „Kasten“ über dem Scheitel',
    ],
  },
  {
    version: '2.0.60',
    date: '2026-09-01',
    title: 'Wandflächen reflektieren Licht',
    changes: [
      'Render-Modus: Außen-Paneele und Wände mit EnvMap (Himmel/Szene) und geringerer Rauheit — sichtbare Lichtreflexion',
      'Innenwände empfangen Punktlicht (Wand-Mesh auf Innen-Layer; Außen-Material blockiert Punktlicht per Shader)',
      'Außenflächen reflektieren Sonne/Himmel; Innenflächen das Punktlicht aus dem Raum',
    ],
  },
  {
    version: '2.0.59',
    date: '2026-09-01',
    title: 'Lade-Fix CSS',
    changes: [
      'Behoben: App lud nicht — CSS-Syntaxfehler in style.css nach Ebenen-Lichter-Styles',
    ],
  },
  {
    version: '2.0.58',
    date: '2026-09-01',
    title: 'Lichter im Ebenenbaum',
    changes: [
      'Neue Sektion „Lichter“ in der linken Ebenen-Liste — alle platzierten Punktlichter auf einen Blick',
      'Lichter auswählen, ein-/ausblenden (Licht an/aus), duplizieren und löschen über Zeilen- oder Mehr-Menü',
      'Ebenen-Panel wieder sichtbar; leerer Zustand mit Hinweis auf Bibliothek → Licht',
    ],
  },
  {
    version: '2.0.57',
    date: '2026-09-01',
    title: 'Fassadenlicht, Bloom, Schattenseiten',
    changes: [
      'Gegenlicht-Shader dimmt Schattenseiten der Hauptflächen wieder (Ost/Nord bei Südsonne nicht mehr fälschlich hell)',
      'Außenfassade erhält EnvMap-Reflexionen aus der CubeCamera (Himmel/Nachbarflügel)',
      'Bloom stärker und früher sichtbar (Default-Schwelle/Stärke, hellerer HDR-Kern an Lichtquellen)',
    ],
  },
  {
    version: '2.0.56',
    date: '2026-09-01',
    title: 'Weiße Decken und Fußböden',
    changes: [
      'Decken und Fußböden im 3D-Render sind wieder weiß wie die Innenwände (Default)',
      'Gleiche Innenbeleuchtung: leichte EnvMap-Reflexion, kein Gegenlicht-Dim, keine Punktlicht-Selbstabschattung',
      'Farb-Toolbar (`ceilingColor`) wirkt weiter auf Decke und Boden in 3D',
    ],
  },
  {
    version: '2.0.55',
    date: '2026-09-01',
    title: 'Bloom, scharfes Glas, Außenlicht',
    changes: [
      'Bloom in 2D-Front wieder sichtbar — EffectComposer wurde in der Front-Ansicht nicht mit der Viewport-Größe synchronisiert',
      'Licht-Glühen (Bloom-Kern) im Render-Modus wieder aktiv — kleine HDR-Kugel statt ausgeblendetem Billboard',
      'Glas schärfer: weniger Brechung in 3D, dünnere Alpha-Scheibe in 2D (kein milchiger Schleier)',
      'Außenfassade empfängt weiterhin Sonne/Hemisphere — Punktlicht bleibt innen (Shader-Maske unverändert)',
    ],
  },
  {
    version: '2.0.54',
    date: '2026-09-01',
    title: 'Wandflächen, Innenlicht, 2D-Glas',
    changes: [
      'Wand-Außenflächen zeigen wieder nach außen — der Streifen über ausgeblendeten Paneelreihen ist geschlossen',
      'Innenwände empfangen Punktlicht ohne Selbstabschattung, bleiben hell und spiegeln leicht',
      '2D-Aufriss: Glas ist durchsichtig (Physical-Transmission funktioniert in der Ortho-Ansicht nicht)',
    ],
  },
  {
    version: '2.0.53',
    date: '2026-09-01',
    title: 'Innenwände, 2D-Licht, Freistreifen',
    changes: [
      'Wand-Normalen korrigiert — Innenflächen und Freistreifen oben wieder sichtbar (panelFlip false)',
      'Innenwände und Laibungs-Innenseite ohne Gegenlicht-Abdunklung; schwaches Innen-Fill bei Punktlicht',
      'Licht durch Fenster in 2D/Front wieder sichtbar, wenn Innen-Punktlicht aktiv ist',
    ],
  },
  {
    version: '2.0.52',
    date: '2026-09-01',
    title: 'Start-Fix',
    changes: [
      'Studio startet wieder — falscher Import `getGlassEnvMap` behoben (`getGlassEnvironment`)',
    ],
  },
  {
    version: '2.0.51',
    date: '2026-09-01',
    title: 'Konche, Freistreifen, Innenlicht',
    changes: [
      'Konche wieder rund — flache Okklusions-Kappen nur noch unsichtbar in der Shadow-Map, nicht in der sichtbaren Laibung',
      '„Reihen oben ausblenden“: Paneele im unteren Bereich bleiben sichtbar; nur der Freistreifen nutzt die volle Wandtiefe für Schatten',
      'Innenwände ohne Gegenlicht-Abdunklung, mit leichten Reflexionen — Licht scheint in 2D wieder durch Fenster',
      'Shadow-Tunnel an Öffnungen etwas breiter (2,5 cm) — weniger Licht-Leck an Rahmenrändern',
    ],
  },
  {
    version: '2.0.50',
    date: '2026-09-01',
    title: 'Punktlicht: Konche und Fassade dicht',
    changes: [
      'Konche und Nischen bekommen kein Innenlicht mehr — die Kalotte ist lichtdicht, nicht mehr ein leuchtender Hohlraum',
      'Editor-Glühen (additive Lichtkreise) scheint im Render nicht mehr durch Wände; im Raum bleibt eine kleine opake Kugel',
      'Fensterrahmen und unsichtbare Raumplatten schließen die Shadow-Map zuverlässig',
    ],
  },
  {
    version: '2.0.49',
    date: '2026-09-01',
    title: 'Punktlicht: Raum wirklich lichtdicht',
    changes: [
      'Wände wieder ein Stück — der Geometrie-Split hatte Flächen zerstört und extra Böden erzeugt',
      'Innenlicht trifft Paneele, Sockel, Gesimse und äußere Fensterbänke nicht mehr (Shader-Maske; Layer allein reichen in Three.js nicht)',
      'Unsichtbare Boden-/Deckenplatten auf der Wandaußenkante schließen die Fuge zur Wand — kein Licht mehr durch Kellerfenster von oben, ohne sichtbare Extra-Flächen',
    ],
  },
  {
    version: '2.0.48',
    date: '2026-09-01',
    title: 'Punktlicht: lichtdichter Raum ohne Extra-Meshes',
    changes: [
      'Duplikat-Boden/Decken-Schalen entfernt — keine sichtbaren Extra-Flächen und kein Z-Fighting mehr an Wänden',
      'Studio-Wände in Außen- (Layer 0) und Innenschale (Layer 1) getrennt — Paneele, Sockel und Gesimse erhalten kein Punktlicht',
      'Okklusion nur über bestehende Böden, Decken, Laibungen und Öffnungs-Tunnel (Konche, Keller)',
    ],
  },
  {
    version: '2.0.47',
    date: '2026-09-01',
    title: 'Punktlicht: kein Bloom auf der Fassade',
    changes: [
      'Selective Bloom — nur Licht-Marker blühen, nicht helle Fenster-Innenräume; keine orange Halo-Linien mehr auf Paneele/Sockel/Gesimse',
      'EnvMap-Reflexionen nur Außen-Layer — glänzende Steine spiegeln kein Innenlicht',
      'Härtere Punktlicht-Schatten; Wand-Außenmaterial FrontSide bei Raumhülle',
    ],
  },
  {
    version: '2.0.46',
    date: '2026-09-01',
    title: 'Punktlicht: nur Innenraum',
    changes: [
      'Bibliotheks-Punktlicht nur auf Innen-Layer — Gesimse, Sockel, Paneele und äußere Fensterbänke werden nicht mehr direkt beleuchtet',
      'Raumhülle schreibt Tiefe (depthWrite) — Glühen/Bloom scheint nicht mehr durch Wände, Konchen und Kellerfenster',
      'Konche/Kellerfenster: zusätzliche Außen-/Innen-Kappen in der Öffnungs-Dichtung',
    ],
  },
  {
    version: '2.0.45',
    date: '2026-09-01',
    title: 'Punktlicht: Konche, Keller & Fundament',
    changes: [
      'Konche: Öffnung lichtdicht verschlossen (Innen- und Nischen-Rückwand) — kein Leck mehr durch die Kalotte',
      'Kellerfenster: Boden-Vollplatte liegt mindestens über der Kellerfenster-Oberkante — kein Licht von oben',
      'Unterste Fundament-Platte schließt Licht nach unten ab',
      'Zusätzliche Öffnungs-Dichtungen mit vollem Tunnel-Umfang (inkl. Schwelle)',
    ],
  },
  {
    version: '2.0.44',
    date: '2026-09-01',
    title: 'Punktlicht: lichtdichte Räume',
    changes: [
      'Raumhülle: Grundriss-Boden/Decke plus Geschoss-Vollplatten — Licht bleibt im Raum, außer durch Öffnungen, Glas oder offene Fenster/Türen',
      'Okklusion automatisch bei jedem aktiven Punktlicht im Render-Modus (3D/Front), unabhängig von Orbit',
      'Wände, Verkleidung, Rollläden, Laibungen und Öffnungs-Tunnel werfen Schatten; Glas nicht',
    ],
  },
  {
    version: '2.0.43',
    date: '2026-09-01',
    title: 'Punktlicht: Schatten & Bloom',
    changes: [
      'Geschoss-Vollplatten (BBox) blockieren Licht diagonal zum Kellerfenster — auch wenn der Grundriss-Boden nicht bis zur Außenwand reicht',
      'Wände, Rahmen, Verkleidung, Laibung und Öffnungs-Tunnel werfen Cube-Shadows für Punktlichter',
      'Lichtquellen erzeugen Bloom (HDR-Kern) — wirken wie Glühbirne, nicht nur Reflexionen',
      'Front-Ansicht nutzt Bloom-Pipeline; Punktlicht-Schatten werden pro Frame aktualisiert',
    ],
  },
  {
    version: '2.0.42',
    date: '2026-09-01',
    title: 'Licht: Klarglas & Geschoss-Schatten',
    changes: [
      'Klarglas filtert Licht und Glühen nicht mehr wie eine Sonnenbrille (Transmission ohne Farbabsorption)',
      'Punktlicht wird von Decken und Böden zwischen Etagen abgeschattet — Kellerfenster ohne Licht von oben',
      'Wandkörper werfen ebenfalls Cube-Shadows für Bibliotheks-Punktlichter',
    ],
  },
  {
    version: '2.0.41',
    date: '2026-09-01',
    title: 'Punktlicht: Watt & Farbe',
    changes: [
      'Leistung in Watt (LED, 1–150 W) statt undurchsichtiger Three.js-Zahlen — 10 W ≈ 800 lm',
      'Licht-Glühen übernimmt die gewählte Lichtfarbe (warm/kalt), nicht mehr nur weiß',
      'Alte Intensitätswerte werden beim Laden automatisch in Watt umgerechnet',
    ],
  },
  {
    version: '2.0.40',
    date: '2026-09-01',
    title: 'Licht durch Glas',
    changes: [
      'Punktlicht-Glühen scheint durch Fensterglas und offene Öffnungen — Wände, Rahmen und Sprossen verdecken weiterhin',
      'Glas: depthWrite aus, damit der Licht-Schein nicht an der Scheibe hängen bleibt',
    ],
  },
  {
    version: '2.0.39',
    date: '2026-09-01',
    title: 'Lichtpunkte: Glühen & Ausblenden',
    changes: [
      'Szene → Licht: Checkbox „Lichtpunkte anzeigen“ (auch Bibliothek → Tab Licht)',
      'Marker sind weiches Glühen statt fester Kugeln — werden von Wänden, Rahmen und Sprossen verdeckt (depthTest)',
    ],
  },
  {
    version: '2.0.38',
    date: '2026-09-01',
    title: 'Schnellerer Studio-Start',
    changes: [
      'Ladeoverlay verschwindet zuverlässig nach dem Start — kein Hängenbleiben mehr',
      'Fix: Licht-Runtime vor Fassaden-Controller blockierte den App-Start nicht mehr',
      'Atmosphäre, Fenster-Meshes und Schatten-Map werden im Hintergrund nachgeladen (kein Doppel-Bake beim Start)',
      'Beschriftungs-Schrift lädt parallel, ohne den ersten sichtbaren Frame zu blockieren',
    ],
  },
  {
    version: '2.0.37',
    date: '2026-09-01',
    title: 'Lichtkreise global ein/aus',
    changes: [
      'Bibliothek → Tab Licht: Checkbox „Lichtkreise anzeigen“ für alle Punktlicht-Marker',
      'Persistenz in `viewOptions.showLightMarkers`; pro Licht weiterhin „Marker anzeigen“ in der Toolbar',
    ],
  },
  {
    version: '2.0.36',
    date: '2026-09-01',
    title: 'Punktlicht-Farbtemperatur',
    changes: [
      'Toolbar: Slider Farbtemperatur (2000–6500 K) für warmes/kühles Licht — Live-Vorschau mit Farbfeld',
      'Persistenz: `colorTemperature` in `SceneLight`; Farbe wird aus Kelvin berechnet (`kelvinToColor`)',
    ],
  },
  {
    version: '2.0.35',
    date: '2026-09-01',
    title: 'Punktlicht-Einstellungen erweitert',
    changes: [
      'Intensität, Reichweite und Abfall: Übernahme erst bei Enter oder Klick außerhalb des Feldes',
      'Rechtsklick auf Punktlicht: Duplizieren (+48 cm Versatz)',
      'Neu: Farbe, Marker ein/aus, Marker-Größe, Reichweite (cm), Abfall (decay)',
    ],
  },
  {
    version: '2.0.34',
    date: '2026-09-01',
    title: 'Punktlicht wird von Wänden verdeckt',
    changes: [
      'Bibliotheks-Punktlichter werfen Cube-Shadows in 2D-Front und 3D (Render-Modus, Schatten an)',
      'Rahmen, Sprossen, Öffnungs-Tunnel und Wandkörper blockieren Innenlicht nach außen',
      'Shadow-Map aktualisiert sich beim Verschieben der Quelle',
    ],
  },
  {
    version: '2.0.33',
    date: '2026-09-01',
    title: 'Punktlicht in 2D verschieben',
    changes: [
      '2D-Front: Drag auf der Blick-Ebene (nicht mehr nur horizontal); Tiefe per Slider entlang der Blickrichtung',
      'Rechtsklick auf Punktlicht: Kontextmenü „Licht entfernen“; kein Pan bei Rechtsklick auf die Quelle',
    ],
  },
  {
    version: '2.0.32',
    date: '2026-09-01',
    title: '3D-Ansicht wieder verfügbar',
    changes: [
      'Button 3D in der Viewport-Chrome wieder sichtbar — OrbitControls, freie Navigation, Scene-Lights verschieben',
      'Gespeicherte 3D-Ansicht wird beim Reload wiederhergestellt (Persistenz)',
      'Oben, Entwurf, Galerie und Einfach/Komplex bleiben ausgeblendet',
    ],
  },
  {
    version: '2.0.31',
    date: '2026-09-01',
    title: 'Bibliotheks-Punktlichter funktionieren',
    changes: [
      'Fix: `sceneLights` ging bei jedem State-Clamp durch `migrateToBuildings` verloren — eingefügte Lichter verschwanden sofort',
      'Drag & Drop / Raycast: Platzierung wandelt Weltkoordinaten in siteOffset-Lokal um (korrekte Position an der Fassade)',
      'Größere sichtbare Marker-Kugel; Auswahl bleibt nach Reload erhalten',
    ],
  },
  {
    version: '2.0.30',
    date: '2026-09-01',
    title: 'Haus wieder sichtbar nach Start',
    changes: [
      'Fix: fehlender Import `isPerfOverlayEnabled` — die Animationsloop war bei jedem Frame abgestürzt, nichts wurde gerendert',
      'Startup: Animationsloop wartet auf Atmosphäre und erstes Mesh-Load; bis dahin kein Dirty-Skip',
      'Nach dem Lade-Overlay: erneuter Viewport-Refresh',
    ],
  },
  {
    version: '2.0.29',
    date: '2026-09-01',
    title: 'Performance-Debug lesbar',
    changes: [
      'Debug-Overlay sitzt über der Ansicht (nicht auf der rechten Sidebar), mit fester Mindestgröße',
      'Sofort sichtbarer Text; FPS/Drawcalls auch in Front- und Oben-Ansicht',
    ],
  },
  {
    version: '2.0.28',
    date: '2026-09-01',
    title: 'Punktlicht platzieren & verschieben',
    changes: [
      'Punktlicht aus Bibliothek in 3D/Front/Oben hineinziehen — Klick oder Drag-and-Drop',
      'Leuchtende Kugel in 3D anklicken und per Drag verschieben (größere Trefferfläche)',
    ],
  },
  {
    version: '2.0.27',
    date: '2026-09-01',
    title: 'Bibliotheks-Lichter & UI-Fixes',
    changes: [
      'Bibliothek → Tab „Licht“: Punktlicht einfügen, in 3D anklicken, Position X/Y/Z rechts einstellen',
      'Rechte Einstellungen: vertikales Scrollen in Beleuchtung und Auswahl-Panels',
      'Debug-Overlay (Performance) größer und besser lesbar',
      'Bloom wirkt wieder in der 3D-Ansicht (nicht nur Render, nicht im Linienmodus)',
    ],
  },
  {
    version: '2.0.26',
    date: '2026-09-01',
    title: 'Punktlichter sichtbar',
    changes: [
      'Innen-/Außen-Punktlicht: höhere Intensität, leuchtende Kugeln, an siteOffset gebunden (dreht mit dem Haus)',
      'Aktiv in 3D-Vorschau und Render — Nacht-Erkennung über Solar-Tageszeit, nicht manuellen Sonnenwinkel',
    ],
  },
  {
    version: '2.0.25',
    date: '2026-09-01',
    title: 'Nachtlicht & volle Tageszeit',
    changes: [
      'Punktlicht innen (warm) und außen (kühl) im Render-Modus — für Nachtszenen mit weichen Schatten',
      'Tageszeit-Slider 0:00–23:59 (Minutenschritte) — volle Nacht testbar',
    ],
  },
  {
    version: '2.0.24',
    date: '2026-09-01',
    title: 'Eingangstreppe mit Schatten',
    changes: [
      'Eingangstreppe empfängt Werf- und Selbstschatten in der 3D-Ansicht — Stufen wirken nicht mehr flach',
      'Shadow-Acne auf Stufen vermieden (FrontSide bei DoubleSide-Material)',
    ],
  },
  {
    version: '2.0.23',
    date: '2026-09-01',
    title: 'Fenstertiefe pro Öffnung',
    changes: [
      'Frontlage (cm von Außenkante) je Fenster/Tür einstellbar — unter Maße in der Öffnungs-Sidebar',
      'Gebäude-Standard-Button stellt die gemeinsame Fallback-Tiefe wieder her',
      'Anzeige als effektive Tiefe (24 cm Laibung + Offset), nicht nur als internes Offset',
    ],
  },
  {
    version: '2.0.22',
    date: '2026-09-01',
    title: 'Konche-Dekor, Keller-Auswahl, Fassadenfarbe',
    changes: [
      'Konche: Fensterbank, Profile und Verdachung in der Sidebar und 3D wie bei Fenstern',
      'Kellerfenster: bei Fassade/Etage/Typ werden nur noch Kellerfenster mitbearbeitet — normale Fenster bleiben unberührt',
      'Auswahl (Bogen): nur markierte Öffnungen, nicht mehr alle Fenster der Wand',
      'Wandfarbe setzt Paneel-Farbe mit — einheitliches Weiß auf allen Etagen im Fassaden-Gültigkeitsbereich',
    ],
  },
  {
    version: '2.0.21',
    date: '2026-09-01',
    title: '2D-Navigation schneller & animierter Doppelklick-Zoom',
    changes: [
      'Zoom und Pan in 2D-Front und Oben-Ansicht: gecachtes Kamera-Layout statt teurer Wand-Neuberechnung pro Frame — spürbar flüssiger',
      'Während Navigation: leichtes Rendering (Oben-Ansicht ohne Reflexionen/Himmel), Raster-Update erst nach Stillstand',
      'Doppelklick-Zoom animiert weich (~280 ms) zum Klickpunkt',
    ],
  },
  {
    version: '2.0.20',
    date: '2026-09-01',
    title: 'Abstandslinien beim Verschieben',
    changes: [
      'Beim Verschieben von Fenstern/Türen: gelbe Maßlinien zeigen den Abstand in cm zum nächsten Objekt (links, rechts, oben, unten)',
      'Abstand zur Wandkante oder zur nächsten Nachbar-Öffnung — in 2D mit cm-Label, in 3D als Maßlinie mit Endstrichen',
    ],
  },
  {
    version: '2.0.19',
    date: '2026-09-01',
    title: '2D-Zoom flüssig & Doppelklick',
    changes: [
      'Mausrad-Zoom in der 2D-Front: gebündelt pro Frame, exponentiell statt fester Stufen — flüssiger auf Trackpad und Maus',
      'Während Zoomen/Pannen: Orbit-Lite (Pixelratio 1) wie in 3D — weniger Ruckler',
      'Doppelklick in 2D-Front und Oben-Ansicht zoomt zum Klickpunkt (2×)',
    ],
  },
  {
    version: '2.0.18',
    date: '2026-09-01',
    title: 'Einheitliche Fassade ohne Etagenstreifen',
    changes: [
      'Zwischendecken werfen keine Schatten mehr auf die Außenfassade (nur Innen-Shadow-Layer)',
      'Beim Etagen-Kopieren ohne Sockel wird die Sockelhöhe auf 0 gesetzt — gleiches Paneel-Raster auf allen Etagen',
    ],
  },
  {
    version: '2.0.17',
    date: '2026-09-01',
    title: 'Teilen-Link: Farben & Kompass',
    changes: [
      'Der Teilen-Link speichert Bodenfarbe, Hintergrund, Himmelsfarbe und die gewählte Kompass-Ausrichtung mit',
      'Alte Links ohne diese Felder funktionieren weiter — es gelten die Standardwerte',
    ],
  },
  {
    version: '2.0.16',
    date: '2026-09-01',
    title: 'Shift-Mehrfachauswahl im Viewport',
    changes: [
      'Front- und Oben-Ansicht: Shift+Klick auf Wand oder Öffnung ergänzt die Mehrfachauswahl statt zu pannen',
      'Shift+Klick auf leeren Bereich verschiebt die Ansicht wie bisher',
      'Ebenenbaum: Shift/Ctrl/Cmd+Klick auf Öffnungen toggelt die Auswahl wie im Viewport',
    ],
  },
  {
    version: '2.0.15',
    date: '2026-09-01',
    title: 'Decke bündig mit Wandoberkante',
    changes: [
      'Zwischendecke ragte 8 cm über die Wandoberkante — Oberseite liegt jetzt bündig auf der Wandoberkante',
    ],
  },
  {
    version: '2.0.14',
    date: '2026-09-01',
    title: 'Kellerfenster-Teilung & Einstellungen scrollen',
    changes: [
      'Kellerfenster: Fensterteilung wieder wählbar — max. 2 Flügel, kein Oberlicht, keine Raster-Teilung, max. 1 Sprosse',
      'Rechte Einstellungs-Spalte scrollt wieder, wenn der Inhalt höher als der Bildschirm ist',
    ],
  },
  {
    version: '2.0.13',
    date: '2026-09-01',
    title: 'Bogenform: Stichmaß beim Wechsel',
    changes: [
      'Wechsel der Bogenform (z. B. Stichbogen → Rundbogen) setzt das Stichmaß auf den Form-Standard — kein verzerrter Mini-Halbkreis mehr',
    ],
  },
  {
    version: '2.0.12',
    date: '2026-09-01',
    title: 'Fensterschatten nach Reload',
    changes: [
      'Shadow-Map wird erst nach geladenen Fenster-Meshes berechnet — Schatten auf Rahmen fehlen nach Seiten-Reload nicht mehr',
      'Sonnenwinkel-Slider war bisher nötig, um die korrekte Weichheit zu erzwingen',
    ],
  },
  {
    version: '2.0.11',
    date: '2026-09-01',
    title: 'Szenenfarben wieder sichtbar',
    changes: [
      'Farb-Picker für Hintergrund, Boden und Himmel reagieren wieder (Event-Listener auch bei vorgefertigten Inputs)',
      'Live-Vorschau beim Ziehen; Bodenfarbe wirkt auch am atmosphärischen Horizont',
    ],
  },
  {
    version: '2.0.10',
    date: '2026-09-01',
    title: 'Neue Licht-Standardwerte',
    changes: [
      'Standard-Licht: 13:15, Sonnenwinkel 210°, Sonnenlicht 3,9, Umgebungslicht 0,53, Schatten-Kontrast 1,50, Weichheit 5,0, Farbtemperatur 4500 K',
      'Beim App-Start wird nur noch das Datum auf heute gesetzt — gespeicherte und Standard-Lichtwerte bleiben erhalten',
    ],
  },
  {
    version: '2.0.9',
    date: '2026-09-01',
    title: 'Fensterschatten nach dem Verschieben',
    changes: [
      'Nach dem Platzieren einer Öffnung empfangen die Fensterrahmen wieder Gesims- und Profilschatten',
    ],
  },
  {
    version: '2.0.8',
    date: '2026-09-01',
    title: 'Fensterziehen: Schatten nach Platzieren',
    changes: [
      'Nach dem Loslassen werden betroffene Gebäude neu gebaut und die Schatten-Map aktualisiert — Fensterschatten bleiben erhalten',
    ],
  },
  {
    version: '2.0.7',
    date: '2026-09-01',
    title: 'Ziehen: kein stehender Schatten',
    changes: [
      'Beim Start des Fensterziehens wird die Schatten-Map einmal neu berechnet — kein „Geisterschatten“ an der alten Position',
      'Schatten-Tunnel der betroffenen Wand wirft während des Ziehens nicht',
    ],
  },
  {
    version: '2.0.6',
    date: '2026-09-01',
    title: 'Drag-Ghost: Form, Füllung, kein Schatten',
    changes: [
      'Orangefarbene Öffnungsmaske sitzt auf der Fassadenfläche (exakte Bogenform), Füllung und Kontur deckungsgleich',
      'Ausgeblendete Fenster/Profile werfen beim Ziehen keinen Schatten mehr',
    ],
  },
  {
    version: '2.0.5',
    date: '2026-09-01',
    title: 'Ziehen: Öffnungsmaske ohne Schatten',
    changes: [
      'Beim Verschieben: orangefarbene Ghost-Form folgt der echten Öffnungskontur (Bogen, Stadion, Rechteck) — kein Werfschatten',
    ],
  },
  {
    version: '2.0.4',
    date: '2026-09-01',
    title: 'Fensterziehen: nur Umriss',
    changes: [
      'Beim Verschieben: Profile, Bänke und Fenster-Detail ausgeblendet — nur die orangefarbene Öffnungsform schwebt vor der Wand',
      'Ladeanimation „Haus vom Nikolaus“: flüssiger Loop ohne Eckpunkte und ohne abgebrochene Pfade',
    ],
  },
  {
    version: '2.0.3',
    date: '2026-09-01',
    title: 'Fenster schwebt beim Verschieben',
    changes: [
      'Beim Ziehen schließt die Wandöffnung einmalig; Fenster, Bänke und Verdachung schweben 48 cm vor der Fassade',
      'Keine Schatten-Neuberechnung während des Ziehens — Loch und Schatten sitzen nach dem Loslassen wieder passgenau',
      'Flüssige Mesh-Verschiebung bleibt erhalten',
    ],
  },
  {
    version: '2.0.2',
    date: '2026-09-01',
    title: 'Objekte flüssig verschieben',
    changes: [
      'Fenster, Wände, Zierband und Schrift folgen der Maus per Mesh-Verschiebung — ohne Ziegel-Rebuild während des Ziehens',
      'Mauerwerk-Loch und Schatten sitzen nach dem Loslassen wieder passgenau',
      'Klick-Auswahl bleibt unverändert schnell',
    ],
  },
  {
    version: '2.0.1',
    date: '2026-09-01',
    title: 'Sonnen-Slider wieder wirksam',
    changes: [
      'Farbtemperatur färbt das Sonnenlicht wieder (warm 2700 K … kühl 8000 K)',
      'Schatten-Weichheit ändert die Penumbra live im Render-Modus',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-09-01',
    title: 'Fassaden-Builder 2.0',
    githubTag: 'v2.0.0',
    changes: [
      'Schlanker Fokus: 2D-Render als Standardansicht',
      'Entfernt aus UI: Ebenen, Oben, 3D, Entwurf, Einfach/Komplex, Galerie',
      'Schnellere Auswahl in 2D: Fenster/Wand-Markierung ohne volles Geometrie-Rebuild',
    ],
  },
  {
    version: '0.7.346',
    date: '2026-09-01',
    title: 'Weichere PCSS-Penumbra',
    changes: [
      'PCSS: 32 Samples statt 17 — weniger sichtbares Poisson-Raster',
      'Shadow-Map 8192 px bei kleinen Sites (≤ 22 m), sonst 4096',
    ],
  },
  {
    version: '0.7.345',
    date: '2026-09-01',
    title: 'Original-PCSS wiederhergestellt',
    changes: [
      'Schatten wieder wie v0.7.314: hart am Okkluder, weicher mit Abstand (Three.js-PCSS, 0,8…28 cm)',
      'Heutige Morgen-Experimente (48…420 cm, Uniform-Pfad) entfernt',
      'Fenster-Werfschatten in 2D bleiben erhalten',
    ],
  },
  {
    version: '0.7.344',
    date: '2026-09-01',
    title: 'Schatten-Weichheit und Fenster-Werfschatten',
    changes: [
      'Schatten-Weichheit-Slider steuert wieder sichtbares PCSS (48…420 cm, live-Uniform)',
      'Fensterrahmen/Konsolen empfangen in 2D wieder Werfschatten wie Paneele',
    ],
  },
  {
    version: '0.7.343',
    date: '2026-09-01',
    title: 'Schatten zurück auf bewährten PCSS-Stand',
    changes: [
      'Heutige Schatten-Experimente (v0.7.331–342) zurückgenommen — wieder performantes PCSS mit Weichheit-Slider',
      'Boden-Umbra-Shader und klassische PCSS-Konstanten (0,8…28 cm) wie zuvor',
      'Flüssige Sonnen-Slider (gedrosselte Shadow-Map) bleibt erhalten',
    ],
  },
  {
    version: '0.7.342',
    date: '2026-09-01',
    title: 'Fensterschatten wieder, weich statt gerastert',
    changes: [
      'Rahmen/Konsolen empfangen wieder Werfschatten in 2D (wie Paneele)',
      'PCSS-Mindest-Penumbra für Öffnungen — kein harter Kontakt/Gerastert auf Vorsprung',
    ],
  },
  {
    version: '0.7.341',
    date: '2026-09-01',
    title: 'Laubschatten weg, saubere Fenster, flüssige Sonne',
    changes: [
      'Laubschatten-Gobo vollständig entfernt',
      'Fensterrahmen ohne Shadow-Map (kein Gerastert mehr); Gesims-Schatten bleibt auf Paneeeln',
      'Sonnen-Slider: Licht sofort, Shadow-Map gedrosselt — flüssiger Azimut/Tagesverlauf',
    ],
  },
  {
    version: '0.7.340',
    date: '2026-09-01',
    title: '2D-Navigation wie 3D',
    changes: [
      'Pan in Bildschirmachsen (OrbitControls-Logik) — nicht mehr spiegelverkehrt je Fassade',
      'Rechtsklick/Mittelmaus/⇧+Ziehen verschieben; Pfeiltasten panen wie in 3D/Oben',
    ],
  },
  {
    version: '0.7.339',
    date: '2026-09-01',
    title: 'Laubschatten sichtbar, Fensterschatten weicher',
    changes: [
      'Laubschatten: Multiply-Overlay auf der Fassade plus sun-facing Shadow-Gobo im Frustum',
      'Fensterrahmen/Konsolen: empfangene Schatten weicher (wie Wand/Konsole)',
    ],
  },
  {
    version: '0.7.338',
    date: '2026-09-01',
    title: 'Laubschatten-Gobo in 2D',
    changes: [
      'Foto-Baumschatten als Gobo in der 2D-Front (Farbe, Sonne über Horizont)',
      'Steuerung: Sonne → Laubschatten (2D), Default an',
    ],
  },
  {
    version: '0.7.337',
    date: '2026-09-01',
    title: 'Fenster-Schatten wie Gesims in 2D',
    changes: [
      '2D-Front: Fensterrahmen empfangen Werfschatten wie Paneele (Gesims auf Wand)',
      '3D/Oben unverändert ohne Rahmen-Empfang (keine Schraffur)',
    ],
  },
  {
    version: '0.7.336',
    date: '2026-09-01',
    title: '2D-Zoom & Export-Slider',
    changes: [
      '2D-Ansicht: Mausrad, +/− und Ziehen/⇧+Ziehen zum Zoomen und Verschieben',
      'Export-Vorschau rechts: Ansichten nebeneinander, volle Höhe, horizontal scrollen',
    ],
  },
  {
    version: '0.7.335',
    date: '2026-09-01',
    title: 'Schatten-Weichheit reagiert live',
    changes: [
      'Weichheit-Slider ohne Shader-Neubau pro Tick (PCSS-Uniform statt Chunk-Define)',
      'Sofortiges 3D-Repaint; Persistenz leicht verzögert',
    ],
  },
  {
    version: '0.7.334',
    date: '2026-09-01',
    title: 'PCSS: ein Schatten statt hart + weich',
    changes: [
      'Kein doppelter Schatten mehr: harte Silhouette bleibt, Weichheit nur innerhalb der Schattenfläche (min/hart-gewinnt)',
      'In beleuchteten Bereichen kein separater PCSS-Geisterschatten',
    ],
  },
  {
    version: '0.7.333',
    date: '2026-09-01',
    title: 'PCSS: Schatten klebt an der Sockelkante',
    changes: [
      'Umbra am Kontakt wieder hart (kein Mindest-Weichfilter); Weichheit nur weiter außen in der Penumbra',
      'Normal-Bias aus; stärkerer Depth-Bias; Shadow-Pass ohne polygonOffset an Castern (Laibung)',
    ],
  },
  {
    version: '0.7.332',
    date: '2026-09-01',
    title: 'PCSS: Schatten klebt an der Kante',
    changes: [
      'Bodenschatten setzt wieder an der Gebäudekante an (Contact-Hardening, härterer Fallback ohne Blocker)',
      'Render: geringerer Normal-Bias — weniger „schwebender“ Schatten (Peter-Panning)',
    ],
  },
  {
    version: '0.7.331',
    date: '2026-09-01',
    title: 'Schatten-Weichheit reagiert wieder live',
    changes: [
      'Render: Weichheit-Slider patcht PCSS sofort (kein UV-Delta-Filter, Shader-Cache-Bust für Wand/Boden)',
      'Hinweis: Weichheit wirkt an Boden/Wandkörper/Dach — Ziegel-Paneele empfangen absichtlich keine Shadow-Map',
    ],
  },
  {
    version: '0.7.330',
    date: '2026-09-01',
    title: 'Schatten: kein Doppel-Mix mehr',
    changes: [
      'Boden: PCSS und alter Umbra-Pass liefen parallel — wirkte gemischt; jetzt ein Schatten-Pfad',
      'Schatten-Weichheit nur in Render sichtbar; Schatten-Dunkelheit aus der Toolbar (Legacy in alten Dateien)',
      'Umgebungslicht + Schatten-Kontrast bleiben die Hauptregler für Schattenhelligkeit',
    ],
  },
  {
    version: '0.7.329',
    date: '2026-09-01',
    title: 'PCSS: weichere Schatten, weniger Punkte',
    changes: [
      'Render-Modus: Sonnenschatten weniger gepunktet (17 PCSS-Samples, Mindest-Weichheit am Schattenrand)',
      'Schatten-Weichheit-Slider steuert weiter PCSS in Render und Boden-Umbra; Kontrast/Dunkelheit unverändert',
      'Entwurf/Vorschau: weiter harte Schatten (Performance)',
    ],
  },
  {
    version: '0.7.328',
    date: '2026-09-01',
    title: 'PCSS: weiche Schatten sichtbar + schnellerer Start',
    changes: [
      'Render-Modus: Sonnenschatten-Penumbra deutlich sichtbar (größere Lichtfläche, korrekte Skala) — wirkte vorher oft wie harte Schatten',
      'Entwurf/Vorschau bleiben absichtlich hart (Performance)',
      'Schnellerer Start: kein frühes PCSS-Enable und keine unnötigen Shader-Neukompilierungen',
    ],
  },
  {
    version: '0.7.327',
    date: '2026-08-30',
    title: 'Entwurf: scharfes Ziegelmuster bei langen Wänden',
    changes: [
      'Lange Wände im Entwurf nutzen mehrere Atlas-Streifen statt einer 1024px-Textur — Ziegel bleiben lesbar statt „Brei“',
      'Atlas ohne Mipmaps und mit höherer Ziel-Auflösung (~3 px/cm)',
    ],
  },
  {
    version: '0.7.326',
    date: '2026-08-30',
    title: 'Start: Studio lädt wieder',
    changes: [
      'Behoben: App blieb auf „Studio wird geladen …“ hängen — falscher Import von `cloneWall` in `wallSegments.ts`.',
    ],
  },
  {
    version: '0.7.325',
    date: '2026-08-30',
    title: 'Entwurf: Auswahl vor Segment-Tausch',
    changes: [
      'Mit Wand-Preset: erster Klick wählt die Wand (Farben/Mauerwerk), zweiter Klick tauscht das Segment',
      'Segment-Tausch blockiert Auswahl nicht mehr bei Längen-Mismatch',
    ],
  },
  {
    version: '0.7.324',
    date: '2026-08-30',
    title: 'Entwurf: Segment tauschen',
    changes: [
      'Gewähltes Wand-Preset + Klick auf Wandabschnitt ersetzt nur dieses Segment (eine Wandfläche, keine Lücken)',
      'Greifer verlängert weiter; Preset-Länge muss zum Segment passen',
    ],
  },
  {
    version: '0.7.323',
    date: '2026-08-30',
    title: 'Bibliothek: Klick armt, Ziehen platziert',
    changes: [
      'Wand-Presets in der Bibliothek: Klick wählt Preset zum Erweitern (Greifer), Platzieren nur per Drag&Drop',
      'Entwurf: Gründerzeit-Fenster wieder sichtbar nach Geometrie-Rebuild',
    ],
  },
  {
    version: '0.7.322',
    date: '2026-08-30',
    title: 'Entwurf: Preset nur am Anbau',
    changes: [
      'Bibliothek-Preset bei markierter Wand nur armen — bestehende Fenster/Türen bleiben',
      'Greifer: Öffnungen nur im neu verlängerten Abschnitt; Verkürzen entfernt nur betroffene Öffnungen',
    ],
  },
  {
    version: '0.7.321',
    date: '2026-08-30',
    title: 'Entwurf: Öffnungen mit Preset-Greifer',
    changes: [
      'Bibliothek „Wand + Fenster/Tür“: Öffnungen sofort beim Preset-Klick und live beim Greifer-Ziehen (pro Segment)',
    ],
  },
  {
    version: '0.7.320',
    date: '2026-08-30',
    title: 'Entwurf: Greifer + Bibliotheks-Segment',
    changes: [
      'Entwurf ohne +/−: Resize-Greifer bleibt; Bibliothek-Preset definiert Segment-Länge beim Verlängern (eine Wand, keine neuen Segmente)',
      'Ohne Preset in der Bibliothek: freie Länge am Greifer; mit Öffnungs-Preset werden Fenster/Türen pro Segment gesetzt',
      '45°/90°-Abzweig (Shift) nutzt Preset-Segmentlänge, wenn Bibliothek gewählt ist',
    ],
  },
  {
    version: '0.7.319',
    date: '2026-08-30',
    title: 'Etagen mitziehen beim Ziehen und Abzweigen',
    changes: [
      'Wand verschieben (EG): gleicher Fußabdriff auf allen Etagen zieht mit — auch bei unterschiedlicher Breite',
      '45°/90°-Abzweig und Entwurf-+/− setzen Module auf allen übereinander liegenden Etagen',
      'Shift beim Verschieben: weiterhin nur die aktuelle Etage',
    ],
  },
  {
    version: '0.7.318',
    date: '2026-08-30',
    title: 'Entwurf: Wand-Module per Bibliothek + Greifer',
    changes: [
      'Im Modus Entwurf: Wand-Preset unten wählen, +/− an der markierten Wand setzt feste Module (192/384 cm …) — kein Strecken einzelner Wände mehr',
      'Resize-Greifer ausgeblendet; neues Preset in der Bibliothek gilt für die nächsten +/−-Klicks',
    ],
  },
  {
    version: '0.7.317',
    date: '2026-08-30',
    title: 'Entwurf: Fenster mit Rahmen und Sprossen',
    changes: [
      'Im Modus Entwurf werden Gründerzeit-Fenster (Rahmen, Sprossen) wie in der Vorschau gezeichnet — nicht mehr nur Glas-Rechtecke',
      'Atlas-Mauerwerk bleibt für Performance; Fenster weiter vor der Textur-Ebene',
    ],
  },
  {
    version: '0.7.316',
    date: '2026-08-30',
    title: 'Darstellungsmodus: Entwurf, Vorschau, Render',
    changes: [
      'Viewport: „Leicht“ → Entwurf, „Arbeit“ → Vorschau, neuer Modus Render mit voller Geometrie (Himmel, Bloom, weiche Schatten)',
      'Drei Buttons statt Toggle — immer genau ein Modus aktiv; gespeicherte Modi werden von alten Werten (light/work/full) migriert',
    ],
  },
  {
    version: '0.7.315',
    date: '2026-08-30',
    title: 'Entwurf: Fenster sichtbar',
    changes: [
      'Entwurf-Modus: einfache Fenster bündig vor der Atlas-Textur (nicht mehr hinter der Mauerwerksebene)',
      'Atlas ohne Tiefenpuffer-Schreiben; Laibungen in Entwurf aus (Performance)',
    ],
  },
  {
    version: '0.7.314',
    date: '2026-09-01',
    title: 'Sonnenschatten PCSS',
    changes: [
      'Sonnenschatten nutzen Percentage-Closer Soft Shadows (PCSS): scharf am Gebäude, weicher mit Abstand — wie im Three.js-Beispiel',
      'Slider Schattenweichheit steuert die PCSS-Lichtgröße (Penumbra), nicht mehr den PCF-Radius',
      'Entwurf- und Vorschau-Modus behalten harte Schatten ohne PCSS',
    ],
  },
  {
    version: '0.7.313',
    date: '2026-08-30',
    title: 'Darstellungsmodus Leicht',
    changes: [
      'Dritte Viewport-Option „Leicht“: Mauerwerk als eine Atlas-Textur aus denselben Maßen/Mustern (layoutPanelTiles), einfache Fenster und Profil-Balken',
      'Arbeit und volle Darstellung bleiben unverändert; Modi schließen sich gegenseitig aus (Voll / Arbeit / Leicht)',
    ],
  },
  {
    version: '0.7.312',
    date: '2026-08-29',
    title: 'Neues Haus und nur weiße Wände',
    changes: [
      'Ebenen → Haus-Mehr-Menü: „Neues Haus“ (leeres Gebäude neben dem Plan)',
      'Ebenen → Haus-Mehr-Menü: „Nur weiße Wände“ / „Fassade einblenden“ — Vollwände weiß ohne Öffnungen, Mauerwerk, Profile, Dach und Decken',
    ],
  },
  {
    version: '0.7.311',
    date: '2026-08-29',
    title: 'Arbeit: einfache Rechtecke, harte Schatten',
    changes: [
      'Arbeitsmodus: Mauerwerk nur noch als Rechtecke 2 cm vor der vollen Wand — keine Bogen-Clips, keine gelochte Wand',
      'Harte Schatten (BasicShadowMap, Radius 0, matte Flächen), Bloom aus, Himmel bleibt Hintergrundfarbe',
    ],
  },
  {
    version: '0.7.310',
    date: '2026-08-29',
    title: 'Arbeit: geschlossene Mauerwerks-Ebene',
    changes: [
      'Arbeitsmodus: Steine und Fugen auf einer gemeinsamen Ebene (Parkettierung), nichts dahinter gestapelt',
      'Keine leeren Fugen mehr; Wand nur in Freistreifen — kein Z-Fight',
    ],
  },
  {
    version: '0.7.309',
    date: '2026-08-29',
    title: 'Arbeit: kein Wand-Durchschimmern',
    changes: [
      'Arbeitsmodus: Steine klar vor der Wand, Fugen-Backer in der Wandstärke — kein Z-Fight mehr',
      'Wandaußenfläche in der Paneelzone weiter aus; nur Freistreifen (Reihen ausblenden) zeigen Wand',
    ],
  },
  {
    version: '0.7.308',
    date: '2026-08-29',
    title: 'Arbeit: Wand/Paneele, Bögen, Himmel',
    changes: [
      'Arbeitsmodus: Fenster mit Sprossen bleiben; Wandaußenfläche nur in Freistreifen (Reihen ausblenden), sonst nur Flat-Mauerwerk',
      'Rundbogen-Clip ohne falsche Restfläche; Profil-Balken bis an die Wand',
      'Himmel/Takram aus → Hintergrundfarbe und Boden',
    ],
  },
  {
    version: '0.7.307',
    date: '2026-08-29',
    title: 'Arbeit: flache Fassade statt Ausblenden',
    changes: [
      'Viewport „Arbeit“: flache Steine mit Fugenkontrast und Fake-Lichtfarbe, Profile/Gesims/Verdachung als einfache Balken',
      'High-Detail-Geometrie und teure Profil-Sweeps pausiert — spürbar schnelleres Wand-Ziehen und Optionen',
      'Himmel, Bloom und Fensterspiegelung bleiben unverändert (nur Geometrie wird vereinfacht)',
    ],
  },
  {
    version: '0.7.306',
    date: '2026-08-29',
    title: 'Arbeitsdarstellung für flüssigeres Bearbeiten',
    changes: [
      'Viewport-Schalter „Arbeit“: Takram-Himmel und Bloom aus, Profile/Gesims/Verdachung ausgeblendet, Fensterspiegelung aus',
      'Zustand bleibt in localStorage; Farbmodus und Nutzer-Bloom-Einstellung bleiben erhalten',
    ],
  },
  {
    version: '0.7.305',
    date: '2026-08-29',
    title: 'Altbau-Fenster: Beschläge, Holzmaße, Öffnungsarten',
    changes: [
      'Editierbare Holzmaße (Blend, Flügel, Sprosse, Kämpfer, Stulp) und profilierte Sprossen',
      'Scharnierseite und Öffnungsart (Dreh / Kipp / Drehkipp) pro Flügel',
      'Beschläge (Olive + Bänder); Kastenfenster mit eigener Innenfarbe',
      'Stabgitter / französischer Balkon; Vorhang oder Innenjalousie',
      'Tür: Kassetten, Drücker, Briefschlitz',
    ],
  },
  {
    version: '0.7.304',
    date: '2026-08-29',
    title: 'Loader: schnellere Strichanimation',
    changes: [
      'Haus-vom-Nikolaus-Loader zeichnet Kanten per stroke-dashoffset als wachsende Linien mit Eckpunkten',
      'Deutlich kürzere Segmentzeit (~85 ms)',
    ],
  },
  {
    version: '0.7.303',
    date: '2026-08-29',
    title: 'Loader: Haus vom Nikolaus',
    changes: [
      'Start-Overlay zeichnet minimalistisch das Haus vom Nikolaus (Linien, teils falsch → von vorn)',
      'Text: „Studio wird geladen …“',
    ],
  },
  {
    version: '0.7.302',
    date: '2026-08-29',
    title: 'Bloom standardmäßig aus',
    changes: [
      'Bloom-Postprocessing ist standardmäßig aus; Slider bleiben unter „Bloom an“ erreichbar',
    ],
  },
  {
    version: '0.7.301',
    date: '2026-08-29',
    title: 'Ost-Mauerwerk ohne Shadow-Schraffur',
    changes: [
      '2D-Aufriss: Paneele/Mauerwerk empfangen keine Shadow-Map bei Streiflicht (Ost/West + Südsonne) und in der Zeichnung',
      'Nord behält Gesims-/Vorstandschatten — dort ist die Sonne nicht streifend',
      'Behebt die zackige „kaputte“ Fugenzeichnung auf der Ostfassade',
    ],
  },
  {
    version: '0.7.300',
    date: '2026-08-29',
    title: 'Gitter/Ornament-Konfigurator entfernt',
    changes: [
      'Parametrisches Schmiedewerk (Gitter/Ornament für Fenster, Tür, Balkon, Zaun) wieder entfernt',
      'Kellerfenster-Gitter unverändert über die bestehende Kellerfenster-Option',
    ],
  },
  {
    version: '0.7.299',
    date: '2026-08-29',
    title: 'Gitter und Ornament',
    changes: [
      'Schmiedegitter für Fenster und Türen: Stabgitter, Eckvoluten, Rosette, S-Schwünge',
      'Modulraster 24/48/96 cm — Motive kacheln mit der Öffnungsgröße',
      'An Studio-Wänden: Balkonbrüstung / Zaunornament',
      'Kellerfenster-Gitter nutzt dasselbe System (weiterhin über die Kellerfenster-Option)',
    ],
  },
  {
    version: '0.7.298',
    date: '2026-08-29',
    title: 'Konche mit Kalotte',
    changes: [
      'Bibliothek Nischen: Konche — halbkreisförmige Vertiefung mit Viertelkugel oben',
      'Typ Fenster/Tür/Konche umschaltbar; flache eckige und runde Nischen unverändert',
    ],
  },
  {
    version: '0.7.297',
    date: '2026-08-29',
    title: 'Sockelprofil bleibt Profil, Öffnung stanzt durch',
    changes: [
      'SVG-Sockel wird wie ein Gesims als Querschnitt entlang der Wand gezogen — Kellerfenster schneiden diesen Körper als Volumen aus, inklusive Bogen',
      'Kein eckiges Zuschneiden des SVG-Querschnitts mehr, kein Zerren in die Laibung',
    ],
  },
  {
    version: '0.7.296',
    date: '2026-08-29',
    title: 'Mauerwerk bleibt nach Etage-Kopie gleich',
    changes: [
      'An 45°-Ecken behalten 0,5- und 1-Steine nach Duplizieren oder Stile einfügen dieselbe Lage wie darunter — der Verband kippt nicht mehr durch neue Wand-IDs',
    ],
  },
  {
    version: '0.7.295',
    date: '2026-08-29',
    title: 'Sockelprofil stanzt die Fensteröffnung',
    changes: [
      'SVG-Sockel folgt der Wand und wird von der Öffnungsmaske ausgeschnitten — gleiche Kontur wie das Wandloch, inkl. Bogen',
      'Kein Zerren des Profils in die Laibung mehr, kein Treppen-Sturz über dem Kellerfenster',
    ],
  },
  {
    version: '0.7.294',
    date: '2026-08-29',
    title: 'Zeichnung: saubere Öffnungskanten wie die Wand',
    changes: [
      'Laibung und Sockel-Sturz ohne Eigenkanten in der Zeichnung — Öffnungskontur wie beim Wandkörper über Paneele/Sockel',
      'Weiß-Fill mit polygonOffset gegen Z-Fight der Strichlinien (Kellerfenster-Bogen ohne Reißverschluss)',
    ],
  },
  {
    version: '0.7.293',
    date: '2026-08-29',
    title: 'Export-Modus, Fassaden-Richtungen, Freiraum cm-weise',
    changes: [
      'Neuer Export-Modus: wählbare 2D-Ansichten im Bildformat (Hoch/Quer, 1:1–16:9), Passepartout, Wallpaper-Safe-Area, PNG/JPG',
      'Gültig für Fassade: Himmelsrichtungs-Chips für die vorhandenen Hausseiten',
      'Freiraum „Abstand allseitig“ in ganzen Zentimetern (kein 8er-Raster mehr)',
    ],
  },
  {
    version: '0.7.292',
    date: '2026-08-29',
    title: 'Sturz und Laibung bleiben hinter dem Mauerwerk',
    changes: [
      'Fenstersturz-Fußplatte und Profil-Anker klar vor den Steinen (Bias 1,5 cm, Mindest-Forward 1,2 cm)',
      'Keine Stirnkappen am offenen Bogen-Sturz — keine weißen Scheiben in den Ziegel',
      'Laibung startet 0,6 cm hinter der Paneelfront',
    ],
  },
  {
    version: '0.7.291',
    date: '2026-08-29',
    title: 'Kein Profil-Z-Fight im Mauerwerk',
    changes: [
      'Fensterprofil am Bogen liegt knapp vor den Paneelen — keine weißen Zacken mehr im Ziegel neben dem Scheitel',
      'Profil-Material mit polygonOffset gegen die Steinflächen',
    ],
  },
  {
    version: '0.7.290',
    date: '2026-08-29',
    title: 'Bloom-Slider wirken wieder',
    changes: [
      'Bloom-Werte aktualisieren die 3D-Ansicht sofort (Dirty-Flag + kein Fog-UI-Rebuild beim Ziehen)',
      'Stärke bis 1,5, Schwelle ab 0; Defaults sichtbarer (Stärke 0,12, Schwelle 0,85, Radius 0,6)',
    ],
  },
  {
    version: '0.7.289',
    date: '2026-08-29',
    title: 'Verdachung nach unten, Laibungsfarben, Sockel-Bogen',
    changes: [
      'Verdachungs-Versatz auch negativ (nach unten Richtung Öffnung), −96…96 cm',
      'Laibung außen und innen eigene Farben im Farben-Tab (Fallback: Wand-/Innenwandfarbe)',
      'Sockel-Aussparung folgt der Öffnungsform (Bogenzwickel und Sturz), Box-Sockel inkl. Umriss',
    ],
  },
  {
    version: '0.7.288',
    date: '2026-08-29',
    title: 'Gesims-Schatten bleibt bei Schrift',
    changes: [
      'Gesims und Zierband werfen wieder Schatten auf den Freistreifen, auch wenn Schrift auf der Wand ist',
      'Schrift empfängt den Gesims-Schatten weiter mit Shadow-Z-Bias (Lesbarkeit)',
    ],
  },
  {
    version: '0.7.287',
    date: '2026-08-29',
    title: 'Bogenhöhe für Fenster und Türen gemeinsam',
    changes: [
      'Bogenform und Stichmaß gelten für Fenster und Türen im Gültigkeitsbereich zugleich',
      'Auswahl: alle Fenster/Türen derselben Wand; Typ/Fassade: im ganzen Haus; Etage: auf der Etage',
      'Glas und Rahmen folgen weiter demselben Stichmaß',
    ],
  },
  {
    version: '0.7.286',
    date: '2026-08-29',
    title: 'Paneel-Snap für Fenster rückgängig',
    changes: [
      'Ausrichtung an Paneelfugen/Steinmitten im Einfach-Modus entfernt',
      'Öffnungen rasten wieder nur auf dem 8-cm-Raster (Ziehen, Pfeile, Positionsfeld)',
    ],
  },
  {
    version: '0.7.285',
    date: '2026-08-29',
    title: 'Bogenhöhe / Stichmaß, Nord-Aufriss-Schatten',
    changes: [
      'Bogenhöhe (Stichmaß) für Öffnungen einstellbar (8-cm-Raster, Auto = Form-Standard)',
      'Glas und Blendrahmen folgen demselben Stichmaß wie die Mauerwerkskrone',
      'Korbbogen entfernt — Alt-Projekte mit Korbbogen werden als Ellipsenbogen geladen',
      '2D-Front: Paneele empfangen wieder Gesims-/Vorstandschatten — auf der Nordfassade ändert Lambert kaum, West wechselt Front-/Gegenlicht',
      'Wandkörper empfängt Schatten wieder immer (Innenraum), nicht nur bei Schrift',
    ],
  },
  {
    version: '0.7.284',
    date: '2026-08-29',
    title: 'Fenster an Paneelfugen (Einfach-Modus)',
    changes: [
      'Im Einfach-Modus: horizontales Ziehen und Pfeile rasten an Paneelfugen oder Steinmitten',
      'Buttons „An Fugen“ (Laibung auf Vertikalfuge, z. B. 2×48=96) und „Auf Steinmitte“ (96 zentriert zu 48)',
      'Ohne Paneele / im Komplex-Modus weiterhin 8-cm-Raster',
    ],
  },
  {
    version: '0.7.283',
    date: '2026-08-29',
    title: 'Keine Max-Caps, Zierband-Mitte/-Duplikat, Sockel überlagert Paneele',
    changes: [
      'Keine harten Maximalgrößen mehr für Paneele, Gesims/Profile, Sockel, Vorsprung, Fugen (nur Mindestwerte; Soft-Max ~10000)',
      'Neues Zierband standardmäßig in Wandmitte; Markieren, Duplizieren (±16 cm) per Rechtsklick und Einstellungen; nur vertikal verschiebbar (8 cm)',
      'Gesims-Tiefe in 4-cm-Schritten; Fenster weiter im 8-cm-Raster',
      'Sockelhöhe verschiebt Paneel-Y nicht mehr — Sockel überlagert, Raster bleibt am Wandfuß',
      'Neue Öffnung erbt Stile auch von anderem Typ derselben Wand bzw. vom Haus',
    ],
  },
  {
    version: '0.7.282',
    date: '2026-08-29',
    title: 'Sockel umschließt Kellerfenster unter der Sockeloberkante',
    changes: [
      'Ist der Sockel höher als ein Kellerfenster (oder anderes Fenster), läuft das Profil als Sturz darüber weiter — kein vertikaler Schacht mehr',
      'Sockelbox in der Zeichnung nutzt die Öffnungsmaske statt voller X-Aussparung',
    ],
  },
  {
    version: '0.7.281',
    date: '2026-08-29',
    title: 'Läuferverband wieder korrekt an Gehrungsecken',
    changes: [
      'Paneele bleiben bis zur Außenecke; der Verband (Läufer: volle Steine + Versatzlage) stimmt wieder — auch bei 90°',
      'Ursache: Forced-Ends an jeder Gehrung und Front-Layout bei kürzerer Paneelfront (projectDepth) erzeugten Stummel/Stapelverband',
      'Forced-Ends nur noch an 45° (komplementär 0,5/1); Raster an der Außenkante auf Wandbreite',
    ],
  },
  {
    version: '0.7.280',
    date: '2026-08-29',
    title: 'Mauerwerk wieder an der Außenkante wie v0.7.257',
    changes: [
      'Wie in 73dbdc9 / v0.7.236: Origin auf der Außenecke, Dicke nach innen — nicht 32–40 cm vor der Ecke',
      'Der Load-Fit schnitt offene Ketten gegen die Planrichtung auf ~Wandstärke; Außenlinien folgen jetzt der Kante',
      'Bitte neu laden (Version 0.7.280), damit der Speicherstand auf die Außenkante gelegt wird',
    ],
  },
  {
    version: '0.7.279',
    date: '2026-08-29',
    title: 'Mauerwerk an der Außenecke, nicht 40 cm davor',
    changes: [
      'Ursache war die Gehrung an der Innenkante: Grundriss-Wände mit Origin innen machen die sichtbare Front an 90°-Ecken um die Wandstärke länger als das Steinraster',
      'Beim Laden liegen verknüpfte Wände wieder auf der Außenkante (Dicke nach innen) — Vertikalfugen 0,5/1 von der Ecke, Gesims und Mauerwerk enden gemeinsam',
      'Bitte neu laden (Version 0.7.279), damit der Hash/Speicherstand nachgezogen wird',
    ],
  },
  {
    version: '0.7.278',
    date: '2026-08-29',
    title: 'Mauerwerk auf der Außenfront bis zur Ecke',
    changes: [
      'Gehrung ist nur noch der Schnitt der Ecke — Steine liegen auf der sichtbaren Außenfront, auch im Keil vor der Plan-Kante',
      'Vertikalfugen 0,5/1 sitzen von der Außenecke, nicht erst 32–40 cm dahinter; Gesims und Mauerwerk enden gemeinsam',
      'Fenster und Feld-Raster bleiben auf Plan-X (keine Scherung über die Wandbreite)',
    ],
  },
  {
    version: '0.7.277',
    date: '2026-08-29',
    title: 'Vertikalfugen in der Gehrungszone',
    changes: [
      'Gehrung nur in der Endzone (~Wandstärke) ausgeblendet — Vertikalfugen sitzen 0,5/1 von der Außenecke, nicht erst hinter einem 32–40-cm-Streifen',
      'Steinraster wird auf der sichtbaren Front gelegt und zurück auf den Plan gemappt; Feld und Öffnungen bleiben unverzerrt',
      'Paneele nutzen dieselbe Gehrung wie der Wandkörper, auch wenn der Nachbar kein Mauerwerk hat',
    ],
  },
  {
    version: '0.7.276',
    date: '2026-08-29',
    title: 'Ecken 0,5/1 ohne zerstörte Öffnungen',
    changes: [
      'Gehrung wieder nur an den Wandenden (wie vor der 45°-Front-Interpolation) — Fenster und Feld-Raster unverzerrt',
      'An 45°- und 90°-Ecken Endsteine so, dass die Front 0,5/1 zeigt; Paneele laufen bis zur Ecke (Raster ab x=0)',
      'Bossen-Fase an der Gehrung entlang der Front, nicht als ~Wandstärke-Streifen',
    ],
  },
  {
    version: '0.7.275',
    date: '2026-08-29',
    title: 'Mauerwerk bis zur Ecke mit 0,5/1',
    changes: [
      'Gehrung linear über die Wandbreite interpoliert — Paneele/Ziegel laufen bis zur Ecke, Vertikalfugen mit echtem 0,5/1-Abstand auf der Front',
      'Keine Plan-Verkürzung mehr; 45°-Endsteine bleiben komplementär 0,5/1',
    ],
  },
  {
    version: '0.7.274',
    date: '2026-08-29',
    title: 'Bossen-Fase an der Gehrung',
    changes: [
      'Bossen-Einzug an gegherten Wandenden entlang der Front, nicht in Plan-X — keine ~Wandstärke-breite Blindzone ohne Vertikalfugen mehr',
      'Plan-Kompensation der Endsteine gilt für alle Verbände (auch Binderlagen)',
    ],
  },
  {
    version: '0.7.273',
    date: '2026-08-29',
    title: 'Vertikalfugen an 90°-Gehrung',
    changes: [
      'An verlängerter Paneelfront (typisch panelFlip innen + 90°-Ecke) kürzere Plan-Endsteine — sichtbare Front wieder 0,5/1 mit Vertikalfugen, Raster weiter ab x=0',
      'Bilderrahmen-Gehrung (wallLocalX) unverändert; kein Feld-Clamp',
    ],
  },
  {
    version: '0.7.272',
    date: '2026-08-29',
    title: 'Mauerwerk bis zur Außenecke (Gehrung)',
    changes: [
      'Paneel-Gehrung wieder paneeltiefen-skaliert wie vor v0.7.221 — an 90°-Ecken kein ~40-cm-Streifen ohne Vertikalfugen mehr',
      'Feldsteine werden nicht mehr auf die Gehrungsebene geklemmt',
    ],
  },
  {
    version: '0.7.271',
    date: '2026-08-29',
    title: 'Mauerwerk nicht um die Wandstärke kürzen',
    changes: [
      '90°-Ecken verkürzen das Steinraster nicht mehr um die Wandstärke — Paneele laufen wieder bis zur Außenecke, die Gehrung bleibt 3D',
    ],
  },
  {
    version: '0.7.270',
    date: '2026-08-29',
    title: 'Mauerwerk bis zur 90°-Ecke',
    changes: [
      'Paneele folgen der Wandgehrung auch an 90°-Ecken, deren Nachbar kein Mauerwerk hat — keine Lücke um die Wandstärke links an der Front',
      'Endsteine an der Gehrung bleiben 0,5/1 auf der Front; der Läuferverband im Feld bleibt erhalten',
    ],
  },
  {
    version: '0.7.269',
    date: '2026-08-29',
    title: 'Läuferverband an 45°-Ecken',
    changes: [
      'Mauerwerk bleibt Läuferverband (gerade Lage 1er, versetzte 0,5er) — 45°-Ecken weiter 0,5/1, ohne 1,5er links und ohne Stapelverband',
      'Untere Paneelreihe über dem Sockel bleibt volle Steinhöhe, nicht abgeschnitten',
    ],
  },
  {
    version: '0.7.268',
    date: '2026-08-29',
    title: 'Mauerwerk-Front an 45°-Gehrung',
    changes: [
      'An stumpfen 45°-Ecken bleiben 0,5- und 1-Steine auf der sichtbaren Front — die Planbreite gleicht die Gehrung aus, statt 1,5er/2er zu zeigen',
    ],
  },
  {
    version: '0.7.267',
    date: '2026-08-28',
    title: 'Mauerwerk an 45°-Ecken',
    changes: [
      'An 45°-Ecken endet Mauerwerk in 0,5- und 1-Steinen (komplementär, Lage für Lage getauscht), nicht in 1,5er-/2er-Resten',
    ],
  },
  {
    version: '0.7.266',
    date: '2026-08-28',
    title: 'Fassade, Gesims-Tiefe, Verband, Sockel, Etagen',
    changes: [
      'Gültig für Fassade: alle Hausseiten (0°/45°/90°), nicht nur gleiche Blickrichtung',
      'Gesims-Feld Tiefe skaliert den Querschnitt nach vorn, nicht die Höhe',
      'Verband an 45°-Ecken: komplementäre 0,5- und 1-Steine; Öffnungen sitzen mittig im 8-cm-Raster',
      'Sockelhöhe in 8-cm-Schritten; Sockelfarbe in der Sockel-Sektion (auch bei Fassaden-Auswahl)',
      'Neue Öffnung übernimmt Stile und Profile vorhandener Öffnungen gleichen Typs',
      'Rechtsklick Kopieren: Objekt oder Stile; Duplizieren zuerst nach links, dann rechts',
      'Wand strecken gilt für verknüpfte Etagen; Etage duplizieren ohne Höhenlücke',
      'Keine Auswahl durch Fassaden hindurch; „Keine Gehrung“ nur an freien Enden',
      'Fußboden-Oberkante = untere Türkante im Raum',
    ],
  },
  {
    version: '0.7.265',
    date: '2026-08-28',
    title: 'Haus bleibt beim Zoomen sichtbar',
    changes: [
      'Fix: Himmels-Quad ohne Tiefentest übermalte die Fassade nach dem ersten Zoom',
    ],
  },
  {
    version: '0.7.264',
    date: '2026-08-28',
    title: 'Stabiler Himmel, Bodenfarbe wie Mauerwerk',
    changes: [
      'Kein Weiß-Flackern mehr beim Orbitieren in die Sonne (stabile Sonnenscheibe, HDR-Kappe für Bloom)',
      'Boden folgt Sonnenlicht wie die Fassade — kein Himmelsblau mehr aus Light-Probe/EnvMap',
      'Bodenfarbe in der Szene-Leiste steuert den Untergrund sichtbar (Albedo)',
    ],
  },
  {
    version: '0.7.263',
    date: '2026-08-28',
    title: 'Bloom mehr Spielraum',
    changes: [
      'Bloom-Slider wieder breiter (Stärke bis 0,35, Radius 0–1, Belichtung 0,75–1,45)',
      'Defaults zurück auf Archviz-Standards (Stärke 0,019, Radius 1, Belichtung 1,116)',
      'Belichtung kubisch (exposure³) — stärker als v0.7.260, kontrollierter als exposure⁴',
    ],
  },
  {
    version: '0.7.262',
    date: '2026-08-28',
    title: 'Boden folgt Licht und Nutzerfarbe',
    changes: [
      'Fix: Boden wirkte blau — Hemi-Fill und Schatten nutzten Zenith-Himmel statt Nutzer-Boden',
      'Schatten-Fill mischt Boden-Albedo + dezente Himmelstönung (ground-mood-v4)',
      'Goldene Stunde: wärmerer Boden bei tiefer Sonne',
    ],
  },
  {
    version: '0.7.261',
    date: '2026-08-28',
    title: 'Himmel wieder sichtbar',
    changes: [
      'Fix: Sky-Exposure-Uniform im RawShaderMaterial explizit deklariert — Himmel war schwarz',
      'Display-Exposure wieder 7 (Bloom) / 8 (ohne Bloom)',
    ],
  },
  {
    version: '0.7.260',
    date: '2026-08-28',
    title: 'Bloom feiner, kein weißes Flackern',
    changes: [
      'Bloom-Slider auf den nutzbaren Bereich begrenzt (Stärke, Radius, Schwelle, Belichtung)',
      'Belichtung quadratisch statt hoch⁴ — feinere Regler-Auflösung',
      'Himmel-HDR mit Bloom gedrosselt; Glas-EnvMap-Bake pausiert während Orbit',
    ],
  },
  {
    version: '0.7.259',
    date: '2026-08-28',
    title: 'Schatten am Haus, heller Taghimmel',
    changes: [
      'Fix: Sonnenlicht hing am Kamerahimmel — Schatten wanderte beim Orbitieren',
      'Taghimmel mit Anzeige-Tonemapping (nicht mehr dunkelblau ohne Atmosphäre)',
      'Boden: kein weißer Planeten-Disc mehr; Beleuchtung wieder in Anzeige-Intensität',
    ],
  },
  {
    version: '0.7.258',
    date: '2026-08-28',
    title: 'Takram-Himmel und kein Kontaktschatten',
    changes: [
      'Kontaktschatten (Top-Down-RT) entfernt — Boden nur Shadow-Map + Umbra-Tönung',
      'Himmel: @takram/three-atmosphere — goldene/blaue Stunde, weiche Dämmerung, Sterne, Mond',
      'SunDirectionalLight ersetzt den einfachen Shader-Dom; manueller Sonnenwinkel bleibt',
    ],
  },
  {
    version: '0.7.257',
    date: '2026-08-28',
    title: 'Bodenschatten wieder sichtbar',
    changes: [
      'Fix: Boden-Shader nutzte getShadowMask() — existiert nicht in MeshStandardMaterial, Shader schlug fehl',
      'Schatten/Umbra/Kontakt am Boden per getShadow(directionalShadowMap[0]) — ground-mood-v2',
    ],
  },
  {
    version: '0.7.256',
    date: '2026-08-28',
    title: 'Wände in Farbe wieder sichtbar',
    changes: [
      'Fix: Gegenlicht-Shader zurück auf Patch nach lights_fragment_begin (v9) — v7/v8 machten Wände in der Farb-Ansicht unsichtbar',
      'Schrift-Dim (Label-Uniforms, Shadow-Z-Bias) bleibt erhalten; Bounce/Innenflächen-Block vorerst entfernt',
    ],
  },
  {
    version: '0.7.255',
    date: '2026-08-28',
    title: 'Gegenlicht-Shader v8 (fehlerhaft)',
    changes: [
      'Versuch: Patch nach lights_fragment_end — Wände blieben in Farbe unsichtbar (in v0.7.256 zurückgenommen)',
    ],
  },
  {
    version: '0.7.254',
    date: '2026-08-28',
    title: 'Schrift bleibt im Schatten dunkel',
    changes: [
      'Bodenreflex/Hemi-Fill der Schattenseite gilt nicht für Fassaden-Schrift — Buchstaben bleiben klar dunkler als auf der Sonnenseite',
    ],
  },
  {
    version: '0.7.253',
    date: '2026-08-28',
    title: 'Mehrschichtige Lichtstimmung',
    changes: [
      'Bodenschatten mit Umbra, weicherer Penumbra (PCFSoft) und Himmelstönung statt flachem Grau',
      'Kontaktschatten am Hausfuß — Gebäude liegt sichtbar auf dem Grundstück',
      'Bodenreflex-Licht auf der Schattenseite; bestehende Sonnen-Slider steuern alle Schichten',
    ],
  },
  {
    version: '0.7.252',
    date: '2026-08-28',
    title: 'Schrift im Schatten dunkler',
    changes: [
      'Fassaden-Schrift auf der Schattenseite klar dunkler: eigener Shade-Faktor dimmt die ganze Glyphe (nicht nur die Seiten)',
      'Schrift empfängt Gebäudeschatten (Directional), ohne dass die Wand die Buchstaben frisst',
      'Flache Schrift nur von vorn beleuchtet — die transparente Rückseite fängt keine Sonne mehr',
    ],
  },
  {
    version: '0.7.251',
    date: '2026-08-28',
    title: 'Himmel: Winkel, Farben, 24 h, heutiges Datum',
    changes: [
      'Sonnenwinkel wieder manuell: Licht und Sonnenscheibe folgen dem Slider (Datum/Tageszeit setzt den realistischen Stand)',
      'Himmel nicht mehr schwarz: Dom bleibt in der Kamera, Hintergrundfarbe als Fallback',
      'Szenenfarben wirken: Himmel, Untergrund und Hintergrund färben Dom, Boden und Hemisphere',
      'Tageszeit fest 0:00–24:00, nicht mehr auf Aufgang–Untergang begrenzt',
      'Datum startet immer mit dem heutigen Tag (Berlin-Sonnenstand)',
    ],
  },
  {
    version: '0.7.250',
    date: '2026-08-28',
    title: 'Himmel mit Sonne, Mond und Nacht',
    changes: [
      'Sichtbarer Himmelsdom: Tageshimmel, Dämmerung, Sterne, Sonnen- und Mondscheibe',
      'Tageszeit 0:00–24:00 — echte Nacht mit Mondlicht und gedämpftem Umgebungslicht',
      'Beleuchtung folgt Sonne (Tag) bzw. Mond (klare Nacht); Schatten nur bei ausreichender Höhe',
      'Himmels- und Bodenfarbe der Szene fließen in Dom und Hemisphere ein',
    ],
  },
  {
    version: '0.7.249',
    date: '2026-08-28',
    title: 'Draufsicht, Szenenfarben, globales Licht',
    changes: [
      'Oben-Ansicht: Kamera über dem Dach — Decken und Dachflächen sichtbar, kein Durchsehen mehr',
      'Draufsicht: Navigation wie 3D (⌘/Ctrl+Ziehen dreht Himmelsrichtung, ⌘/Ctrl+⇧ schwenkt, Pfeiltasten)',
      'Kompass dreht die Draufsicht; Grundstücksdrehung gilt in 3D und Oben',
      'Szenenfarben wirken global: Hintergrund, Boden, Hemisphere-Himmel/Untergrund, Glas-EnvMap in allen Ansichten',
      'Gegenlicht-Shader einheitlich für Wände, Paneele, Mörtel und Schrift — Stärke folgt Sonnen-Slidern',
    ],
  },
  {
    version: '0.7.248',
    date: '2026-08-28',
    title: 'Fugen, Stein-Kontrast, Beleuchtung',
    changes: [
      'Fugenfarbe: eigene Zeile unter Fugenbreite, immer sichtbar wenn Paneele an (nicht mehr in ausblendbarem Block)',
      'Stein-Kontrast/Häufigkeit für alle Paneele und Ziegel (nicht nur Mauerwerk); wirkt auch in Gesamtansicht (Medium-LOD)',
      'Mörtel/Fugenfarbe ab Medium-LOD sichtbar; Vorschau beim Farb-Hover baut Geometrie neu',
      'Paneele/Mörtel ohne Gegenlicht-Shader — Sonnen- und Schattenseite unterscheiden sich wieder klarer',
    ],
  },
  {
    version: '0.7.247',
    date: '2026-08-28',
    title: 'Fugen, Laibung, Schrift, D&D-Wände',
    changes: [
      'Ziegel-Kontrast/Häufigkeit: Slider wirken bei Mauerwerksmustern; Häufigkeit startet automatisch bei Kontrast > 0',
      'Separate Fugenfarbe (Reiter Fugen), Mörtel unabhängig von der Wandfarbe',
      'Fensterlaibung: Außenhälfte = Außenwandfarbe, Innenhälfte = Innenwandfarbe',
      'Bibliothek-Wand per Drag&Drop: 50 % Ghost, Andock-Markierung, Raster um Zielwände; kollineare Verknüpfung verschmilzt zu einer Wand',
      'Klick auf Wand trifft nicht mehr Elemente dahinter; 3D-Cursor standardmäßig Pfeil (Greifer nur an Griffen)',
      'Schrift: Speichern verschiebt Position nicht mehr; 8-cm-Raster beim Ziehen und in X/Y-Feldern; Reiter Schrift bei Teil-Auswahl',
      'Neue Fenster/Türen: physisches Glas standardmäßig aus (Tint-Modus)',
    ],
  },
  {
    version: '0.7.246',
    date: '2026-08-28',
    title: 'Innenwand und Decke weiß',
    changes: [
      'Innenwand und Decke/Boden sind standardmäßig weiß; Farbe unter Farben (Innenwandfarbe, Deckenfarbe)',
      'Alte braune Decken-Defaults an bestehenden Projekten werden weiß, eigene Farben bleiben',
    ],
  },
  {
    version: '0.7.245',
    date: '2026-08-28',
    title: 'Ziegel-Farbe, Hinweise, Laibung',
    changes: [
      'Mauerwerk: Ziegel-Kontrast und Ziegel-Häufigkeit wieder unter den Musterkarten (Hell/Dunkel um die Paneelfarbe)',
      'Erklärungstexte an Feldern als Info-Icon, Text nur beim Darüberfahren',
      'Laibung hat dieselbe Farbe wie die Wand',
    ],
  },
  {
    version: '0.7.244',
    date: '2026-08-28',
    title: 'Weitere Schriften, Vorschau',
    changes: [
      'Schrift-Reiter: weitere Peter-Wiegel-Schriften; Vorschaukarten 16:9 untereinander mit dem Text aus dem Feld oben',
      'Berlin Email und Waschküche: CC BY-NC-SA 3.0 DE; übrige Wiegel-Schnitte OFL 1.1 — Quellen im Dialog Quellen',
    ],
  },
  {
    version: '0.7.243',
    date: '2026-08-28',
    title: 'Glas-Spiegelung, Farbfelder, Himmel',
    changes: [
      'Fensterscheiben spiegeln die echte Umgebung (Nachbarflügel, Boden, Himmel) und bleiben dunkel-transparent, je nach Blickwinkel',
      'Himmelsfarbe für Fenster-Reflexionen standardmäßig blau; alter Weiß-Default wird an bestehenden Projekten nachgezogen',
      'Szenen- und Nebelfarben zeigen RGB, HSL und HEX untereinander',
    ],
  },
  {
    version: '0.7.242',
    date: '2026-08-28',
    title: 'Scope, Glas, Schatten, Fensterbank',
    changes: [
      'Gültig für: Fassade ändert alle Elemente mit der Funktion, Etage nur die Etage, Typ z. B. alle Fenster, Auswahl nur die Markierung',
      'Fensterscheiben dunkel und transparent, mit Spiegelung der echten Szene (Gebäude, Boden, Himmel)',
      'Schatten: Umgebungslicht, Kontrast und Dunkelheit einstellbar; Schatten standardmäßig kräftiger',
      'Fensterbank außen maximal 16 cm; alte Standardtiefen an bereits gesetzten Fenstern nachgezogen, eigene Werte bleiben',
      'Farbfelder zeigen RGB, HSL und HEX untereinander',
      'Wandöffnungen rasten in 8-cm-Schritten',
      'Orange Markierung ist während der Öffnungs-Animation unsichtbar',
    ],
  },
  {
    version: '0.7.241',
    date: '2026-08-28',
    title: 'Kopieren, Gesims, Zierband, Glas',
    changes: [
      'Rechtsklick Kopieren: Untermenü Alles / Paneele / Farben / … (Geometrie + Stile oder nur ein Teil)',
      'Traufgesims aus den Silhouetten: Krone an der Wandoberkante, Profil hängt nach unten',
      'Zierbänder folgen der Öffnungskontur (auch Rundbogen) und werden von Rahmenprofilen unterbrochen',
      'Klarglas ohne Türkis, mit Himmel-/Studio-Spiegelung',
      'Fensterbank-Tiefe standardmäßig Paneel- bzw. Wandtiefe plus 16 cm',
    ],
  },
  {
    version: '0.7.240',
    date: '2026-08-28',
    title: 'Gesims, Glas, Etage, Zierbänder',
    changes: [
      'Gesims: Vorschau und 3D hängen von der Wandkante nach unten (Tropfkante unten, nicht mehr kopfüber)',
      'Neue Fenster/Türen: physisches Glas an (IOR 1,52, leichte Grüntönung)',
      'Etage duplizieren: Dialog mit Checkboxen, „Auswahl speichern“ und „Nur Grundriss übernehmen“',
      'Reiter Zierbänder wieder bei Studio-Wand; Rahmenprofile in der Öffnungs-Toolbar wählbar',
      'Fensterbrett / Fensterbank umbenannt; Fensterbank oben bündig mit der unteren Laibung',
      'Rechtsklick: Untermenü „Alles“ (Farbe, Paneele, …) vor Kopieren; „Wand lösen“',
      'Grundriss-Zeichnen: orangene Hilfslinien, sobald der Cursor mit einem anderen Ende bündig ist',
    ],
  },
  {
    version: '0.7.239',
    date: '2026-08-28',
    title: 'Laibung nur noch Tunnel',
    changes: [
      'Fensterlaibung: nur noch der Tunnel entlang der Öffnung — kein Sturz-Kasten, keine Front-Lippe',
      'Sturz ist die Oberkante der Öffnung; Extra-Linien an den Ecken sind weg',
    ],
  },
  {
    version: '0.7.238',
    date: '2026-08-28',
    title: 'Sturz-Laibung ohne Ecken-Spitzen',
    changes: [
      'Front-Lippe der Leibung: kantenweiser Offset statt uniformem Inflate — Sturz bleibt bündig an der Öffnungs-Oberkante',
      'Keine diagonalen Spitzen mehr an den oberen Laibungsecken in Zeichnung und Farbe',
    ],
  },
  {
    version: '0.7.237',
    date: '2026-08-28',
    title: 'Laibung, Fenster-Animation, Innenlicht',
    changes: [
      'Obere Fensterlaibung: Sturz-Soffit in der Leibung schließt den Blick von schräg oben (ohne Kasten über dem Fenster)',
      'Fenster-Animation öffnet wieder nach innen; Kastenfenster: Außenflügel nach außen, Innenflügel nach innen',
      'Innenwände und -böden empfangen Schatten; Innenflächen dunkler ohne direktes Sonnenlicht',
    ],
  },
  {
    version: '0.7.236',
    date: '2026-08-28',
    title: 'Außenkante als Bezugsgröße',
    changes: [
      'Wandstärke: Außenkanten bleiben fix; Verknüpfung und Gehrung sitzen an den Außenecken',
      'Decke schließt bündig an die Innenwand (Abstand zur Außenwand = Wandstärke)',
      'Kaputte Ecken nach früherer Tiefenänderung werden beim Laden oder erneuten Ändern der Wandstärke repariert',
    ],
  },
  {
    version: '0.7.235',
    date: '2026-08-28',
    title: 'Gehrung bei Wandstärke',
    changes: [
      'Wandstärke-Änderung: Gehrungen werden aus Grundriss + aktueller Tiefe neu berechnet (nicht mehr 32-cm-Default)',
      'Zwischenwert-Skalierung der Gehrung beim Wechsel; panelFlip-false: Außenkante bleibt fix',
      'Grundriss-Wand-Generierung nutzt building.wallDepth statt festem WALL_DEPTH',
    ],
  },
  {
    version: '0.7.234',
    date: '2026-08-28',
    title: 'Decke bündig innen',
    changes: [
      'Decken-Polygon folgt den echten Wand-Innenkanten (panelFlip, wall.depth, Gehrung) statt festem Plan-Inset',
      'Behebt die sichtbare Lücke zwischen Decke und Innenwand — auch nach geänderter Wandstärke',
    ],
  },
  {
    version: '0.7.233',
    date: '2026-08-28',
    title: 'Start-Fix',
    changes: [
      'App startet wieder: fehlende Referenz `viewBtnPlan` → `viewBtnTop` (Ladeoverlay blieb hängen)',
    ],
  },
  {
    version: '0.7.232',
    date: '2026-08-28',
    title: 'Wandstärke & Decke',
    changes: [
      'Globale Wandstärke: Außenkante bleibt fix; nur die Innenseite wandert (panelFlip false: Origin-Kompensation)',
      'Decken-Platte: Unterseite bündig mit Wandoberkante (keine 8-cm-Lücke mehr)',
      'Einheitlicher panelFlip-Default (true) in Paneel-Tiefe und Fenstervorzeichen',
    ],
  },
  {
    version: '0.7.231',
    date: '2026-08-28',
    title: 'Draufsicht statt Grundriss-Tab',
    changes: [
      'Tab „Grundriss“ → „Oben“: orthografische Draufsicht auf die 3D-Szene',
      'Oben, 2D und 3D: gleiche Bearbeitung (Wände ziehen, Öffnungen verschieben, Greifer, Kontextmenü)',
      'Grundriss-Zeichenmodus aus dem Viewport entfernt; interner Grundriss-Sync aus Wänden bleibt',
    ],
  },
  {
    version: '0.7.230',
    date: '2026-08-28',
    title: 'Wand loslösen',
    changes: [
      'Toolbar-Button „Wand loslösen“; danach frei verschieb- und streckbar',
      'Losgelöste Wände ändern beim Strecken nur sich selbst, nicht den Grundriss-Nachbarn',
    ],
  },
  {
    version: '0.7.229',
    date: '2026-08-28',
    title: 'Decke folgt Wandhöhe',
    changes: [
      'Decke/Boden-Trennfläche sitzt an der tatsächlichen Wandoberkante jeder Etage',
      'Geschosshöhe ändern (Greifer, Toolbar, Eingabe) verschiebt die Decke mit',
    ],
  },
  {
    version: '0.7.228',
    date: '2026-08-28',
    title: 'Wand-Mindestmaß, Öffnungen, Etagen-Verschieben',
    changes: [
      'Wand mindestens 48 cm breit/hoch — kleiner nicht möglich',
      'Beim Verkleinern verschwinden Öffnungen, die nicht mehr auf die Wand passen',
      'Wand verschieben zieht gleiche Wände auf allen Etagen mit; Shift = nur diese Etage',
    ],
  },
  {
    version: '0.7.227',
    date: '2026-08-28',
    title: 'Wand-Einstellungen, Decke, Schrift-Versatz',
    changes: [
      'Standard-Geschosshöhe wieder 448 cm; Wandstärke in den Maßen einstellbar',
      'Schrift-Versatz (+ außen / − innen) in den Schrift-Einstellungen',
      'Paneel-Klick zeigt wieder alle Wand-Reiter; 90°-Drehen nur noch per Rechtsklick',
      'Decke in 3D markierbar mit Farbe; schließt bündig an der Innenwand',
      'Reihen oben ausblenden: Bodenschatten am Freistreifen bleibt erhalten',
    ],
  },
  {
    version: '0.7.226',
    date: '2026-08-28',
    title: 'Front-Greifer verschiebt die Wand',
    changes: [
      'Mittiger Pfeil-Greifer auf der Fassade: Wand nur in Front-Richtung verschieben',
      'Ist eine verknüpfte 45°-Wand nicht markiert, ist der Greifer grau — Hover erklärt, die Schrägen zuerst mit auszuwählen',
    ],
  },
  {
    version: '0.7.225',
    date: '2026-08-28',
    title: '45°-Wand auf dem Raster',
    changes: [
      'Schräge Wände wachsen in Diagonalen eines 48×48-Feldes (nicht 48 cm entlang der Schräge) — Endpunkte bleiben auf dem Gitter',
      'Greifer, Shift-Abzweig und Breite ± nutzen denselben Schritt; achsparallel weiter 48 cm',
    ],
  },
  {
    version: '0.7.224',
    date: '2026-08-28',
    title: 'Abzweig-Wand schließt den Pfad',
    changes: [
      'Shift-Greifer: trifft das freie Ende den Ausgangspunkt oder eine andere Wand, schließt sich der Grundriss — Gehrung wie an den übrigen Ecken',
      'In der Wandmitte entsteht ein T-Stoß (Wand wird geteilt, beide Stücke mindestens 48 cm)',
    ],
  },
  {
    version: '0.7.223',
    date: '2026-08-28',
    title: 'Bestands-Wände: Nachzug bei jedem Laden',
    changes: [
      'Falsch gedrehte Abzweig-Wände werden beim Öffnen immer nachgezogen — auch wenn das Projekt schon einmal mit einer neueren Schema-Nummer gespeichert wurde',
    ],
  },
  {
    version: '0.7.222',
    date: '2026-08-28',
    title: 'Bestehende Wände: Front-Korrektur beim Laden',
    changes: [
      'Projekte mit falsch gedrehter Abzweig-Wand (zwei Starts an einer Ecke) werden beim nächsten Öffnen nachgezogen — Front außen wie bei neu gezeichneten Wänden',
      'Fensterbänke und Gehrung folgen beim Laden der Wand-Front; bewusst gedrehte Fronten bleiben erhalten',
    ],
  },
  {
    version: '0.7.221',
    date: '2026-08-28',
    title: 'Abzweig-Wand: Front bleibt außen',
    changes: [
      'Neue Wand per Shift-90°/45° am freien Ende: Paneele und Sockel auf derselben Außenseite wie die bestehende Kette',
    ],
  },
  {
    version: '0.7.220',
    date: '2026-08-28',
    title: 'Sockel und Gesims gehren wie Paneele',
    changes: [
      'Paneele, Sockelprofil und Gesims laufen an 45°- und 90°-Ecken frontal aufeinander zu (Bilderrahmen, auch stumpfe Außenecken)',
    ],
  },
  {
    version: '0.7.219',
    date: '2026-08-28',
    title: 'Gehrung wie ein Bilderrahmen',
    changes: [
      'Paneele, Sockel und Gesims laufen an 45°- und 90°-Ecken frontal aufeinander zu (Gehrungsschnitt, keine stumpfen Enden)',
    ],
  },
  {
    version: '0.7.218',
    date: '2026-08-28',
    title: 'Abzweig-Wand: Außenseite und Gehrung nach innen',
    changes: [
      'Shift-Greifer links: Paneele, Sockel und Gesims bleiben auf der Außenseite (Wand ggf. 180° gedreht)',
      'Gehrung an 45°- und 90°-Ecken immer nach innen (Bilderrahmen), auch rechts',
    ],
  },
  {
    version: '0.7.217',
    date: '2026-08-28',
    title: 'Greifer erst beim Ziehen, Shift setzt neue Wand',
    changes: [
      'Wand-Greifer ändern die Breite erst beim Ziehen, nicht schon beim Anfassen',
      'Shift halten: bestehende Wand bleibt; von der gegriffenen Ecke geht eine neue Wand in 45° oder 90° ab',
    ],
  },
  {
    version: '0.7.216',
    date: '2026-08-28',
    title: 'Wand-Greifer 48 cm, Shift für 45°/90°',
    changes: [
      'Breite ziehen in 48-cm-Schritten entlang der Wand (ohne Taste)',
      'Shift halten: Wand um das andere Ende auf 45° oder 90° schwenken, ebenfalls 48 cm',
      'Bodenraster beim Ziehen auf 48 cm',
    ],
  },
  {
    version: '0.7.215',
    date: '2026-08-28',
    title: 'Wand-Greifer greifen wieder',
    changes: [
      'Greifer ziehen die Wandkante sofort (auch bei verknüpften Wänden); Bodenraster erscheint beim Ziehen',
      'Falls der Strahl den Boden nicht trifft (Frontansicht): Strecken entlang der Wandfläche',
      'Plus/Minus an der Wand ausgeblendet; blaue Greifer nur bei genau einer aktiv markierten Wand',
    ],
  },
  {
    version: '0.7.214',
    date: '2026-08-28',
    title: 'Wand-Greifer: Drag, Raster, 45°',
    changes: [
      'Greifer ziehbar (Window-Pointer); Live-Vorschau beim Ziehen, Snap beim Loslassen',
      'Boden-Raster 45 cm mit 45°/90°-Linien während des Ziehens',
      'Ecken-Greifer: Versatz in 8 Richtungen à 45 cm (Breite + Querversatz)',
    ],
  },
  {
    version: '0.7.213',
    date: '2026-08-28',
    title: 'Wand-Greifer an der Außenkante',
    changes: [
      'Drag-Greifer links, oben und rechts an der Fassaden-Außenkante (48 cm Breite, 24 cm Höhe pro Etage)',
      'Standard-Geschosshöhe 456 cm (Bibliothek, neue Wände); Toolbar Maße ± mit 48/24 cm',
    ],
  },
  {
    version: '0.7.212',
    date: '2026-08-28',
    title: 'Duplizieren in Wandkette',
    changes: [
      'Mittlere Wand in kollinearer Kette: Kopie wird zwischen Quellwand und Nachbar eingefügt',
      'Weiter außen liegende Wände der Kette werden um die Klonbreite verschoben',
      'Gilt auch beim Einfügen aus der Zwischenablage links/rechts',
    ],
  },
  {
    version: '0.7.211',
    date: '2026-08-28',
    title: 'Links/Rechts aus Blickrichtung',
    changes: [
      'Duplizieren, Einfügen und Öffnungs-Klonen: „links“/„rechts“ folgen der Kamera, nicht der festen Wandachse',
      'Bibliotheks-Gizmos (+/−) und Nachbar-Wand entfernen an der sichtbaren Seite',
      'Erker-Anbindung und Endstücke an Wandenden ebenfalls blickrichtungsabhängig',
    ],
  },
  {
    version: '0.7.210',
    date: '2026-08-28',
    title: 'Sturz-Laibung, Fensterbank-Höhe, Paneel-Einstellungen',
    changes: [
      'Obere Laibung: Sturz-Lippe an der Öffnung wieder geschlossen (ohne Kasten oberhalb)',
      'Außen-Fensterbank: Oberkante bündig mit Öffnungs-Unterkante; Neigung kippt nur die Tropfkante',
      'Profil-Außenbank entlang der Oberkante statt der Unterkante gesweept',
      'Paneel-Klick: Tabs Paneele, Fugen und Paneelfarbe gleichzeitig sichtbar',
    ],
  },
  {
    version: '0.7.209',
    date: '2026-08-28',
    title: '3D-Kamera: Orbit um Gebäude, schnelleres Schwenken',
    changes: [
      '⌘/Ctrl + Ziehen dreht wieder um den Gebäude-Mittelpunkt, nicht um einen leeren Punkt in der Szene',
      '⌘/Ctrl + Umschalt + Ziehen schwenkt so schnell wie die Pfeiltasten (nicht mehr extrem langsam)',
      '⌘/Ctrl-Erkennung am Pointer zuverlässiger (Tastatur-Fallback)',
    ],
  },
  {
    version: '0.7.208',
    date: '2026-08-28',
    title: 'Fensterflügel öffnen, Außenbank an der Wand',
    changes: [
      'Fensterflügel schwenken bei Außenseite nach vorne ins Zimmer — Animation wieder sichtbar',
      'Außen-Fensterbank sitzt auf der Fassade und fällt nach außen ab, statt in der Luft zu drehen',
      'Kein 6-cm-Sturz-Stopfen mehr in der Öffnung (wirkte wie ein Kasten über dem Glas)',
    ],
  },
  {
    version: '0.7.207',
    date: '2026-08-28',
    title: 'Fenster-Stand vor Rollläden',
    changes: [
      '3D-Fenster/Türen: Position, Tiefe (24 cm Leibung) und Drehung (+180°) wie vor v0.7.180',
      'Fensterbänke innen/außen: Anker und Neigung wie vor Rollläden-Einführung',
      'Kein Sturz-Stopfen, kein Leibungs-Soffit — Rollläden und übrige Features unverändert',
    ],
  },
  {
    version: '0.7.206',
    date: '2026-08-28',
    title: 'Fenster, Bänke und Sturz korrigiert',
    changes: [
      'Holz-Stopfen am Blendrahmen entfernt — kein sichtbarer Kasten über dem Fenster mehr (war kein Rollladen)',
      'Fenster wieder 24 cm in der Leibung; Drehung folgt panelFlip — Front zeigt nach außen',
      'Außen-Fensterbank: Neigung dreht an der Wandkante statt in der Luft',
      'Leibungs-Soffit über dem Fenster entfernt (wirkte wie Kasten)',
      'Studio-Wände: panelFlip standardmäßig true (Außenseite nach vorne)',
    ],
  },
  {
    version: '0.7.205',
    date: '2026-08-28',
    title: 'Kopieren/Einfügen mit Richtung',
    changes: [
      'Wand kopieren und an anderer Wand per Rechtsklick „Einfügen“ (links/rechts/darüber) platzieren — inkl. Öffnungen und Profilen',
      '+/− an der ausgewählten Wand: bei Zwischenablage einfügen, sonst duplizieren wie bisher',
      'Leere Bühne: weiterhin „Fassade einfügen“ ohne Zielwand',
    ],
  },
  {
    version: '0.7.204',
    date: '2026-08-28',
    title: 'Kein Kasten am Fenstersturz, Stil-Vorlagen, einheitliche Front',
    changes: [
      'Sturz-Stopfen am Fenster füllt nur noch die Leibung nach innen — kein sichtbarer Kasten vor der Fassade',
      'Stile als benannte Vorlage speichern und per Rechtsklick anwenden (zusätzlich zu Kopieren/Einfügen)',
      'Baugruppen und Öffnungs-Bänke folgen einheitlich der Wand-Front (panelFlip)',
    ],
  },
  {
    version: '0.7.203',
    date: '2026-08-28',
    title: 'Wände wieder sichtbar (Gegenlicht-Shader)',
    changes: [
      'Gegenlicht-Shader kompiliert wieder — Wände, Paneele und Rahmen waren unsichtbar, weil normalMatrix nur im Vertex-Shader existiert',
    ],
  },
  {
    version: '0.7.202',
    date: '2026-08-28',
    title: 'Rollläden ohne Kasten, Front beim Verbinden, Gegenlicht-Schatten',
    changes: [
      'Rollläden: kein Kasten und keine Führungsschienen — nur Lamellen, standardmäßig aus',
      'Neue Wand an bestehende andocken: Front-/Blickrichtung der bestehenden Wand übernehmen',
      'Gegenlicht: Seiten und Oberseiten von Wand und Elementen werden mit der Front abgedunkelt, ohne Schraffur auf der Fassade',
    ],
  },
  {
    version: '0.7.201',
    date: '2026-08-28',
    title: 'Schrift zentriert mit 64 cm Abstand von oben',
    changes: [
      'Beim Aktivieren der Wandschrift: horizontal zentriert, Oberkante 64 cm unter der Wandoberkante.',
      'Freistreifen-Logik verschiebt die Schrift nicht mehr nach unten rechts.',
    ],
  },
  {
    version: '0.7.200',
    date: '2026-08-28',
    title: 'Schrift auf der Wandfläche',
    changes: [
      'Beschriftung im oberen Freistreifen liegt auf der sichtbaren Wandhaut, nicht hinter den Bossen',
      'Schrift in der Verkleidungsgruppe mit höherer Render-Reihenfolge — nicht von Paneelen verdeckt',
    ],
  },
  {
    version: '0.7.199',
    date: '2026-08-28',
    title: 'Schrift bleibt sichtbar',
    changes: [
      'Beschriftung empfängt keine Schatten mehr — Wand-Schatten verdunkelt die Schrift nicht',
      'Extrudierte Schrift mit polygonOffset gegen Z-Fight an der Fassade',
    ],
  },
  {
    version: '0.7.198',
    date: '2026-08-28',
    title: 'Wandschatten mit aktiver Schrift',
    changes: [
      'Bei extrudierter Beschriftung castet die Wand wieder Schatten auf Boden und Umgebung',
      'Gesims und Zierband werfen weiterhin keinen Schatten auf den Schrift-Freistreifen',
    ],
  },
  {
    version: '0.7.197',
    date: '2026-08-27',
    title: 'Sturz-Soffit schließt Schrägblick',
    changes: [
      'Tieferer opaker Sturz in der Leibung (~24–32 cm) — kein weißer Glasstreifen mehr beim Blick von schräg oben',
      'Blendrahmen-Stopfen greift Leibung und Rahmenkante zusammen',
    ],
  },
  {
    version: '0.7.196',
    date: '2026-08-27',
    title: 'Sturz-Stopfen schließt Glas-Spalt',
    changes: [
      'Opaker Blendrahmen-Stopfen greift von der Tür nach außen in die Leibung — kein weißer Glasstreifen mehr am Sturz',
      'Studio-Öffnungen nur noch 8 cm vertieft (statt 24 cm)',
    ],
  },
  {
    version: '0.7.195',
    date: '2026-08-27',
    title: 'Kein weißer Glasstreifen am Sturz',
    changes: [
      'Studio-Fenster/Türen nur noch 8 cm vertieft (statt 24 cm) — weniger Schrägblick aufs Glas',
      'Opaker Sturz-Stopfen am Blendrahmen verhindert den weißen Glas-Saum an der Paneelkante',
    ],
  },
  {
    version: '0.7.194',
    date: '2026-08-27',
    title: 'Sturz ohne weißen Haarspalt',
    changes: [
      'Sturz-Klotz füllt die Leibungstiefe am oberen Öffnungsrand (Fassade bis Fensterfront) — kein weißer Glasblick mehr am Sturz',
    ],
  },
  {
    version: '0.7.193',
    date: '2026-08-27',
    title: 'Leibung durch die ganze Wandstärke',
    changes: [
      'Sichtbare Leibung reicht bis zur Innenwand — kein weißer Himmel-Streifen mehr am Sturz über Türen/Fenstern',
    ],
  },
  {
    version: '0.7.192',
    date: '2026-08-27',
    title: 'Kein Lichtleck über der Tür',
    changes: [
      'Shadow-Tunnel an Öffnungen deckt die Paneeltiefe ab — keine hellen Lichtstreifen mehr am Sturz',
    ],
  },
  {
    version: '0.7.191',
    date: '2026-08-27',
    title: 'Tür und Treppe glatt ohne Schraffur',
    changes: [
      'Türflächen und Eingangstreppen ohne Shadow-Map-Schraffur — Oberflächen wirken glatt',
    ],
  },
  {
    version: '0.7.190',
    date: '2026-08-27',
    title: 'Rollläden in der Leibung mit Führungsschienen',
    changes: [
      'Lamellen 180° gedreht und 8 cm hinter die Fassadenaußenfläche gesetzt',
      'Zwei durchscheinende Innen-Führungsschienen links/rechts mit 8 cm Versatz',
    ],
  },
  {
    version: '0.7.189',
    date: '2026-08-27',
    title: 'Zierbänder wieder auffindbar',
    changes: [
      'Eigener Einstellungs-Tab „Zierbänder“ (nicht mehr unter Gesims versteckt)',
      'Band hinzufügen nur mit ausgewählter Studio-Wand; Klick auf Band öffnet den Tab',
    ],
  },
  {
    version: '0.7.188',
    date: '2026-08-27',
    title: 'Fenster an den Rand, Schrift-Schatten, Kopieren/Einfügen',
    changes: [
      'Öffnungen dürfen bündig an den Wandrand (kein 8-cm-Randabstand mehr)',
      'Kein dunkles Gesims-/Selbstschatten-Rechteck mehr über extrudierter Schrift',
      'Rechtsklick: Öffnung, Fassade oder Haus kopieren und auf Auswahl oder leere Bühne einfügen',
    ],
  },
  {
    version: '0.7.187',
    date: '2026-08-27',
    title: 'Bloom mit echtem MSAA',
    changes: [
      'Bloom-Composer rendert mit bis zu 8× MSAA wie der Pfad ohne Bloom — Kanten bleiben glatt',
      'SMAA nur noch als Fallback, wenn die GPU kein Multisampling an Render-Targets kann',
    ],
  },
  {
    version: '0.7.186',
    date: '2026-08-27',
    title: 'Bloom scharf wie ohne Postprocessing',
    changes: [
      'Bloom-Pfad nutzt dieselbe Pixel-Ratio wie der normale Render (kein Weichzeichnen nach Orbit)',
      'SMAA-Antialiasing bei Bloom (ersetzt fehlendes MSAA im EffectComposer)',
      'Bloom-Pass nicht mehr extra auf halbe Auflösung gesetzt',
    ],
  },
  {
    version: '0.7.185',
    date: '2026-08-27',
    title: 'Bloom-Defaults und Belichtung',
    changes: [
      'Neue Bloom-Standards: an, Schwelle 1, Stärke 0,019, Radius 1, Belichtung 1,116',
      'Belichtung wirkt wieder: bei Bloom ACES-Tone-Mapping und Exposure^4 (war fest auf 1 verdrahtet)',
    ],
  },
  {
    version: '0.7.184',
    date: '2026-08-27',
    title: 'Bloom beim Navigieren, 32-cm-Raster, weiße Szene',
    changes: [
      'Bloom bleibt während Kamerabewegung und Animation an (kein Abschalten in Orbit-Lite mehr)',
      'Boden- und Wand-Platzierungsraster sowie Öffnungs-/Schrift-Positionen rasten auf 32 cm (statt 8 cm)',
      'Hintergrund, Untergrund und Himmelsfarbe standardmäßig weiß; neuer Regler „Alle drei“ setzt alle zugleich',
    ],
  },
  {
    version: '0.7.183',
    date: '2026-08-27',
    title: 'Keine Paneel-Schraffur durch Schrift-Schatten',
    changes: [
      'Paneele empfangen wieder keine Shadow-Map — die feine Schraffur/dunklere Optik an Wänden mit 3D-Schrift entfällt',
      'Schrift-Schatten bleiben auf dem Wandkörper (Freistreifen unter der Schrift)',
    ],
  },
  {
    version: '0.7.182',
    date: '2026-08-27',
    title: 'Schrift-Schatten auch auf dem Wandkörper',
    changes: [
      'Extrudierte Schrift wirft Schatten auch auf die nackte Wand (Freistreifen ohne Paneele), nicht nur auf die Steine',
    ],
  },
  {
    version: '0.7.181',
    date: '2026-08-27',
    title: 'Extrudierte Schrift wirft Schatten auf die Fassade',
    changes: [
      'Bei „Mit Tiefe“ empfängt die Wand bzw. die Paneele unter der Schrift wieder Schatten — die Buchstaben zeichnen sich auf dem Untergrund ab',
    ],
  },
  {
    version: '0.7.180',
    date: '2026-08-27',
    title: 'Schrift-Punzen, Rollläden-Tab, negativer Versatz',
    changes: [
      'Extrudierte Schrift: Punzen bei „&“ (und anderen Mehrkontur-Zeichen) bleiben offen',
      'Reiter „Rollläden“ bei Fenster und Tür immer sichtbar; Checkbox standardmäßig aus',
      'Schrift-Vorstand darf negativ sein — Schrift wandert nach hinten/innen',
    ],
  },
  {
    version: '0.7.179',
    date: '2026-08-27',
    title: 'Schrift „Mit Tiefe“ auch mit &',
    changes: [
      'Texte mit „&“ (z. B. „Brot & Brötchen“) bleiben bei „Mit Tiefe“ echte 3D-Buchstaben statt flach auf der Wand',
    ],
  },
  {
    version: '0.7.178',
    date: '2026-08-27',
    title: 'Schrift „Mit Tiefe“ wieder dreidimensional',
    changes: [
      'Extrudierte Wandschrift sitzt vor der äußersten Fassade (inkl. Bosse), nicht mehr im Stein versenkt',
      'Beim Umschalten auf „Mit Tiefe“ wird die Typeface zuerst geladen — kein stilles Flach-Fallback mehr',
    ],
  },
  {
    version: '0.7.177',
    date: '2026-08-27',
    title: 'Rollläden mit Höhe und Animation',
    changes: [
      'Neuer Reiter „Rollläden“ bei Fenster und Tür (standardmäßig aus): nur die Lamellen, leicht gewölbt',
      'Höhe von offen bis geschlossen; beim Herunterlassen Spalt zwischen den Ebenen, unten stapeln sich die Lamellen',
      'Hoch- und Runterfahren animierbar (Weich/Linear, Dauer, Abspielen)',
    ],
  },
  {
    version: '0.7.176',
    date: '2026-08-27',
    title: 'Farbe & Oberfläche pro Element, Seitenspalte nur passende Tabs',
    changes: [
      'Wand, Paneele, Profile, Gesims, Schrift, Rahmen, Profil, Bänke, Verdachung und Treppe lassen sich getrennt einfärben und als stumpf / glänzend / metallisch einstellen',
      'Klick auf ein Teil (Gesims, Bank, Treppe, …) zeigt rechts nur noch die zugehörigen Tabs und Funktionen',
      'Rahmen-/Glasfarbe erscheint nur bei ausgewählter Öffnung, nicht mehr an der reinen Wand',
    ],
  },
  {
    version: '0.7.175',
    date: '2026-08-27',
    title: 'Dock 0,5+0,5 ohne Überstand, Plus wie Duplizieren',
    changes: [
      '0,5+0,5 an der Dock-Fuge: Innenseiten-Trapez wird 0, die Kacheln bleiben in ihrer Wand — kein Überstand in die Nachbarwand oder über Öffnungen',
      '1+1 bleiben getrennt mit vollem Trapez',
      'Plus links/rechts an der Wand kopiert die ausgewählte Wand wie „Duplizieren“ auf genau dieser Seite',
    ],
  },
  {
    version: '0.7.174',
    date: '2026-08-27',
    title: 'Läuferverband bleibt bei geänderter Steinbreite',
    changes: [
      'Stein- oder Paneelbreite ändern lässt den horizontalen Versatz (Läufer, ⅓/¼, Kopfverband) bestehen — keine gleichmäßigen Kästchen mehr',
      'Jede Wand behält ihr eigenes Reihenmuster (1/1/… bzw. 0,5/1/…/0,5); ⅓- und ¼-Versatz nutzen die echte Endstückbreite',
    ],
  },
  {
    version: '0.7.173',
    date: '2026-08-27',
    title: 'Plus dockt wie Duplizieren, Gizmos folgen sofort',
    changes: [
      'Wand-+ links/rechts kopiert die Auswahl wie „Duplizieren“ und dockt sie in den Grundriss (Verknüpfung, Paneelfuge, Minus)',
      'Plus/Minus-Buttons werden bei jeder Kamerabewegung neu projiziert — sie bleiben an der Wand',
      '1+1 an der Dock-Fuge: Trapez-Chamfer, sobald die Kachel an der Fuge endet (nicht nur per Flag)',
    ],
  },
  {
    version: '0.7.172',
    date: '2026-08-27',
    title: '1+1 behält Bossen-Trapez an der Dock-Fuge',
    changes: [
      '1+1-Steine an der Dock-Fuge behalten jeweils das volle Bossen-Trapez (Chamfer), werden nicht wie 0,5+0,5 zu einem Trapez geglättet',
      '0,5+0,5 bleibt ein verschmolzener Stein ohne Fugen-Chamfer',
    ],
  },
  {
    version: '0.7.171',
    date: '2026-08-27',
    title: 'Dock: 0,5+0,5 wieder ein Stein',
    changes: [
      'An der Dock-Fuge werden 0,5+0,5 wieder zu einem ganzen Stein verschmolzen',
      '1+1 bleiben getrennt mit Fuge und Chamfer',
    ],
  },
  {
    version: '0.7.170',
    date: '2026-08-27',
    title: 'Wand-+ wie Duplizieren, Gizmos folgen der Wand',
    changes: [
      'Plus links/rechts an der Wand kopiert wie „Duplizieren“ (gleiche Versatz-Logik)',
      'Plus/Minus- und Dreh-Buttons bleiben beim Kameraschwenken an der Wand (nicht mehr mit der Kamera)',
    ],
  },
  {
    version: '0.7.169',
    date: '2026-08-27',
    title: 'Dock 1+1, Bossen-Vorstand, Wand-+ andocken',
    changes: [
      'An der Dock-Fuge bleiben 1+1 und 0,5+0,5 getrennte Steine mit Chamfer — kein verschmolzenes „2“ ohne V-Nut',
      'Bossen-Vorstand verschiebt die Gehrung bis zur Bossen-Front mit (Paneelkanten wandern mit)',
      'Wand-+ links/rechts dockt bündig an die Auswahl (von außen, panelFlip-korrekt), wie + oben',
    ],
  },
  {
    version: '0.7.168',
    date: '2026-08-27',
    title: 'Wand +/− immer bei Auswahl, Bibliothek 1 px',
    changes: [
      'Plus/Minus links, rechts und oben erscheinen bei markierter Wand ohne vorherigen Bibliothek-Klick',
      'Bibliothek-Klick wählt weiterhin, welche Wand + setzt; sonst gleiche Länge wie die Auswahl',
      'Aktive Bibliothekskarte mit 1 px schwarzer Umrandung statt 2 px',
    ],
  },
  {
    version: '0.7.167',
    date: '2026-08-27',
    title: 'Bibliothek: Plus/Minus an der Wand, aktive Karte umrandet',
    changes: [
      'Wand markieren, Bibliotheks-Wand anklicken: +/− links, rechts und oben — Plus setzt die gewählte Wand, oben eine Etage (Dialog, Standard alles), Minus entfernt',
      'Bibliothekskarte des bereits angewendeten Elements mit 2 px schwarz umrandet; ohne Auswahl ist „Keines“ umrandet',
    ],
  },
  {
    version: '0.7.166',
    date: '2026-08-27',
    title: 'Dock-Fuge: 0,5+0,5 wieder ein Stein',
    changes: [
      'Zwei halbe Steine an der Dock-Fuge werden wieder zu einem ganzen (wie 0,5/1/0,5 auf 0,5/1/0,5)',
      'Zwei volle 1er-Steine bleiben getrennt mit normaler Fuge; nur echte Reste unter 0,49 werden aufgenommen',
    ],
  },
  {
    version: '0.7.165',
    date: '2026-08-27',
    title: 'Fenster- und Tür-Animation',
    changes: [
      'Reiter Animation an jedem Fenster und jeder Tür: getrennte Kurven für Öffnen und Schließen',
      'Punkteeditor (Kurve oder Linie), Vorlagen Fenster/Haustür/Linear, Abspielen inkl. Pause',
      'JSON-Datensatz zum Kopieren und späteren Übernehmen derselben Bewegung',
    ],
  },
  {
    version: '0.7.164',
    date: '2026-08-27',
    title: 'Wand-Front zur Kamera, Dock-Fuge, 1er-Steine',
    changes: [
      'Neue Wand in 3D: Front automatisch entgegengesetzt zur Blickrichtung (z. B. Blick S/W → Front N/N/O)',
      'Zwei 1er-Steine an der Dock-Fuge bleiben getrennt (normale Fuge); nur Reste <0,49 werden aufgenommen',
      'Kollineare Docks ohne Gehrung — keine Lücke in Paneelen, Sockel und Streifen',
    ],
  },
  {
    version: '0.7.163',
    date: '2026-08-27',
    title: 'Dock-Fuge, Merge-Regel, Sockel-Versatz',
    changes: [
      'Dock-Merge korrigiert: kleiner Stein (<0,49) fällt weg, voller Stein reicht über die Fuge',
      'Zwei volle Steine an der Dock-Kante bleiben getrennt, aber ohne Chamfer-Lücke',
      'Sockel-Vorstand standardmäßig 0 cm (nicht mehr 4 cm)',
    ],
  },
  {
    version: '0.7.162',
    date: '2026-08-27',
    title: 'Dock-Merge, Zierband-UI, Sockel-Freiraum',
    changes: [
      'Zierband-Eingabefelder umbrechen im Sidebar-Panel (flex-wrap)',
      'Dock: voller Stein + Randstein <0,49 → ein Stein; zwei volle Steine bleiben getrennt',
      'Paneel-Überlappung an Dock-Kanten vergrößert — weniger sichtbare Trennlinie',
      'Bodentür: kein Bodenquad unter Türen; Schwelle 8 cm unter y=0',
      'Sockel und Zierband: Freiraum um Öffnungen berücksichtigt',
    ],
  },
  {
    version: '0.7.161',
    date: '2026-08-27',
    title: 'Dock-Regel, Erker-Breite, Zierband',
    changes: [
      'Kollineare Dock-Fugen: universelle geometrische Regel (ohne planLinked), Raster-Fortsetzung und Paneel-Überlappung',
      'Laibungssiegel an Öffnungen vergrößert — keine Paneellücken neben Fenstern',
      'Bodentür: keine Stör-Linie an der Schwelle (Wandloch + kein Bodenring unter Türen)',
      'Erker 192/384: Frontwand exakt in Preset-Breite (rechteckig)',
      'Zierband: Profil/Stil, Querschnitt-Höhe, Tiefe und Vorstand editierbar',
    ],
  },
  {
    version: '0.7.160',
    date: '2026-08-27',
    title: 'Gesims-Anker, Erker-Auswahl, Kamera',
    changes: [
      'Gesimse und Zierbänder sitzen wieder bündig auf Wand/Paneel (kein Legacy-V1-Offset, korrekter Z-Anker)',
      'Erker: Klick auf eine Teilwand wählt die ganze Baugruppe (Parent + Schenkel)',
      'Angedockte Wände: Seitenfugen an kollinearen Kanten auch mit Paneele ausgeblendet',
      '3D-Kamera: schnelleres Drehen, Bloom während Orbit aus, längeres Orbit-Lite',
    ],
  },
  {
    version: '0.7.159',
    date: '2026-08-27',
    title: 'Dock-Fuge, Freiraum, Dekor-Sync',
    changes: [
      'Reihen oben ausblenden: Schrift und Zierbänder aus dem ausgeblendeten Streifen wandern auf die nackte Wandfläche',
      'Angedockte Wände ohne Paneele: keine sichtbaren Seitenfugen an kollinearen Dock-Kanten',
      'Zierbänder und Freiraum-Ring werden an Öffnungen inkl. Freiraum-Abstand durchtrennt',
      'Dock-Fuge: nur halbe Endsteine (0,5+0,5) werden zusammengelegt, nicht volle (1+1)',
      'Tür am Boden: keine Stör-Linie mehr an der Sohlbank (SVG + 3D-Freiraum-Kappe)',
      'Erker: panelFlip der Seitenwände zeigt wieder nach außen (kein X-Schnitt mehr)',
    ],
  },
  {
    version: '0.7.158',
    date: '2026-08-27',
    title: 'Kompass-Ausrichtung, Erker-Fronten, Edit-Scope',
    changes: [
      'Neue Wand aus Bibliothek: Achse und Front folgen der gewählten Kompass-Himmelsrichtung',
      'Andocken: Außenseite der neuen Wand an 90°-Ecken korrekt; bei Bedarf Wand umdrehen',
      'Erker: linke/rechte/vordere Wandflächen mit je eigener panelFlip; Gehrung über planLinked',
      'Gültig für: Button „Element“ heißt „Auswahl“; Fassade = gleiche Yaw-Richtung, nicht alle Wände',
      'Zierbänder: bei Etage/Typ/Fassade per Index/Höhe mitziehen; Ausschnitt an Öffnungen wie Profile',
    ],
  },
  {
    version: '0.7.157',
    date: '2026-08-26',
    title: 'Layout-Reparatur rechte Spalte',
    changes: [
      'Rechte Sidebar wieder korrekt: Szene-Einstellungen (Licht/Animation/Szene) liegen wieder in #ui-right statt im Viewport-Grid',
      'Ursache: zusätzliches schließendes </div> nach der Öffnungs-Toolbar schloss #ui-right zu früh',
    ],
  },
  {
    version: '0.7.156',
    date: '2026-08-26',
    title: 'Platzierungs-Raster, Hilfslinien, Tür-Toolbar, Zierbänder',
    changes: [
      'Beim Verschieben/Platzieren: 8-cm-Raster auf Boden oder Zielwand; nach Ablegen ausgeblendet',
      'Wand-Verschieben: Hilfslinien für Enden und Mittelachsen; Öffnungen behalten eigene Kanten/Mitten',
      'Tür/Fenster-Toolbar: HTML-Struktur repariert — Register-Tabs (Maße, Farben, Profil, …) funktionieren wieder',
      'Freiraum um Öffnung: keine Stör-Linie mehr an der Sohlbank bei Boden-Türen',
      'Zierbänder: zusätzliche horizontale Profile auf beliebiger Höhe (Gesims-Bereich)',
      'Paneele an Dock-Kante: zwei halbe Steine (0,5+0,5) werden an der Fuge zu einem ganzen Stein',
      'Geschoss duplizieren: Einfügen zwischen Quell-Etage und bereits vorhandener oberer Wand',
    ],
  },
  {
    version: '0.7.155',
    date: '2026-08-26',
    title: 'Erker-Geometrie, Balkon/Loggia, Öffnungs-Tabs',
    changes: [
      'Runder Erker: Bogen-Positionierung über Sehnenbreite; sichtbare Ellipsen-Wölbung',
      '45°-Erker: rechte Seite korrekt (yaw+135°); Gehrung über planLinked + panelFlip je Außenseite',
      'Balkon/Loggia: Front-Brüstung 96 cm × 16 cm; Seiten volle Höhe; Standalone mit Hauswand (back)',
      'Fenster/Tür: Register-Tabs in der Toolbar wieder sichtbar',
    ],
  },
  {
    version: '0.7.154',
    date: '2026-08-26',
    title: 'Erker-Bogen, Gesims, Schrift, LOD, Öffnungs-Toolbar',
    changes: [
      'Runder Erker: eine durchgängige Ellipsenbogen-Wand (`arcBay`) statt vieler Facetten; Paneele/Profile folgen der Krümmung',
      'Gesims nur noch oben; Auswahl oben/unten entfernt',
      'Wandschrift: Start zentriert (48 cm), Speichern verschiebt nicht mehr nach oben; Flach/Tiefe konsistent auf Paneel bzw. Wand; &-Zeichen per Canvas-Fallback',
      'Detail-Reduktion aus: Preset-Buttons und „Alle Details jetzt laden“ ausgeblendet',
      'Fenster/Tür-Auswahl: alle Toolbar-Sektionen (Bank, Verdachung, Teilung, Profil, Farben) gleichzeitig sichtbar',
    ],
  },
  {
    version: '0.7.153',
    date: '2026-08-26',
    title: 'Wand-Andocken, Bibliothek Erker/Balkon/Loggia, Ellipsen-Erker',
    changes: [
      'Etage darüber: neue Wände sitzen Fläche-auf-Fläche (y = Quelle.y + Höhe), höhere Etagen rücken um das echte Delta',
      'Andock-Stil-Dialog: Höhe Auswahl↔Nachbar; Bibliothek-Drop nutzt aktive Wandhöhe; „Nur verbinden“ lässt Höhe',
      'Verknüpfung lösen entfernt planLinked und groupId (keine Stil-Propagierung mehr über die Gruppe)',
      'Platzier-Ghost: unsichtbares Browser-Thumbnail, Live-Wand-Ghost + orange Fläche auf Etagen-Y',
      'Bibliothek: Tabs Erker / Balkon / Loggia; Tab Wände nur Längen, Endstücke und Wände mit Fenster/Tür',
      'Erker U/45° schließen an Außenfläche mit Gehrung (planLinked); runder Erker als Ellipsenbogen (24 Facetten, kein Kreis)',
    ],
  },
  {
    version: '0.7.152',
    date: '2026-08-26',
    title: 'Weitere Fenster- und Tür-Presets in der Bibliothek',
    changes: [
      'Türen: 288×320 und 480×320 (144×320 war schon vorhanden)',
      'Fenster: 396×196, 192×192, 96×264, 48×96 (144×192 war schon vorhanden)',
      'Galerie zeigt die neuen Öffnungs-Presets automatisch',
    ],
  },
  {
    version: '0.7.151',
    date: '2026-08-26',
    title: 'Szeneneinstellungen ohne Auswahl wieder rechts sichtbar',
    changes: [
      'Ohne Auswahl: Szeneneinstellungen (#lighting-accordion) wieder fest in der rechten Spalte',
      'Fix: Szene-UI war fälschlich in #selection-toolbar genestet und verschwand mit der leeren Auswahl',
    ],
  },
  {
    version: '0.7.150',
    date: '2026-08-26',
    title: 'Freie Kamera und bessere Galerie-Navigation',
    changes: [
      '3D-Orbit ohne Polar-Limit — Kamera wieder unter den Boden drehbar',
      'Galerie: größerer Orbit-Radius und Sichtweite, Nachbarreihen bleiben sichtbar',
      'Galerie-Pan etwas schneller (Screen-Space)',
    ],
  },
  {
    version: '0.7.149',
    date: '2026-08-26',
    title: 'Balkon, runder Erker und Loggia in der Wandbibliothek',
    changes: [
      'Bibliothek Wände: Balkon 192/384, Erker rund 192/384, Loggia 192/384',
      'Runder Erker als Facetten-Halbkreis; Loggia als U-Form nach innen',
      'Persistenz: bayWindow.shape/kind/wallIds[] (Alt-Erker bleiben ladbar)',
    ],
  },
  {
    version: '0.7.148',
    date: '2026-08-26',
    title: 'Fenster folgt Öffnungsbogen, Einbettungs-Profile, glattere Bögen',
    changes: [
      'Fenster/Tür folgen immer der Öffnungsbogenform — Checkbox „Rundbogen am Fenster“ entfernt',
      'High-LOD: gesamte Fensterform folgt der Öffnungskrone; Flügel/Scheiben ohne eigene Mini-Bögen',
      'Eingebettete Öffnungen: Profile und Verdachung folgen weiter der Bogenkrone',
      'Profil-Sweep: Outward als Sehnennormale; dichtere Mesh-Segmente gegen Facetten',
    ],
  },
  {
    version: '0.7.147',
    date: '2026-08-26',
    title: 'Mauerwerk folgt Nicht-Rundbogen-Öffnungen',
    changes: [
      'Paneel-/Mauerwerk-Clip stanzt bei Spitz-/Stich-/Lanzett- & Co. wieder den Öffnungskörper frei (Körperloch + Kronen-Clip)',
      'Laibungs-Siegel nutzt die Kämpferlinie auch ohne Rundbogen-Geometrie',
    ],
  },
  {
    version: '0.7.146',
    date: '2026-08-26',
    title: 'Bogenformen für Öffnungen und Verdachungen',
    changes: [
      'Öffnungen: Eckig, Rund-, Spitz-, Stich-, Lanzett-, Korb-, Ellipsen- und Tudorbogen per Vorschaukarten',
      'Stichmaß aus klassischen Verhältnissen; Maske, Profile und Glas folgen der Bogenkrone',
      'Keilstein-Ring nur noch beim Rundbogen; Verdachung mit derselben Formpalette',
    ],
  },
  {
    version: '0.7.145',
    date: '2026-08-26',
    title: 'Galerie: Nahzoom wieder flüssig',
    changes: [
      'Entfernte Galerie-Wände werden ausgeblendet — Nahzoom bleibt performant',
      'Zoom wird nah am Objekt schneller; Orbit-Minimum niedriger',
    ],
  },
  {
    version: '0.7.144',
    date: '2026-08-26',
    title: 'Sonne: realistischer Tagesverlauf und manuelle Overrides',
    changes: [
      'Datum und Tageszeit setzen den Berlin-Sonnenstand (Winkel, Weichheit, Intensität, Farbtemperatur)',
      'Sonnenwinkel, Intensität, Weichheit und Farbtemperatur bleiben manuell, bis Datum/Tageszeit erneut bewegt wird',
    ],
  },
  {
    version: '0.7.143',
    date: '2026-08-26',
    title: 'Schrift nicht mehr durch Wände',
    changes: [
      'Flache Fassaden-Schrift nutzt wieder Depth-Test — kein Durchscheinen durch andere Wände (z. B. Galerie)',
    ],
  },
  {
    version: '0.7.142',
    date: '2026-08-26',
    title: 'Galerie-Navigation um einzelne Wände',
    changes: [
      'Klick setzt den Orbit-Mittelpunkt auf die Wand; Doppelklick zoomt heran',
      'Einstieg fokussiert die erste Reihe statt die gesamte Galerie',
      'Orbit-Distanz begrenzt — Navigation bleibt flüssig',
    ],
  },
  {
    version: '0.7.141',
    date: '2026-08-26',
    title: 'Galerie-Ansicht für alle Standards',
    changes: [
      'Button Galerie: alle Wandlängen, Paneelstile, Öffnungen und Erker im Raster',
      'Abstand zwischen Wänden/Reihen rechts einstellbar (Standard 320 cm)',
      'Zufallsblock mit „Neu würfeln“ — Projekt bleibt beim Verlassen erhalten',
    ],
  },
  {
    version: '0.7.140',
    date: '2026-08-26',
    title: 'Laibung bündig, Paneele ohne Schraffur',
    changes: [
      'Öffnungs-Tunnel nur noch unsichtbar für Schatten — kein Z-Fight mit Laibung/Paneelen',
      'Paneele, Mörtel und Laibung empfangen keine Shadow-Map mehr (keine Zoom-Schraffur)',
      'Steine um die Öffnung wieder sauber, Laibung steht nicht vor',
    ],
  },
  {
    version: '0.7.139',
    date: '2026-08-26',
    title: 'Quellen nur Positivliste',
    changes: [
      'Quellen-Dialog listet nur noch Genutztes — kein Abschnitt „Nicht verwendet“',
    ],
  },
  {
    version: '0.7.138',
    date: '2026-08-26',
    title: 'Weniger Lichtlecks, Weichheit, Andock-Orange',
    changes: [
      'Sonne scheint nicht mehr durch Wandstärke und Laibung (Öffnungs-Tunnel wirft Schatten)',
      'Schatten-Weichheit reagiert wieder auf den Slider',
      'Beim Verschieben: orange Andockmarkierung auf der Etage der gezogenen Wand, nur die nächste Fläche',
    ],
  },
  {
    version: '0.7.137',
    date: '2026-08-26',
    title: 'Längere, passendere Bodenschatten',
    changes: [
      'Bodenschatten werden nicht mehr am Hauskasten abgeschnitten — auch bei tiefer Sonne',
      'Paneele, Fugen und Sockel werfen mit, die Silhouette stimmt mit der Fassade überein',
    ],
  },
  {
    version: '0.7.136',
    date: '2026-08-26',
    title: 'Kein HDRI, Quellen neben der Version',
    changes: [
      'HDRI vollständig entfernt (Datei, Loader, Szene-Schalter)',
      'Neben der Versionsnummer: Quellen und Danksagung, was wirklich eingebunden ist',
    ],
  },
  {
    version: '0.7.135',
    date: '2026-08-26',
    title: 'Glanz sichtbar, Schrift-Freistreifen, Verdachungs-Lift',
    changes: [
      'Glänzend und metallisch nutzen Studio-Reflexionen auch ohne HDRI',
      'Schrift rückt in den oberen Freistreifen auch wenn er niedriger als die Schrift ist',
      'Verdachung hebt sich exakt um die Höhe/Länge des Sturzprofils (inkl. cm-Maße)',
    ],
  },
  {
    version: '0.7.134',
    date: '2026-08-26',
    title: 'Schrift-Freistreifen, Profil-Maße, Oberflächen',
    changes: [
      'Schrift rückt automatisch in den oberen Freistreifen, wenn „Reihen oben ausblenden“ genug Platz lässt',
      'Rahmenprofil und Verdachung: Höhe/Länge und Tiefe in cm; Verdachung nutzt die Profilhöhe für den Versatz',
      'Oberfläche Wand, Paneele und Profile: stumpf, glänzend oder metallisch',
    ],
  },
  {
    version: '0.7.133',
    date: '2026-08-26',
    title: 'Verdachung über dem Profil, volle Canvas-Breite',
    changes: [
      'Verdachung sitzt über dem Fensterprofil; zusätzlicher Versatz nach oben einstellbar',
      'Eingeklappte Ebenenleiste: 3D-Ansicht füllt die Breite, Kamera schneidet nicht ab',
      'Keilstein-Einstellungen und Vorschau nur sichtbar, wenn der Ring an ist',
      'Öffnung zurücksetzen neben Duplizieren und Löschen',
    ],
  },
  {
    version: '0.7.132',
    date: '2026-08-26',
    title: 'Glatte Wände und Sockel ohne Schraffur',
    changes: [
      'Wandkörper und Sockel ohne Shadow-Map-Moiré beim Rein- und Rauszoomen',
      'Shadow-Map nur von der Vorderseite — weniger Röhrenmonitor-Muster auf großen Flächen',
    ],
  },
  {
    version: '0.7.131',
    date: '2026-08-26',
    title: 'Verdachung an Fensterbreite, Schrift auf der Wand',
    changes: [
      'Verdachung immer so breit wie das Fenster — nur Überstand und Firsthöhe sind einstellbar',
      'Dreieck zu / Segment zu: Profil nach außen, geschlossene Gehrung',
      'Verdachung rutscht über ein später gesetztes Öffnungsprofil am Sturz',
      'Extrudierte Schrift vor der Fassade, geschlossene Buchstaben, aufrecht mit Schatten',
    ],
  },
  {
    version: '0.7.130',
    date: '2026-08-26',
    title: 'Schrift-Lage wie Flach',
    changes: [
      'Extrudierte Schrift 180° in der Wandebene — gleiche Leserichtung wie Flachschrift',
    ],
  },
  {
    version: '0.7.129',
    date: '2026-08-26',
    title: 'Schrift-Typeface Winding',
    changes: [
      'Federo-Typeface mit umgekehrtem Kontur-Winding — Buchstaben vorne geschlossen',
    ],
  },
  {
    version: '0.7.128',
    date: '2026-08-26',
    title: 'Schrift-Extrusion geschlossen',
    changes: [
      'Federo-Typeface mit umgekehrtem Kontur-Winding — Buchstaben vorne geschlossen, nicht hohl',
      'Kurven in typeface.js-Reihenfolge; Schrift mit Tiefe aufrecht und mit Schatten',
    ],
  },
  {
    version: '0.7.127',
    date: '2026-08-26',
    title: 'Schrift-Typeface Cache',
    changes: [
      'Federo-Typeface neu ausgeliefert (Cache-Bust) — Kurven geschlossen, Schrift aufrecht mit Tiefe',
    ],
  },
  {
    version: '0.7.126',
    date: '2026-08-26',
    title: 'Schrift-Kurven und Schatten',
    changes: [
      'Federo-Typeface: Kurvenbefehle in typeface.js-Reihenfolge — Rundungen geschlossen, nicht geshreddert',
      'Extrudierte Schrift aufrecht, Vorderseite geschlossen, bündig an der Fassade, wirft Schatten auf die Wand',
      'Shadow-Map wird auch bei reinen Schrift-Änderungen aktualisiert',
    ],
  },
  {
    version: '0.7.125',
    date: '2026-08-26',
    title: 'Geschlossene Verdachung, Schrift aufrecht',
    changes: [
      'Dreieck zu / Segment zu: nur Giebelbreite und Firsthöhe — keine Linien links und rechts',
      'Fassaden-Schrift steht aufrecht; Textfeld hat einen Speichern-Button',
      'Schrift mit Tiefe sitzt auf der Wand, ist vorne geschlossen, wirft Schatten',
    ],
  },
  {
    version: '0.7.124',
    date: '2026-08-26',
    title: 'Schrift-Tiefe, Federo-Fonts, Verdachung',
    changes: [
      'Schrift „Mit Tiefe“: Typeface lädt zuverlässig (Public-Fonts unter /fonts/, Retry, Fallback Helvetiker)',
      'Federo liegt in public/fonts/ (nicht unter Downloads) — TTF und typeface.json werden vom Dev-Server ausgeliefert',
      'Geschlossene Dreiecks-Verdachung ohne Gehrungs-Sliver an der Basis (Giebelzug und Sturz getrennt)',
    ],
  },
  {
    version: '0.7.123',
    date: '2026-08-26',
    title: 'Streifen und Mauerwerk am Rundbogen',
    changes: [
      'Streifenpaneele und Mauerwerk folgen der Bogenlinie — ohne Treppenstufen an der Laibung, ohne Dreiecksrest am Scheitel',
      'Bossen an geschnittenen Steinen laufen mit der Kurve, nicht als Sehne durchs Fenster',
    ],
  },
  {
    version: '0.7.122',
    date: '2026-08-26',
    title: 'Schrift sichtbar auf dem Stein',
    changes: [
      'Beschriftung in einer Tür oder einem Fenster wird auf die geschlossene Wandfläche gelegt',
      'Schrift bleibt vor der orangen Auswahl sichtbar und sitzt klar vor Bosse und Fuge',
    ],
  },
  {
    version: '0.7.121',
    date: '2026-08-26',
    title: 'Schrift liegt auf dem Mauerwerk',
    changes: [
      'Fassaden-Schrift sitzt wieder auf der Steinaußenseite — auch an gespiegelten Wänden (nicht mehr unsichtbar hinter der Wand)',
      'Neue Schrift setzt den Anker auf die Wandfläche, nicht in eine Tür- oder Fensteröffnung',
    ],
  },
  {
    version: '0.7.120',
    date: '2026-08-26',
    title: 'Paneele folgen wieder dem Rundbogen',
    changes: [
      'Streifen und Ziegel am Rundbogen werden wieder an der Bogenlinie geschnitten, nicht treppenförmig',
    ],
  },
  {
    version: '0.7.119',
    date: '2026-08-26',
    title: 'Schrift einblenden ohne Freeze',
    changes: [
      '„Schrift anzeigen“ baut nicht mehr alle Paneele und die Zeichnung neu',
      'Federo-Laden blockiert die UI nicht mehr (Timeout, kein 256-px-Font-Load, typeface erst bei Mit Tiefe)',
    ],
  },
  {
    version: '0.7.118',
    date: '2026-08-26',
    title: 'Paneele, Öffnungsbreite, Schrift, Verdachung',
    changes: [
      'Schrift ein/aus blendet nicht mehr die Paneele (Font-Reload baut High-LOD wieder auf)',
      'Fenster-/Türbreite ändert sich mittelaxial (je Hälfte links und rechts, 4-cm-Raster für X)',
      'Zeichnung: keine doppelten Wandkanten unter Streifenpaneelen',
      'Verdachung zu: nur Giebelbreite/Firsthöhe, keine Seitenlinien; offene Formen mit Checkbox',
    ],
  },
  {
    version: '0.7.117',
    date: '2026-08-26',
    title: 'Schrift-Drag & Andock-Orientierung',
    changes: [
      'Wandbeschriftung per Drag auf der Fassade verschiebbar (wie Fensterprofil)',
      'Andocken: bei Winkel > 91° zur Nachbarwand Front um 180° drehen',
      'Wandaußenfläche bei Paneelen bleibt sichtbar (ausgeblendete Reihen)',
    ],
  },
  {
    version: '0.7.116',
    date: '2026-08-26',
    title: 'Schema-Migration & Hydrate',
    changes: [
      'Fassaden-Schema-Leiter FACADE_SCHEMA_VERSION 10: Alt-Saves erhalten denselben Feldkatalog wie neue Bibliothek-Elemente',
      'Hash- und Datei-Import laufen über dieselbe migrate→hydrate→clamp-Pipeline',
      'Migration: windowDepthOffset −24→0, sockelStandard→sockelprofil; Breaking-Hinweis via needsReview',
    ],
  },
  {
    version: '0.7.115',
    date: '2026-08-26',
    title: 'Darüber: Verknüpfung bei Mehrfachklon',
    changes: [
      'Duplizieren → Darüber: bei mehreren kopierten Wänden bleibt planLinked untereinander erhalten',
      'Einzelwand darüber weiterhin unverbunden (planLinked: false)',
    ],
  },
  {
    version: '0.7.114',
    date: '2026-08-26',
    title: 'Federo-Schrift, Paneele & Verknüpfung',
    changes: [
      'Fassaden-Schrift (Tab Schrift): Federo für flache Textur und extrudierte 3D-Buchstaben',
      'Wandaußenfläche bleibt bei Paneelen sichtbar (ausgeblendete Reihen zeigen Wandfarbe)',
      'Öffnungsbreite ändert sich mittelachial; verknüpfte Wände verschieben sich gemeinsam',
      'Verdachung: geschlossene Formen nur Breite/Höhe; offene mit Seitenlinien-Checkbox',
      'Treppe: Feld „Breite oben“ entfernt (folgt Türbreite + Überstand)',
    ],
  },
  {
    version: '0.7.113',
    date: '2026-08-26',
    title: 'Wand-Duplizieren: Untermenü',
    changes: [
      'Rechtsklick Wand: Duplizieren mit Nach links, Nach rechts, Darüber, Separiert (Studio)',
      'Darüber fügt Geschoss direkt über der Quell-Etage ein (insertStoreyAbove)',
    ],
  },
  {
    version: '0.7.112',
    date: '2026-08-25',
    title: 'Treppe: Podesttiefe einstellbar',
    changes: [
      'Podesttiefe der obersten Ebene unabhängig vom Stufen-Auftritt',
      'Oberste Ebene schließt hinten immer an Tür bzw. Innenwand an',
    ],
  },
  {
    version: '0.7.111',
    date: '2026-08-25',
    title: 'Glattere Wandflächen ohne Moiré',
    changes: [
      'Wandkörper empfängt keine Shadow-Map mehr — weniger Schraffur-Artefakte beim Zoomen',
      'Außenfläche des Wandkörpers entfällt bei aktiven Paneelen (kein Z-Fighting mit Mörtel)',
    ],
  },
  {
    version: '0.7.110',
    date: '2026-08-25',
    title: 'Verdachung: Giebelmaße & geschlossene Formen',
    changes: [
      'Dreieck/Segment: Giebelbreite, Firsthöhe und Seitenlinien links/rechts einstellbar',
      'Neue Formen Dreieck zu und Segment zu (unten geschlossener Umriss)',
    ],
  },
  {
    version: '0.7.109',
    date: '2026-08-25',
    title: 'Wandbeschriftung',
    changes: [
      'Neuer Tab Schrift: Text auf der Fassade platzieren (Hausnummer, Name, …)',
      'Darstellung flach (Textur) oder mit räumlicher Tiefe (3D-Buchstaben, Serifenlos vorerst)',
      'Position, Höhe, Farbe und Ausrichtung einstellbar',
    ],
  },
  {
    version: '0.7.108',
    date: '2026-08-25',
    title: 'Paneel-Reihen ausblenden',
    changes: [
      'Wand-Paneele: Reihen von oben oder unten gezielt ausblenden (0, 1, 2, …)',
      'Ausgeblendete Bänder ohne Steine und Mörtel — sichtbar bleibt der Wandkörper',
    ],
  },
  {
    version: '0.7.107',
    date: '2026-08-25',
    title: 'Öffnungsbreite zentriert',
    changes: [
      'Breitenänderung bei Fenstern und Türen bleibt mittig (z. B. +16 cm → je 8 cm links und rechts)',
      'Gilt für Breitenfeld in der Toolbar und Modell-/Türgrößen-Wechsel',
    ],
  },
  {
    version: '0.7.106',
    date: '2026-08-25',
    title: 'Streifen-Paneele an mehreren Rundbogenfenstern',
    changes: [
      'Streifen-Paneele zwischen/über mehreren Öffnungen: keine verzerrten Trapeze und Diagonalen mehr in der Zeichnung',
      'Bogen-Clip behält saubere Flachbereiche zwischen Fenstern; konkave Reste ohne fehlerhaften Outline-Fächer',
    ],
  },
  {
    version: '0.7.105',
    date: '2026-08-25',
    title: 'Schema-Hydration für bestehende Elemente',
    changes: [
      'Beim Laden werden fehlende Eigenschaften an alten Wänden und Öffnungen nachgezogen — dieselben UI-Funktionen wie bei neuen Bibliothek-Elementen',
      'Neue Features bleiben an Alt-Elementen standardmäßig aus (Optik unverändert)',
      'Fassaden-Schema-Version getrennt von der App-Version; dokumentierte Migrationsleiter',
    ],
  },
  {
    version: '0.7.104',
    date: '2026-08-25',
    title: 'Tür-/Rundbogen-Artefakte und Wand-Andocken',
    changes: [
      'Tür am Wandrand: keine fehlerhafte Dreiecksfläche mehr über dem Rahmen (Wandkontur)',
      'Rundbogen-Fenster: Geisterlinie im linken Oberlicht beseitigt',
      'Wand verschieben: orange Andockmarkierung, Magnet-Snap an Nachbarenden, ruhigeres Raster (48 cm)',
    ],
  },
  {
    version: '0.7.103',
    date: '2026-08-25',
    title: 'Leere Bibliothekskacheln und Sockel-Clip',
    changes: [
      'Bibliothek und Profil-Picker: erste Kachel „Keine/Keines/Keiner“ zum Abwählen',
      'Sockelhöhe blendet Paneele und Ziegel von unten stufenweise aus, damit der Sockel sichtbar bleibt',
    ],
  },
  {
    version: '0.7.102',
    date: '2026-08-25',
    title: 'Freiraum-Vertiefung in der Wand',
    changes: [
      'Freiraum-Tiefe unter 0 schneidet das Mauerwerk im Band aus: Rückwand und Stufenleibung zeigen die Vertiefung, statt dass der Rahmen verschwindet',
    ],
  },
  {
    version: '0.7.101',
    date: '2026-08-25',
    title: 'Freiraum-Rahmen ohne Paneele',
    changes: [
      'Freiraum um die Öffnung gilt auch ohne Mauerwerk/Paneele: Abstand und Tiefe bilden einen Rahmen auf der nackten Wand',
    ],
  },
  {
    version: '0.7.100',
    date: '2026-08-25',
    title: 'Freiraum-Front und Sockelhöhe',
    changes: [
      'Freiraum-Tiefe: kleinerer Wert zieht die Front nach innen (0 = Wand, Paneel-Vorstand = bündig mit den Paneelen)',
      'Sockelhöhe wieder in 1-cm-Schritten — die Pfeile am Zahlenfeld wirken nicht mehr wie blockiert',
    ],
  },
  {
    version: '0.7.99',
    date: '2026-08-25',
    title: 'Freiraum-Tiefe bewegt die Front',
    changes: [
      'Freiraum „leer“: die sichtbare Front folgt der Tiefe (Vertiefungskante), statt an der Paneelfront zu bleiben',
    ],
  },
  {
    version: '0.7.98',
    date: '2026-08-25',
    title: 'Fenster-Pick, Freiraum-Tiefe, Keilstein-Alpha',
    changes: [
      'Fensterklick wählt wieder die Öffnung (nicht die Wand) — Paneele/Freiraum-Band verdecken den Pick nicht mehr',
      'Freiraum: Leibung endet bündig an der Vertiefung; Abstand und Tiefe getrennt einstellbar',
      'Keilstein-Ring ist als Alpha gekennzeichnet',
    ],
  },
  {
    version: '0.7.97',
    date: '2026-08-25',
    title: 'Schenkelsteine gleich hoch, Anzahl wählbar',
    changes: [
      'Keilsteine bis Sohlbank: gleiche Steinhöhe von der Bank bis zum Kämpfer, nicht mehr am Wandraster',
      'Anzahl je Seite einstellbar (1–21) wie bei den Keilsteinen, Auto aus der Steinhöhe',
    ],
  },
  {
    version: '0.7.96',
    date: '2026-08-25',
    title: 'Zwickel docken an die Keilstein-Außenkante',
    changes: [
      'Paneele werden gegen dieselbe Extrados-Polyline geschnitten wie die Keilstein-Meshes — keine Sehne mehr durch den Ring',
      'Zeichnungs-Hack (Kanten 8°) und 4-Punkt-Bogenkontur zurückgenommen; Krümel unter 3,2 cm wieder ausgeblendet',
    ],
  },
  {
    version: '0.7.95',
    date: '2026-08-25',
    title: 'Paneele münden sichtbar am Extrados',
    changes: [
      'Zeichnung zeigte die Paneel-Mündung am Außenbogen nicht: Kantenwinkel 22° hat die Bogenfacetten als gerade Sehne versteckt — Paneele jetzt mit 8°',
      'Zwickel-Kontur mit 4 Punkten auf der Clip-Kurve; dünne Reste über dem Scheitel bleiben stehen (keine Mondsichel-Lücke)',
    ],
  },
  {
    version: '0.7.94',
    date: '2026-08-25',
    title: 'Zwickel: eine Kontur für Körper und Boss',
    changes: [
      'Zwickelsteine: Körper und Bossen nutzen dieselbe Restkontur (Clip-Punkte auf der Bogenlinie, max. 10 Ecken, parallele Fase)',
      'Kein Rechteck-Diamant-Fallback und keine Interpolations-Sehne mehr durch die Keilsteine',
    ],
  },
  {
    version: '0.7.93',
    date: '2026-08-25',
    title: 'Zwickel-Körper folgt der Bogenlinie',
    changes: [
      'Zwickel-Körper extrudiert die Clip-Kurve (nicht die Sehne) — kein Rechteck mehr im Keilstein-Ring',
      'Bossen bleiben ein paralleler Einzug derselben Restform; der fehlerhafte Boden/Kappen-Split ist zurückgenommen',
    ],
  },
  {
    version: '0.7.92',
    date: '2026-08-25',
    title: 'Keine Diagonale durch die Keilsteine',
    changes: [
      'Mauerwerk neben dem Extrados und Zwickel in der Kappe werden getrennt — keine verschmolzene Boden→Bogen-Diagonale mehr durch die Voussoirs',
    ],
  },
  {
    version: '0.7.91',
    date: '2026-08-25',
    title: 'Zwickel docken ohne Sehnen durch die Keile',
    changes: [
      'Zwickel-Körper und Boss teilen dieselbe Clip-Kontur entlang des Extrados — keine grobe Sehne mehr, die diagonal durch die Voussoirs schneidet',
    ],
  },
  {
    version: '0.7.90',
    date: '2026-08-25',
    title: 'Saubere Zwickel-Fasen ohne Zacken',
    changes: [
      'Zwickel-Bossen: Bogen adaptiv ausgedünnt, paralleler Einzug mit 1:1-Vertex-Paaren (kein verdrehtes Resample)',
      'L-förmige Laibungsreste: Schwerpunkt-Fase statt knickendem Offset — keine Linienhaufen am Kämpfer',
    ],
  },
  {
    version: '0.7.89',
    date: '2026-08-25',
    title: 'Zwickel-Bossen folgen der Restkontur',
    changes: [
      'Zwickelsteine: Boss = paralleler Einzug der Clip-Kontur (Bogen mit Stützpunkten + Gegenseite), nie mehr Source-Diamant aus dem Originalfeld',
      'Laibungs- und Größenreste: Bossen am Restmaß, nicht am Ursprungs-Rechteck',
    ],
  },
  {
    version: '0.7.88',
    date: '2026-08-25',
    title: 'Zwickel-Bossen mit paralleler Fase',
    changes: [
      'Zwickelsteine: innere Bossen-Front ist ein paralleler Einzug des Trapezes (gleiche Fase wie die Wand) — kein Mini-Rechteck mehr aus dem Rasterfeld',
    ],
  },
  {
    version: '0.7.87',
    date: '2026-08-25',
    title: 'Kein 3D-Flackern, Zwickel als Trapez-Körper',
    changes: [
      'Selektion baut Zeichnungslinien nicht mehr neu; Orbit blendet Linien/Bloom/Pixelratio nicht mehr um — kein Aufblitzen',
      'Zwickelsteine: Körper und Bossen teilen dasselbe grobe Trapez (ähnliche kleinere Front), kein dichtes Clip-Mesh mit Rechteck-Diamant',
    ],
  },
  {
    version: '0.7.86',
    date: '2026-08-25',
    title: 'Schatten ohne Flackern, Licht-Default',
    changes: [
      'Selektion und Orbit bauen die Shadow-Map nicht mehr neu / schalten sie nicht aus — kein kurzes Ein-/Ausblenden der Schatten',
      'Sonnenlicht-Default wieder 2,0 (wie vor dem Anheben auf 3,5)',
    ],
  },
  {
    version: '0.7.85',
    date: '2026-08-25',
    title: 'Zwickel-Boss = ähnliche Restform',
    changes: [
      'Zwickel/Outline: Bossen-Front ist eine kleinere Kopie der Restkontur (Trapez bleibt Trapez) — kein Rechteck-Diamant mehr aus dem Rasterfeld',
    ],
  },
  {
    version: '0.7.84',
    date: '2026-08-25',
    title: 'Zwickel als Trapez-Bossen',
    changes: [
      'Zwickelsteine: Bossen folgen der Restkontur als Trapez-/Polygon-Extrusion — kein abgeschnittener Rechteck-Diamant mehr',
    ],
  },
  {
    version: '0.7.83',
    date: '2026-08-25',
    title: 'Keil-Bossen und Zwickel-Diamanten',
    changes: [
      'Keilsteine: Bossen als großer konzentrischer Keil (kein Mini-Rechteck-Paneel), Front ohne doppelte Körperkante',
      'Zwickel: wieder rastertreue Diamant-Bossen — kein gezackter zweiter Bossen-Ring am Extrados',
    ],
  },
  {
    version: '0.7.82',
    date: '2026-08-25',
    title: 'Einbettung wiederhergestellt',
    changes: [
      'Checkbox „In Wand eingebettet“ ist wieder in der Öffnungs-Toolbar (war versehentlich entfernt)',
    ],
  },
  {
    version: '0.7.81',
    date: '2026-08-25',
    title: 'Trapez-Bossen am Zwickel, kein zweiter Bogenring',
    changes: [
      'Bossen an Zwickelsteinen folgen der Trapez-/Bogenkontur — kein eingepferchtes Rechteck-Paneel mehr',
      'Mit Keilstein-Ring erzeugt Freiraum „leer“ keinen zweiten Bogen um die Voussoirs; das Raster dockt am Extrados',
    ],
  },
  {
    version: '0.7.80',
    date: '2026-08-25',
    title: 'Zwickelsteine aus dem Wandraster',
    changes: [
      'Ziegel und Paneele laufen bis an den Rundbogen und werden dort an der Außenlinie der Keilsteine abgeschnitten',
      'Die Reststeine sind die Zwickel — keine extra Blöcke, Leisten oder Kästen über dem Bogen',
    ],
  },
  {
    version: '0.7.79',
    date: '2026-08-25',
    title: 'Zwickel in Wandschichten, kein Kasten über dem Bogen',
    changes: [
      'Über dem Rundbogen bleibt das Mauerwerk: die Kappe endet am Scheitel, volle Schichten sitzen darüber',
      'Die Zwickel folgen dem Extrados in denselben Lagerfugen wie die Wand — kein leeres Rechteck mehr',
    ],
  },
  {
    version: '0.7.78',
    date: '2026-08-25',
    title: 'Keilstein-Schenkel und saubere Zwickel',
    changes: [
      'Optional: Keilsteine bis zur Sohlbank — Schenkel gleicher Ringstärke links und rechts der Laibung, der Halbkreis bleibt',
      'Über dem Rundbogen kein zerschnittenes Raster mehr: die Kappe wird als Zwickel am Extrados gemauert, volle Schichten sitzen darüber',
    ],
  },
  {
    version: '0.7.77',
    date: '2026-08-25',
    title: '3D-Navigation wieder flüssig',
    changes: [
      'Orbit, Schwenken und Mausrad-Zoom bleiben während der Geste leicht: Bloom und Schatten-Abtastung aus, Zeichnungskanten aus, Pixelratio 1 — Zoom zählt mit (nicht nur ⌘-Ziehen)',
      'Nach dem Loslassen bzw. kurz nach dem letzten Rad-Tick wieder volle Qualität; Kamera folgt weiter ohne Dämpfung',
      'Bogen- und Keilstein-Meshes nutzen weniger Segmente in 3D — die Clip-Kurve bleibt fein, die Ansicht ruckelt weniger',
    ],
  },
  {
    version: '0.7.76',
    date: '2026-08-25',
    title: 'Keilsteinbogen: echte radiale Voussoirs',
    changes: [
      'Rundbogen-Keilsteine sind echte Keile mit gemeinsamem Mittelpunkt — Intrados und Extrados als konzentrische Halbkreise, Fugen strikt radial',
      'Kein Diamant-Bossen mehr in den Keilen (das wirkte in der Zeichnung zerbrochen); Bossen folgen dem Keil',
      'Mauerwerk dockt an der Außenlinie des Rings (Extrados), die Laibung bleibt in Öffnungsbreite; SVG-Vorschau mit Kreisbögen und radialen Fugen',
    ],
  },
  {
    version: '0.7.75',
    date: '2026-08-25',
    title: 'Römischer Keilsteinbogen am Rundbogen',
    changes: [
      'Optionaler Keilstein-Ring am Fassaden-Rundbogen: konzentrischer Extrados und strikt radiale Fugen (Voussoirs)',
      'Anzahl und Bogenstärke folgen dem Paneelmaße (Auto), manuell überschreibbar — Live-SVG-Vorschau in der Öffnungs-Toolbar',
      'Mauerwerk und Paneele docken am Extrados; Freiraum „zulaufen“ bleibt ein Band außerhalb des Rings; Bossen greifen auch an den Keilsteinen',
    ],
  },
  {
    version: '0.7.74',
    date: '2026-08-25',
    title: '3D-Navigation ohne Verzögerung',
    changes: [
      'Orbit, Schwenken und Zoom folgen der Maus sofort — kein Nachlaufen mehr durch Kameradämpfung',
      'Während des Drehens bleiben Bloom und Schatten-Map aus, damit die Ansicht flüssig bleibt; nach dem Loslassen wieder voll',
      'Die 3D-Ansicht rendert nur noch bei Bewegung oder Änderung, nicht dauerhaft im Leerlauf',
    ],
  },
  {
    version: '0.7.73',
    date: '2026-08-24',
    title: 'Bossen-Diamant am Bogen wie das volle Feld',
    changes: [
      'Zugeschnittene Steine am Rundbogen haben einen Diamanten wie volle Felder (vier Schrägen, kleine Front) — die Front bleibt im Raster, wenn sie noch im Stein liegt, sonst ein Diamant im Restbalken statt zwei Zentren im L',
      'Nichts ragt ins Fensterloch; L-Steine an Kämpfer und Laibung zerfallen nicht in zwei Bossen',
    ],
  },
  {
    version: '0.7.72',
    date: '2026-08-24',
    title: 'Ein Bossen-Diamant pro Stein, auch am Bogen',
    changes: [
      'Zugeschnittene Bossensteine am Rundbogen haben dasselbe Diamantprofil wie volle Felder: vier Schrägen und eine kleine Front im Reststein',
      'Ein L-Stein an Kämpfer und Laibung bleibt ein Stück und bekommt einen Diamanten — nicht zwei Erhebungen und kein Split in zwei Kisten',
    ],
  },
  {
    version: '0.7.71',
    date: '2026-08-24',
    title: 'Diamant-Bossen an Bogenkappen und Laibung',
    changes: [
      'Zugeschnittene Steine um Rundbogen und hohe Öffnungen bekommen dasselbe X-Bossenprofil wie volle Felder (vier Schrägen, kleine Front) — nicht nur extra Tiefe mit flacher Front',
      'Die kleine Front sitzt im Restbalken; die Schrägen ragen nicht ins Fensterloch',
    ],
  },
  {
    version: '0.7.70',
    date: '2026-08-24',
    title: 'Bossenprofil auch an zugeschnittenen Steinen',
    changes: [
      'Steine neben Fenstern und Rundbögen bekommen dasselbe Diamant-/X-Bossenprofil wie volle Felder, nicht nur extra Tiefe',
      'Die kleine Front sitzt im Reststein (nicht im Fensterloch); die Schrägen folgen der echten Kontur (L-Form, Bogenkante)',
    ],
  },
  {
    version: '0.7.69',
    date: '2026-08-24',
    title: 'Bossen-Vorstand zerlegt Steine am Rundbogen nicht mehr',
    changes: [
      'Größerer Bossen-Vorstand lässt Ziegel neben Rundbogen-Fenstern ganz: keine waagerechte Teilung an der Kämpferlinie und keine Mini-Kisten im Bogen',
      'Steine links und rechts der Laibung bleiben ein Stück (auch als L mit Bogenkante); nur die echte Überlappung folgt der Kurve',
      'Der Vorstand sitzt auf derselben Kontur wie der Stein — nicht als Rechteck-Bounding-Box im Fensterloch',
    ],
  },
  {
    version: '0.7.68',
    date: '2026-08-24',
    title: 'Sockelleiste mit richtiger Außenecken-Gehrung',
    changes: [
      'Die Sockelleiste trifft an 90°-Außenecken wie ein Bilderrahmen auf die Nachbarwand — nicht mehr als nach innen geneigtes V mit offenem Profilquerschnitt',
      'Wandpaneele und Gesims oben bleiben unverändert; nur das Sockelprofil nutzt die nach außen längere Gehrung',
    ],
  },
  {
    version: '0.7.67',
    date: '2026-08-24',
    title: 'Kein Phantom-Kasten in der Zeichnung am Rundbogen',
    changes: [
      'Ziegel- und Mörtelfugen in der Zeichnung folgen dem Rundbogen: keine rechteckige Bounding-Box um den Bogen und keine Fugenfragmente in den Zwickeln',
      'Unter der Kämpferlinie bleibt die echte Laibung; in der Bogenkappe wird über die volle Steinbreite an der Kurve geschnitten — nicht an den lotrechten Kastenkannten',
      'Mehrere Rundbogen nebeneinander und runde Nischen (z. B. Regenrohr) behalten ihre Löcher, statt dass ein zweiter Clip das erste Loch wieder füllt',
    ],
  },
  {
    version: '0.7.66',
    date: '2026-08-24',
    title: 'Saubere Öffnungsmasken, Nischen und Regenrohr-Ausschnitte',
    changes: [
      'Rundbogen-Fenster hinterlassen im Mauerwerk und in den Paneelen keinen rechteckigen Phantom-Kasten mehr um den Bogen',
      'Wandloch, Ziegel und Mörtel folgen derselben Kontur — ohne Extra-Spalte zwischen Maske und Verband',
      'Neuer Bibliothek-Tab Nischen: eckige und runde Vertiefungen, Regenrohr-Ausschnitt und Durchbrüche, ohne Fensterrahmen und Glas',
      'Form (eckig/rund) und Öffnungsart (Nische oder Durchbruch) in der Sidebar; runde Masken als Kreis oder Kapsel',
    ],
  },
  {
    version: '0.7.65',
    date: '2026-08-24',
    title: 'Andock-Querschnitt, Gehrung, Fake-Öffnung, Profil-Bibliothek, Stile kopieren',
    changes: [
      'Beim Ziehen einer neuen Wand leuchten die Andockflächen orange: linker/rechter Querschnitt (Wandtiefe) oder die obere Fläche',
      '0°/90°-Ecken nach dem Verknüpfen mit Gehrung am Wandkörper, Paneel, Sockel und Gesims (Nachbar-Endpunkte, unabhängig von der Grundriss-Laufrichtung)',
      '„In Wand eingebettet“: Rahmen und Glas verschwinden, die Wand bleibt geschlossen; Fensterbänke, Profile, Rundform und Verdachung bleiben (Fake-Öffnung)',
      'Profile und Verdachung liegen in der unteren Bibliothek (eigene Reiter) und lassen sich per Drag&Drop auf Wand bzw. Fenster/Tür legen; rechts nur Zahlen und Checkboxen',
      'Rechtsklick auf eine Wand: Stile kopieren und auf Wände oder Öffnungen einfügen — Dialog wählt Paneel, Farben, Gesims, Sockel, Rahmenprofil, Verdachung und Bänke',
    ],
  },
  {
    version: '0.7.64',
    date: '2026-08-24',
    title: 'Wand-Verknüpfung, Gehrung, Stil-Dialog',
    changes: [
      'Freie Wände andocken: echte Verknüpfung mit Gehrung an der Ecke; Dialog mit drei Optionen (Auswahl auf Nachbarn, Nachbarn auf Auswahl, nur verbinden)',
      'Rechtsklick: Verknüpfung lösen (dann frei verschiebbar) oder Wand verknüpfen, wenn Enden anstoßen',
      'Grundriss-Wände lassen sich nicht mehr herausziehen, strecken oder drehen, solange sie mit nicht ausgewählten Wänden verknüpft sind',
      '90°-Ecken wieder mit Bilderrahmen-Gehrung (Wandkörper); Paneel, Sockel und Gesims folgen „Ecke“ (Gehrung oder stumpf/bündig)',
    ],
  },
  {
    version: '0.7.63',
    date: '2026-08-24',
    title: 'Gesims 8 cm, Sockel 19×196, Endstück L/R, Erker, Sonne',
    changes: [
      'Gesimshöhe rastet in 8-cm-Schritten statt auf die Paneelhöhe',
      'Sockelprofil nur noch 19×196 (SVG); alte Standard-Box-Profile entfallen',
      'Endstück 48 links/rechts: Drag in die Fläche setzt ein sichtbares L; Außenseite vorne+links bzw. vorne+rechts',
      'Erker beim Einsetzen wie eine Wand sichtbar; Drop auf eine Wand fragt nach Ersetzen oder Angliedern (links/rechts/darüber)',
      'Sonnenlicht-Slider bis 8, Default 3,5 (zuvor max. 2,5)',
    ],
  },
  {
    version: '0.7.62',
    date: '2026-08-24',
    title: 'Licht ohne HDRI, Sockel-Tiefe/Vorschau, Gesimshöhe',
    changes: [
      'Ohne HDRI wieder die alte Lichtstimmung: kein ACES-Tone-Mapping, HDRI standardmäßig aus',
      'Sockelhöhe/-tiefe in cm; Vorschau und 3D skalieren das SVG-Profil wie bei Fensterprofilen',
      'Gesimshöhe in Schritten der Paneel-/Ziegelhöhe statt freiem Größenfaktor',
    ],
  },
  {
    version: '0.7.61',
    date: '2026-08-24',
    title: 'Licht ohne HDRI, Sockel 1 cm, Sockelprofil',
    changes: [
      'Ohne HDRI: wieder die frühere Lichtstimmung (kein RoomEnvironment als Szenenlicht, Tone-Mapping wie zuvor)',
      'Sockelhöhe, -tiefe und Versatz in 1-cm-Schritten statt 8-/16-cm-Raster',
      'Sockelprofil-Querschnitt aus dem Original-SVG neu aufgebaut (links = Wand, unten = Boden)',
    ],
  },
  {
    version: '0.7.60',
    date: '2026-08-24',
    title: 'Treppen-Sync, sichere Saves, Gruppen, 10°-Drehung',
    changes: [
      'Türen mit aktiver Treppe halten die Treppenbreite jetzt immer an der Türbreite, auch bei Preset-Wechsel und beim Laden alter Projekte',
      'Alte Projekte behalten ohne gespeichertes HDRI-Flag wieder den früheren Licht-Look; Persistenz speichert nun eine Schema-Version',
      'Letztes Haus und letztes Geschoss lassen sich löschen; die App fällt auf einen leeren gültigen Zustand zurück',
      'Wand-Gruppen: Mehrfachauswahl kann gruppiert werden; Gruppen erscheinen in den Ebenen und drehen gemeinsam um einen Schwerpunkt',
      'Erker-Drop fragt jetzt nach ersetzen / links / rechts / oben und legt den Erker als Gruppe an; Erker richtet sich an der Fassadenaußenseite aus',
      'Feindrehung der Wände läuft jetzt in 10°-Schritten; dekorative Sockelprofile nutzen wieder ihre native Tiefe ohne aufgeblasenes SVG',
    ],
  },
  {
    version: '0.7.59',
    date: '2026-08-24',
    title: 'HDRI, physisches Glas, Erker, End-Bossen, Endstück L, Sockelprofil',
    changes: [
      'Szene: HDRI-Umgebung für Reflexionen und Stimmung (Intensität, optional als Himmel, Belichtung)',
      'Öffnungen: physisches Glas (IOR, Rauheit, Transmission, Dicke) neben Farbtönung — nur 3D',
      'Bibliothek Wände: Erker 192/384 cm, Tiefe 144 cm, rechteckig (U) und 45° — Stile automatisch von Andockwand',
      'Paneele: optionale Bossen an freien Wandenden (1/1, 0,5/0,5, abwechselnd) und Stoß bündig/Gehrung an Nachbar',
      'Endstück 48: Drag&Drop, L-Grundriss 48×48 cm (Fortführung + Winkel-Schenkel)',
      'Sockelprofil: neuer Querschnitt aus hochgeladener Silhouette',
    ],
  },
  {
    version: '0.7.58',
    date: '2026-08-24',
    title: 'Wanddrehung, Endstück, Sockel, Bossen an Fugen',
    changes: [
      'Wand drehen: Overlay 90° bleibt; in den Einstellungen Feindrehung in 8°-Schritten um die Wandmitte',
      'Bibliothek Wände: Vorschau ohne cm-Zahl, volle Höhe im Verhältnis Länge:448',
      'Bossen/Zylinder an kollinear fortgeführten Wänden: volle Steine behalten die Form, Köpfe (0,5er) bleiben flach',
      'Endstück 48 cm in der Bibliothek: zwei Schenkel à 48 cm, Winkel 40–140° in 10°-Schritten',
      'Sockel: Tiefe und Versatz vor dem Mauerwerk unabhängig einstellbar (auch bei SVG-Profil)',
    ],
  },
  {
    version: '0.7.57',
    date: '2026-08-24',
    title: 'Bossen, Ladebildschirm, Sockelleiste, Profile',
    changes: [
      'Bossensteine im Tab Paneele (auch bei Mauerwerk, nicht nur im Modus Komplex)',
      'Ladeanimation bis die Fassade bereit ist; Start immer in der 3D-Ansicht',
      'Sockelprofil: SVG-Höhe vom Boden = Sockelhöhe, liegt auf der Wand, Tiefe = SVG-Breite; Aussparung an Öffnungen',
      'Gesims- und Fensterprofile sitzen wieder auf der Paneelfläche',
    ],
  },
  {
    version: '0.7.56',
    date: '2026-08-24',
    title: 'Wände, Stuck, Selektion, Bibliothek-Layout',
    changes: [
      'Bibliothek-Tabs fest über den Karten; Szene-/Auswahl-Register volle Höhe bis zum unteren Fensterrand',
      'Leibung folgt Paneeltiefe/Profilebene; Außenbank trackt auch Trapez-Vorstand (taperDepth)',
      'Wand andocken: Dialog „Stile der Nachbarwand übernehmen?“ (Optik ohne Öffnungen)',
      'Keine 1:1-Überlagerung beim Ablegen/Verschieben/Drehen/Duplizieren; Miters nach Dock/Move; 90° Flush, Gehrung nur schräg',
      'Wände in Plan und 3D/2D per Drag verschieben; 90°-Overlay an der Selektion',
      'Paneelfläche orange + Drag verschiebt Wand; Treppen-Orange auf Stufen; Sockelprofil ersetzt Box',
    ],
  },
  {
    version: '0.7.55',
    date: '2026-08-23',
    title: 'Vertikale Register, Paneele-DnD, Wand-Andocken, 3D-Flächen',
    changes: [
      'Rechte Auswahl-Register wieder untereinander mit gedrehtem Text (wie Szene-Tabs)',
      'Untere Bibliothek-Tabs im gleichen Chrom, waagerecht; neuer Tab Paneele mit Drag auf Wände',
      'Wand-Andocken: Live-Vorschau in Plan/2D/3D, ±Richtung am Knoten, T-Stoß erlaubt, Drop legt zuverlässig ab',
      'Wandkörper in 3D: Innen- und Außenflächen wieder beidseitig sichtbar (DoubleSide)',
    ],
  },
  {
    version: '0.7.54',
    date: '2026-08-23',
    title: 'Bibliothek unten, Optionen rechts, Wand-Andocken',
    changes: [
      'Untere Leiste zeigt immer die Element-Bibliothek (Wände/Fenster/Türen), Register horizontal über den Karten',
      'Auswahl-Optionen wieder rechts: horizontale Register oben in der rechten Leiste, Werte/Farben bleiben dort',
      'Wand-Andocken: Schatten- und Orange-Vorschau, Überlappung verboten, Front bündig, 90°-Drehen und R für Achse',
      'Linke Ebenen-Spalte lässt sich wieder zuverlässig ein- und ausklappen',
    ],
  },
  {
    version: '0.7.53',
    date: '2026-08-23',
    title: 'Optionen nur unten, Wand-Andocken, linke Spalte',
    changes: [
      'Options-Register horizontal nebeneinander; Titel „Optionen“ entfernt',
      'Bei Auswahl: Einstellungen nur noch in der unteren Leiste (rechte Auswahl-Leiste ausgeblendet)',
      'Wand-Presets: orangene Andock-Vorschau im Grundriss; Snap an bestehende Knoten; Mehrfachauswahl (Ctrl/Cmd) und Verschieben im Navigieren-Modus',
      'Linke Spalte (Ebenen) einklappbar',
    ],
  },
  {
    version: '0.7.52',
    date: '2026-08-23',
    title: 'Options-Register unten bei Auswahl',
    changes: [
      'Bei Auswahl: Options-Gruppen (Maße, Profile, Paneele …) als Register unten in der Übersicht',
      'Rechts nur noch die Bearbeitungs-Controls der aktiven Registerkarte',
      'Ohne Auswahl: Bibliothek (Wände / Fenster / Türen) unten, Szene rechts wie bisher',
    ],
  },
  {
    version: '0.7.51',
    date: '2026-08-23',
    title: 'Einfach/Komplex und Wand-Bibliothek',
    changes: [
      'UI-Modus Einfach | Komplex (Persistenz localStorage): Komplex zeigt erweiterte Feineinstellungen, gleiches Datenmodell',
      'Untere Bibliothek mit Tabs Wände / Fenster / Türen',
      'Wand-Presets (96–576 cm) per Klick oder Drag&Drop als Raster-Segment in den Grundriss — bestehende Öffnungen bleiben erhalten',
    ],
  },
  {
    version: '0.7.50',
    date: '2026-08-23',
    title: 'Rundbogen und SVG-Profilachsen',
    changes: [
      'Rundbogen an Fenster und Tür: Blendrahmen, Flügel und Glas als konzentrischer Halbkreis (nicht mehr verschoben/verzerrt)',
      'SVG-Profile: links = Wand, rechts = Front; Fensterprofil-oben = oben am Holm; Traufgesims-oben = Traufe (hängt von der Wandoberkante nach unten)',
      'Nur noch die gelieferten SVG-Profile in den Pickern (Fenster 32×120/35×130/40×140, Traufe 70×150/110×135/200×200, Sockel Standard + Profil)',
    ],
  },
  {
    version: '0.7.49',
    date: '2026-08-23',
    title: 'Dev-Server: frischer Code trotz Watch aus',
    changes: [
      'Vite-Modulcache invalidiert bei Dateiänderung (mtime) — kein eingefrorener Altcode mehr',
      'Behebt leere Szene / fehlendes Haus durch Runtime-Crash in veraltetem Bundle',
      'Cache-Control: no-store für Dev-Module',
    ],
  },
  {
    version: '0.7.48',
    date: '2026-08-23',
    title: 'SVG-Profile: Fenster, Traufe, Sockel',
    changes: [
      'Neue Fensterprofil-Querschnitte 32×120, 35×130, 40×140 mit Vorschau',
      'Neue Traufgesims-Profile 70×150, 110×135, 200×200 im Gesims-Picker',
      'Sockelprofil: Standard-Vertiefung bleibt, optionales neues Profil mit Vorschau',
      'Farbe, Maße (Profilgröße) und Drehung für Rahmen-, Gesims- und Sockelprofil',
    ],
  },
  {
    version: '0.7.47',
    date: '2026-08-23',
    title: 'Toolbar-Tab bleibt, Bank/Treppe, Aufräumen',
    changes: [
      'Register springt beim Editieren nicht mehr auf Paneele',
      'Keilsteine und „Fächer im Zwickel“ entfernt',
      'Türbreite ändert Treppen-Kernbreite um denselben Delta (Überstand bleibt)',
      'Außenbank-Tiefe folgt Paneel-/Mauerwerkstiefe; Standard Überstand 16, Tiefe 32+, Profil Keines (Brett)',
      'Verdachungs-Optionen nur sichtbar wenn Verdachung an',
      '„Position verschieben“-Label entfernt',
    ],
  },
  {
    version: '0.7.46',
    date: '2026-08-23',
    title: 'Bossen, Sprossen, Bogen-Fix',
    changes: [
      'Trapez-/Bossen-UI heißt jetzt Bossensteine / Bossenprofil (statt „Zylinder“/Trapez)',
      'Sockel-Tab springt bei Höhenänderung nicht mehr zu Paneele',
      'Türbreite passt Treppenbreite mit an (ohne seitlichen Überstand)',
      'Wandhöhe direkt editierbar (Zahl + ±)',
      'Rundbogen: Rahmen/Glas ohne Fragmente an der Laibung links unten',
      'Sprossen sofort sichtbar, gelten für alle Felder unter dem Oberlicht',
      'Toolbar: Beschriftung immer in einer Zeile, Auswahl darunter',
    ],
  },
  {
    version: '0.7.45',
    date: '2026-08-23',
    title: 'Dev-Server: kein Watch-Sturm mehr',
    changes: [
      'Vite File-Watch aus — Desktop/iCloud-Touches lösen keine Server-Restarts und „nur HTML, kein JS“ mehr aus',
      'Nach Code-Änderungen Seite manuell neu laden (kein HMR)',
      'Share-Hash in der URL wird verzögert und bei sehr langen Hashes übersprungen (State bleibt in localStorage)',
    ],
  },
  {
    version: '0.7.44',
    date: '2026-08-23',
    title: 'Paneele-Einstellungen wieder sichtbar',
    changes: [
      'Klick auf Paneelfläche öffnet den Tab „Paneele“ (Muster Paneele/Mauerwerk) — nicht mehr hinter Tab „Maße“ versteckt',
      'Muster-Karten bleiben sichtbar, auch wenn „Paneele anzeigen“ aus ist',
      '„Fächer im Zwickel“ unter Rundbogen wieder da (steuert Freiraum „Auf den Bogen zulaufen“)',
    ],
  },
  {
    version: '0.7.43',
    date: '2026-08-23',
    title: 'Dev-Server stabil',
    changes: [
      'Nur noch ein Vite auf Port 5173 (strictPort) — kein stilles Wechseln auf 5174',
      'iCloud-/Sync-Touches an tsconfig und package-lock lösen keine Reload-Schleife mehr',
      'Behebt „nur HTML, kein JS“ wenn der Server mitten im Neustart war',
    ],
  },
  {
    version: '0.7.42',
    date: '2026-08-23',
    title: 'Ziegel-Fronten wie der letzte GitHub-Stand',
    changes: [
      'Steinfronten nutzen wieder die Windung von v0.7.33 (keine umgedrehten, hohlen Kacheln)',
      'Bogen-Passstücke werden wieder als untere Bogenkante extrudiert, nicht als umgedrehter Umriss',
    ],
  },
  {
    version: '0.7.41',
    date: '2026-08-23',
    title: 'Ziegel-Fronten und weniger Reloads',
    changes: [
      'Stein- und Passstück-Fronten zeigen wieder nach außen (keine hohlen Kacheln an Öffnungen)',
      'Dev-Server ignoriert Asset-/Temp-Änderungen — weniger vollständige Seiten-Reloads',
    ],
  },
  {
    version: '0.7.40',
    date: '2026-08-23',
    title: 'Paneele/Mauerwerk bleiben wählbar',
    changes: [
      'Bei Wandauswahl bleiben Muster für Paneele und Mauerwerk sichtbar — auch wenn der Klick Sockel oder Paneelfläche trifft',
    ],
  },
  {
    version: '0.7.39',
    date: '2026-08-23',
    title: 'Paneele: Fronten am Rundbogen geschlossen',
    changes: [
      'Passstücke am Rundbogen haben wieder eine geschlossene Vorderseite (gleiche Windung wie die übrigen Steine)',
      'Mit Trapez-Vorstand sitzt die abgeschrägte Front auch auf Bogen-Reststücken, nicht nur auf Rechteckkacheln',
    ],
  },
  {
    version: '0.7.38',
    date: '2026-08-23',
    title: 'Paneele: Öffnungsmaske wie das Fensterloch',
    changes: [
      'Jede Paneele (Streifen und Mauerwerk) wird einzeln gegen die Öffnungsmaske geschnitten — dieselbe Form wie das Fensterloch',
      'Nur die Überlappung folgt dem Rundbogen (Zylinderkante); links und rechts bleiben eckige Reststücke',
      'Kein wandbreites konkaves Streifen-Polygon mehr (Flimmern/Z-Fighting am Bogen)',
    ],
  },
  {
    version: '0.7.37',
    date: '2026-08-23',
    title: 'Paneele/Modul: Rundbogen ohne Rechteck-Schultern',
    changes: [
      'Streifen-/Paneel-Umriss am Rundbogen: konkave Clip-Polygone per Ear-Clipping statt Fächer — kein Füllen des Bogenlochs, Zwickel bleiben zu',
      'Modul-Verkleidung (GLB): bei aktivem Fassaden-Rundbogen ausgeblendet — das Mesh hat nur ein Rechteckloch und zeigte sonst Ecken neben dem Bogen',
    ],
  },
  {
    version: '0.7.36',
    date: '2026-08-23',
    title: 'Paneel-Streifen docken am Rundbogen',
    changes: [
      'Streifen-Paneele: breite Kacheln werden als durchgehender Umriss mit kurvenförmiger Unterkante geschnitten — keine vertikale Rechtecknaht an der Laibung mehr',
      'Freiraum „Leer“: Frontkappe reicht von der Wandaußenfläche bis zur Paneelvorderseite (Band vorne geschlossen)',
    ],
  },
  {
    version: '0.7.35',
    date: '2026-08-23',
    title: 'Rundbogen-Zwickel und Freiraum-Front',
    changes: [
      'Ziegel/Paneele folgen wieder der Bogenkurve: Clip-Reste unter 8 cm Schichthöhe werden nicht mehr verworfen (kein Rechteckloch in den Schultern)',
      'Freiraum-Modus „Leer“: Band um die Öffnung ist vorne mit Wandfläche geschlossen (keine offene Kavität zwischen Paneel und Laibung)',
    ],
  },
  {
    version: '0.7.34',
    date: '2026-08-23',
    title: 'Freiraum-Modi am Rundbogen',
    changes: [
      'Freiraum um die Öffnung: „Leer“ (Wand sichtbar) oder „Auf den Bogen zulaufen“ (radiale Fugen im Freiraum-Band)',
      'Kein automatischer Bogenring mehr — Paneele/Mauerwerk folgen der Innenkurve; Keilstein-Ring nur im Freiraum-Modus „zulaufen“',
      'Clip unter der Kämpferlinie nur gegen die Laibung (kein Rechteckkasten neben dem Bogen); Außenfensterbank neigt korrekt an gedrehten Wänden',
    ],
  },
  {
    version: '0.7.33',
    date: '2026-08-23',
    title: 'Paneelfugen am Fassaden-Rundbogen',
    changes: [
      'Bei Rundbogen und aktivem Paneel-/Mauerwerk entsteht ein Bogenring aus Keilsteinen; die Fugen zielen radial auf den Bogen',
      'Das normale Raster dockt am Bogenrücken an (nicht mehr mit vertikalen Stümpfen an der Lochkurve)',
      'Optional „Fächer im Zwickel“: Passsteine über dem Ring werden radial aufgefächert',
    ],
  },
  {
    version: '0.7.32',
    date: '2026-08-23',
    title: 'Rundbogen: Innenkurve und Glasleiste',
    changes: [
      'Im 2D-Plan und in der Teilungs-Vorschau folgt die innere Flügelkante demselben Bogen wie der Blendrahmen (nicht mehr versetzt)',
      'Die Glasleiste im 3D-Fenster folgt konzentrisch dem Flügelbogen',
    ],
  },
  {
    version: '0.7.31',
    date: '2026-08-23',
    title: 'Rundbogen am Fenster unabhängig von der Fassade',
    changes: [
      'Fenster und Türen können einen eigenen sauberen Rundbogen bekommen (Blendrahmen, Flügel, Glas) — unabhängig vom Bogen in der Fassade',
      'Ohne eigene Wahl folgt das Fenster automatisch der Wandöffnung; dekorative Öffnungsprofile folgen immer dem Fassadenbogen',
      'Kombinierbar: nur Fassade rund, nur Fenster rund, beides rund oder beides rechteckig',
    ],
  },
  {
    version: '0.7.30',
    date: '2026-08-23',
    title: 'Freiraum als Rahmen, Mauerwerk an der Laibung',
    changes: [
      'Mauerwerk schließt links und rechts bündig an Öffnungen an, auch neben dem Rundbogen',
      'Optionaler Freiraum rund um die Öffnung folgt einem gleichmäßigen Band (wie ein leerer Profilrahmen), nicht dem Ziegelraster',
    ],
  },
  {
    version: '0.7.28',
    date: '2026-08-23',
    title: 'Rundbogen ohne Stufen an den Kämpfern',
    changes: [
      'Rundbogen folgt gleichmäßigen Winkelabschnitten statt eines X-Rasters — die Kurve bleibt an den Kämpfern rund, Ziegel werden nicht mehr in Stufen ausgeschnitten',
    ],
  },
  {
    version: '0.7.27',
    date: '2026-08-23',
    title: 'Rundbogen glatt statt Raster',
    changes: [
      'Rundbogen-Öffnungen folgen einer echten Kreislinie (Wand, Paneele/Ziegel, Leibung, Profile) statt grober Rechteckstufen',
    ],
  },
  {
    version: '0.7.26',
    date: '2026-08-23',
    title: 'Öffnungen: Sockel, Maße, Blendrahmen, Wand/Nische, Rundbogen',
    changes: [
      'Sockel-Einstellungen bleiben bei jeder Wandauswahl sichtbar (ganz unten)',
      'Öffnungsmaße Breite/Höhe/Tiefe/Position frei editierbar; Vorlagen weiterhin überschreibbar',
      'Eingebetteter Blendrahmen (Default Einbettung 8 cm, Fensterfront 4 cm nach innen)',
      'Öffnung als bündige Wandfläche oder Nische (Profile/Konsolen weiter steuerbar)',
      'Optionaler Rundbogen oben mit Keilsteinen; Paneele, Leibung und Profile folgen dem Bogen',
    ],
  },
  {
    version: '0.7.25',
    date: '2026-08-23',
    title: 'Toolbar: engerer Label-Abstand',
    changes: [
      'Abstand zwischen Titeln und Eingabefeldern/Buttons in der rechten Toolbar einheitlich 4px',
    ],
  },
  {
    version: '0.7.24',
    date: '2026-08-22',
    title: 'Fensterteilung mit Verhältnissen',
    changes: [
      'Fensterteilung: 1–5 gleiche Teile vertikal und horizontal; bei Zweiteilung Verhältnis 1:1 bis 1:6',
      'Primärstege dicker als Sprossen; Sprossen weiter 0–2 je Fensterteil mit Mehrfachauswahl',
      'Türen: Brüstung ein/aus mit Verhältnis Brüstung:Glas 1:1 bis 1:4',
    ],
  },
  {
    version: '0.7.23',
    date: '2026-08-22',
    title: 'Zwei-Ebenen-Fensterteilung',
    changes: [
      'Fensterteilung: vertikal 1 / 1/1 / 1/2 / 1/3 und horizontal 1–3 Spalten über den ganzen Flügel',
      'Sprossen je Fensterteil: 0–2 senkrecht und waagerecht; Mehrfachauswahl in der Vorschau',
      'Alte Saves mit sashSplitV/paneCols werden automatisch migriert',
    ],
  },
  {
    version: '0.7.22',
    date: '2026-08-22',
    title: 'Häuser verschieben/drehen, flexible Fenstersprossen',
    changes: [
      'Grundriss: Haus per Flächenklick wählen und verschieben; Hilfslinien (Self + Align) wie bei Fenstern',
      'Gebäude-Drehung ±45° dreht das gewählte Haus geometrisch (Knoten und Wände), nicht nur die Site-Illusion',
      'Fenstersprossen: vertikales Höhenverhältnis 1/1, 1/2, 1/3 und horizontale Felder 1–3 pro Stapel',
    ],
  },
  {
    version: '0.7.21',
    date: '2026-08-22',
    title: 'Decke / Boden vereint, Formular-Abstände',
    changes: [
      'Pro Geschossgrenze nur noch eine Trennfläche (Decke / Boden) statt getrennter Decke und Boden',
      'Ebenen-Liste und Toolbar: Bezeichnung „Decke / Boden“',
      'Abstand unter Überschriften einheitlich 16px; Checkbox-Text linksbündig',
    ],
  },
  {
    version: '0.7.20',
    date: '2026-08-22',
    title: 'Fix: Ziegel an der Laibung',
    changes: [
      'Öffnungslöcher fressen keine ganzen Steinlagen mehr auf (Regression v0.7.19)',
      'Steine enden an der Fensterkante; Gehrung an Öffnungen geht vom Loch weg statt hinein',
    ],
  },
  {
    version: '0.7.19',
    date: '2026-08-22',
    title: 'Fix: Ziegel an Fenstern',
    changes: [
      'Öffnungs-Loch frisst Steine an der Laibung ganz auf — keine Köpfe/Läufer mehr im Fensterbereich',
    ],
  },
  {
    version: '0.7.18',
    date: '2026-08-22',
    title: 'Strichstärke wirksam & Szene-Register',
    changes: [
      'Strichstärke im Modus Zeichnung wirkt jetzt sichtbar (2D-SVG, 3D mit LineSegments2, Grundriss-Kanten)',
      'Szene-Panel mit vertikalen Registern wie bei der Auswahl-Toolbar (Sonne, Verlauf, Gebäude, Farben, Bloom, LOD, Debug, Nebel)',
    ],
  },
  {
    version: '0.7.17',
    date: '2026-08-22',
    title: 'Grundriss-Sidebar & Strichstärke',
    changes: [
      'Grundriss-Werkzeuge (Modus, Etage, Aktionen, Zoom) in der rechten Seitenleiste statt schwebend im Viewport',
      'Szene-Akkordeon ausgeblendet, solange Grundriss-Ansicht aktiv ist',
      'Strichstärke (Zeichnung) oben links neben Farbe/Zeichnung — unabhängig von Szene sichtbar',
      'Einheitlichere Abstände bei Dropdowns und Eingaben in Szene (Tagesverlauf Von/Bis)',
    ],
  },
  {
    version: '0.7.16',
    date: '2026-08-22',
    title: 'Fix: Paneele an Öffnungen',
    changes: [
      'Aggressive Kachel-Aufblähung (v0.7.14) zurückgenommen — Mauerwerk clippt wieder präzise an der Öffnung',
      'Schmale Reststreifen (< 8 cm) nach dem Clippen werden verworfen statt als Splitter stehen zu bleiben',
    ],
  },
  {
    version: '0.7.15',
    date: '2026-08-22',
    title: 'Fix: Haus wieder sichtbar',
    changes: [
      'Startup-Crash behoben: Strichstärke wurde vor Initialisierung von facade/svgView angewendet',
    ],
  },
  {
    version: '0.7.14',
    date: '2026-08-22',
    title: 'UX-Feinschliff und Paneel-Clipping',
    changes: [
      'Kompass-Nadel folgt in 2D/Zeichnung wieder der gewählten Himmelsrichtung',
      'Szene: Strichstärke für den Stil „Zeichnung“ einstellbar (lineStrokeScale)',
      'Paneele/Ziegel schneiden an Öffnungen immer auf volle Kachelkanten (auch ohne Profile)',
      'Toolbar: einheitliche Abstände, klare Feldüberschriften, graue Tab-Spalte bis unten',
      '„Gültig für“ neben den Buttons; Undo/Redo ohne Hintergrund-Leiste',
      'Hinweistexte standardmäßig grau, rot nur bei Fehlern (is-error)',
    ],
  },
  {
    version: '0.7.13',
    date: '2026-08-22',
    title: 'Keine Akkordeons in Auswahl-Toolbar',
    changes: [
      'Alle Auswahl-Toolbars (Öffnung, Wand/Studio, Dach, Decke) ohne `<details>`-Akkordeons — nur Überschriften und Unterüberschriften',
      'Keine Trennlinien mehr zwischen Sektionen im Panel',
    ],
  },
  {
    version: '0.7.12',
    date: '2026-08-22',
    title: 'Checkboxen & Verdachungs-UI',
    changes: [
      'Einheitliche Checkbox-Darstellung in der Öffnungs-Toolbar (Flex, feste Größe, Label direkt neben der Box)',
      'Konkrete Aktions-Labels statt „Anzeigen“ (Verdachung, Bänke, Konsolen, Treppe)',
      'Verdachung ohne Akkordeon: Überschrift + Unterüberschrift (Fenster-/Türverdachung)',
    ],
  },
  {
    version: '0.7.11',
    date: '2026-08-22',
    title: 'Register-Optik & Sektionsüberschriften',
    changes: [
      'Vertikale Register-Leiste mit grauem Hintergrund, Trennlinien und hervorgehobenem aktiven Reiter',
      'Größere Überschriften für Einstellungs-Sektionen in der Auswahl-Toolbar',
    ],
  },
  {
    version: '0.7.10',
    date: '2026-08-22',
    title: 'Opening-Toolbar: Register verfeinert',
    changes: [
      'Modell und Aktionen nur noch im Reiter „Alles“ (Modell oben, Aktionen unten)',
      'Reiter Maße (Tiefe + Position), Farben-Hub mit allen Öffnungsfarben, Profil inkl. Kanten',
      'Vertikale Reiter-Beschriftung (90°, Laufrichtung nach unten)',
    ],
  },
  {
    version: '0.7.9',
    date: '2026-08-22',
    title: 'Toolbar-Tabs, Verdachung für Türen',
    changes: [
      'Vertikales Register in der rechten Auswahl-Toolbar: „Alles“ plus Reiter pro Einstellungsbereich (Öffnung, Wand, Studio, Dach, Decke)',
      'Verdachung und Konsolen auch für Türen in UI, 2D und 3D; eigene Sektionen statt Verschachtelung in Fensterbänke',
      'Rechte Leiste breiter (ca. 320 px); Profil-Kacheln im 2-Spalten-Grid mit Textumbruch',
    ],
  },
  {
    version: '0.7.8',
    date: '2026-08-22',
    title: 'Fix: Fenster-Einstellungen beim Anklicken',
    changes: [
      'Klick auf Fenster/Tür in 3D oder 2D zeigt wieder die volle Öffnungs-Toolbar (Profil, Bänke, Verdachung)',
      'Grundriss: Auswahl-Toolbar bleibt bei Fensterwahl sichtbar (auch nach Fenstergrößenänderung)',
    ],
  },
  {
    version: '0.7.7',
    date: '2026-08-22',
    title: 'Fix: Öffnungs-Toolbar wieder sichtbar',
    changes: [
      'Profil, Fensterbänke, Verdachung und Treppe erscheinen wieder bei Fenster-/Tür-Auswahl',
      'Dach-/Decken-Selektion blockiert die Öffnungs-Einstellungen nicht mehr',
    ],
  },
  {
    version: '0.7.6',
    date: '2026-08-22',
    title: 'Sonne und Schatten wie zuvor',
    changes: [
      'Fensterreflexion wieder RoomEnvironment (eckige Studio-Lichter, nicht runde Sonnenscheibe)',
      'Glas-Material und Hemisphere-Licht wie vor den Reflexions-Experimenten',
      'Shadow-Map wieder nur bei Geometrie-/Sonnenänderung (autoUpdate aus), Auflösung 4096',
    ],
  },
  {
    version: '0.7.5',
    date: '2026-08-22',
    title: 'Fix: Schatten, Helligkeit, Glasreflexion',
    changes: [
      'Schatten wieder 4096 px (nur bei sehr großen Sites 2048); Shadow-Map aktualisiert sich wieder jedes Frame',
      'Glas: Helligkeit und Sonnenspiegelung zurück (EnvMap + Clearcoat ausbalanciert)',
      'Hemisphere-Aufhellung leicht erhöht',
    ],
  },
  {
    version: '0.7.4',
    date: '2026-08-22',
    title: 'Layout, Glas, Treppen, Datei-Menü',
    changes: [
      'Seitenleisten (Ebenen/Einstellungen) über volle Browserhöhe; Öffnungen-Leiste nur im Viewport',
      'Datei: „Exportieren als .json“, „Importieren einer .json“, Link kopieren',
      'Glas: schmaler Sonnenglanz (EnvMap reduziert, Specular vom Sonnenlicht)',
      'Treppen: oberste Stufe schließt Wandstärke, Trittflächen doppelseitig',
    ],
  },
  {
    version: '0.7.3',
    date: '2026-08-22',
    title: 'Glasreflexion, Treppen, Öffnungen-Leiste',
    changes: [
      'Fenster: Sonnenreflexion als heller Punkt statt großer Fläche (Himmel-EnvMap, weniger Breite)',
      'Treppenstufen: Trittflächen oben wieder sichtbar (Quad-Winding wie Paneel-Geometrie)',
      'Öffnungen-Bibliothek nur unter dem Viewport, nicht mehr unter den Seitenleisten',
    ],
  },
  {
    version: '0.7.2',
    date: '2026-08-22',
    title: 'Fix: Volle Details bei LOD aus',
    changes: [
      'Mit ausgeschalteter Detail-Reduktion erscheinen wieder Ziegel, Fenster und Paneele nach dem Laden',
      'High-Detail-Cache wird nach Geometrie-Rebuilds korrekt invalidiert',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-08-22',
    title: 'Detail-Reduktion steuerbar',
    changes: [
      'Szene: Detail-Reduktion ein/aus (Standard: aus — volle Details wie früher)',
      'Presets Navigation / Ausgewogen / Alle Details; Schwellen und Kategorien einzeln',
      'Button „Alle Details jetzt laden“ für Export und Screenshots',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-22',
    title: 'Performance: LOD & Schatten',
    changes: [
      'Automatisches Detail-LOD beim Rauszoomen (Ziegel → Fassadenplatte → Haus-Hülle)',
      'Ziegel werfen keine Schatten mehr; Shadow-Map skaliert mit Site-Größe',
      'Rebuild nur geänderte Häuser; High-Detail lazy nach Kamera-Nähe',
      'Performance-Debug-Overlay unter Szene → Performance-Debug',
    ],
  },
  {
    version: '0.6.3',
    date: '2026-08-22',
    title: 'Fix: Viewport schrumpft beim Rauszoomen',
    changes: [
      '3D: Kamera-Far-Plane und Nebel folgen Site-Größe und max. Orbit-Distanz',
      'Grundriss: enger Ortho-Tiefenbereich (near/far) — Häuser verschwinden nicht mehr beim Rauszoomen',
      'Untergrund skaliert mit sichtbarem Plan-Frustum; Boden schreibt in Plan-Ansicht kein Depth mehr',
    ],
  },
  {
    version: '0.6.2',
    date: '2026-08-22',
    title: 'Fix: Häuser beim Rauszoomen sichtbar',
    changes: [
      'Grundriss-Kamera zentriert auf alle Häuser (nicht auf Ursprung 0/0)',
      'Zoom-Minimum reicht für gesamte Site; beim Rauszoomen auto-zentrieren',
      'Untergrund-Mitte folgt der Site-Bounding-Box',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-08-22',
    title: 'Multi-Haus Viewport & Ebenen',
    changes: [
      'Grundriss: weiter rauszoomen je nach Gesamtfläche und Hausanzahl',
      'Untergrund und Kamera-Frustum über alle Häuser (nicht nur aktives Haus)',
      '3D: max. Kameraabstand skaliert mit Baukörper-Größe',
      'Nach Haus-Duplikat bleiben alle Haus-Ebenen eingeklappt',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-22',
    title: 'Ebenen, Haus-Duplikat & Regression-Fixes',
    changes: [
      'Regression: Treppe ohne Podest/Setzstufen-Overlap; unteres Türprofil wieder ausgeblendet',
      'Ebenen: schlanke Labels (Typ + Breite cm); Treppe als Unterzeile unter Tür',
      'Decke wie Wand-Zeile mit Mehr-Menü und Farb-Toolbar; FloorPlan.ceilingColor',
      'Dach als aufklappbare Sektion mit Unterpunkten Mansarde/Ziegel/Rinne',
      'Haus duplizieren (Ost/West/Nord/Süd); Haus wählen und im Grundriss verschieben mit Hilfslinien',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-22',
    title: 'Geometrie, Schatten, Farben & Teil-Selektion',
    changes: [
      'Paneel-Trapez: isotroper Kantenrücksprung (gleiche Maße an allen Seiten)',
      'Schatten: PCFSoftShadowMap, 4096² Map; Sonnen-Defaults 4000 K / Intensität 2.0 / Weichheit 2.5',
      'Treppe: Setzstufen + Podest, Sockel-Loch bei angehobener Tür; Treppen-UI bei Türblatt/Profil sichtbar',
      'Türprofil unten wieder gezeichnet; Verdachungs-Konsolen als Profil-Sweep mit Wandversatz',
      'Farben: HEX-Textfeld; Color-Picker bleibt beim Ziehen offen (kein renderUi während Pick)',
      'Teil-Selektion: Treppe/Gesims pickbar; Toolbar und Highlight nur für gewähltes Element',
    ],
  },
  {
    version: '0.4.10',
    date: '2026-08-22',
    title: 'Fix: ⌘⇧ Cursortasten schwenken wieder',
    changes: [
      'Eigene 3D-Navigation: ⌘/Ctrl = rotieren, ⌘/Ctrl+⇧ = schwenken (Maus und Pfeiltasten)',
      'OrbitControls.listenToKeyEvents entfernt — behandelte ⌘⇧ wie ⌘ (beides rotieren)',
      '⌘/Ctrl+Linksklick-Ziehen wieder über Capture-Phase (nicht Three.js ⌘=Pan)',
    ],
  },
  {
    version: '0.4.9',
    date: '2026-08-22',
    title: 'Fix: ⌘⇧ Cursortasten in 3D',
    changes: [
      'OrbitControls.listenToKeyEvents in der 3D-Ansicht — Pfeiltasten schwenken, mit ⌘/Ctrl/⇧ rotieren',
      'Öffnungs-Versatz per Pfeiltaste nur ohne Modifier; ⌘+Rechtsklick-Pan wieder aktiv',
    ],
  },
  {
    version: '0.4.8',
    date: '2026-08-22',
    title: 'Fix: Navigation wie v0.3.0',
    changes: [
      'OrbitControls wieder mit Damping; kein Custom-Orbit und kein Dirty-Rendering mehr',
      'Cmd/Ctrl+Ziehen über Standard-Steuerung (controls bleiben aktiv); Auswahl deaktiviert Orbit nur kurz',
      'Schatten-Map weiter nur bei Geometrie-/Sonnenänderung (autoUpdate=false)',
    ],
  },
  {
    version: '0.4.7',
    date: '2026-08-22',
    title: 'Fix: Orbit hakelt auch ohne Paneele',
    changes: [
      'OrbitControls.update() läuft nicht mehr jedes Frame — Float-Drift hielt den 3D-Render sonst dauerhaft an',
      'Pixelratio bleibt bei Resize auf max. 1,5 (Retina wurde wieder auf 2× gesetzt)',
      'Beim Cmd-Orbit: Schatten und Bloom aus, nach dem Loslassen wieder an',
    ],
  },
  {
    version: '0.4.6',
    date: '2026-08-22',
    title: 'Fix: Stottern + Köpfe an Öffnungen',
    changes: [
      '3D-Ansicht rendert nur noch bei Kamera-, Sonnen- oder Fassadenänderung (idle = kein Vollbild-Render)',
      'Kompass höchstens einmal pro Frame; Muster-SVG-Vorschauen werden gecacht',
      'Mörtel nutzt dieselben Kacheln wie die Steine (kein zweites Layout)',
      'Kopfverband/Mauerwerk: Öffnungsloch in X exakt an Fenster/Tür; Merge-Schwelle = Steinbreite der Lage',
    ],
  },
  {
    version: '0.4.5',
    date: '2026-08-22',
    title: 'Fix: Cmd-Navigation bleibt hängen',
    changes: [
      '⌘/Ctrl + Ziehen dreht die Kamera selbst; Three.js behandelt Cmd+Links sonst als Schwenken und lässt die Steuerung hängen',
      'Auswahl-Klick raycastet nicht mehr durch jedes Mauerstein-Mesh (weniger Ruckler beim Klicken)',
    ],
  },
  {
    version: '0.4.4',
    date: '2026-08-22',
    title: '3D-Navigation flüssiger',
    changes: [
      'Schatten werden beim Orbitieren nicht mehr jedes Frame neu berechnet',
      'Weniger GPU-Last (Pixelratio, Shadow-Map, Bloom, Dachziegel, Steinrückseiten)',
      'Kamera bleibt in Grenzen und läuft nach dem Loslassen nicht mehr frei durch',
    ],
  },
  {
    version: '0.4.3',
    date: '2026-08-22',
    title: 'Fix: Mauerverband-Versatz',
    changes: [
      'Kopfverband, Kreuzverband, Flämisch, Gotisch, Märkisch, Schlesisch und Holländisch: Versatz nach Fachliteratur (Wikipedia/BauNetz)',
      'Schlesischer Verband: 3 Läufer + 1 Kopf pro Schicht (statt 2+1)',
    ],
  },
  {
    version: '0.4.2',
    date: '2026-08-22',
    title: 'Fix: UI ohne CSS / App hängt beim Start',
    changes: [
      'Weitere Endlosschleifen in der Paneel-Verlegung gestoppt (Schritt 0/NaN in buildCuts)',
      'Muster-Vorschau blockiert den Start nicht mehr (nur bei sichtbarer Toolbar)',
      'Minimales App-Layout auch ohne geladenes JS, damit die Oberfläche nicht als Roh-HTML erscheint',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-08-22',
    title: 'Fix: Haus verschwindet nach v0.4.0',
    changes: [
      'Endlosschleife in buildMixedCourseCuts behoben (Mauerwerksmuster blockierten 3D-Init)',
      'Leere buildings[] werden aus Legacy-walls beim Laden repariert; v5-Backup als Fallback',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-08-22',
    title: 'Toolbar, Profile, Paneele/Mauerwerk',
    githubTag: 'v0.4.0',
    changes: [
      'Szene-Panel nur sichtbar ohne Wand-/Öffnungs-/Dachauswahl',
      'Symmetrischer Überstand für Fensterbank innen/außen und Verdachung',
      'Fensterbank außen: Brett-Modus (Keines) oder Profil-Kacheln; Winkel wirkt in 3D',
      'Profilausrichtung im Rahmenprofil-Block; nur bei aktivem Rahmenprofil',
      'Mehrfachbearbeitung trennt Kellerfenster von EG-Fenstern',
      'Profile strikt kategorisiert (Rahmen, Bank, Gesims, Verdachung) mit Kachel-Vorschau',
      'Paneele vs. Mauerwerk: getrennte Muster-Kacheln mit Kontur-Vorschau; 15 Verbandarten',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-08-22',
    title: 'Streifen-Ebenen, Sichtbarkeit, Scope, Paneel-Regeln',
    githubTag: 'v0.3.0',
    changes: [
      'Abwechselnde Streifen: Ebene 1 und Ebene 2 mit eigenem Vorstand und Trapez (Default Ebene 2 = 0)',
      'Geschoss ausblenden blendet Gesims, Fensterprofile und Sohlbänke mit aus',
      'Dach ausblenden funktioniert wieder; Kontextmenü „Löschen“ entfernt das Dach',
      'Edit-Scope „Typ“ für Wände: gleiche Paneel-Konfiguration im aktiven Gebäude',
      'Kein unteres Türprofil mehr (2D und 3D); Seitenprofile enden auf Sockeloberkante',
      'Schmale Paneel-Reste zwischen Öffnungen werden zusammengeführt (min. panelWidth)',
      'Fix: Paneele links/rechts von Fenstern bleiben sichtbar (Loch-Snap wieder 8 cm)',
      'Rechte Toolbar: horizontales Padding an Wand-, Gesims- und Öffnungs-Leisten',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-22',
    title: 'Scope, Ebenen, Bloom/Nebel, Sockel, Dach',
    githubTag: 'v0.2.0',
    changes: [
      'Fix: Decke ausblenden und Ebenen „Ausblenden“ bleiben nach Grundriss-Sync erhalten',
      '„Gültig für“ schwebt unten mittig im Viewport bei Wand-/Öffnungsauswahl',
      'Studio-Wände im Ebenen-Menü duplizieren (Gitter-Offset senkrecht zur Wand)',
      'Dach als Ebenen-Zeile mit Einstellungen in der rechten Toolbar',
      'Türprofile enden auf der Sockeloberkante; Sockelhöhe in Paneel-Schritten',
      'Paneele an Öffnungen optional mit 45°-Gehrung (openingJoin)',
      'Unreal Bloom und Nebel unter Szene mit granularer Konfiguration und Persistenz',
    ],
  },
  {
    version: '0.1.5',
    date: '2026-08-21',
    title: 'Öffnungs-Vorlagen und Paneel-Farben',
    changes: [
      'Öffnungs-Vorlagen, 32-cm-Abstand, freie Farben und Paneel-Zufallsstufen',
      'Streifen ohne jede zweite Reihe; Uhrzeit-Animation ohne Kamerafahrt',
    ],
  },
  {
    version: '0.1.4',
    date: '2026-08-20',
    title: 'Gründerzeit und Selektion',
    changes: [
      'Gründerzeit-Gesimse, orange 3D-Selektion und abwechselnde Paneele',
      'Fensterverdachung mit Formen und Konsolen',
      'Multi-Building: mehrere Gebäude in einem Projekt',
    ],
  },
  {
    version: '0.1.3',
    date: '2026-08-19',
    title: 'Dachziegel und Zeichnungsmodus',
    changes: [
      'Dachziegel mit Trapez und Profil (Barrel/Pantile)',
      'Zeichnungsmodus schwarz/weiß für Fassade und Grundriss',
      'Szene-Farben statt Bloom/Gobos in der Sidebar',
    ],
  },
  {
    version: '0.1.2',
    date: '2026-08-18',
    title: 'Dach und Schatten',
    changes: [
      'Berliner Mansarddach mit Traufe und Dachrinne',
      'Gebäude-Drehung (siteYawDeg) und Tagesverlauf-Animation',
      'Grundriss-Schatten Ein-Pass für Decken und Boden',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-08-18',
    title: 'Grundriss und Studio-Wände',
    changes: [
      'Grundriss zeichnen mit Ring-Erkennung und Etagen',
      'Prozedurale Paneele: Streifen, Läuferverband, Gehrung an Ecken',
      'Edit-Scope Element/Etage/Fassade für Wände und Öffnungen',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-18',
    title: 'Erste öffentliche Version',
    changes: [
      '3D- und 2D-Fassadenansicht mit Wandmodulen und Öffnungen',
      'Klassische Fenster- und Türprofile, Fensterbänke, Sockel',
      'Persistenz per JSON und URL-Hash',
    ],
  },
]

export function githubReleaseUrl(tag: string): string {
  return `${GITHUB_REPO}/releases/tag/${tag}`
}

export function formatReleaseDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
