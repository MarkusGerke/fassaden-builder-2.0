import { WALL_DEPTH, WALL_HEIGHT, WINDOW_SILL_Y } from '../constants/presets'
import type { FacadeState, Opening, Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import type { FacadeStateInput } from '../utils/buildings'
import { updateActiveBuilding } from '../utils/buildings'
import { snapToGrid } from '../utils/grid'
import { createId } from '../utils/id'
import { hydrateOpening } from '../utils/hydrate'
import { clampOpeningToWall } from '../utils/validation'
import { getWallBounds, rebuildBuildingNeighbors } from '../utils/walls'
import { blenderWindowName } from '../blender/windowModels'
import { defaultGruenderzeitConfig } from '../windows/gruenderzeit'
import { DEFAULT_GLASS_COLOR, defaultOpeningFrameColor } from '../constants/colorPalettes'
import { openingKind, parseWallModuleName } from './parseModuleName'

export interface WallModuleOpening {
  width: number
  height: number
  x: number
  y: number
  type: 'door' | 'window'
}

export interface WallModule {
  name: string
  width: number
  height: number
  openings: WallModuleOpening[]
}

/** Wandmodule aus Blender (ohne -v1/-v2 — das sind Paneele). */
const BLENDER_MODULE_NAMES = [
  '3-96x416-48x192',
  '4-192x416-48x192',
  '4-192x416-96x192',
  '4-192x416-144x192',
  '5-384x416-48x192',
  '5-384x416-96x192',
  '5-384x416-144x192',
  '5-384x416-192x192',
  '5-384x416-288x192',
] as const

export const DEFAULT_WALL_MODULE = '4-192x416-96x192'

function centeredX(wallWidth: number, openingWidth: number): number {
  return snapToGrid((wallWidth - openingWidth) / 2)
}

function singleOpeningLayout(
  wallWidth: number,
  opening: { width: number; height: number },
): WallModuleOpening {
  const type = openingKind(opening.height)
  return {
    width: opening.width,
    height: opening.height,
    x: centeredX(wallWidth, opening.width),
    y: type === 'door' ? 0 : WINDOW_SILL_Y,
    type,
  }
}

function layoutOpenings(
  wallWidth: number,
  openings: { width: number; height: number }[],
): WallModuleOpening[] {
  if (openings.length === 1) {
    return [singleOpeningLayout(wallWidth, openings[0])]
  }

  let cursor = 0
  return openings.map((opening) => {
    const type = openingKind(opening.height)
    const layout: WallModuleOpening = {
      width: opening.width,
      height: opening.height,
      x: cursor,
      y: type === 'door' ? 0 : WINDOW_SILL_Y,
      type,
    }
    cursor += opening.width
    return layout
  })
}

function buildModule(name: string): WallModule | null {
  const parsed = parseWallModuleName(name)
  if (!parsed || parsed.openings.length === 0) return null

  return {
    name: parsed.name,
    width: parsed.width,
    height: WALL_HEIGHT,
    openings: layoutOpenings(parsed.width, parsed.openings),
  }
}

export const BLENDER_WALL_MODULES: WallModule[] = BLENDER_MODULE_NAMES.map((name) =>
  buildModule(name),
).filter((module): module is WallModule => module !== null)

export function getWallModule(name: string): WallModule | undefined {
  const base = name.replace(/-v[12]$/, '')
  return BLENDER_WALL_MODULES.find((module) => module.name === base)
}

function createOpeningFromLayout(
  layout: WallModuleOpening,
  wall: Pick<Wall, 'width' | 'height' | 'depth'>,
): Opening {
  return hydrateOpening(
    clampOpeningToWall(
      {
        id: createId(),
        type: layout.type,
        width: layout.width,
        height: layout.height,
        x: layout.x,
        y: layout.y,
        windowModel:
          layout.type === 'window'
            ? blenderWindowName(layout.width, layout.height)
            : undefined,
        gruenderzeit: defaultGruenderzeitConfig(layout.width, layout.height, layout.type),
        frameColor: defaultOpeningFrameColor(layout.type),
        glassColor: DEFAULT_GLASS_COLOR,
      },
      wall,
    ),
    wall,
  )
}

export function wallFromModule(module: WallModule, x = 0): Wall {
  const wall: Wall = {
    id: createId(),
    moduleName: module.name,
    x,
    y: 0,
    width: module.width,
    height: module.height,
    depth: WALL_DEPTH,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
  }

  wall.openings = module.openings.map((layout) => createOpeningFromLayout(layout, wall))
  return wall
}

export function createDefaultFacadeState(): FacadeStateInput {
  const module = getWallModule(DEFAULT_WALL_MODULE) ?? BLENDER_WALL_MODULES[0]
  return {
    walls: [wallFromModule(module, 0)],
    wallHeight: WALL_HEIGHT,
    wallDepth: WALL_DEPTH,
  }
}

export function appendWallModule(state: FacadeState, moduleName: string): FacadeState {
  const module = getWallModule(moduleName)
  if (!module) return state

  return updateActiveBuilding(state, (building) => {
    const bounds = getWallBounds(building.walls)
    const x = building.walls.length === 0 ? 0 : bounds.maxX
    const wall = wallFromModule(module, x)
    return rebuildBuildingNeighbors({
      ...building,
      walls: [...building.walls, wall],
    })
  })
}

export function applyWallModule(
  state: FacadeState,
  wallIds: string[],
  moduleName: string,
): FacadeState {
  const module = getWallModule(moduleName)
  if (!module) return state

  const idSet = new Set(wallIds)
  return {
    ...state,
    buildings: state.buildings.map((building) => {
      if (!building.walls.some((wall) => idSet.has(wall.id))) return building
      const walls = building.walls.map((wall) => {
        if (!idSet.has(wall.id)) return wall
        const next: Wall = {
          ...wall,
          moduleName: module.name,
          width: module.width,
          height: module.height,
          openings: [],
          profiles: [],
          claddingId: undefined,
        }
        next.openings = module.openings.map((layout) => createOpeningFromLayout(layout, next))
        return next
      })
      return rebuildBuildingNeighbors({ ...building, walls })
    }),
  }
}
