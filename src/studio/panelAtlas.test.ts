import { describe, expect, it } from 'vitest'
import { panelAtlasStripRanges } from './panelAtlas'

describe('panelAtlasStripRanges', () => {
  it('keeps short walls as a single strip', () => {
    const ranges = panelAtlasStripRanges(400)
    expect(ranges).toEqual([{ startCm: 0, lengthCm: 400 }])
  })

  it('splits very long walls so each strip stays under the atlas budget', () => {
    const ranges = panelAtlasStripRanges(5000)
    expect(ranges.length).toBeGreaterThan(1)
    expect(ranges[0]?.startCm).toBe(0)
    const total = ranges.reduce((sum, r) => sum + r.lengthCm, 0)
    expect(total).toBeCloseTo(5000, 5)
    for (const range of ranges) {
      // 2048px / 2px/cm = 1024cm max span at MIN_PX_PER_CM
      expect(range.lengthCm).toBeLessThanOrEqual(1024 + 0.01)
    }
    const last = ranges.at(-1)!
    expect(last.startCm + last.lengthCm).toBeCloseTo(5000, 5)
  })
})
