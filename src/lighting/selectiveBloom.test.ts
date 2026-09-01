import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { BLOOM_LAYER } from '../utils/sunLighting'
import { enableBloomLayer } from './selectiveBloom'

describe('selectiveBloom', () => {
  it('aktiviert BLOOM_LAYER auf Objekten', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    enableBloomLayer(mesh)
    expect(mesh.layers.isEnabled(BLOOM_LAYER)).toBe(true)
  })
})
