/**
 * Darstellungsmodus für die 3D-Fassade (unabhängig von LOD).
 * - render: volle parametrische Geometrie (Himmel, Bloom, weiche Schatten)
 * - preview: flache Rechteck-Steine + Balken-Profile (ehem. „Arbeit“)
 * - draft: Atlas-Textur pro Wand + einfache Fenster (ehem. „Leicht“)
 */

const STORAGE_KEY = 'fassaden-builder-edit-presentation'
const MODE_STORAGE_KEY = 'fassaden-builder-presentation-mode'

export type PresentationMode = 'draft' | 'preview' | 'render'

/** @deprecated Prefer PresentationMode; kept for callers during migration. */
export interface EditPresentationSettings {
  enabled: boolean
}

export const DEFAULT_EDIT_PRESENTATION: EditPresentationSettings = {
  enabled: false,
}

export const DEFAULT_PRESENTATION_MODE: PresentationMode = 'render'

function migrateLegacyPresentationMode(raw: string | null): PresentationMode | null {
  if (raw === 'draft' || raw === 'preview' || raw === 'render') return raw
  if (raw === 'light') return 'draft'
  if (raw === 'work') return 'preview'
  if (raw === 'full') return 'render'
  return null
}

export function loadPresentationMode(): PresentationMode {
  try {
    const mode = migrateLegacyPresentationMode(localStorage.getItem(MODE_STORAGE_KEY))
    if (mode) return mode
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === '1' || raw === 'true') return 'preview'
    if (raw === '0' || raw === 'false') return 'render'
  } catch {
    /* ignore */
  }
  return DEFAULT_PRESENTATION_MODE
}

export function savePresentationMode(mode: PresentationMode): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
    // Legacy parallel (nur preview vs. rest)
    localStorage.setItem(STORAGE_KEY, mode === 'preview' ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function loadEditPresentation(): EditPresentationSettings {
  return { enabled: loadPresentationMode() === 'preview' }
}

export function saveEditPresentation(settings: EditPresentationSettings): void {
  savePresentationMode(settings.enabled ? 'preview' : 'render')
}

/** Entwurf/Vorschau: Himmel aus, harte Schatten, kein Bloom. */
export function presentationUsesWorkLikeShading(mode: PresentationMode): boolean {
  return mode === 'preview' || mode === 'draft'
}

export function presentationUsesSimpleProfiles(mode: PresentationMode): boolean {
  return mode === 'preview' || mode === 'draft'
}
