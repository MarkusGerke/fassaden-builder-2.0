import { describe, expect, it } from 'vitest'
import { createDefaultFacadeState, cloneWall } from '../types/facade'
import {
  awningKindDefaults,
  awningKindSwitchPatch,
  defaultAwningConfig,
} from '../studio/awning'
import { updateOpening } from './openings'
import {
  addWallAwning,
  applyAwningToOpenings,
  applyAwningToWall,
  cloneAwningConfig,
  createGroupAwningForOpenings,
  removeWallAwning,
  updateOpeningAwning,
  updateWallAwning,
  wallAwnings,
} from './awnings'
import { hydrateOpening, hydrateWall } from './hydrate'

describe('awning kind switch preserves style/state', () => {
  it('opening: fabricColor + extension survive kind change via switch patch', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const op = {
      id: 'op-1',
      type: 'window' as const,
      x: 48,
      y: 128,
      width: 96,
      height: 192,
    }
    state = {
      ...state,
      buildings: state.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) =>
          w.id === wall.id ? cloneWall({ ...w, openings: [op] }) : w,
        ),
      })),
    }
    const wallId = wall.id
    state = updateOpeningAwning(state, [{ wallId, openingId: op.id }], {
      enabled: true,
      kind: 'foldingArm',
      fabricColor: '#228B22',
      extension: 0.3,
      frameColor: '#111111',
    })
    const before = state.buildings[0]!.walls.find((w) => w.id === wallId)!.openings[0]!.awning!
    state = updateOpeningAwning(
      state,
      [{ wallId, openingId: op.id }],
      { ...awningKindSwitchPatch('dropArm', before.kind), enabled: true },
    )
    const after = state.buildings[0]!.walls.find((w) => w.id === wallId)!.openings[0]!.awning!
    expect(after.kind).toBe('dropArm')
    expect(after.fabricColor).toBe('#228B22')
    expect(after.frameColor).toBe('#111111')
    expect(after.extension).toBe(0.3)
    expect(after.id).toBe(before.id)
    expect(after.armMountYCm).toBe(awningKindDefaults('dropArm').armMountYCm)
  })

  it('wall: fabricColor + extension survive kind change via switch patch', () => {
    let state = createDefaultFacadeState()
    const wallId = state.buildings[0]!.walls[0]!.id
    const { state: withAwning, awningId } = addWallAwning(state, wallId, {
      enabled: true,
      kind: 'foldingArm',
      fabricColor: '#228B22',
      extension: 0.3,
    })
    state = withAwning
    state = updateWallAwning(
      state,
      [wallId],
      { ...awningKindSwitchPatch('markisolette', 'foldingArm'), enabled: true },
      awningId,
    )
    const next = wallAwnings(state.buildings[0]!.walls[0]!).find((a) => a.id === awningId)!
    expect(next.kind).toBe('markisolette')
    expect(next.fabricColor).toBe('#228B22')
    expect(next.extension).toBe(0.3)
    expect(next.projectionCm).toBe(awningKindDefaults('markisolette').projectionCm)
  })

  it('full defaultAwningConfig would wipe style — switch patch must not equal that', () => {
    const styled = defaultAwningConfig({
      enabled: true,
      kind: 'foldingArm',
      fabricColor: '#228B22',
      extension: 0.3,
    })
    const wiped = defaultAwningConfig({ enabled: true, kind: 'dropArm' })
    expect(wiped.fabricColor).not.toBe(styled.fabricColor)
    expect(wiped.extension).not.toBe(styled.extension)
    const patch = awningKindSwitchPatch('dropArm', 'foldingArm')
    expect(patch.fabricColor).toBeUndefined()
    expect(patch.extension).toBeUndefined()
  })
})

