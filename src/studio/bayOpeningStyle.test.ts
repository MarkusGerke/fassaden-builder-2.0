import { describe, expect, it } from 'vitest'
import { bayOpeningDonorWalls, insertBayAsWallSegment, migrateBayOpeningSillTo128, replaceWallWithBayPreset } from './baySegment'
import { BAY_WINDOW_PRESETS, baySillYFromDonorOpenings } from './bayWindow'
import { createStudioWall } from './walls'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { WALL_DEPTH, WINDOW_SILL_Y } from '../constants/presets'
import { emptyNeighbors, type FacadeState, type Wall } from '../types/facade'
import { createId } from '../utils/id'
import { createOpening } from '../utils/openings'

/**
 * v2.0.308+: Erker-Fenster übernehmen Stil der Fassade; Lage Front 48 / 96.
 * v2.0.311: Brüstung von den vorhandenen Fenstern (nicht fest 128).
 */

const FRAME = '#2E4233'
const DONOR_SILL = 72

function stateWithWalls(walls: Wall[], wallHeight = 352): FacadeState {
  const tagged = walls.map((w) => ({ ...w, buildingId: 'b1' }))
  return {
    buildings: [
      { id: 'b1', name: 'B', wallHeight, wallDepth: WALL_DEPTH, walls: tagged, floors: [], groups: [] },
    ],
    activeBuildingId: 'b1',
    selection: { kind: 'none' },
    neighbors: emptyNeighbors(),
  } as unknown as FacadeState
}

function storeyWall(y: number, opts?: { windowsAt?: number[]; width?: number; sillY?: number }): Wall {
  const sillY = opts?.sillY ?? DONOR_SILL
  const base: Wall = {
    ...createStudioWall(0, y),
    id: createId(),
    width: opts?.width ?? 1232,
    height: 352,
    depth: 24,
    originX: 0,
    originZ: 0,
    x: 0,
    y,
    yawDeg: 0,
    panelFlip: true,
    planLinked: true,
    neighbors: emptyNeighbors(),
    panel: { ...DEFAULT_STUDIO_PANEL, enabled: true, pattern: 'runningBond', panelWidth: 48, panelHeight: 24 },
  }
  const openings = (opts?.windowsAt ?? []).map((x) => ({
    ...createOpening('window', 96, 192, base, { x, y: sillY }),
    frameColor: FRAME,
    sillOuter: { enabled: true, mode: 'profile' as const, profileId: 'fensterprofil32x120', scale: 1 },
  }))
  return { ...base, openings }
}

function preset384() {
  return BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-f384-d144-rect')!
}

