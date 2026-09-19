/**
 * Schicht-Editor (MVP): Reihen befüllen mit Muster/Maßen/Farbstufe/Verband-Ebene.
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
  patternCoursePhaseCount,
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
  /** Steintiefe / Vorstand (cm). */
  projectDepth: number
  /** Bossen-Trapez-Vorstand (cm); 0 = flach. */
  taperDepth: number
  /** Bossenprofil 0…1 (1 = flach, 0 = spitz). */
  taper: number
  /** `all` = Trapez; `lr` = Keil nur links/rechts. */
  taperSides: 'all' | 'lr'
  /** 0…phaseCount−1 — welche Lage des Verbands. */
  coursePhase: number
  /** 0 = Basisfarbe; 1…7 = Stufen aus Kontrast-Palette. */
  colorStage: number
  rotated90: boolean
}

function clampCourseTaper(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, value))
}

function clampCourseTaperDepth(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value)
}

function normalizeTaperSides(value: unknown): 'all' | 'lr' {
  return value === 'lr' ? 'lr' : 'all'
}

export function clampCoursePhase(pattern: StudioPanelPattern, phase: number): number {
  const n = Math.max(1, patternCoursePhaseCount(pattern))
  if (!Number.isFinite(phase)) return 0
  return ((Math.round(phase) % n) + n) % n
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
    projectDepth: Math.max(0, Number(base.projectDepth) || 0),
    taperDepth: clampCourseTaperDepth(Number(base.taperDepth) || 0),
    taper: clampCourseTaper(Number(base.taper) || 1),
    taperSides: 'all',
    coursePhase: 0,
    colorStage: 0,
    rotated90: false,
  }
}

/** 0°/90°: Breite und Höhe tauschen (Tiefe und Verband-Ebene bleiben). */
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
  projectDepth: number
} {
  return {
    panelWidth: clampStudioPanelSize(staging.panelWidth),
    panelHeight: clampStudioPanelSize(staging.panelHeight),
    projectDepth: Math.max(0, Number(staging.projectDepth) || 0),
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
    const projectDepth =
      typeof item.projectDepth === 'number' && Number.isFinite(item.projectDepth)
        ? Math.max(0, item.projectDepth)
        : undefined
    const coursePhase =
      typeof item.coursePhase === 'number' && Number.isFinite(item.coursePhase)
        ? clampCoursePhase(item.pattern, item.coursePhase)
        : undefined
    const taperDepth =
      typeof item.taperDepth === 'number' && Number.isFinite(item.taperDepth)
        ? clampCourseTaperDepth(item.taperDepth)
        : undefined
    const taper =
      typeof item.taper === 'number' && Number.isFinite(item.taper)
        ? clampCourseTaper(item.taper)
        : undefined
    const taperSides =
      item.taperSides === 'lr' || item.taperSides === 'all' ? item.taperSides : undefined
    out.push({
      y: Math.max(0, y),
      height,
      pattern: item.pattern,
      panelWidth,
      panelHeight,
      ...(projectDepth !== undefined ? { projectDepth } : {}),
      ...(coursePhase !== undefined ? { coursePhase } : {}),
      ...(colorStage !== undefined ? { colorStage } : {}),
      ...(taperDepth !== undefined ? { taperDepth } : {}),
      ...(taper !== undefined ? { taper } : {}),
      ...(taperSides !== undefined ? { taperSides } : {}),
    })
  }
  out.sort((a, b) => a.y - b.y)
  return out
}

export function wallHasCourseOverrides(wall: Wall): boolean {
  return normalizeCourseOverrides(wall.courseOverrides).length > 0
}

/** Gesetzte Schicht unter localY (Wandfuß-Koordinaten). */
export function findCourseAtLocalY(
  wall: Wall,
  localY: number,
): MasonryCourseOverride | null {
  if (!Number.isFinite(localY)) return null
  const list = normalizeCourseOverrides(wall.courseOverrides)
  for (const o of list) {
    if (localY >= o.y - COURSE_EPS && localY < o.y + o.height - COURSE_EPS) return o
  }
  if (list.length === 0) return null
  const last = list[list.length - 1]!
  if (localY >= last.y - COURSE_EPS && localY <= last.y + last.height + COURSE_EPS) return last
  return null
}

