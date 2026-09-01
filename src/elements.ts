import * as THREE from 'three'

export function createWindowElement(
  cellWidth: number,
  cellHeight: number,
  depth: number,
): THREE.Group {
  const group = new THREE.Group()

  const frameThickness = Math.min(cellWidth, cellHeight) * 0.08
  const frameDepth = depth * 0.6

  const frameGeo = new THREE.BoxGeometry(cellWidth * 0.9, cellHeight * 0.9, frameDepth)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    metalness: 0.1,
    roughness: 0.4,
  })
  const frame = new THREE.Mesh(frameGeo, frameMat)
  frame.castShadow = true
  frame.receiveShadow = true
  group.add(frame)

  const glassGeo = new THREE.BoxGeometry(
    cellWidth * 0.9 - frameThickness * 2,
    cellHeight * 0.9 - frameThickness * 2,
    frameDepth * 0.3,
  )
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fb7d4,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.8,
    transparent: true,
    opacity: 0.9,
  })
  const glass = new THREE.Mesh(glassGeo, glassMat)
  glass.position.z = frameDepth * 0.1
  glass.castShadow = false
  glass.receiveShadow = true
  group.add(glass)

  return group
}

export function createDoorElement(
  cellWidth: number,
  height: number,
  depth: number,
): THREE.Group {
  const group = new THREE.Group()

  const doorDepth = depth * 0.8

  const leafGeo = new THREE.BoxGeometry(cellWidth * 0.7, height * 0.95, doorDepth * 0.5)
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x7a6a58,
    metalness: 0.2,
    roughness: 0.6,
  })
  const leaf = new THREE.Mesh(leafGeo, leafMat)
  leaf.position.y = height * 0.45
  leaf.castShadow = true
  leaf.receiveShadow = true
  group.add(leaf)

  const frameGeo = new THREE.BoxGeometry(cellWidth * 0.9, height, doorDepth * 0.2)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xe6e0d8,
    metalness: 0.1,
    roughness: 0.4,
  })
  const frame = new THREE.Mesh(frameGeo, frameMat)
  frame.castShadow = true
  frame.receiveShadow = true
  group.add(frame)

  return group
}

export function createStuccoElement(cellWidth: number, depth: number): THREE.Mesh {
  const profileHeight = Math.min(cellWidth * 0.35, 0.6)
  const geo = new THREE.BoxGeometry(cellWidth * 1.1, profileHeight, depth * 0.4)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf5f1e6,
    metalness: 0.05,
    roughness: 0.6,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.position.y += profileHeight * 0.4
  return mesh
}

