import * as THREE from 'three'
import type {
  Building,
  FacadeState,
  RoofConfig,
  RoofTileProfile,
  StudioPanelConfig,
  StudioPanelPattern,
  Wall,
} from '../types/facade'
import { getActiveBuilding } from '../utils/buildings'
import { floorIndex } from '../utils/layers'
import {
  planFacesWithHoles,
  planHasClosedRing,
  planNodeWorld,
  polygonAreaXZ,
  type FloorPlan,
} from './floorPlan'
import { layoutPanelTiles } from './panelLayout'
import { MASONRY_KIND_PATTERNS, PANEL_KIND_PATTERNS } from './constants'
import { isStudioWall, wallEndPoint, wallHasPanels, wallStartPoint } from './walls'

export type { RoofConfig, RoofTileProfile }

const TILE_PATTERNS: StudioPanelPattern[] = [
  ...PANEL_KIND_PATTERNS.filter((p) => p !== 'strip'),
  ...MASONRY_KIND_PATTERNS,
]

export const DEFAULT_ROOF: RoofConfig = {
  enabled: false,
  pitchLower: 70,
  pitchUpper: 30,
  overhang: 40,
  ridgeHeight: 280,
  tileColor: '#8b3a2a',
  gutter: true,
  tileWidth: 32,
  tileHeight: 24,
  tileJoint: 0.8,
  tilePattern: 'runningBond',
  tileProfile: 'pantile',
  tileProjectDepth: 3,
  tileTaper: 0.85,
  tileTaperDepth: 1.5,
}

export function normalizeRoof(raw?: Partial<RoofConfig> | null): RoofConfig {
  const base = { ...DEFAULT_ROOF, ...raw }
  const pattern = TILE_PATTERNS.includes(base.tilePattern as StudioPanelPattern)
    ? (base.tilePattern as StudioPanelPattern)
    : DEFAULT_ROOF.tilePattern
  const profile: RoofTileProfile = base.tileProfile === 'barrel' ? 'barrel' : 'pantile'
  return {
    enabled: Boolean(base.enabled),
    hidden: Boolean(base.hidden),
    pitchLower: clamp(base.pitchLower, 45, 80),
    pitchUpper: clamp(base.pitchUpper, 10, 45),
    overhang: clamp(base.overhang, 0, 120),
    ridgeHeight: clamp(base.ridgeHeight, 80, 600),
    tileColor: typeof base.tileColor === 'string' && base.tileColor ? base.tileColor : DEFAULT_ROOF.tileColor,
    gutter: base.gutter !== false,
    tileWidth: snap8(clamp(base.tileWidth, 8, 96)),
    tileHeight: snap8(clamp(base.tileHeight, 8, 96)),
    tileJoint: clamp(base.tileJoint, 0, 4),
    tilePattern: pattern,
    tileProfile: profile,
    tileProjectDepth: clamp(base.tileProjectDepth, 0.5, 12),
    tileTaper: clamp(base.tileTaper, 0.2, 1),
    tileTaperDepth: clamp(base.tileTaperDepth, 0, 8),
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function snap8(n: number): number {
  return Math.round(n / 8) * 8
}

export function facadeHasRoofablePlan(state: FacadeState): boolean {
  const building = getActiveBuilding(state)
  const floors = building.floors
  if (!floors || floors.length === 0) return false
  return planHasClosedRing(floors[floors.length - 1])
}

export function topClosedOuterRing(plan: FloorPlan): Array<{ x: number; z: number }> | null {
  const faces = planFacesWithHoles(plan)
  if (faces.length === 0) return null
  let best = faces[0]
  let bestArea = polygonAreaXZ(best.outer.map(planNodeWorld))
  for (let i = 1; i < faces.length; i += 1) {
    const area = polygonAreaXZ(faces[i].outer.map(planNodeWorld))
    if (area > bestArea) {
      bestArea = area
      best = faces[i]
    }
  }
  return best.outer.map(planNodeWorld)
}

export function topRoofFaceWorld(plan: FloorPlan): {
  outer: Array<{ x: number; z: number }>
  holes: Array<Array<{ x: number; z: number }>>
} | null {
  const faces = planFacesWithHoles(plan)
  if (faces.length === 0) return null
  let best = faces[0]
  let bestArea = polygonAreaXZ(best.outer.map(planNodeWorld))
  for (let i = 1; i < faces.length; i += 1) {
    const area = polygonAreaXZ(faces[i].outer.map(planNodeWorld))
    if (area > bestArea) {
      bestArea = area
      best = faces[i]
    }
  }
  return {
    outer: best.outer.map(planNodeWorld),
    holes: best.holes.map((hole) => hole.map(planNodeWorld)),
  }
}

/** Versetzt ein CCW-Polygon gleichmäßig (positiv = außen). */
export function offsetPolygonXZ(
  pts: Array<{ x: number; z: number }>,
  distance: number,
): Array<{ x: number; z: number }> {
  return offsetPolygonPerEdge(
    pts,
    pts.map(() => distance),
  )
}

/**
 * Per-Kanten-Offset: `edgeDist[i]` gilt für Kante pts[i]→pts[i+1].
 * Vertex i = Schnitt der Parallelen von Kante i−1 und Kante i.
 */
export function offsetPolygonPerEdge(
  pts: Array<{ x: number; z: number }>,
  edgeDist: number[],
): Array<{ x: number; z: number }> {
  const n = pts.length
  if (n < 3) return pts.map((p) => ({ ...p }))
  const result: Array<{ x: number; z: number }> = []
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i - 1 + n) % n]
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    const dIn = edgeDist[(i - 1 + n) % n] ?? 0
    const dOut = edgeDist[i] ?? 0
    const lineIn = parallelLine(prev, curr, dIn)
    const lineOut = parallelLine(curr, next, dOut)
    const hit = intersectLines(lineIn, lineOut)
    result.push(hit ?? { x: curr.x, z: curr.z })
  }
  return result
}

