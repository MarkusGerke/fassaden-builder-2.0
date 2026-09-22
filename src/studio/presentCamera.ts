import type { Wall } from '../types/facade'
import { buildingWorldBox } from '../utils/sunLighting'

export interface PresentCameraFrame {
  lookX: number
  lookY: number
  lookZ: number
  distance: number
  /** Kamerahöhe über lookY (cm) — Blick leicht nach unten, Dach oben im Bild. */
  cameraElevateCm: number
}

/**
 * Perspektiv-Einpassen wie 2D-Aufriss: Blick auf Gebäudemitte.
 * Mit Dach: `contentMaxY` = First/Firsthöhe; Kamera höher als Fassadenmitte,
 * damit das ganze Dach im Fassadenmodus sichtbar bleibt (v2.0.511).
 */
export function computePresentCameraFrame(args: {
  walls: Wall[]
  yawDeg: number
  fovDeg: number
  aspect: number
  storeyHeight: number
  marginStoreys?: number
  /** Oberkante inkl. Dach (Welt-Y). Default: Wand-AABB. */
  contentMaxY?: number
  /**
   * Kamera über lookY anheben (cm). Default: ~12 % der Bauhöhe, mind. 0,35 Geschoss.
   * `0` = keine Anhebung.
   */
  cameraElevateCm?: number
}): PresentCameraFrame | null {
  const box = buildingWorldBox(args.walls)
  if (box.isEmpty()) return null

  const topY =
    typeof args.contentMaxY === 'number' && Number.isFinite(args.contentMaxY)
      ? Math.max(box.max.y, args.contentMaxY)
      : box.max.y
  const margin = (args.marginStoreys ?? 1) * Math.max(80, args.storeyHeight)
  const lookX = (box.min.x + box.max.x) / 2
  const lookZ = (box.min.z + box.max.z) / 2
  // Vertikale Mitte von Sockel bis First (nicht nur Wandkrone)
  const lookY = (box.min.y + topY) / 2
  const buildingH = Math.max(80, topY - box.min.y)

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

  const defaultElevate = Math.max(args.storeyHeight * 0.35, buildingH * 0.12)
  const cameraElevateCm =
    args.cameraElevateCm === undefined ? defaultElevate : Math.max(0, args.cameraElevateCm)

  return { lookX, lookY, lookZ, distance, cameraElevateCm }
}
