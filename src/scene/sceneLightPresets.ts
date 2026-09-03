/**
 * Voreinstellungen und Abstrahlmuster für Bibliotheks-Lichter.
 * Omni → PointLight; down/up/upDown → SpotLight(s) entlang ±Y.
 */

import type { SceneLightAnimationId } from './sceneLightAnimation'

export type SceneLightPresetId =
  | 'laterne'
  | 'deckenlampe'
  | 'stehlampe'
  | 'leselampe'
  | 'fassadenlampe'
  | 'blaulicht'

/** Abstrahlung relativ zur Welt-Hochachse (Y). */
export type SceneLightBeamMode = 'omni' | 'down' | 'up' | 'upDown'

export interface SceneLightPresetDef {
  id: SceneLightPresetId
  label: string
  /** Kurzer Hinweis für Karte / Toolbar. */
  hint: string
  beamMode: SceneLightBeamMode
  /** Spot-Halbwinkel nach unten (°), 10…90. */
  beamAngleDownDeg: number
  /** Spot-Halbwinkel nach oben (°), 10…90. */
  beamAngleUpDeg: number
  colorTemperature: number
  /** Feste Hex-Farbe (überschreibt Kelvin), z. B. Blaulicht. */
  colorHex?: string
  intensity: number
  distance: number
  decay: number
  castShadow: boolean
  markerSizeCm: number
  /** Default-Animation beim Einfügen aus diesem Preset. */
  animation?: SceneLightAnimationId
}

export const SCENE_LIGHT_PRESETS: readonly SceneLightPresetDef[] = [
  {
    id: 'laterne',
    label: 'Laterne',
    hint: 'Rundum, warm — Hof / Eingang',
    beamMode: 'omni',
    beamAngleDownDeg: 70,
    beamAngleUpDeg: 50,
    colorTemperature: 2200,
    intensity: 18,
    distance: 900,
    decay: 2,
    castShadow: true,
    markerSizeCm: 36,
  },
  {
    id: 'deckenlampe',
    label: 'Deckenlampe',
    hint: 'Nach unten, breit',
    beamMode: 'down',
    beamAngleDownDeg: 68,
    beamAngleUpDeg: 40,
    colorTemperature: 3000,
    intensity: 24,
    distance: 700,
    decay: 2,
    castShadow: true,
    markerSizeCm: 32,
  },
  {
    id: 'stehlampe',
    label: 'Stehlampe',
    hint: 'Oben + unten (Indirekt)',
    beamMode: 'upDown',
    beamAngleDownDeg: 55,
    beamAngleUpDeg: 72,
    colorTemperature: 2700,
    intensity: 20,
    distance: 600,
    decay: 2,
    castShadow: true,
    markerSizeCm: 40,
  },
  {
    id: 'leselampe',
    label: 'Leselampe',
    hint: 'Eng nach unten',
    beamMode: 'down',
    beamAngleDownDeg: 32,
    beamAngleUpDeg: 25,
    colorTemperature: 3000,
    intensity: 12,
    distance: 350,
    decay: 2,
    castShadow: true,
    markerSizeCm: 28,
  },
  {
    id: 'fassadenlampe',
    label: 'Fassadenlampe',
    hint: 'Wandfluter nach unten',
    beamMode: 'down',
    beamAngleDownDeg: 48,
    beamAngleUpDeg: 30,
    colorTemperature: 3500,
    intensity: 30,
    distance: 1200,
    decay: 1.8,
    castShadow: true,
    markerSizeCm: 36,
  },
  {
    id: 'blaulicht',
    label: 'Blaulicht',
    hint: 'Einsatz — Doppelblitz ~2 Hz',
    beamMode: 'omni',
    beamAngleDownDeg: 70,
    beamAngleUpDeg: 50,
    colorTemperature: 6500,
    colorHex: '#0a3dff',
    intensity: 36,
    distance: 900,
    decay: 2,
    castShadow: false,
    markerSizeCm: 44,
    animation: 'blaulicht',
  },
] as const

export const SCENE_LIGHT_BEAM_MODE_LABELS: Record<SceneLightBeamMode, string> = {
  omni: 'Alle Richtungen',
  down: 'Nur nach unten',
  up: 'Nur nach oben',
  upDown: 'Unten und oben',
}

export const BEAM_ANGLE_MIN_DEG = 10
export const BEAM_ANGLE_MAX_DEG = 90
export const DEFAULT_BEAM_ANGLE_DOWN_DEG = 60
export const DEFAULT_BEAM_ANGLE_UP_DEG = 55

export function sceneLightPresetById(id: string | undefined): SceneLightPresetDef | undefined {
  if (!id) return undefined
  return SCENE_LIGHT_PRESETS.find((item) => item.id === id)
}

export function normalizeBeamMode(raw: unknown): SceneLightBeamMode {
  if (raw === 'down' || raw === 'up' || raw === 'upDown' || raw === 'omni') return raw
  return 'omni'
}

export function normalizeBeamAngleDeg(raw: unknown, fallback: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  return Math.min(BEAM_ANGLE_MAX_DEG, Math.max(BEAM_ANGLE_MIN_DEG, raw))
}

export function normalizePresetId(raw: unknown): SceneLightPresetId | undefined {
  if (typeof raw !== 'string') return undefined
  return SCENE_LIGHT_PRESETS.some((item) => item.id === raw)
    ? (raw as SceneLightPresetId)
    : undefined
}
