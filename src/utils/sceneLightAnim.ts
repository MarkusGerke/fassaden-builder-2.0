/**
 * Einmalige Szenen-Animation: Tagesverlauf (Uhrzeit) oder Lichtparameter (inkl. Bloom).
 */

export type SceneAnimPlayMode = 'time' | 'light'

export type SceneLightAnimChannelId =
  | 'azimuth'
  | 'intensity'
  | 'ambient'
  | 'shadowContrast'
  | 'shadowSoftness'
  | 'colorTemperature'
  | 'bloomThreshold'
  | 'bloomStrength'
  | 'bloomRadius'
  | 'bloomExposure'

export interface SceneLightAnimChannel {
  enabled: boolean
  from: number
  to: number
}

export type SceneLightAnimChannels = Record<SceneLightAnimChannelId, SceneLightAnimChannel>

export interface SceneLightAnimChannelMeta {
  id: SceneLightAnimChannelId
  label: string
  min: number
  max: number
  step: number
  /** Nachkommastellen für Anzeige/Input. */
  digits: number
  group: 'sun' | 'bloom'
}

export const SCENE_LIGHT_ANIM_CHANNELS: SceneLightAnimChannelMeta[] = [
  { id: 'azimuth', label: 'Sonnenwinkel', min: 0, max: 360, step: 1, digits: 0, group: 'sun' },
  { id: 'intensity', label: 'Sonnenlicht', min: 0.3, max: 8, step: 0.1, digits: 1, group: 'sun' },
  { id: 'ambient', label: 'Umgebungslicht', min: 0.05, max: 1.2, step: 0.01, digits: 2, group: 'sun' },
  {
    id: 'shadowContrast',
    label: 'Schatten-Kontrast',
    min: 0.5,
    max: 10,
    step: 0.05,
    digits: 2,
    group: 'sun',
  },
  {
    id: 'shadowSoftness',
    label: 'Schatten-Weichheit',
    min: 0.5,
    max: 8,
    step: 0.5,
    digits: 1,
    group: 'sun',
  },
  {
    id: 'colorTemperature',
    label: 'Farbtemperatur',
    min: 2700,
    max: 8000,
    step: 100,
    digits: 0,
    group: 'sun',
  },
  {
    id: 'bloomThreshold',
    label: 'Bloom-Schwelle',
    min: 0,
    max: 1.2,
    step: 0.001,
    digits: 3,
    group: 'bloom',
  },
  {
    id: 'bloomStrength',
    label: 'Bloom-Stärke',
    min: 0,
    max: 1.5,
    step: 0.001,
    digits: 3,
    group: 'bloom',
  },
  { id: 'bloomRadius', label: 'Bloom-Radius', min: 0, max: 1, step: 0.001, digits: 3, group: 'bloom' },
  {
    id: 'bloomExposure',
    label: 'Bloom-Belichtung',
    min: 0.75,
    max: 1.45,
    step: 0.001,
    digits: 3,
    group: 'bloom',
  },
]

const CHANNEL_META = new Map(SCENE_LIGHT_ANIM_CHANNELS.map((c) => [c.id, c]))

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function defaultSceneLightAnimChannels(): SceneLightAnimChannels {
  const out = {} as SceneLightAnimChannels
  for (const meta of SCENE_LIGHT_ANIM_CHANNELS) {
    const mid = (meta.min + meta.max) / 2
    out[meta.id] = { enabled: false, from: mid, to: mid }
  }
  // Sinnvolle Defaults für häufig genutzte Kanäle (noch aus).
  out.azimuth = { enabled: false, from: 90, to: 270 }
  out.intensity = { enabled: false, from: 1.5, to: 3.9 }
  out.ambient = { enabled: false, from: 0.3, to: 0.53 }
  out.shadowContrast = { enabled: false, from: 1, to: 1.4 }
  out.shadowSoftness = { enabled: false, from: 2.5, to: 5 }
  out.colorTemperature = { enabled: false, from: 3200, to: 5500 }
  out.bloomThreshold = { enabled: false, from: 0.72, to: 0.5 }
  out.bloomStrength = { enabled: false, from: 0.28, to: 0.6 }
  out.bloomRadius = { enabled: false, from: 0.6, to: 0.8 }
  out.bloomExposure = { enabled: false, from: 1.116, to: 1.25 }
  return out
}

export function normalizeSceneAnimPlayMode(value: unknown): SceneAnimPlayMode {
  return value === 'light' ? 'light' : 'time'
}

export function normalizeSceneLightAnimChannels(value: unknown): SceneLightAnimChannels {
  const base = defaultSceneLightAnimChannels()
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  for (const meta of SCENE_LIGHT_ANIM_CHANNELS) {
    const entry = raw[meta.id]
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const from =
      typeof e.from === 'number' && Number.isFinite(e.from)
        ? clamp(e.from, meta.min, meta.max)
        : base[meta.id].from
    const to =
      typeof e.to === 'number' && Number.isFinite(e.to)
        ? clamp(e.to, meta.min, meta.max)
        : base[meta.id].to
    base[meta.id] = {
      enabled: e.enabled === true,
      from,
      to,
    }
  }
  return base
}

export function sceneLightAnimHasEnabledChannel(channels: SceneLightAnimChannels): boolean {
  return SCENE_LIGHT_ANIM_CHANNELS.some((m) => channels[m.id].enabled)
}

export function sceneLightAnimTouchesBloom(channels: SceneLightAnimChannels): boolean {
  return SCENE_LIGHT_ANIM_CHANNELS.some((m) => m.group === 'bloom' && channels[m.id].enabled)
}

export function lerpSceneLightAnimValue(
  channel: SceneLightAnimChannelId,
  from: number,
  to: number,
  t: number,
): number {
  const meta = CHANNEL_META.get(channel)
  const raw = from + (to - from) * t
  if (!meta) return raw
  if (channel === 'azimuth') {
    // Kürzester Weg um den Kreis (0…360).
    let delta = ((to - from) % 360 + 540) % 360 - 180
    return (((from + delta * t) % 360) + 360) % 360
  }
  const clamped = clamp(raw, meta.min, meta.max)
  if (meta.digits === 0) return Math.round(clamped)
  const f = 10 ** meta.digits
  return Math.round(clamped * f) / f
}
