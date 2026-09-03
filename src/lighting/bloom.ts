/**
 * Unreal-Bloom-Postprocessing (three.js UnrealBloomPass).
 * Einstellungen für die 3D-Ansicht unter „Beleuchtung“.
 */

export interface BloomSettings {
  enabled: boolean
  /** Bloom-Stärke (0…1,5). */
  strength: number
  /** Bloom-Radius (0…1). */
  radius: number
  /** Luminanz-Schwelle (0…1,2) — nur hellere Bereiche blühen. */
  threshold: number
  /** Belichtung für ACES (0,75…1,45), intern als exposure³. */
  exposure: number
  /**
   * Wenn true: Bloom während Orbit/Zoom/Schwenken aus (Orbit-Lite).
   * Default false — Bloom bleibt auch bei Kamerabewegung an.
   */
  disableDuringMotion?: boolean
}

export const DEFAULT_BLOOM_SETTINGS: BloomSettings = {
  enabled: false,
  strength: 0.28,
  radius: 0.6,
  threshold: 0.72,
  exposure: 1.116,
  disableDuringMotion: false,
}

/** Tone-Mapping-Exposure — Kubik: mehr Spielraum als ^4, stärker als ^2. */
export function bloomToneMappingExposure(exposure: number): number {
  return exposure * exposure * exposure
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function normalizeBloomSettings(value: unknown): BloomSettings {
  const base = { ...DEFAULT_BLOOM_SETTINGS }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    strength:
      typeof raw.strength === 'number' && Number.isFinite(raw.strength)
        ? clamp(raw.strength, 0, 1.5)
        : base.strength,
    radius:
      typeof raw.radius === 'number' && Number.isFinite(raw.radius)
        ? clamp(raw.radius, 0, 1)
        : base.radius,
    threshold:
      typeof raw.threshold === 'number' && Number.isFinite(raw.threshold)
        ? clamp(raw.threshold, 0, 1.2)
        : base.threshold,
    exposure:
      typeof raw.exposure === 'number' && Number.isFinite(raw.exposure)
        ? clamp(raw.exposure, 0.75, 1.45)
        : base.exposure,
    disableDuringMotion:
      typeof raw.disableDuringMotion === 'boolean'
        ? raw.disableDuringMotion
        : base.disableDuringMotion,
  }
}

export function isBloomSettings(value: unknown): value is BloomSettings {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  return typeof raw.enabled === 'boolean' || typeof raw.strength === 'number'
}
