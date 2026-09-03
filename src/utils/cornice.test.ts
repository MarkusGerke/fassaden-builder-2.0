import { describe, expect, it } from 'vitest'
import type { EditorState, FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { traufgesims110x135Profile, traufgesims70x150Profile } from '../profiles/uploadedSilhouettes'
import { editWallTargets } from '../studio/editScope'
import {
  corniceScaleFromHeightCm,
  updateWallCornice,
  updateWallCorniceHeightCm,
  wallCornice,
} from './cornice'
import { getWall } from './walls'

function studioWall(id: string, yawDeg: number, y = 0): Wall {
  return {
    id,
    kind: 'studio',
    x: 0,
    y,
    width: 384,
    height: 456,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

function stateOf(walls: Wall[]): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus 1',
        walls,
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

function nativeHeight(profileId: string): number {
  const profile =
    profileId === 'traufgesims110x135' ? traufgesims110x135Profile : traufgesims70x150Profile
  return Math.max(...profile.section.map((point) => point.outward), 1)
}

describe('updateWallCorniceHeightCm — Etage-Scope', () => {
  it('setzt bei gleichem Profil denselben scale auf Wände mit unterschiedlichem Ausgangswert', () => {
    const north = studioWall('north', 0)
    const east = studioWall('east', 90)
    north.cornice = { enabled: true, edge: 'top', scale: 1, profileId: 'traufgesims70x150' }
    east.cornice = { enabled: true, edge: 'top', scale: 2.5, profileId: 'traufgesims70x150' }
    const base = stateOf([north, east])

    const editor: EditorState = {
      selectedWallIds: ['north'],
      selectedOpenings: [],
      selectedEdges: [],
    }
    const targets = editWallTargets(base, editor, 'floor')
    expect(targets.sort()).toEqual(['east', 'north'])

    const heightCm = 24
    const next = updateWallCorniceHeightCm(base, targets, heightCm, nativeHeight)
    const expectedScale = corniceScaleFromHeightCm(heightCm, nativeHeight('traufgesims70x150'))
    expect(wallCornice(getWall(next, 'north')!).scale).toBe(expectedScale)
    expect(wallCornice(getWall(next, 'east')!).scale).toBe(expectedScale)
  })

  it('liefert bei unterschiedlichen Profilen dieselbe sichtbare Höhe in cm', () => {
    const north = studioWall('north', 0)
    const east = studioWall('east', 90)
    north.cornice = { enabled: true, edge: 'top', scale: 1, profileId: 'traufgesims70x150' }
    east.cornice = { enabled: true, edge: 'top', scale: 3, profileId: 'traufgesims110x135' }
    const base = stateOf([north, east])
    const heightCm = 24

    const next = updateWallCorniceHeightCm(
      base,
      ['north', 'east'],
      heightCm,
      nativeHeight,
    )

    for (const id of ['north', 'east'] as const) {
      const cornice = wallCornice(getWall(next, id)!)
      const native = nativeHeight(cornice.profileId!)
      expect(Math.round((cornice.scale ?? 0) * native)).toBe(heightCm)
    }
  })
})

describe('updateWallCornice — uniform patch (Regression)', () => {
  it('schreibt scale 1:1 auf alle Ziel-IDs', () => {
    const north = studioWall('north', 0)
    const east = studioWall('east', 90)
    north.cornice = { enabled: true, edge: 'top', scale: 1, profileId: 'traufgesims70x150' }
    east.cornice = { enabled: true, edge: 'top', scale: 4, profileId: 'traufgesims70x150' }
    const next = updateWallCornice(stateOf([north, east]), ['north', 'east'], { scale: 1.75 })
    expect(wallCornice(getWall(next, 'north')!).scale).toBe(1.75)
    expect(wallCornice(getWall(next, 'east')!).scale).toBe(1.75)
  })
})
