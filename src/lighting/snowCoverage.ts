/**
 * Schneedecke auf Meshes: nach dem Licht Luma → Schneeweiß (Schatten bleiben),
 * nach Weltnormale (Dach auch steil; Details ≤ ~15°) und optionaler
 * Himmelssicht. Flach — kein Vertex-Displace.
 */

import * as THREE from 'three'
import { SNOW_MAX_SLOPE_COS } from './snowWeather'

export type SnowCoverageMode = 'none' | 'cover' | 'thick'

const snowUniforms = {
  uSnowCover: { value: 0 },
  uSnowMaxSlopeCos: { value: SNOW_MAX_SLOPE_COS },
  uSnowDisplace: { value: 0 },
  uSnowColor: { value: new THREE.Color(0xe4ebf2) },
  uSnowOccMap: { value: null as THREE.Texture | null },
  uSnowOccEnabled: { value: 0 },
  uSnowOccOriginXZ: { value: new THREE.Vector2(0, 0) },
  uSnowOccSizeXZ: { value: new THREE.Vector2(1, 1) },
  uSnowOccYMin: { value: 0 },
  uSnowOccYMax: { value: 1 },
}

const SNOW_SHADER_VERSION = 'v6'

/** Welt-Albedo der Schneedecke (auch für Ground-Mood / Material-Tint). */
export const SNOW_ALBEDO_COLOR = new THREE.Color(0xe4ebf2)

export function setSnowCoverageUniforms(opts: {
  cover: number
  displaceCm: number
  occMap: THREE.Texture | null
  occEnabled: boolean
  occOriginX: number
  occOriginZ: number
  occSizeX: number
  occSizeZ: number
  occYMin: number
  occYMax: number
}): void {
  snowUniforms.uSnowCover.value = THREE.MathUtils.clamp(opts.cover, 0, 1)
  snowUniforms.uSnowMaxSlopeCos.value = SNOW_MAX_SLOPE_COS
  snowUniforms.uSnowDisplace.value = Math.max(0, opts.displaceCm)
  snowUniforms.uSnowOccMap.value = opts.occMap
  snowUniforms.uSnowOccEnabled.value = opts.occEnabled && opts.occMap ? 1 : 0
  snowUniforms.uSnowOccOriginXZ.value.set(opts.occOriginX, opts.occOriginZ)
  snowUniforms.uSnowOccSizeXZ.value.set(Math.max(1, opts.occSizeX), Math.max(1, opts.occSizeZ))
  snowUniforms.uSnowOccYMin.value = opts.occYMin
  snowUniforms.uSnowOccYMax.value = opts.occYMax
}

/**
 * Welche Flächen Schnee annehmen dürfen (Q17B / Q18A).
 * Senkrechte Fassade bleibt über Normalen-Falloff weitgehend frei.
 */
