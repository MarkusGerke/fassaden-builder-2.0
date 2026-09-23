import * as THREE from 'three'
import type { RoofConfig, RoofCrossGable, RoofKind } from '../types/facade'
import { normalizeYawDeg, wallCompassLabel } from './compass'

/**
 * Dachformen ohne Ziegel (v2.0.472): Sattel, Walm, Krüppelwalm, Pult.
 *
 * Prinzip: Jede Dachfläche ist eine Ebene `y = a·x + b·z + c`. Das Dach ist die
 * **untere Einhüllende** (Minimum) aller Ebenen über dem Traufpolygon. Die Fläche
 * einer Ebene P ist das Traufpolygon geschnitten mit allen Halbebenen `P ≤ Q`.
 * Für konvexe Grundrisse entspricht das beim Walm exakt dem Straight Skeleton;
 * Sattel/Pult sind Prismen und funktionieren auf jedem Polygon.
 *
 * Bündige Kanten (`flush`): kein Überstand, keine Rinne; beim Walm/Krüppelwalm
 * liefert eine bündige Kante **keine** Ebene → die Fläche endet dort senkrecht
 * (Brandwand / Nachbardach knüpft an).
 */

export interface XZ {
  x: number
  z: number
}

/** Dachebene `y = a·x + b·z + c`. */
export interface RoofPlane {
  id: string
  a: number
  b: number
  c: number
}

export interface RoofFace {
  plane: RoofPlane
  poly: XZ[]
}

export interface RoofEnvelope {
  kind: RoofKind
  planes: RoofPlane[]
  faces: RoofFace[]
  /** Traufpolygon (Außenkante inkl. Überstand). */
  eave: XZ[]
  /** Plan-Außenring (Wandlinie). */
  outer: XZ[]
  eaveY: number
  /** Wandoberkante der obersten Etage (Welt-Y); Soffit an der Wand = eaveY − tv. */
  wallTopY: number
  /** Höchster Punkt der Dachhaut (Welt-Y). */
  ridgeY: number
  /** Vertikale Plattendicke (Dachstärke / cos Neigung). */
  tv: number
  /** Je Traufkante: bündig (kein Überstand, keine Rinne). */
  flush: boolean[]
  /** Je Traufkante: Traufe (Dachhaut auf Traufhöhe an beiden Enden) → Rinne möglich. */
  isEave: boolean[]
}

/** Dachstärke der glatten Platte (cm, senkrecht zur Fläche). */
export const ROOF_SLAB_THICKNESS_CM = 10

/**
 * Basis-Luft zwischen Wandoberkante und Dach-Unterseite (cm) — historisch v2.0.488–492.
 * Traufe nutzt das nicht mehr (v2.0.504: Soffit wieder auf Wandoberkante); Konstante bleibt
 * für Alt-Tests / Fallback-Doku.
 */
export const ROOF_WALL_CLEARANCE_CM = 8

/**
 * Wandkörper der Dach-Etage wird um so viele cm gekürzt (Oberkante), damit die
 * Geschosskante nicht durch die Soffit scheint (v2.0.494; 493 nur Deckel weglassen reichte nicht).
 */
export const ROOF_WALL_TOP_TRIM_CM = 6

/**
 * Horizontale Deckel-Platten von der Außenwandkante nach innen (cm).
 * Nicht nach außen: dort fällt die Soffit und ein Deckel stößt durchs Dach (v2.0.492).
 */
export const ROOF_WALL_CAP_INSET_CM = 48

/** Füllwand leicht vor der Fassade (cm), damit die Geschosskante nicht z-fightet. */
export const ROOF_FILL_FACE_OUTSET_CM = 0.8

/**
 * Giebelfüllung an Kanten ohne Kastentraufe: knapp in die Wand, die Dachkante bleibt davor.
 * Liegt die Füllung auf der Dachkante, flackert die ganze Schräge (Pult, Giebel).
 */
const ROOF_FILL_ONWALL_INSET_CM = 0.4

/**
 * Füllwände greifen unter die (bereits gekürzte) Wandoberkante (cm).
 */
export const ROOF_FILL_SEAL_CM = 2

/** Clearance-Hilfsformel (Paneel×tan); Traufe selbst hebt nicht mehr damit (v2.0.504). */
export function roofWallClearanceCm(facadeOutCm: number, pitchDeg: number): number {
  const tan = Math.tan((Math.min(85, Math.max(1, pitchDeg)) * Math.PI) / 180)
  const forFacade = Math.max(0, facadeOutCm) * tan + 4
  return Math.max(ROOF_WALL_CLEARANCE_CM, forFacade)
}

/** Vertikale Projektion der Dachstärke bei gegebener Neigung (cm). */
export function roofSlabVerticalCm(pitchDeg: number): number {
  const tan = Math.tan((Math.min(85, Math.max(1, pitchDeg)) * Math.PI) / 180)
  const cos = 1 / Math.sqrt(1 + tan * tan)
  return ROOF_SLAB_THICKNESS_CM / Math.max(0.2, cos)
}

const EPS = 1e-6
const AREA_MIN = 4

export const ROOF_KIND_LABELS: Record<RoofKind, string> = {
  mansard: 'Berliner Mansarde',
  gable: 'Satteldach',
  hip: 'Walmdach',
  halfHip: 'Krüppelwalm',
  shed: 'Pultdach',
}

export const ROOF_KINDS: readonly RoofKind[] = ['mansard', 'gable', 'hip', 'halfHip', 'shed']

export function isRoofKind(value: unknown): value is RoofKind {
  return typeof value === 'string' && (ROOF_KINDS as readonly string[]).includes(value)
}

/** Formen mit eigener Neigung / Firstrichtung (nicht Mansarde). */
export function roofKindUsesPitch(kind: RoofKind): boolean {
  return kind !== 'mansard'
}

/** Sattel/Krüppelwalm: Firsthöhe (cm) statt Neigung als Hauptmaß. */
export function roofKindUsesRidgeRise(kind: RoofKind): boolean {
  return kind === 'gable' || kind === 'halfHip'
}

/** Trauf-Überstand als Kastentraufe an Kanten mit geometrischem Überstand. */
export function roofKindUsesBoxedEave(_kind?: RoofKind): boolean {
  return true
}

export function roofKindUsesRidgeDir(kind: RoofKind): boolean {
  // Mansarde und Walm: dieselbe Achse wie Sattel (welche Kanten Stirn sind).
  // Pult: Hochseite, kein richtungsloser First.
  return kind === 'gable' || kind === 'halfHip' || kind === 'shed' || kind === 'mansard' || kind === 'hip'
}

export function planeY(p: RoofPlane, q: XZ): number {
  return p.a * q.x + p.b * q.z + p.c
}

/** Wand-Yaw (CCW, 0 = N, 90 = W) → Richtungsvektor in der XZ-Ebene (N = −Z, O = +X). */
export function yawToDirXZ(yawDeg: number): XZ {
  const h = (normalizeYawDeg(360 - yawDeg) * Math.PI) / 180
  return { x: Math.sin(h), z: -Math.cos(h) }
}

/** Außennormale einer CCW-Kante (wie `offsetPolygonPerEdge`). */
export function edgeOutwardXZ(a: XZ, b: XZ): XZ {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const dx = (b.x - a.x) / len
  const dz = (b.z - a.z) / len
  return { x: dz, z: -dx }
}

/** Wand-Yaw der Außennormale (Kompass-Label wie Fassaden). */
export function edgeOutwardYawDeg(a: XZ, b: XZ): number {
  const n = edgeOutwardXZ(a, b)
  const headingDeg = (Math.atan2(n.x, -n.z) * 180) / Math.PI
  return normalizeYawDeg(360 - headingDeg)
}

export function edgeCompassLabel(a: XZ, b: XZ): string {
  const yaw = Math.round(edgeOutwardYawDeg(a, b) / 45) * 45
  return wallCompassLabel(yaw)
}

