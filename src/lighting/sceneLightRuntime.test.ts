import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR, SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import { SceneLightRuntime } from './sceneLightRuntime'

describe('sceneLightRuntime', () => {
  it('Bibliotheks-Punktlicht nur auf Innen-Layer', () => {
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
        },
      ],
      { roomOcclusion: true },
    )
    const light = runtime.root.children.find((c) => c.userData.kind === 'sceneLight') as
      | import('three').PointLight
      | undefined
    expect(light).toBeDefined()
    expect(light!.layers.isEnabled(SHADOW_LAYER_INTERIOR)).toBe(true)
    expect(light!.layers.isEnabled(SHADOW_LAYER_EXTERIOR)).toBe(false)
    expect(light!.shadow.camera.layers.isEnabled(SHADOW_LAYER_OCCLUDER)).toBe(true)
    const glow = light!.children.find((c) => (c as THREE.Sprite).isSprite)
    const solid = light!.children.find((c) => c.name === 'lightSolidMarker') as THREE.Mesh | undefined
    expect(glow?.visible).toBe(false)
    expect(solid?.visible).toBe(true)
    runtime.dispose()
  })
})
