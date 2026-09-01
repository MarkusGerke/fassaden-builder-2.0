import * as THREE from 'three'

/**
 * Three.js WebGLRenderer filtert Punktlichter **nicht** nach Objekt-Layern.
 * Ein Licht, das die Kamera „sieht“, beleuchtet jedes gerenderte Mesh —
 * deshalb leuchteten Paneele, Sockel, Gesimse und Konchen trotz Layer-Trennung.
 *
 * Außen-Materialien multiplizieren die Punktlicht-Farbe in `getPointLightInfo`
 * mit (1 − uSkipPointLights). Sonne / Hemisphere bleiben. Glas und Innenwand
 * bekommen das nicht.
 */
const skipUniform = { value: 0 }

export const SKIP_POINT_LIGHTS_MARKER = '#define LIGHTS_FRAGMENT_BEGIN_DONE'

const POINT_ATTENUATION_LINE =
  'light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );'

const POINT_SKIP_LINE = 'light.color *= (1.0 - uSkipPointLights);'

export function setSkipPointLights(skip: boolean): void {
  skipUniform.value = skip ? 1 : 0
}

export function skipPointLightsEnabled(): boolean {
  return skipUniform.value > 0.5
}

/** True wenn der aktuelle Three.js-Chunk die erwartete Punktlicht-Zeile hat. */
export function skipPointLightsChunkSupported(): boolean {
  return THREE.ShaderChunk.lights_pars_begin.includes(POINT_ATTENUATION_LINE)
}

function patchedLightsParsBegin(): string {
  const chunk = THREE.ShaderChunk.lights_pars_begin
  if (!chunk.includes(POINT_ATTENUATION_LINE) || chunk.includes(POINT_SKIP_LINE)) return chunk
  return chunk.replace(
    POINT_ATTENUATION_LINE,
    `${POINT_ATTENUATION_LINE}
		${POINT_SKIP_LINE}`,
  )
}

function patchedLightsFragmentBegin(): string {
  const chunk = THREE.ShaderChunk.lights_fragment_begin
  const needle = 'getPointLightInfo( pointLight, geometryPosition, directLight );'
  const patched = chunk.includes(needle)
    ? chunk.replace(
        needle,
        `${needle}
		directLight.color *= (1.0 - uSkipPointLights);`,
      )
    : chunk
  return `${patched}
${SKIP_POINT_LIGHTS_MARKER}
`
}

const POINT_SHADOW_LINE =
  'directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow('

function patchedLightsFragmentBeginNoPointShadow(): string {
  return THREE.ShaderChunk.lights_fragment_begin.replaceAll(
    POINT_SHADOW_LINE,
    'directLight.color *= 1.0; // getPointShadow(',
  )
}

export function bindSkipPointShadows(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  if (material.userData.skipPointShadowsBound) return
  material.userData.skipPointShadowsBound = true
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|skip-pt-shadow-v1`
  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(material, shader, renderer)
    if (shader.fragmentShader.includes('#include <lights_fragment_begin>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_begin>',
        patchedLightsFragmentBeginNoPointShadow(),
      )
      return
    }
    if (!shader.fragmentShader.includes(POINT_SHADOW_LINE)) return
    shader.fragmentShader = shader.fragmentShader.replaceAll(
      POINT_SHADOW_LINE,
      'directLight.color *= 1.0; // getPointShadow(',
    )
  }
  material.needsUpdate = true
}

export function bindSkipPointLights(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.05) return
  const name = (material.name ?? '').toLowerCase()
  if (name.includes('glass') || name.includes('glas')) return
  if (material.userData.skipPointLightsBound) return
  material.userData.skipPointLightsBound = true
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|skip-pt-v3`
  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.call(material, shader, renderer)
    shader.uniforms.uSkipPointLights = skipUniform
    if (shader.fragmentShader.includes(POINT_SKIP_LINE)) {
      if (!shader.fragmentShader.includes('uniform float uSkipPointLights')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
uniform float uSkipPointLights;`,
        )
      }
      return
    }
    let fragment = shader.fragmentShader
    if (!fragment.includes('uniform float uSkipPointLights')) {
      fragment = fragment.replace(
        '#include <common>',
        `#include <common>
uniform float uSkipPointLights;`,
      )
    }
    if (fragment.includes('#include <lights_pars_begin>')) {
      fragment = fragment.replace('#include <lights_pars_begin>', patchedLightsParsBegin())
    }
    if (fragment.includes('#include <lights_fragment_begin>') && !fragment.includes(POINT_SKIP_LINE)) {
      fragment = fragment.replace('#include <lights_fragment_begin>', patchedLightsFragmentBegin())
    }
    shader.fragmentShader = fragment
  }
  material.needsUpdate = true
}
