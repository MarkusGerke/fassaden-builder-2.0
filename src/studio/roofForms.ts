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

export function roofKindUsesRidgeDir(kind: RoofKind): boolean {
  return kind === 'gable' || kind === 'halfHip' || kind === 'shed'
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
  const ctx: PlaneBuildContext = { eave, eaveY, flush, tan: pitchTan(roof.pitch), roof }
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
  flush: boolean[]
  roof: RoofConfig
}

export function buildRoofEnvelope(input: RoofEnvelopeInput): RoofEnvelope | null {
  // Ringe kommen bereits CCW-orientiert (siehe orientRingCcw in roof.ts) — Indizes von
  // `flush` beziehen sich auf diese Reihenfolge.
  const eave = input.eave
  const outer = input.outer
  if (eave.length < 3) return null
  const planes = buildRoofPlanes(input.kind, eave, input.eaveY, input.flush, input.roof)
  if (planes.length === 0) return null
  const faces = envelopeFaces(planes, eave)
  if (faces.length === 0) return null
  let ridgeY = input.eaveY
  for (const f of faces) {
    for (const p of f.poly) ridgeY = Math.max(ridgeY, planeY(f.plane, p))
  }
  const tan = pitchTan(input.roof.pitch)
  const cos = 1 / Math.sqrt(1 + tan * tan)
  const tv = ROOF_SLAB_THICKNESS_CM / cos
  const n = eave.length
  const isEave: boolean[] = []
  for (let i = 0; i < n; i += 1) {
    const a = eave[i]
    const b = eave[(i + 1) % n]
    // Ecken liegen auch an Giebelkanten auf Traufhöhe — das ganze Profil prüfen.
    const samples = envelopeAlongSegment(planes, a, b)
    isEave.push(samples.every((s) => Math.abs(s.y - input.eaveY) < 0.5))
  }
  return {
    kind: input.kind,
    planes,
    faces,
    eave,
    outer,
    eaveY: input.eaveY,
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

/** Index der Traufkante, auf der beide Punkte liegen; −1 wenn keine. */
function eaveEdgeOf(env: RoofEnvelope, u: XZ, v: XZ): number {
  const n = env.eave.length
  for (let i = 0; i < n; i += 1) {
    const a = env.eave[i]
    const b = env.eave[(i + 1) % n]
    if (pointOnSegment(u, a, b, 0.05) && pointOnSegment(v, a, b, 0.05)) return i
  }
  return -1
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
  /** Y für `buildGutterGeometry` (Rinne unter der Plattenkante). */
  gutterEaveY: number
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
): RoofEnvelopeGeometry {
  const roofSink: Sink = { positions: [], normals: [], uvs: [], indices: [] }
  const gableSink: Sink = { positions: [], normals: [], uvs: [], indices: [] }
  const tv = env.tv

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
    pushLiftedPolygon(roofSink, face.poly, top, true, holes)
    pushLiftedPolygon(roofSink, face.poly, bottom, false, holes)

    // Stirnflächen nur an Traufkanten (innere Grate/Kehlen teilen sich Nachbarflächen).
    const m = face.poly.length
    for (let i = 0; i < m; i += 1) {
      const u = face.poly[i]
      const v = face.poly[(i + 1) % m]
      const edgeIdx = eaveEdgeOf(env, u, v)
      if (edgeIdx < 0) continue
      // Stirn vor dem Zwerchgiebel weglassen (dort sitzt die Giebelwand).
      if (footprints.some((f) => f.edgeIdx === edgeIdx)) continue
      const flush = env.flush[edgeIdx]
      let yuTop = top(u)
      let yvTop = top(v)
      let yuBot = bottom(u)
      let yvBot = bottom(v)
      if (flush) {
        yuBot = Math.max(yuBot, env.eaveY)
        yvBot = Math.max(yvBot, env.eaveY)
        yuTop = Math.max(yuTop, env.eaveY)
        yvTop = Math.max(yvTop, env.eaveY)
        if (yuTop - yuBot < 0.05 && yvTop - yvBot < 0.05) continue
      }
      const out = edgeOutwardXZ(env.eave[edgeIdx], env.eave[(edgeIdx + 1) % env.eave.length])
      const A = new THREE.Vector3(u.x, yuTop, u.z)
      const B = new THREE.Vector3(v.x, yvTop, v.z)
      const C = new THREE.Vector3(v.x, yvBot, v.z)
      const D = new THREE.Vector3(u.x, yuBot, u.z)
      const nrm = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A))
      if (nrm.x * out.x + nrm.z * out.z >= 0) pushQuad(roofSink, A, B, C, D)
      else pushQuad(roofSink, A, D, C, B)
    }
  }

  // Zwerchgiebel: eigenes Satteldach + Frontgiebelwand.
  for (const { foot, a, b } of footprints) {
    const cross = buildCrossGableEnvelope(foot, env.eaveY, pitchDeg, a, b)
    if (!cross) continue
    for (const face of cross.faces) {
      const top = (p: XZ) => planeY(face.plane, p)
      const bottom = (p: XZ) => planeY(face.plane, p) - tv
      pushLiftedPolygon(roofSink, face.poly, top, true)
      pushLiftedPolygon(roofSink, face.poly, bottom, false)
    }
    // Frontgiebel auf der Traufkante: von eaveY bis Dachhaut.
    const front = [foot[0], foot[1]]
    const samples = envelopeAlongSegment(cross.planes, front[0], front[1])
    const out = edgeOutwardXZ(a, b)
    for (let s = 0; s + 1 < samples.length; s += 1) {
      const s0 = samples[s]
      const s1 = samples[s + 1]
      const y0 = Math.max(env.eaveY, s0.y - tv)
      const y1 = Math.max(env.eaveY, s1.y - tv)
      if (y0 - env.eaveY < 0.05 && y1 - env.eaveY < 0.05) continue
      const p0 = { x: front[0].x + (front[1].x - front[0].x) * s0.t, z: front[0].z + (front[1].z - front[0].z) * s0.t }
      const p1 = { x: front[0].x + (front[1].x - front[0].x) * s1.t, z: front[0].z + (front[1].z - front[0].z) * s1.t }
      const A = new THREE.Vector3(p0.x, env.eaveY, p0.z)
      const B = new THREE.Vector3(p1.x, env.eaveY, p1.z)
      const C = new THREE.Vector3(p1.x, y1, p1.z)
      const D = new THREE.Vector3(p0.x, y0, p0.z)
      const nrm = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A))
      if (nrm.x * out.x + nrm.z * out.z >= 0) pushQuad(gableSink, A, B, C, D)
      else pushQuad(gableSink, A, D, C, B)
    }
  }

  // Füllwände auf der Wandlinie: von Traufhöhe bis zur Plattenunterseite.
  const n = env.outer.length
  for (let i = 0; i < n; i += 1) {
    const a = env.outer[i]
    const b = env.outer[(i + 1) % n]
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.5) continue
    const samples = envelopeAlongSegment(env.planes, a, b)
    const out = edgeOutwardXZ(a, b)
    for (let s = 0; s + 1 < samples.length; s += 1) {
      const s0 = samples[s]
      const s1 = samples[s + 1]
      const y0 = Math.max(env.eaveY, s0.y - tv)
      const y1 = Math.max(env.eaveY, s1.y - tv)
      if (y0 - env.eaveY < 0.05 && y1 - env.eaveY < 0.05) continue
      const p0 = { x: a.x + (b.x - a.x) * s0.t, z: a.z + (b.z - a.z) * s0.t }
      const p1 = { x: a.x + (b.x - a.x) * s1.t, z: a.z + (b.z - a.z) * s1.t }
      const A = new THREE.Vector3(p0.x, env.eaveY, p0.z)
      const B = new THREE.Vector3(p1.x, env.eaveY, p1.z)
      const C = new THREE.Vector3(p1.x, y1, p1.z)
      const D = new THREE.Vector3(p0.x, y0, p0.z)
      const nrm = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(B, A), new THREE.Vector3().subVectors(C, A))
      if (nrm.x * out.x + nrm.z * out.z >= 0) pushQuad(gableSink, A, B, C, D)
      else pushQuad(gableSink, A, D, C, B)
    }
  }

  const gutterEdgeActive = env.isEave.map((eave, i) => {
    if (!eave || env.flush[i]) return false
    // Keine Rinne vor dem Zwerchgiebel.
    return !footprints.some((f) => f.edgeIdx === i)
  })
  return {
    roof: toGeometry(roofSink) ?? new THREE.BufferGeometry(),
    gable: toGeometry(gableSink),
    gutterEdgeActive,
    gutterEaveY: env.eaveY - tv + 4,
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
