import { describe, expect, it } from 'vitest'
import type { FacadeState, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { applyWallGripCornerTarget, alongWidthDeltaFromMove, snapBranchYawDeg, attachAngledWallFromEnd, poseAngledWallFromEnd, wallEndPoint, wallStartPoint, miterAtWallEnd, repairBuildingPlanLinkedWalls, repairPlanLinkedWallFronts, snapBranchClose, splitStudioWallAt, branchClosesAgainstWalls, findAdjacentWalls, unselectedLinkedDiagonalWalls, offsetStudioWallsAlongFront, frontMoveStepCm, wallAlongDelta, stretchStudioFacade, translateStudioCorner, skewStudioWallToDiagonal, linkedCornerNeighbor, pointsMeet } from './walls'
import { PLAN_DIAGONAL_STEP, PLAN_GRID, snapWallWidthCm, snapWallWidthDelta, wallWidthStepCm, isDiagonalPlanYaw } from './constants'
import { facadeOutward } from './elevation'
import { finalizeStudioGeometry } from './planGeometry'

function studio(id: string, originX: number, width: number): Wall {
  return {
    id,
    kind: 'studio',
    x: originX,
    y: 0,
    width,
    height: 456,
    depth: WALL_DEPTH,
    originX,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    buildingId: 'b1',
    planLinked: true,
  }
}

function stateWith(walls: Wall[]): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'Haus',
        wallHeight: 456,
        wallDepth: WALL_DEPTH,
        walls,
        floors: [{ nodes: [], edges: [] }],
      },
    ],
    activeBuildingId: 'b1',
  }
}

describe('applyWallGripCornerTarget', () => {
  it('verlängert die Wand am Ende entlang der Achse', () => {
    const next = applyWallGripCornerTarget(stateWith([studio('w', 0, 192)]), 'w', 'end', {
      x: 240,
      z: 80,
    })
    const wall = next.buildings[0]!.walls[0]!
    expect(wall.width).toBe(240)
    expect(wall.yawDeg ?? 0).toBe(0)
    expect(wallEndPoint(wall).x).toBeCloseTo(240)
    expect(wallEndPoint(wall).z).toBeCloseTo(0)
    expect(wallStartPoint(wall).x).toBeCloseTo(0)
  })

  it('verschiebt die Startkante ohne die andere Seite zu verlieren', () => {
    const next = applyWallGripCornerTarget(stateWith([studio('w', 0, 192)]), 'w', 'start', {
      x: -48,
      z: 0,
    })
    const wall = next.buildings[0]!.walls[0]!
    expect(wall.width).toBe(240)
    expect(wallStartPoint(wall).x).toBeCloseTo(-48)
  })

  it('schwenkt mit lockYaw false um 90° um das feste Ende', () => {
    const next = applyWallGripCornerTarget(
      stateWith([studio('w', 0, 192)]),
      'w',
      'end',
      { x: 0, z: -192 },
      { lockYaw: false },
    )
    const wall = next.buildings[0]!.walls[0]!
    expect(wall.yawDeg).toBe(90)
    expect(wall.width).toBeCloseTo(192)
    expect(wallStartPoint(wall).x).toBeCloseTo(0)
    expect(wallStartPoint(wall).z).toBeCloseTo(0)
    expect(wallEndPoint(wall).x).toBeCloseTo(0)
    expect(wallEndPoint(wall).z).toBeCloseTo(-192)
  })

  it('schwenkt mit lockYaw false auf 45°', () => {
    const next = applyWallGripCornerTarget(
      stateWith([studio('w', 0, 192)]),
      'w',
      'end',
      { x: 192, z: -192 },
      { lockYaw: false },
    )
    const wall = next.buildings[0]!.walls[0]!
    expect(wall.yawDeg).toBe(45)
    expect(wall.width).toBeCloseTo(192 * Math.SQRT2)
  })
})

describe('alongWidthDeltaFromMove', () => {
  it('misst nur die Bewegung entlang der Achse', () => {
    expect(alongWidthDeltaFromMove(0, 'end', 48, 80)).toBeCloseTo(48)
    expect(alongWidthDeltaFromMove(0, 'start', -48, 0)).toBeCloseTo(48)
    expect(alongWidthDeltaFromMove(0, 'end', 0, 0)).toBeCloseTo(0)
  })
})

describe('snapBranchYawDeg', () => {
  it('rastet senkrecht zur Wand auf 90°', () => {
    expect(snapBranchYawDeg(0, 'end', 0, -100)).toBe(90)
  })

  it('rastet diagonal auf 45°', () => {
    expect(snapBranchYawDeg(0, 'end', 100, -100)).toBe(45)
  })

  it('lehnt kollineares Ziehen ab', () => {
    expect(snapBranchYawDeg(0, 'end', 100, 0)).toBeNull()
    expect(snapBranchYawDeg(0, 'start', -80, 0)).toBeNull()
  })
})

describe('wallWidthStepCm', () => {
  it('8 cm achsparallel, Diagonale eines 8er-Feldes bei 45°', () => {
    expect(wallWidthStepCm(0)).toBe(8)
    expect(wallWidthStepCm(90)).toBe(8)
    expect(wallWidthStepCm(180)).toBe(8)
    expect(wallWidthStepCm(45)).toBeCloseTo(PLAN_DIAGONAL_STEP)
    expect(wallWidthStepCm(135)).toBeCloseTo(PLAN_DIAGONAL_STEP)
    expect(wallWidthStepCm(225)).toBeCloseTo(PLAN_DIAGONAL_STEP)
  })

  it('rastet 45°-Länge auf ganze Rasterdiagonalen', () => {
    expect(snapWallWidthCm(5, 45)).toBe(0)
    expect(snapWallWidthCm(20, 45)).toBeCloseTo(PLAN_DIAGONAL_STEP * 2)
    expect(snapWallWidthCm(PLAN_DIAGONAL_STEP * 1.6, 45)).toBeCloseTo(PLAN_DIAGONAL_STEP * 2)
  })

  it('hält achsparallele Länge in 8 cm', () => {
    expect(snapWallWidthCm(70, 0)).toBe(72)
    expect(snapWallWidthDelta(192, 3, 0)).toBe(0)
    expect(snapWallWidthDelta(192, 5, 0)).toBe(8)
    expect(snapWallWidthDelta(PLAN_DIAGONAL_STEP, 40, 45)).toBeCloseTo(PLAN_DIAGONAL_STEP * 4)
  })
})

