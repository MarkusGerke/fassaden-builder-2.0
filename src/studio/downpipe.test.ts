import { describe, expect, it } from 'vitest'
import {
  createDownpipeFixture,
  DEFAULT_DOWNPIPE_COLOR,
  DEFAULT_DOWNPIPE_DIAMETER_CM,
  normalizeDownpipe,
  resolveDownpipePose,
  syncDownpipeNiches,
} from './downpipe'
import type { Building, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'

function makeWall(partial: Partial<Wall> & Pick<Wall, 'id'>): Wall {
  return {
    kind: 'studio',
    width: 384,
    height: 448,
    depth: 48,
    x: 0,
    y: partial.y ?? 0,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    panelFlip: true,
    storeyIndex: partial.storeyIndex ?? 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    ...partial,
  }
}

describe('downpipe', () => {
  it('normalisiert Defaults (DN 80, surface, shoe, Titanzink, breakDecor)', () => {
    const dp = normalizeDownpipe({ id: 'd1', anchorWallId: 'w1', localX: 17 })
    expect(dp.diameterCm).toBe(DEFAULT_DOWNPIPE_DIAMETER_CM)
    expect(dp.mount).toBe('surface')
    expect(dp.surfaceGapCm).toBe(8)
    expect(dp.foot).toBe('shoe')
    expect(dp.color).toBe(DEFAULT_DOWNPIPE_COLOR)
    expect(dp.localX).toBe(16)
    expect(dp.breakDecor).toBe(true)
  })

  it('Pose: Rohr vor äußerster Paneelfläche mit 8 cm Abstand', () => {
    const wall = makeWall({ id: 'w0', storeyIndex: 0, y: 0 })
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      floors: [{ nodes: [], edges: [] }],
      walls: [wall],
      wallHeight: 448,
      wallDepth: 48,
    }
    const dp = createDownpipeFixture('w0', 96)
    const pose = resolveDownpipePose(building, dp)
    expect(pose).not.toBeNull()
    expect(pose!.radiusCm).toBe(4)
    expect(pose!.clearanceToFacadeCm).toBe(8)
    // panelFlip true → Origin = Außen; +8 Gap +4 radius in −Z (yaw 0 outward)
    expect(pose!.z).toBeCloseTo(-(8 + 4), 5)
  })

  it('Pose: Wandabstand surfaceGapCm überschreibt Default', () => {
    const wall = makeWall({ id: 'w0', storeyIndex: 0, y: 0 })
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      floors: [{ nodes: [], edges: [] }],
      walls: [wall],
      wallHeight: 448,
      wallDepth: 48,
    }
    const dp = createDownpipeFixture('w0', 96, { surfaceGapCm: 12 })
    const pose = resolveDownpipePose(building, dp)
    expect(pose).not.toBeNull()
    expect(pose!.clearanceToFacadeCm).toBe(12)
    expect(pose!.z).toBeCloseTo(-(12 + 4), 5)
  })

  it('Pose: mit Paneelvorstand sitzt das Rohr vor der Paneelfläche; Schelle reicht zur Wand', () => {
    const wall = makeWall({
      id: 'w0',
      storeyIndex: 0,
      y: 0,
      panel: {
        enabled: true,
        pattern: 'runningBond',
        panelWidth: 24,
        panelHeight: 8,
        joint: 1,
        projectDepth: 4,
        taperDepth: 2,
        taper: 1,
        jointDepth: 0.8,
      } as Wall['panel'],
    })
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      floors: [{ nodes: [], edges: [] }],
      walls: [wall],
      wallHeight: 448,
      wallDepth: 48,
    }
    const dp = createDownpipeFixture('w0', 96, { mount: 'surface' })
    const pose = resolveDownpipePose(building, dp)
    expect(pose).not.toBeNull()
    // Paneel 4 + Trapez 2 = 6 cm Fassadenvorstand, dann +8 Gap +4 radius
    expect(pose!.facadeOutCm).toBe(6)
    expect(pose!.clearanceToFacadeCm).toBe(8)
    expect(pose!.z).toBeCloseTo(-(6 + 8 + 4), 5)
  })

  it('Nische erzeugt eckige Cutouts über Etagen', () => {
    const w0 = makeWall({ id: 'w0', storeyIndex: 0, y: 0 })
    const w1 = makeWall({ id: 'w1', storeyIndex: 1, y: 448 })
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      floors: [
        { nodes: [], edges: [] },
        { nodes: [], edges: [] },
      ],
      walls: [w0, w1],
      wallHeight: 448,
      wallDepth: 48,
    }
    const dp = createDownpipeFixture('w0', 96, { mount: 'niche' })
    const { building: next, downpipe } = syncDownpipeNiches(building, dp)
    expect(Object.keys(downpipe.nicheOpeningIds ?? {})).toHaveLength(2)
    expect(next.walls.find((w) => w.id === 'w0')!.openings).toHaveLength(1)
    expect(next.walls.find((w) => w.id === 'w1')!.openings).toHaveLength(1)
    expect(next.walls[0]!.openings[0]!.type).toBe('cutout')
    expect(next.walls[0]!.openings[0]!.cutoutShape).toBe('rect')
    expect(next.walls[0]!.openings[0]!.fill?.mode).toBe('niche')
  })

  it('Aufsatz + breakDecor erzeugt flush-Cutouts für Schmuck', () => {
    const wall = makeWall({ id: 'w0', storeyIndex: 0, y: 0 })
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      floors: [{ nodes: [], edges: [] }],
      walls: [wall],
      wallHeight: 448,
      wallDepth: 48,
    }
    const dp = createDownpipeFixture('w0', 96, { mount: 'surface', breakDecor: true })
    const { building: next, downpipe } = syncDownpipeNiches(building, dp)
    expect(downpipe.nicheOpeningIds?.w0).toBeTruthy()
    expect(next.walls[0]!.openings[0]!.fill?.mode).toBe('flush')
    expect(next.walls[0]!.openings[0]!.cutoutShape).toBe('rect')
  })

  it('breakDecor aus entfernt Aufsatz-Cutouts', () => {
    const wall = makeWall({ id: 'w0', storeyIndex: 0, y: 0 })
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      floors: [{ nodes: [], edges: [] }],
      walls: [wall],
      wallHeight: 448,
      wallDepth: 48,
    }
    const withFlush = syncDownpipeNiches(
      building,
      createDownpipeFixture('w0', 96, { mount: 'surface', breakDecor: true }),
    )
    const cleared = syncDownpipeNiches(withFlush.building, {
      ...withFlush.downpipe,
      breakDecor: false,
    })
    expect(cleared.downpipe.nicheOpeningIds).toBeUndefined()
    expect(cleared.building.walls[0]!.openings).toHaveLength(0)
  })
})
