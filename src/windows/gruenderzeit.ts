import type { ArchFormId } from '../utils/archForms'
import * as THREE from 'three'
import type {
  GruenderzeitBinaryRatio,
  GruenderzeitPaneMuntins,
  GruenderzeitPanelRatio,
  GruenderzeitPresetId,
  GruenderzeitSplitCount,
  GruenderzeitTimberOverrides,
  GruenderzeitWindowConfig,
  LeafOpenMode,
  Opening,
  OpeningDoorConfig,
} from '../types/facade'
import { isTransparentGlass } from '../constants/colorPalettes'
import { applySurfaceFinish, createGlassMaterial } from '../utils/threeColors'
import type { SurfaceFinish } from '../types/facade'
import type { OpeningGlassConfig } from '../utils/glassConfig'
import {
  ARCH_CURVE_SEGMENTS,
  ARCH_MESH_SEGMENTS,
  archPolyline,
  archYAt,
  glazingArchCrown,
  glazingArchGeom,
  insetArchGeom,
  offsetArchGeom,
  type ArchGeom,
} from '../utils/openingGeometry'


function resolveGlazingForm(glazingArch: boolean | ArchFormId): ArchFormId {
  if (typeof glazingArch === 'string') return glazingArch
  return glazingArch ? 'round' : 'rect'
}

/** Feste Holzquerschnitte in cm — skaliert nicht mit der Öffnung. */
export const TIMBER = {
  blend: 5.2,
  blendDepth: 7,
  sash: 4.4,
  sashDepth: 5,
  bead: 1.1,
  muntin: 2.2,
  kaempfer: 7.2,
  /** Flügellücke; 0 = geschlossen bis an den Blendrahmen / Nachbarflügel. */
  gap: 0,
  stulp: 2.2,
  boxGap: 9,
  boxDepth: 16,
  drip: 1.4,
} as const

export type ResolvedTimber = {
  blend: number
  blendDepth: number
  sash: number
  sashDepth: number
  bead: number
  muntin: number
  kaempfer: number
  gap: number
  stulp: number
  boxGap: number
  boxDepth: number
  drip: number
}

