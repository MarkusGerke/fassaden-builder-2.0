import { describe, expect, it } from 'vitest'
import {
  normalizeSurfaceFinish,
  surfaceFinishFromPreset,
  surfaceFinishParams,
  surfaceFinishPresetId,
  surfaceFinishWeights,
} from './surfaceFinish'

describe('surfaceFinish mix', () => {
  it('wandelt Legacy-Strings in 100%-Mix um', () => {
    expect(normalizeSurfaceFinish('matte')).toEqual({ matte: 100, glossy: 0, metal: 0 })
    expect(normalizeSurfaceFinish('glossy')).toEqual({ matte: 0, glossy: 100, metal: 0 })
    expect(normalizeSurfaceFinish('metal')).toEqual({ matte: 0, glossy: 0, metal: 100 })
  })

  it('mischt Presets gewichtet', () => {
    const params = surfaceFinishParams({ matte: 50, glossy: 50, metal: 0 })
    const matte = surfaceFinishParams(surfaceFinishFromPreset('matte'))
    const glossy = surfaceFinishParams(surfaceFinishFromPreset('glossy'))
    expect(params.roughness).toBeCloseTo((matte.roughness + glossy.roughness) / 2, 5)
    expect(params.metalness).toBeCloseTo((matte.metalness + glossy.metalness) / 2, 5)
  })

  it('bei Summe 0 fällt auf Stumpf zurück', () => {
    expect(surfaceFinishWeights({ matte: 0, glossy: 0, metal: 0 })).toEqual({
      matte: 1,
      glossy: 0,
      metal: 0,
    })
  })

  it('Preset-ID folgt dem stärksten Anteil', () => {
    expect(surfaceFinishPresetId({ matte: 20, glossy: 10, metal: 70 })).toBe('metal')
    expect(surfaceFinishPresetId({ matte: 40, glossy: 60, metal: 0 })).toBe('glossy')
  })
})