export function snowCoverageModeForObject(obj: THREE.Object3D): SnowCoverageMode {
  const name = (obj.name ?? '').toLowerCase()
  if (name === 'studioground') return 'thick'

  const kind = obj.userData.kind as string | undefined
  const wallPart = obj.userData.wallPart as string | undefined
  const openingPart = obj.userData.openingPart as string | undefined
  const roofPart = obj.userData.roofPart as string | undefined
  const role = obj.userData.role as string | undefined
  const matName = (() => {
    if (!(obj instanceof THREE.Mesh)) return ''
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
    return ((mat as THREE.Material | undefined)?.name ?? '').toLowerCase()
  })()

  if (role === 'fabric' || role === 'guideRail' || role === 'slat') return 'none'
  if (matName.includes('glass') || matName.includes('glas')) return 'none'
  if (openingPart === 'glass' || openingPart === 'glazing') return 'none'
  if (kind === 'awning' || wallPart === 'awning') return 'none'
  if (kind === 'bayMouthSunOccluder' || kind === 'sunCeilingOccluder') return 'none'
  if (obj.userData.shadowOccluder === true) return 'none'

  if (kind === 'roof') {
    if (roofPart === 'tiles') return 'thick'
    if (roofPart === 'shell' || roofPart === 'dormerRoof' || roofPart === 'dormerShell') return 'thick'
    // Gutter / frame / glass: keine dicke Decke; Rahmen optional cover
    if (roofPart === 'gutter' || roofPart === 'trim') return 'cover'
    return 'none'
  }

  // Gaube/Dachfenster-Rahmen: oft kind !== 'roof', aber roofPart gesetzt
  if (
    roofPart === 'tiles' ||
    roofPart === 'shell' ||
    roofPart === 'dormerRoof' ||
    roofPart === 'dormerShell'
  ) {
    return 'thick'
  }

  if (kind === 'ceiling') return 'thick'
  // Innenboden: keine Decke — Hof liegt auf studioGround
  if (kind === 'floor') return 'none'
  if (kind === 'baySoffit') return 'cover'

  // Horizontale / leicht geneigte Details (≤15° per Shader) — nicht die senkrechte Wandschale
  if (
    wallPart === 'cornice' ||
    wallPart === 'trimBand' ||
    wallPart === 'profile' ||
    wallPart === 'plinth'
  ) {
    return 'cover'
  }

  if (
    openingPart === 'sillOuter' ||
    openingPart === 'sillInner' ||
    openingPart === 'pediment' ||
    openingPart === 'trim' ||
    openingPart === 'parapet'
  ) {
    return 'cover'
  }

  if (role === 'cassette' || role === 'frontBar') {
    return 'cover'
  }

  return 'none'
}

export function applySnowCoverageShader(
  material: THREE.Material,
  mode: SnowCoverageMode,
): void {
  if (mode === 'none') return
  if (!(material instanceof THREE.MeshStandardMaterial)) return
  if (material.userData.skipSnowCoverage === true) return
  if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.05) return
  const name = (material.name ?? '').toLowerCase()
  if (name.includes('glass') || name.includes('glas')) return
  if (name === 'studioground') return
  if (material.userData.groundMoodApplied === true) return
  if (material.transparent && material.opacity < 0.95) return

  const thick = mode === 'thick'
  if (
    material.userData.snowCoverageApplied === true &&
    material.userData.snowCoverageVersion === SNOW_SHADER_VERSION &&
    material.userData.snowCoverageThick === thick
  ) {
    return
  }
  material.userData.snowCoverageApplied = true
  material.userData.snowCoverageVersion = SNOW_SHADER_VERSION
  material.userData.snowCoverageThick = thick

  const prevKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () =>
    `${prevKey ? prevKey() : ''}|snow-cover-${SNOW_SHADER_VERSION}${thick ? '|thick' : ''}`

  const prevCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    prevCompile?.(shader, renderer)
    // Nach anderen Patches: color_fragment ODER opaque_fragment reicht
    const hasColor = shader.fragmentShader.includes('#include <color_fragment>')
    const hasOpaque = shader.fragmentShader.includes('#include <opaque_fragment>')
    if (!shader.vertexShader.includes('#include <beginnormal_vertex>') || (!hasColor && !hasOpaque)) {
      return
    }

    shader.uniforms.uSnowCover = snowUniforms.uSnowCover
    shader.uniforms.uSnowMaxSlopeCos = snowUniforms.uSnowMaxSlopeCos
    shader.uniforms.uSnowColor = snowUniforms.uSnowColor
    shader.uniforms.uSnowOccMap = snowUniforms.uSnowOccMap
    shader.uniforms.uSnowOccEnabled = snowUniforms.uSnowOccEnabled
    shader.uniforms.uSnowOccOriginXZ = snowUniforms.uSnowOccOriginXZ
    shader.uniforms.uSnowOccSizeXZ = snowUniforms.uSnowOccSizeXZ
    shader.uniforms.uSnowOccYMin = snowUniforms.uSnowOccYMin
    shader.uniforms.uSnowOccYMax = snowUniforms.uSnowOccYMax

    const thickFlag = thick ? '1' : '0'

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vSnowWorldNormal;
varying vec3 vSnowWorldPos;`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
vSnowWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vSnowWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      )

    const snowFragHelpers = `
