import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyRenderExteriorSurfaceLook,
  applyRenderInteriorSurfaceLook,
  applySurfaceFinish,
  bindMaterialsToGlassEnv,
  markWindowFrameSurface,
  setExteriorEnvFillFactor,
  setGlassEnvironment,
  syncEnvMapFillIntensities,
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
    setExteriorEnvFillFactor(1)
    const exterior = new THREE.MeshStandardMaterial()
    const interior = new THREE.MeshStandardMaterial()
    applyRenderExteriorSurfaceLook(exterior)
    applyRenderInteriorSurfaceLook(interior)
    expect(exterior.envMap).toBe(tex)
    expect(exterior.envMapIntensity).toBeGreaterThanOrEqual(0.58)
    expect(exterior.userData.forceExteriorEnv).toBe(true)
    expect(interior.envMap).toBe(tex)
    expect(interior.envMapIntensity).toBeGreaterThanOrEqual(0.55)
    setGlassEnvironment(null)
    tex.dispose()
  })

  it('skaliert Außen-Env nachts herunter', () => {
    const tex = new THREE.Texture()
    setGlassEnvironment(tex)
    setExteriorEnvFillFactor(0.05)
    const exterior = new THREE.MeshStandardMaterial()
    applyRenderExteriorSurfaceLook(exterior)
    expect(exterior.envMapIntensity).toBeLessThan(0.05)
    setExteriorEnvFillFactor(1)
    syncEnvMapFillIntensities(new THREE.Mesh(new THREE.BoxGeometry(), exterior))
    expect(exterior.envMapIntensity).toBeGreaterThanOrEqual(0.58)
    setGlassEnvironment(null)
    tex.dispose()
  })

  it('bindet EnvMap nicht an matte Rahmen nur wegen Facade-Shade-Flag', () => {
    const tex = new THREE.Texture()
    setGlassEnvironment(tex)
    const frame = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 })
    frame.userData.exteriorSurface = true
    frame.userData.surfaceFinish = 'matte'
    frame.envMapIntensity = 0.05
    const root = new THREE.Mesh(new THREE.BoxGeometry(), frame)
    bindMaterialsToGlassEnv(root)
    expect(frame.envMap).toBeNull()
    setGlassEnvironment(null)
    tex.dispose()
    root.geometry.dispose()
  })

  it('löst vorhandene EnvMap von markierten Fensterrahmen', () => {
    const tex = new THREE.Texture()
    setGlassEnvironment(tex)
    const frame = new THREE.MeshStandardMaterial({ color: '#ffffff' })
    applySurfaceFinish(frame, 'matte')
    markWindowFrameSurface(frame)
    frame.envMap = tex
    frame.envMapIntensity = 0.58
    const root = new THREE.Mesh(new THREE.BoxGeometry(), frame)
    bindMaterialsToGlassEnv(root)
    expect(frame.envMap).toBeNull()
    setGlassEnvironment(null)
    tex.dispose()
    root.geometry.dispose()
  })

  it('hält EnvMap an Rahmen mit Außen-Finish (wie Wand/Laibung)', () => {
    const tex = new THREE.Texture()
    setGlassEnvironment(tex)
    setExteriorEnvFillFactor(1)
    const frame = new THREE.MeshStandardMaterial({ color: '#ffffff' })
    applySurfaceFinish(frame, 'matte')
    markWindowFrameSurface(frame)
    applyRenderExteriorSurfaceLook(frame)
    const root = new THREE.Mesh(new THREE.BoxGeometry(), frame)
    bindMaterialsToGlassEnv(root)
    expect(frame.envMap).toBe(tex)
    expect(frame.userData.forceExteriorEnv).toBe(true)
    setGlassEnvironment(null)
    tex.dispose()
    root.geometry.dispose()
  })
})
