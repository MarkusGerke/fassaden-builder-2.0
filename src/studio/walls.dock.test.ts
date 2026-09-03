import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import {
  adjustDockOrientation,
  attachAngledWallFromEndForVerticalStack,
  expandPlanLinkedWallIds,
  expandWallMoveIds,
  inheritWallFrontFromNeighbor,
  normalizeStudioWall,
  stretchStudioFacade,
} from './walls'
import { updateActiveBuilding } from '../utils/buildings'
import type { FacadeState } from '../types/facade'
import { openingFitsWithinWall } from '../utils/validation'

function wall(partial: Partial<Wall> & { id: string }): Wall {
  return {
    x: 0,
    y: 0,
    width: 128,
    height: 320,
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

describe('adjustDockOrientation', () => {
  it('lässt Winkel ≤ 91° unverändert (Gehrung)', () => {
    const neighbor = wall({ id: 'n', yawDeg: 0 })
    expect(adjustDockOrientation(90, true, neighbor)).toEqual({ yawDeg: 90, panelFlip: true })
    expect(adjustDockOrientation(91, false, neighbor)).toEqual({ yawDeg: 91, panelFlip: false })
  })

  it('dreht um 180° und übernimmt die Nachbar-Front (gleiche Blickrichtung)', () => {
    const neighbor = wall({ id: 'n', yawDeg: 0, panelFlip: true })
    expect(adjustDockOrientation(180, true, neighbor)).toEqual({ yawDeg: 0, panelFlip: true })
    expect(adjustDockOrientation(135, true, neighbor)).toEqual({ yawDeg: 315, panelFlip: true })
  })
})

describe('inheritWallFrontFromNeighbor', () => {
  it('kollinear entgegengesetztes Yaw: Front zeigt in dieselbe Welt-Richtung', () => {
    const neighbor = wall({ id: 'n', yawDeg: 0, panelFlip: true })
    const added = wall({ id: 'a', yawDeg: 180, panelFlip: true })
    const aligned = inheritWallFrontFromNeighbor(added, neighbor)
    expect(aligned.yawDeg).toBe(180)
    expect(aligned.panelFlip).toBe(false)
  })

  it('ändert nichts, wenn die Front schon passt', () => {
    const neighbor = wall({ id: 'n', yawDeg: 0, panelFlip: true })
    const added = wall({ id: 'a', yawDeg: 0, panelFlip: true })
    expect(inheritWallFrontFromNeighbor(added, neighbor)).toBe(added)
  })
})

describe('expandPlanLinkedWallIds', () => {
  it('zieht verknüpfte Nachbarn in die Verschiebe-Menge', () => {
    const a = wall({ id: 'a', originX: 0, originZ: 0, width: 128, yawDeg: 0 })
    const b = wall({
      id: 'b',
      originX: 128,
      originZ: 0,
      width: 128,
      yawDeg: 90,
    })
    const c = wall({
      id: 'c',
      originX: 999,
      originZ: 999,
      width: 64,
      yawDeg: 0,
      planLinked: false,
    })
    expect(expandPlanLinkedWallIds([a, b, c], ['a']).sort()).toEqual(['a', 'b'])
  })
})

describe('expandWallMoveIds', () => {
  it('zieht gleiche Wand auf anderen Etagen mit', () => {
    const eg = wall({ id: 'eg', y: 0, originX: 0, originZ: 0, width: 192 })
    const og = wall({ id: 'og', y: 448, originX: 0, originZ: 0, width: 192 })
    const other = wall({ id: 'x', y: 0, originX: 500, originZ: 0, width: 192 })
    const walls = [eg, og, other]
    expect(expandWallMoveIds(walls, ['eg'], 448).sort()).toEqual(['eg', 'og'])
  })

  it('singleFloor lässt andere Etagen aus', () => {
    const eg = wall({ id: 'eg', y: 0, originX: 0, originZ: 0, width: 192 })
    const og = wall({ id: 'og', y: 448, originX: 0, originZ: 0, width: 192 })
    expect(expandWallMoveIds([eg, og], ['eg'], 448, { singleFloor: true })).toEqual(['eg'])
  })

  it('zieht auch bei abweichender Breite auf anderen Etagen mit', () => {
    const eg = wall({ id: 'eg', y: 0, originX: 0, originZ: 0, width: 240, planLinked: true })
    const og = wall({ id: 'og', y: 448, originX: 0, originZ: 0, width: 192, planLinked: true })
    expect(expandWallMoveIds([eg, og], ['eg'], 448).sort()).toEqual(['eg', 'og'])
  })

  it('planLinked false lässt den Grundriss-Ring aus', () => {
    const a = wall({ id: 'a', y: 0, originX: 0, originZ: 0, width: 192, planLinked: true, yawDeg: 0 })
    const b = wall({ id: 'b', y: 0, originX: 192, originZ: 0, width: 192, planLinked: true, yawDeg: 90 })
    expect(expandWallMoveIds([a, b], ['a'], 448, { planLinked: false })).toEqual(['a'])
  })
})

describe('normalizeStudioWall openings', () => {
  it('entfernt Öffnungen außerhalb der Wand nach Verkleinern', () => {
    const w = wall({
      id: 'w',
      width: 96,
      openings: [
        {
          id: 'o1',
          type: 'window',
          x: 0,
          y: 0,
          width: 32,
          height: 32,
        },
        {
          id: 'o2',
          type: 'window',
          x: 80,
          y: 0,
          width: 32,
          height: 32,
        },
      ],
    })
    const next = normalizeStudioWall({ ...w, width: 48 })
    expect(next.openings.map((o) => o.id)).toEqual(['o1'])
    expect(openingFitsWithinWall(next.openings[0]!, next)).toBe(true)
  })
})

describe('stretchStudioFacade unverknüpft', () => {
  it('ändert nur die losgelöste Wand, Nachbar bleibt', () => {
    const linked = wall({ id: 'a', originX: 0, originZ: 0, width: 192, planLinked: true })
    const free = wall({ id: 'b', originX: 192, originZ: 0, width: 192, planLinked: false })
    let state: FacadeState = {
      buildings: [{ id: 'b1', name: 'Haus', wallHeight: 448, wallDepth: 32, walls: [linked, free], floors: [] }],
      activeBuildingId: 'b1',
    }
    state = updateActiveBuilding(state, (building) => ({
      ...building,
      walls: building.walls.map((item) =>
        item.id === 'b'
          ? { ...item, originX: 192, originZ: 0, width: 144, planLinked: false }
          : item,
      ),
    }))
    const next = stretchStudioFacade(state, 'b', 'end', 48)
    const a = next.buildings[0]!.walls.find((item) => item.id === 'a')!
    const b = next.buildings[0]!.walls.find((item) => item.id === 'b')!
    expect(b.width).toBe(192)
    expect(a.width).toBe(192)
    expect(a.originX).toBe(0)
  })
})

describe('stretchStudioFacade Etagenstapel', () => {
  it('streckt verknüpfte Wände gleicher Flucht auf allen Etagen', () => {
    const eg = wall({ id: 'eg', originX: 0, originZ: 0, width: 192, y: 0, planLinked: true })
    const og = wall({ id: 'og', originX: 0, originZ: 0, width: 192, y: 448, planLinked: true })
    const state: FacadeState = {
      buildings: [
        { id: 'b1', name: 'Haus', wallHeight: 448, wallDepth: 32, walls: [eg, og], floors: [] },
      ],
      activeBuildingId: 'b1',
    }
    const next = stretchStudioFacade(state, 'eg', 'end', 48)
    const egNext = next.buildings[0]!.walls.find((item) => item.id === 'eg')!
    const ogNext = next.buildings[0]!.walls.find((item) => item.id === 'og')!
    expect(egNext.width).toBe(240)
    expect(ogNext.width).toBe(240)
  })
})

describe('attachAngledWallFromEndForVerticalStack', () => {
  it('setzt Abzweig auf allen Etagen', () => {
    const eg = wall({ id: 'eg', originX: 0, originZ: 0, width: 192, y: 0, planLinked: true })
    const og = wall({ id: 'og', originX: 0, originZ: 0, width: 192, y: 448, planLinked: true })
    const state: FacadeState = {
      buildings: [
        { id: 'b1', name: 'Haus', wallHeight: 448, wallDepth: 32, walls: [eg, og], floors: [] },
      ],
      activeBuildingId: 'b1',
    }
    const next = attachAngledWallFromEndForVerticalStack(state, 'eg', 'end', 90, 96, 'branch-eg')
    const walls = next.buildings[0]!.walls
    expect(walls.filter((w) => Math.abs((w.yawDeg ?? 0) - 90) < 2)).toHaveLength(2)
  })
})
