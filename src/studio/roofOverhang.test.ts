import { describe, expect, it } from 'vitest'
import type { Building } from '../types/facade'
import { PLAN_GRID_LEGACY_SCALE } from './constants'
import { createEmptyFloorPlan, drawPlanLine } from './floorPlan'
import { createStudioWall } from './walls'
import {
  DEFAULT_ROOF,
  listRoofEdges,
  normalizeRoof,
  offsetPolygonPerEdge,
  overhangPerEdge,
  roofOuterRing,
  type RoofEdgeInfo,
} from './roof'

function bareRectBuilding(): Building {
  const s = PLAN_GRID_LEGACY_SCALE
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
  plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
  plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
  plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
  const wall = (id: string, originX: number, originZ: number, yawDeg: number, width: number) => ({
    ...createStudioWall(originX, 0),
    id,
    originX,
    originZ,
    x: originX,
    yawDeg,
    width,
    depth: 24,
    panelFlip: true,
    planLinked: true,
    panel: { enabled: false, pattern: 'none' as const },
  })
  return {
    id: 'b1',
    name: 'Haus',
    wallHeight: 448,
    wallDepth: 24,
    walls: [
      wall('n', 0, 384, 0, 480),
      wall('e', 480, 384, 90, 384),
      wall('s', 480, 0, 180, 480),
      wall('w', 0, 0, 270, 384),
    ],
    floors: [plan],
  }
}

describe('overhangPerEdge', () => {
  const edge = (mode: RoofEdgeInfo['mode'], flush: boolean): RoofEdgeInfo => ({
    key: 'k',
    index: 0,
    a: { x: 0, z: 0 },
    b: { x: 100, z: 0 },
    lengthCm: 100,
    compass: 'N',
    label: 'N',
    mode,
    flush,
  })

  it('setzt Überstand nur bei explizit bündiger Kante auf 0', () => {
    const roof = normalizeRoof({ overhang: 40 })
    expect(overhangPerEdge([edge('flush', true)], roof)).toEqual([0])
    expect(overhangPerEdge([edge('auto', true)], roof)).toEqual([40])
    expect(overhangPerEdge([edge('free', false)], roof)).toEqual([40])
  })
})

describe('Traufüberstand – nackte Wand (Arrivieren)', () => {
  it('wendet Traufüberstand trotz auto-bündiger Kante an', () => {
    const building = bareRectBuilding()
    const roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 50,
    })
    const edges = listRoofEdges(building, roof)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.flush)).toBe(true)
    expect(overhangPerEdge(edges, roof).every((d) => d === 50)).toBe(true)

    const outer = roofOuterRing(building)
    expect(outer).not.toBeNull()
    const eave = offsetPolygonPerEdge(outer!, overhangPerEdge(edges, roof))
    const spread = Math.max(
      ...outer!.map((p, i) => Math.hypot(p.x - eave[i]!.x, p.z - eave[i]!.z)),
    )
    expect(spread).toBeGreaterThan(40)
  })
})