function clampTimberCm(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value == null || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/** Effektive Holzmaße aus Defaults + optionalen Overrides. */
export function resolveTimber(overrides?: GruenderzeitTimberOverrides | null): ResolvedTimber {
  return {
    blend: clampTimberCm(overrides?.blend, TIMBER.blend, 2, 16),
    blendDepth: TIMBER.blendDepth,
    sash: clampTimberCm(overrides?.sash, TIMBER.sash, 2, 14),
    sashDepth: TIMBER.sashDepth,
    bead: TIMBER.bead,
    muntin: clampTimberCm(overrides?.muntin, TIMBER.muntin, 0.8, 8),
    kaempfer: clampTimberCm(overrides?.kaempfer, TIMBER.kaempfer, 3, 20),
    gap: TIMBER.gap,
    stulp: clampTimberCm(overrides?.stulp, TIMBER.stulp, 0.8, 8),
    boxGap: TIMBER.boxGap,
    boxDepth: TIMBER.boxDepth,
    drip: TIMBER.drip,
  }
}

export const GRUENDERZEIT_FRAME_DEPTH = TIMBER.blendDepth

export interface GruenderzeitBar {
  x: number
  y: number
  w: number
  h: number
  kind: 'frame' | 'mullion' | 'transom' | 'sash' | 'muntin' | 'panel' | 'stulp'
}

export interface GruenderzeitPane {
  x: number
  y: number
  w: number
  h: number
  region: 'sash' | 'transom'
}

export interface GruenderzeitLeaf {
  region: 'sash' | 'transom'
  index: number
  hinge: 'left' | 'right'
  openDeg: number
  openMode: LeafOpenMode
  x: number
  y: number
  w: number
  h: number
  bars: GruenderzeitBar[]
  panes: GruenderzeitPane[]
  panel?: { x: number; y: number; w: number; h: number }
}

export interface GruenderzeitLayout {
  bars: GruenderzeitBar[]
  leaves: GruenderzeitLeaf[]
  panes: GruenderzeitPane[]
  width: number
  height: number
  /** True wenn Blendrahmen/Glas nicht rechteckig sind. */
  glazingArch: boolean
  /** Bogenform des Elements (= Öffnungsform). */
  glazingForm: ArchFormId
  /** Optionales manuelles Stichmaß (`Opening.arch.riseCm`); fehlt → Form-Standard. */
  riseCm?: number | null
}

export const WINDOW_STYLE_PRESETS: Record<
  GruenderzeitPresetId,
  {
    label: string
    casements: 1 | 2 | 3
    transom: boolean
    transomRatio: number
    bottomPanel: boolean
    sashBarsH: 0 | 1 | 2
  }
> = {
  '1fl': {
    label: '1-Flügel',
    casements: 1,
    transom: false,
    transomRatio: 0.26,
    bottomPanel: false,
    sashBarsH: 0,
  },
  '2fl': {
    label: '2-Flügel',
    casements: 2,
    transom: false,
    transomRatio: 0.26,
    bottomPanel: false,
    sashBarsH: 0,
  },
  '2fl-ol': {
    label: '2-Flügel + OL',
    casements: 2,
    transom: true,
    transomRatio: 0.26,
    bottomPanel: false,
    sashBarsH: 0,
  },
  ol: {
    label: 'Oberlicht',
    casements: 2,
    transom: true,
    transomRatio: 0.42,
    bottomPanel: false,
    sashBarsH: 0,
  },
  balkon: {
    label: 'Balkontür',
    casements: 2,
    transom: false,
    transomRatio: 0.22,
    bottomPanel: true,
    sashBarsH: 0,
  },
  'balkon-ol': {
    label: 'Balkon + OL',
    casements: 2,
    transom: true,
    transomRatio: 0.22,
    bottomPanel: true,
    sashBarsH: 0,
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function padOpen(values: number[] | undefined, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const value = values?.[i] ?? 0
    return clamp(value, 0, 85)
  })
}

function defaultHingeForIndex(index: number, count: number): 'left' | 'right' {
  if (count === 1) return 'left'
  return index === count - 1 ? 'right' : 'left'
}

function padHinges(
  values: Array<'left' | 'right'> | undefined,
  count: number,
): Array<'left' | 'right'> {
  return Array.from({ length: count }, (_, i) => {
    const v = values?.[i]
    if (v === 'left' || v === 'right') return v
    return defaultHingeForIndex(i, count)
  })
}

function padOpenModes(values: LeafOpenMode[] | undefined, count: number): LeafOpenMode[] {
  return Array.from({ length: count }, (_, i) => {
    const v = values?.[i]
    if (v === 'turn' || v === 'tilt' || v === 'turnTilt') return v
    return 'turn'
  })
}

function addBar(
  bars: GruenderzeitBar[],
  x: number,
  y: number,
  w: number,
  h: number,
  kind: GruenderzeitBar['kind'],
) {
  if (w < 0.3 || h < 0.3) return
  bars.push({ x, y, w, h, kind })
}

function frameRect(
  bars: GruenderzeitBar[],
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
  kind: GruenderzeitBar['kind'],
) {
  const t = thickness
  if (w <= t * 2 + 0.8 || h <= t * 2 + 0.8) {
    addBar(bars, x, y, w, h, kind)
    return
  }
  addBar(bars, x, y, w, t, kind)
  addBar(bars, x, y + h - t, w, t, kind)
  addBar(bars, x, y + t, t, h - 2 * t, kind)
  addBar(bars, x + w - t, y + t, t, h - 2 * t, kind)
}

function subdivide(
  bars: GruenderzeitBar[],
  panes: GruenderzeitPane[],
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  region: GruenderzeitPane['region'],
  muntinW: number = TIMBER.muntin,
) {
  const muntin = muntinW
  const colCount = Math.max(1, cols)
  const rowCount = Math.max(1, rows)
  const innerW = w - muntin * (colCount - 1)
  const innerH = h - muntin * (rowCount - 1)
  const cellW = innerW / colCount
  const cellH = innerH / rowCount
  if (cellW < 4 || cellH < 4) {
    panes.push({ x, y, w, h, region })
    return
  }
  for (let c = 0; c < colCount; c += 1) {
    for (let r = 0; r < rowCount; r += 1) {
      panes.push({
        x: x + c * (cellW + muntin),
        y: y + r * (cellH + muntin),
        w: cellW,
        h: cellH,
        region,
      })
    }
  }
  for (let c = 1; c < colCount; c += 1) {
    addBar(bars, x + c * cellW + (c - 1) * muntin, y, muntin, h, 'muntin')
  }
  for (let r = 1; r < rowCount; r += 1) {
    addBar(bars, x, y + r * cellH + (r - 1) * muntin, w, muntin, 'muntin')
  }
}


export type SplitCount = GruenderzeitSplitCount
export type BinaryRatio = GruenderzeitBinaryRatio
export type PanelRatio = GruenderzeitPanelRatio

const BINARY_RATIOS: BinaryRatio[] = ['1/1', '1/2', '1/3', '1/4', '1/5', '1/6']
const PANEL_RATIOS: PanelRatio[] = ['1/1', '1/2', '1/3', '1/4']

export function isSplitCount(value: unknown): value is SplitCount {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

export function isBinaryRatio(value: unknown): value is BinaryRatio {
  return typeof value === 'string' && (BINARY_RATIOS as string[]).includes(value)
}

export function isPanelRatio(value: unknown): value is PanelRatio {
  return typeof value === 'string' && (PANEL_RATIOS as string[]).includes(value)
}

/** Gewichte für eine Achse: equal 1…n oder bei count=2 Verhältnis 1:n. */
export function axisWeights(count: SplitCount, ratio: BinaryRatio): number[] {
  if (count !== 2) {
    return Array.from({ length: count }, () => 1)
  }
  const n = Number(ratio.split('/')[1])
  const topOrRight = n >= 1 && n <= 6 ? n : 1
  return [1, topOrRight]
}

export function paneCountForSplit(splitVCount: SplitCount, splitHCount: SplitCount): number {
  return splitVCount * splitHCount
}

export function normalizePaneMuntins(
  splitVCount: SplitCount,
  splitHCount: SplitCount,
  muntins: GruenderzeitPaneMuntins[] | undefined,
): GruenderzeitPaneMuntins[] {
  const count = paneCountForSplit(splitVCount, splitHCount)
  const out: GruenderzeitPaneMuntins[] = []
  for (let i = 0; i < count; i += 1) {
    const src = muntins?.[i]
    const v = src?.v === 1 || src?.v === 2 ? src.v : 0
    const h = src?.h === 1 || src?.h === 2 ? src.h : 0
    out.push({ v, h })
  }
  return out
}

export function deriveLegacySashBars(
  splitVCount: SplitCount,
  splitHCount: SplitCount,
): { sashBarsH: 0 | 1 | 2; sashBarsV: 0 | 1 } {
  const sashBarsH = Math.min(2, Math.max(0, splitVCount - 1)) as 0 | 1 | 2
  const sashBarsV: 0 | 1 = splitHCount >= 2 ? 1 : 0
  return { sashBarsH, sashBarsV }
}

/** Anteil der Innenhöhe für die Brüstung aus Panel-Ratio a:b. */
export function panelHeightFraction(ratio: PanelRatio): number {
  const parts = ratio.split('/')
  const a = Number(parts[0]) || 1
  const b = Number(parts[1]) || 1
  return a / (a + b)
}

/** Kontinuierlichen Legacy-Anteil → nächstes diskretes Panel-Ratio. */
export function migratePanelRatioFromFloat(value: number | undefined): PanelRatio {
  if (value === undefined || !Number.isFinite(value)) return '1/2'
  const candidates: Array<{ ratio: PanelRatio; frac: number }> = [
    { ratio: '1/1', frac: 0.5 },
    { ratio: '1/2', frac: 1 / 3 },
    { ratio: '1/3', frac: 0.25 },
    { ratio: '1/4', frac: 0.2 },
  ]
  let best = candidates[0]
  let bestDist = Math.abs(value - best.frac)
  for (const c of candidates) {
    const d = Math.abs(value - c.frac)
    if (d < bestDist) {
      best = c
      bestDist = d
    }
  }
  return best.ratio
}

/** Altes splitV-String → count + ratio. */
export function migrateFromSplitV(
  splitV: '1' | '1/1' | '1/2' | '1/3' | undefined,
): { splitVCount: SplitCount; splitVRatio: BinaryRatio } {
  if (splitV === '1/2') return { splitVCount: 2, splitVRatio: '1/2' }
  if (splitV === '1/3') return { splitVCount: 2, splitVRatio: '1/3' }
  if (splitV === '1/1') return { splitVCount: 2, splitVRatio: '1/1' }
  return { splitVCount: 1, splitVRatio: '1/1' }
}

/** Altes sashBarsH/V → count/ratio. */
export function migrateFromLegacyBars(
  sashBarsH: 0 | 1 | 2 | undefined,
  sashBarsV: 0 | 1 | undefined,
): {
  splitVCount: SplitCount
  splitVRatio: BinaryRatio
  splitHCount: SplitCount
  splitHRatio: BinaryRatio
} {
  const rows = Math.min(5, Math.max(1, (sashBarsH ?? 0) + 1)) as SplitCount
  const cols = (sashBarsV === 1 ? 2 : 1) as SplitCount
  return {
    splitVCount: rows,
    splitVRatio: '1/1',
    splitHCount: cols,
    splitHRatio: '1/1',
  }
}

/** Altes sashSplitV/paneCols → count/ratio. */
export function migrateFromSashSplit(
  sashSplitV: '1/1' | '1/2' | '1/3' | undefined,
  paneCols: Array<1 | 2 | 3> | undefined,
): {
  splitVCount: SplitCount
  splitVRatio: BinaryRatio
  splitHCount: SplitCount
  splitHRatio: BinaryRatio
} {
  const cols = paneCols && paneCols.length > 0 ? paneCols : [1]
  const allSame = cols.every((c) => c === cols[0])
  const splitHCount: SplitCount =
    allSame && (cols[0] === 1 || cols[0] === 2 || cols[0] === 3) ? cols[0] : 1
  const v = migrateFromSplitV(
    sashSplitV === '1/2' || sashSplitV === '1/3' || sashSplitV === '1/1'
      ? sashSplitV
      : cols.length <= 1
        ? '1'
        : '1/1',
  )
  return { ...v, splitHCount, splitHRatio: '1/1' }
}

/**
 * Primärraster (dicke Stege), danach Sprossen je Zelle.
 */
function subdividePrimaryThenMuntins(
  bars: GruenderzeitBar[],
  panes: GruenderzeitPane[],
  x: number,
  y: number,
  w: number,
  h: number,
  splitVCount: SplitCount,
  splitVRatio: BinaryRatio,
  splitHCount: SplitCount,
  splitHRatio: BinaryRatio,
  paneMuntins: GruenderzeitPaneMuntins[],
  region: GruenderzeitPane['region'],
  timber: ResolvedTimber = resolveTimber(),
) {
  const primary = timber.sash
  const rowWeights = axisWeights(splitVCount, splitVRatio)
  const colWeights = axisWeights(splitHCount, splitHRatio)
  const rowCount = rowWeights.length
  const colCount = colWeights.length
  const rowSum = rowWeights.reduce((a, b) => a + b, 0) || 1
  const colSum = colWeights.reduce((a, b) => a + b, 0) || 1
  const innerH = h - primary * (rowCount - 1)
  const innerW = w - primary * (colCount - 1)
  if (innerH < 4 || innerW < 4) {
    panes.push({ x, y, w, h, region })
    return
  }
  const rowHeights = rowWeights.map((wt) => (innerH * wt) / rowSum)
  const colWidths = colWeights.map((wt) => (innerW * wt) / colSum)
  let cursorY = y
  let paneIndex = 0
  for (let r = 0; r < rowCount; r += 1) {
    const rowH = rowHeights[r]
    let cursorX = x
    for (let c = 0; c < colCount; c += 1) {
      const cellW = colWidths[c]
      const muntins = paneMuntins[paneIndex] ?? { v: 0, h: 0 }
      paneIndex += 1
      subdivide(
        bars,
        panes,
        cursorX,
        cursorY,
        cellW,
        rowH,
        muntins.v + 1,
        muntins.h + 1,
        region,
        timber.muntin,
      )
      cursorX += cellW
      if (c < colCount - 1) {
        addBar(bars, cursorX, cursorY, primary, rowH, 'mullion')
        cursorX += primary
      }
    }
    cursorY += rowH
    if (r < rowCount - 1) {
      addBar(bars, x, cursorY, w, primary, 'mullion')
      cursorY += primary
    }
  }
}

export function defaultGruenderzeitConfig(width: number, height: number, type: Opening['type'] = 'window'): GruenderzeitWindowConfig {
  if (type === 'door') {
    return {
      casements: width < 80 ? 1 : 2,
      transom: height >= 280,
      transomRatio: 0.2,
      splitVCount: 1,
      splitVRatio: '1/1',
      splitHCount: 1,
      splitHRatio: '1/1',
      paneMuntins: [{ v: 0, h: 0 }],
      sashBarsH: 0,
      sashBarsV: 0,
      transomBars: 'match',
      bottomPanel: true,
      bottomPanelRatio: '1/2',
      boxWindow: false,
      leafOpenDeg: padOpen(undefined, width < 80 ? 1 : 2),
      transomOpenDeg: padOpen(undefined, width < 80 ? 1 : 2),
      profiledBars: false,
      hardware: false,
    }
  }
  const casements: 1 | 2 | 3 = 1
  return {
    casements,
    // Kein Oberlicht/Mehrflügel-Raster mehr als Default — Nutzer schaltet über Teilung zu.
    // Kellerfenster bekommen ihr Stabgitter separat (`basementWindow`), nicht über Flügelteilung.
    transom: false,
    transomRatio: 0.26,
    splitVCount: 1,
    splitVRatio: '1/1',
    splitHCount: 1,
    splitHRatio: '1/1',
    paneMuntins: [{ v: 0, h: 0 }],
    sashBarsH: 0,
    sashBarsV: 0,
    transomBars: 'match',
    bottomPanel: false,
    bottomPanelRatio: '1/2',
    boxWindow: false,
    leafOpenDeg: padOpen(undefined, casements),
    transomOpenDeg: padOpen(undefined, casements),
    profiledBars: false,
    hardware: false,
  }
}

export function normalizeGruenderzeitConfig(
  raw: Partial<GruenderzeitWindowConfig> | undefined,
  width: number,
  height: number,
  type: Opening['type'] = 'window',
): GruenderzeitWindowConfig {
  const fallback = defaultGruenderzeitConfig(width, height, type)
  const casements = raw?.casements
  const transomBars = raw?.transomBars
  const nextCasements = casements === 1 || casements === 2 || casements === 3 ? casements : fallback.casements

  let splitVCount: SplitCount = fallback.splitVCount
  let splitVRatio: BinaryRatio = fallback.splitVRatio
  let splitHCount: SplitCount = fallback.splitHCount
  let splitHRatio: BinaryRatio = fallback.splitHRatio

  const rawAny = raw as
    | (Partial<GruenderzeitWindowConfig> & {
        bottomPanelRatio?: GruenderzeitPanelRatio | number
      })
    | undefined

  if (isSplitCount(raw?.splitVCount) || isSplitCount(raw?.splitHCount)) {
    if (isSplitCount(raw?.splitVCount)) splitVCount = raw!.splitVCount!
    if (isBinaryRatio(raw?.splitVRatio)) splitVRatio = raw!.splitVRatio!
    if (isSplitCount(raw?.splitHCount)) splitHCount = raw!.splitHCount!
    if (isBinaryRatio(raw?.splitHRatio)) splitHRatio = raw!.splitHRatio!
  } else if (
    raw?.splitV === '1' ||
    raw?.splitV === '1/1' ||
    raw?.splitV === '1/2' ||
    raw?.splitV === '1/3' ||
    raw?.splitH === 1 ||
    raw?.splitH === 2 ||
    raw?.splitH === 3
  ) {
    const v = migrateFromSplitV(raw?.splitV)
    splitVCount = v.splitVCount
    splitVRatio = v.splitVRatio
    if (raw?.splitH === 1 || raw?.splitH === 2 || raw?.splitH === 3) {
      splitHCount = raw.splitH
      splitHRatio = '1/1'
    }
  } else if (
    raw?.sashSplitV === '1/1' ||
    raw?.sashSplitV === '1/2' ||
    raw?.sashSplitV === '1/3' ||
    (raw?.paneCols && raw.paneCols.length > 0)
  ) {
    const migrated = migrateFromSashSplit(raw.sashSplitV, raw.paneCols)
    splitVCount = migrated.splitVCount
    splitVRatio = migrated.splitVRatio
    splitHCount = migrated.splitHCount
    splitHRatio = migrated.splitHRatio
  } else if (raw?.sashBarsH !== undefined || raw?.sashBarsV !== undefined) {
    const migrated = migrateFromLegacyBars(
      raw.sashBarsH === 0 || raw.sashBarsH === 1 || raw.sashBarsH === 2 ? raw.sashBarsH : 0,
      raw.sashBarsV === 1 ? 1 : 0,
    )
    splitVCount = migrated.splitVCount
    splitVRatio = migrated.splitVRatio
    splitHCount = migrated.splitHCount
    splitHRatio = migrated.splitHRatio
  }

  if (splitVCount !== 2) splitVRatio = '1/1'
  if (splitHCount !== 2) splitHRatio = '1/1'

  let bottomPanelRatio: PanelRatio = fallback.bottomPanelRatio ?? '1/2'
  const rawPanel = rawAny?.bottomPanelRatio
  if (isPanelRatio(rawPanel)) {
    bottomPanelRatio = rawPanel
  } else if (typeof rawPanel === 'number') {
    bottomPanelRatio = migratePanelRatioFromFloat(rawPanel)
  }

  const paneMuntins = normalizePaneMuntins(splitVCount, splitHCount, raw?.paneMuntins)
  const legacy = deriveLegacySashBars(splitVCount, splitHCount)

  const timberRaw = raw?.timber
  const timber: GruenderzeitTimberOverrides | undefined =
    timberRaw && typeof timberRaw === 'object'
      ? {
          blend: timberRaw.blend,
          sash: timberRaw.sash,
          muntin: timberRaw.muntin,
          kaempfer: timberRaw.kaempfer,
          stulp: timberRaw.stulp,
        }
      : undefined

  const leafHinges = padHinges(raw?.leafHinges, nextCasements)
  const leafOpenModes = padOpenModes(raw?.leafOpenModes, nextCasements)

  return {
    casements: nextCasements,
    transom: raw?.transom ?? fallback.transom,
    transomRatio: clamp(raw?.transomRatio ?? fallback.transomRatio, 0.16, 0.48),
    splitVCount,
    splitVRatio,
    splitHCount,
    splitHRatio,
    paneMuntins,
    sashBarsH: legacy.sashBarsH,
    sashBarsV: legacy.sashBarsV,
    transomBars:
      transomBars === 'none' || transomBars === 'match' || transomBars === 'cross'
        ? transomBars
        : fallback.transomBars,
    bottomPanel: raw?.bottomPanel ?? fallback.bottomPanel,
    bottomPanelRatio,
    boxWindow: raw?.boxWindow ?? fallback.boxWindow,
    leafOpenDeg: padOpen(raw?.leafOpenDeg, nextCasements),
    transomOpenDeg: padOpen(raw?.transomOpenDeg, nextCasements),
    timber,
    profiledBars: Boolean(raw?.profiledBars),
    leafHinges,
    leafOpenModes,
    hardware: Boolean(raw?.hardware),
    innerFrameColor:
      typeof raw?.innerFrameColor === 'string' && raw.innerFrameColor.trim()
        ? raw.innerFrameColor.trim()
        : undefined,
    leafOpenDegInner: raw?.leafOpenDegInner
      ? padOpen(raw.leafOpenDegInner, nextCasements)
      : undefined,
    transomOpenDegInner: raw?.transomOpenDegInner
      ? padOpen(raw.transomOpenDegInner, nextCasements)
      : undefined,
  }
}

/** Kellerfenster: max. 2 Flügel, kein OL, keine Teilung, max. 1 Sprosse je Richtung. */
export function clampGruenderzeitForBasement(config: GruenderzeitWindowConfig): GruenderzeitWindowConfig {
  const casements: 1 | 2 = config.casements >= 2 ? 2 : 1
  const clampMuntin = (n: number): 0 | 1 | 2 => {
    if (n <= 0) return 0
    return 1
  }
  const paneMuntins = (config.paneMuntins.length > 0 ? config.paneMuntins : [{ v: 0, h: 0 }])
    .slice(0, 1)
    .map((m) => ({ v: clampMuntin(m?.v ?? 0), h: clampMuntin(m?.h ?? 0) }))
  return {
    ...config,
    casements,
    transom: false,
    transomBars: 'none',
    bottomPanel: false,
    splitVCount: 1,
    splitVRatio: '1/1',
    splitHCount: 1,
    splitHRatio: '1/1',
    paneMuntins,
    leafOpenDeg: padOpen(config.leafOpenDeg, casements),
    transomOpenDeg: padOpen(undefined, casements),
    leafHinges: padHinges(config.leafHinges, casements),
    leafOpenModes: padOpenModes(config.leafOpenModes, casements),
  }
}

export function gruenderzeitConfigForOpening(opening: Opening): GruenderzeitWindowConfig {
  const config = normalizeGruenderzeitConfig(
    opening.gruenderzeit,
    opening.width,
    opening.height,
    opening.type,
  )
  if (opening.type === 'window' && opening.basementWindow?.enabled) {
    return clampGruenderzeitForBasement(config)
  }
  return config
}

export function windowAssemblyDepth(config: GruenderzeitWindowConfig): number {
  const timber = resolveTimber(config.timber)
  return config.boxWindow ? timber.boxDepth : timber.blendDepth
}

export function detectWindowPreset(config: GruenderzeitWindowConfig): GruenderzeitPresetId | '' {
  if (config.bottomPanel && config.transom && config.casements === 2) return 'balkon-ol'
  if (config.bottomPanel && !config.transom) return 'balkon'
  if (!config.bottomPanel && config.transom && config.casements === 2 && config.transomRatio >= 0.36) return 'ol'
  if (!config.bottomPanel && config.transom && config.casements >= 2) return '2fl-ol'
  if (!config.bottomPanel && !config.transom && config.casements === 1) return '1fl'
  if (!config.bottomPanel && !config.transom && config.casements === 2) return '2fl'
  return ''
}

function hingeForIndex(
  index: number,
  count: number,
  config: GruenderzeitWindowConfig,
): 'left' | 'right' {
  const custom = config.leafHinges?.[index]
  if (custom === 'left' || custom === 'right') return custom
  return defaultHingeForIndex(index, count)
}

function openModeForIndex(index: number, config: GruenderzeitWindowConfig): LeafOpenMode {
  const mode = config.leafOpenModes?.[index]
  if (mode === 'turn' || mode === 'tilt' || mode === 'turnTilt') return mode
  return 'turn'
}

function buildLeaf(
  x: number,
  y: number,
  w: number,
  h: number,
  region: 'sash' | 'transom',
  index: number,
  count: number,
  openDeg: number,
  config: GruenderzeitWindowConfig,
  timber: ResolvedTimber,
): GruenderzeitLeaf {
  const sash = timber.sash
  const bars: GruenderzeitBar[] = []
  const panes: GruenderzeitPane[] = []
  frameRect(bars, 0, 0, w, h, sash, 'sash')

  const innerX = sash
  const innerY = sash
  const innerW = w - sash * 2
  const innerH = h - sash * 2
  let panel: GruenderzeitLeaf['panel']
  let glassY = innerY
  let glassH = innerH

  const usePanel = Boolean(config.bottomPanel) && region === 'sash' && innerH > 28
  if (usePanel) {
    const ratio = isPanelRatio(config.bottomPanelRatio) ? config.bottomPanelRatio : '1/2'
    const panelH = clamp(innerH * panelHeightFraction(ratio), 12, innerH * 0.72)
    const rail = timber.sash
    panel = { x: innerX, y: innerY, w: innerW, h: panelH }
    addBar(bars, innerX, innerY + panelH, innerW, rail, 'mullion')
    glassY = innerY + panelH + rail
    glassH = innerY + innerH - glassY
  }

  if (innerW > 3 && glassH > 3) {
    if (region === 'transom' && config.transomBars === 'none' && count > 1) {
      panes.push({ x: innerX, y: glassY, w: innerW, h: glassH, region })
    } else if (region === 'transom') {
      const barsH = config.transomBars === 'cross' ? 1 : 0
      const barsV = config.transomBars === 'cross' && count === 1 ? 1 : 0
      subdivide(bars, panes, innerX, glassY, innerW, glassH, barsV + 1, barsH + 1, region, timber.muntin)
    } else {
      subdividePrimaryThenMuntins(
        bars,
        panes,
        innerX,
        glassY,
        innerW,
        glassH,
        config.splitVCount,
        config.splitVRatio,
        config.splitHCount,
        config.splitHRatio,
        config.paneMuntins,
        region,
        timber,
      )
    }
  }

  if (count === 2 && index === 1) {
    addBar(bars, 0, sash, timber.stulp, h - sash * 2, 'stulp')
  }

  return {
    region,
    index,
    hinge: hingeForIndex(index, count, config),
    openDeg,
    openMode: openModeForIndex(index, config),
    x,
    y,
    w,
    h,
    bars,
    panes,
    panel,
  }
}

/**
 * Blendrahmen, Kämpfer und einzelne Flügel in Öffnungskoordinaten
 * (Ursprung unten links, Y nach oben). Holzbreiten aus `resolveTimber`.
 */
export function layoutGruenderzeitWindow(
  width: number,
  height: number,
  config: GruenderzeitWindowConfig,
  glazingArch: boolean | ArchFormId = false,
  riseCm?: number | null,
): GruenderzeitLayout {
  const timber = resolveTimber(config.timber)
  const bars: GruenderzeitBar[] = []
  const W = Math.max(16, width)
  const H = Math.max(16, height)
  const blend = timber.blend
  const kaempfer = timber.kaempfer
  const gap = timber.gap
  const glazingForm: ArchFormId =
    typeof glazingArch === 'string' ? glazingArch : glazingArch ? 'round' : 'rect'
  const archGeom = glazingForm === 'round' ? glazingArchGeom(W, H, riseCm) : null
  const archCrown =
    glazingForm !== 'rect' && glazingForm !== 'round'
      ? glazingArchCrown(W, H, glazingForm, ARCH_MESH_SEGMENTS, riseCm)
      : null
  const archSpringY = archGeom?.springY ?? archCrown?.[0]?.y ?? null

  frameRect(bars, 0, 0, W, H, blend, 'frame')

  const innerX = blend
  const innerY = blend
  const innerW = W - blend * 2
  const innerH = H - blend * 2
  const casements = config.casements
  const transomOn = config.transom && innerH > kaempfer + timber.sash * 4 + 20
  let transomH = transomOn ? clamp(innerH * config.transomRatio, 18, innerH * 0.48) : 0
  let lowerH = transomOn ? innerH - transomH - kaempfer : innerH
  if (transomOn && archSpringY != null) {
    const maxLowerH = archSpringY - kaempfer - innerY
    if (maxLowerH >= 8 && innerY + lowerH + kaempfer > archSpringY + 0.05) {
      lowerH = Math.min(lowerH, maxLowerH)
      transomH = innerH - lowerH - kaempfer
    }
  }
  const lowerY = innerY
  const transomY = innerY + lowerH + kaempfer

  if (transomOn) {
    addBar(bars, innerX, innerY + lowerH, innerW, kaempfer, 'transom')
  }

  const splitLeaves = (
    zoneY: number,
    zoneH: number,
    region: 'sash' | 'transom',
    open: number[],
  ): GruenderzeitLeaf[] => {
    const leaves: GruenderzeitLeaf[] = []
    const usable = innerW - gap * (casements - 1)
    const sashW = usable / casements
    for (let i = 0; i < casements; i += 1) {
      const sx = innerX + i * (sashW + gap)
      leaves.push(
        buildLeaf(sx, zoneY, sashW, zoneH, region, i, casements, open[i] ?? 0, config, timber),
      )
    }
    return leaves
  }

  const leaves = splitLeaves(lowerY, lowerH, 'sash', config.leafOpenDeg ?? [])
  if (transomOn) {
    const transomLeaves =
      config.transomBars === 'none'
        ? [
            buildLeaf(
              innerX,
              transomY,
              innerW,
              transomH,
              'transom',
              0,
              1,
              config.transomOpenDeg?.[0] ?? 0,
              { ...config, transomBars: 'none' },
              timber,
            ),
          ]
        : splitLeaves(transomY, transomH, 'transom', config.transomOpenDeg ?? [])
    leaves.push(...transomLeaves)
  }

  const panes = leaves.flatMap((leaf) =>
    leaf.panes.map((pane) => ({
      ...pane,
      x: leaf.x + pane.x,
      y: leaf.y + pane.y,
    })),
  )

  return {
    bars,
    leaves,
    panes,
    width: W,
    height: H,
    glazingArch: glazingForm !== 'rect',
    glazingForm,
    riseCm,
  }
}

function rectHitsArchCap(x: number, y: number, w: number, h: number, geom: ArchGeom): boolean {
  if (w < 0.2 || h < 0.2) return false
  if (x + w < geom.cx - geom.r + 0.05 || x > geom.cx + geom.r - 0.05) return false
  if (y + h <= geom.springY + 0.15) return false
  return [x, x + w, x + w / 2].some((px) => archYAt(geom, px) < y + h - 0.1)
}

function addRectOutline(path: THREE.Path, x: number, y: number, w: number, h: number, reverse = false) {
  if (reverse) {
    path.moveTo(x, y)
    path.lineTo(x, y + h)
    path.lineTo(x + w, y + h)
    path.lineTo(x + w, y)
  } else {
    path.moveTo(x, y)
    path.lineTo(x + w, y)
    path.lineTo(x + w, y + h)
    path.lineTo(x, y + h)
  }
  path.closePath()
}

function addArchedRectOutline(
  path: THREE.Path,
  x: number,
  y: number,
  w: number,
  h: number,
  geom: ArchGeom,
  reverse = false,
) {
  if (!rectHitsArchCap(x, y, w, h, geom)) {
    addRectOutline(path, x, y, w, h, reverse)
    return
  }
  const x0 = x
  const x1 = x + w
  const y0 = y
  const y1 = y + h
  // Immer Polyline mit Y-Clamp: absarc ohne Boden-Clip erzeugt Nadeln unter der Scheibe
  // (Oberlicht über der Federlinie → Artefakt am Kämpfer × Stulp).
  const samples = archPolyline(geom, ARCH_MESH_SEGMENTS, x0, x1)
  const clamped = samples.map((p) => ({
    x: p.x,
    y: Math.min(y1, Math.max(y0, p.y)),
  }))
  if (reverse) {
    path.moveTo(x0, y0)
    for (const p of clamped) path.lineTo(p.x, p.y)
    path.lineTo(x1, y0)
    path.closePath()
    return
  }
  path.moveTo(x0, y0)
  path.lineTo(x1, y0)
  for (let i = clamped.length - 1; i >= 0; i -= 1) {
    path.lineTo(clamped[i].x, clamped[i].y)
  }
  path.closePath()
}

function extrudeFrameOptions(depth: number, bevel: boolean, arched: boolean): THREE.ExtrudeGeometryOptions {
  return {
    depth,
    bevelEnabled: bevel,
    bevelThickness: bevel ? 0.22 : 0,
    bevelSize: bevel ? 0.22 : 0,
    bevelSegments: bevel ? 1 : 0,
    curveSegments: arched ? ARCH_MESH_SEGMENTS : 2,
  }
}

function createRectFrameGeometry(width: number, height: number, thickness: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  addRectOutline(shape, 0, 0, width, height)
  const t = Math.min(thickness, width / 2 - 0.4, height / 2 - 0.4)
  if (t > 0.4) {
    const hole = new THREE.Path()
    addRectOutline(hole, t, t, width - 2 * t, height - 2 * t, true)
    shape.holes.push(hole)
  }
  return new THREE.ExtrudeGeometry(shape, extrudeFrameOptions(depth, true, false))
}

function appendCrownPath(
  path: THREE.Shape | THREE.Path,
  crown: { x: number; y: number }[],
  reverse: boolean,
): void {
  const pts = reverse ? [...crown].reverse() : crown
  for (let i = 1; i < pts.length; i += 1) {
    path.lineTo(pts[i]!.x, pts[i]!.y)
  }
}

/** Blendrahmen für Stich-/Spitz-/Ellipsen-/Tudorbogen über Kronen-Polyline. */
function createCrownFrameGeometry(
  width: number,
  height: number,
  thickness: number,
  depth: number,
  form: ArchFormId,
  riseCm?: number | null,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  const crown = glazingArchCrown(width, height, form, ARCH_MESH_SEGMENTS, riseCm)
  const springY = crown[0]?.y ?? height
  shape.moveTo(0, 0)
  shape.lineTo(width, 0)
  shape.lineTo(width, springY)
  appendCrownPath(shape, crown, true)
  shape.closePath()

  const t = Math.min(thickness, width / 2 - 0.4, height / 2 - 0.4)
  if (t > 0.4) {
    const hole = new THREE.Path()
    const innerCrown = glazingArchCrown(
      Math.max(2, width - 2 * t),
      Math.max(2, height - 2 * t),
      form,
      ARCH_MESH_SEGMENTS,
      riseCm,
    ).map((p) => ({ x: p.x + t, y: p.y + t }))
    const innerSpring = innerCrown[0]?.y ?? height - t
    hole.moveTo(t, t)
    hole.lineTo(t, innerSpring)
    appendCrownPath(hole, innerCrown, false)
    hole.lineTo(width - t, t)
    hole.closePath()
    shape.holes.push(hole)
  }
  return new THREE.ExtrudeGeometry(shape, extrudeFrameOptions(depth, true, true))
}

function createFrameGeometry(
  width: number,
  height: number,
  thickness: number,
  depth: number,
  arch: ArchGeom | null,
  form: ArchFormId = 'rect',
  riseCm?: number | null,
): THREE.ExtrudeGeometry {
  if (form !== 'rect' && form !== 'round') {
    return createCrownFrameGeometry(width, height, thickness, depth, form, riseCm)
  }
  if (!arch || !rectHitsArchCap(0, 0, width, height, arch)) {
    return createRectFrameGeometry(width, height, thickness, depth)
  }
  const shape = new THREE.Shape()
  addArchedRectOutline(shape, 0, 0, width, height, arch)
  const t = Math.min(thickness, width / 2 - 0.4, height / 2 - 0.4)
  if (t > 0.4) {
    const hole = new THREE.Path()
    const inner = insetArchGeom(arch, t)
    if (inner) {
      // Loch im selben Koordinatensystem wie der Außenumriss: konzentrischer
      // Innenbogen (gleiche Mitte, kleinerer Radius). Ein Extra-Offset um −t
      // verschiebt die Bogenmitte und verzerrt den Halbkreis.
      addArchedRectOutline(hole, t, t, width - 2 * t, height - 2 * t, inner, true)
    } else {
      addRectOutline(hole, t, t, width - 2 * t, height - 2 * t, true)
    }
    shape.holes.push(hole)
  }
  return new THREE.ExtrudeGeometry(shape, extrudeFrameOptions(depth, true, true))
}

function crownYAtX(crown: { x: number; y: number }[], x: number): number {
  if (crown.length === 0) return 0
  if (x <= crown[0]!.x) return crown[0]!.y
  const last = crown[crown.length - 1]!
  if (x >= last.x) return last.y
  for (let i = 0; i < crown.length - 1; i += 1) {
    const a = crown[i]!
    const b = crown[i + 1]!
    if (x >= a.x && x <= b.x) {
      const span = b.x - a.x
      const t = Math.abs(span) < 1e-9 ? 0 : (x - a.x) / span
      return a.y + t * (b.y - a.y)
    }
  }
  return last.y
}


function offsetCrown(
  crown: { x: number; y: number }[],
  ox: number,
  oy: number,
): { x: number; y: number }[] {
  return crown.map((p) => ({ x: p.x + ox, y: p.y + oy }))
}

/** True wenn das Rechteck in die Bogenkappe der (lokalen) Global-Krone ragt. */
function rectHitsCrown(
  x: number,
  y: number,
  w: number,
  h: number,
  crown: { x: number; y: number }[],
): boolean {
  if (crown.length < 2 || w < 0.2 || h < 0.2) return false
  const springY = Math.min(crown[0]!.y, crown[crown.length - 1]!.y)
  if (y + h <= springY + 0.15) return false
  const topAtL = crownYAtX(crown, x)
  const topAtR = crownYAtX(crown, x + w)
  const topAtM = crownYAtX(crown, x + w / 2)
  return Math.min(topAtL, topAtR, topAtM) < y + h - 0.1
}

/** Kronenpunkte zwischen x0..x1 (inkl. Endpunkte), Y später geclempt. */
function sampleCrownBetween(
  crown: { x: number; y: number }[],
  x0: number,
  x1: number,
): { x: number; y: number }[] {
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  const pts: { x: number; y: number }[] = [{ x: lo, y: crownYAtX(crown, lo) }]
  for (const p of crown) {
    if (p.x > lo + 1e-6 && p.x < hi - 1e-6) pts.push({ x: p.x, y: p.y })
  }
  pts.push({ x: hi, y: crownYAtX(crown, hi) })
  return pts
}

/**
 * Rechteck-Umriss, dessen Oberkante der globalen Öffnungskrone folgt
 * (Ausschnitt — keine neu skalierte Mini-Bogenform).
 */
function addCrownClippedRectOutline(
  path: THREE.Path,
  x: number,
  y: number,
  w: number,
  h: number,
  crown: { x: number; y: number }[],
  reverse = false,
) {
  if (!rectHitsCrown(x, y, w, h, crown)) {
    addRectOutline(path, x, y, w, h, reverse)
    return
  }
  const x0 = x
  const x1 = x + w
  const y0 = y
  const y1 = y + h
  const samples = sampleCrownBetween(crown, x0, x1).map((p) => ({
    x: p.x,
    y: Math.min(y1, Math.max(y0, p.y)),
  }))
  if (reverse) {
    path.moveTo(x0, y0)
    for (const p of samples) path.lineTo(p.x, p.y)
    path.lineTo(x1, y0)
    path.closePath()
    return
  }
  path.moveTo(x0, y0)
  path.lineTo(x1, y0)
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    path.lineTo(samples[i]!.x, samples[i]!.y)
  }
  path.closePath()
}

/** Flügelrahmen: Rechteck gegen Ausschnitt der globalen Krone clippen. */
function createClippedCrownFrameGeometry(
  width: number,
  height: number,
  thickness: number,
  depth: number,
  outerCrown: { x: number; y: number }[],
  innerCrown: { x: number; y: number }[] | null,
): THREE.ExtrudeGeometry {
  if (!rectHitsCrown(0, 0, width, height, outerCrown)) {
    return createRectFrameGeometry(width, height, thickness, depth)
  }
  const shape = new THREE.Shape()
  addCrownClippedRectOutline(shape, 0, 0, width, height, outerCrown)
  const t = Math.min(thickness, width / 2 - 0.4, height / 2 - 0.4)
  if (t > 0.4) {
    const hole = new THREE.Path()
    const crownForHole = innerCrown ?? outerCrown
    addCrownClippedRectOutline(hole, t, t, width - 2 * t, height - 2 * t, crownForHole, true)
    shape.holes.push(hole)
  }
  return new THREE.ExtrudeGeometry(shape, extrudeFrameOptions(depth, true, true))
}

function clipBarToArch(
  bar: { x: number; y: number; w: number; h: number },
  arch: ArchGeom | null,
  crown: { x: number; y: number }[] | null = null,
): { x: number; y: number; w: number; h: number } | null {
  if (crown && crown.length >= 2) {
    const y0 = bar.y
    const maxTop = Math.min(
      crownYAtX(crown, bar.x),
      crownYAtX(crown, bar.x + bar.w),
      crownYAtX(crown, bar.x + bar.w / 2),
    )
    if (y0 >= maxTop - 0.2) return null
    const clippedH = Math.min(bar.h, maxTop - y0)
    if (clippedH < 0.3) return null
    return { x: bar.x, y: y0, w: bar.w, h: clippedH }
  }
  if (!arch) return bar
  const y0 = bar.y
  const maxTop = Math.min(archYAt(arch, bar.x), archYAt(arch, bar.x + bar.w), archYAt(arch, bar.x + bar.w / 2))
  if (y0 >= maxTop - 0.2) return null
  const clippedH = Math.min(bar.h, maxTop - y0)
  if (clippedH < 0.3) return null
  let nx = bar.x
  let nw = bar.w
  const topY = y0 + clippedH
  if (bar.w > bar.h && topY > arch.springY + 0.2) {
    const dy = topY - arch.cy
    const half = dy >= arch.r - 0.05 ? 0 : Math.sqrt(Math.max(0, arch.r * arch.r - dy * dy))
    if (half < 0.2) return null
    nx = Math.max(bar.x, arch.cx - half)
    const nx1 = Math.min(bar.x + bar.w, arch.cx + half)
    nw = nx1 - nx
    if (nw < 0.3) return null
  }
  return { x: nx, y: y0, w: nw, h: clippedH }
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  options: { castShadow?: boolean } = {},
) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = options.castShadow ?? true
  // Kein Shadow-Map-Empfang: Selbstschatten auf Türfüllung/Rahmen wirkt wie Schraffur.
  mesh.receiveShadow = false
  parent.add(mesh)
  return mesh
}

