import type {
  EndBossJoin,
  EndBossPattern,
  StudioCornerJoin,
  StudioPanelConfig,
  StudioPanelKind,
  StudioPanelPattern,
} from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'

/** Breite/Höhe der Wand, Öffnungen, Paneel-„1“. */
export const STUDIO_TILE = 32
/** Halbe Kachel („0,5“). */
export const STUDIO_HALF = 16
/** Feineres Mauerwerks-Raster (1 = 16, 0,5 = 8). */
export const STUDIO_MASONRY = 8
/** Grundriss-Knotenabstand. */
export const PLAN_GRID = 48

export const STUDIO_DEFAULT_WIDTH = 192
export const STUDIO_DEFAULT_HEIGHT = 448
/** Breiten-Schritt für Wand strecken/verkleinern (Greifer, Toolbar) — achsparallel. */
export const STUDIO_WALL_WIDTH_STEP = PLAN_GRID
/** Ein 45°-Schritt: Diagonale eines Rasterfeldes, damit Endpunkte auf dem 48-cm-Gitter bleiben. */
export const PLAN_DIAGONAL_STEP = PLAN_GRID * Math.SQRT2
/** Höhen-Schritt für Etagen-Höhe (Greifer, Toolbar). */
export const STUDIO_WALL_HEIGHT_STEP = 16
/** Boden-Raster beim Wand-Greifer = Breiten-Schritt (48 cm). */
export const WALL_RESIZE_FLOOR_STEP = PLAN_GRID
/** Mindest-Breite/Höhe einer Studio-Wand (cm). */
export const STUDIO_MIN_SIZE = PLAN_GRID
/** Abstand Kante-zu-Kante beim Duplizieren von Wänden/Öffnungen. */
export const DUPLICATE_GAP_CM = PLAN_GRID

/** 45°/135°/225°/315° — schräge Plan-Richtung. */
export function isDiagonalPlanYaw(yawDeg: number): boolean {
  const yaw = ((yawDeg % 360) + 360) % 360
  const snapped = Math.round(yaw / 45) * 45
  return Math.abs(snapped % 90) === 45
}

/** Ein Rasterschritt entlang der Wand: 48 cm achsparallel, \(48\sqrt{2}\) cm bei 45°. */
export function wallWidthStepCm(yawDeg: number): number {
  return isDiagonalPlanYaw(yawDeg) ? PLAN_DIAGONAL_STEP : PLAN_GRID
}

/** Wandlänge auf ganze Rasterschritte der Richtung (0 wenn kürzer als ein Schritt). */
export function snapWallWidthCm(widthCm: number, yawDeg: number): number {
  const step = wallWidthStepCm(yawDeg)
  const snapped = Math.round(widthCm / step) * step
  return snapped < step - 1e-6 ? 0 : snapped
}

/** Δ-Breite so, dass die neue Länge auf dem Richtungs-Raster liegt. */
export function snapWallWidthDelta(baseWidth: number, deltaCm: number, yawDeg: number): number {
  const step = wallWidthStepCm(yawDeg)
  const next = Math.round((baseWidth + deltaCm) / step) * step
  if (next < step - 1e-6) return 0
  const d = next - baseWidth
  return Math.abs(d) < 0.5 ? 0 : d
}

export const STUDIO_PANEL_STEP = STUDIO_MASONRY
export const STUDIO_PANEL_MIN = STUDIO_MASONRY
/** @deprecated Nur Soft-Max — kein hartes UI-/Clamp-Cap mehr. */
export const STUDIO_PANEL_MAX = 10_000

const PANEL_PATTERNS: StudioPanelPattern[] = [
  'none',
  'strip',
  'runningBond',
  'headerBond',
  'englishBond',
  'englishCrossBond',
  'wildBond',
  'gothicBond',
  'markishBond',
  'dutchBond',
  'silesianBond',
  'flemishBond',
  'runningBondThird',
  'runningBondQuarter',
  'runningBondDiagonal',
]

export const PANEL_KIND_PATTERNS: StudioPanelPattern[] = ['strip', 'runningBond']

export const MASONRY_KIND_PATTERNS: StudioPanelPattern[] = PANEL_PATTERNS.filter(
  (p) => p !== 'none' && !PANEL_KIND_PATTERNS.includes(p),
)

