import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { WALL_DEPTH } from '../constants/presets'
import {
  claddingZonesForWall,
  deriveCladdingZonesFromPanel,
  openingCladdingInflateCm,
  openingCutsShell,
  resolveOpeningLayerContract,
} from './facadeLayers'
import {
  openingCutsWall,
  openingPanelClearance,
  openingShowsGlazing,
} from '../utils/openingGeometry'

function baseOpening(partial: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    type: 'window',
    x: 48,
    y: 64,
    width: 96,
    height: 128,
    ...partial,
  }
}

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
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    planLinked: true,
    panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', taperDepth: 0 },
    ...partial,
  }
}

describe('resolveOpeningLayerContract', () => {
  it('Durchbruch: Shell-Loch, kein Freiraum', () => {
    const c = resolveOpeningLayerContract(baseOpening({ fill: { mode: 'opening' } }))
    expect(c.cutsShell).toBe(true)
    expect(c.showsGlazing).toBe(true)
    expect(c.shellMaskInflateCm).toBe(0)
    expect(c.claddingMaskInflateCm).toBe(0)
    expect(openingCutsShell(baseOpening())).toBe(openingCutsWall(baseOpening()))
  })

  it('In Wand eingebettet: kein Shell-Loch, kein Glas, Attachments ok', () => {
    const o = baseOpening({
      revealFrame: { enabled: true, embedCm: 8, insetCm: 4 },
      fill: { mode: 'opening' },
    })
    const c = resolveOpeningLayerContract(o)
    expect(c.embeddedFake).toBe(true)
    expect(c.cutsShell).toBe(false)
    expect(c.showsGlazing).toBe(false)
    expect(c.attachmentsAllowed).toBe(true)
    expect(openingShowsGlazing(o)).toBe(false)
    expect(openingCutsWall(o)).toBe(false)
  })

  it('flush: kein Loch', () => {
    const o = baseOpening({ fill: { mode: 'flush' } })
    expect(resolveOpeningLayerContract(o).cutsShell).toBe(false)
  })

  it('Freiraum vergrößert nur Cladding, nie Shell-Maske', () => {
    const o = baseOpening({
      panelClearance: { enabled: true, cm: 12, finish: 'taper', depthCm: -2 },
    })
    const c = resolveOpeningLayerContract(o)
    expect(c.cutsShell).toBe(true)
    expect(c.shellMaskInflateCm).toBe(0)
    expect(c.claddingMaskInflateCm).toBe(12)
    expect(c.claddingClearanceFinish).toBe('taper')
    expect(c.claddingClearanceDepthCm).toBe(-2)
    expect(openingCladdingInflateCm(o)).toBe(openingPanelClearance(o))
  })

  it('hidden: alles aus', () => {
    const o = baseOpening({ hidden: true, panelClearance: { enabled: true, cm: 8 } })
    const c = resolveOpeningLayerContract(o)
    expect(c.cutsShell).toBe(false)
    expect(c.claddingMaskInflateCm).toBe(0)
    expect(c.attachmentsAllowed).toBe(false)
  })

  it('Cutout: kein Chrome, Attachments aus', () => {
    const o = baseOpening({ type: 'cutout', cutoutShape: 'rect', fill: { mode: 'niche' } })
    const c = resolveOpeningLayerContract(o)
    expect(c.cutsShell).toBe(true)
    expect(c.showsWindowChrome).toBe(false)
    expect(c.attachmentsAllowed).toBe(false)
  })
})

describe('claddingZones', () => {
  it('leitet bond/boss/strip aus panel ab', () => {
    expect(deriveCladdingZonesFromPanel(studioWall()).map((z) => z.kind)).toEqual(['bond'])
    expect(
      deriveCladdingZonesFromPanel(
        studioWall({ panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'strip' } }),
      )[0]!.kind,
    ).toBe('strip')
    expect(
      deriveCladdingZonesFromPanel(
        studioWall({
          panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', taperDepth: 4 },
        }),
      )[0]!.front,
    ).toBe('frustum')
  })

  it('nutzt persistierte Zonen wenn gesetzt', () => {
    const wall = studioWall({
      claddingZones: [{ id: 'z1', kind: 'taperedField', front: 'frustum' }],
    })
    expect(claddingZonesForWall(wall)).toHaveLength(1)
    expect(claddingZonesForWall(wall)[0]!.kind).toBe('taperedField')
  })
})
