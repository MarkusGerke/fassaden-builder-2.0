import { WALL_DEPTH, WALL_HEIGHT } from '../constants/presets'
import { PLAN_GRID } from '../studio/constants'
import { createEmptyFloorPlan, type FloorPlan } from '../studio/floorPlan'
import { isStudioWall } from '../studio/walls'
import type { Building, FacadeState, RoofConfig, Wall, WallGroup } from '../types/facade'
import { cloneBuilding, cloneWall, emptyNeighbors } from '../types/facade'
import { createId } from './id'
import { floorIndex } from './layers'
import { rebuildBuildingNeighbors, recomputeBuildingLayout } from './walls'

/** Eingabe für Migration: neues Multi-Building oder flaches Legacy-Format. */
export type FacadeStateInput = {
  buildings?: Building[]
  activeBuildingId?: string
  walls?: Wall[]
  wallHeight?: number
  wallDepth?: number
  windowDepthOffset?: number
  floors?: FloorPlan[]
  roof?: RoofConfig
  customProfiles?: FacadeState['customProfiles']
  viewOptions?: FacadeState['viewOptions']
  siteYawDeg?: number
}

function cloneFloorPlan(plan: FloorPlan): FloorPlan {
  return {
    nodes: plan.nodes.map((node) => ({ ...node })),
    edges: plan.edges.map((edge) => ({ ...edge })),
    showCeiling: plan.showCeiling,
    ceilingColor: plan.ceilingColor,
    hidden: plan.hidden,
  }
}

function cloneRoof(roof: RoofConfig | undefined): RoofConfig | undefined {
  return roof ? { ...roof } : undefined
}

export function syncWallBuildingIds(building: Building): Building {
  return {
    ...building,
    walls: building.walls.map((wall) =>
      wall.buildingId === building.id ? wall : { ...wall, buildingId: building.id },
    ),
    groups: (building.groups ?? [])
      .map((group) => ({
        ...group,
        memberWallIds: group.memberWallIds.filter((id) => building.walls.some((wall) => wall.id === id)),
      }))
      .filter((group) => group.memberWallIds.length > 0),
  }
}

/** Darstellung: nur weiße Vollwände ohne Fassadendetail. */
export function buildingShowsBareWalls(building: Building | undefined | null): boolean {
  return Boolean(building?.bareWalls)
}

/** Wandkörper ohne Öffnungslöcher (für `bareWalls`). */
export function wallWithoutOpenings(wall: Wall): Wall {
  if (wall.openings.length === 0) return wall
  return { ...wall, openings: [] }
}

export function createBuilding(partial?: Partial<Building>): Building {
  const id = partial?.id ?? createId()
  return syncWallBuildingIds({
    id,
    name: partial?.name ?? 'Haus 1',
    hidden: partial?.hidden,
    bareWalls: partial?.bareWalls,
    floors:
      partial?.floors && partial.floors.length > 0
        ? partial.floors.map((plan) => ({
            nodes: plan.nodes.map((node) => ({ ...node })),
            edges: plan.edges.map((edge) => ({ ...edge })),
            showCeiling: plan.showCeiling,
            ceilingColor: plan.ceilingColor,
            hidden: plan.hidden,
          }))
        : [createEmptyFloorPlan()],
    walls: (partial?.walls ?? []).map(cloneWall),
    groups: partial?.groups?.map((group) => ({
      ...group,
      memberWallIds: [...group.memberWallIds],
    })) ?? [],
    roof: cloneRoof(partial?.roof),
    wallHeight: partial?.wallHeight ?? WALL_HEIGHT,
    wallDepth: partial?.wallDepth ?? WALL_DEPTH,
    windowDepthOffset: partial?.windowDepthOffset,
  })
}

export function upsertWallGroup(building: Building, group: WallGroup): Building {
  const groups = building.groups ?? []
  const existing = groups.findIndex((item) => item.id === group.id)
  const nextGroups =
    existing >= 0
      ? groups.map((item, index) => (index === existing ? { ...group, memberWallIds: [...group.memberWallIds] } : item))
      : [...groups, { ...group, memberWallIds: [...group.memberWallIds] }]
  return syncWallBuildingIds({ ...building, groups: nextGroups })
}

