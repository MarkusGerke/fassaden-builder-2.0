/**
 * Hilfs- und Abstandslinien beim Verschieben von Gauben/Dachfenstern —
 * analog zu Öffnungs-Guides, aber in Trauf-Koordinaten (along / distance) auf der Schräge.
 */
import * as THREE from 'three'
import type { Building, RoofConfig, RoofDormer, RoofSkylight } from '../types/facade'
import { snapToGrid } from '../utils/grid'
import { STUDIO_MASONRY } from './constants'
import { planeY } from './roofForms'
import { normalizeRoof } from './roof'
import {
  clampRoofPlacement,
  dormerAnchorForEavePlacement,
  dormerEavePlacement,
  resolveDormerModel,
  roofEaveInfo,
  roofSurfaceFrameAt,
  type RoofSurfaceFrame,
} from './roofOpenings'

export const ROOF_FIXTURE_GUIDE_TOLERANCE = 0.5

export type RoofFixtureGuideStyle = 'self' | 'align' | 'mid'

export type RoofFixtureGuideLine = {
  a: THREE.Vector3
  b: THREE.Vector3
  style: RoofFixtureGuideStyle
}

export type RoofFixtureDistanceGuide = {
  a: THREE.Vector3
  b: THREE.Vector3
  mid: THREE.Vector3
  distanceCm: number
}

type FixtureUV = {
  id: string
  kind: 'skylight' | 'dormer'
  alongCm: number
  distanceCm: number
  edgeIndex: number
  edgeLengthCm: number
  widthCm: number
  depthCm: number
  frame: RoofSurfaceFrame
}

