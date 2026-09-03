import { DEFAULT_WINDOW_DEPTH_OFFSET, FLUSH_TOLERANCE, JOIN_OVERLAP, WALL_DEPTH } from '../constants/presets'
import {
  DEFAULT_CLADDING_COLOR_V2,
  DEFAULT_INTERIOR_COLOR,
  DEFAULT_PROFILE_COLOR,
  DEFAULT_WALL_COLOR,
} from '../constants/colorPalettes'
import { DEFAULT_STUDIO_PANEL, DUPLICATE_GAP_CM } from '../studio/constants'
import { getWallModule, wallFromModule } from '../blender/wallModules'
import type { Building, FacadeState, SurfaceFinish, Wall, WallSide } from '../types/facade'
import { cloneBuilding, cloneFacadeState, cloneWall, emptyNeighbors } from '../types/facade'
import { clampOpeningToWall, clampWallDimensions } from './validation'
import { ensureWindowSills } from './openings'
import { createId } from './id'
import {
  collinearChainFromEnd,
  findCollinearDockWall,
  isStudioWall,
  normalizeStudioWall,
  viewerSideToAlongSign,
  wallAlongDelta,
  wallStartPoint,
  type ViewerHorizontal,
} from '../studio/walls'
import { snapYawTo45 } from '../studio/compass'
import { createEmptyFloorPlan, type FloorPlan } from '../studio/floorPlan'
import { normalizeRoof } from '../studio/roof'
import { syncStairsToDoorWidth } from '../studio/stairs'
import { floorIndex } from './layers'
import {
  findBuildingForWall,
  findWall,
  getActiveBuilding,
  migrateToBuildings,
  syncWallBuildingIds,
  updateActiveBuilding,
  updateBuilding,
} from './buildings'
import { hydrateFacadeState } from './hydrate'

const TOUCH_EPS = 0.5
const OVERLAP_EPS = JOIN_OVERLAP + 0.05

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

