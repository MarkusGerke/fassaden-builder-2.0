import * as THREE from 'three'
import type { AwningConfig, AwningKind, MotionCurve, Opening, SurfaceFinish } from '../types/facade'
import { EMPTY_DAY_SCHEDULE, normalizeDaySchedule } from '../utils/daySchedule'
import { createId } from '../utils/id'
import { normalizeMotionCurve } from '../utils/openingMotion'
import { normalizeSurfaceFinish } from '../utils/surfaceFinish'
import { snapToGrid } from '../utils/grid'
import { STUDIO_MASONRY } from './constants'

export const DEFAULT_AWNING_EXTENSION = 0.65
export const DEFAULT_AWNING_WIDTH_CM = 192
export const DEFAULT_AWNING_PROJECTION_CM = 144
/** Seitenüberstand Öffnung links/rechts (Gelenkarm-Default). */
export const DEFAULT_AWNING_OVERHANG_CM = 16
/** Raster für Seitenüberstand (cm) — feiner als STUDIO_MASONRY. */
export const AWNING_OVERHANG_STEP_CM = 4
/** Volant: senkrechter Stoff unter der Vorderkante. */
export const DEFAULT_AWNING_FRONT_OVERHANG_CM = 16
export const AWNING_FRONT_OVERHANG_MAX_CM = 48
/** Stoff-Default: Grau. */
export const DEFAULT_AWNING_FABRIC_COLOR = '#9ca3af'
export const DEFAULT_AWNING_FRAME_COLOR = '#4b5563'
/** Neigung unter Horizontal (Grad), Wasserablauf. */
export const DEFAULT_AWNING_SLOPE_DEG = 15
export const AWNING_SLOPE_MIN_DEG = 0
export const AWNING_SLOPE_MAX_DEG = 45
/** Abstand Arm-Befestigung von der Stoffaußenkante. */
export const DEFAULT_AWNING_ARM_INSET_CM = 16
/** Fallarm: Mindestabstand Halterung zu Öffnungskante / Profilaußenkante. */
export const AWNING_ARM_CLEARANCE_MIN_CM = 8
export const DEFAULT_AWNING_ARM_CLEARANCE_CM = 8
/** Fallarm: Wandkonsole unter dem Kasten (cm nach unten) — bestimmt die feste Armlänge (Konsole → Kastenunterkante). */
export const DEFAULT_AWNING_ARM_MOUNT_Y_CM = 144
export const AWNING_ARM_MOUNT_Y_MIN_CM = 16
export const AWNING_ARM_MOUNT_Y_MAX_CM = 320
/** Markisolette: senkrechter Tuchanteil bis zum Stoffaustritt (Schiene reicht eine Armlänge tiefer). */
export const DEFAULT_AWNING_VERTICAL_DROP_CM = 120
export const AWNING_CASSETTE_HEIGHT_CM = 12
export const AWNING_CASSETTE_DEPTH_CM = 14
export const AWNING_ARM_SECTION_CM = 3.2
export const AWNING_FRONT_BAR_SECTION_CM = 3.6
export const AWNING_FABRIC_SEGS_ALONG = 16
export const AWNING_FABRIC_SEGS_ACROSS = 8
/** Stoff klar über dem Gestänge (cm). */
export const AWNING_FABRIC_ABOVE_ARMS_CM = 8.5
/** Stoff-Durchhängung relativ zur Ausladung. */
export const AWNING_FABRIC_SAG = 0.03
/** Mindest-Ausfahrt, unter der Arme fast am Kasten liegen. */
export const AWNING_ARM_MIN_EXTENSION = 0.04
/** Segmente der Leitkurve, die dem Volant gehören. */
export const AWNING_VOLANT_SEGS = 4

const SOFT_EXTEND: MotionCurve = {
  durationMs: 2200,
  holdMs: 0,
  keys: [
    { t: 0, v: 0, ease: 'smooth' },
    { t: 0.25, v: 0.18, ease: 'smooth' },
    { t: 0.7, v: 0.78, ease: 'smooth' },
    { t: 1, v: 1, ease: 'smooth' },
  ],
}

const SOFT_RETRACT: MotionCurve = {
  durationMs: 2000,
  holdMs: 0,
  keys: [
    { t: 0, v: 0, ease: 'smooth' },
    { t: 0.35, v: 0.4, ease: 'smooth' },
    { t: 1, v: 1, ease: 'smooth' },
  ],
}

export function defaultAwningMotion(): NonNullable<AwningConfig['motion']> {
  return {
    extend: normalizeMotionCurve(SOFT_EXTEND, SOFT_EXTEND),
    retract: normalizeMotionCurve(SOFT_RETRACT, SOFT_RETRACT),
  }
}

