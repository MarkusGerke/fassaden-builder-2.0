import type { Opening } from '../types/facade'
import { DEFAULT_GLASS_COLOR } from '../constants/colorPalettes'

export interface OpeningGlassConfig {
  mode: 'tint' | 'physical'
  color: string
  ior: number
  roughness: number
  transmission: number
  thickness: number
}

/** Floatglas: IOR ~1,52, leichte Rauheit, ~1,2 cm Scheibe. Transmission 0 = echte Durchsicht. */
export const DEFAULT_GLASS_MODE: OpeningGlassConfig['mode'] = 'physical'
export const DEFAULT_GLASS_IOR = 1.52
export const DEFAULT_GLASS_ROUGHNESS = 0.03
export const DEFAULT_GLASS_TRANSMISSION = 0
export const DEFAULT_GLASS_THICKNESS_CM = 1.2
/** Klarglas von außen: dunkel getönt, Spiegelung bleibt hell (specularColor weiß). */
export const PHYSICAL_CLEAR_GLASS_COLOR = '#1a242e'
/** Alte Transmission-Defaults — unangetastet nur wenn der Nutzer abgewichen ist. */
export const PREVIOUS_GLASS_TRANSMISSION_DEFAULTS = [0.9, 0.96, 0.42] as const

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export function openingGlassConfig(
  opening: Pick<
    Opening,
    'glassColor' | 'glassMode' | 'glassIor' | 'glassRoughness' | 'glassTransmission' | 'glassThickness'
  >,
): OpeningGlassConfig {
  return {
    mode: opening.glassMode === 'tint' ? 'tint' : 'physical',
    color: opening.glassColor ?? DEFAULT_GLASS_COLOR,
    ior: clampNum(opening.glassIor, 1, 2.5, DEFAULT_GLASS_IOR),
    roughness: clampNum(opening.glassRoughness, 0, 1, DEFAULT_GLASS_ROUGHNESS),
    transmission: clampNum(opening.glassTransmission, 0, 1, DEFAULT_GLASS_TRANSMISSION),
    thickness: clampNum(opening.glassThickness, 0.1, 10, DEFAULT_GLASS_THICKNESS_CM),
  }
}

/** Legacy string or full config. */
export function resolveGlassConfig(source: string | OpeningGlassConfig): OpeningGlassConfig {
  if (typeof source === 'string') {
    return openingGlassConfig({ glassColor: source })
  }
  return source
}
