import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { OPENING_DRAG_FLOAT_CM, WALL_DEPTH } from '../constants/presets'
import { studioFacadeSelectionLocalZ } from '../studio/walls'
import {
  labelWorldDeltaFromStates,
  openingDragFloatLocalZ,
  openingWorldDeltaFromStates,
  trimBandWorldDeltaFromStates,
  wallLocalDeltaToWorld,
  wallWorldDeltaFromStates,
} from './liveDrag'

function studioWall(over: Partial<Wall> = {}): Wall {
  return {
    id: 'w1',
    kind: 'studio',
    buildingId: 'b1',
    x: 0,
    y: 0,
    width: 400,
    height: 456,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    ...over,
  }
}

function stateWithWall(wall: Wall): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'b1',
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        walls: [wall],
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('wallLocalDeltaToWorld', () => {
  it('mappt bei Yaw 0 lokales X auf Welt-X und Y auf Welt-Y', () => {
    const delta = wallLocalDeltaToWorld(studioWall(), 24, 16)
    expect(delta.x).toBeCloseTo(24)
    expect(delta.y).toBeCloseTo(16)
    expect(delta.z).toBeCloseTo(0)
  })

  it('dreht lokales X bei Yaw 90° auf −Z', () => {
    const delta = wallLocalDeltaToWorld(studioWall({ yawDeg: 90 }), 24, 8)
    expect(delta.x).toBeCloseTo(0)
    expect(delta.y).toBeCloseTo(8)
    expect(delta.z).toBeCloseTo(-24)
  })
})

describe('openingWorldDeltaFromStates', () => {
  it('liefert den Welt-Offset zwischen Start- und Zielposition', () => {
    const opening = {
      id: 'o1',
      type: 'window' as const,
      x: 80,
      y: 120,
      width: 64,
      height: 96,
    }
    const base = stateWithWall(studioWall({ openings: [opening] }))
    const next = stateWithWall(studioWall({ openings: [{ ...opening, x: 104, y: 136 }] }))
    const delta = openingWorldDeltaFromStates(base, next, { wallId: 'w1', openingId: 'o1' })
    expect(delta.x).toBeCloseTo(24)
    expect(delta.y).toBeCloseTo(16)
    expect(delta.z).toBeCloseTo(0)
  })
})

describe('openingDragFloatLocalZ', () => {
  it('liegt auf der Fassadenaußenfläche + Abstand', () => {
    expect(openingDragFloatLocalZ(studioWall({ panelFlip: false }))).toBe(
      studioFacadeSelectionLocalZ(studioWall({ panelFlip: false }), OPENING_DRAG_FLOAT_CM),
    )
    expect(openingDragFloatLocalZ(studioWall({ panelFlip: true }))).toBe(
      studioFacadeSelectionLocalZ(studioWall({ panelFlip: true }), OPENING_DRAG_FLOAT_CM),
    )
  })
})

describe('wallWorldDeltaFromStates', () => {
  it('folgt originX/originZ der Studio-Wand', () => {
    const base = stateWithWall(studioWall({ originX: 0, originZ: 0 }))
    const next = stateWithWall(studioWall({ originX: 48, originZ: -24, x: 48 }))
    const delta = wallWorldDeltaFromStates(base, next, 'w1')
    expect(delta.x).toBeCloseTo(48)
    expect(delta.y).toBeCloseTo(0)
    expect(delta.z).toBeCloseTo(-24)
  })
})

describe('trimBandWorldDeltaFromStates', () => {
  it('verschiebt nur in Wand-Y', () => {
    const band = { id: 'tb1', yFromBottom: 200, enabled: true }
    const base = stateWithWall(studioWall({ trimBands: [band] }))
    const next = stateWithWall(studioWall({ trimBands: [{ ...band, yFromBottom: 232 }] }))
    const delta = trimBandWorldDeltaFromStates(base, next, 'w1', 'tb1')
    expect(delta.x).toBeCloseTo(0)
    expect(delta.y).toBeCloseTo(32)
    expect(delta.z).toBeCloseTo(0)
  })
})

describe('labelWorldDeltaFromStates', () => {
  it('folgt Label-x/y in Wand-Lokal', () => {
    const base = stateWithWall(studioWall({ label: { enabled: true, text: 'A', x: 100, y: 300 } }))
    const next = stateWithWall(studioWall({ label: { enabled: true, text: 'A', x: 116, y: 284 } }))
    const delta = labelWorldDeltaFromStates(base, next, 'w1')
    expect(delta.x).toBeCloseTo(16)
    expect(delta.y).toBeCloseTo(-16)
    expect(delta.z).toBeCloseTo(0)
  })
})
