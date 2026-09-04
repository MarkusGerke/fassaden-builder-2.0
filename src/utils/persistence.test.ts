import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_APPEARANCE, normalizeSceneAppearance } from './persistence'

describe('normalizeSceneAppearance', () => {
  it('ersetzt alte Szene-Defaults durch #555555', () => {
    const next = normalizeSceneAppearance({
      background: '#ffffff',
      ground: '#ffffff',
      skyReflection: '#3A6084',
      lineStrokeScale: 1,
    })
    expect(next.background).toBe('#555555')
    expect(next.ground).toBe('#555555')
    expect(next.skyReflection).toBe('#555555')
  })

  it('migriert auch den früheren weißen Himmel-Default', () => {
    const next = normalizeSceneAppearance({
      background: '#ffffff',
      ground: '#ffffff',
      skyReflection: '#ffffff',
      lineStrokeScale: 1,
    })
    expect(next).toEqual({ ...DEFAULT_SCENE_APPEARANCE })
  })

  it('lässt vom Nutzer gesetzte Farben', () => {
    const next = normalizeSceneAppearance({
      background: '#112233',
      ground: '#eeeeee',
      skyReflection: '#88aacc',
      lineStrokeScale: 1,
    })
    expect(next.background).toBe('#112233')
    expect(next.skyReflection).toBe('#88aacc')
    expect(next.ground).toBe('#eeeeee')
  })
})
