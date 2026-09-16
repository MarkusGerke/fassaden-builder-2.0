/**
 * Schicht-Editor (MVP): Reihen befüllen mit Muster/Maßen/Farbstufe.
 * Siehe docs/masonry-course-editor.md.
 */
import type {
  FacadeState,
  MasonryCourseOverride,
  StudioPanelConfig,
  StudioPanelPattern,
  Wall,
} from '../types/facade'
import { cloneWall } from '../types/facade'
import {
  DEFAULT_STUDIO_PANEL,
  clampStudioPanelSize,
  normalizeStudioPanel,
  studioPanelDefaultsForPattern,
} from './constants'
import { bayWallSkirtDropCm } from './bayWindow'
import {
  layoutTilesForCourseOverride,
  visiblePanelRowRange,
  type PanelTile,
} from './panelLayout'
import { isStudioWall } from './walls'
import { mapAllWalls } from '../utils/buildings'

const COURSE_EPS = 0.05
const DOMINO_STEP_MS = 42

export type MasonryCourseStaging = {
  pattern: StudioPanelPattern
  panelWidth: number
  panelHeight: number
  /** 0 = Basisfarbe; 1…7 = Stufen aus Kontrast-Palette. */
  colorStage: number
  rotated90: boolean
}

export function createDefaultCourseStaging(
  pattern: StudioPanelPattern = 'runningBond',
  panel?: Partial<StudioPanelConfig> | null,
): MasonryCourseStaging {
  const defaults = studioPanelDefaultsForPattern(pattern)
  const base = normalizeStudioPanel({
    ...DEFAULT_STUDIO_PANEL,
    ...defaults,
    ...(panel ?? {}),
    pattern,
    enabled: true,
  })
  return {
    pattern,
    panelWidth: clampStudioPanelSize(base.panelWidth),
    panelHeight: clampStudioPanelSize(base.panelHeight),
    colorStage: 0,
    rotated90: false,
  }
}

/** 0°/90°: Breite und Höhe tauschen. */
export function rotateCourseStaging(staging: MasonryCourseStaging): MasonryCourseStaging {
  return {
    ...staging,
    panelWidth: staging.panelHeight,
    panelHeight: staging.panelWidth,
    rotated90: !staging.rotated90,
  }
}

export function stagingEffectiveSizes(staging: MasonryCourseStaging): {
  panelWidth: number
  panelHeight: number
} {
  return {
    panelWidth: clampStudioPanelSize(staging.panelWidth),
    panelHeight: clampStudioPanelSize(staging.panelHeight),
  }
}

export function normalizeCourseOverrides(
  raw: MasonryCourseOverride[] | undefined | null,
): MasonryCourseOverride[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  const out: MasonryCourseOverride[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const y = Number(item.y)
    const height = Number(item.height)
    const panelWidth = clampStudioPanelSize(Number(item.panelWidth))
    const panelHeight = clampStudioPanelSize(Number(item.panelHeight))
    if (!Number.isFinite(y) || !Number.isFinite(height) || height < COURSE_EPS) continue
    if (item.pattern === 'none') continue
    const colorStage =
      typeof item.colorStage === 'number' && Number.isFinite(item.colorStage)
        ? Math.max(0, Math.min(7, Math.round(item.colorStage)))
        : undefined
    out.push({
      y: Math.max(0, y),
      height,
      pattern: item.pattern,
      panelWidth,
      panelHeight,
      ...(colorStage !== undefined ? { colorStage } : {}),
    })
  }
  out.sort((a, b) => a.y - b.y)
  return out
}

export function wallHasCourseOverrides(wall: Wall): boolean {
  return normalizeCourseOverrides(wall.courseOverrides).length > 0
}

/** Modul-Rasterband an localY (Höhe = Staging-Modul). */
export function courseBandAtLocalY(
  wall: Wall,
  localY: number,
  moduleHeight: number,
  allWalls: Wall[] = [],
): { y: number; height: number; rowIndex: number } | null {
  const h = clampStudioPanelSize(moduleHeight)
  if (h < COURSE_EPS || !Number.isFinite(localY)) return null
  const skirt = bayWallSkirtDropCm(wall, allWalls)
  const probe = normalizeStudioPanel({
    ...DEFAULT_STUDIO_PANEL,
    panelHeight: h,
    panelWidth: h,
    pattern: 'runningBond',
    enabled: true,
    hideRowsBottom: 0,
    hideRowsTop: 0,
  })
  const { rowCuts, firstVisibleRow, lastVisibleRow } = visiblePanelRowRange(
    wall.height,
    probe,
    skirt,
  )
  if (firstVisibleRow > lastVisibleRow) return null
  for (let i = firstVisibleRow; i <= lastVisibleRow; i += 1) {
    const y0 = rowCuts[i]!
    const y1 = rowCuts[i + 1]!
    if (localY >= y0 - COURSE_EPS && localY < y1 - COURSE_EPS) {
      return { y: y0, height: y1 - y0, rowIndex: i }
    }
  }
  if (localY >= (rowCuts[lastVisibleRow] ?? 0) - COURSE_EPS) {
    const y0 = rowCuts[lastVisibleRow]!
    const y1 = rowCuts[lastVisibleRow + 1]!
    return { y: y0, height: y1 - y0, rowIndex: lastVisibleRow }
  }
  return null
}

