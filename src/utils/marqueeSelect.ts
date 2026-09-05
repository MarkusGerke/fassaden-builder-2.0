import type { Opening, Wall } from '../types/facade'
import {
  isStudioWall,
  studioFacadeOutwardDepth,
  studioFacadeOutwardLocalZ,
  studioWallTransform,
} from '../studio/walls'
import { openingMasonryRect } from './openingGeometry'

export type ClientRect = { left: number; top: number; right: number; bottom: number }

export function normalizeClientRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): ClientRect {
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
  }
}

export function clientPointInRect(
  x: number,
  y: number,
  rect: ClientRect,
  eps = 0.5,
): boolean {
  return (
    x >= rect.left - eps &&
    x <= rect.right + eps &&
    y >= rect.top - eps &&
    y <= rect.bottom + eps
  )
}

/** Alle Punkte müssen im Rechteck liegen (kein Null/Clip). */
export function allClientPointsInRect(
  points: Array<{ x: number; y: number } | null>,
  rect: ClientRect,
): boolean {
  if (points.length === 0) return false
  for (const p of points) {
    if (!p || !clientPointInRect(p.x, p.y, rect)) return false
  }
  return true
}

export type SiteLocalPoint = { x: number; y: number; z: number }

/**
 * 8 Ecken der Wand-OBB in site-lokal (wie `buildingWorldBox`).
 * Enthält Paneel-Vorstand.
 */
export function wallObbSiteLocalCorners(wall: Wall): SiteLocalPoint[] {
  const transform = isStudioWall(wall)
    ? studioWallTransform(wall)
    : {
        position: { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, z: 0 },
        rotationY: 0,
      }
  const hw = wall.width / 2
  const hh = wall.height / 2
  const outward = isStudioWall(wall) ? studioFacadeOutwardDepth(wall) : 0
  const flip = wall.panelFlip ?? false
  const z0 = flip ? -outward : 0
  const z1 = flip ? wall.depth : wall.depth + outward
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)
  const corners: SiteLocalPoint[] = []
  for (const lx of [-hw, hw]) {
    for (const ly of [-hh, hh]) {
      for (const lz of [z0, z1]) {
        corners.push({
          x: transform.position.x + lx * cos + lz * sin,
          y: transform.position.y + ly,
          z: transform.position.z - lx * sin + lz * cos,
        })
      }
    }
  }
  return corners
}

/**
 * 4 Ecken des Öffnungs-Mauerwerks (AABB) auf der Fassadenaußenfläche, site-lokal.
 * Wand-Lokal: X/Y vom Wandmittelpunkt, Z = Fassadenfront.
 */
export function openingFaceSiteLocalCorners(wall: Wall, opening: Opening): SiteLocalPoint[] {
  const rect = openingMasonryRect(opening)
  const facadeZ = isStudioWall(wall) ? studioFacadeOutwardLocalZ(wall) : wall.depth
  const transform = isStudioWall(wall)
    ? studioWallTransform(wall)
    : {
        position: { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, z: 0 },
        rotationY: 0,
      }
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)
  const xs = [rect.x, rect.x + rect.width]
  const ys = [rect.y, rect.y + rect.height]
  const corners: SiteLocalPoint[] = []
  for (const faceX of xs) {
    for (const faceY of ys) {
      const lx = faceX - wall.width / 2
      const ly = faceY - wall.height / 2
      corners.push({
        x: transform.position.x + lx * cos + facadeZ * sin,
        y: wall.y + wall.height / 2 + ly,
        z: transform.position.z - lx * sin + facadeZ * cos,
      })
    }
  }
  return corners
}

/** Kleine Achsen-Kreuze um eine Lichtposition (site-lokal) für „vollständig eingerahmt“. */
export function lightMarkerSiteLocalCorners(
  x: number,
  y: number,
  z: number,
  radiusCm = 40,
): SiteLocalPoint[] {
  return [
    { x, y, z },
    { x: x + radiusCm, y, z },
    { x: x - radiusCm, y, z },
    { x, y: y + radiusCm, z },
    { x, y: y - radiusCm, z },
    { x, y, z: z + radiusCm },
    { x, y, z: z - radiusCm },
  ]
}
