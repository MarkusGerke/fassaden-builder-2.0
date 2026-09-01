import type { Opening, OpeningMotion, MotionCurve, MotionKeyframe, MotionEase } from '../types/facade'

export const OPENING_MOTION_FORMAT = 'fassaden-opening-motion/v1'

const KEY_T_EPS = 0.004
export const MOTION_V_MIN = -0.2
export const MOTION_V_MAX = 1.35

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

/** Catmull-Rom auf Werte, u in 0…1 zwischen p1 und p2. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u
  const u3 = u2 * u
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u3
  )
}

function isEase(value: unknown): value is MotionEase {
  return value === 'linear' || value === 'smooth'
}

export function normalizeMotionKeyframe(raw: Partial<MotionKeyframe> | undefined, fallback: MotionKeyframe): MotionKeyframe {
  const t = typeof raw?.t === 'number' && Number.isFinite(raw.t) ? clamp(raw.t, 0, 1) : fallback.t
  const v = typeof raw?.v === 'number' && Number.isFinite(raw.v) ? clamp(raw.v, MOTION_V_MIN, MOTION_V_MAX) : fallback.v
  const ease: MotionEase = isEase(raw?.ease) ? raw.ease : (fallback.ease ?? 'smooth')
  return { t, v, ease }
}

export function normalizeMotionCurve(raw: Partial<MotionCurve> | undefined, fallback: MotionCurve): MotionCurve {
  const durationMs = Math.max(
    80,
    Math.round(typeof raw?.durationMs === 'number' && Number.isFinite(raw.durationMs) ? raw.durationMs : fallback.durationMs),
  )
  const holdMs = Math.max(
    0,
    Math.round(typeof raw?.holdMs === 'number' && Number.isFinite(raw.holdMs) ? raw.holdMs : (fallback.holdMs ?? 0)),
  )
  const src = Array.isArray(raw?.keys) && raw.keys.length >= 2 ? raw.keys : fallback.keys
  const keys = src
    .map((key, i) =>
      normalizeMotionKeyframe(key, fallback.keys[Math.min(i, fallback.keys.length - 1)] ?? { t: 0, v: 0, ease: 'smooth' }),
    )
    .sort((a, b) => a.t - b.t)
  if (keys.length === 0) {
    return { durationMs, holdMs, keys: fallback.keys.map((k) => ({ ...k })) }
  }
  keys[0] = { ...keys[0]!, t: 0 }
  keys[keys.length - 1] = { ...keys[keys.length - 1]!, t: 1 }
  const dedup: MotionKeyframe[] = []
  for (const key of keys) {
    const prev = dedup[dedup.length - 1]
    if (prev && Math.abs(prev.t - key.t) < KEY_T_EPS) {
      dedup[dedup.length - 1] = { ...key, t: prev.t }
      continue
    }
    dedup.push(key)
  }
  if (dedup.length < 2) {
    return { durationMs, holdMs, keys: fallback.keys.map((k) => ({ ...k })) }
  }
  dedup[0] = { ...dedup[0]!, t: 0 }
  dedup[dedup.length - 1] = { ...dedup[dedup.length - 1]!, t: 1 }
  return { durationMs, holdMs, keys: dedup }
}

/** Fenster: beschleunigt öffnen, leicht überdrehen, ein paar Grad zurück. */
export const DEFAULT_WINDOW_MOTION: OpeningMotion = {
  maxDeg: 80,
  open: {
    durationMs: 1400,
    holdMs: 0,
    keys: [
      { t: 0, v: 0, ease: 'smooth' },
      { t: 0.48, v: 0.42, ease: 'smooth' },
      { t: 0.78, v: 1.08, ease: 'smooth' },
      { t: 1, v: 1, ease: 'smooth' },
    ],
  },
  close: {
    durationMs: 1100,
    holdMs: 0,
    keys: [
      { t: 0, v: 1, ease: 'smooth' },
      { t: 0.4, v: 0.58, ease: 'smooth' },
      { t: 1, v: 0, ease: 'smooth' },
    ],
  },
}