export function defaultAwningConfig(partial?: Partial<AwningConfig>): AwningConfig {
  return normalizeAwningConfig({
    id: createId(),
    enabled: false,
    kind: 'foldingArm',
    extension: DEFAULT_AWNING_EXTENSION,
    widthCm: DEFAULT_AWNING_WIDTH_CM,
    projectionCm: DEFAULT_AWNING_PROJECTION_CM,
    overhangCm: DEFAULT_AWNING_OVERHANG_CM,
    frontOverhangCm: DEFAULT_AWNING_FRONT_OVERHANG_CM,
    slopeDeg: DEFAULT_AWNING_SLOPE_DEG,
    armInsetCm: DEFAULT_AWNING_ARM_INSET_CM,
    armClearanceCm: DEFAULT_AWNING_ARM_CLEARANCE_CM,
    armMountYCm: DEFAULT_AWNING_ARM_MOUNT_Y_CM,
    verticalDropCm: DEFAULT_AWNING_VERTICAL_DROP_CM,
    fabricColor: DEFAULT_AWNING_FABRIC_COLOR,
    frameColor: DEFAULT_AWNING_FRAME_COLOR,
    finish: { matte: 85, glossy: 15, metal: 0 },
    motion: defaultAwningMotion(),
    schedule: { ...EMPTY_DAY_SCHEDULE },
    ...partial,
  })
}

