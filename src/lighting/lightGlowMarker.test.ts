import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createLightBloomCore,
  createLightEditRing,
  createLightGlowSprite,
  createLightSolidMarker,
  disposeLightBloomCore,
  disposeLightEditRing,
  disposeLightGlowSprite,
  disposeLightSolidMarker,
  updateLightBloomCore,
  updateLightEditRing,
  updateLightGlowSprite,
  updateLightSolidMarker,
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

  it('erzeugt opake Positions-Kugel mit Tiefenschreiben', () => {
    const mesh = createLightSolidMarker()
    const mat = mesh.material as THREE.MeshBasicMaterial
    expect(mat.depthTest).toBe(true)
    expect(mat.depthWrite).toBe(true)
    expect(mat.blending).not.toBe(THREE.AdditiveBlending)
    updateLightSolidMarker(mesh, '#ffaa66', true, false)
    expect(mesh.visible).toBe(true)
    updateLightSolidMarker(mesh, '#ffaa66', false, false)
    expect(mesh.visible).toBe(false)
    disposeLightSolidMarker(mesh)
  })

  it('Licht-Modus-Kreis ist durch Wände sichtbar und orange bei Auswahl', () => {
    const ring = createLightEditRing(80)
    const mat = ring.material as THREE.SpriteMaterial
    expect(mat.depthTest).toBe(false)
    updateLightEditRing(ring, '#4488ff', 96, false)
    expect(ring.visible).toBe(true)
    expect(`#${mat.color.getHexString()}`).toBe('#4488ff')
    updateLightEditRing(ring, '#4488ff', 96, true)
    expect(`#${mat.color.getHexString()}`).toBe('#ff8800')
    updateLightEditRing(ring, '#4488ff', 0, false)
    expect(ring.visible).toBe(false)
    disposeLightEditRing(ring)
  })
})
