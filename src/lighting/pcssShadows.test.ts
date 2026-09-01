import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  disablePcssShadows,
  enablePcssShadows,
  isPcssShadowsEnabled,
  PCSS_NUM_SAMPLES,
  pcssLightSizeUvFromSoftness,
  pcssLightWorldSizeFromSoftness,
} from './pcssShadows'

describe('pcssShadows', () => {
  it('mappt Weichheit 0,5…8 auf wachsende Lichtfläche in cm', () => {
    expect(pcssLightWorldSizeFromSoftness(0.5)).toBeCloseTo(0.8, 5)
    expect(pcssLightWorldSizeFromSoftness(8)).toBeCloseTo(28, 5)
    expect(pcssLightWorldSizeFromSoftness(2.5)).toBeGreaterThan(0.8)
    expect(pcssLightWorldSizeFromSoftness(2.5)).toBeLessThan(28)
  })

  it('berechnet LIGHT_SIZE_UV aus Frustum-Breite', () => {
    const uv = pcssLightSizeUvFromSoftness(4, 4000)
    expect(uv).toBeCloseTo(pcssLightWorldSizeFromSoftness(4) / 4000, 8)
  })

  it('aktiviert und deaktiviert den ShaderChunk-Override', () => {
    const original = THREE.ShaderChunk.shadowmap_pars_fragment
    enablePcssShadows()
    expect(isPcssShadowsEnabled()).toBe(true)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('pcssGetShadow')
    disablePcssShadows()
    expect(isPcssShadowsEnabled()).toBe(false)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(original)
  })

  it('nutzt ausreichend PCSS-Samples gegen sichtbares Poisson-Raster', () => {
    expect(PCSS_NUM_SAMPLES).toBeGreaterThanOrEqual(25)
  })
})
