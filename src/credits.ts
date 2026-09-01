/**
 * Transparente Quellenliste — nur das, was die App wirklich nutzt.
 * Fremden Anwendungscode kopieren wir nicht; Bibliotheken werden importiert.
 */

export interface CreditEntry {
  name: string
  license: string
  usedAs: string
  thanks: string
  url?: string
}

/** Bibliotheken und Schriften, die wir einbinden (Import / Font-Datei), nicht nachbauen. */
export const LIBRARY_CREDITS: CreditEntry[] = [
  {
    name: 'Three.js',
    license: 'MIT',
    usedAs:
      '3D-Engine. Import aus dem npm-Paket `three`: Szene, Kamera, Lichter, Schatten, Materialien, Geometrie. Kein kopierter Engine-Quelltext im Projekt.',
    thanks: 'Danke an die three.js-Autorinnen und -Autoren (Copyright © 2010–2026).',
    url: 'https://threejs.org/',
  },
  {
    name: 'Three.js-Addons (Import, kein kopierter Quelltext)',
    license: 'MIT (Teil von three.js)',
    usedAs:
      'OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, SMAAPass (Fallback ohne MSAA), OutputPass, CubeCamera/PMREM, LineMaterial/LineSegments2, FontLoader, TextGeometry, GLTFLoader, BufferGeometryUtils. CubeCamera vor dem Baukörper als Material-EnvMap für Glas (Nachbarflügel, Boden, Himmel) — das ist kein Foto-HDRI.',
    thanks: 'Danke für die mitgelieferten Addons; wir importieren sie aus dem Paket, statt Dateien zu kopieren.',
    url: 'https://github.com/mrdoob/three.js',
  },
  {
    name: '@takram/three-atmosphere',
    license: 'MIT',
    usedAs:
      'Physikalischer Himmel und Sonnenlicht (Eric Bruneton, Precomputed Atmospheric Scattering): SkyMaterial, Sterne (Yale Bright Star Catalog), SunDirectionalLight, SkyLightProbe. Precomputed Textures und stars.bin werden zur Laufzeit von der Takram-CDN geladen.',
    thanks: 'Danke an Shota Matsuda / takram design engineering und Eric Bruneton für das Streuungsmodell.',
    url: 'https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/atmosphere',
  },
  {
    name: 'postprocessing',
    license: 'Zlib',
    usedAs:
      'Peer-Dependency von @takram/three-atmosphere (für optionale Atmosphären-Post-Processing-Effekte; aktuell nicht im Render-Pfad aktiv).',
    thanks: 'Danke an pmndrs für die Post-Processing-Bibliothek.',
    url: 'https://github.com/pmndrs/postprocessing',
  },
  {
    name: 'three-bvh-csg',
    license: 'MIT',
    usedAs:
      'Boolesche Mesh-Operationen (Sweep minus Öffnungsvolumen) für das dekorative Sockelprofil. Import aus dem npm-Paket, zusammen mit Peer `three-mesh-bvh`.',
    thanks: 'Danke an Garrett Johnson für three-bvh-csg und three-mesh-bvh.',
    url: 'https://github.com/gkjohnson/three-bvh-csg',
  },
  {
    name: 'Federo',
    license: 'SIL Open Font License 1.1',
    usedAs:
      'Standard-Fassaden-Schrift (`public/fonts/Federo-Regular.ttf` und `.typeface.json`). Umwandlung mit `scripts/ttf-to-typeface.mjs`.',
    thanks: 'Danke an Cyreal für die Schrift Federo.',
    url: 'https://fonts.google.com/specimen/Federo',
  },
  {
    name: 'Peter Wiegel — OFL-Schriften',
    license: 'SIL Open Font License 1.1',
    usedAs:
      'Fassaden-Schriften unter `public/fonts/peter-wiegel/`: Berliner Wand, Bombe CAT, CAT Neuzeit, CAT Reporter, DIN 1451 breit, Flottflott, Hardman, Mammut CAT, Mammut OT CAT, Osterbar, Phanta Du, Rumburak, Rundkursiv, Secession, Vorgang. Quellenordner, Copyright und Reserved Font Names: `public/fonts/peter-wiegel/QUELLEN.md`. OFL-Text: `public/fonts/licenses/OFL-1.1.txt`. Einige Schnitte stammen von CAT-Fonts (Peter Wiegel). Der Ordner `Email/` (Webfont von Berlin Email) ist nicht extra eingebunden.',
    thanks: 'Danke an Peter Wiegel (www.peter-wiegel.de) für die frei lizenzierten Schriften.',
    url: 'https://www.peter-wiegel.de',
  },
  {
    name: 'Peter Wiegel — Berlin Email, Waschküche',
    license: 'CC BY-NC-SA 3.0 DE (Namensnennung – Nicht kommerziell – Weitergabe unter gleichen Bedingungen)',
    usedAs:
      'Berlin Email (`BerlinEmailTT/Berlin Email.ttf`) sowie Waschküche und Waschküche grob (`WaschkuecheTT`). Nicht-kommerzielle Nutzung mit Namensnennung und ShareAlike. Die mitgelieferten `Creative Commons Lizenz.txt` sind Latin-1-kodiert; maßgeblich ist der Lizenztext bei Creative Commons.',
    thanks: 'Danke an Peter Wiegel für Berlin Email und Waschküche.',
    url: 'https://creativecommons.org/licenses/by-nc-sa/3.0/de/',
  },
  {
    name: 'Helvetiker (typeface.json)',
    license: 'Three.js-Beispiel-Font',
    usedAs: 'Nur Fallback, falls Federo nicht lädt. Datei: `public/fonts/helvetiker_regular.typeface.json`.',
    thanks: 'Danke an die three.js-Beispiele für den Fallback-Font.',
  },
  {
    name: 'opentype.js',
    license: 'MIT',
    usedAs: 'Nur im Build-Skript zur Schriftumwandlung, nicht in der laufenden App.',
    thanks: 'Danke an Frederik De Bleser und Mitwirkende.',
    url: 'https://github.com/opentypejs/opentype.js',
  },
  {
    name: 'Vite',
    license: 'MIT',
    usedAs: 'Entwicklungsserver und Production-Build. Kein Vite-UI-Code in der Fassaden-Logik.',
    thanks: 'Danke an das Vite-Projekt.',
    url: 'https://vite.dev/',
  },
  {
    name: 'TypeScript',
    license: 'Apache-2.0',
    usedAs: 'Typsprache beim Entwickeln und Compilieren. Kein TypeScript-Compiler in der ausgelieferten Seite.',
    thanks: 'Danke an Microsoft und die TypeScript-Mitwirkenden.',
    url: 'https://www.typescriptlang.org/',
  },
]