/** Stabiler Schlüssel einer Ring-Kante (Mittelpunkt, cm-gerundet, richtungsunabhängig). */
export function roofEdgeKey(a: XZ, b: XZ): string {
  const mx = Math.round((a.x + b.x) / 2)
  const mz = Math.round((a.z + b.z) / 2)
  return `${mx}:${mz}`
}

function polygonArea(poly: XZ[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    s += p.x * q.z - q.x * p.z
  }
  return s / 2
}

/**
 * Konvention wie `offsetPolygonPerEdge`: Außennormale (dz, −dx) ⇔ Fläche positiv.
 * Vor dem Ableiten von Kanten-Indizes (Modi, Überstand) anwenden — danach nicht mehr drehen.
 */
export function orientRingCcw(poly: XZ[]): XZ[] {
  return polygonArea(poly) < 0 ? [...poly].reverse() : poly
}

/** Sutherland–Hodgman: behalte `fa·x + fb·z + fc ≥ 0`. */
export function clipPolygonByHalfPlane(poly: XZ[], fa: number, fb: number, fc: number): XZ[] {
  if (poly.length < 3) return []
  const out: XZ[] = []
  const f = (p: XZ) => fa * p.x + fb * p.z + fc
  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i]
    const nxt = poly[(i + 1) % poly.length]
    const fc0 = f(cur)
    const fc1 = f(nxt)
    const inCur = fc0 >= -EPS
    const inNxt = fc1 >= -EPS
    if (inCur) out.push(cur)
    if (inCur !== inNxt) {
      const t = fc0 / (fc0 - fc1)
      if (Number.isFinite(t) && t > 0 && t < 1) {
        out.push({ x: cur.x + (nxt.x - cur.x) * t, z: cur.z + (nxt.z - cur.z) * t })
      }
    }
  }
  return dedupePoly(out)
}

function dedupePoly(poly: XZ[]): XZ[] {
  const out: XZ[] = []
  for (const p of poly) {
    const last = out[out.length - 1]
    if (last && Math.hypot(last.x - p.x, last.z - p.z) < 0.01) continue
    out.push(p)
  }
  if (out.length >= 2) {
    const a = out[0]
    const b = out[out.length - 1]
    if (Math.hypot(a.x - b.x, a.z - b.z) < 0.01) out.pop()
  }
  return out
}

function dedupePlanes(planes: RoofPlane[]): RoofPlane[] {
  const out: RoofPlane[] = []
  for (const p of planes) {
    if (
      out.some(
        (q) => Math.abs(q.a - p.a) < 1e-7 && Math.abs(q.b - p.b) < 1e-7 && Math.abs(q.c - p.c) < 1e-3,
      )
    ) {
      continue
    }
    out.push(p)
  }
  return out
}

function longestEdgeDir(poly: XZ[]): XZ {
  let best = { x: 1, z: 0 }
  let bestLen = -1
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len > bestLen) {
      bestLen = len
      best = { x: (b.x - a.x) / (len || 1), z: (b.z - a.z) / (len || 1) }
    }
  }
  return best
}

function longestEdgeIndex(poly: XZ[]): number {
  let bestIdx = 0
  let bestLen = -1
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len > bestLen) {
      bestLen = len
      bestIdx = i
    }
  }
  return bestIdx
}

function pitchTan(pitchDeg: number): number {
  const p = Math.min(85, Math.max(5, pitchDeg))
  return Math.tan((p * Math.PI) / 180)
}

/**
 * Firstrichtung (Sattel/Krüppelwalm): Vektor der Firstachse.
 * `ridgeDeg` = Wand-Yaw; 0 → N–S-Achse, 90 → O–W-Achse.
 */
function ridgeAxisDir(roof: RoofConfig, eave: XZ[]): XZ {
  if (roof.ridgeDeg === null || roof.ridgeDeg === undefined) return longestEdgeDir(eave)
  return yawToDirXZ(roof.ridgeDeg)
}

/** Halbe Spannweite lotrecht zur Firstachse (Außenring). */
export function halfSpanPerpendicularToRidge(outer: XZ[], roof: RoofConfig): number {
  const d = ridgeAxisDir(roof, outer)
  const n = { x: -d.z, z: d.x }
  let sMin = Infinity
  let sMax = -Infinity
  for (const p of outer) {
    const s = n.x * p.x + n.z * p.z
    sMin = Math.min(sMin, s)
    sMax = Math.max(sMax, s)
  }
  return Math.max(40, (sMax - sMin) * 0.5)
}

/** Neigung (°) aus Firsthöhe über Traufe und Grundriss-Spannweite. */
export function roofPitchDegFromRidgeRise(ridgeRiseCm: number, outer: XZ[], roof: RoofConfig): number {
  const half = halfSpanPerpendicularToRidge(outer, roof)
  const tan = Math.max(0.05, ridgeRiseCm) / half
  const deg = (Math.atan(tan) * 180) / Math.PI
  return Math.min(85, Math.max(5, deg))
}

function effectivePitchDegForPlanes(kind: RoofKind, outer: XZ[], roof: RoofConfig): number {
  if (roofKindUsesRidgeRise(kind) && roof.ridgeRiseCm !== undefined) {
    return roofPitchDegFromRidgeRise(roof.ridgeRiseCm, outer, roof)
  }
  return roof.pitch
}

/** Pult: Richtung zur Hochseite. Auto = Innen-Normale der längsten Traufkante. */
function shedHighDir(roof: RoofConfig, eave: XZ[]): XZ {
  if (roof.ridgeDeg === null || roof.ridgeDeg === undefined) {
    const i = longestEdgeIndex(eave)
    const n = edgeOutwardXZ(eave[i], eave[(i + 1) % eave.length])
    return { x: -n.x, z: -n.z }
  }
  return yawToDirXZ(roof.ridgeDeg)
}

interface PlaneBuildContext {
  eave: XZ[]
  eaveY: number
  flush: boolean[]
  tan: number
  roof: RoofConfig
}

function gablePlanes(ctx: PlaneBuildContext, d: XZ): RoofPlane[] {
  const n = { x: -d.z, z: d.x }
  let sMin = Infinity
  let sMax = -Infinity
  for (const p of ctx.eave) {
    const s = n.x * p.x + n.z * p.z
    sMin = Math.min(sMin, s)
    sMax = Math.max(sMax, s)
  }
  return [
    { id: 'gable-a', a: n.x * ctx.tan, b: n.z * ctx.tan, c: ctx.eaveY - sMin * ctx.tan },
    { id: 'gable-b', a: -n.x * ctx.tan, b: -n.z * ctx.tan, c: ctx.eaveY + sMax * ctx.tan },
  ]
}

function shedPlanes(ctx: PlaneBuildContext): RoofPlane[] {
  const h = shedHighDir(ctx.roof, ctx.eave)
  let sMin = Infinity
  for (const p of ctx.eave) sMin = Math.min(sMin, h.x * p.x + h.z * p.z)
  return [{ id: 'shed', a: h.x * ctx.tan, b: h.z * ctx.tan, c: ctx.eaveY - sMin * ctx.tan }]
}

function hipPlanes(ctx: PlaneBuildContext, includeFlush: boolean): RoofPlane[] {
  const planes: RoofPlane[] = []
  const n = ctx.eave.length
  for (let i = 0; i < n; i += 1) {
    if (!includeFlush && ctx.flush[i]) continue
    const a = ctx.eave[i]
    const b = ctx.eave[(i + 1) % n]
    if (Math.hypot(b.x - a.x, b.z - a.z) < 1) continue
    const out = edgeOutwardXZ(a, b)
    const inward = { x: -out.x, z: -out.z }
    // y = eaveY + ((p − a)·inward)·tan
    planes.push({
      id: `hip-${i}`,
      a: inward.x * ctx.tan,
      b: inward.z * ctx.tan,
      c: ctx.eaveY - (a.x * inward.x + a.z * inward.z) * ctx.tan,
    })
  }
  return planes
}