describe('awnings CRUD', () => {
  it('adds and removes wall awnings', () => {
    let state = createDefaultFacadeState()
    const wallId = state.buildings[0]!.walls[0]!.id
    const { state: next, awningId } = addWallAwning(state, wallId, {
      enabled: true,
      kind: 'foldingArm',
    })
    state = next
    expect(wallAwnings(state.buildings[0]!.walls[0]!).length).toBe(1)
    expect(wallAwnings(state.buildings[0]!.walls[0]!)[0]!.id).toBe(awningId)

    state = updateWallAwning(state, [wallId], { extension: 0.2 }, awningId)
    expect(wallAwnings(state.buildings[0]!.walls[0]!)[0]!.extension).toBe(0.2)

    state = removeWallAwning(state, wallId, awningId)
    expect(wallAwnings(state.buildings[0]!.walls[0]!).length).toBe(0)
  })

  it('updates opening awning and sets width when enabling', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const opening = wall.openings[0]
    if (!opening) {
      // Minimal opening for test
      wall.openings.push({
        id: 'op-1',
        type: 'window',
        x: 48,
        y: 128,
        width: 96,
        height: 192,
      })
    }
    const op = state.buildings[0]!.walls[0]!.openings[0]!
    state = {
      ...state,
      buildings: state.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) => (w.id === wall.id ? cloneWall({ ...w, openings: [op] }) : w)),
      })),
    }
    const wallId = wall.id
    state = updateOpeningAwning(
      state,
      [{ wallId, openingId: op.id }],
      { enabled: true, kind: 'dropArm' },
    )
    const nextOp = state.buildings[0]!.walls.find((w) => w.id === wallId)!.openings[0]!
    expect(nextOp.awning?.enabled).toBe(true)
    expect(nextOp.awning?.kind).toBe('dropArm')
    expect(nextOp.awning?.widthCm).toBeGreaterThanOrEqual(op.width)
  })
})

describe('awning clipboard apply', () => {
  it('pastes opening awning style and keeps target id', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const op = {
      id: 'op-src',
      type: 'window' as const,
      x: 48,
      y: 128,
      width: 96,
      height: 192,
    }
    const peer = {
      id: 'op-peer',
      type: 'window' as const,
      x: 200,
      y: 128,
      width: 120,
      height: 192,
    }
    state = {
      ...state,
      buildings: state.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) =>
          w.id === wall.id ? cloneWall({ ...w, openings: [op, peer] }) : w,
        ),
      })),
    }
    state = updateOpeningAwning(
      state,
      [{ wallId: wall.id, openingId: 'op-src' }],
      { enabled: true, kind: 'markisolette', fabricColor: '#112233' },
    )
    const src = state.buildings[0]!.walls[0]!.openings.find((o) => o.id === 'op-src')!.awning!
    state = applyAwningToOpenings(
      state,
      [{ wallId: wall.id, openingId: 'op-peer' }],
      cloneAwningConfig(src),
      'paste',
    )
    const nextPeer = state.buildings[0]!.walls[0]!.openings.find((o) => o.id === 'op-peer')!
    expect(nextPeer.awning?.enabled).toBe(true)
    expect(nextPeer.awning?.kind).toBe('markisolette')
    expect(nextPeer.awning?.fabricColor).toBe('#112233')
    expect(nextPeer.awning?.id).not.toBe(src.id)
  })

  it('replace skips openings without awning', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const peer = {
      id: 'op-peer',
      type: 'window' as const,
      x: 48,
      y: 128,
      width: 96,
      height: 192,
    }
    state = {
      ...state,
      buildings: state.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) =>
          w.id === wall.id ? cloneWall({ ...w, openings: [peer] }) : w,
        ),
      })),
    }
    state = applyAwningToOpenings(
      state,
      [{ wallId: wall.id, openingId: 'op-peer' }],
      defaultAwningConfig({ enabled: true, kind: 'foldingArm', extension: 0.5 }),
      'replace',
    )
    expect(state.buildings[0]!.walls[0]!.openings[0]!.awning?.enabled ?? false).toBe(false)
  })

  it('adds wall awning at click and replaces keeping id/mount', () => {
    let state = createDefaultFacadeState()
    const wallId = state.buildings[0]!.walls[0]!.id
    const { state: withAwning, awningId } = applyAwningToWall(
      state,
      wallId,
      defaultAwningConfig({
        enabled: true,
        kind: 'foldingArm',
        extension: 0.4,
        fabricColor: '#aaaaaa',
      }),
      { at: { localX: 100, localY: 200 } },
    )
    state = withAwning
    const prev = wallAwnings(state.buildings[0]!.walls[0]!)[0]!
    expect(prev.id).toBe(awningId)
    expect(prev.mountX).toBeDefined()

    const { state: replaced, awningId: sameId } = applyAwningToWall(
      state,
      wallId,
      defaultAwningConfig({
        enabled: true,
        kind: 'dropArm',
        extension: 0.9,
        fabricColor: '#00ff00',
      }),
      { awningId },
    )
    expect(sameId).toBe(awningId)
    const next = wallAwnings(replaced.buildings[0]!.walls[0]!)[0]!
    expect(next.kind).toBe('dropArm')
    expect(next.fabricColor).toBe('#00ff00')
    expect(next.mountX).toBe(prev.mountX)
    expect(next.mountY).toBe(prev.mountY)
  })
})

