import * as THREE from 'three'
import type { MotionCurve, Opening, OpeningRollerShutter, SurfaceFinish } from '../types/facade'
import { normalizeMotionCurve, LINEAR_MOTION } from '../utils/openingMotion'

/** Default: geschlossenheit 0 = oben, 1 = unten. */
export const DEFAULT_ROLLER_SHUTTER_DROP = 0

export const DEFAULT_ROLLER_SLAT_HEIGHT_CM = 5
export const DEFAULT_ROLLER_GAP_CM = 0.85
export const DEFAULT_ROLLER_BULGE_CM = 0.55
export const DEFAULT_ROLLER_COLOR = '#6b7280'
/** Rollladen-Ebene relativ zur Fassadenaußenfläche nach innen (cm). */
export const ROLLER_SHUTTER_INWARD_CM = 8
/**
 * Früher: Abstand zu Führungsschienen. Lamellen gehen jetzt bis zur Laibung
 * (volle Öffnungsbreite); Konstante 0 für Alt-Tests / Docs.
 */
export const ROLLER_GUIDE_EDGE_INSET_CM = 0
/** Querschnitt der Führungsschiene entlang der Öffnungsbreite (cm). */
export const ROLLER_GUIDE_THICKNESS_CM = 1.4
/** Tiefe der Führungsschiene (cm, lokal ±Z). */
export const ROLLER_GUIDE_DEPTH_CM = 3.2
/** Deckkraft der Innen-Führungsschienen (durchscheinend). */
export const ROLLER_GUIDE_OPACITY = 0.38
/** Stapel-Pitch relativ zur Lamellenhöhe (< 1 → leichte Überlappung, lichtdicht). */
export const ROLLER_STACK_PITCH_FACTOR = 0.9

const SOFT_LOWER: MotionCurve = {
  durationMs: 1800,
  holdMs: 0,
  keys: [
    { t: 0, v: 0, ease: 'smooth' },
    { t: 0.35, v: 0.28, ease: 'smooth' },
    { t: 0.75, v: 0.82, ease: 'smooth' },
    { t: 1, v: 1, ease: 'smooth' },
  ],
}

const SOFT_RAISE: MotionCurve = {
  durationMs: 1600,
  holdMs: 0,
  keys: [
    { t: 0, v: 0, ease: 'smooth' },
    { t: 0.4, v: 0.45, ease: 'smooth' },
    { t: 1, v: 1, ease: 'smooth' },
  ],
}

export function defaultRollerShutterMotion(): NonNullable<OpeningRollerShutter['motion']> {
  return {
    raise: normalizeMotionCurve(SOFT_RAISE, SOFT_RAISE),
    lower: normalizeMotionCurve(SOFT_LOWER, SOFT_LOWER),
  }
}

export function defaultOpeningRollerShutter(): OpeningRollerShutter {
  return {
    enabled: false,
    drop: DEFAULT_ROLLER_SHUTTER_DROP,
    color: DEFAULT_ROLLER_COLOR,
    finish: 'matte',
    slatHeightCm: DEFAULT_ROLLER_SLAT_HEIGHT_CM,
    gapCm: DEFAULT_ROLLER_GAP_CM,
    motion: defaultRollerShutterMotion(),
  }
}

export function normalizeOpeningRollerShutter(
  raw?: Partial<OpeningRollerShutter> | null,
): OpeningRollerShutter {
  const base = defaultOpeningRollerShutter()
  const drop =
    typeof raw?.drop === 'number' && Number.isFinite(raw.drop)
      ? Math.max(0, Math.min(1, raw.drop))
      : base.drop
  const slatHeightCm =
    typeof raw?.slatHeightCm === 'number' && Number.isFinite(raw.slatHeightCm)
      ? Math.max(2.5, Math.min(12, raw.slatHeightCm))
      : base.slatHeightCm
  const gapCm =
    typeof raw?.gapCm === 'number' && Number.isFinite(raw.gapCm)
      ? Math.max(0, Math.min(4, raw.gapCm))
      : base.gapCm
  const motionRaw = raw?.motion
  const motionFallback = defaultRollerShutterMotion()
  return {
    enabled: Boolean(raw?.enabled),
    drop,
    color: typeof raw?.color === 'string' ? raw.color : base.color,
    finish:
      raw?.finish === 'glossy' || raw?.finish === 'metal' || raw?.finish === 'matte'
        ? raw.finish
        : base.finish,
    slatHeightCm,
    gapCm,
    motion: {
      raise: normalizeMotionCurve(motionRaw?.raise, motionFallback.raise),
      lower: normalizeMotionCurve(motionRaw?.lower, motionFallback.lower),
    },
  }
}

