import { describe, expect, it } from 'vitest'
import { createGlassMaterial } from './threeColors'

describe('Glas für Licht-Glühen', () => {
  it('schreibt keine Tiefe — Scheiben okkludieren Punktlicht-Marker nicht', () => {
    const clear = createGlassMaterial('#ffffff')
    expect(clear.depthWrite).toBe(false)
    const physical = createGlassMaterial({
      mode: 'physical',
      color: '#8ec4dc',
      transmission: 0.92,
      thickness: 0.8,
      roughness: 0.06,
      ior: 1.5,
    })
    expect(physical.depthWrite).toBe(false)
  })

  it('Klarglas filtert Licht nicht (Transmission ohne Absorption)', () => {
    const clear = createGlassMaterial('transparent')
    expect(clear.transmission).toBeGreaterThan(0.9)
    expect(clear.attenuationDistance).toBe(Infinity)
    expect(clear.attenuationColor.getHexString()).toBe('ffffff')
  })
})
