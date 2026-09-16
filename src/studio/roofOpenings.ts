/**
 * Dachfenster und Gauben: Fußabdrücke, Löcher in der Dachhaut, Fixture-Meshes.
 * Gauben ≠ Zwerchgiebel (Traufkante) — sitzen auf der Schräge.
 *
 * Gauben-Engine (v2.0.479): lokales Koordinatensystem an der Frontwand-Mitte auf der
 * Dachhaut — `u` quer (Betrachter-rechts), `v` hangaufwärts, `y` Welt-Höhe. Hauptdach
 * `g(v) = y0 + tanM·v`. Jede geneigte Gaubenfläche ist eine Ebene `y = a·u + b·v + c`;
 * die Gaubenhaut ist das **Minimum** aller Ebenen (wie `roofForms` für das Hauptdach).
 * Flächen = Bounding-Rechteck ∩ {P_i ≤ P_j} ∩ {P_i ≥ g}; die Kehle ist die Linie
 * `P_i = g`. Loch in der Haupthaut = Innen-Rechteck ∩ ⋂{P_i ≥ g + τ} (konvex).
 * Senkrechte Bauteile (Front, Wangen, Rückwand) werden als Profile entlang `v = 0`,
 * `u = ±W/2`, `v = D` aus Envelope und Hauptdach abgetastet und als Extrusion (Wandstärke)
 * gebaut. Tonnendach = Sehnen-Ebenen des Bogens; Fledermausgaube ist ein Heightfield;
 * Dachreiter steht mit vier Wänden auf dem First.
 */
import * as THREE from 'three'
import type {
  Building,
  Opening,
  RoofConfig,
  RoofDormer,
  RoofDormerKind,
  RoofSkylight,
} from '../types/facade'
import {
  normalizeRoofDormerKind,
  roofDormerHasVerticalCheeks,
  roofDormerUsesPitch,
} from '../types/facade'
import { createId } from '../utils/id'
import { createOpening } from '../utils/openings'
import { openingMaskPolyline, openingRevealEmbed } from '../utils/openingGeometry'
import { pointInPolygonXZ } from './floorPlan'
import {
  clipPolygonByHalfPlane,
  intersectConvexPolygons,
  orientRingCcw,
  planeY,
  type RoofEaveCut,
  type RoofPlane,
  type XZ,
} from './roofForms'
import {
  normalizeRoof,
  offsetPolygonPerEdge,
  overhangPerEdge,
  roofEnvelopeForBuilding,
  roofOuterRing,
  listRoofEdges,
} from './roof'
import { storeyTopY } from '../utils/layers'

/** Rahmenstärke Dachfenster (cm). */
export const SKYLIGHT_FRAME_CM = 8
/** Glas liegt leicht über der Haut (cm entlang Normal). */
export const SKYLIGHT_LIFT_CM = 2

export interface RoofSurfaceFrame {
  origin: XZ
  y: number
  plane: RoofPlane
  /** Quer zum Gefälle (XZ, normiert). */
  u: XZ
  /** Hangaufwärts (XZ, normiert). */
  v: XZ
  /** 3D-Normal (nach außen/oben). */
  normal: THREE.Vector3
}

export interface RoofOpeningFootprint {
  id: string
  kind: 'skylight' | 'dormer'
  poly: XZ[]
}

function planeFromThreePoints(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): RoofPlane {
  // y = p.a·x + p.b·z + p.c  ⇔  n·(X - A) = 0 mit n_y ≠ 0
  const ab = new THREE.Vector3().subVectors(b, a)
  const ac = new THREE.Vector3().subVectors(c, a)
  const n = new THREE.Vector3().crossVectors(ab, ac)
  if (Math.abs(n.y) < 1e-6) {
    return { id: 'flat', a: 0, b: 0, c: a.y }
  }
  const pa = -n.x / n.y
  const pb = -n.z / n.y
  const pc = a.y - pa * a.x - pb * a.z
  return { id: 'facet', a: pa, b: pb, c: pc }
}

function frameFromPlane(origin: XZ, plane: RoofPlane): RoofSurfaceFrame {
  const y = planeY(plane, origin)
  const gradLen = Math.hypot(plane.a, plane.b) || 1e-6
  const v: XZ = { x: plane.a / gradLen, z: plane.b / gradLen }
  const u: XZ = { x: -v.z, z: v.x }
  const normal = new THREE.Vector3(-plane.a, 1, -plane.b).normalize()
  return { origin, y, plane, u, v, normal }
}

function mansardBands(building: Building, roof: RoofConfig): {
  eave: XZ[]
  breakPoly: XZ[]
  ridgePoly: XZ[]
  eaveY: number
  breakRise: number
  ridgeHeight: number
} | null {
  const floors = building.floors
  if (!floors?.length) return null
  // Mansarde hat kein Envelope — Traufpolygon aus roofBase-Logik via listRoofEdges.
  const edges = listRoofEdges(building, roof)
  if (edges.length < 3) return null
  // outer from edges.map(a) may miss closing — use consecutive a's from edges
  const ring: XZ[] = []
  for (const e of edges) ring.push(e.a)
  const oriented = orientRingCcw(ring)
  const overhangs = overhangPerEdge(edges, roof.overhang)
  const eave = offsetPolygonPerEdge(oriented, overhangs)
  const eaveY = storeyTopY(building, floors.length - 1)
  const breakRise = roof.ridgeHeight * 0.55
  const breakPoly = insetRingByPitch(eave, breakRise, roof.pitchLower)
  const ridgePoly = insetRingByPitch(breakPoly, roof.ridgeHeight - breakRise, roof.pitchUpper)
  if (breakPoly.length < 3 || ridgePoly.length < 3) return null
  return { eave, breakPoly, ridgePoly, eaveY, breakRise, ridgeHeight: roof.ridgeHeight }
}

/** Traufpolygon (mit Überstand), Wandlinie und Traufhöhe — alle Dachformen. */
export function roofEaveInfo(
  building: Building,
  rawRoof: RoofConfig | undefined,
): { eave: XZ[]; outer: XZ[]; eaveY: number } | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  if (!roof.enabled) return null
  if (roof.kind !== 'mansard') {
    const env = roofEnvelopeForBuilding(building, roof)
    if (!env) return null
    // eaveY hier = Wandoberkante.
    return { eave: env.eave, outer: env.outer, eaveY: env.wallTopY }
  }
  const bands = mansardBands(building, roof)
  const outer = roofOuterRing(building)
  if (!bands || !outer) return null
  return { eave: bands.eave, outer, eaveY: bands.eaveY }
}

/** Horizontaler Inset: d = rise / tan(pitch). Positiv = innen. */
function insetRingByPitch(ring: XZ[], rise: number, pitchDeg: number): XZ[] {
  const rad = (Math.max(1, pitchDeg) * Math.PI) / 180
  const d = rise / Math.tan(rad)
  return offsetPolygonPerEdge(
    ring,
    ring.map(() => -d),
  )
}

function facetPlaneForPoint(
  lower: XZ[],
  upper: XZ[],
  y0: number,
  y1: number,
  p: XZ,
): RoofPlane | null {
  const n = Math.min(lower.length, upper.length)
  if (n < 3) return null
  let bestI = 0
  let bestD = Infinity
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const mid = {
      x: (lower[i].x + lower[j].x + upper[i].x + upper[j].x) * 0.25,
      z: (lower[i].z + lower[j].z + upper[i].z + upper[j].z) * 0.25,
    }
    const d = Math.hypot(p.x - mid.x, p.z - mid.z)
    if (d < bestD) {
      bestD = d
      bestI = i
    }
  }
  const i = bestI
  const j = (i + 1) % n
  const L0 = new THREE.Vector3(lower[i].x, y0, lower[i].z)
  const L1 = new THREE.Vector3(lower[j].x, y0, lower[j].z)
  const U0 = new THREE.Vector3(upper[i].x, y1, upper[i].z)
  return planeFromThreePoints(L0, L1, U0)
}

/**
 * Dachhaut-Frame am Punkt (Welt-XZ). Null wenn außerhalb oder kein Dach.
 */
export function roofSurfaceFrameAt(
  building: Building,
  rawRoof: RoofConfig | undefined,
  p: XZ,
): RoofSurfaceFrame | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  if (!roof.enabled || roof.hidden) return null

  if (roof.kind !== 'mansard') {
    const env = roofEnvelopeForBuilding(building, roof)
    if (!env) return null
    if (!pointInPolygonXZ(p.x, p.z, env.eave)) return null
    const plane = env.planes.reduce((best, pl) =>
      planeY(pl, p) < planeY(best, p) ? pl : best,
    )
    return frameFromPlane(p, plane)
  }

  const bands = mansardBands(building, roof)
  if (!bands) return null
  if (!pointInPolygonXZ(p.x, p.z, bands.eave)) return null
  const inBreak = pointInPolygonXZ(p.x, p.z, bands.breakPoly)
  const inRidge = pointInPolygonXZ(p.x, p.z, bands.ridgePoly)
  if (inRidge) {
    return frameFromPlane(p, {
      id: 'ridge',
      a: 0,
      b: 0,
      c: bands.eaveY + bands.ridgeHeight,
    })
  }
  if (inBreak) {
    const plane = facetPlaneForPoint(
      bands.breakPoly,
      bands.ridgePoly,
      bands.eaveY + bands.breakRise,
      bands.eaveY + bands.ridgeHeight,
      p,
    )
    if (!plane) return null
    return frameFromPlane(p, plane)
  }
  const plane = facetPlaneForPoint(
    bands.eave,
    bands.breakPoly,
    bands.eaveY,
    bands.eaveY + bands.breakRise,
    p,
  )
  if (!plane) return null
  return frameFromPlane(p, plane)
}

