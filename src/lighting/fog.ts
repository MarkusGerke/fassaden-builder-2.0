/**
 * Nebel in der 3D-Szene (THREE.Fog / FogExp2).
 */

export type FogType = 'linear' | 'exponential'

export interface FogSettings {
  enabled: boolean
  type: FogType
  color: string
  /** Linear: Start (cm). */
  near: number
  /** Linear: Ende (cm). */
  far: number
  /** Exponentiell: Dichte. */
  density: number
}

export const DEFAULT_FOG_SETTINGS: FogSettings = {
  enabled: false,
  type: 'linear',
  color: '#cccccc',
  near: 400,
  far: 2000,
  density: 0.0008,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

export function normalizeFogSettings(value: unknown): FogSettings {
  const base = { ...DEFAULT_FOG_SETTINGS }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    type: raw.type === 'exponential' ? 'exponential' : 'linear',
    color: isHexColor(raw.color) ? raw.color : base.color,
    near:
      typeof raw.near === 'number' && Number.isFinite(raw.near)
        ? clamp(raw.near, 1, 10000)
        : base.near,
    far:
      typeof raw.far === 'number' && Number.isFinite(raw.far)
        ? clamp(raw.far, 10, 20000)
        : base.far,
    density:
      typeof raw.density === 'number' && Number.isFinite(raw.density)
        ? clamp(raw.density, 0.00001, 0.05)
        : base.density,
  }
}

export function isFogSettings(value: unknown): value is FogSettings {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  return typeof raw.enabled === 'boolean' || typeof raw.near === 'number'
}
