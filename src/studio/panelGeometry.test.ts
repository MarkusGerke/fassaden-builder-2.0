import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { FacadeState, Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { createStudioOpeningRevealGeometry, createStudioPanelGeometry, createStudioWallGeometry, innerFaceRingFromWalls } from './panelGeometry'
import { layoutPanelTiles } from './panelLayout'
import { buildingNeedsOuterSpineFit, finalizeStudioGeometry } from './planGeometry'
import { applyFacadeLoadPipeline } from '../utils/facadeLoad'
import {
  createEmptyFloorPlan,
  drawPlanLine,
  extractPlanRings,
  innerFaceRingWorld,
  syncFloorPlansFromWalls,
} from './floorPlan'
import { wallsFromFloorPlan } from './floorPlan'
import {
  attachAngledWallFromEnd,
  createStudioWall,
  panelMiterEnds,
  plinthMiterEnds,
  studioPanelFaceLocalZ,
  studioWallTransform,
} from './walls'

function studioWall(panel?: Wall['panel']): Wall {
  return {
    id: 'w1',
    x: 0,
    y: 0,
    width: 128,
    height: 256,
    depth: 24,
    openings: [],
    profiles: [],
    neighbors: {},
    panel: panel ?? { ...DEFAULT_STUDIO_PANEL },
  }
}

function vertexCount(wall: Wall): number {
  return createStudioWallGeometry(wall).getAttribute('position').count
}

describe('createStudioWallGeometry', () => {
  it('behält Außenfläche bei aktiven Paneelen (gleiche Topologie)', () => {
    const withPanels = studioWall({ ...DEFAULT_STUDIO_PANEL, enabled: true, pattern: 'strip' })
    const withoutPanels = studioWall({ ...DEFAULT_STUDIO_PANEL, enabled: false, pattern: 'none' })
    expect(vertexCount(withPanels)).toBe(vertexCount(withoutPanels))
  })

  it('legt die Innenfläche auf Material-Gruppe 1', () => {
    const geo = createStudioWallGeometry(studioWall())
    expect(geo.groups.length).toBe(2)
    expect(geo.groups[0]?.materialIndex).toBe(0)
    expect(geo.groups[1]?.materialIndex).toBe(1)
    expect(geo.groups[1]!.count).toBeGreaterThan(0)
  })
})

function localToWorld(wall: Wall, localX: number, localZ: number): { x: number; z: number } {
  const t = studioWallTransform(wall)
  const cos = Math.cos(t.rotationY)
  const sin = Math.sin(t.rotationY)
  return {
    x: t.position.x + localX * cos + localZ * sin,
    z: t.position.z - localX * sin + localZ * cos,
  }
}

function panelEndFrontWorld(
  wall: Wall,
  walls: Wall[],
  end: 'start' | 'end',
): { x: number; z: number } {
  const geo = createStudioPanelGeometry(wall, wall.panel!, walls)
  const pos = geo.getAttribute('position') as { getX(i: number): number; getZ(i: number): number; count: number }
  const frontZ = studioPanelFaceLocalZ(wall)
  let bestX = end === 'start' ? Infinity : -Infinity
  let bestZ = frontZ
  for (let i = 0; i < pos.count; i += 1) {
    const z = pos.getZ(i)
    if (Math.abs(z - frontZ) > 0.6) continue
    const x = pos.getX(i)
    if (end === 'start' ? x < bestX : x > bestX) {
      bestX = x
      bestZ = z
    }
  }
  expect(Number.isFinite(bestX)).toBe(true)
  return localToWorld(wall, bestX, bestZ)
}

function stateFromWall(wall: Wall): FacadeState {
  const w = { ...wall, id: 'w', buildingId: 'b1', planLinked: true }
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus',
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        walls: [w],
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('Bilderrahmen-Gehrung an Abzweig-Wänden', () => {
  it('90° rechts: Paneel-Fronten treffen sich an der Ecke', () => {
    const source = { ...createStudioWall(0, 0), id: 'w', width: 192, originX: 0, originZ: 0, yawDeg: 0 as const, buildingId: 'b1', planLinked: true }
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateFromWall(source), 'w', 'end', 90, 96, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const src = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    expect(src.miterEnd).toBeCloseTo(-WALL_DEPTH)
    expect(Math.abs(branch.miterStart ?? 0)).toBeCloseTo(WALL_DEPTH)
    expect(panelMiterEnds(src, walls).end).toBe(true)
    expect(panelMiterEnds(branch, walls).start).toBe(true)
    expect(plinthMiterEnds(src, walls).end).toBe(true)
    expect(plinthMiterEnds(branch, walls).start).toBe(true)

    const a = panelEndFrontWorld(src, walls, 'end')
    const b = panelEndFrontWorld(branch, walls, 'start')
    const gap = Math.hypot(a.x - b.x, a.z - b.z)
    expect(gap, `Frontlücke ${gap.toFixed(2)} cm bei ${JSON.stringify({ a, b, miterSrc: src.miterEnd, miterBr: branch.miterStart })}`).toBeLessThan(2)
  })

  it('90° links: Paneel-Fronten treffen sich an der Ecke', () => {
    const source = { ...createStudioWall(0, 0), id: 'w', width: 192, originX: 0, originZ: 0, yawDeg: 0 as const, buildingId: 'b1', planLinked: true }
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateFromWall(source), 'w', 'start', 90, 96, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const src = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    const a = panelEndFrontWorld(src, walls, 'start')
    const b = panelEndFrontWorld(branch, walls, 'end')
    const gap = Math.hypot(a.x - b.x, a.z - b.z)
    expect(gap, `Frontlücke ${gap.toFixed(2)} cm`).toBeLessThan(2)
  })

  it('45° rechts: Paneel-Fronten treffen sich an der Ecke', () => {
    const source = { ...createStudioWall(0, 0), id: 'w', width: 192, originX: 0, originZ: 0, yawDeg: 0 as const, buildingId: 'b1', planLinked: true }
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateFromWall(source), 'w', 'end', 45, 96, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const src = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    const a = panelEndFrontWorld(src, walls, 'end')
    const b = panelEndFrontWorld(branch, walls, 'start')
    const gap = Math.hypot(a.x - b.x, a.z - b.z)
    expect(gap, `Frontlücke ${gap.toFixed(2)} cm miter=${src.miterEnd}`).toBeLessThan(2)
  })

  it('90°-Ecke mit panelFlip false (Bibliothek-Wand): Fronten treffen sich', () => {
    const a0 = {
      ...createStudioWall(0, 0),
      id: 'a',
      width: 480,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
    }
    const b0 = {
      ...createStudioWall(0, 0),
      id: 'b',
      width: 384,
      originX: 480,
      originZ: 0,
      yawDeg: 270 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
    }
    const state = finalizeStudioGeometry({
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 456,
          wallDepth: WALL_DEPTH,
          walls: [a0, b0],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    })
    const walls = state.buildings[0]!.walls
    const a = walls.find((item) => item.id === 'a')!
    const b = walls.find((item) => item.id === 'b')!
    const pa = panelEndFrontWorld(a, walls, 'end')
    const pb = panelEndFrontWorld(b, walls, 'start')
    const gap = Math.hypot(pa.x - pb.x, pa.z - pb.z)
    expect(gap, `Frontlücke ${gap.toFixed(2)} cm ${JSON.stringify({ pa, pb })}`).toBeLessThan(2)
  })
})

describe('90°-Ecke: Mauerwerk bis zur Außenecke (panelFlip false)', () => {
  const panel = {
    ...DEFAULT_STUDIO_PANEL,
    enabled: true,
    pattern: 'runningBond' as const,
    panelWidth: 64,
    panelHeight: 32,
    cornerJoin: 'none' as const,
    projectDepth: 4,
    taper: 1,
    taperDepth: 0,
    plinthEnabled: false,
    plinthHeight: 0,
    joint: 0.8,
    jointDepth: 0.8,
  }

  function userLCorner() {
    const a0 = {
      ...createStudioWall(0, 0),
      id: 'front',
      width: 1056,
      height: 256,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
      panel,
    }
    // Westwand: Innenkante x=0, z=−400…0, Außenseite −X → konvexe Außenecke am Ursprung.
    const b0 = {
      ...createStudioWall(0, 0),
      id: 'return',
      width: 400,
      height: 256,
      depth: 40,
      originX: 0,
      originZ: -400,
      yawDeg: 270 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
      panel: { ...panel, pattern: 'none' as const, enabled: false },
    }
    const state = finalizeStudioGeometry({
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 256,
          wallDepth: 40,
          walls: [a0, b0],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    })
    return state.buildings[0]!.walls
  }

  function uniqueFrontXs(geo: ReturnType<typeof createStudioPanelGeometry>, frontZ: number, eps = 1.2) {
    const pos = geo.getAttribute('position') as { getX(i: number): number; getZ(i: number): number; count: number }
    const xs: number[] = []
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getZ(i) - frontZ) > 0.8) continue
      const x = pos.getX(i)
      if (!xs.some((v) => Math.abs(v - x) < eps)) xs.push(x)
    }
    return xs.sort((a, b) => a - b)
  }

  it('Paneel-Front reicht bis zur Wandkörper-Außenecke, erste Vertikale 0,5/1', () => {
    const walls = userLCorner()
    const front = walls.find((item) => item.id === 'front')!
    expect(panelMiterEnds(front, walls).start).toBe(true)
    expect(front.miterStart ?? 0, `miterStart sollte positiv sein (Front verlängern), ist ${front.miterStart}`).toBeGreaterThan(20)
    const firstTiles = layoutPanelTiles(front, front.panel!, walls).filter((t) => t.y < 40)
    expect(firstTiles[0]!.x).toBeLessThan(-20)

    const outerZ = front.panelFlip ? 0 : front.depth
    const wallGeo = createStudioWallGeometry(front, walls)
    const wallPos = wallGeo.getAttribute('position') as {
      getX(i: number): number
      getZ(i: number): number
      count: number
    }
    let wallLeft = Infinity
    for (let i = 0; i < wallPos.count; i += 1) {
      if (Math.abs(wallPos.getZ(i) - outerZ) > 1) continue
      wallLeft = Math.min(wallLeft, wallPos.getX(i))
    }

    const frontZ = studioPanelFaceLocalZ(front)
    const panelGeo = createStudioPanelGeometry(front, front.panel!, walls)
    const xs = uniqueFrontXs(panelGeo, frontZ)
    const panelLeft = xs[0]!
    const gapToWall = panelLeft - wallLeft
    const fromLeft = xs.filter((x) => x > panelLeft + 2).map((x) => x - panelLeft)
    const firstJoint = fromLeft[0] ?? NaN

    expect(
      gapToWall,
      `Paneele ${gapToWall.toFixed(1)} cm kürzer als Wandkörper (wallLeft=${wallLeft.toFixed(1)} panelLeft=${panelLeft.toFixed(1)} miterStart=${front.miterStart} joints=${fromLeft.slice(0, 6).map((v) => v.toFixed(1)).join(',')})`,
    ).toBeLessThan(3)

    const nearHalfOrFull = (d: number) => Math.abs(d - 32) < 10 || Math.abs(d - 64) < 10
    expect(
      firstJoint,
      `erste Vertikale ${firstJoint.toFixed(1)} cm von der Ecke — der ~Wandstärke-Streifen ohne Fuge muss weg (joints ${fromLeft.slice(0, 8).map((v) => v.toFixed(1)).join(', ')})`,
    ).toBeLessThan(40)
    expect(
      nearHalfOrFull(firstJoint),
      `erste Vertikale ${firstJoint.toFixed(1)} cm von der Ecke, erwartet 32 oder 64`,
    ).toBe(true)
  })

  it('Bossen-Front (taper) reicht ebenfalls bis zur Außenecke, nicht um die Wandstärke zurück', () => {
    const walls = userLCorner()
    const front = walls.find((item) => item.id === 'front')!
    front.panel = {
      ...panel,
      projectDepth: 6,
      taper: 0.45,
      taperDepth: 6,
    }
    const outerZ = front.depth
    const wallGeo = createStudioWallGeometry(front, walls)
    const wallPos = wallGeo.getAttribute('position') as {
      getX(i: number): number
      getZ(i: number): number
      count: number
    }
    let wallLeft = Infinity
    for (let i = 0; i < wallPos.count; i += 1) {
      if (Math.abs(wallPos.getZ(i) - outerZ) > 1) continue
      wallLeft = Math.min(wallLeft, wallPos.getX(i))
    }

    const bodyFrontZ = studioPanelFaceLocalZ(front)
    const taperFrontZ = bodyFrontZ + 6
    const panelGeo = createStudioPanelGeometry(front, front.panel, walls)
    const pos = panelGeo.getAttribute('position') as {
      getX(i: number): number
      getZ(i: number): number
      count: number
    }
    let bossLeft = Infinity
    let bodyLeft = Infinity
    const bossXs: number[] = []
    for (let i = 0; i < pos.count; i += 1) {
      const z = pos.getZ(i)
      const x = pos.getX(i)
      if (Math.abs(z - bodyFrontZ) < 0.8) bodyLeft = Math.min(bodyLeft, x)
      if (Math.abs(z - taperFrontZ) < 0.8) {
        bossLeft = Math.min(bossLeft, x)
        if (!bossXs.some((v) => Math.abs(v - x) < 1.5)) bossXs.push(x)
      }
    }
    bossXs.sort((a, b) => a - b)
    const fromBoss = bossXs.filter((x) => x > bossLeft + 2).map((x) => x - bossLeft)
    const gapBoss = bossLeft - wallLeft
    const gapBody = bodyLeft - wallLeft

    expect(
      Number.isFinite(bossLeft),
      `keine Bossen-Vertices bei z=${taperFrontZ}`,
    ).toBe(true)
    expect(
      gapBoss,
      `Bossen ${gapBoss.toFixed(1)} cm kürzer als Wand (wall=${wallLeft.toFixed(1)} body=${bodyLeft.toFixed(1)} boss=${bossLeft.toFixed(1)} gapBody=${gapBody.toFixed(1)} joints=${fromBoss.slice(0, 6).map((v) => v.toFixed(1)).join(',')})`,
    ).toBeLessThan(8)
  })
})