function parallelLine(
  a: { x: number; z: number },
  b: { x: number; z: number },
  distance: number,
): { ox: number; oz: number; dx: number; dz: number } {
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const dx = (b.x - a.x) / len
  const dz = (b.z - a.z) / len
  // CCW Außen-Normale
  const nx = dz
  const nz = -dx
  return {
    ox: a.x + nx * distance,
    oz: a.z + nz * distance,
    dx,
    dz,
  }
}

function intersectLines(
  a: { ox: number; oz: number; dx: number; dz: number },
  b: { ox: number; oz: number; dx: number; dz: number },
): { x: number; z: number } | null {
  const det = a.dx * b.dz - a.dz * b.dx
  if (Math.abs(det) < 1e-8) {
    return { x: a.ox, z: a.oz }
  }
  const t = ((b.ox - a.ox) * b.dz - (b.oz - a.oz) * b.dx) / det
  return { x: a.ox + a.dx * t, z: a.oz + a.dz * t }
}

function insetByPitch(
  poly: Array<{ x: number; z: number }>,
  riseCm: number,
  pitchDeg: number,
): Array<{ x: number; z: number }> {
  const rad = (pitchDeg * Math.PI) / 180
  const run = riseCm / Math.tan(Math.max(0.15, rad))
  return offsetPolygonXZ(poly, -run)
}

/** Wand ohne Paneele → Dach bündig, keine Rinne an dieser Kante. */
export function wallIsBareForRoof(wall: Wall): boolean {
  if (!isStudioWall(wall)) return false
  return !wallHasPanels(wall)
}

function edgeMatchesWall(
  a: { x: number; z: number },
  b: { x: number; z: number },
  wall: Wall,
): boolean {
  const s = wallStartPoint(wall)
  const e = wallEndPoint(wall)
  const tol = 16
  const forward =
    Math.hypot(a.x - s.x, a.z - s.z) <= tol && Math.hypot(b.x - e.x, b.z - e.z) <= tol
  const reverse =
    Math.hypot(a.x - e.x, a.z - e.z) <= tol && Math.hypot(b.x - s.x, b.z - s.z) <= tol
  return forward || reverse
}

