import * as THREE from 'three'
import type { Opening, OpeningStairs, Wall } from '../types/facade'
import { STUDIO_MASONRY } from './constants'
import {
  studioFacadeOutwardLocalZ,
  studioWallInnerLocalZ,
  studioWindowDepthForwardSign,
} from './walls'

const STEP_MIN = 1
const STEP_MAX = 16
const LANDING_DEPTH_MAX = 192

export function snapStairMeasure(value: number, min = STUDIO_MASONRY, max = 192): number {
  if (!Number.isFinite(value) || value <= 0) return min
  const snapped = Math.round(value / STUDIO_MASONRY) * STUDIO_MASONRY
  return Math.max(min, Math.min(max, snapped))
}

/** Effektive Podesttiefe — Default = Auftritt. */
export function stairLandingDepth(stairs: OpeningStairs): number {
  const raw = stairs.landingDepth ?? stairs.tread
  return snapStairMeasure(raw, STUDIO_MASONRY, LANDING_DEPTH_MAX)
}

export function defaultOpeningStairs(opening: Opening): OpeningStairs {
  return {
    enabled: false,
    count: 3,
    rise: 16,
    tread: 32,
    width: snapStairMeasure(opening.width),
    extendLeft: 0,
    extendRight: 0,
    splayLeft: 0,
    splayRight: 0,
  }
}

export function syncStairsToDoorWidth(
  raw: Partial<OpeningStairs> | undefined,
  opening: Opening,
): OpeningStairs {
  const base = defaultOpeningStairs(opening)
  const count = Math.max(
    STEP_MIN,
    Math.min(STEP_MAX, Math.round(raw?.count ?? base.count)),
  )
  const enabled = Boolean(raw?.enabled)
  return {
    enabled,
    count,
    rise: snapStairMeasure(raw?.rise ?? base.rise, STUDIO_MASONRY, 48),
    tread: snapStairMeasure(raw?.tread ?? base.tread, STUDIO_MASONRY, 96),
    // Treppenoberkante folgt immer der Türbreite; Überstand/Aufweitung bleiben separat.
    width: snapStairMeasure(opening.width, STUDIO_MASONRY, 384),
    extendLeft: snapStairMeasure(
      raw?.extendLeft ?? raw?.extendRight ?? 0,
      0,
      192,
    ),
    extendRight: snapStairMeasure(
      raw?.extendRight ?? raw?.extendLeft ?? 0,
      0,
      192,
    ),
    splayLeft: snapStairMeasure(raw?.splayLeft ?? raw?.splayRight ?? 0, 0, 96),
    splayRight: snapStairMeasure(raw?.splayRight ?? raw?.splayLeft ?? 0, 0, 96),
    landingDepth: snapStairMeasure(
      raw?.landingDepth ?? raw?.tread ?? base.tread,
      STUDIO_MASONRY,
      LANDING_DEPTH_MAX,
    ),
    color: typeof raw?.color === 'string' ? raw.color : undefined,
    finish:
      raw?.finish === 'glossy' || raw?.finish === 'metal' || raw?.finish === 'matte'
        ? raw.finish
        : undefined,
  }
}

export function normalizeOpeningStairs(
  raw: Partial<OpeningStairs> | undefined,
  opening: Opening,
): OpeningStairs {
  return syncStairsToDoorWidth(raw, opening)
}

export function stairTopY(stairs: OpeningStairs): number {
  return stairs.count * stairs.rise
}

export interface StairTread {
  /** Wandlokal X der linken Kante (kann < 0 oder > wall.width sein). */
  x: number
  y: number
  width: number
  height: number
  /** Abstand der hinteren Kante von der Fassadenfront nach außen. */
  zOut: number
  depth: number
}

