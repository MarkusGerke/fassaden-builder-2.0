import { describe, expect, it } from 'vitest'
import type { FacadeState, Opening, Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { resolveProfile } from '../profiles/registry'
import { DEFAULT_STUDIO_PANEL } from '../studio/constants'
import { finalizeStudioGeometry } from '../studio/planGeometry'
import {
  attachAngledWallFromEnd,
  createStudioWall,
  studioPanelFaceLocalZ,
  studioWallTransform,
  PROFILE_BACK_CLEARANCE_CM,
} from '../studio/walls'
import { openingContainsPoint, openingMaskYRangesAtX } from './openingGeometry'
import {
  buildProfilePaths,
  clipProfileSectionAboveCm,
  clipProfileSectionMinusYHoles,
  createPlinthProfileSweepGeometry,
  createProfileSweepGeometry,
  plinthHoleYRangesAtX,
  scaleProfileSectionAxes,
  transformProfileSection,
  trimBandOpeningXHoles,
  type ProfilePath,
} from './profilePaths'

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

function localToWorld(wall: Wall, localX: number, localZ: number): { x: number; z: number } {
  const t = studioWallTransform(wall)
  const cos = Math.cos(t.rotationY)
  const sin = Math.sin(t.rotationY)
  return {
    x: t.position.x + localX * cos + localZ * sin,
    z: t.position.z - localX * sin + localZ * cos,
  }
}

function plinthPathForWall(state: FacadeState, wallId: string): ProfilePath {
  const path = buildProfilePaths(state).find((item) => item.role === 'plinthProfile' && item.wallId === wallId)
  expect(path, `kein Sockelprofil-Pfad für ${wallId}`).toBeTruthy()
  return path!
}

function plinthSweepGeometry(wall: Wall, path: ProfilePath) {
  const profile = resolveProfile(path.profileId, undefined)
  expect(profile?.section).toBeTruthy()
  const section = scaleProfileSectionAxes(
    transformProfileSection(
      profile!.section!,
      path.rotationDeg ?? 0,
      path.flipOutward ?? false,
      path.flipForward ?? false,
    ),
    path.sectionScale ?? 1,
    path.sectionScaleForward ?? path.sectionScale ?? 1,
  )
  const forwardSign = path.forwardSign ?? 1
  const zBase = studioPanelFaceLocalZ(wall) + (path.offsetForward ?? 0) * forwardSign
  const plinthH = wall.panel?.plinthHeight ?? 0
  if (path.clipOpeningMask && plinthH > 0.5) {
    return createPlinthProfileSweepGeometry(path, section, zBase, forwardSign, wall, plinthH)
  }
  return createProfileSweepGeometry(path, section, zBase, forwardSign)
}

function plinthEndFrontWorld(
  wall: Wall,
  state: FacadeState,
  end: 'start' | 'end',
): { x: number; z: number } {
  const path = plinthPathForWall(state, wall.id)
  const geo = plinthSweepGeometry(wall, path)
  const pos = geo.getAttribute('position') as { getX(i: number): number; getZ(i: number): number; count: number }
  const forwardSign = path.forwardSign ?? 1
  let frontZ = pos.getZ(0)
  for (let i = 1; i < pos.count; i += 1) {
    const z = pos.getZ(i)
    frontZ = forwardSign >= 0 ? Math.max(frontZ, z) : Math.min(frontZ, z)
  }
  let bestX = end === 'start' ? Infinity : -Infinity
  let bestZ = frontZ
  for (let i = 0; i < pos.count; i += 1) {
    const z = pos.getZ(i)
    if (Math.abs(z - frontZ) > 0.8) continue
    const x = pos.getX(i)
    if (end === 'start' ? x < bestX : x > bestX) {
      bestX = x
      bestZ = z
    }
  }
  expect(Number.isFinite(bestX)).toBe(true)
  return localToWorld(wall, bestX, bestZ)
}

describe('Profil-Sweep Bilderrahmen-Gehrung', () => {
  it('Front-X folgt z × tan, auch wenn die Rückseite weit vor z = 0 sitzt', () => {
    const halfW = 240
    const zBack = 36
    const forward = 8
    const path: ProfilePath = {
      profileId: 'test',
      wallId: 'w',
      points: [
        { x: -halfW, y: 0 },
        { x: halfW, y: 0 },
      ],
      closed: false,
      outward: [{ x: 0, y: 1 }],
      zOffset: 0,
      localSpace: true,
      forwardSign: 1,
      planMiterStart: 1,
      planMiterEnd: -1,
      capStart: false,
      capEnd: false,
    }
    const section = [
      { outward: 0, forward: 0 },
      { outward: 32, forward: 0 },
      { outward: 32, forward },
      { outward: 0, forward },
    ]
    const geo = createProfileSweepGeometry(path, section, zBack, 1)
    const pos = geo.getAttribute('position') as { getX(i: number): number; getZ(i: number): number; count: number }
    const frontZ = zBack + forward
    let minX = Infinity
    for (let i = 0; i < pos.count; i += 1) {
      if (Math.abs(pos.getZ(i) - frontZ) > 0.05) continue
      minX = Math.min(minX, pos.getX(i))
    }
    expect(minX).toBeCloseTo(-halfW + frontZ, 1)
  })

  it('Öffnungsprofil: Fußplatte (forward=0) wird vor die Paneelfläche gehoben', () => {
    const zBack = 0
    const path: ProfilePath = {
      profileId: 'test',
      wallId: 'w',
      openingId: 'o1',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      closed: false,
      outward: [{ x: 0, y: 1 }],
      zOffset: 0,
      localSpace: true,
      forwardSign: 1,
      capStart: false,
      capEnd: false,
    }
    const section = [
      { outward: 0, forward: 0 },
      { outward: 12, forward: 0 },
      { outward: 12, forward: 8 },
      { outward: 0, forward: 8 },
    ]
    const geo = createProfileSweepGeometry(path, section, zBack, 1)
    const pos = geo.getAttribute('position') as { getZ(i: number): number; count: number }
    let minZ = Infinity
    for (let i = 0; i < pos.count; i += 1) minZ = Math.min(minZ, pos.getZ(i))
    expect(minZ).toBeCloseTo(PROFILE_BACK_CLEARANCE_CM, 5)
  })

  it('90° rechts: Sockelprofil-Fronten treffen sich', () => {
    const source = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 192,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      buildingId: 'b1',
      planLinked: true,
    }
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateFromWall(source), 'w', 'end', 90, 96, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const src = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    const a = plinthEndFrontWorld(src, next, 'end')
    const b = plinthEndFrontWorld(branch, next, 'start')
    const gap = Math.hypot(a.x - b.x, a.z - b.z)
    expect(gap, `Sockellücke ${gap.toFixed(2)} cm`).toBeLessThan(2)
  })

  it('45° rechts: Sockelprofil-Fronten treffen sich', () => {
    const source = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 192,
      originX: 0,
      originZ: 0,
      yawDeg: 0 as const,
      buildingId: 'b1',
      planLinked: true,
    }
    const next = finalizeStudioGeometry(
      attachAngledWallFromEnd(stateFromWall(source), 'w', 'end', 45, 96, 'branch'),
    )
    const walls = next.buildings[0]!.walls
    const src = walls.find((item) => item.id === 'w')!
    const branch = walls.find((item) => item.id === 'branch')!
    const a = plinthEndFrontWorld(src, next, 'end')
    const b = plinthEndFrontWorld(branch, next, 'start')
    const gap = Math.hypot(a.x - b.x, a.z - b.z)
    expect(gap, `Sockellücke ${gap.toFixed(2)} cm miter=${src.miterEnd}`).toBeLessThan(2)
  })

  it('Live-Zickzack 90° (panelFlip false): Sockelprofil-Fronten treffen sich', () => {
    const w480 = {
      ...createStudioWall(0, 0),
      id: '2c449e89-15d3-4c03-92a8-5c881e9db5f4',
      width: 480,
      originX: -59.64675298172568,
      originZ: -1787.6467529817257,
      yawDeg: 0 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
    }
    const w384 = {
      ...createStudioWall(0, 0),
      id: '5e43fa5e-5506-4ecb-96b7-d16f1bedc506',
      width: 384,
      originX: 420.3532470182743,
      originZ: -1787.6467529817257,
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
          wallHeight: 624,
          wallDepth: WALL_DEPTH,
          walls: [w480, w384],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    })
    const walls = state.buildings[0]!.walls
    const a = walls.find((item) => item.id === w480.id)!
    const b = walls.find((item) => item.id === w384.id)!
    const paths = buildProfilePaths(state).filter((p) => p.role === 'plinthProfile')
    const p480 = paths.find((p) => p.wallId === a.id)!
    const p384 = paths.find((p) => p.wallId === b.id)!
    expect(p480, 'Sockelpfad 480').toBeTruthy()
    expect(p384, 'Sockelpfad 384').toBeTruthy()
    expect(p480.planMiterEnd, `planMiterEnd 480=${p480.planMiterEnd}`).not.toBe(0)
    expect(p384.planMiterStart, `planMiterStart 384=${p384.planMiterStart}`).not.toBe(0)
    const pa = plinthEndFrontWorld(a, state, 'end')
    const pb = plinthEndFrontWorld(b, state, 'start')
    const gap = Math.hypot(pa.x - pb.x, pa.z - pb.z)
    expect(gap, `Sockellücke ${gap.toFixed(2)} cm ${JSON.stringify({ pa, pb, miter480: p480.planMiterEnd, miter384: p384.planMiterStart })}`).toBeLessThan(2)
  })

  it('90° mit panelFlip false: Sockelprofil-Fronten treffen sich', () => {
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
    const a = state.buildings[0]!.walls.find((item) => item.id === 'a')!
    const b = state.buildings[0]!.walls.find((item) => item.id === 'b')!
    const pa = plinthEndFrontWorld(a, state, 'end')
    const pb = plinthEndFrontWorld(b, state, 'start')
    const gap = Math.hypot(pa.x - pb.x, pa.z - pb.z)
    expect(gap, `Sockellücke ${gap.toFixed(2)} cm ${JSON.stringify({ pa, pb })}`).toBeLessThan(2)
  })

  it('Live-Zickzack 45° (panelFlip false): Sockelprofil-Fronten treffen sich', () => {
    const w768 = {
      ...createStudioWall(0, 0),
      id: '7b2d6d1e-1d4a-4224-9c77-f6591b62c425',
      width: 768,
      originX: 768,
      originZ: -1200,
      yawDeg: 0 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
    }
    const w288 = {
      ...createStudioWall(0, 0),
      id: '7d263377-8850-4018-ab09-e573e8d588b6',
      width: 288,
      originX: 564.3532470182744,
      originZ: -1403.6467529817257,
      yawDeg: 315 as const,
      panelFlip: false,
      buildingId: 'b1',
      planLinked: true,
    }
    const state = finalizeStudioGeometry({
      buildings: [
        {
          id: 'b1',
          name: 'Haus',
          wallHeight: 624,
          wallDepth: WALL_DEPTH,
          walls: [w768, w288],
          floors: [{ nodes: [], edges: [] }],
        },
      ],
      activeBuildingId: 'b1',
    })
    const a = state.buildings[0]!.walls.find((item) => item.id === w768.id)!
    const b = state.buildings[0]!.walls.find((item) => item.id === w288.id)!
    const pa = plinthEndFrontWorld(a, state, 'start')
    const pb = plinthEndFrontWorld(b, state, 'end')
    const gap = Math.hypot(pa.x - pb.x, pa.z - pb.z)
    expect(gap, `Sockellücke 45° ${gap.toFixed(2)} cm ${JSON.stringify({ pa, pb })}`).toBeLessThan(2)
  })
})