function findWallForEdge(
  building: Building,
  a: { x: number; z: number },
  b: { x: number; z: number },
  topFloor: number,
): Wall | null {
  const edgeLen = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const edx = (b.x - a.x) / edgeLen
  const edz = (b.z - a.z) / edgeLen
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }

  let best: Wall | null = null
  let bestScore = Infinity

  for (const wall of building.walls) {
    if (!isStudioWall(wall)) continue
    if (floorIndex(wall, building.wallHeight) !== topFloor) continue
    if (edgeMatchesWall(a, b, wall)) return wall

    const s = wallStartPoint(wall)
    const e = wallEndPoint(wall)
    const wLen = Math.hypot(e.x - s.x, e.z - s.z) || 1
    const wdx = (e.x - s.x) / wLen
    const wdz = (e.z - s.z) / wLen
    // Parallel (Richtung oder Gegenrichtung)
    const parallel = Math.abs(edx * wdx + edz * wdz)
    if (parallel < 0.92) continue
    const dist = pointToSegmentDist(mid, s, e)
    // Länge ähnlich (gegen kurze Nachbarstücke)
    const lenRatio = Math.min(edgeLen, wLen) / Math.max(edgeLen, wLen)
    if (dist < 28 && lenRatio > 0.55 && dist < bestScore) {
      bestScore = dist
      best = wall
    }
  }
  return best
}

function pointToSegmentDist(
  p: { x: number; z: number },
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const len2 = abx * abx + abz * abz || 1
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t))
}

function overhangPerEdge(
  building: Building,
  outer: Array<{ x: number; z: number }>,
  overhang: number,
): number[] {
  const topFloor = (building.floors?.length ?? 1) - 1
  const n = outer.length
  const dists: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a = outer[i]
    const b = outer[(i + 1) % n]
    const wall = findWallForEdge(building, a, b, topFloor)
    if (wall && wallIsBareForRoof(wall)) dists.push(0)
    else dists.push(overhang)
  }
  return dists
}

function appendTri(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
) {
  const base = positions.length / 3
  const ab = new THREE.Vector3().subVectors(b, a)
  const ac = new THREE.Vector3().subVectors(c, a)
  const normal = new THREE.Vector3().crossVectors(ab, ac).normalize()
  for (const v of [a, b, c]) {
    positions.push(v.x, v.y, v.z)
    normals.push(normal.x, normal.y, normal.z)
    uvs.push(v.x / 32, v.z / 32)
  }
  indices.push(base, base + 1, base + 2)
}

function appendQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
) {
  appendTri(positions, normals, uvs, indices, a, b, c)
  appendTri(positions, normals, uvs, indices, a, c, d)
}

function buildCap(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  poly: Array<{ x: number; z: number }>,
  y: number,
  holes: Array<Array<{ x: number; z: number }>> = [],
) {
  if (poly.length < 3) return
  const shape = new THREE.Shape()
  shape.moveTo(poly[0].x, poly[0].z)
  for (let i = 1; i < poly.length; i += 1) {
    shape.lineTo(poly[i].x, poly[i].z)
  }
  shape.closePath()
  for (const hole of holes) {
    if (hole.length < 3) continue
    const path = new THREE.Path()
    path.moveTo(hole[0].x, hole[0].z)
    for (let i = hole.length - 1; i >= 1; i -= 1) {
      path.lineTo(hole[i].x, hole[i].z)
    }
    path.closePath()
    shape.holes.push(path)
  }
  const shapeGeo = new THREE.ShapeGeometry(shape)
  const posAttr = shapeGeo.getAttribute('position')
  const indexAttr = shapeGeo.index
  const base = positions.length / 3
  for (let i = 0; i < posAttr.count; i += 1) {
    const px = posAttr.getX(i)
    const pz = posAttr.getY(i)
    positions.push(px, y, pz)
    normals.push(0, 1, 0)
    uvs.push(px / 32, pz / 32)
  }
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 1) {
      indices.push(base + indexAttr.getX(i))
    }
  }
  shapeGeo.dispose()
}