/** Kanten, die am Ende `tExtreme` der Firstachse liegen (beide Endpunkte). */
function endEdgesFlush(ctx: PlaneBuildContext, d: XZ, tExtreme: number): boolean {
  const n = ctx.eave.length
  let any = false
  let allFlush = true
  for (let i = 0; i < n; i += 1) {
    const a = ctx.eave[i]
    const b = ctx.eave[(i + 1) % n]
    const ta = d.x * a.x + d.z * a.z
    const tb = d.x * b.x + d.z * b.z
    if (Math.abs(ta - tExtreme) < 0.5 && Math.abs(tb - tExtreme) < 0.5) {
      any = true
      if (!ctx.flush[i]) allFlush = false
    }
  }
  return any && allFlush
}

function halfHipPlanes(ctx: PlaneBuildContext, d: XZ): RoofPlane[] {
  const planes = gablePlanes(ctx, d)
  let tMin = Infinity
  let tMax = -Infinity
  for (const p of ctx.eave) {
    const t = d.x * p.x + d.z * p.z
    tMin = Math.min(tMin, t)
    tMax = Math.max(tMax, t)
  }
  const hK = Math.max(0, ctx.roof.halfHipHeight)
  if (!endEdgesFlush(ctx, d, tMin)) {
    planes.push({
      id: 'halfhip-min',
      a: d.x * ctx.tan,
      b: d.z * ctx.tan,
      c: ctx.eaveY + hK - tMin * ctx.tan,
    })
  }
  if (!endEdgesFlush(ctx, d, tMax)) {
    planes.push({
      id: 'halfhip-max',
      a: -d.x * ctx.tan,
      b: -d.z * ctx.tan,
      c: ctx.eaveY + hK + tMax * ctx.tan,
    })
  }
  return planes
}

export function buildRoofPlanes(
  kind: RoofKind,
  eave: XZ[],
  eaveY: number,
  flush: boolean[],
  roof: RoofConfig,
): RoofPlane[] {
  const pitchDeg = effectivePitchDegForPlanes(kind, eave, roof)
  const ctx: PlaneBuildContext = { eave, eaveY, flush, tan: pitchTan(pitchDeg), roof }
  let planes: RoofPlane[]
  switch (kind) {
    case 'gable':
      planes = gablePlanes(ctx, ridgeAxisDir(roof, eave))
      break
    case 'shed':
      planes = shedPlanes(ctx)
      break
    case 'halfHip':
      planes = halfHipPlanes(ctx, ridgeAxisDir(roof, eave))
      break
    case 'hip':
    default: {
      planes = hipPlanes(ctx, false)
      // Alle Kanten bündig → sonst kein Dach: dann wie frei behandeln.
      if (planes.length < 2) planes = hipPlanes(ctx, true)
      break
    }
  }
  return dedupePlanes(planes)
}

/** Höhe der Einhüllenden an einem Punkt. */
export function envelopeY(planes: RoofPlane[], p: XZ): number {
  let y = Infinity
  for (const pl of planes) y = Math.min(y, planeY(pl, p))
  return y
}

function envelopePlane(planes: RoofPlane[], p: XZ): RoofPlane {
  let best = planes[0]
  let y = Infinity
  for (const pl of planes) {
    const v = planeY(pl, p)
    if (v < y) {
      y = v
      best = pl
    }
  }
  return best
}

/** Flächen der Einhüllenden: je Ebene das Traufpolygon ∩ {P ≤ Q ∀ Q}. */
export function envelopeFaces(planes: RoofPlane[], eave: XZ[]): RoofFace[] {
  const faces: RoofFace[] = []
  for (const p of planes) {
    let poly = eave
    for (const q of planes) {
      if (q === p) continue
      // Q − P ≥ 0
      poly = clipPolygonByHalfPlane(poly, q.a - p.a, q.b - p.b, q.c - p.c)
      if (poly.length < 3) break
    }
    if (poly.length >= 3 && Math.abs(polygonArea(poly)) > AREA_MIN) {
      faces.push({ plane: p, poly })
    }
  }
  return faces
}

export interface RoofEnvelopeInput {
  kind: RoofKind
  outer: XZ[]
  eave: XZ[]
  eaveY: number
  /** Wandoberkante; Default: eaveY − tv − Basis-Clearance. */
  wallTopY?: number
  flush: boolean[]
  roof: RoofConfig
}

export function buildRoofEnvelope(input: RoofEnvelopeInput): RoofEnvelope | null {
  // Ringe kommen bereits CCW-orientiert (siehe orientRingCcw in roof.ts) — Indizes von
  // `flush` beziehen sich auf diese Reihenfolge.
  const eave = input.eave
  const outer = input.outer
  if (eave.length < 3 || outer.length < 3) return null
  // Ebenen am Außenwand-Ring: Traufüberstand verlängert die Flächen nach außen,
  // hebt den First aber nicht (v2.0.481). Flächenclip bleibt am Traufpolygon.
  const planes = buildRoofPlanes(input.kind, outer, input.eaveY, input.flush, input.roof)
  if (planes.length === 0) return null
  const faces = envelopeFaces(planes, eave)
  if (faces.length === 0) return null
  // Firsthöhe am Gebäudeumriss / Innen — Überstands-Spitzen (Pult-Hochseite) heben nicht.
  let ridgeY = input.eaveY
  const ridgeSamples: XZ[] = [...outer]
  let cx = 0
  let cz = 0
  for (let i = 0; i < outer.length; i += 1) {
    const a = outer[i]!
    const b = outer[(i + 1) % outer.length]!
    ridgeSamples.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 })
    cx += a.x
    cz += a.z
  }
  ridgeSamples.push({ x: cx / outer.length, z: cz / outer.length })
  for (const p of ridgeSamples) ridgeY = Math.max(ridgeY, envelopeY(planes, p))
  const tan = pitchTan(input.roof.pitch)
  const cos = 1 / Math.sqrt(1 + tan * tan)
  const tv = ROOF_SLAB_THICKNESS_CM / cos
  const n = eave.length
  const edgeFlat: boolean[] = []
  const edgeMeanY: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a = eave[i]
    const b = eave[(i + 1) % n]
    // Traufkante: Höhe entlang der Kante nahezu konstant (Spitze liegt unter eaveY).
    // Giebelkante: Höhe variiert stark. Pult-Hochseite ist flach, aber oben —
    // deshalb zusätzlich die niedrigste flache Kante als Traufe.
    const samples = envelopeAlongSegment(planes, a, b)
    if (samples.length === 0) {
      edgeFlat.push(false)
      edgeMeanY.push(input.eaveY)
      continue
    }
    let yMin = Infinity
    let yMax = -Infinity
    let ySum = 0
    for (const s of samples) {
      yMin = Math.min(yMin, s.y)
      yMax = Math.max(yMax, s.y)
      ySum += s.y
    }
    edgeFlat.push(yMax - yMin < 0.5)
    edgeMeanY.push(ySum / samples.length)
  }
  const floorY = Math.min(...edgeMeanY)
  const isEave = edgeFlat.map((flat, i) => flat && edgeMeanY[i]! <= floorY + 0.5)
  const wallTopY =
    input.wallTopY ??
    input.eaveY - tv
  return {
    kind: input.kind,
    planes,
    faces,
    eave,
    outer,
    eaveY: input.eaveY,
    wallTopY,
    ridgeY,
    tv,
    flush: input.flush.slice(0, n),
    isEave,
  }
}

// ---------------------------------------------------------------------------
// Geometrie

interface Sink {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}

function pushTri(sink: Sink, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
  const ab = new THREE.Vector3().subVectors(b, a)
  const ac = new THREE.Vector3().subVectors(c, a)
  const nrm = new THREE.Vector3().crossVectors(ab, ac)
  if (nrm.lengthSq() < 1e-10) return
  nrm.normalize()
  const base = sink.positions.length / 3
  for (const v of [a, b, c]) {
    sink.positions.push(v.x, v.y, v.z)
    sink.normals.push(nrm.x, nrm.y, nrm.z)
    sink.uvs.push(v.x / 32, (v.z + v.y) / 32)
  }
  sink.indices.push(base, base + 1, base + 2)
}

