import * as THREE from 'three'
import type { FacadeState, SceneLight, SceneLightGroup } from '../types/facade'
import { createId } from '../utils/id'
import { getAllWalls } from '../utils/buildings'
import { buildingWorldBox, kelvinToColor } from '../utils/sunLighting'
import { DEFAULT_POWER_WATTS, normalizePowerWatts } from '../lighting/sceneLightUnits'
import {
  normalizeDaySchedule,
  type DaySchedule,
} from '../utils/daySchedule'
import {
  normalizeSceneLightAnimation,
  type SceneLightAnimationId,
} from './sceneLightAnimation'
import {
  DEFAULT_BEAM_ANGLE_DOWN_DEG,
  DEFAULT_BEAM_ANGLE_UP_DEG,
  normalizeBeamAngleDeg,
  normalizeBeamMode,
  normalizePresetId,
  sceneLightPresetById,
  type SceneLightPresetId,
} from './sceneLightPresets'

export type { SceneLight, SceneLightGroup }
export type { SceneLightPresetId }

const MARKER_SIZE_MIN_CM = 8
const MARKER_SIZE_MAX_CM = 200
const COLOR_TEMP_MIN_K = 2000
const COLOR_TEMP_MAX_K = 6500
const DEFAULT_COLOR_TEMP_K = 3000

export const DEFAULT_SCENE_LIGHT_FADE_IN_MS = 800
export const DEFAULT_SCENE_LIGHT_FADE_OUT_MS = 1200

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
  beamMode: 'omni',
  beamAngleDownDeg: DEFAULT_BEAM_ANGLE_DOWN_DEG,
  beamAngleUpDeg: DEFAULT_BEAM_ANGLE_UP_DEG,
  animation: 'none',
  fadeInMs: DEFAULT_SCENE_LIGHT_FADE_IN_MS,
  fadeOutMs: DEFAULT_SCENE_LIGHT_FADE_OUT_MS,
  schedule: { onTimes: [], offTimes: [] },
}

function normalizeFadeMs(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  return Math.min(60000, Math.max(0, Math.round(raw)))
}

export function kelvinToHex(kelvin: number): string {
  return `#${kelvinToColor(kelvin).getHexString()}`
}

/** Anzeigename der Lichtart (Preset-Label oder gesetzter Label). */
export function sceneLightTypeLabel(
  light: Pick<SceneLight, 'label' | 'preset' | 'animation'>,
): string {
  const preset =
    sceneLightPresetById(light.preset) ??
    (light.animation === 'blaulicht' ? sceneLightPresetById('blaulicht') : undefined)
  if (preset) return preset.label
  const label = light.label?.trim()
  if (label && label !== DEFAULT_SCENE_LIGHT.label) return label
  if (label) return label
  return DEFAULT_SCENE_LIGHT.label!
}

/**
 * Ebenen-Name: Art + laufende Nummer bei mehreren gleicher Art.
 * Beispiel: Blaulicht, Blaulicht 2, Laterne, Laterne 2.
 */