export function getWallBounds(walls: Wall[]): Bounds {
  if (walls.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  const minX = Math.min(...walls.map((wall) => wall.x))
  const minY = Math.min(...walls.map((wall) => wall.y))
  const maxX = Math.max(...walls.map((wall) => wall.x + wall.width))
  const maxY = Math.max(...walls.map((wall) => wall.y + wall.height))

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function getWall(state: FacadeState, id: string | null | undefined): Wall | undefined {
  return findWall(state, id)
}

export function connectedWallsOnFloor(state: FacadeState, wallId: string): string[] {
  const start = getWall(state, wallId)
  if (!start) return [wallId]

  const building = findBuildingForWall(state, wallId)
  if (!building) return [wallId]

  const floor = floorIndex(start, building.wallHeight)
  const floorIds = new Set(
    building.walls
      .filter((wall) => floorIndex(wall, building.wallHeight) === floor)
      .map((wall) => wall.id),
  )

  const visited = new Set<string>()
  const queue = [wallId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const wall = building.walls.find((w) => w.id === id)
    if (!wall) continue
    for (const neighborId of Object.values(wall.neighbors)) {
      if (neighborId && floorIds.has(neighborId) && !visited.has(neighborId)) {
        queue.push(neighborId)
      }
    }
  }

  return [...visited]
}

export function originWall(state: FacadeState): Wall | undefined {
  const building = getActiveBuilding(state)
  if (building.walls.length === 0) return undefined
  return [...building.walls].sort((a, b) => a.x - b.x || a.y - b.y)[0]
}

export function aabbOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function proposedAdjacentRect(wall: Wall, side: WallSide) {
  switch (side) {
    case 'left':
      return { x: wall.x - wall.width, y: wall.y, width: wall.width, height: wall.height }
    case 'right':
      return { x: wall.x + wall.width, y: wall.y, width: wall.width, height: wall.height }
    case 'top':
      return { x: wall.x, y: wall.y + wall.height, width: wall.width, height: wall.height }
    case 'bottom':
      return { x: wall.x, y: wall.y - wall.height, width: wall.width, height: wall.height }
  }
}

export function recomputeBuildingLayout(building: Building): Building {
  const height = building.wallHeight
  const depth = building.wallDepth
  const walls = building.walls.map((wall) => {
    if (isStudioWall(wall)) {
      return normalizeStudioWall({ ...cloneWall(wall), depth })
    }
    const dims = clampWallDimensions({
      width: wall.width,
      height,
      depth,
    })
    const cloned = cloneWall(wall)
    return {
      ...cloned,
      ...dims,
      openings: cloned.openings.map((opening) => clampOpeningToWall(opening, dims)),
    }
  })

  const placed = walls.map(cloneWall)
  const placedById = new Map(placed.map((wall) => [wall.id, wall]))

  const floorGroups = new Map<number, Wall[]>()
  for (const wall of placed) {
    const floor = floorIndex(wall, height)
    const list = floorGroups.get(floor) ?? []
    list.push(wall)
    floorGroups.set(floor, list)
  }

  for (const floorWalls of floorGroups.values()) {
    const floorIds = new Set(floorWalls.map((wall) => wall.id))
    const root = [...floorWalls].sort((a, b) => a.x - b.x || a.y - b.y)[0]
    if (!root) continue

    const visited = new Set<string>([root.id])
    const queue = [placedById.get(root.id)!]

    while (queue.length > 0) {
      const wall = queue.shift()!
      const links: Array<[WallSide, string | undefined]> = [
        ['left', wall.neighbors.left],
        ['right', wall.neighbors.right],
        ['top', wall.neighbors.top],
        ['bottom', wall.neighbors.bottom],
      ]

      for (const [side, neighborId] of links) {
        if (!neighborId || !floorIds.has(neighborId)) continue
        const neighbor = placedById.get(neighborId)
        if (!neighbor || visited.has(neighbor.id)) continue
        visited.add(neighbor.id)
        switch (side) {
          case 'right':
            neighbor.x = wall.x + wall.width
            break
          case 'left':
            neighbor.x = wall.x - neighbor.width
            break
          case 'top':
            neighbor.y = wall.y + wall.height
            break
          case 'bottom':
            neighbor.y = wall.y - neighbor.height
            break
        }
        queue.push(neighbor)
      }
    }
  }

  return syncWallBuildingIds({ ...building, walls: placed, wallHeight: height, wallDepth: depth })
}

export function recomputeLayout(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map(recomputeBuildingLayout),
  }
}

export function canAddAdjacentWall(
  state: FacadeState,
  selectedId: string,
  _side: WallSide,
): boolean {
  return Boolean(getWall(state, selectedId))
}

function slotIsOccupied(
  walls: Wall[],
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  for (const wall of walls) {
    const ox = rangeOverlap(rect.x, rect.x + rect.width, wall.x, wall.x + wall.width)
    const oy = rangeOverlap(rect.y, rect.y + rect.height, wall.y, wall.y + wall.height)
    if (ox > OVERLAP_EPS && oy > OVERLAP_EPS) return true
  }
  return false
}

function collectShiftIds(
  walls: Wall[],
  selected: Wall,
  side: WallSide,
  wallHeight: number,
): Set<string> {
  const selectedFloor = floorIndex(selected, wallHeight)
  const ids = new Set<string>()
  for (const wall of walls) {
    if (wall.id === selected.id) continue
    if (floorIndex(wall, wallHeight) !== selectedFloor) continue
    const behind =
      side === 'right'
        ? wall.x + TOUCH_EPS >= selected.x + selected.width && yOverlap(wall, selected) > TOUCH_EPS
        : side === 'left'
          ? wall.x + wall.width <= selected.x + TOUCH_EPS && yOverlap(wall, selected) > TOUCH_EPS
          : side === 'top'
            ? wall.y + TOUCH_EPS >= selected.y + selected.height && xOverlap(wall, selected) > TOUCH_EPS
            : wall.y + wall.height <= selected.y + TOUCH_EPS && xOverlap(wall, selected) > TOUCH_EPS
    if (behind) ids.add(wall.id)
  }

  let changed = true
  while (changed) {
    changed = false
    for (const wall of walls) {
      if (ids.has(wall.id) || wall.id === selected.id) continue
      for (const other of walls) {
        if (!ids.has(other.id)) continue
        const stacked =
          side === 'left' || side === 'right'
            ? edgesFlush(other, wall, 'top') || edgesFlush(other, wall, 'bottom')
            : edgesFlush(other, wall, 'left') || edgesFlush(other, wall, 'right')
        if (!stacked) continue
        ids.add(wall.id)
        changed = true
      }
    }
  }

  return ids
}

export function addAdjacentWall(
  state: FacadeState,
  selectedId: string,
  side: WallSide,
): FacadeState {
  const building = findBuildingForWall(state, selectedId)
  if (!building) return cloneFacadeState(state)

  const selected = building.walls.find((wall) => wall.id === selectedId)
  if (!selected) return cloneFacadeState(state)

  const rect = proposedAdjacentRect(selected, side)
  const module = selected.moduleName ? getWallModule(selected.moduleName) : undefined
  const next: Wall = module
    ? { ...wallFromModule(module, rect.x), y: rect.y, buildingId: building.id }
    : {
        id: createId(),
        x: rect.x,
        y: rect.y,
        width: selected.width,
        height: building.wallHeight,
        depth: building.wallDepth,
        openings: [],
        profiles: [],
        neighbors: emptyNeighbors(),
        buildingId: building.id,
      }

  const occupied = slotIsOccupied(building.walls, rect)
  const shiftIds = occupied
    ? collectShiftIds(building.walls, selected, side, building.wallHeight)
    : new Set<string>()
  const dx = side === 'right' ? selected.width : side === 'left' ? -selected.width : 0
  const dy = side === 'top' ? selected.height : side === 'bottom' ? -selected.height : 0

  const walls = building.walls.map((wall) => {
    const cloned = cloneWall(wall)
    if (shiftIds.has(wall.id)) {
      cloned.x += dx
      cloned.y += dy
    }
    return cloned
  })
  walls.push(next)

  return updateBuilding(state, building.id, (b) =>
    rebuildBuildingNeighbors({ ...b, walls }),
  )
}

export function removeWall(state: FacadeState, id: string): FacadeState {
  const building = findBuildingForWall(state, id)
  if (!building || !building.walls.some((wall) => wall.id === id)) {
    return cloneFacadeState(state)
  }

  const walls = building.walls
    .filter((wall) => wall.id !== id)
    .map((wall) => {
      const cloned = cloneWall(wall)
      for (const side of ['left', 'right', 'top', 'bottom'] as WallSide[]) {
        if (cloned.neighbors[side] === id) {
          delete cloned.neighbors[side]
        }
      }
      return cloned
    })

  return updateBuilding(state, building.id, (b) => recomputeBuildingLayout({ ...b, walls }))
}

export function duplicateWalls(
  state: FacadeState,
  ids: string[],
  preferredSide: 'left' | 'right' = 'right',
  opts?: { planLinked?: boolean; viewerRight?: ViewerHorizontal },
): FacadeState {
  if (ids.length === 0) return cloneFacadeState(state)

  const building = findBuildingForWall(state, ids[0])
  if (!building) return cloneFacadeState(state)

  const idSet = new Set(ids)
  const selected = building.walls.filter((wall) => idSet.has(wall.id))
  if (selected.length === 0) return cloneFacadeState(state)

  const bounds = getWallBounds(selected)
  const vr = opts?.viewerRight ?? { x: -1, z: 0 }
  const sign = viewerSideToAlongSign(selected[0]!, preferredSide, vr.x, vr.z)
  const refWall = selected[0]!
  const insertWidthCm = selected.length === 1 ? refWall.width : bounds.width
  const layoutDx = sign * (bounds.width + DUPLICATE_GAP_CM)
  const clones: Wall[] = []

  for (const wall of selected) {
    const openingIdMap = new Map<string, string>()
    const openings = wall.openings.map((opening) => {
      const nextId = createId()
      openingIdMap.set(opening.id, nextId)
      return { ...opening, id: nextId }
    })

    const cloned: Wall = {
      ...cloneWall(wall),
      id: createId(),
      x: wall.x + layoutDx,
      y: wall.y,
      neighbors: emptyNeighbors(),
      groupId: undefined,
      openings,
      profiles: wall.profiles.map((profile) => ({
        ...profile,
        openingId: openingIdMap.get(profile.openingId) ?? profile.openingId,
      })),
      buildingId: building.id,
    }

    if (isStudioWall(wall)) {
      const along = wallAlongDelta(wall.yawDeg ?? 0, sign * (wall.width + DUPLICATE_GAP_CM))
      cloned.originX = (wall.originX ?? wall.x) + along.x
      cloned.originZ = (wall.originZ ?? 0) + along.z
      // Studio-Layout-X folgt der wandlokalen Verschiebung, nicht dem Modul-Bounds-Offset.
      cloned.x = wall.x + sign * (wall.width + DUPLICATE_GAP_CM)
      cloned.planLinked = opts?.planLinked === true
    }

    clones.push(cloned)
  }

  const insertEnd: 'start' | 'end' = sign > 0 ? 'end' : 'start'
  const shouldInsertInChain =
    opts?.planLinked === true && selected.length === 1 && isStudioWall(refWall)

  return updateBuilding(state, building.id, (b) => {
    let walls = b.walls
    if (shouldInsertInChain) {
      walls = shiftCollinearNeighborsForInsert(
        walls,
        refWall,
        insertEnd,
        insertWidthCm + DUPLICATE_GAP_CM,
        idSet,
      )
    }
    return rebuildBuildingNeighbors({ ...b, walls: [...walls, ...clones] })
  })
}

/** Neue Wände aus der Zwischenablage (neue IDs, planLinked aus). */
export function cloneWallsForInsert(sources: Wall[], buildingId: string): Wall[] {
  return sources.map((source) => {
    const openingIdMap = new Map<string, string>()
    const openings = source.openings.map((opening) => {
      const nextId = createId()
      openingIdMap.set(opening.id, nextId)
      return { ...opening, id: nextId }
    })
    const cloned: Wall = {
      ...cloneWall(source),
      id: createId(),
      buildingId,
      groupId: undefined,
      neighbors: emptyNeighbors(),
      openings,
      profiles: source.profiles.map((profile) => ({
        ...profile,
        openingId: openingIdMap.get(profile.openingId) ?? profile.openingId,
      })),
      planLinked: false,
    }
    return cloned
  })
}

function shiftWallByLayoutDelta(wall: Wall, deltaX: number, deltaY: number): Wall {
  const next = { ...wall, x: wall.x + deltaX, y: wall.y + deltaY }
  if (!isStudioWall(wall)) return next
  const along = wallAlongDelta(wall.yawDeg ?? 0, deltaX)
  next.originX = (wall.originX ?? wall.x) + along.x
  next.originZ = (wall.originZ ?? 0) + along.z
  next.x = next.originX ?? next.x
  return next
}

/** Verschiebt kollineare Nachbarn auf der Seite `end`, wenn eine Kopie dazwischen eingefügt wird. */
function shiftCollinearNeighborsForInsert(
  walls: Wall[],
  anchor: Wall,
  end: 'start' | 'end',
  insertWidthCm: number,
  excludeIds: Set<string>,
): Wall[] {
  const neighbor = findCollinearDockWall(anchor, end, walls)
  if (!neighbor) return walls
  const shiftIds = new Set(collinearChainFromEnd(anchor, end, walls, excludeIds))
  if (shiftIds.size === 0) return walls
  const deltaX = (end === 'end' ? 1 : -1) * insertWidthCm
  return walls.map((wall) =>
    shiftIds.has(wall.id) ? shiftWallByLayoutDelta(wall, deltaX, 0) : wall,
  )
}

function shiftAndAlignStudioWall(
  wall: Wall,
  deltaX: number,
  deltaY: number,
  targetYaw: number,
): Wall {
  const shifted = shiftWallByLayoutDelta(wall, deltaX, deltaY)
  if (!isStudioWall(shifted)) return shifted
  const start = wallStartPoint(shifted)
  return normalizeStudioWall({
    ...shifted,
    yawDeg: targetYaw,
    originX: start.x,
    originZ: start.z,
    x: start.x,
  })
}

/**
 * Fügt kopierte Wände relativ zu einer Zielwand ein (links/rechts/oben).
 * Behält relative Anordnung der Zwischenablage bei.
 */
export function pasteWallsRelativeToTarget(
  state: FacadeState,
  sources: Wall[],
  targetWallId: string,
  side: 'left' | 'right' | 'above',
  viewerRight?: ViewerHorizontal,
): FacadeState {
  const building = findBuildingForWall(state, targetWallId)
  if (!building) return cloneFacadeState(state)
  const target = building.walls.find((wall) => wall.id === targetWallId)
  if (!target || sources.length === 0) return cloneFacadeState(state)

  let clones = cloneWallsForInsert(sources, building.id)
  const bounds = getWallBounds(clones)
  const targetYaw = isStudioWall(target) ? (target.yawDeg ?? 0) : undefined

  let deltaX: number
  let deltaY: number
  if (side === 'above') {
    deltaX = target.x - bounds.minX
    deltaY = target.y + target.height - bounds.minY
  } else {
    const vr = viewerRight ?? { x: -1, z: 0 }
    const sign = viewerSideToAlongSign(target, side, vr.x, vr.z)
    if (sign > 0) {
      deltaX = target.x + target.width - bounds.minX
    } else {
      deltaX = target.x - bounds.width - bounds.minX
    }
    deltaY = target.y - bounds.minY
  }

  clones = clones.map((wall) => {
    if (targetYaw !== undefined && isStudioWall(wall)) {
      return shiftAndAlignStudioWall(wall, deltaX, deltaY, targetYaw)
    }
    return shiftWallByLayoutDelta(wall, deltaX, deltaY)
  })

  if (side === 'left' || side === 'right') {
    const vr = viewerRight ?? { x: -1, z: 0 }
    const sign = viewerSideToAlongSign(target, side, vr.x, vr.z)
    const insertEnd: 'start' | 'end' = sign > 0 ? 'end' : 'start'
    const insertWidthCm = bounds.width

    return updateBuilding(state, building.id, (b) => {
      let walls = shiftCollinearNeighborsForInsert(
        b.walls,
        target,
        insertEnd,
        insertWidthCm,
        new Set([targetWallId]),
      )
      return rebuildBuildingNeighbors({ ...b, walls: [...walls, ...clones] })
    })
  }

  if (side === 'above') {
    const height = building.wallHeight
    const targetFloor = floorIndex(target, height)
    const maxCloneTop = Math.max(...clones.map((wall) => wall.y + wall.height * 2))
    const higherWalls = building.walls.filter((wall) => floorIndex(wall, height) > targetFloor)
    const minHigherY =
      higherWalls.length > 0
        ? Math.min(...higherWalls.map((wall) => wall.y))
        : (targetFloor + 1) * height
    const lift = Math.max(0, maxCloneTop - minHigherY)

    const shiftedWalls = building.walls.map((wall) => {
      const cloned = cloneWall(wall)
      if (lift > 0 && floorIndex(wall, height) > targetFloor) {
        cloned.y = wall.y + lift
      }
      return cloned
    })

    const floors = (building.floors ?? [{ nodes: [], edges: [] }]).map(cloneFloorPlan)
    while (floors.length <= targetFloor) floors.push(createEmptyFloorPlan())
    if (floors.length <= targetFloor + 1) {
      floors.splice(targetFloor + 1, 0, cloneFloorPlan(floors[targetFloor] ?? createEmptyFloorPlan()))
    }

    return updateBuilding(state, building.id, (b) =>
      rebuildBuildingNeighbors({
        ...b,
        walls: [...shiftedWalls, ...clones],
        floors,
      }),
    )
  }

  return cloneFacadeState(state)
}

export function updateWallWidths(
  state: FacadeState,
  ids: string[],
  width: number,
): FacadeState {
  const idSet = new Set(ids)
  let next = state
  for (const building of state.buildings) {
    if (!building.walls.some((wall) => idSet.has(wall.id))) continue
    const walls = building.walls.map((wall) => {
      const cloned = cloneWall(wall)
      if (!idSet.has(wall.id)) return cloned
      const dims = clampWallDimensions({
        width,
        height: building.wallHeight,
        depth: building.wallDepth,
      })
      cloned.width = dims.width
      cloned.height = dims.height
      cloned.depth = dims.depth
      cloned.openings = cloned.openings.map((opening) => clampOpeningToWall(opening, cloned))
      return cloned
    })
    next = updateBuilding(next, building.id, (b) => recomputeBuildingLayout({ ...b, walls }))
  }
  return next
}

export function updateWallCladding(
  state: FacadeState,
  ids: string[],
  claddingId: string,
): FacadeState {
  const idSet = new Set(ids)
  let next = state
  for (const building of state.buildings) {
    if (!building.walls.some((wall) => idSet.has(wall.id))) continue
    next = updateBuilding(next, building.id, (b) => ({
      ...b,
      walls: b.walls.map((wall) => {
        const cloned = cloneWall(wall)
        if (idSet.has(wall.id)) cloned.claddingId = claddingId
        return cloned
      }),
    }))
  }
  return next
}

export function updateWallColors(
  state: FacadeState,
  ids: string[],
  color: string,
  field: 'wallColor' | 'claddingColor' | 'profileColor' | 'interiorColor',
): FacadeState {
  const idSet = new Set(ids)
  let next = state
  for (const building of state.buildings) {
    if (!building.walls.some((wall) => idSet.has(wall.id))) continue
    next = updateBuilding(next, building.id, (b) => ({
      ...b,
      walls: b.walls.map((wall) => {
        if (!idSet.has(wall.id)) return cloneWall(wall)
        return { ...cloneWall(wall), [field]: color }
      }),
    }))
  }
  return next
}

export function updateCeilingColorForWalls(
  state: FacadeState,
  ids: string[],
  color: string,
): FacadeState {
  const idSet = new Set(ids)
  let next = state
  for (const building of state.buildings) {
    const targets = building.walls.filter((wall) => idSet.has(wall.id))
    if (targets.length === 0) continue
    const floorIdxs = new Set(targets.map((wall) => floorIndex(wall, building.wallHeight)))
    const floors = [...(building.floors ?? [])]
    let maxIdx = floors.length - 1
    for (const idx of floorIdxs) maxIdx = Math.max(maxIdx, idx)
    while (floors.length <= maxIdx) floors.push(createEmptyFloorPlan())
    for (const idx of floorIdxs) {
      floors[idx] = { ...floors[idx], ceilingColor: color }
    }
    next = updateBuilding(next, building.id, { floors })
  }
  return next
}

export function updateWallFinishes(
  state: FacadeState,
  ids: string[],
  finish: SurfaceFinish,
  field: 'wallFinish' | 'claddingFinish' | 'profileFinish',
): FacadeState {
  const idSet = new Set(ids)
  let next = state
  for (const building of state.buildings) {
    if (!building.walls.some((wall) => idSet.has(wall.id))) continue
    next = updateBuilding(next, building.id, (b) => ({
      ...b,
      walls: b.walls.map((wall) => {
        if (!idSet.has(wall.id)) return cloneWall(wall)
        return { ...cloneWall(wall), [field]: finish }
      }),
    }))
  }
  return next
}

export function updateWallSurfaceColors(
  state: FacadeState,
  ids: string[],
  color: string,
): FacadeState {
  const idSet = new Set(ids)
  let next = state
  for (const building of state.buildings) {
    if (!building.walls.some((wall) => idSet.has(wall.id))) continue
    next = updateBuilding(next, building.id, (b) => ({
      ...b,
      walls: b.walls.map((wall) => {
        if (!idSet.has(wall.id)) return cloneWall(wall)
        return { ...cloneWall(wall), wallColor: color, claddingColor: color }
      }),
    }))
  }
  return next
}

export function updateGlobalHeight(state: FacadeState, height: number): FacadeState {
  const active = getActiveBuilding(state)
  const dims = clampWallDimensions({
    width: 384,
    height,
    depth: active.wallDepth,
  })
  return recomputeLayout(updateActiveBuilding(state, { wallHeight: dims.height }))
}

export function updateGlobalDepth(state: FacadeState, depth: number): FacadeState {
  const active = getActiveBuilding(state)
  const dims = clampWallDimensions({
    width: 384,
    height: active.wallHeight,
    depth,
  })
  // Nur Gebäude-Tiefe setzen. Wände bleiben auf der alten Geometrie, damit
  // `fitBuildingWallsToOuterSpine` die Außenkanten noch aus `wall.depth` ableiten kann.
  return updateActiveBuilding(state, { wallDepth: dims.depth })
}

export function normalizeWindowDepthOffset(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_WINDOW_DEPTH_OFFSET
  // Alter Default −24 meinte „in der Laibung“; die 24 cm sind jetzt der Basisversatz.
  if (value === -24) return 0
  return value
}

export function rebuildBuildingNeighbors(building: Building): Building {
  const walls = building.walls.map((wall) => {
    const cloned = cloneWall(wall)
    cloned.neighbors = emptyNeighbors()
    const left = pickNeighbor(cloned, 'left', building.walls, building.wallHeight)
    const right = pickNeighbor(cloned, 'right', building.walls, building.wallHeight)
    const top = pickNeighbor(cloned, 'top', building.walls, building.wallHeight)
    const bottom = pickNeighbor(cloned, 'bottom', building.walls, building.wallHeight)
    if (left) cloned.neighbors.left = left
    if (right) cloned.neighbors.right = right
    if (top) cloned.neighbors.top = top
    if (bottom) cloned.neighbors.bottom = bottom
    return cloned
  })

  return syncWallBuildingIds({ ...building, walls })
}

export function clampBuilding(building: Building): Building {
  const dims = clampWallDimensions({
    width: 384,
    height: building.wallHeight,
    depth: building.wallDepth ?? WALL_DEPTH,
  })
  const walls = building.walls.map((wall) => {
    if (isStudioWall(wall)) {
      return normalizeStudioWall({ ...cloneWall(wall), depth: dims.depth })
    }
    const wallDims = clampWallDimensions({
      width: wall.width,
      height: dims.height,
      depth: dims.depth,
    })
    const cloned = cloneWall(wall)
    return {
      ...cloned,
      ...wallDims,
      openings: cloned.openings.map((opening) => {
        const clamped = ensureWindowSills(clampOpeningToWall(opening, wallDims))
        return clamped.type === 'door' && clamped.stairs?.enabled
          ? { ...clamped, stairs: syncStairsToDoorWidth(clamped.stairs, clamped) }
          : clamped
      }),
    }
  })

  return rebuildBuildingNeighbors(
    syncWallBuildingIds({
      ...cloneBuilding(building),
      walls,
      wallHeight: dims.height,
      wallDepth: dims.depth,
      windowDepthOffset: normalizeWindowDepthOffset(building.windowDepthOffset),
      roof: building.roof ? normalizeRoof(building.roof) : building.roof,
    }),
  )
}

export function clampFacadeState(state: FacadeState): FacadeState {
  const migrated = migrateToBuildings(state)
  const hydrated = hydrateFacadeState(migrated)
  return {
    ...hydrated,
    buildings: hydrated.buildings.map(clampBuilding),
    siteYawDeg: snapYawTo45(hydrated.siteYawDeg ?? 0),
  }
}

export function rangeOverlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0)
}

