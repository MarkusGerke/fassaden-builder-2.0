import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, WALL_DEPTH } from '../studio/constants'
import { applyTwoHorizontalCladdingZones } from '../studio/facadeLayers'
import {
  applyPanelStyleToWall,
  draftFromWallStyle,
} from './styleTemplates'

function studioWall(partial: Partial<Wall> = {}): Wall {
  return {
    id: 'w1',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 384,
    height: 256,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    buildingId: 'b1',
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    planLinked: true,
    panel: {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond',
      panelWidth: 48,
      panelHeight: 8,
      plinthEnabled: false,
      plinthHeight: 0,
    },
    ...partial,
  }
}

describe('styleTemplates claddingZones', () => {
  it('Roundtrip: draft speichert und apply stellt Zwei-Bänder wieder her', () => {
    const source = applyTwoHorizontalCladdingZones(studioWall(), {
      splitYCm: 128,
      lowerPanelWidth: 48,
      upperPanelWidth: 24,
    })
    const draft = draftFromWallStyle(source)
    expect(draft.claddingZones).toHaveLength(2)
    expect(draft.claddingZones?.[0]?.id).toBe('band-lower')
    expect(draft.panel?.panelWidth).toBe(48)

    const target = studioWall({
      id: 'target',
      panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', panelWidth: 32 },
    })
    const applied = applyPanelStyleToWall(target, draft)
    expect(applied.panel?.panelWidth).toBe(48)
    expect(applied.claddingZones).toHaveLength(2)
    expect(applied.claddingZones?.[1]?.panel?.panelWidth).toBe(24)
  })

  it('ohne Zonen: apply löscht bestehende claddingZones', () => {
    const withBands = applyTwoHorizontalCladdingZones(studioWall(), {
      splitYCm: 128,
      lowerPanelWidth: 48,
      upperPanelWidth: 24,
    })
    const plainDraft = draftFromWallStyle(studioWall({ claddingZones: undefined }))
    expect(plainDraft.claddingZones).toBeUndefined()
    const cleared = applyPanelStyleToWall(withBands, plainDraft)
    expect(cleared.claddingZones).toBeUndefined()
  })
})
