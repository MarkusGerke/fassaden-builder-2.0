import type { ArchFormId } from '../utils/archForms'
import { DEFAULT_WINDOW_DEPTH_OFFSET, WALL_DEPTH, WALL_HEIGHT } from '../constants/presets'
import { createDefaultFacadeState as createBlenderDefaultFacadeState } from '../blender/wallModules'
import type { FloorPlan } from '../studio/floorPlan'
import { createEmptyFloorPlan } from '../studio/floorPlan'
import type { CustomProfileDef } from '../profiles/custom'
import { createId } from '../utils/id'
import { migrateOpeningPanelFan } from '../utils/openingGeometry'
import type { DaySchedule } from '../utils/daySchedule'
import type { GroundLeaf } from '../scene/groundLeaves'
import type { SurfaceFinish } from '../utils/surfaceFinish'
export type { FloorPlan, DaySchedule, GroundLeaf, SurfaceFinish }

/**
 * Dachform auf dem obersten Grundriss-Ring.
 * `mansard` = Berliner Mansarde (Bestand, Ziegel möglich). Übrige Formen (v2.0.472):
 * Ebenen-Envelope über dem Traufpolygon, Eindeckung vorerst glatt.
 */
export type RoofKind = 'mansard' | 'gable' | 'hip' | 'halfHip' | 'shed'

/** Eindeckung: Ziegel-Geometrie (nur Mansarde) oder glatte Dachhaut. */
export type RoofCovering = 'tiles' | 'smooth'

/**
 * Traufkante: `auto` = ohne Paneele bündig (Bestand), `free` = Überstand + Rinne,
 * `flush` = bündig ohne Überstand/Rinne (Nachbardach / Brandwand).
 */
export type RoofEdgeMode = 'auto' | 'free' | 'flush'

/**
 * Zwerchgiebel (Quergiebel) auf einer Traufkante.
 * Sitzt auf der Fassaden-/Traufkante, schneidet in die Dachhaut, eigenes Satteldach nach innen.
 * Nicht zu verwechseln mit Gauben (auf der Schräge).
 */
export interface RoofCrossGable {
  /** Kante (`roofEdgeKey` am Plan-Outer). */
  edgeKey: string
  /** Breite entlang der Fassade (cm). */
  widthCm: number
  /** Tiefe nach innen vom Traufpolygon (cm). */
  depthCm: number
}

/**
 * Gaubenformen (Wikipedia „Formen von Dachgauben“, v2.0.479 realistisch):
 * - `gable` Giebelgaube (Sattel + Stirngiebel), `hip` Walmgaube mit Firstgrat,
 *   `hipNoRidge` Walmgaube ohne Firstgrat (Walmspitze liegt auf der Hauptdachhaut),
 * - `shedStraight` Schleppgaube, `shedSkew` schräge Schleppgaube, `shedTrapez` Trapezgaube
 *   (geneigte Wangen ≥ 15°), `pointed` Spitz-/Dreiecksgaube, `barrel` Tonnendach-/Rundgaube,
 * - `bat` Fledermausgaube, `turret` Dachreiter.
 * Alt: `shed` → `shedStraight` beim Normalize. Zwerchgiebel („Dachgiebel“) bleibt `crossGables`.
 */
export const ROOF_DORMER_KINDS = [
  'gable',
  'hip',
  'hipNoRidge',
  'shedStraight',
  'shedSkew',
  'shedTrapez',
  'pointed',
  'barrel',
  'bat',
  'turret',
] as const

export type RoofDormerKind = (typeof ROOF_DORMER_KINDS)[number]

export const ROOF_DORMER_LABELS: Record<RoofDormerKind, string> = {
  gable: 'Giebelgaube',
  hip: 'Walmdachgaube (mit Firstgrat)',
  hipNoRidge: 'Walmdachgaube (ohne Firstgrat)',
  shedStraight: 'Schleppgaube',
  shedSkew: 'Schleppgaube (schräg)',
  shedTrapez: 'Trapezgaube',
  pointed: 'Spitzgaube',
  barrel: 'Tonnendach-Giebelgaube',
  bat: 'Fledermausgaube',
  turret: 'Dachreiter',
}

export function isRoofDormerKind(value: unknown): value is RoofDormerKind {
  return typeof value === 'string' && (ROOF_DORMER_KINDS as readonly string[]).includes(value)
}

export function normalizeRoofDormerKind(raw: unknown): RoofDormerKind {
  if (raw === 'shed') return 'shedStraight'
  if (isRoofDormerKind(raw)) return raw
  return 'gable'
}

/** Formen mit senkrechten Wangen (Dreieck-/Trapezwange). */
export function roofDormerHasVerticalCheeks(kind: RoofDormerKind): boolean {
  return kind !== 'pointed' && kind !== 'shedTrapez' && kind !== 'bat'
}

/** Formen mit eigener Gaubendach-Neigung (Sattel/Walm: Seitenflächen, Schlepp/Trapez: Pult). */
export function roofDormerUsesPitch(kind: RoofDormerKind): boolean {
  return kind !== 'pointed' && kind !== 'barrel' && kind !== 'bat'
}

/** Formen, bei denen `depthCm` die Gaube wirklich begrenzt (sonst nur Kappe). */
export function roofDormerUsesDepth(kind: RoofDormerKind): boolean {
  return kind === 'bat' || kind === 'turret'
}

/** Dachfenster (flach in der Dachhaut). */
export interface RoofSkylight {
  id: string
  /** Welt-XZ Mittelpunkt. */
  x: number
  z: number
  /** Breite quer zum Gefälle (cm, waagerecht auf der Ebene). */
  widthCm: number
  /** Höhe hangaufwärts (cm). */
  heightCm: number
  /** Ausgeblendet: Mesh und Loch entfallen, Daten bleiben. */
  hidden?: boolean
}

/**
 * Gaube auf der Dachschräge (nicht Zwerchgiebel).
 *
 * Seit v2.0.479 realistische Konstruktion: Frontwand steht auf der Dachhaut, Wangen als
 * rechtwinklige Dreiecke bis zur Dachhaut, Gaubendach schneidet die Haupthaut in Kehlen
 * (Tiefe ergibt sich aus Höhe, Neigung und Hauptdachneigung). Fenster = normale `Opening`
 * (Gründerzeit-Fensterlogik), Koordinaten relativ zur Frontwand (links außen / Unterkante).
 */
export interface RoofDormer {
  id: string
  kind: RoofDormerKind
  /** Welt-XZ: Mitte der Frontwand-Außenkante auf der Dachhaut (v2.0.479; vorher Fußabdruck-Mitte). */
  x: number
  z: number
  /** Außenbreite Wange zu Wange, quer zum Gefälle (cm). */
  widthCm: number
  /**
   * Fledermaus: Auslauf hangaufwärts; Dachreiter: Tiefe. Sonst nur Kappe —
   * die Gaube endet vorher, wo ihr Dach auf die Haupthaut trifft (Rückwand nur bei Flachdach).
   */
  depthCm: number
  /**
   * Frontwandhöhe über der Dachhaut an der Front (cm). Spitzgaube: Spitzenhöhe;
   * Fledermaus: Scheitelhöhe der Welle.
   */
  heightCm: number
  /** Gaubendach-Neigung (°). Sattel/Walm: Seitenflächen; Schlepp/Trapez: Pult. Fehlt → Form-Default. */
  roofPitchDeg?: number
  /** Dachüberstand der Gaube vorn/seitlich (cm). Default 16. */
  overhangCm?: number
  /** Wandstärke Front/Wangen (cm). Default 20. */
  wallThicknessCm?: number
  /** Tonnendach: Bogenstich (cm). Fehlt → Breite/4 (Segmentbogen); = Breite/2 → Halbkreis. */
  riseCm?: number
  /** Trapezgaube: Wangenneigung gegen die Senkrechte (°). Default 20, min 15. */
  cheekTiltDeg?: number
  /**
   * Traufdurchbruch: Front steht auf der Außenwandlinie und reicht bis zur Traufhöhe
   * (Zwerchhaus-artig); Dachhaut, Stirn, Rinne und Füllwand sind im Gaubenbereich unterbrochen.
   */
  eaveBreak?: boolean
  /** Ausgeblendet: Mesh und Loch entfallen, Daten bleiben. */
  hidden?: boolean
  /** Fenster in der Front (normale Öffnung). `hidden: true` = kein Fenster. Fehlt → Default-Fenster. */
  window?: Opening
  /** Farbe Front/Wangen. Fehlt → `roof.gableColor`. */
  wallColor?: string
  /** Farbe Gaubendach. Fehlt → `roof.tileColor`. */
  roofColor?: string
  /** Farbe Blenden (Ortgang/Traufbrett, Fensterbank-Blech). Fehlt → `roof.gutterColor`. */
  trimColor?: string
}

