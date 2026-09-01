import type { Building, FacadeState, Opening, Wall } from '../types/facade'
import { PLAN_GRID } from '../studio/constants'
import type { FloorPlan } from '../studio/floorPlan'
import { floorIndex, floorLabel } from '../utils/layers'

export function groupWallsByFloorForBuilding(building: Building): Map<number, Wall[]> {
  const map = new Map<number, Wall[]>()
  for (const wall of building.walls) {
    const index = floorIndex(wall, building.wallHeight)
    const list = map.get(index) ?? []
    list.push(wall)
    map.set(index, list)
  }
  for (const walls of map.values()) {
    walls.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
  }
  return map
}

export function sortedFloorIndicesForBuilding(building: Building): number[] {
  const indices = new Set<number>()
  for (let i = 0; i < building.floors.length; i += 1) indices.add(i)
  for (const wall of building.walls) {
    indices.add(floorIndex(wall, building.wallHeight))
  }
  return [...indices].sort((a, b) => b - a)
}

export { floorLabel }

export function visibilityMenuLabel(hidden?: boolean): string {
  return hidden ? 'Einblenden' : 'Ausblenden'
}

export function layerHiddenClass(hidden?: boolean): string {
  return hidden ? ' layer-dimmed' : ''
}

export function canEditActiveBuilding(state: FacadeState): boolean {
  const building = state.buildings.find((b) => b.id === state.activeBuildingId)
  return Boolean(building && !building.hidden)
}

export function canEditWall(state: FacadeState, wallId: string): boolean {
  const building = state.buildings.find((b) => b.walls.some((w) => w.id === wallId))
  if (!building || building.hidden) return false
  return building.id === state.activeBuildingId
}

export function layerWidthMeta(widthCm: number): string {
  return `${Math.round(widthCm)} cm`
}

export function layerOpeningWidthMeta(opening: Opening): string {
  return layerWidthMeta(opening.width)
}

export function floorPlanSpanMeta(plan: FloorPlan | undefined): string {
  if (!plan || plan.nodes.length === 0) return '—'
  let minGx = Infinity
  let maxGx = -Infinity
  for (const node of plan.nodes) {
    minGx = Math.min(minGx, node.gx)
    maxGx = Math.max(maxGx, node.gx)
  }
  return layerWidthMeta(Math.max(0, (maxGx - minGx) * PLAN_GRID))
}
