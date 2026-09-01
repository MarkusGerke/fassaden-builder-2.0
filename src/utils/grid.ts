import type { Opening } from '../types/facade'
import { GRID_SIZE } from '../constants/presets'

export function snapToGrid(value: number, grid = GRID_SIZE): number {
  return Math.round(value / grid) * grid
}

/** 8-Richtungs-Snap (0°, 45°, 90°, …) für Boden-Versatz in cm. */
export function snapDelta8Way(
  dx: number,
  dz: number,
  step: number,
  snap = true,
): { dx: number; dz: number } {
  const dist = Math.hypot(dx, dz)
  if (dist < 0.5) return { dx: 0, dz: 0 }
  if (!snap) return { dx, dz }
  const snappedDist = Math.round(dist / step) * step
  if (snappedDist === 0) return { dx: 0, dz: 0 }
  const angle = Math.atan2(dz, dx)
  const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
  return {
    dx: Math.cos(snapAngle) * snappedDist,
    dz: Math.sin(snapAngle) * snappedDist,
  }
}

export function snapOpening(opening: Opening, grid = GRID_SIZE): Opening {
  return {
    ...opening,
    x: snapToGrid(opening.x, grid),
    y: snapToGrid(opening.y, grid),
    width: Math.max(grid, snapToGrid(opening.width, grid)),
    height: Math.max(grid, snapToGrid(opening.height, grid)),
  }
}
