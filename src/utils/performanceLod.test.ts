import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { buildingIdsNeedingRebuild } from './performanceLod'

function wall(id: string, buildingId: string, x = 0): Wall {
  return {
    id,
    kind: 'studio',
    buildingId,
    x,
    y: 0,
    width: 128,
    height: 456,
    depth: WALL_DEPTH,
    originX: x,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

function stateWithBuildings(...buildingIds: string[]): FacadeState {
  return {
    buildings: buildingIds.map((id) => ({
      id,
      name: id,
      wallHeight: 456,
      wallDepth: WALL_DEPTH,
      walls: [wall(`${id}-w`, id)],
      floors: [{ nodes: [], edges: [] }],
    })),
    activeBuildingId: buildingIds[0]!,
  }
}

describe('buildingIdsNeedingRebuild', () => {
  it('liefert das eine geänderte Haus — auch wenn es das einzige ist', () => {
    const prev = stateWithBuildings('b1')
    const next = structuredClone(prev)
    next.buildings[0]!.walls[0]!.x = 48
    expect(buildingIdsNeedingRebuild(prev, next)).toEqual(['b1'])
  })

  it('liefert nur das geänderte Haus bei mehreren Häusern', () => {
    const prev = stateWithBuildings('b1', 'b2')
    const next = structuredClone(prev)
    next.buildings[1]!.walls[0]!.x = 96
    expect(buildingIdsNeedingRebuild(prev, next)).toEqual(['b2'])
  })

  it('liefert leeres Array ohne Geometrieänderung', () => {
    const prev = stateWithBuildings('b1')
    expect(buildingIdsNeedingRebuild(prev, structuredClone(prev))).toEqual([])
  })

  it('liefert null bei neuem Haus oder Site-Yaw', () => {
    const prev = stateWithBuildings('b1')
    expect(buildingIdsNeedingRebuild(prev, stateWithBuildings('b1', 'b2'))).toBeNull()
    const yawed = structuredClone(prev)
    yawed.siteYawDeg = 90
    expect(buildingIdsNeedingRebuild(prev, yawed)).toBeNull()
  })
})
