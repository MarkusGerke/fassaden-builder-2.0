import { describe, expect, it } from 'vitest'
import {
  applyBayDrop,
  bayDropCm,
  bayHostWall,
  bayPresetFittedToWallWidth,
  bayStackWallIds,
  buildBaySlideGuideModel,
  flattenBayToFlatWall,
  insertBayAsWallSegment,
  replaceWallWithBayPreset,
  slideBaySegmentAlong,
  canSlideBaySegment,
  swapBayPreset,
} from './baySegment'
import { BAY_WINDOW_PRESETS, bayMouthWidthCm, bayWallSkirtDropCm } from './bayWindow'
import { createStudioWall, wallEndPoint, wallStartPoint } from './walls'
import { WALL_DEPTH } from '../constants/presets'
import { emptyNeighbors, type FacadeState, type Wall } from '../types/facade'
import { createId } from '../utils/id'

function bayPreset(front: number, depth: number, shape: 'rect' | 'angled45' = 'rect') {
  const key = shape === 'rect' ? 'rect' : '45'
  return BAY_WINDOW_PRESETS.find((p) => p.id === `bay-f${front}-d${depth}-${key}`)!
}

function stateWithWall(wall: Wall): FacadeState {
  return {
    buildings: [
      {
        id: 'b1',
        name: 'B',
        wallHeight: 512,
        wallDepth: WALL_DEPTH,
        walls: [wall],
        floors: [],
        groups: [],
      },
    ],
    activeBuildingId: 'b1',
    neighbors: emptyNeighbors(),
  } as FacadeState
}

