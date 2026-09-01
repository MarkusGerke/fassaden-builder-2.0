import * as THREE from 'three'
import type { Wall } from '../types/facade'
import { STUDIO_TILE } from './constants'
import { wallAlongDelta } from './walls'

const GRID_COLOR = 0x3399ff
const GRID_OPACITY = 0.42

function gridMaterial() {
  return new THREE.LineBasicMaterial({
    color: GRID_COLOR,
    transparent: true,
    opacity: GRID_OPACITY,
    depthTest: false,
    depthWrite: false,
  })
}

function disposeGridObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const line = child as THREE.Line
    if (line.geometry) line.geometry.dispose()
  })
}

export function clearPlacementGrid(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0]!
    group.remove(child)
    disposeGridObject(child)
  }
}

function addLineSegments(group: THREE.Group, points: THREE.Vector3[]) {
  if (points.length < 2) return
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const line = new THREE.LineSegments(geo, gridMaterial())
  line.renderOrder = 14
  group.add(line)
}

/** 32-cm-Raster auf dem Boden (Welt-X/Z). */
export function showFloorPlacementGrid(
  group: THREE.Group,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  floorY: number,
  cell = STUDIO_TILE,
) {
  clearPlacementGrid(group)
  const pad = cell * 4
  const x0 = Math.floor((minX - pad) / cell) * cell
  const x1 = Math.ceil((maxX + pad) / cell) * cell
  const z0 = Math.floor((minZ - pad) / cell) * cell
  const z1 = Math.ceil((maxZ + pad) / cell) * cell
  const y = floorY + 0.4
  const verts: THREE.Vector3[] = []

  for (let x = x0; x <= x1 + 1e-6; x += cell) {
    verts.push(new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, z1))
  }
  for (let z = z0; z <= z1 + 1e-6; z += cell) {
    verts.push(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z))
  }
  addLineSegments(group, verts)
}

/** 45-cm-Raster auf dem Boden inkl. Diagonalen (45°/90°) — Wand-Greifer. */
export function showFloorResizeGrid(
  group: THREE.Group,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  floorY: number,
  cell = 45,
) {
  clearPlacementGrid(group)
  const pad = cell * 6
  const x0 = Math.floor((minX - pad) / cell) * cell
  const x1 = Math.ceil((maxX + pad) / cell) * cell
  const z0 = Math.floor((minZ - pad) / cell) * cell
  const z1 = Math.ceil((maxZ + pad) / cell) * cell
  const y = floorY + 0.4
  const verts: THREE.Vector3[] = []

  for (let x = x0; x <= x1 + 1e-6; x += cell) {
    verts.push(new THREE.Vector3(x, y, z0), new THREE.Vector3(x, y, z1))
  }
  for (let z = z0; z <= z1 + 1e-6; z += cell) {
    verts.push(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z))
  }

  const span = Math.max(x1 - x0, z1 - z0)
  for (let s = x0 + z0 - span; s <= x1 + z1 + span + 1e-6; s += cell) {
    verts.push(
      new THREE.Vector3(x0, y, s - x0),
      new THREE.Vector3(x1, y, s - x1),
    )
  }
  for (let d = x0 - z0 - span; d <= x1 - z1 + span + 1e-6; d += cell) {
    verts.push(
      new THREE.Vector3(x0, y, x0 - d),
      new THREE.Vector3(x1, y, x1 - d),
    )
  }
  addLineSegments(group, verts)
}

/** 32-cm-Raster auf der Außenfläche einer Studio-Wand. */
export function showWallFacePlacementGrid(
  group: THREE.Group,
  wall: Wall,
  cell = STUDIO_TILE,
) {
  clearPlacementGrid(group)
  const yawDeg = wall.yawDeg ?? 0
  const originX = wall.originX ?? wall.x
  const originZ = wall.originZ ?? 0
  const outward = wallAlongDelta(yawDeg + 90, 2)
  const ox = outward.x
  const oz = outward.z
  const verts: THREE.Vector3[] = []

  for (let lx = 0; lx <= wall.width + 1e-6; lx += cell) {
    const along = wallAlongDelta(yawDeg, lx)
    const bottom = new THREE.Vector3(originX + along.x + ox, wall.y, originZ + along.z + oz)
    const top = new THREE.Vector3(originX + along.x + ox, wall.y + wall.height, originZ + along.z + oz)
    verts.push(bottom, top)
  }
  for (let ly = 0; ly <= wall.height + 1e-6; ly += cell) {
    const along0 = wallAlongDelta(yawDeg, 0)
    const along1 = wallAlongDelta(yawDeg, wall.width)
    const y = wall.y + ly
    verts.push(
      new THREE.Vector3(originX + along0.x + ox, y, originZ + along0.z + oz),
      new THREE.Vector3(originX + along1.x + ox, y, originZ + along1.z + oz),
    )
  }
  addLineSegments(group, verts)
}

export function boundsFromSegments(
  segments: Array<{ ax: number; az: number; bx: number; bz: number }>,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const seg of segments) {
    minX = Math.min(minX, seg.ax, seg.bx)
    maxX = Math.max(maxX, seg.ax, seg.bx)
    minZ = Math.min(minZ, seg.az, seg.bz)
    maxZ = Math.max(maxZ, seg.az, seg.bz)
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  return { minX, maxX, minZ, maxZ }
}