/** Geschlossenes U-Profil mit Gehrung entlang ausgewählter Traufkanten. */
function buildGutterGeometry(
  eave: Array<{ x: number; z: number }>,
  eaveY: number,
  edgeActive: boolean[],
): THREE.BufferGeometry | null {
  const n = eave.length
  if (n < 2) return null
  const segments: Array<Array<{ x: number; z: number }>> = []
  let current: Array<{ x: number; z: number }> = []
  for (let i = 0; i < n; i += 1) {
    if (!edgeActive[i]) {
      if (current.length >= 2) segments.push(current)
      current = []
      continue
    }
    if (current.length === 0) current.push({ ...eave[i] })
    current.push({ ...eave[(i + 1) % n] })
  }
  // Geschlossener Ring: alle Kanten aktiv → ein Polygon
  if (edgeActive.every(Boolean)) {
    segments.length = 0
    segments.push(eave.map((p) => ({ ...p })))
  } else if (current.length >= 2) {
    segments.push(current)
  }
  // Offene Ketten am Ring-Wrap zusammenführen
  if (
    edgeActive[0] &&
    edgeActive[n - 1] &&
    !edgeActive.every(Boolean) &&
    segments.length >= 2
  ) {
    const first = segments[0]
    const last = segments[segments.length - 1]
    if (
      Math.hypot(last[last.length - 1].x - first[0].x, last[last.length - 1].z - first[0].z) < 1e-3
    ) {
      segments[0] = [...last.slice(0, -1), ...first]
      segments.pop()
    }
  }

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const w = 8
  const h = 6
  const drop = 4
  const lip = 2
  const yTop = eaveY - drop
  const yBot = yTop - h

  for (const path of segments) {
    if (path.length < 2) continue
    const closed =
      path.length >= 3 &&
      Math.hypot(path[0].x - path[path.length - 1].x, path[0].z - path[path.length - 1].z) < 1e-3
    const pts = closed ? path.slice(0, -1) : path
    if (pts.length < 2) continue
    sweepGutterPath(positions, normals, uvs, indices, pts, closed, yTop, yBot, w, lip)
  }

  if (positions.length === 0) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Querschnitt: innen Lippe → außen → Boden → innen unten (geschlossen). */
function gutterProfile(
  outward: THREE.Vector3,
  origin: THREE.Vector3,
  yTop: number,
  yBot: number,
  w: number,
  lip: number,
): THREE.Vector3[] {
  const o = outward.clone().normalize()
  const base = new THREE.Vector3(origin.x, yTop, origin.z)
  return [
    base.clone().addScaledVector(o, -lip),
    base.clone().addScaledVector(o, w),
    new THREE.Vector3(origin.x, yBot, origin.z).addScaledVector(o, w),
    new THREE.Vector3(origin.x, yBot, origin.z).addScaledVector(o, -lip),
  ]
}

function edgeFrame(
  a: { x: number; z: number },
  b: { x: number; z: number },
): { tangent: THREE.Vector3; outward: THREE.Vector3 } {
  const tangent = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
  // CCW Außen
  const outward = new THREE.Vector3(tangent.z, 0, -tangent.x)
  return { tangent, outward }
}

function miterOutward(
  prevOut: THREE.Vector3,
  nextOut: THREE.Vector3,
): THREE.Vector3 {
  const m = prevOut.clone().add(nextOut)
  if (m.lengthSq() < 1e-8) return nextOut.clone()
  m.normalize()
  const cosHalf = Math.max(0.25, m.dot(nextOut))
  return m.multiplyScalar(1 / cosHalf)
}

function sweepGutterPath(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  pts: Array<{ x: number; z: number }>,
  closed: boolean,
  yTop: number,
  yBot: number,
  w: number,
  lip: number,
) {
  const count = pts.length
  const frames: Array<{ outward: THREE.Vector3; origin: THREE.Vector3 }> = []
  for (let i = 0; i < count; i += 1) {
    const prev = pts[(i - 1 + count) % count]
    const curr = pts[i]
    const next = pts[(i + 1) % count]
    let outward: THREE.Vector3
    if (!closed && i === 0) {
      outward = edgeFrame(curr, next).outward
    } else if (!closed && i === count - 1) {
      outward = edgeFrame(prev, curr).outward
    } else {
      const a = edgeFrame(prev, curr).outward
      const b = edgeFrame(curr, next).outward
      outward = miterOutward(a, b)
    }
    frames.push({
      outward,
      origin: new THREE.Vector3(curr.x, 0, curr.z),
    })
  }

  const rings: THREE.Vector3[][] = frames.map((f) =>
    gutterProfile(f.outward, f.origin, yTop, yBot, w, lip),
  )

  const ringCount = closed ? count : count
  const segCount = closed ? count : count - 1
  for (let i = 0; i < segCount; i += 1) {
    const j = (i + 1) % ringCount
    const r0 = rings[i]
    const r1 = rings[j]
    for (let k = 0; k < r0.length; k += 1) {
      const k2 = (k + 1) % r0.length
      appendQuad(positions, normals, uvs, indices, r0[k], r1[k], r1[k2], r0[k2])
    }
  }
  if (!closed) {
    // Endkappen
    capRing(positions, normals, uvs, indices, rings[0], true)
    capRing(positions, normals, uvs, indices, rings[rings.length - 1], false)
  }
}

function capRing(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  ring: THREE.Vector3[],
  flip: boolean,
) {
  if (ring.length < 3) return
  const a = ring[0]
  const b = ring[1]
  const c = ring[2]
  const d = ring[3]
  if (flip) appendQuad(positions, normals, uvs, indices, a, d, c, b)
  else appendQuad(positions, normals, uvs, indices, a, b, c, d)
}

function roofPanelConfig(roof: RoofConfig): StudioPanelConfig {
  return {
    panelWidth: roof.tileWidth,
    panelHeight: roof.tileHeight,
    joint: roof.tileJoint,
    pattern: roof.tilePattern,
    cornerJoin: 'miter',
    projectDepth: roof.tileProjectDepth,
    taper: roof.tileTaper,
    taperDepth: roof.tileTaperDepth,
    enabled: true,
  }
}

function fakeWall(width: number, height: number): Wall {
  return {
    id: 'roof-facet',
    kind: 'studio',
    width: Math.max(8, width),
    height: Math.max(8, height),
    depth: 32,
    x: 0,
    y: 0,
    openings: [],
    profiles: [],
    neighbors: {},
  }
}

function profileOffset(profile: RoofTileProfile, u: number, tileIndex: number): number {
  const t = Math.max(0, Math.min(1, u))
  if (profile === 'barrel') {
    const wave = Math.sin(Math.PI * t)
    return tileIndex % 2 === 0 ? wave : -wave * 0.65
  }
  // Pantile: S-Kurve (Mulde + Wulst)
  return Math.sin(Math.PI * 2 * t) * 0.55 + Math.sin(Math.PI * t) * 0.35
}

function addTiledFacet(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  L0: THREE.Vector3,
  L1: THREE.Vector3,
  U1: THREE.Vector3,
  U0: THREE.Vector3,
  roof: RoofConfig,
) {
  const width = L0.distanceTo(L1)
  const height = L0.distanceTo(U0)
  if (width < 4 || height < 4) {
    appendQuad(positions, normals, uvs, indices, L0, L1, U1, U0)
    return
  }

  const wall = fakeWall(width, height)
  const tiles = layoutPanelTiles(wall, roofPanelConfig(roof), [])
  const along = new THREE.Vector3().subVectors(L1, L0)
  const up = new THREE.Vector3().subVectors(U0, L0)
  const normal = new THREE.Vector3().crossVectors(along, up).normalize()
  if (normal.lengthSq() < 1e-8) {
    appendQuad(positions, normals, uvs, indices, L0, L1, U1, U0)
    return
  }

  const depth = roof.tileProjectDepth
  const taperDepth = roof.tileTaperDepth
  const taper = Math.max(0.005, Math.min(1, roof.tileTaper))
  const samples = 3

  const pointOnFacet = (u: number, v: number) => {
    const lo = new THREE.Vector3().lerpVectors(L0, L1, u)
    const hi = new THREE.Vector3().lerpVectors(U0, U1, u)
    return new THREE.Vector3().lerpVectors(lo, hi, v)
  }

  let tileIndex = 0
  for (const tile of tiles) {
    const u0 = tile.x / width
    const u1 = (tile.x + tile.width) / width
    const v0 = tile.y / height
    const v1 = (tile.y + tile.height) / height
    // Wie Paneele: Inset in cm aus Kachelmaß × (1−taper), nicht nur UV-Anteil
    const insetU = Math.min((tile.width / 2) * (1 - taper), tile.width * 0.45) / width
    const insetV = Math.min((tile.height / 2) * (1 - taper), tile.height * 0.45) / height
    const cols: THREE.Vector3[] = []
    const colsFront: THREE.Vector3[] = []
    const colsTip: THREE.Vector3[] = []

    for (let s = 0; s <= samples; s += 1) {
      const fu = s / samples
      const u = u0 + (u1 - u0) * fu
      const amp = profileOffset(roof.tileProfile, fu, tileIndex) * depth * 0.85
      const p0 = pointOnFacet(u, v0)
      const p1 = pointOnFacet(u, v1)
      cols.push(p0.clone(), p1.clone())
      const nOff = normal.clone().multiplyScalar(depth + amp)
      colsFront.push(p0.clone().add(nOff), p1.clone().add(nOff))
      if (taperDepth > 1e-4) {
        const uu = THREE.MathUtils.clamp(u, u0 + insetU, u1 - insetU)
        const tipAmp = profileOffset(roof.tileProfile, fu, tileIndex) * depth * 0.35
        const tipN = normal.clone().multiplyScalar(depth + taperDepth + tipAmp)
        const t0 = pointOnFacet(uu, v0 + insetV).add(tipN)
        const t1 = pointOnFacet(uu, v1 - insetV).add(tipN)
        colsTip.push(t0, t1)
      }
    }

    // Seitenwände + Front als Streifen
    for (let s = 0; s < samples; s += 1) {
      const i = s * 2
      const j = (s + 1) * 2
      // Unterseite (Dachhaut) weglassen — darunter liegt die Konstruktion
      // Front
      appendQuad(
        positions,
        normals,
        uvs,
        indices,
        colsFront[i],
        colsFront[j],
        colsFront[j + 1],
        colsFront[i + 1],
      )
      // Seiten längs (unten→front)
      appendQuad(
        positions,
        normals,
        uvs,
        indices,
        cols[i],
        colsFront[i],
        colsFront[i + 1],
        cols[i + 1],
      )
      appendQuad(
        positions,
        normals,
        uvs,
        indices,
        cols[j],
        cols[j + 1],
        colsFront[j + 1],
        colsFront[j],
      )
    }
    // Stirnflächen an u0/u1
    appendQuad(
      positions,
      normals,
      uvs,
      indices,
      cols[0],
      cols[1],
      colsFront[1],
      colsFront[0],
    )
    const last = samples * 2
    appendQuad(
      positions,
      normals,
      uvs,
      indices,
      cols[last],
      colsFront[last],
      colsFront[last + 1],
      cols[last + 1],
    )

    if (colsTip.length === colsFront.length) {
      for (let s = 0; s < samples; s += 1) {
        const i = s * 2
        const j = (s + 1) * 2
        appendQuad(
          positions,
          normals,
          uvs,
          indices,
          colsFront[i],
          colsFront[j],
          colsTip[j],
          colsTip[i],
        )
        appendQuad(
          positions,
          normals,
          uvs,
          indices,
          colsFront[i + 1],
          colsTip[i + 1],
          colsTip[j + 1],
          colsFront[j + 1],
        )
        appendQuad(
          positions,
          normals,
          uvs,
          indices,
          colsTip[i],
          colsTip[j],
          colsTip[j + 1],
          colsTip[i + 1],
        )
      }
    }

    tileIndex += 1
  }
}

function buildTiledBands(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  lower: Array<{ x: number; z: number }>,
  upper: Array<{ x: number; z: number }>,
  y0: number,
  y1: number,
  roof: RoofConfig,
) {
  const n = Math.min(lower.length, upper.length)
  if (n < 3) return
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    const L0 = new THREE.Vector3(lower[i].x, y0, lower[i].z)
    const L1 = new THREE.Vector3(lower[j].x, y0, lower[j].z)
    const U1 = new THREE.Vector3(upper[j].x, y1, upper[j].z)
    const U0 = new THREE.Vector3(upper[i].x, y1, upper[i].z)
    addTiledFacet(positions, normals, uvs, indices, L0, L1, U1, U0, roof)
  }
}

