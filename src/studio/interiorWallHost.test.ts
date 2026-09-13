import { describe, expect, it } from 'vitest'
import { WALL_DEPTH, WALL_HEIGHT } from '../constants/presets'
import { facadeOutward } from './elevation'
import {
  createInteriorWallFromHostNormal,
  createStudioWall,
  inwardYawDeg,
  normalizeStudioWall,
  styleWallAsInterior,
  wallEndTouchesForeignSpine,
  wallStartPoint,
} from './walls'

describe('createInteriorWallFromHostNormal', () => {
  it('legt 90°-Innenwand an Innenseite ohne Host-Änderung und ohne Sockel', () => {
    const host = normalizeStudioWall({
      ...createStudioWall(0, 0),
      id: 'host',
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      width: 384,
      height: WALL_HEIGHT,
      depth: WALL_DEPTH,
      panelFlip: true,
      openings: [],
    })
    const hostSnapshot = structuredClone(host)
    const interior = createInteriorWallFromHostNormal({
      host,
      localXCm: 192,
      lengthCm: 96,
      depthCm: 24,
    })
    expect(interior).not.toBeNull()
    expect(interior!.role).toBe('interior')
    expect(interior!.width).toBe(96)
    expect(interior!.depth).toBe(24)
    expect(interior!.yawDeg).toBe(inwardYawDeg(0, true))
    expect(Math.abs(((interior!.yawDeg ?? 0) - 0 + 360) % 180 - 90)).toBeLessThan(1)
    expect(interior!.panel?.plinthEnabled).toBe(false)
    expect(interior!.planLinked).toBe(true)
    expect(interior!.height).toBe(host.height)
    expect(host).toEqual(hostSnapshot)
    const out = facadeOutward(0, true)
    const into = { x: -out.x, z: -out.z }
    const start = wallStartPoint(interior!)
    // Start liegt an Host-Innenseite (Y=0-Wand: Z = WALL_DEPTH)
    expect(start.z).toBeCloseTo(into.z * WALL_DEPTH, 5)
    expect(wallEndTouchesForeignSpine(interior!, 'start', [host, interior!])).toBe(true)
  })

  it('dockt an Innenwand-Host (beide Seiten) und bleibt an Innenseite der Außenwand', () => {
    const exterior = normalizeStudioWall({
      ...createStudioWall(0, 0),
      id: 'ext',
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      width: 384,
      height: WALL_HEIGHT,
      depth: WALL_DEPTH,
      panelFlip: true,
      openings: [],
    })
    const first = createInteriorWallFromHostNormal({
      host: exterior,
      localXCm: 192,
      lengthCm: 192,
      depthCm: 24,
    })!
    const firstStyled = styleWallAsInterior(first, 24)
    const second = createInteriorWallFromHostNormal({
      host: firstStyled,
      localXCm: 96,
      lengthCm: 96,
      depthCm: 24,
      fromFace: 'outer',
    })
    expect(second).not.toBeNull()
    expect(second!.role).toBe('interior')
    expect(wallEndTouchesForeignSpine(second!, 'start', [exterior, firstStyled, second!])).toBe(true)
  })
})
