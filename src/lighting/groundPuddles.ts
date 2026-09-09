/**
 * Boden-Steingrau und nasse Pfützen (Fassaden-Spiegelung).
 *
 * Look angelehnt an three.js `webgpu_materials_retroreflection` → createFloor():
 * ein Reflector + Noise-Maske (dunkle, scharfe Pfützen), WebGL-Adaption ohne TSL/WebGPU.
 */

import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

/** Fester Boden-Ton (Himmel- und Neutral-Modus). */
export const GROUND_STONE_GRAY = '#7E848C'

export const PUDDLE_COUNT_MIN = 1
export const PUDDLE_COUNT_MAX = 8
export const PUDDLE_SIZE_MIN = 0.35
export const PUDDLE_SIZE_MAX = 2.5
export const PUDDLE_SPREAD_MIN = 0.4
export const PUDDLE_SPREAD_MAX = 2.5
export const PUDDLE_STRENGTH_MIN = 0.15
export const PUDDLE_STRENGTH_MAX = 1

export interface GroundPuddleSettings {
  enabled: boolean
  /** Dichte der Pfützen (1 = wenig, 8 = viel Fläche). */
  count: number
  /** Größe der einzelnen Pfützen-Flecken (Noise-Frequenz). */
  size: number
  /** Ausdehnung der nassen Zone ums Gebäude. */
  spread: number
  /** Spiegel-/Nässe-Wirkung (0,15…1). */
  strength: number
}

export const DEFAULT_GROUND_PUDDLE_SETTINGS: GroundPuddleSettings = {
  enabled: false,
  count: 5,
  size: 1,
  spread: 1,
  strength: 0.75,
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeGroundPuddleSettings(value: unknown): GroundPuddleSettings {
  const base = { ...DEFAULT_GROUND_PUDDLE_SETTINGS }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    count: Math.round(clamp(finiteOr(raw.count, base.count), PUDDLE_COUNT_MIN, PUDDLE_COUNT_MAX)),
    size: clamp(finiteOr(raw.size, base.size), PUDDLE_SIZE_MIN, PUDDLE_SIZE_MAX),
    spread: clamp(finiteOr(raw.spread, base.spread), PUDDLE_SPREAD_MIN, PUDDLE_SPREAD_MAX),
    strength: clamp(finiteOr(raw.strength, base.strength), PUDDLE_STRENGTH_MIN, PUDDLE_STRENGTH_MAX),
  }
}

export function isGroundPuddleSettings(value: unknown): value is GroundPuddleSettings {
  if (!value || typeof value !== 'object') return false
  return typeof (value as Record<string, unknown>).enabled === 'boolean'
}

const PUDDLE_Y_EPS = 2.5
const REFLECT_SIZE = 512
/** Dunkler Pfützen-Grundton (Asphalt × 0,3 im Example). */
const PUDDLE_TINT = new THREE.Color(0x2a3038)

/**
 * Shader wie Reflector.ReflectorShader, plus Noise-Pfützen-Maske
 * (angelehnt an webgpu_materials_retroreflection createFloor).
 */
