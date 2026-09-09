import { describe, it, expect } from 'vitest'
import { WALL_DEPTH, WALL_HEIGHT, UPPER_STOREY_WALL_DEPTH } from '../constants/presets'
import { createStudioWall } from './walls'
import { insertBayAsWallSegment, bayHostWall } from './baySegment'
import { BAY_WINDOW_PRESETS, BAY_WALL_DEPTH_CM } from './bayWindow'
import { insertStoreyAbove } from '../utils/walls'
import type { FacadeState, Wall } from '../types/facade'

describe('Wandstärken EG/OG/Erker', () => {
  it('Erker bleibt 24 cm nach finalize; OG-Klon 24 cm', () => {
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'eg',
      width: 576,
      height: WALL_HEIGHT,
      depth: WALL_DEPTH,
      panelFlip: true,
      planLinked: true,
    }
    let state: FacadeState = {
      buildings: [{
        id: 'b1', name: 'Haus', wallHeight: WALL_HEIGHT, wallDepth: WALL_DEPTH,
        walls: [wall], floors: [{ nodes: [], edges: [] }],
      }],
      activeBuildingId: 'b1',
    } as FacadeState
    state = insertStoreyAbove(state, 0, { copyOpenings: false })
    const og = state.buildings[0]!.walls.filter(w => (w.y ?? 0) >= WALL_HEIGHT - 1)
    expect(og.length).toBeGreaterThan(0)
    expect(og.every(w => w.depth === UPPER_STOREY_WALL_DEPTH)).toBe(true)

    const ogWall = og.find(w => w.width >= 576)!
    const preset = BAY_WINDOW_PRESETS.find(p => p.id === 'bay-f192-d96-rect')!
    const inserted = insertBayAsWallSegment(state, ogWall.id, preset, 288, { singleFloor: true })!
    const host = bayHostWall(inserted.state.buildings[0]!.walls, inserted.bayWallIds[0]!)!
    const bayWalls = inserted.state.buildings[0]!.walls.filter(w => host.bayWindow!.wallIds.includes(w.id))
    expect(bayWalls.every(w => w.depth === BAY_WALL_DEPTH_CM)).toBe(true)
    expect(bayWalls.some(w => w.bayRole === 'front')).toBe(true)
  })
})