function pushQuad(sink: Sink, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
  pushTri(sink, a, b, c)
  pushTri(sink, a, c, d)
}

/** Senkrechter Rand zwischen Ober- und Unterkante, Normale nach außen. */
function pushEdgeRim(
  sink: Sink,
  p0: XZ,
  p1: XZ,
  y0Top: number,
  y1Top: number,
  y0Bot: number,
  y1Bot: number,
  outward: XZ,
) {
  const A = new THREE.Vector3(p0.x, y0Top, p0.z)
  const B = new THREE.Vector3(p1.x, y1Top, p1.z)
  const C = new THREE.Vector3(p1.x, y1Bot, p1.z)
  const D = new THREE.Vector3(p0.x, y0Bot, p0.z)
  const nrm = new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(B, A),
    new THREE.Vector3().subVectors(C, A),
  )
  if (nrm.x * outward.x + nrm.z * outward.z >= 0) pushQuad(sink, A, B, C, D)
  else pushQuad(sink, A, D, C, B)
}

/** Polygon in Plan-Koordinaten triangulieren und auf eine Höhenfunktion heben. */
function pushLiftedPolygon(
  sink: Sink,
  poly: XZ[],
  heightAt: (p: XZ) => number,
  upward: boolean,
  holes: XZ[][] = [],
) {
  if (poly.length < 3) return
  const contour = poly.map((p) => new THREE.Vector2(p.x, p.z))
  const holeContours = holes
    .filter((h) => h.length >= 3)
    .map((h) => h.map((p) => new THREE.Vector2(p.x, p.z)))
  let tris: number[][]
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, holeContours)
  } catch {
    tris = THREE.ShapeUtils.triangulateShape(contour, [])
  }
  // ShapeUtils-Indizes: [Kontur | Loch0 | Loch1 | …]
  const flat = [...poly, ...holes.filter((h) => h.length >= 3).flat()]
  for (const tri of tris) {
    const pa = flat[tri[0]]
    const pb = flat[tri[1]]
    const pc = flat[tri[2]]
    if (!pa || !pb || !pc) continue
    const a = new THREE.Vector3(pa.x, heightAt(pa), pa.z)
    const b = new THREE.Vector3(pb.x, heightAt(pb), pb.z)
    const c = new THREE.Vector3(pc.x, heightAt(pc), pc.z)
    const nrm = new THREE.Vector3()
      .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
    const up = nrm.y >= 0
    if (up === upward) pushTri(sink, a, b, c)
    else pushTri(sink, a, c, b)
  }
}

/** Konvexe Schnittmenge (Sutherland–Hodgman, Clip CCW). */
export function intersectConvexPolygons(subject: XZ[], clip: XZ[]): XZ[] {
  let out = subject
  const n = clip.length
  for (let i = 0; i < n; i += 1) {
    const a = clip[i]
    const b = clip[(i + 1) % n]
    const outN = edgeOutwardXZ(a, b)
    // Innenseite behalten: −outward · (p − a) ≥ 0
    const fa = -outN.x
    const fb = -outN.z
    const fc = -(fa * a.x + fb * a.z)
    out = clipPolygonByHalfPlane(out, fa, fb, fc)
    if (out.length < 3) return []
  }
  return out
}

/** Rechteck-Fußabdruck eines Zwerchgiebels auf Traufkante a→b, nach innen. */
export function crossGableFootprint(a: XZ, b: XZ, widthCm: number, depthCm: number): XZ[] {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const tx = (b.x - a.x) / len
  const tz = (b.z - a.z) / len
  const out = edgeOutwardXZ(a, b)
  const inward = { x: -out.x, z: -out.z }
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
  const half = Math.min(widthCm, len - 2) / 2
  if (half < 20 || depthCm < 20) return []
  const p0 = { x: mid.x - tx * half, z: mid.z - tz * half }
  const p1 = { x: mid.x + tx * half, z: mid.z + tz * half }
  const p2 = { x: p1.x + inward.x * depthCm, z: p1.z + inward.z * depthCm }
  const p3 = { x: p0.x + inward.x * depthCm, z: p0.z + inward.z * depthCm }
  return orientRingCcw([p0, p1, p2, p3])
}

function yawFromDirXZ(d: XZ): number {
  const headingDeg = (Math.atan2(d.x, -d.z) * 180) / Math.PI
  return normalizeYawDeg(360 - headingDeg)
}

/**
 * Zwerchgiebel-Envelope: Sattel mit First nach innen (senkrecht zur Fassadenkante).
 */
export function buildCrossGableEnvelope(
  footprint: XZ[],
  eaveY: number,
  pitchDeg: number,
  facadeA: XZ,
  facadeB: XZ,
): RoofEnvelope | null {
  const inward = { x: -edgeOutwardXZ(facadeA, facadeB).x, z: -edgeOutwardXZ(facadeA, facadeB).z }
  const ridgeDeg = yawFromDirXZ(inward)
  const roof = {
    pitch: pitchDeg,
    ridgeDeg,
    halfHipHeight: 0,
  } as RoofConfig
  return buildRoofEnvelope({
    kind: 'gable',
    outer: footprint,
    eave: footprint,
    eaveY,
    flush: footprint.map(() => false),
    roof,
  })
}

function pointOnSegment(p: XZ, a: XZ, b: XZ, tol: number): boolean {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz || 1
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2
  if (t < -1e-6 || t > 1 + 1e-6) return false
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t)) <= tol
}

function ringEdgeIndex(ring: XZ[], u: XZ, v: XZ, tol = 0.05): number {
  const n = ring.length
  for (let i = 0; i < n; i += 1) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    if (pointOnSegment(u, a, b, tol) && pointOnSegment(v, a, b, tol)) return i
  }
  return -1
}

/** Index der Traufkante, auf der beide Punkte liegen; −1 wenn keine. */
function eaveEdgeOf(env: RoofEnvelope, u: XZ, v: XZ): number {
  return ringEdgeIndex(env.eave, u, v)
}

/**
 * Parameter auf u→v, der neben der Wand liegt. Die Gehrung ragt über die
 * Wandecke hinaus; dort darf kein Plattenrand liegen (Endkappe / Stirnbrett).
 * Steht die Kante vor der Wand, bleibt der ganze Abschnitt — der Rand ist dann
 * die Außenkante, nicht die Wandlinie.
 */
function rimIntervalAlongsideWall(
  env: RoofEnvelope,
  edgeIdx: number,
  u: XZ,
  v: XZ,
): [number, number] | null {
  const wallA = env.outer[edgeIdx]
  const wallB = env.outer[(edgeIdx + 1) % env.outer.length]
  if (!wallA || !wallB) return [0, 1]
  const dx = v.x - u.x
  const dz = v.z - u.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1) return [0, 1]
  const tOf = (p: XZ) => ((p.x - u.x) * dx + (p.z - u.z) * dz) / len2
  const lineDist = (p: XZ) => {
    const t = tOf(p)
    return Math.hypot(p.x - (u.x + dx * t), p.z - (u.z + dz * t))
  }
  if (lineDist(wallA) > 1.5 && lineDist(wallB) > 1.5) return [0, 1]
  const t0 = Math.max(0, Math.min(tOf(wallA), tOf(wallB)))
  const t1 = Math.min(1, Math.max(tOf(wallA), tOf(wallB)))
  if (t1 - t0 < 1e-4) return null
  return [t0, t1]
}

function edgeStandsOffWall(env: RoofEnvelope, index: number): boolean {
  const n = Math.min(env.outer.length, env.eave.length)
  if (index < 0 || index >= n) return false
  const wallA = env.outer[index]!
  const wallB = env.outer[(index + 1) % env.outer.length]!
  const tipA = env.eave[index]!
  const tipB = env.eave[(index + 1) % env.eave.length]!
  const midWall = { x: (wallA.x + wallB.x) / 2, z: (wallA.z + wallB.z) / 2 }
  const midTip = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
  return Math.hypot(midTip.x - midWall.x, midTip.z - midWall.z) >= 1
}

