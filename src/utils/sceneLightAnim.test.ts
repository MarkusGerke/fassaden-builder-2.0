import { describe, expect, it } from 'vitest'
import {
  defaultSceneLightAnimChannels,
  lerpSceneLightAnimValue,
  normalizeSceneAnimPlayMode,
  normalizeSceneLightAnimChannels,
  sceneLightAnimHasEnabledChannel,
} from './sceneLightAnim'
import { lerpTimeOfDayHours } from './sunLighting'

describe('sceneLightAnim', () => {
  it('normalisiert Play-Modus', () => {
    expect(normalizeSceneAnimPlayMode('light')).toBe('light')
    expect(normalizeSceneAnimPlayMode('time')).toBe('time')
    expect(normalizeSceneAnimPlayMode('x')).toBe('time')
  })

  it('erkennt aktivierte Kanäle', () => {
    const channels = defaultSceneLightAnimChannels()
    expect(sceneLightAnimHasEnabledChannel(channels)).toBe(false)
    channels.azimuth.enabled = true
    expect(sceneLightAnimHasEnabledChannel(channels)).toBe(true)
  })

  it('interpoliert Azimut über den kürzesten Weg', () => {
    expect(lerpSceneLightAnimValue('azimuth', 350, 10, 0.5)).toBeCloseTo(0, 5)
  })

  it('klammert Bloom-Werte', () => {
    const channels = normalizeSceneLightAnimChannels({
      bloomStrength: { enabled: true, from: -1, to: 9 },
    })
    expect(channels.bloomStrength.from).toBe(0)
    expect(channels.bloomStrength.to).toBe(1.5)
  })
})

describe('lerpTimeOfDayHours', () => {
  it('interpoliert über Mitternacht wenn Bis < Von', () => {
    expect(lerpTimeOfDayHours(22, 2, 0.5)).toBeCloseTo(0, 5)
  })

  it('interpoliert tagsüber linear', () => {
    expect(lerpTimeOfDayHours(6, 18, 0.5)).toBeCloseTo(12, 5)
  })
})
