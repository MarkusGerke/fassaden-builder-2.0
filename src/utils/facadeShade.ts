import * as THREE from 'three'
import type { SunSettings } from './sunLighting'
import { SKIP_POINT_LIGHTS_MARKER } from '../lighting/skipPointLights'

/**
 * Gegenlicht: die große Fassadenfront wird dunkel (N·L), Seiten und Oberseiten
 * bleiben ohne Nachhilfe hell (Sonne + Hemisphere). Shader dämpft Direct+Hemi
 * auf Nicht-Frontflächen, wenn die Fassadennormale von der Sonne wegzeigt.
 * Schrift nutzt denselben Shader, dimmt aber die ganze Glyphe (inkl. Front)
 * und stärkere Faktoren — Labels empfangen oft nur grob Shadow-Map.
 *
 * Stärke folgt global den Sonnen-Einstellungen (Ambient, Kontrast, Dunkelheit).
 */
export interface FacadeShadeParams {
  directDim: number
  hemiDim: number
  interiorDirectDim: number
  interiorHemiDim: number
  /** Schrift: Direct-Restlicht auf der Schattenseite (stärker als Wand). */
  labelDirectDim: number
  /** Schrift: Hemisphere-Restlicht auf der Schattenseite (stärker als Wand). */
  labelHemiDim: number
}

export interface FacadeShadeOptions {
  /** Wandbeschriftung: Front mitdimmen, eigene Dim-Faktoren, Shadow-Z-Bias. */
  label?: boolean
}

/**
 * Shadow-Map-Z-Offset nur für Schrift. Glyphen sitzen 1–2 cm vor der Wand;
 * ohne Extra-Bias frisst die Wand-Karte die Buchstaben (v0.7.199).
 * 0,004 ≈ einige cm bei typischem Ortho-Frustum — Nachbarflügel bleiben dunkel.
 */
export const LABEL_SHADOW_COORD_Z_BIAS = 0.004

const shadeUniforms = {
  uDirectDim: { value: 0.1 },
  uHemiDim: { value: 0.42 },
  uInteriorDirectDim: { value: 0.22 },
  uInteriorHemiDim: { value: 0.38 },
  uLabelDirectDim: { value: 0.06 },
  uLabelHemiDim: { value: 0.18 },
}

export function setFacadeShadeParams(params: FacadeShadeParams): void {
  shadeUniforms.uDirectDim.value = params.directDim
  shadeUniforms.uHemiDim.value = params.hemiDim
  shadeUniforms.uInteriorDirectDim.value = params.interiorDirectDim
  shadeUniforms.uInteriorHemiDim.value = params.interiorHemiDim
  shadeUniforms.uLabelDirectDim.value = params.labelDirectDim
  shadeUniforms.uLabelHemiDim.value = params.labelHemiDim
}

/** Leitet Abdunklungsstärke aus Sonnen-Slidern ab (Wände + stärkere Schrift-Werte). */
export function facadeShadeParamsFromSun(settings: SunSettings): FacadeShadeParams {
  // Nachts / unter Horizont: kein Gegenlicht-Dim — sonst dämpfen Punktlichter mit (Wände grau).
  if (!Number.isFinite(settings.elevationRad) || settings.elevationRad <= 0.02) {
    return {
      directDim: 1,
      hemiDim: 1,
      interiorDirectDim: 1,
      interiorHemiDim: 1,
      labelDirectDim: 1,
      labelHemiDim: 1,
    }
  }
  const ambientNorm = THREE.MathUtils.clamp(settings.ambient / 0.65, 0.25, 1.4)
  const invContrast = 1 / Math.max(0.5, settings.shadowContrast)
  const densityBoost = 1 + settings.shadowDensity * 0.35
  return {
    // Contrast bis 5: Direct und Hemi dimmen mit — sonst bleibt Neutral trotz Max blass.
    directDim: THREE.MathUtils.clamp((0.05 + 0.08 * ambientNorm) * invContrast * densityBoost, 0.02, 0.35),
    hemiDim: THREE.MathUtils.clamp((0.32 + 0.28 * ambientNorm) * invContrast, 0.1, 0.68),
    interiorDirectDim: THREE.MathUtils.clamp((0.14 + 0.12 * ambientNorm) * densityBoost, 0.1, 0.38),
    interiorHemiDim: THREE.MathUtils.clamp(0.3 + 0.22 * ambientNorm, 0.25, 0.58),
    labelDirectDim: THREE.MathUtils.clamp(
      (0.03 + 0.05 * ambientNorm) * invContrast * densityBoost,
      0.025,
      0.14,
    ),
    labelHemiDim: THREE.MathUtils.clamp(0.11 + 0.14 * ambientNorm, 0.1, 0.32),
  }
}

export function facadeOutwardLocalZ(panelFlip: boolean | undefined): number {
  return panelFlip ? -1 : 1
}

