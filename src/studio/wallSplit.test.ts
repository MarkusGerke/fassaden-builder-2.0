import { describe, expect, it } from 'vitest'
import type { FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { PLAN_DIAGONAL_STEP } from './constants'
import { finalizeStudioGeometry } from './planGeometry'
import { wallEndPoint, wallStartPoint } from './walls'
import {
  canMergeWallSegments,
  mergeWallSegments,
  shiftWallsBeyondEnd,
  splitStudioWallRange,
  splitWallStackRange,
  wallSplitRangeAt,
  wallSplitStack,
} from './wallSplit'

function studio(id: string, originX: number, width: number, y = 0, openings: Opening[] = [], yawDeg = 0): Wall {
  return {
    id,
    kind: 'studio',
    x: originX,
    y,
    width,
    height: 448,
    depth: WALL_DEPTH,
    originX,
    originZ: 0,
    yawDeg,
    openings,
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    planLinked: true,
    wallColor: '#abcdef',
  }
}

function stateWith(walls: Wall[]): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus',
        wallHeight: 448,
        wallDepth: WALL_DEPTH,
        walls,
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('wallSplitRangeAt', () => {
  it('rastet das Segment um die Hover-Position auf 48 cm', () => {
    const wall = studio('w', 0, 576)
    expect(wallSplitRangeAt(wall, 300, 96)).toEqual({ startCm: 240, endCm: 336 })
    expect(wallSplitRangeAt(wall, 250, 192)).toEqual({ startCm: 144, endCm: 336 })
  })

  it('klemmt an Wandanfang und -ende', () => {
    const wall = studio('w', 0, 384)
    expect(wallSplitRangeAt(wall, 10, 96)).toEqual({ startCm: 0, endCm: 96 })
    expect(wallSplitRangeAt(wall, 380, 96)).toEqual({ startCm: 288, endCm: 384 })
  })

  it('null, wenn das Segment breiter als die Wand ist', () => {
    expect(wallSplitRangeAt(studio('w', 0, 96), 40, 192)).toBeNull()
  })

  it('45°-Wand: Raster ist die Diagonale', () => {
    const wall = studio('w', 0, PLAN_DIAGONAL_STEP * 6, 0, [], 45)
    const range = wallSplitRangeAt(wall, PLAN_DIAGONAL_STEP * 2.6, PLAN_DIAGONAL_STEP * 2)
    expect(range!.startCm / PLAN_DIAGONAL_STEP).toBeCloseTo(2, 5)
  })
})

describe('splitStudioWallRange', () => {
  it('drei Stücke: Reste + Mittelstück, Öffnungen bleiben in Weltlage', () => {
    const win: Opening = { id: 'o', type: 'window', x: 240, y: 96, width: 96, height: 192 }
    const wall = studio('w', 100, 576, 0, [win])
    const result = splitStudioWallRange(wall, { startCm: 192, endCm: 384 })!
    expect(result.parts.map((p) => p.width)).toEqual([192, 192, 192])
    expect(result.parts[1]!.id).toBe(result.middleId)
    expect(result.parts[0]!.id).toBe('w')
    // Kollinear anschließend
    expect(wallStartPoint(result.parts[1]!).x).toBeCloseTo(wallEndPoint(result.parts[0]!).x)
    expect(wallStartPoint(result.parts[2]!).x).toBeCloseTo(wallEndPoint(result.parts[1]!).x)
    // Öffnung liegt bei Welt-X 340..436 → im Mittelstück (Start 292) bei lokal 48
    const middle = result.parts[1]!
    expect(middle.openings).toHaveLength(1)
    expect(middle.openings[0]!.x).toBeCloseTo(48)
    expect(result.parts[0]!.openings).toHaveLength(0)
    expect(result.parts[2]!.openings).toHaveLength(0)
    // Stil erbt
    expect(middle.wallColor).toBe('#abcdef')
  })

  it('Segment am Wandanfang → zwei Stücke, Mittelstück behält die ID', () => {
    const result = splitStudioWallRange(studio('w', 0, 384), { startCm: 0, endCm: 96 })!
    expect(result.parts).toHaveLength(2)
    expect(result.middleId).toBe('w')
    expect(result.parts[0]!.width).toBe(96)
  })

  it('Segment am Wandende → zwei Stücke, Mittelstück ist das neue rechte', () => {
    const result = splitStudioWallRange(studio('w', 0, 384), { startCm: 288, endCm: 384 })!
    expect(result.parts).toHaveLength(2)
    expect(result.middleId).toBe(result.parts[1]!.id)
    expect(result.parts[1]!.width).toBe(96)
  })

  it('Segment = ganze Wand → nichts zu teilen', () => {
    expect(splitStudioWallRange(studio('w', 0, 192), { startCm: 0, endCm: 192 })).toBeNull()
  })
})

describe('splitWallStackRange', () => {
  it('teilt alle Etagen mit gleichem Fußabdruck am selben Segment', () => {
    const state = stateWith([
      studio('eg', 0, 576, 0),
      studio('og', 0, 576, 448),
      studio('other', 1000, 576, 0),
    ])
    const stack = wallSplitStack(state.buildings[0]!.walls[0]!, state.buildings[0]!.walls, 448)
    expect(stack.map((w) => w.id)).toEqual(['eg', 'og'])

    const result = splitWallStackRange(state, 'eg', { startCm: 192, endCm: 384 })!
    expect(result.middleIds).toHaveLength(2)
    const walls = result.state.buildings[0]!.walls
    expect(walls).toHaveLength(7)
    const middles = walls.filter((w) => result.middleIds.includes(w.id))
    expect(middles.map((w) => w.y).sort()).toEqual([0, 448])
    for (const m of middles) {
      expect(m.width).toBe(192)
      expect(m.originX).toBeCloseTo(192)
    }
    // Unbeteiligte Wand unverändert
    expect(walls.find((w) => w.id === 'other')!.width).toBe(576)
    // Finalize läuft ohne Fehler durch und behält die Breiten
    const finalized = finalizeStudioGeometry(result.state)
    expect(finalized.buildings[0]!.walls.filter((w) => result.middleIds.includes(w.id)).every((w) => w.width === 192)).toBe(true)
  })

  it('schmalere Etage ohne Platz bleibt unverändert', () => {
    const state = stateWith([studio('eg', 0, 576, 0), studio('og', 0, 96, 448)])
    const result = splitWallStackRange(state, 'eg', { startCm: 192, endCm: 384 })!
    expect(result.middleIds).toHaveLength(1)
    expect(result.state.buildings[0]!.walls.find((w) => w.id === 'og')!.width).toBe(96)
  })
})

describe('mergeWallSegments („Wand verknüpfen“)', () => {
  it('ein Segment: verschmilzt die ganze kollineare Kette auf allen Etagen, Öffnungen bleiben', () => {
    const opening: Opening = {
      id: 'o1',
      type: 'window',
      x: 400,
      y: 100,
      width: 96,
      height: 144,
    } as Opening
    const base = stateWith([studio('eg', 0, 576, 0, [opening]), studio('og', 0, 576, 448)])
    const split = splitWallStackRange(base, 'eg', { startCm: 192, endCm: 384 })!
    expect(split.state.buildings[0]!.walls).toHaveLength(6)
    expect(canMergeWallSegments(split.state, [split.middleId])).toBe(true)

    const merged = mergeWallSegments(split.state, [split.middleId])!
    const walls = merged.state.buildings[0]!.walls
    expect(walls).toHaveLength(2)
    for (const w of walls) {
      expect(w.width).toBe(576)
      expect(w.originX).toBeCloseTo(0)
    }
    const eg = walls.find((w) => w.y === 0)!
    expect(eg.openings).toHaveLength(1)
    expect(eg.openings[0]!.x).toBeCloseTo(400)
    expect(merged.selectedIds).toHaveLength(1)
    expect(walls.some((w) => w.id === merged.selectedIds[0])).toBe(true)
  })

  it('mehrere Segmente: nur die Auswahl verschmilzt', () => {
    const base = stateWith([studio('eg', 0, 576, 0)])
    const split = splitWallStackRange(base, 'eg', { startCm: 192, endCm: 384 })!
    const walls0 = split.state.buildings[0]!.walls
    const left = walls0.find((w) => Math.abs((w.originX ?? 0) - 0) < 0.5)!
    const merged = mergeWallSegments(split.state, [left.id, split.middleId])!
    const walls = merged.state.buildings[0]!.walls
    expect(walls).toHaveLength(2)
    expect(walls.map((w) => w.width).sort((a, b) => a - b)).toEqual([192, 384])
  })

  it('nichts zu verschmelzen → null', () => {
    const state = stateWith([studio('a', 0, 192), studio('b', 1000, 192)])
    expect(canMergeWallSegments(state, ['a'])).toBe(false)
    expect(mergeWallSegments(state, ['a'])).toBeNull()
  })
})

describe('shiftWallsBeyondEnd (Greifer + Shift)', () => {
  it('streckt das Segment und rückt Folgewände (auch Ecke + parallele Rückwand) mit', () => {
    // Front: a | b | c entlang X; rechte Seitenwand bei x=576; Rückwand parallel bei z=-384.
    const state = stateWith([
      studio('a', 0, 192),
      studio('b', 192, 192),
      studio('c', 384, 192),
      { ...studio('side', 576, 384), yawDeg: 90 },
      { ...studio('back', 0, 576), originZ: -384 },
    ])
    const next = shiftWallsBeyondEnd(state, 'b', 'end', 48)
    const walls = next.buildings[0]!.walls
    const get = (id: string) => walls.find((w) => w.id === id)!
    expect(get('a').width).toBe(192)
    expect(get('a').originX).toBeCloseTo(0)
    expect(get('b').width).toBe(240)
    expect(get('c').width).toBe(192)
    expect(get('c').originX).toBeCloseTo(432)
    expect(get('side').originX).toBeCloseTo(624)
    expect(get('side').width).toBe(384)
    expect(get('back').width).toBe(624)
    expect(get('back').originX).toBeCloseTo(0)
  })

  it('Start-Ende: verschiebt alles davor in Gegenrichtung', () => {
    const state = stateWith([studio('a', 0, 192), studio('b', 192, 192)])
    const next = shiftWallsBeyondEnd(state, 'b', 'start', 48)
    const walls = next.buildings[0]!.walls
    const a = walls.find((w) => w.id === 'a')!
    const b = walls.find((w) => w.id === 'b')!
    expect(a.originX).toBeCloseTo(-48)
    expect(a.width).toBe(192)
    expect(b.originX).toBeCloseTo(144)
    expect(b.width).toBe(240)
  })
})
