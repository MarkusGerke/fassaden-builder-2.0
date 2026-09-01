import type { WallLengthPreset, WallOpeningPreset } from '../constants/presets'
import type { BayWindowPreset } from '../studio/bayWindow'
import type { StudioPanelPattern } from '../types/facade'
import {
  galleryBayPresets,
  galleryOpeningPresets,
  galleryPanelPatterns,
  galleryWallLengths,
} from './galleryCatalog'

export const GALLERY_RANDOM_COUNT = 12

export type GalleryRandomKind = 'plain' | 'opening' | 'bay'

export interface GalleryRandomSpec {
  lengthCm: number
  pattern: StudioPanelPattern
  kind: GalleryRandomKind
  openingPreset?: WallOpeningPreset
  bayPreset?: BayWindowPreset
}

/** Einfacher deterministischer PRNG (mulberry32). */
export function createGalleryRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length]!
}

export function newGalleryRandomSeed(): number {
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0
}

/**
 * N Zufallsvarianten aus denselben Katalogen wie die systematischen Reihen.
 * Öffnung nur wenn die Wand lang genug ist; sonst plain oder Erker.
 */
export function buildGalleryRandomSpecs(seed: number, count = GALLERY_RANDOM_COUNT): GalleryRandomSpec[] {
  const rng = createGalleryRng(seed)
  const lengths = galleryWallLengths()
  const patterns = galleryPanelPatterns().filter((p) => p !== 'none')
  const openings = galleryOpeningPresets()
  const bays = galleryBayPresets()
  const out: GalleryRandomSpec[] = []

  for (let i = 0; i < count; i += 1) {
    const length = pick(rng, lengths)
    const pattern = pick(rng, patterns.length > 0 ? patterns : galleryPanelPatterns())
    const roll = rng()
    if (roll < 0.35) {
      const fitting = openings.filter((o) => o.width + 32 <= length.lengthCm)
      if (fitting.length > 0) {
        out.push({
          lengthCm: length.lengthCm,
          pattern,
          kind: 'opening',
          openingPreset: pick(rng, fitting),
        })
        continue
      }
    }
    if (roll < 0.55) {
      const fitting = bays.filter((b) => b.frontWidthCm + 32 <= length.lengthCm)
      if (fitting.length > 0) {
        out.push({
          lengthCm: length.lengthCm,
          pattern,
          kind: 'bay',
          bayPreset: pick(rng, fitting),
        })
        continue
      }
    }
    out.push({
      lengthCm: length.lengthCm,
      pattern,
      kind: 'plain',
    })
  }

  return out
}

export function galleryRandomLengthOptions(): WallLengthPreset[] {
  return galleryWallLengths()
}