function eaveHasBoxedSoffit(env: RoofEnvelope, index: number): boolean {
  return Boolean(env.isEave[index]) && edgeStandsOffWall(env, index)
}

/**
 * Höhenprofil der Einhüllenden entlang einer Strecke: Kandidaten-t sind die
 * Schnittpunkte je zweier Ebenen — dazwischen ist das Minimum linear.
 */
function envelopeAlongSegment(planes: RoofPlane[], a: XZ, b: XZ): Array<{ t: number; y: number }> {
  const ts = new Set<number>([0, 1])
  for (let i = 0; i < planes.length; i += 1) {
    for (let j = i + 1; j < planes.length; j += 1) {
      const p = planes[i]
      const q = planes[j]
      const fa = planeY(p, a) - planeY(q, a)
      const fb = planeY(p, b) - planeY(q, b)
      if (Math.abs(fa - fb) < 1e-9) continue
      const t = fa / (fa - fb)
      if (t > 1e-6 && t < 1 - 1e-6) ts.add(t)
    }
  }
  return [...ts]
    .sort((x, y) => x - y)
    .map((t) => {
      const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }
      return { t, y: envelopeY(planes, p) }
    })
}

export interface RoofEnvelopeGeometry {
  roof: THREE.BufferGeometry
  gable: THREE.BufferGeometry | null
  gutterEdgeActive: boolean[]
  /** Je Traufkante: Parameter-Intervalle [t0,t1] ohne Rinne (Traufdurchbruch). */
  gutterGaps: Array<Array<[number, number]>>
  /** Oberkante der Rinne: Dachhaut an der Traufspitze. */
  gutterEaveY: number
}

/**
 * Traufdurchbruch einer Gaube: Strecke a→b (Welt-XZ) parallel zur Traufkante in
 * Gaubenbreite. Dort entfallen Plattenstirn, Rinne und Füllwand.
 */
export interface RoofEaveCut {
  a: XZ
  b: XZ
}

/** Bis zu diesem Abstand (cm) zählt ein Schnitt zu einer Kante. */
const EAVE_CUT_MAX_DIST = 240

/** Parameter-Intervalle auf p→q, die von Schnitten (parallel, nah) überdeckt werden — gemerged. */
export function edgeCutIntervals(p: XZ, q: XZ, cuts: RoofEaveCut[]): Array<[number, number]> {
  const dx = q.x - p.x
  const dz = q.z - p.z
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-6 || cuts.length === 0) return []
  const len = Math.sqrt(len2)
  const tx = dx / len
  const tz = dz / len
  const raw: Array<[number, number]> = []
  for (const cut of cuts) {
    const cx = cut.b.x - cut.a.x
    const cz = cut.b.z - cut.a.z
    const cl = Math.hypot(cx, cz)
    if (cl < 1e-6) continue
    const parallel = Math.abs((cx * tx + cz * tz) / cl)
    if (parallel < 0.9) continue
    const dist = (r: XZ) => Math.abs((r.x - p.x) * -tz + (r.z - p.z) * tx)
    if (dist(cut.a) > EAVE_CUT_MAX_DIST || dist(cut.b) > EAVE_CUT_MAX_DIST) continue
    const ta = ((cut.a.x - p.x) * dx + (cut.a.z - p.z) * dz) / len2
    const tb = ((cut.b.x - p.x) * dx + (cut.b.z - p.z) * dz) / len2
    const t0 = Math.max(0, Math.min(ta, tb))
    const t1 = Math.min(1, Math.max(ta, tb))
    if (t1 - t0 > 1e-4) raw.push([t0, t1])
  }
  raw.sort((u, v) => u[0] - v[0])
  const merged: Array<[number, number]> = []
  for (const iv of raw) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1] + 1e-6) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }
  return merged
}

/** Komplement der Intervalle in [t0,t1]. */
export function complementIntervals(
  gaps: Array<[number, number]>,
  t0 = 0,
  t1 = 1,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let cur = t0
  for (const [g0, g1] of gaps) {
    if (g1 <= cur) continue
    if (g0 >= t1) break
    if (g0 > cur + 1e-6) out.push([cur, Math.min(g0, t1)])
    cur = Math.max(cur, g1)
  }
  if (cur < t1 - 1e-6) out.push([cur, t1])
  return out
}

/**
 * Polygon minus konvexes Loch als Liste konvexer (bzw. einfacher) Teilstücke:
 * Stück_i = poly ∩ außen(Kante_i) ∩ innen(Kanten_0..i−1). Deckt die Differenz exakt ab,
 * funktioniert auch, wenn das Loch den Rand schneidet (Traufdurchbruch) — dort scheitert
 * `triangulateShape` mit Loch-Konturen.
 */
export function subtractConvexHole(poly: XZ[], hole: XZ[]): XZ[][] {
  if (poly.length < 3) return []
  if (hole.length < 3) return [poly]
  const h = orientRingCcw(hole)
  const pieces: XZ[][] = []
  let inside = poly
  for (let i = 0; i < h.length && inside.length >= 3; i += 1) {
    const a = h[i]
    const b = h[(i + 1) % h.length]
    const outN = edgeOutwardXZ(a, b)
    // innen: −out·(p − a) ≥ 0 ; außen: out·(p − a) ≥ 0
    const fcIn = outN.x * a.x + outN.z * a.z
    const outside = clipPolygonByHalfPlane(inside, outN.x, outN.z, -fcIn)
    if (outside.length >= 3 && Math.abs(polygonArea(outside)) > AREA_MIN) pieces.push(outside)
    inside = clipPolygonByHalfPlane(inside, -outN.x, -outN.z, fcIn)
  }
  return pieces
}

function subtractHoles(poly: XZ[], holes: XZ[][]): XZ[][] {
  let pieces = [poly]
  for (const hole of holes) {
    if (hole.length < 3) continue
    const next: XZ[][] = []
    for (const piece of pieces) {
      const hit = intersectConvexPolygons(piece, hole)
      if (hit.length < 3 || Math.abs(polygonArea(hit)) <= AREA_MIN) {
        next.push(piece)
        continue
      }
      next.push(...subtractConvexHole(piece, hole))
    }
    pieces = next
  }
  return pieces
}

