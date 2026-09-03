import { describe, expect, it, afterEach } from 'vitest'
import * as THREE from 'three'
import {
  disablePcssShadows,
  enablePcssShadows,
  getPcssLightSizeUv,
  isPcssShadowsEnabled,
  PCSS_NUM_SAMPLES,
  PCSS_PENUMBRA_SCALE,
  pcssLightSizeUvFromSoftness,
  pcssLightWorldSizeFromSoftness,
  pointShadowRadiusFromSoftness,
  updatePcssShadowParameters,
} from './pcssShadows'

describe('pcssShadows', () => {
  afterEach(() => {
    disablePcssShadows()
  })

  it('mappt Weichheit 0,5…8 auf wachsende Lichtfläche in cm', () => {
    expect(pcssLightWorldSizeFromSoftness(0.5)).toBeCloseTo(0.8, 5)
    expect(pcssLightWorldSizeFromSoftness(8)).toBeCloseTo(28, 5)
    expect(pcssLightWorldSizeFromSoftness(2.5)).toBeGreaterThan(0.8)
    expect(pcssLightWorldSizeFromSoftness(2.5)).toBeLessThan(28)
  })

  it('mappt Weichheit auf Punktlicht-Cube-Shadow-Radius', () => {
    expect(pointShadowRadiusFromSoftness(0.5)).toBeCloseTo(1, 5)
    expect(pointShadowRadiusFromSoftness(8)).toBeCloseTo(18, 5)
    expect(pointShadowRadiusFromSoftness(2.5)).toBeGreaterThan(1)
    expect(pointShadowRadiusFromSoftness(2.5)).toBeLessThan(18)
  })

  it('berechnet LIGHT_SIZE_UV aus Frustum-Breite', () => {
    const uv = pcssLightSizeUvFromSoftness(4, 4000)
    expect(uv).toBeCloseTo(pcssLightWorldSizeFromSoftness(4) / 4000, 8)
  })

  it('aktiviert und deaktiviert den ShaderChunk-Override', () => {
    const original = THREE.ShaderChunk.shadowmap_pars_fragment
    enablePcssShadows()
    expect(isPcssShadowsEnabled()).toBe(true)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('pcssGetShadow')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('uniform float pcssLightSizeUv')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('PCSS_PENUMBRA_SCALE')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain(
      'pcssLightSizeUv * PCSS_PENUMBRA_SCALE * ( zReceiver - PCSS_NEAR_PLANE ) / zReceiver',
    )
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).not.toContain(
      'pcssLightSizeUv * PCSS_NEAR_PLANE / zReceiver',
    )
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('sum / 9.0')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).not.toContain(
      'float depth = textureCube( shadowMap, bd3D ).r;',
    )
    disablePcssShadows()
    expect(isPcssShadowsEnabled()).toBe(false)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(original)
  })

  it('aktualisiert die Lichtgröße live über Uniform, ohne Shader-Chunk neu zu bauen', () => {
    enablePcssShadows()
    const before = THREE.ShaderChunk.shadowmap_pars_fragment
    updatePcssShadowParameters(8, 4000)
    expect(getPcssLightSizeUv()).toBeCloseTo(pcssLightSizeUvFromSoftness(8, 4000), 8)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(before)
    updatePcssShadowParameters(0.5, 4000)
    expect(getPcssLightSizeUv()).toBeCloseTo(pcssLightSizeUvFromSoftness(0.5, 4000), 8)
    expect(getPcssLightSizeUv()).toBeLessThan(pcssLightSizeUvFromSoftness(8, 4000))
    disablePcssShadows()
  })

  it('bindet die PCSS-Uniform an Materialien', () => {
    enablePcssShadows()
    const mat = new THREE.MeshStandardMaterial()
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat))
    updatePcssShadowParameters(4, 2000, scene)
    expect(mat.userData.pcssLightSizeBound).toBe(true)
    const uniforms: Record<string, { value: unknown }> = {}
    mat.onBeforeCompile(
      { uniforms, vertexShader: '', fragmentShader: '' } as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    expect(uniforms.pcssLightSizeUv).toBeDefined()
    expect(uniforms.pcssLightSizeUv.value).toBe(getPcssLightSizeUv())
    disablePcssShadows()
  })

  it('nutzt ausreichend PCSS-Samples gegen sichtbares Poisson-Raster', () => {
    expect(PCSS_NUM_SAMPLES).toBeGreaterThanOrEqual(25)
  })

  it('hat Ortho-Penumbra-Skala für sichtbaren Weichheit-Slider', () => {
    expect(PCSS_PENUMBRA_SCALE).toBe(8)
  })
})
