import {
  WALL_LENGTH_PRESETS,
  WALL_WITH_OPENING_PRESETS,
  type WallWithOpeningPreset,
} from '../constants/presets'
import { cloneWall, type FacadeState, type Opening, type Wall } from '../types/facade'
import { findBuildingForWall, updateBuilding } from '../utils/buildings'
import { createOpening } from '../utils/openings'
import { STUDIO_MIN_SIZE } from './constants'
import { alignOpeningElementsToWallFront, isStudioWall } from './walls'

export interface WallSegmentBand {
  startCm: number
  lengthCm: number
}

export function wallPresetLengthCm(presetId: string): number | null {
  const lengthPreset = WALL_LENGTH_PRESETS.find((item) => item.id === presetId)
  if (lengthPreset) return lengthPreset.lengthCm
  const withOpening = WALL_WITH_OPENING_PRESETS.find((item) => item.id === presetId)
  return withOpening?.lengthCm ?? null
}

export function wallWithOpeningPreset(presetId: string): WallWithOpeningPreset | undefined {
  return WALL_WITH_OPENING_PRESETS.find((item) => item.id === presetId)
}

/** Teilt die Wand in gleich lange Bänder (letztes ggf. kürzer, min. 48 cm). */
export function inferWallSegmentLayout(wall: Wall, gridCm: number): WallSegmentBand[] {
  const bands: WallSegmentBand[] = []
  if (gridCm <= 0 || wall.width <= 0) return bands
  let start = 0
  while (start < wall.width - 0.5) {
    const remaining = wall.width - start
    if (remaining >= gridCm - 0.5) {
      bands.push({ startCm: start, lengthCm: gridCm })
      start += gridCm
      continue
    }
    if (remaining >= STUDIO_MIN_SIZE - 0.5) {
      bands.push({ startCm: start, lengthCm: remaining })
    }
    break
  }
  return bands
}

export function wallSegmentIndexAt(localX: number, layout: WallSegmentBand[]): number | null {
  for (let i = 0; i < layout.length; i += 1) {
    const band = layout[i]!
    if (localX >= band.startCm - 0.5 && localX < band.startCm + band.lengthCm + 0.5) {
      return i
    }
  }
  return null
}

function openingCenterInBand(opening: Opening, band: WallSegmentBand): boolean {
  const center = opening.x + opening.width / 2
  return center >= band.startCm - 0.5 && center < band.startCm + band.lengthCm + 0.5
}

/**
 * Ersetzt Öffnungen in einem Band — Wandbreite und -id bleiben unverändert (eine Fläche).
 */
export function applyWallPresetToSegment(
  state: FacadeState,
  wallId: string,
  segmentIndex: number,
  presetId: string,
  layout: WallSegmentBand[],
): FacadeState | null {
  const band = layout[segmentIndex]
  if (!band) return null
  const presetLen = wallPresetLengthCm(presetId)
  if (presetLen == null || Math.abs(presetLen - band.lengthCm) > 0.5) return null

  const wall = getWallForSegment(state, wallId)
  if (!wall || !isStudioWall(wall)) return null
  const building = findBuildingForWall(state, wallId)
  if (!building) return null

  const openingPreset = wallWithOpeningPreset(presetId)

  return updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.map((item) => {
      if (item.id !== wallId || !isStudioWall(item)) return cloneWall(item)
      const keptOpenings = item.openings.filter(
        (opening) => !opening.hidden && !openingCenterInBand(opening, band),
      )
      const removedIds = new Set(
        item.openings
          .filter((opening) => openingCenterInBand(opening, band))
          .map((opening) => opening.id),
      )
      let openings = keptOpenings.filter(
        (opening) =>
          !opening.hidden &&
          opening.x >= -0.5 &&
          opening.x + opening.width <= item.width + 0.5,
      )

      if (openingPreset) {
        const ox = band.startCm + (band.lengthCm - openingPreset.opening.width) / 2
        if (ox + openingPreset.opening.width <= item.width + 0.5) {
          openings.push(
            createOpening(
              openingPreset.opening.type,
              openingPreset.opening.width,
              openingPreset.opening.height,
              item,
              { x: ox },
            ),
          )
        }
      }

      openings.sort((a, b) => a.x - b.x)
      return alignOpeningElementsToWallFront({
        ...cloneWall(item),
        openings,
        profiles: item.profiles.filter((profile) => !removedIds.has(profile.openingId)),
      })
    }),
  }))
}

function getWallForSegment(state: FacadeState, wallId: string): Wall | undefined {
  return findBuildingForWall(state, wallId)?.walls.find((wall) => wall.id === wallId)
}
