import { describe, expect, it } from 'vitest'
import { buildGallerySections, galleryPanelPatterns, galleryWallLengths } from './galleryCatalog'
import { buildGalleryRandomSpecs } from './galleryRandom'
import { buildGalleryFacadeState } from './galleryState'

describe('gallery', () => {
  it('baut Abschnitte aus Katalogen', () => {
    const sections = buildGallerySections()
    expect(sections.some((s) => s.kind === 'pattern' && s.pattern === 'none')).toBe(true)
    expect(sections.some((s) => s.kind === 'opening')).toBe(true)
    expect(sections.some((s) => s.kind === 'bay')).toBe(true)
    expect(sections.at(-1)?.kind).toBe('random')
    expect(galleryWallLengths()[0]?.lengthCm).toBeLessThan(galleryWallLengths().at(-1)!.lengthCm)
    expect(galleryPanelPatterns()[0]).toBe('none')
  })

  it('erzeugt freie Studio-Wände im Raster', () => {
    const { state, spacingCm } = buildGalleryFacadeState({ spacingCm: 320, randomSeed: 42 })
    expect(spacingCm).toBe(320)
    expect(state.buildings).toHaveLength(1)
    const walls = state.buildings[0]!.walls
    expect(walls.length).toBeGreaterThan(40)
    expect(walls.every((w) => w.planLinked === false)).toBe(true)
    expect(walls.every((w) => w.kind === 'studio')).toBe(true)
    expect(state.buildings[0]!.roof?.enabled).toBe(false)
  })

  it('Zufall ist seed-stabil', () => {
    const a = buildGalleryRandomSpecs(123, 8)
    const b = buildGalleryRandomSpecs(123, 8)
    expect(a).toEqual(b)
    expect(buildGalleryRandomSpecs(999, 8)).not.toEqual(a)
  })
})
