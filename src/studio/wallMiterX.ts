import type { Wall } from '../types/facade'

const END_EPS = 1e-4

/**
 * Wand-X im zentrierten Lokalraum (Bilderrahmen).
 *
 * - `wallX ≈ 0` / `width`: auf der Gehrungsebene `s − z·tan` (Wandkörper, Gesims).
 * - Sonst: `wallX − halfW`, nur auf diese Ebenen geklemmt (Feld/Öffnungen ungehrt).
 *
 * Steine in der Keilzone einer konvexen Ecke liegen auf wallX < 0 bzw. > width,
 * damit Vertikalfugen 0,5/1 von der Außenecke sitzen — nicht erst hinter einem
 * 32–40-cm-Streifen ohne Fuge.
 */
export function studioMiterLocalX(
  wall: Wall,
  wallX: number,
  z: number,
  miterStartEnabled = true,
  miterEndEnabled = true,
): number {
  const halfW = wall.width / 2
  const wallDepth = Math.max(wall.depth, 1e-6)
  const tanStart = miterStartEnabled ? (wall.miterStart ?? 0) / wallDepth : 0
  const tanEnd = miterEndEnabled ? (wall.miterEnd ?? 0) / wallDepth : 0
  const xStart = -halfW - z * tanStart
  const xEnd = halfW - z * tanEnd

  if (miterStartEnabled && wallX <= END_EPS) {
    if (wallX >= -END_EPS) return xStart
  }
  if (miterEndEnabled && wallX >= wall.width - END_EPS) {
    if (wallX <= wall.width + END_EPS) return xEnd
  }

  const x = wallX - halfW
  const lo = Math.min(xStart, xEnd)
  const hi = Math.max(xStart, xEnd)
  return Math.min(hi, Math.max(lo, x))
}

/** Inverse der ungehrten Abbildung `x = wallX − halfW`. */
export function studioWallXFromMiterLocalX(wall: Wall, localX: number): number {
  return localX + wall.width / 2
}
