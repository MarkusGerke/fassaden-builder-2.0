import { describe, expect, it } from 'vitest'
import type { Building } from '../types/facade'
import { PLAN_GRID_LEGACY_SCALE } from './constants'
import { roofEnvelopeHeightAt } from './roofForms'
import { createEmptyFloorPlan, drawPlanLine } from './floorPlan'
import { createStudioWall } from './walls'
import { buildDownpipeGeometry, createDownpipeFixture } from './downpipe'
import {
  buildMansardRoof,
  DEFAULT_ROOF,
  edgeModesForRoofKind,
  GUTTER_BEAD_RADIUS_CM,
  GUTTER_OUTER_DIAMETER_CM,
  GUTTER_WALL_CM,
  gutterMouthOnWall,
  listRoofEdges,
  normalizeRoof,
  offsetPolygonPerEdge,
  overhangPerEdge,
  roofEaveCorniceDropCm,
  roofEnvelopeForBuilding,
  roofOuterRing,
  type RoofEdgeInfo,
} from './roof'

function bareRectBuilding(): Building {
  const s = PLAN_GRID_LEGACY_SCALE
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
  plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
  plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
  plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
  const wall = (id: string, originX: number, originZ: number, yawDeg: number, width: number) => ({
    ...createStudioWall(originX, 0),
    id,
    originX,
    originZ,
    x: originX,
    yawDeg,
    width,
    depth: 24,
    panelFlip: true,
    planLinked: true,
    panel: { enabled: false, pattern: 'none' as const },
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
  }
}

describe('overhangPerEdge', () => {
  const edge = (mode: RoofEdgeInfo['mode'], flush: boolean): RoofEdgeInfo => ({
    key: 'k',
    index: 0,
    a: { x: 0, z: 0 },
    b: { x: 100, z: 0 },
    lengthCm: 100,
    compass: 'N',
    label: 'N',
    mode,
    flush,
  })

  it('setzt Überstand nur bei explizit bündiger Kante auf 0', () => {
    expect(overhangPerEdge([edge('flush', true)], 40)).toEqual([0])
    expect(overhangPerEdge([edge('auto', true)], 40)).toEqual([40])
    expect(overhangPerEdge([edge('free', false)], 40)).toEqual([40])
  })
})

describe('Traufüberstand – nackte Wand (Arrivieren)', () => {
  it('wendet Traufüberstand trotz auto-bündiger Kante an', () => {
    const building = bareRectBuilding()
    const roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 50,
    })
    const edges = listRoofEdges(building, roof)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.flush)).toBe(true)
    expect(overhangPerEdge(edges, roof.overhang).every((d) => d === 50)).toBe(true)

    const outer = roofOuterRing(building)
    expect(outer).not.toBeNull()
    const eave = offsetPolygonPerEdge(outer!, overhangPerEdge(edges, roof.overhang))
    const spread = Math.max(
      ...outer!.map((p, i) => Math.hypot(p.x - eave[i]!.x, p.z - eave[i]!.z)),
    )
    expect(spread).toBeGreaterThan(40)
  })

  it('Firstrichtung dreht, welche Kanten am Walm und an der Mansarde bündig sind', () => {
    const building = bareRectBuilding()
    for (const wall of building.walls) {
      wall.panel = { enabled: true, pattern: 'runningBond' }
    }
    const alongLong = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'hip',
      ridgeDeg: 90,
    })
    const alongShort = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'mansard',
      ridgeDeg: 0,
    })
    const hipFlush = listRoofEdges(building, alongLong)
      .filter((e) => e.flush)
      .map((e) => e.compass)
      .sort()
    const mansardFlush = listRoofEdges(building, alongShort)
      .filter((e) => e.flush)
      .map((e) => e.compass)
      .sort()
    expect(hipFlush).not.toEqual(mansardFlush)
    expect(hipFlush.length).toBeGreaterThan(0)
    expect(mansardFlush.length).toBeGreaterThan(0)
  })

  it('Gesims sitzt unter der Untersicht und bleibt am Giebel höher', () => {
    const building = bareRectBuilding()
    building.roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 40,
    })
    const env = roofEnvelopeForBuilding(building, building.roof)
    expect(env).not.toBeNull()
    const edges = listRoofEdges(building, building.roof)
    expect(edges.some((e) => e.flush && env!.isEave[e.index])).toBe(true)
    for (const edge of edges) {
      if (!edge.wallId) continue
      const drop = roofEaveCorniceDropCm(building, edge.wallId)
      if (env!.isEave[edge.index] && edge.mode !== 'flush') expect(drop).toBeCloseTo(41, 5)
      else expect(drop).toBe(0)
    }
    building.roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'mansard',
      overhang: 40,
    })
    const mansard = listRoofEdges(building, building.roof)
    let dropped = 0
    for (const edge of mansard) {
      if (!edge.wallId) continue
      const drop = roofEaveCorniceDropCm(building, edge.wallId)
      if (drop === 0) continue
      expect(drop).toBe(11)
      dropped += 1
    }
    expect(dropped).toBeGreaterThan(0)
  })
})

