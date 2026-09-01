import { describe, expect, it } from 'vitest'
import { snapDelta8Way } from './grid'

describe('snapDelta8Way', () => {
  it('snappt auf 45°/90° in 48-cm-Schritten', () => {
    expect(snapDelta8Way(40, 0, 48, true)).toEqual({ dx: 48, dz: 0 })
    const up = snapDelta8Way(0, 40, 48, true)
    expect(up.dx).toBeCloseTo(0, 5)
    expect(up.dz).toBe(48)
    const diag = snapDelta8Way(40, 40, 48, true)
    expect(diag.dx).toBeCloseTo(48 / Math.SQRT2, 1)
    expect(diag.dz).toBeCloseTo(48 / Math.SQRT2, 1)
    expect(snapDelta8Way(10, 10, 48, true)).toEqual({ dx: 0, dz: 0 })
  })

  it('lässt kontinuierliche Werte ohne Snap durch', () => {
    expect(snapDelta8Way(17, 23, 45, false)).toEqual({ dx: 17, dz: 23 })
  })
})
