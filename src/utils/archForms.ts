/**
 * Klassische Bogenformen für Wandöffnungen und Verdachungen.
 * Kämpfer y=0, Scheitel +y, Spannweite entlang x.
 *
 * `basket` (Korbbogen) entfällt — Alt-Saves werden auf `ellipse` migriert.
 */

export type ArchFormId =
  | 'rect'
  | 'round'
  | 'pointed'
  | 'segmental'
  | 'lancet'
  | 'ellipse'
  | 'tudor'

export interface ArchPoint {
  x: number
  y: number
}

export const ARCH_FORM_IDS: readonly ArchFormId[] = [
  'rect',
  'round',
  'pointed',
  'segmental',
  'lancet',
  'ellipse',
  'tudor',
] as const

const LABELS: Record<ArchFormId, string> = {
  rect: 'Eckig',
  round: 'Rundbogen',
  pointed: 'Spitzbogen',
  segmental: 'Stichbogen',
  lancet: 'Lanzettbogen',
  ellipse: 'Ellipsenbogen',
  tudor: 'Tudorbogen',
}

/** Stichmaß / Spannweite — null = rechteckig. */
const RISE_RATIO: Record<ArchFormId, number | null> = {
  rect: null,
  round: 0.5,
  pointed: Math.sqrt(3) / 2,
  segmental: 1 / 6,
  lancet: 1,
  ellipse: 1 / 3,
  tudor: 0.3,
}

/** Mindest-Stichmaß (cm); 8-cm-Raster. */
export const ARCH_RISE_STEP_CM = 8
export const ARCH_RISE_MIN_CM = 8

export function isArchFormId(value: unknown): value is ArchFormId {
  return typeof value === 'string' && (ARCH_FORM_IDS as readonly string[]).includes(value)
}

/** Mappt Legacy `basket` → `ellipse`. */
export function normalizeArchFormId(raw: unknown, fallback: ArchFormId = 'rect'): ArchFormId {
  if (raw === 'basket') return 'ellipse'
  return isArchFormId(raw) ? raw : fallback
}

export function archFormLabel(form: ArchFormId): string {
  return LABELS[form]
}

export function defaultArchRiseRatio(form: ArchFormId): number | null {
  return RISE_RATIO[form]
}

export function defaultArchRise(form: ArchFormId, span: number): number {
  const ratio = defaultArchRiseRatio(form)
  if (ratio == null || !(span > 0)) return 0
  return span * ratio
}

export const ARCH_MIN_JAMB_BODY_CM = 24

/** Maximales Stichmaß: genug gerader Leibungskörper unter dem Kämpfer. */
export function maxArchRiseForOpening(
  openingHeight: number,
  minJambBodyCm = ARCH_MIN_JAMB_BODY_CM,
): number {
  if (!(openingHeight > 0)) return 0
  return Math.max(0, openingHeight - Math.min(minJambBodyCm, openingHeight * 0.35))
}

export function snapArchRiseCm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.max(ARCH_RISE_MIN_CM, Math.round(value / ARCH_RISE_STEP_CM) * ARCH_RISE_STEP_CM)
}

/**
 * Stichmaß der Öffnungskrone.
 * `riseCm` gesetzt → Nutzerwert (gerastert), sonst Form-Standard; stets auf Max geklemmt.
 * Rundbogen zusätzlich ≤ Spannweite/2.
 */
export function resolveArchRiseForOpening(
  form: ArchFormId,
  span: number,
  openingHeight: number,
  riseCm?: number | null,
  minJambBodyCm = ARCH_MIN_JAMB_BODY_CM,
): number {
  if (form === 'rect') return 0
  const maxRise = maxArchRiseForOpening(openingHeight, minJambBodyCm)
  if (maxRise <= 0) return 0
  const ideal =
    riseCm != null && Number.isFinite(riseCm) && riseCm > 0
      ? snapArchRiseCm(riseCm)
      : defaultArchRise(form, span)
  if (ideal <= 0) return 0
  let capped = Math.min(ideal, maxRise)
  if (form === 'round') capped = Math.min(capped, span / 2)
  return capped
}

/** @deprecated Nutze `resolveArchRiseForOpening` — ohne Nutzer-`riseCm`. */
export function clampArchRiseForOpening(
  form: ArchFormId,
  span: number,
  openingHeight: number,
  minJambBodyCm = ARCH_MIN_JAMB_BODY_CM,
): number {
  return resolveArchRiseForOpening(form, span, openingHeight, undefined, minJambBodyCm)
}

export function archFormIsCurved(form: ArchFormId): boolean {
  return form !== 'rect'
}

function sampleCircularArc(
  cx: number,
  cy: number,
  r: number,
  theta0: number,
  theta1: number,
  segments: number,
): ArchPoint[] {
  const n = Math.max(2, segments)
  const pts: ArchPoint[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = theta0 + ((theta1 - theta0) * i) / n
    pts.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r })
  }
  return pts
}

