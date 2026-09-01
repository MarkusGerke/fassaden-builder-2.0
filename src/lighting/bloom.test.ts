import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BLOOM_SETTINGS,
  bloomToneMappingExposure,
  normalizeBloomSettings,
} from './bloom'

describe('bloom settings', () => {
  it('erlaubt stärkeren Bloom als v0.7.260', () => {
    const next = normalizeBloomSettings({
      enabled: true,
      strength: 0.25,
      radius: 0.9,
      threshold: 0.75,
      exposure: 1.4,
    })
    expect(next.strength).toBe(0.25)
    expect(next.radius).toBe(0.9)
    expect(next.threshold).toBe(0.75)
    expect(next.exposure).toBe(1.4)
  })

  it('klemmt extreme Alt-Werte', () => {
    const next = normalizeBloomSettings({
      enabled: true,
      strength: 3,
      radius: 1.5,
      threshold: -0.2,
      exposure: 2.5,
    })
    expect(next.strength).toBe(1.5)
    expect(next.radius).toBe(1)
    expect(next.threshold).toBe(0)
    expect(next.exposure).toBe(1.45)
  })

  it('Belichtung kubisch — Mittelweg zwischen ^2 und ^4', () => {
    expect(bloomToneMappingExposure(1)).toBe(1)
    expect(bloomToneMappingExposure(DEFAULT_BLOOM_SETTINGS.exposure)).toBeCloseTo(1.39, 1)
    expect(bloomToneMappingExposure(1.4)).toBeGreaterThan(2.5)
  })
})