varying vec3 vSnowWorldNormal;
varying vec3 vSnowWorldPos;
uniform float uSnowCover;
uniform float uSnowMaxSlopeCos;
uniform vec3 uSnowColor;
uniform sampler2D uSnowOccMap;
uniform float uSnowOccEnabled;
uniform vec2 uSnowOccOriginXZ;
uniform vec2 uSnowOccSizeXZ;
uniform float uSnowOccYMin;
uniform float uSnowOccYMax;
float snowSkyVisibility(vec3 worldPos) {
  if (uSnowOccEnabled < 0.5) return 1.0;
  vec2 uv = (worldPos.xz - uSnowOccOriginXZ) / max(vec2(1.0), uSnowOccSizeXZ);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  float packed = texture2D(uSnowOccMap, uv).r;
  float topY = mix(uSnowOccYMin, uSnowOccYMax, packed);
  float gap = topY - worldPos.y;
  return 1.0 - smoothstep(4.0, 28.0, gap);
}

float snowCoverFactor() {
  float up = max(0.0, normalize(vSnowWorldNormal).y);
#if ${thickFlag}
  // Boden + Dach: auch steile Dachflächen (nicht auf 15° begrenzen)
  float slope = smoothstep(0.12, 0.55, up);
  float sky = 1.0;
#else
  // Horizontale Details: hart bei ~15° (cos)
  float slope = smoothstep(uSnowMaxSlopeCos - 0.04, min(1.0, uSnowMaxSlopeCos + 0.03), up);
  float sky = snowSkyVisibility(vSnowWorldPos);
#endif
  float cover = clamp(uSnowCover * slope * sky, 0.0, 1.0);
  float n = fract(sin(dot(vSnowWorldPos.xz * 0.07, vec2(12.9898, 78.233))) * 43758.5453);
  return cover * mix(0.92, 1.0, n);
}
`

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
${snowFragHelpers}`,
    )

    if (hasOpaque) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
{
  float coverO = snowCoverFactor();
  if (coverO > 0.001) {
    float luma = max(0.08, dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 snowLit = uSnowColor * clamp(luma / 0.38, 0.18, 1.12);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, snowLit, coverO);
  }
}
`,
      )
    }
  }
  material.needsUpdate = true
}

/** Traversiert und patched alle geeigneten Meshes. */
export function applySnowCoverageToObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mode = snowCoverageModeForObject(obj)
    if (mode === 'none') return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (mat) applySnowCoverageShader(mat, mode)
    }
  })
}

/**
 * Zusätzlicher Albedo-Tint für thick-Flächen (Dach): zuverlässig sichtbar,
 * auch wenn andere onBeforeCompile-Pfade die Decke im Fragment dämpfen.
 */
export function applySnowAlbedoTint(
  material: THREE.MeshStandardMaterial,
  cover: number,
  strength = 0.92,
): void {
  if (!material.userData.snowBaseColorHex) {
    material.userData.snowBaseColorHex = `#${material.color.getHexString()}`
  }
  const base = new THREE.Color(material.userData.snowBaseColorHex as string)
  const t = THREE.MathUtils.clamp(cover, 0, 1) * strength
  material.color.copy(base).lerp(SNOW_ALBEDO_COLOR, t)
}

export function tintSnowThickObjects(root: THREE.Object3D, cover: number): number {
  let n = 0
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.InstancedMesh)) return
    if (snowCoverageModeForObject(obj) !== 'thick') return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue
      if (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0.05) continue
      applySnowAlbedoTint(mat, cover, 0.94)
      n += 1
    }
  })
  return n
}

/** Debug: wie viele Meshes im Teilbaum thick/cover/none sind. */
export function countSnowCoverageModes(root: THREE.Object3D): {
  thick: number
  cover: number
  none: number
  children: number
} {
  let thick = 0
  let cover = 0
  let none = 0
  let children = 0
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.InstancedMesh)) return
    children += 1
    const mode = snowCoverageModeForObject(obj)
    if (mode === 'thick') thick += 1
    else if (mode === 'cover') cover += 1
    else none += 1
  })
  return { thick, cover, none, children }
}
