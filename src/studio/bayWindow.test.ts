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
} from '../studio/bayWindow'
import { createStudioWall, wallEndPoint, wallStartPoint } from '../studio/walls'

describe('bayWindow assemblies', () => {
  it('katalog enthält Balkon, runden Erker und Loggia in 192/384', () => {
    const ids = BAY_WINDOW_PRESETS.map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'bay-192-round',
        'bay-384-round',
        'balcony-192',
        'balcony-384',
        'loggia-192',
        'loggia-384',
      ]),
    )
    expect(bayPresetKind({ kind: undefined })).toBe('bay')
    expect(bayPresetKind({ kind: 'loggia' })).toBe('loggia')
  })

  it('runder Erker: eine durchgängige Bogen-Wand statt Facetten', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-round')!
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true },
      preset,
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
    const bay = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-rect')!
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
    // Scheitel muss von der Sehne wegstehen (Betrag ≈ Tiefe).
    expect(Math.abs(mid.z)).toBeGreaterThan(50)
    expect(Math.abs(mid.x - 96)).toBeLessThan(40)
  })

  it('bayWallSelectionIds liefert Parent und alle Schenkel', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 384,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 192)!
    const all = [built.parent, ...built.walls]
    const side = built.walls.find((w) => w.bayRole === 'side')!
    const ids = bayWallSelectionIds(all, side.id)
    expect(ids).toEqual(expect.arrayContaining([built.parent.id, ...built.parent.bayWindow!.wallIds!]))
    expect(ids?.length).toBe(4)
  })

  it('rechteckiger Erker: Seitenwände haben unterschiedliche panelFlip (links/rechts)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 384,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 192)
    expect(built).not.toBeNull()
    const sides = built!.walls.filter((w) => w.bayRole === 'side')
    expect(sides).toHaveLength(2)
    expect(sides[0]!.panelFlip).not.toBe(sides[1]!.panelFlip)
  })

  it('rechteckiger Erker: Frontwand hat Preset-Breite (192 cm)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 384,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 192)
    expect(built).not.toBeNull()
    const front = built!.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBe(192)
  })

  it('rechteckiger Erker: Front schließt an beide Seitenenden (±2 cm)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-rect')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 384,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 192)
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

  it('45°-Erker: rechte Seite schließt an Front (±2 cm)', () => {
    const preset = BAY_WINDOW_PRESETS.find((p) => p.id === 'bay-192-45')!
    const parent = {
      ...createStudioWall(0, 0),
      width: 384,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, 192)
    expect(built).not.toBeNull()
    const sides = built!.walls.filter((w) => w.bayRole === 'side')
    const expected = 144 / Math.cos(Math.PI / 4)
    for (const side of sides) {
      expect(side.width).toBeCloseTo(expected, 5)
    }
    const front = built!.walls.find((w) => w.bayRole === 'front')!
    const leftEnd = wallEndPoint(sides[0]!)
    const rightEnd = wallEndPoint(sides[1]!)
    const fs = wallStartPoint(front)
    const fe = wallEndPoint(front)
    expect(Math.hypot(leftEnd.x - fs.x, leftEnd.z - fs.z)).toBeLessThanOrEqual(2)
    expect(Math.hypot(rightEnd.x - fe.x, rightEnd.z - fe.z)).toBeLessThanOrEqual(2)
  })

  it('Ellipsenbogen: Scheitel = Tiefe, kein Kreis (Radius ≠ W/2)', () => {
    const W = 192
    const D = 144
    const pts = roundBayArcPoints(0, 0, 0, true, W, D, ROUND_BAY_FACETS, false)
    const mid = pts[Math.floor(pts.length / 2)]!
    expect(Math.abs(mid.z)).toBeCloseTo(D, 5)
    // Bei einem Halbkreis mit Radius W/2 wäre der Scheitel bei W/2 = 96, nicht bei D=144.
    expect(Math.abs(Math.abs(mid.z) - W / 2)).toBeGreaterThan(20)
    // Bogen < 180°: Sehnen-Endpunkte, kein Vollkreis-Rückweg.
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
