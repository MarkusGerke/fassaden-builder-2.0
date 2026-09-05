import { describe, expect, it } from 'vitest'
import { createStudioWall, normalizeStudioWall } from '../studio/walls'
import {
  GALLERY_CAM_MIN_DISTANCE,
  GALLERY_WALL_CULL_DISTANCE,
  galleryCameraDepthRange,
  galleryEntryFocusWalls,
  galleryFocusBounds,
  galleryZoomSpeedForDistance,
} from './galleryCamera'

describe('galleryCamera', () => {
  it('begrenzt Einstiegsfokus auf die erste Reihe', () => {
    const mk = (x: number, z: number, width = 192) =>
      normalizeStudioWall({
        ...createStudioWall(x, 0),
        originX: x,
        originZ: z,
        width,
        planLinked: false,
      })
    const walls = [
      mk(0, 0),
      mk(500, 0),
      mk(1000, 0),
      mk(1500, 0),
      mk(2000, 0),
      mk(0, 800),
      mk(500, 800),
    ]
    const entry = galleryEntryFocusWalls(walls)
    expect(entry.every((w) => (w.originZ ?? 0) < 80)).toBe(true)
    expect(entry.length).toBeLessThanOrEqual(4)
    const bounds = galleryFocusBounds(entry)
    expect(bounds).not.toBeNull()
    expect(bounds!.span).toBeGreaterThanOrEqual(192)
    // Bis 4 Wände der ersten Reihe — Spannweite folgt den Origins, kein 900-Cap.
    expect(bounds!.cx).toBeGreaterThan(0)
  })

  it('liefert die volle Grundriss-Spannweite ohne Cap', () => {
    const rect = [
      normalizeStudioWall({
        ...createStudioWall(0, 0),
        originX: 0,
        originZ: 0,
        width: 2000,
        yawDeg: 0,
        planLinked: false,
      }),
      normalizeStudioWall({
        ...createStudioWall(0, 0),
        originX: 2000,
        originZ: 0,
        width: 1500,
        yawDeg: 90,
        planLinked: false,
      }),
    ]
    const bounds = galleryFocusBounds(rect)
    expect(bounds).not.toBeNull()
    expect(bounds!.span).toBeGreaterThan(900)
    expect(bounds!.span).toBeGreaterThanOrEqual(1500)
  })

  it('beschleunigt Zoom nahe am Ziel und hält far knapp über Cull-Distanz', () => {
    expect(galleryZoomSpeedForDistance(GALLERY_CAM_MIN_DISTANCE)).toBeGreaterThan(
      galleryZoomSpeedForDistance(800),
    )
    const near = galleryCameraDepthRange(50)
    expect(near.far).toBeGreaterThan(GALLERY_WALL_CULL_DISTANCE)
    expect(near.near).toBeLessThan(5)
  })
})