export function openingSupportsRollerShutter(opening: {
  type: string
  basementWindow?: { enabled?: boolean }
}): boolean {
  return (
    (opening.type === 'window' || opening.type === 'door') &&
    !Boolean(opening.basementWindow?.enabled)
  )
}

/** Maximale Lamellenanzahl, damit die Öffnung bei Stapelung voll abgedeckt ist. */
export function rollerShutterSlatCount(openingHeight: number, slatHeight: number): number {
  const h = Math.max(2.5, slatHeight)
  const pitchPacked = h * ROLLER_STACK_PITCH_FACTOR
  return Math.max(4, Math.ceil((Math.max(1, openingHeight) - h) / pitchPacked) + 1)
}

/**
 * Abstände zwischen Lamellenzentren: oben freier Spalt, unten Stapel (komprimiert).
 */
function redistributeSpacings(
  count: number,
  total: number,
  preferTop: number,
  preferBottom: number,
): number[] {
  if (count <= 0) return []
  if (count === 1) return [total]
  const raw: number[] = []
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1)
    // Stapel unten: stärkere Kompression am unteren Ende.
    const ease = t * t
    raw.push(preferTop * (1 - ease) + preferBottom * ease)
  }
  const sum = raw.reduce((a, b) => a + b, 0) || 1
  return raw.map((s) => (s / sum) * total)
}

/**
 * Y-Positionen der Lamellenmitten relativ zur Öffnungsunterkante (cm, lokal).
 * `drop` 0 = oben/offen (keine sichtbaren Lamellen), 1 = unten/geschlossen.
 *
 * Absenken: Vorhang hängt vom Sturz mit freiem Spalt nach unten. Sobald die
 * unterste Lamelle die Fensterbank berührt, stapeln weitere Lamellen von unten
 * aufeinander (Hochfahren umgekehrt).
 */
export function rollerShutterSlatCentersFromBottom(
  openingHeight: number,
  drop: number,
  slatHeight: number,
  gap: number,
): number[] {
  const H = Math.max(1, openingHeight)
  const h = Math.max(2.5, slatHeight)
  const g = Math.max(0, gap)
  const d = Math.max(0, Math.min(1, drop))
  if (d < 1e-4) return []

  const nMax = rollerShutterSlatCount(H, h)
  const pitchFree = h + g
  const pitchPacked = h * ROLLER_STACK_PITCH_FACTOR
  // Gesamtlänge der Kette bei freiem Spalt — drop skaliert linear darauf.
  const Lmax = (nMax - 1) * pitchFree + h
  const L = Math.max(h, d * Lmax)

  let n = Math.min(nMax, Math.max(1, Math.floor((L - h) / pitchFree) + 1))
  if (d >= 0.995) n = nMax

  if (n === 1) {
    return [H - h / 2]
  }

  const Lchain = (n - 1) * pitchFree + h
  // Freihängend vom Sturz: Oberkante der ersten Lamelle bei H.
  const bottomEdge = H - Lchain

  if (bottomEdge >= -0.02) {
    const centers: number[] = []
    let y = H - h / 2
    for (let i = 0; i < n; i += 1) {
      centers.push(y)
      y -= pitchFree
    }
    return centers
  }

  // Bank erreicht: unterste Mitte auf h/2, Abstände oben frei / unten Stapel.
  const available = Math.max(h * 0.5, H - h)
  const spacings = redistributeSpacings(n - 1, available, pitchFree, pitchPacked)
  const centers: number[] = []
  let y = H - h / 2
  centers.push(y)
  for (const spacing of spacings) {
    y -= spacing
    centers.push(y)
  }
  // Numerisch unterste auf Bank pinnen.
  centers[centers.length - 1] = h / 2
  return centers
}

