import { describe, expect, it } from 'vitest'
import { tickWindFabrics, windDisplacementAmplitude, registerWindFabric, clearWindFabrics } from './windRuntime'
import * as THREE from 'three'

describe('windRuntime', () => {
  it('amplitude is 0 at intensity 0', () => {
    expect(windDisplacementAmplitude(0)).toBe(0)
    expect(windDisplacementAmplitude(0.5)).toBeGreaterThan(0)
  })

  it('restores base positions when intensity is 0', () => {
    clearWindFabrics()
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array([
      -5, 0, 20, 0, 0, 40, 5, 0, 60, -5, 0, 80, 0, 0, 100, 5, 0, 120,
    ])
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mesh = new THREE.Mesh(geo)
    registerWindFabric('t1', mesh)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const before = Float32Array.from(pos.array as ArrayLike<number>)
    tickWindFabrics(1.5, 0.8)
    let changed = false
    for (let i = 0; i < before.length; i += 1) {
      if (Math.abs((pos.array[i] as number) - before[i]!) > 1e-6) {
        changed = true
        break
      }
    }
    expect(changed).toBe(true)
    tickWindFabrics(2, 0)
    for (let i = 0; i < before.length; i += 1) {
      expect(pos.array[i]).toBeCloseTo(before[i]!, 5)
    }
    clearWindFabrics()
  })
})
