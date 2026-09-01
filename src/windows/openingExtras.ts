import * as THREE from 'three'
import type { OpeningGuard, OpeningInteriorShade, SurfaceFinish } from '../types/facade'
import { applySurfaceFinish } from '../utils/threeColors'

export function normalizeOpeningGuard(raw?: OpeningGuard | null): OpeningGuard {
  return {
    enabled: Boolean(raw?.enabled),
    mode: raw?.mode === 'balcony' ? 'balcony' : 'grille',
    barSpacingCm: Math.min(40, Math.max(6, raw?.barSpacingCm ?? 12)),
    heightCm: Math.min(160, Math.max(48, raw?.heightCm ?? 96)),
    color: typeof raw?.color === 'string' && raw.color.trim() ? raw.color.trim() : undefined,
    finish:
      raw?.finish === 'glossy' || raw?.finish === 'metal' || raw?.finish === 'matte'
        ? raw.finish
        : undefined,
  }
}

export function normalizeOpeningInteriorShade(
  raw?: OpeningInteriorShade | null,
): OpeningInteriorShade {
  return {
    enabled: Boolean(raw?.enabled),
    mode: raw?.mode === 'blind' ? 'blind' : 'curtain',
    drop: Math.min(1, Math.max(0, raw?.drop ?? 0)),
    color: typeof raw?.color === 'string' && raw.color.trim() ? raw.color.trim() : undefined,
  }
}

export function normalizeOpeningDoor(raw?: {
  cassetteCount?: number
  handle?: boolean
  letterSlot?: boolean
} | null) {
  const c = raw?.cassetteCount
  return {
    cassetteCount: (c === 1 || c === 2 || c === 3 || c === 4 ? c : 2) as 1 | 2 | 3 | 4,
    handle: raw?.handle !== false,
    letterSlot: Boolean(raw?.letterSlot),
  }
}

/** Stabgitter oder franz. Balkon vor der Öffnung (lokal: Mitte = 0, Y unten = -h/2). */
export function createOpeningGuardMesh(
  width: number,
  height: number,
  guard: OpeningGuard,
  fallbackColor = '#4a4a4a',
): THREE.Group {
  const group = new THREE.Group()
  const color = guard.color ?? fallbackColor
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.45,
    shadowSide: THREE.DoubleSide,
  })
  applySurfaceFinish(mat, guard.finish as SurfaceFinish | undefined)
  const spacing = guard.barSpacingCm ?? 12
  const barR = 0.55
  const railH = guard.mode === 'balcony' ? Math.min(guard.heightCm ?? 96, height) : height
  const y0 = -height / 2
  const y1 = y0 + railH
  const count = Math.max(2, Math.floor(width / spacing) + 1)
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const x = -width / 2 + 2 + t * (width - 4)
    const geo = new THREE.CylinderGeometry(barR, barR, railH, 6)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, (y0 + y1) / 2, 0)
    mesh.castShadow = true
    mesh.receiveShadow = false
    group.add(mesh)
  }
  // Handlauf
  const rail = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 1.4, 1.4), mat)
  rail.position.set(0, y1 - 0.7, 0)
  rail.castShadow = true
  group.add(rail)
  if (guard.mode === 'balcony') {
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(width - 2, 1.2, 1.2), mat)
    bottom.position.set(0, y0 + 1.2, 0)
    group.add(bottom)
  }
  return group
}

/** Vorhang oder Jalousie innen (negatives Z relativ zur Fensterfront). */
export function createInteriorShadeMesh(
  width: number,
  height: number,
  shade: OpeningInteriorShade,
): THREE.Group {
  const group = new THREE.Group()
  const drop = shade.drop
  if (drop < 0.02) return group
  const color = shade.color ?? '#d8cfc4'
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide,
  })
  const coverH = height * drop
  if (shade.mode === 'blind') {
    const slatH = 3.2
    const n = Math.max(1, Math.floor(coverH / (slatH + 0.4)))
    for (let i = 0; i < n; i += 1) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width - 4, slatH * 0.85, 0.4), mat)
      mesh.position.set(0, height / 2 - slatH / 2 - i * (slatH + 0.4), 0)
      mesh.castShadow = false
      group.add(mesh)
    }
  } else {
    // Zwei Vorhangbahnen
    const panelW = (width - 6) / 2
    const left = new THREE.Mesh(new THREE.BoxGeometry(panelW, coverH, 1.2), mat)
    left.position.set(-panelW / 2 - 1, height / 2 - coverH / 2, 0)
    const right = new THREE.Mesh(new THREE.BoxGeometry(panelW, coverH, 1.2), mat)
    right.position.set(panelW / 2 + 1, height / 2 - coverH / 2, 0)
    group.add(left, right)
  }
  return group
}