describe('awning relative width + groups', () => {
  it('recomputes opening awning width when window width changes', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const op = {
      id: 'op-w',
      type: 'window' as const,
      x: 48,
      y: 128,
      width: 96,
      height: 192,
    }
    state = {
      ...state,
      buildings: state.buildings.map((b) => ({
        ...b,
        walls: b.walls.map((w) =>
          w.id === wall.id ? cloneWall({ ...w, openings: [op] }) : w,
        ),
      })),
    }
    state = updateOpeningAwning(
      state,
      [{ wallId: wall.id, openingId: 'op-w' }],
      { enabled: true, overhangCm: 16 },
    )
    expect(state.buildings[0]!.walls[0]!.openings[0]!.awning!.widthCm).toBe(128)
    state = updateOpening(state, wall.id, 'op-w', { width: 160 })
    expect(state.buildings[0]!.walls[0]!.openings[0]!.awning!.widthCm).toBe(192)
  })

  it('creates group awning spanning two openings', () => {
    let state = createDefaultFacadeState()
    const wall = state.buildings[0]!.walls[0]!
    const a = {
      id: 'a',
      type: 'window' as const,
      x: 40,
      y: 128,
      width: 80,
      height: 160,
    }
    const b = {
      id: 'b',
      type: 'window' as const,
      x: 160,
      y: 128,
      width: 96,
      height: 160,
    }
    state = {
      ...state,
      buildings: state.buildings.map((bld) => ({
        ...bld,
        walls: bld.walls.map((w) =>
          w.id === wall.id ? cloneWall({ ...w, openings: [a, b] }) : w,
        ),
      })),
    }
    const { state: next, awningId } = createGroupAwningForOpenings(state, wall.id, ['a', 'b'], {
      overhangCm: 16,
    })
    const group = wallAwnings(next.buildings[0]!.walls[0]!).find((x) => x.id === awningId)!
    // span 40..256 = 216 + 32 overhang = 248
    expect(group.widthCm).toBe(248)
    expect(group.openingIds).toEqual(['a', 'b'])
    // Höhe über Sturz relativ (0 = auf Span-Top)
    expect(group.mountY).toBe(0)
    expect(next.buildings[0]!.walls[0]!.openings.every((o) => !o.awning?.enabled)).toBe(true)

    const wider = updateWallAwning(next, [wall.id], { overhangCm: 32 }, awningId)
    const g2 = wallAwnings(wider.buildings[0]!.walls[0]!).find((x) => x.id === awningId)!
    expect(g2.overhangCm).toBe(32)
    // span 216 + 2×32 = 280
    expect(g2.widthCm).toBe(280)
  })
})

describe('hydrate awning', () => {
  it('fills missing awning on window without enabling', () => {
    const opening = hydrateOpening({
      id: 'a',
      type: 'window',
      x: 0,
      y: 128,
      width: 96,
      height: 192,
    })
    expect(opening.awning?.enabled).toBe(false)
    expect(opening.awning?.id).toBeTruthy()
  })

  it('fills empty awnings list on wall', () => {
    const wall = hydrateWall({
      id: 'w',
      kind: 'studio',
      x: 0,
      y: 0,
      width: 384,
      height: 384,
      depth: 24,
      openings: [],
      profiles: [],
      neighbors: {},
    })
    expect(wall.awnings).toEqual([])
  })
})