describe('attachAngledWallFromEnd', () => {
  it('lässt die Quellwand unverändert und knüpft eine 90°-Wand ans Ende', () => {
    const next = attachAngledWallFromEnd(stateWith([studio('w', 0, 192)]), 'w', 'end', 90, 96, 'branch')
    const walls = next.buildings[0]!.walls
    const source = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    expect(source.width).toBe(192)
    expect(source.yawDeg ?? 0).toBe(0)
    expect(wallEndPoint(source).x).toBeCloseTo(192)
    expect(wallEndPoint(source).z).toBeCloseTo(0)
    expect(branch.width).toBe(96)
    expect(branch.yawDeg).toBe(90)
    expect(wallStartPoint(branch).x).toBeCloseTo(192)
    expect(wallStartPoint(branch).z).toBeCloseTo(0)
    expect(wallEndPoint(branch).x).toBeCloseTo(192)
    expect(wallEndPoint(branch).z).toBeCloseTo(-96)
    expect(source.planLinked).toBe(true)
    expect(branch.planLinked).toBe(true)
    expect(branch.panelFlip).toBe(true)
    const out = facadeOutward(branch.yawDeg ?? 0, branch.panelFlip ?? true)
    expect(out.x).toBeLessThan(0)
  })

  it('setzt 45°-Wand auf die Diagonale eines 8-cm-Feldes (Endpunkt auf dem Raster)', () => {
    const next = attachAngledWallFromEnd(
      stateWith([studio('w', 0, 192)]),
      'w',
      'end',
      45,
      PLAN_DIAGONAL_STEP,
      'branch',
    )
    const branch = next.buildings[0]!.walls.find((item) => item.id === 'branch')!
    expect(branch.width).toBeCloseTo(PLAN_DIAGONAL_STEP)
    expect(wallStartPoint(branch).x).toBeCloseTo(192)
    expect(wallStartPoint(branch).z).toBeCloseTo(0)
    expect(wallEndPoint(branch).x).toBeCloseTo(200)
    expect(wallEndPoint(branch).z).toBeCloseTo(-8)
  })

  it('dreht die linke Abzweig-Wand so, dass Paneele zur Quelle (außen) zeigen', () => {
    const pose = poseAngledWallFromEnd(studio('w', 0, 192), 'start', 90, 48)
    expect(pose.panelFlip).toBe(true)
    expect(pose.yawDeg).toBe(270)
    expect(pose.originX).toBeCloseTo(0)
    expect(pose.originZ).toBeCloseTo(-48)
    const next = attachAngledWallFromEnd(stateWith([studio('w', 0, 192)]), 'w', 'start', 90, 48, 'branch')
    const source = next.buildings[0]!.walls.find((item) => item.id === 'w')!
    const branch = next.buildings[0]!.walls.find((item) => item.id === 'branch')!
    expect(source.width).toBe(192)
    expect(wallStartPoint(source).x).toBeCloseTo(0)
    expect(wallEndPoint(branch).x).toBeCloseTo(0)
    expect(wallEndPoint(branch).z).toBeCloseTo(0)
    expect(branch.panelFlip).toBe(true)
    const out = facadeOutward(branch.yawDeg ?? 0, branch.panelFlip ?? true)
    expect(out.x).toBeGreaterThan(0)
  })

  it('hält links bei 45° die Außenseite zur Quelle', () => {
    const pose = poseAngledWallFromEnd(studio('w', 0, 192), 'start', 135, 96)
    expect(pose.panelFlip).toBe(true)
    const out = facadeOutward(pose.yawDeg, pose.panelFlip)
    expect(out.x).toBeGreaterThan(0)
  })

  it('90° am Start einer flip-false-Wand: Front auf derselben Bandseite, Ende an der Fuge', () => {
    const source = {
      ...studio('w', 0, 336),
      originX: 180,
      originZ: -1548,
      yawDeg: 90 as const,
      panelFlip: false,
    }
    const pose = poseAngledWallFromEnd(source, 'start', 180, 240)
    expect(pose.panelFlip).toBe(false)
    expect(wallStartPoint({ ...source, ...pose, width: 240, kind: 'studio' } as Wall)).not.toEqual(
      wallStartPoint(source),
    )
    const joint = wallStartPoint(source)
    const branch = {
      ...source,
      ...pose,
      width: 240,
      originX: pose.originX,
      originZ: pose.originZ,
      yawDeg: pose.yawDeg,
      panelFlip: pose.panelFlip,
    }
    expect(wallEndPoint(branch).x).toBeCloseTo(joint.x)
    expect(wallEndPoint(branch).z).toBeCloseTo(joint.z)
    const out = facadeOutward(pose.yawDeg, pose.panelFlip)
    const srcOut = facadeOutward(source.yawDeg, source.panelFlip)
    const srcAlong = { x: 0, z: -1 }
    const srcSide = srcAlong.x * srcOut.z - srcAlong.z * srcOut.x
    const along = { x: Math.cos((pose.yawDeg * Math.PI) / 180), z: -Math.sin((pose.yawDeg * Math.PI) / 180) }
    const side = along.x * out.z - along.z * out.x
    expect(Math.sign(side)).toBe(Math.sign(srcSide))
    expect(out.z).toBeGreaterThan(0)
  })

  it('setzt Gehrung mit Vorzeichen (90°: Betrag = Wandtiefe)', () => {
    const right = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateWith([studio('w', 0, 192)]), 'w', 'end', 90, 96, 'branch'),
    )
    const rightWalls = right.buildings[0]!.walls
    const rightSource = rightWalls.find((item) => item.id === 'w')!
    const rightBranch = rightWalls.find((item) => item.id === 'branch')!
    expect(Math.abs(miterAtWallEnd(rightSource, 'end', rightWalls))).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(miterAtWallEnd(rightBranch, 'start', rightWalls))).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(rightSource.miterEnd ?? 0)).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(rightBranch.miterStart ?? 0)).toBeCloseTo(WALL_DEPTH)

    const left = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateWith([studio('w', 0, 192)]), 'w', 'start', 90, 96, 'branch'),
    )
    const leftWalls = left.buildings[0]!.walls
    const leftSource = leftWalls.find((item) => item.id === 'w')!
    const leftBranch = leftWalls.find((item) => item.id === 'branch')!
    expect(Math.abs(leftSource.miterStart ?? 0)).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(leftBranch.miterEnd ?? 0)).toBeCloseTo(WALL_DEPTH)
  })

  it('setzt 45°-Gehrung mit Vorzeichen (Betrag tan(22,5°) × Tiefe)', () => {
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateWith([studio('w', 0, 192)]), 'w', 'end', 45, 96, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const source = walls.find((item) => item.id === 'w')!
    const expected = WALL_DEPTH * Math.tan(Math.PI / 8)
    expect(Math.abs(source.miterEnd ?? 0)).toBeCloseTo(expected)
  })
})

