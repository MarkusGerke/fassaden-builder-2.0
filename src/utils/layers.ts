import { WALL_HEIGHT } from '../constants/presets'
import type { Building, FacadeState, Wall } from '../types/facade'
import { basementWindowEnabled } from '../studio/basementWindow'
import { findBuildingForWall, getActiveBuilding, getAllWalls } from './buildings'
import { groupWallsByFloorForBuilding, sortedFloorIndicesForBuilding } from '../ui/layerListHelpers'

export type LayerItem = { kind: 'wall'; wallId: string }

export function floorIndex(wall: Wall, wallHeight = WALL_HEIGHT): number {
  return Math.round(wall.y / wallHeight)
}

/** Y-Position der Geschossoberkante (Decke/Boden-Trennfläche) aus den Wänden dieser Etage. */
export function storeyTopY(building: Building, floorIdx: number): number {
  const wh = building.wallHeight
  let top = 0
  let found = false
  for (const wall of building.walls) {
    if (wall.hidden) continue
    if (floorIndex(wall, wh) !== floorIdx) continue
    found = true
    top = Math.max(top, wall.y + wall.height)
  }
  return found ? top : (floorIdx + 1) * wh
}

/** Y-Unterkante einer Etage (Wandfuß). */
export function storeyBottomY(building: Building, floorIdx: number): number {
  const wh = building.wallHeight
  let bottom = Infinity
  let found = false
  for (const wall of building.walls) {
    if (wall.hidden) continue
    if (floorIndex(wall, wh) !== floorIdx) continue
    found = true
    bottom = Math.min(bottom, wall.y)
  }
  return found ? bottom : floorIdx * wh
}

/**
 * Begehbare Fußboden-Oberkante: untere Türkante im Raum, sonst Wandfuß.
 */
export function storeyFloorSurfaceY(building: Building, floorIdx: number): number {
  const wh = building.wallHeight
  let sill = Infinity
  for (const wall of building.walls) {
    if (wall.hidden) continue
    if (floorIndex(wall, wh) !== floorIdx) continue
    for (const opening of wall.openings) {
      if (opening.hidden || opening.type !== 'door') continue
      sill = Math.min(sill, wall.y + opening.y)
    }
  }
  return Number.isFinite(sill) ? sill : storeyBottomY(building, floorIdx)
}

/**
 * Y-Oberkante der lichtdichten Boden-Vollplatte: Fußboden, mindestens über allen Kellerfenstern.
 * Verhindert diagonales Punktlicht von oben in Kellerfenster.
 */
export function effectiveStoreyFloorCapY(building: Building, floorIdx: number, padCm = 4): number {
  const base = storeyFloorSurfaceY(building, floorIdx)
  const wh = building.wallHeight
  let basementTop = -Infinity
  for (const wall of building.walls) {
    if (wall.hidden) continue
    if (floorIndex(wall, wh) !== floorIdx) continue
    for (const opening of wall.openings) {
      if (opening.hidden || !basementWindowEnabled(opening)) continue
      basementTop = Math.max(basementTop, wall.y + opening.y + opening.height)
    }
  }
  if (!Number.isFinite(basementTop)) return base
  return Math.max(base, basementTop + padCm)
}

export function floorLabel(index: number): string {
  if (index === 0) return 'Erdgeschoss'
  return `${index}. Obergeschoss`
}

function wallHeightForWall(state: FacadeState, wall: Wall): number {
  return findBuildingForWall(state, wall.id)?.wallHeight ?? getActiveBuilding(state).wallHeight
}

export function groupWallsByFloor(facadeState: FacadeState): Map<number, Wall[]> {
  const map = new Map<number, Wall[]>()
  for (const wall of getAllWalls(facadeState)) {
    const index = floorIndex(wall, wallHeightForWall(facadeState, wall))
    const list = map.get(index) ?? []
    list.push(wall)
    map.set(index, list)
  }
  for (const walls of map.values()) {
    walls.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
  }
  return map
}

export function sortedFloorIndices(facadeState: FacadeState): number[] {
  return [...groupWallsByFloor(facadeState).keys()].sort((a, b) => b - a)
}

export function buildLayerOrder(facadeState: FacadeState): LayerItem[] {
  const items: LayerItem[] = []
  for (const building of [...facadeState.buildings].reverse()) {
    const byFloor = groupWallsByFloorForBuilding(building)
    for (const floor of sortedFloorIndicesForBuilding(building)) {
      const walls = byFloor.get(floor) ?? []
      for (const wall of walls) {
        items.push({ kind: 'wall', wallId: wall.id })
      }
    }
  }
  return items
}

export function layerIndexForWall(facadeState: FacadeState, wallId: string): number {
  return buildLayerOrder(facadeState).findIndex(
    (item) => item.kind === 'wall' && item.wallId === wallId,
  )
}

export function buildingWallHeight(building: Building): number {
  return building.wallHeight
}
