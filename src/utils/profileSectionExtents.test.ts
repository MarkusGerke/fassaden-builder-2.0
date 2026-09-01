import { describe, expect, it } from 'vitest'
import { trimOutwardExtentCm, trimSectionScales } from './profileSectionExtents'

describe('profileSectionExtents', () => {
  const section = [
    { outward: 0, forward: 0 },
    { outward: 10, forward: 4 },
    { outward: 8, forward: 6 },
  ]

  it('skaliert per Faktor wenn keine cm-Maße gesetzt sind', () => {
    expect(trimSectionScales({ scale: 2 }, section)).toEqual({ outward: 2, forward: 2 })
  })

  it('nutzt absolute cm für Höhe und Tiefe', () => {
    expect(trimSectionScales({ scale: 1, extentOutCm: 20, extentForwardCm: 12 }, section)).toEqual({
      outward: 2,
      forward: 2,
    })
  })

  it('liefert Outward-Höhe für Verdachungs-Lift', () => {
    expect(trimOutwardExtentCm({ extentOutCm: 14 }, section)).toBe(14)
    expect(trimOutwardExtentCm({ scale: 1.5 }, section)).toBe(15)
  })
})