function repairEmptyBuildingsFromLegacy(
  buildings: Building[],
  activeBuildingId: string,
  legacy: FacadeStateInput,
): Building[] {
  const totalWalls = buildings.reduce((count, building) => count + building.walls.length, 0)
  const legacyWalls = legacy.walls ?? []
  if (totalWalls > 0 || legacyWalls.length === 0) return buildings

  const targetIndex = Math.max(
    0,
    buildings.findIndex((building) => building.id === activeBuildingId),
  )
  return buildings.map((building, index) => {
    if (index !== targetIndex) return building
    return syncWallBuildingIds({
      ...building,
      walls: legacyWalls.map((wall) => ({ ...cloneWall(wall), buildingId: building.id })),
      wallHeight: building.wallHeight || legacy.wallHeight || WALL_HEIGHT,
      wallDepth: building.wallDepth || legacy.wallDepth || WALL_DEPTH,
      windowDepthOffset: building.windowDepthOffset ?? legacy.windowDepthOffset,
      roof: building.roof ?? legacy.roof,
      floors:
        building.floors.length > 0
          ? building.floors
          : legacy.floors && legacy.floors.length > 0
            ? legacy.floors.map((plan) => ({
                nodes: plan.nodes.map((node) => ({ ...node })),
                edges: plan.edges.map((edge) => ({ ...edge })),
                showCeiling: plan.showCeiling,
                hidden: plan.hidden,
              }))
            : [createEmptyFloorPlan()],
    })
  })
}

export function migrateToBuildings(legacyOrNew: FacadeStateInput | FacadeState): FacadeState {
  const legacyInput = legacyOrNew as FacadeStateInput
  if (legacyOrNew.buildings && legacyOrNew.buildings.length > 0) {
    const activeBuildingId = legacyOrNew.buildings.some((b) => b.id === legacyOrNew.activeBuildingId)
      ? (legacyOrNew.activeBuildingId as string)
      : legacyOrNew.buildings[0].id
    const buildings = repairEmptyBuildingsFromLegacy(
      legacyOrNew.buildings.map((building) =>
        syncWallBuildingIds(
          createBuilding({
            ...building,
            floors:
              building.floors && building.floors.length > 0
                ? building.floors
                : [createEmptyFloorPlan()],
          }),
        ),
      ),
      activeBuildingId,
      legacyInput,
    )
    return {
      buildings,
      activeBuildingId,
      customProfiles: legacyOrNew.customProfiles,
      viewOptions: legacyOrNew.viewOptions,
      siteYawDeg: legacyOrNew.siteYawDeg,
      sceneLights: legacyOrNew.sceneLights,
    }
  }

  const legacy = legacyOrNew as FacadeStateInput
  const building = createBuilding({
    name: 'Haus 1',
    walls: legacy.walls ?? [],
    floors:
      legacy.floors && legacy.floors.length > 0
        ? legacy.floors
        : [createEmptyFloorPlan()],
    roof: legacy.roof,
    wallHeight: legacy.wallHeight ?? WALL_HEIGHT,
    wallDepth: legacy.wallDepth ?? WALL_DEPTH,
    windowDepthOffset: legacy.windowDepthOffset,
  })

  return {
    buildings: [building],
    activeBuildingId: building.id,
    customProfiles: legacyOrNew.customProfiles,
    viewOptions: legacyOrNew.viewOptions,
    siteYawDeg: legacyOrNew.siteYawDeg,
    sceneLights: legacyOrNew.sceneLights,
  }
}

export function getActiveBuilding(state: FacadeState): Building {
  const found = state.buildings.find((b) => b.id === state.activeBuildingId)
  return found ?? state.buildings[0]
}

/** Alle Wände aller Gebäude (inkl. hidden); Filterung ist Sache des Renderers. */
export function getAllWalls(state: FacadeState): Wall[] {
  return state.buildings.flatMap((building) => building.walls)
}

/** Wände sichtbarer Gebäude ohne wall.hidden und ohne ausgeblendete Etage. */
export function getVisibleWalls(state: FacadeState): Wall[] {
  const out: Wall[] = []
  for (const building of state.buildings) {
    if (building.hidden) continue
    for (const wall of building.walls) {
      if (wall.hidden) continue
      const fi = floorIndex(wall, building.wallHeight)
      const plan = building.floors[fi]
      if (plan?.hidden) continue
      out.push(wall)
    }
  }
  return out
}