function near(a: number, b: number, tol = ROOF_FIXTURE_GUIDE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

function lift(frame: RoofSurfaceFrame, u: number, v: number, floatCm = 2): THREE.Vector3 {
  const x = frame.origin.x + frame.u.x * u + frame.v.x * v
  const z = frame.origin.z + frame.u.z * u + frame.v.z * v
  const y = planeY(frame.plane, { x, z }) + floatCm
  return new THREE.Vector3(x, y, z)
}

/**
 * Weltpunkt auf 8-cm-Raster der Traufposition snappen (along + distance).
 * Fallback: 8-cm-Raster in XZ, wenn keine Traufprojektion möglich.
 */
export function snapRoofFixturePlacement(
  building: Building,
  rawRoof: RoofConfig | undefined,
  x: number,
  z: number,
  grid = STUDIO_MASONRY,
): { x: number; z: number } | null {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  const placement = dormerEavePlacement(building, roof, { x, z })
  if (placement) {
    const along = Math.max(
      0,
      Math.min(placement.edgeLengthCm, snapToGrid(placement.alongCm, grid)),
    )
    const distance = Math.max(0, snapToGrid(placement.distanceCm, grid))
    return dormerAnchorForEavePlacement(building, roof, { x, z }, {
      alongCm: along,
      distanceCm: distance,
    })
  }
  const sx = snapToGrid(x, grid)
  const sz = snapToGrid(z, grid)
  return clampRoofPlacement(building, roof, sx, sz)
}

function fixtureSize(
  building: Building,
  roof: RoofConfig,
  kind: 'skylight' | 'dormer',
  item: RoofSkylight | RoofDormer,
): { widthCm: number; depthCm: number } {
  if (kind === 'skylight') {
    const s = item as RoofSkylight
    return { widthCm: s.widthCm, depthCm: s.heightCm }
  }
  const d = item as RoofDormer
  const model = resolveDormerModel(building, roof, d)
  return {
    widthCm: d.widthCm,
    depthCm: model?.actualDepthCm ?? d.depthCm,
  }
}

/**
 * Vorzeichen: Trauf-along → lokales frame.u.
 * frame.u steht oft entgegengesetzt zur Kante a→b (dot ≈ −1).
 */
function eaveAlongToLocalUSign(frame: RoofSurfaceFrame, building: Building, roof: RoofConfig, edgeIndex: number): number {
  const info = roofEaveInfo(building, roof)
  if (!info || info.eave.length < 2) return 1
  const a = info.eave[edgeIndex]
  const b = info.eave[(edgeIndex + 1) % info.eave.length]
  if (!a || !b) return 1
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const ex = (b.x - a.x) / len
  const ez = (b.z - a.z) / len
  const dot = frame.u.x * ex + frame.u.z * ez
  return dot < 0 ? -1 : 1
}

function collectFixtures(building: Building, roof: RoofConfig): FixtureUV[] {
  const out: FixtureUV[] = []
  for (const s of roof.skylights ?? []) {
    if (s.hidden) continue
    const placement = dormerEavePlacement(building, roof, s)
    const frame = roofSurfaceFrameAt(building, roof, { x: s.x, z: s.z })
    if (!placement || !frame) continue
    const size = fixtureSize(building, roof, 'skylight', s)
    out.push({
      id: s.id,
      kind: 'skylight',
      alongCm: placement.alongCm,
      distanceCm: placement.distanceCm,
      edgeIndex: placement.edgeIndex,
      edgeLengthCm: placement.edgeLengthCm,
      widthCm: size.widthCm,
      depthCm: size.depthCm,
      frame,
    })
  }
  for (const d of roof.dormers ?? []) {
    if (d.hidden) continue
    const placement = dormerEavePlacement(building, roof, d)
    const model = resolveDormerModel(building, roof, d)
    // Gaube: Frame am Modell-Ursprung (bei Traufdurchbruch ≠ Anker d.x/d.z).
    const frame = model
      ? { ...model.frame, origin: { ...model.origin }, y: model.y0 }
      : roofSurfaceFrameAt(building, roof, { x: d.x, z: d.z })
    if (!placement || !frame) continue
    const size = fixtureSize(building, roof, 'dormer', d)
    out.push({
      id: d.id,
      kind: 'dormer',
      alongCm: placement.alongCm,
      distanceCm: placement.distanceCm,
      edgeIndex: placement.edgeIndex,
      edgeLengthCm: placement.edgeLengthCm,
      widthCm: size.widthCm,
      depthCm: size.depthCm,
      frame,
    })
  }
  return out
}

function activeLocalExtents(f: FixtureUV): {
  u0: number
  u1: number
  v0: number
  v1: number
} {
  const hw = f.widthCm / 2
  if (f.kind === 'skylight') {
    const hd = Math.max(4, f.depthCm / 2)
    return { u0: -hw, u1: hw, v0: -hd, v1: hd }
  }
  // Gaube: Anker = Frontwand-Mitte, Tiefe hangaufwärts.
  return { u0: -hw, u1: hw, v0: 0, v1: Math.max(8, f.depthCm) }
}

/**
 * Hilfslinien + Abstände für das gezogene Dach-Fixture.
 * along ≈ Wand-X, distance ≈ Wand-Y (nach oben = hangauf).
 */
export function computeRoofFixtureGuides(
  building: Building,
  rawRoof: RoofConfig | undefined,
  active: { kind: 'skylight' | 'dormer'; id: string },
): { lines: RoofFixtureGuideLine[]; distances: RoofFixtureDistanceGuide[] } {
  const roof = normalizeRoof(rawRoof ?? building.roof)
  const all = collectFixtures(building, roof)
  const me = all.find((f) => f.kind === active.kind && f.id === active.id)
  if (!me) return { lines: [], distances: [] }

  const frame = me.frame
  const { u0, u1, v0, v1 } = activeLocalExtents(me)
  const midU = (u0 + u1) / 2
  const midV = (v0 + v1) / 2
  const uSign = eaveAlongToLocalUSign(frame, building, roof, me.edgeIndex)
  // Trauf-along → lokales u (Vorzeichen an Kante a→b vs. frame.u).
  const alongToU = (alongCm: number) => uSign * (alongCm - me.alongCm)
  const uLeft = alongToU(0)
  const uRight = alongToU(me.edgeLengthCm)
  const vEave = -me.distanceCm
  const vTop = Math.max(v1 + 800, me.edgeLengthCm)
  const groundY = -2
  const lines: RoofFixtureGuideLine[] = []

  /**
   * Kantenlinie (konstantes u):
   * 1) senkrecht unter der Fixture-Kante zum Boden (wie Fenster — gleiche XZ),
   * 2) auf der Schräge Traufe → First.
   * Früher: Boden-Fuß an der Traufe → in 3D seitlich versetzt (v2.0.485).
   */
  const pushU = (u: number, style: RoofFixtureGuideStyle) => {
    const atFixture = lift(frame, u, v0)
    const ground = new THREE.Vector3(atFixture.x, groundY, atFixture.z)
    const onEave = lift(frame, u, vEave)
    const onTop = lift(frame, u, vTop)
    lines.push({ a: ground, b: atFixture, style })
    lines.push({ a: onEave, b: onTop, style })
  }
  const pushV = (v: number, style: RoofFixtureGuideStyle) => {
    lines.push({
      a: lift(frame, uLeft, v),
      b: lift(frame, uRight, v),
      style,
    })
  }

  pushU(u0, 'self')
  pushU(u1, 'self')
  pushU(midU, 'self')
  pushV(v0, 'self')
  pushV(v1, 'self')
  pushV(midV, 'self')

  const peers = all.filter((f) => f.id !== me.id && f.edgeIndex === me.edgeIndex)
  const myAlongL = me.alongCm - me.widthCm / 2
  const myAlongR = me.alongCm + me.widthCm / 2
  const myAlongM = me.alongCm
  const myDistF = me.distanceCm
  const myDistB = me.distanceCm + me.depthCm
  const myDistM = me.distanceCm + me.depthCm / 2

  for (const p of peers) {
    const pL = p.alongCm - p.widthCm / 2
    const pR = p.alongCm + p.widthCm / 2
    const pM = p.alongCm
    for (const [mine, theirs] of [
      [myAlongL, pL],
      [myAlongL, pR],
      [myAlongL, pM],
      [myAlongR, pL],
      [myAlongR, pR],
      [myAlongR, pM],
      [myAlongM, pL],
      [myAlongM, pR],
      [myAlongM, pM],
    ] as const) {
      if (near(mine, theirs)) pushU(alongToU(mine), 'align')
    }
    const pF = p.distanceCm
    const pB = p.distanceCm + p.depthCm
    const pMid = p.distanceCm + p.depthCm / 2
    for (const [mine, theirs] of [
      [myDistF, pF],
      [myDistF, pB],
      [myDistF, pMid],
      [myDistB, pF],
      [myDistB, pB],
      [myDistB, pMid],
      [myDistM, pF],
      [myDistM, pB],
      [myDistM, pMid],
    ] as const) {
      if (near(mine, theirs)) pushV(mine - me.distanceCm, 'align')
    }
  }

  const distances: RoofFixtureDistanceGuide[] = []
  const addDist = (ua: number, va: number, ub: number, vb: number, cm: number) => {
    if (cm < 1) return
    const a = lift(frame, ua, va)
    const b = lift(frame, ub, vb)
    distances.push({
      a,
      b,
      mid: a.clone().lerp(b, 0.5).addScaledVector(frame.normal, 4),
      distanceCm: Math.round(cm),
    })
  }

  if (me.distanceCm >= 1) {
    addDist(midU, v0, midU, v0 - me.distanceCm, me.distanceCm)
  }

  let bestLeft: { gap: number; atAlong: number } | null = null
  let bestRight: { gap: number; atAlong: number } | null = null
  for (const p of peers) {
    const pL = p.alongCm - p.widthCm / 2
    const pR = p.alongCm + p.widthCm / 2
    if (pR <= myAlongL + 1e-3) {
      const gap = myAlongL - pR
      if (!bestLeft || gap < bestLeft.gap) bestLeft = { gap, atAlong: pR }
    }
    if (pL >= myAlongR - 1e-3) {
      const gap = pL - myAlongR
      if (!bestRight || gap < bestRight.gap) bestRight = { gap, atAlong: pL }
    }
  }
  if (bestLeft) addDist(u0, midV, alongToU(bestLeft.atAlong), midV, bestLeft.gap)
  if (bestRight) addDist(u1, midV, alongToU(bestRight.atAlong), midV, bestRight.gap)

  let bestDown: { gap: number; at: number } | null = null
  let bestUp: { gap: number; at: number } | null = null
  for (const p of peers) {
    const pF = p.distanceCm
    const pB = p.distanceCm + p.depthCm
    if (pB <= myDistF + 1e-3) {
      const gap = myDistF - pB
      if (!bestDown || gap < bestDown.gap) bestDown = { gap, at: pB - me.distanceCm }
    }
    if (pF >= myDistB - 1e-3) {
      const gap = pF - myDistB
      if (!bestUp || gap < bestUp.gap) bestUp = { gap, at: pF - me.distanceCm }
    }
  }
  if (bestDown) addDist(midU, v0, midU, bestDown.at, bestDown.gap)
  if (bestUp) addDist(midU, v1, midU, bestUp.at, bestUp.gap)

  return { lines, distances }
}