describe('Erker-Fenster: Stil + Lage 48/96 + Brüstung vom Spender', () => {
  it('baySillYFromDonorOpenings: häufigste Y, sonst 128', () => {
    expect(baySillYFromDonorOpenings([])).toBe(WINDOW_SILL_Y)
    expect(baySillYFromDonorOpenings([{ type: 'door', y: 0 } as never])).toBe(WINDOW_SILL_Y)
    expect(
      baySillYFromDonorOpenings([
        { type: 'window', y: 72 } as never,
        { type: 'window', y: 72 } as never,
        { type: 'window', y: 128 } as never,
      ]),
    ).toBe(72)
  })

  it('Segment: Stil und Brüstung 72 von der Host-Wand', () => {
    const host = storeyWall(800, { windowsAt: [120, 1016] })
    const inserted = insertBayAsWallSegment(stateWithWalls([host]), host.id, preset384(), 616, {
      singleFloor: true,
    })
    expect(inserted).not.toBeNull()
    const walls = inserted!.state.buildings[0]!.walls
    const front = walls.find((w) => w.bayRole === 'front')!
    const sides = walls.filter((w) => w.bayRole === 'side')
    expect(front.openings.map((o) => o.x)).toEqual([expect.closeTo(48, 5), expect.closeTo(240, 5)])
    expect(front.openings.every((o) => o.y === DONOR_SILL)).toBe(true)
    expect(front.openings.every((o) => o.frameColor === FRAME)).toBe(true)
    expect(front.openings.every((o) => o.sillOuter?.profileId === 'fensterprofil32x120')).toBe(true)
    expect(sides).toHaveLength(2)
    expect(sides.every((s) => s.openings[0]?.frameColor === FRAME)).toBe(true)
    expect(sides.every((s) => s.openings[0]?.y === DONOR_SILL)).toBe(true)
  })

  it('Host ohne Fenster: Spender ist eine andere Wand derselben Etage (Stil + Y)', () => {
    const host = storeyWall(800)
    const other: Wall = {
      ...storeyWall(800, { windowsAt: [200], width: 480, sillY: 64 }),
      originX: 1232,
      x: 1232,
      yawDeg: 90,
    }
    const donors = bayOpeningDonorWalls([host, other], host.id, 800)
    expect(donors.map((w) => w.id)).toEqual([host.id, other.id])
    const inserted = insertBayAsWallSegment(stateWithWalls([host, other]), host.id, preset384(), 616, {
      singleFloor: true,
    })!
    const front = inserted.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front.openings).toHaveLength(2)
    expect(front.openings.every((o) => o.frameColor === FRAME)).toBe(true)
    expect(front.openings.every((o) => o.y === 64)).toBe(true)
  })

  it('ohne Spender-Fenster: Brüstung fällt auf 128', () => {
    const narrow = storeyWall(800, { width: 384 }) // keine Fenster
    const result = replaceWallWithBayPreset(stateWithWalls([narrow]), narrow.id, preset384())!
    const front = result.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front.openings.every((o) => o.y === WINDOW_SILL_Y)).toBe(true)
  })

  it('pro Etage: Brüstung und Stil vom jeweiligen Geschoss', () => {
    const eg = storeyWall(0, { windowsAt: [120, 1016], sillY: 128 })
    const og = storeyWall(800, { windowsAt: [120, 1016], sillY: 72 })
    og.openings = og.openings.map((o) => ({ ...o, frameColor: '#ffffff' }))

    const egIns = insertBayAsWallSegment(stateWithWalls([eg]), eg.id, preset384(), 616, {
      singleFloor: true,
    })!
    const ogIns = insertBayAsWallSegment(stateWithWalls([og]), og.id, preset384(), 616, {
      singleFloor: true,
    })!
    const egFront = egIns.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    const ogFront = ogIns.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(egFront.openings.every((o) => o.frameColor === FRAME && o.y === 128)).toBe(true)
    expect(ogFront.openings.every((o) => o.frameColor === '#ffffff' && o.y === 72)).toBe(true)
  })

  it('Wand komplett ersetzen: Stil und Brüstung der ersetzten Wand', () => {
    const host = storeyWall(800, { windowsAt: [48, 240], width: 384, sillY: 72 })
    const replaced = replaceWallWithBayPreset(stateWithWalls([host]), host.id, preset384())!
    const front = replaced.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front.openings.map((o) => o.x)).toEqual([expect.closeTo(48, 5), expect.closeTo(240, 5)])
    expect(front.openings.every((o) => o.frameColor === FRAME && o.y === 72)).toBe(true)
  })

  it('Migration Schema 21 bleibt: Front 72 → 128 (historisch)', () => {
    const host = storeyWall(800, { windowsAt: [120], width: 1232 })
    const inserted = insertBayAsWallSegment(stateWithWalls([host]), host.id, preset384(), 616, {
      singleFloor: true,
    })!
    // Nach Insert liegen Fenster schon bei 72; Migration setzt auf 128
    let walls = inserted.state.buildings[0]!.walls
    const broken = {
      ...inserted.state,
      buildings: [
        {
          ...inserted.state.buildings[0]!,
          walls: walls.map((w) =>
            w.bayRole === 'front'
              ? { ...w, openings: w.openings.map((o) => ({ ...o, y: 72 })) }
              : { ...w, openings: w.openings.map((o) => ({ ...o, y: WINDOW_SILL_Y })) },
          ),
        },
      ],
    }
    const fixed = migrateBayOpeningSillTo128(broken)
    const front = fixed.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front.openings.every((o) => o.y === WINDOW_SILL_Y)).toBe(true)
  })
})
