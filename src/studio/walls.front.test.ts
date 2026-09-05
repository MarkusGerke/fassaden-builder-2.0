import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { createDefaultFacadeState } from '../types/facade'
import { updateActiveBuilding } from '../utils/buildings'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { alignOpeningElementsToWallFront, leafOpenSignForWall, outerSillBoardPose, unifyGroupFrontOrientation, studioPanelFaceLocalZ, studioProfileAnchorLocalZ, PROFILE_FACE_BIAS_CM } from '../studio/walls'

function studioWall(overrides: Partial<Wall> = {}): Wall {
  return {
    id: 'w1',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 192,
    height: 456,
    depth: 32,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    panelFlip: true,
    openings: [
      {
        id: 'o1',
        type: 'window',
        width: 96,
        height: 192,
        x: 48,
        y: 128,
        sillInner: { enabled: true, depth: 16, thickness: 4, flipForward: true },
        sillOuter: { enabled: true, mode: 'board', depth: 32, thickness: 4, flipForward: true },
      },
    ],
    profiles: [],
    neighbors: { start: null, end: null },
    buildingId: 'b1',
    ...overrides,
  } as Wall
}

describe('alignOpeningElementsToWallFront', () => {
  it('setzt flipForward der Bänke passend zu panelFlip', () => {
    const wall = studioWall({ panelFlip: true })
    const aligned = alignOpeningElementsToWallFront(wall)
    expect(aligned.openings[0]?.sillInner?.flipForward).toBe(false)
    expect(aligned.openings[0]?.sillOuter?.flipForward).toBe(false)
  })
})

describe('unifyGroupFrontOrientation', () => {
  it('gleicht panelFlip in der Baugruppe bei gleicher Yaw ab', () => {
    const base = createDefaultFacadeState()
    const state: FacadeState = updateActiveBuilding(base, {
      walls: [
        studioWall({ id: 'a', groupId: 'g1', panelFlip: true }),
        studioWall({ id: 'b', groupId: 'g1', panelFlip: false, originX: 192, x: 192 }),
      ],
    })
    const next = unifyGroupFrontOrientation(state, 'a')
    const walls = next.buildings[0]!.walls
    expect(walls.find((w) => w.id === 'b')?.panelFlip).toBe(true)
  })

  it('lässt Erker-Schenkel unangetastet (Außenseite ist geometrisch festgelegt)', () => {
    // Regression v2.0.224: Beim 90°-Erker kippte die Vereinheitlichung einen Schenkel
    // nach innen (schwarze Wand, Sockel/Paneele im Erker-Inneren).
    const base = createDefaultFacadeState()
    const state: FacadeState = updateActiveBuilding(base, {
      walls: [
        studioWall({
          id: 'front',
          groupId: 'g1',
          panelFlip: true,
          bayRole: 'front',
          bayWindow: { frontWidthCm: 288, depthCm: 192, shape: 'rect' },
        }),
        studioWall({ id: 'left', groupId: 'g1', panelFlip: true, yawDeg: 90, bayRole: 'side', bayParentId: 'front' }),
        studioWall({ id: 'right', groupId: 'g1', panelFlip: false, yawDeg: 90, originX: 288, x: 288, bayRole: 'side', bayParentId: 'front' }),
      ],
    })
    const next = unifyGroupFrontOrientation(state, 'left')
    const walls = next.buildings[0]!.walls
    expect(walls.find((w) => w.id === 'right')?.panelFlip).toBe(false)
    expect(walls.find((w) => w.id === 'left')?.panelFlip).toBe(true)
  })
})

describe('leafOpenSignForWall', () => {
  it('dreht Flügel bei panelFlip ins Zimmer (positiver Winkel = innen)', () => {
    expect(leafOpenSignForWall(studioWall({ panelFlip: true }))).toBe(1)
    expect(leafOpenSignForWall(studioWall({ panelFlip: false }))).toBe(-1)
  })
})

describe('outerSillBoardPose', () => {
  it('setzt den Pivot an die Wandaußenkante und die Platte nach außen', () => {
    const flipped = outerSillBoardPose(studioWall({ panelFlip: true, depth: 32 }), 32)
    expect(flipped.localZ).toBe(0)
    expect(flipped.translateZ).toBe(-16)
    expect(flipped.tiltX).toBe(-1)

    const withPanel = outerSillBoardPose(
      studioWall({
        panelFlip: true,
        depth: 32,
        panel: { ...DEFAULT_STUDIO_PANEL, projectDepth: 8 },
      }),
      32,
    )
    expect(withPanel.localZ).toBe(-8)

    const unflipped = outerSillBoardPose(studioWall({ panelFlip: false, depth: 32 }), 32)
    expect(unflipped.localZ).toBe(32)
    expect(unflipped.translateZ).toBe(16)
    expect(unflipped.tiltX).toBe(1)
  })
})

describe('studioProfileAnchorLocalZ', () => {
  it('sitzt vor der Paneelfläche (kein Z-Fight der Profil-Rückseite)', () => {
    const wall = studioWall({
      panelFlip: true,
      depth: 32,
      panel: { ...DEFAULT_STUDIO_PANEL, projectDepth: 8 },
    })
    const face = studioPanelFaceLocalZ(wall)
    const anchor = studioProfileAnchorLocalZ(wall, -4)
    // panelFlip: außen = negativ; Bias weiter nach außen (kleineres Z)
    expect(anchor).toBeLessThan(face - 1e-6)
    expect(face - anchor).toBeCloseTo(PROFILE_FACE_BIAS_CM, 5)
  })
})
