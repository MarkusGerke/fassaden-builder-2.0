/**
 * Nutzersteuerung für automatische Detail-Reduktion (LOD) in der 3D-Szene.
 */

export interface LodSimplifyFlags {
  /** Ziegel/Fugen → Fassadenplatte; Farben bleiben erhalten. */
  facadePattern: boolean
  /** Gründerzeit-Fenster → Glas + schmaler Rahmen. */
  windows: boolean
  /** Gesimse, Fensterbänke, Verdachung. */
  profiles: boolean
  /** Öffnungs-Leibungen. */
  reveals: boolean
  /** Farbige Haus-Box in der Ferne. */
  farHull: boolean
}

export interface LodThresholds {
  /** Volle Ziegel wenn Stein größer als dieser Wert (px). */
  tileHighPx: number
  /** Vereinfachte Fassade wenn Stein größer als dieser Wert (px). */
  tileMediumPx: number
  /** Nur Silhouette wenn Haus kleiner als dieser Wert (px). */
  buildingFarPx: number
}

export interface LodSettings {
  enabled: boolean
  simplify: LodSimplifyFlags
  thresholds: LodThresholds
}

export const DEFAULT_LOD_SIMPLIFY: LodSimplifyFlags = {
  facadePattern: true,
  windows: true,
  profiles: true,
  reveals: true,
  farHull: true,
}

export const DEFAULT_LOD_THRESHOLDS: LodThresholds = {
  tileHighPx: 4,
  tileMediumPx: 1,
  buildingFarPx: 30,
}

export const DEFAULT_LOD_SETTINGS: LodSettings = {
  enabled: false,
  simplify: { ...DEFAULT_LOD_SIMPLIFY },
  thresholds: { ...DEFAULT_LOD_THRESHOLDS },
}

export type LodPresetId = 'navigation' | 'balanced' | 'quality'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function normalizeSimplify(value: unknown): LodSimplifyFlags {
  const base = { ...DEFAULT_LOD_SIMPLIFY }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  return {
    facadePattern: typeof raw.facadePattern === 'boolean' ? raw.facadePattern : base.facadePattern,
    windows: typeof raw.windows === 'boolean' ? raw.windows : base.windows,
    profiles: typeof raw.profiles === 'boolean' ? raw.profiles : base.profiles,
    reveals: typeof raw.reveals === 'boolean' ? raw.reveals : base.reveals,
    farHull: typeof raw.farHull === 'boolean' ? raw.farHull : base.farHull,
  }
}

function normalizeThresholds(value: unknown): LodThresholds {
  const base = { ...DEFAULT_LOD_THRESHOLDS }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  const tileHighPx =
    typeof raw.tileHighPx === 'number' && Number.isFinite(raw.tileHighPx)
      ? clamp(raw.tileHighPx, 0.5, 64)
      : base.tileHighPx
  const tileMediumPx =
    typeof raw.tileMediumPx === 'number' && Number.isFinite(raw.tileMediumPx)
      ? clamp(raw.tileMediumPx, 0.1, tileHighPx)
      : base.tileMediumPx
  const buildingFarPx =
    typeof raw.buildingFarPx === 'number' && Number.isFinite(raw.buildingFarPx)
      ? clamp(raw.buildingFarPx, 5, 200)
      : base.buildingFarPx
  return { tileHighPx, tileMediumPx, buildingFarPx }
}

export function normalizeLodSettings(value: unknown): LodSettings {
  const base = {
    enabled: DEFAULT_LOD_SETTINGS.enabled,
    simplify: { ...DEFAULT_LOD_SIMPLIFY },
    thresholds: { ...DEFAULT_LOD_THRESHOLDS },
  }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    simplify: normalizeSimplify(raw.simplify),
    thresholds: normalizeThresholds(raw.thresholds),
  }
}

export function isLodSettings(value: unknown): value is LodSettings {
  if (!value || typeof value !== 'object') return false
  const raw = value as Record<string, unknown>
  return typeof raw.enabled === 'boolean' || raw.simplify !== undefined || raw.thresholds !== undefined
}

export function applyLodPreset(preset: LodPresetId): LodSettings {
  switch (preset) {
    case 'navigation':
      return normalizeLodSettings({
        enabled: true,
        simplify: { ...DEFAULT_LOD_SIMPLIFY },
        thresholds: { tileHighPx: 6, tileMediumPx: 2, buildingFarPx: 40 },
      })
    case 'balanced':
      return normalizeLodSettings({
        enabled: true,
        simplify: {
          facadePattern: true,
          windows: false,
          profiles: false,
          reveals: false,
          farHull: true,
        },
        thresholds: { ...DEFAULT_LOD_THRESHOLDS },
      })
    case 'quality':
    default:
      return normalizeLodSettings({ enabled: false })
  }
}