export function panelKindForPattern(pattern: StudioPanelPattern): StudioPanelKind {
  if (pattern === 'none') return 'panel'
  return PANEL_KIND_PATTERNS.includes(pattern) ? 'panel' : 'masonry'
}

export const PATTERN_LABELS: Record<StudioPanelPattern, string> = {
  none: 'Keine',
  strip: 'Streifen',
  runningBond: 'Läuferverband',
  headerBond: 'Kopfverband',
  englishBond: 'Blockverband',
  englishCrossBond: 'Kreuzverband',
  wildBond: 'Wilder Verband',
  gothicBond: 'Gotischer Verband',
  markishBond: 'Märkischer Verband',
  dutchBond: 'Holländischer Verband',
  silesianBond: 'Schlesischer Verband',
  flemishBond: 'Flämischer Verband',
  runningBondThird: 'Läuferverband (⅓ versetzt)',
  runningBondQuarter: 'Läuferverband (¼ versetzt, senkrecht)',
  runningBondDiagonal: 'Läuferverband (¼ versetzt, schräg)',
}

const CORNER_JOINS: StudioCornerJoin[] = ['none', 'miter', 'bond']

export const DEFAULT_STUDIO_PANEL: StudioPanelConfig = {
  panelWidth: 32,
  panelHeight: 32,
  joint: 0.8,
  pattern: 'strip',
  cornerJoin: 'miter',
  projectDepth: 4,
  taper: 1,
  jointDepth: 0.8,
  taperDepth: 0,
  enabled: true,
  alternateFloors: false,
  recessedProjectDepth: 0,
  recessedTaperDepth: 0,
  recessedTaper: 1,
  tileColorVariance: 0,
  tileColorVariety: 0,
  plinthEnabled: true,
  plinthHeight: 32,
  plinthDepth: 8,
  plinthOffsetForward: 0,
  plinthProfileId: 'sockelprofil',
  plinthProfileScale: 1,
  plinthProfileRotationDeg: 0,
  plinthProfileFlipOutward: false,
  plinthProfileFlipForward: false,
  hideRowsBottom: 0,
  hideRowsTop: 0,
}

export const PLINTH_OVERHANG = 0.6

/** Signatur für Edit-Scope „Typ“ (baugleiche Paneel-Konfiguration). */
export function panelConfigKey(panel?: StudioPanelConfig | null): string {
  const n = normalizeStudioPanel(panel)
  return JSON.stringify({
    panelWidth: n.panelWidth,
    panelHeight: n.panelHeight,
    joint: n.joint,
    pattern: n.pattern,
    cornerJoin: n.cornerJoin,
    projectDepth: n.projectDepth,
    taper: n.taper,
    jointDepth: n.jointDepth,
    taperDepth: n.taperDepth,
    enabled: n.enabled,
    alternateFloors: n.alternateFloors,
    recessedProjectDepth: n.recessedProjectDepth,
    recessedTaperDepth: n.recessedTaperDepth,
    recessedTaper: n.recessedTaper,
    plinthEnabled: n.plinthEnabled,
    plinthHeight: n.plinthHeight,
    plinthDepth: n.plinthDepth,
    plinthOffsetForward: n.plinthOffsetForward,
    plinthProfileId: n.plinthProfileId,
    plinthProfileScale: n.plinthProfileScale,
    plinthProfileColor: n.plinthProfileColor,
    plinthColor: n.plinthColor,
    plinthProfileRotationDeg: n.plinthProfileRotationDeg,
    plinthProfileFlipOutward: n.plinthProfileFlipOutward,
    plinthProfileFlipForward: n.plinthProfileFlipForward,
    openingJoin: n.openingJoin,
    hideRowsBottom: n.hideRowsBottom,
    hideRowsTop: n.hideRowsTop,
    tileColorVariance: n.tileColorVariance,
    tileColorVariety: n.tileColorVariety,
    jointColor: n.jointColor,
  })
}

export function wallsMatchByPanelConfig(
  a?: StudioPanelConfig | null,
  b?: StudioPanelConfig | null,
): boolean {
  return panelConfigKey(a) === panelConfigKey(b)
}

export const STUDIO_WALL_DEPTH = WALL_DEPTH

/** Softes oberes Raster — UI ohne hartes Maximum; nur für sinnvolle Snap-Grenzen. */
export const STUDIO_PANEL_SOFT_MAX = 10_000