export function sceneLightDisplayName(
  light: SceneLight,
  allLights: readonly SceneLight[],
): string {
  const base = sceneLightTypeLabel(light)
  const same = allLights.filter((item) => sceneLightTypeLabel(item) === base)
  if (same.length <= 1) return base
  const index = same.findIndex((item) => item.id === light.id)
  return `${base} ${Math.max(1, index + 1)}`
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
  const color: string =
    (hasLegacyHexOnly ||
      (typeof raw.color === 'string' &&
        raw.color.startsWith('#') &&
        raw.color !== colorFromKelvin)) &&
    typeof raw.color === 'string'
      ? raw.color
      : colorFromKelvin
  const preset =
    normalizePresetId(raw.preset) ??
    (normalizeSceneLightAnimation(raw.animation) === 'blaulicht' ? 'blaulicht' : undefined)
  const groupId = typeof raw.groupId === 'string' && raw.groupId ? raw.groupId : undefined
  const defaultLabel = preset
    ? sceneLightPresetById(preset)?.label ?? DEFAULT_SCENE_LIGHT.label
    : DEFAULT_SCENE_LIGHT.label
  const rawLabel = typeof raw.label === 'string' ? raw.label.trim() : ''
  // Generisches „Punktlicht“ durch Preset-Namen ersetzen (Ebenen-Anzeige).
  const label: string =
    rawLabel && rawLabel !== DEFAULT_SCENE_LIGHT.label
      ? rawLabel
      : (defaultLabel ?? DEFAULT_SCENE_LIGHT.label!)
  return {
    id: raw.id,
    label,
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
    preset,
    beamMode: normalizeBeamMode(raw.beamMode),
    beamAngleDownDeg: normalizeBeamAngleDeg(raw.beamAngleDownDeg, DEFAULT_BEAM_ANGLE_DOWN_DEG),
    beamAngleUpDeg: normalizeBeamAngleDeg(raw.beamAngleUpDeg, DEFAULT_BEAM_ANGLE_UP_DEG),
    animation: normalizeSceneLightAnimation(raw.animation),
    groupId,
    fadeInMs: normalizeFadeMs(raw.fadeInMs, DEFAULT_SCENE_LIGHT_FADE_IN_MS),
    fadeOutMs: normalizeFadeMs(raw.fadeOutMs, DEFAULT_SCENE_LIGHT_FADE_OUT_MS),
    schedule: normalizeDaySchedule(raw.schedule),
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

export function normalizeSceneLightGroups(
  raw: unknown,
  lights: readonly SceneLight[],
): SceneLightGroup[] {
  if (!Array.isArray(raw)) return []
  const lightIds = new Set(lights.map((item) => item.id))
  const out: SceneLightGroup[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const id = (item as { id?: string }).id
    if (typeof id !== 'string' || !id) continue
    const nameRaw = (item as { name?: string }).name
    const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : 'Lichtgruppe'
    const membersRaw = (item as { memberLightIds?: unknown }).memberLightIds
    const memberLightIds = Array.isArray(membersRaw)
      ? [
          ...new Set(
            membersRaw.filter((mid): mid is string => typeof mid === 'string' && lightIds.has(mid)),
          ),
        ]
      : []
    if (memberLightIds.length === 0) continue
    out.push({ id, name, memberLightIds })
  }
  return out
}

/** Lichter + Gruppen konsistent (verwaiste groupId / leere Gruppen bereinigen). */
export function normalizeSceneLightState(state: FacadeState): {
  sceneLights: SceneLight[]
  sceneLightGroups: SceneLightGroup[]
} {
  const lights = normalizeSceneLights(state.sceneLights)
  const groups = normalizeSceneLightGroups(state.sceneLightGroups, lights)
  const groupIds = new Set(groups.map((g) => g.id))
  const membersByLight = new Map<string, string>()
  for (const group of groups) {
    for (const lightId of group.memberLightIds) membersByLight.set(lightId, group.id)
  }
  const sceneLights = lights.map((light) => {
    const groupId = membersByLight.get(light.id)
    if (groupId) return normalizeSceneLight({ ...light, groupId })
    if (light.groupId && !groupIds.has(light.groupId)) {
      return normalizeSceneLight({ ...light, groupId: undefined })
    }
    return light
  })
  return { sceneLights, sceneLightGroups: groups }
}

function stateWithoutSceneLights(state: FacadeState): unknown {
  const { sceneLights: _lights, sceneLightGroups: _groups, ...rest } = state
  return rest
}

/** True wenn sich nur `sceneLights` / `sceneLightGroups` geändert haben — kein Grundriss-/Fassaden-Pfad. */
export function facadeStateDiffersOnlyBySceneLights(
  prev: FacadeState,
  next: FacadeState,
): boolean {
  if (JSON.stringify(stateWithoutSceneLights(prev)) !== JSON.stringify(stateWithoutSceneLights(next))) {
    return false
  }
  return (
    JSON.stringify(normalizeSceneLightState(prev)) !==
    JSON.stringify(normalizeSceneLightState(next))
  )
}

/** Ebenenbaum-relevante Licht-Metadaten (ohne XYZ/Farbe/Watt). */
export function sceneLightsLayerListKey(state: FacadeState): string {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  return JSON.stringify({
    groups: sceneLightGroups.map((g) => [g.id, g.name, g.memberLightIds]),
    lights: sceneLights.map((l) => [
      l.id,
      l.label,
      l.enabled,
      l.groupId ?? null,
      l.preset ?? null,
      l.showMarker !== false,
    ]),
  })
}

export function defaultSceneLightPosition(
  state: FacadeState,
  index = 0,
): Pick<SceneLight, 'x' | 'y' | 'z'> {
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

/** Felder einer Voreinstellung (Farbe aus Kelvin oder feste Hex-Farbe). */
export function sceneLightFieldsFromPreset(presetId: SceneLightPresetId): Partial<SceneLight> {
  const preset = sceneLightPresetById(presetId)
  if (!preset) return {}
  const color =
    typeof preset.colorHex === 'string' && preset.colorHex.startsWith('#')
      ? preset.colorHex
      : kelvinToHex(preset.colorTemperature)
  return {
    preset: preset.id,
    label: preset.label,
    beamMode: preset.beamMode,
    beamAngleDownDeg: preset.beamAngleDownDeg,
    beamAngleUpDeg: preset.beamAngleUpDeg,
    colorTemperature: preset.colorTemperature,
    color,
    intensity: preset.intensity,
    distance: preset.distance,
    decay: preset.decay,
    castShadow: preset.castShadow,
    markerSizeCm: preset.markerSizeCm,
    animation: (preset.animation ?? 'none') as SceneLightAnimationId,
    enabled: true,
    showMarker: true,
  }
}

export function addSceneLight(
  state: FacadeState,
  position?: Partial<Pick<SceneLight, 'x' | 'y' | 'z'>>,
  presetId?: SceneLightPresetId,
): { state: FacadeState; lightId: string } {
  const { sceneLights: lights, sceneLightGroups } = normalizeSceneLightState(state)
  const pos = defaultSceneLightPosition(state, lights.length)
  const lightId = createId()
  const fromPreset = presetId ? sceneLightFieldsFromPreset(presetId) : {}
  const next: SceneLight = normalizeSceneLight({
    id: lightId,
    ...DEFAULT_SCENE_LIGHT,
    ...fromPreset,
    ...pos,
    ...position,
    groupId: undefined,
  })
  return {
    state: { ...state, sceneLights: [...lights, next], sceneLightGroups },
    lightId,
  }
}

/** Wendet Voreinstellung auf ein bestehendes Licht an (Position bleibt). */
export function applySceneLightPreset(
  state: FacadeState,
  lightId: string,
  presetId: SceneLightPresetId,
): FacadeState {
  return updateSceneLight(state, lightId, sceneLightFieldsFromPreset(presetId))
}

export function updateSceneLight(
  state: FacadeState,
  lightId: string,
  patch: Partial<Omit<SceneLight, 'id'>>,
): FacadeState {
  const { sceneLights: lights, sceneLightGroups } = normalizeSceneLightState(state)
  const idx = lights.findIndex((item) => item.id === lightId)
  if (idx < 0) return state
  lights[idx] = normalizeSceneLight({ ...lights[idx], ...patch, id: lightId })
  return { ...state, sceneLights: lights, sceneLightGroups }
}

/** Schaltet alle Bibliotheks-Punktlichter gemeinsam ein oder aus. */
export function setAllSceneLightsEnabled(state: FacadeState, enabled: boolean): FacadeState {
  const { sceneLights: lights, sceneLightGroups } = normalizeSceneLightState(state)
  if (lights.length === 0) return state
  if (lights.every((item) => item.enabled === enabled)) return state
  return {
    ...state,
    sceneLights: lights.map((item) => normalizeSceneLight({ ...item, enabled })),
    sceneLightGroups,
  }
}

/**
 * Pro Licht gewünschten An-Zustand setzen (Sonne und/oder Schedule).
 * Unveränderte Lichter behalten manuelles `enabled`.
 */
export function setSceneLightsEnabledById(
  state: FacadeState,
  enabledById: ReadonlyMap<string, boolean>,
): FacadeState {
  if (enabledById.size === 0) return state
  const { sceneLights: lights, sceneLightGroups } = normalizeSceneLightState(state)
  if (lights.length === 0) return state
  let changed = false
  const next = lights.map((item) => {
    if (!enabledById.has(item.id)) return item
    const enabled = enabledById.get(item.id)!
    if (item.enabled === enabled) return item
    changed = true
    return normalizeSceneLight({ ...item, enabled })
  })
  if (!changed) return state
  return { ...state, sceneLights: next, sceneLightGroups }
}

export function removeSceneLight(state: FacadeState, lightId: string): FacadeState {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  const lights = sceneLights.filter((item) => item.id !== lightId)
  const groups = sceneLightGroups
    .map((group) => ({
      ...group,
      memberLightIds: group.memberLightIds.filter((id) => id !== lightId),
    }))
    .filter((group) => group.memberLightIds.length > 0)
  return { ...state, sceneLights: lights, sceneLightGroups: groups }
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
    preset: source.preset,
    beamMode: source.beamMode,
    beamAngleDownDeg: source.beamAngleDownDeg,
    beamAngleUpDeg: source.beamAngleUpDeg,
    animation: source.animation,
    groupId: undefined,
  })
  return { state: next, lightId: newId }
}

export function createSceneLightGroup(
  state: FacadeState,
  lightIds: string[],
  name = 'Lichtgruppe',
): FacadeState {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  const ids = [...new Set(lightIds.filter((id) => sceneLights.some((l) => l.id === id)))]
  if (ids.length < 2) return state
  const groupId = createId()
  const groups = [
    ...sceneLightGroups.map((group) => ({
      ...group,
      memberLightIds: group.memberLightIds.filter((id) => !ids.includes(id)),
    })),
    { id: groupId, name, memberLightIds: ids },
  ].filter((group) => group.memberLightIds.length > 0)
  const lights = sceneLights.map((light) =>
    ids.includes(light.id) ? normalizeSceneLight({ ...light, groupId }) : light,
  )
  return { ...state, sceneLights: lights, sceneLightGroups: groups }
}

export function addLightsToSceneLightGroup(
  state: FacadeState,
  groupId: string,
  lightIds: string[],
): FacadeState {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  if (!sceneLightGroups.some((g) => g.id === groupId)) return state
  const ids = [...new Set(lightIds.filter((id) => sceneLights.some((l) => l.id === id)))]
  if (ids.length === 0) return state
  const groups = sceneLightGroups
    .map((group) => {
      if (group.id === groupId) {
        return {
          ...group,
          memberLightIds: [...new Set([...group.memberLightIds, ...ids])],
        }
      }
      return {
        ...group,
        memberLightIds: group.memberLightIds.filter((id) => !ids.includes(id)),
      }
    })
    .filter((group) => group.memberLightIds.length > 0)
  const lights = sceneLights.map((light) =>
    ids.includes(light.id) ? normalizeSceneLight({ ...light, groupId }) : light,
  )
  return { ...state, sceneLights: lights, sceneLightGroups: groups }
}

export function ungroupSceneLights(state: FacadeState, lightIds: string[]): FacadeState {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  const ids = new Set(lightIds)
  if (ids.size === 0) return state
  const lights = sceneLights.map((light) =>
    ids.has(light.id) ? normalizeSceneLight({ ...light, groupId: undefined }) : light,
  )
  const groups = sceneLightGroups
    .map((group) => ({
      ...group,
      memberLightIds: group.memberLightIds.filter((id) => !ids.has(id)),
    }))
    .filter((group) => group.memberLightIds.length > 0)
  return { ...state, sceneLights: lights, sceneLightGroups: groups }
}

export function renameSceneLightGroup(
  state: FacadeState,
  groupId: string,
  name: string,
): FacadeState {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  const trimmed = name.trim() || 'Lichtgruppe'
  const groups = sceneLightGroups.map((group) =>
    group.id === groupId ? { ...group, name: trimmed } : group,
  )
  return { ...state, sceneLights, sceneLightGroups: groups }
}

export function setSceneLightGroupEnabled(
  state: FacadeState,
  groupId: string,
  enabled: boolean,
): FacadeState {
  const { sceneLights, sceneLightGroups } = normalizeSceneLightState(state)
  const group = sceneLightGroups.find((g) => g.id === groupId)
  if (!group) return state
  const memberIds = new Set(group.memberLightIds)
  return {
    ...state,
    sceneLights: sceneLights.map((light) =>
      memberIds.has(light.id) ? normalizeSceneLight({ ...light, enabled }) : light,
    ),
    sceneLightGroups,
  }
}
