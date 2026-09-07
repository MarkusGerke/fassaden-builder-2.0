/** Oberflächen-Anteile 0–100 (Stumpf / Glänzend / Metallisch), gemischt. */
export interface SurfaceFinish {
  matte: number
  glossy: number
  metal: number
}

/** Legacy-Einzelwahl / Select-Wert (dominanter Anteil). */
export type SurfaceFinishPreset = 'matte' | 'glossy' | 'metal'

export const DEFAULT_SURFACE_FINISH: SurfaceFinish = { matte: 100, glossy: 0, metal: 0 }

export const SURFACE_FINISH_OPTIONS: { id: SurfaceFinishPreset; label: string }[] = [
  { id: 'matte', label: 'Stumpf' },
  { id: 'glossy', label: 'Glänzend' },
  { id: 'metal', label: 'Metallisch' },
]

export interface SurfaceFinishParams {
  roughness: number
  metalness: number
  envMapIntensity: number
  /** EnvMap am Material (Studio-RoomEnvironment, kein HDRI). */
  useEnvMap: boolean
}

const PRESETS: Record<SurfaceFinishPreset, SurfaceFinishParams> = {
  matte: { roughness: 0.92, metalness: 0, envMapIntensity: 0.05, useEnvMap: false },
  glossy: { roughness: 0.14, metalness: 0.12, envMapIntensity: 1.35, useEnvMap: true },
  metal: { roughness: 0.2, metalness: 1, envMapIntensity: 1.55, useEnvMap: true },
}

export function clampFinishAxis(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function surfaceFinishFromPreset(id: SurfaceFinishPreset): SurfaceFinish {
  if (id === 'glossy') return { matte: 0, glossy: 100, metal: 0 }
  if (id === 'metal') return { matte: 0, glossy: 0, metal: 100 }
  return { ...DEFAULT_SURFACE_FINISH }
}

/** Alt-String, Mix-Objekt oder fehlend → kanonischer Mix. */
export function normalizeSurfaceFinish(raw: unknown): SurfaceFinish {
  if (raw === 'glossy' || raw === 'metal' || raw === 'matte') {
    return surfaceFinishFromPreset(raw)
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>
    return {
      matte: clampFinishAxis(record.matte),
      glossy: clampFinishAxis(record.glossy),
      metal: clampFinishAxis(record.metal),
    }
  }
  return { ...DEFAULT_SURFACE_FINISH }
}

/** Optional-Feld: fehlt → undefined (Vererbung); sonst Mix. */
export function optionalSurfaceFinish(raw: unknown): SurfaceFinish | undefined {
  if (raw == null || raw === '') return undefined
  if (raw === 'glossy' || raw === 'metal' || raw === 'matte') {
    return surfaceFinishFromPreset(raw)
  }
  if (typeof raw === 'object') return normalizeSurfaceFinish(raw)
  return undefined
}

/** Select / Legacy: stärkster Anteil (bei Gleichstand Metall > Glanz > Stumpf wenn > 0). */
export function surfaceFinishPresetId(
  finish?: SurfaceFinish | SurfaceFinishPreset | null,
): SurfaceFinishPreset {
  const mix = normalizeSurfaceFinish(finish)
  const { matte, glossy, metal } = mix
  if (metal >= glossy && metal >= matte && metal > 0) return 'metal'
  if (glossy >= matte && glossy > 0) return 'glossy'
  return 'matte'
}

export function surfaceFinishWeights(
  finish?: SurfaceFinish | SurfaceFinishPreset | null,
): { matte: number; glossy: number; metal: number } {
  const mix = normalizeSurfaceFinish(finish)
  const sum = mix.matte + mix.glossy + mix.metal
  if (sum <= 0) return { matte: 1, glossy: 0, metal: 0 }
  return {
    matte: mix.matte / sum,
    glossy: mix.glossy / sum,
    metal: mix.metal / sum,
  }
}

export function surfaceFinishParams(
  finish?: SurfaceFinish | SurfaceFinishPreset | null,
): SurfaceFinishParams {
  const w = surfaceFinishWeights(finish)
  const roughness =
    PRESETS.matte.roughness * w.matte +
    PRESETS.glossy.roughness * w.glossy +
    PRESETS.metal.roughness * w.metal
  const metalness =
    PRESETS.matte.metalness * w.matte +
    PRESETS.glossy.metalness * w.glossy +
    PRESETS.metal.metalness * w.metal
  const envMapIntensity =
    PRESETS.matte.envMapIntensity * w.matte +
    PRESETS.glossy.envMapIntensity * w.glossy +
    PRESETS.metal.envMapIntensity * w.metal
  return {
    roughness,
    metalness,
    envMapIntensity,
    useEnvMap: w.glossy + w.metal > 0.02,
  }
}

export function surfaceFinishUsesEnv(
  finish?: SurfaceFinish | SurfaceFinishPreset | null,
): boolean {
  return surfaceFinishParams(finish).useEnvMap
}
