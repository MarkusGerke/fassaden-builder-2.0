import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import {
  buildingDepthOffsetFromFacadeDepthCm,
  buildingFacadeDepthCm,
  depthOffsetFromFacadeDepthCm,
  openingFacadeDepthCm,
  openingUsesCustomDepth,
} from './openingDepth'

function opening(partial: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    type: 'window',
    x: 0,
    y: 96,
    width: 96,
    height: 128,
    ...partial,
  } as Opening
}

describe('openingFacadeDepthCm', () => {
  it('Standard ohne Override: 32 cm (Laibung 24 + Default-Offset 8)', () => {
    expect(openingFacadeDepthCm(opening())).toBe(32)
  })

  it('mit Gebäude-Offset 0: 24 cm', () => {
    expect(openingFacadeDepthCm(opening(), 0)).toBe(24)
  })

  it('mit depthOffset +4: 28 cm', () => {
    expect(openingFacadeDepthCm(opening({ depthOffset: 4 }), 0)).toBe(28)
  })

  it('mit Gebäude-Default +6', () => {
    expect(openingFacadeDepthCm(opening(), 6)).toBe(30)
  })
})

describe('depthOffsetFromFacadeDepthCm', () => {
  it('roundtrip bei 24 cm', () => {
    const o = opening()
    const offset = depthOffsetFromFacadeDepthCm(24, o)
    expect(openingFacadeDepthCm(opening({ depthOffset: offset }))).toBe(24)
  })
})

describe('buildingFacadeDepthCm', () => {
  it('mappt Offset auf Frontlage', () => {
    expect(buildingFacadeDepthCm(8)).toBe(32)
    expect(buildingDepthOffsetFromFacadeDepthCm(32)).toBe(8)
  })

  it('ohne Offset: Default 32 cm', () => {
    expect(buildingFacadeDepthCm(undefined)).toBe(32)
  })
})

describe('openingUsesCustomDepth', () => {
  it('false ohne Feld', () => {
    expect(openingUsesCustomDepth(opening())).toBe(false)
  })
  it('true mit depthOffset', () => {
    expect(openingUsesCustomDepth(opening({ depthOffset: 0 }))).toBe(true)
  })
})
