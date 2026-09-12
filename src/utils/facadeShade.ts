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
  /**
   * Gegenlicht aus der echten Flächennormale (N·L) statt Objekt-Z — für Rahmen, Sprossen,
   * Fensterbänke, deren lokale Achsen nicht zur Wand-Außenrichtung passen (v2.0.365).
   * Ohne Seiten/Oberkanten-Ausnahme: jede sonnenabgewandte Fläche dimmt.
   */
  normalBacklit?: boolean
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

/** Nacht: Außen ohne Gegenlicht-Dim; Innen Restlicht, damit Weiß nicht pechschwarz wirkt. */
const INTERIOR_SHADE_NIGHT: Pick<
  FacadeShadeParams,
  'interiorDirectDim' | 'interiorHemiDim' | 'interiorIndirectGain'
> = {
  interiorDirectDim: 0.42,
  interiorHemiDim: 0.28,
  interiorIndirectGain: 0.45,
}

/** Unter Horizont: kein volles Hemi auf der Fassade (v2.0.352 FULL wirkte wie Tag bei falscher Höhe). */
const EXTERIOR_SHADE_NIGHT: Pick<
  FacadeShadeParams,
  'directDim' | 'hemiDim' | 'labelDirectDim' | 'labelHemiDim'
> = {
  directDim: 0.28,
  hemiDim: 0.2,
  labelDirectDim: 0.14,
  labelHemiDim: 0.16,
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
  return applyShadeDepth(facadeShadeParamsDaylight(settings, shadeWeight), settings.shadeDepth)
}

/**
 * Slider „Schatten-Tiefe“ (v2.0.364): skaliert Fassaden-Schattenseite und Innenraum.
 * 0 → unverändert, 1 → nahezu schwarz. Boden-Schlagschatten (shadow.intensity) bleibt unberührt.
 */
export function applyShadeDepth(params: FacadeShadeParams, depth: number): FacadeShadeParams {
  const d = Number.isFinite(depth) ? THREE.MathUtils.clamp(depth, 0, 1) : 0
  if (d <= 0.001) return params
  const hemiScale = 1 - 0.92 * d
  const directScale = 1 - 0.8 * d
  // Innen: Sonne durch Öffnung/Glas muss sichtbar bleiben (v2.0.366) — Direct nur leicht,
  // Streulicht (Hemi/Env) stark dimmen.
  const interiorDirectScale = 1 - 0.3 * d
  return {
    directDim: params.directDim * directScale,
    hemiDim: params.hemiDim * hemiScale,
    interiorDirectDim: params.interiorDirectDim * interiorDirectScale,
    interiorHemiDim: params.interiorHemiDim * hemiScale,
    interiorIndirectGain: params.interiorIndirectGain * hemiScale,
    labelDirectDim: params.labelDirectDim * directScale,
    labelHemiDim: params.labelHemiDim * hemiScale,
  }
}