export function yOverlap(a: Wall, b: Wall): number {
  return rangeOverlap(a.y, a.y + a.height, b.y, b.y + b.height)
}

export function xOverlap(a: Wall, b: Wall): number {
  return rangeOverlap(a.x, a.x + a.width, b.x, b.x + b.width)
}

export function edgesFlush(a: Wall, b: Wall, sideOfA: WallSide): boolean {
  switch (sideOfA) {
    case 'right':
      return Math.abs(a.x + a.width - b.x) <= TOUCH_EPS && yOverlap(a, b) > TOUCH_EPS
    case 'left':
      return Math.abs(a.x - (b.x + b.width)) <= TOUCH_EPS && yOverlap(a, b) > TOUCH_EPS
    case 'top':
      return Math.abs(a.y + a.height - b.y) <= TOUCH_EPS && xOverlap(a, b) > TOUCH_EPS
    case 'bottom':
      return Math.abs(a.y - (b.y + b.height)) <= TOUCH_EPS && xOverlap(a, b) > TOUCH_EPS
  }
}

export function edgeIsJoined(wall: Wall, side: WallSide, walls: Wall[]): boolean {
  return walls.some((other) => other.id !== wall.id && edgesFlush(wall, other, side))
}

export function hasInteriorOverlap(walls: Wall[]): boolean {
  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const ox = xOverlap(walls[i], walls[j])
      const oy = yOverlap(walls[i], walls[j])
      if (ox > OVERLAP_EPS && oy > OVERLAP_EPS) return true
    }
  }
  return false
}