describe('Feld-Raster ohne Wand-Scherung', () => {
  it('hält Feld-Fugen auf Plan-X (Öffnungen bleiben unverzerrt)', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      pattern: 'runningBond' as const,
      panelWidth: 64,
      panelHeight: 32,
      cornerJoin: 'miter' as const,
      projectDepth: 4,
      taper: 1,
      taperDepth: 0,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'a',
      width: 1056,
      height: 256,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      panelFlip: false,
      miterStart: 40,
      miterEnd: -16.57,
      planLinked: true,
      panel,
    }
    const neighbor: Wall = {
      ...createStudioWall(0, 0),
      id: 'side',
      width: 400,
      height: 256,
      depth: 40,
      originX: 0,
      originZ: -400,
      yawDeg: 270,
      panelFlip: false,
      planLinked: true,
      panel: { ...panel, pattern: 'none', enabled: false },
    }
    const walls = [wall, neighbor]
    const tiles = layoutPanelTiles(wall, panel, walls)
    const mid = tiles.find((t) => t.x > 200 && t.x + t.width < 800 && t.y < 40)!
    expect(mid).toBeTruthy()
    const geo = createStudioPanelGeometry(wall, panel, walls)
    const pos = geo.getAttribute('position') as { getX(i: number): number; getZ(i: number): number; count: number }
    const frontZ = studioPanelFaceLocalZ(wall)
    const halfW = wall.width / 2
    const planLeft = mid.x - halfW
    const planRight = mid.x + mid.width - halfW
    let leftHits = 0
    let rightHits = 0
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getZ(i) - frontZ) > 0.8) continue
      const x = pos.getX(i)
      if (Math.abs(x - planLeft) < 2) leftHits += 1
      if (Math.abs(x - planRight) < 2) rightHits += 1
    }
    expect(leftHits, 'linke Feld-Fuge muss auf Plan-X liegen, nicht geschert').toBeGreaterThan(0)
    expect(rightHits, 'rechte Feld-Fuge muss auf Plan-X liegen, nicht geschert').toBeGreaterThan(0)
  })
})

