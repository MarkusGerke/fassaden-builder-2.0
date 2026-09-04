import { describe, expect, it } from 'vitest'
import { emptyNeighbors } from '../types/facade'
import type { FacadeState, Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import {
  createEmptyFloorPlan,
  drawPlanLine,
  extractPlanRings,
  floorPlanFromWalls,
  planFacesWithHoles,
  planHasClosedRing,
  sealNearClosedPlanGaps,
  splitEdgesAtTJoints,
  removePlanChords,
  stabilizeFloorPlanIds,
  syncFloorPlansFromWalls,
} from './floorPlan'
import { PLAN_GRID } from './constants'

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

describe('sealNearClosedPlanGaps', () => {
  it('verbindet zwei Grad-1-Enden eine Zelle auseinander zu einem geschlossenen Ring', () => {
    const open = {
      nodes: [
        { id: 'a', gx: 0, gz: 0 },
        { id: 'b', gx: 10, gz: 0 },
        { id: 'c', gx: 10, gz: 8 },
        { id: 'd', gx: 0, gz: 8 },
        { id: 'e', gx: 1, gz: 0 },
      ],
      edges: [
        { id: 'e1', fromId: 'e', toId: 'b' },
        { id: 'e2', fromId: 'b', toId: 'c' },
        { id: 'e3', fromId: 'c', toId: 'd' },
        { id: 'e4', fromId: 'd', toId: 'a' },
      ],
    }
    expect(planHasClosedRing(open)).toBe(false)
    const sealed = sealNearClosedPlanGaps(open)
    expect(planHasClosedRing(sealed)).toBe(true)
    expect(extractPlanRings(sealed).some((r) => r.closed && r.nodes.length >= 4)).toBe(true)
  })

  it('schließt Raster-Lücke nach Extrusion (Wandenden 48 cm versetzt)', () => {
    const walls = [
      wall('a', PLAN_GRID, 0, 0, 192 - PLAN_GRID),
      wall('r', 192, 0, 270, 192),
      wall('b', 192, 192, 180, 192),
      wall('l', 0, 192, 90, 192),
    ]
    const plan = floorPlanFromWalls(walls)
    expect(planHasClosedRing(plan)).toBe(true)
  })
})

describe('splitEdgesAtTJoints / Vorsprung-Kontur', () => {
  it('L-Form: geschlossener Outer mit ≥ 6 Ecken', () => {
    let plan = createEmptyFloorPlan()
    // L: (0,0)-(10,0)-(10,4)-(4,4)-(4,10)-(0,10)
    plan = drawPlanLine(plan, 0, 0, 10, 0)
    plan = drawPlanLine(plan, 10, 0, 10, 4)
    plan = drawPlanLine(plan, 10, 4, 4, 4)
    plan = drawPlanLine(plan, 4, 4, 4, 10)
    plan = drawPlanLine(plan, 4, 10, 0, 10)
    plan = drawPlanLine(plan, 0, 10, 0, 0)
    const faces = planFacesWithHoles(plan)
    expect(faces.length).toBe(1)
    expect(faces[0]!.outer.length).toBeGreaterThanOrEqual(6)
  })

  it('U-Vorsprung: T-Split + Chord-Entfernung → Outer mit ≥ 6 Ecken', () => {
    let raw = createEmptyFloorPlan()
    raw = drawPlanLine(raw, 0, 0, 10, 0)
    raw = drawPlanLine(raw, 10, 0, 10, 8)
    raw = drawPlanLine(raw, 10, 8, 0, 8)
    raw = drawPlanLine(raw, 0, 8, 0, 0)
    raw = drawPlanLine(raw, 3, 0, 3, -2)
    raw = drawPlanLine(raw, 3, -2, 7, -2)
    raw = drawPlanLine(raw, 7, -2, 7, 0)
    const before = planFacesWithHoles(raw)
    expect(before[0]?.outer.length ?? 0).toBeLessThanOrEqual(4)

    const fixed = removePlanChords(splitEdgesAtTJoints(raw))
    const faces = planFacesWithHoles(fixed)
    expect(faces.length).toBe(1)
    expect(faces[0]!.outer.length).toBeGreaterThanOrEqual(6)
  })
})