/** Rechteck-Fußabdruck in XZ um Mittelpunkt (u quer, v hangauf). */
export function roofRectFootprint(
  frame: RoofSurfaceFrame,
  widthCm: number,
  depthCm: number,
): XZ[] {
  const hw = widthCm / 2
  const hd = depthCm / 2
  const o = frame.origin
  const corners: XZ[] = [
    { x: o.x - frame.u.x * hw - frame.v.x * hd, z: o.z - frame.u.z * hw - frame.v.z * hd },
    { x: o.x + frame.u.x * hw - frame.v.x * hd, z: o.z + frame.u.z * hw - frame.v.z * hd },
    { x: o.x + frame.u.x * hw + frame.v.x * hd, z: o.z + frame.u.z * hw + frame.v.z * hd },
    { x: o.x - frame.u.x * hw + frame.v.x * hd, z: o.z - frame.u.z * hw + frame.v.z * hd },
  ]
  return orientRingCcw(corners)
}

export function skylightFootprint(building: Building, roof: RoofConfig, s: RoofSkylight): XZ[] | null {
  const frame = roofSurfaceFrameAt(building, roof, { x: s.x, z: s.z })
  if (!frame) return null
  return roofRectFootprint(frame, s.widthCm, s.heightCm)
}

function xzAt(frame: RoofSurfaceFrame, su: number, sv: number): XZ {
  return {
    x: frame.origin.x + frame.u.x * su + frame.v.x * sv,
    z: frame.origin.z + frame.u.z * su + frame.v.z * sv,
  }
}

// ---------------------------------------------------------------------------
// Gauben: Parameter, Defaults
// ---------------------------------------------------------------------------

/** Dachstärke Gaubendach (cm, senkrecht) — Blenden/Untersicht. */
export const DORMER_ROOF_THICKNESS_CM = 8
/** Randstreifen Haupthaut, der unter dem Gaubendach stehen bleibt (cm). */
export const DORMER_HOLE_MARGIN_CM = 8
/** Rücksprung der Fensterfront hinter der Gauben-Außenfläche (cm). */
export const DORMER_WINDOW_RECESS_CM = 6
/** Seitlicher Mindestabstand Fenster ↔ Wangen-Innenkante (cm). */
export const DORMER_WINDOW_SIDE_MARGIN_CM = 8
/** Mindestabstand Fensteroberkante ↔ Gaubenhaut (cm). */
export const DORMER_WINDOW_TOP_MARGIN_CM = 10
/** Mindest-Brüstung des Gaubenfensters (cm). */
export const DORMER_WINDOW_SILL_MIN_CM = 8
/** Segmente der Tonnendach-Sehnen. */
const BARREL_SEGMENTS = 16
/** Fledermaus-Raster. */
const BAT_U_SEGMENTS = 32
const BAT_V_SEGMENTS = 12
/** Dachreiter: maximale Kantenlänge (cm). */
export const TURRET_MAX_SIDE_CM = 240

export const DORMER_DEFAULT_OVERHANG_CM = 15
export const DORMER_DEFAULT_WALL_THICKNESS_CM = 20
export const DORMER_DEFAULT_CHEEK_TILT_DEG = 20

/** Tonnendach-Bogenstich ohne eigene Angabe: Segmentbogen mit Stich = Breite/4. */
export function dormerDefaultRiseCm(widthCm: number): number {
  return Math.round(clampNum(widthCm / 4, 12, widthCm / 2))
}

/** Default-Neigung des Gaubendachs je Form (Grad). */
export function dormerDefaultPitchDeg(kind: RoofDormerKind, mainPitchDeg: number): number {
  switch (kind) {
    case 'shedStraight':
    case 'shedSkew':
    case 'shedTrapez':
      return clampNum(Math.round(mainPitchDeg - 20), 8, 30)
    case 'hip':
    case 'hipNoRidge':
      return 35
    case 'turret':
      return 50
    case 'gable':
    default:
      return 40
  }
}

/**
 * Default-Fenster einer Gaube. Entsteht über `createOpening` — gleicher Feldkatalog
 * (Gründerzeit-Teilung, Glas, Laibung, Bank) wie eine Wandöffnung; `donorWalls` erbt den
 * Stil der vorhandenen Hausfenster. Koordinaten relativ zur Frontwand (links / Unterkante).
 */
export function defaultDormerWindow(
  d: Pick<RoofDormer, 'widthCm' | 'heightCm' | 'kind'>,
  donorWalls?: Array<{ openings?: Opening[] }>,
): Opening {
  const kind = normalizeRoofDormerKind(d.kind)
  let width: number
  let height: number
  let y = 20
  if (kind === 'bat') {
    // Fledermaus: schmal unter dem Scheitel — Haut fällt zu den Seiten schnell ab.
    width = clampNum(Math.round(d.widthCm * 0.22), 40, 160)
    height = clampNum(Math.round(d.heightCm * 0.45), 32, 120)
    y = 10
  } else if (kind === 'pointed') {
    // Spitzgaube: kleines Rechteck sicher im Giebeldreieck.
    width = clampNum(Math.round(d.widthCm * 0.28), 32, 120)
    height = clampNum(Math.round(d.heightCm * 0.36), 28, 140)
    y = 12
  } else if (kind === 'shedTrapez') {
    // Trapez: Front verjüngt sich nach oben — etwas schmaler als Standard.
    width = clampNum(Math.round((d.widthCm - 2 * DORMER_DEFAULT_WALL_THICKNESS_CM) * 0.5), 40, 180)
    height = clampNum(Math.round(d.heightCm - 40), 40, 200)
  } else {
    width = clampNum(Math.round((d.widthCm - 2 * DORMER_DEFAULT_WALL_THICKNESS_CM) * 0.62), 40, 200)
    height = clampNum(Math.round(d.heightCm - 36), 40, 220)
  }
  const frontWall = {
    width: d.widthCm,
    height: d.heightCm,
    depth: DORMER_DEFAULT_WALL_THICKNESS_CM,
  }
  const base = createOpening(
    'window',
    width,
    height,
    frontWall,
    { x: Math.round((d.widthCm - width) / 2), y },
    donorWalls ? { donorWalls } : undefined,
  )
  return { ...base, id: 'dormer-window', x: Math.round((d.widthCm - width) / 2), y }
}

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

// ---------------------------------------------------------------------------
// Gauben-Modell
// ---------------------------------------------------------------------------

/** Ebene `y = a·u + b·v + c` im Gauben-Lokalraum (y = Welt-Höhe). */
export interface DormerPlane {
  a: number
  b: number
  c: number
  /** `roof` = Dachfläche, `cheek` = geneigte Wange (Trapezgaube). */
  tag: 'roof' | 'cheek'
}

export interface DormerModel {
  dormer: RoofDormer
  kind: RoofDormerKind
  /** Welt-XZ der Frontwand-Mitte (nach Traufdurchbruch-Projektion). */
  origin: XZ
  /** Frame am Anker (Richtungen u/v, Hauptdach-Ebene). */
  frame: RoofSurfaceFrame
  /** Hauptdach-Höhe an der Frontlinie. */
  y0: number
  /** Steigung Hauptdach in v. */
  tanM: number
  /** Unterkante der Frontwand (Traufdurchbruch: Traufhöhe, sonst y0). */
  yBase: number
  widthCm: number
  heightCm: number
  /** Tiefe-Kappe (Rückwand, wenn Kehle weiter hinten läge). */
  depthCm: number
  overhangCm: number
  wallThicknessCm: number
  roofPitchDeg: number
  riseCm: number
  cheekTiltDeg: number
  eaveBreak: boolean
  /** v der Traufkante (negativ) — nur bei Traufdurchbruch. */
  vEave: number | null
  /** Ebenen-Modell (null bei Fledermaus/Dachreiter). */
  planes: DormerPlane[] | null
  /** Oberkante der Gaubenhaut (Welt-y) im Lokalraum. */
  topAt: (u: number, v: number) => number
  /** Hauptdach-Höhe im Lokalraum. */
  roofAt: (v: number) => number
  /** Gefittetes Fenster (x von links der Frontwand, y ab Wandunterkante). */
  window: Opening | null
  /** Rückwand nötig (Ebenen erreichen die Haupthaut vor `depthCm` nicht). */
  hasBackWall: boolean
  /** Tatsächliche Tiefe (Kehle oder Kappe). */
  actualDepthCm: number
}

function tanDeg(deg: number): number {
  return Math.tan((deg * Math.PI) / 180)
}

function planeAt(p: DormerPlane, u: number, v: number): number {
  return p.a * u + p.b * v + p.c
}

interface RingHit {
  /** Abstand vom Ursprung entlang `dir` (cm). */
  t: number
  /** Index der getroffenen Kante (`ring[i] → ring[i+1]`). */
  index: number
  /** Lauf auf der Kante, 0…1. */
  s: number
}

/** Strahl vom Anker gegen −v bis zur ersten Kante des Rings. */
function rayHitRing(origin: XZ, dir: XZ, ring: XZ[]): RingHit | null {
  let best: RingHit | null = null
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const ex = b.x - a.x
    const ez = b.z - a.z
    const den = dir.x * ez - dir.z * ex
    if (Math.abs(den) < 1e-9) continue
    const wx = a.x - origin.x
    const wz = a.z - origin.z
    const t = (wx * ez - wz * ex) / den
    const s = (wx * dir.z - wz * dir.x) / den
    if (t <= 1e-6 || s < -1e-6 || s > 1 + 1e-6) continue
    if (best === null || t < best.t) best = { t, index: i, s: clampNum(s, 0, 1) }
  }
  return best
}

