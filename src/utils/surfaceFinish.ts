import type { SurfaceFinish } from '../types/facade'

export type { SurfaceFinish }

export const DEFAULT_SURFACE_FINISH: SurfaceFinish = 'matte'

export const SURFACE_FINISH_OPTIONS: { id: SurfaceFinish; label: string }[] = [
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

const PRESETS: Record<SurfaceFinish, SurfaceFinishParams> = {
  matte: { roughness: 0.92, metalness: 0, envMapIntensity: 0.05, useEnvMap: false },
  glossy: { roughness: 0.14, metalness: 0.12, envMapIntensity: 1.35, useEnvMap: true },
  metal: { roughness: 0.2, metalness: 1, envMapIntensity: 1.55, useEnvMap: true },
}

export function normalizeSurfaceFinish(raw: unknown): SurfaceFinish {
  if (raw === 'glossy' || raw === 'metal') return raw
  return 'matte'
}

export function surfaceFinishParams(finish?: SurfaceFinish | null): SurfaceFinishParams {
  return PRESETS[normalizeSurfaceFinish(finish)]
}
