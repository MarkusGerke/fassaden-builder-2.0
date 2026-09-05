import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { DEFAULT_STUDIO_PANEL, PLAN_GRID_LEGACY_SCALE } from '../studio/constants'
import { floorIndex, effectiveStoreyFloorCapY, storeyFloorSurfaceY, storeyTopY } from './layers'
import {
  insertStoreyAbove,
  duplicateStorey,
  duplicateWalls,
  pasteWallsRelativeToTarget,
  resizeStoreyHeight,
  STOREY_COPY_PLAN_ONLY,
  updateCeilingColorForWalls,
} from './walls'
import { createStudioWall, studioWallOuterLocalZ, studioWallOuterSpine, studioWallTransform, attachAngledWallFromEnd, wallStartPoint, wallEndPoint, pointsMeet } from '../studio/walls'
import { finalizeStudioGeometry, applyGlobalWallDepth } from '../studio/planGeometry'
import { createEmptyFloorPlan, drawPlanLine } from '../studio/floorPlan'

function wall(id: string, y: number): Wall {
  return {
    id,
    kind: 'studio',
    x: 0,
    y,
    width: 128,
    height: 456,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
  }
}

function twoFloorState(): FacadeState {
  const h = 456
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus',
        wallHeight: h,
        wallDepth: WALL_DEPTH,
        walls: [wall('eg', 0), wall('og', h)],
        floors: [
          { nodes: [{ id: 'n1', gx: 0, gz: 0 }], edges: [] },
          { nodes: [{ id: 'n2', gx: 0, gz: 0 }], edges: [] },
        ],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('insertStoreyAbove', () => {
  it('schiebt höhere Etagen nach oben und fügt Klone auf i+1 ein', () => {
    const base = twoFloorState()
    const h = 456
    const next = insertStoreyAbove(base, 0, { wallIds: ['eg'], copyOpenings: true })
    const building = next.buildings[0]!
    expect(building.floors).toHaveLength(3)
    const og = building.walls.find((item) => item.id === 'og')
    expect(og?.y).toBe(h * 2)
    const clones = building.walls.filter((item) => item.id !== 'eg' && item.id !== 'og')
    expect(clones).toHaveLength(1)
    expect(clones[0]?.y).toBe(h)
    expect(floorIndex(clones[0]!, h)).toBe(1)
  })

  it('fügt zwischen Quelle und bestehender oberer Wand ein', () => {
    const h = 456
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('eg', 0), wall('og', h)],
          floors: [{ nodes: [], edges: [] }, { nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = insertStoreyAbove(base, 0, { wallIds: ['eg'], copyOpenings: false })
    const building = next.buildings[0]!
    const og = building.walls.find((item) => item.id === 'og')
    const clone = building.walls.find((item) => item.id !== 'eg' && item.id !== 'og')
    expect(og?.y).toBe(h * 2)
    expect(clone?.y).toBe(h)
    expect(building.floors).toHaveLength(3)
  })

  it('entfernt groupId beim Klon', () => {
    const base = twoFloorState()
    base.buildings[0]!.walls[0]!.groupId = 'grp-1'
    const next = insertStoreyAbove(base, 0, { wallIds: ['eg'], copyOpenings: false })
    const clone = next.buildings[0]!.walls.find((item) => item.id !== 'eg' && item.id !== 'og')
    expect(clone?.groupId).toBeUndefined()
  })

  it('löst planLinked bei Einzelwand, behält sie bei Mehrfachklon', () => {
    const h = 456
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('a', 0), wall('b', 0)],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const single = insertStoreyAbove(base, 0, { wallIds: ['a'], copyOpenings: false })
    const singleClone = single.buildings[0]!.walls.find((item) => item.id !== 'a' && item.id !== 'b')
    expect(singleClone?.planLinked).toBe(false)

    const multi = insertStoreyAbove(base, 0, { wallIds: ['a', 'b'], copyOpenings: false })
    const multiClones = multi.buildings[0]!.walls.filter((item) => item.id !== 'a' && item.id !== 'b')
    expect(multiClones).toHaveLength(2)
    expect(multiClones.every((item) => item.planLinked !== false)).toBe(true)
  })

  it('setzt Klon Fläche-auf-Fläche auch bei abweichender Wandhöhe', () => {
    const h = 456
    const tall: Wall = { ...wall('eg', 0), height: 480 }
    const og = wall('og', h)
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [tall, og],
          floors: [
            { nodes: [], edges: [] },
            { nodes: [], edges: [] },
          ],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = insertStoreyAbove(base, 0, { wallIds: ['eg'], copyOpenings: false })
    const building = next.buildings[0]!
    const clone = building.walls.find((item) => item.id !== 'eg' && item.id !== 'og')!
    const movedOg = building.walls.find((item) => item.id === 'og')!
    expect(clone.y).toBe(480)
    expect(clone.y).toBe(tall.y + tall.height)
    // Altes OG sitzt auf/über der Klon-Oberkante — kein Überlapp, kein Schweben unter dem Klon.
    expect(movedOg.y).toBeGreaterThanOrEqual(clone.y + clone.height)
  })

  it('lässt Paneele weg, wenn copy.panel false ist', () => {
    const base = twoFloorState()
    base.buildings[0]!.walls[0]!.panel = { ...DEFAULT_STUDIO_PANEL, pattern: 'strip', enabled: true }
    const next = insertStoreyAbove(base, 0, {
      wallIds: ['eg'],
      copyOpenings: true,
      copy: { panel: false },
    })
    const clone = next.buildings[0]!.walls.find((item) => item.id !== 'eg' && item.id !== 'og')
    expect(clone?.panel?.pattern).toBe('none')
    expect(clone?.panel?.enabled).toBe(false)
  })

  it('deaktiviert Sockel inkl. Höhe, wenn copy.plinth false ist', () => {
    const base = twoFloorState()
    base.buildings[0]!.walls[0]!.panel = {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'strip',
      enabled: true,
      plinthEnabled: true,
      plinthHeight: 64,
    }
    base.buildings[0]!.walls[0]!.cornice = { enabled: true, edge: 'top', scale: 1, profileId: 'traufgesims70x150' }
    const next = insertStoreyAbove(base, 0, {
      wallIds: ['eg'],
      copyOpenings: false,
      copy: { plinth: false, cornice: false },
    })
    const clone = next.buildings[0]!.walls.find((item) => item.id !== 'eg' && item.id !== 'og')
    expect(clone?.panel?.plinthEnabled).toBe(false)
    expect(clone?.panel?.plinthHeight).toBe(0)
    expect(clone?.cornice?.enabled).toBe(false)
  })
})

describe('duplicateStorey', () => {
  it('übernimmt bei Nur-Grundriss keine Paneele und Öffnungen', () => {
    const base = twoFloorState()
    base.buildings[0]!.walls[0]!.panel = { ...DEFAULT_STUDIO_PANEL, pattern: 'strip', enabled: true }
    base.buildings[0]!.walls[0]!.openings = [
      {
        id: 'win',
        type: 'window',
        x: 32,
        y: 96,
        width: 96,
        height: 160,
      },
    ]
    const next = duplicateStorey(base, 0, { copyOpenings: true, copy: STOREY_COPY_PLAN_ONLY })
    const clones = next.buildings[0]!.walls.filter((item) => item.id !== 'eg' && item.id !== 'og')
    expect(clones).toHaveLength(1)
    expect(clones[0]?.openings).toHaveLength(0)
    expect(clones[0]?.panel?.enabled).toBe(false)
  })

  it('stapelt auf die echte Oberkante, auch nach Verkleinern der duplizierten Etage', () => {
    const hTall = 608
    const hShort = 448
    const eg = wall('eg', 0)
    eg.height = hTall
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: hTall,
          wallDepth: WALL_DEPTH,
          walls: [eg],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    let next = duplicateStorey(base, 0, { copyOpenings: false })
    const og = next.buildings[0]!.walls.find((item) => item.id !== 'eg')!
    expect(og.y).toBe(hTall)
    next = resizeStoreyHeight(next, 1, hShort - hTall)
    const ogShrunk = next.buildings[0]!.walls.find((item) => item.id === og.id)!
    expect(ogShrunk.height).toBe(hShort)
    expect(ogShrunk.y).toBe(hTall)
    next = duplicateStorey(next, 1, { copyOpenings: false })
    const ids = new Set(['eg', og.id])
    const second = next.buildings[0]!.walls.find((item) => !ids.has(item.id))!
    expect(second.y).toBe(ogShrunk.y + ogShrunk.height)
  })
})

describe('duplicateWalls', () => {
  it('legt die Studio-Kopie links bzw. rechts an dieselbe Wand', () => {
    const source = wall('w1', 0)
    source.width = 192
    source.originX = 0
    source.originZ = 0
    source.yawDeg = 0
    const state: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 456,
          wallDepth: WALL_DEPTH,
          walls: [source],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const left = duplicateWalls(state, ['w1'], 'left')
    const cloneLeft = left.buildings[0]!.walls.find((item) => item.id !== 'w1')
    expect(cloneLeft?.originX).toBe(192 + 48)
    expect(cloneLeft?.width).toBe(192)
    expect(cloneLeft?.originZ).toBe(0)

    const right = duplicateWalls(state, ['w1'], 'right')
    const cloneRight = right.buildings[0]!.walls.find((item) => item.id !== 'w1')
    expect(cloneRight?.originX).toBe(-(192 + 48))
    expect(cloneRight?.width).toBe(192)
  })

  it('fügt Kopie in kollineare Kette ein und verschiebt Nachbarn', () => {
    const mk = (id: string, originX: number): Wall => ({
      ...wall(id, 0),
      width: 100,
      originX,
      x: originX,
      planLinked: true,
    })
    const a = mk('a', 0)
    const b = mk('b', 100)
    const c = mk('c', 200)
    const state: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 456,
          wallDepth: WALL_DEPTH,
          walls: [a, b, c],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const towardEnd = duplicateWalls(state, ['b'], 'left', { planLinked: true })
    const cloneEnd = towardEnd.buildings[0]!.walls.find((item) => item.id !== 'a' && item.id !== 'b' && item.id !== 'c')
    const cShifted = towardEnd.buildings[0]!.walls.find((item) => item.id === 'c')
    expect(cloneEnd?.originX).toBe(248)
    expect(cShifted?.originX).toBe(348)

    const towardStart = duplicateWalls(state, ['b'], 'right', { planLinked: true })
    const cloneStart = towardStart.buildings[0]!.walls.find(
      (item) => item.id !== 'a' && item.id !== 'b' && item.id !== 'c',
    )
    const aShifted = towardStart.buildings[0]!.walls.find((item) => item.id === 'a')
    expect(cloneStart?.originX).toBe(-48)
    expect(aShifted?.originX).toBe(-148)
  })
})

describe('pasteWallsRelativeToTarget', () => {
  it('fügt kopierte Wand links neben die Zielwand', () => {
    const target = wall('target', 0)
    target.width = 192
    target.originX = 0
    target.x = 0
    const source = wall('source', 0)
    source.width = 128
    source.originX = 400
    source.x = 400
    source.openings = [
      {
        id: 'o1',
        type: 'window',
        x: 32,
        y: 120,
        width: 96,
        height: 128,
      },
    ]
    const state: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 456,
          wallDepth: WALL_DEPTH,
          walls: [target],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = pasteWallsRelativeToTarget(state, [source], 'target', 'left')
    const pasted = next.buildings[0]!.walls.find((item) => item.id !== 'target')
    expect(pasted?.originX).toBe(192)
    expect(pasted?.width).toBe(128)
    expect(pasted?.openings).toHaveLength(1)
    expect(pasted?.openings[0]?.id).not.toBe('o1')
  })

  it('fügt kopierte Wand rechts neben die Zielwand', () => {
    const target = wall('target', 0)
    target.width = 192
    target.originX = 192
    target.x = 192
    const source = wall('source', 0)
    source.width = 128
    source.originX = 0
    source.x = 0
    const state: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 456,
          wallDepth: WALL_DEPTH,
          walls: [target],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = pasteWallsRelativeToTarget(state, [source], 'target', 'right')
    const pasted = next.buildings[0]!.walls.find((item) => item.id !== 'target')
    expect(pasted?.originX).toBe(64)
    expect(pasted?.width).toBe(128)
  })
})

describe('storeyTopY nach resizeStoreyHeight', () => {
  it('Decke EG folgt höherer Wand; OG-Decke bleibt an Wandoberkante', () => {
    const h = 448
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('eg', 0), wall('og', h)],
          floors: [
            { nodes: [{ id: 'n1', gx: 0, gz: 0 }], edges: [] },
            { nodes: [{ id: 'n2', gx: 0, gz: 0 }], edges: [] },
          ],
        },
      ],
      activeBuildingId: 'b1',
    }
    base.buildings[0]!.walls.forEach((w) => {
      w.height = h
    })
    const next = resizeStoreyHeight(base, 0, 16)
    const building = next.buildings[0]!
    expect(storeyTopY(building, 0)).toBe(464)
    expect(storeyTopY(building, 1)).toBe(464 + 448)
    expect(storeyTopY(building, 1)).not.toBe(2 * building.wallHeight)
  })

  it('OG-Höhenänderung verschiebt Decke dieser Etage', () => {
    const h = 448
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('eg', 0), wall('og', h)],
          floors: [
            { nodes: [{ id: 'n1', gx: 0, gz: 0 }], edges: [] },
            { nodes: [{ id: 'n2', gx: 0, gz: 0 }], edges: [] },
          ],
        },
      ],
      activeBuildingId: 'b1',
    }
    base.buildings[0]!.walls.forEach((w) => {
      w.height = h
    })
    const next = resizeStoreyHeight(base, 1, 32)
    const building = next.buildings[0]!
    expect(storeyTopY(building, 0)).toBe(448)
    expect(storeyTopY(building, 1)).toBe(448 + 448 + 32)
  })
})

