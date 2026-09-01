import type {
  Opening,
  OpeningPediment,
  PedimentForm,
  Wall,
} from '../types/facade'
import {
  type ArchFormId,
  sampleArchCrown,
} from '../utils/archForms'
import {
  DEFAULT_PEDIMENT_CONSOLE_ID,
  DEFAULT_PEDIMENT_PROFILE_ID,
  isPedimentConsoleProfile,
  isPedimentProfile,
} from '../profiles/windowTrim'
import { STUDIO_MASONRY } from './constants'

const OVERHANG_MAX = 96
const GABLE_MAX = 96
const GABLE_WIDTH_MAX = 384
const CONSOLE_WIDTH_DEFAULT = 16
const CONSOLE_DEPTH_DEFAULT = 8
const CONSOLE_HEIGHT_DEFAULT = 64
const CONSOLE_WIDTH_MAX = 48
const CONSOLE_DEPTH_MAX = 32
const CONSOLE_HEIGHT_MAX = 192
const ARC_SEGMENTS = 16

export interface PedimentVec2 {
  x: number
  y: number
}

export interface PedimentGableLayout {
  x0: number
  x1: number
  gableLeft: number
  gableRight: number
  midX: number
  yBase: number
  gable: number
}

export function snapPedimentMeasure(value: number, min = 0, max = OVERHANG_MAX): number {
  if (!Number.isFinite(value)) return min
  const snapped = Math.round(value / STUDIO_MASONRY) * STUDIO_MASONRY
  return Math.max(min, Math.min(max, snapped))
}

export function defaultOpeningPediment(): OpeningPediment {
  return {
    enabled: false,
    form: 'straight',
    profileId: DEFAULT_PEDIMENT_PROFILE_ID,
    overhang: 8,
    gableHeight: 24,
    gableWidth: 0,
    sideArmWidth: 0,
    scale: 1,
    offsetUp: 0,
    offsetForward: 0,
    consoles: {
      enabled: false,
      profileId: DEFAULT_PEDIMENT_CONSOLE_ID,
      width: CONSOLE_WIDTH_DEFAULT,
      depth: CONSOLE_DEPTH_DEFAULT,
      height: CONSOLE_HEIGHT_DEFAULT,
    },
  }
}

const PEDIMENT_FORMS: PedimentForm[] = [
  'straight',
  'triangle',
  'segment',
  'triangleClosed',
  'segmentClosed',
  'round',
  'pointed',
  'segmental',
  'lancet',
  'ellipse',
  'tudor',
]

const ARCH_PEDIMENT_FORMS: readonly ArchFormId[] = [
  'round',
  'pointed',
  'segmental',
  'lancet',
  'ellipse',
  'tudor',
]

function normalizeForm(raw: string | undefined): PedimentForm {
  if (raw === 'basket') return 'ellipse'
  if (raw && PEDIMENT_FORMS.includes(raw as PedimentForm)) return raw as PedimentForm
  return 'straight'
}

export function pedimentFormIsClosed(form: PedimentForm): boolean {
  return form === 'triangleClosed' || form === 'segmentClosed'
}

export function pedimentFormIsSegment(form: PedimentForm): boolean {
  return (
    form === 'segment' ||
    form === 'segmentClosed' ||
    form === 'segmental' ||
    (ARCH_PEDIMENT_FORMS as readonly string[]).includes(form)
  )
}

export function pedimentFormToArchForm(form: PedimentForm): ArchFormId | null {
  if (form === 'segment' || form === 'segmentClosed' || form === 'segmental') return 'segmental'
  if ((ARCH_PEDIMENT_FORMS as readonly string[]).includes(form)) return form as ArchFormId
  return null
}

export function pedimentFormSupportsGableDims(form: PedimentForm): boolean {
  return form !== 'straight'
}

export function normalizeOpeningPediment(
  raw: Partial<OpeningPediment> | undefined,
): OpeningPediment {
  const base = defaultOpeningPediment()
  const profileId =
    raw?.profileId && isPedimentProfile(raw.profileId)
      ? raw.profileId
      : base.profileId
  const consoleRaw = raw?.consoles
  const consoleProfile =
    consoleRaw?.profileId && isPedimentConsoleProfile(consoleRaw.profileId)
      ? consoleRaw.profileId
      : DEFAULT_PEDIMENT_CONSOLE_ID
  return {
    enabled: Boolean(raw?.enabled),
    form: normalizeForm(raw?.form),
    profileId,
    overhang: snapPedimentMeasure(
      raw?.overhang ??
        raw?.overhangLeft ??
        raw?.overhangRight ??
        base.overhang ??
        8,
      0,
      OVERHANG_MAX,
    ),
    gableHeight: snapPedimentMeasure(
      raw?.gableHeight ?? base.gableHeight ?? 24,
      STUDIO_MASONRY,
      GABLE_MAX,
    ),
    gableWidth: snapPedimentMeasure(raw?.gableWidth ?? 0, 0, GABLE_WIDTH_MAX),
    sideArmWidth: snapPedimentMeasure(raw?.sideArmWidth ?? 0, 0, OVERHANG_MAX),
    scale:
      Number.isFinite(raw?.scale) && (raw?.scale as number) > 0
        ? Math.min(4, Math.max(0.25, raw!.scale!))
        : 1,
    extentOutCm:
      Number.isFinite(raw?.extentOutCm) && (raw?.extentOutCm as number) > 0
        ? Math.min(192, Math.max(1, raw!.extentOutCm!))
        : undefined,
    extentForwardCm:
      Number.isFinite(raw?.extentForwardCm) && (raw?.extentForwardCm as number) > 0
        ? Math.min(96, Math.max(1, raw!.extentForwardCm!))
        : undefined,
    color: raw?.color,
    finish:
      raw?.finish === 'glossy' || raw?.finish === 'metal' || raw?.finish === 'matte'
        ? raw.finish
        : undefined,
    offsetUp: snapPedimentMeasure(raw?.offsetUp ?? 0, -OVERHANG_MAX, OVERHANG_MAX),
    offsetForward: Number.isFinite(raw?.offsetForward) ? Number(raw!.offsetForward) : 0,
    consoles: {
      enabled: Boolean(consoleRaw?.enabled),
      profileId: consoleProfile,
      width: snapPedimentMeasure(
        consoleRaw?.width ?? CONSOLE_WIDTH_DEFAULT,
        STUDIO_MASONRY,
        CONSOLE_WIDTH_MAX,
      ),
      depth: snapPedimentMeasure(
        consoleRaw?.depth ?? CONSOLE_DEPTH_DEFAULT,
        STUDIO_MASONRY,
        CONSOLE_DEPTH_MAX,
      ),
      height: snapPedimentMeasure(
        consoleRaw?.height ?? CONSOLE_HEIGHT_DEFAULT,
        STUDIO_MASONRY,
        CONSOLE_HEIGHT_MAX,
      ),
      wallOffset: snapPedimentMeasure(consoleRaw?.wallOffset ?? 0, 0, 96),
    },
  }
}