function createChamferedBarGeometry(w: number, h: number, d: number, chamfer: number): THREE.BufferGeometry {
  const c = Math.min(chamfer, w * 0.35, h * 0.35, d * 0.35)
  if (c < 0.05) return new THREE.BoxGeometry(w, h, d)
  const hw = w / 2
  const hh = h / 2
  const hd = d / 2
  const shape = new THREE.Shape()
  shape.moveTo(-hw + c, -hd)
  shape.lineTo(hw - c, -hd)
  shape.lineTo(hw, -hd + c)
  shape.lineTo(hw, hd - c)
  shape.lineTo(hw - c, hd)
  shape.lineTo(-hw + c, hd)
  shape.lineTo(-hw, hd - c)
  shape.lineTo(-hw, -hd + c)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    curveSegments: 1,
  })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, -hh, 0)
  return geo
}

function addHardwareToSash(
  content: THREE.Group,
  leaf: GruenderzeitLeaf,
  wood: THREE.Material,
  timber: ResolvedTimber,
) {
  const metal = (wood as THREE.MeshStandardMaterial).clone()
  metal.color = new THREE.Color('#3a3a3a')
  metal.metalness = 0.55
  metal.roughness = 0.35
  const lockSide = leaf.hinge === 'left' ? 1 : -1
  const oliveX = lockSide * (leaf.w / 2 - timber.sash * 0.55)
  addMesh(content, new THREE.CylinderGeometry(0.55, 0.55, 1.2, 10), metal, oliveX, 0, timber.sashDepth + 0.6)
  const olive = content.children[content.children.length - 1] as THREE.Mesh
  olive.rotation.z = Math.PI / 2
  const hingeX = leaf.hinge === 'left' ? -leaf.w / 2 + 0.4 : leaf.w / 2 - 0.4
  for (const ty of [-leaf.h * 0.28, leaf.h * 0.28]) {
    addMesh(content, new THREE.BoxGeometry(1.2, 4.5, 0.7), metal, hingeX, ty, timber.sashDepth * 0.5)
  }
}