describe('storeyFloorSurfaceY', () => {
  it('liegt auf der unteren Türkante', () => {
    const w = wall('eg', 0)
    w.height = 448
    w.openings = [{ id: 'd1', type: 'door', x: 32, y: 0, width: 96, height: 208 }]
    const building = {
      id: 'b1',
      name: 'Haus',
      wallHeight: 448,
      wallDepth: WALL_DEPTH,
      walls: [w],
      floors: [{ nodes: [], edges: [] }],
    }
    expect(storeyFloorSurfaceY(building, 0)).toBe(0)
    w.openings[0]!.y = 8
    expect(storeyFloorSurfaceY(building, 0)).toBe(8)
  })
})

describe('effectiveStoreyFloorCapY', () => {
  it('liegt mindestens über Kellerfenstern', () => {
    const w = wall('eg', 0)
    w.height = 448
    w.openings = [
      {
        id: 'bw1',
        type: 'window',
        x: 80,
        y: 40,
        width: 48,
        height: 64,
        basementWindow: { enabled: true, grilleHeight: 0.5 },
      },
    ]
    const building = {
      id: 'b1',
      name: 'Haus',
      wallHeight: 448,
      wallDepth: WALL_DEPTH,
      walls: [w],
      floors: [{ nodes: [], edges: [] }],
    }
    expect(effectiveStoreyFloorCapY(building, 0)).toBe(40 + 64 + 4)
  })
})

