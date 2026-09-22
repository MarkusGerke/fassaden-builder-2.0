/**
 * Schneefall / Winterwetter — Szenen-Einstellungen (Persistenz ohne Deckenhöhe).
 *
 * Vertrag: Partikel (Fall + liegen) + Decken-Maske (Neigung ≤ ~15° + Himmelssicht),
 * Dicke nur Boden/Dach; Temp-Slider; Render+3D; Qualität niedrig/hoch.
 */

export type SnowQuality = 'low' | 'high'

export interface SnowWeatherSettings {
  enabled: boolean
  /** Lufttemperatur in °C (−20…20). */
  temperatureC: number
  /** Niederschlagsstärke 0…1. */
  intensity: number
  quality: SnowQuality
}

export const SNOW_TEMP_MIN_C = -20
export const SNOW_TEMP_MAX_C = 20
export const SNOW_INTENSITY_MIN = 0
export const SNOW_INTENSITY_MAX = 1

/** Max. Neigung gegen Horizontal, darüber kaum Schnee (Q7 ≈ 15°). */
export const SNOW_MAX_SLOPE_DEG = 15

export const DEFAULT_SNOW_WEATHER_SETTINGS: SnowWeatherSettings = {
  enabled: false,
  temperatureC: -2,
  intensity: 0.55,
  quality: 'low',
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeSnowWeatherSettings(value: unknown): SnowWeatherSettings {
  const base = { ...DEFAULT_SNOW_WEATHER_SETTINGS }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  const quality: SnowQuality = raw.quality === 'high' ? 'high' : 'low'
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    temperatureC: clamp(
      finiteOr(raw.temperatureC, base.temperatureC),
      SNOW_TEMP_MIN_C,
      SNOW_TEMP_MAX_C,
    ),
    intensity: clamp(
      finiteOr(raw.intensity, base.intensity),
      SNOW_INTENSITY_MIN,
      SNOW_INTENSITY_MAX,
    ),
    quality,
  }
}

export function isSnowWeatherSettings(value: unknown): value is SnowWeatherSettings {
  if (!value || typeof value !== 'object') return false
  return typeof (value as Record<string, unknown>).enabled === 'boolean'
}

/** Flocken-Durchmesser in Szenen-cm (Weltmaß, Q4A). */
export const SNOW_FLAKE_SIZE_CM = 5

/** Partikelzahl: niedrig ~6,5k, hoch ~28k — Orbit kürzt nicht (Q3A). */
export function snowParticleBudget(quality: SnowQuality): {
  count: number
  spawnPerSec: number
} {
  if (quality === 'high') return { count: 28_000, spawnPerSec: 7200 }
  return { count: 6500, spawnPerSec: 1800 }
}

/**
 * Akkumulation: bei T≤0 und Intensität > 0 wächst die Decke.
 * Bei intensity 0,55 / −2 °C ≈ 0→1 in ~50 s.
 */
export function snowAccumulateRatePerSec(temperatureC: number, intensity: number): number {
  if (temperatureC > 0.05) return 0
  const cold = clamp((-temperatureC) / 8, 0.35, 1.25)
  return Math.max(0, intensity) * 0.1 * cold
}

/**
 * Schmelze: bei T>0 — „binnen Sekunden“ bei klar über 0.
 * +1 °C ≈ 8 s für volle Decke; +5 °C ≈ 2 s.
 */
export function snowMeltRatePerSec(temperatureC: number): number {
  if (temperatureC <= 0) return 0
  const t = clamp(temperatureC, 0, 12)
  return 0.08 + t * t * 0.018
}

/**
 * Pfützen-Crossfade (Q8C): kalt/verschneit → Pfützen weg;
 * warm/schmelzend → Pfützen stärker sichtbar.
 */
export function snowPuddleStrengthScale(cover: number, temperatureC: number): number {
  const c = clamp(cover, 0, 1)
  const meltWarm = clamp(temperatureC / 6, 0, 1)
  const wetFromMelt = c > 0.02 && temperatureC > 0 ? clamp(c * 0.55 + meltWarm * 0.35, 0, 1) : 0
  const snowHide = 1 - c * (1 - 0.15 * meltWarm)
  return clamp(Math.max(snowHide, wetFromMelt * 0.85), 0, 1)
}

/** Sonne etwas dämpfen, Diffus höher (Q10B). */
export function snowOvercastFactors(enabled: boolean, intensity: number, cover: number): {
  sunMul: number
  hemiMul: number
} {
  if (!enabled) return { sunMul: 1, hemiMul: 1 }
  const w = clamp(0.35 + intensity * 0.4 + cover * 0.25, 0, 1)
  return {
    sunMul: 1 - 0.45 * w,
    hemiMul: 1 + 0.35 * w,
  }
}

export const SNOW_MAX_SLOPE_COS = Math.cos((SNOW_MAX_SLOPE_DEG * Math.PI) / 180)