function toGeometry(sink: Sink): THREE.BufferGeometry | null {
  if (sink.positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(sink.positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(sink.normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(sink.uvs, 2))
  geo.setIndex(sink.indices)
  geo.computeBoundingSphere()
  return geo
}

/**
 * Glatte Dachplatte (Ober-/Unterseite + Stirn an der Traufe) und Füllwände
 * (Giebel / Traufschluss) über der Wandlinie. Optional Zwerchgiebel: Loch in der
 * Hauptdachhaut + eigenes Satteldach auf dem Fußabdruck.
 */
export function buildRoofEnvelopeGeometry(
  env: RoofEnvelope,
  crossGables: RoofCrossGable[] = [],
  pitchDeg = 45,
  extraHoles: XZ[][] = [],
  eaveCuts: RoofEaveCut[] = [],
  /** Vertikale Füllwand auf der Wandlinie weglassen (Paneele decken den Giebel). */
  skipFillEdgeIndices?: ReadonlySet<number>,
): RoofEnvelopeGeometry {
  const roofSink: Sink = { positions: [], normals: [], uvs: [], indices: [] }
  const gableSink: Sink = { positions: [], normals: [], uvs: [], indices: [] }
  const tv = env.tv
  const cutsOn = (p: XZ, q: XZ) => (eaveCuts.length ? edgeCutIntervals(p, q, eaveCuts) : [])
  const lerpXZ = (p: XZ, q: XZ, t: number): XZ => ({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })

  const footprints: Array<{ foot: XZ[]; edgeIdx: number; a: XZ; b: XZ }> = []
  for (const cg of crossGables) {
    const edgeIdx = env.outer.findIndex((oa, i) => {
      const ob = env.outer[(i + 1) % env.outer.length]
      return roofEdgeKey(oa, ob) === cg.edgeKey
    })
    if (edgeIdx < 0) continue
    const a = env.eave[edgeIdx]
    const b = env.eave[(edgeIdx + 1) % env.eave.length]
    // Bei gleicher Neigung schneidet der Quergiebel die Haupthaut bei Tiefe ≈ Breite/2.
    // Tiefer → Quergiebel unter der Haupthaut und sichtbares Loch (v2.0.473).
    const depth = Math.min(cg.depthCm, cg.widthCm * 0.5)
    const foot = crossGableFootprint(a, b, cg.widthCm, depth)
    if (foot.length >= 4) footprints.push({ foot, edgeIdx, a, b })
  }

  for (const face of env.faces) {
    const top = (p: XZ) => planeY(face.plane, p)
    const bottom = (p: XZ) => planeY(face.plane, p) - tv
    const holes: XZ[][] = []
    for (const { foot } of footprints) {
      const hit = intersectConvexPolygons(face.poly, foot)
      if (hit.length >= 3 && Math.abs(polygonArea(hit)) > AREA_MIN) holes.push(hit)
    }
    // Gauben/Dachfenster: Differenz-Zerlegung statt Loch-Kontur — robust, wenn das Loch
    // den Flächenrand schneidet (Traufdurchbruch) oder an einer Kehle liegt.
    const pieces = subtractHoles(face.poly, extraHoles)
    for (const piece of pieces) {
      const pieceHoles = holes
        .map((h) => intersectConvexPolygons(piece, h))
        .filter((h) => h.length >= 3 && Math.abs(polygonArea(h)) > AREA_MIN)
      pushLiftedPolygon(roofSink, piece, top, true, pieceHoles)
      pushLiftedPolygon(roofSink, piece, bottom, false, pieceHoles)
    }

    // Stirnflächen nur an Traufkanten (innere Grate/Kehlen teilen sich Nachbarflächen).
    const m = face.poly.length
    for (let i = 0; i < m; i += 1) {
      const u = face.poly[i]
      const v = face.poly[(i + 1) % m]
      const edgeIdx = eaveEdgeOf(env, u, v)
      if (edgeIdx < 0) continue
      // Stirn vor dem Zwerchgiebel weglassen (dort sitzt die Giebelwand).
      if (footprints.some((f) => f.edgeIdx === edgeIdx)) continue
      // Kastentraufe schließt diese Kante selbst (Stirnbrett). Sonst nur die Plattenstärke,
      // auch auf der Wand — die Füllwand sitzt 0,4 cm dahinter, sonst flackert die Schräge.
      if (eaveHasBoxedSoffit(env, edgeIdx)) continue
      // Nur der Abschnitt neben der Wand. Die Rückführung hinter der Ecke gehört der
      // Endkappe — derselbe Rand dort ergibt das Schachbrett an der Ortgangecke.
      const along = rimIntervalAlongsideWall(env, edgeIdx, u, v)
      if (!along) continue
      const yuTop = top(u)
      const yvTop = top(v)
      const yuBot = bottom(u)
      const yvBot = bottom(v)
      const out = edgeOutwardXZ(env.eave[edgeIdx], env.eave[(edgeIdx + 1) % env.eave.length])
      // Traufdurchbruch: Stirn nur außerhalb der Gaubenbreite.
      for (const [c0, c1] of complementIntervals(cutsOn(u, v))) {
        const t0 = Math.max(c0, along[0])
        const t1 = Math.min(c1, along[1])
        if (t1 - t0 < 1e-4) continue
        const p0 = lerpXZ(u, v, t0)
        const p1 = lerpXZ(u, v, t1)
        pushEdgeRim(
          roofSink,
          p0,
          p1,
          yuTop + (yvTop - yuTop) * t0,
          yuTop + (yvTop - yuTop) * t1,
          yuBot + (yvBot - yuBot) * t0,
          yuBot + (yvBot - yuBot) * t1,
          out,
        )
      }
    }
  }

  // Füllwände + Wandkronen-Deckel.
  const wallTopY = env.wallTopY
  const soffitAtWallLine = env.eaveY - tv
  const eaveFillBottomY = wallTopY - ROOF_WALL_TOP_TRIM_CM - ROOF_FILL_SEAL_CM
  const capY = soffitAtWallLine - 0.8
  for (const { foot, a, b } of footprints) {
    const cross = buildCrossGableEnvelope(foot, env.eaveY, pitchDeg, a, b)
    if (!cross) continue
    for (const face of cross.faces) {
      const top = (p: XZ) => planeY(face.plane, p)
      const bottom = (p: XZ) => planeY(face.plane, p) - tv
      pushLiftedPolygon(roofSink, face.poly, top, true)
      pushLiftedPolygon(roofSink, face.poly, bottom, false)
      const m = face.poly.length
      for (let i = 0; i < m; i += 1) {
        const u = face.poly[i]!
        const v = face.poly[(i + 1) % m]!
        if (ringEdgeIndex(foot, u, v) < 0) continue
        if (pointOnSegment(u, a, b, 1.5) && pointOnSegment(v, a, b, 1.5)) continue
        const out = edgeOutwardXZ(u, v)
        pushEdgeRim(roofSink, u, v, top(u), top(v), bottom(u), bottom(v), out)
      }
    }
    // Frontgiebel auf der Traufkante: von Seal-Unterkante bis Dach-Unterseite.
    const front = [foot[0], foot[1]]
    const samples = envelopeAlongSegment(cross.planes, front[0], front[1])
    const out = edgeOutwardXZ(a, b)
    for (let s = 0; s + 1 < samples.length; s += 1) {
      const s0 = samples[s]
      const s1 = samples[s + 1]
      const y0 = Math.max(eaveFillBottomY, s0.y - tv)
      const y1 = Math.max(eaveFillBottomY, s1.y - tv)
      if (y0 - eaveFillBottomY < 0.05 && y1 - eaveFillBottomY < 0.05) continue
      const p0 = { x: front[0].x + (front[1].x - front[0].x) * s0.t, z: front[0].z + (front[1].z - front[0].z) * s0.t }
      const p1 = { x: front[0].x + (front[1].x - front[0].x) * s1.t, z: front[0].z + (front[1].z - front[0].z) * s1.t }
      const A = new THREE.Vector3(p0.x, eaveFillBottomY, p0.z)
      const B = new THREE.Vector3(p1.x, eaveFillBottomY, p1.z)
      const C = new THREE.Vector3(p1.x, y1, p1.z)
      const D = new THREE.Vector3(p0.x, y0, p0.z)
      const nrm = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A))
      if (nrm.x * out.x + nrm.z * out.z >= 0) pushQuad(gableSink, A, B, C, D)
      else pushQuad(gableSink, A, D, C, B)
    }
  }

  // Füllwände auf der Wandlinie. Giebel: ab Geschosskante (kein Trim-Spalt); Traufe: unter die gekürzte Wand.
  const n = env.outer.length
  for (let i = 0; i < n; i += 1) {
    if (skipFillEdgeIndices?.has(i)) continue
    const a = env.outer[i]
    const b = env.outer[(i + 1) % n]
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.5) continue
    // Kastentraufe endet an der Plattenunterseite. Jede andere Kante läuft bis an die
    // Dachhaut, aber 0,4 cm in der Wand — auf der Kante flackert sie gegen die Schräge.
    const boxed = eaveHasBoxedSoffit(env, i)
    const botY = boxed ? eaveFillBottomY : wallTopY
    const outset = boxed ? ROOF_FILL_FACE_OUTSET_CM : -ROOF_FILL_ONWALL_INSET_CM
    const samples = envelopeAlongSegment(env.planes, a, b)
    const out = edgeOutwardXZ(a, b)
    const gaps = cutsOn(a, b)
    const yOnFill = (t: number, sampleY: number) => {
      if (boxed) return Math.max(botY, sampleY - tv)
      const p = lerpXZ(a, b, t)
      return Math.max(botY, envelopeY(env.planes, { x: p.x + out.x * outset, z: p.z + out.z * outset }))
    }
    for (let s = 0; s + 1 < samples.length; s += 1) {
      const s0 = samples[s]
      const s1 = samples[s + 1]
      const yA = yOnFill(s0.t, s0.y)
      const yB = yOnFill(s1.t, s1.y)
      if (yA - botY < 0.05 && yB - botY < 0.05) continue
      // Traufdurchbruch: Füllwand nur außerhalb der Gaubenfront (sonst Z-Fight mit der Gaubenwand).
      for (const [t0, t1] of complementIntervals(gaps, s0.t, s1.t)) {
        const f0 = (t0 - s0.t) / Math.max(1e-9, s1.t - s0.t)
        const f1 = (t1 - s0.t) / Math.max(1e-9, s1.t - s0.t)
        const y0 = yA + (yB - yA) * f0
        const y1 = yA + (yB - yA) * f1
        const p0 = lerpXZ(a, b, t0)
        const p1 = lerpXZ(a, b, t1)
        const f0p = {
          x: p0.x + out.x * outset,
          z: p0.z + out.z * outset,
        }
        const f1p = {
          x: p1.x + out.x * outset,
          z: p1.z + out.z * outset,
        }
        const A = new THREE.Vector3(f0p.x, botY, f0p.z)
        const B = new THREE.Vector3(f1p.x, botY, f1p.z)
        const C = new THREE.Vector3(f1p.x, y1, f1p.z)
        const D = new THREE.Vector3(f0p.x, y0, f0p.z)
        const nrm = new THREE.Vector3()
          .crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A))
        if (nrm.x * out.x + nrm.z * out.z >= 0) pushQuad(gableSink, A, B, C, D)
        else pushQuad(gableSink, A, D, C, B)
      }
    }
  }

  // Horizontale Wandkronen-Deckel nur an Traufen nach innen — nicht am Giebel (sonst Naht auf Geschosshöhe).
  for (let i = 0; i < n; i += 1) {
    if (env.flush[i]) continue
    const a = env.outer[i]
    const b = env.outer[(i + 1) % n]
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.5) continue
    const out = edgeOutwardXZ(a, b)
    const inn = { x: -out.x, z: -out.z }
    const gaps = cutsOn(a, b)
    for (const [t0, t1] of complementIntervals(gaps, 0, 1)) {
      if (t1 - t0 < 1e-4) continue
      const p0 = lerpXZ(a, b, t0)
      const p1 = lerpXZ(a, b, t1)
      const q0 = {
        x: p0.x + inn.x * ROOF_WALL_CAP_INSET_CM,
        z: p0.z + inn.z * ROOF_WALL_CAP_INSET_CM,
      }
      const q1 = {
        x: p1.x + inn.x * ROOF_WALL_CAP_INSET_CM,
        z: p1.z + inn.z * ROOF_WALL_CAP_INSET_CM,
      }
      const A = new THREE.Vector3(p0.x, capY, p0.z)
      const B = new THREE.Vector3(p1.x, capY, p1.z)
      const C = new THREE.Vector3(q1.x, capY, q1.z)
      const D = new THREE.Vector3(q0.x, capY, q0.z)
      pushQuad(gableSink, A, B, C, D)
      pushQuad(gableSink, A, D, C, B)
    }
  }

  appendEaveSoffits(env, gableSink, footprints, cutsOn)

  const gutterEdgeActive = env.isEave.map((eave, i) => {
    // `flush` ist auch „nackte Wand“ / Stirnmaske — der Überstand bleibt, die Rinne auch.
    // Explizit bündig hat Überstand 0, dann steht die Kante nicht vor der Wand.
    if (!eave || !edgeStandsOffWall(env, i)) return false
    // Keine Rinne vor dem Zwerchgiebel.
    return !footprints.some((f) => f.edgeIdx === i)
  })
  const gutterGaps = env.eave.map((p, i) => cutsOn(p, env.eave[(i + 1) % env.eave.length]))
  // Rinne schließt oben an der Dachkante an (Traufspitze), nicht an der Untersicht.
  const tipYs: number[] = []
  for (let i = 0; i < env.eave.length; i += 1) {
    if (!env.isEave[i] || !edgeStandsOffWall(env, i)) continue
    const a = env.eave[i]
    const b = env.eave[(i + 1) % env.eave.length]
    tipYs.push(envelopeY(env.planes, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }))
  }
  const tipY =
    tipYs.length > 0 ? tipYs.reduce((sum, y) => sum + y, 0) / tipYs.length : env.eaveY
  return {
    roof: toGeometry(roofSink) ?? new THREE.BufferGeometry(),
    gable: toGeometry(gableSink),
    gutterEdgeActive,
    gutterGaps,
    gutterEaveY: tipY,
  }
}

