import type { FacadeState, Wall, WallTrimBand } from '../types/facade'
import { cloneWall } from '../types/facade'
import type { EditScope } from '../studio/editScope'
import { STUDIO_HALF, STUDIO_MASONRY } from '../studio/constants'
import { mapAllWalls } from './buildings'
import { getWall } from './walls'
import { canonicalProfileId } from '../profiles/registry'
import { DEFAULT_CORNICE_PROFILE_ID } from '../profiles/windowTrim'
import { clampCorniceScale } from './cornice'
import { createId } from './id'

/** Vertikaler Abstand beim Duplizieren eines Zierbands (cm). */
export const TRIM_BAND_DUPLICATE_OFFSET = STUDIO_HALF

/** Default-Höhe: Wandmitte, auf 8-cm-Raster. */
export function defaultTrimBandY(wallHeight: number): number {
  if (!Number.isFinite(wallHeight) || wallHeight <= 0) return STUDIO_MASONRY * 4
  const mid = wallHeight / 2
  return Math.max(0, Math.round(mid / STUDIO_MASONRY) * STUDIO_MASONRY)
}

export function normalizeWallTrimBand(raw: Partial<WallTrimBand> & { id?: string }): WallTrimBand {
  const fallbackY = STUDIO_MASONRY * 4
  const yRaw = Number(raw.yFromBottom ?? fallbackY)
  const yFromBottom = Math.max(
    0,
    Math.round((Number.isFinite(yRaw) ? yRaw : fallbackY) / STUDIO_MASONRY) * STUDIO_MASONRY,
  )
  return {
    id: raw.id ?? createId(),
    enabled: raw.enabled !== false,
    yFromBottom,
    profileId: canonicalProfileId(raw.profileId || DEFAULT_CORNICE_PROFILE_ID),
    scale: clampCorniceScale(raw.scale ?? 1),
    sectionScaleForward: clampCorniceScale(raw.sectionScaleForward ?? raw.scale ?? 1),
    color: raw.color,
    rotationDeg: raw.rotationDeg ?? 0,
    flipOutward: Boolean(raw.flipOutward),
    flipForward: Boolean(raw.flipForward),
    offsetForward: Number.isFinite(raw.offsetForward) ? Number(raw.offsetForward) : 0,
  }
}

export function wallTrimBands(wall: Wall): WallTrimBand[] {
  return (wall.trimBands ?? []).map((band) => normalizeWallTrimBand(band))
}

export function wallHasTrimBands(wall: Wall): boolean {
  return wallTrimBands(wall).some((band) => band.enabled !== false)
}

function resolveBandIndex(
  bands: WallTrimBand[],
  bandId: string,
  anchorIndex: number,
  anchorY: number | undefined,
  scope: EditScope,
): number {
  if (scope === 'element') {
    return bands.findIndex((band) => band.id === bandId)
  }
  if (anchorIndex >= 0 && anchorIndex < bands.length) return anchorIndex
  if (anchorY !== undefined) {
    const byY = bands.findIndex((band) => band.yFromBottom === anchorY)
    if (byY >= 0) return byY
  }
  return bands.findIndex((band) => band.id === bandId)
}

export function updateWallTrimBands(
  state: FacadeState,
  wallIds: string[],
  bands: WallTrimBand[],
): FacadeState {
  const ids = new Set(wallIds)
  const normalized = bands.map((band) => normalizeWallTrimBand(band))
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    return { ...cloneWall(wall), trimBands: normalized }
  })
}

export function addWallTrimBand(state: FacadeState, wallIds: string[]): FacadeState {
  const ids = new Set(wallIds)
  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const next = [
      ...wallTrimBands(wall),
      normalizeWallTrimBand({ yFromBottom: defaultTrimBandY(wall.height) }),
    ]
    return { ...cloneWall(wall), trimBands: next }
  })
}