export function withActiveBuilding(state: FacadeState, building: Building): FacadeState {
  const synced = syncWallBuildingIds(building)
  return {
    ...state,
    buildings: state.buildings.map((b) => (b.id === synced.id ? synced : b)),
    activeBuildingId: synced.id,
  }
}

export function updateActiveBuilding(
  state: FacadeState,
  patch: Partial<Building> | ((building: Building) => Building),
): FacadeState {
  const current = getActiveBuilding(state)
  const next =
    typeof patch === 'function' ? patch(cloneBuilding(current)) : { ...cloneBuilding(current), ...patch }
  return withActiveBuilding(state, next)
}

export function setActiveBuildingId(state: FacadeState, id: string): FacadeState {
  if (!state.buildings.some((b) => b.id === id)) return state
  return { ...state, activeBuildingId: id }
}

function maxPlanGx(state: FacadeState): number {
  let maxGx = 0
  for (const building of state.buildings) {
    for (const floor of building.floors) {
      for (const node of floor.nodes) {
        maxGx = Math.max(maxGx, node.gx)
      }
    }
    for (const wall of building.walls) {
      const ox = wall.originX ?? wall.x
      const endX = ox + (wall.width ?? 0)
      maxGx = Math.max(maxGx, Math.ceil(ox / PLAN_GRID), Math.ceil(endX / PLAN_GRID))
    }
  }
  return maxGx
}

function offsetFloorPlan(plan: FloorPlan, offsetGx: number): FloorPlan {
  if (offsetGx === 0) return cloneFloorPlan(plan)
  return {
    ...cloneFloorPlan(plan),
    nodes: plan.nodes.map((node) => ({ ...node, gx: node.gx + offsetGx })),
  }
}

/** Neues leeres Gebäude rechts neben dem bisherigen Plan (Gitter-Offset). */
export function addBuildingBeside(state: FacadeState): FacadeState {
  const active = getActiveBuilding(state)
  const gap = 3
  const offsetGx = maxPlanGx(state) + gap
  const index = state.buildings.length + 1
  const floors =
    active.floors.length > 0
      ? active.floors.map((plan) =>
          offsetFloorPlan({ nodes: [], edges: [], showCeiling: plan.showCeiling, hidden: plan.hidden }, offsetGx),
        )
      : [createEmptyFloorPlan()]
  // Leere Etagen: eine FloorPlan pro vorhandener Etage, Knoten bereits leer — Offset irrelevant.
  // Sicherstellen: mindestens eine leere FloorPlan.
  const nextFloors = floors.length > 0 ? floors : [createEmptyFloorPlan()]

  const building = createBuilding({
    name: `Haus ${index}`,
    floors: nextFloors.map((plan) => ({
      nodes: plan.nodes.map((n) => ({ ...n, gx: n.gx })),
      edges: [],
      showCeiling: plan.showCeiling,
      hidden: plan.hidden,
    })),
    walls: [],
    wallHeight: active.wallHeight,
    wallDepth: active.wallDepth,
    windowDepthOffset: active.windowDepthOffset,
  })

  return {
    ...state,
    buildings: [...state.buildings, building],
    activeBuildingId: building.id,
  }
}

export function removeBuilding(state: FacadeState, id: string): FacadeState {
  const buildings = state.buildings.filter((b) => b.id !== id)
  if (buildings.length === state.buildings.length) return state
  if (buildings.length === 0) {
    const fallback = createBuilding({
      name: 'Haus 1',
      wallHeight: state.buildings[0]?.wallHeight,
      wallDepth: state.buildings[0]?.wallDepth,
      windowDepthOffset: state.buildings[0]?.windowDepthOffset,
    })
    return { ...state, buildings: [fallback], activeBuildingId: fallback.id }
  }
  const activeBuildingId =
    state.activeBuildingId === id ? buildings[0].id : state.activeBuildingId
  return { ...state, buildings, activeBuildingId }
}

export function findWall(state: FacadeState, id: string | null | undefined): Wall | undefined {
  if (!id) return undefined
  for (const building of state.buildings) {
    const wall = building.walls.find((w) => w.id === id)
    if (wall) return wall
  }
  return undefined
}

export function findBuildingForWall(state: FacadeState, wallId: string): Building | undefined {
  return state.buildings.find((b) => b.walls.some((w) => w.id === wallId))
}

