import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { skewStudioWallToDiagonal, wallStartPoint, wallEndPoint } from './walls'
import {
  floorPlanFromWalls,
  planHasClosedRing,
  planFacesWithHoles,
  planSegmentsForWall,
  normalizePlanCell,
} from './floorPlan'
import { finalizeStudioGeometry } from './planGeometry'

function wallAt(id: string, ox: number, oz: number, yaw: number, w: number, y = 0): Wall {
  return {
    id,
    kind: 'studio',
    x: ox,
    y,
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
    planLinked: true,
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

describe('Boden/Decke nach Schrägstellen', () => {
  it('normalizePlanCell entfernt −0', () => {
    expect(Object.is(normalizePlanCell(-0), 0)).toBe(true)
    expect(normalizePlanCell(2)).toBe(2)
  })

  it('clustert gemeinsame Stoßecke (120 cm) zu einem geschlossenen Ring', () => {
    const walls = [
      wallAt('a', 0, 0, 45, 120 * Math.SQRT2),
      wallAt('b', 120, -120, 90, 120),
      wallAt('c', 120, -240, 180, 120),
      wallAt('d', 0, -240, 270, 240),
    ]
    expect(wallEndPoint(walls[0]!).x).toBeCloseTo(wallStartPoint(walls[1]!).x, 5)
    const plan = floorPlanFromWalls(walls)
    expect(planHasClosedRing(plan)).toBe(true)
    expect(planFacesWithHoles(plan).length).toBeGreaterThan(0)
  })

  it('schließt Ring und Flächen nach Shift 90°→135° (120-cm-Front)', () => {
    const walls = [
      wallAt('a', 0, 0, 0, 120),
      wallAt('b', 120, 0, 90, 240),
      wallAt('c', 120, -240, 180, 120),
      wallAt('d', 0, -240, 270, 240),
    ]
    const next = finalizeStudioGeometry(
      skewStudioWallToDiagonal(stateWith(walls), 'a', 'end', -40, -100, {
        selectedWallIds: ['a'],
      }),
    )
    const plan = next.buildings[0]!.floors[0]!
    expect(planHasClosedRing(plan)).toBe(true)
    expect(planFacesWithHoles(plan).length).toBeGreaterThan(0)
    expect(plan.showCeiling).not.toBe(false)
  })

  it('planSegmentsForWall legt L-Pfad bei ungültiger Direktdiagonale', () => {
    const parts = planSegmentsForWall(0, 0, 3, -2)
    expect(parts.length).toBeGreaterThanOrEqual(1)
  })
})