function buildSashContent(
  leaf: GruenderzeitLeaf,
  wood: THREE.Material,
  glass: THREE.Material,
  panelMat: THREE.Material,
  sashOuterArch: ArchGeom | null,
  sashOuterCrown: { x: number; y: number }[] | null = null,
  sashInnerCrown: { x: number; y: number }[] | null = null,
  timber: ResolvedTimber = resolveTimber(),
  profiledBars = false,
  hardware = false,
  door?: OpeningDoorConfig | null,
): THREE.Group {
  const content = new THREE.Group()
  let sashGeo: THREE.ExtrudeGeometry
  if (sashOuterArch) {
    sashGeo = createFrameGeometry(leaf.w, leaf.h, timber.sash, timber.sashDepth, sashOuterArch, 'rect')
  } else if (sashOuterCrown && rectHitsCrown(0, 0, leaf.w, leaf.h, sashOuterCrown)) {
    sashGeo = createClippedCrownFrameGeometry(
      leaf.w,
      leaf.h,
      timber.sash,
      timber.sashDepth,
      sashOuterCrown,
      sashInnerCrown,
    )
  } else {
    sashGeo = createFrameGeometry(leaf.w, leaf.h, timber.sash, timber.sashDepth, null, 'rect')
  }
  addMesh(content, sashGeo, wood, -leaf.w / 2, -leaf.h / 2, 0)

  const beadT = timber.bead
  const beadInset = timber.sash - 0.15
  if (leaf.w > beadInset * 2 + 2 && leaf.h > beadInset * 2 + 2) {
    const beadOx = beadInset - beadT
    const beadOy = beadInset - beadT
    const beadW = leaf.w - beadInset * 2 + beadT * 2
    const beadH = leaf.h - beadInset * 2 + beadT * 2
    const beadOuterArch = sashOuterArch ? insetArchGeom(sashOuterArch, beadOx) : null
    const beadArch = beadOuterArch ? offsetArchGeom(beadOuterArch, -beadOx, -beadOy) : null
    const beadOuterCrown = sashOuterCrown ? offsetCrown(sashOuterCrown, -beadOx, -beadOy) : null
    const beadInnerCrown = sashInnerCrown ? offsetCrown(sashInnerCrown, -beadOx, -beadOy) : null
    let beadGeo: THREE.ExtrudeGeometry
    if (beadArch) {
      beadGeo = createFrameGeometry(beadW, beadH, beadT, timber.sashDepth * 0.45, beadArch, 'rect')
    } else if (beadOuterCrown && rectHitsCrown(0, 0, beadW, beadH, beadOuterCrown)) {
      beadGeo = createClippedCrownFrameGeometry(
        beadW,
        beadH,
        beadT,
        timber.sashDepth * 0.45,
        beadOuterCrown,
        beadInnerCrown,
      )
    } else {
      beadGeo = createFrameGeometry(beadW, beadH, beadT, timber.sashDepth * 0.45, null, 'rect')
    }
    addMesh(content, beadGeo, wood, -leaf.w / 2 + beadOx, -leaf.h / 2 + beadOy, timber.sashDepth * 0.38)
  }

  const toCenter = (x: number, y: number, w: number, h: number) => ({
    cx: x + w / 2 - leaf.w / 2,
    cy: y + h / 2 - leaf.h / 2,
  })
  const sashInnerArch = sashOuterArch ? insetArchGeom(sashOuterArch, timber.sash) : null
  const clipCrown = sashInnerCrown
  const barDepth = timber.sashDepth * 0.62

  for (const bar of leaf.bars) {
    if (bar.kind === 'sash') continue
    const clipped = clipBarToArch(bar, sashInnerArch, clipCrown)
    if (!clipped) continue
    const { cx, cy } = toCenter(clipped.x, clipped.y, clipped.w, clipped.h)
    const useProfile =
      profiledBars && (bar.kind === 'muntin' || bar.kind === 'mullion' || bar.kind === 'transom')
    const geo = useProfile
      ? createChamferedBarGeometry(clipped.w, clipped.h, barDepth, 0.35)
      : new THREE.BoxGeometry(clipped.w, clipped.h, barDepth)
    addMesh(content, geo, wood, cx, cy, timber.sashDepth * 0.35)
  }

  if (leaf.panel) {
    const p = leaf.panel
    const { cx, cy } = toCenter(p.x, p.y, p.w, p.h)
    addMesh(content, new THREE.BoxGeometry(p.w, p.h, timber.sashDepth * 0.5), panelMat, cx, cy, timber.sashDepth * 0.28)
    const cassetteCount = door?.cassetteCount ?? 1
    const inset = 1.6
    if (cassetteCount <= 1) {
      if (p.w > inset * 2 + 2 && p.h > inset * 2 + 2) {
        addMesh(
          content,
          new THREE.BoxGeometry(p.w - inset * 2, p.h - inset * 2, timber.sashDepth * 0.22),
          wood,
          cx,
          cy,
          timber.sashDepth * 0.18,
        )
      }
    } else {
      const gap = 1.2
      const cellH = (p.h - inset * 2 - gap * (cassetteCount - 1)) / cassetteCount
      if (cellH > 2 && p.w > inset * 2 + 2) {
        for (let i = 0; i < cassetteCount; i += 1) {
          const cellCy = cy - p.h / 2 + inset + cellH / 2 + i * (cellH + gap)
          addMesh(
            content,
            new THREE.BoxGeometry(p.w - inset * 2, cellH, timber.sashDepth * 0.22),
            wood,
            cx,
            cellCy,
            timber.sashDepth * 0.18,
          )
        }
      }
    }
    if (door?.letterSlot) {
      addMesh(
        content,
        new THREE.BoxGeometry(Math.min(18, p.w * 0.45), 2.2, 0.4),
        wood,
        cx,
        cy + p.h * 0.15,
        timber.sashDepth * 0.55,
      )
    }
  }

  for (const pane of leaf.panes) {
    const hitsArch = sashInnerArch && rectHitsArchCap(pane.x, pane.y, pane.w, pane.h, sashInnerArch)
    const hitsCrown = clipCrown && rectHitsCrown(pane.x, pane.y, pane.w, pane.h, clipCrown)
    if (hitsArch && sashInnerArch) {
      const shape = new THREE.Shape()
      addArchedRectOutline(shape, pane.x, pane.y, pane.w, pane.h, sashInnerArch)
      const geo = new THREE.ExtrudeGeometry(shape, extrudeFrameOptions(0.35, false, true))
      addMesh(content, geo, glass, -leaf.w / 2, -leaf.h / 2, timber.sashDepth * 0.42, { castShadow: false })
    } else if (hitsCrown && clipCrown) {
      const shape = new THREE.Shape()
      addCrownClippedRectOutline(shape, pane.x, pane.y, pane.w, pane.h, clipCrown)
      const geo = new THREE.ExtrudeGeometry(shape, extrudeFrameOptions(0.35, false, true))
      addMesh(content, geo, glass, -leaf.w / 2, -leaf.h / 2, timber.sashDepth * 0.42, { castShadow: false })
    } else {
      const { cx, cy } = toCenter(pane.x, pane.y, pane.w, pane.h)
      addMesh(
        content,
        new THREE.BoxGeometry(Math.max(0.5, pane.w), Math.max(0.5, pane.h), 0.35),
        glass,
        cx,
        cy,
        timber.sashDepth * 0.42,
        { castShadow: false },
      )
    }
  }

  const drip = new THREE.BoxGeometry(leaf.w * 0.92, timber.drip, timber.drip)
  addMesh(content, drip, wood, 0, -leaf.h / 2 + timber.sash * 0.35, timber.sashDepth + 0.4)

  if (hardware) addHardwareToSash(content, leaf, wood, timber)
  if (door?.handle && leaf.region === 'sash') {
    const metal = (wood as THREE.MeshStandardMaterial).clone()
    metal.color = new THREE.Color('#2c2c2c')
    metal.metalness = 0.6
    metal.roughness = 0.3
    const hx = (leaf.hinge === 'left' ? 1 : -1) * (leaf.w / 2 - timber.sash * 0.7)
    addMesh(content, new THREE.BoxGeometry(1.4, 8, 1.2), metal, hx, 4, timber.sashDepth + 0.8)
    addMesh(
      content,
      new THREE.BoxGeometry(5, 1.2, 1.2),
      metal,
      hx + (leaf.hinge === 'left' ? 2 : -2),
      4,
      timber.sashDepth + 0.8,
    )
  }

  return content
}

