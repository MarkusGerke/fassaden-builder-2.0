import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createStudioSphereGeometry,
  studioEnvironmentHex,
  studioTintHex,
  studioFlatFloorSize,
  studioSphereRadius,
  STUDIO_DAY_BEIGE,
  STUDIO_FLOOR_MARGIN_CM,
  STUDIO_NIGHT_NEAR_BLACK,
} from './studioStage'

describe('studioStage', () => {
  it('mischt Beige bei Tag und nahezu Schwarz bei Nacht', () => {
    expect(studioEnvironmentHex(0).toLowerCase()).toBe(STUDIO_DAY_BEIGE.toLowerCase())
    expect(studioEnvironmentHex(1).toLowerCase()).toBe(STUDIO_NIGHT_NEAR_BLACK.toLowerCase())
    const mid = new THREE.Color(studioEnvironmentHex(0.5))
    const day = new THREE.Color(STUDIO_DAY_BEIGE)
    const night = new THREE.Color(STUDIO_NIGHT_NEAR_BLACK)
    expect(mid.getHex()).not.toBe(day.getHex())
    expect(mid.getHex()).not.toBe(night.getHex())
    expect(mid.r).toBeLessThan(day.r)
    expect(mid.r).toBeGreaterThan(night.r)
  })

  it('tönt nutzerdefinierte Neutral-Farben nach Tageszeit', () => {
    expect(studioTintHex('#ff0000', 0).toLowerCase()).toBe('#ff0000')
    expect(studioTintHex('#ff0000', 1).toLowerCase()).toBe(STUDIO_NIGHT_NEAR_BLACK.toLowerCase())
  })

  it('macht den flachen Boden immer größer als das Haus inkl. Rand', () => {
    const span = 800
    const size = studioFlatFloorSize(100, span)
    expect(size).toBe(span + STUDIO_FLOOR_MARGIN_CM * 2)
    expect(size).toBeGreaterThan(span)
    expect(studioFlatFloorSize(2000, 100)).toBe(2000)
  })

  it('erzeugt eine Kugel mit positivem Radius', () => {
    const geo = createStudioSphereGeometry(500)
    expect(geo.parameters.radius).toBe(500)
    expect(studioSphereRadius(1000)).toBeGreaterThan(500)
    geo.dispose()
  })
})
