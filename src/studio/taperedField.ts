import type { Opening, OpeningTaperedField, StudioPanelConfig } from '../types/facade'
import {
  buildSemicircularArchSpec,
  openingArchOutline,
  openingArchVoussoirsEnabled,
  type OpeningPoly,
} from '../utils/openingGeometry'
import { STUDIO_MASONRY } from './constants'

export const DEFAULT_TAPERED_FIELD_COURSES = 3
export const DEFAULT_TAPERED_FIELD_OVERHANG_CM = 8
/** Obere Breite / untere Breite (Default: nach oben verjüngend). */
export const DEFAULT_TAPERED_FIELD_TOP_WIDTH_RATIO = 0.55
export const DEFAULT_TAPERED_FIELD_OFFSET_UP_CM = 0
export const TAPERED_FIELD_COURSES_MIN = 1
export const TAPERED_FIELD_COURSES_MAX = 12
export const TAPERED_FIELD_OVERHANG_MAX = 96
export const TAPERED_FIELD_RATIO_MIN = 0.15
export const TAPERED_FIELD_RATIO_MAX = 1

export function defaultOpeningTaperedField(): OpeningTaperedField {
  return {
    enabled: false,
    courses: DEFAULT_TAPERED_FIELD_COURSES,
    overhangCm: DEFAULT_TAPERED_FIELD_OVERHANG_CM,
    topWidthRatio: DEFAULT_TAPERED_FIELD_TOP_WIDTH_RATIO,
    invert: false,
    offsetUpCm: DEFAULT_TAPERED_FIELD_OFFSET_UP_CM,
  }
}

function snapMeasure(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  const snapped = Math.round(value / STUDIO_MASONRY) * STUDIO_MASONRY
  return Math.max(min, Math.min(max, snapped))
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TAPERED_FIELD_TOP_WIDTH_RATIO
  return Math.max(TAPERED_FIELD_RATIO_MIN, Math.min(TAPERED_FIELD_RATIO_MAX, value))
}

export function normalizeOpeningTaperedField(
  raw: Partial<OpeningTaperedField> | undefined,
): OpeningTaperedField {
  const base = defaultOpeningTaperedField()
  if (!raw) return base
  const coursesRaw = raw.courses ?? base.courses!
  const courses = Math.max(
    TAPERED_FIELD_COURSES_MIN,
    Math.min(TAPERED_FIELD_COURSES_MAX, Math.round(Number(coursesRaw) || base.courses!)),
  )
  return {
    enabled: Boolean(raw.enabled),
    courses,
    overhangCm: snapMeasure(
      raw.overhangCm ?? base.overhangCm!,
      0,
      TAPERED_FIELD_OVERHANG_MAX,
    ),
    topWidthRatio: clampRatio(raw.topWidthRatio ?? base.topWidthRatio!),
    invert: Boolean(raw.invert),
    offsetUpCm: snapMeasure(
      raw.offsetUpCm ?? base.offsetUpCm!,
      0,
      TAPERED_FIELD_OVERHANG_MAX,
    ),
    courseHeightCm:
      raw.courseHeightCm != null && Number.isFinite(raw.courseHeightCm) && raw.courseHeightCm > 0
        ? snapMeasure(raw.courseHeightCm, STUDIO_MASONRY, 96)
        : undefined,
  }
}

/**
 * Oberkante der Öffnung für das Quaderfeld: Extrados (mit Voussoir),
 * sonst Bogenscheitel, sonst Sturz (eckig).
 */
export function taperedFieldBaseY(
  opening: Opening,
  panel?: Pick<StudioPanelConfig, 'panelWidth' | 'panelHeight' | 'joint'>,
): number {
  if (openingArchVoussoirsEnabled(opening) && panel) {
    const spec = buildSemicircularArchSpec(opening, {
      panelWidth: panel.panelWidth,
      panelHeight: panel.panelHeight,
      joint: panel.joint ?? 0.8,
      inflate: 0,
    })
    if (spec) return spec.cy + spec.rOuter
  }
  const outline = openingArchOutline(opening, 0)
  if (outline && outline.length >= 2) {
    let maxY = outline[0]!.y
    for (const p of outline) {
      if (p.y > maxY) maxY = p.y
    }
    return maxY
  }
  return opening.y + opening.height
}

export interface TaperedFieldCourseSpec {
  /** Unterkante der Lage (Wand-Y). */
  y0: number
  /** Oberkante der Lage (Wand-Y). */
  y1: number
  /** Breite an y0. */
  widthBottom: number
  /** Breite an y1. */
  widthTop: number
  /** Mittel-X. */
  cx: number
}

export interface TaperedFieldLayout {
  baseY: number
  courses: TaperedFieldCourseSpec[]
  /** AABB zum Entfernen des kartesischen Rasters. */
  aabb: { x: number; y: number; width: number; height: number }
  bottomWidth: number
  topWidth: number
}

