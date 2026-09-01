import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyRenderExteriorSurfaceLook,
  applyRenderInteriorSurfaceLook,
  setGlassEnvironment,
} from './threeColors'

describe('render surface looks', () => {
  it('markiert Außenmaterial und senkt Rauheit', () => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92 })
    applyRenderExteriorSurfaceLook(mat)
    expect(mat.userData.exteriorSurface).toBe(true)
    expect(mat.roughness).toBeLessThanOrEqual(0.78)
  })

  it('bindet EnvMap an Außen- und Innen-Render-Look', () => {
    const tex = new THREE.Texture()
    setGlassEnvironment(tex)
    const exterior = new THREE.MeshStandardMaterial()
    const interior = new THREE.MeshStandardMaterial()
    applyRenderExteriorSurfaceLook(exterior)
    applyRenderInteriorSurfaceLook(interior)
    expect(exterior.envMap).toBe(tex)
    expect(exterior.envMapIntensity).toBeGreaterThanOrEqual(0.58)
    expect(interior.envMap).toBe(tex)
    expect(interior.envMapIntensity).toBeGreaterThanOrEqual(0.55)
    setGlassEnvironment(null)
    tex.dispose()
  })
})