function facadeShadeParamsDaylight(settings: SunSettings, shadeWeight: number): FacadeShadeParams {
  if (shadeWeight <= 0.001) {
    return {
      ...EXTERIOR_SHADE_NIGHT,
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
    // Direct: Sonnenfleck durch Öffnung/Glas (v2.0.366).
    // Indirect: Weiß muss als Weiß lesbar bleiben (v2.0.367) — zuvor hemiDim²×gain ≈ 0
    // → Boden/Innenwand wirkten dunkelgrau trotz Albedo #ffffff.
    interiorDirectDim: THREE.MathUtils.clamp(0.6 + 0.15 * ambientNorm, 0.55, 0.85),
    interiorHemiDim: THREE.MathUtils.clamp(0.32 + 0.12 * ambientNorm, 0.28, 0.48),
    interiorIndirectGain: THREE.MathUtils.clamp(0.55 + 0.15 * ambientNorm, 0.5, 0.75),
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

/**
 * Nach `lights_fragment_begin`: Gegenlicht-Maske berechnen, Direct dimmen.
 * `facadeDim`/`facadeHemiAmt` bleiben für den Indirect-Patch im Scope.
 */
const FACADE_SHADE_DIRECT_PATCH = `
        float facadeDim = 0.0;
        float facadeHemiAmt = 1.0;
        float facadeSideOrTop = 0.0;
        {
          vec3 objN = normalize(vFacadeObjectNormal);
          float frontness = abs(objN.z);
          float sideOrTop = 1.0 - smoothstep(0.35, 0.85, frontness);
          facadeSideOrTop = sideOrTop;
          float sunOnFront = 0.0;
          #if ( NUM_DIR_LIGHTS > 0 )
            vec3 facadeRef = normalize(mix(normalize(vFacadeView), geometryNormal, uNormalBacklit));
            sunOnFront = dot(facadeRef, directionalLights[0].direction);
          #endif
          float backlit = 1.0 - smoothstep(-0.28, -0.04, sunOnFront);
          // Front (sideOrTop≈0): volles Gegenlicht-Dim. Flache horizontale Facetten: stärker dimmen
          // (v2.0.370: 0,45 reichte nicht — v2.0.371: ~82 % + Extra-Indirect unten).
          float dimMask = max(mix(1.0 - sideOrTop * 0.82, 1.0, uLabelShade), uNormalBacklit);
          facadeDim = clamp(backlit * dimMask, 0.0, 1.0);
          float directAmt = mix(uDirectDim, uLabelDirectDim, uLabelShade);
          facadeHemiAmt = mix(uHemiDim, uLabelHemiDim, uLabelShade);
          reflectedLight.directDiffuse *= mix(1.0, directAmt, facadeDim);
          reflectedLight.directSpecular *= mix(1.0, directAmt, facadeDim);
        }`

/**
 * Vor `lights_fragment_end`: Hemi/Probe (`irradiance`) und EnvMap (`iblIrradiance`, `radiance`)
 * dimmen. **v2.0.364:** Vorher wurde `reflectedLight.indirectDiffuse` direkt nach
 * `lights_fragment_begin` skaliert — dort ist es noch 0 (Three r183 addiert IBL/Hemi erst in
 * `lights_fragment_end`) → Hemi-Dim war wirkungslos, Schattenseite blieb tag-hell.
 */
const FACADE_SHADE_INDIRECT_PATCH = `
        {
          float facadeIndirect = mix(1.0, facadeHemiAmt, facadeDim);
          float horizExtra = facadeSideOrTop * max(facadeDim, 0.22);
          facadeIndirect *= mix(1.0, 0.35, horizExtra);
          irradiance *= facadeIndirect;
          iblIrradiance *= facadeIndirect;
          radiance *= mix(1.0, mix(1.0, facadeHemiAmt, uLabelShade), facadeDim);
        }`

export function facadeOutwardLocalZ(panelFlip: boolean | undefined): number {
  return panelFlip ? -1 : 1
}

export function applyFacadeShadeShader(
  material: THREE.Material,
  outwardLocalZ: number,
  options?: FacadeShadeOptions,
): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  if (material.userData.skipFacadeShade === true) return
  const isLabel = options?.label === true
  const normalBacklit =
    options?.normalBacklit === true || material.userData.facadeShadeNormalMode === true
  // Flache Schrift: transparent + opacity 1 + alphaTest — Shader trotzdem anwenden.
  if (!isLabel && material.transparent && material.opacity < 0.95) return
  if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.05) return
  const name = (material.name ?? '').toLowerCase()
  if (name.includes('glass') || name.includes('glas')) return

  material.userData.uFacadeOutwardLocal = outwardLocalZ
  material.userData.uLabelShade = isLabel ? 1 : 0
  material.userData.uNormalBacklit = normalBacklit ? 1 : 0
  material.userData.exteriorSurface = true
  const existing = material.userData.uFacadeOutwardUniform as { value: number } | undefined
  if (existing) existing.value = outwardLocalZ
  const existingLabel = material.userData.uLabelShadeUniform as { value: number } | undefined
  if (existingLabel) existingLabel.value = isLabel ? 1 : 0
  const existingNormal = material.userData.uNormalBacklitUniform as { value: number } | undefined
  if (existingNormal) existingNormal.value = normalBacklit ? 1 : 0
  if (material.userData.facadeShadeApplied) return
  material.userData.facadeShadeApplied = true
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|facade-backlit-v14${isLabel ? '|label' : ''}`
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
    const normalUniform = { value: material.userData.uNormalBacklit as number }
    shader.uniforms.uNormalBacklit = normalUniform
    material.userData.uNormalBacklitUniform = normalUniform
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
uniform float uNormalBacklit;
uniform float uLabelDirectDim;
uniform float uLabelHemiDim;`,
      )
      .replace(
        '#include <lights_fragment_begin>',
        `#include <lights_fragment_begin>
${FACADE_SHADE_DIRECT_PATCH}`,
      )
      .replace(
        SKIP_POINT_LIGHTS_MARKER,
        `${SKIP_POINT_LIGHTS_MARKER}
${FACADE_SHADE_DIRECT_PATCH}`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `${FACADE_SHADE_INDIRECT_PATCH}
#include <lights_fragment_end>`,
      )
  }
  material.needsUpdate = true
}

/**
 * Indirect gedämpft, Direct für Sonnenfleck. v2.0.367: kein hemiDim² mehr —
 * sonst Weiß→Dunkelgrau trotz korrekter Albedo.
 */
const interiorShadePatch = `
        {
          float hemiIn = clamp(uInteriorHemiDim * uInteriorIndirectGain, 0.04, 1.0);
          reflectedLight.indirectDiffuse *= hemiIn;
          reflectedLight.indirectSpecular *= hemiIn;
          float directIn = clamp(uInteriorDirectDim, 0.02, 1.0);
          reflectedLight.directDiffuse *= directIn;
          reflectedLight.directSpecular *= directIn;
        }`

/** Innenflächen: kein volles Himmels-Hemi/Env — nur gedämpftes Restlicht (Fenster). */
export function applyInteriorShadeShader(material: THREE.MeshStandardMaterial): void {
  if (material.userData.skipInteriorShade === true) return
  if (material.userData.interiorShadeHooked) return
  material.userData.interiorShadeHooked = true
  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|interior-shade-v8`
  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer)
    const frag = shader.fragmentShader
    const hasLightsEnd = frag.includes('#include <lights_fragment_end>')
    if (!hasLightsEnd) return
    shader.uniforms.uInteriorDirectDim = shadeUniforms.uInteriorDirectDim
    shader.uniforms.uInteriorHemiDim = shadeUniforms.uInteriorHemiDim
    shader.uniforms.uInteriorIndirectGain = shadeUniforms.uInteriorIndirectGain
    shader.fragmentShader = frag
      .replace(
        '#include <common>',
        `#include <common>
uniform float uInteriorDirectDim;
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