function rayHitDistance(origin: XZ, dir: XZ, ring: XZ[]): number | null {
  return rayHitRing(origin, dir, ring)?.t ?? null
}

/** Bogenstich-Funktion des Tonnendachs: Höhe über der Kämpferlinie bei u. */
function barrelArcY(u: number, width: number, rise: number): number {
  const hw = width / 2
  const R = Math.min(rise, hw)
  if (R < 1) return 0
  const r = (hw * hw + R * R) / (2 * R)
  const inner = Math.max(0, r * r - u * u)
  return Math.max(0, Math.sqrt(inner) - (r - R))
}

function buildPlanes(
  kind: RoofDormerKind,
  W: number,
  H: number,
  D: number,
  y0: number,
  tanM: number,
  pitchDeg: number,
  rise: number,
  tiltDeg: number,
): DormerPlane[] | null {
  const tanD = tanDeg(pitchDeg)
  const hw = W / 2
  switch (kind) {
    case 'gable': {
      const c = y0 + H + tanD * hw
      return [
        { a: tanD, b: 0, c, tag: 'roof' },
        { a: -tanD, b: 0, c, tag: 'roof' },
      ]
    }
    case 'hip':
    case 'hipNoRidge': {
      const c = y0 + H + tanD * hw
      const ridgeRise = H + tanD * hw
      const vKehle = tanM > 1e-4 ? ridgeRise / tanM : D
      const vApexMax = Math.max(20, Math.min(vKehle, D))
      let tanF = tanD
      if (kind === 'hipNoRidge') {
        // Spitze der Walmflächen genau auf der Kehle/Kappe → kein Firstgrat.
        tanF = (tanD * hw) / vApexMax
      }
      return [
        { a: tanD, b: 0, c, tag: 'roof' },
        { a: -tanD, b: 0, c, tag: 'roof' },
        { a: 0, b: tanF, c: y0 + H, tag: 'roof' },
      ]
    }
    case 'shedStraight':
      return [{ a: 0, b: tanD, c: y0 + H, tag: 'roof' }]
    case 'shedSkew': {
      const tanQ = tanDeg(tiltDeg)
      return [{ a: tanQ, b: tanD, c: y0 + H + tanQ * hw, tag: 'roof' }]
    }
    case 'shedTrapez': {
      // Wangen um `tilt` aus der Senkrechten nach innen geneigt; Firstbreite ≥ 40 % der Sohle.
      let k = 1 / Math.tan((Math.max(5, tiltDeg) * Math.PI) / 180)
      const kMin = (2 * H) / Math.max(1, 0.6 * W)
      if (k < kMin) k = kMin
      return [
        { a: 0, b: tanD, c: y0 + H, tag: 'roof' },
        { a: -k, b: tanM, c: y0 + k * hw, tag: 'cheek' },
        { a: k, b: tanM, c: y0 + k * hw, tag: 'cheek' },
      ]
    }
    case 'pointed': {
      const t = H / Math.max(1, hw)
      return [
        { a: t, b: 0, c: y0 + H, tag: 'roof' },
        { a: -t, b: 0, c: y0 + H, tag: 'roof' },
      ]
    }
    case 'barrel': {
      const out: DormerPlane[] = []
      for (let k = 0; k < BARREL_SEGMENTS; k += 1) {
        const u0 = -hw + (W * k) / BARREL_SEGMENTS
        const u1 = -hw + (W * (k + 1)) / BARREL_SEGMENTS
        const y0k = H + barrelArcY(u0, W, rise)
        const y1k = H + barrelArcY(u1, W, rise)
        const a = (y1k - y0k) / (u1 - u0)
        out.push({ a, b: 0, c: y0 + y0k - a * u0, tag: 'roof' })
      }
      return out
    }
    case 'bat':
    case 'turret':
    default:
      return null
  }
}

/** Fledermaus-Höhe über der Haupthaut. */
function batBump(u: number, v: number, W: number, H: number, D: number): number {
  const hw = W / 2
  if (Math.abs(u) >= hw) return 0
  const across = Math.cos((Math.PI * u) / W)
  let fade = 1
  if (v > 0) {
    const x = Math.min(1, v / Math.max(1, D))
    fade = 1 - (3 * x * x - 2 * x * x * x)
  }
  return H * across * across * fade
}

/** Gauben-Modell auflösen (Frame, Ebenen, Fenster-Fit). Null ohne Dach/außerhalb. */
export function resolveDormerModel(
  building: Building,
  rawRoof: RoofConfig | undefined,
  d: RoofDormer,
): DormerModel | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  if (!roof.enabled) return null
  const kind = normalizeRoofDormerKind(d.kind)
  const frameAtAnchor = roofSurfaceFrameAt(building, roof, { x: d.x, z: d.z })
  if (!frameAtAnchor) return null
  const mainPitch = roof.kind === 'mansard' ? roof.pitchLower : roof.pitch
  const tanM = Math.hypot(frameAtAnchor.plane.a, frameAtAnchor.plane.b)

  const isTurret = kind === 'turret'
  const W = isTurret ? Math.min(d.widthCm, TURRET_MAX_SIDE_CM) : d.widthCm
  const D = isTurret ? Math.min(d.depthCm, TURRET_MAX_SIDE_CM) : d.depthCm
  const H = d.heightCm
  const o = d.overhangCm ?? DORMER_DEFAULT_OVERHANG_CM
  const t = d.wallThicknessCm ?? DORMER_DEFAULT_WALL_THICKNESS_CM
  const pitch = d.roofPitchDeg ?? dormerDefaultPitchDeg(kind, mainPitch)
  const rise = d.riseCm ?? dormerDefaultRiseCm(W)
  const tilt = d.cheekTiltDeg ?? DORMER_DEFAULT_CHEEK_TILT_DEG
  const eaveBreak = Boolean(d.eaveBreak) && !isTurret && kind !== 'bat'

  let origin: XZ = frameAtAnchor.origin
  let y0 = frameAtAnchor.y
  let yBase = y0
  let vEave: number | null = null
  const frame = frameAtAnchor
  if (eaveBreak) {
    const info = roofEaveInfo(building, roof)
    const down: XZ = { x: -frame.v.x, z: -frame.v.z }
    const sWall = info ? rayHitDistance(frame.origin, down, info.outer) : null
    const sEave = info ? rayHitDistance(frame.origin, down, info.eave) : null
    if (info && sWall !== null && sEave !== null && sEave > sWall) {
      origin = { x: frame.origin.x - frame.v.x * sWall, z: frame.origin.z - frame.v.z * sWall }
      y0 = frame.y - tanM * sWall
      yBase = Math.min(info.eaveY, y0)
      vEave = -(sEave - sWall)
    }
  }

  const roofAt = (v: number) => y0 + tanM * v
  const planes = buildPlanes(kind, W, H, D, y0, tanM, pitch, rise, tilt)
  let topAt: (u: number, v: number) => number
  if (kind === 'bat') {
    topAt = (u, v) => roofAt(v) + batBump(u, v, W, H, D)
  } else if (isTurret) {
    const tanD = tanDeg(pitch)
    const yTop = yTurretTop(building, roof, frame, W, D, H)
    topAt = (_u, v) => yTop + tanD * Math.max(0, D / 2 - Math.abs(v))
  } else if (planes) {
    topAt = (u, v) => {
      let m = Infinity
      for (const p of planes) m = Math.min(m, planeAt(p, u, v))
      return m
    }
  } else {
    topAt = () => y0 + H
  }

  // Tatsächliche Tiefe = Kehle (Gaubenhaut trifft Haupthaut). `depthCm` ist nur Kappe,
  // wenn die Haut die Haupthaut nie erreicht (z. B. Schlepp steiler als Hauptdach).
  // Früher: Suche nur bis depthCm → Bibliothek-Default 120 cm erzeugte bei allen Formen
  // eine stumpfe Rückwand; durchs Fenster sah man die Dachhaut (v2.0.486).
  let actualDepth = D
  let hasBackWall = false
  if (kind === 'bat') {
    actualDepth = D
  } else if (isTurret) {
    actualDepth = D
    hasBackWall = true
  } else if (planes) {
    const probeU = [-W / 2, -W / 4, 0, W / 4, W / 2]
    const above = (v: number) => probeU.some((u) => topAt(u, v) - roofAt(v) > 0.5)
    // Hangauf bis First / großzügigem Limit — nicht an der Nutzertiefe abschneiden.
    const maxSearch = Math.max(D, 120, Math.min(2400, H / Math.max(1e-4, tanM) + W + 80))
    if (above(maxSearch)) {
      hasBackWall = true
      actualDepth = D
    } else {
      let lo = 0
      let hi = maxSearch
      for (let i = 0; i < 48; i += 1) {
        const mid = (lo + hi) / 2
        if (above(mid)) lo = mid
        else hi = mid
      }
      actualDepth = hi
      hasBackWall = false
    }
  }

  const model: DormerModel = {
    dormer: d,
    kind,
    origin,
    frame,
    y0,
    tanM,
    yBase,
    widthCm: W,
    heightCm: H,
    depthCm: D,
    overhangCm: o,
    wallThicknessCm: t,
    roofPitchDeg: pitch,
    riseCm: rise,
    cheekTiltDeg: tilt,
    eaveBreak: vEave !== null,
    vEave,
    planes,
    topAt,
    roofAt,
    window: null,
    hasBackWall,
    actualDepthCm: actualDepth,
  }
  model.window = d.window?.hidden ? null : fitDormerWindow(model, dormerWindowWithDefaults(d, W, H, kind))
  return model
}