export function patchWallTrimBand(
  state: FacadeState,
  wallIds: string[],
  bandId: string,
  patch: Partial<WallTrimBand>,
  opts?: { anchorWallId?: string; scope?: EditScope },
): FacadeState {
  const ids = new Set(wallIds)
  const scope = opts?.scope ?? 'element'
  const anchor = opts?.anchorWallId ? getWall(state, opts.anchorWallId) : undefined
  const anchorBands = anchor ? wallTrimBands(anchor) : []
  const anchorIndex = anchorBands.findIndex((band) => band.id === bandId)
  const anchorY = anchorIndex >= 0 ? anchorBands[anchorIndex]!.yFromBottom : undefined

  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const bands = wallTrimBands(wall)
    const idx = resolveBandIndex(bands, bandId, anchorIndex, anchorY, scope)
    if (idx < 0) return cloneWall(wall)
    const next = bands.map((band, i) =>
      i === idx ? normalizeWallTrimBand({ ...band, ...patch, id: band.id }) : band,
    )
    return { ...cloneWall(wall), trimBands: next }
  })
}

export function removeWallTrimBand(
  state: FacadeState,
  wallIds: string[],
  bandId: string,
  opts?: { anchorWallId?: string; scope?: EditScope },
): FacadeState {
  const ids = new Set(wallIds)
  const scope = opts?.scope ?? 'element'
  const anchor = opts?.anchorWallId ? getWall(state, opts.anchorWallId) : undefined
  const anchorBands = anchor ? wallTrimBands(anchor) : []
  const anchorIndex = anchorBands.findIndex((band) => band.id === bandId)
  const anchorY = anchorIndex >= 0 ? anchorBands[anchorIndex]!.yFromBottom : undefined

  return mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const bands = wallTrimBands(wall)
    const idx = resolveBandIndex(bands, bandId, anchorIndex, anchorY, scope)
    if (idx < 0) return cloneWall(wall)
    const next = bands.filter((_, i) => i !== idx)
    return { ...cloneWall(wall), trimBands: next.length > 0 ? next : undefined }
  })
}

/**
 * Dupliziert ein Zierband mit gleichem Stil; Y ± `TRIM_BAND_DUPLICATE_OFFSET` (16 cm), 8-cm-Raster.
 */
export function duplicateWallTrimBand(
  state: FacadeState,
  wallIds: string[],
  bandId: string,
  direction: 'up' | 'down',
  opts?: { anchorWallId?: string; scope?: EditScope },
): { state: FacadeState; newBandId?: string } {
  const ids = new Set(wallIds)
  const scope = opts?.scope ?? 'element'
  const anchor = opts?.anchorWallId ? getWall(state, opts.anchorWallId) : undefined
  const anchorBands = anchor ? wallTrimBands(anchor) : []
  const anchorIndex = anchorBands.findIndex((band) => band.id === bandId)
  const anchorY = anchorIndex >= 0 ? anchorBands[anchorIndex]!.yFromBottom : undefined
  const dy = direction === 'up' ? TRIM_BAND_DUPLICATE_OFFSET : -TRIM_BAND_DUPLICATE_OFFSET
  let newBandId: string | undefined

  const nextState = mapAllWalls(state, (wall) => {
    if (!ids.has(wall.id)) return cloneWall(wall)
    const bands = wallTrimBands(wall)
    const idx = resolveBandIndex(bands, bandId, anchorIndex, anchorY, scope)
    if (idx < 0) return cloneWall(wall)
    const source = bands[idx]!
    const yFromBottom = Math.max(
      0,
      Math.min(
        wall.height,
        Math.round((source.yFromBottom + dy) / STUDIO_MASONRY) * STUDIO_MASONRY,
      ),
    )
    const clone = normalizeWallTrimBand({
      ...source,
      id: createId(),
      yFromBottom,
    })
    if (wall.id === (opts?.anchorWallId ?? wallIds[0])) newBandId = clone.id
    return { ...cloneWall(wall), trimBands: [...bands, clone] }
  })

  return { state: nextState, newBandId }
}