export function isAwningKind(value: unknown): value is AwningKind {
  return value === 'foldingArm' || value === 'dropArm' || value === 'markisolette'
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function normalizeAwningConfig(raw?: Partial<AwningConfig> | null): AwningConfig {
  const baseId = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : createId()
  const kind = isAwningKind(raw?.kind) ? raw.kind : 'foldingArm'
  const extension =
    typeof raw?.extension === 'number' && Number.isFinite(raw.extension)
      ? clamp(raw.extension, 0, 1)
      : DEFAULT_AWNING_EXTENSION
  const widthCm =
    typeof raw?.widthCm === 'number' && Number.isFinite(raw.widthCm)
      ? clamp(snapToGrid(raw.widthCm, STUDIO_MASONRY), 48, 960)
      : DEFAULT_AWNING_WIDTH_CM
  const projectionCm =
    typeof raw?.projectionCm === 'number' && Number.isFinite(raw.projectionCm)
      ? clamp(snapToGrid(raw.projectionCm, STUDIO_MASONRY), 48, 480)
      : DEFAULT_AWNING_PROJECTION_CM
  const overhangCm =
    typeof raw?.overhangCm === 'number' && Number.isFinite(raw.overhangCm)
      ? clamp(snapToGrid(raw.overhangCm, AWNING_OVERHANG_STEP_CM), 0, 64)
      : DEFAULT_AWNING_OVERHANG_CM
  const frontOverhangCm =
    typeof raw?.frontOverhangCm === 'number' && Number.isFinite(raw.frontOverhangCm)
      ? clamp(snapToGrid(raw.frontOverhangCm, STUDIO_MASONRY), 0, AWNING_FRONT_OVERHANG_MAX_CM)
      : DEFAULT_AWNING_FRONT_OVERHANG_CM
  const slopeDeg =
    typeof raw?.slopeDeg === 'number' && Number.isFinite(raw.slopeDeg)
      ? clamp(raw.slopeDeg, AWNING_SLOPE_MIN_DEG, AWNING_SLOPE_MAX_DEG)
      : DEFAULT_AWNING_SLOPE_DEG
  const armInsetCm =
    typeof raw?.armInsetCm === 'number' && Number.isFinite(raw.armInsetCm)
      ? clamp(snapToGrid(raw.armInsetCm, STUDIO_MASONRY), 0, 160)
      : DEFAULT_AWNING_ARM_INSET_CM
  const armClearanceCm =
    typeof raw?.armClearanceCm === 'number' && Number.isFinite(raw.armClearanceCm)
      ? clamp(snapToGrid(raw.armClearanceCm, STUDIO_MASONRY), AWNING_ARM_CLEARANCE_MIN_CM, 160)
      : DEFAULT_AWNING_ARM_CLEARANCE_CM
  const armMountYCm =
    typeof raw?.armMountYCm === 'number' && Number.isFinite(raw.armMountYCm)
      ? clamp(snapToGrid(raw.armMountYCm, STUDIO_MASONRY), AWNING_ARM_MOUNT_Y_MIN_CM, AWNING_ARM_MOUNT_Y_MAX_CM)
      : DEFAULT_AWNING_ARM_MOUNT_Y_CM
  const verticalDropCm =
    typeof raw?.verticalDropCm === 'number' && Number.isFinite(raw.verticalDropCm)
      ? clamp(snapToGrid(raw.verticalDropCm, STUDIO_MASONRY), 24, 320)
      : DEFAULT_AWNING_VERTICAL_DROP_CM
  const mountY =
    typeof raw?.mountY === 'number' && Number.isFinite(raw.mountY) ? raw.mountY : undefined
  const mountX =
    typeof raw?.mountX === 'number' && Number.isFinite(raw.mountX) ? raw.mountX : undefined
  const openingIds = Array.isArray(raw?.openingIds)
    ? raw.openingIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
    : undefined
  const motionRaw = raw?.motion
  const motionFallback = defaultAwningMotion()
  return {
    id: baseId,
    enabled: Boolean(raw?.enabled),
    kind,
    extension,
    widthCm,
    projectionCm,
    overhangCm,
    frontOverhangCm,
    slopeDeg,
    armInsetCm,
    armClearanceCm,
    armMountYCm,
    verticalDropCm,
    mountY,
    mountX,
    openingIds: openingIds && openingIds.length > 0 ? openingIds : undefined,
    fabricColor:
      typeof raw?.fabricColor === 'string' ? raw.fabricColor : DEFAULT_AWNING_FABRIC_COLOR,
    frameColor: typeof raw?.frameColor === 'string' ? raw.frameColor : DEFAULT_AWNING_FRAME_COLOR,
    finish: normalizeSurfaceFinish(raw?.finish ?? { matte: 85, glossy: 15, metal: 0 }),
    motion: {
      extend: normalizeMotionCurve(motionRaw?.extend, motionFallback.extend),
      retract: normalizeMotionCurve(motionRaw?.retract, motionFallback.retract),
    },
    schedule: normalizeDaySchedule(raw?.schedule ?? EMPTY_DAY_SCHEDULE),
  }
}

export function openingSupportsAwning(opening: Pick<Opening, 'type' | 'basementWindow'>): boolean {
  if (opening.basementWindow?.enabled) return false
  return (
    opening.type === 'window' ||
    opening.type === 'door' ||
    opening.type === 'cutout' ||
    opening.type === 'conch'
  )
}

export function defaultOpeningAwningWidth(
  opening: Pick<Opening, 'width'>,
  overhangCm = DEFAULT_AWNING_OVERHANG_CM,
): number {
  return clamp(snapToGrid(opening.width + 2 * overhangCm, AWNING_OVERHANG_STEP_CM), 48, 960)
}

export function awningFabricFinish(awning: AwningConfig): SurfaceFinish {
  return normalizeSurfaceFinish(awning.finish ?? { matte: 90, glossy: 10, metal: 0 })
}

export function awningFrameFinish(awning: AwningConfig): SurfaceFinish {
  const base = normalizeSurfaceFinish(awning.finish ?? { matte: 40, glossy: 20, metal: 40 })
  return {
    matte: Math.min(100, base.matte),
    glossy: base.glossy,
    metal: Math.max(base.metal, 35),
  }
}

/** Markisolette-Defaults: Ausladung ~64 cm, Stoffaustritt 120 cm unter dem Kasten, Arm 45° unter Horizontal. */
export const DEFAULT_MARKISOLETTE_PROJECTION_CM = 64
export const DEFAULT_MARKISOLETTE_VERTICAL_CM = DEFAULT_AWNING_VERTICAL_DROP_CM
export const DEFAULT_MARKISOLETTE_SLOPE_DEG = 45
/** Fallarm-Default: Konsole 144 cm unter dem Kasten → Armlänge ≈ 136 cm. */
export const DEFAULT_DROP_ARM_MOUNT_Y_CM = DEFAULT_AWNING_ARM_MOUNT_Y_CM
/** Stoff-Versatz entlang der Tuchnormalen (weg vom Gestänge, cm). */
export const AWNING_FABRIC_NORMAL_LIFT_CM = 3.2
const AWNING_ROLL_RADIUS_CM = 4.5

/** Beim Typwechsel typgerechte Maße mitgeben (Ausladung/Konsole/Senkrecht sind typabhängig). */
export function awningKindDefaults(kind: AwningKind): Partial<AwningConfig> {
  if (kind === 'markisolette') {
    return {
      projectionCm: DEFAULT_MARKISOLETTE_PROJECTION_CM,
      verticalDropCm: DEFAULT_MARKISOLETTE_VERTICAL_CM,
      slopeDeg: DEFAULT_MARKISOLETTE_SLOPE_DEG,
    }
  }
  if (kind === 'dropArm') {
    return {
      projectionCm: DEFAULT_AWNING_PROJECTION_CM,
      armMountYCm: DEFAULT_DROP_ARM_MOUNT_Y_CM,
      slopeDeg: DEFAULT_AWNING_SLOPE_DEG,
    }
  }
  return { projectionCm: DEFAULT_AWNING_PROJECTION_CM, slopeDeg: DEFAULT_AWNING_SLOPE_DEG }
}

export function awningArmCount(_kind: AwningKind): number {
  return 4
}

export function awningNeedsWallBrackets(kind: AwningKind): boolean {
  return kind === 'dropArm' || kind === 'markisolette'
}

/** Lokaler Pose-Stand für Gestänge + Stoff (Wand-Lokal: X quer, Y hoch, Z nach außen). */
export interface AwningPose {
  cassetteCenter: THREE.Vector3
  cassetteSize: THREE.Vector3
  rollRadius: number
  /** Gelenkarm: Wandende der Arme; Fallarm: Konsole; Markisolette: Gleiter/Drehpunkt in der Schiene. */
  leftMount: THREE.Vector3
  rightMount: THREE.Vector3
  /** Gelenkarm: Ellbogen. Fallarm/Markisolette: Armmitte (kein Gelenk). */
  leftElbow: THREE.Vector3
  rightElbow: THREE.Vector3
  leftFront: THREE.Vector3
  rightFront: THREE.Vector3
  frontBarCenter: THREE.Vector3
  frontBarLength: number
  /** Feste Armlänge (Gelenkarm: Summe beider Glieder). */
  armLen: number
  /** Markisolette: unteres Ende der Führungsschienen = Drehpunkt der Arme. */
  guideBottomY?: number
  fabricPoints: THREE.Vector3[]
  segsAlong: number
  segsAcross: number
}

export interface AwningPoseParams {
  kind: AwningKind
  widthCm: number
  projectionCm: number
  extension: number
  frontOverhangCm?: number
  slopeDeg?: number
  armInsetCm?: number
  armClearanceCm?: number
  /** Fallarm: Konsole unter Kasten (cm) — bestimmt die Armlänge. Markisolette: ungenutzt. */
  armMountYCm?: number
  /** Markisolette: senkrechter Tuchanteil bis zum Stoffaustritt (cm). */
  verticalDropCm?: number
  openingWidthCm?: number
  profileOutwardCm?: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function slopeRad(params: AwningPoseParams): number {
  const deg = Number.isFinite(params.slopeDeg) ? (params.slopeDeg as number) : DEFAULT_AWNING_SLOPE_DEG
  return THREE.MathUtils.degToRad(clamp(deg, AWNING_SLOPE_MIN_DEG, AWNING_SLOPE_MAX_DEG))
}

function resolveArmXs(widthCm: number, armInsetCm: number): { leftX: number; rightX: number } {
  const halfW = widthCm / 2
  const inset = clamp(armInsetCm, 0, Math.max(0, halfW - 4))
  return { leftX: -halfW + inset, rightX: halfW - inset }
}

/** Fallarm/Markisolette-X: min. 8 cm außerhalb Öffnungskante bzw. Profilaußenkante. */
export function resolveDropArmXs(params: {
  widthCm: number
  armInsetCm?: number
  armClearanceCm?: number
  openingWidthCm?: number
  profileOutwardCm?: number
}): { leftX: number; rightX: number } {
  const halfW = params.widthCm / 2
  if (typeof params.openingWidthCm === 'number' && Number.isFinite(params.openingWidthCm)) {
    const clearance = Math.max(
      AWNING_ARM_CLEARANCE_MIN_CM,
      params.armClearanceCm ?? DEFAULT_AWNING_ARM_CLEARANCE_CM,
    )
    const fromCenter =
      params.openingWidthCm / 2 + Math.max(0, params.profileOutwardCm ?? 0) + clearance
    const x = clamp(fromCenter, 4, Math.max(4, halfW - 2))
    return { leftX: -x, rightX: x }
  }
  return resolveArmXs(params.widthCm, params.armInsetCm ?? DEFAULT_AWNING_ARM_INSET_CM)
}

/** Tuchnormale zu einer Laufrichtung in der YZ-Ebene: nach oben, bei senkrechtem Tuch nach außen (+Z). */
function fabricNormal(tangent: THREE.Vector3): THREE.Vector3 {
  const n = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0))
  if (n.lengthSq() < 1e-9) return new THREE.Vector3(0, 0, 1)
  n.normalize()
  if (n.y < -1e-4 || (Math.abs(n.y) <= 1e-4 && n.z < 0)) n.negate()
  return n
}