function outerStartWorld(wall: Wall): { x: number; z: number } {
  const t = studioWallTransform(wall)
  const outerZ = studioWallOuterLocalZ(wall)
  const localX = -wall.width / 2
  const cos = Math.cos(t.rotationY)
  const sin = Math.sin(t.rotationY)
  return {
    x: t.position.x + localX * cos + outerZ * sin,
    z: t.position.z - localX * sin + outerZ * cos,
  }
}

describe('updateGlobalDepth', () => {
  it('behält die Außenkante bei panelFlip true (Planlinie)', () => {
    const source = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 480,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      panelFlip: true,
      planLinked: true,
    }
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 448,
          wallDepth: WALL_DEPTH,
          walls: [source],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const before = outerStartWorld(base.buildings[0]!.walls[0]!)
    const next = finalizeStudioGeometry(applyGlobalWallDepth(base, 24))
    const after = outerStartWorld(next.buildings[0]!.walls[0]!)
    expect(after.x).toBeCloseTo(before.x, 4)
    expect(after.z).toBeCloseTo(before.z, 4)
    expect(next.buildings[0]!.walls[0]!.depth).toBe(24)
  })

  it('behält die Außenkante bei panelFlip false (Bibliothek)', () => {
    const source = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 480,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      panelFlip: false,
      planLinked: true,
    }
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 448,
          wallDepth: WALL_DEPTH,
          walls: [source],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const before = outerStartWorld(base.buildings[0]!.walls[0]!)
    const next = finalizeStudioGeometry(applyGlobalWallDepth(base, 24))
    const after = outerStartWorld(next.buildings[0]!.walls[0]!)
    expect(after.x).toBeCloseTo(before.x, 4)
    expect(after.z).toBeCloseTo(before.z, 4)
    expect(next.buildings[0]!.walls[0]!.depth).toBe(24)
  })

  it('passt Gehrungen an neue Wandstärke an (90°-Abzweig)', () => {
    const source = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 192,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      panelFlip: true,
      planLinked: true,
      buildingId: 'b1',
    }
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 448,
          wallDepth: WALL_DEPTH,
          walls: [source],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const withBranch = finalizeStudioGeometry(
      attachAngledWallFromEnd(base, 'w', 'end', 90, 96, 'branch'),
    )
    const next = finalizeStudioGeometry(applyGlobalWallDepth(withBranch, 24))
    const walls = next.buildings[0]!.walls
    const src = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    expect(Math.abs(src.miterEnd ?? 0)).toBeCloseTo(24)
    expect(Math.abs(branch.miterStart ?? 0)).toBeCloseTo(24)
    expect(src.depth).toBe(24)
    expect(branch.depth).toBe(24)
  })

  it('hält Außenkanten und verknüpft 90°-Ecken nach Tiefenwechsel (panelFlip false)', () => {
    const inner = (id: string, originX: number, originZ: number, yawDeg: number, width: number): Wall => ({
      ...createStudioWall(originX, 0),
      id,
      originX,
      originZ,
      x: originX,
      yawDeg,
      width,
      depth: WALL_DEPTH,
      panelFlip: false,
      planLinked: true,
    })
    const walls = [
      inner('n', 0, 384, 0, 480),
      inner('e', 480, 384, 90, 384),
      inner('s', 480, 0, 180, 480),
      inner('w', 0, 0, 270, 384),
    ]
    let plan = createEmptyFloorPlan()
    const s = PLAN_GRID_LEGACY_SCALE
    plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
    plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
    plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
    plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 448,
          wallDepth: WALL_DEPTH,
          walls,
          floors: [plan],
        },
      ],
      activeBuildingId: 'b1',
    }
    const outerBox = (list: Wall[]) => {
      const pts = list.flatMap((item) => {
        const spine = studioWallOuterSpine(item)
        return [spine.start, spine.end]
      })
      return {
        minX: Math.min(...pts.map((p) => p.x)),
        maxX: Math.max(...pts.map((p) => p.x)),
        minZ: Math.min(...pts.map((p) => p.z)),
        maxZ: Math.max(...pts.map((p) => p.z)),
      }
    }
    const before = outerBox(base.buildings[0]!.walls)
    const next = finalizeStudioGeometry(applyGlobalWallDepth(base, 24))
    const nextWalls = next.buildings[0]!.walls
    const after = outerBox(nextWalls)
    expect(after.minX).toBeCloseTo(before.minX, 4)
    expect(after.maxX).toBeCloseTo(before.maxX, 4)
    expect(after.minZ).toBeCloseTo(before.minZ, 4)
    expect(after.maxZ).toBeCloseTo(before.maxZ, 4)
    expect(nextWalls.every((item) => item.panelFlip === true)).toBe(true)
    expect(nextWalls.every((item) => item.depth === 24)).toBe(true)
    for (const item of nextWalls) {
      const startHits = nextWalls.some(
        (other) => other.id !== item.id && pointsMeet(wallStartPoint(item), wallStartPoint(other)),
      ) || nextWalls.some(
        (other) => other.id !== item.id && pointsMeet(wallStartPoint(item), wallEndPoint(other)),
      )
      const endHits = nextWalls.some(
        (other) => other.id !== item.id && pointsMeet(wallEndPoint(item), wallStartPoint(other)),
      ) || nextWalls.some(
        (other) => other.id !== item.id && pointsMeet(wallEndPoint(item), wallEndPoint(other)),
      )
      expect(startHits, `${item.id} start`).toBe(true)
      expect(endHits, `${item.id} end`).toBe(true)
      expect(Math.abs(item.miterStart ?? 0)).toBeCloseTo(24)
      expect(Math.abs(item.miterEnd ?? 0)).toBeCloseTo(24)
    }
  })

  it('repariert auseinandergerissene Ecken anhand der Außenlinien', () => {
    const inner = (id: string, originX: number, originZ: number, yawDeg: number, width: number): Wall => ({
      ...createStudioWall(originX, 0),
      id,
      originX,
      originZ,
      x: originX,
      yawDeg,
      width,
      depth: 24,
      panelFlip: false,
      planLinked: true,
    })
    const walls = [
      inner('n', 0, 392, 0, 480),
      inner('e', 488, 384, 90, 384),
      inner('s', 480, -8, 180, 480),
      inner('w', -8, 0, 270, 384),
    ]
    let plan = createEmptyFloorPlan()
    const s = PLAN_GRID_LEGACY_SCALE
    plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
    plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
    plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
    plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 448,
          wallDepth: 24,
          walls,
          floors: [plan],
        },
      ],
      activeBuildingId: 'b1',
    }
    expect(
      pointsMeet(wallEndPoint(walls[0]!), wallStartPoint(walls[1]!)),
    ).toBe(false)
    const next = finalizeStudioGeometry(applyGlobalWallDepth(base, 24))
    const nextWalls = next.buildings[0]!.walls
    for (const item of nextWalls) {
      const startHits = nextWalls.some(
        (other) => other.id !== item.id && (
          pointsMeet(wallStartPoint(item), wallStartPoint(other)) ||
          pointsMeet(wallStartPoint(item), wallEndPoint(other))
        ),
      )
      expect(startHits, `${item.id} start`).toBe(true)
      expect(item.panelFlip).toBe(true)
      expect(Math.abs(item.miterStart ?? 0)).toBeCloseTo(24)
    }
  })
})

describe('updateCeilingColorForWalls', () => {
  it('färbt die Decke der Etage der gewählten Wand', () => {
    const next = updateCeilingColorForWalls(twoFloorState(), ['eg'], '#ccddee')
    expect(next.buildings[0]!.floors[0]!.ceilingColor).toBe('#ccddee')
    expect(next.buildings[0]!.floors[1]!.ceilingColor).toBeUndefined()
  })
})