describe('repairPlanLinkedWallFronts', () => {
  function branchFalseFlip(id: string, originX: number, originZ: number, yawDeg: number, width: number): Wall {
    return {
      ...studio(id, originX, width),
      originZ,
      yawDeg,
      panelFlip: false,
    }
  }

  it('zwei Starts an einer Fuge: Blatt endet an der Fuge, Front auf der Bandseite', () => {
    const source = branchFalseFlip('w5', 180.35, -1547.65, 90, 336)
    const branch = branchFalseFlip('w6', 180.35, -1547.65, 180, 240)
    const joint = wallStartPoint(source)
    expect(wallStartPoint(branch).x).toBeCloseTo(joint.x)
    expect(wallStartPoint(branch).z).toBeCloseTo(joint.z)

    const repaired = repairBuildingPlanLinkedWalls([source, branch])
    const next = repaired.find((item) => item.id === 'w6')!
    expect(wallEndPoint(next).x).toBeCloseTo(joint.x)
    expect(wallEndPoint(next).z).toBeCloseTo(joint.z)
    expect(next.panelFlip).toBe(false)
    const out = facadeOutward(next.yawDeg ?? 0, next.panelFlip ?? true)
    expect(out.z).toBeGreaterThan(0)
  })

  it('hält Öffnungen an derselben Welt-Stelle wenn die Wand umgedreht wird', () => {
    const source = branchFalseFlip('w5', 180, -1548, 90, 336)
    const branch = {
      ...branchFalseFlip('w6', 180, -1548, 180, 240),
      openings: [
        {
          id: 'win',
          type: 'window' as const,
          x: 48,
          y: 96,
          width: 96,
          height: 192,
        },
      ],
    }
    const repaired = repairBuildingPlanLinkedWalls([source, branch])
    const next = repaired.find((item) => item.id === 'w6')!
    expect(next.openings[0]!.x).toBeCloseTo(240 - 48 - 96)
  })

  it('lässt eine bereits korrekte Abzweig-Wand unverändert', () => {
    const attached = attachAngledWallFromEnd(
      stateWith([studio('w', 0, 192)]),
      'w',
      'start',
      90,
      96,
      'branch',
    )
    const walls = attached.buildings[0]!.walls
    const repaired = repairBuildingPlanLinkedWalls(walls)
    for (const wall of walls) {
      const next = repaired.find((item) => item.id === wall.id)!
      expect(next.originX).toBeCloseTo(wall.originX ?? 0)
      expect(next.originZ).toBeCloseTo(wall.originZ ?? 0)
      expect(next.yawDeg).toBe(wall.yawDeg)
      expect(next.panelFlip).toBe(wall.panelFlip)
    }
  })

  it('ändert panelFlip nicht, wenn die Fuge schon Ende→Start ist', () => {
    const attached = attachAngledWallFromEnd(
      stateWith([studio('w', 0, 192)]),
      'w',
      'end',
      90,
      96,
      'branch',
    )
    const walls = attached.buildings[0]!.walls.map((wall) =>
      wall.id === 'branch' ? { ...wall, panelFlip: !(wall.panelFlip ?? true) } : wall,
    )
    const repaired = repairBuildingPlanLinkedWalls(walls)
    expect(repaired.find((item) => item.id === 'branch')!.panelFlip).toBe(
      walls.find((item) => item.id === 'branch')!.panelFlip,
    )
  })

  it('ist idempotent', () => {
    const source = branchFalseFlip('w5', 180, -1548, 90, 336)
    const branch = branchFalseFlip('w6', 180, -1548, 180, 240)
    const once = repairPlanLinkedWallFronts(stateWith([source, branch]))
    const twice = repairPlanLinkedWallFronts(once)
    const a = once.buildings[0]!.walls.find((item) => item.id === 'w6')!
    const b = twice.buildings[0]!.walls.find((item) => item.id === 'w6')!
    expect(b.originX).toBeCloseTo(a.originX ?? 0)
    expect(b.originZ).toBeCloseTo(a.originZ ?? 0)
    expect(b.yawDeg).toBe(a.yawDeg)
    expect(b.panelFlip).toBe(a.panelFlip)
  })

  it('kehrt die Abzweig-Wand nicht zurück, wenn das freie Ende schon an einem Start liegt', () => {
    const source = branchFalseFlip('w5', 180, -1548, 90, 336)
    const branch = branchFalseFlip('w6', 180, -1548, 180, 240)
    const continuation = branchFalseFlip('w7', -60, -1548, 90, 336)
    const repaired = repairBuildingPlanLinkedWalls([source, branch, continuation])
    const next = repaired.find((item) => item.id === 'w6')!
    const joint = wallStartPoint(source)
    expect(wallEndPoint(next).x).toBeCloseTo(joint.x)
    expect(wallEndPoint(next).z).toBeCloseTo(joint.z)
    expect(next.yawDeg).toBe(0)
    const out = facadeOutward(next.yawDeg ?? 0, next.panelFlip ?? true)
    expect(out.z).toBeGreaterThan(0)
  })
})

