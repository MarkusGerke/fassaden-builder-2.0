import { describe, expect, it } from 'vitest'
import {
  BAY_WINDOW_PRESETS,
  ROUND_BAY_FACETS,
  bayMinMouthWidthCm,
  bayMouthWidthCm,
  bayPresetKind,
  baySideWindowWidthCm,
  bayWallSelectionIds,
  bayWindowGhostSegments,
  bayWindowPreviewSvg,
  buildBayWindowAtPose,
  buildBayWindowWalls,
  layoutBayFrontOpenings,
  layoutBaySideOpenings,
  maxBayWindowsOnWall,
  roundBayArcPoints,
  scaleBayPresetToMouthWidth,
  type BayWindowPreset,
} from '../studio/bayWindow'
import { createStudioWall, wallEndPoint, wallStartPoint, miterAtWallEnd } from '../studio/walls'
import { finalizeStudioGeometry } from '../studio/planGeometry'
import { WALL_DEPTH, WINDOW_SILL_Y } from '../constants/presets'
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

function bayPreset(shape: 'rect' | 'angled45', front: number, depth: number): BayWindowPreset {
  const shapeKey = shape === 'rect' ? 'rect' : '45'
  const found = BAY_WINDOW_PRESETS.find(
    (p) => p.id === `bay-f${front}-d${depth}-${shapeKey}`,
  )
  if (!found) throw new Error(`missing preset bay-f${front}-d${depth}-${shapeKey}`)
  return found
}

