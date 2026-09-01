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
  const refs: Array<{ sx: number; sz: number; ex: number; ez: number; midX: number; midZ: number }> = []
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

  for (const wall of floorWalls) {
    if (!isStudioWall(wall) || activeIds.has(wall.id)) continue
    const seg = segmentOf(wall)
    for (const ref of refs) {
      if (near(ref.sx, seg.sx)) push({ kind: 'startX', value: ref.sx, orientation: 'vertical', source: 'align' })
      if (near(ref.sx, seg.ex)) push({ kind: 'startX', value: ref.sx, orientation: 'vertical', source: 'align' })
      if (near(ref.ex, seg.sx)) push({ kind: 'endX', value: ref.ex, orientation: 'vertical', source: 'align' })
      if (near(ref.ex, seg.ex)) push({ kind: 'endX', value: ref.ex, orientation: 'vertical', source: 'align' })
      if (near(ref.sz, seg.sz)) push({ kind: 'startZ', value: ref.sz, orientation: 'horizontal', source: 'align' })
      if (near(ref.sz, seg.ez)) push({ kind: 'startZ', value: ref.sz, orientation: 'horizontal', source: 'align' })
      if (near(ref.ez, seg.sz)) push({ kind: 'endZ', value: ref.ez, orientation: 'horizontal', source: 'align' })
      if (near(ref.ez, seg.ez)) push({ kind: 'endZ', value: ref.ez, orientation: 'horizontal', source: 'align' })
      if (near(ref.midX, seg.midX)) push({ kind: 'midX', value: ref.midX, orientation: 'vertical', source: 'align' })
      if (near(ref.midZ, seg.midZ)) push({ kind: 'midZ', value: ref.midZ, orientation: 'horizontal', source: 'align' })
    }
  }
  return guides
}