/** Haustür: träger Start, dann schneller, letzte Winkel zäh, Pause, Fall mit Tempo. */
export const DEFAULT_DOOR_MOTION: OpeningMotion = {
  maxDeg: 80,
  open: {
    durationMs: 2400,
    holdMs: 900,
    keys: [
      { t: 0, v: 0, ease: 'smooth' },
      { t: 0.2, v: 0.05, ease: 'smooth' },
      { t: 0.52, v: 0.52, ease: 'smooth' },
      { t: 0.84, v: 0.9, ease: 'smooth' },
      { t: 1, v: 1, ease: 'smooth' },
    ],
  },
  close: {
    durationMs: 1900,
    holdMs: 0,
    keys: [
      { t: 0, v: 1, ease: 'smooth' },
      { t: 0.16, v: 0.94, ease: 'smooth' },
      { t: 0.5, v: 0.48, ease: 'smooth' },
      { t: 1, v: 0, ease: 'smooth' },
    ],
  },
}

export const LINEAR_MOTION: OpeningMotion = {
  maxDeg: 80,
  open: {
    durationMs: 1200,
    holdMs: 0,
    keys: [
      { t: 0, v: 0, ease: 'linear' },
      { t: 1, v: 1, ease: 'linear' },
    ],
  },
  close: {
    durationMs: 1200,
    holdMs: 0,
    keys: [
      { t: 0, v: 1, ease: 'linear' },
      { t: 1, v: 0, ease: 'linear' },
    ],
  },
}

export function defaultOpeningMotion(type: Opening['type']): OpeningMotion {
  if (type === 'door') return cloneOpeningMotion(DEFAULT_DOOR_MOTION)
  return cloneOpeningMotion(DEFAULT_WINDOW_MOTION)
}

export function cloneOpeningMotion(motion: OpeningMotion): OpeningMotion {
  return {
    maxDeg: motion.maxDeg,
    open: {
      durationMs: motion.open.durationMs,
      holdMs: motion.open.holdMs ?? 0,
      keys: motion.open.keys.map((k) => ({ ...k })),
    },
    close: {
      durationMs: motion.close.durationMs,
      holdMs: motion.close.holdMs ?? 0,
      keys: motion.close.keys.map((k) => ({ ...k })),
    },
  }
}

export function normalizeOpeningMotion(
  raw: Partial<OpeningMotion> | undefined,
  type: Opening['type'],
): OpeningMotion {
  const fallback = defaultOpeningMotion(type)
  const maxDeg = Math.round(
    clamp(typeof raw?.maxDeg === 'number' && Number.isFinite(raw.maxDeg) ? raw.maxDeg : fallback.maxDeg, 10, 120),
  )
  return {
    maxDeg,
    open: normalizeMotionCurve(raw?.open, fallback.open),
    close: normalizeMotionCurve(raw?.close, fallback.close),
  }
}

export function evalMotionCurve(curve: MotionCurve, tRaw: number): number {
  const keys = curve.keys
  if (keys.length === 0) return 0
  if (keys.length === 1) return keys[0]!.v
  const t = clamp(tRaw, 0, 1)
  if (t <= keys[0]!.t) return keys[0]!.v
  const last = keys[keys.length - 1]!
  if (t >= last.t) return last.v
  let i = 0
  while (i < keys.length - 2 && keys[i + 1]!.t < t) i += 1
  const a = keys[i]!
  const b = keys[i + 1]!
  const span = b.t - a.t
  const u = span < 1e-8 ? 1 : (t - a.t) / span
  if ((a.ease ?? 'smooth') === 'linear') return lerp(a.v, b.v, u)
  const p0 = keys[i - 1] ?? a
  const p3 = keys[i + 2] ?? b
  return catmullRom(p0.v, a.v, b.v, p3.v, u)
}

export function sampleMotionCurve(curve: MotionCurve, steps = 48): Array<{ t: number; v: number }> {
  const n = Math.max(8, steps)
  const out: Array<{ t: number; v: number }> = []
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    out.push({ t, v: evalMotionCurve(curve, t) })
  }
  return out
}