describe('snapBranchClose / Pfad schließen', () => {
  function wallAt(
    id: string,
    originX: number,
    originZ: number,
    yawDeg: number,
    width: number,
  ): Wall {
    return { ...studio(id, originX, width), originX, originZ, x: originX, yawDeg }
  }

  it('zieht die Breite auf den Ausgangspunkt eines Rechtecks', () => {
    let state = stateWith([studio('a', 0, 192)])
    state = attachAngledWallFromEnd(state, 'a', 'end', 90, 192, 'b')
    state = attachAngledWallFromEnd(state, 'b', 'end', 180, 192, 'c')
    const closed = finalizeStudioGeometry(
      attachAngledWallFromEnd(state, 'c', 'end', 270, 144, 'd'),
    )
    const walls = closed.buildings[0]!.walls
    const d = walls.find((item) => item.id === 'd')!
    const a = walls.find((item) => item.id === 'a')!
    expect(d.width).toBeCloseTo(192)
    expect(wallEndPoint(d).x).toBeCloseTo(wallStartPoint(a).x)
    expect(wallEndPoint(d).z).toBeCloseTo(wallStartPoint(a).z)
    expect(Math.abs(miterAtWallEnd(d, 'end', walls))).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(miterAtWallEnd(a, 'start', walls))).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(d.miterEnd ?? 0)).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(a.miterStart ?? 0)).toBeCloseTo(WALL_DEPTH)
    expect(branchClosesAgainstWalls(d, 'c', walls)).toBe(true)
  })

  it('rastet nicht, wenn die Ecke mehr als 48 cm entfernt ist', () => {
    let state = stateWith([studio('a', 0, 192)])
    state = attachAngledWallFromEnd(state, 'a', 'end', 90, 192, 'b')
    state = attachAngledWallFromEnd(state, 'b', 'end', 180, 192, 'c')
    const next = attachAngledWallFromEnd(state, 'c', 'end', 270, 96, 'd')
    const d = next.buildings[0]!.walls.find((item) => item.id === 'd')!
    expect(d.width).toBeCloseTo(96)
    expect(branchClosesAgainstWalls(d, 'c', next.buildings[0]!.walls)).toBe(false)
  })

  it('findet den T-Stoß auf dem 90°-Strahl', () => {
    const long = wallAt('long', 0, 0, 0, 384)
    const stub = wallAt('stub', 0, 192, 0, 192)
    const joint = wallEndPoint(stub)
    const snap = snapBranchClose(joint, 90, 192, [long, stub], {
      floorY: 0,
      excludeIds: ['stub'],
    })
    expect(snap?.widthCm).toBeCloseTo(192)
    expect(snap?.split).toBeDefined()
  })

  it('teilt die getroffene Wand am T-Stoß und setzt Gehrung', () => {
    const long = wallAt('long', 0, 0, 0, 384)
    const stub = wallAt('stub', 0, 192, 0, 192)
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateWith([long, stub]), 'stub', 'end', 90, 144, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const branch = walls.find((item) => item.id === 'branch')!
    expect(branch.width).toBeCloseTo(192)
    expect(wallEndPoint(branch).x).toBeCloseTo(192)
    expect(wallEndPoint(branch).z).toBeCloseTo(0)
    expect(walls).toHaveLength(4)
    expect(walls.find((item) => item.id === 'long')?.width).toBeCloseTo(192)
    expect(findAdjacentWalls(branch, 'end', walls).length).toBe(2)
    expect(Math.abs(miterAtWallEnd(branch, 'end', walls))).toBeCloseTo(WALL_DEPTH)
    expect(Math.abs(branch.miterEnd ?? 0)).toBeCloseTo(WALL_DEPTH)
    const first = walls.find((item) => item.id === 'long')!
    expect(Math.abs(miterAtWallEnd(first, 'end', walls))).toBeCloseTo(WALL_DEPTH)
  })

  it('zieht 45°-Abzweig auf Ecke mit Querversatz und schließt den Stoß', () => {
    const yaw = 45
    const step = wallWidthStepCm(yaw)
    const widthIdeal = step * 4
    const joint = { x: 0, z: 0 }
    const dir = wallAlongDelta(yaw, 1)
    const dirLen = Math.hypot(dir.x, dir.z) || 1
    const ux = dir.x / dirLen
    const uz = dir.z / dirLen
    const px = -uz
    const pz = ux
    const offsetCm = 8
    const target = {
      x: joint.x + ux * widthIdeal + px * offsetCm,
      z: joint.z + uz * widthIdeal + pz * offsetCm,
    }
    const source = wallAt('src', -192, 0, 0, 192)
    const targetWall = wallAt('tgt', target.x, target.z, 0, 192)

    const snap = snapBranchClose(joint, yaw, widthIdeal - 20, [source, targetWall], {
      floorY: 0,
      excludeIds: ['src'],
    })
    expect(snap?.widthCm).toBeCloseTo(widthIdeal, 5)
    expect(snap?.meet).toBeDefined()

    const closed = finalizeStudioGeometry(
      attachAngledWallFromEnd(
        stateWith([source, targetWall]),
        'src',
        'end',
        yaw,
        widthIdeal - 20,
        'branch',
      ),
    )
    const walls = closed.buildings[0]!.walls
    const branch = walls.find((item) => item.id === 'branch')!
    const free =
      Math.hypot(wallEndPoint(branch).x - target.x, wallEndPoint(branch).z - target.z) <
      Math.hypot(wallStartPoint(branch).x - target.x, wallStartPoint(branch).z - target.z)
        ? wallEndPoint(branch)
        : wallStartPoint(branch)
    expect(Math.hypot(free.x - target.x, free.z - target.z)).toBeLessThan(2)
    expect(branchClosesAgainstWalls(branch, 'src', walls)).toBe(true)
    const neighbors = [
      ...findAdjacentWalls(branch, 'start', walls),
      ...findAdjacentWalls(branch, 'end', walls),
    ]
    expect(neighbors.some((item) => item.id === 'tgt')).toBe(true)
    const freeEnd =
      findAdjacentWalls(branch, 'end', walls).some((item) => item.id === 'tgt') ? 'end' : 'start'
    expect(Math.abs(miterAtWallEnd(branch, freeEnd, walls))).toBeGreaterThan(0.5)
  })

  it('schließt 45°-Pfad bei ~12 cm Querversatz zur Zielecke', () => {
    const yaw = 45
    const step = wallWidthStepCm(yaw)
    const widthIdeal = step * 5
    const joint = { x: 0, z: 0 }
    const dir = wallAlongDelta(yaw, 1)
    const dirLen = Math.hypot(dir.x, dir.z) || 1
    const ux = dir.x / dirLen
    const uz = dir.z / dirLen
    const offsetCm = 12
    const target = {
      x: joint.x + ux * widthIdeal - uz * offsetCm,
      z: joint.z + uz * widthIdeal + ux * offsetCm,
    }
    const source = wallAt('src', -192, 0, 0, 192)
    const targetWall = wallAt('tgt', target.x, target.z, 90, 192)

    expect(
      snapBranchClose(joint, yaw, widthIdeal, [source, targetWall], {
        floorY: 0,
        excludeIds: ['src'],
      })?.widthCm,
    ).toBeCloseTo(widthIdeal, 5)

    const walls = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateWith([source, targetWall]), 'src', 'end', yaw, widthIdeal, 'd'),
    ).buildings[0]!.walls
    const d = walls.find((item) => item.id === 'd')!
    const free =
      Math.hypot(wallEndPoint(d).x - target.x, wallEndPoint(d).z - target.z) <
      Math.hypot(wallStartPoint(d).x - target.x, wallStartPoint(d).z - target.z)
        ? wallEndPoint(d)
        : wallStartPoint(d)
    expect(Math.hypot(free.x - target.x, free.z - target.z)).toBeLessThan(2)
    expect(branchClosesAgainstWalls(d, 'src', walls)).toBe(true)
  })

  it('legt Öffnungen beim Teilen auf das Stück mit dem Mittelpunkt', () => {
    const wall = {
      ...wallAt('long', 0, 0, 0, 384),
      openings: [
        { id: 'win', type: 'window' as const, x: 240, y: 96, width: 96, height: 192 },
      ],
    }
    const parts = splitStudioWallAt(wall, 192)
    expect(parts).not.toBeNull()
    expect(parts![0]!.openings).toHaveLength(0)
    expect(parts![1]!.openings).toHaveLength(1)
    expect(parts![1]!.openings[0]!.x).toBeCloseTo(48)
    expect(parts![0]!.width).toBeCloseTo(192)
    expect(parts![1]!.width).toBeCloseTo(192)
  })
})