/** Mappt alle Wände aller Gebäude. */
export function mapAllWalls(state: FacadeState, fn: (wall: Wall) => Wall): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      syncWallBuildingIds({
        ...building,
        walls: building.walls.map(fn),
      }),
    ),
  }
}

/** Ersetzt die Wandliste des aktiven Gebäudes. */
export function withActiveWalls(state: FacadeState, walls: Wall[]): FacadeState {
  return updateActiveBuilding(state, (b) => ({ ...b, walls }))
}

/** Aktualisiert ein Gebäude anhand der ID. */
export function updateBuilding(
  state: FacadeState,
  buildingId: string,
  patch: Partial<Building> | ((building: Building) => Building),
): FacadeState {
  return {
    ...state,
    buildings: state.buildings.map((building) => {
      if (building.id !== buildingId) return building
      const next =
        typeof patch === 'function'
          ? patch(cloneBuilding(building))
          : { ...cloneBuilding(building), ...patch }
      return syncWallBuildingIds(next)
    }),
  }
}

export type BuildingDuplicateDirection = 'east' | 'west' | 'north' | 'south'

type PlanGridBounds = { minGx: number; maxGx: number; minGz: number; maxGz: number }

function planGridBoundsFromBuilding(building: Building): PlanGridBounds | null {
  let minGx = Infinity
  let maxGx = -Infinity
  let minGz = Infinity
  let maxGz = -Infinity
  let any = false
  for (const floor of building.floors) {
    for (const node of floor.nodes) {
      any = true
      minGx = Math.min(minGx, node.gx)
      maxGx = Math.max(maxGx, node.gx)
      minGz = Math.min(minGz, node.gz)
      maxGz = Math.max(maxGz, node.gz)
    }
  }
  for (const wall of building.walls) {
    const ox = wall.originX ?? wall.x
    const oz = wall.originZ ?? 0
    const gx0 = Math.floor(ox / PLAN_GRID)
    const gz0 = Math.floor(oz / PLAN_GRID)
    const gx1 = Math.ceil((ox + (wall.width ?? 0)) / PLAN_GRID)
    const gz1 = Math.ceil((oz + (wall.depth ?? 0)) / PLAN_GRID)
    any = true
    minGx = Math.min(minGx, gx0, gx1)
    maxGx = Math.max(maxGx, gx0, gx1)
    minGz = Math.min(minGz, gz0, gz1)
    maxGz = Math.max(maxGz, gz0, gz1)
  }
  if (!any) return null
  return { minGx, maxGx, minGz, maxGz }
}

function globalPlanGridBounds(state: FacadeState): PlanGridBounds {
  let minGx = Infinity
  let maxGx = -Infinity
  let minGz = Infinity
  let maxGz = -Infinity
  let any = false
  for (const building of state.buildings) {
    const bounds = planGridBoundsFromBuilding(building)
    if (!bounds) continue
    any = true
    minGx = Math.min(minGx, bounds.minGx)
    maxGx = Math.max(maxGx, bounds.maxGx)
    minGz = Math.min(minGz, bounds.minGz)
    maxGz = Math.max(maxGz, bounds.maxGz)
  }
  if (!any) return { minGx: 0, maxGx: 0, minGz: 0, maxGz: 0 }
  return { minGx, maxGx, minGz, maxGz }
}

