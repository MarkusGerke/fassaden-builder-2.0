import type { Building } from '../types/facade'
import { PLAN_GRID } from './constants'
import { planGridBoundsForBuilding } from '../utils/buildings'

export const BUILDING_GUIDE_TOLERANCE = 0.5

export type BuildingGuideKind =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'midX'
  | 'midZ'

export type BuildingGuide = {
  kind: BuildingGuideKind
  value: number
  orientation: 'vertical' | 'horizontal'
  source: 'self' | 'align'
}

type Bounds = { minGx: number; maxGx: number; minGz: number; maxGz: number }

function boundsWorld(bounds: Bounds): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  midX: number
  midZ: number
} {
  const minX = bounds.minGx * PLAN_GRID
  const maxX = bounds.maxGx * PLAN_GRID
  const minZ = bounds.minGz * PLAN_GRID
  const maxZ = bounds.maxGz * PLAN_GRID
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    midX: (minX + maxX) / 2,
    midZ: (minZ + maxZ) / 2,
  }
}

function near(a: number, b: number, tol = BUILDING_GUIDE_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

export function collectBuildingGuides(
  buildings: Building[],
  draggedBuildingId: string,
  previewBounds: Bounds,
): BuildingGuide[] {
  const guides: BuildingGuide[] = []
  const self = boundsWorld(previewBounds)

  guides.push(
    { kind: 'left', value: self.minX, orientation: 'vertical', source: 'self' },
    { kind: 'right', value: self.maxX, orientation: 'vertical', source: 'self' },
    { kind: 'midX', value: self.midX, orientation: 'vertical', source: 'self' },
    { kind: 'top', value: self.minZ, orientation: 'horizontal', source: 'self' },
    { kind: 'bottom', value: self.maxZ, orientation: 'horizontal', source: 'self' },
    { kind: 'midZ', value: self.midZ, orientation: 'horizontal', source: 'self' },
  )

  for (const building of buildings) {
    if (building.hidden || building.id === draggedBuildingId) continue
    const bounds = planGridBoundsForBuilding(building)
    if (!bounds) continue
    const other = boundsWorld(bounds)
    const candidates: BuildingGuide[] = [
      { kind: 'left', value: other.minX, orientation: 'vertical', source: 'align' },
      { kind: 'right', value: other.maxX, orientation: 'vertical', source: 'align' },
      { kind: 'midX', value: other.midX, orientation: 'vertical', source: 'align' },
      { kind: 'top', value: other.minZ, orientation: 'horizontal', source: 'align' },
      { kind: 'bottom', value: other.maxZ, orientation: 'horizontal', source: 'align' },
      { kind: 'midZ', value: other.midZ, orientation: 'horizontal', source: 'align' },
    ]
    for (const guide of candidates) {
      const selfVal =
        guide.orientation === 'vertical'
          ? guide.kind === 'left'
            ? self.minX
            : guide.kind === 'right'
              ? self.maxX
              : self.midX
          : guide.kind === 'top'
            ? self.minZ
            : guide.kind === 'bottom'
              ? self.maxZ
              : self.midZ
      if (near(selfVal, guide.value)) guides.push(guide)
    }
  }

  return guides
}

export function snapBuildingOffset(
  startBounds: Bounds,
  dgx: number,
  dgz: number,
  guides: BuildingGuide[],
): { dgx: number; dgz: number } {
  let snapDgx = dgx
  let snapDgz = dgz
  const preview: Bounds = {
    minGx: startBounds.minGx + dgx,
    maxGx: startBounds.maxGx + dgx,
    minGz: startBounds.minGz + dgz,
    maxGz: startBounds.maxGz + dgz,
  }
  const self = boundsWorld(preview)

  for (const guide of guides) {
    if (guide.source !== 'align') continue
    if (guide.orientation === 'vertical') {
      for (const val of [self.minX, self.maxX, self.midX]) {
        if (near(val, guide.value)) {
          snapDgx += Math.round((guide.value - val) / PLAN_GRID)
        }
      }
    } else {
      for (const val of [self.minZ, self.maxZ, self.midZ]) {
        if (near(val, guide.value)) {
          snapDgz += Math.round((guide.value - val) / PLAN_GRID)
        }
      }
    }
  }

  return { dgx: snapDgx, dgz: snapDgz }
}

/**
 * Hilfslinien, sobald der Zeichen-Cursor (oder ein verschobenes Ende)
 * mit vorhandenen Knoten/Wandenden in X oder Z bündig ist.
 */
export function collectPlanDrawGuides(
  preview: { x: number; z: number },
  references: Array<{ x: number; z: number }>,
  ignore?: { x: number; z: number },
): BuildingGuide[] {
  const guides: BuildingGuide[] = []
  const seen = new Set<string>()
  const push = (guide: BuildingGuide) => {
    const key = `${guide.orientation}:${guide.value.toFixed(2)}`
    if (seen.has(key)) return
    seen.add(key)
    guides.push(guide)
  }
  for (const ref of references) {
    if (
      ignore &&
      Math.abs(ref.x - ignore.x) <= BUILDING_GUIDE_TOLERANCE &&
      Math.abs(ref.z - ignore.z) <= BUILDING_GUIDE_TOLERANCE
    ) {
      continue
    }
    if (near(preview.x, ref.x)) {
      push({ kind: 'midX', value: ref.x, orientation: 'vertical', source: 'align' })
    }
    if (near(preview.z, ref.z)) {
      push({ kind: 'midZ', value: ref.z, orientation: 'horizontal', source: 'align' })
    }
  }
  return guides
}