/**
 * Zeilen der Tuchmitte entlang eines Pfads (x = 0, Rolle → Vorderkante) nach Bogenlänge verteilen
 * und entlang der lokalen Normalen vom Gestänge abheben. Gerader Pfad: leichte Durchhängung.
 */
function sampleFabricRows(path: THREE.Vector3[], rows: number, sagCm: number): THREE.Vector3[] {
  const segLens: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i += 1) {
    const l = path[i]!.distanceTo(path[i - 1]!)
    segLens.push(l)
    total += l
  }
  const out: THREE.Vector3[] = []
  const straight = path.length === 2
  for (let i = 0; i <= rows; i += 1) {
    const t = rows > 0 ? i / rows : 0
    const target = total * t
    let acc = 0
    let seg = 0
    while (seg < segLens.length - 1 && acc + segLens[seg]! < target - 1e-6) {
      acc += segLens[seg]!
      seg += 1
    }
    const a = path[seg]!
    const b = path[Math.min(path.length - 1, seg + 1)]!
    const l = segLens[seg] || 1
    const u = clamp01((target - acc) / l)
    const p = new THREE.Vector3().lerpVectors(a, b, u)
    const tangent = new THREE.Vector3().subVectors(b, a)
    if (tangent.lengthSq() < 1e-9) tangent.set(0, -1, 0)
    tangent.normalize()
    let lift = AWNING_FABRIC_NORMAL_LIFT_CM
    if (straight) lift -= Math.sin(Math.PI * t) * sagCm
    p.addScaledVector(fabricNormal(tangent), lift)
    out.push(p)
  }
  return out
}

