import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  DEFAULT_SUN_SETTINGS,
  expandBoxByGroundShadow,
  intensityFromElevation,
  shadowRadiusFromSoftness,
  shadowSoftnessFromElevation,
  sunFromTargetDirection,
  sunRayDirectionFromSettings,
  syncSunSettingsFromSolar,
} from './sunLighting'
import { facadeOutward } from '../studio/elevation'

describe('expandBoxByGroundShadow', () => {
  const box = new THREE.Box3(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 100, 50))

  it('ändert die Grundfläche kaum bei senkrechter Sonne', () => {
    const out = expandBoxByGroundShadow(box, new THREE.Vector3(0, -1, 0), 0)
    expect(out.min.x).toBeCloseTo(-50, 5)
    expect(out.max.x).toBeCloseTo(50, 5)
    expect(out.min.z).toBeCloseTo(-50, 5)
    expect(out.max.z).toBeCloseTo(50, 5)
    expect(out.min.y).toBeCloseTo(0, 5)
  })

  it('verlängert den Schatten in Strahlrichtung auf den Boden', () => {
    const ray = new THREE.Vector3(0, -1, -1).normalize()
    const out = expandBoxByGroundShadow(box, ray, 0, 10_000)
    // Höhe 100 cm, 45°: Boden-Treffer 100 cm weiter in −Z
    expect(out.min.z).toBeCloseTo(-150, 5)
    expect(out.max.z).toBeCloseTo(50, 5)
  })

  it('begrenzt die Länge, damit die Shadow-Map nicht ausfranst', () => {
    const ray = new THREE.Vector3(0, -1, -1).normalize()
    const out = expandBoxByGroundShadow(box, ray, 0, 50)
    const dz = 50 / Math.SQRT2
    expect(out.min.z).toBeCloseTo(-50 - dz, 5)
  })
})

describe('sunRayDirectionFromSettings', () => {
  it('zeigt bei Mittag nach unten', () => {
    const ray = sunRayDirectionFromSettings({ ...DEFAULT_SUN_SETTINGS }, new THREE.Vector3())
    expect(ray.y).toBeLessThan(0)
    expect(ray.length()).toBeCloseTo(1, 5)
  })
})

describe('Fassaden-Front N·L vs. Azimut', () => {
  const elev = Math.PI / 4

  function frontDot(yawDeg: number, azimuthDeg: number): number {
    const out = facadeOutward(yawDeg, true)
    const toSun = sunFromTargetDirection(
      { ...DEFAULT_SUN_SETTINGS, azimuth: azimuthDeg, elevationRad: elev },
      new THREE.Vector3(),
    )
    return out.x * toSun.x + out.z * toSun.z
  }

  it('Nord (yaw 0): bei Tages-Azimut O→S→W bleibt die Front ≤ 0 (Gegenlicht/Streiflicht)', () => {
    expect(facadeOutward(0, true).z).toBeCloseTo(-1, 5)
    expect(frontDot(0, 90)).toBeLessThanOrEqual(0.05)
    expect(frontDot(0, 180)).toBeLessThan(-0.5)
    expect(frontDot(0, 270)).toBeLessThanOrEqual(0.05)
  })

  it('West (yaw 90): wechselt von Gegenlicht (O) zu Frontlicht (W)', () => {
    expect(facadeOutward(90, true).x).toBeCloseTo(-1, 5)
    expect(frontDot(90, 90)).toBeLessThan(-0.5)
    expect(frontDot(90, 270)).toBeGreaterThan(0.5)
  })
})

describe('shadowRadiusFromSoftness', () => {
  it('hält die Schattenweichheit im Slider-Bereich 0,5…8', () => {
    expect(shadowRadiusFromSoftness(2.5)).toBeCloseTo(2.5, 5)
    expect(shadowRadiusFromSoftness(8)).toBe(8)
    expect(shadowRadiusFromSoftness(0.5)).toBe(0.5)
  })
})

describe('syncSunSettingsFromSolar', () => {
  it('überschreibt Winkel/Weichheit/Intensität nur mit applySolarLook', () => {
    const base = {
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 21,
      timeOfDay: 12,
      azimuth: 42,
      intensity: 7.5,
      shadowSoftness: 8,
      colorTemperature: 2700,
      elevationRad: 0.2,
    }
    const kept = syncSunSettingsFromSolar(base, { applySolarLook: false })
    expect(kept.azimuth).toBe(42)
    expect(kept.intensity).toBe(7.5)
    expect(kept.shadowSoftness).toBe(8)
    expect(kept.colorTemperature).toBe(2700)
    expect(kept.elevationRad).toBe(0.2)

    const solar = syncSunSettingsFromSolar(base, { applySolarLook: true })
    expect(solar.azimuth).not.toBe(42)
    expect(solar.intensity).toBe(intensityFromElevation(solar.elevationRad))
    expect(solar.shadowSoftness).toBe(shadowSoftnessFromElevation(solar.elevationRad))
    expect(solar.elevationRad).toBeGreaterThan(0.2)
  })
})