/**
 * Gespeichertes Fenster auf den vollen Öffnungs-Feldkatalog heben. Gauben aus frühen
 * Dev-Ständen hatten nur `x/y/width/height` — ohne Gründerzeit-Teilung und Glasfelder
 * säße dort sonst ein nacktes Loch.
 */
function dormerWindowWithDefaults(
  d: RoofDormer,
  widthCm: number,
  heightCm: number,
  kind: RoofDormerKind,
): Opening {
  const fallback = defaultDormerWindow({ widthCm, heightCm, kind })
  if (!d.window) return fallback
  if (d.window.gruenderzeit) return d.window
  return { ...fallback, ...d.window }
}

/** Oberkante der Dachreiter-Wände: höchster Hauptdach-Punkt unter dem Rechteck + Höhe. */
function yTurretTop(
  building: Building,
  roof: RoofConfig,
  frame: RoofSurfaceFrame,
  W: number,
  D: number,
  H: number,
): number {
  let maxY = frame.y
  const n = 5
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= n; j += 1) {
      const u = -W / 2 + (W * i) / n
      const v = -D / 2 + (D * j) / n
      const f = roofSurfaceFrameAt(building, roof, xzAt(frame, u, v))
      if (f) maxY = Math.max(maxY, f.y)
    }
  }
  return maxY + H
}

/**
 * Fenster in die Frontwand einpassen: Breite zwischen den Wangen, Höhe unter der
 * Gaubenhaut (an den Fensterkanten gemessen), Brüstung ≥ Minimum. Gibt eine Kopie zurück.
 */
export function fitDormerWindow(model: DormerModel, win: Opening): Opening | null {
  const W = model.widthCm
  const t = model.wallThicknessCm
  const hasCheeks = roofDormerHasVerticalCheeks(model.kind)
  // Spitz/Trapez/Fledermaus: keine senkrechten Wangen — seitlich mehr Luft unter der Haut.
  const taperKinds = model.kind === 'pointed' || model.kind === 'shedTrapez' || model.kind === 'bat'
  const sideInset =
    (hasCheeks || model.kind === 'turret' ? t : 0) +
    (taperKinds ? DORMER_WINDOW_SIDE_MARGIN_CM * 2 : DORMER_WINDOW_SIDE_MARGIN_CM)
  const availW = W - 2 * sideInset
  if (availW < 24) return null
  let width = Math.max(24, Math.min(Math.round(win.width), Math.floor(availW)))
  let x = Number.isFinite(win.x) ? Math.round(win.x) : Math.round((W - width) / 2)
  x = clampNum(x, sideInset, W - sideInset - width)
  const y = Math.max(DORMER_WINDOW_SILL_MIN_CM, Math.round(win.y))
  const vFront = model.kind === 'turret' ? -model.depthCm / 2 : 0
  const topClearance = (uL: number, uR: number) => {
    let topMin = Infinity
    const samples = 11
    for (let i = 0; i <= samples; i += 1) {
      const u = uL + ((uR - uL) * i) / samples
      topMin = Math.min(topMin, model.topAt(u, vFront))
    }
    return topMin - DORMER_WINDOW_TOP_MARGIN_CM - (model.yBase + y)
  }
  // Dreieck/Welle: Breite schrumpfen, bis die Fensteroberkante unter der Profilhaut liegt.
  for (let guard = 0; guard < 12; guard += 1) {
    const uL = x - W / 2
    const uR = uL + width
    const availH = topClearance(uL, uR)
    if (availH >= 24) {
      const height = Math.max(24, Math.min(Math.round(win.height), Math.floor(availH)))
      return {
        ...win,
        id: win.id || 'dormer-window',
        type: win.type === 'door' ? 'door' : 'window',
        x,
        y,
        width,
        height,
      }
    }
    if (!taperKinds || width <= 28) break
    width = Math.max(24, Math.floor(width * 0.85))
    x = clampNum(Math.round((W - width) / 2), sideInset, W - sideInset - width)
  }
  return null
}

// ---------------------------------------------------------------------------
// Fußabdruck, Löcher, Traufschnitte
// ---------------------------------------------------------------------------

function toXZ(model: DormerModel, u: number, v: number): XZ {
  const f = model.frame
  return {
    x: model.origin.x + f.u.x * u + f.v.x * v,
    z: model.origin.z + f.u.z * u + f.v.z * v,
  }
}

function toWorld(model: DormerModel, u: number, v: number, y: number): THREE.Vector3 {
  const p = toXZ(model, u, v)
  return new THREE.Vector3(p.x, y, p.z)
}

function uvRectPoly(u0: number, u1: number, v0: number, v1: number): XZ[] {
  return [
    { x: u0, z: v0 },
    { x: u1, z: v0 },
    { x: u1, z: v1 },
    { x: u0, z: v1 },
  ]
}

function polyAreaXZ(poly: XZ[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.z - q.x * p.z
  }
  return a * 0.5
}

/** Monotone-Chain-Hülle (XZ). */
function convexHullXZ(points: XZ[]): XZ[] {
  const pts = [...points].sort((p, q) => (p.x === q.x ? p.z - q.z : p.x - q.x))
  if (pts.length < 3) return pts
  const cross = (o: XZ, a: XZ, b: XZ) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const lower: XZ[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-9) lower.pop()
    lower.push(p)
  }
  const upper: XZ[] = []
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-9) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/** Faces des Ebenen-Modells im (u,v)-Raum, je Ebene ein konvexes Polygon. */
function planeFacesUV(model: DormerModel): Array<{ plane: DormerPlane; poly: XZ[] }> {
  const planes = model.planes
  if (!planes) return []
  const hw = model.widthCm / 2
  const o = model.overhangCm
  const vBack = model.hasBackWall ? model.depthCm : model.actualDepthCm + 1
  const rect = uvRectPoly(-hw - o, hw + o, -o, vBack)
  const out: Array<{ plane: DormerPlane; poly: XZ[] }> = []
  for (let i = 0; i < planes.length; i += 1) {
    const pi = planes[i]
    let poly = rect
    for (let j = 0; j < planes.length && poly.length >= 3; j += 1) {
      if (j === i) continue
      const pj = planes[j]
      // P_j − P_i ≥ 0
      poly = clipPolygonByHalfPlane(poly, pj.a - pi.a, pj.b - pi.b, pj.c - pi.c)
    }
    if (poly.length < 3) continue
    // P_i − g ≥ 0
    poly = clipPolygonByHalfPlane(poly, pi.a, pi.b - model.tanM, pi.c - model.y0)
    if (poly.length >= 3 && Math.abs(polyAreaXZ(poly)) > 4) out.push({ plane: pi, poly })
  }
  return out
}

/** Äußerer Fußabdruck (mit Überstand) — Picking, Überlappung, Ziehen. */
export function dormerFootprint(building: Building, roof: RoofConfig, d: RoofDormer): XZ[] | null {
  const model = resolveDormerModel(building, roof, d)
  if (!model) return null
  return dormerModelFootprint(model)
}

export function dormerModelFootprint(model: DormerModel): XZ[] {
  const hw = model.widthCm / 2
  const o = model.overhangCm
  if (model.kind === 'turret') {
    const hd = model.depthCm / 2
    return orientRingCcw([
      toXZ(model, -hw - o, -hd - o),
      toXZ(model, hw + o, -hd - o),
      toXZ(model, hw + o, hd + o),
      toXZ(model, -hw - o, hd + o),
    ])
  }
  const vFront = model.vEave ?? -o
  const vBack = model.actualDepthCm
  return orientRingCcw([
    toXZ(model, -hw - o, vFront),
    toXZ(model, hw + o, vFront),
    toXZ(model, hw + o, vBack),
    toXZ(model, -hw - o, vBack),
  ])
}

/** Löcher in der Haupthaut (konvex, Welt-XZ) für eine Gaube. */
export function dormerRoofHoles(model: DormerModel): XZ[][] {
  const hw = model.widthCm / 2
  const t = model.wallThicknessCm
  const m = DORMER_HOLE_MARGIN_CM
  const holes: XZ[][] = []
  const toWorldPoly = (poly: XZ[]) => orientRingCcw(poly.map((p) => toXZ(model, p.x, p.z)))

  if (model.kind === 'turret') {
    const hd = model.depthCm / 2
    holes.push(toWorldPoly(uvRectPoly(-hw + t, hw - t, -hd + t, hd - t)))
    return holes
  }

  if (model.kind === 'bat') {
    const pts: XZ[] = []
    const rows = 14
    const vStart = t
    const vEnd = model.depthCm
    for (let i = 0; i <= rows; i += 1) {
      const v = vStart + ((vEnd - vStart) * i) / rows
      const peak = batBump(0, v, model.widthCm, model.heightCm, model.depthCm)
      if (peak <= m) break
      const ratio = m / peak
      const uMax = Math.min(hw - t, (model.widthCm / Math.PI) * Math.acos(Math.sqrt(ratio)))
      if (uMax < 4) break
      pts.push({ x: -uMax, z: v }, { x: uMax, z: v })
    }
    if (pts.length >= 4) {
      const hull = convexHullXZ(pts)
      if (hull.length >= 3) holes.push(toWorldPoly(hull))
    }
    return holes
  }

  const planes = model.planes
  if (!planes) return holes
  const hasCheeks = roofDormerHasVerticalCheeks(model.kind)
  const uIn = hasCheeks ? hw - t : hw - m
  const vBack = model.hasBackWall ? model.depthCm - t : model.actualDepthCm + 2
  let poly = uvRectPoly(-uIn, uIn, model.eaveBreak ? -1 : t, vBack)
  for (const p of planes) {
    // P − g ≥ m
    poly = clipPolygonByHalfPlane(poly, p.a, p.b - model.tanM, p.c - model.y0 - m)
    if (poly.length < 3) break
  }
  if (poly.length >= 3 && Math.abs(polyAreaXZ(poly)) > 16) holes.push(toWorldPoly(poly))

  if (model.eaveBreak && model.vEave !== null) {
    // Traufstreifen vor der Frontwand bis unter die Wand (volle Breite).
    holes.push(toWorldPoly(uvRectPoly(-hw, hw, model.vEave - 6, t + 0.5)))
  }
  return holes
}

