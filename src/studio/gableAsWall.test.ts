import { describe, expect, it } from 'vitest'
import type { Building } from '../types/facade'
import { PLAN_GRID_LEGACY_SCALE } from './constants'
import { createEmptyFloorPlan, drawPlanLine } from './floorPlan'
import {
  clipRectBandToGableProfile,
  clipTilesToGableProfile,
  gablePanelClipForWall,
  resolveGableHostWallId,
  wallHasGablePanels,
} from './gableAsWall'
import { DEFAULT_ROOF, listRoofEdges, normalizeRoof, roofEnvelopeForBuilding, roofWallTopTrimCm } from './roof'
import { buildRoofEnvelopeGeometry, envelopeY } from './roofForms'
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

  it('gablePanelClipForWall bleibt unter der Dach-Unterseite (nicht Oberhaut)', () => {
    const building = rectGableBuilding(true)
    const roof = normalizeRoof(building.roof)
    const edges = listRoofEdges(building, roof)
    const gableEdge = edges.find((e) => e.flush && e.wallId)!
    const wall = building.walls.find((w) => w.id === gableEdge.wallId)!
    const env = roofEnvelopeForBuilding(building, roof)!
    const clip = gablePanelClipForWall(building, wall)!
    const midWorld = {
      x: (gableEdge.a.x + gableEdge.b.x) / 2,
      z: (gableEdge.a.z + gableEdge.b.z) / 2,
    }
    const roofTop = envelopeY(env.planes, midWorld)
    const soffit = roofTop - env.tv
    const clipWorldY = wall.y + clip.maxLocalYAt(wall.width / 2)
    expect(clipWorldY).toBeLessThanOrEqual(soffit + 0.01)
    expect(clipWorldY).toBeGreaterThan(soffit - 2)
    // Alte Bug-Lage: knapp unter Oberhaut → Kanten durch die Platte
    expect(clipWorldY).toBeLessThan(roofTop - env.tv * 0.5)
  })

  it('roofWallTopTrimCm kürzt Traufe, Giebel bleibt 0', () => {
    const building = rectGableBuilding(true)
    const roof = normalizeRoof(building.roof)
    const edges = listRoofEdges(building, roof)
    const gable = edges.find((e) => e.flush && e.wallId)!
    const eave = edges.find((e) => !e.flush && e.wallId)!
    const gableWall = building.walls.find((w) => w.id === gable.wallId)!
    const eaveWall = building.walls.find((w) => w.id === eave.wallId)!
    expect(roofWallTopTrimCm(building, gableWall)).toBe(0)
    expect(roofWallTopTrimCm(building, eaveWall)).toBeGreaterThan(0)
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

  it('clipRectBandToGableProfile schneidet die Mörtelplatte auf das Dreieck', () => {
    // Sattel: First bei x=200 → Y=500, Traufe bei x=0/400 → Y=300.
    const peak = 500
    const eave = 300
    const halfW = 200
    const maxY = (x: number) => {
      const t = Math.abs(x - halfW) / halfW
      return peak - t * (peak - eave)
    }
    const band = { x: 0, y: 0, width: 400, height: 600 }
    const parts = clipRectBandToGableProfile([band], maxY, 8)
    expect(parts.length).toBeGreaterThan(10)
    const mid = parts.find((p) => p.x <= halfW && p.x + p.width >= halfW)!
    expect(mid.height).toBeLessThanOrEqual(peak + 0.01)
    expect(mid.height).toBeGreaterThan(peak - 12)
    const left = parts[0]!
    expect(left.height).toBeLessThanOrEqual(eave + 8)
    expect(Math.max(...parts.map((p) => p.y + p.height))).toBeLessThanOrEqual(peak + 0.01)
    // Kein Streifen ragt über die Extended-Höhe hinaus und nichts oberhalb First.
    expect(parts.every((p) => p.y + p.height <= peak + 1e-6)).toBe(true)
  })

  it('clipRectBandToGableProfile lässt Bogen-/Outline-Teile unangetastet', () => {
    const withArc = {
      x: 0,
      y: 0,
      width: 40,
      height: 100,
      topArc: [{ x: 0, y: 100 }, { x: 40, y: 80 }],
    }
    const kept = clipRectBandToGableProfile([withArc], () => 50)
    expect(kept).toHaveLength(1)
    expect(kept[0]).toBe(withArc)
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

  it('Giebel-Extension: Mesh-Mittelpunkt folgt layoutWall.height (kein Y-Versatz)', () => {
    const building = rectGableBuilding(true)
    const edges = listRoofEdges(building, normalizeRoof(building.roof))
    const gableEdge = edges.find((e) => e.flush && e.wallId)
    const wall = building.walls.find((w) => w.id === gableEdge!.wallId)!
    const clip = gablePanelClipForWall(building, wall)!
    const layout = { ...wall, height: clip.extendedHeight }
    // worldY(wallY) = wall.y + height/2 + (wallY - height/2) = wall.y + wallY
    // nur wenn Transform und localY dieselbe height nutzen.
    const centerOrig = wall.y + wall.height / 2
    const centerExt = layout.y + layout.height / 2
    const shiftIfWrong = centerOrig - centerExt // negativ: Mesh zu tief
    expect(shiftIfWrong).toBeLessThan(-1)
    // Korrekte Platzierung: centerExt — dann wallY=0 → world = wall.y
    expect(centerExt - layout.height / 2).toBeCloseTo(wall.y, 5)
    expect(centerExt + layout.height / 2).toBeCloseTo(wall.y + clip.extendedHeight, 5)
  })
})
