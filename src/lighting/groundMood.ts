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
  uGroundSnowCover: { value: number }
  uGroundSnowColor: { value: THREE.Color }
}

const GROUND_MOOD_SHADER_VERSION = 'v8'

const groundMoodUniforms: GroundMoodUniforms = {
  uGroundAlbedo: { value: new THREE.Color('#ffffff') },
  uGroundAmbient: { value: new THREE.Color('#cccccc') },
  uShadowUmbra: { value: 0.65 },
  uGroundSoftness: { value: 0.5 },
  uGroundSnowCover: { value: 0 },
  uGroundSnowColor: { value: new THREE.Color(0xe4ebf2) },
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
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|ground-mood-v8`
  const snowOnGround = material.name === 'studioGround'
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
    if (snowOnGround) {
      shader.uniforms.uGroundSnowCover = groundMoodUniforms.uGroundSnowCover
      shader.uniforms.uGroundSnowColor = groundMoodUniforms.uGroundSnowColor
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uGroundAlbedo;
uniform vec3 uGroundAmbient;${
          snowOnGround
            ? `
uniform float uGroundSnowCover;
uniform vec3 uGroundSnowColor;`
            : ''
        }`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
        irradiance = uGroundAlbedo * uGroundAmbient;`,
      )

    if (snowOnGround && shader.fragmentShader.includes('#include <opaque_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
{
  float snowC = clamp(uGroundSnowCover, 0.0, 1.0);
  if (snowC > 0.001) {
    float luma = max(0.08, dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 snowLit = uGroundSnowColor * clamp(luma / 0.38, 0.18, 1.12);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, snowLit, snowC);
  }
}`,
      )
    }
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

/** Nur Albedo (z. B. Schneedecke) — ohne Shadow-Mood neu zu setzen. */
export function setGroundMoodAlbedo(groundAlbedo: THREE.Color): void {
  groundMoodUniforms.uGroundAlbedo.value.copy(groundAlbedo)
}

/** Schneedecke auf dem echten Boden: Farbe tauschen, PCSS-Verhältnis behalten. */
export function setGroundMoodSnowCover(cover: number): void {
  groundMoodUniforms.uGroundSnowCover.value = Number.isFinite(cover)
    ? Math.min(1, Math.max(0, cover))
    : 0
}

/** Arbeitsmodus: harte Boden-Umbra, keine weiche Penumbra. */
export function setGroundShadowHard(hard: boolean): void {
  if (!hard) return
  groundMoodUniforms.uGroundSoftness.value = 0
  groundMoodUniforms.uShadowUmbra.value = 1
}
