import { describe, expect, it } from 'vitest'
import type { Opening, OpeningStairs } from '../types/facade'
import { layoutStairTreads, stairLandingDepth, syncStairsToDoorWidth } from './stairs'

function doorOpening(width = 96): Opening {
  return {
    id: 'door-1',
    type: 'door',
    x: 64,
    y: 48,
    width,
    height: 208,
  }
}

function stairs(overrides: Partial<OpeningStairs> = {}): OpeningStairs {
  return syncStairsToDoorWidth(
    {
      enabled: true,
      count: 3,
      rise: 16,
      tread: 32,
      ...overrides,
    },
    doorOpening(),
  )
}

describe('stair landing depth', () => {
  it('verschiebt untere Stufen wenn Podesttiefe vom Auftritt abweicht', () => {
    const opening = { ...doorOpening(), y: 48 }
    const treads = layoutStairTreads(opening, stairs({ landingDepth: 48, tread: 32 }))
    expect(treads[0]?.depth).toBe(48)
    expect(treads[0]?.zOut).toBe(0)
    expect(treads[1]?.zOut).toBe(48)
    expect(treads[1]?.depth).toBe(32)
    expect(treads[2]?.zOut).toBe(80)
  })

  it('fehlende Podesttiefe folgt dem Auftritt', () => {
    expect(stairLandingDepth(stairs({ tread: 40 }))).toBe(40)
  })

  it('normalisiert Podesttiefe auf 8er-Raster', () => {
    const normalized = syncStairsToDoorWidth({ enabled: true, count: 2, landingDepth: 50 }, doorOpening())
    expect(normalized.landingDepth).toBe(48)
  })
})
