import { describe, expect, it } from 'vitest'
import { dateInputValue, dayOfYearFromMonthDay, solarPosition, todayMonthDay } from './solar'
import {
  moonPosition,
  resolveCelestialState,
  directionFromSolar,
  skyPaletteFromCelestial,
} from './celestialSky'
import { DEFAULT_SUN_SETTINGS, syncSunSettingsFromSolar, TIME_OF_DAY_MAX } from './sunLighting'

describe('celestialSky', () => {
  it('Mond liegt gegenüber der Sonne (≈12 h)', () => {
    const doy = dayOfYearFromMonthDay(6, 21)
    const solarNoon = solarPosition(doy, 12)
    const sunNoon = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 21,
      timeOfDay: 12,
      azimuth: solarNoon.azimuthDeg,
      elevationRad: solarNoon.elevationRad,
    })
    const moonMidnight = moonPosition(doy, 0)
    expect(Math.abs(moonMidnight.elevationRad - sunNoon.sun.elevationRad)).toBeLessThan(0.15)
  })

  it('Nacht aktiviert Mond-Licht wenn Sonne unter Horizont', () => {
    const solar = solarPosition(dayOfYearFromMonthDay(12, 21), 23)
    const state = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 12,
      day: 21,
      timeOfDay: 23,
      azimuth: solar.azimuthDeg,
      elevationRad: solar.elevationRad,
    })
    expect(state.sunAboveHorizon).toBe(false)
    expect(state.activeLight === 'moon' || state.activeLight === 'night').toBe(true)
    expect(state.twilightFactor).toBeGreaterThan(0.4)
  })

  it('nutzt den manuellen Sonnenwinkel für Licht und Scheibe', () => {
    const state = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      azimuth: 90,
      elevationRad: 0.7,
      timeOfDay: 12,
    })
    expect(state.sun.azimuthDeg).toBe(90)
    expect(state.lightAzimuthDeg).toBe(90)
    expect(state.activeLight).toBe('sun')
  })

  it('Tageshimmel folgt den Szenenfarben', () => {
    const day = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      elevationRad: 1,
      timeOfDay: 12,
    })
    const pal = skyPaletteFromCelestial(day, '#ff0000', '#00ff00', '#0000ff')
    expect(pal.zenith.r).toBeGreaterThan(0.85)
    expect(pal.ground.g).toBeGreaterThan(0.85)
    expect(pal.horizon.b).toBeGreaterThan(0.4)
  })

  it('directionFromSolar zeigt nach oben bei Elevation 90°', () => {
    const dir = directionFromSolar(0, Math.PI / 2)
    expect(dir.y).toBeCloseTo(1, 3)
  })
})

describe('todayMonthDay', () => {
  it('nimmt Monat und Tag aus dem lokalen Datum', () => {
    expect(todayMonthDay(new Date(2026, 7, 28))).toEqual({ month: 8, day: 28 })
    expect(dateInputValue(8, 28, 2026)).toBe('2026-08-28')
  })
})

describe('24h Tageszeit', () => {
  it('behält Nachtstunden beim Sync ohne Solar-Look', () => {
    const kept = syncSunSettingsFromSolar(
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 2, animFromTime: 0, animToTime: 24 },
      { applySolarLook: false },
    )
    expect(kept.timeOfDay).toBe(2)
    expect(kept.animFromTime).toBe(0)
    expect(kept.animToTime).toBe(TIME_OF_DAY_MAX)
  })
})