interface FinishArgs {
  widthCm: number
  cassetteH: number
  cassetteD: number
  extension: number
  frontOverhangCm: number
  /** Stoffpfad Mittellinie von der Rolle bis zur Tuch-Vorderkante (ohne Volant). */
  fabricPath: THREE.Vector3[]
  sagCm: number
  leftMount: THREE.Vector3
  rightMount: THREE.Vector3
  leftElbow: THREE.Vector3
  rightElbow: THREE.Vector3
  leftFront: THREE.Vector3
  rightFront: THREE.Vector3
  armLen: number
  guideBottomY?: number
}

function rollCenterOf(cassetteH: number): THREE.Vector3 {
  return new THREE.Vector3(0, -cassetteH * 0.08, AWNING_ROLL_RADIUS_CM)
}

function finishPose(a: FinishArgs): AwningPose {
  const frontBarCenter = a.leftFront.clone().add(a.rightFront).multiplyScalar(0.5)
  const cassetteCenter = new THREE.Vector3(0, 0, a.cassetteD * 0.5)
  const cassetteSize = new THREE.Vector3(a.widthCm + 4, a.cassetteH, a.cassetteD)

  const segsAlong = AWNING_FABRIC_SEGS_ALONG
  const segsAcross = AWNING_FABRIC_SEGS_ACROSS
  const canopySegs = Math.max(4, segsAlong - AWNING_VOLANT_SEGS)
  const volantSegs = segsAlong - canopySegs
  const e = a.extension
  const rows = sampleFabricRows(a.fabricPath, canopySegs, a.sagCm)
  const front = rows[rows.length - 1]!
  const volantH = Math.max(0, a.frontOverhangCm) * e
  // Volant hängt senkrecht, vor dem Frontrohr (+Z), nicht durch das Gestell.
  const tip = front.clone()
  tip.y -= volantH
  tip.z += 2.2
  for (let i = 1; i <= volantSegs; i += 1) {
    const t = i / volantSegs
    rows.push(volantH < 1e-3 ? front.clone() : front.clone().lerp(tip, t))
  }

  const halfW = a.widthCm / 2
  const fabricPoints: THREE.Vector3[] = []
  for (const along of rows) {
    for (let ix = 0; ix <= segsAcross; ix += 1) {
      const x = lerp(-halfW, halfW, ix / segsAcross)
      fabricPoints.push(new THREE.Vector3(x, along.y, along.z))
    }
  }

  return {
    cassetteCenter,
    cassetteSize,
    rollRadius: AWNING_ROLL_RADIUS_CM,
    leftMount: a.leftMount,
    rightMount: a.rightMount,
    leftElbow: a.leftElbow,
    rightElbow: a.rightElbow,
    leftFront: a.leftFront,
    rightFront: a.rightFront,
    frontBarCenter,
    frontBarLength: a.widthCm,
    armLen: a.armLen,
    guideBottomY: a.guideBottomY,
    fabricPoints,
    segsAlong,
    segsAcross,
  }
}

/** Gelenkarm, Länge je Glied: knapp über halbe Ausladung → voll ausgefahren fast gestreckt. */
export function foldingArmSegmentLengthCm(projectionCm: number): number {
  return Math.max(12, projectionCm * 0.5 + 1.5)
}

/**
 * Gelenkarm: Kasten oben, Tuch fällt mit `slopeDeg` nach vorn. Je Arm zwei Glieder fester Länge;
 * der Ellbogen klappt in der Tuchebene zur Mitte hin ein (Zwei-Glied-IK) und liegt unter dem Tuch.
 */
