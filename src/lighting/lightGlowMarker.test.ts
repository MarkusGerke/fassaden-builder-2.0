import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createLightBloomCore,
  createLightGlowSprite,
  disposeLightBloomCore,
  disposeLightGlowSprite,
  updateLightBloomCore,
  updateLightGlowSprite,
} from './lightGlowMarker'

describe('lightGlowMarker', () => {
  it('erzeugt Sprite mit Tiefentest für Okklusion', () => {
    const sprite = createLightGlowSprite(40)
    const mat = sprite.material as THREE.SpriteMaterial
    expect(sprite).toBeInstanceOf(THREE.Sprite)
    expect(mat.depthTest).toBe(true)
    expect(mat.depthWrite).toBe(false)
    expect(mat.transparent).toBe(true)
    disposeLightGlowSprite(sprite)
  })

  it('tönnt Glühen in Lichtfarbe ohne Übersteuerung', () => {
    const sprite = createLightGlowSprite(40)
    updateLightGlowSprite(sprite, '#ff6600', 64, 2)
    const mat = sprite.material as THREE.SpriteMaterial
    expect(`#${mat.color.getHexString()}`).toBe('#ff6600')
    expect(mat.opacity).toBeLessThanOrEqual(0.98)
    disposeLightGlowSprite(sprite)
  })

  it('skaliert und blendet nach Durchmesser aus', () => {
    const sprite = createLightGlowSprite(40)
    updateLightGlowSprite(sprite, '#ffcc88', 64, 2)
    expect(sprite.visible).toBe(true)
    expect(sprite.scale.x).toBe(64)
    updateLightGlowSprite(sprite, '#ffcc88', 0, 1)
    expect(sprite.visible).toBe(false)
    disposeLightGlowSprite(sprite)
  })

  it('Bloom-Kern leuchtet HDR-nah bei aktivem Bloom', () => {
    const core = createLightBloomCore()
    updateLightBloomCore(core, '#ffaa66', 80, 12, true, true)
    expect(core.visible).toBe(true)
    const mat = core.material as THREE.MeshBasicMaterial
    expect(mat.color.r).toBeGreaterThan(1)
    updateLightBloomCore(core, '#ffaa66', 80, 12, false, true)
    expect(core.visible).toBe(false)
    disposeLightBloomCore(core)
  })
})
