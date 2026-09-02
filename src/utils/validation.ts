import { GRID_SIZE, WALL_WIDTH_PRESETS } from '../constants/presets'
import {
  STUDIO_MIN_SIZE,
  STUDIO_MASONRY,
  STUDIO_WALL_HEIGHT_STEP,
} from '../studio/constants'
import type { Opening, Wall, WallDimensions } from '../types/facade'
import { snapToGrid } from './grid'

/** Mindestabstand zwischen Öffnungen (cm). */
export const OPENING_MIN_GAP = 32

export interface ValidationResult {
  valid: boolean
  message?: string
}

export function openingFitsWall(
  size: { width: number; height: number },
  wall: { width: number; height: number },
): boolean {
  return size.width <= wall.width && size.height <= wall.height
}

/** Öffnung liegt vollständig innerhalb der Wandfläche (kein Überstand). */
export function openingFitsWithinWall(opening: Opening, wall: WallDimensions): boolean {
  return (
    opening.x >= -1e-6 &&
    opening.y >= -1e-6 &&
    opening.width > 0 &&
    opening.height > 0 &&
    opening.x + opening.width <= wall.width + 1e-6 &&
    opening.y + opening.height <= wall.height + 1e-6
  )
}

export function clampOpeningToWall(
  opening: Opening,
  wall: WallDimensions,
  grid?: number,
  opts?: { snapToGrid?: boolean },
): Opening {
  const doSnap = opts?.snapToGrid !== false
  const gridSize = grid ?? GRID_SIZE
  const posGrid = grid === STUDIO_MASONRY ? STUDIO_MASONRY / 2 : gridSize
  const snapped = {
    ...opening,
    x: doSnap ? snapToGrid(opening.x, posGrid) : opening.x,
    y: doSnap ? snapToGrid(opening.y, gridSize) : opening.y,
    width: doSnap
      ? Math.max(gridSize, snapToGrid(opening.width, gridSize))
      : Math.max(gridSize, opening.width),
    height: doSnap
      ? Math.max(gridSize, snapToGrid(opening.height, gridSize))
      : Math.max(gridSize, opening.height),
  }
  const minSize = 8
  const width = Math.max(minSize, Math.min(snapped.width, wall.width))
  const height = Math.max(minSize, Math.min(snapped.height, wall.height))
  // Kein Randabstand zur Wandkante — Öffnungen dürfen bündig an den Rand.
  const minX = 0
  const minY = 0
  const maxX = Math.max(minX, wall.width - width)
  const maxY = Math.max(minY, wall.height - height)
  return {
    ...snapped,
    width,
    height,
    x: Math.max(minX, Math.min(snapped.x, maxX)),
    y: Math.max(minY, Math.min(snapped.y, maxY)),
  }
}

export function validateOpening(
  opening: Opening,
  wall: WallDimensions,
): ValidationResult {
  if (opening.width <= 0 || opening.height <= 0) {
    return { valid: false, message: 'Breite und Höhe müssen größer als 0 sein.' }
  }

  if (opening.width > wall.width || opening.height > wall.height) {
    return { valid: false, message: 'Die Öffnung ist größer als die Wand.' }
  }

  if (opening.x < 0 || opening.y < 0) {
    return { valid: false, message: 'Position darf nicht negativ sein.' }
  }

  if (opening.x + opening.width > wall.width) {
    return { valid: false, message: 'Die Öffnung ragt über die Wandbreite hinaus.' }
  }

  if (opening.y + opening.height > wall.height) {
    return { valid: false, message: 'Die Öffnung ragt über die Wandhöhe hinaus.' }
  }

  return { valid: true }
}

function openingsOverlap(a: Opening, b: Opening): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function validateOpeningPlacement(opening: Opening, wall: Wall): ValidationResult {
  const base = validateOpening(opening, wall)
  if (!base.valid) return base

  if (wall.kind === 'studio') {
    const step = STUDIO_MASONRY
    // Bei Mauerwerk-Fugen-Snap dürfen X/Breite auf echten Cuts liegen (nicht nur 4/8-cm).
    // Höhe/Y bleiben am Schichtraster; Prüfung entfällt ebenfalls, wenn Snap aktiv ist.
    const masonrySnap =
      wall.panel != null &&
      wall.panel.enabled !== false &&
      wall.panel.pattern !== 'none' &&
      wall.panel.pattern !== 'strip' &&
      wall.panel.pattern !== 'wildBond'
    if (!masonrySnap) {
      if (opening.width % step !== 0 || opening.height % step !== 0) {
        return {
          valid: false,
          message: `Maße müssen Vielfache von ${step} cm sein.`,
        }
      }
      const posStep = step / 2
      if (opening.x % posStep !== 0 || opening.y % step !== 0) {
        return {
          valid: false,
          message: `Position muss am ${posStep}-cm-Raster ausgerichtet sein.`,
        }
      }
    }
  }

  const MIN_GAP = OPENING_MIN_GAP
  for (const other of wall.openings) {
    if (other.id === opening.id) continue
    if (openingsOverlap(opening, other)) {
      return { valid: false, message: 'Öffnungen dürfen sich nicht überlappen.' }
    }
    if (openingsTooClose(opening, other, MIN_GAP)) {
      return {
        valid: false,
        message: `Mindestabstand zwischen Öffnungen: ${MIN_GAP} cm.`,
      }
    }
  }

  return { valid: true }
}

/** Gibt true zurück wenn zwei Öffnungen horizontal näher als minGap cm sind (oder überlappen). */
export function openingsTooClose(a: Opening, b: Opening, minGap = OPENING_MIN_GAP): boolean {
  const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width))
  const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height))
  return gapX < minGap && gapY < minGap
}

export function clampWallDimensions(wall: WallDimensions): WallDimensions {
  const nearestWidth = WALL_WIDTH_PRESETS.reduce((closest, preset) =>
    Math.abs(preset - wall.width) < Math.abs(closest - wall.width) ? preset : closest,
  )

  return {
    width: nearestWidth,
    height: Math.max(STUDIO_MIN_SIZE, snapToGrid(wall.height, STUDIO_WALL_HEIGHT_STEP)),
    depth: Math.max(1, wall.depth),
  }
}

export function clampStudioWallDimensions(wall: WallDimensions): WallDimensions {
  return {
    width: Math.max(STUDIO_MIN_SIZE, wall.width),
    height: Math.max(STUDIO_MIN_SIZE, snapToGrid(wall.height, STUDIO_WALL_HEIGHT_STEP)),
    depth: Math.max(1, wall.depth),
  }
}
