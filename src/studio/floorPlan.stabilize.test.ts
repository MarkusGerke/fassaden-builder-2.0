import { describe, expect, it } from 'vitest'
import { emptyNeighbors } from '../types/facade'
import type { FacadeState, Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import {
  floorPlanFromWalls,
  stabilizeFloorPlanIds,
  syncFloorPlansFromWalls,
} from './floorPlan'

function wall(
  id: string,
  originX: number,
  originZ: number,
  yawDeg: number,
  width: number,
): Wall {
  return {
    id,
    kind: 'studio',
    buildingId: 'b1',
    x: originX,
    y: 0,
    width,
    height: 448,
    depth: WALL_DEPTH,
    originX,
    originZ,
    yawDeg,
    panelFlip: true,
    planLinked: true,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

function rectWalls(): Wall[] {
  const w = 480
  const d = 288
  return [
    wall('n', 0, 0, 0, w),
    wall('e', w, 0, 90, d),
    wall('s', w, d, 180, w),
    wall('w', 0, d, 270, d),
  ]
}

describe('stabilizeFloorPlanIds', () => {
  it('behält Node- und Edge-IDs bei gleicher Geometrie', () => {
    const walls = rectWalls()
    const first = floorPlanFromWalls(walls)
    const second = floorPlanFromWalls(walls)
    expect(first.nodes.length).toBeGreaterThanOrEqual(4)
    expect(first.nodes.map((n) => n.id).sort()).not.toEqual(second.nodes.map((n) => n.id).sort())

    const stable = stabilizeFloorPlanIds(first, second)
    const key = (n: { gx: number; gz: number }) => `${n.gx},${n.gz}`
    for (const node of first.nodes) {
      const match = stable.nodes.find((n) => key(n) === key(node))
      expect(match?.id).toBe(node.id)
    }
    expect(stable.edges).toHaveLength(first.edges.length)
    for (const edge of first.edges) {
      const from = first.nodes.find((n) => n.id === edge.fromId)!
      const to = first.nodes.find((n) => n.id === edge.toId)!
      const stableEdge = stable.edges.find((e) => {
        const a = stable.nodes.find((n) => n.id === e.fromId)!
        const b = stable.nodes.find((n) => n.id === e.toId)!
        return (
          (key(a) === key(from) && key(b) === key(to)) ||
          (key(a) === key(to) && key(b) === key(from))
        )
      })
      expect(stableEdge?.id).toBe(edge.id)
    }
  })

  it('syncFloorPlansFromWalls ändert IDs nicht ohne Geometrieänderung', () => {
    const state: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 448,
          wallDepth: WALL_DEPTH,
          walls: rectWalls(),
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const once = syncFloorPlansFromWalls(state)
    const twice = syncFloorPlansFromWalls(once)
    expect(JSON.stringify(once.buildings[0]!.floors)).toBe(JSON.stringify(twice.buildings[0]!.floors))
  })
})
