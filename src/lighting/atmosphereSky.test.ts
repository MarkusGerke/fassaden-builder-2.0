import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyDisplaySunColor, berlinWorldToECEFMatrix, patchSkyFragmentShader, sunSettingsToDate } from './atmosphereSky'
import { resolveCelestialState } from '../utils/celestialSky'
import { DEFAULT_SUN_SETTINGS } from '../utils/sunLighting'
import { SOLAR_REF_YEAR } from '../utils/solar'

describe('atmosphereSky helpers', () => {
  it('sunSettingsToDate nutzt Referenzjahr und Tageszeit', () => {
    const date = sunSettingsToDate({
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 15,
      timeOfDay: 14.5,
    })
    expect(date.getFullYear()).toBe(SOLAR_REF_YEAR)
    expect(date.getMonth()).toBe(5)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(14)
    expect(date.getMinutes()).toBe(30)
  })

  it('berlinWorldToECEFMatrix: +Y ist geodätisch oben, +X Ost', () => {
    const m = berlinWorldToECEFMatrix()
    const ecef = new THREE.Vector3().setFromMatrixPosition(m)
    expect(ecef.length()).toBeGreaterThan(6_300_000)

    const up = new THREE.Vector3(0, 1, 0).transformDirection(m).normalize()
    expect(up.dot(ecef.clone().normalize())).toBeGreaterThan(0.95)

    const east = new THREE.Vector3(1, 0, 0).transformDirection(m).normalize()
    expect(Math.abs(east.dot(up))).toBeLessThan(0.05)
  })

  it('applyDisplaySunColor hebt physikalische Radiance auf Anzeige-Intensität', () => {
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.color.setRGB(0.02, 0.016, 0.01)
    const celestial = resolveCelestialState({
      ...DEFAULT_SUN_SETTINGS,
      month: 6,
      day: 21,
      timeOfDay: 12,
      elevationRad: 1,
    })
    applyDisplaySunColor(light, celestial, 1)
    expect(light.intensity).toBeGreaterThan(1)
    expect(Math.max(light.color.r, light.color.g, light.color.b)).toBeGreaterThan(0.8)
  })

  it('patchSkyFragmentShader klemmt HDR und ersetzt dFdx-Sonnenscheibe', () => {
    const src = `layout(location = 0) out vec4 outputColor;
float fragmentAngle = length(dRDdx + dRDdy) / length(rayDirection);
outputColor.a = 1.0;`
    const next = patchSkyFragmentShader(src)
    expect(next).toContain('uniform float uSkyDisplayExposure')
    expect(next).toContain('float fragmentAngle = 0.0030;')
    expect(next).toContain('SKY_HDR_CLAMP')
    expect(next).not.toContain('length(dRDdx + dRDdy)')
  })
})
