import { describe, expect, it } from 'vitest'
import {
  BLAULICHT_CYCLE_MS,
  BLAULICHT_DARK_FACTOR,
  BLAULICHT_FLASH2_ON_MS,
  BLAULICHT_FLASH_GAP_MS,
  BLAULICHT_FLASH_ON_MS,
  blaulichtFlashDurationMs,
  blaulichtPhaseOffsetMs,
  blaulichtPhaseOffsetsById,
  normalizeSceneLightAnimation,
  sceneLightAnimationFactor,
  sceneLightAnimationFactorWhenLit,
  sceneLightsNeedLiveFrames,
} from './sceneLightAnimation'

describe('sceneLightAnimation', () => {
  it('normalisiert unbekannte Werte auf none', () => {
    expect(normalizeSceneLightAnimation(undefined)).toBe('none')
    expect(normalizeSceneLightAnimation('foo')).toBe('none')
    expect(normalizeSceneLightAnimation('blaulicht')).toBe('blaulicht')
  })

  it('verlängert Blitze bei niedriger FPS', () => {
    expect(blaulichtFlashDurationMs(16)).toBe(BLAULICHT_FLASH_ON_MS)
    expect(blaulichtFlashDurationMs(170)).toBeGreaterThan(BLAULICHT_FLASH_ON_MS)
    expect(sceneLightAnimationFactor('blaulicht', 80, 0, 170)).toBe(1)
    expect(sceneLightAnimationFactor('blaulicht', 360, 0, 170)).toBe(BLAULICHT_DARK_FACTOR)
  })

  it('Blaulicht: Doppelblitz mit langer Dunkelphase', () => {
    expect(sceneLightAnimationFactor('none', 0)).toBe(1)
    expect(sceneLightAnimationFactor('blaulicht', 0)).toBe(1)
    expect(sceneLightAnimationFactor('blaulicht', BLAULICHT_FLASH_ON_MS - 1)).toBe(1)
    expect(sceneLightAnimationFactor('blaulicht', BLAULICHT_FLASH_ON_MS + 1)).toBe(
      BLAULICHT_DARK_FACTOR,
    )
    const flash2Start = BLAULICHT_FLASH_ON_MS + BLAULICHT_FLASH_GAP_MS
    expect(sceneLightAnimationFactor('blaulicht', flash2Start)).toBe(1)
    expect(
      sceneLightAnimationFactor('blaulicht', flash2Start + BLAULICHT_FLASH2_ON_MS + 1),
    ).toBe(BLAULICHT_DARK_FACTOR)
    expect(sceneLightAnimationFactor('blaulicht', BLAULICHT_CYCLE_MS - 1)).toBe(
      BLAULICHT_DARK_FACTOR,
    )
    expect(sceneLightAnimationFactor('blaulicht', BLAULICHT_CYCLE_MS)).toBe(1)
  })

  it('verteilt Phasen gleichmäßig auf mehrere Blaulichter', () => {
    expect(blaulichtPhaseOffsetMs(0, 1)).toBe(0)
    expect(blaulichtPhaseOffsetMs(0, 2)).toBe(0)
    expect(blaulichtPhaseOffsetMs(1, 2)).toBe(BLAULICHT_CYCLE_MS / 2)
    expect(blaulichtPhaseOffsetMs(1, 3)).toBeCloseTo(BLAULICHT_CYCLE_MS / 3)
    const map = blaulichtPhaseOffsetsById([
      { id: 'a', animation: 'blaulicht', enabled: true },
      { id: 'b', animation: 'blaulicht', enabled: true },
      { id: 'c', animation: 'none', enabled: true },
      { id: 'd', animation: 'blaulicht', enabled: false },
    ])
    expect(map.get('a')).toBe(0)
    expect(map.get('b')).toBe(BLAULICHT_CYCLE_MS / 2)
    expect(map.has('c')).toBe(false)
    expect(map.has('d')).toBe(false)
    // Versatz: Licht B ist hell wenn A dunkel (Mitte des Zyklus)
    expect(sceneLightAnimationFactor('blaulicht', 0, map.get('a'))).toBe(1)
    expect(sceneLightAnimationFactor('blaulicht', 0, map.get('b'))).toBe(BLAULICHT_DARK_FACTOR)
  })

  it('kein Blink-Muster beim Ausblenden (enabled aus)', () => {
    expect(sceneLightAnimationFactorWhenLit(false, 'blaulicht', 0)).toBe(1)
    expect(sceneLightAnimationFactorWhenLit(false, 'blaulicht', 200)).toBe(1)
    expect(sceneLightAnimationFactorWhenLit(true, 'blaulicht', 200)).toBe(BLAULICHT_DARK_FACTOR)
  })

  it('erkennt Live-Frames nur bei aktivem Blinken', () => {
    expect(sceneLightsNeedLiveFrames([])).toBe(false)
    expect(sceneLightsNeedLiveFrames([{ animation: 'blaulicht', enabled: true }])).toBe(true)
    expect(sceneLightsNeedLiveFrames([{ animation: 'blaulicht', enabled: false }])).toBe(false)
    expect(sceneLightsNeedLiveFrames([{ animation: 'none', enabled: true }])).toBe(false)
  })
})
