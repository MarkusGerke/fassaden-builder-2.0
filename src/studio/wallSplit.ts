/**
 * Wandsegment aus bestehender Wand herauslösen („Wände“-Bibliothek ohne Auswahl):
 * Hover zeigt ein Segment gewählter Breite auf der Wand (Raster entlang der Wand),
 * Klick teilt die Wand — auf allen Etagen mit gleichem Fußabdruck — in
 * `links | Segment | rechts`. Öffnungen bleiben an Ort und Stelle.
 *
 * Doku: docs/ux.md („Wandsegment herauslösen“).
 */
import type { FacadeState, Wall } from '../types/facade'
import { findBuildingForWall, updateBuilding } from '../utils/buildings'
import { STUDIO_WALL_WIDTH_STEP, wallWidthStepCm } from './constants'
import { findVerticalAlignedWalls, isStudioWall, splitStudioWallAt } from './walls'

export interface WallSplitRange {
  /** Segmentanfang vom Wandstart (cm). */
  startCm: number
  /** Segmentende vom Wandstart (cm). */
  endCm: number
}

const EPS = 0.5

/**
 * Segment der Breite `segmentCm` um die Hover-Position `localX` (cm vom Wandstart),
 * auf das Richtungs-Raster gerastet und in die Wand geklemmt.
 * `null`, wenn das Segment nicht in die Wand passt.
 */
export function wallSplitRangeAt(wall: Wall, localX: number, segmentCm: number): WallSplitRange | null {
  if (!isStudioWall(wall) || !(segmentCm > 0) || !Number.isFinite(localX)) return null
  const step = wallWidthStepCm(wall.yawDeg ?? 0)
  if (segmentCm > wall.width + EPS) return null
  const maxStart = wall.width - segmentCm
  let start = Math.round((localX - segmentCm / 2) / step) * step
  if (start > maxStart) start = Math.floor(maxStart / step) * step
  if (start < 0) start = 0
  if (start > maxStart + EPS) start = maxStart
  return { startCm: start, endCm: start + segmentCm }
}

/**
 * Teilt eine Wand in bis zu drei kollineare Stücke; das mittlere ist `[startCm, endCm]`.
 * Gibt `null` zurück, wenn nichts zu teilen ist (Segment = ganze Wand) oder ein Reststück
 * kürzer als ein Rasterschritt würde bzw. die Wand geschützt ist (Erker/Endstück).
 */
export function splitStudioWallRange(
  wall: Wall,
  range: WallSplitRange,
): { parts: Wall[]; middleId: string } | null {
  if (!isStudioWall(wall)) return null
  const startCm = Math.max(0, Math.min(range.startCm, wall.width))
  const endCm = Math.max(0, Math.min(range.endCm, wall.width))
  if (endCm - startCm < STUDIO_WALL_WIDTH_STEP - EPS) return null
  const atStart = startCm <= EPS
  const atEnd = wall.width - endCm <= EPS
  if (atStart && atEnd) return null
  if (atStart) {
    const parts = splitStudioWallAt(wall, endCm)
    return parts ? { parts: [parts[0], parts[1]], middleId: parts[0].id } : null
  }
  if (atEnd) {
    const parts = splitStudioWallAt(wall, startCm)
    return parts ? { parts: [parts[0], parts[1]], middleId: parts[1].id } : null
  }
  const first = splitStudioWallAt(wall, startCm)
  if (!first) return null
  const second = splitStudioWallAt(first[1], endCm - startCm)
  if (!second) return null
  return { parts: [first[0], second[0], second[1]], middleId: second[0].id }
}

function yawDeltaAbs(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360
  return Math.min(d, 360 - d)
}

/**
 * Wand plus alle Etagen mit gleichem Fußabdruck (gleicher Ursprung, gleiche Richtung).
 * Die Seed-Wand steht vorne.
 */
export function wallSplitStack(wall: Wall, walls: Wall[], wallHeight: number): Wall[] {
  const yaw = wall.yawDeg ?? 0
  const others = findVerticalAlignedWalls(wall, walls, wallHeight).filter(
    (other) => yawDeltaAbs(yaw, other.yawDeg ?? 0) <= 2,
  )
  return [wall, ...others]
}

export interface WallStackSplitResult {
  state: FacadeState
  /** Mittelstück der Seed-Wand (zum Auswählen). */
  middleId: string
  /** Mittelstücke aller geteilten Etagen (Seed zuerst). */
  middleIds: string[]
}

/**
 * Teilt `wallId` und alle Etagen mit gleichem Fußabdruck am selben Segment.
 * Etagen, in die das Segment nicht passt (schmalere Wand), bleiben unverändert.
 * `null`, wenn die Seed-Wand selbst nicht geteilt werden kann.
 */
export function splitWallStackRange(
  state: FacadeState,
  wallId: string,
  range: WallSplitRange,
): WallStackSplitResult | null {
  const building = findBuildingForWall(state, wallId)
  const seed = building?.walls.find((item) => item.id === wallId)
  if (!building || !seed || !isStudioWall(seed)) return null
  const seedSplit = splitStudioWallRange(seed, range)
  if (!seedSplit) return null

  const replacements = new Map<string, Wall[]>([[seed.id, seedSplit.parts]])
  const middleIds = [seedSplit.middleId]
  for (const other of wallSplitStack(seed, building.walls, building.wallHeight).slice(1)) {
    const split = splitStudioWallRange(other, range)
    if (!split) continue
    replacements.set(other.id, split.parts)
    middleIds.push(split.middleId)
  }

  const next = updateBuilding(state, building.id, (b) => ({
    ...b,
    walls: b.walls.flatMap((item) => replacements.get(item.id) ?? [item]),
  }))
  return { state: next, middleId: seedSplit.middleId, middleIds }
}
