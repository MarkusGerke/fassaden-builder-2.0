import type { Wall } from '../types/facade'

/** Interne Streifen für glatte Ellipsen-Geometrie (eine logische Wand). */
export const ARC_WALL_MESH_STRIPS = 64

export interface ArcBayCurve {
  frontWidthCm: number
  depthCm: number
  inward?: boolean
}

export function wallHasArcBay(wall: Wall): boolean {
  return Boolean(wall.arcBay?.frontWidthCm && wall.arcBay?.depthCm)
}

/** Halbellipsenbogen-Länge (φ = 0…π), Ramanujan-Näherung. */
export function halfEllipseArcLength(a: number, b: number): number {
  const aa = Math.max(1, a)
  const bb = Math.max(1, b)
  const h = ((aa - bb) / (aa + bb)) ** 2
  return (Math.PI / 2) * (aa + bb) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

/** Bogenparameter φ ∈ [0, π] für Wegstrecke s entlang der Halbellipse (0…L). */
export function phiFromArcLength(s: number, a: number, b: number, totalLength: number): number {
  const L = Math.max(1e-6, totalLength)
  const target = Math.max(0, Math.min(L, s))
  if (target <= 0) return 0
  if (target >= L) return Math.PI

  let lo = 0
  let hi = Math.PI
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    const len = partialEllipseArcLength(a, b, mid)
    if (len < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Bogenlänge von φ=0 bis φ=endPhi (numerisch). */
export function partialEllipseArcLength(a: number, b: number, endPhi: number): number {
  const steps = Math.max(8, Math.ceil(endPhi * 32))
  let len = 0
  let prev = ellipseTangentPoint(a, b, 0)
  for (let i = 1; i <= steps; i += 1) {
    const phi = (endPhi * i) / steps
    const pt = ellipseTangentPoint(a, b, phi)
    len += Math.hypot(pt.x - prev.x, pt.z - prev.z)
    prev = pt
  }
  return len
}

/** Punkt auf der Halbellipse in Wand-Lokal-Koordinaten: x entlang Sehne, z nach außen. */
export function ellipsePointLocal(a: number, b: number, phi: number, inward: boolean): { x: number; z: number } {
  const sign = inward ? -1 : 1
  return {
    x: a * (1 - Math.cos(phi)),
    z: sign * b * Math.sin(phi),
  }
}

function ellipseTangentPoint(a: number, b: number, phi: number): { x: number; z: number } {
  const dx = a * Math.sin(phi)
  const dz = b * Math.cos(phi)
  const len = Math.hypot(dx, dz) || 1
  return { x: dx / len, z: dz / len }
}

export function arcBayParams(wall: Wall): { a: number; b: number; inward: boolean; arcLength: number } | null {
  const arc = wall.arcBay
  if (!arc?.frontWidthCm || !arc?.depthCm) return null
  const a = arc.frontWidthCm / 2
  const b = arc.depthCm
  const inward = Boolean(arc.inward)
  const arcLength = partialEllipseArcLength(a, b, Math.PI)
  return { a, b, inward, arcLength }
}

/** wallX = Weg entlang der Bogenoberfläche (0…wall.width). */
export function arcPhiFromWallX(wall: Wall, wallX: number): number {
  const p = arcBayParams(wall)
  if (!p) return 0
  const s = Math.max(0, Math.min(wall.width, wallX))
  return phiFromArcLength(s, p.a, p.b, p.arcLength)
}

/** Z-Position der Außenfläche am Bogen (Wand-Lokal). */
export function arcOuterBulgeZ(wall: Wall, wallX: number): number {
  const p = arcBayParams(wall)
  if (!p) return 0
  const phi = arcPhiFromWallX(wall, wallX)
  const raw = p.b * Math.sin(phi)
  const baySign = p.inward ? -1 : 1
  const forwardSign = wall.panelFlip ? -1 : 1
  return raw * baySign * forwardSign
}

function arcWallInnerLocalZ(wall: Wall): number {
  return wall.panelFlip ? wall.depth : 0
}

/** X auf der Sehne (Wand-Lokal, 0…frontWidthCm). */
export function arcChordX(wall: Wall, wallX: number): number {
  const p = arcBayParams(wall)
  if (!p) return wallX
  const pt = ellipsePointLocal(p.a, p.b, arcPhiFromWallX(wall, wallX), p.inward)
  return pt.x
}

/**
 * Wand-Lokalposition auf der gekrümmten Fläche.
 * wallX = Bogenlänge, wallY = Höhe von unten, z = Tiefe von Sehne nach innen.
 */
export function arcWallLocalPoint(
  wall: Wall,
  wallX: number,
  wallY: number,
  zDepth: number,
): { x: number; y: number; z: number } {
  const p = arcBayParams(wall)
  const halfH = wall.height / 2
  if (!p) {
    const halfW = wall.width / 2
    return { x: wallX - halfW, y: wallY - halfH, z: zDepth }
  }
  const outerZ = arcOuterBulgeZ(wall, wallX)
  const xOuter = arcChordX(wall, wallX) - p.a
  const t = Math.max(0, Math.min(1, zDepth / Math.max(wall.depth, 1e-6)))
  const zInner = arcWallInnerLocalZ(wall)
  return {
    x: xOuter,
    y: wallY - halfH,
    z: outerZ + (zInner - outerZ) * t,
  }
}

/** Tangential-Yaw an der Bogenposition (Grad). */
export function arcTangentYawDeg(wall: Wall, wallX: number): number {
  const p = arcBayParams(wall)
  if (!p) return wall.yawDeg ?? 0
  const phi = arcPhiFromWallX(wall, wallX)
  const dx = p.a * Math.sin(phi)
  const dz = (p.inward ? -1 : 1) * p.b * Math.cos(phi)
  const localYaw = (Math.atan2(dx, dz) * 180) / Math.PI
  return (wall.yawDeg ?? 0) + localYaw
}