/** Öffentliche Verfahren, die wir selbst in TypeScript nachgebaut haben — kein fremder Datei-Dump. */
export const METHOD_CREDITS: CreditEntry[] = [
  {
    name: 'Sonnenstand (Berlin)',
    license: 'US-Behördenwerk / öffentlich beschrieben (NOAA-Näherung)',
    usedAs:
      'Eigene Implementierung in `src/utils/solar.ts` (Azimut/Elevation für die Vorschau). Kein kopiertes NOAA-Skript.',
    thanks: 'Danke an die NOAA für die öffentlich dokumentierten Sonnen-Gleichungen.',
  },
  {
    name: 'Sonnen-Schatten (Frustum)',
    license: 'Eigenes Verfahren; Shadow-Map über Three.js (MIT-Import)',
    usedAs:
      'Eigene Bodenprojektion der Gebäude-AABB entlang der Sonnenstrahlen plus Texel-Rasterung in `src/utils/sunLighting.ts`.',
    thanks: 'Danke an Three.js für die DirectionalLight-Shadow-Map-API (PCF).',
  },
]

export const CREDITS_INTRO =
  'Die Fassaden-Logik (Wände, Paneele, Öffnungen, Profile, UI) ist eigenes Projektcode. Unten steht, welche Bibliotheken und Schriften wir einbinden und wofür. 3D-Modelle unter `src/assets/` und `public/windows/` sind Projektdateien, geladen über den importierten GLTFLoader.'