function buildRidgeTiles(
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  ridge: Array<{ x: number; z: number }>,
  y: number,
  roof: RoofConfig,
) {
  const n = ridge.length
  if (n < 2) return
  const R = Math.max(2, roof.tileProjectDepth * 1.2)
  const step = Math.max(8, roof.tileWidth)
  for (let i = 0; i < n; i += 1) {
    const a = ridge[i]
    const b = ridge[(i + 1) % n]
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const dx = (b.x - a.x) / len
    const dz = (b.z - a.z) / len
    const ox = dz
    const oz = -dx
    const count = Math.max(1, Math.floor(len / step))
    for (let k = 0; k < count; k += 1) {
      const t0 = k / count
      const t1 = (k + 1) / count
      const samples = 8
      for (let s = 0; s < samples; s += 1) {
        const a0 = (Math.PI * s) / samples
        const a1 = (Math.PI * (s + 1)) / samples
        const p00 = new THREE.Vector3(
          a.x + dx * len * t0 + ox * Math.cos(a0) * R,
          y + Math.sin(a0) * R,
          a.z + dz * len * t0 + oz * Math.cos(a0) * R,
        )
        const p10 = new THREE.Vector3(
          a.x + dx * len * t1 + ox * Math.cos(a0) * R,
          y + Math.sin(a0) * R,
          a.z + dz * len * t1 + oz * Math.cos(a0) * R,
        )
        const p11 = new THREE.Vector3(
          a.x + dx * len * t1 + ox * Math.cos(a1) * R,
          y + Math.sin(a1) * R,
          a.z + dz * len * t1 + oz * Math.cos(a1) * R,
        )
        const p01 = new THREE.Vector3(
          a.x + dx * len * t0 + ox * Math.cos(a1) * R,
          y + Math.sin(a1) * R,
          a.z + dz * len * t0 + oz * Math.cos(a1) * R,
        )
        appendQuad(positions, normals, uvs, indices, p00, p10, p11, p01)
      }
    }
  }
}

