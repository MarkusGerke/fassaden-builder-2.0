import { describe, expect, it } from 'vitest'
import type { Building } from '../types/facade'
import { PLAN_GRID_LEGACY_SCALE } from './constants'
import { createEmptyFloorPlan, drawPlanLine } from './floorPlan'
import {
  clipTilesToGableProfile,
  gablePanelClipForWall,
  resolveGableHostWallId,
  wallHasGablePanels,
} from './gableAsWall'
import { DEFAULT_ROOF, listRoofEdges, normalizeRoof, roofEnvelopeForBuilding } from './roof'
import { buildRoofEnvelopeGeometry } from './roofForms'
import { createStudioWall } from './walls'

function rectGableBuilding(withPanels = false): Building {
  const s = PLAN_GRID_LEGACY_SCALE
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
  plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
  plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
  plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
  const panel = withPanels
    ? { enabled: true, pattern: 'runningBond' as const }
    : { enabled: false, pattern: 'none' as const }
  const wall = (id: string, originX: number, originZ: number, yawDeg: number, width: number) => ({
    ...createStudioWall(originX, 0),
    id,
    originX,
    originZ,
    x: originX,
    yawDeg,
    width,
    height: 448,
    depth: 24,
    panelFlip: true,
    planLinked: true,
    panel,
  })
  return {
    id: 'b1',
    name: 'Haus',
    wallHeight: 448,
    wallDepth: 24,
    walls: [
      wall('n', 0, 384, 0, 480),
      wall('e', 480, 384, 90, 384),
      wall('s', 480, 0, 180, 480),
      wall('w', 0, 0, 270, 384),
    ],
    floors: [plan],
    roof: normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 40,
    }),
  }
}

describe('gableAsWall', () => {
  it('resolveGableHostWallId trifft die Giebelwand in der Mitte der Stirnseite', () => {
    const building = rectGableBuilding()
    const edges = listRoofEdges(building, normalizeRoof(building.roof))
    const gable = edges.find((e) => e.flush || e.compass === 'O' || e.compass === 'W')
    expect(gable?.wallId).toBeTruthy()
    const mid = {
      x: (gable!.a.x + gable!.b.x) / 2,
      y: 448 + 80,
      z: (gable!.a.z + gable!.b.z) / 2,
    }
    // Senkrechte Flächennormale (kein Soffit).
    const wallId = resolveGableHostWallId(building, mid, { x: 1, y: 0, z: 0 })
    expect(wallId).toBe(gable!.wallId)
  })

  it('resolveGableHostWallId liefert null bei waagerechter Normalen (Untersicht)', () => {
    const building = rectGableBuilding()
    const edges = listRoofEdges(building, normalizeRoof(building.roof))
    const gable = edges.find((e) => e.wallId)
    expect(gable).toBeTruthy()
    const mid = {
      x: (gable!.a.x + gable!.b.x) / 2,
      y: 448 + 40,
      z: (gable!.a.z + gable!.b.z) / 2,
    }
    expect(resolveGableHostWallId(building, mid, { x: 0, y: 1, z: 0 })).toBeNull()
  })

  it('gablePanelClipForWall verlängert die Giebelwand über die Geschosshöhe', () => {
    const building = rectGableBuilding(true)
    const edges = listRoofEdges(building, normalizeRoof(building.roof))
    const gableEdge = edges.find((e) => e.flush && e.wallId)
    expect(gableEdge?.wallId).toBeTruthy()
    const wall = building.walls.find((w) => w.id === gableEdge!.wallId)!
    const clip = gablePanelClipForWall(building, wall)
    expect(clip).not.toBeNull()
    expect(clip!.extendedHeight).toBeGreaterThan(wall.height + 2)
    const midY = clip!.maxLocalYAt(wall.width / 2)
    const sideY = clip!.maxLocalYAt(0)
    expect(midY).toBeGreaterThan(sideY + 10)
  })

  it('clipTilesToGableProfile kürzt Steine oberhalb der Schräge', () => {
    const tiles = [
      { x: 0, y: 400, width: 32, height: 200 },
      { x: 0, y: 500, width: 32, height: 40 },
    ]
    // Bei x≈16 liegt die Schräge auf 448 — oberer Stein fällt weg, unterer wird gekürzt.
    const clipped = clipTilesToGableProfile(tiles, () => 448, 448)
    expect(clipped).toHaveLength(1)
    expect(clipped[0]!.height).toBeCloseTo(48, 5)
  })

  it('wallHasGablePanels folgt wallHasPanels', () => {
    const bare = rectGableBuilding(false)
    const panelled = rectGableBuilding(true)
    expect(wallHasGablePanels(bare, 'e')).toBe(false)
    expect(wallHasGablePanels(panelled, 'e')).toBe(true)
  })

  it('skipFillEdgeIndices lässt Füllwand an Paneel-Giebeln weg', () => {
    const building = rectGableBuilding(true)
    const roof = normalizeRoof(building.roof)
    const env = roofEnvelopeForBuilding(building, roof)
    expect(env).not.toBeNull()
    const edges = listRoofEdges(building, roof)
    const skip = new Set(
      edges.filter((e) => e.wallId && wallHasGablePanels(building, e.wallId)).map((e) => e.index),
    )
    expect(skip.size).toBeGreaterThan(0)
    const withSkip = buildRoofEnvelopeGeometry(env!, [], 45, [], [], skip)
    const full = buildRoofEnvelopeGeometry(env!)
    const count = (g: { getAttribute: (n: string) => { count: number } | undefined } | null) =>
      g?.getAttribute('position')?.count ?? 0
    expect(count(withSkip.gable)).toBeLessThan(count(full.gable))
  })
})
