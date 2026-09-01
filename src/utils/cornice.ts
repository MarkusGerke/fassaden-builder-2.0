import type { CorniceEdge, FacadeState, Wall, WallCorniceConfig } from '../types/facade'
import { cloneWall } from '../types/facade'
import { mapAllWalls } from './buildings'
import { canonicalProfileId } from '../profiles/registry'
import { DEFAULT_CORNICE_PROFILE_ID } from '../profiles/windowTrim'

export const DEFAULT_WALL_CORNICE: Required<Omit<WallCorniceConfig, 'color' | 'finish'>> & {
  color?: string
  finish?: WallCorniceConfig['finish']
} = {
  enabled: false,
  edge: 'top',
  scale: 1,
  profileId: DEFAULT_CORNICE_PROFILE_ID,
  rotationDeg: 0,
  flipOutward: false,
  flipForward: false,
  offsetForward: 0,
  sectionScaleForward: 1,
}

export const CORNICE_SCALE_MIN = 0.25
/** Soft-Obergrenze — kein hartes Nutzer-Maximum. */
export const CORNICE_SCALE_MAX = 10_000

export function clampCorniceScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_WALL_CORNICE.scale
  return Math.min(CORNICE_SCALE_MAX, Math.max(CORNICE_SCALE_MIN, value))
}

function clampRotationDeg(value: number): number {
  if (!Number.isFinite(value)) return 0
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360
}

export function normalizeWallCornice(raw?: WallCorniceConfig): WallCorniceConfig {
  return {
    enabled: Boolean(raw?.enabled),
    edge: 'top',
    scale: clampCorniceScale(raw?.scale ?? DEFAULT_WALL_CORNICE.scale),
    profileId: canonicalProfileId(raw?.profileId || DEFAULT_WALL_CORNICE.profileId),
    color: raw?.color,
    finish:
      raw?.finish === 'glossy' || raw?.finish === 'metal' || raw?.finish === 'matte'
        ? raw.finish
        : undefined,
    rotationDeg: clampRotationDeg(raw?.rotationDeg ?? 0),
    flipOutward: Boolean(raw?.flipOutward),
    flipForward: Boolean(raw?.flipForward),
    offsetForward: Number.isFinite(raw?.offsetForward) ? Number(raw?.offsetForward) : 0,
    sectionScaleForward: Number.isFinite(raw?.sectionScaleForward)
      ? clampCorniceScale(Number(raw?.sectionScaleForward))
      : undefined,
  }
}

export function wallCornice(wall: Wall): WallCorniceConfig {
  return normalizeWallCornice(wall.cornice)
}

export function wallHasCornice(wall: Wall, edge?: CorniceEdge): boolean {
  const cornice = wallCornice(wall)
  if (!cornice.enabled) return false
  if (edge && cornice.edge !== edge) return false
  return true
}

export function updateWallCornice(
  state: FacadeState,
  wallIds: string[],
  patch: Partial<WallCorniceConfig>,
): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    return {
      ...cloneWall(wall),
      cornice: normalizeWallCornice({ ...wallCornice(wall), ...patch }),
    }
  })
}
