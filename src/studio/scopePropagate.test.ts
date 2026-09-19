import { describe, expect, it } from 'vitest'
import type { EditorState, FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { assignProfilesToOpenings, removeProfilesFromOpenings } from '../utils/openings'
import { ALL_EDGES } from '../constants/presets'
import { defaultGruenderzeitConfig } from '../windows/gruenderzeit'
import {
  applyOpeningProfilesDelta,
  assignSelectionPropertiesToScope,
  propagateSelectionEdit,
  scopePropagateAvailable,
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
    const next = applyOpeningProfilesDelta(peer, { id: 'peer', type: 'window' }, before, after)
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
    expect(applyOpeningProfilesDelta(peer, { id: 'peer', type: 'window' }, same, same)).toBe(peer)
  })

  it('keine Rahmenprofile auf Kellerfenster', () => {
    const after = [{ openingId: 'donor', profileId: 'neu', edge: 'top' as const }]
    const next = applyOpeningProfilesDelta(
      [],
      { id: 'keller', type: 'window', basementWindow: { enabled: true } },
      [],
      after,
    )
    expect(next).toEqual([])
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

  it('übernimmt Profilfarbe auf Konche/Einbuchtung der Etage (v2.0.412)', () => {
    const window = win({
      id: 'o1',
      width: 96,
      height: 192,
      trim: { offsetX: 0, offsetY: 0, offsetForward: 0, rotationDeg: 0, flipOutward: false, flipForward: false, cornerJoin: 'miter', color: '#824242' },
    })
    const conch = win({
      id: 'c1',
      type: 'conch',
      x: 200,
      width: 96,
      height: 128,
      trim: { offsetX: 0, offsetY: 0, offsetForward: 0, rotationDeg: 0, flipOutward: false, flipForward: false, cornerJoin: 'miter' },
    })
    const cutout = win({
      id: 'n1',
      type: 'cutout',
      x: 48,
      y: 64,
      width: 32,
      height: 48,
      cutoutShape: 'rect',
      fill: { mode: 'niche', nicheDepthCm: 32 },
    })
    const before = stateWithWalls([
      wall({
        id: 'w1',
        openings: [window, conch],
        profiles: [
          { openingId: 'o1', profileId: 'fensterprofil32x120', edge: 'top' },
          { openingId: 'c1', profileId: 'fensterprofil32x120', edge: 'top' },
        ],
      }),
      wall({
        id: 'w2',
        openings: [cutout],
        originX: 400,
        profiles: [{ openingId: 'n1', profileId: 'fensterprofil32x120', edge: 'top' }],
      }),
    ])
    const after = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              openings: [
                {
                  ...window,
                  trim: { ...window.trim!, color: '#D13C3C' },
                },
                conch,
              ],
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'floor')
    const w1 = next.buildings[0]!.walls.find((w) => w.id === 'w1')!
    const w2 = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(w1.openings.find((o) => o.id === 'c1')?.trim?.color).toBe('#D13C3C')
    expect(w2.openings.find((o) => o.id === 'n1')?.trim?.color).toBe('#D13C3C')
  })

  it('übernimmt Rahmenfarbe auf Fenster und Türen (auch andere Maße)', () => {
    const door = win({
      id: 'd1',
      type: 'door',
      x: 48,
      y: 0,
      width: 160,
      height: 304,
      frameColor: '#ffffff',
    })
    const o2 = win({ id: 'o2', width: 96, height: 192, frameColor: '#ffffff' })
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [door] }),
      wall({ id: 'w2', openings: [o2], originX: 400 }),
    ])
    const after = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              openings: [{ ...door, frameColor: '#A54040' }],
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'd1'), 'facade')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.openings.find((o) => o.id === 'o2')?.frameColor).toBe('#A54040')
  })

  it('Typ-Übernahme: gleiche Art ohne Maßfilter; Toast-Typ ist verfügbar', () => {
    const door = win({
      id: 'd1',
      type: 'door',
      x: 48,
      y: 0,
      width: 160,
      height: 304,
      frameColor: '#ffffff',
    })
    const door2 = win({
      id: 'd2',
      type: 'door',
      x: 48,
      y: 0,
      width: 96,
      height: 240,
      frameColor: '#ffffff',
    })
    const window = win({ id: 'o1', width: 96, height: 192, frameColor: '#ffffff' })
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [door] }),
      wall({ id: 'w2', openings: [door2, window], originX: 400 }),
    ])
    const after = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              openings: [{ ...door, frameColor: '#A54040' }],
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    const editor = editorForOpening('w1', 'd1')
    expect(scopePropagateAvailable(after, editor, 'element', 'type')).toBe(true)
    const next = propagateSelectionEdit(before, after, editor, 'type')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.openings.find((o) => o.id === 'd2')?.frameColor).toBe('#A54040')
    expect(peer.openings.find((o) => o.id === 'o1')?.frameColor).toBe('#ffffff')
  })
})

