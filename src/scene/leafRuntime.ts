/**
 * Runtime-Meshes und leichter Cursor-Wind für Bodenlaub.
 */
import * as THREE from 'three'
import type { GroundLeaf } from './groundLeaves'
import { LEAF_Y_CM, normalizeGroundLeaves } from './groundLeaves'
import { getLeafGeometries } from './leafShapes'

export const LEAF_WIND_RADIUS_CM = 100
export const LEAF_WIND_STRENGTH = 2.8
export const LEAF_WIND_DAMPING = 0.88
export const LEAF_WIND_MAX_SPEED = 90
export const LEAF_SPIN_FACTOR = 0.35

export interface LeafWindSample {
  /** siteOffset-Lokal XZ. */
  x: number
  z: number
  /** Windrichtung / Cursor-Geschwindigkeit (cm/s). */
  vx: number
  vz: number
  active: boolean
}

interface LeafEntry {
  mesh: THREE.Mesh
  leaf: GroundLeaf
  vx: number
  vz: number
  spin: number
}

const sharedMaterials = new Map<string, THREE.MeshStandardMaterial>()

function materialForColor(hex: string): THREE.MeshStandardMaterial {
  let mat = sharedMaterials.get(hex)
  if (mat) return mat
  mat = new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  })
  sharedMaterials.set(hex, mat)
  return mat
}

export class LeafRuntime {
  readonly root = new THREE.Group()
  private readonly entries = new Map<string, LeafEntry>()

  constructor() {
    this.root.name = 'leafRuntime'
  }

  sync(leaves: GroundLeaf[]): void {
    const list = normalizeGroundLeaves(leaves)
    const ids = new Set(list.map((l) => l.id))
    for (const id of [...this.entries.keys()]) {
      if (ids.has(id)) continue
      this.disposeEntry(id)
    }
    const geos = getLeafGeometries()
    for (const leaf of list) {
      let entry = this.entries.get(leaf.id)
      if (!entry) {
        const geo = geos[leaf.shape] ?? geos[0]!
        const mesh = new THREE.Mesh(geo, materialForColor(leaf.color))
        mesh.castShadow = false
        mesh.receiveShadow = true
        mesh.frustumCulled = true
        mesh.userData.groundLeafId = leaf.id
        this.root.add(mesh)
        entry = { mesh, leaf, vx: 0, vz: 0, spin: 0 }
        this.entries.set(leaf.id, entry)
      } else {
        entry.leaf = leaf
        const geo = geos[leaf.shape] ?? geos[0]!
        if (entry.mesh.geometry !== geo) entry.mesh.geometry = geo
        entry.mesh.material = materialForColor(leaf.color)
      }
      this.applyPose(entry)
    }
  }

  /** Persistierbare Pose aus Runtime (nach Wind) — für optionales Commit. */
  snapshotLeaves(): GroundLeaf[] {
    const out: GroundLeaf[] = []
    for (const entry of this.entries.values()) {
      out.push({
        ...entry.leaf,
        x: entry.mesh.position.x,
        z: entry.mesh.position.z,
        y: LEAF_Y_CM,
        yawDeg: THREE.MathUtils.radToDeg(entry.mesh.rotation.y),
      })
    }
    return out
  }

  /**
   * Wind-Tick. @returns true wenn sich etwas bewegt hat (Dirty-Flag).
   */
  tick(dtMs: number, wind: LeafWindSample): boolean {
    if (this.entries.size === 0) return false
    const dt = Math.min(0.05, Math.max(0, dtMs / 1000))
    if (dt <= 0) return false
    let moved = false
    const r2 = LEAF_WIND_RADIUS_CM * LEAF_WIND_RADIUS_CM
    for (const entry of this.entries.values()) {
      const px = entry.mesh.position.x
      const pz = entry.mesh.position.z
      if (wind.active) {
        const dx = px - wind.x
        const dz = pz - wind.z
        const d2 = dx * dx + dz * dz
        if (d2 < r2 && d2 > 1e-4) {
          const d = Math.sqrt(d2)
          const falloff = 1 - d / LEAF_WIND_RADIUS_CM
          const push = LEAF_WIND_STRENGTH * falloff * falloff
          // Windrichtung = Cursor-Velocity + leichter radialer Schub.
          entry.vx += (wind.vx * 0.02 + (dx / d) * 18) * push * dt
          entry.vz += (wind.vz * 0.02 + (dz / d) * 18) * push * dt
          entry.spin += (wind.vx * 0.001 - wind.vz * 0.001) * push * LEAF_SPIN_FACTOR
        }
      }
      entry.vx *= LEAF_WIND_DAMPING
      entry.vz *= LEAF_WIND_DAMPING
      entry.spin *= LEAF_WIND_DAMPING
      const speed = Math.hypot(entry.vx, entry.vz)
      if (speed > LEAF_WIND_MAX_SPEED) {
        const s = LEAF_WIND_MAX_SPEED / speed
        entry.vx *= s
        entry.vz *= s
      }
      if (Math.abs(entry.vx) < 0.02 && Math.abs(entry.vz) < 0.02 && Math.abs(entry.spin) < 0.001) {
        entry.vx = 0
        entry.vz = 0
        entry.spin = 0
        continue
      }
      entry.mesh.position.x += entry.vx * dt
      entry.mesh.position.z += entry.vz * dt
      entry.mesh.position.y = LEAF_Y_CM
      entry.mesh.rotation.y += entry.spin * dt
      entry.leaf.x = entry.mesh.position.x
      entry.leaf.z = entry.mesh.position.z
      entry.leaf.yawDeg = THREE.MathUtils.radToDeg(entry.mesh.rotation.y)
      moved = true
    }
    return moved
  }

  count(): number {
    return this.entries.size
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.disposeEntry(id)
    for (const mat of sharedMaterials.values()) mat.dispose()
    sharedMaterials.clear()
  }

  private applyPose(entry: LeafEntry): void {
    const { leaf, mesh } = entry
    mesh.position.set(leaf.x, leaf.y ?? LEAF_Y_CM, leaf.z)
    mesh.rotation.set(0, THREE.MathUtils.degToRad(leaf.yawDeg), 0)
    const s = leaf.scale
    mesh.scale.set(s, s, s)
  }

  private disposeEntry(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.root.remove(entry.mesh)
    // Geometrie shared — nicht disposen.
    this.entries.delete(id)
  }
}

/** Nützlich für Tests ohne volle Szene. */
export function windImpulsePreview(
  leafX: number,
  leafZ: number,
  wind: LeafWindSample,
): { ax: number; az: number } {
  if (!wind.active) return { ax: 0, az: 0 }
  const dx = leafX - wind.x
  const dz = leafZ - wind.z
  const d2 = dx * dx + dz * dz
  const r2 = LEAF_WIND_RADIUS_CM * LEAF_WIND_RADIUS_CM
  if (d2 >= r2 || d2 <= 1e-4) return { ax: 0, az: 0 }
  const d = Math.sqrt(d2)
  const falloff = 1 - d / LEAF_WIND_RADIUS_CM
  const push = LEAF_WIND_STRENGTH * falloff * falloff
  return {
    ax: (wind.vx * 0.02 + (dx / d) * 18) * push,
    az: (wind.vz * 0.02 + (dz / d) * 18) * push,
  }
}
