import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNOW_WEATHER_SETTINGS,
  normalizeSnowWeatherSettings,
  snowAccumulateRatePerSec,
  snowMeltRatePerSec,
  snowOvercastFactors,
  snowParticleBudget,
  snowPuddleStrengthScale,
} from './snowWeather'
import { snowCoverageModeForObject } from './snowCoverage'
import * as THREE from 'three'

describe('snowWeather', () => {
  it('normalisiert Defaults und clamp', () => {
    expect(normalizeSnowWeatherSettings(null)).toEqual(DEFAULT_SNOW_WEATHER_SETTINGS)
    const n = normalizeSnowWeatherSettings({
      enabled: true,
      temperatureC: 99,
      intensity: -1,
      quality: 'high',
    })
    expect(n.enabled).toBe(true)
    expect(n.temperatureC).toBe(20)
    expect(n.intensity).toBe(0)
    expect(n.quality).toBe('high')
  })

  it('akkumuliert nur bei Frost', () => {
    expect(snowAccumulateRatePerSec(-2, 0.55)).toBeGreaterThan(0.01)
    expect(snowAccumulateRatePerSec(1, 0.55)).toBe(0)
  })

  it('schmilzt schneller bei Wärme', () => {
    expect(snowMeltRatePerSec(5)).toBeGreaterThan(snowMeltRatePerSec(1))
    expect(snowMeltRatePerSec(-1)).toBe(0)
  })

  it('Pfützen-Crossfade und Overcast', () => {
    expect(snowPuddleStrengthScale(1, -5)).toBeLessThan(0.3)
    expect(snowPuddleStrengthScale(0, 10)).toBe(1)
    const o = snowOvercastFactors(true, 0.8, 0.5)
    expect(o.sunMul).toBeLessThan(1)
    expect(o.hemiMul).toBeGreaterThan(1)
  })

  it('Partikelbudget unabhängig vom Orbit', () => {
    expect(snowParticleBudget('low').count).toBe(6500)
    expect(snowParticleBudget('high').count).toBe(28_000)
    expect(snowParticleBudget('high').count).toBeGreaterThan(snowParticleBudget('low').count)
  })
})

describe('snowCoverageModeForObject', () => {
  it('Boden thick, Glas none, Gesims cover, Wandschale none, Decke thick', () => {
    const ground = new THREE.Mesh()
    ground.name = 'studioGround'
    expect(snowCoverageModeForObject(ground)).toBe('thick')

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshStandardMaterial({ name: 'glassPane' }),
    )
    expect(snowCoverageModeForObject(glass)).toBe('none')

    const cornice = new THREE.Mesh()
    cornice.userData.wallPart = 'cornice'
    expect(snowCoverageModeForObject(cornice)).toBe('cover')

    const cladding = new THREE.Mesh()
    cladding.userData.wallPart = 'cladding'
    expect(snowCoverageModeForObject(cladding)).toBe('none')

    const tiles = new THREE.Mesh()
    tiles.userData.kind = 'roof'
    tiles.userData.roofPart = 'tiles'
    expect(snowCoverageModeForObject(tiles)).toBe('thick')

    const dormerShell = new THREE.Mesh()
    dormerShell.userData.kind = 'roofDormer'
    dormerShell.userData.roofPart = 'shell'
    expect(snowCoverageModeForObject(dormerShell)).toBe('thick')

    const ceiling = new THREE.Mesh()
    ceiling.userData.kind = 'ceiling'
    expect(snowCoverageModeForObject(ceiling)).toBe('thick')

    const indoorFloor = new THREE.Mesh()
    indoorFloor.userData.kind = 'floor'
    expect(snowCoverageModeForObject(indoorFloor)).toBe('none')
  })
})
