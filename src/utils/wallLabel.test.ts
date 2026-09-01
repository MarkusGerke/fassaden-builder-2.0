import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { hydrateWall } from './hydrate'
import { facadeStateDiffersOnlyByWallLabels, normalizeWallLabel, placeTrimBandOnTopBareBand, placeWallLabelOnTopBareBand, suggestWallLabelAnchor, topBareBandForLabel, updateWallLabel, wallHasLabel, defaultWallLabelAnchor } from './wallLabel'
import { WALL_DEPTH } from '../constants/presets'
import { clampFacadeState } from './walls'
import { DEFAULT_STUDIO_PANEL } from '../studio/constants'

function studioWall(): Wall {
  return {
    id: 'wall-1',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 384,
    height: 456,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

describe('wallLabel', () => {
  it('hydriert Alt-Wand mit neutralem Label-Feld', () => {
    const hydrated = hydrateWall(studioWall())
    expect(hydrated.label).toBeDefined()
    expect(hydrated.label?.enabled).toBe(false)
    expect(hydrated.label?.depth).toBe('flat')
  })

  it('aktiviert Beschriftung mit Text', () => {
    const state: FacadeState = {
      buildings: [{ id: 'b1', name: 'Haus', walls: [studioWall()], wallHeight: 456, wallDepth: WALL_DEPTH, floors: [{ nodes: [], edges: [] }] }],
      activeBuildingId: 'b1',
    }
    const next = updateWallLabel(state, ['wall-1'], {
      enabled: true,
      text: '12a',
      x: 192,
      y: 224,
      depth: 'extruded',
      extrudeCm: 6,
      offsetForward: -3.5,
    })
    const wall = next.buildings[0]!.walls[0]!
    expect(wallHasLabel(wall)).toBe(true)
    expect(normalizeWallLabel(wall.label, wall).extrudeCm).toBe(6)
    expect(normalizeWallLabel(wall.label, wall).offsetForward).toBe(-3.5)
  })

  it('erlaubt negativen Schrift-Vorstand und clampt Extremwerte', () => {
    expect(normalizeWallLabel({ offsetForward: -12 }).offsetForward).toBe(-12)
    expect(normalizeWallLabel({ offsetForward: -999 }).offsetForward).toBe(-80)
    expect(normalizeWallLabel({ offsetForward: 999 }).offsetForward).toBe(80)
  })

  it('erkennt reine Label-Änderungen für leichten Rebuild', () => {
    const base = clampFacadeState({
      buildings: [{ id: 'b1', name: 'Haus', walls: [studioWall()], wallHeight: 456, wallDepth: WALL_DEPTH, floors: [{ nodes: [], edges: [] }] }],
      activeBuildingId: 'b1',
    })
    const next = clampFacadeState(updateWallLabel(base, ['wall-1'], { enabled: true, text: 'A' }))
    expect(facadeStateDiffersOnlyByWallLabels(base, next)).toBe(true)
    const other = {
      ...next,
      buildings: next.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) => ({ ...w, width: w.width + 8 })),
      })),
    }
    expect(facadeStateDiffersOnlyByWallLabels(base, other)).toBe(false)
  })

  it('schlägt einen Anker auf der Wandfläche vor, nicht in der Tür', () => {
    const wall = studioWall()
    wall.width = 944
    wall.height = 544
    wall.panel = { ...DEFAULT_STUDIO_PANEL, enabled: true, pattern: 'headerBond', plinthEnabled: true, plinthHeight: 64 }
    wall.openings = [
      { id: 'door', type: 'door', x: 424, y: 48, width: 144, height: 320 },
      { id: 'w1', type: 'window', x: 160, y: 160, width: 144, height: 192 },
      { id: 'w2', type: 'window', x: 680, y: 160, width: 144, height: 192 },
    ]
    const anchor = suggestWallLabelAnchor(wall)
    const inDoor = anchor.x >= 424 && anchor.x <= 568 && anchor.y >= 48 && anchor.y + 32 <= 368
    expect(inDoor).toBe(false)
    expect(anchor.y).toBeGreaterThanOrEqual(64)
    expect(anchor.y).toBeLessThan(480)
  })

  it('legt einen Anker in der Tür beim Hydrate auf das Mauerwerk', () => {
    const wall = studioWall()
    wall.width = 944
    wall.height = 544
    wall.panel = { ...DEFAULT_STUDIO_PANEL, enabled: true, pattern: 'headerBond', plinthEnabled: true, plinthHeight: 64 }
    wall.openings = [
      { id: 'door', type: 'door', x: 424, y: 48, width: 144, height: 320 },
    ]
    wall.label = {
      enabled: true,
      text: 'Test',
      x: 472,
      y: 224,
      heightCm: 32,
      depth: 'extruded',
    }
    const hydrated = hydrateWall(wall)
    const inDoor =
      (hydrated.label?.x ?? 0) >= 424 &&
      (hydrated.label?.x ?? 0) <= 568 &&
      (hydrated.label?.y ?? 0) >= 48 &&
      (hydrated.label?.y ?? 0) <= 368
    expect(inDoor).toBe(false)
    expect(hydrated.label?.x).not.toBe(472)
  })

  it('defaultWallLabelAnchor: Mitte, Oberkante 64 cm unter Wandoberkante', () => {
    const wall = studioWall()
    wall.height = 320
    wall.width = 384
    const anchor = defaultWallLabelAnchor(wall, 48)
    expect(anchor.x).toBe(192)
    expect(anchor.y).toBe(320 - 64 - 48)
  })

  it('setzt die Schrift im Freistreifen zentriert mit 64 cm Abstand von oben', () => {
    const wall = studioWall()
    wall.height = 320
    wall.panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      pattern: 'strip',
      panelHeight: 32,
      hideRowsTop: 1,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    wall.label = {
      enabled: true,
      text: 'Haus',
      x: 100,
      y: 40,
      heightCm: 64,
    }
    const band = topBareBandForLabel(wall)
    expect(band).not.toBeNull()
    const placed = placeWallLabelOnTopBareBand(wall)
    expect(placed).not.toBeNull()
    expect(placed!.x).toBe(wall.width / 2)
    expect(placed!.y).toBe(wall.height - 64 - 64)
    expect(placed!.align).toBe('center')
  })

  it('verschiebt Zierbänder in den oberen Freistreifen', () => {
    const wall = studioWall()
    wall.height = 320
    wall.panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      pattern: 'strip',
      panelHeight: 32,
      hideRowsTop: 2,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    wall.trimBands = [{ id: 'band-1', enabled: true, yFromBottom: 300, profileId: 'traufgesims70x150' }]
    const placed = placeTrimBandOnTopBareBand(wall, wall.trimBands[0])
    expect(placed).not.toBeNull()
    expect(placed!.yFromBottom).toBeGreaterThanOrEqual(256)
    expect(placed!.yFromBottom).toBeLessThanOrEqual(320)
  })
})