describe('translateStudioCorner / angrenzende Wand', () => {
  function wallAt(
    id: string,
    originX: number,
    originZ: number,
    yawDeg: number,
    width: number,
  ): Wall {
    return { ...studio(id, originX, width), originX, originZ, x: originX, yawDeg, panelFlip: true }
  }

  it('streckt die Stoßecke der Nachbarwand, Gegenseite bleibt', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192, 0, 90, 192)
    const next = offsetStudioWallsAlongFront(stateWith([a, b]), 'a', ['a'], 48, {
      collinear: false,
      returnWalls: false,
    })
    const walls = next.buildings[0]!.walls
    const a2 = walls.find((w) => w.id === 'a')!
    const b2 = walls.find((w) => w.id === 'b')!
    expect(a2.originZ).toBeCloseTo(-48)
    expect(wallStartPoint(b2).x).toBeCloseTo(192)
    expect(wallStartPoint(b2).z).toBeCloseTo(-48)
    expect(wallEndPoint(b2).x).toBeCloseTo(192)
    expect(wallEndPoint(b2).z).toBeCloseTo(-192)
    expect(b2.width).toBeCloseTo(144)
  })

  it('beim Verlängern: Nachbar folgt senkrecht, Länge entlang der Achse bleibt', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192, 0, 90, 192)
    const next = stretchStudioFacade(stateWith([a, b]), 'a', 'end', 48)
    const walls = next.buildings[0]!.walls
    const a2 = walls.find((w) => w.id === 'a')!
    const b2 = walls.find((w) => w.id === 'b')!
    expect(a2.width).toBe(240)
    expect(wallEndPoint(a2).x).toBeCloseTo(240)
    expect(wallEndPoint(b2).z).toBeCloseTo(-192)
    expect(wallStartPoint(b2).z).toBeCloseTo(0)
    expect(wallStartPoint(b2).x).toBeCloseTo(240)
    expect(wallEndPoint(b2).x).toBeCloseTo(240)
    expect(b2.width).toBeCloseTo(192)
  })

  it('translateStudioCorner: Front-Versatz streckt nur die Stoßseite', () => {
    const b = wallAt('b', 192, 0, 90, 192)
    const next = translateStudioCorner(stateWith([b]), { x: 192, z: 0 }, { x: 192, z: -48 })
    const b2 = next.buildings[0]!.walls[0]!
    expect(wallStartPoint(b2).z).toBeCloseTo(-48)
    expect(wallEndPoint(b2).z).toBeCloseTo(-192)
    expect(b2.width).toBeCloseTo(144)
  })
})