function cloneBuildingWithNewIds(source: Building): Building {
  const newBuildingId = createId()
  const nodeIdMap = new Map<string, string>()
  const floors = source.floors.map((plan) => {
    const nodes = plan.nodes.map((node) => {
      const id = createId()
      nodeIdMap.set(node.id, id)
      return { ...node, id }
    })
    return {
      nodes,
      edges: plan.edges.map((edge) => ({
        ...edge,
        id: createId(),
        fromId: nodeIdMap.get(edge.fromId) ?? edge.fromId,
        toId: nodeIdMap.get(edge.toId) ?? edge.toId,
      })),
      showCeiling: plan.showCeiling,
      ceilingColor: plan.ceilingColor,
      hidden: plan.hidden,
    }
  })

  const wallIdMap = new Map<string, string>()
  const walls = source.walls.map((wall) => {
    const openingIdMap = new Map<string, string>()
    const newWallId = createId()
    wallIdMap.set(wall.id, newWallId)
    const openings = wall.openings.map((opening) => {
      const nextId = createId()
      openingIdMap.set(opening.id, nextId)
      return { ...opening, id: nextId }
    })
    return {
      ...cloneWall(wall),
      id: newWallId,
      buildingId: newBuildingId,
      neighbors: emptyNeighbors(),
      openings,
      profiles: wall.profiles.map((profile) => ({
        ...profile,
        openingId: openingIdMap.get(profile.openingId) ?? profile.openingId,
      })),
    }
  })

  const remappedWalls = walls.map((wall) => ({
    ...wall,
    neighbors: {
      left: wall.neighbors.left ? wallIdMap.get(wall.neighbors.left) : undefined,
      right: wall.neighbors.right ? wallIdMap.get(wall.neighbors.right) : undefined,
      top: wall.neighbors.top ? wallIdMap.get(wall.neighbors.top) : undefined,
      bottom: wall.neighbors.bottom ? wallIdMap.get(wall.neighbors.bottom) : undefined,
    },
  }))

  return syncWallBuildingIds({
    ...cloneBuilding(source),
    id: newBuildingId,
    floors,
    walls: remappedWalls,
    roof: source.roof ? { ...source.roof } : undefined,
  })
}

function offsetBuildingGrid(building: Building, dgx: number, dgz: number): Building {
  if (dgx === 0 && dgz === 0) return building
  const dx = dgx * PLAN_GRID
  const dz = dgz * PLAN_GRID
  return {
    ...building,
    floors: building.floors.map((plan) => ({
      ...plan,
      nodes: plan.nodes.map((node) => ({ ...node, gx: node.gx + dgx, gz: node.gz + dgz })),
    })),
    walls: building.walls.map((wall) => {
      if (isStudioWall(wall)) {
        return {
          ...wall,
          originX: (wall.originX ?? wall.x) + dx,
          originZ: (wall.originZ ?? 0) + dz,
        }
      }
      return { ...wall, x: wall.x + dx }
    }),
  }
}

/** Haus aus Snapshot einfügen (neue IDs) und in Gitterrichtung versetzen. */
export function insertBuildingClone(
  state: FacadeState,
  source: Building,
  direction: BuildingDuplicateDirection = 'east',
): FacadeState {
  const gap = 3
  let clone = cloneBuildingWithNewIds(source)
  const sourceBounds = planGridBoundsFromBuilding(clone)
  const globalBounds = globalPlanGridBounds(state)

  let dgx = 0
  let dgz = 0
  if (sourceBounds) {
    switch (direction) {
      case 'east':
        dgx = globalBounds.maxGx + gap - sourceBounds.minGx
        break
      case 'west':
        dgx = globalBounds.minGx - gap - sourceBounds.maxGx
        break
      case 'south':
        dgz = globalBounds.maxGz + gap - sourceBounds.minGz
        break
      case 'north':
        dgz = globalBounds.minGz - gap - sourceBounds.maxGz
        break
    }
  } else {
    dgx = maxPlanGx(state) + gap
  }

  clone = offsetBuildingGrid(clone, dgx, dgz)
  clone = rebuildBuildingNeighbors(recomputeBuildingLayout(clone))
  clone.name = `Haus ${state.buildings.length + 1}`

  return {
    ...state,
    buildings: [...state.buildings, clone],
    activeBuildingId: clone.id,
  }
}

/** Haus inkl. Grundriss und Wände duplizieren und in Gitterrichtung versetzen. */
export function duplicateBuilding(
  state: FacadeState,
  buildingId: string,
  direction: BuildingDuplicateDirection,
): FacadeState {
  const source = state.buildings.find((b) => b.id === buildingId)
  if (!source) return state
  return insertBuildingClone(state, source, direction)
}

/** Verschiebt ein Gebäude um Gitterzellen (Grundriss-Knoten + Wand-Origins). */
export function offsetBuildingByGrid(
  state: FacadeState,
  buildingId: string,
  dgx: number,
  dgz: number,
): FacadeState {
  if (dgx === 0 && dgz === 0) return state
  return updateBuilding(state, buildingId, (building) =>
    rebuildBuildingNeighbors(recomputeBuildingLayout(offsetBuildingGrid(building, dgx, dgz))),
  )
}

export function planGridBoundsForBuilding(building: Building): PlanGridBounds | null {
  return planGridBoundsFromBuilding(building)
}
