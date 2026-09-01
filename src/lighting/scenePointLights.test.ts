import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DEFAULT_SUN_SETTINGS } from '../utils/sunLighting'
import {
  createScenePointLights,
  scenePointLightNightFactor,
  updateScenePointLights,
} from './scenePointLights'

describe('scenePointLights', () => {
  it('erzeugt Innen- und Außen-Punktlicht mit sichtbaren Markern', () => {
    const bundle = createScenePointLights()
    expect(bundle.indoor.castShadow).toBe(true)
    expect(bundle.outdoor.castShadow).toBe(true)
    expect(bundle.root.children).toHaveLength(2)
    expect(bundle.indoorMarker.geometry).toBeDefined()
  })

  it('skaliert Intensität bei Nacht hoch', () => {
    const bundle = createScenePointLights()
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(400, 448, 300))
    updateScenePointLights(
      bundle,
      box,
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 2 },
      { enabled: true, castShadow: true },
    )
    expect(bundle.indoor.intensity).toBeGreaterThan(2000)
    expect(bundle.outdoor.intensity).toBeGreaterThan(2800)
    expect(bundle.indoorMarker.visible).toBe(true)
    expect(bundle.outdoorMarker.visible).toBe(true)
  })

  it('dimmt bei Tag, Marker bleiben sichtbar', () => {
    expect(scenePointLightNightFactor({ ...DEFAULT_SUN_SETTINGS, timeOfDay: 13.25 })).toBeLessThan(
      0.3,
    )
    const bundle = createScenePointLights()
    const box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(400, 448, 300))
    updateScenePointLights(
      bundle,
      box,
      { ...DEFAULT_SUN_SETTINGS, timeOfDay: 13.25 },
      { enabled: true, castShadow: false },
    )
    expect(bundle.indoor.intensity).toBeGreaterThan(800)
    expect(bundle.indoorMarker.visible).toBe(true)
  })
})