describe('Load: Innen-Origin auf Außenkante (panelFlip false)', () => {
  const panel = {
    ...DEFAULT_STUDIO_PANEL,
    enabled: true,
    pattern: 'runningBond' as const,
    panelWidth: 64,
    panelHeight: 32,
    cornerJoin: 'none' as const,
    projectDepth: 4,
    taper: 0.8,
    taperDepth: 2,
    plinthEnabled: false,
    plinthHeight: 0,
    joint: 0.8,
    jointDepth: 0.8,
  }

  function innerLState(): FacadeState {
    const front = {
      ...createStudioWall(0, 0),
      id: 'front',
      width: 1056,
      height: 256,
      depth: 40,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
      panel,
    }
    const side = {
      ...createStudioWall(0, 0),
      id: 'return',
      width: 384,
      height: 256,
      depth: 40,
      originX: 0,
      originZ: -384,
      yawDeg: 270 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
      panel: { ...panel, pattern: 'none' as const, enabled: false },
    }
    return {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 256,
          wallDepth: 40,
          walls: [front, side],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
  }

  it('erkennt panelFlip-false-Grundrisswände als Fit-Bedarf', () => {
    const withPlans = syncFloorPlansFromWalls(innerLState())
    expect(withPlans.buildings[0]!.floors[0]!.nodes.length).toBeGreaterThan(0)
    expect(buildingNeedsOuterSpineFit(withPlans.buildings[0]!)).toBe(true)
  })

  it('legt Origin auf die Außenecke; erste Zeichnungs-Vertikale 0,5/1', () => {
    const withPlans = syncFloorPlansFromWalls(innerLState())
    const { facade } = applyFacadeLoadPipeline(withPlans)
    const walls = facade.buildings[0]!.walls
    const front = walls.find((item) => item.id === 'front')!
    expect(front.panelFlip).toBe(true)
    expect(front.width).toBeGreaterThan(1056)

    const firstTiles = layoutPanelTiles(front, front.panel!, walls).filter((t) => t.y < 40)
    expect(firstTiles[0]!.x).toBeGreaterThan(-12)

    const outerZ = 0
    const wallGeo = createStudioWallGeometry(front, walls)
    const wallPos = wallGeo.getAttribute('position') as {
      getX(i: number): number
      getZ(i: number): number
      count: number
    }
    let wallLeft = Infinity
    for (let i = 0; i < wallPos.count; i += 1) {
      if (Math.abs(wallPos.getZ(i) - outerZ) > 1) continue
      wallLeft = Math.min(wallLeft, wallPos.getX(i))
    }

    const panelGeo = createStudioPanelGeometry(front, front.panel!, walls)
    const edges = new THREE.EdgesGeometry(panelGeo, 20)
    const epos = edges.getAttribute('position') as { getX(i: number): number; getZ(i: number): number; count: number }
    const faceZ = studioPanelFaceLocalZ(front)
    const taperZ = faceZ - 2
    const xs: number[] = []
    for (let i = 0; i < epos.count; i += 1) {
      const z = epos.getZ(i)
      if (Math.abs(z - faceZ) > 1.2 && Math.abs(z - taperZ) > 1.2) continue
      const x = epos.getX(i)
      if (!xs.some((v) => Math.abs(v - x) < 2)) xs.push(x)
    }
    xs.sort((a, b) => a - b)
    const panelLeft = xs[0]!
    const fromLeft = xs.filter((x) => x > panelLeft + 2).map((x) => x - panelLeft)
    const firstJoint = fromLeft.find((d) => d > 8) ?? fromLeft[0] ?? NaN
    expect(panelLeft - wallLeft, `Paneele ${(panelLeft - wallLeft).toFixed(1)} cm kürzer als Wand`).toBeLessThan(8)
    expect(
      Math.abs(firstJoint - 32) < 12 || Math.abs(firstJoint - 64) < 12,
      `erste Zeichnungs-Vertikale ${firstJoint.toFixed(1)} cm von der Ecke, erwartet 32 oder 64 (kanten ${fromLeft.slice(0, 8).map((v) => v.toFixed(1)).join(', ')})`,
    ).toBe(true)
    edges.dispose()
    panelGeo.dispose()
    wallGeo.dispose()
  })
})

describe('innerFaceRingFromWalls', () => {
  function rectanglePlan() {
    let plan = createEmptyFloorPlan()
    plan = drawPlanLine(plan, 0, 0, 10, 0)
    plan = drawPlanLine(plan, 10, 0, 10, 8)
    plan = drawPlanLine(plan, 10, 8, 0, 8)
    plan = drawPlanLine(plan, 0, 8, 0, 0)
    return plan
  }

  it('stimmt bei panelFlip true mit innerFaceRingWorld (Fläche)', () => {
    const plan = rectanglePlan()
    const ring = extractPlanRings(plan).find((item) => item.closed)!
    const walls = wallsFromFloorPlan(plan)
    const fromWalls = innerFaceRingFromWalls(ring.nodes, walls, WALL_DEPTH)
    const fromFormula = innerFaceRingWorld(ring.nodes, WALL_DEPTH)
    const area = (pts: Array<{ x: number; z: number }>) => {
      let sum = 0
      for (let i = 0; i < pts.length; i += 1) {
        const p = pts[i]!
        const q = pts[(i + 1) % pts.length]!
        sum += p.x * q.z - q.x * p.z
      }
      return Math.abs(sum) / 2
    }
    expect(fromWalls.length).toBeGreaterThanOrEqual(3)
    expect(area(fromWalls)).toBeCloseTo(area(fromFormula), 0)
  })

  it('panelFlip false: Decke bündig an Innenkante (kein Doppel-Inset)', () => {
    const plan = rectanglePlan()
    const ring = extractPlanRings(plan).find((item) => item.closed)!
    const walls = wallsFromFloorPlan(plan).map((wall) => ({ ...wall, panelFlip: false }))
    const fromWalls = innerFaceRingFromWalls(ring.nodes, walls, WALL_DEPTH)
    const fromFormula = innerFaceRingWorld(ring.nodes, WALL_DEPTH)
    const minZWalls = Math.min(...fromWalls.map((p) => p.z))
    const minZFormula = Math.min(...fromFormula.map((p) => p.z))
    expect(minZWalls).toBeLessThan(minZFormula - 20)
  })
})

describe('createStudioOpeningRevealGeometry', () => {
  it('Sturz liegt auf der Öffnungs-Oberkante, ohne Lippe darüber oder Soffit darunter', () => {
    const openingTop = 320
    const wall: Wall = {
      ...studioWall(),
      kind: 'studio',
      panelFlip: true,
      depth: 32,
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      openings: [
        {
          id: 'o1',
          type: 'window',
          x: 48,
          y: 128,
          width: 96,
          height: openingTop - 128,
        },
      ],
    }
    const geometry = createStudioOpeningRevealGeometry(wall, wall.openings[0]!)
    expect(geometry).not.toBeNull()
    const pos = geometry!.getAttribute('position')
    const meshTop = openingTop - wall.height / 2
    let maxY = -Infinity
    let topCount = 0
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i)
      maxY = Math.max(maxY, y)
      if (Math.abs(y - meshTop) < 0.05) topCount += 1
    }
    expect(maxY).toBeCloseTo(meshTop, 2)
    expect(topCount).toBeGreaterThanOrEqual(4)
    expect(pos.count).toBe(32)
    geometry!.dispose()
  })
})

describe('createStudioOpeningRevealGeometry — Konche', () => {
  it('baut Kalotten-Leibung mit Vertices und zwei Materialgruppen', () => {
    const wall = studioWall()
    const opening = {
      id: 'conch-1',
      type: 'conch' as const,
      x: 16,
      y: 96,
      width: 96,
      height: 128,
      fill: { mode: 'niche' as const, nicheDepthCm: 48 },
      arch: { enabled: true, form: 'round' as const, riseCm: 48 },
    }
    wall.openings = [opening]
    const geo = createStudioOpeningRevealGeometry(wall, opening)
    expect(geo).not.toBeNull()
    const pos = geo!.getAttribute('position')
    expect(pos.count).toBeGreaterThan(100)
    expect(geo!.groups.length).toBeGreaterThanOrEqual(1)
    // Innere Kalotte sollte hinter der Fassade liegen (negative Z bei Standardwand)
    let minZ = Infinity
    for (let i = 0; i < pos.count; i += 1) {
      minZ = Math.min(minZ, pos.getZ(i))
    }
    expect(minZ).toBeLessThan(0)
    geo!.dispose()
  })
})
