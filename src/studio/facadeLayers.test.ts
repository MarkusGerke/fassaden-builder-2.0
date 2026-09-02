import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { WALL_DEPTH } from '../constants/presets'
import {
  claddingZonesForWall,
  clipTilesToZoneRect,
  deriveCladdingZonesFromPanel,
  openingCladdingInflateCm,
  openingCutsShell,
  resolveOpeningLayerContract,
  applyTwoHorizontalCladdingZones,
  buildTwoHorizontalCladdingZones,
  clearPersistedCladdingZones,
  clampCladdingSplitY,
  claddingZoneAtY,
  defaultUpperBandWidth,
  effectivePanelAtY,
  isTwoHorizontalBandCladding,
  readTwoHorizontalBandOptions,
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

  it('clippt Kacheln auf Zonen-Rechteck', () => {
    const tiles = [
      { x: 0, y: 0, width: 100, height: 32 },
      { x: 0, y: 100, width: 100, height: 32 },
    ]
    const clipped = clipTilesToZoneRect(tiles, {
      id: 'z',
      kind: 'bond',
      front: 'flat',
      rect: { x: 0, y: 80, width: 384, height: 80 },
    })
    expect(clipped).toHaveLength(1)
    expect(clipped[0]!.y).toBe(100)
    expect(clipped[0]!.height).toBe(32)
  })

  it('baut zwei Horizontal-Bänder und liest sie zurück', () => {
    const wall = studioWall({
      height: 256,
      width: 384,
      panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', panelWidth: 48, plinthEnabled: false },
    })
    const withBands = applyTwoHorizontalCladdingZones(wall, {
      splitYCm: 128,
      lowerPanelWidth: 48,
      upperPanelWidth: 24,
    })
    expect(isTwoHorizontalBandCladding(withBands)).toBe(true)
    const zones = claddingZonesForWall(withBands)
    expect(zones).toHaveLength(2)
    expect(zones[0]!.id).toBe('band-lower')
    expect(zones[0]!.rect).toEqual({ x: 0, y: 0, width: 384, height: 128 })
    expect(zones[0]!.panel?.panelWidth).toBe(48)
    expect(zones[1]!.rect).toEqual({ x: 0, y: 128, width: 384, height: 128 })
    expect(zones[1]!.panel?.panelWidth).toBe(24)
    expect(readTwoHorizontalBandOptions(withBands)).toEqual({
      splitYCm: 128,
      lowerPanelWidth: 48,
      upperPanelWidth: 24,
    })
    expect(clearPersistedCladdingZones(withBands).claddingZones).toBeUndefined()
  })

  it('passt Band-Rects nach Wandhöhen-Änderung an', () => {
    const base = applyTwoHorizontalCladdingZones(
      studioWall({
        height: 256,
        width: 200,
        panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', panelWidth: 48 },
      }),
      { splitYCm: 128, lowerPanelWidth: 48, upperPanelWidth: 24 },
    )
    const taller = { ...base, height: 320, width: 240 }
    const zones = claddingZonesForWall(taller)
    expect(zones[0]!.rect?.width).toBe(240)
    expect(zones[0]!.rect?.height).toBe(128)
    expect(zones[1]!.rect?.y).toBe(128)
    expect(zones[1]!.rect?.height).toBe(192)
  })

  it('klammert Split und Default-Oberbreite', () => {
    expect(clampCladdingSplitY(3, 256)).toBe(8)
    expect(clampCladdingSplitY(250, 256)).toBe(248)
    expect(defaultUpperBandWidth(48)).toBe(24)
    expect(buildTwoHorizontalCladdingZones(studioWall({ height: 200 }), {
      splitYCm: 100,
      lowerPanelWidth: 32,
      upperPanelWidth: 16,
    })).toHaveLength(2)
  })

  it('claddingZoneAtY / effectivePanelAtY wählt das Band', () => {
    const withBands = applyTwoHorizontalCladdingZones(
      studioWall({
        height: 256,
        width: 384,
        panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'runningBond', panelWidth: 48, plinthEnabled: false },
      }),
      { splitYCm: 128, lowerPanelWidth: 48, upperPanelWidth: 24 },
    )
    expect(claddingZoneAtY(withBands, 40)?.id).toBe('band-lower')
    expect(claddingZoneAtY(withBands, 200)?.id).toBe('band-upper')
    expect(effectivePanelAtY(withBands, 40).panelWidth).toBe(48)
    expect(effectivePanelAtY(withBands, 200).panelWidth).toBe(24)
    const plain = studioWall({ panel: { ...DEFAULT_STUDIO_PANEL, panelWidth: 32 } })
    expect(effectivePanelAtY(plain, 100).panelWidth).toBe(32)
  })
})
