import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Opening, Wall } from '../types/facade'
import { isStudioWall, studioWindowDepthForwardSign } from './walls'

export function basementWindowEnabled(opening: Opening): boolean {
  return opening.type === 'window' && Boolean(opening.basementWindow?.enabled)
}

export function basementWindowGrilleHeight(opening: Opening): number {
  const ratio = Math.max(0.25, Math.min(0.85, opening.basementWindow?.grilleHeight ?? 0.5))
  return opening.height * ratio
}

export function createBasementGrilleGeometry(
  wall: Wall,
  opening: Opening,
): THREE.BufferGeometry | null {
  if (!basementWindowEnabled(opening)) return null

  const widthInset = Math.max(4, Math.min(8, opening.width * 0.08))
  const topInset = 4
  const bottomInset = 3
  const grilleHeight = Math.max(12, basementWindowGrilleHeight(opening) - topInset - bottomInset)
  const clearWidth = Math.max(12, opening.width - widthInset * 2)
  const bar = Math.max(1.2, Math.min(2, opening.width * 0.03))
  const horizontalBar = Math.max(1.2, bar * 0.9)
  const verticalCount = clearWidth >= 28 ? 3 : 2
  const horizontalCount = grilleHeight >= 24 ? 2 : 1

  const xMin = opening.x + widthInset - wall.width / 2
  const yMin = opening.y + bottomInset - wall.height / 2
  const zCenter = (wall.panelFlip ?? false ? 0 : wall.depth) + studioWindowDepthForwardSign(wall) * 1.2
  const depth = 1.4
  const parts: THREE.BufferGeometry[] = []

  const verticalSpan = verticalCount > 1 ? clearWidth / (verticalCount - 1) : 0
  for (let i = 0; i < verticalCount; i += 1) {
    const x = xMin + i * verticalSpan
    const geom = new THREE.BoxGeometry(bar, grilleHeight, depth)
    geom.translate(x, yMin + grilleHeight / 2, zCenter)
    parts.push(geom)
  }

  const horizontalSpan = horizontalCount > 1 ? grilleHeight / (horizontalCount - 1) : 0
  for (let i = 0; i < horizontalCount; i += 1) {
    const y = yMin + i * horizontalSpan
    const geom = new THREE.BoxGeometry(clearWidth + bar, horizontalBar, depth)
    geom.translate(xMin + clearWidth / 2, y, zCenter)
    parts.push(geom)
  }

  if (isStudioWall(wall) && parts.length === 0) return null
  return parts.length > 0 ? mergeGeometries(parts, false) : null
}
