import { describe, expect, it } from 'vitest'
import { createOuterSillBoardGeometry } from './sillGeometry'

describe('createOuterSillBoardGeometry', () => {
  it('lässt die wandseitige Fläche weg (5 statt 6 Faces)', () => {
    const flipped = createOuterSillBoardGeometry(128, 4, 16, -8, -1)
    expect(flipped.getIndex()?.count).toBe(30)
    const unflipped = createOuterSillBoardGeometry(128, 4, 16, 8, 1)
    expect(unflipped.getIndex()?.count).toBe(30)
  })
})
