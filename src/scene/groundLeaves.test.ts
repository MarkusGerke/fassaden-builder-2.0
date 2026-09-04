import { describe, expect, it } from 'vitest'
import {
  MAX_GROUND_LEAVES,
  appendGroundLeaves,
  clearGroundLeaves,
  createLeafClump,
  createLeafScatter,
  createRandomLeaf,
  normalizeGroundLeaf,
  normalizeGroundLeaves,
} from './groundLeaves'
import type { FacadeState } from '../types/facade'

function emptyState(leaves: unknown = undefined): FacadeState {
  return {
    buildings: [],
    activeBuildingId: 'b1',
    groundLeaves: leaves as FacadeState['groundLeaves'],
  }
}

describe('groundLeaves', () => {
  it('normalize füllt Defaults und clamp', () => {
    const leaf = normalizeGroundLeaf({ id: 'a', shape: 9, scale: 99, color: '#abc' })
    expect(leaf.id).toBe('a')
    expect(leaf.shape).toBe(0)
    expect(leaf.scale).toBe(2.5)
    expect(leaf.color).toBe('#AABBCC')
  })

  it('createLeafClump erzeugt mehrere Blätter um den Punkt', () => {
    const clump = createLeafClump(100, 200, 10, 40, () => 0.5)
    expect(clump).toHaveLength(10)
    for (const leaf of clump) {
      expect(Math.hypot(leaf.x - 100, leaf.z - 200)).toBeLessThanOrEqual(40.01)
    }
  })

  it('appendGroundLeaves respektiert MAX_GROUND_LEAVES', () => {
    const existing = Array.from({ length: MAX_GROUND_LEAVES - 2 }, (_, i) =>
      createRandomLeaf(i, 0, () => 0.2),
    )
    const state = emptyState(existing)
    const next = appendGroundLeaves(state, createLeafClump(0, 0, 20))
    expect(normalizeGroundLeaves(next.groundLeaves)).toHaveLength(MAX_GROUND_LEAVES)
  })

  it('createLeafScatter respektiert Restkapazität', () => {
    const added = createLeafScatter(0, 0, 100, 100, 50, MAX_GROUND_LEAVES - 5)
    expect(added).toHaveLength(5)
  })

  it('clearGroundLeaves leert das Array', () => {
    const state = emptyState([createRandomLeaf(1, 2)])
    expect(clearGroundLeaves(state).groundLeaves).toEqual([])
  })
})
