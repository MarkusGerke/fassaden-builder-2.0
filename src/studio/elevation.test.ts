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

  it('Nord morgens (Sept. ~09:00): Werfschatten — kein Streiflicht', () => {
    expect(facadeSunIsGrazing(0, 118)).toBe(false)
    expect(facadeSunIsGrazing(180, 118)).toBe(false)
  })

  it('Nord nachmittags (Sept. ~15:12): Werfschatten — kein Streiflicht', () => {
    expect(facadeSunIsGrazing(0, 242)).toBe(false)
    expect(facadeSunIsGrazing(180, 242)).toBe(false)
  })

  it('Ost/West bei Südsonne: weiterhin Streiflicht (Paneel-Acne)', () => {
    expect(facadeSunIsGrazing(270, 178)).toBe(true)
    expect(facadeSunIsGrazing(90, 182)).toBe(true)
  })
})
