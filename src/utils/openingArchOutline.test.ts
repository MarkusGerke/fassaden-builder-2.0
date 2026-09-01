import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import { openingArchOutline, openingCutsWall } from './openingGeometry'

function pointedOpening(overrides: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    type: 'window',
    x: 40,
    y: 60,
    width: 120,
    height: 200,
    arch: { enabled: true, form: 'pointed' },
    ...overrides,
  }
}

describe('openingArchOutline', () => {
  it('liefert eine Spitzbogen-Krone auch bei Fake-Einbettung (kein Wandloch)', () => {
    const opening = pointedOpening({
      revealFrame: { enabled: true },
    })
    expect(openingCutsWall(opening)).toBe(false)
    const outline = openingArchOutline(opening)
    expect(outline).not.toBeNull()
    expect(outline!.length).toBeGreaterThan(8)
    const mid = outline![Math.floor(outline!.length / 2)]!
    const left = outline![0]!
    const right = outline![outline!.length - 1]!
    expect(mid.y).toBeGreaterThan(left.y)
    expect(mid.y).toBeGreaterThan(right.y)
  })

  it('bleibt null bei eckiger Öffnung', () => {
    const opening = pointedOpening({ arch: { enabled: false, form: 'rect' } })
    expect(openingArchOutline(opening)).toBeNull()
  })
})
