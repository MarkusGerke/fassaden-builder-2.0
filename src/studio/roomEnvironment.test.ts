import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { exteriorReflectionProbe, reflectionViewBucket } from './roomEnvironment'

describe('exteriorReflectionProbe', () => {
  it('setzt die Probe außerhalb der Gebäude-AABB auf der Kameraseite', () => {
    const box = new THREE.Box3(new THREE.Vector3(-200, 0, -200), new THREE.Vector3(200, 400, 200))
    const cam = new THREE.Vector3(800, 280, 0)
    const probe = exteriorReflectionProbe(box, cam)
    expect(probe.x).toBeGreaterThan(200)
    expect(probe.z).toBeCloseTo(0, 0)
    expect(probe.y).toBeGreaterThan(80)
  })

  it('ändert den View-Bucket wenn die Kamera um das Haus wandert', () => {
    const focus = new THREE.Vector3(0, 150, 0)
    const a = reflectionViewBucket(new THREE.Vector3(400, 200, 0), focus)
    const b = reflectionViewBucket(new THREE.Vector3(0, 200, 400), focus)
    expect(a).not.toBe(b)
  })
})
