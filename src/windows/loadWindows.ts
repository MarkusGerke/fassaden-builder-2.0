import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { WINDOW_MODELS, windowModelKey } from './catalog'
import { createGlassMaterial } from '../utils/threeColors'

const loader = new GLTFLoader()

function isGlassMaterial(material: THREE.Material): boolean {
  const name = material.name.toLowerCase()
  if (name.includes('glas') || name.includes('glass')) return true
  const physical = material instanceof THREE.MeshPhysicalMaterial ? material : null
  if (physical && (physical.transparent || physical.transmission > 0)) return true
  return material.transparent && material.opacity < 0.95
}

function prepareWindowMaterial(material: THREE.Material): THREE.Material {
  if (isGlassMaterial(material)) return createGlassMaterial('#8ec4dc')
  const clone = material.clone()
  clone.side = THREE.DoubleSide
  if (clone instanceof THREE.MeshStandardMaterial) {
    clone.metalness = Math.min(clone.metalness, 0.08)
    clone.roughness = Math.max(clone.roughness, 0.4)
  }
  return clone
}

function prepareTemplate(root: THREE.Object3D): THREE.Object3D {
  // Nicht in XY zentrieren — der Modul-Pfad nutzt opening.x - box.min.x.
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    const next = materials.map((material) => prepareWindowMaterial(material))
    child.material = Array.isArray(child.material) ? next : next[0]
    const glass = (Array.isArray(child.material) ? child.material : [child.material]).some(
      (material) => isGlassMaterial(material),
    )
    child.castShadow = !glass
    child.receiveShadow = false
  })
  return root
}

export async function loadWindowTemplates(): Promise<Map<string, THREE.Object3D>> {
  const templates = new Map<string, THREE.Object3D>()
  await Promise.all(
    WINDOW_MODELS.map(async (spec) => {
      try {
        const gltf = await loader.loadAsync(spec.url)
        templates.set(windowModelKey(spec.width, spec.height), prepareTemplate(gltf.scene))
      } catch (error) {
        console.error(`Fenster ${spec.width}×${spec.height} konnte nicht geladen werden.`, error)
      }
    }),
  )
  return templates
}