/** Flügel öffnen immer ins Gebäudeinnere (Vorzeichen für Schwenk um Y). */
export const LEAF_OPEN_INWARD = 1

export type LeafMotionTag = {
  region: 'sash' | 'transom'
  index: number
  restDeg: number
  dir: number
  openSign: number
  openMode: LeafOpenMode
}

export function isLeafMotionTag(value: unknown): value is LeafMotionTag {
  if (!value || typeof value !== 'object') return false
  const tag = value as LeafMotionTag
  return (
    (tag.region === 'sash' || tag.region === 'transom') &&
    typeof tag.index === 'number' &&
    typeof tag.restDeg === 'number' &&
    typeof tag.dir === 'number' &&
    typeof tag.openSign === 'number'
  )
}

function applyLeafRestPose(pivot: THREE.Group, leaf: GruenderzeitLeaf, dir: number, openSign: number) {
  const deg = leaf.openDeg
  const mode = leaf.openMode ?? 'turn'
  pivot.rotation.set(0, 0, 0)
  if (mode === 'tilt') {
    pivot.rotation.x = THREE.MathUtils.degToRad(-deg * 0.45)
  } else if (mode === 'turnTilt') {
    pivot.rotation.y = THREE.MathUtils.degToRad(deg * 0.55 * dir * openSign)
    pivot.rotation.x = THREE.MathUtils.degToRad(-deg * 0.25)
  } else {
    pivot.rotation.y = THREE.MathUtils.degToRad(deg * dir * openSign)
  }
}

