import { describe, expect, it } from 'vitest'
import {
  BAY_WINDOW_PRESETS,
  ROUND_BAY_FACETS,
  bayPresetKind,
  bayWallSelectionIds,
  bayWindowGhostSegments,
  buildBayWindowAtPose,
  buildBayWindowWalls,
  roundBayArcPoints,
  type BayWindowPreset,
} from '../studio/bayWindow'
import { createStudioWall, wallEndPoint, wallStartPoint, miterAtWallEnd } from '../studio/walls'
import { finalizeStudioGeometry } from '../studio/planGeometry'
import { WALL_DEPTH } from '../constants/presets'
import { emptyNeighbors, type FacadeState } from '../types/facade'

/** Legacy-Form für Persistenz-Tests (nicht mehr in der Bibliothek). */
const ROUND_BAY_192: BayWindowPreset = {
  id: 'bay-192-round',
  label: 'Erker 192 (rund)',
  frontWidthCm: 192,
  depthCm: 144,
  shape: 'round',
  kind: 'bay',
}

describe('bayWindow assemblies', () => {
  it('katalog: zwei Erker (384 rect/45°) plus Balkon und Loggia', () => {
    const ids = BAY_WINDOW_PRESETS.map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'bay-384-rect',
        'bay-384-45',
        'balcony-192',
        'balcony-384',
        'loggia-192',
        'loggia-384',
      ]),
    )
    expect(ids.filter((id) => id.startsWith('bay-'))).toEqual(['bay-384-rect', 'bay-384-45'])
    expect(bayPresetKind({ kind: undefined })).toBe('bay')
    expect(bayPresetKind({ kind: 'loggia' })).toBe('loggia')
  })

  it('runder Erker (Legacy): eine durchgängige Bogen-Wand statt Facetten', () => {
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true },
      ROUND_BAY_192,
    )
    expect(walls.length).toBe(1)
    const host = walls.find((w) => w.bayWindow)
    expect(host?.bayWindow?.shape).toBe('round')
    expect(host?.bayWindow?.kind).toBe('bay')
    expect(host?.bayWindow?.wallIds).toHaveLength(1)
    expect(host?.arcBay?.frontWidthCm).toBe(192)
    expect(host?.bayRole).toBe('arc')
  })

  it('Loggia-Ghost geht entgegengesetzt zum Erker', () => {
    const bay = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const loggia = BAY_WINDOW_PRESETS.find((p) => p.id === 'loggia-192')!
    const baySegs = bayWindowGhostSegments(0, 0, 0, true, bay)
    const loggiaSegs = bayWindowGhostSegments(0, 0, 0, true, loggia)
    const bayFront = baySegs[1]!
    const loggiaFront = loggiaSegs[1]!
    const bayMidZ = (bayFront.az + bayFront.bz) / 2
    const loggiaMidZ = (loggiaFront.az + loggiaFront.bz) / 2
    expect(Math.sign(bayMidZ)).not.toBe(0)
    expect(Math.sign(loggiaMidZ)).toBe(-Math.sign(bayMidZ))
  })

  it('roundBayArcPoints: Endpunkte auf der Sehne, Scheitel von der Wand weg', () => {
    const pts = roundBayArcPoints(0, 0, 0, true, 192, 144, ROUND_BAY_FACETS, false)
    expect(pts.length).toBe(ROUND_BAY_FACETS + 1)
    expect(pts[0]!.x).toBeCloseTo(0, 5)
    expect(pts[0]!.z).toBeCloseTo(0, 5)
    expect(pts[pts.length - 1]!.x).toBeCloseTo(192, 5)
    const mid = pts[Math.floor(pts.length / 2)]!
    expect(Math.abs(mid.z)).toBeGreaterThan(50)
    expect(Math.abs(mid.x - 96)).toBeLessThan(40)
  })

  it('bayWallSelectionIds liefert Parent und alle Schenkel', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 288)!
    const all = [built.parent, ...built.walls]
    const side = built.walls.find((w) => w.bayRole === 'side')!
    const ids = bayWallSelectionIds(all, side.id)
    expect(ids).toEqual(expect.arrayContaining([built.parent.id, ...built.parent.bayWindow!.wallIds!]))
    expect(ids?.length).toBe(4)
  })

  it('rechteckiger Erker: Seitenwände haben unterschiedliche panelFlip (links/rechts)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 288)
    expect(built).not.toBeNull()
    const sides = built!.walls.filter((w) => w.bayRole === 'side')
    expect(sides).toHaveLength(2)
    expect(sides[0]!.panelFlip).not.toBe(sides[1]!.panelFlip)
  })

  it('rechteckiger Erker: Frontwand hat Preset-Breite (384 cm)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 288)
    expect(built).not.toBeNull()
    const front = built!.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBe(384)
  })

  it('rechteckiger Erker: Front schließt an beide Seitenenden (±2 cm)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 288)
    expect(built).not.toBeNull()
    const walls = built!.walls
    const front = walls.find((w) => w.bayRole === 'front')!
    const sides = walls.filter((w) => w.bayRole === 'side')
    expect(sides).toHaveLength(2)
    const leftEnd = wallEndPoint(sides[0]!)
    const rightEnd = wallEndPoint(sides[1]!)
    const frontStart = wallStartPoint(front)
    const frontEnd = wallEndPoint(front)
    const d1 = Math.hypot(leftEnd.x - frontStart.x, leftEnd.z - frontStart.z)
    const d2 = Math.hypot(rightEnd.x - frontEnd.x, rightEnd.z - frontEnd.z)
    expect(d1).toBeLessThanOrEqual(2)
    expect(d2).toBeLessThanOrEqual(2)
    expect(walls.every((w) => w.planLinked === true)).toBe(true)
  })

  it('45°-Erker: Front = 384 cm, Ansatz = W+2D, Schenkel schließen an', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-45')!
    const attachW = 384 + 2 * 144
    const parent = {
      ...createStudioWall(0, 0),
      width: attachW + 48,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)
    expect(built).not.toBeNull()
    const sides = built!.walls.filter((w) => w.bayRole === 'side')
    const expected = 144 / Math.cos(Math.PI / 4)
    for (const side of sides) {
      expect(side.width).toBeCloseTo(expected, 5)
    }
    const front = built!.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(384, 5)
    const leftEnd = wallEndPoint(sides[0]!)
    const rightEnd = wallEndPoint(sides[1]!)
    const fs = wallStartPoint(front)
    const fe = wallEndPoint(front)
    expect(Math.hypot(leftEnd.x - fs.x, leftEnd.z - fs.z)).toBeLessThanOrEqual(2)
    expect(Math.hypot(rightEnd.x - fe.x, rightEnd.z - fe.z)).toBeLessThanOrEqual(2)
  })

  it('Ansatz liegt auf Parent-Planlinie (kein half-depth-Offset)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      depth: 32,
    }
    const built = buildBayWindowWalls(parent, preset, 288)!
    const side = built.walls.find((w) => w.bayRole === 'side')!
    expect(Math.abs(wallStartPoint(side).z)).toBeLessThan(0.5)
  })

  it('Front-Ecken haben Gehrung nach finalize', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-rect')!
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 448 },
      preset,
    )
    const state = {
      buildings: [
        {
          id: 'b1',
          name: 'B',
          wallHeight: 448,
          wallDepth: WALL_DEPTH,
          walls,
          floors: [],
          groups: [],
        },
      ],
      activeBuildingId: 'b1',
      neighbors: emptyNeighbors(),
    } as FacadeState
    const fin = finalizeStudioGeometry(state)
    const w = fin.buildings[0]!.walls
    const front = w.find((item) => item.bayRole === 'front')!
    expect(Math.abs(miterAtWallEnd(front, 'start', w))).toBeGreaterThan(1)
    expect(Math.abs(miterAtWallEnd(front, 'end', w))).toBeGreaterThan(1)
  })

  it('45°-Erker-Ghost: Ansatzbreite W+2D', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-384-45')!
    const segs = bayWindowGhostSegments(0, 0, 0, true, preset)
    expect(segs).toHaveLength(3)
    const attach = Math.hypot(segs[0]!.ax - segs[2]!.ax, segs[0]!.az - segs[2]!.az)
    expect(attach).toBeCloseTo(384 + 2 * 144, 5)
    const front = Math.hypot(segs[1]!.ax - segs[1]!.bx, segs[1]!.az - segs[1]!.bz)
    expect(front).toBeCloseTo(384, 5)
  })

  it('Ellipsenbogen: Scheitel = Tiefe, kein Kreis (Radius ≠ W/2)', () => {
    const W = 192
    const D = 144
    const pts = roundBayArcPoints(0, 0, 0, true, W, D, ROUND_BAY_FACETS, false)
    const mid = pts[Math.floor(pts.length / 2)]!
    expect(Math.abs(mid.z)).toBeCloseTo(D, 5)
    expect(Math.abs(Math.abs(mid.z) - W / 2)).toBeGreaterThan(20)
    expect(pts[0]!.x).toBeCloseTo(0, 5)
    expect(pts[pts.length - 1]!.x).toBeCloseTo(W, 5)
  })

  it('Balkon: Front-Brüstung 96 cm hoch, 16 cm dick', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'balcony-192')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 384,
      height: 336,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 192)
    expect(built).not.toBeNull()
    const front = built!.walls.find((w) => w.bayRole === 'front')!
    expect(front.height).toBe(96)
    expect(front.depth).toBe(16)
    const sides = built!.walls.filter((w) => w.bayRole === 'side')
    expect(sides.every((w) => w.height === 336)).toBe(true)
  })

  it('Standalone-Balkon enthält Hauswand (back)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'balcony-192')!
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 320 },
      preset,
    )
    expect(walls.some((w) => w.bayRole === 'back')).toBe(true)
    expect(walls.length).toBe(4)
  })
})
