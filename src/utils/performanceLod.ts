import * as THREE from 'three'
import type { Building, FacadeState } from '../types/facade'
import { buildingWorldBox } from './sunLighting'

/** Sichtbarkeits-Stufe pro Gebäude (Bildschirmgröße, nicht reine Meter-Distanz). */
export type LodLevel = 'high' | 'medium' | 'far'

export interface LodThresholds {
  tileHighPx: number
  tileMediumPx: number
  buildingFarPx: number
}

export const LOD_TILE_HIGH_PX = 4
export const LOD_TILE_MEDIUM_PX = 1
export const LOD_BUILDING_FAR_PX = 30

/** Hysterese-Faktoren gegen Flackern an Schwellen. */
export const LOD_HYSTERESIS_DOWN = 0.8
export const LOD_HYSTERESIS_UP = 1.2

export const LOD_EVAL_INTERVAL_FRAMES = 6

/** Näherungsweise sichtbare Kantenlänge in Pixeln. */
export function worldSizeToPixels(
  worldSize: number,
  distance: number,
  viewportHeight: number,
  fovDeg: number,
): number {
  if (distance < 1e-3 || worldSize <= 0) return Infinity
  const fovRad = THREE.MathUtils.degToRad(fovDeg)
  return (worldSize / distance) * (viewportHeight / (2 * Math.tan(fovRad / 2)))
}

export function buildingScreenSpanPx(
  building: Building,
  camera: THREE.Camera,
  viewportHeight: number,
): number {
  const walls = building.walls.filter((w) => !w.hidden)
  const box = buildingWorldBox(walls)
  if (box.isEmpty()) return Infinity
  const size = new THREE.Vector3()
  box.getSize(size)
  const span = Math.max(size.x, size.y, size.z, 400)
  const center = new THREE.Vector3()
  box.getCenter(center)
  const dist = camera.position.distanceTo(center)
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 50
  return worldSizeToPixels(span, dist, viewportHeight, fov)
}

export function tileScreenPx(buildingSpanPx: number, tileCm = 32, buildingSpanCm = 400): number {
  if (buildingSpanPx === Infinity) return Infinity
  return (buildingSpanPx * tileCm) / Math.max(buildingSpanCm, 1)
}

export function nextLodLevel(
  current: LodLevel,
  buildingSpanPx: number,
  tilePx: number,
  thresholds: LodThresholds = {
    tileHighPx: LOD_TILE_HIGH_PX,
    tileMediumPx: LOD_TILE_MEDIUM_PX,
    buildingFarPx: LOD_BUILDING_FAR_PX,
  },
): LodLevel {
  const { tileHighPx, tileMediumPx, buildingFarPx } = thresholds
  if (buildingSpanPx < buildingFarPx * LOD_HYSTERESIS_UP && current === 'far') {
    return tilePx >= tileMediumPx * LOD_HYSTERESIS_UP ? 'medium' : 'far'
  }
  if (buildingSpanPx >= buildingFarPx * LOD_HYSTERESIS_DOWN) {
    if (current === 'far') return 'far'
    if (tilePx < tileMediumPx * LOD_HYSTERESIS_DOWN) {
      return buildingSpanPx < buildingFarPx * LOD_HYSTERESIS_UP ? 'medium' : 'far'
    }
    if (tilePx >= tileHighPx * LOD_HYSTERESIS_UP) return 'high'
    if (current === 'high' && tilePx >= tileHighPx * LOD_HYSTERESIS_DOWN) return 'high'
    return 'medium'
  }
  if (tilePx >= tileHighPx * LOD_HYSTERESIS_UP) return 'high'
  if (tilePx >= tileMediumPx * LOD_HYSTERESIS_UP) return 'medium'
  if (current === 'high' && tilePx >= tileHighPx * LOD_HYSTERESIS_DOWN) return 'high'
  if (current === 'medium' && tilePx >= tileMediumPx * LOD_HYSTERESIS_DOWN) return 'medium'
  return 'far'
}

/** Effektive Stufe für eine Kategorie — bleibt high wenn LOD aus oder Kategorie deaktiviert. */
export function effectiveCategoryLevel(
  base: LodLevel,
  categoryEnabled: boolean,
  lodEnabled: boolean,
): LodLevel {
  if (!lodEnabled || !categoryEnabled) return 'high'
  return base
}

/** Bei far ohne Hull: mindestens medium statt unsichtbar. */
export function effectiveFarHullLevel(base: LodLevel, farHullEnabled: boolean, lodEnabled: boolean): LodLevel {
  if (!lodEnabled || farHullEnabled) return base
  if (base === 'far') return 'medium'
  return base
}

/** Welche Gebäude sich geändert haben — `null` = voller Rebuild nötig. */
export function buildingIdsNeedingRebuild(prev: FacadeState, next: FacadeState): string[] | null {
  if (prev.siteYawDeg !== next.siteYawDeg) return null
  if (prev.buildings.length !== next.buildings.length) return null
  const changed: string[] = []
  for (const nb of next.buildings) {
    const ob = prev.buildings.find((b) => b.id === nb.id)
    if (!ob) return null
    if (JSON.stringify(ob) !== JSON.stringify(nb)) changed.push(nb.id)
  }
  if (changed.length === 0) return []
  if (changed.length === next.buildings.length) return null
  return changed
}

export function averageBuildingColor(building: Building): string {
  const walls = building.walls.filter((w) => !w.hidden)
  if (walls.length === 0) return '#9a8a7a'
  let r = 0
  let g = 0
  let b = 0
  for (const wall of walls) {
    const hex = wall.claddingColor ?? wall.wallColor ?? '#9a8a7a'
    const c = new THREE.Color(hex)
    r += c.r
    g += c.g
    b += c.b
  }
  const n = walls.length
  return `#${new THREE.Color(r / n, g / n, b / n).getHexString()}`
}

export function buildingWorldBoxForBuilding(building: Building): THREE.Box3 {
  return buildingWorldBox(building.walls.filter((w) => !w.hidden))
}
