import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { resolveCelestialState, skyPaletteFromCelestial } from './celestialSky'
import { bounceDirectionFromKey, resolveLightingMood } from './lightingMood'
import { DEFAULT_SUN_SETTINGS } from './sunLighting'
import { dayOfYearFromMonthDay, solarPosition } from './solar'

describe('lightingMood', () => {
  it('Tag: Bounce ist aktiv', () => {
    const celestial = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 21,
      timeOfDay: 12,
    })
    const palette = skyPaletteFromCelestial(celestial, '#3a6084', '#c8c8c8', '#e8e8e8')
    const mood = resolveLightingMood(
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 12 },
      celestial,
      palette,
      '#c8c8c8',
    )
    expect(mood.bounceIntensity).toBeGreaterThan(0.1)
    expect(mood.keyShadowSoftness).toBeGreaterThan(0.5)
  })

  it('Nacht: Bounce nahe null', () => {
    const solar = solarPosition(dayOfYearFromMonthDay(12, 21), 23)
    const celestial = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 12,
      day: 21,
      timeOfDay: 23,
      azimuth: solar.azimuthDeg,
      elevationRad: solar.elevationRad,
    })
    const palette = skyPaletteFromCelestial(celestial, '#3a6084', '#888', '#666')
    const mood = resolveLightingMood(
      {
        ...DEFAULT_SUN_SETTINGS,
        month: 12,
        day: 21,
        timeOfDay: 23,
        azimuth: solar.azimuthDeg,
        elevationRad: solar.elevationRad,
      },
      celestial,
      palette,
      '#888',
    )
    expect(mood.bounceIntensity).toBeLessThan(0.15)
  })

  it('shadowDensity erhöht Umbra', () => {
    const celestial = resolveCelestialState({ ...DEFAULT_SUN_SETTINGS, timeOfDay: 12 })
    const palette = skyPaletteFromCelestial(celestial, '#3a6084', '#aaa', '#aaa')
    const low = resolveLightingMood(
      { ...DEFAULT_SUN_SETTINGS, shadowDensity: 0.1 },
      celestial,
      palette,
      '#aaa',
    )
    const high = resolveLightingMood(
      { ...DEFAULT_SUN_SETTINGS, shadowDensity: 0.95 },
      celestial,
      palette,
      '#aaa',
    )
    expect(high.shadowUmbraStrength).toBeGreaterThan(low.shadowUmbraStrength)
  })

  it('Boden-Ambient folgt Sonnenfarbe, nicht Zenith-Blau', () => {
    const celestial = resolveCelestialState({ ...DEFAULT_SUN_SETTINGS, timeOfDay: 12 })
    const palette = skyPaletteFromCelestial(celestial, '#3a6084', '#e8e0d8', '#ffffff')
    const mood = resolveLightingMood(
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 12 },
      celestial,
      palette,
      '#e8e0d8',
    )
    expect(mood.groundAmbientColor.b).toBeLessThanOrEqual(mood.groundAmbientColor.r * 1.08)
    expect(mood.hemiSkyColor.r).toBeGreaterThan(mood.hemiSkyColor.b)
  })

  it('tiefe Sonne wärmt Hemi-Fill', () => {
    const highSunC = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 21,
      timeOfDay: 12,
      elevationRad: 1.1,
    })
    const lowSunC = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 21,
      timeOfDay: 19,
      elevationRad: 0.12,
    })
    const highMood = resolveLightingMood(
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 12, elevationRad: 1.1, colorTemperature: 6200 },
      highSunC,
      skyPaletteFromCelestial(highSunC, '#3a6084', '#cccccc', '#ffffff'),
      '#cccccc',
    )
    const lowMood = resolveLightingMood(
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 19, elevationRad: 0.12, colorTemperature: 3600 },
      lowSunC,
      skyPaletteFromCelestial(lowSunC, '#3a6084', '#cccccc', '#ffffff'),
      '#cccccc',
    )
    expect(lowMood.hemiSkyColor.equals(highMood.hemiSkyColor)).toBe(false)
    expect(lowMood.groundAmbientColor.r).toBeGreaterThan(lowMood.groundAmbientColor.b * 0.9)
  })

  it('bounceDirection liegt gegenüber der Sonne', () => {
    const bounce = bounceDirectionFromKey(90, 0.8)
    const sun = new THREE.Vector3()
    sun.set(Math.sin(Math.PI / 2), Math.sin(0.8), -Math.cos(Math.PI / 2) * Math.cos(0.8))
    expect(bounce.dot(sun)).toBeLessThan(0)
  })
})
