import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CLADDING_MODELS, WINDOW_PROFILE_MODELS, windowModelKey, type CladdingSpec } from './catalog'

const loader = new GLTFLoader()

const profileMaterial = new THREE.MeshStandardMaterial({
  color: 0x504c44,
  roughness: 0.5,
  metalness: 0,
  side: THREE.DoubleSide,
  shadowSide: THREE.DoubleSide,
})

const claddingMaterial = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.5,
  metalness: 0,
  side: THREE.DoubleSide,
  shadowSide: THREE.DoubleSide,
})

function prepareTemplate(root: THREE.Object3D, material: THREE.MeshStandardMaterial): THREE.Object3D {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = true
    child.receiveShadow = true
    child.material = material
  })
  return root
}

async function loadGroup(
  items: Array<{ url: string; key: string }>,
  material: THREE.MeshStandardMaterial,
): Promise<Map<string, THREE.Object3D>> {
  const templates = new Map<string, THREE.Object3D>()
  await Promise.all(
    items.map(async (item) => {
      try {
        const gltf = await loader.loadAsync(item.url)
        templates.set(item.key, prepareTemplate(gltf.scene, material))
      } catch (error) {
        console.error(`Mesh ${item.key} konnte nicht geladen werden.`, error)
      }
    }),
  )
  return templates
}

export function loadWindowProfileTemplates(): Promise<Map<string, THREE.Object3D>> {
  return loadGroup(
    WINDOW_PROFILE_MODELS.map((spec) => ({
      key: windowModelKey(spec.width, spec.height),
      url: spec.url,
    })),
    profileMaterial,
  )
}

export function loadCladdingTemplates(): Promise<Map<string, THREE.Object3D>> {
  return loadGroup(
    CLADDING_MODELS.filter((spec): spec is CladdingSpec & { url: string } => Boolean(spec.url)).map(
      (spec) => ({ key: spec.id, url: spec.url }),
    ),
    claddingMaterial,
  )
}