function sampleSegmentalCrown(span: number, rise: number, segments: number): ArchPoint[] {
  const c = span / 2
  if (rise < 1e-6) {
    return [
      { x: 0, y: 0 },
      { x: span, y: 0 },
    ]
  }
  const r = (c * c + rise * rise) / (2 * rise)
  const cy = rise - r
  const cx = c
  const t0 = Math.atan2(-cy, -cx)
  const t1 = Math.atan2(-cy, span - cx)
  return sampleCircularArc(cx, cy, r, t0, t1, segments)
}

/**
 * Spitzbogen (gleichseitig oder Lanzett): Zentren auf/außerhalb der Kämpfer.
 * Stichmaß wird auf mindestens gleichseitig angehoben — gedrückte Spitzbögen
 * sind mit dieser Zwei-Zentren-Konstruktion geometrisch unsauber.
 */
function samplePointedCrown(span: number, rise: number, segments: number): ArchPoint[] {
  const minRise = (Math.sqrt(3) / 2) * span
  const h = Math.max(rise, minRise)
  const cL = span / 4 + (h * h) / Math.max(span, 1e-6)
  const cR = span - cL
  const rL = Math.abs(cL)
  const rR = Math.abs(span - cR)
  const half = Math.max(4, Math.ceil(segments / 2))
  const pts: ArchPoint[] = []
  for (let i = 0; i <= half; i += 1) {
    const x = (span / 2) * (i / half)
    const y = Math.sqrt(Math.max(0, rL * rL - (x - cL) * (x - cL)))
    pts.push({ x, y })
  }
  for (let i = 1; i <= half; i += 1) {
    const x = span / 2 + (span / 2) * (i / half)
    const y = Math.sqrt(Math.max(0, rR * rR - (x - cR) * (x - cR)))
    pts.push({ x, y })
  }
  pts[half] = { x: span / 2, y: h }
  return pts
}

function sampleEllipseCrown(span: number, rise: number, segments: number): ArchPoint[] {
  const a = span / 2
  const b = Math.max(rise, 1e-6)
  const n = Math.max(4, segments)
  const pts: ArchPoint[] = []
  for (let i = 0; i <= n; i += 1) {
    const t = Math.PI - (Math.PI * i) / n
    pts.push({ x: a + a * Math.cos(t), y: b * Math.sin(t) })
  }
  return pts
}

/** Tudorbogen: flache Halbellipse (charakteristisch gedrückt). */
function sampleTudorCrown(span: number, rise: number, segments: number): ArchPoint[] {
  return sampleEllipseCrown(span, Math.max(rise, 1e-6), segments)
}

function sampleRoundCrown(span: number, rise: number, segments: number): ArchPoint[] {
  const r = Math.min(span / 2, Math.max(rise, 1e-6))
  return sampleCircularArc(span / 2, 0, r, Math.PI, 0, segments)
}

export function sampleArchCrown(
  form: ArchFormId,
  span: number,
  rise: number,
  segments = 32,
): ArchPoint[] {
  const s = Math.max(0, span)
  const h = Math.max(0, rise)
  if (s < 1e-6 || form === 'rect' || h < 1e-6) {
    return [
      { x: 0, y: 0 },
      { x: s, y: 0 },
    ]
  }
  switch (form) {
    case 'round':
      return sampleRoundCrown(s, h, segments)
    case 'pointed':
    case 'lancet':
      return samplePointedCrown(s, h, segments)
    case 'segmental':
      return sampleSegmentalCrown(s, h, segments)
    case 'ellipse':
      return sampleEllipseCrown(s, h, segments)
    case 'tudor':
      return sampleTudorCrown(s, h, segments)
    default:
      return [
        { x: 0, y: 0 },
        { x: s, y: 0 },
      ]
  }
}

export function sampleOpeningArchCrown(
  form: ArchFormId,
  openingX: number,
  openingY: number,
  width: number,
  height: number,
  segments = 32,
  riseCm?: number | null,
): ArchPoint[] {
  const rise = resolveArchRiseForOpening(form, width, height, riseCm)
  const springY = openingY + height - rise
  return sampleArchCrown(form, width, rise, segments).map((p) => ({
    x: openingX + p.x,
    y: springY + p.y,
  }))
}

export function archFormPreviewSvg(form: ArchFormId): string {
  const stroke = 'currentColor'
  const sw = 2.2
  if (form === 'rect') {
    return `<svg viewBox="0 0 48 28" width="48" height="28" aria-hidden="true"><path d="M10 24 V8 H38 V24" fill="none" stroke="${stroke}" stroke-width="${sw}"/></svg>`
  }
  const span = 28
  const rise = Math.min(defaultArchRise(form, span), 18)
  const crown = sampleArchCrown(form, span, rise, 24)
  const ox = 10
  const oy = 24
  const cmds = crown.map((p, i) => {
    const x = ox + p.x
    const y = oy - p.y
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  const path = `M${ox} 24 ${cmds.join(' ')} L${ox + span} 24`
  return `<svg viewBox="0 0 48 28" width="48" height="28" aria-hidden="true"><path d="${path}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></svg>`
}
