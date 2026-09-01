/**
 * Abschnittsliste der Galerie — nur Imports aus Preset-/Pattern-Katalogen.
 * Neue Presets erscheinen automatisch, ohne Hardcodes hier.
 */
import {
  WALL_LENGTH_PRESETS,
  WALL_OPENING_PRESETS,
  type WallLengthPreset,
  type WallOpeningPreset,
} from '../constants/presets'
import { BAY_WINDOW_PRESETS, type BayWindowPreset } from '../studio/bayWindow'
import { PATTERN_LABELS } from '../studio/constants'
import type { StudioPanelPattern } from '../types/facade'

export type GallerySectionKind = 'pattern' | 'opening' | 'bay' | 'random'

export interface GallerySection {
  kind: GallerySectionKind
  id: string
  title: string
  /** Paneelmuster für pattern-/opening-Reihen */
  pattern?: StudioPanelPattern
  openingPreset?: WallOpeningPreset
  bayPreset?: BayWindowPreset
}

/** Alle Muster in stabiler Katalog-Reihenfolge (none zuerst). */
export function galleryPanelPatterns(): StudioPanelPattern[] {
  return Object.keys(PATTERN_LABELS) as StudioPanelPattern[]
}

export function galleryWallLengths(): WallLengthPreset[] {
  return [...WALL_LENGTH_PRESETS].sort((a, b) => a.lengthCm - b.lengthCm)
}

export function galleryOpeningPresets(): WallOpeningPreset[] {
  return [...WALL_OPENING_PRESETS]
}

export function galleryBayPresets(): BayWindowPreset[] {
  return [...BAY_WINDOW_PRESETS]
}

/** Systematische Abschnitte vor dem Zufallsblock. */
export function buildGallerySections(): GallerySection[] {
  const sections: GallerySection[] = []

  for (const pattern of galleryPanelPatterns()) {
    sections.push({
      kind: 'pattern',
      id: `pattern-${pattern}`,
      title: `Stil: ${PATTERN_LABELS[pattern]}`,
      pattern,
    })
  }

  for (const preset of galleryOpeningPresets()) {
    sections.push({
      kind: 'opening',
      id: `opening-${preset.id}`,
      title: `Öffnung: ${preset.label}`,
      pattern: 'strip',
      openingPreset: preset,
    })
  }

  for (const preset of galleryBayPresets()) {
    sections.push({
      kind: 'bay',
      id: `bay-${preset.id}`,
      title: `Erker: ${preset.label}`,
      pattern: 'strip',
      bayPreset: preset,
    })
  }

  sections.push({
    kind: 'random',
    id: 'random',
    title: 'Zufall',
  })

  return sections
}