/** Traufschnitt (Rinne/Stirn unterbrechen) — nur bei Traufdurchbruch. */
export function dormerEaveCut(model: DormerModel): RoofEaveCut | null {
  if (!model.eaveBreak || model.vEave === null) return null
  const hw = model.widthCm / 2
  return { a: toXZ(model, -hw, model.vEave), b: toXZ(model, hw, model.vEave) }
}

// ---------------------------------------------------------------------------
// Position relativ zur Traufe
// ---------------------------------------------------------------------------

export interface DormerEavePlacement {
  /** Abstand Frontwand-Mitte ↔ Traufkante, im Grundriss hangabwärts gemessen (cm). */
  distanceCm: number
  /** Position entlang der Traufkante, vom Kantenanfang (cm). */
  alongCm: number
  /** Index der Traufkante im Traufpolygon (mit Überstand). */
  edgeIndex: number
  /** Länge dieser Traufkante (cm). */
  edgeLengthCm: number
}

/** Traufbezogene Position einer Gaube — Grundlage der Zahlenfelder in der rechten Leiste. */
export function dormerEavePlacement(
  building: Building,
  rawRoof: RoofConfig | undefined,
  d: Pick<RoofDormer, 'x' | 'z'>,
): DormerEavePlacement | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  const frame = roofSurfaceFrameAt(building, roof, { x: d.x, z: d.z })
  const info = roofEaveInfo(building, roof)
  if (!frame || !info || info.eave.length < 3) return null
  const hit = rayHitRing(frame.origin, { x: -frame.v.x, z: -frame.v.z }, info.eave)
  if (!hit) return null
  const a = info.eave[hit.index]
  const b = info.eave[(hit.index + 1) % info.eave.length]
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  return { distanceCm: hit.t, alongCm: hit.s * len, edgeIndex: hit.index, edgeLengthCm: len }
}

/**
 * Neuer Anker (Welt-XZ) für geänderten Traufabstand / Lauf auf der Traufkante.
 * Iteriert, weil die Gefällerichtung `v` von der getroffenen Dachfläche abhängt.
 */
export function dormerAnchorForEavePlacement(
  building: Building,
  rawRoof: RoofConfig | undefined,
  d: Pick<RoofDormer, 'x' | 'z'>,
  next: { distanceCm?: number; alongCm?: number },
): XZ | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  const current = dormerEavePlacement(building, roof, d)
  const info = roofEaveInfo(building, roof)
  const startFrame = roofSurfaceFrameAt(building, roof, { x: d.x, z: d.z })
  if (!current || !info || !startFrame) return null
  const dist = Math.max(2, next.distanceCm ?? current.distanceCm)
  const along = clampNum(next.alongCm ?? current.alongCm, 0, current.edgeLengthCm)
  const a = info.eave[current.edgeIndex]
  const b = info.eave[(current.edgeIndex + 1) % info.eave.length]
  const len = current.edgeLengthCm || 1
  const foot: XZ = { x: a.x + ((b.x - a.x) * along) / len, z: a.z + ((b.z - a.z) * along) / len }
  let v = startFrame.v
  let p: XZ = { x: foot.x + v.x * dist, z: foot.z + v.z * dist }
  for (let i = 0; i < 3; i += 1) {
    const f = roofSurfaceFrameAt(building, roof, p)
    if (!f) break
    v = f.v
    p = { x: foot.x + v.x * dist, z: foot.z + v.z * dist }
  }
  return roofSurfaceFrameAt(building, roof, p) ? p : null
}

/** Alle Löcher (Dachfenster + Gauben) für die Dachhaut. */
export function roofOpeningHoles(building: Building, roof: RoofConfig): XZ[][] {
  const holes: XZ[][] = []
  for (const s of roof.skylights ?? []) {
    if (s.hidden) continue
    const foot = skylightFootprint(building, roof, s)
    if (foot && foot.length >= 3) holes.push(foot)
  }
  for (const d of roof.dormers ?? []) {
    if (d.hidden) continue
    const model = resolveDormerModel(building, roof, d)
    if (!model) continue
    for (const hole of dormerRoofHoles(model)) if (hole.length >= 3) holes.push(hole)
  }
  return holes
}

/** Traufschnitte aller Gauben mit Traufdurchbruch. */
export function roofEaveCuts(building: Building, roof: RoofConfig): RoofEaveCut[] {
  const cuts: RoofEaveCut[] = []
  for (const d of roof.dormers ?? []) {
    if (d.hidden || !d.eaveBreak) continue
    const model = resolveDormerModel(building, roof, d)
    if (!model) continue
    const cut = dormerEaveCut(model)
    if (cut) cuts.push(cut)
  }
  return cuts
}

export function createSkylightFixture(
  x: number,
  z: number,
  widthCm = 80,
  heightCm = 120,
): RoofSkylight {
  return {
    id: createId(),
    x,
    z,
    widthCm,
    heightCm,
  }
}

export function createDormerFixture(
  kind: RoofDormerKind,
  x: number,
  z: number,
  widthCm = 160,
  depthCm = 400,
  heightCm = 140,
  donorWalls?: Array<{ openings?: Opening[] }>,
): RoofDormer {
  const k = normalizeRoofDormerKind(kind)
  const base: RoofDormer = {
    id: createId(),
    kind: k,
    x,
    z,
    widthCm: k === 'turret' ? Math.min(widthCm, 120) : widthCm,
    depthCm: k === 'turret' ? 120 : depthCm,
    heightCm: k === 'bat' ? Math.min(heightCm, 96) : heightCm,
  }
  if (k === 'bat') {
    // Fledermaus: breit und flach; der Auslauf hangaufwärts hängt an der Breite,
    // sonst wirkt die Welle als Rampe (zu tief) oder als Beule (zu kurz).
    base.widthCm = Math.max(widthCm, 320)
    base.depthCm = Math.round(base.widthCm * 0.9)
  }
  base.window = defaultDormerWindow(base, donorWalls)
  return base
}

// ---------------------------------------------------------------------------
// Geometrie-Helfer
// ---------------------------------------------------------------------------

interface GeoSink {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}

function newSink(): GeoSink {
  return { positions: [], normals: [], uvs: [], indices: [] }
}

function pushQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
) {
  const n = new THREE.Vector3()
    .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
    .normalize()
  const base = positions.length / 3
  for (const p of [a, b, c, d]) {
    positions.push(p.x, p.y, p.z)
    normals.push(n.x, n.y, n.z)
    uvs.push(0, 0)
  }
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

/** Planares Polygon (Fan) mit gegebener Normale; Reihenfolge bestimmt die Seite. */
function pushPolygon(sink: GeoSink, pts: THREE.Vector3[], flip = false) {
  if (pts.length < 3) return
  const ring = flip ? [...pts].reverse() : pts
  const n = new THREE.Vector3()
  // Newell-Normale (robust bei kollinearen ersten Punkten)
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i]
    const q = ring[(i + 1) % ring.length]
    n.x += (p.y - q.y) * (p.z + q.z)
    n.y += (p.z - q.z) * (p.x + q.x)
    n.z += (p.x - q.x) * (p.y + q.y)
  }
  if (n.lengthSq() < 1e-12) return
  n.normalize()
  const base = sink.positions.length / 3
  for (const p of ring) {
    sink.positions.push(p.x, p.y, p.z)
    sink.normals.push(n.x, n.y, n.z)
    sink.uvs.push(0, 0)
  }
  for (let i = 1; i + 1 < ring.length; i += 1) sink.indices.push(base, base + i, base + i + 1)
}

function toGeo(positions: number[], normals: number[], uvs: number[], indices: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

function sinkToGeo(sink: GeoSink): THREE.BufferGeometry {
  if (sink.positions.length === 0) {
    return toGeo([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 0, 1, 0, 0, 1], [0, 1, 2])
  }
  return toGeo(sink.positions, sink.normals, sink.uvs, sink.indices)
}

/** BufferGeometry (indiziert oder nicht) in den Sink kopieren. */
function appendGeometry(sink: GeoSink, geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const uv = geo.getAttribute('uv')
  const idx = geo.getIndex()
  if (!pos) return
  const base = sink.positions.length / 3
  for (let i = 0; i < pos.count; i += 1) {
    sink.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    if (nor) sink.normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
    else sink.normals.push(0, 1, 0)
    if (uv) sink.uvs.push(uv.getX(i), uv.getY(i))
    else sink.uvs.push(0, 0)
  }
  if (idx) {
    for (let i = 0; i < idx.count; i += 1) sink.indices.push(idx.getX(i) + base)
  } else {
    for (let i = 0; i < pos.count; i += 1) sink.indices.push(base + i)
  }
}

interface SY {
  s: number
  y: number
}

/** Duplikate/degenerierte Punkte im Profilring entfernen. */
function cleanRing(ring: SY[]): SY[] {
  const out: SY[] = []
  for (const p of ring) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.s - p.s) < 1e-3 && Math.abs(last.y - p.y) < 1e-3) continue
    out.push(p)
  }
  while (
    out.length > 1 &&
    Math.abs(out[0].s - out[out.length - 1].s) < 1e-3 &&
    Math.abs(out[0].y - out[out.length - 1].y) < 1e-3
  ) {
    out.pop()
  }
  return out
}

