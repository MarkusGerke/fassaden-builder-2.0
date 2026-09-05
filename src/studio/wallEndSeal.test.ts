import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import {
  sealNearWallEndGaps,
  wallStartPoint,
  wallEndPoint,
  pointsMeet,
  WALL_END_SEAL_GAP_CM,
} from './walls'
import { finalizeStudioGeometry } from './planGeometry'

function wallAt(
  id: string,
  ox: number,
  oz: number,
  yaw: number,
  w: number,
  opts?: { planLinked?: boolean },
): Wall {
  return {
    id,
    kind: 'studio',
    x: ox,
    y: 0,
    width: w,
    height: 456,
    depth: WALL_DEPTH,
    originX: ox,
    originZ: oz,
    yawDeg: yaw,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    planLinked: opts?.planLinked ?? true,
  }
}

function stateWith(walls: Wall[]): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'H',
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        walls,
        floors: [{ nodes: [], edges: [], showCeiling: true }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('sealNearWallEndGaps', () => {
  it('schließt 90°-Ecke mit Lücke unter 48 cm', () => {
    // A endet bei (192,0), B startet bei (192+24, 0) = 24 cm Versatz — fast 90°-Stoß
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 216, 0, 90, 192)
    expect(Math.hypot(wallEndPoint(a).x - wallStartPoint(b).x, wallEndPoint(a).z - wallStartPoint(b).z)).toBe(24)
    expect(24).toBeLessThan(WALL_END_SEAL_GAP_CM)

    const next = sealNearWallEndGaps(stateWith([a, b]))
    const walls = next.buildings[0]!.walls
    const a2 = walls.find((w) => w.id === 'a')!
    const b2 = walls.find((w) => w.id === 'b')!
    const meet =
      pointsMeet(wallEndPoint(a2), wallStartPoint(b2)) ||
      pointsMeet(wallEndPoint(a2), wallEndPoint(b2)) ||
      pointsMeet(wallStartPoint(a2), wallStartPoint(b2)) ||
      pointsMeet(wallStartPoint(a2), wallEndPoint(b2))
    expect(meet).toBe(true)
  })

  it('schließt kollineare Lücke unter 48 cm', () => {
    // A: 0→168, B: 192→384 — 24 cm Lücke auf der Achse
    const a = wallAt('a', 0, 0, 0, 168)
    const b = wallAt('b', 192, 0, 0, 192)
    const gap = wallStartPoint(b).x - wallEndPoint(a).x
    expect(gap).toBe(24)

    const next = sealNearWallEndGaps(stateWith([a, b]))
    const walls = next.buildings[0]!.walls
    const a2 = walls.find((w) => w.id === 'a')!
    const b2 = walls.find((w) => w.id === 'b')!
    expect(
      pointsMeet(wallEndPoint(a2), wallStartPoint(b2)) ||
        pointsMeet(wallEndPoint(a2), wallEndPoint(b2)),
    ).toBe(true)
  })

  it('lässt Lücken über 48 cm offen', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192 + 60, 0, 90, 192)
    const next = sealNearWallEndGaps(stateWith([a, b]))
    const a2 = next.buildings[0]!.walls.find((w) => w.id === 'a')!
    const b2 = next.buildings[0]!.walls.find((w) => w.id === 'b')!
    expect(pointsMeet(wallEndPoint(a2), wallStartPoint(b2))).toBe(false)
    expect(a2.width).toBe(192)
    expect(wallStartPoint(b2).x).toBe(252)
  })

  it('finalizeStudioGeometry dockt Near-Miss mit', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192 + 16, 0, 90, 192)
    const next = finalizeStudioGeometry(stateWith([a, b]))
    const a2 = next.buildings[0]!.walls.find((w) => w.id === 'a')!
    const b2 = next.buildings[0]!.walls.find((w) => w.id === 'b')!
    expect(
      pointsMeet(wallEndPoint(a2), wallStartPoint(b2)) ||
        pointsMeet(wallEndPoint(a2), wallEndPoint(b2)),
    ).toBe(true)
  })
})