function pickNeighbor(
  wall: Wall,
  side: WallSide,
  walls: Wall[],
  wallHeight: number,
): string | undefined {
  const wallFloor = floorIndex(wall, wallHeight)
  let bestId: string | undefined
  let bestOverlap = TOUCH_EPS
  for (const other of walls) {
    if (other.id === wall.id || floorIndex(other, wallHeight) !== wallFloor) continue
    if (!edgesFlush(wall, other, side)) continue
    const overlap = side === 'left' || side === 'right' ? yOverlap(wall, other) : xOverlap(wall, other)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      bestId = other.id
    }
  }
  return bestId
}

/** Was eine neu eingefügte Etage von der Quellwand übernimmt. Standard: alles. */
export interface StoreyCopyOptions {
  panel: boolean
  openings: boolean
  wallColor: boolean
  claddingColor: boolean
  profileColor: boolean
  cornice: boolean
  plinth: boolean
}

export const DEFAULT_STOREY_COPY: StoreyCopyOptions = {
  panel: true,
  openings: true,
  wallColor: true,
  claddingColor: true,
  profileColor: true,
  cornice: true,
  plinth: true,
}

/** Nur Wände/Grundriss, ohne Optik und Öffnungen. */
export const STOREY_COPY_PLAN_ONLY: StoreyCopyOptions = {
  panel: false,
  openings: false,
  wallColor: false,
  claddingColor: false,
  profileColor: false,
  cornice: false,
  plinth: false,
}

