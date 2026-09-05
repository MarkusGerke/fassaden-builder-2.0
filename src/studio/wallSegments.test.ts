import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { createOpening } from '../utils/openings'
import {
  applyWallPresetToSegment,
  inferWallSegmentLayout,
  wallSegmentIndexAt,
} from './wallSegments'
import { updateActiveBuilding } from '../utils/buildings'
import type { FacadeState } from '../types/facade'

function wall(partial: Partial<Wall> & { id: string; width: number }): Wall {
  return {
    x: 0,
    y: 0,
    height: 320,
    depth: WALL_DEPTH,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    kind: 'studio',
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    panelFlip: true,
    ...partial,
  }
}

function stateWithWall(item: Wall): FacadeState {
  return updateActiveBuilding(
    {
      buildings: [
        {
          id: 'b1',
          name: 'Test',
          walls: [item],
          wallHeight: 320,
          wallDepth: WALL_DEPTH,
          floors: [{ nodes: [], edges: [] }],
          groups: [],
        },
      ],
      activeBuildingId: 'b1',
    } as FacadeState,
    (b) => ({ ...b, walls: [item] }),
  )
}

describe('inferWallSegmentLayout', () => {
  it('teilt 576 cm in drei 192-cm-Bänder', () => {
    const layout = inferWallSegmentLayout(wall({ id: 'w1', width: 576 }), 192)
    expect(layout).toEqual([
      { startCm: 0, lengthCm: 192 },
      { startCm: 192, lengthCm: 192 },
      { startCm: 384, lengthCm: 192 },
    ])
  })

  it('letztes Band kann kürzer sein', () => {
    const layout = inferWallSegmentLayout(wall({ id: 'w1', width: 240 }), 192)
    expect(layout).toEqual([
      { startCm: 0, lengthCm: 192 },
      { startCm: 192, lengthCm: 48 },
    ])
  })
})

describe('wallSegmentIndexAt', () => {
  const layout = inferWallSegmentLayout(wall({ id: 'w1', width: 576 }), 192)

  it('findet mittleres Segment', () => {
    expect(wallSegmentIndexAt(200, layout)).toBe(1)
  })
})

describe('applyWallPresetToSegment', () => {
  it('ersetzt Öffnung nur im gewählten Band', () => {
    const base = wall({ id: 'w1', width: 384 })
    const withWindow = {
      ...base,
      openings: [
        createOpening('window', 96, 192, base, { x: 48 }),
        createOpening('window', 96, 192, base, { x: 240 }),
      ],
    }
    const state = stateWithWall(withWindow)
    const layout = inferWallSegmentLayout(withWindow, 192)
    const next = applyWallPresetToSegment(state, 'w1', 1, 'wall-192', layout)
    expect(next).not.toBeNull()
    const result = next!.buildings[0]!.walls[0]!
    expect(result.width).toBe(384)
    expect(result.openings).toHaveLength(1)
    expect(result.openings[0]!.x).toBeCloseTo(48, 0)
  })

  it('setzt Fenster in leeres Band', () => {
    const base = wall({ id: 'w1', width: 192 })
    const state = stateWithWall(base)
    const layout = inferWallSegmentLayout(base, 192)
    // Wand+Öffnung-Presets sind aus der Bibliothek entfernt; reine Längen-Presets leeren Öffnungen im Band.
    const next = applyWallPresetToSegment(state, 'w1', 0, 'wall-192', layout)
    const result = next!.buildings[0]!.walls[0]!
    expect(result.width).toBe(192)
    expect(result.openings).toHaveLength(0)
  })
})