describe('Front-Verschieben', () => {
  function wallAt(
    id: string,
    originX: number,
    originZ: number,
    yawDeg: number,
    width: number,
  ): Wall {
    return { ...studio(id, originX, width), originX, originZ, x: originX, yawDeg, panelFlip: true }
  }

  it('meldet unverknüpft ausgewählte 45°-Nachbarn', () => {
    let state = attachAngledWallFromEnd(stateWith([wallAt('a', 0, 0, 0, 192)]), 'a', 'end', 45, PLAN_DIAGONAL_STEP, 'd')
    const walls = state.buildings[0]!.walls
    expect(unselectedLinkedDiagonalWalls(walls, ['a']).map((item) => item.id)).toEqual(['d'])
    expect(unselectedLinkedDiagonalWalls(walls, ['a', 'd'])).toHaveLength(0)
  })

  it('verschiebt die Wand nur entlang der Front', () => {
    const wall = wallAt('a', 0, 0, 0, 192)
    expect(frontMoveStepCm(wall)).toBe(8)
    const next = offsetStudioWallsAlongFront(stateWith([wall]), 'a', ['a'], 48)
    const moved = next.buildings[0]!.walls[0]!
    expect(moved.originX).toBeCloseTo(0)
    expect(moved.originZ).toBeCloseTo(-48)
    expect(moved.width).toBe(192)
  })

  it('streckt den 90°-Nachbarn am Stoß und hält die 45°-Wand in der Auswahl', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const side = wallAt('side', 0, 0, 90, 192)
    let state = stateWith([a, side])
    state = attachAngledWallFromEnd(state, 'a', 'end', 45, PLAN_DIAGONAL_STEP, 'diag')
    const before = state.buildings[0]!.walls.find((item) => item.id === 'diag')!
    const diagWidth = before.width
    const moved = offsetStudioWallsAlongFront(state, 'a', ['a', 'diag'], 48)
    const walls = moved.buildings[0]!.walls
    const front = walls.find((item) => item.id === 'a')!
    const sideNext = walls.find((item) => item.id === 'side')!
    const diag = walls.find((item) => item.id === 'diag')!
    expect(front.originZ).toBeCloseTo(-48)
    expect(sideNext.width).toBeCloseTo(144)
    expect(wallStartPoint(sideNext).z).toBeCloseTo(-48)
    expect(wallEndPoint(sideNext).z).toBeCloseTo(-192)
    expect(diag.width).toBeCloseTo(diagWidth)
    expect(diag.yawDeg).toBe(before.yawDeg)
  })

  it('extrudiert ein Mittelsegment: Nachbarn bleiben, Rückwände entstehen (collinear: false)', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192, 0, 0, 192)
    const c = wallAt('c', 384, 0, 0, 192)
    const next = offsetStudioWallsAlongFront(stateWith([a, b, c]), 'b', ['b'], 48, {
      collinear: false,
      returnWalls: true,
    })
    const walls = next.buildings[0]!.walls
    expect(walls.find((w) => w.id === 'a')!.originZ).toBeCloseTo(0)
    expect(walls.find((w) => w.id === 'c')!.originZ).toBeCloseTo(0)
    const mid = walls.find((w) => w.id === 'b')!
    expect(mid.originZ).toBeCloseTo(-48)
    expect(mid.width).toBe(192)
    const returns = walls.filter((w) => !['a', 'b', 'c'].includes(w.id))
    expect(returns).toHaveLength(2)
    for (const r of returns) {
      expect(r.width).toBeCloseTo(48)
      expect(r.planLinked).toBe(true)
      const s = wallStartPoint(r)
      const e = wallEndPoint(r)
      expect(Math.min(s.z, e.z)).toBeCloseTo(-48)
      expect(Math.max(s.z, e.z)).toBeCloseTo(0)
    }
    expect(returns.map((r) => Math.round(wallStartPoint(r).x)).sort((p, q) => p - q)).toEqual([192, 384])
    // Ring-konsistente Laufrichtung: a → (192,0)→(192,-48) → b → (384,-48)→(384,0) → c
    const left = returns.find((r) => Math.round(wallStartPoint(r).x) === 192)!
    const right = returns.find((r) => Math.round(wallStartPoint(r).x) === 384)!
    expect(wallStartPoint(left).z).toBeCloseTo(0)
    expect(wallEndPoint(left).z).toBeCloseTo(-48)
    expect(wallStartPoint(right).z).toBeCloseTo(-48)
    expect(wallEndPoint(right).z).toBeCloseTo(0)
    expect(left.panelFlip).toBe(true)
    expect(right.panelFlip).toBe(true)
    // Gehrungen wie in einem normalen Ring (Ecke: miterEnd der einlaufenden = −miterStart der
    // auslaufenden Wand; Außenecke +/−, Innenecke −/+). Vorher war die rechte Rückwand
    // gegen die Ringrichtung orientiert → Gehrung an zwei Ecken falsch herum.
    const fin = finalizeStudioGeometry(next).buildings[0]!.walls
    const f = (id: string) => fin.find((w) => w.id === id)!
    const fLeft = fin.find((w) => w.id === left.id)!
    const fRight = fin.find((w) => w.id === right.id)!
    const depth = WALL_DEPTH
    // Innenecken (alte Ecken)
    expect(f('a').miterEnd).toBeCloseTo(-depth)
    expect(fLeft.miterStart).toBeCloseTo(depth)
    expect(fRight.miterEnd).toBeCloseTo(-depth)
    expect(f('c').miterStart).toBeCloseTo(depth)
    // Außenecken (neue Ecken)
    expect(fLeft.miterEnd).toBeCloseTo(depth)
    expect(f('b').miterStart).toBeCloseTo(-depth)
    expect(f('b').miterEnd).toBeCloseTo(depth)
    expect(fRight.miterStart).toBeCloseTo(-depth)

    // Zweites Extrudieren: Rückwände werden verlängert, keine neuen
    const again = offsetStudioWallsAlongFront(next, 'b', ['b'], 48, { collinear: false, returnWalls: true })
    const walls2 = again.buildings[0]!.walls
    expect(walls2).toHaveLength(5)
    const returns2 = walls2.filter((w) => !['a', 'b', 'c'].includes(w.id))
    for (const r of returns2) expect(r.width).toBeCloseTo(96)

    // Zurückschieben auf die Flucht: Rückwände verschwinden, Front liegt wieder bei z=0
    const back = offsetStudioWallsAlongFront(again, 'b', ['b'], -96, { collinear: false, returnWalls: true })
    const walls3 = back.buildings[0]!.walls
    expect(walls3.map((w) => w.id).sort()).toEqual(['a', 'b', 'c'])
    expect(walls3.find((w) => w.id === 'b')!.originZ).toBeCloseTo(0)

    // Weiter nach innen (Nische): Rückwände kippen mit, Außenseite zeigt in die Nische
    const recess = offsetStudioWallsAlongFront(next, 'b', ['b'], -96, { collinear: false, returnWalls: true })
    const walls4 = recess.buildings[0]!.walls
    expect(walls4).toHaveLength(5)
    const recessReturns = walls4.filter((w) => !['a', 'b', 'c'].includes(w.id))
    for (const r of recessReturns) {
      expect(r.width).toBeCloseTo(48)
      expect(Math.max(wallStartPoint(r).z, wallEndPoint(r).z)).toBeCloseTo(48)
    }
  })

  it('ohne collinear: false zieht die Flucht weiter mit (bestehendes Verhalten)', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192, 0, 0, 192)
    const next = offsetStudioWallsAlongFront(stateWith([a, b]), 'b', ['b'], 48)
    expect(next.buildings[0]!.walls.find((w) => w.id === 'a')!.originZ).toBeCloseTo(-48)
  })
})

