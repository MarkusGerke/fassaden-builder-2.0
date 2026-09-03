import { describe, expect, it } from 'vitest'
import type { EditorState, FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { editArchOpeningTargets, editOpeningTargets, editWallTargets, openingsMatchByType } from './editScope'

function wall(
  id: string,
  yawDeg: number,
  y: number,
  openings: Opening[],
): Wall {
  return {
    id,
    kind: 'studio',
    x: 0,
    y,
    width: 384,
    height: 456,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg,
    openings,
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

function opening(id: string, type: Opening['type'], x = 32, width = 96, height = 192): Opening {
  return { id, type, x, y: type === 'door' ? 0 : 96, width, height }
}

function stateOf(walls: Wall[]): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus 1',
        walls,
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

function editorWith(opening: { wallId: string; openingId: string }): EditorState {
  return {
    selectedWallIds: [],
    selectedOpenings: [opening],
    selectedEdges: [],
  }
}

describe('openingsMatchByType', () => {
  it('trifft nur den Typ, nicht Maße oder Keller', () => {
    const a = opening('a', 'window', 0, 96, 160)
    const b = opening('b', 'window', 48, 128, 192)
    const door = opening('d', 'door')
    expect(openingsMatchByType(a, b)).toBe(true)
    expect(openingsMatchByType(a, door)).toBe(false)
  })
})

describe('editOpeningTargets', () => {
  const northWin = opening('n1', 'window', 32, 96, 160)
  const northWin2 = opening('n2', 'window', 160, 128, 192)
  const northDoor = opening('nd', 'door')
  const eastWin = opening('e1', 'window')
  const upperWin = opening('u1', 'window')
  const walls = [
    wall('north', 0, 0, [northWin, northWin2, northDoor]),
    wall('east', 90, 0, [eastWin]),
    wall('north-1', 0, 456, [upperWin]),
  ]
  const facade = stateOf(walls)

  it('Auswahl: nur markierte Öffnung', () => {
    const refs = editOpeningTargets(facade, editorWith({ wallId: 'north', openingId: 'n1' }), 'element')
    expect(refs).toEqual([{ wallId: 'north', openingId: 'n1' }])
  })

  it('Typ: alle Fenster, unabhängig von der Größe', () => {
    const refs = editOpeningTargets(facade, editorWith({ wallId: 'north', openingId: 'n1' }), 'type')
    const ids = refs.map((r) => r.openingId).sort()
    expect(ids).toEqual(['e1', 'n1', 'n2', 'u1'])
  })

  it('Etage: alle Öffnungen derselben Etage', () => {
    const refs = editOpeningTargets(facade, editorWith({ wallId: 'north', openingId: 'n1' }), 'floor')
    const ids = refs.map((r) => `${r.wallId}:${r.openingId}`).sort()
    expect(ids).toEqual(['east:e1', 'north:n1', 'north:n2', 'north:nd'])
  })

  it('Fassade: alle Öffnungen aller Hausseiten, unabhängig vom Winkel', () => {
    const refs = editOpeningTargets(facade, editorWith({ wallId: 'north', openingId: 'n1' }), 'facade')
    const ids = refs.map((r) => `${r.wallId}:${r.openingId}`).sort()
    expect(ids).toEqual(['east:e1', 'north-1:u1', 'north:n1', 'north:n2', 'north:nd'])
  })

  it('Fassade mit Yaw-Filter: nur Nord-Wände', () => {
    const refs = editOpeningTargets(
      facade,
      editorWith({ wallId: 'north', openingId: 'n1' }),
      'facade',
      [0],
    )
    const ids = refs.map((r) => `${r.wallId}:${r.openingId}`).sort()
    expect(ids).toEqual(['north-1:u1', 'north:n1', 'north:n2', 'north:nd'])
  })

  it('Kellerfenster Fassade: nur Kellerfenster, keine normalen Fenster', () => {
    const basement = {
      ...opening('b1', 'window', 32, 64, 0),
      basementWindow: { enabled: true, grilleHeight: 0.5 },
    }
    const normal = opening('n3', 'window', 160, 128, 192)
    const wallsWithBasement = [
      wall('north', 0, 0, [basement, normal, northDoor]),
      wall('east', 90, 0, [eastWin]),
      wall('north-1', 0, 456, [upperWin]),
    ]
    const facadeB = stateOf(wallsWithBasement)
    const refs = editOpeningTargets(
      facadeB,
      editorWith({ wallId: 'north', openingId: 'b1' }),
      'facade',
    )
    expect(refs).toEqual([{ wallId: 'north', openingId: 'b1' }])
  })
})

describe('editArchOpeningTargets', () => {
  const northWin = opening('n1', 'window', 32, 96, 160)
  const northWin2 = opening('n2', 'window', 160, 128, 192)
  const northDoor = opening('nd', 'door')
  const eastWin = opening('e1', 'window')
  const eastDoor = opening('ed', 'door')
  const upperWin = opening('u1', 'window')
  const walls = [
    wall('north', 0, 0, [northWin, northWin2, northDoor]),
    wall('east', 90, 0, [eastWin, eastDoor]),
    wall('north-1', 0, 456, [upperWin]),
  ]
  const facade = stateOf(walls)

  it('Auswahl: nur markierte Öffnungen (Fenster/Türen)', () => {
    const refs = editArchOpeningTargets(facade, editorWith({ wallId: 'north', openingId: 'n1' }), 'element')
    expect(refs).toEqual([{ wallId: 'north', openingId: 'n1' }])
  })

  it('Typ: Fenster und Türen im Haus (nicht nur Fenster)', () => {
    const refs = editArchOpeningTargets(facade, editorWith({ wallId: 'north', openingId: 'n1' }), 'type')
    const ids = refs.map((r) => `${r.wallId}:${r.openingId}`).sort()
    expect(ids).toEqual(['east:e1', 'east:ed', 'north-1:u1', 'north:n1', 'north:n2', 'north:nd'])
  })
})

describe('editWallTargets', () => {
  const northWin = opening('n1', 'window', 32, 96, 160)
  const eastWin = opening('e1', 'window')
  const upperWin = opening('u1', 'window')
  const walls = [
    wall('north', 0, 0, [northWin]),
    wall('east', 90, 0, [eastWin]),
    wall('diag', 45, 0, []),
    wall('north-1', 0, 456, [upperWin]),
  ]
  const facade = stateOf(walls)

  it('Fassade: alle Studio-Wände des Hauses (0°/45°/90°, alle Etagen)', () => {
    const ids = editWallTargets(
      facade,
      { selectedWallIds: ['north'], selectedOpenings: [], selectedEdges: [] },
      'facade',
    ).sort()
    expect(ids).toEqual(['diag', 'east', 'north', 'north-1'])
  })

  it('Fassade mit Yaw-Filter: nur 90°-Wände', () => {
    const ids = editWallTargets(
      facade,
      { selectedWallIds: ['north'], selectedOpenings: [], selectedEdges: [] },
      'facade',
      [90],
    ).sort()
    expect(ids).toEqual(['east'])
  })

  it('Etage: alle Studio-Wände derselben Etage im Haus', () => {
    const ids = editWallTargets(
      facade,
      { selectedWallIds: ['north'], selectedOpenings: [], selectedEdges: [] },
      'floor',
    ).sort()
    expect(ids).toEqual(['diag', 'east', 'north'])
    expect(ids).not.toContain('north-1')
  })
})
