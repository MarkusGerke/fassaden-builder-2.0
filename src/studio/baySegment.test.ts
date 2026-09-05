import { describe, expect, it } from 'vitest'
import {
  bayPresetFittedToWallWidth,
  flattenBayToFlatWall,
  insertBayAsWallSegment,
  replaceWallWithBayPreset,
  slideBaySegmentAlong,
  canSlideBaySegment,
  swapBayPreset,
} from './baySegment'
import { BAY_WINDOW_PRESETS, bayMouthWidthCm } from './bayWindow'
import { createStudioWall, wallStartPoint } from './walls'
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
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, preset, 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const flat = flattenBayToFlatWall(inserted.state, host.id)!
    const walls = flat.state.buildings[0]!.walls
    expect(walls.every((w) => !w.bayWindow && !w.bayParentId && !w.bayRole)).toBe(true)
    const total = walls.reduce((s, w) => s + w.width, 0)
    expect(total).toBeCloseTo(576, 0)
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
})
