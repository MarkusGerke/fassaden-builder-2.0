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

/** UI-Höhe in cm, 8-cm-Raster (Mauerwerk). */
export function snapCorniceHeightCm(heightCm: number, step = 8): number {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return step
  return Math.max(step, Math.round(heightCm / step) * step)
}

/** UI-Tiefe in cm, 4-cm-Schritte. */
export function snapCorniceDepthCm(depthCm: number): number {
  if (!Number.isFinite(depthCm) || depthCm <= 0) return 4
  return Math.max(4, Math.round(depthCm / 4) * 4)
}

export function corniceScaleFromHeightCm(
  heightCm: number,
  nativeHeightCm: number,
  step = 8,
): number {
  const snapped = snapCorniceHeightCm(heightCm, step)
  return clampCorniceScale(snapped / Math.max(nativeHeightCm, 1))
}

export function corniceScaleFromDepthCm(depthCm: number, nativeForwardCm: number): number {
  const snapped = snapCorniceDepthCm(depthCm)
  return clampCorniceScale(snapped / Math.max(nativeForwardCm, 1))
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

/**
 * Gesims-Höhe in cm auf alle Zielwände — pro Wand eigener `scale` aus dem
 * jeweiligen Profil-Querschnitt (Etage/Fassade/Typ: gleiche sichtbare cm).
 */
export function updateWallCorniceHeightCm(
  state: FacadeState,
  wallIds: string[],
  heightCm: number,
  nativeHeightForProfile: (profileId: string) => number,
  step = 8,
): FacadeState {
  const ids = new Set(wallIds)
  const snapped = snapCorniceHeightCm(heightCm, step)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const cornice = wallCornice(wall)
    const profileId = cornice.profileId ?? DEFAULT_WALL_CORNICE.profileId
    const scale = clampCorniceScale(snapped / Math.max(nativeHeightForProfile(profileId), 1))
    return {
      ...cloneWall(wall),
      cornice: normalizeWallCornice({ ...cornice, enabled: true, scale }),
    }
  })
}

/** Gesims-Tiefe in cm — pro Wand `sectionScaleForward` aus Profil-Querschnitt. */
export function updateWallCorniceDepthCm(
  state: FacadeState,
  wallIds: string[],
  depthCm: number,
  nativeForwardForProfile: (profileId: string) => number,
): FacadeState {
  const ids = new Set(wallIds)
  const snapped = snapCorniceDepthCm(depthCm)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const cornice = wallCornice(wall)
    const profileId = cornice.profileId ?? DEFAULT_WALL_CORNICE.profileId
    const sectionScaleForward = clampCorniceScale(
      snapped / Math.max(nativeForwardForProfile(profileId), 1),
    )
    return {
      ...cloneWall(wall),
      cornice: normalizeWallCornice({ ...cornice, enabled: true, sectionScaleForward }),
    }
  })
}