/**
 * Profil (s, y) als Wandscheibe extrudieren. `origin` = Weltpunkt für s=0,y=0,z=0,
 * `sAxis` = Welt-Richtung von s, `zAxis` = Extrusionsrichtung (Wandstärke).
 * Spiegelt s bei linkshändiger Basis, damit die Flächennormalen außen bleiben.
 */
function extrudeProfile(
  sink: GeoSink,
  outer: SY[],
  holes: SY[][],
  depth: number,
  origin: THREE.Vector3,
  sAxis: THREE.Vector3,
  zAxis: THREE.Vector3,
) {
  const ring = cleanRing(outer)
  if (ring.length < 3) return
  const up = new THREE.Vector3(0, 1, 0)
  const det = new THREE.Vector3().crossVectors(sAxis, up).dot(zAxis)
  const mirror = det < 0
  const sx = mirror ? -1 : 1
  const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.s * sx, p.y)))
  for (const h of holes) {
    const hr = cleanRing(h)
    if (hr.length >= 3) shape.holes.push(new THREE.Path(hr.map((p) => new THREE.Vector2(p.s * sx, p.y))))
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
  const sWorld = sAxis.clone().multiplyScalar(sx)
  const m = new THREE.Matrix4().makeBasis(sWorld, up, zAxis.clone().normalize())
  m.setPosition(origin)
  geo.applyMatrix4(m)
  appendGeometry(sink, geo)
  geo.dispose()
}

// ---------------------------------------------------------------------------
// Dachflächen (Ebenen-Modell)
// ---------------------------------------------------------------------------

interface DormerSinks {
  shell: GeoSink
  roof: GeoSink
  trim: GeoSink
}

function isFreeEdge(model: DormerModel, p: XZ, q: XZ): boolean {
  const hw = model.widthCm / 2 + model.overhangCm
  const eps = 0.05
  const vFront = -model.overhangCm
  if (Math.abs(p.z - vFront) < eps && Math.abs(q.z - vFront) < eps) return true
  if (Math.abs(p.x - hw) < eps && Math.abs(q.x - hw) < eps) return true
  if (Math.abs(p.x + hw) < eps && Math.abs(q.x + hw) < eps) return true
  return false
}

function buildPlanarRoof(model: DormerModel, sinks: DormerSinks) {
  const faces = planeFacesUV(model)
  const tau = DORMER_ROOF_THICKNESS_CM
  for (const { plane, poly } of faces) {
    const ring = orientRingCcw(poly)
    const top = ring.map((p) => toWorld(model, p.x, p.z, planeAt(plane, p.x, p.z)))
    const bottom = top.map((p) => p.clone().setY(p.y - tau))
    // Oben: CCW in (u,v) mit u×v = −Y-Orientierung? Newell-Normale prüfen → nach oben drehen.
    pushOriented(sinks.roof, top, true)
    pushOriented(sinks.trim, bottom, false)
    for (let i = 0; i < ring.length; i += 1) {
      const p = ring[i]
      const q = ring[(i + 1) % ring.length]
      if (!isFreeEdge(model, p, q)) continue
      const a = top[i]
      const b = top[(i + 1) % ring.length]
      const c = bottom[(i + 1) % ring.length]
      const d = bottom[i]
      // Außenseite: Normale weg von der Gaubenmitte.
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
      const centerXZ = toWorld(model, 0, model.actualDepthCm / 2, mid.y)
      const outward = new THREE.Vector3().subVectors(mid, centerXZ).setY(0)
      const n = new THREE.Vector3()
        .crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
      if (n.dot(outward) >= 0) pushQuad(sinks.trim.positions, sinks.trim.normals, sinks.trim.uvs, sinks.trim.indices, a, b, c, d)
      else pushQuad(sinks.trim.positions, sinks.trim.normals, sinks.trim.uvs, sinks.trim.indices, b, a, d, c)
    }
  }
}

/** Polygon so orientieren, dass die Normale nach oben (`up=true`) bzw. unten zeigt. */
function pushOriented(sink: GeoSink, pts: THREE.Vector3[], up: boolean) {
  if (pts.length < 3) return
  let ny = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    ny += (p.z - q.z) * (p.x + q.x)
  }
  const flip = up ? ny < 0 : ny > 0
  pushPolygon(sink, pts, flip)
}

// ---------------------------------------------------------------------------
// Senkrechte Wände
// ---------------------------------------------------------------------------

/**
 * Obere Profillinie entlang u bei festem v: Knicke aus Ebenenpaaren + Rand.
 * `drop` senkt das Profil auf die **Unterseite** der Gaubendachhaut — sonst liegt die
 * Wandoberkante deckungsgleich auf der Dachfläche (Z-Fighting-Streifen, v2.0.479).
 */
function topProfileU(model: DormerModel, v: number, u0: number, u1: number, drop = 0): SY[] {
  const planes = model.planes
  const us = new Set<number>([u0, u1])
  if (planes) {
    for (let i = 0; i < planes.length; i += 1) {
      for (let j = i + 1; j < planes.length; j += 1) {
        const da = planes[i].a - planes[j].a
        if (Math.abs(da) < 1e-9) continue
        const u = (planes[j].c - planes[i].c + (planes[j].b - planes[i].b) * v) / da
        if (u > u0 + 1e-6 && u < u1 - 1e-6) us.add(u)
      }
    }
  } else {
    const n = BAT_U_SEGMENTS
    for (let i = 1; i < n; i += 1) us.add(u0 + ((u1 - u0) * i) / n)
  }
  return [...us].sort((a, b) => a - b).map((u) => ({ s: u, y: model.topAt(u, v) - drop }))
}

/** Obere Profillinie entlang v bei festem u (Wangen): Knicke aus Ebenenpaaren + Kehle. */
function topProfileV(model: DormerModel, u: number, v0: number, v1: number, drop = 0): SY[] {
  const planes = model.planes
  const vs = new Set<number>([v0, v1])
  if (planes) {
    for (let i = 0; i < planes.length; i += 1) {
      for (let j = i + 1; j < planes.length; j += 1) {
        const db = planes[i].b - planes[j].b
        if (Math.abs(db) < 1e-9) continue
        const v = (planes[j].c - planes[i].c + (planes[j].a - planes[i].a) * u) / db
        if (v > v0 + 1e-6 && v < v1 - 1e-6) vs.add(v)
      }
    }
  }
  return [...vs].sort((a, b) => a - b).map((v) => ({ s: v, y: model.topAt(u, v) - drop }))
}

function windowHoleProfile(model: DormerModel): SY[] | null {
  const win = model.window
  if (!win) return null
  const embed = openingRevealEmbed(win)
  const mask = openingMaskPolyline(win, -embed)
  if (mask.length < 3) return null
  const W = model.widthCm
  const vFront = model.kind === 'turret' ? -model.depthCm / 2 : 0
  const pts: SY[] = mask.map((p) => ({ s: p.x - W / 2, y: model.yBase + p.y }))
  // Rechteck muss im Frontprofil liegen — sonst bricht ExtrudeGeometry (Spitz/Fledermaus).
  for (const p of pts) {
    if (p.y > model.topAt(p.s, vFront) - DORMER_ROOF_THICKNESS_CM - 0.5) return null
  }
  return pts
}

function buildFrontWall(model: DormerModel, sinks: DormerSinks, vFront: number, withWindow: boolean) {
  const hw = model.widthCm / 2
  const t = model.wallThicknessCm
  const top = topProfileU(model, vFront, -hw, hw, DORMER_ROOF_THICKNESS_CM)
  const ring: SY[] = [{ s: -hw, y: model.yBase }, { s: hw, y: model.yBase }]
  for (let i = top.length - 1; i >= 0; i -= 1) {
    if (top[i].y > model.yBase + 0.05) ring.push(top[i])
    else ring.push({ s: top[i].s, y: model.yBase })
  }
  const holes: SY[][] = []
  const hole = withWindow ? windowHoleProfile(model) : null
  if (hole) holes.push(hole)
  const origin = toWorld(model, 0, vFront, 0)
  const f = model.frame
  const sAxis = new THREE.Vector3(f.u.x, 0, f.u.z)
  const zAxis = new THREE.Vector3(f.v.x, 0, f.v.z) // nach innen
  extrudeProfile(sinks.shell, ring, holes, t, origin, sAxis, zAxis)
}

function buildBackWall(model: DormerModel, sinks: DormerSinks, vBack: number) {
  const hw = model.widthCm / 2
  const t = model.wallThicknessCm
  const yB = model.roofAt(vBack)
  const top = topProfileU(model, vBack, -hw, hw, DORMER_ROOF_THICKNESS_CM)
  if (!top.some((p) => p.y > yB + 0.5)) return
  const ring: SY[] = [{ s: -hw, y: yB - 2 }, { s: hw, y: yB - 2 }]
  for (let i = top.length - 1; i >= 0; i -= 1) ring.push({ s: top[i].s, y: Math.max(yB - 2, top[i].y) })
  const origin = toWorld(model, 0, vBack, 0)
  const f = model.frame
  const sAxis = new THREE.Vector3(f.u.x, 0, f.u.z)
  const zAxis = new THREE.Vector3(-f.v.x, 0, -f.v.z) // nach innen (nach vorn)
  extrudeProfile(sinks.shell, ring, [], t, origin, sAxis, zAxis)
}

