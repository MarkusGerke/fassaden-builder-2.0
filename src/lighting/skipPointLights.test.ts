import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  bindSkipPointLights,
  bindSkipPointShadows,
  setSkipPointLights,
  skipPointLightsChunkSupported,
  skipPointLightsEnabled,
} from './skipPointLights'

function stubShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\n',
    fragmentShader:
      '#include <common>\n#include <lights_pars_begin>\n#include <lights_fragment_begin>\n',
  }
}

describe('skipPointLights', () => {
  it('Three.js-Chunk enthält die Punktlicht-Attenuation zum Patchen', () => {
    expect(skipPointLightsChunkSupported()).toBe(true)
  })

  it('bindet Uniform und dämpft Punktlicht-Farbe in getPointLightInfo', () => {
    const mat = new THREE.MeshStandardMaterial()
    bindSkipPointLights(mat)
    expect(mat.userData.skipPointLightsBound).toBe(true)
    setSkipPointLights(true)
    expect(skipPointLightsEnabled()).toBe(true)
    const shader = stubShader()
    mat.onBeforeCompile!(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    expect(shader.fragmentShader).toContain('uniform float uSkipPointLights')
    expect(shader.fragmentShader).toContain('light.color *= (1.0 - uSkipPointLights)')
    expect(shader.fragmentShader).not.toContain('#include <lights_pars_begin>')
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>')
    setSkipPointLights(false)
    expect(skipPointLightsEnabled()).toBe(false)
  })

  it('lässt Gegenlicht-Shader den Lights-Include behalten', async () => {
    const { applyFacadeShadeShader } = await import('../utils/facadeShade')
    const mat = new THREE.MeshStandardMaterial()
    bindSkipPointLights(mat)
    applyFacadeShadeShader(mat, 1)
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <beginnormal_vertex>\n',
      fragmentShader:
        '#include <common>\n#include <lights_pars_begin>\n#include <lights_fragment_begin>\n',
    }
    mat.onBeforeCompile!(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    const dimBlocks = shader.fragmentShader.split('mix(sideOrTop, 1.0, uLabelShade)').length - 1
    expect(dimBlocks).toBe(1)
    expect(shader.fragmentShader).toContain('light.color *= (1.0 - uSkipPointLights)')
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>')
  })

  it('lässt Glas unangetastet', () => {
    const mat = new THREE.MeshPhysicalMaterial({ transmission: 1 })
    bindSkipPointLights(mat)
    expect(mat.userData.skipPointLightsBound).toBeUndefined()
  })

  it('nimmt Innenwänden die Punktlicht-Selbstabschattung', () => {
    const mat = new THREE.MeshStandardMaterial()
    bindSkipPointShadows(mat)
    const shader = stubShader()
    mat.onBeforeCompile!(
      shader as unknown as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    expect(shader.fragmentShader).toContain('directLight.color *= 1.0; // getPointShadow(')
    expect(shader.fragmentShader).not.toContain('#include <lights_fragment_begin>')
  })
})