export function stagingFromCourse(course: MasonryCourseOverride): MasonryCourseStaging {
  return {
    pattern: course.pattern,
    panelWidth: clampStudioPanelSize(course.panelWidth),
    panelHeight: clampStudioPanelSize(course.panelHeight),
    projectDepth:
      typeof course.projectDepth === 'number' && Number.isFinite(course.projectDepth)
        ? Math.max(0, course.projectDepth)
        : DEFAULT_STUDIO_PANEL.projectDepth,
    taperDepth: clampCourseTaperDepth(
      typeof course.taperDepth === 'number' ? course.taperDepth : 0,
    ),
    taper: clampCourseTaper(typeof course.taper === 'number' ? course.taper : 0.8),
    taperSides: normalizeTaperSides(course.taperSides),
    coursePhase: clampCoursePhase(course.pattern, course.coursePhase ?? 0),
    colorStage:
      typeof course.colorStage === 'number' && Number.isFinite(course.colorStage)
        ? Math.max(0, Math.min(7, Math.round(course.colorStage)))
        : 0,
    rotated90: false,
  }
}

export function removeCourseOverride(
  existing: MasonryCourseOverride[] | undefined,
  band: { y: number; height: number },
): MasonryCourseOverride[] {
  return normalizeCourseOverrides(existing).filter(
    (o) =>
      !tileOverlapsCourseY({ x: 0, y: o.y, width: 1, height: o.height }, band.y, band.height),
  )
}

export function deleteWallCourseOverride(
  state: FacadeState,
  wallIds: string[],
  band: { y: number; height: number },
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return cloneWall(wall)
    const cloned = cloneWall(wall)
    const next = removeCourseOverride(cloned.courseOverrides, band)
    return {
      ...cloned,
      courseOverrides: next.length > 0 ? next : undefined,
    }
  })
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
  course: Pick<
    MasonryCourseOverride,
    'pattern' | 'panelWidth' | 'panelHeight' | 'projectDepth' | 'taperDepth' | 'taper'
  >,
): StudioPanelConfig {
  return normalizeStudioPanel({
    ...(base ?? DEFAULT_STUDIO_PANEL),
    pattern: course.pattern,
    panelWidth: course.panelWidth,
    panelHeight: course.panelHeight,
    ...(course.projectDepth !== undefined ? { projectDepth: course.projectDepth } : {}),
    ...(course.taperDepth !== undefined ? { taperDepth: course.taperDepth } : {}),
    ...(course.taper !== undefined ? { taper: course.taper } : {}),
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
    ...(next.projectDepth !== undefined
      ? { projectDepth: Math.max(0, next.projectDepth) }
      : {}),
    ...(next.coursePhase !== undefined
      ? { coursePhase: clampCoursePhase(next.pattern, next.coursePhase) }
      : {}),
    ...(next.colorStage !== undefined
      ? { colorStage: Math.max(0, Math.min(7, Math.round(next.colorStage))) }
      : {}),
    ...(next.taperDepth !== undefined
      ? { taperDepth: clampCourseTaperDepth(next.taperDepth) }
      : {}),
    ...(next.taper !== undefined ? { taper: clampCourseTaper(next.taper) } : {}),
    ...(next.taperSides === 'lr' || next.taperSides === 'all'
      ? { taperSides: next.taperSides }
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
  const taperDepth = clampCourseTaperDepth(staging.taperDepth)
  return {
    y: band.y,
    height: band.height,
    pattern: staging.pattern,
    panelWidth: sizes.panelWidth,
    panelHeight: sizes.panelHeight,
    projectDepth: sizes.projectDepth,
    coursePhase: clampCoursePhase(staging.pattern, staging.coursePhase),
    colorStage: Math.max(0, Math.min(7, Math.round(staging.colorStage))),
    taperDepth,
    taper: taperDepth > 0 ? clampCourseTaper(staging.taper) : 1,
    taperSides: taperDepth > 0 ? normalizeTaperSides(staging.taperSides) : 'all',
  }
}

/** Persistiert Override; nur gesetzte Reihen — kein wandweites Muster. */
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
    // Schicht-Editor: Basis-Muster aus — Layout zeichnet nur courseOverrides.
    // Maße/Vorstand behalten (Mörtel, Boss); Pattern bleibt none.
    const coursePanel = panelConfigForCourse(panel, course)
    panel = normalizeStudioPanel({
      ...panel,
      panelWidth: coursePanel.panelWidth,
      panelHeight: coursePanel.panelHeight,
      projectDepth: coursePanel.projectDepth,
      // Bossen bleiben pro Schicht (Tiles) — nicht auf die ganze Wand schreiben.
      joint: coursePanel.joint,
      pattern: 'none',
      enabled: true,
    })
    const stage = course.colorStage ?? 0
    if (stage > 0) {
      const needVariety = Math.max(panel.tileColorVariety ?? 0, Math.round((stage / 7) * 100))
      const needVariance = Math.max(panel.tileColorVariance ?? 0, 35)
      panel = normalizeStudioPanel({
        ...panel,
        tileColorVariety: needVariety,
        tileColorVariance: needVariance,
        pattern: 'none',
        enabled: true,
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