/** Dach auf dem obersten Grundriss-Ring (Mansarde, Sattel, Walm, Krüppelwalm, Pult). */
export interface RoofConfig {
  enabled: boolean
  /** Dachform, Default `mansard`. */
  kind: RoofKind
  /** Neigung (Grad) für Sattel/Walm/Krüppelwalm/Pult. Mansarde nutzt `pitchLower`/`pitchUpper`. */
  pitch: number
  /**
   * Firstrichtung (Sattel/Krüppelwalm, Wand-Yaw-Konvention 0 = N–S, 90 = O–W, 45er-Raster)
   * bzw. Hochseite beim Pultdach (0…315). `null` = automatisch (längste Traufkante).
   */
  ridgeDeg: number | null
  /** Krüppelwalm: Höhe der Giebelwand über der Traufe bis zum Walmansatz (cm). */
  halfHipHeight: number
  /** Eindeckung: `tiles` (nur Mansarde) oder `smooth`. */
  covering: RoofCovering
  /** Kanten-Modi je Traufkante (`roofEdgeKey`), fehlend = `auto`. */
  edgeModes?: Record<string, RoofEdgeMode>
  /** Farbe der Giebel-/Füllwände über der Traufe (Default Wandweiß). */
  gableColor?: string
  /** Zwerchgiebel (0…n); MVP-UI steuert den ersten Eintrag. */
  crossGables?: RoofCrossGable[]
  /** Dachfenster auf der Dachhaut. */
  skylights?: RoofSkylight[]
  /** Gauben auf der Dachschräge. */
  dormers?: RoofDormer[]
  /** Untere Mansarden-Neigung (Grad zur Horizontalen), steil. */
  pitchLower: number
  /** Obere Mansarden-Neigung (Grad), flacher. */
  pitchUpper: number
  /** Fallback-Traufüberstand (cm), wenn Kante/Kompass keinen Wert hat. */
  overhang: number
  /** Überstand je Traufkante (`roofEdgeKey`), überschreibt Kompass/Fallback. */
  edgeOverhangCm?: Record<string, number>
  /** Kurzweg Überstand N/O/S/W (cm) für alle Kanten dieser Außenseite. */
  overhangCompass?: Partial<Record<'N' | 'O' | 'S' | 'W', number>>
  /**
   * Sattel/Krüppelwalm: lotrechte Firsthöhe über Traufe (cm) — Hauptmaß statt Neigung.
   * Mansarde: ungenutzt (dort `ridgeHeight`).
   */
  ridgeRiseCm?: number
  /** Firsthöhe über Traufe (cm) — Mansarde. */
  ridgeHeight: number
  /** Ziegelfarbe. */
  tileColor: string
  /** Dachrinne an der Traufe (nur belegte Seiten). */
  gutter: boolean
  /** Farbe der Dachrinne (Titanzink-Default). */
  gutterColor?: string
  /** Ziegel-Sichtbreite (cm), 8-cm-Raster. */
  tileWidth: number
  /** Ziegel-Sichthöhe / Schichthöhe (cm). */
  tileHeight: number
  /** Fuge zwischen Ziegeln (cm). */
  tileJoint: number
  /** Verlegmuster wie bei Paneelen. */
  tilePattern: StudioPanelPattern
  /** Querschnitt: gewölbt (Barrel) oder geschwungen (Pantile). */
  tileProfile: RoofTileProfile
  /** Ziegeldicke / Vorstand (cm). */
  tileProjectDepth: number
  /** Vorder/Rück-Verhältnis der Trapezkappe (0…1). */
  tileTaper: number
  /** Trapezhöhe auf der Ziegelfront (cm). */
  tileTaperDepth: number
  /** Dach ausblenden. */
  hidden?: boolean
}

export type RoofTileProfile = 'barrel' | 'pantile'

/** Einbau des Fallrohrs: vor der Fassade oder in einer Wandnische. */
export type DownpipeMount = 'surface' | 'niche'

/** Unteres Ende: senkrecht in den Boden oder Auslaufschuh zum Gehweg. */
export type DownpipeFoot = 'ground' | 'shoe'

/**
 * Mehrgeschossiges Fallrohr (Gebäude-Fixture).
 * Optional gekoppelte Cutout-Nischen pro Etagenwand (`nicheOpeningIds`).
 */
export interface DownpipeFixture {
  id: string
  /** Ankerwand der vertikalen Kette (`findVerticalAlignedWalls`). */
  anchorWallId: string
  /** Position entlang der Wand (cm vom Start). */
  localX: number
  /** Außendurchmesser (cm). Default DN 80 = 8. */
  diameterCm: number
  mount: DownpipeMount
  /**
   * Aufsatz: Abstand Rohraußenkante → äußerste Paneelfläche (cm). Default 8.
   * Nur bei `mount: 'surface'` relevant.
   */
  surfaceGapCm?: number
  nicheWidthCm?: number
  nicheDepthCm?: number
  foot: DownpipeFoot
  color: string
  /**
   * Fassadenschmuck (Gesims/Zierband/Sockel) an der Rohr-/Nischenstelle unterbrechen,
   * Enden links/rechts bündig geschlossen. Default true.
   */
  breakDecor?: boolean
  /**
   * Gekoppelte Cutout-IDs pro Wand-ID:
   * Nische → `fill.niche`; Aufsatz + breakDecor → `fill.flush` (nur Schmuck).
   */
  nicheOpeningIds?: Record<string, string>
}

export interface WallDimensions {
  width: number
  height: number
  depth: number
}

/** Treffart an Profil-Ecken: Gehrung (Bilderrahmen) oder kantig/stumpf. */
export type ProfileCornerJoin = 'miter' | 'none'

/** Vordere Wandkante für das Gesims. */
export type CorniceEdge = 'top' | 'bottom'

/** Gesims entlang der vorderen Ober- oder Unterkante einer Wand. */
export interface WallCorniceConfig {
  enabled?: boolean
  /** Vordere Oberkante (Kranz) oder Unterkante (Sockel). */
  edge?: CorniceEdge
  /** Skalierung des SVG-Querschnitts (1 = Fensterprofil-Originalgröße). */
  scale?: number
  /** Querschnitt, standardmäßig das Fensterprofil. */
  profileId?: string
  /** Hex-Farbe des Gesimses. */
  color?: string
  /** Reflexion des Gesimses. Fehlt → Profil-Oberfläche der Wand. */
  finish?: SurfaceFinish
  /** Drehung des 2D-Querschnitts (Grad, 90°-Schritte). */
  rotationDeg?: number
  /** Spiegeln quer zur Kante (oben/unten). */
  flipOutward?: boolean
  /** Spiegeln senkrecht zur Wand (vorne/hinten). */
  flipForward?: boolean
  /** Vorstand senkrecht zur Wandfläche (cm). */
  offsetForward?: number
  /**
   * Querschnitt-Tiefe (Forward-Achse). Fehlt → wie `scale` (gleichmäßig).
   * Die UI „Tiefe (cm)“ schreibt diesen Faktor, nicht `offsetForward`.
   */
  sectionScaleForward?: number
}

/** Horizontales Zierband / Profil auf beliebiger Höhe (cm von unten). */
export interface WallTrimBand {
  id: string
  enabled?: boolean
  /** Höhe des Bandes über dem Wandfuß (cm, 8er-Raster). */
  yFromBottom: number
  profileId?: string
  /** Querschnitt-Höhe (outward-Achse). */
  scale?: number
  /** Querschnitt-Tiefe (forward-Achse). Fehlt → wie `scale`. */
  sectionScaleForward?: number
  color?: string
  rotationDeg?: number
  flipOutward?: boolean
  flipForward?: boolean
  offsetForward?: number
}

/** Flach (Textur) oder extrudiert (3D-Buchstaben). */
export type WallLabelDepth = 'flat' | 'extruded'

/** Beschriftung / Inschrift auf der Fassadenfläche. */
export interface WallLabelConfig {
  /** Stabil für Mehrfach-Schriften / Pick / Toolbar. */
  id?: string
  enabled?: boolean
  text?: string
  /** cm von links (Ankerpunkt je nach align). */
  x?: number
  /** cm von unten. */
  y?: number
  /** Buchstabenhöhe (cm, 8er-Raster). */
  heightCm?: number
  color?: string
  /** Reflexion der Schrift. Default stumpf. */
  finish?: SurfaceFinish
  depth?: WallLabelDepth
  /** Tiefe bei depth=extruded (cm). */
  extrudeCm?: number
  offsetForward?: number
  align?: 'left' | 'center' | 'right'
  /** Schriftart (`src/studio/labelFonts.ts`). Default Federo. */
  fontId?: string
}

/** Verschiebung/Drehung des Fensterprofil-Sweeps relativ zur Öffnung. */
export interface OpeningTrimConfig {
  /** Verschiebung entlang der Wand (cm). */
  offsetX?: number
  /** Verschiebung in der Höhe (cm). */
  offsetY?: number
  /** Vorstand senkrecht zur Wandfläche (cm). */
  offsetForward?: number
  /** Drehung des 2D-Querschnitts (Grad, 90°-Schritte). */
  rotationDeg?: number
  /** Spiegeln quer zur Öffnung (innen/außen). */
  flipOutward?: boolean
  /** Spiegeln senkrecht zur Wand (vorne/hinten). */
  flipForward?: boolean
  /** Hex-Farbe des Fensterprofils. */
  color?: string
  /** Reflexion des Fensterprofils. Fehlt → Profil-Oberfläche der Wand. */
  finish?: SurfaceFinish
  cornerJoin?: ProfileCornerJoin
  /** Skalierung des Querschnitts (1 = Originalgröße). */
  scale?: number
  /**
   * Höhe/Länge des Querschnitts in cm (Achse quer zur Kante / Outward).
   * Steuert die Verdachungs-Anhebung am Sturz und die Querschnitt-Skalierung.
   */
  extentOutCm?: number
  /** Tiefe des Querschnitts in cm (senkrecht zur Wand / Forward). */
  extentForwardCm?: number
}

/** Eingebetteter Blendrahmen (Gegenteil Profil-Vorstand). */
export interface OpeningRevealFrame {
  enabled: boolean
  /** cm Einbettung in die Wand, allseitig; Default 8. */
  embedCm?: number
  /** cm Versatz der Fensterfront nach innen; Default 4. */
  insetCm?: number
}

/**
 * Optionaler Streifen rund um die Öffnung.
 * Mit Paneelen/Mauerwerk: Ausschnitt im Raster. Ohne Paneele: Rahmen auf der Wand.
 * Das Mauerloch bleibt unverändert.
 * - `finish: 'empty'` (Default): Band ohne Paneele — Rahmen bzw. Wand sichtbar.
 * - `finish: 'taper'`: Im Band radiale/konische Fugen zum Bogenmittelpunkt (nur mit Paneelen).
 */
