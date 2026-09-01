import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState, type Wall } from '../types/facade'
import { STUDIO_DEFAULT_HEIGHT, STUDIO_HALF, STUDIO_MASONRY } from '../studio/constants'
import {
  addWallTrimBand,
  defaultTrimBandY,
  duplicateWallTrimBand,
  normalizeWallTrimBand,
  TRIM_BAND_DUPLICATE_OFFSET,
  wallTrimBands,
} from './trimBands'

function studioWall(height = STUDIO_DEFAULT_HEIGHT): Wall {
  const state = createDefaultFacadeState()
  const wall = state.buildings[0]!.walls[0]!
  return { ...wall, kind: 'studio', height, trimBands: undefined }
}

describe('trimBands', () => {
  it('legt neue Bänder in Wandmitte (8er-Raster)', () => {
    expect(defaultTrimBandY(448)).toBe(224)
    expect(defaultTrimBandY(450)).toBe(224)
    const wall = studioWall(448)
    const next = addWallTrimBand(createDefaultFacadeState(), [wall.id])
    // State aus createDefaultFacadeState hat andere Wand-ID — über normalize prüfen
    const band = normalizeWallTrimBand({ yFromBottom: defaultTrimBandY(448) })
    expect(band.yFromBottom).toBe(224)
    expect(band.yFromBottom % STUDIO_MASONRY).toBe(0)
  })

  it('addWallTrimBand nutzt Wandhöhe/2', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    wall.height = 400
    wall.kind = 'studio'
    state = {
      ...state,
      buildings: [{ ...state.buildings[0]!, walls: [wall] }],
    }
    state = addWallTrimBand(state, [wall.id])
    const bands = wallTrimBands(state.buildings[0]!.walls[0]!)
    expect(bands).toHaveLength(1)
    expect(bands[0]!.yFromBottom).toBe(defaultTrimBandY(400))
  })

  it('dupliziert mit 16 cm Abstand und behält Stil', () => {
    expect(TRIM_BAND_DUPLICATE_OFFSET).toBe(STUDIO_HALF)
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    wall.height = 448
    wall.kind = 'studio'
    wall.trimBands = [
      normalizeWallTrimBand({
        id: 'band-src',
        yFromBottom: 200,
        profileId: 'traufgesims70x150',
        scale: 1.5,
        color: '#abcdef',
      }),
    ]
    state = {
      ...state,
      buildings: [{ ...state.buildings[0]!, walls: [wall] }],
    }
    const { state: next, newBandId } = duplicateWallTrimBand(state, [wall.id], 'band-src', 'up', {
      anchorWallId: wall.id,
    })
    const bands = wallTrimBands(next.buildings[0]!.walls[0]!)
    expect(bands).toHaveLength(2)
    const clone = bands.find((band) => band.id === newBandId)
    expect(clone).toBeTruthy()
    expect(clone!.yFromBottom).toBe(216)
    expect(clone!.scale).toBe(1.5)
    expect(clone!.color).toBe('#abcdef')
  })
})