describe('Zierband-Löcher', () => {
  it('schneidet am Rundbogen nur die Sehne, nicht das volle Rechteck', () => {
    const opening: Opening = {
      id: 'win-arch',
      type: 'window',
      x: 64,
      y: 80,
      width: 96,
      height: 160,
      arch: { enabled: true, form: 'round' },
    }
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 384,
      openings: [opening],
      profiles: [],
    }
    const body = trimBandOpeningXHoles(wall, 120, 0, true)
    expect(body).toHaveLength(1)
    expect(body[0]!.x1 - body[0]!.x0).toBeCloseTo(96, 0)

    const crown = trimBandOpeningXHoles(wall, 230, 0, true)
    expect(crown.length).toBeGreaterThan(0)
    const crownW = crown[0]!.x1 - crown[0]!.x0
    expect(crownW).toBeGreaterThan(20)
    expect(crownW).toBeLessThan(80)
  })

  it('weitet das Loch um das Rahmenprofil', () => {
    const opening: Opening = {
      id: 'win-1',
      type: 'window',
      x: 80,
      y: 96,
      width: 96,
      height: 160,
    }
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 384,
      openings: [opening],
      profiles: [{ openingId: 'win-1', profileId: 'fensterprofil32x120', edge: 'left' }],
    }
    const without = trimBandOpeningXHoles({ ...wall, profiles: [] }, 160, 0, true)
    const withProfile = trimBandOpeningXHoles(wall, 160, 0, true)
    expect(without[0]!.x1 - without[0]!.x0).toBeCloseTo(96, 0)
    expect(withProfile[0]!.x1 - withProfile[0]!.x0).toBeGreaterThan(96 + 8)
  })
})

