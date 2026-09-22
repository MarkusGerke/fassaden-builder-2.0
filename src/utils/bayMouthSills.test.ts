import { describe, expect, it } from 'vitest'
import { emptyNeighbors, type FacadeState, type Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { createStudioWall } from '../studio/walls'
import { insertBayAsWallSegment } from '../studio/baySegment'
import { BAY_WINDOW_PRESETS } from '../studio/bayWindow'
import { createOpening, openingOuterSillConflictsBayMouth } from './openings'
import { bayMouthLocalXGapsForWall } from './profilePaths'

function stateWithWall(wall: Wall): FacadeState {
  const tagged = { ...wall, buildingId: 'b1' }
  return {
    buildings: [
      {
        id: 'b1',
        name: 'B',
        wallHeight: 448,
        wallDepth: WALL_DEPTH,
        walls: [tagged],
        floors: [{ nodes: [], edges: [] }],
        groups: [],
      },
    ],
    activeBuildingId: 'b1',
    neighbors: emptyNeighbors(),
  }
}

describe('bayMouthLocalXGapsForWall', () => {
  it('Restwand am Mund: Öffnungs-X, nicht zentriert — Bank am Mund greift', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f192-d96-rect')!
    const host: Wall = {
      ...createStudioWall(0, 0),
      id: 'host',
      width: 576,
      height: 448,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
      openings: [],
    }
    host.openings = [createOpening('window', 96, 192, host, { x: 96, y: 128 })]
    const inserted = insertBayAsWallSegment(stateWithWall(host), 'host', preset, 288, {
      singleFloor: true,
    })
    expect(inserted).not.toBeNull()
    const walls = inserted!.state.buildings[0]!.walls
    const remnant = walls.find(
      (w) => !w.bayRole && !w.bayWindow && (w.originX ?? w.x) < 50 && w.openings.length > 0,
    )
    expect(remnant).toBeTruthy()
    const gaps = bayMouthLocalXGapsForWall(inserted!.state, remnant!)
    expect(gaps.some((g) => g.x0 >= remnant!.width - 1)).toBe(true)
    const win = remnant!.openings[0]!
    expect(openingOuterSillConflictsBayMouth(win, win.sillOuter, gaps)).toBe(true)
  })
})
