import type { Wall } from '../types/facade'
import { buildingWorldBox } from '../utils/sunLighting'

export interface PresentCameraFrame {
  lookX: number
  lookY: number
  lookZ: number
  distance: number
}

/**
 * Perspektiv-Einpassen wie 2D-Aufriss: Blick auf Gebäudemitte, Augenhöhe = vertikale Mitte,
 * Randabstand mindestens eine Geschosshöhe (in Welt-cm).
 */
export function computePresentCameraFrame(args: {
  walls: Wall[]
  yawDeg: number
  fovDeg: number
  aspect: number
  storeyHeight: number
  marginStoreys?: number
}): PresentCameraFrame | null {
  const box = buildingWorldBox(args.walls)
  if (box.isEmpty()) return null

  const margin = (args.marginStoreys ?? 1) * Math.max(80, args.storeyHeight)
  const lookX = (box.min.x + box.max.x) / 2
  const lookZ = (box.min.z + box.max.z) / 2
  const lookY = (box.min.y + box.max.y) / 2
  const buildingH = Math.max(80, box.max.y - box.min.y)

  const yawRad = (args.yawDeg * Math.PI) / 180
  const rightX = Math.cos(yawRad)
  const rightZ = -Math.sin(yawRad)

  const corners: [number, number][] = [
    [box.min.x, box.min.z],
    [box.min.x, box.max.z],
    [box.max.x, box.min.z],
    [box.max.x, box.max.z],
  ]
  let minRight = Infinity
  let maxRight = -Infinity
  for (const [x, z] of corners) {
    const r = x * rightX + z * rightZ
    minRight = Math.min(minRight, r)
    maxRight = Math.max(maxRight, r)
  }
  const buildingW = Math.max(80, maxRight - minRight)

  const vFovRad = (args.fovDeg * Math.PI) / 180
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * Math.max(1e-6, args.aspect))

  const distForH = (buildingH + 2 * margin) / (2 * Math.tan(vFovRad / 2))
  const distForW = (buildingW + 2 * margin) / (2 * Math.tan(hFovRad / 2))
  const distance = Math.max(distForH, distForW, 200)

  return { lookX, lookY, lookZ, distance }
}