export function computeFoldingArmPose(params: AwningPoseParams): AwningPose {
  const e = clamp01(params.extension)
  const slope = slopeRad(params)
  const { leftX, rightX } = resolveArmXs(params.widthCm, params.armInsetCm ?? DEFAULT_AWNING_ARM_INSET_CM)
  const cassetteH = AWNING_CASSETTE_HEIGHT_CM
  const cassetteD = AWNING_CASSETTE_DEPTH_CM
  const mountY = -cassetteH * 0.4
  const mountZ = cassetteD * 0.4
  const proj = Math.max(8, params.projectionCm)
  const reach = proj * Math.max(e, e > 0 ? AWNING_ARM_MIN_EXTENSION : 0)
  const dirY = -Math.sin(slope)
  const dirZ = Math.cos(slope)
  const frontY = mountY + reach * dirY
  const frontZ = mountZ + reach * dirZ
  const below = AWNING_FABRIC_ABOVE_ARMS_CM * 0.85

  // Zwei-Glied-IK in der Tuchebene: Ellbogen quer (X) zur Mitte, Abstand h aus fester Gliedlänge.
  // Wand-/Vorderende liegen below/2 unter dem Tuch, der Ellbogen below → Glieder exakt segLen lang.
  const segLen = foldingArmSegmentLengthCm(proj)
  const drop = below * 0.5
  const half = Math.min(reach * 0.5, segLen - 0.01)
  const h = Math.sqrt(Math.max(0, segLen * segLen - half * half - drop * drop))
  // Tuchebene: along = (0, dirY, dirZ), Normale n = (0, cos, sin) — nach oben/vorn.
  const n = new THREE.Vector3(0, Math.cos(slope), Math.sin(slope))
  const along = new THREE.Vector3(0, dirY, dirZ)
  const planeMid = new THREE.Vector3(0, mountY, mountZ).addScaledVector(along, reach * 0.5)

  const leftMount = new THREE.Vector3(leftX, mountY, mountZ).addScaledVector(n, -drop)
  const rightMount = new THREE.Vector3(rightX, mountY, mountZ).addScaledVector(n, -drop)
  const leftElbow = planeMid.clone().addScaledVector(n, -below)
  leftElbow.x = leftX + h
  const rightElbow = planeMid.clone().addScaledVector(n, -below)
  rightElbow.x = rightX - h
  // Gekreuzte Arme (schmale Markise): linker Arm eine Profilhöhe tiefer, keine Durchdringung.
  if (leftElbow.x > rightElbow.x - AWNING_ARM_SECTION_CM * 1.5) leftElbow.addScaledVector(n, -AWNING_ARM_SECTION_CM * 1.3)
  const leftFront = new THREE.Vector3(leftX, frontY, frontZ).addScaledVector(n, -drop)
  const rightFront = new THREE.Vector3(rightX, frontY, frontZ).addScaledVector(n, -drop)

  const rollCenter = rollCenterOf(cassetteH)
  const fabricFront = new THREE.Vector3(0, frontY + AWNING_FRONT_BAR_SECTION_CM * 0.4, frontZ)
  const sag = clamp(reach * AWNING_FABRIC_SAG * e, 0, AWNING_FABRIC_NORMAL_LIFT_CM * 0.6)
  return finishPose({
    widthCm: params.widthCm,
    cassetteH,
    cassetteD,
    extension: e,
    frontOverhangCm: params.frontOverhangCm ?? DEFAULT_AWNING_FRONT_OVERHANG_CM,
    fabricPath: [rollCenter, fabricFront],
    sagCm: sag,
    leftMount,
    rightMount,
    leftElbow,
    rightElbow,
    leftFront,
    rightFront,
    armLen: segLen * 2,
  })
}

/** Fallarm: feste Armlänge aus Konsolenhöhe (Konsole → Kastenunterkante). */
export function dropArmLengthCm(armMountYCm: number | undefined): number {
  const cassetteH = AWNING_CASSETTE_HEIGHT_CM
  const bracketY = -Math.max(cassetteH, armMountYCm ?? DEFAULT_DROP_ARM_MOUNT_Y_CM)
  const topY = -cassetteH * 0.5 - 1.5
  return Math.max(16, topY - bracketY)
}

/**
 * Fallarm: **ein** starrer Arm je Seite an einer Wandkonsole `armMountYCm` unter dem Kasten.
 * Eingefahren steht der Arm senkrecht an der Wand (Ausfallprofil direkt unter dem Kasten);
 * beim Ausfahren fällt er auf einem Kreisbogen nach vorn bis `slopeDeg` unter Horizontal.
 * Armlänge = Abstand Konsole → Kastenunterkante, unabhängig von der Ausfahrt.
 */
