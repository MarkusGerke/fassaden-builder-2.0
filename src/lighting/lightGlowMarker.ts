import * as THREE from 'three'

let sharedGlowMap: THREE.Texture | null = null

function glowTexture(): THREE.Texture {
  if (sharedGlowMap) return sharedGlowMap
  const size = 64
  const data = new Uint8Array(size * size * 4)
  const center = (size - 1) / 2
  const maxR = center
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center
      const dy = y - center
      const t = Math.min(1, Math.hypot(dx, dy) / maxR)
      const alpha = Math.max(0, 1 - t * t) ** 1.6
      const i = (y * size + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = Math.round(255 * alpha)
    }
  }
  sharedGlowMap = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  sharedGlowMap.needsUpdate = true
  return sharedGlowMap
}

/** Weiches Glühen — depthTest gegen opake Geometrie; Glas schreibt keine Tiefe (siehe applyGlassLook). */
export function createLightGlowSprite(initialDiameterCm: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  })
  const sprite = new THREE.Sprite(material)
  sprite.renderOrder = 2
  sprite.scale.setScalar(Math.max(8, initialDiameterCm))
  return sprite
}

export function updateLightGlowSprite(
  sprite: THREE.Sprite,
  colorHex: string,
  diameterCm: number,
  brightness: number,
): void {
  const material = sprite.material as THREE.SpriteMaterial
  material.color.set(colorHex)
  const b = THREE.MathUtils.clamp(brightness, 0.35, 2.5)
  material.opacity = THREE.MathUtils.clamp(0.5 + (b - 0.35) * 0.28, 0.5, 0.98)
  if (diameterCm <= 0) {
    sprite.visible = false
    return
  }
  sprite.visible = true
  sprite.scale.setScalar(Math.max(8, diameterCm))
}

export function disposeLightGlowSprite(sprite: THREE.Sprite): void {
  ;(sprite.material as THREE.SpriteMaterial).dispose()
}

/** Kleine HDR-Kugel — UnrealBloomPass erfasst die Lichtquelle als Glühbirne. */
export function createLightBloomCore(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), material)
  mesh.renderOrder = 3
  mesh.name = 'lightBloomCore'
  return mesh
}

export function updateLightBloomCore(
  mesh: THREE.Mesh,
  colorHex: string,
  markerDiameterCm: number,
  watts: number,
  bloomActive: boolean,
  visible: boolean,
): void {
  if (!visible || !bloomActive || markerDiameterCm <= 0) {
    mesh.visible = false
    return
  }
  const material = mesh.material as THREE.MeshBasicMaterial
  const c = new THREE.Color(colorHex)
  const gain = 10 + Math.sqrt(Math.max(1, watts)) * 2.4
  material.color.copy(c).multiplyScalar(gain)
  material.opacity = 1
  mesh.visible = true
  mesh.scale.setScalar(Math.max(10, markerDiameterCm * 0.28))
}

export function disposeLightBloomCore(mesh: THREE.Mesh): void {
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
}

/**
 * Opake Positions-Kugel für den Render-Modus.
 * Additive Sprites sind kamera-füllende Quads — sie stecken durch Wände
 * und sehen aus wie Lichtflecken auf der Fassade.
 */
export function createLightSolidMarker(): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    toneMapped: false,
    depthTest: true,
    depthWrite: true,
    transparent: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material)
  mesh.renderOrder = 1
  mesh.name = 'lightSolidMarker'
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.scale.setScalar(8)
  return mesh
}

export function updateLightSolidMarker(
  mesh: THREE.Mesh,
  colorHex: string,
  visible: boolean,
  selected: boolean,
): void {
  const material = mesh.material as THREE.MeshBasicMaterial
  material.color.set(colorHex)
  mesh.visible = visible
  mesh.scale.setScalar(selected ? 12 : 8)
}

export function disposeLightSolidMarker(mesh: THREE.Mesh): void {
  mesh.geometry.dispose()
  ;(mesh.material as THREE.Material).dispose()
}