export interface OpeningPanelClearance {
  enabled: boolean
  /** Allseitiger Abstand (cm). Default 8. */
  cm?: number
  /**
   * Vorstand vor der Wandaußenkante (positiv) bzw. Vertiefung in die Wand (negativ), cm.
   * 0 = Wandfläche. Fehlt → Paneel-Vorstand (`projectDepth`) bzw. 4 cm.
   */
  depthCm?: number
  /** Bandfüllung. Default `empty`. */
  finish?: 'empty' | 'taper'
}

/**
 * Äußere Laibungshälfte mit Paneelen/Mauerwerk verkleiden (Return um die Öffnungskante).
 * Glatte Außen-Laibung entfällt bis zur Fensterfront; Innenhälfte bleibt Putz.
 * Default aus. Nur wirksam mit sichtbaren Paneelen.
 */
export interface OpeningPanelWrappedReveal {
  enabled: boolean
}

/**
 * Füllmodus der Öffnung:
 * - `opening` = normales Fenster/Tür mit Glas
 * - `flush` = bündige Wandfläche (kein Loch)
 * - `niche` = Nische ohne Glas
 */
export type OpeningFillMode = 'opening' | 'flush' | 'niche'

export interface OpeningFill {
  mode: OpeningFillMode
  /** Nur bei `niche`: Tiefe der Vertiefung (cm). Default 10. */
  nicheDepthCm?: number
}

/**
 * Rundbogen der Wandöffnung (Mauerwerk, Leibung, dekorative Öffnungsprofile).
 * Unabhängig vom Fenster-/Tür-Element (`Opening.glazingArch`).
 *
 * Keilstein-Ring (`voussoirs`): konzentrischer Extrados, strikt radiale Fugen.
 * `keystoneCount` / `ringThicknessCm` fehlen → Auto aus Paneelbreite/-höhe.
 */
export type OpeningArchSpandrel = 'bond' | 'rect'

export interface OpeningArch {
  enabled: boolean
  /**
   * Bogenform der Wandöffnung. Default nach Normalize: `rect`.
   * `enabled` bleibt ableitbar: `form !== 'rect'` (Back-Compat).
   * Legacy `basket` (Korbbogen) → `ellipse` in `normalizeArchFormId`.
   */
  form?: ArchFormId
  /**
   * Stichmaß / Bogenhöhe vom Kämpfer zum Scheitel (cm, 8er-Raster).
   * Fehlt → Form-Standard (`defaultArchRise`). Geklemmt an Öffnungshöhe.
   */
  riseCm?: number
  /**
   * Legacy-Alias für dekorative Box-Keilsteine (v0.7.x).
   * Neu: `voussoirs` steuert den echten Keilstein-Ring im Mauerwerk/Paneel.
   */
  keystones?: boolean
  /** Keilstein-Ring (Voussoirs) mit radialen Fugen. Default aus. */
  voussoirs?: boolean
  /**
   * Anzahl Keilsteine (ungerade empfohlen, 5–21).
   * Fehlt → Auto aus Bogenlänge / Paneelbreite.
   */
  keystoneCount?: number
  /**
   * Bogenstärke Extrados − Intrados (cm).
   * Fehlt → Auto `max(8, panelHeight)`.
   */
  ringThicknessCm?: number
  /** Startwinkel in Grad (0 = rechts, 90 = oben, 180 = links). Default 180. */
  thetaStartDeg?: number
  /** Endwinkel in Grad. Default 0. */
  thetaEndDeg?: number
  /**
   * Übermauerung oberhalb des Extrados:
   * `bond` = Wandraster läuft bis an den Extrados und wird dort maskiert (Default),
   * `rect` = rechteckige Spandrel-Kappe über dem Scheitel.
   */
  spandrel?: OpeningArchSpandrel
  /**
   * Schenkel des Keilstein-Rings: gleiche Ringstärke links/rechts der Laibung
   * von der Sohlbank bis zur Kämpferlinie. Der Halbkreis bleibt.
   */
  jambs?: boolean
  /**
   * Anzahl Steine je Schenkel (1–21), gleiche Höhe von Sohlbank bis Kämpfer.
   * Fehlt → Auto aus lichter Höhe / Paneelhöhe.
   */
  jambCount?: number
}

export type OpeningCutoutShape = 'rect' | 'round'

export interface Opening {
  id: string
  /**
   * `window` / `door` = Öffnung mit Rahmen/Glas.
   * `cutout` = eckige/runde Nische oder Durchbruch ohne Fenster-Chrome.
   * `conch` = Konche: halbkreisförmige Maske, Kalotte (Viertelkugel) als Rückwand.
   */
  type: 'door' | 'window' | 'cutout' | 'conch'
  x: number
  y: number
  width: number
  height: number
  /**
   * Breaking-Migration: Element braucht manuelle Prüfung (Statuszeile / Dialog).
   * Freitext-Code oder Kurzhinweis; UI zeigt Controls trotzdem.
   */
  needsReview?: string
  /**
   * Nur `type === 'cutout'`: eckige oder runde/stadiumförmige Mauerwerk-Maske.
   * Default `rect`.
   */
  cutoutShape?: OpeningCutoutShape
  /** Blender-Fenstermodell, z. B. „3-96x192“. */
  windowModel?: string
  /**
   * Zusätzliche Tiefe relativ zur Standard-Laibung (+ nach außen, − nach innen).
   * Fehlt das Feld, gilt `Building.windowDepthOffset`.
   */
  depthOffset?: number
  /** Eingebetteter Blendrahmen (Loch größer, Glas weiter innen). */
  revealFrame?: OpeningRevealFrame
  /** Freiraum ohne Paneele/Ziegel rund um die Öffnung (Wand bleibt stehen). */
  panelClearance?: OpeningPanelClearance
  /**
   * Äußere Laibung mit Paneelen verkleiden (um die Ecke in die Öffnung).
   * Default aus — Hydrate setzt `{ enabled: false }`.
   */
  panelWrappedReveal?: OpeningPanelWrappedReveal
  /** Wandfläche / Nische statt durchgehender Öffnung. */
  fill?: OpeningFill
  /** Rundbogen der Wandöffnung + optionale Keilsteine. Dekorative Profile folgen automatisch. */
  arch?: OpeningArch
  /**
   * Radiale Rustika-Lagen am Bogen (Experiment). Default aus — v2.0.78 Auto war unbrauchbar.
   * Siehe `archRustication.ts` / docs/facade-layers.md.
   */
  archRustication?: { enabled?: boolean }
  /**
   * Legacy-Feld. Wird ignoriert — Blendrahmen/Flügel/Glas folgen immer `Opening.arch.form`.
   * Bleibt nur für Alt-Saves erhalten; beim Speichern nicht mehr setzen.
   */
  glazingArch?: boolean
  /** Hex-Farbe für Fenster-/Türrahmen in 2D/3D. */
  frameColor?: string
  /** Reflexion des Rahmens. Default stumpf. */
  frameFinish?: SurfaceFinish
  /**
   * Farbe der äußeren Laibungshälfte. Fehlt → `wall.wallColor`.
   */
  revealExteriorColor?: string
  /**
   * Farbe der inneren Laibungshälfte. Fehlt → `wall.interiorColor`.
   */
  revealInteriorColor?: string
  /** Hex-Farbe für Fensterglas in 2D/3D. */
  glassColor?: string
  /** `tint` = Farbe/Transparenz wie bisher; `physical` = IOR/Transmission/Roughness. */
  glassMode?: 'tint' | 'physical'
  /** Brechungsindex (physisches Glas). Default 1.5. */
  glassIor?: number
  /** Rauheit 0…1 (physisches Glas). */
  glassRoughness?: number
  /** Transmission 0…1 (physisches Glas). */
  glassTransmission?: number
  /** Scheibendicke in cm (physisches Glas). */
  glassThickness?: number
  /** Einstellungen für das Fensterprofil. */
  trim?: OpeningTrimConfig
  /** Berliner Gründerzeit-Teilung innerhalb der Öffnung. */
  gruenderzeit?: GruenderzeitWindowConfig
  /** Innere Fensterbank (ins Zimmer). */
  sillInner?: OpeningSillInner
  /** Äußere Fensterbank mit eigenem Profil. */
  sillOuter?: OpeningSillOuter
  /** Verdachung über dem Sturz (Fenster/Tür). */
  pediment?: OpeningPediment
  /**
   * Optionales separates Trapez-/Verdachungsfeld über der Öffnung
   * (`CladdingZoneKind: 'taperedField'`). Nicht die radialen Rustika-Lagen am Bogen
   * (v2.0.78) — Default aus; UI unter Verdachung.
   */
  taperedField?: OpeningTaperedField
  /** Eingangstreppe vor der Tür. */
  stairs?: OpeningStairs
  /** Rollläden (nur Lamellen) vor Fenster/Tür. */
  rollerShutter?: OpeningRollerShutter
  /** Markise über der Öffnung (Gelenkarm / Fallarm). */
  awning?: AwningConfig
  /** Fenstergitter (Default aus; Kellerfenster-Preset setzt enabled). */
  basementWindow?: BasementWindowConfig
  /**
   * Öffnen-/Schließen-Kurve (Zeit 0…1 → Anteil am Zielwinkel).
   * Wirkt nur bei Abspielen, nicht auf den Ruhe-Öffnungswinkel der Flügel.
   */
  motion?: OpeningMotion
  /** Uhrzeiten: on = öffnen, off = schließen. */
  schedule?: DaySchedule
  /** Stabgitter / französischer Balkon vor der Öffnung. */
  guard?: OpeningGuard
  /** Tür-Details (nur `type === 'door'`). */
  door?: OpeningDoorConfig
  /** Vorhang oder Innenjalousie. */
  interiorShade?: OpeningInteriorShade
  /** Öffnung ausblenden. */
  hidden?: boolean
}