describe('Firstrichtung verschiebt Überstand', () => {
  it('neue Stirnseiten werden bündig, die alten Traufen bekommen den Überstand zurück', () => {
    const building = bareRectBuilding()
    const alongLong = edgeModesForRoofKind(
      building,
      'gable',
      normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'gable', ridgeDeg: 90 }),
    )
    const alongShort = edgeModesForRoofKind(
      building,
      'gable',
      normalizeRoof({ ...DEFAULT_ROOF, enabled: true, kind: 'gable', ridgeDeg: 0 }),
    )
    const zeros = (modes: Record<string, 'flush' | 'free'>, ridgeDeg: number) => {
      const roof = normalizeRoof({
        ...DEFAULT_ROOF,
        enabled: true,
        kind: 'gable',
        ridgeDeg,
        overhang: 40,
        edgeModes: modes,
      })
      return listRoofEdges(building, roof)
        .filter((_, i) => overhangPerEdge(listRoofEdges(building, roof), 40)[i] === 0)
        .map((e) => e.compass)
        .sort()
    }
    const longZeros = zeros(alongLong, 90)
    const shortZeros = zeros(alongShort, 0)
    expect(longZeros.length).toBeGreaterThan(0)
    expect(shortZeros.length).toBeGreaterThan(0)
    expect(longZeros).not.toEqual(shortZeros)
  })
})

describe('Kastentraufe – Mansarde', () => {
  it('baut eine Untersicht, auch wenn die Wände nackt sind', () => {
    const building = bareRectBuilding()
    building.roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'mansard',
      overhang: 40,
    })
    const built = buildMansardRoof({ buildings: [building], activeBuildingId: building.id })
    expect(built?.gable).not.toBeNull()
    expect(built!.gable!.getAttribute('position').count).toBeGreaterThan(6)
    const gutter = built!.gutter
    expect(gutter).not.toBeNull()
    gutter!.computeBoundingBox()
    const box = gutter!.boundingBox!
    const depth = box.max.y - box.min.y
    expect(depth).toBeGreaterThan(GUTTER_OUTER_DIAMETER_CM / 2 - 1)
    expect(depth).toBeLessThan(GUTTER_OUTER_DIAMETER_CM)
    // Geschlossener Ring: alle vier Seiten, nicht nur drei mit offenen Enden.
    expect(box.min.x).toBeLessThan(-46)
    expect(box.max.x).toBeGreaterThan(520)
    expect(box.min.z).toBeLessThan(-46)
    expect(box.max.z).toBeGreaterThan(420)
  })

  it('Sattel und Pult haben eine Rinne, auch wenn die Wände nackt sind', () => {
    const building = bareRectBuilding()
    for (const kind of ['gable', 'shed'] as const) {
      building.roof = normalizeRoof({
        ...DEFAULT_ROOF,
        enabled: true,
        kind,
        pitch: 45,
        overhang: 40,
        gutter: true,
      })
      const built = buildMansardRoof({ buildings: [building], activeBuildingId: building.id })
      expect(built?.gutter, kind).not.toBeNull()
      expect(built!.gutter!.getAttribute('position').count, kind).toBeGreaterThan(20)
    }
  })

  it('offene Rinnenenden sind mit einer Kappe geschlossen', () => {
    const building = bareRectBuilding()
    const roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'mansard',
      overhang: 40,
      gutter: true,
    })
    building.roof = normalizeRoof({
      ...roof,
      edgeModes: edgeModesForRoofKind(building, 'mansard', roof),
    })
    const built = buildMansardRoof({ buildings: [building], activeBuildingId: building.id })
    const pos = built!.gutter!.getAttribute('position')
    const index = built!.gutter!.getIndex()!
    const mouth = gutterMouthOnWall(building, 's', { x: 240, z: 0 })
    expect(mouth).not.toBeNull()
    const yRim = mouth!.yTop
    let disks = 0
    for (let i = 0; i < index.count; i += 3) {
      const ys = [0, 1, 2].map((k) => pos.getY(index.getX(i + k)))
      const xs = [0, 1, 2].map((k) => pos.getX(index.getX(i + k)))
      const zs = [0, 1, 2].map((k) => pos.getZ(index.getX(i + k)))
      const span = Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs),
      )
      const atRim = ys.filter((y) => Math.abs(y - yRim) < 0.2).length
      const drop = yRim - Math.min(...ys)
      // Halbkreis in der Endebene: ein Punkt auf der Oberkante, der Bogen darunter, klein in XZ.
      if (span < 14 && atRim >= 1 && drop > 2) disks += 1
    }
    expect(disks).toBeGreaterThan(8)
    const innerSpan = GUTTER_OUTER_DIAMETER_CM - 2 * GUTTER_WALL_CM
    const rim: Array<{ x: number; z: number }> = []
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getY(i) - yRim) < 0.15) rim.push({ x: pos.getX(i), z: pos.getZ(i) })
    }
    let centers = 0
    for (let i = 0; i < rim.length; i += 1) {
      for (let j = i + 1; j < rim.length; j += 1) {
        const d = Math.hypot(rim[i]!.x - rim[j]!.x, rim[i]!.z - rim[j]!.z)
        if (Math.abs(d - innerSpan) > 0.4) continue
        const mid = { x: (rim[i]!.x + rim[j]!.x) / 2, z: (rim[i]!.z + rim[j]!.z) / 2 }
        if (rim.some((p, k) => k !== i && k !== j && Math.hypot(p.x - mid.x, p.z - mid.z) < 0.35)) centers += 1
      }
    }
    expect(centers).toBeGreaterThan(0)
  })
})

