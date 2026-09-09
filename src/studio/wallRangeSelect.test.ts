import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { wallIdsForShiftRange } from './wallRangeSelect'

const H = 320

function wall(partial: Partial<Wall> & { id: string }): Wall {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: H,
    depth: WALL_DEPTH,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    kind: 'studio',
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    panelFlip: true,
    planLinked: true,
    ...partial,
  }
}

/** Rechteck 100×100: N→O→S→W (CCW). */
function rectFloor(y: number, storeyIndex: number, prefix: string): Wall[] {
  return [
    wall({
      id: `${prefix}-n`,
      y,
      storeyIndex,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      width: 100,
    }),
    wall({
      id: `${prefix}-e`,
      y,
      storeyIndex,
      originX: 100,
      originZ: 0,
      yawDeg: 270,
      width: 100,
    }),
    wall({
      id: `${prefix}-s`,
      y,
      storeyIndex,
      originX: 100,
      originZ: 100,
      yawDeg: 180,
      width: 100,
    }),
    wall({
      id: `${prefix}-w`,
      y,
      storeyIndex,
      originX: 0,
      originZ: 100,
      yawDeg: 90,
      width: 100,
    }),
  ]
}

describe('wallIdsForShiftRange', () => {
  it('gleiche Etage gegenüber: kürzerer Umlauf (3 Wände), nicht der lange Weg', () => {
    const walls = rectFloor(0, 0, 'eg')
    const ids = wallIdsForShiftRange(walls, 'eg-n', 'eg-s', H)
    expect(ids).toHaveLength(3)
    expect(ids).toContain('eg-n')
    expect(ids).toContain('eg-s')
    // Ein Seitenweg: entweder O oder W, nicht beide
    const hasE = ids.includes('eg-e')
    const hasW = ids.includes('eg-w')
    expect(hasE !== hasW).toBe(true)
  })

  it('gleiche Etage benachbart: nur die beiden Wände', () => {
    const walls = rectFloor(0, 0, 'eg')
    const ids = wallIdsForShiftRange(walls, 'eg-n', 'eg-e', H)
    expect(ids.sort()).toEqual(['eg-e', 'eg-n'])
  })

  it('gleiche Fassadenseite über Etagen: nur Nordwände, nicht Ost/Süd/West', () => {
    const walls = [
      ...rectFloor(0, 0, 'eg'),
      ...rectFloor(H, 1, 'og1'),
      ...rectFloor(H * 2, 2, 'og2'),
      ...rectFloor(H * 3, 3, 'og3'),
    ]
    const ids = new Set(wallIdsForShiftRange(walls, 'eg-n', 'og3-n', H))
    expect(ids.has('eg-n')).toBe(true)
    expect(ids.has('og1-n')).toBe(true)
    expect(ids.has('og2-n')).toBe(true)
    expect(ids.has('og3-n')).toBe(true)
    expect(ids.has('eg-e')).toBe(false)
    expect(ids.has('og1-s')).toBe(false)
    expect(ids.has('og2-w')).toBe(false)
    expect(ids.size).toBe(4)
  })

  it('Erker-Schenkel nicht mit, wenn nur Front auf dem Fassaden-Streifen liegt', () => {
    const walls = [
      wall({
        id: 'host',
        y: 0,
        storeyIndex: 0,
        originX: 0,
        originZ: 0,
        yawDeg: 0,
        width: 100,
        bayWindow: { wallIds: ['bay-l', 'bay-f', 'bay-r'], depthCm: 96, shape: 'rect' },
      }),
      wall({
        id: 'bay-l',
        y: 0,
        storeyIndex: 0,
        originX: 20,
        originZ: 0,
        yawDeg: 270,
        width: 96,
        bayParentId: 'host',
        bayRole: 'side',
      }),
      wall({
        id: 'bay-f',
        y: 0,
        storeyIndex: 0,
        originX: 20,
        originZ: -96,
        yawDeg: 0,
        width: 60,
        bayParentId: 'host',
        bayRole: 'front',
      }),
      wall({
        id: 'bay-r',
        y: 0,
        storeyIndex: 0,
        originX: 80,
        originZ: 0,
        yawDeg: 90,
        width: 96,
        bayParentId: 'host',
        bayRole: 'side',
      }),
      wall({
        id: 'og-n',
        y: H,
        storeyIndex: 1,
        originX: 0,
        originZ: 0,
        yawDeg: 0,
        width: 100,
      }),
    ]
    const ids = new Set(wallIdsForShiftRange(walls, 'bay-f', 'og-n', H))
    expect(ids.has('bay-f')).toBe(true)
    expect(ids.has('og-n')).toBe(true)
    // Schenkel haben andere Yaw — nur wenn auf dem Pfad/markiert, nicht per Gruppen-Expand
    expect(ids.has('bay-l')).toBe(false)
    expect(ids.has('bay-r')).toBe(false)
  })
})