export function applyFacadeShadeShader(
  material: THREE.Material,
  outwardLocalZ: number,
  options?: FacadeShadeOptions,
): void {
  if (material.userData.skipFacadeShade === true) return
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  const isLabel = options?.label === true
  // Flache Schrift: transparent + opacity 1 + alphaTest — Shader trotzdem anwenden.
  if (!isLabel && material.transparent && material.opacity < 0.95) return
  if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.05) return
  const name = (material.name ?? '').toLowerCase()
  if (name.includes('glass') || name.includes('glas')) return

  material.userData.uFacadeOutwardLocal = outwardLocalZ
  material.userData.uLabelShade = isLabel ? 1 : 0
  material.userData.exteriorSurface = true
  const existing = material.userData.uFacadeOutwardUniform as { value: number } | undefined
  if (existing) existing.value = outwardLocalZ
  const existingLabel = material.userData.uLabelShadeUniform as { value: number } | undefined
  if (existingLabel) existingLabel.value = isLabel ? 1 : 0
  if (material.userData.facadeShadeApplied) return
  material.userData.facadeShadeApplied = true
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|facade-backlit-v10${isLabel ? '|label' : ''}`
  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer)
    const hasLightsInclude = shader.fragmentShader.includes('#include <lights_fragment_begin>')
    const hasLightsMarker = shader.fragmentShader.includes(SKIP_POINT_LIGHTS_MARKER)
    if (
      !shader.vertexShader.includes('#include <beginnormal_vertex>') ||
      (!hasLightsInclude && !hasLightsMarker)
    ) {
      return
    }
    const uniform = { value: material.userData.uFacadeOutwardLocal as number }
    shader.uniforms.uFacadeOutwardLocal = uniform
    material.userData.uFacadeOutwardUniform = uniform
    const labelUniform = { value: isLabel ? 1 : 0 }
    shader.uniforms.uLabelShade = labelUniform
    material.userData.uLabelShadeUniform = labelUniform
    shader.uniforms.uDirectDim = shadeUniforms.uDirectDim
    shader.uniforms.uHemiDim = shadeUniforms.uHemiDim
    shader.uniforms.uInteriorDirectDim = shadeUniforms.uInteriorDirectDim
    shader.uniforms.uInteriorHemiDim = shadeUniforms.uInteriorHemiDim
    shader.uniforms.uLabelDirectDim = shadeUniforms.uLabelDirectDim
    shader.uniforms.uLabelHemiDim = shadeUniforms.uLabelHemiDim
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFacadeObjectNormal;
varying vec3 vFacadeView;
uniform float uFacadeOutwardLocal;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
vFacadeObjectNormal = objectNormal;
vFacadeView = normalize(normalMatrix * vec3(0.0, 0.0, uFacadeOutwardLocal));`,
      )
    if (isLabel) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <shadowmap_vertex>',
        `#include <shadowmap_vertex>
#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 )
    vDirectionalShadowCoord[ 0 ].z -= ${LABEL_SHADOW_COORD_Z_BIAS.toFixed(4)};
#endif`,
      )
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vFacadeObjectNormal;
varying vec3 vFacadeView;
uniform float uFacadeOutwardLocal;
uniform float uDirectDim;
uniform float uHemiDim;
uniform float uInteriorDirectDim;
uniform float uInteriorHemiDim;
uniform float uLabelShade;
uniform float uLabelDirectDim;
uniform float uLabelHemiDim;`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
        {
          vec3 objN = normalize(vFacadeObjectNormal);
          float frontness = abs(objN.z);
          float sideOrTop = 1.0 - smoothstep(0.35, 0.85, frontness);
          float sunOnFront = 0.0;
          #if ( NUM_DIR_LIGHTS > 0 )
            sunOnFront = dot(normalize(vFacadeView), directionalLights[0].direction);
          #endif
          float backlit = 1.0 - smoothstep(-0.28, -0.04, sunOnFront);
          // Hauptfläche (sideOrTop≈0): bei Gegenlicht dimmen; Seiten/Oberkanten bleiben hell.
          float dimMask = mix(1.0 - sideOrTop, 1.0, uLabelShade);
          float dim = clamp(backlit * dimMask, 0.0, 1.0);
          float directAmt = mix(uDirectDim, uLabelDirectDim, uLabelShade);
          float hemiAmt = mix(uHemiDim, uLabelHemiDim, uLabelShade);
          reflectedLight.directDiffuse *= mix(1.0, directAmt, dim);
          reflectedLight.directSpecular *= mix(1.0, directAmt, dim);
          reflectedLight.indirectDiffuse *= mix(1.0, hemiAmt, dim);
          reflectedLight.indirectSpecular *= mix(1.0, mix(1.0, hemiAmt, uLabelShade), dim);
        }`,
      )
      .replace(
        SKIP_POINT_LIGHTS_MARKER,
        `${SKIP_POINT_LIGHTS_MARKER}
        {
          vec3 objN = normalize(vFacadeObjectNormal);
          float frontness = abs(objN.z);
          float sideOrTop = 1.0 - smoothstep(0.35, 0.85, frontness);
          float sunOnFront = 0.0;
          #if ( NUM_DIR_LIGHTS > 0 )
            sunOnFront = dot(normalize(vFacadeView), directionalLights[0].direction);
          #endif
          float backlit = 1.0 - smoothstep(-0.28, -0.04, sunOnFront);
          // Hauptfläche (sideOrTop≈0): bei Gegenlicht dimmen; Seiten/Oberkanten bleiben hell.
          float dimMask = mix(1.0 - sideOrTop, 1.0, uLabelShade);
          float dim = clamp(backlit * dimMask, 0.0, 1.0);
          float directAmt = mix(uDirectDim, uLabelDirectDim, uLabelShade);
          float hemiAmt = mix(uHemiDim, uLabelHemiDim, uLabelShade);
          reflectedLight.directDiffuse *= mix(1.0, directAmt, dim);
          reflectedLight.directSpecular *= mix(1.0, directAmt, dim);
          reflectedLight.indirectDiffuse *= mix(1.0, hemiAmt, dim);
          reflectedLight.indirectSpecular *= mix(1.0, mix(1.0, hemiAmt, uLabelShade), dim);
        }`,
      )
  }
  material.needsUpdate = true
}
