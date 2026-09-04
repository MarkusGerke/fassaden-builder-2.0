/**
 * Boden-Fill-Shader: Nutzer-Albedo × Sonnen-Ambient statt Himmelsblau.
 * Schatten kommt nur aus dem Standard-`getShadow` (PCSS) — kein zweites Sampling.
 */
import * as THREE from 'three'

export interface GroundMoodUniforms {
  uGroundAlbedo: { value: THREE.Color }
  uGroundAmbient: { value: THREE.Color }
  uShadowUmbra: { value: number }
  uGroundSoftness: { value: number }
}

const GROUND_MOOD_SHADER_VERSION = 'v6'

const groundMoodUniforms: GroundMoodUniforms = {
  uGroundAlbedo: { value: new THREE.Color('#ffffff') },
  uGroundAmbient: { value: new THREE.Color('#cccccc') },
  uShadowUmbra: { value: 0.65 },
  uGroundSoftness: { value: 0.5 },
}

export function applyGroundMoodShader(material: THREE.MeshStandardMaterial): void {
  if (material.userData.groundMoodVersion !== GROUND_MOOD_SHADER_VERSION) {
    material.userData.groundMoodApplied = false
    material.userData.groundMoodVersion = GROUND_MOOD_SHADER_VERSION
  }
  if (material.userData.groundMoodApplied) return
  material.userData.groundMoodApplied = true
  if (!material.name) material.name = 'studioGround'
  material.envMap = null
  material.envMapIntensity = 0
  material.roughness = 1
  material.metalness = 0
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|ground-mood-v6`
  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer)
    if (
      !shader.fragmentShader.includes('#include <shadowmap_pars_fragment>') ||
      !shader.fragmentShader.includes('#include <lights_fragment_begin>') ||
      !shader.fragmentShader.includes('#include <lights_fragment_end>') ||
      !shader.vertexShader.includes('#include <worldpos_vertex>')
    ) {
      return
    }
    shader.uniforms.uGroundAlbedo = groundMoodUniforms.uGroundAlbedo
    shader.uniforms.uGroundAmbient = groundMoodUniforms.uGroundAmbient

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uGroundAlbedo;
uniform vec3 uGroundAmbient;`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
        irradiance = uGroundAlbedo * uGroundAmbient;`,
      )
  }
  material.needsUpdate = true
}

export function updateGroundMoodUniformValues(
  mood: {
    shadowUmbraStrength: number
    groundShadowSoftness: number
    groundAmbientColor: THREE.Color
  },
  groundAlbedo: THREE.Color,
): void {
  groundMoodUniforms.uGroundAlbedo.value.copy(groundAlbedo)
  groundMoodUniforms.uGroundAmbient.value.copy(mood.groundAmbientColor)
  groundMoodUniforms.uShadowUmbra.value = mood.shadowUmbraStrength
  groundMoodUniforms.uGroundSoftness.value = mood.groundShadowSoftness
}

/** Arbeitsmodus: harte Boden-Umbra, keine weiche Penumbra. */
export function setGroundShadowHard(hard: boolean): void {
  if (!hard) return
  groundMoodUniforms.uGroundSoftness.value = 0
  groundMoodUniforms.uShadowUmbra.value = 1
}