describe('bayWindow assemblies', () => {
  it('katalog: 16 Erker (90°/45° × Fronten × Tiefen) plus Balkon und Loggia', () => {
    const bayIds = BAY_WINDOW_PRESETS.filter((p) => bayPresetKind(p) === 'bay').map((p) => p.id)
    expect(bayIds).toHaveLength(16)
    expect(bayIds).toContain('bay-f192-d96-rect')
    expect(bayIds).toContain('bay-f576-d144-45')
    expect(bayIds.some((id) => id === 'bay-384-rect')).toBe(false)
    expect(BAY_WINDOW_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining(['balcony-192', 'balcony-384', 'loggia-192', 'loggia-384']),
    )
    expect(bayPresetKind({ kind: undefined })).toBe('bay')
    expect(bayPresetKind({ kind: 'loggia' })).toBe('loggia')
  })

  it('Fenster-Layout: Außenrand ≥ 24, Abstand ≥ 48; Frontbreiten wie spezifiziert', () => {
    expect(maxBayWindowsOnWall(192, 96)).toBe(1)
    expect(maxBayWindowsOnWall(288, 96)).toBe(2)
    expect(maxBayWindowsOnWall(384, 96)).toBe(2)
    expect(maxBayWindowsOnWall(576, 96)).toBe(4)
    const one = layoutBayFrontOpenings(192)
    expect(one).toHaveLength(1)
    expect(one[0]!.width).toBe(96)
    expect(one[0]!.x).toBeCloseTo(48, 5)
    expect(one[0]!.y).toBe(WINDOW_SILL_Y)
    const two = layoutBayFrontOpenings(288)
    expect(two).toHaveLength(2)
    expect(two[1]!.x - (two[0]!.x + two[0]!.width)).toBeCloseTo(48, 5)
    expect(two[0]!.x).toBeCloseTo(24, 5)
    expect(baySideWindowWidthCm(96)).toBe(48)
    expect(baySideWindowWidthCm(144)).toBe(96)
    const side96 = layoutBaySideOpenings(96, 96)
    expect(side96).toHaveLength(1)
    expect(side96[0]!.width).toBe(48)
    expect(side96[0]!.x).toBeCloseTo(24, 5)
  })

  it('scaleBayPresetToMouthWidth: 90° Front = Segment, 45° Front = Segment − 2×Tiefe', () => {
    const rect = bayPreset('rect', 288, 96)
    const angled = bayPreset('angled45', 288, 96)
    expect(scaleBayPresetToMouthWidth(rect, 192)?.frontWidthCm).toBe(192)
    expect(scaleBayPresetToMouthWidth(rect, 384)?.frontWidthCm).toBe(384)
    const a576 = scaleBayPresetToMouthWidth(angled, 576)!
    expect(a576.frontWidthCm).toBe(576 - 2 * 96)
    expect(a576.depthCm).toBe(96)
    expect(bayMouthWidthCm(a576)).toBe(576)
    expect(scaleBayPresetToMouthWidth(angled, 192)).toBeNull()
    expect(bayMinMouthWidthCm(angled)).toBe(2 * 96 + 8)
  })

  it('runder Erker (Legacy): eine durchgängige Bogen-Wand statt Facetten', () => {
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true },
      ROUND_BAY_192,
    )
    expect(walls).toHaveLength(1)
    const host = walls.find((w) => w.bayWindow)
    expect(host?.bayWindow?.shape).toBe('round')
    expect(host?.bayWindow?.kind).toBe('bay')
    expect(host?.bayWindow?.wallIds).toHaveLength(1)
  })

  it('Loggia-Ghost geht entgegengesetzt zum Erker', () => {
    const bay = bayPreset('rect', 288, 96)
    const loggia = BAY_WINDOW_PRESETS.find((p) => p.id === 'loggia-192')!
    const baySegs = bayWindowGhostSegments(0, 0, 0, true, bay)
    const loggiaSegs = bayWindowGhostSegments(0, 0, 0, true, loggia)
    expect(Math.sign(baySegs[0]!.bz - baySegs[0]!.az)).not.toBe(
      Math.sign(loggiaSegs[0]!.bz - loggiaSegs[0]!.az),
    )
  })

  it('bayWallSelectionIds liefert die drei Erker-Flächen ohne Duplikat', () => {
    const preset = bayPreset('rect', 288, 96)
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true },
      preset,
    )
    const parent = walls.find((w) => w.bayWindow)!
    const ids = bayWallSelectionIds(walls, parent.id)
    expect(ids).toEqual(parent.bayWindow!.wallIds)
    expect(new Set(ids).size).toBe(3)
    const side = walls.find((w) => w.bayRole === 'side')!
    expect(bayWallSelectionIds(walls, side.id)).toEqual(ids)
  })

  it('Erker bekommen echte Fenster auf Front und Schenkeln (editierbar)', () => {
    const preset = bayPreset('rect', 288, 96)
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      preset,
    )
    const front = walls.find((w) => w.bayRole === 'front')!
    const sides = walls.filter((w) => w.bayRole === 'side')
    expect(front.openings).toHaveLength(2)
    expect(front.openings.every((o) => o.type === 'window' && o.width === 96 && o.height === 192)).toBe(
      true,
    )
    expect(front.openings[0]!.y).toBe(WINDOW_SILL_Y)
    expect(sides.every((s) => s.openings.length === 1 && s.openings[0]!.width === 48)).toBe(true)
    // IDs sind eindeutig — Verschieben/Löschen wie normale Öffnungen.
    const ids = walls.flatMap((w) => w.openings.map((o) => o.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('Tiefe 144: Schenkel mit 96er Fenster', () => {
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      bayPreset('rect', 192, 144),
    )
    const sides = walls.filter((w) => w.bayRole === 'side')
    expect(sides.every((s) => s.openings[0]?.width === 96)).toBe(true)
    const front = walls.find((w) => w.bayRole === 'front')!
    expect(front.openings).toHaveLength(1)
  })

  it('rechteckiger Erker wie Vorlage: Umlauf Mund→Front→Mund, alle Wände gleiches panelFlip', () => {
    const preset = bayPreset('rect', 288, 96)
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)!
    const sides = built.walls.filter((w) => w.bayRole === 'side')
    const front = built.walls.find((w) => w.bayRole === 'front')!
    expect(sides).toHaveLength(2)
    const yawDiff = Math.abs((((sides[0]!.yawDeg! - sides[1]!.yawDeg!) % 360) + 360) % 360)
    expect(yawDiff).toBeCloseTo(180, 5)
    expect(sides[0]!.panelFlip).toBe(front.panelFlip)
    expect(sides[1]!.panelFlip).toBe(front.panelFlip)
    const outward = (w: { yawDeg?: number; panelFlip?: boolean }) => {
      const r = ((w.yawDeg ?? 0) * Math.PI) / 180
      return (w.panelFlip ?? true)
        ? { x: -Math.sin(r), z: -Math.cos(r) }
        : { x: Math.sin(r), z: Math.cos(r) }
    }
    expect(outward(sides[0]!).x).toBeCloseTo(-1, 5)
    expect(outward(sides[1]!).x).toBeCloseTo(1, 5)
    expect(outward(front).z).toBeCloseTo(-1, 5)
  })

  it('rechteckiger Erker bei panelFlip=false: Schenkel-Außenseiten nach außen (nicht Paneele innen)', () => {
    const preset = bayPreset('rect', 288, 96)
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: false,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)!
    const sides = built.walls.filter((w) => w.bayRole === 'side')
    const front = built.walls.find((w) => w.bayRole === 'front')!
    const outward = (w: { yawDeg?: number; panelFlip?: boolean }) => {
      const r = ((w.yawDeg ?? 0) * Math.PI) / 180
      return (w.panelFlip ?? true)
        ? { x: -Math.sin(r), z: -Math.cos(r) }
        : { x: Math.sin(r), z: Math.cos(r) }
    }
    // Vorsprung +Z: linker Schenkel −X, rechter +X, Front +Z
    expect(outward(sides[0]!).x).toBeCloseTo(-1, 5)
    expect(outward(sides[1]!).x).toBeCloseTo(1, 5)
    expect(outward(front).z).toBeCloseTo(1, 5)
    expect(sides[0]!.panelFlip).toBe(front.panelFlip)
    expect(sides[1]!.panelFlip).toBe(front.panelFlip)
  })

  it('45°-Erker bei panelFlip=false: Schenkel zeigen nach außen', () => {
    const preset = bayPreset('angled45', 288, 96)
    const mouth = bayMouthWidthCm(preset)
    const parent = {
      ...createStudioWall(0, 0),
      width: mouth + 64,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: false,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)!
    const sides = built.walls.filter((w) => w.bayRole === 'side')
    const front = built.walls.find((w) => w.bayRole === 'front')!
    const outward = (w: { yawDeg?: number; panelFlip?: boolean }) => {
      const r = ((w.yawDeg ?? 0) * Math.PI) / 180
      return (w.panelFlip ?? true)
        ? { x: -Math.sin(r), z: -Math.cos(r) }
        : { x: Math.sin(r), z: Math.cos(r) }
    }
    const bayCx =
      (wallStartPoint(sides[0]!).x +
        wallEndPoint(sides[1]!).x +
        wallStartPoint(front).x +
        wallEndPoint(front).x) /
      4
    const bayCz =
      (wallStartPoint(sides[0]!).z +
        wallEndPoint(sides[1]!).z +
        wallStartPoint(front).z +
        wallEndPoint(front).z) /
      4
    for (const side of sides) {
      const mid = {
        x: (wallStartPoint(side).x + wallEndPoint(side).x) / 2,
        z: (wallStartPoint(side).z + wallEndPoint(side).z) / 2,
      }
      const away = { x: mid.x - bayCx, z: mid.z - bayCz }
      const n = outward(side)
      expect(n.x * away.x + n.z * away.z).toBeGreaterThan(0)
    }
    const frontN = outward(front)
    expect(frontN.z).toBeGreaterThan(0)
  })

  it('rechteckiger Erker: Frontwand hat Preset-Breite, Schenkel = Tiefe', () => {
    const preset = bayPreset('rect', 288, 96)
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)!
    const front = built.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(288, 5)
    const sides = built.walls.filter((w) => w.bayRole === 'side')
    expect(sides.every((s) => Math.abs(s.width - 96) < 0.5)).toBe(true)
  })

  it('rechteckiger Erker: Front schließt an beide Seitenenden (±2 cm)', () => {
    const preset = bayPreset('rect', 288, 96)
    const parent = {
      ...createStudioWall(0, 0),
      width: 576,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)!
    const sides = built.walls.filter((w) => w.bayRole === 'side')
    const front = built.walls.find((w) => w.bayRole === 'front')!
    const leftEnd = wallEndPoint(sides[0]!)
    const rightStart = wallStartPoint(sides[1]!)
    const fs = wallStartPoint(front)
    const fe = wallEndPoint(front)
    expect(Math.hypot(leftEnd.x - fs.x, leftEnd.z - fs.z)).toBeLessThanOrEqual(2)
    expect(Math.hypot(rightStart.x - fe.x, rightStart.z - fe.z)).toBeLessThanOrEqual(2)
    expect(built.walls.every((w) => w.planLinked === true)).toBe(true)
  })

  it('45°-Erker: Schenkel fest (D√2), Front = Preset, Ansatz = Front+2D', () => {
    const preset = bayPreset('angled45', 288, 96)
    const mouth = bayMouthWidthCm(preset)
    expect(mouth).toBe(288 + 2 * 96)
    const parent = {
      ...createStudioWall(0, 0),
      width: mouth + 64,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, preset, parent.width / 2)
    expect(built).not.toBeNull()
    const sides = built!.walls.filter((w) => w.bayRole === 'side')
    const expectedSide = 96 / Math.cos(Math.PI / 4)
    expect(sides.every((s) => Math.abs(s.width - expectedSide) < 0.5)).toBe(true)
    const front = built!.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(288, 5)
    const leftEnd = wallEndPoint(sides[0]!)
    const rightStart = wallStartPoint(sides[1]!)
    const fs = wallStartPoint(front)
    const fe = wallEndPoint(front)
    expect(Math.hypot(leftEnd.x - fs.x, leftEnd.z - fs.z)).toBeLessThanOrEqual(2)
    expect(Math.hypot(rightStart.x - fe.x, rightStart.z - fe.z)).toBeLessThanOrEqual(2)
    expect(sides.every((s) => s.panelFlip === front.panelFlip)).toBe(true)
  })

  it('45° skalieren: Schenkeltiefe bleibt, Front = Mund − 2D', () => {
    const base = bayPreset('angled45', 288, 96)
    const scaled = scaleBayPresetToMouthWidth(base, 480)!
    expect(scaled.depthCm).toBe(96)
    expect(scaled.frontWidthCm).toBe(480 - 192)
    const parent = {
      ...createStudioWall(0, 0),
      width: 480,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const built = buildBayWindowWalls(parent, scaled, parent.width / 2)!
    const front = built.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(288, 5)
    // Nach Skalierung auf 480 Mund / Front 288: 2 Frontfenster bleiben.
    expect(front.openings).toHaveLength(2)
  })

  it('Standalone-Pose: drei Wände, Gehrung nach finalize', () => {
    const preset = bayPreset('rect', 288, 96)
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      preset,
    )
    expect(walls).toHaveLength(3)
    let state = {
      buildings: [
        {
          id: 'b1',
          name: 'B',
          wallHeight: 512,
          wallDepth: WALL_DEPTH,
          walls,
          floors: [],
          groups: [],
        },
      ],
      activeBuildingId: 'b1',
      neighbors: emptyNeighbors(),
    } as FacadeState
    state = finalizeStudioGeometry(state)
    const next = state.buildings[0]!.walls
    for (const wall of next) {
      for (const end of ['start', 'end'] as const) {
        const m = miterAtWallEnd(wall, end, next)
        expect(Number.isFinite(m)).toBe(true)
      }
    }
  })

  it('45° Standalone: Schenkel mit korrekter Länge und Fenster', () => {
    const preset = bayPreset('angled45', 288, 144)
    const walls = buildBayWindowAtPose(
      { originX: 0, originZ: 0, y: 0, yawDeg: 0, panelFlip: true, height: 512 },
      preset,
    )
    const sides = walls.filter((w) => w.bayRole === 'side')
    const expected = 144 / Math.cos(Math.PI / 4)
    expect(sides.every((s) => Math.abs(s.width - expected) < 0.5)).toBe(true)
    expect(sides.every((s) => s.openings[0]?.width === 96)).toBe(true)
  })

  it('Vorschau-SVG: Außenansicht schräg oben mit Fensterflächen', () => {
    const svg = bayWindowPreviewSvg(bayPreset('rect', 288, 96))
    expect(svg).toContain('<svg')
    expect(svg).toContain('#8ebfd4')
    expect(svg).toContain('#f3ebe0') // Dachfläche
    expect(bayWindowPreviewSvg(bayPreset('angled45', 192, 144))).toContain('<path')
    // Rechter Schenkel bleibt in der Isometrie sichtbar (nicht von der Front verdeckt).
    expect(svg).toContain('#c4b9ac')
  })

  it('roundBayArcPoints: Sehnenenden und Scheitel', () => {
    const pts = roundBayArcPoints(0, 0, 0, true, 192, 96, ROUND_BAY_FACETS, false)
    expect(pts[0]!.x).toBeCloseTo(0, 5)
    expect(pts[pts.length - 1]!.x).toBeCloseTo(192, 5)
    const mid = pts[Math.floor(pts.length / 2)]!
    expect(mid.z).toBeCloseTo(-96, 5)
  })
})
