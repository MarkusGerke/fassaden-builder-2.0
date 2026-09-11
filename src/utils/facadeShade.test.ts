import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyFacadeShadeShader,
  applyInteriorShadeShader,
  applyShadeDepth,
  facadeOutwardLocalZ,
  facadeShadeParamsFromSun,
  LABEL_SHADOW_COORD_Z_BIAS,
  setFacadeShadeParams,
} from './facadeShade'
import { DEFAULT_SUN_SETTINGS } from './sunLighting'

function stubShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader:
      '#include <common>\n#include <beginnormal_vertex>\n#include <shadowmap_vertex>\n',
    fragmentShader:
      '#include <common>\n#include <lights_fragment_begin>\n#include <lights_fragment_end>\n',
  }
}

describe('facadeShade', () => {
  it('panelFlip true = lokale −Z nach außen', () => {
    expect(facadeOutwardLocalZ(true)).toBe(-1)
    expect(facadeOutwardLocalZ(false)).toBe(1)
  })

  it('markiert Außenflächen für EnvMap-Bindung', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, 1)
    expect(mat.userData.exteriorSurface).toBe(true)
  })

  it('hängt den Gegenlicht-Shader an Standard-Material', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, -1)
    expect(mat.userData.facadeShadeApplied).toBe(true)
    expect(mat.userData.uFacadeOutwardLocal).toBe(-1)
    expect(typeof mat.onBeforeCompile).toBe('function')
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.vertexShader).toContain('vFacadeView = normalize(normalMatrix')
    expect(shader.fragmentShader).not.toContain('normalMatrix *')
    expect(shader.fragmentShader).toContain('vFacadeView')
    expect(shader.fragmentShader).toContain('#include <lights_fragment_begin>')
    expect(shader.fragmentShader).toContain('sideOrTop * 0.82')
    expect(shader.fragmentShader).toContain('horizExtra')
    expect(shader.vertexShader).not.toContain('vDirectionalShadowCoord[ 0 ].z -=')
  })

  it('Indirect-Dim sitzt vor lights_fragment_end (v2.0.364 — vorher wirkungslos)', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, 1)
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    const frag = shader.fragmentShader
    const indirectAt = frag.indexOf('irradiance *= facadeIndirect')
    const endAt = frag.indexOf('#include <lights_fragment_end>')
    const beginAt = frag.indexOf('#include <lights_fragment_begin>')
    expect(indirectAt).toBeGreaterThan(beginAt)
    expect(indirectAt).toBeLessThan(endAt)
    expect(frag).toContain('iblIrradiance *= facadeIndirect')
    expect(frag).not.toContain('reflectedLight.indirectDiffuse *= mix')
  })

  it('Normalen-Modus für Rahmen: Uniform 1, Shader nutzt geometryNormal (v2.0.365)', () => {
    const mat = new THREE.MeshStandardMaterial()
    mat.userData.facadeShadeNormalMode = true
    applyFacadeShadeShader(mat, 1)
    expect(mat.userData.facadeShadeApplied).toBe(true)
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.uniforms.uNormalBacklit.value).toBe(1)
    expect(shader.fragmentShader).toContain('geometryNormal, uNormalBacklit')
    const plain = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(plain, 1)
    const shader2 = stubShader()
    plain.onBeforeCompile(shader2 as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader2.uniforms.uNormalBacklit.value).toBe(0)
  })

  it('Schatten-Tiefe: 0 unverändert, 1 fast schwarz, Default dunkler als roh', () => {
    const raw = facadeShadeParamsFromSun({ ...DEFAULT_SUN_SETTINGS, shadeDepth: 0 })
    expect(applyShadeDepth(raw, 0)).toEqual(raw)
    const deep = applyShadeDepth(raw, 1)
    expect(deep.hemiDim).toBeLessThan(raw.hemiDim * 0.1)
    expect(deep.interiorDirectDim).toBeCloseTo(raw.interiorDirectDim * 0.7, 6)
    expect(deep.interiorHemiDim).toBeLessThan(raw.interiorHemiDim * 0.1)
    const def = facadeShadeParamsFromSun(DEFAULT_SUN_SETTINGS)
    expect(def.hemiDim).toBeLessThan(raw.hemiDim)
    expect(def.interiorDirectDim).toBeLessThan(raw.interiorDirectDim)
    expect(def.hemiDim).toBeGreaterThan(0.2)
  })

  it('Schrift-Shader dimmt die Front und setzt Shadow-Z-Bias', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, -1, { label: true })
    expect(mat.userData.uLabelShade).toBe(1)
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.uniforms.uLabelShade.value).toBe(1)
    expect(shader.fragmentShader).toContain('uLabelDirectDim')
    expect(shader.fragmentShader).toContain('uLabelHemiDim')
    expect(shader.fragmentShader).toContain('sideOrTop * 0.82')
    expect(shader.fragmentShader).toContain('horizExtra')
    expect(shader.vertexShader).toContain(
      `vDirectionalShadowCoord[ 0 ].z -= ${LABEL_SHADOW_COORD_Z_BIAS.toFixed(4)}`,
    )
  })

  it('wendet den Shader auch auf opake transparente Schrift an', () => {
    const mat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 1, alphaTest: 0.08 })
    applyFacadeShadeShader(mat, 1, { label: true })
    expect(mat.userData.facadeShadeApplied).toBe(true)
  })

  it('Schrift-Dim ist klar dunkler als Wand-Dim (Defaults)', () => {
    const params = facadeShadeParamsFromSun({
      ...DEFAULT_SUN_SETTINGS,
      shadowContrast: 1.4,
      ambient: 0.53,
      shadeDepth: 0,
    })
    expect(params.labelHemiDim).toBeLessThan(params.hemiDim)
    expect(params.labelDirectDim).toBeLessThan(params.directDim)
    expect(params.labelHemiDim).toBeGreaterThanOrEqual(0.18)
    expect(params.labelHemiDim).toBeLessThanOrEqual(0.55)
  })

  it('Gegenlicht behält starkes Himmels-Fill (Rohkurve, Schatten-Tiefe 0)', () => {
    const params = facadeShadeParamsFromSun({ ...DEFAULT_SUN_SETTINGS, shadeDepth: 0 })
    // Direktlicht stark gedimmt, Ambient weitgehend erhalten (v2.0.312).
    expect(params.directDim).toBeLessThan(0.25)
    expect(params.hemiDim).toBeGreaterThanOrEqual(0.55)
    expect(params.hemiDim).toBeLessThan(1)
  })

  it('nachts kein Gegenlicht-Dim (Punktlicht bleibt hell)', () => {
    const night = facadeShadeParamsFromSun({ ...DEFAULT_SUN_SETTINGS, elevationRad: -0.2 })
    expect(night.directDim).toBeLessThan(0.35)
    expect(night.hemiDim).toBeLessThan(0.25)
    expect(night.labelDirectDim).toBeLessThan(0.2)
    expect(night.interiorDirectDim).toBeLessThan(0.65)
    expect(night.interiorHemiDim).toBeLessThan(0.45)
    expect(night.interiorHemiDim).toBeGreaterThan(0.08)
  })

  it('tagsüber Innen-Fill: Weiß lesbar, Sonne durch Öffnung sichtbar (v2.0.367)', () => {
    const day = facadeShadeParamsFromSun({ ...DEFAULT_SUN_SETTINGS, shadeDepth: 0 })
    // Produkt hemi×gain ≈ 0,18…0,35 — Weiß bleibt hellgrau, nicht pechschwarz.
    expect(day.interiorHemiDim * day.interiorIndirectGain).toBeGreaterThanOrEqual(0.14)
    expect(day.interiorHemiDim * day.interiorIndirectGain).toBeLessThanOrEqual(0.4)
    expect(day.interiorDirectDim).toBeGreaterThanOrEqual(0.5)
    expect(day.interiorDirectDim).toBeLessThanOrEqual(0.85)
    const deep = facadeShadeParamsFromSun({ ...DEFAULT_SUN_SETTINGS, shadeDepth: 1 })
    expect(deep.interiorDirectDim).toBeGreaterThanOrEqual(0.4)
    expect(deep.interiorHemiDim).toBeLessThan(day.interiorHemiDim * 0.2)
  })

  it('setFacadeShadeParams schreibt Schrift-Uniforms', () => {
    const restore = facadeShadeParamsFromSun(DEFAULT_SUN_SETTINGS)
    const mat = new THREE.MeshStandardMaterial()
    applyFacadeShadeShader(mat, 1, { label: true })
    setFacadeShadeParams({
      directDim: 0.2,
      hemiDim: 0.5,
      interiorDirectDim: 0.2,
      interiorHemiDim: 0.4,
      interiorIndirectGain: 0.12,
      labelDirectDim: 0.07,
      labelHemiDim: 0.15,
    })
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.uniforms.uLabelDirectDim.value).toBe(0.07)
    expect(shader.uniforms.uLabelHemiDim.value).toBe(0.15)
    setFacadeShadeParams(restore)
  })

  it('applyInteriorShadeShader hängt Innen-Uniforms ein', () => {
    const mat = new THREE.MeshStandardMaterial()
    applyInteriorShadeShader(mat)
    const shader = stubShader()
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    expect(shader.uniforms.uInteriorHemiDim).toBeDefined()
    expect(shader.fragmentShader).toContain('uInteriorHemiDim')
    expect(shader.fragmentShader).toContain('#include <lights_fragment_end>')
    expect(shader.fragmentShader).toContain('uInteriorHemiDim * uInteriorIndirectGain')
    expect(shader.fragmentShader).not.toContain('uInteriorHemiDim * uInteriorHemiDim')
    expect(shader.fragmentShader).toContain('uInteriorDirectDim')
  })

  it('überspringt Glas', () => {
    const glass = new THREE.MeshPhysicalMaterial({ transmission: 1, transparent: true })
    glass.name = 'glass'
    applyFacadeShadeShader(glass, -1)
    expect(glass.userData.facadeShadeApplied).toBeUndefined()
  })
})