export type MotionEase = 'linear' | 'smooth'

/** Punkt auf der Bewegungskurve. `ease` gilt für das Segment bis zum nächsten Punkt. */
export interface MotionKeyframe {
  /** Zeitanteil 0…1. */
  t: number
  /** Winkelanteil am Ziel (1 = voll offen). Darf leicht über 1 / unter 0 (Überdrehen). */
  v: number
  ease?: MotionEase
}

export interface MotionCurve {
  durationMs: number
  /** Pause am Kurvenende, bevor ein Zyklus schließt (ms). */
  holdMs?: number
  keys: MotionKeyframe[]
}

export interface OpeningMotion {
  /** Zielwinkel in Grad, falls Flügel aktuell auf 0° stehen. */
  maxDeg: number
  open: MotionCurve
  close: MotionCurve
}

export type PedimentForm =
  | 'straight'
  | 'triangle'
  | 'segment'
  | 'triangleClosed'
  | 'segmentClosed'
  | 'round'
  | 'pointed'
  | 'segmental'
  | 'lancet'
  | 'ellipse'
  | 'tudor'

export interface OpeningPedimentConsoles {
  enabled: boolean
  /** Querschnitt, Default `traufgesims70x150`. */
  profileId?: string
  /** Breite je Konsole entlang der Wand (cm, 8er-Raster). Default 16. */
  width?: number
  /** Tiefe nach außen (cm, 8er-Raster). Default 8. */
  depth?: number
  /** Höhe nach unten ab Sturz (cm, 8er-Raster). Default 64. */
  height?: number
  /** Versatz entlang der Wandfläche nach unten (cm, 8er-Raster). Default 0. */
  wallOffset?: number
}

/** Verdachung über dem Fenstersturz — unabhängig vom umlaufenden Fensterprofil. */
export interface OpeningPediment {
  enabled: boolean
  form: PedimentForm
  /** Querschnitt, Default `fensterprofil40x140`. */
  profileId: string
  /** Symmetrischer Überstand links und rechts (cm, 8er-Raster). */
  overhang?: number
  /** @deprecated Bevorzugt `overhang`. */
  overhangLeft?: number
  /** @deprecated Bevorzugt `overhang`. */
  overhangRight?: number
  /** Firsthöhe bei Dreieck/Segment (cm, 8er-Raster). */
  gableHeight?: number
  /** Giebelbreite (cm); 0 = Öffnung + 2× Überstand (geschlossen) bzw. Spannweite minus Horizontalen. */
  gableWidth?: number
  /** Horizontale Seitenlinien links/rechts (cm), nur offene Formen. */
  sideArmWidth?: number
  /**
   * Geschlossene Formen: Tympanon rückseitig verschließen (Mauerwerk scheint nicht durch).
   * Default aus.
   */
  sealedBack?: boolean
  scale?: number
  /** Höhe/Länge des Querschnitts in cm (Outward). Überschreibt `scale` wenn gesetzt. */
  extentOutCm?: number
  /** Tiefe des Querschnitts in cm (Forward). */
  extentForwardCm?: number
  color?: string
  /** Reflexion der Verdachung. Fehlt → Profil-Oberfläche der Wand. */
  finish?: SurfaceFinish
  /**
   * Extra-Versatz nach oben (cm), zusätzlich zur automatischen Anhebung
   * über ein Sturzprofil. Negativ = nach unten Richtung Öffnung. Default 0.
   */
  offsetUp?: number
  /** Versatz senkrecht zur Wand (cm, Tiefe). Default 0. */
  offsetForward?: number
  consoles?: OpeningPedimentConsoles
}

/**
 * Konisches Quader-/Bossenfeld über der Öffnung (Verdachungsfeld).
 * Nicht zu verwechseln mit `panelClearance.finish: 'taper'` (radialer Freiraum-Fächer)
 * oder Keilstein-Ring / Hybrid-Voussoir.
 */
export interface OpeningTaperedField {
  enabled: boolean
  /** Anzahl horizontaler Lagen. Default 3. */
  courses?: number
  /** Seitlicher Überstand an der breiten Kante (cm, 8er-Raster). Default 8. */
  overhangCm?: number
  /**
   * Verhältnis schmale / breite Kante. Default 0.55.
   * Ohne `invert`: obere Breite = untere × Ratio (nach oben verjüngend).
   */
  topWidthRatio?: number
  /**
   * `false` (Default): unten breit (Öffnung + Überstand), nach oben schmaler.
   * `true`: nach unten verjüngend (unten schmal, oben breit mit Überstand).
   */
  invert?: boolean
  /** Abstand über Sturz / Scheitel / Extrados (cm, 8er-Raster). Default 0. */
  offsetUpCm?: number
  /** Schichthöhe (cm); fehlt → `wall.panel.panelHeight`. */
  courseHeightCm?: number
}

export interface OpeningStairs {
  enabled: boolean
  /** Anzahl der Stufen. */
  count: number
  /** Steigung je Stufe (cm, 8er-Raster). */
  rise: number
  /** Auftritt / Tiefe je Stufe (cm, 8er-Raster). */
  tread: number
  /** Breite der obersten Stufe (cm, 8er-Raster), mindestens Türbreite. */
  width: number
  /** Extra links der Tür (cm, 8er-Raster) — kann über die Wandkante hinaus. */
  extendLeft: number
  /** Extra rechts der Tür (cm, 8er-Raster). */
  extendRight: number
  /**
   * Aufweitung je tieferer Stufe nach links (cm, 8er-Raster).
   * 0 = geradlinig, >0 = Flucht nach links außen.
   */
  splayLeft: number
  /** Aufweitung je tieferer Stufe nach rechts. */
  splayRight: number
  /**
   * Tiefe der obersten Ebene / Podest (cm, 8er-Raster).
   * Unabhängig vom Auftritt der Stufen darunter; hinten immer bis Tür/Innenwand.
   * Fehlt in Altprojekten → folgt `tread`.
   */
  landingDepth?: number
  /** Hex-Farbe der Treppe. Fehlt → Wandfarbe. */
  color?: string
  /** Reflexion der Treppe. Fehlt → Wand-Oberfläche. */
  finish?: SurfaceFinish
}

/** Rollläden vor der Öffnung — nur die Lamellen (keine Kasten-Mechanik). */
export interface OpeningRollerShutter {
  enabled: boolean
  /**
   * Geschlossenheit 0…1: 0 = oben/offen, 1 = unten/geschlossen.
   * Steuert Ruhehöhe und Animation.
   */
  drop: number
  color?: string
  finish?: SurfaceFinish
  /** Lamellenhöhe in cm. */
  slatHeightCm?: number
  /** Spalt zwischen freihängenden Lamellen in cm. */
  gapCm?: number
  /**
   * Hochfahren (`raise`) und Runterfahren (`lower`).
   * Kurvenwert `v` = Fortschritt 0…1 der jeweiligen Aktion.
   */
  motion?: {
    raise: MotionCurve
    lower: MotionCurve
  }
  /** Uhrzeiten: on = hoch, off = runter. */
  schedule?: DaySchedule
}

/** Gelenkarm- oder Fallarm-Markise. */
export type AwningKind = 'foldingArm' | 'dropArm' | 'markisolette'

/**
 * Markise an Öffnung oder frei an der Wand.
 * `extension` 0 = eingerollt, 1 = voll ausgefahren.
 */
export interface AwningConfig {
  id: string
  enabled: boolean
  kind: AwningKind
  /** 0 = eingerollt, 1 = voll ausgefahren. */
  extension: number
  widthCm: number
  /** Ausladung bei extension = 1 (cm). Bei Markisolette: ausgestellter Teil. */
  projectionCm: number
  /**
   * Montage: Unterkante Kasten.
   * Wand: cm von Wandfuß. Öffnung: cm relativ zum Sturz (0 = am Sturz, + nach oben).
   */
  mountY?: number
  /** Wand: Anker links (cm). Öffnung: optionaler X-Versatz der Mitte. */
  mountX?: number
  /** Seitlicher Überstand über die Öffnung (cm). Default 16; Raster 4 cm (v2.0.435). */
  overhangCm?: number
  /**
   * Volant: senkrechter Stoff unter der Vorderkante (cm, 8er-Raster, 0…48).
   * Default 16.
   */
  frontOverhangCm?: number
  /** Tuchneigung unter der Horizontalen (Grad, 0…45). Default 15. */
  slopeDeg?: number
  /** Abstand der Arm-Befestigung von der Stoffaußenkante (cm). Wand-Markise. */
  armInsetCm?: number
  /**
   * Fallarm/Markisolette an Öffnung: Abstand der Wandhalterung
   * zur Öffnungskante bzw. zur Außenseite des Fensterprofils (cm, min. 8).
   */
  armClearanceCm?: number
  /** Fallarm/Markisolette: Wandgelenk unter dem Kasten (cm nach unten). */
  armMountYCm?: number
  /** Markisolette: Höhe des senkrechten Tuchanteils (cm). */
  verticalDropCm?: number
  fabricColor?: string
  frameColor?: string
  finish?: SurfaceFinish
  motion?: {
    extend: MotionCurve
    retract: MotionCurve
  }
  /** Uhrzeiten: on = ausfahren, off = einfahren. */
  schedule?: DaySchedule
  /**
   * Wand-Markise über eine oder mehrere Öffnungen derselben Wand.
   * Breite/Position folgen dem Span der Öffnungen + `overhangCm`.
   * Fehlt / leer = freie Wand-Markise mit manueller Breite.
   */
  openingIds?: string[]
}

