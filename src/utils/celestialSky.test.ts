import { describe, expect, it } from 'vitest'
import { dateInputValue, dayOfYearFromMonthDay, solarPosition, todayMonthDay } from './solar'
import {
  autoSceneLightsWantNight,
  exteriorEnvFillFromCelestial,
  exteriorKeyDimAfterSunset,
  moonPosition,
  resolveCelestialState,
  directionFromSolar,
  skyPaletteFromCelestial,
  worldYNdcAt,
} from './celestialSky'
import * as THREE from 'three'
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

  it('Zwielicht: stetig um −12° und am Horizont (v2.0.340)', () => {
    const deg = (d: number) => (d * Math.PI) / 180
    const tw = (elevRad: number) =>
      resolveCelestialState({
        ...DEFAULT_SUN_SETTINGS,
        month: 9,
        day: 11,
        timeOfDay: 3.4,
        elevationRad: elevRad,
        azimuth: 90,
      }).twilightFactor
    expect(tw(deg(-12.2))).toBe(1)
    expect(tw(deg(-11.8))).toBeGreaterThan(0.85)
    expect(Math.abs(tw(deg(-12.2)) - tw(deg(-11.8)))).toBeLessThan(0.2)
    expect(tw(deg(0))).toBeGreaterThan(0.2)
    expect(tw(deg(0))).toBeLessThan(0.35)
    expect(tw(deg(8))).toBe(0)
  })

  it('Sonnenuntergang: Key-Licht ohne Minutensprung (19:09→19:10)', () => {
    const doy = dayOfYearFromMonthDay(9, 11)
    const sample = (tod: number) => {
      const solar = solarPosition(doy, tod)
      return resolveCelestialState({
        ...DEFAULT_SUN_SETTINGS,
        month: 9,
        day: 11,
        timeOfDay: tod,
        azimuth: solar.azimuthDeg,
        elevationRad: solar.elevationRad,
      }).lightIntensity
    }
    const i9 = sample(19 + 9 / 60)
    const i10 = sample(19 + 10 / 60)
    expect(i9).toBeGreaterThan(0.08)
    expect(i10).toBeGreaterThan(0.02)
    expect(Math.abs(i9 - i10)).toBeLessThan(i9 * 0.75)
  })

  it('Sonnenuntergang: Himmels-Ambient ohne Minutensprung (19:09→19:10)', () => {
    const doy = dayOfYearFromMonthDay(9, 11)
    const sample = (tod: number) => {
      const solar = solarPosition(doy, tod)
      return resolveCelestialState({
        ...DEFAULT_SUN_SETTINGS,
        month: 9,
        day: 11,
        timeOfDay: tod,
        azimuth: solar.azimuthDeg,
        elevationRad: solar.elevationRad,
      }).skyAmbientFactor
    }
    const a9 = sample(19 + 9 / 60)
    const a10 = sample(19 + 10 / 60)
    expect(Math.abs(a9 - a10)).toBeLessThan(0.15)
  })

  it('nach Untergang: Fassaden-Key sinkt bis ~20:40 (11. Sep.)', () => {
    const doy = dayOfYearFromMonthDay(9, 11)
    const stateAt = (tod: number) => {
      const solar = solarPosition(doy, tod)
      return resolveCelestialState({
        ...DEFAULT_SUN_SETTINGS,
        month: 9,
        day: 11,
        timeOfDay: tod,
        azimuth: solar.azimuthDeg,
        elevationRad: solar.elevationRad,
      })
    }
    const dusk = stateAt(19 + 57 / 60)
    const late = stateAt(20 + 41 / 60)
    expect(dusk.lightIntensity).toBeLessThan(0.2)
    expect(late.lightIntensity).toBeLessThan(0.06)
    expect(late.activeLight).toBe('night')
    expect(exteriorKeyDimAfterSunset(late.sun.elevationRad)).toBeLessThan(0.05)
  })

  it('Sonnenuntergang: Env-Fill ohne Sprung (19:16→19:18)', () => {
    const doy = dayOfYearFromMonthDay(9, 11)
    const envAt = (tod: number) => {
      const solar = solarPosition(doy, tod)
      const c = resolveCelestialState({
        ...DEFAULT_SUN_SETTINGS,
        month: 9,
        day: 11,
        timeOfDay: tod,
        azimuth: solar.azimuthDeg,
        elevationRad: solar.elevationRad,
      })
      return exteriorEnvFillFromCelestial(c)
    }
    expect(Math.abs(envAt(19 + 16 / 60) - envAt(19 + 17 / 60))).toBeLessThan(0.12)
    expect(Math.abs(envAt(19 + 17 / 60) - envAt(19 + 18 / 60))).toBeLessThan(0.12)
  })

  it('Lichter-mit-Sonne: Hysterese um den Horizont', () => {
    const deg = (d: number) => (d * Math.PI) / 180
    expect(autoSceneLightsWantNight(deg(-2), false)).toBe(true)
    expect(autoSceneLightsWantNight(deg(2), true)).toBe(false)
    // Zwischenzone: Zustand halten
    expect(autoSceneLightsWantNight(deg(0), true)).toBe(true)
    expect(autoSceneLightsWantNight(deg(0), false)).toBe(false)
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

  it('Sternennacht hat kein Key-Licht', () => {
    const state = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 9,
      day: 20,
      timeOfDay: 0,
      elevationRad: -0.5,
      azimuth: 180,
    })
    expect(state.activeLight).toBe('night')
    expect(state.lightIntensity).toBe(0)
    expect(state.skyAmbientFactor).toBeLessThan(0.03)
  })

  it('Mondlicht ist kühl (hohe Kelvin)', () => {
    const solar = solarPosition(dayOfYearFromMonthDay(9, 5), 0)
    const state = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 9,
      day: 5,
      timeOfDay: 0,
      azimuth: solar.azimuthDeg,
      elevationRad: solar.elevationRad,
    })
    expect(state.activeLight).toBe('moon')
    expect(state.lightColorTemp).toBeGreaterThanOrEqual(7800)
  })

  it('directionFromSolar zeigt nach oben bei Elevation 90°', () => {
    const dir = directionFromSolar(0, Math.PI / 2)
    expect(dir.y).toBeCloseTo(1, 3)
  })

  it('worldYNdcAt: Welt-Y=0 liegt auf einer NDC-Höhe (Ortho-Front)', () => {
    const cam = new THREE.OrthographicCamera(-100, 100, 80, -80, 1, 2000)
    cam.position.set(0, 200, 800)
    cam.lookAt(0, 200, 0)
    cam.updateMatrixWorld()
    cam.updateProjectionMatrix()
    const y0 = worldYNdcAt(cam, 0, 0, 0)
    const y50 = worldYNdcAt(cam, 0, 50, 0)
    expect(y50).toBeGreaterThan(y0)
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