export interface RoofBuildResult {
  roof: THREE.BufferGeometry
  gutter: THREE.BufferGeometry | null
  tileColor: string
}

/**
 * Berliner Mansarde: Ziegel auf den Mänteln, Firstziegel, optional gehrungene Rinne.
 * Leere Fassadenseiten: Überstand 0, keine Rinne.
 */
function buildMansardRoofForBuilding(
  building: Building,
  roof: RoofConfig,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
  gutterPositions: number[],
  gutterNormals: number[],
  gutterUvs: number[],
  gutterIndices: number[],
): boolean {
  if (!roof.enabled) return false
  const floors = building.floors
  if (!floors || floors.length === 0) return false
  const topPlan = floors[floors.length - 1]
  const face = topRoofFaceWorld(topPlan)
  if (!face || face.outer.length < 3) return false
  const outer = face.outer

  const eaveY = floors.length * building.wallHeight
  const edgeOverhang = overhangPerEdge(building, outer, roof.overhang)
  const eave = offsetPolygonPerEdge(outer, edgeOverhang)
  const breakRise = roof.ridgeHeight * 0.55
  const upperRise = roof.ridgeHeight - breakRise
  const breakPoly = insetByPitch(eave, breakRise, roof.pitchLower)
  const ridgePoly = insetByPitch(breakPoly, upperRise, roof.pitchUpper)
  const ridgeHoles = face.holes
    .map((hole) =>
      insetByPitch(hole, breakRise + upperRise, (roof.pitchLower + roof.pitchUpper) * 0.5),
    )
    .filter((h) => h.length >= 3)

  buildTiledBands(
    positions,
    normals,
    uvs,
    indices,
    eave,
    breakPoly,
    eaveY,
    eaveY + breakRise,
    roof,
  )
  buildTiledBands(
    positions,
    normals,
    uvs,
    indices,
    breakPoly,
    ridgePoly,
    eaveY + breakRise,
    eaveY + roof.ridgeHeight,
    roof,
  )
  buildCap(positions, normals, uvs, indices, ridgePoly, eaveY + roof.ridgeHeight, ridgeHoles)
  buildRidgeTiles(positions, normals, uvs, indices, ridgePoly, eaveY + roof.ridgeHeight, roof)

  const edgeActive = edgeOverhang.map((d) => d > 0.5)
  if (roof.gutter && edgeActive.some(Boolean)) {
    const gutterGeo = buildGutterGeometry(eave, eaveY, edgeActive)
    if (gutterGeo) {
      appendBufferGeometry(
        gutterGeo,
        gutterPositions,
        gutterNormals,
        gutterUvs,
        gutterIndices,
      )
      gutterGeo.dispose()
    }
  }

  return true
}