function tileOverlapsCourseY(tile: PanelTile, y: number, height: number): boolean {
  const t1 = tile.y + tile.height
  const c1 = y + height
  return Math.min(t1, c1) - Math.max(tile.y, y) > COURSE_EPS
}

export function panelConfigForCourse(
  base: StudioPanelConfig | undefined,
  course: Pick<MasonryCourseOverride, 'pattern' | 'panelWidth' | 'panelHeight'>,
): StudioPanelConfig {
  return normalizeStudioPanel({
    ...(base ?? DEFAULT_STUDIO_PANEL),
    pattern: course.pattern,
    panelWidth: course.panelWidth,
    panelHeight: course.panelHeight,
    enabled: true,
    hideRowsBottom: 0,
    hideRowsTop: 0,
  })
}

export function previewTilesForCourse(
  wall: Wall,
  basePanel: StudioPanelConfig | undefined,
  course: MasonryCourseOverride,
  allWalls: Wall[] = [],
): PanelTile[] {
  return layoutTilesForCourseOverride(wall, basePanel, course, allWalls)
}

export function upsertCourseOverride(
  existing: MasonryCourseOverride[] | undefined,
  next: MasonryCourseOverride,
): MasonryCourseOverride[] {
  const list = normalizeCourseOverrides(existing).filter(
    (o) =>
      !tileOverlapsCourseY({ x: 0, y: o.y, width: 1, height: o.height }, next.y, next.height),
  )
  list.push({
    y: next.y,
    height: next.height,
    pattern: next.pattern,
    panelWidth: clampStudioPanelSize(next.panelWidth),
    panelHeight: clampStudioPanelSize(next.panelHeight),
    ...(next.colorStage !== undefined
      ? { colorStage: Math.max(0, Math.min(7, Math.round(next.colorStage))) }
      : {}),
  })
  list.sort((a, b) => a.y - b.y)
  return list
}

export function courseFromStaging(
  band: { y: number; height: number },
  staging: MasonryCourseStaging,
): MasonryCourseOverride {
  const sizes = stagingEffectiveSizes(staging)
  return {
    y: band.y,
    height: band.height,
    pattern: staging.pattern,
    panelWidth: sizes.panelWidth,
    panelHeight: sizes.panelHeight,
    colorStage: Math.max(0, Math.min(7, Math.round(staging.colorStage))),
  }
}

/** Persistiert Override; aktiviert Paneel falls nötig; stellt Farbpalette sicher. */
export function updateWallCourseOverride(
  state: FacadeState,
  wallIds: string[],
  course: MasonryCourseOverride,
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    const cloned = cloneWall(wall)
    let panel = normalizeStudioPanel(cloned.panel ?? DEFAULT_STUDIO_PANEL)
    if (panel.enabled === false || panel.pattern === 'none') {
      panel = normalizeStudioPanel({
        ...panel,
        ...panelConfigForCourse(panel, course),
        pattern: course.pattern,
        enabled: true,
      })
    }
    const stage = course.colorStage ?? 0
    if (stage > 0) {
      const needVariety = Math.max(panel.tileColorVariety ?? 0, Math.round((stage / 7) * 100))
      const needVariance = Math.max(panel.tileColorVariance ?? 0, 35)
      panel = normalizeStudioPanel({
        ...panel,
        tileColorVariety: needVariety,
        tileColorVariance: needVariance,
      })
    }
    return {
      ...cloned,
      panel,
      courseOverrides: upsertCourseOverride(cloned.courseOverrides, course),
    }
  })
}

export function clearWallCourseOverrides(state: FacadeState, wallIds: string[]): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    const cloned = cloneWall(wall)
    if (!cloned.courseOverrides?.length) return cloned
    return { ...cloned, courseOverrides: undefined }
  })
}

export function dominoStepMs(): number {
  return DOMINO_STEP_MS
}
