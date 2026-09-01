import * as THREE from 'three'
import type { FacadeState, SceneLight } from '../types/facade'
import { createId } from '../utils/id'
import { getAllWalls } from '../utils/buildings'
import { buildingWorldBox, kelvinToColor } from '../utils/sunLighting'
import { DEFAULT_POWER_WATTS, normalizePowerWatts } from '../lighting/sceneLightUnits'

export type { SceneLight }

const MARKER_SIZE_MIN_CM = 8
const MARKER_SIZE_MAX_CM = 200
const COLOR_TEMP_MIN_K = 2000
const COLOR_TEMP_MAX_K = 6500
const DEFAULT_COLOR_TEMP_K = 3000

export const DEFAULT_SCENE_LIGHT: Omit<SceneLight, 'id' | 'x' | 'y' | 'z'> = {
  label: 'Punktlicht',
  color: '#ffaa66',
  colorTemperature: DEFAULT_COLOR_TEMP_K,
  intensity: DEFAULT_POWER_WATTS,
  enabled: true,
  castShadow: true,
  showMarker: true,
  markerSizeCm: 40,
  distance: 0,
  decay: 2,
}

export function kelvinToHex(kelvin: number): string {
  return `#${kelvinToColor(kelvin).getHexString()}`
}

export function normalizeSceneLight(raw: Partial<SceneLight> & { id: string }): SceneLight {
  const x = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 0
  const y = typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : 220
  const z = typeof raw.z === 'number' && Number.isFinite(raw.z) ? raw.z : 0
  const intensity =
    typeof raw.intensity === 'number' && Number.isFinite(raw.intensity)
      ? normalizePowerWatts(raw.intensity)
      : DEFAULT_SCENE_LIGHT.intensity
  const colorTemperature =
    typeof raw.colorTemperature === 'number' && Number.isFinite(raw.colorTemperature)
      ? Math.min(COLOR_TEMP_MAX_K, Math.max(COLOR_TEMP_MIN_K, raw.colorTemperature))
      : DEFAULT_COLOR_TEMP_K
  const colorFromKelvin = kelvinToHex(colorTemperature)
  const hasLegacyHexOnly =
    typeof raw.color === 'string' && raw.color.startsWith('#') && raw.colorTemperature === undefined
  const color =
    hasLegacyHexOnly ||
    (typeof raw.color === 'string' && raw.color.startsWith('#') && raw.color !== colorFromKelvin)
      ? raw.color
      : colorFromKelvin
  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : DEFAULT_SCENE_LIGHT.label,
    x,
    y,
    z,
    color,
    colorTemperature,
    intensity,
    enabled: raw.enabled !== false,
    castShadow: raw.castShadow !== false,
    showMarker: raw.showMarker !== false,
    markerSizeCm:
      typeof raw.markerSizeCm === 'number' && Number.isFinite(raw.markerSizeCm)
        ? Math.min(MARKER_SIZE_MAX_CM, Math.max(MARKER_SIZE_MIN_CM, raw.markerSizeCm))
        : DEFAULT_SCENE_LIGHT.markerSizeCm!,
    distance:
      typeof raw.distance === 'number' && Number.isFinite(raw.distance)
        ? Math.max(0, raw.distance)
        : DEFAULT_SCENE_LIGHT.distance!,
    decay:
      typeof raw.decay === 'number' && Number.isFinite(raw.decay)
        ? Math.min(3, Math.max(0, raw.decay))
        : DEFAULT_SCENE_LIGHT.decay!,
  }
}

export function normalizeSceneLights(raw: unknown): SceneLight[] {
  if (!Array.isArray(raw)) return []
  const out: SceneLight[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = (item as { id?: string }).id
    if (typeof id !== 'string' || !id) continue
    out.push(normalizeSceneLight({ ...(item as Partial<SceneLight>), id }))
  }
  return out
}

export function defaultSceneLightPosition(state: FacadeState, index = 0): Pick<SceneLight, 'x' | 'y' | 'z'> {
  const box = buildingWorldBox(getAllWalls(state))
  if (box.isEmpty()) {
    return { x: index * 48, y: 220, z: 0 }
  }
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  return {
    x: center.x + index * 40,
    y: Math.max(box.min.y + 180, 180),
    z: center.z + (index % 2 === 0 ? 0 : size.z * 0.15),
  }
}

export function addSceneLight(
  state: FacadeState,
  position?: Partial<Pick<SceneLight, 'x' | 'y' | 'z'>>,
): { state: FacadeState; lightId: string } {
  const lights = normalizeSceneLights(state.sceneLights)
  const pos = defaultSceneLightPosition(state, lights.length)
  const lightId = createId()
  const next: SceneLight = normalizeSceneLight({
    id: lightId,
    ...DEFAULT_SCENE_LIGHT,
    ...pos,
    ...position,
  })
  return {
    state: { ...state, sceneLights: [...lights, next] },
    lightId,
  }
}

export function updateSceneLight(
  state: FacadeState,
  lightId: string,
  patch: Partial<Omit<SceneLight, 'id'>>,
): FacadeState {
  const lights = normalizeSceneLights(state.sceneLights)
  const idx = lights.findIndex((item) => item.id === lightId)
  if (idx < 0) return state
  lights[idx] = normalizeSceneLight({ ...lights[idx], ...patch, id: lightId })
  return { ...state, sceneLights: lights }
}

export function removeSceneLight(state: FacadeState, lightId: string): FacadeState {
  const lights = normalizeSceneLights(state.sceneLights).filter((item) => item.id !== lightId)
  return { ...state, sceneLights: lights }
}

export function sceneLightById(state: FacadeState, lightId: string): SceneLight | undefined {
  return normalizeSceneLights(state.sceneLights).find((item) => item.id === lightId)
}

const DUPLICATE_OFFSET_CM = 48

export function duplicateSceneLight(
  state: FacadeState,
  lightId: string,
): { state: FacadeState; lightId: string } {
  const source = sceneLightById(state, lightId)
  if (!source) return { state, lightId: '' }
  const { state: withNew, lightId: newId } = addSceneLight(state, {
    x: source.x + DUPLICATE_OFFSET_CM,
    y: source.y,
    z: source.z,
  })
  const next = updateSceneLight(withNew, newId, {
    label: source.label,
    color: source.color,
    colorTemperature: source.colorTemperature,
    intensity: source.intensity,
    enabled: source.enabled,
    castShadow: source.castShadow,
    showMarker: source.showMarker,
    markerSizeCm: source.markerSizeCm,
    distance: source.distance,
    decay: source.decay,
  })
  return { state: next, lightId: newId }
}
