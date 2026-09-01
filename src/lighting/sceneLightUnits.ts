/** LED-Lichtstrom (lm/W) — typische warmweiße LED-Lampe. */
export const LED_LUMENS_PER_WATT = 80

/**
 * Szene in cm: inverse-square-Falloff braucht Faktor 100² gegenüber Metern,
 * damit Watt-Werte wie im Alltag wirken.
 */
export const CM_INTENSITY_SCALE = 10_000

export const POWER_WATTS_MIN = 1
export const POWER_WATTS_MAX = 150
export const DEFAULT_POWER_WATTS = 12

/** Alte Saves: rohe Three.js-Intensität (≥500) → Watt umrechnen. */
export const LEGACY_INTENSITY_THRESHOLD = 500

/** Three.js PointLight-Intensität aus Leistung in Watt (LED). */
export function wattsToThreeIntensity(watts: number): number {
  if (watts <= 0) return 0
  const lumens = watts * LED_LUMENS_PER_WATT
  const candela = lumens / (4 * Math.PI)
  return candela * CM_INTENSITY_SCALE
}

/** Rückrechnung für Migration alter Projekte. */
export function threeIntensityToWatts(threeIntensity: number): number {
  if (threeIntensity <= 0) return 0
  const candela = threeIntensity / CM_INTENSITY_SCALE
  const lumens = candela * (4 * Math.PI)
  return lumens / LED_LUMENS_PER_WATT
}

/** Persistierte Leistung in Watt (migriert Legacy-Intensität). */
export function normalizePowerWatts(raw: number): number {
  const v = Number.isFinite(raw) ? Math.max(0, raw) : DEFAULT_POWER_WATTS
  if (v <= 0) return 0
  if (v > LEGACY_INTENSITY_THRESHOLD) {
    const migrated = threeIntensityToWatts(v)
    return Math.min(POWER_WATTS_MAX, Math.max(POWER_WATTS_MIN, Math.round(migrated)))
  }
  return Math.min(POWER_WATTS_MAX, Math.max(POWER_WATTS_MIN, Math.round(v)))
}

/** Marker-Helligkeit aus Watt — Farbe bleibt getrennt (kein Ausbleichen). */
export function markerGlowBrightness(watts: number, selected = false): number {
  const base = 0.75 + Math.sqrt(Math.max(1, watts) / DEFAULT_POWER_WATTS) * 0.35
  return selected ? Math.min(2.4, base + 0.45) : Math.min(2, base)
}
