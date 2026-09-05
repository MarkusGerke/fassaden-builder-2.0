import { describe, expect, it } from 'vitest'
import type { FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { centeredOpeningX, anchoredOpeningX, resetOpenings, resolveOuterSillLayout, updateOpening, createOpening, defaultOuterSillDepth } from './openings'
import { STUDIO_MASONRY, DEFAULT_STUDIO_PANEL } from '../studio/constants'
import { WALL_DEPTH } from '../constants/presets'

function studioWall(openings: Opening[]): Wall {
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
    openings,
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

function facadeWithOpening(opening: Opening): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus 1',
        walls: [studioWall([opening])],
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('centeredOpeningX', () => {
  it('hält die Mitte bei Breitenänderung (+16 cm → je 8 cm links/rechts)', () => {
    const opening = { x: 96, width: 96 } as Opening
    const newWidth = 112
    const newX = centeredOpeningX(opening, newWidth, STUDIO_MASONRY)
    expect(newX).toBe(88)
    expect(newX + newWidth / 2).toBe(opening.x + opening.width / 2)
  })

  it('hält die Mitte bei +8 cm (je 4 cm, nicht am 8er-Raster kleben)', () => {
    const opening = { x: 96, width: 96 } as Opening
    const newWidth = 104
    const newX = centeredOpeningX(opening, newWidth, STUDIO_MASONRY)
    expect(newX).toBe(92)
    expect(newX + newWidth / 2).toBe(opening.x + opening.width / 2)
  })

  it('hält die Mitte beim Verkleinern (−8 cm)', () => {
    const opening = { x: 96, width: 96 } as Opening
    const newWidth = 88
    const newX = centeredOpeningX(opening, newWidth, STUDIO_MASONRY)
    expect(newX).toBe(100)
    expect(newX + newWidth / 2).toBe(opening.x + opening.width / 2)
  })
})

describe('anchoredOpeningX', () => {
  it('nach rechts: linke Kante bleibt', () => {
    const opening = { x: 96, width: 96 }
    expect(anchoredOpeningX(opening, 112, 'right', STUDIO_MASONRY)).toBe(96)
  })

  it('nach links: rechte Kante bleibt', () => {
    const opening = { x: 96, width: 96 }
    expect(anchoredOpeningX(opening, 112, 'left', STUDIO_MASONRY)).toBe(80)
  })
})

describe('updateOpening width centering via commit path', () => {
  it('verschiebt x mit, wenn Breite über Patch geändert wird', () => {
    const opening: Opening = {
      id: 'win-1',
      type: 'window',
      x: 128,
      y: 96,
      width: 96,
      height: 192,
    }
    const state = facadeWithOpening(opening)
    const newWidth = 128
    const next = updateOpening(state, 'wall-1', 'win-1', { width: newWidth })
    const updated = next.buildings[0]!.walls[0]!.openings[0]!
    expect(updated.width).toBe(newWidth)
    expect(updated.x).toBe(112)
    expect(updated.x + updated.width / 2).toBe(opening.x + opening.width / 2)
  })

  it('hält die Mitte bei +8 cm ohne explizites x', () => {
    const opening: Opening = {
      id: 'win-1',
      type: 'window',
      x: 128,
      y: 96,
      width: 96,
      height: 192,
    }
    const next = updateOpening(facadeWithOpening(opening), 'wall-1', 'win-1', { width: 104 })
    const updated = next.buildings[0]!.walls[0]!.openings[0]!
    expect(updated.width).toBe(104)
    // Idealmitte 124; Clamp ohne Modulverband snapt auf 8er-Raster → 120 oder 128
    expect([120, 128]).toContain(updated.x)
    expect(Math.abs(updated.x + updated.width / 2 - (opening.x + opening.width / 2))).toBeLessThanOrEqual(4)
  })
})

describe('resetOpenings', () => {
  it('behält Lage und Größe, entfernt Profil und Verdachung', () => {
    const opening: Opening = {
      id: 'win-1',
      type: 'window',
      x: 128,
      y: 96,
      width: 96,
      height: 192,
      pediment: { enabled: true, form: 'straight', profileId: 'fensterprofil40x140' },
    }
    const state = facadeWithOpening(opening)
    state.buildings[0]!.walls[0]!.profiles = [
      { openingId: 'win-1', profileId: 'fensterprofil40x140', edge: 'top' },
    ]
    const next = resetOpenings(state, [{ wallId: 'wall-1', openingId: 'win-1' }])
    const wall = next.buildings[0]!.walls[0]!
    const updated = wall.openings[0]!
    expect(updated.id).toBe('win-1')
    expect(updated.x).toBe(128)
    expect(updated.y).toBe(96)
    expect(updated.width).toBe(96)
    expect(updated.pediment?.enabled).toBe(false)
    expect(wall.profiles).toHaveLength(0)
  })
})

describe('resolveOuterSillLayout', () => {
  it('setzt die Oberkante auf die Öffnungs-Unterkante', () => {
    const layout = resolveOuterSillLayout(
      { id: 'w', type: 'window', x: 48, y: 128, width: 96, height: 160 },
      { enabled: true, mode: 'board', thickness: 4, overhang: 16, depth: 32 },
    )
    expect(layout.yTop).toBe(128)
    expect(layout.yBottom).toBe(124)
  })
})

describe('defaultOuterSillDepth', () => {
  it('ist 16 cm Vorstand, unabhängig von Paneel- oder Wandtiefe', () => {
    expect(
      defaultOuterSillDepth({
        depth: 32,
        panel: { ...DEFAULT_STUDIO_PANEL, projectDepth: 4, taperDepth: 0, enabled: true },
      }),
    ).toBe(16)
    expect(defaultOuterSillDepth({ depth: 24, panel: { enabled: false, projectDepth: 4 } })).toBe(16)
  })

  it('createOpening setzt die Außenbank auf 16 cm', () => {
    const created = createOpening('window', 96, 192, {
      width: 384,
      height: 456,
      depth: WALL_DEPTH,
      kind: 'studio',
      panel: { ...DEFAULT_STUDIO_PANEL },
    })
    expect(created.sillOuter?.depth).toBe(16)
  })

  it('übernimmt Stile vorhandener Öffnungen gleichen Typs', () => {
    const existing: Opening = {
      id: 'win-1',
      type: 'window',
      x: 32,
      y: 96,
      width: 96,
      height: 160,
      frameColor: '#112233',
      glassColor: '#445566',
    }
    const created = createOpening('window', 80, 128, {
      width: 384,
      height: 456,
      depth: WALL_DEPTH,
      kind: 'studio',
      panel: { ...DEFAULT_STUDIO_PANEL },
      openings: [existing],
    })
    expect(created.id).not.toBe('win-1')
    expect(created.x).not.toBe(32)
    expect(created.frameColor).toBe('#112233')
    expect(created.glassColor).toBe('#445566')
  })

  it('fällt auf andere Öffnungstypen derselben Wand zurück', () => {
    const door: Opening = {
      id: 'door-1',
      type: 'door',
      x: 0,
      y: 0,
      width: 96,
      height: 224,
      frameColor: '#99aabb',
      glassColor: '#ccddee',
    }
    const created = createOpening('window', 80, 128, {
      width: 384,
      height: 456,
      depth: WALL_DEPTH,
      kind: 'studio',
      panel: { ...DEFAULT_STUDIO_PANEL },
      openings: [door],
    })
    expect(created.frameColor).toBe('#99aabb')
    expect(created.glassColor).toBe('#ccddee')
  })

  it('fällt auf Öffnungen anderer Hauswände zurück', () => {
    const donor: Opening = {
      id: 'win-other',
      type: 'window',
      x: 16,
      y: 96,
      width: 80,
      height: 128,
      frameColor: '#010203',
    }
    const created = createOpening(
      'window',
      80,
      128,
      {
        width: 384,
        height: 456,
        depth: WALL_DEPTH,
        kind: 'studio',
        panel: { ...DEFAULT_STUDIO_PANEL },
        openings: [],
      },
      undefined,
      { donorWalls: [{ openings: [donor] }] },
    )
    expect(created.frameColor).toBe('#010203')
  })
})
