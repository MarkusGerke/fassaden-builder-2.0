import { describe, expect, it } from 'vitest'
import type { EditorState, FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { assignProfilesToOpenings, removeProfilesFromOpenings } from '../utils/openings'
import { ALL_EDGES } from '../constants/presets'
import {
  applyOpeningProfilesDelta,
  propagateSelectionEdit,
} from './scopePropagate'

const H = 456

function win(partial: Partial<Opening> & { id: string }): Opening {
  return {
    type: 'window',
    x: 48,
    y: 128,
    width: 96,
    height: 192,
    ...partial,
  } as Opening
}

function wall(partial: Partial<Wall> & { id: string; openings: Opening[] }): Wall {
  return {
    x: 0,
    y: 0,
    width: 384,
    height: H,
    depth: WALL_DEPTH,
    profiles: [],
    neighbors: emptyNeighbors(),
    kind: 'studio',
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    panelFlip: true,
    planLinked: true,
    storeyIndex: 0,
    ...partial,
  }
}

function stateWithWalls(walls: Wall[]): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus 1',
        walls,
        wallHeight: H,
        wallDepth: WALL_DEPTH,
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

function editorForOpening(wallId: string, openingId: string): EditorState {
  return {
    selectedWallIds: [],
    selectedOpenings: [{ wallId, openingId }],
    selectedEdges: [],
  }
}

describe('applyOpeningProfilesDelta', () => {
  it('ersetzt Peer-Profile und remappt openingId', () => {
    const peer = [
      { openingId: 'peer', profileId: 'old', edge: 'top' as const },
      { openingId: 'other', profileId: 'keep', edge: 'left' as const },
    ]
    const before = [{ openingId: 'donor', profileId: 'old', edge: 'top' as const }]
    const after = [
      { openingId: 'donor', profileId: 'neu', edge: 'top' as const },
      { openingId: 'donor', profileId: 'neu', edge: 'right' as const },
    ]
    const next = applyOpeningProfilesDelta(peer, 'peer', before, after)
    expect(next.filter((p) => p.openingId === 'other')).toEqual([
      { openingId: 'other', profileId: 'keep', edge: 'left' },
    ])
    expect(next.filter((p) => p.openingId === 'peer')).toEqual([
      { openingId: 'peer', profileId: 'neu', edge: 'top' },
      { openingId: 'peer', profileId: 'neu', edge: 'right' },
    ])
  })

  it('ändert nichts wenn Donor-Profile gleich', () => {
    const peer = [{ openingId: 'peer', profileId: 'a', edge: 'top' as const }]
    const same = [{ openingId: 'donor', profileId: 'a', edge: 'top' as const }]
    expect(applyOpeningProfilesDelta(peer, 'peer', same, same)).toBe(peer)
  })
})

describe('propagateSelectionEdit — Fensterprofile', () => {
  it('übernimmt Rahmenprofil auf gleiche Fenster der Fassade', () => {
    const o1 = win({ id: 'o1', x: 48 })
    const o2 = win({ id: 'o2', x: 48 })
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [o1], yawDeg: 0 }),
      wall({ id: 'w2', openings: [o2], yawDeg: 0, originX: 400 }),
    ])
    const after = assignProfilesToOpenings(
      before,
      [{ wallId: 'w1', openingId: 'o1' }],
      [...ALL_EDGES],
      'fensterprofil32x120',
    )
    const editor = editorForOpening('w1', 'o1')
    const next = propagateSelectionEdit(before, after, editor, 'facade')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.profiles.filter((p) => p.openingId === 'o2')).toHaveLength(4)
    expect(peer.profiles.every((p) => p.profileId === 'fensterprofil32x120')).toBe(true)
  })

  it('entfernt Rahmenprofil auf der Etage wenn Donor keins mehr hat', () => {
    const o1 = win({ id: 'o1' })
    const o2 = win({ id: 'o2' })
    let before = stateWithWalls([
      wall({
        id: 'w1',
        openings: [o1],
        profiles: ALL_EDGES.map((edge) => ({
          openingId: 'o1',
          profileId: 'fensterprofil32x120',
          edge,
        })),
      }),
      wall({
        id: 'w2',
        openings: [o2],
        originX: 400,
        profiles: ALL_EDGES.map((edge) => ({
          openingId: 'o2',
          profileId: 'fensterprofil32x120',
          edge,
        })),
      }),
    ])
    const after = removeProfilesFromOpenings(
      before,
      [{ wallId: 'w1', openingId: 'o1' }],
      [...ALL_EDGES],
    )
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'floor')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.profiles.filter((p) => p.openingId === 'o2')).toHaveLength(0)
  })

  it('übernimmt Rahmenprofil auf Fenster und Türen (auch andere Maße)', () => {
    const o1 = win({ id: 'o1', width: 96, height: 192 })
    const o2 = win({ id: 'o2', width: 144, height: 192 })
    const door = win({
      id: 'd1',
      type: 'door',
      x: 48,
      y: 0,
      width: 96,
      height: 240,
    })
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [o1] }),
      wall({ id: 'w2', openings: [o2, door], originX: 400 }),
    ])
    const after = assignProfilesToOpenings(
      before,
      [{ wallId: 'w1', openingId: 'o1' }],
      [...ALL_EDGES],
      'fensterprofil32x120',
    )
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'facade')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.profiles.filter((p) => p.openingId === 'o2')).toHaveLength(4)
    expect(peer.profiles.filter((p) => p.openingId === 'd1')).toHaveLength(4)
    expect(peer.profiles.every((p) => p.profileId === 'fensterprofil32x120')).toBe(true)
  })

  it('übernimmt Tür-Profil auch auf Fenster der Etage', () => {
    const door = win({
      id: 'd1',
      type: 'door',
      x: 48,
      y: 0,
      width: 96,
      height: 240,
    })
    const o2 = win({ id: 'o2', width: 96, height: 192 })
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [door] }),
      wall({ id: 'w2', openings: [o2], originX: 400 }),
    ])
    const after = assignProfilesToOpenings(
      before,
      [{ wallId: 'w1', openingId: 'd1' }],
      [...ALL_EDGES],
      'fensterprofil32x120',
    )
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'd1'), 'floor')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.profiles.filter((p) => p.openingId === 'o2')).toHaveLength(4)
  })
})
