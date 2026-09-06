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
  removeStorey,
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

  it('setzt storeyIndex korrekt nach Duplikat trotz abweichender EG-Höhe', () => {
    const hTall = 448
    const hShort = 384
    const eg = wall('eg', 0)
    eg.height = hTall
    const og1 = wall('og1', hTall)
    og1.height = hTall
    const og2 = wall('og2', hTall * 2)
    og2.height = hTall
    const og3 = wall('og3', hTall * 3)
    og3.height = hTall
    let base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: hTall,
          wallDepth: WALL_DEPTH,
          walls: [eg, og1, og2, og3],
          floors: [
            { nodes: [], edges: [] },
            { nodes: [], edges: [] },
            { nodes: [], edges: [] },
            { nodes: [], edges: [] },
          ],
        },
      ],
      activeBuildingId: 'b1',
    }
    base = resizeStoreyHeight(base, 0, hShort - hTall)
    const next = duplicateStorey(base, 3, { copyOpenings: false })
    const building = next.buildings[0]!
    const source = building.walls.find((item) => item.id === 'og3')!
    const clone = building.walls.find(
      (item) => !['eg', 'og1', 'og2', 'og3'].includes(item.id),
    )!
    expect(floorIndex(source, building.wallHeight)).toBe(3)
    expect(floorIndex(clone, building.wallHeight)).toBe(4)
    expect(clone.storeyIndex).toBe(4)
    expect(building.walls.some((w) => floorIndex(w, building.wallHeight) === 5)).toBe(false)
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

  it('erhält groupId und remappt Gruppen der Klone', () => {
    const base = twoFloorState()
    base.buildings[0]!.walls[0]!.groupId = 'grp-1'
    base.buildings[0]!.groups = [{ id: 'grp-1', name: 'Erker', memberWallIds: ['eg'] }]
    const next = insertStoreyAbove(base, 0, { wallIds: ['eg'], copyOpenings: false })
    const clone = next.buildings[0]!.walls.find((item) => item.id !== 'eg' && item.id !== 'og')
    expect(clone?.groupId).toBeTruthy()
    expect(clone?.groupId).not.toBe('grp-1')
    const group = next.buildings[0]!.groups?.find((g) => g.id === clone?.groupId)
    expect(group?.name).toBe('Erker')
    expect(group?.memberWallIds).toEqual([clone!.id])
  })

  it('remappt Erker-bayParentId und bayWindow.wallIds auf Klone', () => {
    const h = 456
    const frontId = 'bay-front'
    const leftId = 'bay-left'
    const rightId = 'bay-right'
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [
            {
              ...wall(frontId, 0),
              bayRole: 'front',
              groupId: 'bay-g',
              bayWindow: {
                frontWidthCm: 192,
                depthCm: 96,
                shape: 'rect',
                kind: 'bay',
                wallIds: [leftId, frontId, rightId],
              },
            },
            {
              ...wall(leftId, 0),
              bayRole: 'side',
              bayParentId: frontId,
              groupId: 'bay-g',
              width: 96,
            },
            {
              ...wall(rightId, 0),
              bayRole: 'side',
              bayParentId: frontId,
              groupId: 'bay-g',
              width: 96,
            },
          ],
          floors: [{ nodes: [], edges: [] }],
          groups: [{ id: 'bay-g', name: 'Erker 192', memberWallIds: [leftId, frontId, rightId] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = insertStoreyAbove(base, 0, {
      wallIds: [leftId, frontId, rightId],
      copyOpenings: false,
    })
    const clones = next.buildings[0]!.walls.filter(
      (w) => w.id !== leftId && w.id !== frontId && w.id !== rightId,
    )
    expect(clones).toHaveLength(3)
    const cloneFront = clones.find((w) => w.bayWindow?.wallIds?.length)
    expect(cloneFront).toBeTruthy()
    expect(cloneFront!.bayParentId).toBeUndefined()
    expect(cloneFront!.bayWindow!.wallIds).toHaveLength(3)
    expect(cloneFront!.bayWindow!.wallIds.every((id) => clones.some((c) => c.id === id))).toBe(
      true,
    )
    const cloneSides = clones.filter((w) => w.bayRole === 'side')
    expect(cloneSides).toHaveLength(2)
    expect(cloneSides.every((w) => w.bayParentId === cloneFront!.id)).toBe(true)
    const group = next.buildings[0]!.groups?.find((g) => g.id === cloneFront!.groupId)
    expect(group?.memberWallIds.sort()).toEqual(clones.map((c) => c.id).sort())
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

  it('ändert EG-Schrift nicht, wenn ein Obergeschoss dupliziert wird', () => {
    const base = twoFloorState()
    const eg = base.buildings[0]!.walls.find((w) => w.id === 'eg')!
    eg.labels = [
      {
        id: 'lbl-eg',
        enabled: true,
        text: 'EG',
        x: 64,
        y: 320,
        heightCm: 48,
        depth: 'flat',
        extrudeCm: 4,
        offsetForward: 0,
        align: 'center',
        fontId: 'federo',
      },
    ]
    eg.label = eg.labels[0]
    const labelYBefore = eg.labels[0]!.y
    const next = insertStoreyAbove(base, 1, { wallIds: ['og'], copyOpenings: false })
    const egAfter = next.buildings[0]!.walls.find((w) => w.id === 'eg')!
    expect(egAfter.labels?.[0]?.y).toBe(labelYBefore)
    expect(egAfter.labels?.[0]?.x).toBe(64)
    expect(egAfter.labels?.[0]?.text).toBe('EG')
    expect(egAfter.y).toBe(0)
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

  it('dritte Etage: Klone sitzen darüber, nie auf derselben Geschosshöhe', () => {
    const h = 456
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('eg', 0), wall('og', h), wall('dg', h * 2)],
          floors: [{ nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = duplicateStorey(base, 2, { copyOpenings: false })
    const building = next.buildings[0]!
    expect(building.floors).toHaveLength(4)
    const dg = building.walls.find((item) => item.id === 'dg')!
    expect(dg.y).toBe(h * 2)
    const clones = building.walls.filter((item) => !['eg', 'og', 'dg'].includes(item.id))
    expect(clones).toHaveLength(1)
    expect(clones[0]!.y).toBe(h * 3)
    expect(floorIndex(clones[0]!, h)).toBe(3)
    expect(floorIndex(clones[0]!, h)).not.toBe(floorIndex(dg, h))
  })

  it('duplizieren lässt Quell-Geschoss unverändert (Höhe und Fuß)', () => {
    const h = 456
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('eg', 0), wall('og', h), wall('dg', h * 2)],
          floors: [{ nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = duplicateStorey(base, 1, { copyOpenings: false })
    const eg = next.buildings[0]!.walls.find((item) => item.id === 'eg')!
    const og = next.buildings[0]!.walls.find((item) => item.id === 'og')!
    expect(eg.y).toBe(0)
    expect(eg.height).toBe(h)
    expect(og.y).toBe(h)
    expect(og.height).toBe(h)
  })
})

describe('removeStorey', () => {
  it('ändert Höhe und Fuß der Etagen darunter nicht', () => {
    const h = 456
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: h,
          wallDepth: WALL_DEPTH,
          walls: [wall('eg', 0), wall('og', h), wall('dg', h * 2)],
          floors: [{ nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = removeStorey(base, 2)
    const building = next.buildings[0]!
    expect(building.walls.map((w) => w.id).sort()).toEqual(['eg', 'og'])
    const eg = building.walls.find((w) => w.id === 'eg')!
    const og = building.walls.find((w) => w.id === 'og')!
    expect(eg.y).toBe(0)
    expect(eg.height).toBe(h)
    expect(og.y).toBe(h)
    expect(og.height).toBe(h)
    expect(building.floors).toHaveLength(2)
  })

  it('senkt höhere Etagen um die echte Höhe der gelöschten ab', () => {
    const hEg = 500
    const hOg = 400
    const eg = wall('eg', 0)
    eg.height = hEg
    const og = wall('og', hEg)
    og.height = hOg
    const dg = wall('dg', hEg + hOg)
    dg.height = 450
    const base: FacadeState = {
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: hEg,
          wallDepth: WALL_DEPTH,
          walls: [eg, og, dg],
          floors: [{ nodes: [], edges: [] }, { nodes: [], edges: [] }, { nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    }
    const next = removeStorey(base, 1)
    const building = next.buildings[0]!
    const eg2 = building.walls.find((w) => w.id === 'eg')!
    const dg2 = building.walls.find((w) => w.id === 'dg')!
    expect(eg2.height).toBe(hEg)
    expect(eg2.y).toBe(0)
    expect(dg2.y).toBe(hEg)
    expect(dg2.height).toBe(450)
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
