import { describe, expect, it } from 'vitest'
import { applyBayDrop, insertBayAsWallSegment } from './baySegment'
import { BAY_WINDOW_PRESETS, bayWallSkirtDropCm } from './bayWindow'
import { createStudioWall } from './walls'
import { WALL_DEPTH } from '../constants/presets'
import { emptyNeighbors, type FacadeState, type Wall } from '../types/facade'
import { createId } from '../utils/id'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel } from './constants'
import { layoutPanelTiles, visiblePanelRowRange } from './panelLayout'

function bayPreset(front: number, depth: number) {
  return BAY_WINDOW_PRESETS.find((p) => p.id === `bay-f${front}-d${depth}-rect`)!
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
    selection: { kind: 'none' },
  } as FacadeState
}

describe('Erker-Drop Paneel-Schichtflucht', () => {
  it('Schichtfugen von Front und Restwand liegen auf gleicher Welthöhe (Drop nicht Vielfaches der Paneelhöhe)', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      pattern: 'runningBond' as const,
      panelHeight: 32,
      panelWidth: 64,
      joint: 0.8,
      plinthEnabled: false,
      plinthHeight: 0,
    }
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
      panel,
      neighbors: emptyNeighbors(),
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, bayPreset(192, 96), 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    // 80 % 32 = 16 → früher Phasenversatz, wenn Raster am verlängerten Fuß startet
    const dropped = applyBayDrop(inserted.state, host.id, 80)!
    const walls = dropped.buildings[0]!.walls
    const remnant = walls.find((w) => !w.bayWindow && !w.bayParentId && !w.bayRole)!
    const front = walls.find((w) => w.bayRole === 'front')!

    const remPanel = normalizeStudioPanel(remnant.panel ?? panel)
    const bayPanel = normalizeStudioPanel(front.panel ?? panel)
    const skirt = bayWallSkirtDropCm(front, walls)
    expect(skirt).toBeGreaterThan(0)

    const remCuts = visiblePanelRowRange(remnant.height, remPanel, 0).rowCuts
    const bayCuts = visiblePanelRowRange(front.height, bayPanel, skirt).rowCuts

    const remWorld = remCuts.map((y) => (remnant.y ?? 0) + y)
    const bayWorld = bayCuts.map((y) => (front.y ?? 0) + y)

    const remFloor = remnant.y ?? 0
    const remTop = remFloor + remnant.height
    for (const y of bayWorld) {
      if (y < remFloor - 0.5 || y > remTop + 0.5) continue
      const match = remWorld.some((r) => Math.abs(r - y) < 0.51)
      expect(match, `Bay-Schnitt ${y} ohne Restwand-Pendant (skirt=${skirt})`).toBe(true)
    }

    const remTiles = layoutPanelTiles(remnant, remPanel, walls)
    const bayTiles = layoutPanelTiles(front, bayPanel, walls)
    const remJoints = [...new Set(remTiles.flatMap((t) => [t.y, t.y + t.height]))]
      .sort((a, b) => a - b)
      .map((y) => remFloor + y)
    const bayJoints = [...new Set(bayTiles.flatMap((t) => [t.y, t.y + t.height]))]
      .sort((a, b) => a - b)
      .map((y) => (front.y ?? 0) + y)
      .filter((y) => y >= remFloor - 0.5 && y <= remTop + 0.5)

    for (const y of bayJoints) {
      const match = remJoints.some((r) => Math.abs(r - y) < 0.51)
      expect(match, `Bay-Fuge ${y} ohne Restwand-Pendant`).toBe(true)
    }
  })

  it('bayWallSkirtDropCm fällt auf dropCm zurück, wenn Schein-Restwand denselben Fuß hat', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      panelHeight: 32,
      plinthEnabled: false,
      plinthHeight: 0,
    }
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
      panel,
      neighbors: emptyNeighbors(),
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, bayPreset(192, 96), 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    const dropped = applyBayDrop(inserted.state, host.id, 80)!
    const walls = [...dropped.buildings[0]!.walls]
    const front = walls.find((w) => w.bayRole === 'front')!
    // Schein-Partner: gleiche Oberkante und gleicher Fuß wie der Erker → Messung 0
    walls.unshift({
      ...createStudioWall(0, 0),
      id: createId(),
      width: 64,
      height: front.height,
      depth: WALL_DEPTH,
      y: front.y,
      originX: -100,
      originZ: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
      panel,
      neighbors: emptyNeighbors(),
    })
    expect(bayWallSkirtDropCm(front, walls)).toBe(80)
  })

  it('bayWallSkirtDropCm misst Fußdifferenz auch bei dropCm 0 (Meta-Desync)', () => {
    const panel = {
      ...DEFAULT_STUDIO_PANEL,
      enabled: true,
      panelHeight: 24,
      plinthEnabled: false,
      plinthHeight: 0,
    }
    const wall: Wall = {
      ...createStudioWall(0, 0),
      id: createId(),
      width: 576,
      height: 352,
      depth: WALL_DEPTH,
      y: 448,
      originX: 0,
      originZ: 0,
      x: 0,
      yawDeg: 0,
      panelFlip: true,
      planLinked: true,
      panel,
      neighbors: emptyNeighbors(),
    }
    const inserted = insertBayAsWallSegment(stateWithWall(wall), wall.id, bayPreset(192, 96), 288)!
    const host = inserted.state.buildings[0]!.walls.find((w) => w.bayWindow)!
    // Geometrie wie Drop 32, Meta absichtlich 0 (wie in der Repro-Szene)
    const walls = inserted.state.buildings[0]!.walls.map((w) => {
      if (!w.bayWindow && !w.bayParentId && !w.bayRole) return w
      const next = {
        ...w,
        y: (w.y ?? 0) - 32,
        height: w.height + 32,
      }
      if (w.bayWindow) {
        return { ...next, bayWindow: { ...w.bayWindow, dropCm: 0 } }
      }
      return next
    })
    const front = walls.find((w) => w.bayRole === 'front')!
    const hostAfter = walls.find((w) => w.bayWindow)!
    expect(hostAfter.bayWindow?.dropCm).toBe(0)
    expect(bayWallSkirtDropCm(front, walls)).toBe(32)

    const rem = walls.find((w) => !w.bayWindow && !w.bayParentId && !w.bayRole)!
    const remCuts = visiblePanelRowRange(rem.height, normalizeStudioPanel(panel), 0).rowCuts
    const bayCuts = visiblePanelRowRange(
      front.height,
      normalizeStudioPanel(panel),
      bayWallSkirtDropCm(front, walls),
    ).rowCuts
    const remWorld = remCuts.map((y) => (rem.y ?? 0) + y)
    const bayWorld = bayCuts.map((y) => (front.y ?? 0) + y)
    for (const y of bayWorld) {
      if (y < (rem.y ?? 0) - 0.5 || y > (rem.y ?? 0) + rem.height + 0.5) continue
      expect(remWorld.some((r) => Math.abs(r - y) < 0.51)).toBe(true)
    }
  })
})
