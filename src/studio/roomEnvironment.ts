/**
 * Reflexionskarte für Glas und glänzende/metallische Oberflächen.
 *
 * Kein HDRI: CubeCamera steht *vor* dem Baukörper (Richtung Kamera) und
 * rendert die echte Szene (Nachbarflügel, Boden, Himmel). `scene.environment`
 * bleibt null, damit die Fassade nicht überleuchtet wird.
 */
import * as THREE from 'three'
import {
  glassGroundReflectionColor,
  glassSkyReflectionColor,
  setGlassEnvironment,
} from '../utils/threeColors'

let pmrem: THREE.PMREMGenerator | null = null
let cubeRT: THREE.WebGLCubeRenderTarget | null = null
let cubeCamera: THREE.CubeCamera | null = null
let roomEnvTarget: THREE.WebGLRenderTarget | null = null
let reflectionsDirty = true
let baking = false

const CUBE_SIZE = 256
const SKY_RADIUS = 6400
const VIEW_BUCKET_RAD = Math.PI / 10

const _center = new THREE.Vector3()
const _size = new THREE.Vector3()
const _dir = new THREE.Vector3()

function createSkyGroundMesh(skyHex: string, groundHex: string): THREE.Mesh {
  const geo = new THREE.SphereGeometry(SKY_RADIUS, 32, 20)
  const pos = geo.getAttribute('position')
  const colors = new Float32Array(pos.count * 3)
  const sky = new THREE.Color(skyHex)
  const horizon = sky.clone().lerp(new THREE.Color(groundHex), 0.28)
  const ground = new THREE.Color(groundHex).multiplyScalar(0.55)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i) / SKY_RADIUS
    if (y > 0) tmp.lerpColors(horizon, sky, Math.min(1, y * 1.15))
    else tmp.lerpColors(horizon, ground, Math.min(1, -y * 1.1))
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, depthWrite: false }),
  )
  mesh.name = 'glassSkyProbe'
  mesh.frustumCulled = false
  return mesh
}

function isGlassMesh(obj: THREE.Object3D): boolean {
  if (!(obj instanceof THREE.Mesh)) return false
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
  return mats.some((mat) => {
    if (!mat) return false
    const name = (mat.name ?? '').toLowerCase()
    if (name.includes('glas') || name.includes('glass')) return true
    if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0.02) return true
    return false
  })
}

export function markSceneReflectionsDirty(): void {
  reflectionsDirty = true
}

/** Probe vor dem Baukörper, auf der Seite der Kamera — nicht im Innenraum. */
export function exteriorReflectionProbe(
  box: THREE.Box3,
  cameraWorld: THREE.Vector3,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  if (box.isEmpty()) {
    return out.set(cameraWorld.x, Math.max(140, cameraWorld.y * 0.45), cameraWorld.z)
  }
  box.getCenter(_center)
  box.getSize(_size)
  const radius = Math.max(_size.x, _size.z) * 0.5
  _dir.set(cameraWorld.x - _center.x, 0, cameraWorld.z - _center.z)
  if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1)
  else _dir.normalize()
  const standoff = radius + Math.max(180, radius * 0.22)
  out.copy(_center).addScaledVector(_dir, standoff)
  out.y = THREE.MathUtils.clamp(_center.y, 130, Math.max(130, box.max.y * 0.48))
  return out
}

/** Grobe Kamerarichtung um den Fokus, für EnvMap-Neuaufbau beim Orbitieren. */
export function reflectionViewBucket(cameraWorld: THREE.Vector3, focus: THREE.Vector3): number {
  const az = Math.atan2(cameraWorld.x - focus.x, cameraWorld.z - focus.z)
  return Math.round(az / VIEW_BUCKET_RAD)
}

export function initRoomEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  pmrem = new THREE.PMREMGenerator(renderer)
  cubeRT = new THREE.WebGLCubeRenderTarget(CUBE_SIZE, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
  })
  cubeCamera = new THREE.CubeCamera(12, 14000, cubeRT)
  cubeCamera.name = 'glassCubeCamera'
  cubeCamera.layers.enable(0)
  cubeCamera.layers.enable(1)
  for (const child of cubeCamera.children) {
    if (child instanceof THREE.Camera) {
      child.layers.enable(0)
      child.layers.enable(1)
    }
  }
  scene.add(cubeCamera)
}

export function applySceneBackground(
  scene: THREE.Scene,
  _renderer: THREE.WebGLRenderer,
  backgroundHex: string,
): void {
  scene.environment = null
  scene.environmentIntensity = 1
  scene.background = new THREE.Color(backgroundHex)
  scene.backgroundIntensity = 1
  markSceneReflectionsDirty()
}

/**
 * Rendert die echte Szene in eine Cube-EnvMap (ohne Glas, damit keine Rekursion).
 * Nur aufrufen wenn dirty — 6 Extra-Renders.
 */
export function bakeSceneReflectionsIfNeeded(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  probe: THREE.Vector3,
  extraHide: THREE.Object3D[] = [],
): void {
  if (!reflectionsDirty || baking || !pmrem || !cubeRT || !cubeCamera) return
  baking = true
  reflectionsDirty = false

  const hidden: Array<{ obj: THREE.Object3D; visible: boolean }> = []
  const hide = (obj: THREE.Object3D | null | undefined) => {
    if (!obj || !obj.visible) return
    hidden.push({ obj, visible: obj.visible })
    obj.visible = false
  }

  try {
    for (const obj of extraHide) hide(obj)
    scene.traverse((obj) => {
      if (obj === cubeCamera) return
      if (obj.name === 'glassSkyProbe') return
      if (isGlassMesh(obj)) hide(obj)
    })

    const sky = createSkyGroundMesh(glassSkyReflectionColor, glassGroundReflectionColor)
    sky.position.copy(probe)
    scene.add(sky)

    const prevFog = scene.fog
    scene.fog = null
    const prevTone = renderer.toneMapping
    const prevExposure = renderer.toneMappingExposure
    const prevAutoClear = renderer.autoClear
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1
    renderer.autoClear = true

    cubeCamera.position.copy(probe)
    cubeCamera.update(renderer, scene)

    renderer.toneMapping = prevTone
    renderer.toneMappingExposure = prevExposure
    renderer.autoClear = prevAutoClear
    scene.fog = prevFog

    scene.remove(sky)
    sky.geometry.dispose()
    ;(sky.material as THREE.MeshBasicMaterial).dispose()

    const generated = pmrem.fromCubemap(cubeRT.texture)
    roomEnvTarget?.dispose()
    roomEnvTarget = generated
    setGlassEnvironment(generated.texture)
  } finally {
    for (const item of hidden) item.obj.visible = item.visible
    baking = false
  }
}

export function disposeRoomEnvironment(): void {
  roomEnvTarget?.dispose()
  cubeRT?.dispose()
  pmrem?.dispose()
  roomEnvTarget = null
  cubeRT = null
  cubeCamera = null
  pmrem = null
}
