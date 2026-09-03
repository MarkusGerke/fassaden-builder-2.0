import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { applyGroundMoodShader } from './groundMood'

describe('groundMood shader', () => {
  it('ersetzt Himmels-Irradiance durch Nutzer-Albedo × Ambient, ohne Kontakt-RT', () => {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff })
    applyGroundMoodShader(material)
    let fragmentShader = ''
    const wrapped = material.onBeforeCompile!
    material.onBeforeCompile = (shader, renderer) => {
      wrapped(shader, renderer)
      fragmentShader = shader.fragmentShader
    }
    material.onBeforeCompile(
      {
        fragmentShader: `#include <common>
#include <shadowmap_pars_fragment>
void main() {
  #include <lights_fragment_begin>
  #include <lights_fragment_end>
}
`,
        vertexShader: `#include <common>
void main() {
  #include <worldpos_vertex>
}
`,
        uniforms: {},
      } as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    expect(fragmentShader).not.toContain('getShadow(')
    expect(fragmentShader).toContain('irradiance = uGroundAlbedo * uGroundAmbient')
    expect(fragmentShader).not.toContain('uShadowSkyColor')
    expect(fragmentShader).not.toContain('uContactMap')
    expect(material.envMapIntensity).toBe(0)
  })
})
