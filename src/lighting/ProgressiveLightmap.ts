import * as THREE from 'three'

export class ProgressiveLightmap {
  private meshes: Set<THREE.Mesh> = new Set()
  private _strength = 0.6

  get strength() {
    return this._strength
  }

  set strength(value: number) {
    this._strength = THREE.MathUtils.clamp(value, 0, 1)
  }

  addMesh(mesh: THREE.Mesh) {
    this.meshes.add(mesh)
  }

  /**
   * Vereinfachte Placeholder-Implementierung:
   * Im MVP wird hier nur ein weiches Ambient-/AO-ähnliches Verhalten simuliert,
   * die eigentliche progressive Lightmap kann später detailgetreu nach dem
   * three.js-Beispiel nachgezogen werden.
   */
  update(delta: number) {
    const t = THREE.MathUtils.clamp(delta * 2 * this._strength, 0, 1)
    for (const mesh of this.meshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
      if (Array.isArray(mat)) continue
      const targetRoughness = 0.4 + (1 - this._strength) * 0.4
      const targetMetalness = 0.1 * this._strength
      mat.roughness = THREE.MathUtils.lerp(mat.roughness, targetRoughness, t)
      mat.metalness = THREE.MathUtils.lerp(mat.metalness, targetMetalness, t)
    }
  }
}

