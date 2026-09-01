import type { OpeningTrimConfig } from '../types/facade'
import type { ProfileSectionPoint } from '../profiles/types'

/** Native Ausdehnung eines Profilquerschnitts (cm). */
export function profileSectionNativeExtents(section: ProfileSectionPoint[]): {
  outward: number
  forward: number
} {
  let outward = 0
  let forward = 0
  for (const point of section) {
    if (point.outward > outward) outward = point.outward
    if (point.forward > forward) forward = point.forward
  }
  return { outward, forward }
}

/**
 * Querschnitt-Skalierung aus Trim: absolute cm (`extentOutCm` / `extentForwardCm`)
 * haben Vorrang vor dem Faktor `scale`.
 */
export function trimSectionScales(
  trim: Pick<OpeningTrimConfig, 'scale' | 'extentOutCm' | 'extentForwardCm'> | undefined,
  section: ProfileSectionPoint[],
): { outward: number; forward: number } {
  const native = profileSectionNativeExtents(section)
  const factor =
    Number.isFinite(trim?.scale) && (trim!.scale as number) > 0 ? (trim!.scale as number) : 1
  const outward =
    Number.isFinite(trim?.extentOutCm) &&
    (trim!.extentOutCm as number) > 0 &&
    native.outward > 1e-6
      ? (trim!.extentOutCm as number) / native.outward
      : factor
  const forward =
    Number.isFinite(trim?.extentForwardCm) &&
    (trim!.extentForwardCm as number) > 0 &&
    native.forward > 1e-6
      ? (trim!.extentForwardCm as number) / native.forward
      : outward
  return { outward, forward }
}

/** Effektive Outward-Höhe in cm (für Verdachungs-Anhebung). */
export function trimOutwardExtentCm(
  trim: Pick<OpeningTrimConfig, 'scale' | 'extentOutCm'> | undefined,
  section: ProfileSectionPoint[],
): number {
  if (Number.isFinite(trim?.extentOutCm) && (trim!.extentOutCm as number) > 0) {
    return trim!.extentOutCm as number
  }
  const native = profileSectionNativeExtents(section)
  const factor =
    Number.isFinite(trim?.scale) && (trim!.scale as number) > 0 ? (trim!.scale as number) : 1
  return native.outward * factor
}