/** Breiten an Unter- und Oberkante des Feldes. */
export function taperedFieldEndWidths(
  openingWidth: number,
  cfg: OpeningTaperedField,
): { bottomWidth: number; topWidth: number } {
  const overhang = cfg.overhangCm ?? DEFAULT_TAPERED_FIELD_OVERHANG_CM
  const ratio = cfg.topWidthRatio ?? DEFAULT_TAPERED_FIELD_TOP_WIDTH_RATIO
  const wide = Math.max(STUDIO_MASONRY, openingWidth + 2 * overhang)
  const narrow = Math.max(STUDIO_MASONRY, wide * ratio)
  if (cfg.invert) {
    // Nach unten verjüngend: unten schmal, oben breit (Überstand).
    return { bottomWidth: narrow, topWidth: wide }
  }
  // Default: unten an Öffnung (+ Überstand), nach oben schmaler.
  return { bottomWidth: wide, topWidth: narrow }
}

export function taperedFieldCourseWidths(
  bottomWidth: number,
  topWidth: number,
  courseCount: number,
): { widthBottom: number; widthTop: number }[] {
  const n = Math.max(1, Math.round(courseCount))
  const out: { widthBottom: number; widthTop: number }[] = []
  for (let i = 0; i < n; i += 1) {
    const t0 = i / n
    const t1 = (i + 1) / n
    out.push({
      widthBottom: bottomWidth + (topWidth - bottomWidth) * t0,
      widthTop: bottomWidth + (topWidth - bottomWidth) * t1,
    })
  }
  return out
}

export function buildTaperedFieldLayout(
  opening: Opening,
  cfg: OpeningTaperedField,
  panel: Pick<StudioPanelConfig, 'panelWidth' | 'panelHeight' | 'joint'>,
): TaperedFieldLayout | null {
  const normalized = normalizeOpeningTaperedField(cfg)
  if (!normalized.enabled) return null
  if (opening.hidden) return null
  if (opening.type !== 'window' && opening.type !== 'door' && opening.type !== 'conch') {
    return null
  }

  const courseH = Math.max(
    STUDIO_MASONRY,
    normalized.courseHeightCm ?? panel.panelHeight,
  )
  const n = normalized.courses ?? DEFAULT_TAPERED_FIELD_COURSES
  const { bottomWidth, topWidth } = taperedFieldEndWidths(opening.width, normalized)
  const widths = taperedFieldCourseWidths(bottomWidth, topWidth, n)
  const baseY = taperedFieldBaseY(opening, panel) + (normalized.offsetUpCm ?? 0)
  const cx = opening.x + opening.width / 2
  const joint = Math.max(0, panel.joint ?? 0.8)
  const stoneH = Math.max(2, courseH - joint)

  const courses: TaperedFieldCourseSpec[] = []
  for (let i = 0; i < widths.length; i += 1) {
    const y0 = baseY + i * courseH
    const y1 = y0 + stoneH
    courses.push({
      y0,
      y1,
      widthBottom: widths[i]!.widthBottom,
      widthTop: widths[i]!.widthTop,
      cx,
    })
  }

  const maxW = Math.max(bottomWidth, topWidth)
  const totalH = n * courseH
  return {
    baseY,
    courses,
    aabb: {
      x: cx - maxW / 2,
      y: baseY,
      width: maxW,
      height: totalH,
    },
    bottomWidth,
    topWidth,
  }
}

/** Trapez-Polygone (Outline) für Extrude — ohne Voussoir-Voraussetzung. */
export function taperedFieldPolysFromLayout(
  layout: TaperedFieldLayout,
  taperDepth?: number,
): OpeningPoly[] {
  const depth = taperDepth != null && taperDepth > 1e-6 ? taperDepth : undefined
  return layout.courses.map((c) => {
    const x0b = c.cx - c.widthBottom / 2
    const x1b = c.cx + c.widthBottom / 2
    const x0t = c.cx - c.widthTop / 2
    const x1t = c.cx + c.widthTop / 2
    const outline = [
      { x: x0b, y: c.y0 },
      { x: x1b, y: c.y0 },
      { x: x1t, y: c.y1 },
      { x: x0t, y: c.y1 },
    ]
    const minX = Math.min(x0b, x0t)
    const maxX = Math.max(x1b, x1t)
    return {
      x: minX,
      y: c.y0,
      width: maxX - minX,
      height: c.y1 - c.y0,
      outline,
      ...(depth != null ? { taperDepth: depth } : {}),
    }
  })
}

export function taperedFieldPolysForOpening(
  opening: Opening,
  panel: StudioPanelConfig,
): {
  polys: OpeningPoly[]
  /** Äußeres Trapez zum Entfernen des Rasters (kein AABB). */
  trap: {
    cx: number
    y0: number
    y1: number
    widthBottom: number
    widthTop: number
  }
} | null {
  const cfg = normalizeOpeningTaperedField(opening.taperedField)
  const layout = buildTaperedFieldLayout(opening, cfg, panel)
  if (!layout) return null
  const taperDepth = panel.taperDepth ?? 0
  return {
    polys: taperedFieldPolysFromLayout(layout, taperDepth),
    trap: {
      cx: opening.x + opening.width / 2,
      y0: layout.baseY,
      y1: layout.baseY + layout.aabb.height,
      widthBottom: layout.bottomWidth,
      widthTop: layout.topWidth,
    },
  }
}