describe('skewStudioWallToDiagonal (Shift an verknüpfter Ecke)', () => {
  function wallAt(
    id: string,
    originX: number,
    originZ: number,
    yawDeg: number,
    width: number,
    openings: Wall['openings'] = [],
  ): Wall {
    return {
      ...studio(id, originX, width),
      originX,
      originZ,
      x: originX,
      yawDeg,
      openings,
      planLinked: true,
    }
  }

  it('erkennt verknüpfte Ecken (90° und 135°), nicht freies Ende', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192, 0, 90, 192)
    const walls = [a, b]
    expect(linkedCornerNeighbor(a, 'end', walls)?.id).toBe('b')
    expect(linkedCornerNeighbor(a, 'start', walls)).toBeNull()

    const diagLen = 96 * Math.SQRT2
    const a45 = wallAt('a45', 0, 0, 45, diagLen)
    const end45 = wallEndPoint(a45)
    const b90 = wallAt('b90', end45.x, end45.z, 90, 192)
    expect(linkedCornerNeighbor(a45, 'end', [a45, b90])?.id).toBe('b90')
  })

  it('stellt 90°→135°: Nachbar nur kürzer, Position/Fenster bleiben', () => {
    // A kürzer als B, sonst liegt der 45°-Schnitt am fernen B-Ende.
    const a = wallAt('a', 0, 0, 0, 96)
    const b = wallAt('b', 96, 0, 90, 192, [
      {
        id: 'win',
        type: 'window',
        x: 48,
        y: 96,
        width: 96,
        height: 192,
      },
    ])
    const state = stateWith([a, b])
    const bFarBefore = wallEndPoint(b)
    const winWorldBefore = {
      x: wallStartPoint(b).x + wallAlongDelta(90, 48 + 48).x,
      z: wallStartPoint(b).z + wallAlongDelta(90, 48 + 48).z,
    }

    const next = skewStudioWallToDiagonal(state, 'a', 'end', -40, -80)
    const walls = next.buildings[0]!.walls
    const a2 = walls.find((w) => w.id === 'a')!
    const b2 = walls.find((w) => w.id === 'b')!
    expect(isDiagonalPlanYaw(a2.yawDeg ?? 0)).toBe(true)
    expect(Math.abs((a2.yawDeg ?? 0) - 45) < 8 || Math.abs((a2.yawDeg ?? 0) - 315) < 8).toBe(true)
    expect(pointsMeet(wallEndPoint(a2), wallStartPoint(b2)) || pointsMeet(wallEndPoint(a2), wallEndPoint(b2))).toBe(
      true,
    )
    // Nachbar: ferne Ecke unverändert, nur Breite kleiner
    expect(pointsMeet(wallEndPoint(b2), bFarBefore) || pointsMeet(wallStartPoint(b2), bFarBefore)).toBe(true)
    expect(b2.width).toBeLessThan(192)
    expect(b2.width).toBeGreaterThan(24)
    // Fenster: Weltlage (Mitte) unverändert, lokales x angepasst
    const along = wallAlongDelta(b2.yawDeg ?? 0, 1)
    const ulen = Math.hypot(along.x, along.z) || 1
    const winMidLocal = b2.openings[0]!.x + b2.openings[0]!.width / 2
    const winWorldAfter = {
      x: wallStartPoint(b2).x + (along.x / ulen) * winMidLocal,
      z: wallStartPoint(b2).z + (along.z / ulen) * winMidLocal,
    }
    expect(winWorldAfter.x).toBeCloseTo(winWorldBefore.x, 0)
    expect(winWorldAfter.z).toBeCloseTo(winWorldBefore.z, 0)
    expect(walls).toHaveLength(2)
  })

  it('stellt die markierte Wand von 135° zurück auf 90°', () => {
    const diagLen = 96 * Math.SQRT2
    const a = wallAt('a', 0, 0, 45, diagLen)
    const joint = wallEndPoint(a)
    const b = wallAt('b', joint.x, joint.z, 90, 96)
    // B geht weiter in −Z; ferne Ecke bei z = joint.z - 96
    const state = stateWith([a, b])
    expect(linkedCornerNeighbor(a, 'end', state.buildings[0]!.walls)?.id).toBe('b')

    const next = skewStudioWallToDiagonal(state, 'a', 'end', 120, -20)
    const a2 = next.buildings[0]!.walls.find((w) => w.id === 'a')!
    const b2 = next.buildings[0]!.walls.find((w) => w.id === 'b')!
    const yaw = a2.yawDeg ?? 0
    expect(isDiagonalPlanYaw(yaw)).toBe(false)
    expect(Math.abs(yaw) < 8 || Math.abs(yaw - 180) < 8 || Math.abs(yaw - 360) < 8).toBe(true)
    expect(pointsMeet(wallEndPoint(a2), wallStartPoint(b2)) || pointsMeet(wallEndPoint(a2), wallEndPoint(b2))).toBe(
      true,
    )
  })

  it('ändert nichts am freien Ende (Abzweig macht der Aufrufer)', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const state = stateWith([a])
    expect(linkedCornerNeighbor(a, 'end', state.buildings[0]!.walls)).toBeNull()
    const next = skewStudioWallToDiagonal(state, 'a', 'end', -80, -120)
    expect(next.buildings[0]!.walls).toHaveLength(1)
    expect(next.buildings[0]!.walls[0]!.yawDeg ?? 0).toBe(0)
  })

  it('lehnt 45° ab, wenn der Nachbar darunter die Mindestbreite verliert', () => {
    const a = wallAt('a', 0, 0, 0, 192)
    const b = wallAt('b', 192, 0, 90, 192)
    const next = skewStudioWallToDiagonal(stateWith([a, b]), 'a', 'end', -80, -120)
    expect(next.buildings[0]!.walls.find((w) => w.id === 'a')!.yawDeg ?? 0).toBe(0)
  })

  it('ändert nur ausgewählte Etagen, nicht den vertikalen Stapel ohne Auswahl', () => {
    const a0 = wallAt('a0', 0, 0, 0, 96)
    const b0 = wallAt('b0', 96, 0, 90, 192)
    const a1 = { ...wallAt('a1', 0, 0, 0, 96), y: 456, height: 456 }
    const b1 = { ...wallAt('b1', 96, 0, 90, 192), y: 456, height: 456 }
    const state = stateWith([a0, b0, a1, b1])
    state.buildings[0]!.floors = [
      { nodes: [], edges: [], showCeiling: true },
      { nodes: [], edges: [], showCeiling: true },
    ]

    const next = skewStudioWallToDiagonal(state, 'a0', 'end', -40, -80, {
      selectedWallIds: ['a0'],
    })
    const walls = next.buildings[0]!.walls
    expect(isDiagonalPlanYaw(walls.find((w) => w.id === 'a0')!.yawDeg ?? 0)).toBe(true)
    expect(walls.find((w) => w.id === 'a1')!.yawDeg ?? 0).toBe(0)
    expect(walls.find((w) => w.id === 'a1')!.width).toBe(96)
    expect(walls.find((w) => w.id === 'b1')!.width).toBe(192)
    expect(next.buildings[0]!.floors[0]!.showCeiling).toBe(true)
  })

  it('zieht markierte OG-Wände mit, wenn sie ausgewählt sind', () => {
    const a0 = wallAt('a0', 0, 0, 0, 96)
    const b0 = wallAt('b0', 96, 0, 90, 192)
    const a1 = { ...wallAt('a1', 0, 0, 0, 96), y: 456, height: 456 }
    const b1 = { ...wallAt('b1', 96, 0, 90, 192), y: 456, height: 456 }
    const next = skewStudioWallToDiagonal(stateWith([a0, b0, a1, b1]), 'a0', 'end', -40, -80, {
      selectedWallIds: ['a0', 'a1'],
    })
    const walls = next.buildings[0]!.walls
    expect(isDiagonalPlanYaw(walls.find((w) => w.id === 'a0')!.yawDeg ?? 0)).toBe(true)
    expect(isDiagonalPlanYaw(walls.find((w) => w.id === 'a1')!.yawDeg ?? 0)).toBe(true)
  })

  it('stretchStudioFacade hält Öffnungen auf der gestreckten Wand', () => {
    const a = wallAt('a', 0, 0, 0, 192, [
      { id: 'win', type: 'window', x: 40, y: 96, width: 96, height: 192 },
    ])
    const b = wallAt('b', 192, 0, 90, 192)
    const next = stretchStudioFacade(stateWith([a, b]), 'a', 'end', 48)
    const a2 = next.buildings[0]!.walls.find((w) => w.id === 'a')!
    expect(a2.width).toBe(240)
    expect(a2.openings).toHaveLength(1)
    expect(a2.openings[0]!.x).toBe(40)
    expect(a2.openings[0]!.width).toBe(96)
  })
})
