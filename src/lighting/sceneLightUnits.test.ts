import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POWER_WATTS,
  LED_LUMENS_PER_WATT,
  markerGlowBrightness,
  normalizePowerWatts,
  threeIntensityToWatts,
  wattsToThreeIntensity,
} from './sceneLightUnits'

describe('sceneLightUnits', () => {
  it('rechnet Watt in Three.js-Intensität mit cm-Skalierung', () => {
    const tenW = wattsToThreeIntensity(10)
    const lumens = 10 * LED_LUMENS_PER_WATT
    const expected = (lumens / (4 * Math.PI)) * 10_000
    expect(tenW).toBeCloseTo(expected, 0)
    expect(tenW).toBeGreaterThan(500_000)
  })

  it('migriert Legacy-Intensität zurück in Watt', () => {
    const legacy = wattsToThreeIntensity(8)
    expect(normalizePowerWatts(legacy)).toBe(8)
    expect(threeIntensityToWatts(legacy)).toBeCloseTo(8, 0)
  })

  it('behält Watt-Werte im UI-Bereich', () => {
    expect(normalizePowerWatts(12)).toBe(12)
    expect(normalizePowerWatts(0)).toBe(0)
    expect(normalizePowerWatts(200)).toBe(150)
  })

  it('begrenzt Marker-Helligkeit für sattes Farbglühen', () => {
    expect(markerGlowBrightness(DEFAULT_POWER_WATTS)).toBeLessThanOrEqual(2)
    expect(markerGlowBrightness(150)).toBeLessThanOrEqual(2)
    expect(markerGlowBrightness(12, true)).toBeLessThanOrEqual(2.4)
  })
})
