import * as THREE from 'three'
import type { FacadeState, SceneLight } from '../types/facade'
import { createId } from '../utils/id'
import { getAllWalls } from '../utils/buildings'
import { buildingWorldBox } from '../utils/sunLighting'

export type { SceneLight }

export const DEFAULT_SCENE_LIGHT: Omit<SceneLight, 'id' | 'x' | 'y' | 'z'> = {
  label: 'Punktlicht',
  color: '#ffaa66',
  intensity: 2800,
  enabled: true,
  castShadow: true,
}

export function normalizeSceneLight(raw: Partial<SceneLight> & { id: string }): SceneLight {
  const x = typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 0
  const y = typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : 220
  const z = typeof raw.z === 'number' && Number.isFinite(raw.z) ? raw.z : 0
  const intensity =
    typeof raw.intensity === 'number' && Number.isFinite(raw.intensity)
      ? Math.max(0, raw.intensity)
      : DEFAULT_SCENE_LIGHT.intensity
  return {
    id: raw.id,
    label: typeof raw.label === 'string' ? raw.label : DEFAULT_SCENE_LIGHT.label,
    x,
    y,
    z,
    color: typeof raw.color === 'string' && raw.color.startsWith('#') ? raw.color : DEFAULT_SCENE_LIGHT.color,
    intensity,
    enabled: raw.enabled !== false,
    castShadow: raw.castShadow !== false,
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