function addLeafToWindow(
  root: THREE.Group,
  leaf: GruenderzeitLeaf,
  width: number,
  height: number,
  z: number,
  openSign: number,
  wood: THREE.Material,
  glass: THREE.Material,
  panelMat: THREE.Material,
  blendInnerArch: ArchGeom | null,
  blendInnerCrown: { x: number; y: number }[] | null = null,
  glazingForm: ArchFormId = 'rect',
  riseCm?: number | null,
  timber: ResolvedTimber = resolveTimber(),
  profiledBars = false,
  hardware = false,
  door?: OpeningDoorConfig | null,
) {
  const pivot = new THREE.Group()
  const mode = leaf.openMode ?? 'turn'
  if (mode === 'tilt' || mode === 'turnTilt') {
    // Drehpunkt unten am Flügel
    pivot.position.set(leaf.x + leaf.w / 2 - width / 2, leaf.y - height / 2, z)
  } else {
    const hingeX = leaf.hinge === 'left' ? leaf.x : leaf.x + leaf.w
    pivot.position.set(hingeX - width / 2, leaf.y + leaf.h / 2 - height / 2, z)
  }
  const sashOuterArch = blendInnerArch ? offsetArchGeom(blendInnerArch, -leaf.x, -leaf.y) : null
  const sashOuterCrown = blendInnerCrown ? offsetCrown(blendInnerCrown, -leaf.x, -leaf.y) : null
  const sashInnerGlobal =
    glazingForm !== 'rect' && glazingForm !== 'round'
      ? glazingArchCrown(
          Math.max(2, width - 2 * (timber.blend + timber.sash)),
          Math.max(2, height - 2 * (timber.blend + timber.sash)),
          glazingForm,
          ARCH_MESH_SEGMENTS,
          riseCm,
        ).map((p) => ({
          x: p.x + timber.blend + timber.sash,
          y: p.y + timber.blend + timber.sash,
        }))
      : null
  const sashInnerCrown = sashInnerGlobal ? offsetCrown(sashInnerGlobal, -leaf.x, -leaf.y) : null
  const content = buildSashContent(
    leaf,
    wood,
    glass,
    panelMat,
    sashOuterArch,
    sashOuterCrown,
    sashInnerCrown,
    timber,
    profiledBars,
    hardware,
    door,
  )
  if (mode === 'tilt' || mode === 'turnTilt') {
    content.position.set(0, leaf.h / 2, 0)
  } else {
    const contentOffsetX = leaf.hinge === 'left' ? leaf.w / 2 : -leaf.w / 2
    content.position.set(contentOffsetX, 0, 0)
  }
  const dir = leaf.hinge === 'left' ? 1 : -1
  applyLeafRestPose(pivot, leaf, dir, openSign)
  pivot.userData.leafMotion = {
    region: leaf.region,
    index: leaf.index,
    restDeg: leaf.openDeg,
    dir,
    openSign,
    openMode: mode,
  } satisfies LeafMotionTag
  pivot.add(content)
  root.add(pivot)
}