export interface OpeningSillInner {
  enabled: boolean
  /** Symmetrischer Überstand links und rechts (cm, 8er-Raster). */
  overhang?: number
  /** Tiefe ins Innere (cm). */
  depth: number
  /** Stärke (cm). */
  thickness: number
  color?: string
  /** Reflexion der Innenbank. Fehlt → Profil-Oberfläche der Wand. */
  finish?: SurfaceFinish
  profileId?: string
  scale?: number
  /** Drehung des Profilquerschnitts (Grad, 90°-Schritte). */
  rotationDeg?: number
  /** Spiegeln quer zur Bank (oben/unten). */
  flipOutward?: boolean
  /** Spiegeln senkrecht zur Wand (vorne/hinten). */
  flipForward?: boolean
}

export interface OpeningSillOuter {
  enabled: boolean
  /** `board` = Quader ohne Profil-Sweep; `profile` = Profil an der Unterkante. */
  mode?: 'board' | 'profile'
  profileId?: string
  color?: string
  /** Reflexion der Außenbank. Fehlt → Profil-Oberfläche der Wand. */
  finish?: SurfaceFinish
  scale?: number
  flipForward?: boolean
  /** Drehung des Profilquerschnitts (Grad, 90°-Schritte). */
  rotationDeg?: number
  /** Spiegeln quer zur Bank (oben/unten). */
  flipOutward?: boolean
  cornerJoin?: ProfileCornerJoin
  /** @deprecated Absolute Gesamtbreite; bevorzugt overhangLeft/Right. */
  width?: number
  /** Symmetrischer Überstand links und rechts (cm, 8er-Raster). */
  overhang?: number
  /** @deprecated Bevorzugt `overhang`. */
  overhangLeft?: number
  /** @deprecated Bevorzugt `overhang`. */
  overhangRight?: number
  /** Tiefe nach außen ab Fassade (cm). */
  depth?: number
  /** Stärke / Höhe der Bank (cm). */
  thickness?: number
  /** Gefälle nach außen (Grad, positiv = vorne tiefer). */
  angleDeg?: number
}

export interface BasementWindowConfig {
  enabled: boolean
  /** Anteil der Öffnungshöhe mit Gitter im unteren Bereich. */
  grilleHeight?: number
}

export interface ViewOptions {
  /** Dach-/Obergeschoss-Decke in 3D. */
  showCeiling?: boolean
  /** Zwischendecken zwischen Etagen. */
  showIntermediateFloors?: boolean
  /** Editor-Kugeln aller Punktlichter (Bibliothek; Default an). */
  showLightMarkers?: boolean
}

/** Sprossen im Oberlicht: eine Scheibe, wie die Flügel geteilt, oder Kreuz. */
export type GruenderzeitTransomBars = 'none' | 'match' | 'cross'

export type GruenderzeitPresetId =
  | '1fl'
  | '2fl'
  | '2fl-ol'
  | 'ol'
  | 'balkon'
  | 'balkon-ol'

/** Stil eines Berliner Gründerzeit-Fensters (Kämpfer, Flügel, Sprossen). */

/** Optionale Overrides der festen Holzquerschnitte (cm); fehlt → `TIMBER`-Default. */
export interface GruenderzeitTimberOverrides {
  blend?: number
  sash?: number
  muntin?: number
  kaempfer?: number
  stulp?: number
}

/** Öffnungsart eines Flügels (Ruhepose + Animation). */
export type LeafOpenMode = 'turn' | 'tilt' | 'turnTilt'

/** Anzahl gleichmäßiger Primärteile je Achse (≥ 1, kein UI-Maximum). */
export type GruenderzeitSplitCount = number

/**
 * Verhältnis bei Zweiteilung (unten→oben bzw. links→rechts).
 * Nur relevant wenn Count === 2.
 */
export type GruenderzeitBinaryRatio = '1/1' | '1/2' | '1/3' | '1/4' | '1/5' | '1/6'

/** Brüstung : Glas (unten→oben) bei Türen. */
export type GruenderzeitPanelRatio = '1/1' | '1/2' | '1/3' | '1/4'

/** @deprecated Alte vertikale Teilung — migriert nach splitVCount/splitVRatio. */
export type GruenderzeitSplitV = '1' | '1/1' | '1/2' | '1/3'

/** Sprossen innerhalb eines Fensterteils. */
export interface GruenderzeitPaneMuntins {
  /** Senkrechte Sprossen (≥ 0 → Felder = v+1). */
  v: number
  /** Waagerechte Sprossen (≥ 0 → Felder = h+1). */
  h: number
}

/** @deprecated Altes einstufiges Höhenverhältnis. */
export type GruenderzeitSashSplitV = '1/1' | '1/2' | '1/3'

export interface GruenderzeitWindowConfig {
  /** Anzahl der Flügel unter dem Kämpfer (≥ 1). */
  casements: number
  /** Oberlicht über dem Kämpfer. */
  transom: boolean
  /** Anteil der lichten Höhe für das Oberlicht (0.16–0.4). */
  transomRatio: number
  /** Vertikale Primärteilung: Anzahl gleichmäßiger Zeilen (≥ 1). */
  splitVCount: GruenderzeitSplitCount
  /** Bei splitVCount === 2: Höhenverhältnis unten→oben. */
  splitVRatio: GruenderzeitBinaryRatio
  /** Horizontale Primärteilung: Anzahl gleichmäßiger Spalten (≥ 1). */
  splitHCount: GruenderzeitSplitCount
  /** Bei splitHCount === 2: Breitenverhältnis links→rechts. */
  splitHRatio: GruenderzeitBinaryRatio
  /** Oberlicht: vertikale Primärteilung (≥ 1). */
  transomSplitVCount: GruenderzeitSplitCount
  /** Bei transomSplitVCount === 2: Höhenverhältnis. */
  transomSplitVRatio: GruenderzeitBinaryRatio
  /** Oberlicht: horizontale Primärteilung (≥ 1). */
  transomSplitHCount: GruenderzeitSplitCount
  /** Bei transomSplitHCount === 2: Breitenverhältnis. */
  transomSplitHRatio: GruenderzeitBinaryRatio
  /**
   * Sprossen je Fensterteil (Länge = splitVCount × splitHCount).
   * Index row-major, unten→oben, links→rechts.
   */
  paneMuntins: GruenderzeitPaneMuntins[]
  /** @deprecated Abgeleitet aus splitVCount/splitHCount — nur Legacy. */
  sashBarsH: 0 | 1 | 2
  /** @deprecated Abgeleitet aus splitHCount — nur Legacy. */
  sashBarsV: 0 | 1
  /** @deprecated Migriert nach splitVCount/splitVRatio. */
  splitV?: GruenderzeitSplitV
  /** @deprecated Migriert nach splitHCount. */
  splitH?: 1 | 2 | 3
  /** @deprecated Migriert nach splitVCount/splitVRatio. */
  sashSplitV?: GruenderzeitSashSplitV
  /** @deprecated Migriert nach splitHCount / paneMuntins. */
  paneCols?: Array<1 | 2 | 3>
  /** @deprecated Migriert nach transomSplit* (none→1×1, cross→2×2, match→Flügel-Teilung). */
  transomBars: GruenderzeitTransomBars
  /** Balkontür / Tür: untere Holzfüllung statt Glas. */
  bottomPanel?: boolean
  /** Brüstung : Glas (unten→oben). */
  bottomPanelRatio?: GruenderzeitPanelRatio
  /** Kastenfenster: innerer und äußerer Flügel. */
  boxWindow?: boolean
  /** Öffnungswinkel der unteren Flügel, von links nach rechts (Grad). Außen bei Kasten. */
  leafOpenDeg?: number[]
  /** Öffnungswinkel der Oberlicht-Flügel. Außen bei Kasten. */
  transomOpenDeg?: number[]
  /** Holzmaße (cm); fehlende Keys → TIMBER-Defaults. */
  timber?: GruenderzeitTimberOverrides
  /** Profilierte Sprossen/Kämpfer (Fase). Default aus. */
  profiledBars?: boolean
  /**
   * Scharnierseite je Flügel (Länge = casements). Fehlt → Auto (links…, rechts äußerster).
   */
  leafHinges?: Array<'left' | 'right'>
  /** Öffnungsart je Flügel. Fehlt → alle `turn`. */
  leafOpenModes?: LeafOpenMode[]
  /** Sichtbare Beschläge (Olive + Bänder). Default aus (Altprojekte unverändert). */
  hardware?: boolean
  /** Kastenfenster: Farbe innere Flügelebene. Fehlt → `Opening.frameColor`. */
  innerFrameColor?: string
  /** Kasten: Öffnungswinkel innere untere Flügel. Fehlt → `leafOpenDeg`. */
  leafOpenDegInner?: number[]
  /** Kasten: Öffnungswinkel innere Oberlicht-Flügel. Fehlt → `transomOpenDeg`. */
  transomOpenDegInner?: number[]
}

/** Stabgitter vor der Öffnung oder französischer Balkon (niedrige Brüstung). */
export interface OpeningGuard {
  enabled: boolean
  mode: 'grille' | 'balcony'
  /** Stababstand (cm). Default 12. */
  barSpacingCm?: number
  /** Brüstungshöhe bei `balcony` (cm). Default 96. */
  heightCm?: number
  color?: string
  finish?: SurfaceFinish
}

/** Tür-spezifische Details (Kassette, Drücker, Briefschlitz). */
export interface OpeningDoorConfig {
  /** Anzahl Kassettenfelder in der Brüstung (1–4). Default 2. */
  cassetteCount?: 1 | 2 | 3 | 4
  /** Türdrücker anzeigen. Default true bei neuen Türen. */
  handle?: boolean
  /** Briefschlitz. Default false. */
  letterSlot?: boolean
  /**
   * Unteren Blendrahmen (Schwelle) zeichnen.
   * Default false (Haustür); true = Balkontür mit U-Rahmen unten zu.
   */
  bottomFrame?: boolean
}

/** Innenliegender Sichtschutz (Vorhang oder Jalousie). */
export interface OpeningInteriorShade {
  enabled: boolean
  mode: 'curtain' | 'blind'
  /** Geschlossenheit 0…1 (1 = voll zu). */
  drop: number
  color?: string
}