describe('propagateSelectionEdit — Öffnungs-Deltas nested', () => {
  it('übernimmt nur boxWindow, behält Peer-casements', () => {
    const donorGz = {
      ...defaultGruenderzeitConfig(96, 192, 'window'),
      casements: 2 as const,
      boxWindow: false,
    }
    const peerGz = {
      ...defaultGruenderzeitConfig(96, 192, 'window'),
      casements: 3,
      boxWindow: false,
      splitHCount: 2 as const,
    }
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [win({ id: 'o1', gruenderzeit: donorGz })] }),
      wall({
        id: 'w2',
        openings: [win({ id: 'o2', gruenderzeit: peerGz })],
        originX: 400,
      }),
    ])
    const afterGz = { ...donorGz, boxWindow: true }
    const after = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              openings: [{ ...before.buildings[0]!.walls[0]!.openings[0]!, gruenderzeit: afterGz }],
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'floor')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!.openings.find((o) => o.id === 'o2')!
    expect(peer.gruenderzeit?.boxWindow).toBe(true)
    expect(peer.gruenderzeit?.casements).toBe(3)
    expect(peer.gruenderzeit?.splitHCount).toBe(2)
  })

  it('Markise: übernimmt Stil, Breite aus Peer-Öffnung + Überstand', () => {
    const donorAwning = {
      id: 'da',
      enabled: true,
      kind: 'foldingArm' as const,
      extension: 0.5,
      widthCm: 200,
      projectionCm: 144,
      overhangCm: 16,
    }
    const peerAwning = {
      id: 'pa',
      enabled: false,
      kind: 'foldingArm' as const,
      extension: 0.65,
      widthCm: 96,
      projectionCm: 144,
      overhangCm: 8,
    }
    const before = stateWithWalls([
      wall({
        id: 'w1',
        openings: [win({ id: 'o1', width: 160, awning: donorAwning as never })],
      }),
      wall({
        id: 'w2',
        originX: 400,
        openings: [win({ id: 'o2', width: 80, awning: peerAwning as never })],
      }),
    ])
    const after = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              openings: [
                {
                  ...before.buildings[0]!.walls[0]!.openings[0]!,
                  awning: { ...donorAwning, enabled: true, fabricColor: '#112233' },
                },
              ],
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    // Peer before ohne enabled Markise → after donor mit Farbe: Delta vom Donor-Edit
    const beforeDonorOff = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              openings: [
                {
                  ...before.buildings[0]!.walls[0]!.openings[0]!,
                  awning: { ...donorAwning, enabled: false },
                },
              ],
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    const next = propagateSelectionEdit(
      beforeDonorOff,
      after,
      editorForOpening('w1', 'o1'),
      'floor',
    )
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!.openings.find((o) => o.id === 'o2')!
    expect(peer.awning?.enabled).toBe(true)
    expect(peer.awning?.fabricColor).toBe('#112233')
    // 80 + 2*16 = 112
    expect(peer.awning?.widthCm).toBe(112)
  })
})

describe('propagateSelectionEdit — Gesims ganz ersetzen', () => {
  it('übernimmt enabled Gesims auf Etage (kein Partial-Merge)', () => {
    const before = stateWithWalls([
      wall({ id: 'w1', openings: [], cornice: { enabled: false } }),
      wall({ id: 'w2', openings: [], originX: 400, cornice: { enabled: false } }),
    ])
    const after = {
      ...before,
      buildings: [
        {
          ...before.buildings[0]!,
          walls: [
            {
              ...before.buildings[0]!.walls[0]!,
              cornice: {
                enabled: true,
                edge: 'top' as const,
                profileId: 'traufgesims70x150',
                scale: 1.5,
              },
            },
            before.buildings[0]!.walls[1]!,
          ],
        },
      ],
    }
    const editor: EditorState = {
      selectedWallIds: ['w1'],
      selectedOpenings: [],
      selectedEdges: [],
    }
    const next = propagateSelectionEdit(before, after, editor, 'floor')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    expect(peer.cornice?.enabled).toBe(true)
    expect(peer.cornice?.profileId).toBe('traufgesims70x150')
    expect(peer.cornice?.scale).toBe(1.5)
  })
})

