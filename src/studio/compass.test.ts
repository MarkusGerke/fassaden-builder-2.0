import { describe, expect, it } from 'vitest'
import { wallDockAxisFromFacadeYaw } from './compass'
import { viewerSideToAlongSign } from './walls'
import type { Wall } from '../types/facade'

function studioWall(yawDeg: number): Wall {
  return {
    id: 'w',
    x: 0,
    y: 0,
    width: 192,
    height: 456,
    depth: 32,
    yawDeg,
    originX: 0,
    originZ: 0,
    kind: 'studio',
    openings: [],
    profiles: [],
    neighbors: {},
    buildingId: 'b',
  }
}

describe('wallDockAxisFromFacadeYaw', () => {
  it('ordnet N/S der x-Achse und W/O der z-Achse zu', () => {
    expect(wallDockAxisFromFacadeYaw(0)).toBe('x')
    expect(wallDockAxisFromFacadeYaw(180)).toBe('x')
    expect(wallDockAxisFromFacadeYaw(90)).toBe('z')
    expect(wallDockAxisFromFacadeYaw(270)).toBe('z')
  })
})

describe('viewerSideToAlongSign', () => {
  it('wand entlang +X: von Süden links = +X, rechts = −X', () => {
    const wall = studioWall(0)
    const fromSouth = { x: -1, z: 0 }
    expect(viewerSideToAlongSign(wall, 'left', fromSouth.x, fromSouth.z)).toBe(1)
    expect(viewerSideToAlongSign(wall, 'right', fromSouth.x, fromSouth.z)).toBe(-1)
  })

  it('wand entlang +X: von Norden links = −X, rechts = +X', () => {
    const wall = studioWall(0)
    const fromNorth = { x: 1, z: 0 }
    expect(viewerSideToAlongSign(wall, 'left', fromNorth.x, fromNorth.z)).toBe(-1)
    expect(viewerSideToAlongSign(wall, 'right', fromNorth.x, fromNorth.z)).toBe(1)
  })

  it('wand entlang −Z (yaw 90): viewerRight = Osten → links/rechts entlang der Wand', () => {
    const wall = studioWall(90)
    const viewerEast = { x: 0, z: 1 }
    expect(viewerSideToAlongSign(wall, 'left', viewerEast.x, viewerEast.z)).toBe(1)
    expect(viewerSideToAlongSign(wall, 'right', viewerEast.x, viewerEast.z)).toBe(-1)
  })
})
