import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { applyFacadeLoadPipeline } from './facadeLoad'
import { buildingNeedsOuterSpineFit, finalizeStudioGeometry, fitStateWallsToOuterSpine } from '../studio/planGeometry'
import { syncFloorPlansFromWalls } from '../studio/floorPlan'
import { FACADE_SCHEMA_VERSION } from './schemaMigrations'

function wall(
  id: string,
  originX: number,
  originZ: number,
  yawDeg: number,
  width: number,
  panelFlip = true,
): Wall {
  return {
    id,
    kind: 'studio',
    x: originX,
    y: 0,
    width,
    height: 456,
    depth: WALL_DEPTH,
    originX,
    originZ,
    yawDeg,
    panelFlip,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    planLinked: true,
  }
}

/** Geschlossenes Rechteck 960×480, Außenkante, panelFlip true. */
function outerRect(): FacadeState {
  const w = 960
  const d = 480
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus',
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        walls: [
          wall('n', 0, 0, 0, w, true),
          wall('e', w, 0, 90, d, true),
          wall('s', w, d, 180, w, true),
          wall('w', 0, d, 270, d, true),
        ],
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

function poses(state: FacadeState) {
  return state.buildings[0]!.walls.map((item) => ({
    id: item.id,
    originX: item.originX,
    originZ: item.originZ,
    width: item.width,
    yawDeg: item.yawDeg,
    panelFlip: item.panelFlip,
  }))
}

describe('load wall pose stability', () => {
  it('outer rect: needsFit false', () => {
    const synced = syncFloorPlansFromWalls(outerRect())
    expect(buildingNeedsOuterSpineFit(synced.buildings[0]!)).toBe(false)
  })

  it('pipeline twice does not move walls', () => {
    const synced = syncFloorPlansFromWalls(outerRect())
    const a = applyFacadeLoadPipeline(synced, FACADE_SCHEMA_VERSION)
    const before = poses(a.facade)
    const b = applyFacadeLoadPipeline(a.facade, FACADE_SCHEMA_VERSION)
    expect(poses(b.facade)).toEqual(before)
  })

  it('orphans do not trigger outer-spine fit on every load', () => {
    const base = outerRect()
    for (let i = 0; i < 5; i += 1) {
      base.buildings[0]!.walls.push(wall(`orphan${i}`, 5000 + i * 200, 5000, 0, 96, true))
    }
    const synced = syncFloorPlansFromWalls(base)
    expect(buildingNeedsOuterSpineFit(synced.buildings[0]!)).toBe(false)
    const a = applyFacadeLoadPipeline(synced, FACADE_SCHEMA_VERSION)
    const before = poses(a.facade)
    const b = applyFacadeLoadPipeline(a.facade, FACADE_SCHEMA_VERSION)
    expect(poses(b.facade)).toEqual(before)
  })

  it('force fit twice is stable for outer rect', () => {
    const synced = syncFloorPlansFromWalls(outerRect())
    const a = finalizeStudioGeometry(fitStateWallsToOuterSpine(synced))
    const before = poses(a)
    const b = finalizeStudioGeometry(fitStateWallsToOuterSpine(a))
    expect(poses(b)).toEqual(before)
  })

  it('inner-origin majority gets fit once then stays put', () => {
    const w = 960
    const d = 480
    const depth = WALL_DEPTH
    const state: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 456,
          wallDepth: depth,
          walls: [
            wall('n', 0, depth, 0, w, false),
            wall('e', w - depth, 0, 90, d, false),
            wall('s', w, d - depth, 180, w, false),
            wall('w', depth, d, 270, d, false),
          ],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const synced = syncFloorPlansFromWalls(state)
    expect(buildingNeedsOuterSpineFit(synced.buildings[0]!)).toBe(true)
    const a = applyFacadeLoadPipeline(synced, FACADE_SCHEMA_VERSION)
    expect(a.facade.buildings[0]!.walls.every((item) => item.panelFlip === true)).toBe(true)
    expect(buildingNeedsOuterSpineFit(a.facade.buildings[0]!)).toBe(false)
    const before = poses(a.facade)
    const b = applyFacadeLoadPipeline(a.facade, FACADE_SCHEMA_VERSION)
    expect(poses(b.facade)).toEqual(before)
  })
})
