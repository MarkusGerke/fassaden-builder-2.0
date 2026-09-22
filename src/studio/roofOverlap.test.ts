import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DEFAULT_ROOF, buildMansardRoof, normalizeRoof } from './roof'
import {
  buildRoofEnvelope,
  buildRoofEnvelopeGeometry,
  orientRingCcw,
} from './roofForms'
import { offsetPolygonPerEdge } from './roof'
import type { Building } from '../types/facade'
import { PLAN_GRID_LEGACY_SCALE } from './constants'
import { createEmptyFloorPlan, drawPlanLine } from './floorPlan'
import { createStudioWall } from './walls'

function tris(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position')
  const index = geo.getIndex()
  const out: THREE.Vector3[][] = []
  const push = (ia: number, ib: number, ic: number) => {
    const a = new THREE.Vector3(pos.getX(ia), pos.getY(ia), pos.getZ(ia))
    const b = new THREE.Vector3(pos.getX(ib), pos.getY(ib), pos.getZ(ib))
    const c = new THREE.Vector3(pos.getX(ic), pos.getY(ic), pos.getZ(ic))
    const ab = new THREE.Vector3().subVectors(b, a)
    const ac = new THREE.Vector3().subVectors(c, a)
    if (ab.cross(ac).lengthSq() < 0.25) return
    out.push([a, b, c])
  }
  if (index) {
    for (let i = 0; i < index.count; i += 3) push(index.getX(i), index.getX(i + 1), index.getX(i + 2))
  }
  return out
}

function planeOf(t: THREE.Vector3[]) {
  const n = new THREE.Vector3().subVectors(t[1]!, t[0]!).cross(new THREE.Vector3().subVectors(t[2]!, t[0]!))
  const len = n.length()
  n.multiplyScalar(1 / len)
  return { n, d: n.dot(t[0]!), area: len / 2 }
}

type V2 = { x: number; y: number }

function polyArea(poly: V2[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i += 1) {
    const q = poly[(i + 1) % poly.length]!
    s += poly[i]!.x * q.y - q.x * poly[i]!.y
  }
  return Math.abs(s) / 2
}

function clipPoly(poly: V2[], ax: number, ay: number, bx: number, by: number): V2[] {
  const out: V2[] = []
  const inside = (p: V2) => (bx - ax) * (p.y - ay) - (by - ay) * (p.x - ax) >= -0.05
  for (let i = 0; i < poly.length; i += 1) {
    const s = poly[i]!
    const e = poly[(i + 1) % poly.length]!
    const sin = inside(s)
    const ein = inside(e)
    if (sin && ein) out.push(e)
    else if (sin !== ein) {
      const ds = (bx - ax) * (s.y - ay) - (by - ay) * (s.x - ax)
      const de = (bx - ax) * (e.y - ay) - (by - ay) * (e.x - ax)
      const t = ds / (ds - de || 1e-9)
      out.push({ x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t })
      if (ein) out.push(e)
    }
  }
  return out
}

/** Echte Schnittfläche in der gemeinsamen Ebene. Gemeinsame Kante bleibt ~0. */
function overlapArea(a: THREE.Vector3[], b: THREE.Vector3[]): number {
  const pa = planeOf(a)
  const pb = planeOf(b)
  if (Math.abs(pa.n.dot(pb.n)) < 0.985) return 0
  const signed = pa.n.dot(pb.n) >= 0 ? 1 : -1
  const dist = Math.abs(pa.d - signed * pb.d)
  if (dist > 0.35) return 0
  const u = new THREE.Vector3(1, 0, 0).cross(pa.n)
  if (u.lengthSq() < 1e-6) u.set(0, 1, 0).cross(pa.n)
  u.normalize()
  const v = new THREE.Vector3().crossVectors(pa.n, u)
  const proj = (p: THREE.Vector3): V2 => ({ x: p.dot(u), y: p.dot(v) })
  const A = a.map(proj)
  const B = b.map(proj)
  const cut = (edge: V2[]) => {
    let poly = A.slice()
    for (let i = 0; i < 3 && poly.length >= 3; i += 1) {
      poly = clipPoly(poly, edge[i]!.x, edge[i]!.y, edge[(i + 1) % 3]!.x, edge[(i + 1) % 3]!.y)
    }
    return poly.length >= 3 ? polyArea(poly) : 0
  }
  return Math.max(cut(B), cut([B[0]!, B[2]!, B[1]!]))
}

function reportArea(roof: THREE.BufferGeometry, gable: THREE.BufferGeometry | null): number {
  const rt = tris(roof)
  const gt = gable ? tris(gable) : []
  let roofArea = 0
  for (const a of gt) {
    for (const b of rt) {
      const ov = overlapArea(a, b)
      if (ov >= 8) roofArea += ov
    }
  }
  return roofArea
}

function rect() {
  return orientRingCcw([
    { x: 0, z: 0 },
    { x: 960, z: 0 },
    { x: 960, z: 480 },
    { x: 0, z: 480 },
  ])
}

function bare(): Building {
  const s = PLAN_GRID_LEGACY_SCALE
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
  plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
  plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
  plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
  const wall = (id: string, originX: number, originZ: number, yawDeg: number, width: number) => ({
    ...createStudioWall(originX, 0),
    id,
    originX,
    originZ,
    x: originX,
    yawDeg,
    width,
    depth: 24,
    panelFlip: true,
    planLinked: true,
    panel: { enabled: false, pattern: 'none' as const },
  })
  return {
    id: 'b1',
    name: 'Haus',
    wallHeight: 448,
    wallDepth: 24,
    walls: [
      wall('n', 0, 384, 0, 480),
      wall('e', 480, 384, 90, 384),
      wall('s', 480, 0, 180, 480),
      wall('w', 0, 0, 270, 384),
    ],
    floors: [plan],
  }
}

describe('Giebel und Dach liegen nicht aufeinander', () => {
  it('sattel alle überstehend', () => {
    const outer = rect()
    const roof = normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'gable', pitch: 45, overhang: 40 })
    const eave = offsetPolygonPerEdge(outer, outer.map(() => 40))
    const env = buildRoofEnvelope({ kind: 'gable', outer, eave, eaveY: 448, flush: outer.map(() => false), roof })!
    const geo = buildRoofEnvelopeGeometry(env)
    expect(reportArea(geo.roof, geo.gable)).toBe(0)
  })

  it('sattel giebel bündig', () => {
    const outer = rect()
    const roof = normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'gable', pitch: 45, overhang: 40 })
    const flush = [false, true, false, true]
    const eave = offsetPolygonPerEdge(outer, flush.map((f) => (f ? 0 : 40)))
    const env = buildRoofEnvelope({ kind: 'gable', outer, eave, eaveY: 448, flush, roof })!
    const geo = buildRoofEnvelopeGeometry(env)
    expect(reportArea(geo.roof, geo.gable)).toBe(0)
  })

  it('walm', () => {
    const outer = rect()
    const roof = normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'hip', pitch: 45, overhang: 40 })
    const eave = offsetPolygonPerEdge(outer, outer.map(() => 40))
    const env = buildRoofEnvelope({ kind: 'hip', outer, eave, eaveY: 448, flush: outer.map(() => false), roof })!
    const geo = buildRoofEnvelopeGeometry(env)
    expect(reportArea(geo.roof, geo.gable)).toBe(0)
  })

  it('mansarde nackt', () => {
    const building = bare()
    building.roof = normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'mansard', overhang: 40 })
    const built = buildMansardRoof({ buildings: [building], activeBuildingId: building.id })!
    expect(reportArea(built.roof, built.gable)).toBe(0)
  })
})
