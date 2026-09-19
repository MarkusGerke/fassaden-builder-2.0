import type { FacadeState, Wall } from '../types/facade'
import { WALL_DEPTH, WALL_HEIGHT, UPPER_STOREY_WALL_DEPTH } from '../constants/presets'
import { getActiveBuilding, updateActiveBuilding } from '../utils/buildings'
import { createOpening } from '../utils/openings'
import { duplicateStorey, removeStorey } from '../utils/walls'
import { floorIndex } from '../utils/layers'
import { createId } from '../utils/id'
import { insertBayAsWallSegment } from '../studio/baySegment'
import {
  createStudioWall,
  findVerticalAlignedWalls,
  isStudioWall,
  normalizeStudioWall,
  stretchSingleStudioWall,
} from '../studio/walls'
import { DEFAULT_STUDIO_PANEL, normalizeStudioPanel } from '../studio/constants'
import { finalizeStudioGeometry } from '../studio/planGeometry'
import { syncFloorPlansFromWalls } from '../studio/floorPlan'
import type { HauswandPlan } from './hauswandTypes'
import { resolveBayPresetFromPlan } from './generateHauswand'
import { HAUSWAND_WALL_HEIGHT_CM } from './hauswandGrid'

const EPS = 0.5

function cloneStyleWall(source: Wall): Partial<Wall> {
  return {
    yawDeg: source.yawDeg ?? 0,
    panelFlip: source.panelFlip ?? true,
    planLinked: source.planLinked ?? true,
    originX: source.originX ?? source.x,
    originZ: source.originZ ?? 0,
    panel: source.panel
      ? normalizeStudioPanel(source.panel)
      : normalizeStudioPanel(DEFAULT_STUDIO_PANEL),
    wallColor: source.wallColor,
    wallFinish: source.wallFinish,
    claddingColor: source.claddingColor,
    claddingFinish: source.claddingFinish,
  }
}

function pickHostWall(building: ReturnType<typeof getActiveBuilding>): Wall | null {
  const candidates = building.walls.filter(
    (w) =>
      isStudioWall(w) &&
      !w.bayParentId &&
      !w.bayRole &&
      (w.y ?? 0) < EPS &&
      !w.endPiece &&
      !w.endPieceParentId,
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, w) => (w.width > best.width ? w : best), candidates[0]!)
}

function stackIdsForHost(host: Wall, walls: Wall[], wallHeight: number): Set<string> {
  const stacked = findVerticalAlignedWalls(host, walls, wallHeight)
  return new Set([host.id, ...stacked.map((w) => w.id)])
}

function bayMemberIdsToRemove(walls: Wall[], stackIds: Set<string>): Set<string> {
  const remove = new Set<string>()
  for (const id of stackIds) {
    const w = walls.find((item) => item.id === id)
    if (!w?.bayWindow?.wallIds?.length) continue
    for (const bid of w.bayWindow.wallIds) remove.add(bid)
  }
  return remove
}

function rebuildFacadeStack(
  building: ReturnType<typeof getActiveBuilding>,
  host: Wall,
  storeys: number,
  widthCm: number,
): Wall[] {
  const wallHeight = building.wallHeight || WALL_HEIGHT
  const stackIds = stackIdsForHost(host, building.walls, wallHeight)
  const bayExtra = bayMemberIdsToRemove(building.walls, stackIds)
  const style = cloneStyleWall(host)
  const kept = building.walls.filter((w) => !stackIds.has(w.id) && !bayExtra.has(w.id))

  const stack: Wall[] = []
  for (let floor = 0; floor < storeys; floor += 1) {
    const y = floor * wallHeight
    const depth = floor === 0 ? building.wallDepth || WALL_DEPTH : UPPER_STOREY_WALL_DEPTH
    stack.push(
      normalizeStudioWall({
        ...createStudioWall(style.originX ?? 0, y),
        id: floor === 0 ? host.id : createId(),
        ...style,
        width: widthCm,
        height: wallHeight,
        depth,
        y,
        storeyIndex: floor,
        openings: [],
        profiles: [],
      }),
    )
  }
  return [...kept, ...stack]
}

function countBuildingStoreys(building: ReturnType<typeof getActiveBuilding>): number {
  const h = building.wallHeight || WALL_HEIGHT
  let maxFi = 0
  for (const w of building.walls) {
    if (!isStudioWall(w)) continue
    maxFi = Math.max(maxFi, floorIndex(w, h))
  }
  return Math.max(1, maxFi + 1, building.floors?.length ?? 1)
}

function adjustStoreyCount(state: FacadeState, hostId: string, target: number): FacadeState {
  let next = state
  let guard = 0
  while (countBuildingStoreys(getActiveBuilding(next)) < target && guard < 8) {
    const fi = countBuildingStoreys(getActiveBuilding(next)) - 1
    next = duplicateStorey(next, fi, { copyOpenings: false, wallIds: [hostId] })
    guard += 1
  }
  guard = 0
  while (countBuildingStoreys(getActiveBuilding(next)) > target && guard < 8) {
    const fi = countBuildingStoreys(getActiveBuilding(next)) - 1
    next = removeStorey(next, fi)
    guard += 1
  }
  return next
}