export type OpeningEdge = 'top' | 'right' | 'bottom' | 'left'
export type WallSide = 'left' | 'right' | 'top' | 'bottom'

export interface WallNeighbors {
  left?: string
  right?: string
  top?: string
  bottom?: string
}

export interface ProfileAssignment {
  openingId: string
  profileId: string
  edge: OpeningEdge
}

export interface OpeningRef {
  wallId: string
  openingId: string
}

/** Wählbarer Teil einer Öffnung für Toolbar-Fokus; Verschieben gilt immer für die Gruppe. */
export type OpeningPart =
  | 'group'
  | 'frame'
  | 'trim'
  | 'sillInner'
  | 'sillOuter'
  | 'pediment'
  | 'consoles'
  | 'stairs'
  | 'grille'
  | 'rollerShutter'
  | 'awning'

export type WallKind = 'module' | 'studio'

/** Wand-Ausrichtung in Grad (0–360, typisch 8°-Raster in den Einstellungen). */
export type StudioYawDeg = number

/** Mauerwerks- bzw. Paneelmuster auf der Studio-Wand. `none` = nackte Wand. */
export type StudioPanelPattern =
  | 'none'
  | 'strip'
  | 'runningBond'
  | 'headerBond'
  | 'englishBond'
  | 'englishCrossBond'
  | 'wildBond'
  | 'gothicBond'
  | 'markishBond'
  | 'dutchBond'
  | 'silesianBond'
  | 'flemishBond'
  | 'runningBondThird'
  | 'runningBondQuarter'
  | 'runningBondDiagonal'

/** UI-Gruppe: Paneele (Streifen/Läufer) vs. Mauerwerk (Verbände). */
export type StudioPanelKind = 'panel' | 'masonry'

/** Treffart an äußeren Ecken: keine Gehrung, Bilderrahmen-Gehrung oder Verband. */
export type StudioCornerJoin = 'none' | 'miter' | 'bond'

/** Bossen-Muster an freiem Wandende (linke/rechte Kante). */
export type EndBossPattern = 'off' | 'full' | 'half' | 'alternate'

/** Stoß Bossen-Endstein an Nachbarwand. */
export type EndBossJoin = 'flush' | 'miter'

/** Verkleidungs-Zone (Schicht B) — siehe docs/facade-layers.md. */
export type CladdingZoneKind =
  | 'bond'
  | 'strip'
  | 'boss'
  | 'voussoir'
  | 'taperedField'
  | 'none'

export type CladdingFrontKind = 'flat' | 'frustum' | 'profile'

export interface CladdingZoneRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Eine Verkleidungszone auf der Wandfläche.
 * Ohne `rect` = volle sichtbare Paneelfläche (wie `wall.panel`).
 */
export interface CladdingZone {
  id: string
  kind: CladdingZoneKind
  front: CladdingFrontKind
  rect?: CladdingZoneRect
  /** Optionale Overrides; fehlen → Wand-`panel`. */
  panel?: Partial<StudioPanelConfig>
}

export interface StudioPanelConfig {
  /** Läufer-Sichtlänge (cm), 8-cm-Raster. Binder sind die Hälfte. */
  panelWidth: number
  /** Schichthöhe (cm), 8-cm-Raster. */
  panelHeight: number
  joint: number
  pattern: StudioPanelPattern
  /** Abgeleitet aus `pattern`; optional persistiert. */
  kind?: StudioPanelKind
  cornerJoin: StudioCornerJoin
  projectDepth: number
  /** Verhältnis Vorderkante / Wandanschluss (z. B. 0.7 = vorn schmaler). */
  taper: number
  /**
   * Tiefe der Fuge (cm). Die Fuge reicht von der Vorderkante um jointDepth zurück.
   * Dahinter liegt der Stein ohne Fuge bündig an. Default ≈ 0.8 cm.
   */
  jointDepth?: number
  /**
   * Zusätzlicher Vorstand der Trapez-Vorderfläche (cm). Gibt an, wie weit die
   * Trapezspitze über die Stufenebene hinausragt. Default = 0.
   */
  taperDepth?: number
  /** false: nur der Wandkörper, keine Paneele. Default true. */
  enabled?: boolean
  /**
   * Nur bei Muster `strip`: abwechselnd erhabene und zurückgesetzte Streifen (Ebene 1 / Ebene 2).
   * Default false.
   */
  alternateFloors?: boolean
  /**
   * Ebene 2 (ungerade Reihen): Vorstand / Steintiefe (cm). Default 0 = kein Stein-Mesh.
   * Migration: altes `recessedDepth` wird beim Laden übernommen.
   */
  recessedProjectDepth?: number
  /** Ebene 2: Trapez-Vorstand (cm). Default 0. */
  recessedTaperDepth?: number
  /** Ebene 2: Trapez-Faktor (1 = eckig, 0 = spitz). Default 1. */
  recessedTaper?: number
  /** @deprecated Nur noch lesen — Migration zu `recessedProjectDepth`. */
  recessedDepth?: number
  /**
   * Zufallsfarben der Steine: Kontrast 0–100 % (Hell/Dunkel-Abweichung von claddingColor).
   */
  tileColorVariance?: number
  /**
   * Häufigkeit 0–100 % → 1…8 Farbstufen (0 = eine Farbe).
   */
  tileColorVariety?: number
  /** Mörtel-/Fugenfarbe. Fehlt → `#c8c0b8`. */
  jointColor?: string
  /** false oder Höhe 0: kein Sockel. Default true. */
  plinthEnabled?: boolean
  /** Sockelhöhe von unten (cm), Raster = panelHeight. 0 = kein Sockel. */
  plinthHeight?: number
  /** Sockeltiefe nach außen (cm), 8-cm-Raster — unabhängig vom SVG-Profil. */
  plinthDepth?: number
  /** Versatz der Sockelfront zur Paneelfläche (cm, + = vor dem Mauerwerk). */
  plinthOffsetForward?: number
  /**
   * Sockelprofil-Querschnitt. `sockelprofil` = SVG 19×196 (Sweep auf Sockelhöhe).
   * Alte IDs `sockelStandard` werden auf `sockelprofil` gemappt.
   */
  plinthProfileId?: string
  /** Skalierung des Sockelprofils (1 = Originalgröße). */
  plinthProfileScale?: number
  /** Farbe des Sockelprofils. */
  plinthProfileColor?: string
  /**
   * Farbe des Sockelkörpers (Mauerwerk). Fehlt → Wandfarbe.
   * Die sichtbare Sockelfarbe in der Toolbar setzt Körper und Profil gemeinsam.
   */
  plinthColor?: string
  /** Drehung des Sockelprofil-Querschnitts (90°-Schritte). */
  plinthProfileRotationDeg?: number
  plinthProfileFlipOutward?: boolean
  plinthProfileFlipForward?: boolean
  /** Paneele an Öffnungen: flush = Rechteckloch, miter = 45°-Gehrung. Default flush. */
  openingJoin?: 'flush' | 'miter'
  /** Bossen-Endstein links (Wandstart). Default off. */
  endBossStart?: EndBossPattern
  /** Bossen-Endstein rechts (Wandende). Default off. */
  endBossEnd?: EndBossPattern
  /** Stoß Start-Endstein an Nachbarwand. Default flush. */
  endBossStartJoin?: EndBossJoin
  /** Stoß End-Endstein an Nachbarwand. Default flush. */
  endBossEndJoin?: EndBossJoin
  /** Anzahl Paneel-Reihen von unten ohne Steine/Mörtel (0 = alle sichtbar). */
  hideRowsBottom?: number
  /** Anzahl Paneel-Reihen von oben ohne Steine/Mörtel (0 = alle sichtbar). */
  hideRowsTop?: number
}