function resolveStoreyCopy(options: {
  copyOpenings: boolean
  copy?: Partial<StoreyCopyOptions>
}): StoreyCopyOptions {
  return {
    panel: options.copy?.panel ?? true,
    openings: options.copy?.openings ?? options.copyOpenings,
    wallColor: options.copy?.wallColor ?? true,
    claddingColor: options.copy?.claddingColor ?? true,
    profileColor: options.copy?.profileColor ?? true,
    cornice: options.copy?.cornice ?? true,
    plinth: options.copy?.plinth ?? true,
  }
}

function applyStoreyCopyStyle(cloned: Wall, copy: StoreyCopyOptions): Wall {
  let next = cloned
  if (!copy.panel) {
    next = {
      ...next,
      claddingZones: undefined,
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        enabled: false,
        pattern: 'none',
        plinthEnabled: copy.plinth ? (cloned.panel?.plinthEnabled ?? false) : false,
        plinthHeight: copy.plinth
          ? (cloned.panel?.plinthHeight ?? DEFAULT_STUDIO_PANEL.plinthHeight)
          : 0,
        plinthDepth: cloned.panel?.plinthDepth ?? DEFAULT_STUDIO_PANEL.plinthDepth,
        plinthOffsetForward: cloned.panel?.plinthOffsetForward ?? DEFAULT_STUDIO_PANEL.plinthOffsetForward,
        plinthProfileId: cloned.panel?.plinthProfileId ?? DEFAULT_STUDIO_PANEL.plinthProfileId,
      },
    }
  } else if (!copy.plinth && next.panel) {
    next = { ...next, panel: { ...next.panel, plinthEnabled: false, plinthHeight: 0 } }
  }
  if (!copy.wallColor) next = { ...next, wallColor: DEFAULT_WALL_COLOR, interiorColor: DEFAULT_INTERIOR_COLOR }
  if (!copy.claddingColor) next = { ...next, claddingColor: DEFAULT_CLADDING_COLOR_V2 }
  if (!copy.profileColor) next = { ...next, profileColor: DEFAULT_PROFILE_COLOR }
  if (!copy.cornice) {
    next = {
      ...next,
      cornice: next.cornice ? { ...next.cornice, enabled: false } : next.cornice,
    }
  }
  return next
}