export function createGruenderzeitWindowMesh(
  width: number,
  height: number,
  config: GruenderzeitWindowConfig,
  frameColor: string,
  glassColor: string | OpeningGlassConfig,
  glazingArch: boolean | ArchFormId = false,
  frameFinish?: SurfaceFinish | null,
  leafOpenSign: number = LEAF_OPEN_INWARD,
  riseCm?: number | null,
  door?: OpeningDoorConfig | null,
): THREE.Group {
  const timber = resolveTimber(config.timber)
  const layout = layoutGruenderzeitWindow(width, height, config, glazingArch, riseCm)
  const group = new THREE.Group()
  const depth = windowAssemblyDepth(config)
  group.userData.proceduralWindow = true
  group.userData.boxMaxZ = depth

  const makeWood = (color: string) => {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.48,
      metalness: 0.03,
      shadowSide: THREE.DoubleSide,
    })
    applySurfaceFinish(mat, frameFinish)
    return mat
  }
  const wood = makeWood(frameColor)
  const panelMat = makeWood(frameColor)
  panelMat.roughness = 0.58
  const innerWood = makeWood(config.innerFrameColor?.trim() || frameColor)
  const glassMat = createGlassMaterial(glassColor)

  const glazingForm = resolveGlazingForm(glazingArch)
  const outerArch = glazingForm === 'round' ? glazingArchGeom(width, height, riseCm) : null
  const blendInnerArch = outerArch ? insetArchGeom(outerArch, timber.blend) : null
  const blendInnerCrown =
    glazingForm !== 'rect' && glazingForm !== 'round'
      ? glazingArchCrown(
          Math.max(2, width - 2 * timber.blend),
          Math.max(2, height - 2 * timber.blend),
          glazingForm,
          ARCH_MESH_SEGMENTS,
          riseCm,
        ).map((p) => ({ x: p.x + timber.blend, y: p.y + timber.blend }))
      : null
  const blendGeo = createFrameGeometry(width, height, timber.blend, depth, outerArch, glazingForm, riseCm)
  addMesh(group, blendGeo, wood, -width / 2, -height / 2, 0)

  for (const bar of layout.bars) {
    if (bar.kind !== 'transom' && bar.kind !== 'mullion') continue
    const clipped = clipBarToArch(bar, blendInnerArch, blendInnerCrown)
    if (!clipped) continue
    const useProfile = Boolean(config.profiledBars)
    const geo = useProfile
      ? createChamferedBarGeometry(clipped.w, clipped.h, depth * 0.85, 0.4)
      : new THREE.BoxGeometry(clipped.w, clipped.h, depth * 0.85)
    addMesh(
      group,
      geo,
      wood,
      clipped.x + clipped.w / 2 - width / 2,
      clipped.y + clipped.h / 2 - height / 2,
      depth * 0.08,
    )
  }

  type Layer = {
    z: number
    sign: number
    wood: THREE.MeshStandardMaterial
    openOverride?: { leaf?: number[]; transom?: number[] }
  }
  const layers: Layer[] = config.boxWindow
    ? [
        {
          z: 1.2,
          sign: leafOpenSign,
          wood: innerWood,
          openOverride: {
            leaf: config.leafOpenDegInner ?? config.leafOpenDeg,
            transom: config.transomOpenDegInner ?? config.transomOpenDeg,
          },
        },
        {
          z: depth - timber.sashDepth - 1.1,
          sign: -leafOpenSign,
          wood,
        },
      ]
    : [{ z: 1.35, sign: leafOpenSign, wood }]

  for (const layer of layers) {
    for (const leaf of layout.leaves) {
      const openLeaf = { ...leaf }
      if (layer.openOverride) {
        const arr = leaf.region === 'transom' ? layer.openOverride.transom : layer.openOverride.leaf
        if (arr) openLeaf.openDeg = arr[leaf.index] ?? leaf.openDeg
      }
      addLeafToWindow(
        group,
        openLeaf,
        width,
        height,
        layer.z,
        layer.sign,
        layer.wood,
        glassMat,
        layer.wood,
        blendInnerArch,
        blendInnerCrown,
        glazingForm,
        riseCm,
        timber,
        Boolean(config.profiledBars),
        Boolean(config.hardware),
        door,
      )
    }
  }

  return group
}


function svgY(originTop: number, openingHeight: number, barY: number, barH: number): number {
  return originTop + (openingHeight - barY - barH)
}

function svgPx(originX: number, x: number): number {
  return originX + x
}

function svgPy(originTop: number, openingHeight: number, y: number): number {
  return originTop + openingHeight - y
}

function svgArchedRectD(
  originX: number,
  originTop: number,
  openingHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  arch: ArchGeom | null,
): string {
  const sx = (px: number) => svgPx(originX, px)
  const sy = (py: number) => svgPy(originTop, openingHeight, py)
  if (!arch || !rectHitsArchCap(x, y, w, h, arch)) {
    return `M ${sx(x)} ${sy(y + h)} L ${sx(x + w)} ${sy(y + h)} L ${sx(x + w)} ${sy(y)} L ${sx(x)} ${sy(y)} Z`
  }
  const x0 = x
  const x1 = x + w
  const y0 = y
  const y1 = y + h
  const samples = archPolyline(arch, ARCH_CURVE_SEGMENTS, x0, x1)
  const parts = [`M ${sx(x0)} ${sy(y0)}`, `L ${sx(x1)} ${sy(y0)}`]
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    const p = samples[i]
    parts.push(`L ${sx(p.x)} ${sy(Math.min(y1, Math.max(y0, p.y)))}`)
  }
  parts.push('Z')
  return parts.join(' ')
}


function svgCrownRectD(
  originX: number,
  originTop: number,
  openingHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  form: ArchFormId,
  riseCm?: number | null,
): string {
  const sx = (px: number) => svgPx(originX, px)
  const sy = (py: number) => svgPy(originTop, openingHeight, py)
  if (form === 'rect' || w < 1 || h < 1) {
    return `M ${sx(x)} ${sy(y + h)} L ${sx(x + w)} ${sy(y + h)} L ${sx(x + w)} ${sy(y)} L ${sx(x)} ${sy(y)} Z`
  }
  const crown = glazingArchCrown(w, h, form, ARCH_MESH_SEGMENTS, riseCm).map((p) => ({
    x: x + p.x,
    y: y + p.y,
  }))
  const springY = crown[0]?.y ?? y + h
  const parts = [`M ${sx(x)} ${sy(y)}`, `L ${sx(x + w)} ${sy(y)}`, `L ${sx(x + w)} ${sy(springY)}`]
  for (let i = crown.length - 1; i >= 0; i -= 1) {
    const p = crown[i]!
    parts.push(`L ${sx(p.x)} ${sy(Math.min(y + h, Math.max(y, p.y)))}`)
  }
  parts.push('Z')
  return parts.join(' ')
}


/** Rechteck gegen globale Krone clippen (Öffnungskoordinaten) — kein Mini-Bogen. */
function svgCrownClippedRectD(
  originX: number,
  originTop: number,
  openingHeight: number,
  x: number,
  y: number,
  w: number,
  h: number,
  crown: { x: number; y: number }[],
): string {
  const sx = (px: number) => svgPx(originX, px)
  const sy = (py: number) => svgPy(originTop, openingHeight, py)
  if (!rectHitsCrown(x, y, w, h, crown)) {
    return `M ${sx(x)} ${sy(y + h)} L ${sx(x + w)} ${sy(y + h)} L ${sx(x + w)} ${sy(y)} L ${sx(x)} ${sy(y)} Z`
  }
  const x0 = x
  const x1 = x + w
  const y0 = y
  const y1 = y + h
  const samples = sampleCrownBetween(crown, x0, x1).map((p) => ({
    x: p.x,
    y: Math.min(y1, Math.max(y0, p.y)),
  }))
  const parts = [`M ${sx(x0)} ${sy(y0)}`, `L ${sx(x1)} ${sy(y0)}`]
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    parts.push(`L ${sx(samples[i]!.x)} ${sy(samples[i]!.y)}`)
  }
  parts.push('Z')
  return parts.join(' ')
}