function wallInHostStack(wall: Wall, hostId: string, walls: Wall[], wallHeight: number): boolean {
  const host = walls.find((w) => w.id === hostId)
  if (!host) return false
  if (wall.id === hostId) return true
  return findVerticalAlignedWalls(host, walls, wallHeight).some((s) => s.id === wall.id)
}

function applyEgGroups(wall: Wall, plan: HauswandPlan): Wall {
  let openings = [...wall.openings]
  for (const group of plan.egGroups) {
    for (const spec of group.openings) {
      openings.push(
        createOpening(spec.type, spec.width, spec.height, wall, {
          x: spec.x,
          y: spec.y,
        }),
      )
    }
  }
  return { ...wall, openings }
}

function applyOgWindows(wall: Wall, plan: HauswandPlan): Wall {
  let openings = [...wall.openings]
  for (const spec of plan.ogWindowByAxis) {
    openings.push(
      createOpening(spec.type, spec.width, spec.height, wall, {
        x: spec.x,
        y: spec.y,
      }),
    )
  }
  return { ...wall, openings }
}

function resizeStackToWidth(walls: Wall[], hostId: string, wallHeight: number, targetWidth: number): Wall[] {
  const host = walls.find((w) => w.id === hostId)
  if (!host) return walls
  const ids = stackIdsForHost(host, walls, wallHeight)
  const delta = targetWidth - host.width
  if (Math.abs(delta) < EPS) return walls
  return walls.map((wall) => {
    if (!ids.has(wall.id) || !isStudioWall(wall)) return wall
    return stretchSingleStudioWall(wall, 'end', delta)
  })
}

function syncFloorsArray(building: ReturnType<typeof getActiveBuilding>, storeys: number) {
  const floors = [...(building.floors ?? [])]
  while (floors.length < storeys) {
    floors.push({ nodes: [], edges: [] })
  }
  while (floors.length > storeys) floors.pop()
  return floors
}

/** Wendet einen Hauswand-Plan auf das aktive Gebäude an (eine Fassaden-Stapelwand). */
export function applyHauswandGeneration(state: FacadeState, plan: HauswandPlan): FacadeState {
  const building = getActiveBuilding(state)
  let host = pickHostWall(building)
  let next = state

  if (!host) {
    const created = normalizeStudioWall({
      ...createStudioWall(0, 0),
      id: createId(),
      width: plan.widthCm,
      height: building.wallHeight || HAUSWAND_WALL_HEIGHT_CM,
      depth: building.wallDepth || WALL_DEPTH,
      panelFlip: true,
      planLinked: true,
    })
    next = updateActiveBuilding(state, (b) => ({
      ...b,
      walls: [...b.walls, created],
      floors: syncFloorsArray(b, plan.storeys),
    }))
    host = created
  }

  const hostId = host.id

  next = updateActiveBuilding(next, (b) => {
    const h = pickHostWall(b) ?? b.walls.find((w) => w.id === hostId)!
    return {
      ...b,
      walls: rebuildFacadeStack(b, h, plan.storeys, plan.widthCm),
      floors: syncFloorsArray(b, plan.storeys),
    }
  })

  next = adjustStoreyCount(next, hostId, plan.storeys)

  next = updateActiveBuilding(next, (b) => ({
    ...b,
    walls: resizeStackToWidth(b.walls, hostId, b.wallHeight, plan.widthCm),
  }))

  next = updateActiveBuilding(next, (b) => ({
    ...b,
    walls: b.walls.map((wall) => {
      if (!wallInHostStack(wall, hostId, b.walls, b.wallHeight)) return wall
      const fi = floorIndex(wall, b.wallHeight)
      const cleared = { ...wall, openings: [] }
      if (fi === 0) return applyEgGroups(cleared, plan)
      if (fi >= 1 && fi <= plan.storeys - 1) return applyOgWindows(cleared, plan)
      return cleared
    }),
  }))

  if (plan.bay) {
    const preset = resolveBayPresetFromPlan(plan.bay)
    for (let fi = 1; fi <= plan.storeys - 2; fi += 1) {
      const b = getActiveBuilding(next)
      const floorWall = b.walls.find(
        (w) => wallInHostStack(w, hostId, b.walls, b.wallHeight) && floorIndex(w, b.wallHeight) === fi,
      )
      if (!floorWall) continue
      const inserted = insertBayAsWallSegment(next, floorWall.id, preset, plan.bay.centerLocalXCm, {
        singleFloor: true,
      })
      if (inserted) next = inserted.state
    }
  }

  next = syncFloorPlansFromWalls(next)

  return finalizeStudioGeometry(next)
}
