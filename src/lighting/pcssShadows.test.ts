import { describe, expect, it, afterEach } from 'vitest'
import * as THREE from 'three'
import {
  disablePcssShadows,
  enablePcssShadows,
  getPcssLightSizeUv,
  isPcssShadowsEnabled,
  PCSS_CONTACT_TEXELS_MAX,
  PCSS_NUM_SAMPLES,
  PCSS_PENUMBRA_SCALE,
  pcssLightSizeUvFromSoftness,
  pcssLightWorldSizeFromSoftness,
  pointShadowRadiusFromSoftness,
  updatePcssShadowParameters,
} from './pcssShadows'

describe('pcssShadows', () => {
  afterEach(() => {
    disablePcssShadows()
  })

  it('mappt Weichheit 0,5…8 auf wachsende Lichtfläche in cm', () => {
    expect(pcssLightWorldSizeFromSoftness(0.5)).toBeCloseTo(0.8, 5)
    expect(pcssLightWorldSizeFromSoftness(8)).toBeCloseTo(28, 5)
    expect(pcssLightWorldSizeFromSoftness(2.5)).toBeGreaterThan(0.8)
    expect(pcssLightWorldSizeFromSoftness(2.5)).toBeLessThan(28)
  })

  it('mappt Weichheit auf Punktlicht-Cube-Shadow-Radius', () => {
    expect(pointShadowRadiusFromSoftness(0.5)).toBeCloseTo(3, 5)
    expect(pointShadowRadiusFromSoftness(8)).toBeCloseTo(32, 5)
    expect(pointShadowRadiusFromSoftness(2.5)).toBeGreaterThan(3)
    expect(pointShadowRadiusFromSoftness(2.5)).toBeLessThan(32)
    expect(pointShadowRadiusFromSoftness(2.5, 2)).toBeCloseTo(pointShadowRadiusFromSoftness(2.5) * 2, 5)
  })

  it('berechnet LIGHT_SIZE_UV aus Frustum-Breite', () => {
    const uv = pcssLightSizeUvFromSoftness(4, 4000)
    expect(uv).toBeCloseTo(pcssLightWorldSizeFromSoftness(4) / 4000, 8)
  })

  it('aktiviert und deaktiviert den ShaderChunk-Override', () => {
    const original = THREE.ShaderChunk.shadowmap_pars_fragment
    enablePcssShadows()
    expect(isPcssShadowsEnabled()).toBe(true)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('pcssGetShadow')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('uniform float pcssLightSizeUv')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain('PCSS_PENUMBRA_SCALE')
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain(
      'pcssLightSizeUv * PCSS_PENUMBRA_SCALE * ( zReceiver - PCSS_NEAR_PLANE ) / zReceiver',
    )
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).not.toContain(
      'pcssLightSizeUv * PCSS_NEAR_PLANE / zReceiver',
    )
    // Punktlicht: Hard-Cube (kein Soft-Würfel auf dem Boden, v2.0.118)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toContain(
      'float depth = textureCube( shadowMap, bd3D ).r;',
    )
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).not.toContain('sum / 17.0')
    disablePcssShadows()
    expect(isPcssShadowsEnabled()).toBe(false)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(original)
  })

  it('aktualisiert die Lichtgröße live über Uniform, ohne Shader-Chunk neu zu bauen', () => {
    enablePcssShadows()
    const before = THREE.ShaderChunk.shadowmap_pars_fragment
    updatePcssShadowParameters(8, 4000)
    expect(getPcssLightSizeUv()).toBeCloseTo(pcssLightSizeUvFromSoftness(8, 4000), 8)
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(before)
    updatePcssShadowParameters(0.5, 4000)
    expect(getPcssLightSizeUv()).toBeCloseTo(pcssLightSizeUvFromSoftness(0.5, 4000), 8)
    expect(getPcssLightSizeUv()).toBeLessThan(pcssLightSizeUvFromSoftness(8, 4000))
    disablePcssShadows()
  })

  it('bindet die PCSS-Uniform an Materialien', () => {
    enablePcssShadows()
    const mat = new THREE.MeshStandardMaterial()
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat))
    updatePcssShadowParameters(4, 2000, scene)
    expect(mat.userData.pcssLightSizeBound).toBe(true)
    const uniforms: Record<string, { value: unknown }> = {}
    mat.onBeforeCompile(
      { uniforms, vertexShader: '', fragmentShader: '' } as THREE.WebGLProgramParametersWithUniforms,
      {} as THREE.WebGLRenderer,
    )
    expect(uniforms.pcssLightSizeUv).toBeDefined()
    expect(uniforms.pcssLightSizeUv.value).toBe(getPcssLightSizeUv())
    disablePcssShadows()
  })

  it('nutzt ausreichend PCSS-Samples gegen sichtbares Poisson-Raster', () => {
    expect(PCSS_NUM_SAMPLES).toBeGreaterThanOrEqual(25)
  })

  it('Poisson-Disk als const-Array, keine Laufzeit-Initialisierung (v2.0.120: ~15× schneller)', () => {
    enablePcssShadows()
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
    expect(chunk).toContain(`const vec2 pcssDisk[ ${PCSS_NUM_SAMPLES} ] = vec2[ ${PCSS_NUM_SAMPLES} ](`)
    expect(chunk).not.toContain('pcssInitPoissonSamples')
    expect(chunk).not.toContain('vec2 pcssPoissonDisk[')
    // Alle Tap-Schleifen mit Literal-Grenzen, damit Three.js sie entrollt (kein dynamischer Array-Index).
    const loops = chunk.match(/#pragma unroll_loop_start\s+for \( int i = 0; i < (\d+); i \+\+ \)/g) ?? []
    expect(loops.length).toBe(2)
    expect(chunk).not.toMatch(/for \( int i = 0; i < PCSS_[A-Z_]+; i ?\+\+ \)/)
    disablePcssShadows()
  })

  it('hat keinen Orbit-1-Tap-Pfad mehr (weiche Schatten bleiben beim Navigieren)', () => {
    enablePcssShadows()
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
    expect(chunk).not.toContain('pcssLite')
    expect(chunk).toContain(
      'shadow = pcssGetShadow( shadowMap, shadowCoord, 1.0 / shadowMapSize.x, pcssSlope );',
    )
    disablePcssShadows()
  })

  it('nutzt Receiver-Plane-Bias in Blocker-Suche und Filter (keine Selbstabschattung auf Gesims/Sockel)', () => {
    enablePcssShadows()
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
    // Steigung vor dem Frustum-Branch (uniformer Kontrollfluss für dFdx/dFdy).
    const slopeAt = chunk.indexOf('vec2 pcssSlope = pcssReceiverPlaneSlope( shadowCoord.xy, shadowCoord.z );')
    expect(slopeAt).toBeGreaterThan(0)
    const branchAt = chunk.indexOf('if ( frustumTest )', slopeAt)
    expect(branchAt).toBeGreaterThan(slopeAt)
    expect(
      chunk.indexOf('pcssGetShadow( shadowMap, shadowCoord, 1.0 / shadowMapSize.x, pcssSlope )', branchAt),
    ).toBeGreaterThan(branchAt)
    expect(chunk).toContain('zPlane = zReceiver + dot( slope, offset );')
    expect(chunk).toContain('step( zReceiver + dot( slope, offset ), depth )')
    expect(chunk).toContain('#define PCSS_PLANE_SLOPE_MAX 6.0000')
    expect(chunk).toContain('pcssHardShadow')
    disablePcssShadows()
  })

  it('ein Schatten statt zwei: Hart-Tap nur unter ~2 Texeln eingemischt, kein min(hard, soft) (v2.0.260)', () => {
    enablePcssShadows()
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
    // v2.0.258: min(hard, soft) → harter Kern + einseitiger weicher Halo („zwei Schatten“).
    expect(chunk).not.toContain('min( hard, soft )')
    expect(chunk).toContain('return mix( soft, hard, contact );')
    expect(chunk).toContain(
      'smoothstep( PCSS_CONTACT_TEXELS_MIN * texelUv, PCSS_CONTACT_TEXELS_MAX * texelUv, filterRadius )',
    )
    expect(chunk).toContain('#define PCSS_CONTACT_TEXELS_MIN 0.5000')
    expect(chunk).toContain('#define PCSS_CONTACT_TEXELS_MAX 2.0000')
    // Texelgröße aus der echten Shadow-Map-Auflösung (8192 Render / 4096 Vorschau).
    expect(chunk).toContain('pcssGetShadow( shadowMap, shadowCoord, 1.0 / shadowMapSize.x, pcssSlope )')
    expect(PCSS_CONTACT_TEXELS_MAX).toBeLessThanOrEqual(3)
    disablePcssShadows()
  })

  it('Blocker-Suche: nähegewichtet (Kontakt bleibt dunkel) + Early-Out für Lit und Umbra', () => {
    enablePcssShadows()
    const chunk = THREE.ShaderChunk.shadowmap_pars_fragment
    expect(chunk).toContain('weight = isBlocker / ( abs( zReceiver - depth ) + PCSS_BLOCKER_PROX );')
    expect(chunk).toContain('return vec2( blockerDepthSum / weightSum, numBlockers );')
    expect(chunk).toContain('#define PCSS_BLOCKER_PROX 0.010000')
    // Voll lit: ohne Blocker kein Filter.
    expect(chunk).toContain('if ( blocker.x == -1.0 ) return hard;')
    // Voll Umbra: alle Such-Taps verdeckt und Filterscheibe ⊆ Suchscheibe → 0 ohne 64-Tap-Filter.
    expect(chunk).toContain(
      `if ( blocker.y > float( ${PCSS_NUM_SAMPLES} ) - 0.5 && filterRadius <= searchRadius ) return 0.0;`,
    )
    disablePcssShadows()
  })

  it('hat Ortho-Penumbra-Skala für sichtbaren Weichheit-Slider', () => {
    expect(PCSS_PENUMBRA_SCALE).toBe(8)
  })
})