function appendBufferGeometry(
  geo: THREE.BufferGeometry,
  positions: number[],
  normals: number[],
  uvs: number[],
  indices: number[],
) {
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute
  const indexAttr = geo.index
  const base = positions.length / 3
  for (let i = 0; i < posAttr.count; i += 1) {
    positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
    normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i))
    uvs.push(uvAttr.getX(i), uvAttr.getY(i))
  }
  if (indexAttr) {
    for (let i = 0; i < indexAttr.count; i += 1) {
      indices.push(base + indexAttr.getX(i))
    }
  }
}

export function buildMansardRoof(state: FacadeState, raw?: Partial<RoofConfig> | null): RoofBuildResult | null {
  const visibleBuildings = state.buildings.filter((building) => !building.hidden)
  if (visibleBuildings.length === 0) return null

  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const gutterPositions: number[] = []
  const gutterNormals: number[] = []
  const gutterUvs: number[] = []
  const gutterIndices: number[] = []

  let tileColor = DEFAULT_ROOF.tileColor
  let anyBuilt = false

  for (const building of visibleBuildings) {
    const roof = normalizeRoof(raw ?? building.roof)
    if (
      buildMansardRoofForBuilding(
        building,
        roof,
        positions,
        normals,
        uvs,
        indices,
        gutterPositions,
        gutterNormals,
        gutterUvs,
        gutterIndices,
      )
    ) {
      anyBuilt = true
      tileColor = roof.tileColor
    }
  }

  if (!anyBuilt || positions.length === 0) return null

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()

  const gutter =
    gutterPositions.length > 0
      ? (() => {
          const gutterGeo = new THREE.BufferGeometry()
          gutterGeo.setAttribute('position', new THREE.Float32BufferAttribute(gutterPositions, 3))
          gutterGeo.setAttribute('normal', new THREE.Float32BufferAttribute(gutterNormals, 3))
          gutterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(gutterUvs, 2))
          gutterGeo.setIndex(gutterIndices)
          gutterGeo.computeVertexNormals()
          gutterGeo.computeBoundingSphere()
          return gutterGeo
        })()
      : null

  return {
    roof: geo,
    gutter,
    tileColor,
  }
}