describe('assignSelectionPropertiesToScope', () => {
  it('weist Öffnungsfarbe auf Typ zu ohne Position zu kopieren', () => {
    const o1 = win({ id: 'o1', x: 48, frameColor: '#A54040' })
    const o2 = win({ id: 'o2', x: 200, frameColor: '#ffffff' })
    const state = stateWithWalls([
      wall({ id: 'w1', openings: [o1] }),
      wall({ id: 'w2', openings: [o2], originX: 400 }),
    ])
    const next = assignSelectionPropertiesToScope(state, editorForOpening('w1', 'o1'), 'type')
    const peer = next.buildings[0]!.walls.find((w) => w.id === 'w2')!
    const peerOpen = peer.openings.find((o) => o.id === 'o2')!
    expect(peerOpen.frameColor).toBe('#A54040')
    expect(peerOpen.x).toBe(200)
  })

  it('weist Bogenform zu ohne manuelles Stichmaß (Auto je Peer-Breite)', () => {
    const o1 = win({
      id: 'o1',
      width: 96,
      arch: { enabled: true, form: 'round', riseCm: 8, voussoirs: false },
    })
    const o2 = win({
      id: 'o2',
      x: 200,
      width: 120,
      arch: { enabled: false, form: 'rect' },
    })
    const state = stateWithWalls([
      wall({ id: 'w1', openings: [o1, o2] }),
    ])
    const next = assignSelectionPropertiesToScope(state, editorForOpening('w1', 'o1'), 'floor')
    const peerOpen = next.buildings[0]!.walls[0]!.openings.find((o) => o.id === 'o2')!
    expect(peerOpen.arch?.form).toBe('round')
    expect(peerOpen.arch?.enabled).toBe(true)
    expect(peerOpen.arch?.riseCm).toBeUndefined()
  })
})

describe('propagateSelectionEdit arch riseCm', () => {
  it('Toast Auto-Stichmaß: entfernt riseCm auf Peers (Typ/Etage/Fassade)', () => {
    const beforeOpen = win({
      id: 'o1',
      arch: { enabled: true, form: 'round', riseCm: 8, voussoirs: false },
    })
    const afterOpen = win({
      id: 'o1',
      arch: { enabled: true, form: 'round', voussoirs: false },
    })
    const peerOpen = win({
      id: 'o2',
      x: 200,
      width: 120,
      arch: { enabled: true, form: 'round', riseCm: 8, voussoirs: false },
    })
    const before = stateWithWalls([wall({ id: 'w1', openings: [beforeOpen, peerOpen] })])
    const after = stateWithWalls([wall({ id: 'w1', openings: [afterOpen, peerOpen] })])
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'facade')
    const peer = next.buildings[0]!.walls[0]!.openings.find((o) => o.id === 'o2')!
    expect(peer.arch?.form).toBe('round')
    expect(peer.arch?.riseCm).toBeUndefined()
  })

  it('Toast: manuelles Stichmaß als letzte Änderung auf Peers kopieren', () => {
    const beforeOpen = win({
      id: 'o1',
      arch: { enabled: true, form: 'round', voussoirs: false },
    })
    const afterOpen = win({
      id: 'o1',
      arch: { enabled: true, form: 'round', riseCm: 16, voussoirs: false },
    })
    const peerOpen = win({
      id: 'o2',
      x: 200,
      width: 120,
      arch: { enabled: true, form: 'round', voussoirs: false },
    })
    const before = stateWithWalls([wall({ id: 'w1', openings: [beforeOpen, peerOpen] })])
    const after = stateWithWalls([wall({ id: 'w1', openings: [afterOpen, peerOpen] })])
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'facade')
    const peer = next.buildings[0]!.walls[0]!.openings.find((o) => o.id === 'o2')!
    expect(peer.arch?.riseCm).toBe(16)
  })

  it('löscht Peer-Stichmaß bei Formwechsel', () => {
    const beforeOpen = win({
      id: 'o1',
      arch: { enabled: true, form: 'segmental', riseCm: 8, voussoirs: false },
    })
    const afterOpen = win({
      id: 'o1',
      arch: { enabled: true, form: 'round', voussoirs: false },
    })
    const peerOpen = win({
      id: 'o2',
      x: 200,
      width: 120,
      arch: { enabled: true, form: 'segmental', riseCm: 8, voussoirs: false },
    })
    const before = stateWithWalls([wall({ id: 'w1', openings: [beforeOpen, peerOpen] })])
    const after = stateWithWalls([
      wall({
        id: 'w1',
        openings: [afterOpen, peerOpen],
      }),
    ])
    const next = propagateSelectionEdit(before, after, editorForOpening('w1', 'o1'), 'floor')
    const peer = next.buildings[0]!.walls[0]!.openings.find((o) => o.id === 'o2')!
    expect(peer.arch?.form).toBe('round')
    expect(peer.arch?.riseCm).toBeUndefined()
  })
})
