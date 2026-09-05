import type { Wall } from '../types/facade'
import { wallAlongDelta } from '../studio/walls'
import { STUDIO_DEFAULT_HEIGHT } from '../studio/constants'

/**
 * Max. Orbit-Radius zum Ziel.
 * Groß genug für Überblick über mehrere Reihen; engeres Culling hält Nahzoom flüssig.
 */
export const GALLERY_CAM_MAX_DISTANCE = 5200
/** Nah genug für Fassaden-Detail, ohne in die Wand zu rutschen. */
export const GALLERY_CAM_MIN_DISTANCE = 12
/**
 * Wände weiter weg als das werden in der Galerie ausgeblendet (ein Gebäude = kein LOD).
 * Weit genug, dass Nachbarreihen sichtbar bleiben und man panen/anklicken kann.
 */
export const GALLERY_WALL_CULL_DISTANCE = 3800
/** Hysterese gegen Sichtbarkeits-Flackern an der Cull-Grenze. */
export const GALLERY_WALL_CULL_HYSTERESIS = 400
/** camera.far-Untergrenze in der Galerie (mit Culling reicht weit weniger als die ganze Site). */
export const GALLERY_CAM_FAR_MIN = 5600

export interface GalleryFocusBounds {
  cx: number
  cy: number
  cz: number
  span: number
}

/** AABB-Mittelpunkt und Spannweite einer Wandgruppe (Grundriss XZ). */
export function galleryFocusBounds(walls: Wall[]): GalleryFocusBounds | null {
  if (walls.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let maxY = STUDIO_DEFAULT_HEIGHT
  for (const wall of walls) {
    const ox = wall.originX ?? wall.x
    const oz = wall.originZ ?? 0
    const along = wallAlongDelta(wall.yawDeg ?? 0, wall.width)
    const ex = ox + along.x
    const ez = oz + along.z
    minX = Math.min(minX, ox, ex)
    maxX = Math.max(maxX, ox, ex)
    minZ = Math.min(minZ, oz, ez)
    maxZ = Math.max(maxZ, oz, ez)
    maxY = Math.max(maxY, wall.y + wall.height)
  }
  const span = Math.max(maxX - minX, maxZ - minZ, 96)
  return {
    cx: (minX + maxX) / 2,
    cy: maxY / 2,
    cz: (minZ + maxZ) / 2,
    // Kein Cap: sonst steht die 3D-Startkamera bei großen Häusern in einer Wand.
    span,
  }
}

/**
 * Einstiegsfokus: erste Reihe (kleinstes originZ), bis ~4 Wände / ~1200 cm Breite.
 * Nicht die ganze Galerie — sonst Orbit um den Gesamtschwerpunkt und riesige Distanz.
 */
export function galleryEntryFocusWalls(walls: Wall[]): Wall[] {
  if (walls.length === 0) return []
  const sorted = [...walls].sort((a, b) => {
    const za = a.originZ ?? 0
    const zb = b.originZ ?? 0
    if (Math.abs(za - zb) > 1) return za - zb
    return (a.originX ?? a.x) - (b.originX ?? b.x)
  })
  const z0 = sorted[0]!.originZ ?? 0
  const row = sorted.filter((w) => Math.abs((w.originZ ?? 0) - z0) < 80)
  const picked: Wall[] = []
  let widthSum = 0
  for (const wall of row) {
    picked.push(wall)
    widthSum += wall.width
    if (picked.length >= 4 || widthSum >= 1200) break
  }
  return picked.length > 0 ? picked : sorted.slice(0, 1)
}

/**
 * Zoom-Geschwindigkeit abhängig vom Orbit-Radius.
 * Nah am Ziel wirkt prozentuales Dolly sonst „eingefroren“.
 */
export function galleryZoomSpeedForDistance(distance: number): number {
  const d = Number.isFinite(distance) ? Math.max(GALLERY_CAM_MIN_DISTANCE, distance) : 400
  if (d < 80) return 3.2
  if (d < 200) return 2.4
  if (d < 500) return 1.6
  return 1.2
}

/** camera.near/far für Galerie: enger Frustum = bessere Tiefe und weniger Fill-Rate. */
export function galleryCameraDepthRange(distanceToTarget: number): { near: number; far: number } {
  const d = Number.isFinite(distanceToTarget) ? Math.max(1, distanceToTarget) : 400
  return {
    near: Math.min(8, Math.max(0.4, d * 0.02)),
    far: Math.max(GALLERY_CAM_FAR_MIN, d + GALLERY_WALL_CULL_DISTANCE + 500),
  }
}