export function insertMotionKey(curve: MotionCurve, t: number, v: number): MotionCurve {
  const keys = curve.keys.map((k) => ({ ...k }))
  const nt = clamp(t, 0.02, 0.98)
  const nv = clamp(v, MOTION_V_MIN, MOTION_V_MAX)
  for (const key of keys) {
    if (Math.abs(key.t - nt) < 0.03) {
      key.v = nv
      return normalizeMotionCurve({ ...curve, keys }, curve)
    }
  }
  keys.push({ t: nt, v: nv, ease: 'smooth' })
  return normalizeMotionCurve({ ...curve, keys }, curve)
}

export function moveMotionKey(curve: MotionCurve, index: number, t: number, v: number): MotionCurve {
  const keys = curve.keys.map((k) => ({ ...k }))
  if (!keys[index]) return curve
  const first = index === 0
  const last = index === keys.length - 1
  keys[index] = {
    ...keys[index]!,
    t: first ? 0 : last ? 1 : clamp(t, 0.02, 0.98),
    v: clamp(v, MOTION_V_MIN, MOTION_V_MAX),
  }
  return normalizeMotionCurve({ ...curve, keys }, curve)
}

export function deleteMotionKey(curve: MotionCurve, index: number): MotionCurve {
  if (curve.keys.length <= 2) return curve
  if (index <= 0 || index >= curve.keys.length - 1) return curve
  const keys = curve.keys.filter((_, i) => i !== index)
  return normalizeMotionCurve({ ...curve, keys }, curve)
}

export function setMotionKeyEase(curve: MotionCurve, index: number, ease: MotionEase): MotionCurve {
  const keys = curve.keys.map((k, i) => (i === index ? { ...k, ease } : { ...k }))
  return normalizeMotionCurve({ ...curve, keys }, curve)
}

export interface OpeningMotionDataset {
  format: typeof OPENING_MOTION_FORMAT
  preset?: 'window' | 'door' | 'linear' | 'custom'
  maxDeg: number
  open: MotionCurve
  close: MotionCurve
}

export function openingMotionToDataset(motion: OpeningMotion, preset: OpeningMotionDataset['preset'] = 'custom'): OpeningMotionDataset {
  const cloned = cloneOpeningMotion(motion)
  return {
    format: OPENING_MOTION_FORMAT,
    preset,
    maxDeg: cloned.maxDeg,
    open: cloned.open,
    close: cloned.close,
  }
}

export function parseOpeningMotionDataset(raw: string, type: Opening['type']): OpeningMotion | null {
  try {
    const data = JSON.parse(raw) as Partial<OpeningMotionDataset> & Partial<OpeningMotion>
    if (!data || typeof data !== 'object') return null
    if (data.format && data.format !== OPENING_MOTION_FORMAT) return null
    return normalizeOpeningMotion(
      {
        maxDeg: data.maxDeg,
        open: data.open,
        close: data.close,
      },
      type,
    )
  } catch {
    return null
  }
}

export function motionPresetById(id: 'window' | 'door' | 'linear'): OpeningMotion {
  if (id === 'door') return cloneOpeningMotion(DEFAULT_DOOR_MOTION)
  if (id === 'linear') return cloneOpeningMotion(LINEAR_MOTION)
  return cloneOpeningMotion(DEFAULT_WINDOW_MOTION)
}

export function openingMotionFromOpening(opening: Opening): OpeningMotion {
  return normalizeOpeningMotion(opening.motion, opening.type)
}

export function patchOpeningMotionCurve(
  motion: OpeningMotion,
  phase: 'open' | 'close',
  curve: MotionCurve,
): OpeningMotion {
  return {
    maxDeg: motion.maxDeg,
    open: phase === 'open' ? normalizeMotionCurve(curve, motion.open) : motion.open,
    close: phase === 'close' ? normalizeMotionCurve(curve, motion.close) : motion.close,
  }
}