interface EdgeFrame {
  wallA: XZ
  wallB: XZ
  out: XZ
  along: XZ
  dist: number
  /** Wandenden, senkrecht um den Überstand versetzt — nicht die Gehrung. */
  p0: XZ
  p1: XZ
}

/** Senkrechter Versatz der Wandkante. Null, wenn die Traufe auf der Wand liegt. */
function edgeFrame(env: RoofEnvelope, index: number): EdgeFrame | null {
  const n = Math.min(env.outer.length, env.eave.length)
  if (index < 0 || index >= n) return null
  const wallA = env.outer[index]!
  const wallB = env.outer[(index + 1) % env.outer.length]!
  const tipA = env.eave[index]!
  const tipB = env.eave[(index + 1) % env.eave.length]!
  const len = Math.hypot(wallB.x - wallA.x, wallB.z - wallA.z)
  if (len < 0.5) return null
  const out = edgeOutwardXZ(wallA, wallB)
  const along = { x: (wallB.x - wallA.x) / len, z: (wallB.z - wallA.z) / len }
  const midWall = { x: (wallA.x + wallB.x) / 2, z: (wallA.z + wallB.z) / 2 }
  const midTip = { x: (tipA.x + tipB.x) / 2, z: (tipA.z + tipB.z) / 2 }
  const dist = (midTip.x - midWall.x) * out.x + (midTip.z - midWall.z) * out.z
  if (dist < 1) return null
  return {
    wallA,
    wallB,
    out,
    along,
    dist,
    p0: { x: wallA.x + out.x * dist, z: wallA.z + out.z * dist },
    p1: { x: wallB.x + out.x * dist, z: wallB.z + out.z * dist },
  }
}

function xzDist(a: XZ, b: XZ): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function pushSoffitQuad(sink: Sink, w0: XZ, w1: XZ, e1: XZ, e0: XZ, y: number) {
  const A = new THREE.Vector3(w0.x, y, w0.z)
  const B = new THREE.Vector3(w1.x, y, w1.z)
  const C = new THREE.Vector3(e1.x, y, e1.z)
  const D = new THREE.Vector3(e0.x, y, e0.z)
  const nrm = new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(B, A),
    new THREE.Vector3().subVectors(C, A),
  )
  if (nrm.y > 0) pushQuad(sink, A, D, C, B)
  else pushQuad(sink, A, B, C, D)
}

function pushDownTri(sink: Sink, a: XZ, b: XZ, c: XZ, y: number) {
  const A = new THREE.Vector3(a.x, y, a.z)
  const B = new THREE.Vector3(b.x, y, b.z)
  const C = new THREE.Vector3(c.x, y, c.z)
  const nrm = new THREE.Vector3().crossVectors(
    new THREE.Vector3().subVectors(B, A),
    new THREE.Vector3().subVectors(C, A),
  )
  if (nrm.lengthSq() < 1e-8) return
  if (nrm.y > 0) pushTri(sink, A, C, B)
  else pushTri(sink, A, B, C)
}

