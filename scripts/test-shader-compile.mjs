import * as THREE from 'three'
import { applyFacadeShadeShader } from '../src/utils/facadeShade.ts'
import { applyGroundMoodShader } from '../src/lighting/groundMood.ts'
import { enablePcssShadows, updatePcssShadowParameters } from '../src/lighting/pcssShadows.ts'

const renderer = new THREE.WebGLRenderer({ antialias: false })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.BasicShadowMap
enablePcssShadows()
const scene = new THREE.Scene()
const cam = new THREE.PerspectiveCamera(50, 1, 1, 1000)
cam.position.set(0, 200, 500)

const dir = new THREE.DirectionalLight(0xffffff, 2)
dir.castShadow = true
scene.add(dir)
scene.add(new THREE.DirectionalLight(0xffffff, 0.2))
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.3))

const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888 })
applyFacadeShadeShader(wallMat, 1)
const wall = new THREE.Mesh(new THREE.BoxGeometry(100, 200, 20), wallMat)
wall.receiveShadow = true
wall.castShadow = true
scene.add(wall)

const groundMat = new THREE.MeshStandardMaterial({ color: 0xcccccc })
applyGroundMoodShader(groundMat)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), groundMat)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

updatePcssShadowParameters(2.5, 4000, scene)

const errors = []
renderer.debug.checkShaderErrors = true
const orig = console.error
console.error = (...a) => {
  errors.push(a.join(' '))
  orig(...a)
}

renderer.compile(scene, cam)
renderer.render(scene, cam)

console.log('shader errors:', errors.length ? errors : 'none')
process.exit(errors.length ? 1 : 0)