function cloneWallForStorey(
  wall: Wall,
  targetY: number,
  copyOpenings: boolean,
  options: { stripStairs?: boolean; keepPlanLinked?: boolean } = {},
): Wall {
  const openingIdMap = new Map<string, string>()
  const openings = copyOpenings
    ? wall.openings.map((opening) => {
        const nextId = createId()
        openingIdMap.set(opening.id, nextId)
        let next = { ...opening, id: nextId }
        if (options.stripStairs && opening.type === 'door' && next.stairs?.enabled) {
          next = {
            ...next,
            stairs: syncStairsToDoorWidth({ ...next.stairs, enabled: false }, next),
          }
        }
        return next
      })
    : []

  const cloned: Wall = {
    ...cloneWall(wall),
    id: createId(),
    y: targetY,
    neighbors: emptyNeighbors(),
    groupId: undefined,
    openings,
    profiles: copyOpenings
      ? wall.profiles.map((profile) => ({
          ...profile,
          openingId: openingIdMap.get(profile.openingId) ?? profile.openingId,
        }))
      : [],
    buildingId: wall.buildingId,
  }

  if (isStudioWall(wall)) {
    // Einzelwand darüber: lösen. Mehrere Klone (Etage/Auswahl): untereinander verknüpft lassen.
    cloned.planLinked = options.keepPlanLinked === true && wall.planLinked !== false
    return normalizeStudioWall(cloned)
  }
  return cloned
}

