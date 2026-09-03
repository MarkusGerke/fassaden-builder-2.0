import * as THREE from 'three'

/**
 * Optional: Außen-Materialien multiplizieren Punktlicht mit (1 − uSkipPointLights).
 * Seit v2.0.102 standardmäßig **aus** (0): Punktlicht beleuchtet Fassade und Innenraum;
 * lichtdicht über Cube-Shadows / Okkluder. Sonne / Hemisphere bleiben unberührt.
 * Glas wird nie gebunden.
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

/**
 * Früher: Cube-Selbstschatten auf Innenwänden abschalten (Acne-Workaround).
 * Seit v2.0.102 No-Op — Innenwände/Böden empfangen Punktlicht-Schatten (Rahmen, Sprossen, Wände).
 * Alte Materialien mit `skipPointShadowsBound` werden beim nächsten Material-Rebuild neu erzeugt.
 */
export function bindSkipPointShadows(_material: THREE.Material): void {
  // bewusst leer — Schattenempfang wieder aktiv
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
