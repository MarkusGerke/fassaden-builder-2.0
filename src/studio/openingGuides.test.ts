import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { computeOpeningDistanceLines } from './openingGuides'

function studioWall(id: string, originX: number, width: number, openings: Opening[] = []): Wall {
  return {
    id,
    kind: 'studio',
    x: originX,
    y: 0,
    width,
    height: 456,
    depth: WALL_DEPTH,
    originX,
    originZ: 0,
    yawDeg: 0,
    openings,
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    planLinked: true,
  }
}

function opening(id: string, x: number, y: number, width = 96, height = 192): Opening {
  return {
    id,
    type: 'window',
    x,
    y,
    width,
    height,
  }
}

describe('computeOpeningDistanceLines', () => {
  it('misst Abstände zur Wandkante, wenn keine Nachbarn da sind', () => {
    const wall = studioWall('w', 0, 480, [opening('o1', 192, 96, 96, 192)])
    const lines = computeOpeningDistanceLines(wall, wall.openings[0], [wall])
    expect(lines.find((l) => l.direction === 'left')?.distanceCm).toBe(192)
    expect(lines.find((l) => l.direction === 'right')?.distanceCm).toBe(192)
    expect(lines.find((l) => l.direction === 'bottom')?.distanceCm).toBe(96)
    expect(lines.find((l) => l.direction === 'top')?.distanceCm).toBe(168)
  })

  it('misst horizontalen Abstand zwischen zwei Öffnungen', () => {
    const wall = studioWall('w', 0, 480, [
      opening('o1', 96, 96),
      opening('o2', 288, 96),
    ])
    const lines = computeOpeningDistanceLines(wall, wall.openings[0], [wall])
    expect(lines.find((l) => l.direction === 'right')?.distanceCm).toBe(96)
  })

  it('misst vertikalen Abstand zwischen zwei Öffnungen', () => {
    const wall = studioWall('w', 0, 480, [
      opening('o1', 96, 96, 96, 96),
      opening('o2', 96, 256, 96, 96),
    ])
    const lines = computeOpeningDistanceLines(wall, wall.openings[0], [wall])
    expect(lines.find((l) => l.direction === 'top')?.distanceCm).toBe(64)
  })

  it('ignoriert Abstände unter 1 cm', () => {
    const wall = studioWall('w', 0, 96, [opening('o1', 0, 0, 96, 96)])
    const lines = computeOpeningDistanceLines(wall, wall.openings[0], [wall])
    expect(lines.find((l) => l.direction === 'left')).toBeUndefined()
    expect(lines.find((l) => l.direction === 'bottom')).toBeUndefined()
  })
})