describe('baySegment', () => {
  it('insertBayAsWallSegment singleFloor teilt nur die Seed-Etage', () => {
    const preset = bayPreset(192, 96)
    const base: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 448,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const upper: Wall = { ...base, id: createId(), y: 448 }
    const state = stateWithWall(base)
    state.buildings[0]!.walls.push(upper)
    state.buildings[0]!.wallHeight = 448

    const onlyLower = insertBayAsWallSegment(state, base.id, preset, 288, { singleFloor: true })!
    const walls = onlyLower.state.buildings[0]!.walls
    expect(walls.filter((w) => w.bayWindow).length).toBe(1)
    expect(walls.some((w) => w.id === upper.id && !w.bayRole)).toBe(true)

    const both = insertBayAsWallSegment(state, base.id, preset, 288)!
    expect(both.state.buildings[0]!.walls.filter((w) => w.bayWindow).length).toBe(2)
  })

  it('bayPresetFittedToWallWidth dehnt 90°-Front auf die Wand', () => {
    const preset = bayPreset(192, 96)
    const fitted = bayPresetFittedToWallWidth(preset, 384)!
    expect(fitted.frontWidthCm).toBe(384)
    expect(fitted.depthCm).toBe(96)
    expect(bayMouthWidthCm(fitted)).toBe(384)
  })

  it('bayPresetFittedToWallWidth: 45° hält Tiefe, Front = Mund − 2D', () => {
    const preset = bayPreset(192, 96, 'angled45')
    const fitted = bayPresetFittedToWallWidth(preset, 576)!
    expect(fitted.depthCm).toBe(96)
    expect(fitted.frontWidthCm).toBe(576 - 192)
  })

  it('insertBayAsWallSegment teilt breite Wand und setzt Preset-Mundbreite', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const result = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)
    expect(result).not.toBeNull()
    const walls = result!.state.buildings[0]!.walls
    const bayFront = walls.find((w) => w.bayRole === 'front')
    expect(bayFront?.width).toBeCloseTo(192, 5)
    expect(bayFront?.openings.length).toBeGreaterThan(0)
    // Reststücke links/rechts
    const remnants = walls.filter((w) => !w.bayRole && !w.bayWindow)
    expect(remnants.length).toBeGreaterThanOrEqual(2)
    const totalStraight = remnants.reduce((s, w) => s + w.width, 0)
    expect(totalStraight + bayMouthWidthCm(preset)).toBeCloseTo(576, 0)
  })

  it('replaceWallWithBayPreset auf passender Breite skaliert nicht', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 192,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
    }
    const result = replaceWallWithBayPreset(stateWithWall(wall), wall.id, preset)!
    const front = result.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(192, 5)
  })

  it('slideBaySegmentAlong verschiebt Erker und tauscht Restbreiten', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    expect(canSlideBaySegment(inserted.state.buildings[0]!.walls, host.id)).toBe(true)

    const before = inserted.state.buildings[0]!.walls
    const leftBefore = before.find((w) => !w.bayRole && !w.bayWindow && (w.originX ?? w.x) < 100)!
    const rightBefore = before.find((w) => !w.bayRole && !w.bayWindow && (w.originX ?? w.x) > 200)!
    const frontBefore = before.find((w) => w.bayRole === 'front')!
    const frontStart = wallStartPoint(frontBefore)

    const slid = slideBaySegmentAlong(inserted.state, host.id, 48)!
    const after = slid.buildings[0]!.walls
    const leftAfter = after.find((w) => w.id === leftBefore.id)!
    const rightAfter = after.find((w) => w.id === rightBefore.id)!
    const frontAfter = after.find((w) => w.id === frontBefore.id)!
    expect(leftAfter.width).toBeCloseTo(leftBefore.width + 48, 5)
    expect(rightAfter.width).toBeCloseTo(rightBefore.width - 48, 5)
    const frontStartAfter = wallStartPoint(frontAfter)
    expect(frontStartAfter.x - frontStart.x).toBeCloseTo(48, 5)
  })

  it('slideBaySegmentAlong rastet auf 8-cm-Schritte', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const frontBefore = inserted.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    const x0 = wallStartPoint(frontBefore).x

    // 12 → 16 (round half-up), 3 → 0 (kein Schritt), 20 → 24
    const s12 = slideBaySegmentAlong(inserted.state, host.id, 12)!
    expect(wallStartPoint(s12.buildings[0]!.walls.find((w) => w.id === frontBefore.id)!).x - x0).toBeCloseTo(16, 5)
    const s3 = slideBaySegmentAlong(inserted.state, host.id, 3)!
    expect(wallStartPoint(s3.buildings[0]!.walls.find((w) => w.id === frontBefore.id)!).x - x0).toBeCloseTo(0, 5)
    const s20 = slideBaySegmentAlong(inserted.state, host.id, 20)!
    expect(wallStartPoint(s20.buildings[0]!.walls.find((w) => w.id === frontBefore.id)!).x - x0).toBeCloseTo(24, 5)
  })

  it('slideBaySegmentAlong lässt keine Lücken: Reststücke enden am Erker-Mund', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const slid = slideBaySegmentAlong(inserted.state, host.id, -72)!
    const walls = slid.buildings[0]!.walls
    const sides = walls.filter((w) => w.bayRole === 'side')
    const remnants = walls.filter((w) => !w.bayRole && !w.bayWindow)
    expect(sides.length).toBe(2)
    expect(remnants.length).toBe(2)
    const total = remnants.reduce((s, w) => s + w.width, 0)
    expect(total + bayMouthWidthCm(preset)).toBeCloseTo(576, 0)
    // Jeder Mundpunkt der Schenkel trifft ein Rest-Ende
    const attachPts = [wallStartPoint(sides[0]!), wallEndPoint(sides[1]!)]
    for (const pt of attachPts) {
      const hit = remnants.some((r) => {
        const s = wallStartPoint(r)
        const e = wallEndPoint(r)
        return Math.hypot(s.x - pt.x, s.z - pt.z) < 1 || Math.hypot(e.x - pt.x, e.z - pt.z) < 1
      })
      expect(hit).toBe(true)
    }
  })

  it('slideBaySegmentAlong nimmt Erker anderer Etagen im Stapel mit', () => {
    const preset = bayPreset(192, 96)
    const base: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const upper: Wall = { ...base, id: createId(), y: 512 }
    const state = stateWithWall(base)
    state.buildings[0]!.walls.push(upper)
    const inserted = insertBayAsWallSegment(state, base.id, preset, 288)!
    const walls = inserted.state.buildings[0]!.walls
    const hosts = walls.filter((w) => w.bayWindow)
    expect(hosts.length).toBe(2)
    const lowerHost = hosts.find((h) => Math.abs(h.y ?? 0) < 1)!
    const fronts = walls.filter((w) => w.bayRole === 'front')
    expect(fronts.length).toBe(2)
    const xBefore = fronts.map((f) => wallStartPoint(f).x)

    const slid = slideBaySegmentAlong(inserted.state, lowerHost.id, 48)!
    const after = slid.buildings[0]!.walls
    fronts.forEach((f, i) => {
      const moved = after.find((w) => w.id === f.id)!
      expect(wallStartPoint(moved).x - xBefore[i]!).toBeCloseTo(48, 5)
    })
    expect(bayStackWallIds(after, lowerHost.id)?.length).toBe(6)
  })

  it('flattenBayToFlatWall entfernt Erker und verschmilzt Reststücke', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
      storeyIndex: 0,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const dropped = applyBayDrop(inserted.state, host.id, 96)!
    const hostAfter = dropped.buildings[0]!.walls.find((w) => w.bayWindow)!
    expect(hostAfter.y).toBeLessThan(0)
    const flat = flattenBayToFlatWall(dropped, hostAfter.id)!
    const walls = flat.state.buildings[0]!.walls
    expect(walls.every((w) => !w.bayWindow && !w.bayParentId && !w.bayRole)).toBe(true)
    const total = walls.reduce((s, w) => s + w.width, 0)
    expect(total).toBeCloseTo(576, 0)
    // Flat-Wand auf Etagenfuß (ohne Rock), storeyIndex erhalten.
    for (const w of walls) {
      expect(w.y).toBeCloseTo(0, 0)
      expect(w.height).toBeCloseTo(512, 0)
      expect(w.storeyIndex ?? 0).toBe(0)
    }
  })

  it('applyBayDrop verlängert nach unten, Oberkante bleibt fix', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const memberIds = new Set(bayStackWallIds(inserted.state.buildings[0]!.walls, host.id)!)
    const before = inserted.state.buildings[0]!.walls.filter((w) => memberIds.has(w.id))
    const tops = new Map(before.map((w) => [w.id, (w.y ?? 0) + w.height]))

    const dropped = applyBayDrop(inserted.state, host.id, 96)!
    const after = dropped.buildings[0]!.walls.filter((w) => memberIds.has(w.id))
    for (const w of after) {
      const b = before.find((x) => x.id === w.id)!
      expect(w.y ?? 0).toBeCloseTo((b.y ?? 0) - 96, 5)
      expect(w.height).toBeCloseTo(b.height + 96, 5)
      // Oberkante unverändert.
      expect((w.y ?? 0) + w.height).toBeCloseTo(tops.get(w.id)!, 5)
      // Öffnungen behalten die Welthöhe (lokales y wächst mit dem Drop).
      for (const o of w.openings) {
        const bo = b.openings.find((x) => x.id === o.id)
        if (bo) expect(o.y).toBeCloseTo((bo.y ?? 0) + 96, 5)
      }
    }
    const hostAfter = dropped.buildings[0]!.walls.find((w) => w.id === host.id)!
    expect(hostAfter.bayWindow?.dropCm).toBe(96)
    expect(bayDropCm(dropped.buildings[0]!.walls, host.id)).toBe(96)
  })

  it('bayWallSkirtDropCm hält Sockel auf Restwand-Fuß (Schenkel = Front)', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const remnantY = inserted.state.buildings[0]!.walls.find(
      (w) => !w.bayWindow && !w.bayParentId && !w.bayRole,
    )!.y
    const dropped = applyBayDrop(inserted.state, host.id, 96)!
    const walls = dropped.buildings[0]!.walls
    const front = walls.find((w) => w.bayRole === 'front')!
    const sides = walls.filter((w) => w.bayRole === 'side')
    expect(sides.length).toBe(2)
    for (const w of [front, ...sides]) {
      const skirt = bayWallSkirtDropCm(w, walls)
      expect(skirt).toBeCloseTo(remnantY - (w.y ?? 0), 0)
      expect((w.y ?? 0) + skirt).toBeCloseTo(remnantY, 0)
    }
  })

  it('applyBayDrop ist idempotent (Zielwert absolut, Delta angewandt)', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const once = applyBayDrop(inserted.state, host.id, 96)!
    // Erneut mit gleichem Zielwert → keine weitere Änderung.
    const twice = applyBayDrop(once, host.id, 96)!
    const front1 = once.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    const front2 = twice.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front2.height).toBeCloseTo(front1.height, 5)
    expect(front2.y ?? 0).toBeCloseTo(front1.y ?? 0, 5)
    // Zurück auf 0 → Ausgangshöhe.
    const zero = applyBayDrop(once, host.id, 0)!
    const frontZero = zero.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(frontZero.height).toBeCloseTo(512, 5)
    expect(bayDropCm(zero.buildings[0]!.walls, host.id)).toBe(0)
  })

  it('buildBaySlideGuideModel liefert Ersatz-Wand mit Mundöffnung', () => {
    const preset = bayPreset(192, 96)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    expect(bayHostWall(inserted.state.buildings[0]!.walls, host.id)?.id).toBe(host.id)
    const model = buildBaySlideGuideModel(inserted.state.buildings[0]!.walls, host.id)
    expect(model).not.toBeNull()
    expect(model!.opening.width).toBeCloseTo(bayMouthWidthCm(preset), 0)
    expect(model!.peers.length).toBeGreaterThanOrEqual(1)
    // Ersatz-Wand deckt Rest links + Mund + Rest rechts ab.
    expect(model!.wall.width).toBeCloseTo(576, 0)
  })

  it('swapBayPreset tauscht Preset bei gleichem Mundzentrum', () => {
    const presetA = bayPreset(192, 96)
    const presetB = bayPreset(192, 144)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, presetA, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const swapped = swapBayPreset(inserted.state, host.id, presetB)!
    const meta = swapped.state.buildings[0]!.walls.find((w) => w.bayWindow)?.bayWindow
    expect(meta?.depthCm).toBe(144)
    expect(meta?.frontWidthCm).toBe(192)
    const front = swapped.state.buildings[0]!.walls.find((w) => w.bayRole === 'front')!
    expect(front.width).toBeCloseTo(192, 5)
  })

  it('swapBayPreset kann zwei Erker nacheinander tauschen', () => {
    const presetA = bayPreset(192, 96)
    const presetB = bayPreset(192, 144)
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 960,
      height: 512,
      depth: WALL_DEPTH,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
    }
    const first = insertBayAsWallSegment(stateWithWall(wall), wall.id, presetA, 192)!
    const remnantRight = first.state.buildings[0]!.walls.find(
      (w) => !w.bayWindow && !w.bayParentId && !w.bayRole && (w.originX ?? w.x) > 200,
    )!
    const second = insertBayAsWallSegment(first.state, remnantRight.id, presetA, remnantRight.width / 2)!
    const hosts = second.state.buildings[0]!.walls.filter((w) => w.bayWindow)
    expect(hosts).toHaveLength(2)
    let next = second.state
    for (const host of hosts) {
      const swapped = swapBayPreset(next, host.id, presetB)!
      next = swapped.state
    }
    const metas = next.buildings[0]!.walls.filter((w) => w.bayWindow).map((w) => w.bayWindow!)
    expect(metas).toHaveLength(2)
    expect(metas.every((m) => m.depthCm === 144 && m.frontWidthCm === 192)).toBe(true)
  })
})
