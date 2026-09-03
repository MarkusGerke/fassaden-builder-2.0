import * as THREE from 'three'
import type { Wall } from '../types/facade'
import {
  DEFAULT_STUDIO_PANEL,
  normalizeStudioPanel,
  STUDIO_MASONRY,
  STUDIO_TILE,
} from './constants'
import {
  openingMasonryCourseYs,
  openingMasonryJambXs,
  wallUsesOpeningMasonrySnap,
} from '../utils/openingPanelSnap'
import { visiblePanelRowRange } from './panelLayout'
import { wallAlongDelta } from './walls'

const GRID_COLOR = 0x3399ff
const GRID_OPACITY = 0.42
const CUT_EPS = 0.05

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

function uniqueCuts(values: number[], max: number): number[] {
  const out: number[] = []
  for (const v of [...values].sort((a, b) => a - b)) {
    if (!Number.isFinite(v)) continue
    const c = Math.max(0, Math.min(max, v))
    if (out.length === 0 || c - out[out.length - 1]! > CUT_EPS) out.push(c)
  }
  if (out.length === 0 || out[0]! > CUT_EPS) out.unshift(0)
  if (out[out.length - 1]! < max - CUT_EPS) out.push(max)
  else out[out.length - 1] = max
  return out
}

function regularCuts(length: number, step: number): number[] {
  if (length <= CUT_EPS || step <= CUT_EPS) return [0, Math.max(0, length)]
  const cuts: number[] = [0]
  const n = Math.max(1, Math.floor((length + CUT_EPS) / step))
  for (let i = 1; i < n; i += 1) cuts.push(i * step)
  return uniqueCuts(cuts, length)
}

/**
 * Vertikale Rasterlinien der Wandfläche = Stoßfugen des Verbands (gerade+ungerade),
 * sonst Paneelbreite / 8-cm-Fallback. Streifen: nur Laibungen (0 / Breite).
 */
export function wallFaceGridXs(wall: Wall, allWalls: Wall[] = [wall]): number[] {
  const panel = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  if (!panel.enabled || panel.pattern === 'none') {
    return regularCuts(wall.width, STUDIO_TILE)
  }
  if (panel.pattern === 'strip') {
    return uniqueCuts([0, wall.width], wall.width)
  }
  if (wallUsesOpeningMasonrySnap(wall)) {
    return openingMasonryJambXs(wall, allWalls, wall.height / 2)
  }
  const step = Math.max(STUDIO_MASONRY, panel.panelWidth)
  return regularCuts(wall.width, step)
}

/**
 * Horizontale Rasterlinien = Schichtgrenzen des Paneels / Mauerwerks.
 */
export function wallFaceGridYs(wall: Wall): number[] {
  const panel = normalizeStudioPanel(wall.panel ?? DEFAULT_STUDIO_PANEL)
  if (!panel.enabled || panel.pattern === 'none') {
    return regularCuts(wall.height, STUDIO_TILE)
  }
  if (wallUsesOpeningMasonrySnap(wall)) {
    return openingMasonryCourseYs(wall, wall.height / 2)
  }
  const { rowCuts } = visiblePanelRowRange(wall.height, panel)
  return uniqueCuts(rowCuts, wall.height)
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

/**
 * Raster auf der Außenfläche einer Studio-Wand = Fugen/Schichten des Paneels
 * bzw. Mauerwerks (nicht mehr festes 32-cm-Gitter).
 */
export function showWallFacePlacementGrid(
  group: THREE.Group,
  wall: Wall,
  allWalls: Wall[] = [wall],
) {
  clearPlacementGrid(group)
  const yawDeg = wall.yawDeg ?? 0
  const originX = wall.originX ?? wall.x
  const originZ = wall.originZ ?? 0
  const outward = wallAlongDelta(yawDeg + 90, 2)
  const ox = outward.x
  const oz = outward.z
  const verts: THREE.Vector3[] = []
  const xs = wallFaceGridXs(wall, allWalls)
  const ys = wallFaceGridYs(wall)

  for (const lx of xs) {
    const along = wallAlongDelta(yawDeg, lx)
    const bottom = new THREE.Vector3(originX + along.x + ox, wall.y, originZ + along.z + oz)
    const top = new THREE.Vector3(
      originX + along.x + ox,
      wall.y + wall.height,
      originZ + along.z + oz,
    )
    verts.push(bottom, top)
  }
  for (const ly of ys) {
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
