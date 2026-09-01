import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_APPEARANCE, normalizeSceneAppearance } from './persistence'

describe('normalizeSceneAppearance', () => {
  it('ersetzt den alten weißen Himmel-Default durch Blau', () => {
    const next = normalizeSceneAppearance({
      background: '#ffffff',
      ground: '#ffffff',
      skyReflection: '#ffffff',
      lineStrokeScale: 1,
    })
    expect(next.skyReflection).toBe(DEFAULT_SCENE_APPEARANCE.skyReflection)
    expect(next.skyReflection).not.toBe('#ffffff')
  })

  it('lässt eine vom Nutzer gesetzte Himmelsfarbe', () => {
    const next = normalizeSceneAppearance({
      background: '#ffffff',
      ground: '#eeeeee',
      skyReflection: '#88aacc',
      lineStrokeScale: 1,
    })
    expect(next.skyReflection).toBe('#88aacc')
    expect(next.ground).toBe('#eeeeee')
  })
})
