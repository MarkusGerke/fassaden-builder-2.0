/** Abstand zwischen Galerie-Wänden und -Reihen (cm). Nur Galerie-Modus, nicht im Projekt-Save. */

export const GALLERY_SPACING_DEFAULT_CM = 320
export const GALLERY_SPACING_MIN_CM = 48
export const GALLERY_SPACING_MAX_CM = 2000
export const GALLERY_SPACING_STORAGE_KEY = 'fassaden-builder-gallery-spacing'

export function clampGallerySpacingCm(value: number): number {
  if (!Number.isFinite(value)) return GALLERY_SPACING_DEFAULT_CM
  return Math.max(GALLERY_SPACING_MIN_CM, Math.min(GALLERY_SPACING_MAX_CM, Math.round(value)))
}

export function loadGallerySpacingCm(): number {
  try {
    const raw = localStorage.getItem(GALLERY_SPACING_STORAGE_KEY)
    if (raw == null) return GALLERY_SPACING_DEFAULT_CM
    return clampGallerySpacingCm(Number(raw))
  } catch {
    return GALLERY_SPACING_DEFAULT_CM
  }
}

export function saveGallerySpacingCm(value: number): number {
  const next = clampGallerySpacingCm(value)
  try {
    localStorage.setItem(GALLERY_SPACING_STORAGE_KEY, String(next))
  } catch {
    /* ignore */
  }
  return next
}