function buildCheek(model: DormerModel, sinks: DormerSinks, side: -1 | 1, vFront: number, vBack: number) {
  const hw = model.widthCm / 2
  const t = model.wallThicknessCm
  const u = side * hw
  const top = topProfileV(model, u, vFront, vBack, DORMER_ROOF_THICKNESS_CM)
  // Kehle: erstes v, an dem top ≤ Hauptdach.
  const pts: SY[] = []
  let ended = false
  for (let i = 0; i < top.length; i += 1) {
    const cur = top[i]
    const gap = cur.y - model.roofAt(cur.s)
    if (gap <= 0.05) {
      if (i > 0) {
        const prev = top[i - 1]
        const gPrev = prev.y - model.roofAt(prev.s)
        const tRoot = gPrev / Math.max(1e-9, gPrev - gap)
        const s = prev.s + (cur.s - prev.s) * tRoot
        pts.push({ s, y: model.roofAt(s) })
      }
      ended = true
      break
    }
    pts.push(cur)
  }
  if (pts.length < 2) return
  const vEnd = pts[pts.length - 1].s
  // Ring: unten entlang Hauptdach von vEnd zurück zur Front, dann oben nach hinten.
  const ring: SY[] = []
  ring.push({ s: vFront, y: Math.min(model.yBase, model.roofAt(vFront)) })
  if (model.yBase < model.roofAt(vFront) - 0.05) ring.push({ s: vFront, y: model.roofAt(vFront) })
  if (!ended) ring.push({ s: vEnd, y: model.roofAt(vEnd) })
  // obere Kante von hinten nach vorn
  for (let i = pts.length - 1; i >= 0; i -= 1) ring.push(pts[i])
  // Höhe prüfen
  let maxGap = 0
  for (const p of pts) maxGap = Math.max(maxGap, p.y - model.roofAt(p.s))
  if (maxGap < 1) return
  const origin = toWorld(model, u, 0, 0)
  const f = model.frame
  const sAxis = new THREE.Vector3(f.v.x, 0, f.v.z)
  const zAxis = new THREE.Vector3(-side * f.u.x, 0, -side * f.u.z) // nach innen
  extrudeProfile(sinks.shell, ring, [], t, origin, sAxis, zAxis)
}

// ---------------------------------------------------------------------------
// Fledermaus (Heightfield)
// ---------------------------------------------------------------------------

function buildBatRoof(model: DormerModel, sinks: DormerSinks) {
  const W = model.widthCm
  const hw = W / 2
  const o = model.overhangCm
  const D = model.depthCm
  const tau = DORMER_ROOF_THICKNESS_CM
  const nu = BAT_U_SEGMENTS
  const nv = BAT_V_SEGMENTS
  // Reihe 0 = Überstand (v = −o), Reihe 1 = Frontlinie, dann bis D.
  const vAt = (j: number) => (j === 0 ? -o : (D * (j - 1)) / (nv - 1))
  const rows: THREE.Vector3[][] = []
  for (let j = 0; j <= nv; j += 1) {
    const v = vAt(j)
    const row: THREE.Vector3[] = []
    for (let i = 0; i <= nu; i += 1) {
      const u = -hw + (W * i) / nu
      row.push(toWorld(model, u, v, model.topAt(u, v)))
    }
    rows.push(row)
  }
  const r = sinks.roof
  for (let j = 0; j < nv; j += 1) {
    for (let i = 0; i < nu; i += 1) {
      const a = rows[j][i]
      const b = rows[j][i + 1]
      const c = rows[j + 1][i + 1]
      const d = rows[j + 1][i]
      pushOriented(r, [a, b, c, d], true)
    }
  }
  // Vorderkante: Blende + Untersicht des Überstands (v ∈ [−o, 0]).
  for (let i = 0; i < nu; i += 1) {
    const a = rows[0][i]
    const b = rows[0][i + 1]
    if (a.y - model.roofAt(-o) < 0.5 && b.y - model.roofAt(-o) < 0.5) continue
    const c = b.clone().setY(b.y - tau)
    const d = a.clone().setY(a.y - tau)
    pushOriented(sinks.trim, [a, b, c, d], false)
    const e = rows[1][i + 1].clone().setY(rows[1][i + 1].y - tau)
    const f = rows[1][i].clone().setY(rows[1][i].y - tau)
    pushOriented(sinks.trim, [d, c, e, f], false)
  }
}

// ---------------------------------------------------------------------------
// Dachreiter
// ---------------------------------------------------------------------------

function buildTurret(building: Building, roof: RoofConfig, model: DormerModel, sinks: DormerSinks) {
  const W = model.widthCm
  const D = model.depthCm
  const hw = W / 2
  const hd = D / 2
  const t = model.wallThicknessCm
  const o = model.overhangCm
  const tau = DORMER_ROOF_THICKNESS_CM
  const yTop = yTurretTop(building, roof, model.frame, W, D, model.heightCm)
  const tanD = tanDeg(model.roofPitchDeg)
  const f = model.frame
  const U = new THREE.Vector3(f.u.x, 0, f.u.z)
  const V = new THREE.Vector3(f.v.x, 0, f.v.z)
  const roofYAt = (u: number, v: number) => roofSurfaceFrameAt(building, roof, toXZ(model, u, v))?.y ?? model.roofAt(v)
  const n = 6

  // Front (v = −hd) mit Fenster, Rückwand (v = +hd)
  for (const side of [-1, 1] as const) {
    const v = side * hd
    const ring: SY[] = []
    for (let i = 0; i <= n; i += 1) {
      const u = -hw + (W * i) / n
      ring.push({ s: u, y: roofYAt(u, v) - 4 })
    }
    // Wandoberkante auf die Dach-Unterseite — sonst deckungsgleich mit der Dachfläche.
    ring.push({ s: hw, y: yTop - tau }, { s: -hw, y: yTop - tau })
    const holes: SY[][] = []
    if (side === -1) {
      const hole = windowHoleProfile(model)
      if (hole) holes.push(hole)
    }
    extrudeProfile(sinks.shell, ring, holes, t, toWorld(model, 0, v, 0), U, V.clone().multiplyScalar(-side))
  }
  // Wangen (u = ±hw) mit Giebeldreieck (First entlang u bei v = 0)
  for (const side of [-1, 1] as const) {
    const u = side * hw
    const ring: SY[] = []
    for (let i = 0; i <= n; i += 1) {
      const v = -hd + (D * i) / n
      ring.push({ s: v, y: roofYAt(u, v) - 4 })
    }
    ring.push(
      { s: hd, y: yTop - tau },
      { s: 0, y: yTop + tanD * hd - tau },
      { s: -hd, y: yTop - tau },
    )
    extrudeProfile(sinks.shell, ring, [], t, toWorld(model, u, 0, 0), V, U.clone().multiplyScalar(-side))
  }
  // Satteldach (zwei Rechtecke) mit Überstand, Blenden, Untersicht
  const ridgeY = yTop + tanD * hd
  const eaveY = yTop - tanD * o
  for (const side of [-1, 1] as const) {
    const a = toWorld(model, -hw - o, side * (hd + o), eaveY)
    const b = toWorld(model, hw + o, side * (hd + o), eaveY)
    const c = toWorld(model, hw + o, 0, ridgeY)
    const d = toWorld(model, -hw - o, 0, ridgeY)
    pushOriented(sinks.roof, [a, b, c, d], true)
    const a2 = a.clone().setY(a.y - tau)
    const b2 = b.clone().setY(b.y - tau)
    const c2 = c.clone().setY(c.y - tau)
    const d2 = d.clone().setY(d.y - tau)
    pushOriented(sinks.trim, [a2, b2, c2, d2], false)
    // Traufblende
    pushOutwardQuad(sinks.trim, a, b, b2, a2, toWorld(model, 0, 0, eaveY))
    // Ortgang
    pushOutwardQuad(sinks.trim, b, c, c2, b2, toWorld(model, 0, 0, eaveY))
    pushOutwardQuad(sinks.trim, d, a, a2, d2, toWorld(model, 0, 0, eaveY))
  }
}

/** Quad mit Normale weg vom Zentrum (XZ). */
function pushOutwardQuad(
  sink: GeoSink,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  center: THREE.Vector3,
) {
  const mid = new THREE.Vector3().addVectors(a, c).multiplyScalar(0.5)
  const outward = new THREE.Vector3().subVectors(mid, center).setY(0)
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a))
  if (n.dot(outward) >= 0) pushQuad(sink.positions, sink.normals, sink.uvs, sink.indices, a, b, c, d)
  else pushQuad(sink.positions, sink.normals, sink.uvs, sink.indices, b, a, d, c)
}

// ---------------------------------------------------------------------------
// Fensterbank + Fensterplatzierung
// ---------------------------------------------------------------------------

export interface DormerWindowPlacement {
  /** Gefittete Öffnung (x von links der Frontwand, y ab Wandunterkante). */
  opening: Opening
  /** Welt-Mitte der Öffnung auf der Außenfläche der Frontwand. */
  center: THREE.Vector3
  /** Rechts (Betrachter), Oben, Außen (zum Betrachter). */
  right: THREE.Vector3
  up: THREE.Vector3
  outward: THREE.Vector3
  /** Rücksprung der Rahmenfront hinter der Außenfläche (cm). */
  recessCm: number
  wallThicknessCm: number
}

