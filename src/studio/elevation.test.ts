import { describe, expect, it } from 'vitest'
import { facadeSunIsGrazing } from './elevation'

describe('facadeSunIsGrazing', () => {
  it('Ost bei Südsonne: Streiflicht', () => {
    expect(facadeSunIsGrazing(270, 180)).toBe(true)
  })

  it('West bei Südsonne: Streiflicht', () => {
    expect(facadeSunIsGrazing(90, 180)).toBe(true)
  })

  it('Nord bei Südsonne: nicht streifend (Werfschatten behalten)', () => {
    expect(facadeSunIsGrazing(0, 180)).toBe(false)
  })

  it('Süd bei Südsonne: frontal, nicht streifend', () => {
    expect(facadeSunIsGrazing(180, 180)).toBe(false)
  })

  it('Ost bei Ostsonne: frontal', () => {
    expect(facadeSunIsGrazing(270, 90)).toBe(false)
  })
})
