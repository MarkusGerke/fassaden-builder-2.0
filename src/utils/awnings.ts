import type { AwningConfig, FacadeState, Opening, OpeningRef, Wall } from '../types/facade'
import { cloneWall } from '../types/facade'
import { mapAllWalls } from './buildings'
import { snapToGrid } from './grid'
import { STUDIO_MASONRY } from '../studio/constants'
import {
  defaultAwningConfig,
  defaultOpeningAwningWidth,
  normalizeAwningConfig,
  openingSupportsAwning,
} from '../studio/awning'
import { createId } from './id'

export function wallAwnings(wall: Wall): AwningConfig[] {
  return (wall.awnings ?? []).map((item) => normalizeAwningConfig(item))
}

export function findWallAwning(wall: Wall, awningId?: string | null): AwningConfig | undefined {
  if (!awningId) return undefined
  return wallAwnings(wall).find((item) => item.id === awningId)
}

export function defaultWallAwningAnchor(
  wall: Wall,
  widthCm = 192,
  projectionCm = 144,
): { mountX: number; mountY: number } {
  const w = Math.max(48, widthCm)
  const mountX = snapToGrid(Math.max(0, (wall.width - w) / 2), STUDIO_MASONRY)
  const mountY = snapToGrid(
    Math.max(AWNING_MOUNT_MIN_Y, Math.min(wall.height - 24, wall.height * 0.72)),
    STUDIO_MASONRY,
  )
  void projectionCm
  return { mountX, mountY }
}

const AWNING_MOUNT_MIN_Y = 96

export function addWallAwning(
  state: FacadeState,
  wallId: string,
  partial?: Partial<AwningConfig>,
): { state: FacadeState; awningId: string } {
  const awningId = typeof partial?.id === 'string' && partial.id.trim() ? partial.id.trim() : createId()
  const nextState = mapAllWalls(state, (wall) => {
    if (wall.id !== wallId) return cloneWall(wall)
    const widthCm = partial?.widthCm ?? 192
    const anchor = defaultWallAwningAnchor(wall, widthCm, partial?.projectionCm)
    const awning = normalizeAwningConfig({
      ...defaultAwningConfig({
        enabled: true,
        kind: partial?.kind ?? 'foldingArm',
        extension: partial?.extension ?? 0.65,
        ...partial,
        id: awningId,
        mountX: partial?.mountX ?? anchor.mountX,
        mountY: partial?.mountY ?? anchor.mountY,
      }),
      enabled: true,
      id: awningId,
    })
    return {
      ...cloneWall(wall),
      awnings: [...wallAwnings(wall), awning],
    }
  })
  return { state: nextState, awningId }
}

export function updateWallAwning(
  state: FacadeState,
  wallIds: string[],
  patch: Partial<AwningConfig> & {
    motion?: Partial<NonNullable<AwningConfig['motion']>>
  },
  awningId?: string | null,
): FacadeState {
  if (wallIds.length === 0) return state
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const list = wallAwnings(wall)
    if (list.length === 0) return cloneWall(wall)
    const targetId = awningId && list.some((a) => a.id === awningId) ? awningId : list[0]!.id
    return {
      ...cloneWall(wall),
      awnings: list.map((item) => {
        if (item.id !== targetId) return item
        const motion = patch.motion
          ? {
              extend: patch.motion.extend ?? item.motion!.extend,
              retract: patch.motion.retract ?? item.motion!.retract,
            }
          : item.motion
        return normalizeAwningConfig({
          ...item,
          ...patch,
          id: item.id,
          motion,
        })
      }),
    }
  })
}

export function removeWallAwning(
  state: FacadeState,
  wallId: string,
  awningId?: string | null,
): FacadeState {
  return mapAllWalls(state, (wall) => {
    if (wall.id !== wallId) return cloneWall(wall)
    const list = wallAwnings(wall)
    if (list.length === 0) return cloneWall(wall)
    const next = awningId ? list.filter((item) => item.id !== awningId) : list.slice(0, -1)
    return { ...cloneWall(wall), awnings: next }
  })
}

export function updateOpeningAwning(
  state: FacadeState,
  targets: OpeningRef[],
  patch: Partial<AwningConfig> & {
    motion?: Partial<NonNullable<AwningConfig['motion']>>
  },
): FacadeState {
  if (targets.length === 0) return state
  const byWall = new Map<string, Set<string>>()
  for (const target of targets) {
    const set = byWall.get(target.wallId) ?? new Set<string>()
    set.add(target.openingId)
    byWall.set(target.wallId, set)
  }
  return mapAllWalls(state, (wall) => {
    const openingIds = byWall.get(wall.id)
    if (!openingIds) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      openings: wall.openings.map((opening) => {
        if (!openingIds.has(opening.id)) return opening
        if (!openingSupportsAwning(opening)) return opening
        const prev = normalizeAwningConfig(
          opening.awning ??
            defaultAwningConfig({
              enabled: false,
              widthCm: defaultOpeningAwningWidth(opening),
            }),
        )
        const motion = patch.motion
          ? {
              extend: patch.motion.extend ?? prev.motion!.extend,
              retract: patch.motion.retract ?? prev.motion!.retract,
            }
          : prev.motion
        let widthCm = patch.widthCm ?? prev.widthCm
        if (patch.enabled === true && !prev.enabled && patch.widthCm == null) {
          widthCm = defaultOpeningAwningWidth(opening, patch.overhangCm ?? prev.overhangCm)
        }
        if (patch.overhangCm != null && patch.widthCm == null) {
          widthCm = defaultOpeningAwningWidth(opening, patch.overhangCm)
        }
        return {
          ...opening,
          awning: normalizeAwningConfig({
            ...prev,
            ...patch,
            id: prev.id,
            widthCm,
            motion,
          }),
        }
      }),
    }
  })
}

export function ensureOpeningAwning(opening: Opening): AwningConfig {
  return normalizeAwningConfig(
    opening.awning ??
      defaultAwningConfig({
        enabled: false,
        widthCm: defaultOpeningAwningWidth(opening),
      }),
  )
}