function cloneFloorPlan(plan: FloorPlan): FloorPlan {
  return {
    nodes: plan.nodes.map((node) => ({ ...node })),
    edges: plan.edges.map((edge) => ({ ...edge })),
    showCeiling: plan.showCeiling,
    hidden: plan.hidden,
  }
}

/**
 * Neues Geschoss direkt über sourceFloorIndex einfügen.
 * Jeder Klon sitzt Fläche-auf-Fläche: y = source.y + source.height.
 * Höhere Etagen werden so weit angehoben, dass sie über den Klon-Oberkanten liegen.
 */
export function insertStoreyAbove(
  state: FacadeState,
  sourceFloorIndex: number,
  options: { wallIds?: string[]; copyOpenings: boolean; copy?: Partial<StoreyCopyOptions> },
): FacadeState {
  const building = getActiveBuilding(state)
  const height = building.wallHeight
  const { wallIds } = options
  const copy = resolveStoreyCopy(options)
  const copyOpenings = copy.openings

  const sourceWalls = wallIds
    ? building.walls.filter((w) => wallIds.includes(w.id))
    : building.walls.filter((w) => floorIndex(w, height) === sourceFloorIndex)

  if (sourceWalls.length === 0) return cloneFacadeState(state)

  const targetIndex = sourceFloorIndex + 1
  // Fläche auf Fläche: Oberkante Quelle = Unterkante Klon (pro Wand).
  const maxCloneTop = Math.max(...sourceWalls.map((w) => w.y + w.height * 2))
  const higherWalls = building.walls.filter((w) => floorIndex(w, height) > sourceFloorIndex)
  const minHigherY =
    higherWalls.length > 0
      ? Math.min(...higherWalls.map((w) => w.y))
      : targetIndex * height
  const lift = Math.max(0, maxCloneTop - minHigherY)

  const shiftedWalls = building.walls.map((wall) => {
    if (floorIndex(wall, height) > sourceFloorIndex) {
      return { ...cloneWall(wall), y: wall.y + lift }
    }
    return cloneWall(wall)
  })

  const keepPlanLinked = sourceWalls.length > 1
  const clones = sourceWalls.map((wall) =>
    applyStoreyCopyStyle(
      cloneWallForStorey(wall, wall.y + wall.height, copyOpenings, {
        stripStairs: true,
        keepPlanLinked,
      }),
      copy,
    ),
  )

  const floors = (building.floors ?? [{ nodes: [], edges: [] }]).map(cloneFloorPlan)
  while (floors.length <= sourceFloorIndex) floors.push(createEmptyFloorPlan())
  const sourcePlan = floors[sourceFloorIndex] ?? createEmptyFloorPlan()
  floors.splice(targetIndex, 0, cloneFloorPlan(sourcePlan))

  return updateBuilding(state, building.id, (b) =>
    rebuildBuildingNeighbors({
      ...b,
      walls: [...shiftedWalls, ...clones],
      floors,
    }),
  )
}

export function finalizeWallLayout(state: FacadeState): FacadeState {
  return recomputeLayout(rebuildNeighbors(state))
}

export function rebuildNeighbors(state: FacadeState): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map(rebuildBuildingNeighbors),
  }
}

export function flushAdjacentWalls(walls: Wall[]): Wall[] {
  const next = walls.map(cloneWall)
  const byId = () => next

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false
    for (const a of byId()) {
      for (const b of byId()) {
        if (a.id === b.id) continue

        if (yOverlap(a, b) > TOUCH_EPS) {
          const gapRight = b.x - (a.x + a.width)
          if (gapRight > -OVERLAP_EPS && gapRight < FLUSH_TOLERANCE && Math.abs(gapRight) > 1e-6) {
            const previous = b.x
            b.x = a.x + a.width
            if (hasInteriorOverlap(next)) {
              b.x = previous
            } else {
              changed = true
            }
          }
        }

        if (xOverlap(a, b) > TOUCH_EPS) {
          const gapTop = b.y - (a.y + a.height)
          if (gapTop > -OVERLAP_EPS && gapTop < FLUSH_TOLERANCE && Math.abs(gapTop) > 1e-6) {
            const previous = b.y
            b.y = a.y + a.height
            if (hasInteriorOverlap(next)) {
              b.y = previous
            } else {
              changed = true
            }
          }
        }
      }
    }
    if (!changed) break
  }

  return next
}

export interface WallMovePosition {
  id: string
  x: number
  y: number
}