export function computeDropArmPose(params: AwningPoseParams): AwningPose {
  const e = clamp01(params.extension)
  const slope = slopeRad(params)
  const { leftX, rightX } = resolveDropArmXs(params)
  const cassetteH = AWNING_CASSETTE_HEIGHT_CM
  const cassetteD = AWNING_CASSETTE_DEPTH_CM
  const bracketY = -Math.max(cassetteH, params.armMountYCm ?? DEFAULT_DROP_ARM_MOUNT_Y_CM)
  const mountZ = cassetteD * 0.12
  const armLen = dropArmLengthCm(params.armMountYCm)
  const alphaMax = Math.PI / 2 + slope
  const alpha = alphaMax * e
  const frontY = bracketY + armLen * Math.cos(alpha)
  const frontZ = mountZ + armLen * Math.sin(alpha)

  const leftMount = new THREE.Vector3(leftX, bracketY, mountZ)
  const rightMount = new THREE.Vector3(rightX, bracketY, mountZ)
  const leftFront = new THREE.Vector3(leftX, frontY, frontZ)
  const rightFront = new THREE.Vector3(rightX, frontY, frontZ)
  const leftElbow = new THREE.Vector3().lerpVectors(leftMount, leftFront, 0.5)
  const rightElbow = new THREE.Vector3().lerpVectors(rightMount, rightFront, 0.5)

  const rollCenter = rollCenterOf(cassetteH)
  const fabricFront = new THREE.Vector3(0, frontY + AWNING_FRONT_BAR_SECTION_CM * 0.5, frontZ)
  const sag = clamp(rollCenter.distanceTo(fabricFront) * AWNING_FABRIC_SAG * e, 0, AWNING_FABRIC_NORMAL_LIFT_CM * 0.5)
  return finishPose({
    widthCm: params.widthCm,
    cassetteH,
    cassetteD,
    extension: e,
    frontOverhangCm: params.frontOverhangCm ?? DEFAULT_AWNING_FRONT_OVERHANG_CM,
    fabricPath: [rollCenter, fabricFront],
    sagCm: sag,
    leftMount,
    rightMount,
    leftElbow,
    rightElbow,
    leftFront,
    rightFront,
    armLen,
  })
}

/** Markisolette: Phasenaufteilung (Anteil senkrecht), Armlänge und Stoffaustritt. */
export function markisolettePhaseSplit(params: AwningPoseParams): { e1: number; armLen: number; vertical: number } {
  const slope = slopeRad(params)
  const vertical = Math.max(16, params.verticalDropCm ?? DEFAULT_MARKISOLETTE_VERTICAL_CM)
  const alphaMax = Math.PI / 2 + slope
  const armLen = Math.max(16, Math.max(8, params.projectionCm) / Math.sin(alphaMax))
  const growth = 2 * armLen * Math.sin(alphaMax * 0.5)
  const e1 = vertical / (vertical + growth)
  return { e1, armLen, vertical }
}

/**
 * Markisolette (Senkrecht + Ausstellarm): Ausfallprofil und Armgleiter laufen in Führungsschienen.
 * Phase 1: alles fährt senkrecht bis zum Stoffaustritt (`verticalDropCm`); der Gleiter (unteres Armende)
 * schlägt dort am Blockadeelement = Schienenende an, eine Armlänge unter dem Austritt.
 * Phase 2: der **starre** Arm schwenkt um diesen Drehpunkt nach außen (0° = senkrecht nach oben,
 * max. 90° + `slopeDeg`); das Tuch bleibt bis zum Austritt in der Schiene und läuft dann gerade zum Profil.
 * Armlänge aus Ausladung: `projectionCm = armLen · sin(90° + slope)`.
 */