/** Giebel-Layout in Wand-XY (0 = links/unten). Breite = Öffnung + 2× Überstand. */
export function pedimentGableLayout(
  opening: Opening,
  pediment: OpeningPediment,
  baseLiftCm = 0,
): PedimentGableLayout {
  const overhang = pediment.overhang ?? pediment.overhangLeft ?? pediment.overhangRight ?? 8
  const x0 = opening.x - overhang
  const x1 = opening.x + opening.width + overhang
  const midX = opening.x + opening.width / 2
  const lift = Number.isFinite(baseLiftCm) ? baseLiftCm : 0
  const yBase = opening.y + opening.height + lift
  const gable = pediment.gableHeight ?? 24
  return { x0, x1, gableLeft: x0, gableRight: x1, midX, yBase, gable }
}

/** Spannweite und Basis-Y der Verdachung in Wand-Lokalraum (Wandmitte = 0). */
export function pedimentSpanLocal(
  wall: Wall,
  opening: Opening,
  pediment: OpeningPediment,
  baseLiftCm = 0,
) {
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const layout = pedimentGableLayout(opening, pediment, baseLiftCm)
  return {
    x0: layout.x0 - halfW,
    x1: layout.x1 - halfW,
    yBase: layout.yBase - halfH,
    gable: layout.gable,
    gableLeft: layout.gableLeft - halfW,
    gableRight: layout.gableRight - halfW,
    midX: layout.midX - halfW,
  }
}

/** Aufriss-Punkte (Wand-XY, Ursprung unten links an der Wand). */
export function pedimentOutlineWallXy(
  opening: Opening,
  pediment: OpeningPediment,
  baseLiftCm = 0,
): PedimentVec2[] {
  const layout = pedimentGableLayout(opening, pediment, baseLiftCm)
  return pedimentFormPoints(pediment.form, layout)
}

export function pedimentFormPoints(
  form: PedimentForm,
  layout: PedimentGableLayout,
): PedimentVec2[] {
  const { x0, x1, gableLeft, gableRight, midX, yBase, gable } = layout
  if (form === 'straight') {
    return [
      { x: x0, y: yBase },
      { x: x1, y: yBase },
    ]
  }
  if (form === 'triangle' || form === 'triangleClosed') {
    const peak = { x: midX, y: yBase + gable }
    const leftBase = { x: gableLeft, y: yBase }
    const rightBase = { x: gableRight, y: yBase }
    if (form === 'triangleClosed') {
      return [leftBase, peak, rightBase]
    }
    const points: PedimentVec2[] = []
    if (x0 < gableLeft - 1e-6) points.push({ x: x0, y: yBase })
    points.push(leftBase, peak, rightBase)
    if (x1 > gableRight + 1e-6) points.push({ x: x1, y: yBase })
    return points
  }
  const archForm = pedimentFormToArchForm(form) ?? 'segmental'
  const span = gableRight - gableLeft
  const rise = Math.max(gable, 1e-6)
  const arc = sampleArchCrown(archForm, span, rise, ARC_SEGMENTS).map((p) => ({
    x: gableLeft + p.x,
    y: yBase + p.y,
  }))
  if (form === 'segmentClosed') {
    return arc
  }
  const points: PedimentVec2[] = []
  if (x0 < gableLeft - 1e-6) points.push({ x: x0, y: yBase })
  for (const p of arc) points.push(p)
  if (x1 > gableRight + 1e-6) points.push({ x: x1, y: yBase })
  return points
}


/** Linke Normale je Segment (Pfad von links nach rechts → oben). */
export function pedimentSegmentOutwards(points: PedimentVec2[], closed = false): PedimentVec2[] {
  const outward: PedimentVec2[] = []
  if (points.length < 2) return outward
  const segmentCount = closed ? points.length : points.length - 1
  for (let i = 0; i < segmentCount; i += 1) {
    const a = points[i]!
    const b = points[(i + 1) % points.length]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    outward.push({ x: -dy / len, y: dx / len })
  }
  return outward
}