export function appendGruenderzeitSvg(
  parent: SVGElement,
  layout: GruenderzeitLayout,
  originX: number,
  originTop: number,
  openingHeight: number,
  frameColor: string,
  glassColor: string | OpeningGlassConfig,
  lineStyle: boolean,
) {
  const ns = 'http://www.w3.org/2000/svg'
  const glassHex = typeof glassColor === 'string' ? glassColor : glassColor.color
  const add = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke: string,
    strokeWidth: number,
    fillOpacity?: number,
  ) => {
    const rect = document.createElementNS(ns, 'rect')
    rect.setAttribute('x', String(x))
    rect.setAttribute('y', String(y))
    rect.setAttribute('width', String(w))
    rect.setAttribute('height', String(h))
    rect.setAttribute('fill', fill)
    if (fillOpacity !== undefined) rect.setAttribute('fill-opacity', String(fillOpacity))
    rect.setAttribute('stroke', stroke)
    rect.setAttribute('stroke-width', String(strokeWidth))
    rect.setAttribute('pointer-events', 'none')
    parent.appendChild(rect)
  }
  const addPath = (
    d: string,
    fill: string,
    stroke: string,
    strokeWidth: number,
    fillOpacity?: number,
    fillRule?: string,
  ) => {
    const path = document.createElementNS(ns, 'path')
    path.setAttribute('d', d)
    path.setAttribute('fill', fill)
    if (fillOpacity !== undefined) path.setAttribute('fill-opacity', String(fillOpacity))
    if (fillRule) path.setAttribute('fill-rule', fillRule)
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', String(strokeWidth))
    path.setAttribute('pointer-events', 'none')
    parent.appendChild(path)
  }

  const woodFill = lineStyle ? '#ffffff' : frameColor
  const woodStroke = lineStyle ? '#000000' : '#2a2a2a'
  const glassFill = lineStyle
    ? '#ffffff'
    : isTransparentGlass(glassHex)
      ? '#3A6084'
      : glassHex
  const glassStroke = lineStyle ? '#000000' : frameColor
  const glazingForm = layout.glazingForm ?? (layout.glazingArch ? 'round' : 'rect')
  const riseCm = layout.riseCm
  const outerArch = glazingForm === 'round' ? glazingArchGeom(layout.width, layout.height, riseCm) : null
  const blendInnerArch = outerArch ? insetArchGeom(outerArch, TIMBER.blend) : null
  const sashInnerArch = blendInnerArch ? insetArchGeom(blendInnerArch, TIMBER.sash) : null
  const blendInnerCrown =
    glazingForm !== 'rect' && glazingForm !== 'round'
      ? glazingArchCrown(
          Math.max(2, layout.width - 2 * TIMBER.blend),
          Math.max(2, layout.height - 2 * TIMBER.blend),
          glazingForm,
          ARCH_MESH_SEGMENTS,
          riseCm,
        ).map((p) => ({ x: p.x + TIMBER.blend, y: p.y + TIMBER.blend }))
      : null

  if (glazingForm !== 'rect' && glazingForm !== 'round') {
    const ring = [
      svgCrownRectD(
        originX,
        originTop,
        openingHeight,
        0,
        0,
        layout.width,
        layout.height,
        glazingForm,
        riseCm,
      ),
      svgCrownRectD(
        originX,
        originTop,
        openingHeight,
        TIMBER.blend,
        TIMBER.blend,
        layout.width - TIMBER.blend * 2,
        layout.height - TIMBER.blend * 2,
        glazingForm,
        riseCm,
      ),
    ].join(' ')
    addPath(ring, woodFill, woodStroke, lineStyle ? 1.1 : 0.35, undefined, 'evenodd')
  } else if (outerArch && blendInnerArch) {
    const ring = [
      svgArchedRectD(originX, originTop, openingHeight, 0, 0, layout.width, layout.height, outerArch),
      svgArchedRectD(
        originX,
        originTop,
        openingHeight,
        TIMBER.blend,
        TIMBER.blend,
        layout.width - TIMBER.blend * 2,
        layout.height - TIMBER.blend * 2,
        blendInnerArch,
      ),
    ].join(' ')
    addPath(ring, woodFill, woodStroke, lineStyle ? 1.1 : 0.35, undefined, 'evenodd')
  }

  for (const bar of layout.bars) {
    if ((outerArch || blendInnerCrown) && bar.kind === 'frame') continue
    const clipped = clipBarToArch(bar, blendInnerArch, blendInnerCrown)
    if (!clipped) continue
    add(
      originX + clipped.x,
      svgY(originTop, openingHeight, clipped.y, clipped.h),
      clipped.w,
      clipped.h,
      woodFill,
      woodStroke,
      lineStyle ? (bar.kind === 'frame' ? 1.1 : 0.8) : 0.35,
    )
  }

  const sashInnerCrown =
    glazingForm !== 'rect' && glazingForm !== 'round'
      ? glazingArchCrown(
          Math.max(2, layout.width - 2 * (TIMBER.blend + TIMBER.sash)),
          Math.max(2, layout.height - 2 * (TIMBER.blend + TIMBER.sash)),
          glazingForm,
          ARCH_MESH_SEGMENTS,
          riseCm,
        ).map((p) => ({
          x: p.x + TIMBER.blend + TIMBER.sash,
          y: p.y + TIMBER.blend + TIMBER.sash,
        }))
      : null

  for (const leaf of layout.leaves) {
    const lx = originX + leaf.x
    const ly = (localY: number, localH: number) => svgY(originTop, openingHeight, leaf.y + localY, localH)
    const leafSashInner = sashInnerArch ? offsetArchGeom(sashInnerArch, -leaf.x, -leaf.y) : null
    if (blendInnerArch) {
      const ring = [
        svgArchedRectD(originX, originTop, openingHeight, leaf.x, leaf.y, leaf.w, leaf.h, blendInnerArch),
        svgArchedRectD(
          originX,
          originTop,
          openingHeight,
          leaf.x + TIMBER.sash,
          leaf.y + TIMBER.sash,
          leaf.w - TIMBER.sash * 2,
          leaf.h - TIMBER.sash * 2,
          sashInnerArch,
        ),
      ].join(' ')
      addPath(ring, woodFill, woodStroke, lineStyle ? 0.75 : 0.9, undefined, 'evenodd')
    } else if (blendInnerCrown && sashInnerCrown) {
      const ring = [
        svgCrownClippedRectD(
          originX,
          originTop,
          openingHeight,
          leaf.x,
          leaf.y,
          leaf.w,
          leaf.h,
          blendInnerCrown,
        ),
        svgCrownClippedRectD(
          originX,
          originTop,
          openingHeight,
          leaf.x + TIMBER.sash,
          leaf.y + TIMBER.sash,
          leaf.w - TIMBER.sash * 2,
          leaf.h - TIMBER.sash * 2,
          sashInnerCrown,
        ),
      ].join(' ')
      addPath(ring, woodFill, woodStroke, lineStyle ? 0.75 : 0.9, undefined, 'evenodd')
    }
    for (const pane of leaf.panes) {
      const paneArch = sashInnerArch
      const paneHitsCrown =
        sashInnerCrown &&
        rectHitsCrown(leaf.x + pane.x, leaf.y + pane.y, pane.w, pane.h, sashInnerCrown)
      if (paneArch && rectHitsArchCap(leaf.x + pane.x, leaf.y + pane.y, pane.w, pane.h, paneArch)) {
        addPath(
          svgArchedRectD(
            originX,
            originTop,
            openingHeight,
            leaf.x + pane.x,
            leaf.y + pane.y,
            pane.w,
            pane.h,
            paneArch,
          ),
          glassFill,
          glassStroke,
          lineStyle ? 0.7 : 0.5,
          lineStyle ? undefined : isTransparentGlass(glassHex) ? 0.12 : 0.4,
        )
      } else if (paneHitsCrown && sashInnerCrown) {
        addPath(
          svgCrownClippedRectD(
            originX,
            originTop,
            openingHeight,
            leaf.x + pane.x,
            leaf.y + pane.y,
            pane.w,
            pane.h,
            sashInnerCrown,
          ),
          glassFill,
          glassStroke,
          lineStyle ? 0.7 : 0.5,
          lineStyle ? undefined : isTransparentGlass(glassHex) ? 0.12 : 0.4,
        )
      } else {
        add(
          lx + pane.x,
          ly(pane.y, pane.h),
          pane.w,
          pane.h,
          glassFill,
          glassStroke,
          lineStyle ? 0.7 : 0.5,
          lineStyle ? undefined : isTransparentGlass(glassHex) ? 0.12 : 0.4,
        )
      }
    }
    if (leaf.panel) {
      add(lx + leaf.panel.x, ly(leaf.panel.y, leaf.panel.h), leaf.panel.w, leaf.panel.h, woodFill, woodStroke, lineStyle ? 0.7 : 0.6)
      add(
        lx + leaf.panel.x + 1.6,
        ly(leaf.panel.y + 1.6, leaf.panel.h - 3.2),
        leaf.panel.w - 3.2,
        leaf.panel.h - 3.2,
        lineStyle ? '#ffffff' : frameColor,
        woodStroke,
        lineStyle ? 0.6 : 0.45,
      )
    }
    for (const bar of leaf.bars) {
      if ((blendInnerArch || blendInnerCrown) && bar.kind === 'sash') continue
      const localInnerCrown = sashInnerCrown
        ? offsetCrown(sashInnerCrown, -leaf.x, -leaf.y)
        : null
      const clipped = clipBarToArch(bar, leafSashInner, localInnerCrown)
      if (!clipped) continue
      add(
        lx + clipped.x,
        ly(clipped.y, clipped.h),
        clipped.w,
        clipped.h,
        woodFill,
        woodStroke,
        lineStyle ? (bar.kind === 'muntin' ? 0.6 : 0.75) : bar.kind === 'muntin' ? 0.7 : 0.9,
      )
    }
    if (leaf.openDeg > 4) {
      add(
        lx,
        ly(0, leaf.h),
        Math.max(1.2, leaf.w * 0.08),
        leaf.h,
        lineStyle ? '#000000' : 'rgba(0,0,0,0.18)',
        'none',
        0,
        lineStyle ? 1 : undefined,
      )
    }
  }
}

export function gruenderzeitPreviewSvg(
  width: number,
  height: number,
  config: GruenderzeitWindowConfig,
  frameColor: string,
  glassColor: string | OpeningGlassConfig,
  glazingArch: boolean | ArchFormId = false,
  riseCm?: number | null,
): string {
  const layout = layoutGruenderzeitWindow(width, height, config, glazingArch, riseCm)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  appendGruenderzeitSvg(svg, layout, 0, 0, height, frameColor, glassColor, false)
  return new XMLSerializer().serializeToString(svg)
}