describe('Rinneneisen, Wulst, Schwanenhals', () => {
  it('Rinnenoberkante schließt an der Dachhaut an', () => {
    const building = bareRectBuilding()
    building.roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 40,
      gutter: true,
    })
    const env = roofEnvelopeForBuilding(building)
    const mouth = gutterMouthOnWall(building, 's', { x: 240, z: 0 })
    expect(env).not.toBeNull()
    expect(mouth).not.toBeNull()
    const edge = {
      x: mouth!.x - mouth!.outward.x * (GUTTER_OUTER_DIAMETER_CM / 2),
      z: mouth!.z - mouth!.outward.z * (GUTTER_OUTER_DIAMETER_CM / 2),
    }
    const skin = roofEnvelopeHeightAt(env!, edge)
    expect(mouth!.yTop).toBeCloseTo(skin, 1)
    expect(mouth!.yTop).toBeGreaterThan(skin - env!.tv + 8)
    const built = buildMansardRoof({ buildings: [building], activeBuildingId: building.id })
    const pos = built!.gutter!.getAttribute('position')
    let onSkin = 0
    let onSoffit = 0
    for (let i = 0; i < pos.count; i += 1) {
      const out =
        (pos.getX(i) - edge.x) * mouth!.outward.x + (pos.getZ(i) - edge.z) * mouth!.outward.z
      if (Math.abs(out) > 1.2) continue
      if (Math.abs(pos.getY(i) - skin) < 0.4) onSkin += 1
      if (Math.abs(pos.getY(i) - (skin - env!.tv)) < 0.4) onSoffit += 1
    }
    expect(onSkin).toBeGreaterThan(4)
    expect(onSoffit).toBe(0)
  })


  it('Wulst steht vor der Halbrundkante, Rinneneisen liegen über der Rinne', () => {
    const building = bareRectBuilding()
    building.roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 40,
      gutter: true,
    })
    const built = buildMansardRoof({ buildings: [building], activeBuildingId: building.id })
    const pos = built!.gutter!.getAttribute('position')
    let yMax = -Infinity
    let yMin = Infinity
    let zMin = Infinity
    for (let i = 0; i < pos.count; i += 1) {
      yMax = Math.max(yMax, pos.getY(i))
      yMin = Math.min(yMin, pos.getY(i))
      zMin = Math.min(zMin, pos.getZ(i))
    }
    // Nase über dem Wulst ragt nur wenig über die Dachkante, der Bogen hängt darunter.
    expect(yMax - yMin).toBeGreaterThan(GUTTER_OUTER_DIAMETER_CM / 2)
    expect(yMax - yMin).toBeLessThan(GUTTER_OUTER_DIAMETER_CM / 2 + 3)
    expect(zMin).toBeLessThan(-(40 + GUTTER_OUTER_DIAMETER_CM + GUTTER_BEAD_RADIUS_CM))
  })

  it('Schwanenhals nur an der Traufe, das Rohr endet unter der Rinne', () => {
    const building = bareRectBuilding()
    building.roof = normalizeRoof({
      ...DEFAULT_ROOF,
      enabled: true,
      kind: 'gable',
      pitch: 45,
      overhang: 40,
      gutter: true,
    })
    const onEave = createDownpipeFixture('s', 200)
    const onGable = createDownpipeFixture('e', 160)
    building.downpipes = [onEave, onGable]
    const eaveGeo = buildDownpipeGeometry(building, onEave)!
    const gableGeo = buildDownpipeGeometry(building, onGable)!
    eaveGeo.computeBoundingBox()
    gableGeo.computeBoundingBox()
    const eaveBox = eaveGeo.boundingBox!
    const gableBox = gableGeo.boundingBox!
    expect(eaveBox.min.z).toBeLessThan(-20)
    const mouth = gutterMouthOnWall(building, 's', { x: 200, z: 0 })
    expect(mouth).not.toBeNull()
    expect(eaveBox.max.y).toBeLessThan(mouth!.yTop)
    expect(eaveBox.max.y).toBeGreaterThan(mouth!.yTop - GUTTER_OUTER_DIAMETER_CM)
    expect(gableBox.min.z).toBeGreaterThan(-5)
  })
})
