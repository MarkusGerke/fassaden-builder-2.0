import type { FacadeState, OpeningRef, Wall } from '../types/facade'
import { OPENING_DRAG_FLOAT_CM } from '../constants/presets'
import {
  isStudioWall,
  studioFacadeSelectionLocalZ,
  studioWallTransform,
  windowDepthForwardSign,
} from '../studio/walls'
import { findWall } from './buildings'
import { wallTrimBands } from './trimBands'
import { wallLabel } from './wallLabel'

function wallPlacement(wall: Wall) {
  if (isStudioWall(wall)) return studioWallTransform(wall)
  return {
    position: { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, z: 0 },
    rotationY: 0,
  }
}

/** Wand-Lokal → Welt, gleiche Konvention wie `FacadeController.localToWorld`. */
export function wallLocalToWorld(
  wall: Wall,
  localX: number,
  localY: number,
  localZ: number,
): { x: number; y: number; z: number } {
  const transform = wallPlacement(wall)
  const cos = Math.cos(transform.rotationY)
  const sin = Math.sin(transform.rotationY)
  return {
    x: transform.position.x + localX * cos + localZ * sin,
    y: wall.y + wall.height / 2 + localY,
    z: transform.position.z - localX * sin + localZ * cos,
  }
}

export function wallLocalDeltaToWorld(
  wall: Wall,
  localDx: number,
  localDy: number,
  localDz = 0,
): { x: number; y: number; z: number } {
  const from = wallLocalToWorld(wall, 0, 0, 0)
  const to = wallLocalToWorld(wall, localDx, localDy, localDz)
  return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z }
}

export function wallWorldDeltaFromStates(
  base: FacadeState,
  next: FacadeState,
  wallId: string,
): { x: number; y: number; z: number } {
  const from = findWall(base, wallId)
  const to = findWall(next, wallId)
  if (!from || !to) return { x: 0, y: 0, z: 0 }
  const a = wallPlacement(from).position
  const b = wallPlacement(to).position
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
}

/** Lokales Z für Drag-Ghost: Fassadenaußenfläche + Abstand (wie Auswahl-Overlay). */
export function openingDragFloatLocalZ(wall: Wall): number {
  if (isStudioWall(wall)) {
    return studioFacadeSelectionLocalZ(wall, OPENING_DRAG_FLOAT_CM)
  }
  return wall.depth + OPENING_DRAG_FLOAT_CM * windowDepthForwardSign(wall)
}

export function openingWorldDeltaFromStates(
  base: FacadeState,
  next: FacadeState,
  ref: OpeningRef,
): { x: number; y: number; z: number } {
  const fromWall = findWall(base, ref.wallId)
  const toWall = findWall(next, ref.wallId)
  const from = fromWall?.openings.find((item) => item.id === ref.openingId)
  const to = toWall?.openings.find((item) => item.id === ref.openingId)
  if (!fromWall || !toWall || !from || !to) return { x: 0, y: 0, z: 0 }
  return wallLocalDeltaToWorld(toWall, to.x - from.x, to.y - from.y)
}

export function trimBandWorldDeltaFromStates(
  base: FacadeState,
  next: FacadeState,
  wallId: string,
  bandId: string,
): { x: number; y: number; z: number } {
  const fromWall = findWall(base, wallId)
  const toWall = findWall(next, wallId)
  if (!fromWall || !toWall) return { x: 0, y: 0, z: 0 }
  const from = wallTrimBands(fromWall).find((band) => band.id === bandId)
  const to = wallTrimBands(toWall).find((band) => band.id === bandId)
  if (!from || !to) return { x: 0, y: 0, z: 0 }
  return wallLocalDeltaToWorld(toWall, 0, to.yFromBottom - from.yFromBottom)
}

export function labelWorldDeltaFromStates(
  base: FacadeState,
  next: FacadeState,
  wallId: string,
): { x: number; y: number; z: number } {
  const fromWall = findWall(base, wallId)
  const toWall = findWall(next, wallId)
  if (!fromWall || !toWall) return { x: 0, y: 0, z: 0 }
  const from = wallLabel(fromWall)
  const to = wallLabel(toWall)
  return wallLocalDeltaToWorld(toWall, (to.x ?? 0) - (from.x ?? 0), (to.y ?? 0) - (from.y ?? 0))
}