export function moveWalls(
  state: FacadeState,
  positions: WallMovePosition[],
  options: { flush?: boolean } = {},
): FacadeState {
  const pos = new Map(positions.map((item) => [item.id, item]))
  let next = state

  for (const building of state.buildings) {
    if (!building.walls.some((wall) => pos.has(wall.id))) continue

    const walls = building.walls.map((wall) => {
      const cloned = cloneWall(wall)
      const position = pos.get(wall.id)
      if (position) {
        cloned.x = position.x
        cloned.y = position.y
      }
      return cloned
    })

    if (options.flush && hasInteriorOverlap(walls)) {
      return cloneFacadeState(state)
    }

    const placed = options.flush ? flushAdjacentWalls(walls) : walls
    if (options.flush && hasInteriorOverlap(placed)) {
      next = updateBuilding(next, building.id, (b) => ({ ...b, walls: b.walls.map(cloneWall) }))
      continue
    }

    next = updateBuilding(next, building.id, (b) => ({ ...b, walls: placed }))
  }

  return rebuildNeighbors(next)
}

/**
 * Dupliziert alle Wände einer Etage (oder einer Auswahl) als neues Geschoss
 * direkt auf die aktuelle Gebäudeoberkante (echte Wandoberkanten, nicht Index × wallHeight).
 */
export function duplicateStorey(
  state: FacadeState,
  sourceFloorIndex: number,
  options: { wallIds?: string[]; copyOpenings: boolean; copy?: Partial<StoreyCopyOptions> },
): FacadeState {
  const building = getActiveBuilding(state)
  const { wallIds } = options
  const copy = resolveStoreyCopy(options)
  const copyOpenings = copy.openings
  const sourceWalls = wallIds
    ? building.walls.filter((w) => wallIds.includes(w.id))
    : building.walls.filter((w) => floorIndex(w, building.wallHeight) === sourceFloorIndex)

  if (sourceWalls.length === 0) return cloneFacadeState(state)

  const buildingTop = Math.max(0, ...building.walls.map((wall) => wall.y + wall.height))
  const keepPlanLinked = sourceWalls.length > 1
  const clones: Wall[] = sourceWalls.map((wall) =>
    applyStoreyCopyStyle(
      cloneWallForStorey(wall, buildingTop, copyOpenings, {
        stripStairs: true,
        keepPlanLinked,
      }),
      copy,
    ),
  )

  const floors = (building.floors ?? [{ nodes: [], edges: [] }]).map(cloneFloorPlan)
  while (floors.length <= sourceFloorIndex) floors.push(createEmptyFloorPlan())
  const targetIndex = Math.max(
    sourceFloorIndex + 1,
    floors.length,
    ...(building.walls.map((w) => floorIndex(w, building.wallHeight) + 1)),
  )
  while (floors.length <= targetIndex) floors.push(createEmptyFloorPlan())
  const sourcePlan = floors[sourceFloorIndex]
  floors[targetIndex] = cloneFloorPlan(sourcePlan)

  return updateBuilding(state, building.id, (b) =>
    rebuildBuildingNeighbors({
      ...b,
      walls: [...b.walls, ...clones],
      floors,
    }),
  )
}

/**
 * Ändert die Geschosshöhe einer Etage: Wände dieser Etage werden höher/niedriger,
 * alle darüber liegenden Etagen verschieben sich entsprechend in Y.
 */
export function resizeStoreyHeight(
  state: FacadeState,
  sourceFloorIndex: number,
  deltaHeight: number,
): FacadeState {
  if (deltaHeight === 0) return cloneFacadeState(state)

  return updateActiveBuilding(state, (building) => {
    const height = building.wallHeight
    const walls = building.walls.map((wall) => {
      const fi = floorIndex(wall, height)
      if (fi < sourceFloorIndex) return cloneWall(wall)
      if (fi === sourceFloorIndex) {
        if (isStudioWall(wall)) {
          return normalizeStudioWall({
            ...cloneWall(wall),
            height: wall.height + deltaHeight,
          })
        }
        const dims = clampWallDimensions({
          width: wall.width,
          height: wall.height + deltaHeight,
          depth: wall.depth,
        })
        const cloned = cloneWall(wall)
        return {
          ...cloned,
          ...dims,
          openings: cloned.openings.map((opening) => clampOpeningToWall(opening, dims)),
        }
      }
      return { ...cloneWall(wall), y: wall.y + deltaHeight }
    })
    const wallHeight =
      sourceFloorIndex === 0 ? height + deltaHeight : building.wallHeight
    return { ...building, wallHeight, walls }
  })
}

/**
 * Entfernt eine Etage: Wände löschen, höhere Etagen um eine Geschosshöhe absenken,
 * zugehörigen Grundriss entfernen.
 */
export function removeStorey(state: FacadeState, storeyIndex: number): FacadeState {
  return updateActiveBuilding(state, (building) => {
    const height = building.wallHeight
    const walls = building.walls
      .filter((wall) => floorIndex(wall, height) !== storeyIndex)
      .map((wall) => {
        if (floorIndex(wall, height) <= storeyIndex) return cloneWall(wall)
        return { ...cloneWall(wall), y: wall.y - height }
      })

    const floors = (building.floors ?? [{ nodes: [], edges: [] }])
      .filter((_, index) => index !== storeyIndex)
      .map((plan) => ({
        nodes: plan.nodes.map((node) => ({ ...node })),
        edges: plan.edges.map((edge) => ({ ...edge })),
      }))

    return rebuildBuildingNeighbors({
      ...building,
      walls,
      floors: floors.length > 0 ? floors : [{ nodes: [], edges: [] }],
    })
  })
}
