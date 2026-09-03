import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyFacadeShadeShader,
  facadeOutwardLocalZ,
  facadeShadeParamsFromSun,
  LABEL_SHADOW_COORD_Z_BIAS,
  setFacadeShadeParams,
} from './facadeShade'
import { DEFAULT_SUN_SETTINGS } from './sunLighting'

function stubShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader:
      '#include <common>\n#include <beginnormal_vertex>\n#include <shadowmap_vertex>\n',
    fragmentShader: '#include <common>\n#include <lights_fragment_begin>\n',
  }
}

describe('facadeShade', () => {
  it('panelFlip true = lokale −Z nach außen', () => {
    expect(facadeOutwardLocalZ(true)).toBe(-1)
    expect(facadeOutwardLocalZ(false)).toBe(1)
  })

  it('markiert Außenflächen für EnvMap-Bindung', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, 1)
    expect(mat.userData.exteriorSurface).toBe(true)
  })

  it('hängt den Gegenlicht-Shader an Standard-Material', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, -1)
    expect(mat.userData.facadeShadeApplied).toBe(true)
    expect(mat.userData.uFacadeOutwardLocal).toBe(-1)
    expect(typeof mat.onBeforeCompile).toBe('function')
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.vertexShader).toContain('vFacadeView = normalize(normalMatrix')
    expect(shader.fragmentShader).not.toContain('normalMatrix *')
    expect(shader.fragmentShader).toContain('vFacadeView')
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>')
    expect(shader.fragmentShader).toContain('mix(1.0 - sideOrTop, 1.0, uLabelShade)')
    expect(shader.fragmentShader).not.toContain('lights_fragment_end')
    expect(shader.vertexShader).not.toContain('vDirectionalShadowCoord[ 0 ].z -=')
  })

  it('Schrift-Shader dimmt die Front und setzt Shadow-Z-Bias', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, -1, { label: true })
    expect(mat.userData.uLabelShade).toBe(1)
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.uniforms.uLabelShade.value).toBe(1)
    expect(shader.fragmentShader).toContain('uLabelDirectDim')
    expect(shader.fragmentShader).toContain('uLabelHemiDim')
    expect(shader.fragmentShader).toContain('mix(1.0 - sideOrTop, 1.0, uLabelShade)')
    expect(shader.vertexShader).toContain(
      `vDirectionalShadowCoord[ 0 ].z -= ${LABEL_SHADOW_COORD_Z_BIAS.toFixed(4)}`,
    )
  })

  it('wendet den Shader auch auf opake transparente Schrift an', () => {
    const mat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 1, alphaTest: 0.08 })
    applyFacadeShadeShader(mat, 1, { label: true })
    expect(mat.userData.facadeShadeApplied).toBe(true)
  })

  it('Schrift-Dim ist klar dunkler als Wand-Dim (Defaults)', () => {
    const params = facadeShadeParamsFromSun(DEFAULT_SUN_SETTINGS)
    expect(params.labelHemiDim).toBeLessThan(params.hemiDim)
    expect(params.labelDirectDim).toBeLessThan(params.directDim)
    expect(params.labelHemiDim).toBeGreaterThanOrEqual(0.1)
    expect(params.labelHemiDim).toBeLessThanOrEqual(0.32)
  })

  it('nachts kein Gegenlicht-Dim (Punktlicht bleibt hell)', () => {
    const night = facadeShadeParamsFromSun({ ...DEFAULT_SUN_SETTINGS, elevationRad: -0.2 })
    expect(night.directDim).toBe(1)
    expect(night.hemiDim).toBe(1)
    expect(night.labelDirectDim).toBe(1)
  })

  it('setFacadeShadeParams schreibt Schrift-Uniforms', () => {
    const restore = facadeShadeParamsFromSun(DEFAULT_SUN_SETTINGS)
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, 1, { label: true })
    setFacadeShadeParams({
      directDim: 0.2,
      hemiDim: 0.5,
      interiorDirectDim: 0.2,
      interiorHemiDim: 0.4,
      labelDirectDim: 0.07,
      labelHemiDim: 0.15,
    })
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.uniforms.uLabelDirectDim.value).toBe(0.07)
    expect(shader.uniforms.uLabelHemiDim.value).toBe(0.15)
    setFacadeShadeParams(restore)
  })

  it('überspringt Glas', () => {
    const glass = new THREE.MeshPhysicalMaterial({ transmission: 1, transparent: true })
    glass.name = 'glass'
    applyFacadeShadeShader(glass, -1)
    expect(glass.userData.facadeShadeApplied).toBeUndefined()
  })
})
