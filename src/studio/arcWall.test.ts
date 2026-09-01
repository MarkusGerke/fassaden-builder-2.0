import { describe, expect, it } from 'vitest'
import { arcOuterBulgeZ, partialEllipseArcLength } from './arcWall'

describe('arcWall curve', () => {
  it('Scheitel hat sichtbare Wölbung (nicht flach)', () => {
    const W = 192
    const D = 144
    const arcLength = partialEllipseArcLength(W / 2, D, Math.PI)
    const wall = {
      width: arcLength,
      depth: 32,
      panelFlip: true,
      arcBay: { frontWidthCm: W, depthCm: D, inward: false },
    }
    const midZ = arcOuterBulgeZ(wall, arcLength / 2)
    const endZ = arcOuterBulgeZ(wall, 0)
    expect(Math.abs(midZ)).toBeGreaterThan(D * 0.85)
    expect(Math.abs(endZ)).toBeLessThan(1)
    expect(Math.abs(midZ - endZ)).toBeGreaterThan(100)
  })
})