describe('Sockel um Kellerfenster', () => {
  const basementRect: Opening = {
    id: 'bw',
    type: 'window',
    x: 80,
    y: 0,
    width: 48,
    height: 64,
    basementWindow: { enabled: true, grilleHeight: 0.5 },
  }
  const basementArch: Opening = {
    id: 'bw',
    type: 'window',
    x: 80,
    y: 0,
    width: 96,
    height: 64,
    arch: { enabled: true, form: 'round', voussoirs: false },
    basementWindow: { enabled: true, grilleHeight: 0.5 },
  }

  it('stanzt die Öffnungsmaske als Y-Loch in den Sockelstreifen', () => {
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 384,
      height: 256,
      openings: [basementRect],
    }
    const atWindow = plinthHoleYRangesAtX(wall, 104, 96)
    expect(atWindow).toHaveLength(1)
    expect(atWindow[0]!.y0).toBeCloseTo(0, 0)
    expect(atWindow[0]!.y1).toBeCloseTo(65, 0)
    const beside = plinthHoleYRangesAtX(wall, 20, 96)
    expect(beside).toHaveLength(0)
  })

  it('folgt dem Bogen: Loch-Oberkante am Scheitel höher als am Kämpfer', () => {
    const mid = openingMaskYRangesAtX(basementArch, 80 + 48)
    const side = openingMaskYRangesAtX(basementArch, 80 + 12)
    expect(mid.length).toBeGreaterThanOrEqual(1)
    expect(side.length).toBeGreaterThanOrEqual(1)
    expect(mid[0]!.y1).toBeGreaterThan(side[0]!.y1 + 4)
  })

  it('legt ein durchgehendes Sockelprofil mit Öffnungsmaske an', () => {
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 384,
      height: 256,
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        plinthEnabled: true,
        plinthHeight: 96,
        plinthProfileId: 'sockelprofil',
      },
      openings: [basementRect],
    }
    const state = stateFromWall(wall)
    const paths = buildProfilePaths(state).filter((p) => p.role === 'plinthProfile' && p.wallId === 'w')
    expect(paths).toHaveLength(1)
    expect(paths[0]!.clipOpeningMask).toBe(true)
    expect(paths[0]!.sectionClipBelowCm).toBeUndefined()
    const halfW = wall.width / 2
    expect(paths[0]!.points[0]!.y).toBeCloseTo(-wall.height / 2, 5)
    expect(paths[0]!.points[0]!.x).toBeCloseTo(-halfW, 5)
    expect(paths[0]!.points[1]!.x).toBeCloseTo(halfW, 5)
  })

  it('lässt den Profilquerschnitt um das Loch stehen, ohne ihn auf die Sohle zu schieben', () => {
    const section = [
      { outward: 0, forward: 0 },
      { outward: 96, forward: 0 },
      { outward: 96, forward: 8 },
      { outward: 0, forward: 8 },
      { outward: 0, forward: 0 },
    ]
    const pieces = clipProfileSectionMinusYHoles(section, [{ y0: 0, y1: 64 }])
    expect(pieces).toHaveLength(1)
    expect(Math.min(...pieces[0]!.map((p) => p.outward))).toBeCloseTo(64, 5)
    expect(Math.max(...pieces[0]!.map((p) => p.outward))).toBeCloseTo(96, 5)
  })

  it('schneidet den Profilquerschnitt oberhalb einer Höhe zu', () => {
    const section = [
      { outward: 0, forward: 0 },
      { outward: 96, forward: 0 },
      { outward: 96, forward: 8 },
      { outward: 0, forward: 8 },
      { outward: 0, forward: 0 },
    ]
    const clipped = clipProfileSectionAboveCm(section, 64)
    expect(clipped.length).toBeGreaterThanOrEqual(3)
    expect(Math.min(...clipped.map((p) => p.outward))).toBeCloseTo(0, 5)
    expect(Math.max(...clipped.map((p) => p.outward))).toBeCloseTo(32, 5)
  })

  it('erzeugt keine Sweep-Vertices im Inneren der Kellerfenster-Öffnung', () => {
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: 'w',
      width: 384,
      height: 256,
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        plinthEnabled: true,
        plinthHeight: 96,
        plinthProfileId: 'sockelprofil',
      },
      openings: [basementArch],
    }
    const state = stateFromWall(wall)
    const path = buildProfilePaths(state).find((p) => p.role === 'plinthProfile' && p.wallId === 'w')
    expect(path, 'Sockelprofil-Pfad fehlt').toBeTruthy()
    const geo = plinthSweepGeometry(wall, path!)
    const pos = geo.getAttribute('position')
    expect(pos).toBeTruthy()
    expect(pos!.count).toBeGreaterThan(50)
    const opening = basementArch
    const usedCsg = !geo.userData.plinthOpeningDiscard
    expect(usedCsg, 'Sockel-CSG sollte das Öffnungsvolumen abziehen').toBe(true)
    let onOpening = 0
    let lintel = 0
    for (let i = 0; i < pos!.count; i += 1) {
      const wallX = pos!.getX(i) + wall.width / 2
      const wallY = pos!.getY(i) + wall.height / 2
      if (wallX > opening.x + 2 && wallX < opening.x + opening.width - 2) {
        onOpening += 1
        if (wallY > opening.y + opening.height - 8) lintel += 1
      }
    }
    expect(onOpening, 'CSG sollte Schnittvertices an der Öffnung erzeugen').toBeGreaterThan(10)
    expect(lintel, 'Sockel-Sturz über dem Bogen sollte erhalten bleiben').toBeGreaterThan(4)
    const index = geo.index
    const triCount = index ? index.count / 3 : pos!.count / 3
    const vert = (i: number) => {
      const vi = index ? index.getX(i) : i
      return {
        x: pos!.getX(vi) + wall.width / 2,
        y: pos!.getY(vi) + wall.height / 2,
      }
    }
    let inside = 0
    const bary = [
      [1 / 3, 1 / 3, 1 / 3],
      [0.6, 0.2, 0.2],
      [0.2, 0.6, 0.2],
      [0.2, 0.2, 0.6],
    ]
    for (let t = 0; t < triCount; t += 1) {
      const a = vert(t * 3)
      const b = vert(t * 3 + 1)
      const c = vert(t * 3 + 2)
      for (const w of bary) {
        const wallX = a.x * w[0]! + b.x * w[1]! + c.x * w[2]!
        const wallY = a.y * w[0]! + b.y * w[1]! + c.y * w[2]!
        if (
          wallX > opening.x + 16 &&
          wallX < opening.x + opening.width - 16 &&
          wallY > opening.y + 16 &&
          wallY < opening.y + opening.height - 16 &&
          openingContainsPoint(opening, wallX, wallY)
        ) {
          inside += 1
        }
      }
    }
    expect(inside).toBe(0)
  })
})
