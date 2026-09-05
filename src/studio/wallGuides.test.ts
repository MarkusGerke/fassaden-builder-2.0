import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { createStudioWall } from './walls'
import {
  snapBranchLengthToWallEdges,
  snapPointToWallEdges,
  WALL_GUIDE_SNAP_CM,
} from './wallGuides'

function studio(partial: Partial<Wall> & { id: string }): Wall {
  return {
    ...createStudioWall(0, 0),
    ...partial,
    kind: 'studio',
    planLinked: false,
  } as Wall
}

describe('snapPointToWallEdges', () => {
  it('snappt auf Endpunkt einer unverbundenen Wand', () => {
    const a = studio({
      id: 'a',
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      width: 192,
    })
    const hit = snapPointToWallEdges({ x: 192 + WALL_GUIDE_SNAP_CM - 0.5, z: 1 }, [a])
    expect(hit.point.x).toBeCloseTo(192)
    expect(hit.guides.length).toBeGreaterThan(0)
  })
})

describe('snapBranchLengthToWallEdges', () => {
  it('schließt Lücke zu bündiger, unverbundener Wand exakt', () => {
    const target = studio({
      id: 'b',
      originX: 288,
      originZ: 0,
      yawDeg: 0,
      width: 96,
    })
    // Von (0,0) nach +X; Zielkante bei 288, Maus bei ~284
    const snap = snapBranchLengthToWallEdges(
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      284,
      [target],
    )
    expect(snap).not.toBeNull()
    expect(snap!.lengthCm).toBeCloseTo(288)
  })
})
