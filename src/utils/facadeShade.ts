import * as THREE from 'three'
import type { SunSettings } from './sunLighting'
import { SKIP_POINT_LIGHTS_MARKER } from '../lighting/skipPointLights'

/**
 * Gegenlicht: die große Fassadenfront wird dunkel (N·L), Seiten und Oberseiten
 * bleiben ohne Nachhilfe hell (Sonne + Hemisphere). Shader dämpft Direct+Hemi
 * auf Nicht-Frontflächen, wenn die Fassadennormale von der Sonne wegzeigt.
 * **v2.0.312:** Hemi nur noch leicht dämpfen — Schlagschatten behalten volles Ambient;
 * zu starkes Hemi-Dim machte Erker-Schenkel/Nordfassaden pechschwarz dagegen.
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
  /** Zusätzliche Skala auf Indirect (Hemi/Env-Anteil im Lichtpass). */
  interiorIndirectGain: number
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
  uInteriorIndirectGain: { value: 0.16 },
  uLabelDirectDim: { value: 0.06 },
  uLabelHemiDim: { value: 0.18 },
}

export function setFacadeShadeParams(params: FacadeShadeParams): void {
  shadeUniforms.uDirectDim.value = params.directDim
  shadeUniforms.uHemiDim.value = params.hemiDim
  shadeUniforms.uInteriorDirectDim.value = params.interiorDirectDim
  shadeUniforms.uInteriorHemiDim.value = params.interiorHemiDim
  shadeUniforms.uInteriorIndirectGain.value = params.interiorIndirectGain
  shadeUniforms.uLabelDirectDim.value = params.labelDirectDim
  shadeUniforms.uLabelHemiDim.value = params.labelHemiDim
}

const FACADE_SHADE_FULL: FacadeShadeParams = {
  directDim: 1,
  hemiDim: 1,
  interiorDirectDim: 1,
  interiorHemiDim: 1,
  interiorIndirectGain: 1,
  labelDirectDim: 1,
  labelHemiDim: 1,
}

/** Nacht: Außen ohne Gegenlicht-Dim; Innen nie volles Hemi (Punktlicht über moderate Direct-Dim). */
const INTERIOR_SHADE_NIGHT: Pick<
  FacadeShadeParams,
  'interiorDirectDim' | 'interiorHemiDim' | 'interiorIndirectGain'
> = {
  interiorDirectDim: 0.42,
  interiorHemiDim: 0.18,
  interiorIndirectGain: 0.22,
}

/** Leitet Abdunklungsstärke aus Sonnen-Slidern ab (Wände + stärkere Schrift-Werte). */
export function facadeShadeParamsFromSun(settings: SunSettings): FacadeShadeParams {
  const elev = settings.elevationRad
  // Unter Horizont / sehr flach: kein Gegenlicht-Dim — weicher Übergang statt Knick bei ~1,15° (v2.0.342).
  if (!Number.isFinite(elev)) return FACADE_SHADE_FULL
  const shadeWeight = THREE.MathUtils.smoothstep(
    elev,
    THREE.MathUtils.degToRad(-0.5),
    THREE.MathUtils.degToRad(2.5),
  )
  if (shadeWeight <= 0.001) {
    return {
      ...FACADE_SHADE_FULL,
      ...INTERIOR_SHADE_NIGHT,
    }
  }
  const ambientNorm = THREE.MathUtils.clamp(settings.ambient / 0.65, 0.25, 1.4)
  const invContrast = 1 / Math.max(0.5, settings.shadowContrast)
  const densityBoost = 1 + settings.shadowDensity * 0.35
  const hemiContrast = Math.pow(invContrast, 0.25)
  const shaded: FacadeShadeParams = {
    directDim: THREE.MathUtils.clamp((0.05 + 0.08 * ambientNorm) * invContrast * densityBoost, 0.01, 0.35),
    hemiDim: THREE.MathUtils.clamp((0.78 + 0.16 * ambientNorm) * hemiContrast, 0.55, 0.94),
    interiorDirectDim: THREE.MathUtils.clamp((0.012 + 0.012 * ambientNorm) * densityBoost, 0.008, 0.05),
    interiorHemiDim: THREE.MathUtils.clamp(0.028 + 0.028 * ambientNorm, 0.02, 0.07),
    interiorIndirectGain: THREE.MathUtils.clamp(0.1 + 0.06 * ambientNorm, 0.08, 0.16),
    labelDirectDim: THREE.MathUtils.clamp(
      (0.03 + 0.05 * ambientNorm) * invContrast * densityBoost,
      0.015,
      0.14,
    ),
    labelHemiDim: THREE.MathUtils.clamp((0.28 + 0.18 * ambientNorm) * hemiContrast, 0.18, 0.55),
  }
  if (shadeWeight >= 0.999) return shaded
  return {
    directDim: THREE.MathUtils.lerp(FACADE_SHADE_FULL.directDim, shaded.directDim, shadeWeight),
    hemiDim: THREE.MathUtils.lerp(FACADE_SHADE_FULL.hemiDim, shaded.hemiDim, shadeWeight),
    interiorDirectDim: THREE.MathUtils.lerp(
      INTERIOR_SHADE_NIGHT.interiorDirectDim,
      shaded.interiorDirectDim,
      shadeWeight,
    ),
    interiorHemiDim: THREE.MathUtils.lerp(
      INTERIOR_SHADE_NIGHT.interiorHemiDim,
      shaded.interiorHemiDim,
      shadeWeight,
    ),
    interiorIndirectGain: THREE.MathUtils.lerp(
      INTERIOR_SHADE_NIGHT.interiorIndirectGain,
      shaded.interiorIndirectGain,
      shadeWeight,
    ),
    labelDirectDim: THREE.MathUtils.lerp(
      FACADE_SHADE_FULL.labelDirectDim,
      shaded.labelDirectDim,
      shadeWeight,
    ),
    labelHemiDim: THREE.MathUtils.lerp(FACADE_SHADE_FULL.labelHemiDim, shaded.labelHemiDim, shadeWeight),
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

/** Nur Indirect dämpfen — Direct = Sonne durch Öffnungen + Punktlicht unangetastet (v2.0.353). */
const interiorShadePatch = `
        {
          float hemiIn = uInteriorHemiDim * uInteriorHemiDim * uInteriorIndirectGain;
          reflectedLight.indirectDiffuse *= hemiIn;
          reflectedLight.indirectSpecular *= hemiIn;
        }`

/** Innenflächen: kein volles Himmels-Hemi/Env — nur gedämpftes Restlicht (Fenster). */
export function applyInteriorShadeShader(material: THREE.MeshStandardMaterial): void {
  if (material.userData.skipInteriorShade === true) return
  if (material.userData.interiorShadeHooked) return
  material.userData.interiorShadeHooked = true
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|interior-shade-v5`
  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer)
    const frag = shader.fragmentShader
    const hasLightsEnd = frag.includes('#include <lights_fragment_end>')
    if (!hasLightsEnd) return
    shader.uniforms.uInteriorHemiDim = shadeUniforms.uInteriorHemiDim
    shader.uniforms.uInteriorIndirectGain = shadeUniforms.uInteriorIndirectGain
    shader.fragmentShader = frag
      .replace(
        '#include <common>',
        `#include <common>
uniform float uInteriorHemiDim;
uniform float uInteriorIndirectGain;`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>${interiorShadePatch}`,
      )
    material.userData.interiorShadeApplied = true
  }
  material.needsUpdate = true
}