/** Schluss in der Ebene Wand→senkrechte Spitze, von der Untersicht bis auf die Dachhaut. */
function appendPerpCap(
  sink: Sink,
  env: RoofEnvelope,
  wallPt: XZ,
  tipPt: XZ,
  soffitY: number,
  facing: XZ,
) {
  if (xzDist(wallPt, tipPt) < 1) return
  const samples = envelopeAlongSegment(env.planes, wallPt, tipPt)
  for (let s = 0; s + 1 < samples.length; s += 1) {
    const s0 = samples[s]!
    const s1 = samples[s + 1]!
    // Bis zur Dachoberseite. Nur bis zur Unterseite bleibt die Plattenwange offen.
    const y0 = s0.y
    const y1 = s1.y
    if (y0 <= soffitY + 0.05 && y1 <= soffitY + 0.05) continue
    const p0 = {
      x: wallPt.x + (tipPt.x - wallPt.x) * s0.t,
      z: wallPt.z + (tipPt.z - wallPt.z) * s0.t,
    }
    const p1 = {
      x: wallPt.x + (tipPt.x - wallPt.x) * s1.t,
      z: wallPt.z + (tipPt.z - wallPt.z) * s1.t,
    }
    pushEdgeRim(
      sink,
      p0,
      p1,
      Math.max(y0, soffitY),
      Math.max(y1, soffitY),
      soffitY,
      soffitY,
      facing,
    )
  }
}

/**
 * Waagerechtes Eckstück bis zur Gehrung, wenn die Nachbarkante vor der Wand steht.
 * `neighborBoxed`: Nachbar ist selbst Kastentraufe, sein Stirnbrett geht bis auf die Dachhaut.
 * Sonst deckt der Plattenrand die Stärke. Die Rückführung hinter der Wandecke hat
 * keinen Plattenrand — dort schließt die Endkappe.
 */
function appendCornerSoffit(
  sink: Sink,
  env: RoofEnvelope,
  wall: XZ,
  perp: XZ,
  miter: XZ,
  neighborPerp: XZ,
  soffitY: number,
  neighborBoxed: boolean,
) {
  pushDownTri(sink, wall, perp, neighborPerp, soffitY)
  pushDownTri(sink, perp, miter, neighborPerp, soffitY)
  const fascia = (p: XZ, q: XZ, fromTop: boolean) => {
    if (xzDist(p, q) < 1) return
    const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }
    const vx = mid.x - wall.x
    const vz = mid.z - wall.z
    const len = Math.hypot(vx, vz) || 1
    const yAt = (pt: XZ) => {
      const top = envelopeY(env.planes, pt)
      return fromTop ? top : top - env.tv
    }
    pushEdgeRim(
      sink,
      p,
      q,
      Math.max(yAt(p), soffitY),
      Math.max(yAt(q), soffitY),
      soffitY,
      soffitY,
      { x: vx / len, z: vz / len },
    )
  }
  fascia(perp, miter, true)
  fascia(miter, neighborPerp, neighborBoxed)
}

/** Stirnbrett entlang der Dachkante zwischen senkrechter Spitze und Gehrung. */
function appendEaveFascia(sink: Sink, env: RoofEnvelope, p: XZ, q: XZ, soffitY: number, awayFrom: XZ) {
  if (xzDist(p, q) < 1) return
  const mid = { x: (p.x + q.x) / 2, z: (p.z + q.z) / 2 }
  const vx = mid.x - awayFrom.x
  const vz = mid.z - awayFrom.z
  const len = Math.hypot(vx, vz) || 1
  pushEdgeRim(
    sink,
    p,
    q,
    envelopeY(env.planes, p),
    envelopeY(env.planes, q),
    soffitY,
    soffitY,
    { x: vx / len, z: vz / len },
  )
}

/**
 * Kastentraufe: waagerechte Untersicht von der Außenwand bis zur senkrechten
 * Traufspitze, auf Höhe der Plattenunterkante. Die Gehrung zieht die Untersicht
 * nicht schräg aus der Wand. Nur Traufen mit Überstand. Zwerchgiebel und
 * Traufdurchbrüche lassen dieselbe Lücke wie die Stirn.
 */
function appendEaveSoffits(
  env: RoofEnvelope,
  sink: Sink,
  footprints: Array<{ edgeIdx: number }>,
  cutsOn: (p: XZ, q: XZ) => Array<[number, number]>,
): void {
  const n = Math.min(env.outer.length, env.eave.length)
  const lerp = (p: XZ, q: XZ, t: number): XZ => ({
    x: p.x + (q.x - p.x) * t,
    z: p.z + (q.z - p.z) * t,
  })
  const foot = new Set(footprints.map((f) => f.edgeIdx))
  const boxed = (i: number) => eaveHasBoxedSoffit(env, i) && !foot.has(i)
  for (let i = 0; i < n; i += 1) {
    // `flush` heißt hier auch „nackte Wand“ oder Stirnmaske — der Überstand bleibt.
    // Nur echte Traufen mit Abstand Wand→Spitze. Bündig (`overhang` 0) fällt durch.
    if (!boxed(i)) continue
    const fr = edgeFrame(env, i)
    if (!fr) continue
    const prev = (i + n - 1) % n
    const next = (i + 1) % n
    const prevFr = foot.has(prev) ? null : edgeFrame(env, prev)
    const nextFr = foot.has(next) ? null : edgeFrame(env, next)
    const nextBoxed = boxed(next)
    const mid = { x: (fr.p0.x + fr.p1.x) / 2, z: (fr.p0.z + fr.p1.z) / 2 }
    const y = envelopeY(env.planes, mid) - env.tv
    const tipA = env.eave[i]!
    const tipB = env.eave[(i + 1) % env.eave.length]!
    const faceStart = { x: -fr.along.x, z: -fr.along.z }
    for (const [t0, t1] of complementIntervals(cutsOn(fr.wallA, fr.wallB))) {
      if (t1 - t0 < 1e-4) continue
      const w0 = lerp(fr.wallA, fr.wallB, t0)
      const w1 = lerp(fr.wallA, fr.wallB, t1)
      const e0 = lerp(fr.p0, fr.p1, t0)
      const e1 = lerp(fr.p0, fr.p1, t1)
      // Stirnbrett 0,4 cm vor der Dachkante, sonst flackert es über der Rinne.
      const lip = 0.4
      const e0o = { x: e0.x + fr.out.x * lip, z: e0.z + fr.out.z * lip }
      const e1o = { x: e1.x + fr.out.x * lip, z: e1.z + fr.out.z * lip }
      pushSoffitQuad(sink, w0, w1, e1o, e0o, y)
      pushEdgeRim(
        sink,
        e0o,
        e1o,
        envelopeY(env.planes, e0),
        envelopeY(env.planes, e1),
        y,
        y,
        fr.out,
      )
      // Nachbar steht vor der Wand: Eckstück auf der Außenkante. Eine Kappe in der
      // Wandebene schneidet dann die Dachplatte (Streifen unter der Ecke).
      if (t0 <= 1e-4 && prevFr && xzDist(tipA, fr.p0) > 1) {
        appendCornerSoffit(sink, env, fr.wallA, fr.p0, tipA, prevFr.p1, y, boxed(prev))
      } else if (t0 <= 1e-4) {
        appendPerpCap(sink, env, fr.wallA, fr.p0, y, faceStart)
        appendEaveFascia(sink, env, fr.p0, tipA, y, fr.wallA)
      } else {
        appendPerpCap(sink, env, w0, e0, y, faceStart)
      }
      if (t1 < 1 - 1e-4) {
        appendPerpCap(sink, env, w1, e1, y, fr.along)
      } else if (nextFr && !nextBoxed && xzDist(tipB, fr.p1) > 1) {
        appendCornerSoffit(sink, env, fr.wallB, fr.p1, tipB, nextFr.p0, y, false)
      } else if (!nextBoxed) {
        appendPerpCap(sink, env, fr.wallB, fr.p1, y, fr.along)
        appendEaveFascia(sink, env, fr.p1, tipB, y, fr.wallB)
      }
    }
  }
}

/** Höhenfunktion für Tests/UI (z. B. Firsthöhe): Envelope an einem Punkt. */
export function roofEnvelopeHeightAt(env: RoofEnvelope, p: XZ): number {
  return envelopeY(env.planes, p)
}

/** Ebene, die an einem Punkt die Dachhaut bildet (für spätere Gauben/Dachfenster). */
export function roofEnvelopePlaneAt(env: RoofEnvelope, p: XZ): RoofPlane {
  return envelopePlane(env.planes, p)
}