export function clampStudioPanelSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_STUDIO_PANEL.panelWidth
  const snapped = Math.round(value / STUDIO_PANEL_STEP) * STUDIO_PANEL_STEP
  return Math.max(STUDIO_PANEL_MIN, Math.min(STUDIO_PANEL_SOFT_MAX, snapped))
}

/** Sockelhöhe in 8-cm-Schritten (Mauerwerksraster). 0 = kein Sockel. Kein hartes Maximum. */
export function clampPlinthHeight(value: number | undefined, maxHeight?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  const snapped = Math.round(value / STUDIO_MASONRY) * STUDIO_MASONRY
  const floor = Math.max(STUDIO_MASONRY, snapped)
  if (typeof maxHeight === 'number' && Number.isFinite(maxHeight) && maxHeight > 0) {
    return Math.min(Math.max(STUDIO_MASONRY, Math.round(maxHeight)), floor)
  }
  return floor
}

/** Sockeltiefe in 1-cm-Schritten. Kein hartes Maximum. */
export function clampPlinthDepth(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.max(1, Math.round(value))
}

/** Sockel-Versatz in 1-cm-Schritten. Kein hartes Maximum. */
export function clampPlinthOffsetForward(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return DEFAULT_STUDIO_PANEL.plinthOffsetForward ?? 0
  }
  return Math.max(0, Math.round(value))
}

function clampOptional(v: number | undefined, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, typeof v === 'number' && Number.isFinite(v) ? v : fallback))
}

function isPanelPattern(value: unknown): value is StudioPanelPattern {
  return typeof value === 'string' && PANEL_PATTERNS.includes(value as StudioPanelPattern)
}

function isCornerJoin(value: unknown): value is StudioCornerJoin {
  return typeof value === 'string' && CORNER_JOINS.includes(value as StudioCornerJoin)
}