export interface Wall extends WallDimensions {
  kind?: WallKind
  /** Ausrichtung der Wandkante im Grundriss (Grad, Y-Achse). */
  yawDeg?: StudioYawDeg
  /** Fußpunkt der Wandkante im Grundriss (cm). */
  originX?: number
  originZ?: number
  /**
   * true: Paneele auf lokaler z=0 (Außenseite), vorstehend nach −Z.
   * false: Paneele auf z=depth (Vorderseite), vorstehend nach +Z.
   */
  panelFlip?: boolean
  /** Gehrung innen am Start (cm entlang der Wand, Bilderrahmen). */
  miterStart?: number
  /** Gehrung innen am Ende (cm entlang der Wand, Bilderrahmen). */
  miterEnd?: number
  /**
   * Endstück-Konfiguration: 48-cm-Rücksprung an der linken oder rechten Außenseite.
   * Nur auf der Parent-Wand gesetzt; Schenkel verweisen via `endPieceParentId`.
   */
  endPiece?: {
    side: 'start' | 'end'
    hand?: 'left' | 'right'
    angleDeg: number
    armWallIds?: string[]
  }
  /** Parent-Wand-ID bei Endstück-Schenkeln. */
  endPieceParentId?: string
  /** 0 oder 1 — erster/zweiter Schenkel am Parent-Endstück. */
  endPieceArmIndex?: 0 | 1
  /** Erker-/Balkon-/Loggia-Gruppe: Parent-Wand mit Frontbreite. */
  bayWindow?: {
    frontWidthCm: number
    depthCm: number
    shape: 'rect' | 'angled45' | 'round'
    /** Default `bay` bei Alt-Saves ohne Feld. */
    kind?: 'bay' | 'balcony' | 'loggia'
    /** Kind-Wand-IDs (3 bei U-Form, mehr bei rundem Erker). */
    wallIds: string[]
    /** Erker nach unten verlängern (cm). Oberkante bleibt fix. Default 0. */
    dropCm?: number
  }
  /** Erker-Schenkel: Verweis auf Parent-Wand mit `bayWindow`. */
  bayParentId?: string
  /** side | front | return | arc | back (Hauswand bei Balkon/Loggia) */
  bayRole?: 'side' | 'front' | 'return' | 'arc' | 'back'
  /** Runder Erker: eine Wand mit Ellipsenbogen-Geometrie (Paneele/Profile folgen der Krümmung). */
  arcBay?: {
    frontWidthCm: number
    depthCm: number
    inward?: boolean
  }
  /**
   * Außenfassade (Default) vs. Innenwand ohne Paneele/Gesims/Außenoptik.
   * Innenwände: `planLinked: false`, gewählte `depth`, schlichter Wandkörper.
   */
  role?: 'exterior' | 'interior'
  panel?: StudioPanelConfig
  /**
   * Verkleidungszonen (Schicht B). Fehlt oder leer → Ableitung aus `panel`
   * (`claddingZonesForWall` in `facadeLayers.ts`). Siehe docs/facade-layers.md.
   */
  claddingZones?: CladdingZone[]
  id: string
  moduleName?: string
  x: number
  y: number
  openings: Opening[]
  profiles: ProfileAssignment[]
  neighbors: WallNeighbors
  /** @deprecated Blender-Modulname steht in moduleName */
  presetId?: string
  claddingId?: string
  /** Hex-Farbe der Wandfläche (außen / Mörtel). */
  wallColor?: string
  /** Hex-Farbe der Innenwand (Raumseite). Default Weiß. */
  interiorColor?: string
  /** Hex-Farbe der Paneele. */
  claddingColor?: string
  /** Hex-Farbe der Profile an dieser Wand. */
  profileColor?: string
  /** Reflexion der Wandfläche. Default stumpf. */
  wallFinish?: SurfaceFinish
  /** Reflexion der Paneele / Steine. Default stumpf. */
  claddingFinish?: SurfaceFinish
  /** Reflexion der Profile / Gesimse. Default stumpf. */
  profileFinish?: SurfaceFinish
  /** Gesims an der vorderen Ober- oder Unterkante. */
  cornice?: WallCorniceConfig
  /** Zusätzliche horizontale Zierbänder / Profile. */
  trimBands?: WallTrimBand[]
  /**
   * Fassadenbeschriftungen (Hausnummer, Inschrift, …). Mehrere pro Wand.
   * Legacy-Feld `label` wird beim Hydrate nach `labels` migriert.
   */
  labels?: WallLabelConfig[]
  /** @deprecated Nutze `labels[]`. Einzellabel für Altstände / Sync mit labels[0]. */
  label?: WallLabelConfig
  /** Frei platzierte Markisen an der Wand. */
  awnings?: AwningConfig[]
  /** Zugehöriges Gebäude. */
  buildingId?: string
  /** Persistente Editor-Gruppe (z. B. Erker oder Nutzer-Gruppe). */
  groupId?: string
  /**
   * Expliziter Geschoss-Index (0 = EG). Unabhängig von `y / wallHeight`,
   * damit Resize/Drop/ungleiche Höhen die Ebenenliste nicht durcheinanderbringen.
   */
  storeyIndex?: number
  /**
   * Teil des Grundriss-Graphen (Gehrung, gemeinsames Verschieben).
   * `false` = frei; fehlt das Feld, gilt die Wand als verknüpft (Bestandsprojekte).
   */
  planLinked?: boolean
  /** Breaking-Migration: Wand braucht manuelle Prüfung. */
  needsReview?: string
  /** Wand ausblenden. */
  hidden?: boolean
}

export interface WallGroup {
  id: string
  name: string
  memberWallIds: string[]
  hidden?: boolean
}

/** Ein Baukörper mit eigenen Etagen, Wänden und Dach. */
export interface Building {
  id: string
  name: string
  hidden?: boolean
  /**
   * Nur weiße Vollwände: keine Öffnungen, kein Mauerwerk/Profile/Dach/Decken.
   * Daten bleiben erhalten; nur die Darstellung.
   */
  bareWalls?: boolean
  /**
   * Sichtbarkeit von Fassadenschmuck (Paneele, Sockel, Gesims, …) — nur Darstellung.
   * Fehlt / true = sichtbar. Siehe `normalizeFacadeDecor`.
   */
  facadeDecor?: Partial<import('../studio/facadeDecor').FacadeDecorVisibility>
  floors: FloorPlan[]
  /** Jede Wand sollte `buildingId === building.id` haben. */
  walls: Wall[]
  groups?: WallGroup[]
  roof?: RoofConfig
  /** Fallrohre (über alle Etagen der Ankerwand-Kette). */
  downpipes?: DownpipeFixture[]
  wallHeight: number
  wallDepth: number
  windowDepthOffset?: number
}

export interface SceneLight {
  id: string
  label?: string
  x: number
  y: number
  z: number
  /** Hex-Farbe, z. B. #ffaa66 */
  color: string
  /** Leistung in Watt (LED, 1–150). Three.js-Intensität wird zur Laufzeit berechnet. */
  intensity: number
  enabled: boolean
  castShadow: boolean
  /** Farbtemperatur in Kelvin (2000–6500). Slider setzt `color` daraus; manuelle Farbe bleibt, bis die Temperatur erneut bewegt wird. */
  colorTemperature?: number
  /** Sichtbare Editor-Kugel (nur Darstellung, Licht bleibt aktiv). */
  showMarker?: boolean
  /** Radius der Editor-Kugel in cm (Default 40). */
  markerSizeCm?: number
  /** Three.js Reichweite in cm (0 = unbegrenzt). */
  distance?: number
  /** Three.js Abfall (Default 2). */
  decay?: number
  /** Voreinstellung (Laterne, Deckenlampe, …). */
  preset?: 'laterne' | 'deckenlampe' | 'stehlampe' | 'leselampe' | 'fassadenlampe' | 'blaulicht'
  /** Abstrahlung: omni (Punkt) oder Spot nach unten/oben. */
  beamMode?: 'omni' | 'down' | 'up' | 'upDown'
  /** Spot-Halbwinkel nach unten in Grad (10–90). */
  beamAngleDownDeg?: number
  /** Spot-Halbwinkel nach oben in Grad (10–90). */
  beamAngleUpDeg?: number
  /** Laufzeit-Animation (z. B. Blaulicht-Doppelblitz). */
  animation?: 'none' | 'blaulicht'
  /** Persistente Lichtgruppe im Ebenenbaum. */
  groupId?: string
  /** Einblenden-Dauer (ms) bei Auto-/Schedule-An. */
  fadeInMs?: number
  /** Ausblenden-Dauer (ms) bei Auto-/Schedule-Aus. */
  fadeOutMs?: number
  /** Uhrzeiten Ein/Aus (parallel zu „Lichter mit Sonne“). */
  schedule?: DaySchedule
}

/** Gruppe von Bibliotheks-Lichtern (Ebenenbaum). */
export interface SceneLightGroup {
  id: string
  name: string
  memberLightIds: string[]
}

export interface FacadeState {
  buildings: Building[]
  activeBuildingId: string
  /** Vom Nutzer gezeichnete Profilquerschnitte. */
  customProfiles?: CustomProfileDef[]
  /** Sichtbarkeit von Innenflächen in 3D (Decke pro Etage: FloorPlan.showCeiling). */
  viewOptions?: ViewOptions
  /**
   * Drehung des gesamten Baukörpers inkl. Boden in der 3D-Szene (CCW, Grad).
   * Wände und Grundriss bleiben lokal; nur die Site-Gruppe rotiert.
   */
  siteYawDeg?: number
  /** Frei platzierbare Punktlichter (Bibliothek → Licht). */
  sceneLights?: SceneLight[]
  /** Lichtgruppen für den Ebenenbaum. */
  sceneLightGroups?: SceneLightGroup[]
  /** Herbstlaub auf dem Boden (siteOffset-Lokal). */
  groundLeaves?: GroundLeaf[]
}

export interface EditorState {
  selectedWallIds: string[]
  selectedOpenings: OpeningRef[]
  selectedEdges: OpeningEdge[]
  /** Fokus auf einen Teil der Öffnung (Toolbar); Drag bleibt die ganze Gruppe. */
  selectedOpeningPart?: OpeningPart
  /** Fokus auf Wand-Teil (Gesims, Sockel, …); nur bei Wandwahl ohne Öffnung. */
  selectedWallPart?: 'group' | 'cornice' | 'plinth' | 'cladding' | 'label' | 'trimBand' | 'awning'
  /** Gewähltes Zierband (bei `selectedWallPart === 'trimBand'`). */
  selectedTrimBandId?: string
  /** Gewählte Fassaden-Schrift (bei `selectedWallPart === 'label'`). */
  selectedLabelId?: string
  /** Gewählte Wand-Markise (bei `selectedWallPart === 'awning'`). */
  selectedAwningId?: string
  /** Gewähltes Dach (Gebäude-ID); leert Wand/Öffnung bei Klick auf Dach-Zeile. */
  selectedRoofBuildingId?: string
  /** Fokus auf Dach-Teil (Toolbar). */
  selectedRoofPart?: 'group' | 'shell' | 'tiles' | 'gutter'
  /** Gewähltes Dachfenster oder Gaube auf dem Dach. */
  selectedRoofFixture?: { kind: 'skylight' | 'dormer'; id: string }
  /** Gewählte Decke (Etage). */
  selectedCeiling?: { buildingId: string; floorIndex: number }
  /** Haus-Gruppe für Verschieben im Grundriss. */
  selectedBuildingId?: string
  /** Gewähltes Bibliotheks-Punktlicht (Fokus / Toolbar). */
  selectedSceneLightId?: string
  /** Mehrfachauswahl von Lichtern (Ebenen: Shift+Klick, Gruppieren). */
  selectedSceneLightIds?: string[]
  /** Gewähltes Fallrohr (`buildingId` + `downpipeId`). */
  selectedDownpipe?: { buildingId: string; downpipeId: string }
}