export function computeMarkisolettePose(params: AwningPoseParams): AwningPose {
  const e = clamp01(params.extension)
  const slope = slopeRad(params)
  const { leftX, rightX } = resolveDropArmXs(params)
  const cassetteH = AWNING_CASSETTE_HEIGHT_CM
  const cassetteD = AWNING_CASSETTE_DEPTH_CM
  const railZ = cassetteD * 0.12
  const { e1, armLen, vertical } = markisolettePhaseSplit(params)
  const alphaMax = Math.PI / 2 + slope
  const exitY = -vertical
  const pivotY = exitY - armLen
  const rollCenter = rollCenterOf(cassetteH)
  // Tuch hängt senkrecht ab Rollenvorderkante (vor der Schiene) bis zum Austritt.
  const hangZ = rollCenter.z
  const exitPoint = new THREE.Vector3(0, exitY, hangZ)
  const barHalf = AWNING_FRONT_BAR_SECTION_CM * 0.5

  let frontY: number
  let frontZ: number
  let mountY: number
  let fabricPath: THREE.Vector3[]
  if (e <= e1) {
    const t = e1 > 0 ? clamp01(e / e1) : 1
    frontY = lerp(-cassetteH * 0.5 - barHalf, exitY, t)
    frontZ = railZ
    mountY = frontY - armLen
    fabricPath = [rollCenter, new THREE.Vector3(0, frontY + barHalf, hangZ)]
  } else {
    const growth = 2 * armLen * Math.sin(alphaMax * 0.5)
    const s = ((e - e1) / Math.max(1e-6, 1 - e1)) * growth
    const alpha = Math.min(alphaMax, 2 * Math.asin(clamp01(s / (2 * armLen))))
    frontY = pivotY + armLen * Math.cos(alpha)
    frontZ = railZ + armLen * Math.sin(alpha)
    mountY = pivotY
    const fabricFront = new THREE.Vector3(0, frontY + barHalf, frontZ)
    fabricPath = alpha > 1e-3 ? [rollCenter, exitPoint, fabricFront] : [rollCenter, fabricFront]
  }

  const leftMount = new THREE.Vector3(leftX, mountY, railZ)
  const rightMount = new THREE.Vector3(rightX, mountY, railZ)
  const leftFront = new THREE.Vector3(leftX, frontY, frontZ)
  const rightFront = new THREE.Vector3(rightX, frontY, frontZ)
  const leftElbow = new THREE.Vector3().lerpVectors(leftMount, leftFront, 0.5)
  const rightElbow = new THREE.Vector3().lerpVectors(rightMount, rightFront, 0.5)

  return finishPose({
    widthCm: params.widthCm,
    cassetteH,
    cassetteD,
    extension: e,
    frontOverhangCm: params.frontOverhangCm ?? DEFAULT_AWNING_FRONT_OVERHANG_CM,
    fabricPath,
    sagCm: 0,
    leftMount,
    rightMount,
    leftElbow,
    rightElbow,
    leftFront,
    rightFront,
    armLen,
    guideBottomY: pivotY,
  })
}

export function computeAwningPose(params: AwningPoseParams): AwningPose {
  if (params.kind === 'dropArm') return computeDropArmPose(params)
  if (params.kind === 'markisolette') return computeMarkisolettePose(params)
  return computeFoldingArmPose(params)
}

/** Leitkurven-Länge (Summen der Segmente entlang der Mitte) — monoton mit extension. */
export function awningGuideLength(pose: AwningPose): number {
  const midCol = Math.floor(pose.segsAcross / 2)
  let len = 0
  let prev: THREE.Vector3 | null = null
  for (let iy = 0; iy <= pose.segsAlong; iy += 1) {
    const p = pose.fabricPoints[iy * (pose.segsAcross + 1) + midCol]
    if (!p) continue
    if (prev) len += prev.distanceTo(p)
    prev = p
  }
  return len
}

export function createAwningFabricGeometry(pose: AwningPose): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, pose.segsAcross, pose.segsAlong)
  applyAwningFabricPositions(geo, pose)
  return geo
}

export function applyAwningFabricPositions(geo: THREE.BufferGeometry, pose: AwningPose): void {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const expected = (pose.segsAlong + 1) * (pose.segsAcross + 1)
  if (pos.count !== expected || pose.fabricPoints.length !== expected) return
  for (let i = 0; i < expected; i += 1) {
    const p = pose.fabricPoints[i]!
    pos.setXYZ(i, p.x, p.y, p.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
}

function boxBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
): { center: THREE.Vector3; length: number; quaternion: THREE.Quaternion } {
  const dir = b.clone().sub(a)
  const length = Math.max(0.5, dir.length())
  const center = a.clone().add(b).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion()
  if (length > 1e-4) {
    const mid = dir.clone().normalize()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mid)
  }
  return { center, length, quaternion }
}

export interface AwningArmSegmentSpec {
  center: THREE.Vector3
  length: number
  quaternion: THREE.Quaternion
  section: number
}

/**
 * Sichtbare Armsegmente. Gelenkarm: je Seite Wand→Ellbogen→Vorderkante (2 Glieder, 4 Specs).
 * Fallarm / Markisolette: je Seite **ein** starres Segment Konsole/Drehpunkt → Ausfallprofil (2 Specs).
 */
export function awningArmSegmentSpecs(pose: AwningPose, kind: AwningKind): AwningArmSegmentSpec[] {
  const s = AWNING_ARM_SECTION_CM
  const specs: AwningArmSegmentSpec[] = []
  const push = (a: THREE.Vector3, b: THREE.Vector3) => {
    const { center, length, quaternion } = boxBetween(a, b)
    specs.push({ center, length, quaternion, section: s })
  }
  if (kind === 'foldingArm') {
    push(pose.leftMount, pose.leftElbow)
    push(pose.leftElbow, pose.leftFront)
    push(pose.rightMount, pose.rightElbow)
    push(pose.rightElbow, pose.rightFront)
  } else {
    push(pose.leftMount, pose.leftFront)
    push(pose.rightMount, pose.rightFront)
  }
  return specs
}
