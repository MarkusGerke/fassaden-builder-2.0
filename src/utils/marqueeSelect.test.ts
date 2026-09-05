import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import {
  allClientPointsInRect,
  clientPointInRect,
  lightMarkerSiteLocalCorners,
  normalizeClientRect,
  openingFaceSiteLocalCorners,
  wallObbSiteLocalCorners,
} from './marqueeSelect'

function studioWall(partial: Partial<Wall> & Pick<Wall, 'id' | 'width' | 'height'>): Wall {
  return {
    kind: 'studio',
    x: partial.originX ?? 0,
    y: 0,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    planLinked: true,
    panelFlip: true,
    ...partial,
  }
}

describe('normalizeClientRect / containment', () => {
  it('normalisiert beliebige Eckreihenfolge', () => {
    expect(normalizeClientRect(100, 80, 20, 10)).toEqual({
      left: 20,
      top: 10,
      right: 100,
      bottom: 80,
    })
  })

  it('fordert alle Punkte im Rechteck — Teiltreffer scheitern', () => {
    const rect = normalizeClientRect(0, 0, 100, 100)
    expect(allClientPointsInRect([{ x: 10, y: 10 }, { x: 90, y: 90 }], rect)).toBe(true)
    expect(allClientPointsInRect([{ x: 10, y: 10 }, { x: 110, y: 90 }], rect)).toBe(false)
    expect(allClientPointsInRect([{ x: 10, y: 10 }, null], rect)).toBe(false)
    expect(clientPointInRect(0, 0, rect)).toBe(true)
  })
})

describe('wallObbSiteLocalCorners', () => {
  it('liefert 8 Ecken einer achsparallelen Wand', () => {
    const wall = studioWall({ id: 'w', width: 192, height: 456, originX: 0, originZ: 0 })
    const corners = wallObbSiteLocalCorners(wall)
    expect(corners).toHaveLength(8)
    const xs = corners.map((c) => c.x)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(Math.max(...xs)).toBeCloseTo(192)
  })
})

describe('openingFaceSiteLocalCorners', () => {
  it('liegt in der Wandfläche', () => {
    const wall = studioWall({ id: 'w', width: 192, height: 456 })
    const opening: Opening = {
      id: 'o',
      type: 'window',
      x: 48,
      y: 100,
      width: 96,
      height: 160,
    } as Opening
    const corners = openingFaceSiteLocalCorners(wall, opening)
    expect(corners).toHaveLength(4)
    const xs = corners.map((c) => c.x)
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(40)
    expect(Math.max(...xs)).toBeLessThanOrEqual(160)
  })
})

describe('lightMarkerSiteLocalCorners', () => {
  it('umfasst Mittelpunkt und Achsen', () => {
    const pts = lightMarkerSiteLocalCorners(10, 20, 30, 40)
    expect(pts).toHaveLength(7)
    expect(pts[0]).toEqual({ x: 10, y: 20, z: 30 })
  })
})
