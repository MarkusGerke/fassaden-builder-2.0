import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState, cloneWall } from '../types/facade'
import {
  addWallAwning,
  removeWallAwning,
  updateOpeningAwning,
  updateWallAwning,
  wallAwnings,
} from './awnings'
import { hydrateOpening, hydrateWall } from './hydrate'

describe('awnings CRUD', () => {
  it('adds and removes wall awnings', () => {
    let state = createDefaultFacadeState()
    const wallId = state.buildings[0]!.walls[0]!.id
    const { state: next, awningId } = addWallAwning(state, wallId, {
      enabled: true,
      kind: 'foldingArm',
    })
    state = next
    expect(wallAwnings(state.buildings[0]!.walls[0]!).length).toBe(1)
    expect(wallAwnings(state.buildings[0]!.walls[0]!)[0]!.id).toBe(awningId)

    state = updateWallAwning(state, [wallId], { extension: 0.2 }, awningId)
    expect(wallAwnings(state.buildings[0]!.walls[0]!)[0]!.extension).toBe(0.2)

    state = removeWallAwning(state, wallId, awningId)
    expect(wallAwnings(state.buildings[0]!.walls[0]!).length).toBe(0)
  })

  it('updates opening awning and sets width when enabling', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const opening = wall.openings[0]
    if (!opening) {
      // Minimal opening for test
      wall.openings.push({
        id: 'op-1',
        type: 'window',
        x: 48,
        y: 128,
        width: 96,
        height: 192,
      })
    }
    const op = state.buildings[0]!.walls[0]!.openings[0]!
    state = {
      ...state,
      buildings: state.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) => (w.id === wall.id ? cloneWall({ ...w, openings: [op] }) : w)),
      })),
    }
    const wallId = wall.id
    state = updateOpeningAwning(
      state,
      [{ wallId, openingId: op.id }],
      { enabled: true, kind: 'dropArm' },
    )
    const nextOp = state.buildings[0]!.walls.find((w) => w.id === wallId)!.openings[0]!
    expect(nextOp.awning?.enabled).toBe(true)
    expect(nextOp.awning?.kind).toBe('dropArm')
    expect(nextOp.awning?.widthCm).toBeGreaterThanOrEqual(op.width)
  })
})

describe('hydrate awning', () => {
  it('fills missing awning on window without enabling', () => {
    const opening = hydrateOpening({
      id: 'a',
      type: 'window',
      x: 0,
      y: 128,
      width: 96,
      height: 192,
    })
    expect(opening.awning?.enabled).toBe(false)
    expect(opening.awning?.id).toBeTruthy()
  })

  it('fills empty awnings list on wall', () => {
    const wall = hydrateWall({
      id: 'w',
      kind: 'studio',
      x: 0,
      y: 0,
      width: 384,
      height: 384,
      depth: 24,
      openings: [],
      profiles: [],
      neighbors: {},
    })
    expect(wall.awnings).toEqual([])
  })
})
