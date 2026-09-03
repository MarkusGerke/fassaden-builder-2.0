import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR, SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import { SceneLightRuntime } from './sceneLightRuntime'

function firstPointLight(runtime: SceneLightRuntime): THREE.PointLight | undefined {
  let found: THREE.PointLight | undefined
  runtime.root.traverse((obj) => {
    if (found) return
    if ((obj as THREE.PointLight).isPointLight) found = obj as THREE.PointLight
  })
  return found
}

describe('sceneLightRuntime', () => {
  it('Bibliotheks-Punktlicht auf Außen- und Innen-Layer', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'l1',
          x: 0,
          y: 200,
          z: 0,
          color: '#ffd080',
          intensity: 12,
          enabled: true,
          showMarker: true,
          castShadow: true,
          beamMode: 'omni',
        },
      ],
      { roomOcclusion: true },
    )
    const light = firstPointLight(runtime)
    expect(light).toBeDefined()
    expect(light!.layers.isEnabled(SHADOW_LAYER_INTERIOR)).toBe(true)
    expect(light!.layers.isEnabled(SHADOW_LAYER_EXTERIOR)).toBe(true)
    expect(light!.shadow.camera.layers.isEnabled(SHADOW_LAYER_OCCLUDER)).toBe(true)
    const root = light!.parent!
    const glow = root.children.find((c) => (c as THREE.Sprite).isSprite)
    const solid = root.children.find((c) => c.name === 'lightSolidMarker') as THREE.Mesh | undefined
    const bloomCore = root.children.find((c) => c.name === 'lightBloomCore') as THREE.Mesh | undefined
    expect(glow?.visible).toBe(false)
    expect(solid?.visible).toBe(true)
    expect(bloomCore?.visible).toBe(false)
    runtime.dispose()
  })

  it('Bloom-Kern bei Raum-Okklusion sichtbar wenn Bloom aktiv', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'l1',
          x: 0,
          y: 200,
          z: 0,
          color: '#ffd080',
          intensity: 12,
          enabled: true,
          showMarker: true,
          castShadow: true,
          beamMode: 'omni',
        },
      ],
      { roomOcclusion: true, bloomActive: true },
    )
    const light = firstPointLight(runtime)
    const bloomCore = light!.parent!.children.find((c) => c.name === 'lightBloomCore') as
      | THREE.Mesh
      | undefined
    expect(bloomCore?.visible).toBe(true)
    runtime.dispose()
  })

  it('Deckenlampe: Spot nach unten, Point aus', () => {
    const runtime = new SceneLightRuntime()
    runtime.sync(
      [
        {
          id: 'ceil',
          x: 0,
          y: 280,
          z: 0,
          color: '#ffd080',
          intensity: 24,
          enabled: true,
          castShadow: true,
          beamMode: 'down',
          beamAngleDownDeg: 68,
        },
      ],
      { roomOcclusion: true },
    )
    let spot: THREE.SpotLight | undefined
    let point: THREE.PointLight | undefined
    runtime.root.traverse((obj) => {
      if ((obj as THREE.SpotLight).isSpotLight && obj.userData.spotDir === 'down') {
        spot = obj as THREE.SpotLight
      }
      if ((obj as THREE.PointLight).isPointLight) point = obj as THREE.PointLight
    })
    expect(spot?.visible).toBe(true)
    expect(point?.visible).toBe(false)
    expect(spot!.angle).toBeGreaterThan(0.5)
    runtime.dispose()
  })
})