/**
 * Abgedeckte Höhe von oben (cm): für lichtdichten Schatten-Okkluder.
 * Entspricht dem Bereich vom Sturz bis zur Unterkante des Vorhangs / Stapels.
 */
export function rollerShutterCoverHeightFromTop(
  openingHeight: number,
  drop: number,
  slatHeight: number,
  gap: number,
): number {
  const H = Math.max(1, openingHeight)
  const centers = rollerShutterSlatCentersFromBottom(openingHeight, drop, slatHeight, gap)
  if (centers.length === 0) return 0
  const h = Math.max(2.5, slatHeight)
  const bottomEdge = Math.min(...centers.map((c) => c - h / 2))
  return Math.max(0, Math.min(H, H - bottomEdge))
}

/** Gewölbter Lamellen-Querschnitt, Extrusion entlang der Breite. */
export function createRollerSlatGeometry(
  width: number,
  height: number,
  bulge: number = DEFAULT_ROLLER_BULGE_CM,
): THREE.BufferGeometry {
  const halfH = height / 2
  const depth = Math.max(0.6, height * 0.35)
  const b = Math.max(0.15, bulge)

  const shape = new THREE.Shape()
  // Vorderseite (gewölbt = +X im Shape → nach Rotate −Z / nach innen zur Leibung)
  shape.moveTo(0, -halfH)
  shape.quadraticCurveTo(b, 0, 0, halfH)
  shape.lineTo(-depth, halfH)
  shape.quadraticCurveTo(-depth + b * 0.35, 0, -depth, -halfH)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1, width),
    bevelEnabled: false,
    curveSegments: 6,
    steps: 1,
  })
  // Extrude +Z → Breite X, Höhe Y; zusätzlich 180° um Y (Wölbung zur Leibung).
  geo.rotateY(-Math.PI / 2)
  geo.rotateY(Math.PI)
  geo.computeBoundingBox()
  const box = geo.boundingBox
  if (box) {
    const cx = (box.min.x + box.max.x) / 2
    const cy = (box.min.y + box.max.y) / 2
    // Nach der 180°-Drehung liegt die Wölbung bei −Z; Anker an max.z (Fassadenseite).
    geo.translate(-cx, -cy, -box.max.z)
  }
  return geo
}

/** Vertikale Innen-Führungsschiene (volle Öffnungshöhe, Querschnitt flach). */
export function createRollerGuideRailGeometry(
  height: number,
  thickness: number = ROLLER_GUIDE_THICKNESS_CM,
  depth: number = ROLLER_GUIDE_DEPTH_CM,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(
    Math.max(0.6, thickness),
    Math.max(1, height),
    Math.max(0.8, depth),
  )
  // Fassadenseite bei z=0, Schiene erstreckt sich nach innen (−Z).
  geo.translate(0, 0, -Math.max(0.8, depth) / 2)
  return geo
}

/** Nutzbreite der Lamellen: volle Öffnungsbreite bis zur Laibung (kein seitlicher Spalt). */
export function rollerShutterSlatWidth(openingWidth: number): number {
  return Math.max(8, openingWidth - ROLLER_GUIDE_EDGE_INSET_CM * 2)
}

export type RollerShutterMotionPreset = 'soft' | 'linear'

export function rollerShutterMotionPreset(
  id: RollerShutterMotionPreset,
): NonNullable<OpeningRollerShutter['motion']> {
  if (id === 'linear') {
    return {
      raise: normalizeMotionCurve(LINEAR_MOTION.open, LINEAR_MOTION.open),
      lower: normalizeMotionCurve(
        {
          durationMs: LINEAR_MOTION.close.durationMs,
          holdMs: 0,
          keys: [
            { t: 0, v: 0, ease: 'linear' },
            { t: 1, v: 1, ease: 'linear' },
          ],
        },
        SOFT_LOWER,
      ),
    }
  }
  return defaultRollerShutterMotion()
}

export function rollerShutterFinish(shutter: OpeningRollerShutter): SurfaceFinish {
  return shutter.finish === 'glossy' || shutter.finish === 'metal' ? shutter.finish : 'matte'
}

export function rollerShutterFromOpening(opening: Opening): OpeningRollerShutter {
  return normalizeOpeningRollerShutter(opening.rollerShutter)
}