/** Alte Saves mit `unit` auf Breite/Höhe und Raster 8 cm bringen. */
export function normalizeStudioPanel(
  raw?: (Partial<StudioPanelConfig> & { unit?: number }) | null,
): StudioPanelConfig {
  const legacy = typeof raw?.unit === 'number' ? raw.unit : DEFAULT_STUDIO_PANEL.panelWidth
  const joint = raw?.joint ?? DEFAULT_STUDIO_PANEL.joint
  const projectDepth = raw?.projectDepth ?? DEFAULT_STUDIO_PANEL.projectDepth
  const taper = raw?.taper ?? DEFAULT_STUDIO_PANEL.taper
  return {
    panelWidth: clampStudioPanelSize(raw?.panelWidth ?? legacy),
    panelHeight: clampStudioPanelSize(raw?.panelHeight ?? legacy),
    joint: Math.max(
      0,
      Math.min(
        STUDIO_PANEL_SOFT_MAX,
        Number.isFinite(joint) ? joint : DEFAULT_STUDIO_PANEL.joint,
      ),
    ),
    pattern: isPanelPattern(raw?.pattern) ? raw.pattern : DEFAULT_STUDIO_PANEL.pattern,
    cornerJoin: isCornerJoin(raw?.cornerJoin) ? raw.cornerJoin : DEFAULT_STUDIO_PANEL.cornerJoin,
    projectDepth: Math.max(
      0,
      Math.min(
        STUDIO_PANEL_SOFT_MAX,
        Number.isFinite(projectDepth) ? projectDepth : DEFAULT_STUDIO_PANEL.projectDepth,
      ),
    ),
    taper: Math.max(0, Math.min(1, Number.isFinite(taper) ? taper : DEFAULT_STUDIO_PANEL.taper)),
    jointDepth: clampOptional(
      raw?.jointDepth,
      0,
      STUDIO_PANEL_SOFT_MAX,
      DEFAULT_STUDIO_PANEL.jointDepth ?? 0.8,
    ),
    taperDepth: clampOptional(
      raw?.taperDepth,
      0,
      STUDIO_PANEL_SOFT_MAX,
      DEFAULT_STUDIO_PANEL.taperDepth ?? 0,
    ),
    enabled: raw?.enabled !== false,
    alternateFloors: raw?.alternateFloors === true,
    recessedProjectDepth: (() => {
      const legacy =
        raw?.recessedProjectDepth ??
        raw?.recessedDepth ??
        DEFAULT_STUDIO_PANEL.recessedProjectDepth ??
        0
      let depth = clampOptional(legacy, 0, STUDIO_PANEL_SOFT_MAX, 0)
      const jd = clampOptional(
        raw?.jointDepth,
        0,
        STUDIO_PANEL_SOFT_MAX,
        DEFAULT_STUDIO_PANEL.jointDepth ?? 0.8,
      )
      if (depth > 0 && depth < jd + 0.1) depth = Math.round((jd + 0.1) * 10) / 10
      return depth
    })(),
    recessedTaperDepth: clampOptional(
      raw?.recessedTaperDepth,
      0,
      STUDIO_PANEL_SOFT_MAX,
      DEFAULT_STUDIO_PANEL.recessedTaperDepth ?? 0,
    ),
    recessedTaper: clampOptional(raw?.recessedTaper, 0, 1, DEFAULT_STUDIO_PANEL.recessedTaper ?? 1),
    tileColorVariance: clampOptional(raw?.tileColorVariance, 0, 100, 0),
    tileColorVariety: (() => {
      const variance = clampOptional(raw?.tileColorVariance, 0, 100, 0)
      const variety = clampOptional(raw?.tileColorVariety, 0, 100, 0)
      if (variance > 0 && variety <= 0) return 40
      return variety
    })(),
    jointColor: typeof raw?.jointColor === 'string' ? raw.jointColor : undefined,
    plinthEnabled: raw?.plinthEnabled !== false,
    plinthHeight: clampPlinthHeight(raw?.plinthHeight ?? DEFAULT_STUDIO_PANEL.plinthHeight ?? 32),
    plinthDepth: clampPlinthDepth(raw?.plinthDepth ?? DEFAULT_STUDIO_PANEL.plinthDepth ?? 8),
    plinthOffsetForward: clampPlinthOffsetForward(
      raw?.plinthOffsetForward ?? DEFAULT_STUDIO_PANEL.plinthOffsetForward ?? 0,
    ),
    plinthProfileId: (() => {
      const rawId =
        typeof raw?.plinthProfileId === 'string' && raw.plinthProfileId
          ? raw.plinthProfileId
          : DEFAULT_STUDIO_PANEL.plinthProfileId
      return rawId === 'sockelStandard' ? 'sockelprofil' : rawId
    })(),
    plinthProfileScale: clampOptional(
      raw?.plinthProfileScale,
      0.25,
      STUDIO_PANEL_SOFT_MAX,
      DEFAULT_STUDIO_PANEL.plinthProfileScale ?? 1,
    ),
    plinthProfileColor: typeof raw?.plinthProfileColor === 'string' ? raw.plinthProfileColor : undefined,
    plinthColor: typeof raw?.plinthColor === 'string' ? raw.plinthColor : undefined,
    plinthProfileRotationDeg: (() => {
      const v = raw?.plinthProfileRotationDeg
      if (!Number.isFinite(v)) return 0
      return ((((Math.round(Number(v) / 90) * 90) % 360) + 360) % 360)
    })(),
    plinthProfileFlipOutward: Boolean(raw?.plinthProfileFlipOutward),
    plinthProfileFlipForward: Boolean(raw?.plinthProfileFlipForward),
    openingJoin: raw?.openingJoin === 'miter' ? 'miter' : 'flush',
    endBossStart: normalizeEndBossPattern(raw?.endBossStart),
    endBossEnd: normalizeEndBossPattern(raw?.endBossEnd),
    endBossStartJoin: normalizeEndBossJoin(raw?.endBossStartJoin),
    endBossEndJoin: normalizeEndBossJoin(raw?.endBossEndJoin),
    hideRowsBottom: clampHideRows(raw?.hideRowsBottom, 999),
    hideRowsTop: clampHideRows(raw?.hideRowsTop, 999),
  }
}

function normalizeEndBossPattern(value: unknown): EndBossPattern {
  if (value === 'full' || value === 'half' || value === 'alternate') return value
  return 'off'
}

function normalizeEndBossJoin(value: unknown): EndBossJoin | undefined {
  if (value === 'flush' || value === 'miter') return value
  return undefined
}

/** Ganzzahlige Reihenanzahl zum Ausblenden (0 … maxRows). */
export function clampHideRows(value: number | undefined, maxRows: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || maxRows <= 0) return 0
  return Math.max(0, Math.min(maxRows, Math.floor(value)))
}

export function studioPlinthActive(panel: StudioPanelConfig): boolean {
  return panel.plinthEnabled !== false && (panel.plinthHeight ?? 0) > 0.5
}