/** Stufen von oben (Tür) nach unten (Gehweg). y=0 = Wandfuß, oben = Türschwelle. */
export function layoutStairTreads(opening: Opening, stairs: OpeningStairs): StairTread[] {
  if (!stairs.enabled || stairs.count < 1) return []
  const treads: StairTread[] = []
  const topY = opening.y
  const landing = stairLandingDepth(stairs)
  for (let i = 0; i < stairs.count; i += 1) {
    const fromTop = i
    const y0 = topY - (fromTop + 1) * stairs.rise
    const extraL = stairs.extendLeft + fromTop * stairs.splayLeft
    const extraR = stairs.extendRight + fromTop * stairs.splayRight
    const width = stairs.width + extraL + extraR
    const x = opening.x + (opening.width - stairs.width) / 2 - extraL
    const zOut = fromTop === 0 ? 0 : landing + (fromTop - 1) * stairs.tread
    const depth = fromTop === 0 ? landing : stairs.tread
    treads.push({
      x,
      y: y0,
      width,
      height: stairs.rise,
      zOut,
      depth,
    })
  }
  return treads
}

function addQuad(
  positions: number[],
  normals: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
) {
  const base = positions.length / 3
  for (const p of [a, b, c, d]) {
    positions.push(p.x, p.y, p.z)
    normals.push(0, 0, 0)
  }
  indices.push(base, base + 3, base + 2, base, base + 2, base + 1)
}

function finalizeNormals(positions: number[], normals: number[], indices: number[]) {
  for (let i = 0; i < indices.length; i += 3) {
    const ax = positions[indices[i] * 3]
    const ay = positions[indices[i] * 3 + 1]
    const az = positions[indices[i] * 3 + 2]
    const bx = positions[indices[i + 1] * 3]
    const by = positions[indices[i + 1] * 3 + 1]
    const bz = positions[indices[i + 1] * 3 + 2]
    const cx = positions[indices[i + 2] * 3]
    const cy = positions[indices[i + 2] * 3 + 1]
    const cz = positions[indices[i + 2] * 3 + 2]
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    for (const idx of [indices[i], indices[i + 1], indices[i + 2]]) {
      normals[idx * 3] += nx
      normals[idx * 3 + 1] += ny
      normals[idx * 3 + 2] += nz
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2])
    if (len > 1e-6) {
      normals[i] /= len
      normals[i + 1] /= len
      normals[i + 2] /= len
    }
  }
}

export function createOpeningStairsGeometry(
  wall: Wall,
  opening: Opening,
): THREE.BufferGeometry | null {
  const stairs = opening.stairs
    ? normalizeOpeningStairs(opening.stairs, opening)
    : null
  if (!stairs?.enabled) return null
  const treads = layoutStairTreads(opening, stairs)
  if (treads.length === 0) return null

  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const outward = studioWindowDepthForwardSign(wall)
  const facadeZ = studioFacadeOutwardLocalZ(wall)
  const outerWallZ = wall.panelFlip ?? false ? 0 : wall.depth
  const innerWallZ = studioWallInnerLocalZ(wall)

  for (let i = 0; i < treads.length; i += 1) {
    const tread = treads[i]
    const x0 = tread.x - halfW
    const x1 = tread.x + tread.width - halfW
    const y0 = tread.y - halfH
    const y1 = tread.y + tread.height - halfH
    // Oberste Ebene: immer bis Innenwand/Tür; Stufen darunter an der Außenkante.
    const zBack = i === 0 ? innerWallZ : outerWallZ
    const zFront = facadeZ + (tread.zOut + tread.depth) * outward
    const blb = new THREE.Vector3(x0, y0, zBack)
    const brb = new THREE.Vector3(x1, y0, zBack)
    const trb = new THREE.Vector3(x1, y1, zBack)
    const tlb = new THREE.Vector3(x0, y1, zBack)
    const blf = new THREE.Vector3(x0, y0, zFront)
    const brf = new THREE.Vector3(x1, y0, zFront)
    const trf = new THREE.Vector3(x1, y1, zFront)
    const tlf = new THREE.Vector3(x0, y1, zFront)
    addQuad(positions, normals, indices, blb, tlb, trb, brb)
    addQuad(positions, normals, indices, blf, brf, trf, tlf)
    addQuad(positions, normals, indices, blb, brb, brf, blf)
    addQuad(positions, normals, indices, trb, tlb, tlf, trf)
    addQuad(positions, normals, indices, tlb, blb, blf, tlf)
    addQuad(positions, normals, indices, brb, trb, trf, brf)
  }

  finalizeNormals(positions, normals, indices)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  return geometry
}