export const DEFAULT_WALL_ID = 'wall-1'

export function emptyNeighbors(): WallNeighbors {
  return {}
}

export function createDefaultFacadeState(): FacadeState {
  const legacy = createBlenderDefaultFacadeState()
  const buildingId = createId()
  const building: Building = {
    id: buildingId,
    name: 'Haus 1',
    floors:
      legacy.floors && legacy.floors.length > 0
        ? legacy.floors.map((plan) => ({
            nodes: plan.nodes.map((node) => ({ ...node })),
            edges: plan.edges.map((edge) => ({ ...edge })),
          }))
        : [createEmptyFloorPlan()],
    walls: (legacy.walls ?? []).map((wall) => ({ ...cloneWall(wall), buildingId })),
    groups: [],
    wallHeight: legacy.wallHeight ?? WALL_HEIGHT,
    wallDepth: legacy.wallDepth ?? WALL_DEPTH,
    windowDepthOffset: DEFAULT_WINDOW_DEPTH_OFFSET,
  }
  return {
    buildings: [building],
    activeBuildingId: buildingId,
  }
}

export function cloneBuilding(building: Building): Building {
  return {
    ...building,
    floors: building.floors.map((plan) => ({
      nodes: plan.nodes.map((node) => ({ ...node })),
      edges: plan.edges.map((edge) => ({ ...edge })),
      showCeiling: plan.showCeiling,
      ceilingColor: plan.ceilingColor,
      hidden: plan.hidden,
    })),
    walls: building.walls.map(cloneWall),
    groups: building.groups?.map((group) => ({
      ...group,
      memberWallIds: [...group.memberWallIds],
    })) ?? [],
    roof: building.roof
      ? {
          ...building.roof,
          edgeModes: building.roof.edgeModes ? { ...building.roof.edgeModes } : undefined,
          crossGables: building.roof.crossGables?.map((c) => ({ ...c })),
          skylights: building.roof.skylights?.map((s) => ({ ...s })),
          dormers: building.roof.dormers?.map((d) => ({
            ...d,
            ...(d.window ? { window: cloneOpening(d.window) } : {}),
          })),
        }
      : undefined,
    downpipes: building.downpipes?.map((dp) => ({
      ...dp,
      nicheOpeningIds: dp.nicheOpeningIds ? { ...dp.nicheOpeningIds } : undefined,
    })),
  }
}

export function createDefaultEditorState(): EditorState {
  return {
    selectedWallIds: [],
    selectedOpenings: [],
    selectedEdges: [],
    selectedOpeningPart: undefined,
    selectedAwningId: undefined,
    selectedRoofBuildingId: undefined,
    selectedRoofPart: undefined,
    selectedRoofFixture: undefined,
    selectedCeiling: undefined,
    selectedBuildingId: undefined,
    selectedDownpipe: undefined,
  }
}

export function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    neighbors: { ...wall.neighbors },
    openings: wall.openings.map(cloneOpening),
    profiles: wall.profiles.map((profile) => ({ ...profile })),
    panel: wall.panel ? { ...wall.panel } : undefined,
    claddingZones: wall.claddingZones?.map((zone) => ({
      ...zone,
      rect: zone.rect ? { ...zone.rect } : undefined,
      panel: zone.panel ? { ...zone.panel } : undefined,
    })),
    cornice: wall.cornice ? { ...wall.cornice } : undefined,
    trimBands: wall.trimBands?.map((band) => ({ ...band })),
    labels: wall.labels?.map((item) => ({ ...item })),
    label: wall.label ? { ...wall.label } : undefined,
    awnings: wall.awnings?.map((item) => ({
      ...item,
      motion: item.motion
        ? {
            extend: {
              durationMs: item.motion.extend?.durationMs ?? 2200,
              holdMs: item.motion.extend?.holdMs,
              keys: (item.motion.extend?.keys ?? []).map((k) => ({ ...k })),
            },
            retract: {
              durationMs: item.motion.retract?.durationMs ?? 2000,
              holdMs: item.motion.retract?.holdMs,
              keys: (item.motion.retract?.keys ?? []).map((k) => ({ ...k })),
            },
          }
        : undefined,
      schedule: item.schedule
        ? {
            onTimes: [...(item.schedule.onTimes ?? [])],
            offTimes: [...(item.schedule.offTimes ?? [])],
          }
        : undefined,
    })),
  }
}

/** Tiefe Kopie einer Öffnung (Wand-Öffnungen und Gauben-Fenster). */
export function cloneOpening(opening: Opening): Opening {
      const migrated = migrateOpeningPanelFan(opening)
      return {
        ...migrated,
        trim: migrated.trim ? { ...migrated.trim } : undefined,
        gruenderzeit: migrated.gruenderzeit
          ? {
              ...migrated.gruenderzeit,
              leafOpenDeg: migrated.gruenderzeit.leafOpenDeg
                ? [...migrated.gruenderzeit.leafOpenDeg]
                : undefined,
              transomOpenDeg: migrated.gruenderzeit.transomOpenDeg
                ? [...migrated.gruenderzeit.transomOpenDeg]
                : undefined,
              leafOpenDegInner: migrated.gruenderzeit.leafOpenDegInner
                ? [...migrated.gruenderzeit.leafOpenDegInner]
                : undefined,
              transomOpenDegInner: migrated.gruenderzeit.transomOpenDegInner
                ? [...migrated.gruenderzeit.transomOpenDegInner]
                : undefined,
              leafHinges: migrated.gruenderzeit.leafHinges
                ? [...migrated.gruenderzeit.leafHinges]
                : undefined,
              leafOpenModes: migrated.gruenderzeit.leafOpenModes
                ? [...migrated.gruenderzeit.leafOpenModes]
                : undefined,
              timber: migrated.gruenderzeit.timber
                ? { ...migrated.gruenderzeit.timber }
                : undefined,
            }
          : undefined,
        sillInner: migrated.sillInner ? { ...migrated.sillInner } : undefined,
        sillOuter: migrated.sillOuter ? { ...migrated.sillOuter } : undefined,
        pediment: migrated.pediment
          ? {
              ...migrated.pediment,
              consoles: migrated.pediment.consoles
                ? { ...migrated.pediment.consoles }
                : undefined,
            }
          : undefined,
        taperedField: migrated.taperedField ? { ...migrated.taperedField } : undefined,
        archRustication: migrated.archRustication
          ? { enabled: Boolean(migrated.archRustication.enabled) }
          : undefined,
        stairs: migrated.stairs ? { ...migrated.stairs } : undefined,
        basementWindow: migrated.basementWindow ? { ...migrated.basementWindow } : undefined,
        guard: migrated.guard ? { ...migrated.guard } : undefined,
        door: migrated.door ? { ...migrated.door } : undefined,
        interiorShade: migrated.interiorShade ? { ...migrated.interiorShade } : undefined,
        awning: migrated.awning
          ? {
              ...migrated.awning,
              motion: migrated.awning.motion
                ? {
                    extend: {
                      durationMs: migrated.awning.motion.extend?.durationMs ?? 2200,
                      holdMs: migrated.awning.motion.extend?.holdMs,
                      keys: (migrated.awning.motion.extend?.keys ?? []).map((k) => ({ ...k })),
                    },
                    retract: {
                      durationMs: migrated.awning.motion.retract?.durationMs ?? 2000,
                      holdMs: migrated.awning.motion.retract?.holdMs,
                      keys: (migrated.awning.motion.retract?.keys ?? []).map((k) => ({ ...k })),
                    },
                  }
                : undefined,
              schedule: migrated.awning.schedule
                ? {
                    onTimes: [...(migrated.awning.schedule.onTimes ?? [])],
                    offTimes: [...(migrated.awning.schedule.offTimes ?? [])],
                  }
                : undefined,
            }
          : undefined,
        motion: migrated.motion
          ? {
              maxDeg: migrated.motion.maxDeg,
              open: {
                durationMs: migrated.motion.open?.durationMs ?? 1200,
                holdMs: migrated.motion.open?.holdMs,
                keys: (migrated.motion.open?.keys ?? []).map((k) => ({ ...k })),
              },
              close: {
                durationMs: migrated.motion.close?.durationMs ?? 1200,
                holdMs: migrated.motion.close?.holdMs,
                keys: (migrated.motion.close?.keys ?? []).map((k) => ({ ...k })),
              },
            }
          : undefined,
        revealFrame: migrated.revealFrame ? { ...migrated.revealFrame } : undefined,
        panelClearance: migrated.panelClearance ? { ...migrated.panelClearance } : undefined,
        fill: migrated.fill ? { ...migrated.fill } : undefined,
        arch: migrated.arch ? { ...migrated.arch } : undefined,
        glazingArch: migrated.glazingArch,
      }
}

export function cloneFacadeState(state: FacadeState): FacadeState {
  return {
    buildings: state.buildings.map(cloneBuilding),
    activeBuildingId: state.activeBuildingId,
    customProfiles: state.customProfiles?.map((profile) => ({
      ...profile,
      vertices: profile.vertices.map((vertex) => ({ ...vertex })),
    })),
    viewOptions: state.viewOptions ? { ...state.viewOptions } : undefined,
    siteYawDeg: state.siteYawDeg,
    sceneLights: state.sceneLights?.map((light) => ({ ...light })),
    sceneLightGroups: state.sceneLightGroups?.map((group) => ({
      ...group,
      memberLightIds: [...group.memberLightIds],
    })),
    groundLeaves: state.groundLeaves?.map((leaf) => ({ ...leaf })),
  }
}

export function oppositeSide(side: WallSide): WallSide {
  switch (side) {
    case 'left':
      return 'right'
    case 'right':
      return 'left'
    case 'top':
      return 'bottom'
    case 'bottom':
      return 'top'
  }
}