const PuddleReflectorShader = {
  name: 'PuddleReflectorShader',
  uniforms: {
    color: { value: null as THREE.Color | null },
    tDiffuse: { value: null as THREE.Texture | null },
    textureMatrix: { value: null as THREE.Matrix4 | null },
    uPuddleThreshold: { value: 0.35 },
    uPuddleScale: { value: 0.004 },
    uWetness: { value: 0.7 },
    uEdge: { value: 0.18 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vWorldXZ;

    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
      vWorldXZ = worldPosition.xz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uPuddleThreshold;
    uniform float uPuddleScale;
    uniform float uWetness;
    uniform float uEdge;
    varying vec4 vUv;
    varying vec2 vWorldXZ;

    float blendOverlay( float base, float blend ) {
      return ( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
    }

    vec3 blendOverlay( vec3 base, vec3 blend ) {
      return vec3(
        blendOverlay( base.r, blend.r ),
        blendOverlay( base.g, blend.g ),
        blendOverlay( base.b, blend.b )
      );
    }

    float hash21( vec2 p ) {
      return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453123 );
    }

    float noise21( vec2 p ) {
      vec2 i = floor( p );
      vec2 f = fract( p );
      float a = hash21( i );
      float b = hash21( i + vec2( 1.0, 0.0 ) );
      float c = hash21( i + vec2( 0.0, 1.0 ) );
      float d = hash21( i + vec2( 1.0, 1.0 ) );
      vec2 u = f * f * ( 3.0 - 2.0 * f );
      return mix( a, b, u.x ) + ( c - a ) * u.y * ( 1.0 - u.x ) + ( d - b ) * u.x * u.y;
    }

    // Weichere Pfützen-Form: zwei Oktaven wie im Example (mx_noise + smoothstep).
    float puddleMask( vec2 p ) {
      float n = noise21( p * uPuddleScale + vec2( 6.27, 2.13 ) );
      n = n * 0.65 + noise21( p * uPuddleScale * 2.1 + vec2( 1.7, 9.4 ) ) * 0.35;
      return smoothstep( uPuddleThreshold, uPuddleThreshold + uEdge, n );
    }

    void main() {
      vec4 base = texture2DProj( tDiffuse, vUv );
      float puddle = puddleMask( vWorldXZ );
      if ( puddle < 0.004 ) discard;

      vec3 mirror = blendOverlay( base.rgb, color );
      // In der Pfütze dunkler + Spiegel; Rand weicher.
      vec3 wet = mix( color * 0.45, mirror, 0.55 + 0.45 * uWetness );
      float alpha = puddle * ( 0.35 + 0.65 * uWetness );
      gl_FragColor = vec4( wet, alpha );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
}

/**
 * Eine Spiegelebene ums Gebäude mit Noise-Pfützen (1 Extra-Pass).
 * Während Orbit ausgeblendet.
 */
export class GroundPuddleRuntime {
  readonly group = new THREE.Group()
  private reflector: Reflector | null = null
  private built = false

  constructor() {
    this.group.name = 'groundPuddles'
    this.group.visible = false
  }

  ensureBuilt(): void {
    if (this.built) return
    this.built = true

    const geo = new THREE.PlaneGeometry(1, 1)
    const reflector = new Reflector(geo, {
      clipBias: 0.003,
      textureWidth: REFLECT_SIZE,
      textureHeight: REFLECT_SIZE,
      color: PUDDLE_TINT,
      shader: PuddleReflectorShader,
      multisample: 0,
    })
    reflector.name = 'groundPuddlePlane'
    reflector.rotation.x = -Math.PI / 2
    reflector.castShadow = false
    reflector.receiveShadow = false
    reflector.frustumCulled = false
    reflector.renderOrder = 2

    const mat = reflector.material as THREE.ShaderMaterial
    mat.transparent = true
    mat.depthWrite = false
    mat.polygonOffset = true
    mat.polygonOffsetFactor = -2
    mat.polygonOffsetUnits = -2

    // #region agent log
    {
      const original = reflector.onBeforeRender.bind(reflector)
      let logged = 0
      reflector.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
        if (logged < 3) {
          logged += 1
          const worldPos = new THREE.Vector3().setFromMatrixPosition(reflector.matrixWorld)
          const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld)
          fetch('http://127.0.0.1:7776/ingest/9414f33d-5b29-4b40-be42-dc7dff4db9a6', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c6b426' },
            body: JSON.stringify({
              sessionId: 'c6b426',
              runId: 'post-fix-noise',
              hypothesisId: 'F',
              location: 'groundPuddles.ts:onBeforeRender',
              message: 'noise-puddle reflector pass',
              data: {
                camY: +camPos.y.toFixed(1),
                worldY: +worldPos.y.toFixed(3),
                scaleX: +reflector.scale.x.toFixed(0),
                scaleZ: +reflector.scale.y.toFixed(0),
                threshold: mat.uniforms['uPuddleThreshold']?.value,
                wetness: mat.uniforms['uWetness']?.value,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {})
        }
        return original(renderer, scene, camera, geometry, material, group)
      }
    }
    // #endregion

    this.reflector = reflector
    this.group.add(reflector)
  }

  sync(opts: {
    enabled: boolean
    view3d: boolean
    orbitLite: boolean
    count: number
    size: number
    spread: number
    strength: number
    groundY: number
    cx: number
    cz: number
    box: THREE.Box3 | null
  }): void {
    const show = opts.enabled && opts.view3d && !opts.orbitLite
    // #region agent log
    fetch('http://127.0.0.1:7776/ingest/9414f33d-5b29-4b40-be42-dc7dff4db9a6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c6b426' },
      body: JSON.stringify({
        sessionId: 'c6b426',
        runId: 'post-fix-noise',
        hypothesisId: 'A',
        location: 'groundPuddles.ts:sync',
        message: 'puddle sync gate',
        data: {
          show,
          enabled: opts.enabled,
          view3d: opts.view3d,
          orbitLite: opts.orbitLite,
          count: opts.count,
          size: opts.size,
          spread: opts.spread,
          strength: opts.strength,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    if (!show) {
      this.group.visible = false
      return
    }
    this.ensureBuilt()
    this.group.visible = true

    const halfX = opts.box ? Math.max(80, (opts.box.max.x - opts.box.min.x) * 0.5) : 200
    const halfZ = opts.box ? Math.max(80, (opts.box.max.z - opts.box.min.z) * 0.5) : 200
    const cx = opts.box ? (opts.box.min.x + opts.box.max.x) * 0.5 : opts.cx
    const cz = opts.box ? (opts.box.min.z + opts.box.max.z) * 0.5 : opts.cz
    const count = clamp(Math.round(opts.count), PUDDLE_COUNT_MIN, PUDDLE_COUNT_MAX)
    const size = clamp(opts.size, PUDDLE_SIZE_MIN, PUDDLE_SIZE_MAX)
    const spread = clamp(opts.spread, PUDDLE_SPREAD_MIN, PUDDLE_SPREAD_MAX)
    const strength = clamp(opts.strength, PUDDLE_STRENGTH_MIN, PUDDLE_STRENGTH_MAX)

    // Zone ums Gebäude (rundum außerhalb + etwas über die Box hinaus).
    const margin = 180 * spread
    const planeW = (halfX + margin) * 2
    const planeD = (halfZ + margin) * 2

    // count ↑ → niedrigere Schwelle → mehr Pfützenfläche (wie Example smoothstep).
    const threshold = THREE.MathUtils.mapLinear(count, PUDDLE_COUNT_MIN, PUDDLE_COUNT_MAX, 0.55, 0.2)
    // size ↑ → größere Flecken → niedrigere Noise-Frequenz (cm-Welt).
    const noiseScale = THREE.MathUtils.mapLinear(size, PUDDLE_SIZE_MIN, PUDDLE_SIZE_MAX, 0.014, 0.0025)

    const reflector = this.reflector!
    reflector.position.set(cx, opts.groundY + PUDDLE_Y_EPS, cz)
    // Plane liegt in XY vor Rot.x; nach -90°: local Y → World -Z, Scale.y steuert Tiefe.
    reflector.scale.set(planeW, planeD, 1)

    const mat = reflector.material as THREE.ShaderMaterial
    mat.uniforms['uPuddleThreshold']!.value = threshold
    mat.uniforms['uPuddleScale']!.value = noiseScale
    mat.uniforms['uWetness']!.value = strength
    mat.uniforms['color']!.value.copy(PUDDLE_TINT)

    // #region agent log
    fetch('http://127.0.0.1:7776/ingest/9414f33d-5b29-4b40-be42-dc7dff4db9a6', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c6b426' },
      body: JSON.stringify({
        sessionId: 'c6b426',
        runId: 'post-fix-noise',
        hypothesisId: 'C',
        location: 'groundPuddles.ts:sync:placed',
        message: 'noise puddle plane',
        data: {
          cx: +cx.toFixed(1),
          cz: +cz.toFixed(1),
          planeW: +planeW.toFixed(0),
          planeD: +planeD.toFixed(0),
          y: +(opts.groundY + PUDDLE_Y_EPS).toFixed(2),
          threshold: +threshold.toFixed(3),
          noiseScale: +noiseScale.toFixed(5),
          strength,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }

  dispose(): void {
    if (this.reflector) {
      this.reflector.geometry.dispose()
      const mat = this.reflector.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
      const rt = (this.reflector as unknown as { getRenderTarget?: () => THREE.WebGLRenderTarget })
        .getRenderTarget?.()
      rt?.dispose()
      this.group.remove(this.reflector)
      this.reflector = null
    }
    this.built = false
  }
}
