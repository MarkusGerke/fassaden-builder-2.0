import type { Wall } from '../types/facade'
import { isStudioWall, wallEndPoint, wallStartPoint } from './walls'

export const WALL_GUIDE_TOLERANCE = 0.5

export type WallGuideKind =
  | 'startX'
  | 'startZ'
  | 'endX'
  | 'endZ'
  | 'midX'
  | 'midZ'

export type WallGuide = {
  kind: WallGuideKind
  value: number
  orientation: 'vertical' | 'horizontal'
  source: 'self' | 'align'
}

function near(a: number, b: number, tol = WALL_GUIDE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

function segmentOf(wall: Wall): { sx: number; sz: number; ex: number; ez: number; midX: number; midZ: number } {
  const s = wallStartPoint(wall)
  const e = wallEndPoint(wall)
  return {
    sx: s.x,
    sz: s.z,
    ex: e.x,
    ez: e.z,
    midX: (s.x + e.x) / 2,
    midZ: (s.z + e.z) / 2,
  }
}

/** Fang-Toleranz: Hilfslinie erscheint und Endpunkt springt bündig. */
export const WALL_GUIDE_SNAP_CM = 4

type SegRef = { sx: number; sz: number; ex: number; ez: number; midX: number; midZ: number }

function pushAlignGuides(
  push: (guide: WallGuide) => void,
  refs: SegRef[],
  floorWalls: Wall[],
  skipIds: Set<string>,
  tol = WALL_GUIDE_SNAP_CM,
) {
  for (const wall of floorWalls) {
    if (!isStudioWall(wall) || skipIds.has(wall.id)) continue
    const seg = segmentOf(wall)
    for (const ref of refs) {
      if (near(ref.sx, seg.sx, tol) || near(ref.sx, seg.ex, tol)) {
        push({ kind: 'startX', value: near(ref.sx, seg.sx, tol) ? seg.sx : seg.ex, orientation: 'vertical', source: 'align' })
      }
      if (near(ref.ex, seg.sx, tol) || near(ref.ex, seg.ex, tol)) {
        push({ kind: 'endX', value: near(ref.ex, seg.sx, tol) ? seg.sx : seg.ex, orientation: 'vertical', source: 'align' })
      }
      if (near(ref.sz, seg.sz, tol) || near(ref.sz, seg.ez, tol)) {
        push({ kind: 'startZ', value: near(ref.sz, seg.sz, tol) ? seg.sz : seg.ez, orientation: 'horizontal', source: 'align' })
      }
      if (near(ref.ez, seg.sz, tol) || near(ref.ez, seg.ez, tol)) {
        push({ kind: 'endZ', value: near(ref.ez, seg.sz, tol) ? seg.sz : seg.ez, orientation: 'horizontal', source: 'align' })
      }
      if (near(ref.midX, seg.midX, tol) || near(ref.midX, seg.sx, tol) || near(ref.midX, seg.ex, tol)) {
        const target = near(ref.midX, seg.midX, tol)
          ? seg.midX
          : near(ref.midX, seg.sx, tol)
            ? seg.sx
            : seg.ex
        push({ kind: 'midX', value: target, orientation: 'vertical', source: 'align' })
      }
      if (near(ref.midZ, seg.midZ, tol) || near(ref.midZ, seg.sz, tol) || near(ref.midZ, seg.ez, tol)) {
        const target = near(ref.midZ, seg.midZ, tol)
          ? seg.midZ
          : near(ref.midZ, seg.sz, tol)
            ? seg.sz
            : seg.ez
        push({ kind: 'midZ', value: target, orientation: 'horizontal', source: 'align' })
      }
      if (near(ref.sx, seg.midX, tol)) {
        push({ kind: 'startX', value: seg.midX, orientation: 'vertical', source: 'align' })
      }
      if (near(ref.ex, seg.midX, tol)) {
        push({ kind: 'endX', value: seg.midX, orientation: 'vertical', source: 'align' })
      }
      if (near(ref.sz, seg.midZ, tol)) {
        push({ kind: 'startZ', value: seg.midZ, orientation: 'horizontal', source: 'align' })
      }
      if (near(ref.ez, seg.midZ, tol)) {
        push({ kind: 'endZ', value: seg.midZ, orientation: 'horizontal', source: 'align' })
      }
    }
  }
}

/** Hilfslinien für Wand-Enden und Mittelachsen beim Verschieben. */
export function computeWallMoveGuides(activeWalls: Wall[], floorWalls: Wall[]): WallGuide[] {
  const guides: WallGuide[] = []
  const seen = new Set<string>()
  const push = (guide: WallGuide) => {
    const key = `${guide.orientation}:${guide.kind}:${guide.value.toFixed(2)}:${guide.source}`
    if (seen.has(key)) return
    seen.add(key)
    guides.push(guide)
  }

  const activeIds = new Set(activeWalls.map((w) => w.id))
  const refs: SegRef[] = []
  for (const wall of activeWalls) {
    if (!isStudioWall(wall)) continue
    const seg = segmentOf(wall)
    refs.push(seg)
    push({ kind: 'startX', value: seg.sx, orientation: 'vertical', source: 'self' })
    push({ kind: 'startZ', value: seg.sz, orientation: 'horizontal', source: 'self' })
    push({ kind: 'endX', value: seg.ex, orientation: 'vertical', source: 'self' })
    push({ kind: 'endZ', value: seg.ez, orientation: 'horizontal', source: 'self' })
    push({ kind: 'midX', value: seg.midX, orientation: 'vertical', source: 'self' })
    push({ kind: 'midZ', value: seg.midZ, orientation: 'horizontal', source: 'self' })
  }

  pushAlignGuides(push, refs, floorWalls, activeIds)
  return guides
}

/** Hilfslinien für ein freies Segment (Abzweig / Bibliothek-Vorschau). */
export function computeSegmentAlignGuides(
  segments: Array<{ ax: number; az: number; bx: number; bz: number }>,
  floorWalls: Wall[],
  skipWallIds: Iterable<string> = [],
): WallGuide[] {
  const guides: WallGuide[] = []
  const seen = new Set<string>()
  const push = (guide: WallGuide) => {
    const key = `${guide.orientation}:${guide.kind}:${guide.value.toFixed(2)}:${guide.source}`
    if (seen.has(key)) return
    seen.add(key)
    guides.push(guide)
  }
  const refs: SegRef[] = segments.map((s) => ({
    sx: s.ax,
    sz: s.az,
    ex: s.bx,
    ez: s.bz,
    midX: (s.ax + s.bx) / 2,
    midZ: (s.az + s.bz) / 2,
  }))
  for (const seg of refs) {
    push({ kind: 'startX', value: seg.sx, orientation: 'vertical', source: 'self' })
    push({ kind: 'startZ', value: seg.sz, orientation: 'horizontal', source: 'self' })
    push({ kind: 'endX', value: seg.ex, orientation: 'vertical', source: 'self' })
    push({ kind: 'endZ', value: seg.ez, orientation: 'horizontal', source: 'self' })
    push({ kind: 'midX', value: seg.midX, orientation: 'vertical', source: 'self' })
    push({ kind: 'midZ', value: seg.midZ, orientation: 'horizontal', source: 'self' })
  }
  pushAlignGuides(push, refs, floorWalls, new Set(skipWallIds))
  return guides.filter((g) => g.source === 'align')
}

/**
 * Snappt einen freien Endpunkt auf bündige X/Z-Kanten anderer Wände.
 * Gibt den gesnappten Punkt und die aktiven Align-Guides zurück.
 */
export function snapPointToWallEdges(
  point: { x: number; z: number },
  floorWalls: Wall[],
  skipWallIds: Iterable<string> = [],
  tol = WALL_GUIDE_SNAP_CM,
): { point: { x: number; z: number }; guides: WallGuide[] } {
  const skip = new Set(skipWallIds)
  let x = point.x
  let z = point.z
  let bestDx = tol + 1
  let bestDz = tol + 1
  let snapX: number | null = null
  let snapZ: number | null = null
  const guides: WallGuide[] = []
  for (const wall of floorWalls) {
    if (!isStudioWall(wall) || skip.has(wall.id)) continue
    const seg = segmentOf(wall)
    for (const candidate of [seg.sx, seg.ex, seg.midX]) {
      const d = Math.abs(point.x - candidate)
      if (d <= tol && d < bestDx) {
        bestDx = d
        snapX = candidate
      }
    }
    for (const candidate of [seg.sz, seg.ez, seg.midZ]) {
      const d = Math.abs(point.z - candidate)
      if (d <= tol && d < bestDz) {
        bestDz = d
        snapZ = candidate
      }
    }
  }
  if (snapX !== null) {
    x = snapX
    guides.push({ kind: 'endX', value: snapX, orientation: 'vertical', source: 'align' })
  }
  if (snapZ !== null) {
    z = snapZ
    guides.push({ kind: 'endZ', value: snapZ, orientation: 'horizontal', source: 'align' })
  }
  return { point: { x, z }, guides }
}