function windowPlacement(model: DormerModel, vFront: number): DormerWindowPlacement | null {
  const win = model.window
  if (!win) return null
  const W = model.widthCm
  const uC = win.x + win.width / 2 - W / 2
  const yC = model.yBase + win.y + win.height / 2
  const f = model.frame
  const right = new THREE.Vector3(f.u.x, 0, f.u.z).normalize()
  const outward = new THREE.Vector3(-f.v.x, 0, -f.v.z).normalize()
  return {
    opening: win,
    center: toWorld(model, uC, vFront, yC),
    right,
    up: new THREE.Vector3(0, 1, 0),
    outward,
    recessCm: DORMER_WINDOW_RECESS_CM,
    wallThicknessCm: model.wallThicknessCm,
  }
}

function buildWindowSill(model: DormerModel, sinks: DormerSinks, vFront: number) {
  const win = model.window
  if (!win) return
  const W = model.widthCm
  const uL = win.x - W / 2 - 3
  const uR = uL + win.width + 6
  const y = model.yBase + win.y
  const proj = 4
  const th = 3
  const a = toWorld(model, uL, vFront - proj, y)
  const b = toWorld(model, uR, vFront - proj, y)
  const c = toWorld(model, uR, vFront + DORMER_WINDOW_RECESS_CM, y)
  const d = toWorld(model, uL, vFront + DORMER_WINDOW_RECESS_CM, y)
  pushOriented(sinks.trim, [a, b, c, d], true)
  const a2 = a.clone().setY(y - th)
  const b2 = b.clone().setY(y - th)
  pushOriented(sinks.trim, [a2, b2, c.clone().setY(y - th), d.clone().setY(y - th)], false)
  pushOutwardQuad(sinks.trim, a, b, b2, a2, toWorld(model, 0, model.actualDepthCm / 2, y))
  pushOutwardQuad(sinks.trim, a, a2, d.clone().setY(y - th), d, toWorld(model, 0, model.actualDepthCm / 2, y))
  pushOutwardQuad(sinks.trim, b, c, c.clone().setY(y - th), b2, toWorld(model, 0, model.actualDepthCm / 2, y))
}

// ---------------------------------------------------------------------------
// Dachfenster
// ---------------------------------------------------------------------------

export interface SkylightBuildResult {
  frame: THREE.BufferGeometry
  glass: THREE.BufferGeometry
}

/** Flacher Rahmen + Glas auf der Dachhaut. */
export function buildSkylightMeshes(
  building: Building,
  roof: RoofConfig,
  s: RoofSkylight,
): SkylightBuildResult | null {
  const surf = roofSurfaceFrameAt(building, roof, { x: s.x, z: s.z })
  if (!surf) return null
  const hw = s.widthCm / 2
  const hd = s.heightCm / 2
  const f = SKYLIGHT_FRAME_CM
  const lift = SKYLIGHT_LIFT_CM
  const n = surf.normal
  const ux = new THREE.Vector3(surf.u.x, 0, surf.u.z)
  // Orthonormalisieren auf der Ebene
  const u = new THREE.Vector3().crossVectors(n, new THREE.Vector3().crossVectors(ux, n)).normalize()
  const v = new THREE.Vector3().crossVectors(n, u).normalize().negate()
  // v soll hangauf ≈ surf.v
  if (v.x * surf.v.x + v.z * surf.v.z < 0) v.negate()

  const center = new THREE.Vector3(surf.origin.x, surf.y, surf.origin.z).addScaledVector(n, lift)

  const corner = (su: number, sv: number, alongN = 0) =>
    center
      .clone()
      .addScaledVector(u, su)
      .addScaledVector(v, sv)
      .addScaledVector(n, alongN)

  const framePos: number[] = []
  const frameNor: number[] = []
  const frameUv: number[] = []
  const frameIdx: number[] = []

  // Äußerer Ring oben, innerer Ring (Glasöffnung)
  const outer = [
    corner(-hw, -hd, f),
    corner(hw, -hd, f),
    corner(hw, hd, f),
    corner(-hw, hd, f),
  ]
  const inner = [
    corner(-(hw - f), -(hd - f), f),
    corner(hw - f, -(hd - f), f),
    corner(hw - f, hd - f, f),
    corner(-(hw - f), hd - f, f),
  ]
  const outerBot = outer.map((p) => p.clone().addScaledVector(n, -f))
  const innerBot = inner.map((p) => p.clone().addScaledVector(n, -f * 0.5))

  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4
    // Oberseite Rahmen
    pushQuad(framePos, frameNor, frameUv, frameIdx, outer[i], outer[j], inner[j], inner[i])
    // Außenwand
    pushQuad(framePos, frameNor, frameUv, frameIdx, outerBot[i], outerBot[j], outer[j], outer[i])
    // Innenlaibung
    pushQuad(framePos, frameNor, frameUv, frameIdx, inner[i], inner[j], innerBot[j], innerBot[i])
  }

  const glassPos: number[] = []
  const glassNor: number[] = []
  const glassUv: number[] = []
  const glassIdx: number[] = []
  const g0 = corner(-(hw - f), -(hd - f), f * 0.6)
  const g1 = corner(hw - f, -(hd - f), f * 0.6)
  const g2 = corner(hw - f, hd - f, f * 0.6)
  const g3 = corner(-(hw - f), hd - f, f * 0.6)
  pushQuad(glassPos, glassNor, glassUv, glassIdx, g0, g1, g2, g3)

  return {
    frame: toGeo(framePos, frameNor, frameUv, frameIdx),
    glass: toGeo(glassPos, glassNor, glassUv, glassIdx),
  }
}

// ---------------------------------------------------------------------------
// Gaube bauen
// ---------------------------------------------------------------------------

export interface DormerBuildResult {
  /** Wände (Front, Wangen, Rückwand) — Wandfarbe. */
  shell: THREE.BufferGeometry
  /** Dachflächen oben — Ziegelfarbe. */
  roof: THREE.BufferGeometry
  /** Blenden, Untersichten, Fensterbank — Blendenfarbe. */
  trim: THREE.BufferGeometry
  /** Fensterplatzierung (Gründerzeit-Mesh baut der Controller). */
  window: DormerWindowPlacement | null
  /** Äußerer Fußabdruck (Welt-XZ). */
  footprint: XZ[]
  model: DormerModel
}

/**
 * Gaube auf der Schräge. Formen nach Wikipedia (Giebel, Walm mit/ohne First, Schlepp
 * gerade/schräg/Trapez, Spitz, Tonne, Fledermaus, Dachreiter). Loch separat über
 * `roofOpeningHoles`, Traufschnitte über `roofEaveCuts`.
 */
export function buildDormerMeshes(
  building: Building,
  roof: RoofConfig,
  d: RoofDormer,
): DormerBuildResult | null {
  const model = resolveDormerModel(building, roof, d)
  if (!model) return null
  const sinks: DormerSinks = { shell: newSink(), roof: newSink(), trim: newSink() }

  let placement: DormerWindowPlacement | null = null
  if (model.kind === 'turret') {
    buildTurret(building, roof, model, sinks)
    placement = windowPlacement(model, -model.depthCm / 2)
    buildWindowSill(model, sinks, -model.depthCm / 2)
  } else if (model.kind === 'bat') {
    buildBatRoof(model, sinks)
    buildFrontWall(model, sinks, 0, true)
    placement = windowPlacement(model, 0)
    buildWindowSill(model, sinks, 0)
  } else {
    buildPlanarRoof(model, sinks)
    buildFrontWall(model, sinks, 0, true)
    if (roofDormerHasVerticalCheeks(model.kind)) {
      const vBack = model.hasBackWall ? model.depthCm : model.actualDepthCm
      buildCheek(model, sinks, -1, 0, vBack)
      buildCheek(model, sinks, 1, 0, vBack)
    }
    if (model.hasBackWall) buildBackWall(model, sinks, model.depthCm)
    placement = windowPlacement(model, 0)
    buildWindowSill(model, sinks, 0)
  }

  return {
    shell: sinkToGeo(sinks.shell),
    roof: sinkToGeo(sinks.roof),
    trim: sinkToGeo(sinks.trim),
    window: placement,
    footprint: dormerModelFootprint(model),
    model,
  }
}

/** Nutzt die Gaube ihre Dachneigung? (UI-Sichtbarkeit) */
export function dormerShowsPitch(kind: RoofDormerKind): boolean {
  return roofDormerUsesPitch(kind)
}

/** Clamp Punkt ins Traufpolygon (einfach: wenn draußen → null). */
export function clampRoofPlacement(
  building: Building,
  roof: RoofConfig,
  x: number,
  z: number,
): { x: number; z: number } | null {
  const frame = roofSurfaceFrameAt(building, roof, { x, z })
  if (!frame) return null
  return { x, z }
}

/** Überlappung zweier konvexer Fußabdrücke. */
export function footprintsOverlap(a: XZ[], b: XZ[]): boolean {
  const hit = intersectConvexPolygons(a, b)
  if (hit.length < 3) return false
  let area = 0
  for (let i = 0; i < hit.length; i += 1) {
    const p = hit[i]
    const q = hit[(i + 1) % hit.length]
    area += p.x * q.z - q.x * p.z
  }
  return Math.abs(area) * 0.5 > 16
}

export function roofHasOverlappingOpening(
  building: Building,
  roof: RoofConfig,
  candidate: XZ[],
  excludeId?: string,
): boolean {
  for (const s of roof.skylights ?? []) {
    if (s.id === excludeId) continue
    const foot = skylightFootprint(building, roof, s)
    if (foot && footprintsOverlap(candidate, foot)) return true
  }
  for (const d of roof.dormers ?? []) {
    if (d.id === excludeId) continue
    const foot = dormerFootprint(building, roof, d)
    if (foot && footprintsOverlap(candidate, foot)) return true
  }
  return false
}
