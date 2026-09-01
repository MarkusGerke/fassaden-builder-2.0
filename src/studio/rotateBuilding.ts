import type { Building, FacadeState, StudioYawDeg } from '../types/facade'
import { cloneFacadeState } from '../types/facade'
import { updateBuilding } from '../utils/buildings'
import { rebuildBuildingNeighbors, recomputeBuildingLayout } from '../utils/walls'
import { snapYawTo45 } from './compass'
import { PLAN_GRID } from './constants'
import { planNodeWorld } from './floorPlan'
import { isStudioWall } from './walls'

export type BuildingRotateDelta = 45 | -45

export function normalizeSiteYawDeg(yaw: number | undefined): number {
  return snapYawTo45(yaw ?? 0)
}

export function buildingCentroid(state: FacadeState): { x: number; z: number } | null {
  let sx = 0
  let sz = 0
  let n = 0
  for (const building of state.buildings) {
    if (building.hidden) continue
    for (const wall of building.walls) {
      if (!isStudioWall(wall)) continue
      sx += wall.originX ?? wall.x
      sz += wall.originZ ?? 0
      n += 1
    }
  }
  if (n === 0) {
    for (const building of state.buildings) {
      if (building.hidden) continue
      for (const plan of building.floors) {
        for (const node of plan.nodes) {
          const w = planNodeWorld(node)
          sx += w.x
          sz += w.z
          n += 1
        }
      }
    }
  }
  if (n === 0) return null
  return { x: sx / n, z: sz / n }
}

export function canRotateStudioBuilding(state: FacadeState): boolean {
  return state.buildings.some(
    (building) =>
      !building.hidden &&
      (building.walls.some(isStudioWall) || building.floors.some((plan) => plan.nodes.length > 0)),
  )
}

/**
 * Dreht den Baukörper als Site-Gruppe (±45° CCW), ohne Wände neu zu bauen.
 * Die 3D-Szene wendet `siteYawDeg` um den Schwerpunkt an.
 */
export function rotateStudioBuilding(
  state: FacadeState,
  deltaYawDeg: BuildingRotateDelta,
): FacadeState {
  if (!canRotateStudioBuilding(state)) return cloneFacadeState(state)
  const next = cloneFacadeState(state)
  next.siteYawDeg = normalizeSiteYawDeg((state.siteYawDeg ?? 0) + deltaYawDeg)
  return next
}

function rotatePoint(
  x: number,
  z: number,
  cx: number,
  cz: number,
  deltaDeg: number,
): { x: number; z: number } {
  const rad = (deltaDeg * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const dx = x - cx
  const dz = z - cz
  return { x: cx + dx * c - dz * s, z: cz + dx * s + dz * c }
}

function buildingPivot(building: Building): { x: number; z: number } | null {
  let sx = 0
  let sz = 0
  let n = 0
  for (const plan of building.floors) {
    for (const node of plan.nodes) {
      const w = planNodeWorld(node)
      sx += w.x
      sz += w.z
      n += 1
    }
  }
  if (n === 0) {
    for (const wall of building.walls) {
      if (!isStudioWall(wall)) continue
      sx += wall.originX ?? wall.x
      sz += wall.originZ ?? 0
      n += 1
    }
  }
  if (n === 0) return null
  return {
    x: Math.round(sx / n / PLAN_GRID) * PLAN_GRID,
    z: Math.round(sz / n / PLAN_GRID) * PLAN_GRID,
  }
}

export function canRotateBuildingGeometry(state: FacadeState, buildingId: string): boolean {
  const building = state.buildings.find((b) => b.id === buildingId && !b.hidden)
  if (!building) return false
  return building.walls.some(isStudioWall) || building.floors.some((plan) => plan.nodes.length > 0)
}

/**
 * Dreht ein einzelnes Haus geometrisch um ±45° (Plan-Knoten + Wand-Origins/Yaw).
 */
export function rotateBuildingByDeg(
  state: FacadeState,
  buildingId: string,
  deltaYawDeg: BuildingRotateDelta,
): FacadeState {
  if (!canRotateBuildingGeometry(state, buildingId)) return cloneFacadeState(state)
  return updateBuilding(state, buildingId, (building) => {
    const pivot = buildingPivot(building)
    if (!pivot) return building
    const floors = building.floors.map((plan) => ({
      ...plan,
      nodes: plan.nodes.map((node) => {
        const w = planNodeWorld(node)
        const r = rotatePoint(w.x, w.z, pivot.x, pivot.z, deltaYawDeg)
        return {
          ...node,
          gx: Math.round(r.x / PLAN_GRID),
          gz: Math.round(r.z / PLAN_GRID),
        }
      }),
    }))
    const walls = building.walls.map((wall) => {
      if (!isStudioWall(wall)) return wall
      const ox = wall.originX ?? wall.x
      const oz = wall.originZ ?? 0
      const r = rotatePoint(ox, oz, pivot.x, pivot.z, deltaYawDeg)
      const yaw = snapYawTo45((wall.yawDeg ?? 0) + deltaYawDeg) as StudioYawDeg
      return {
        ...wall,
        originX: Math.round(r.x / PLAN_GRID) * PLAN_GRID,
        originZ: Math.round(r.z / PLAN_GRID) * PLAN_GRID,
        yawDeg: yaw,
      }
    })
    return rebuildBuildingNeighbors(recomputeBuildingLayout({ ...building, floors, walls }))
  })
}
