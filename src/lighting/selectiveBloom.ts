/**
 * Selective Bloom — nur Objekte auf BLOOM_LAYER blühen.
 * Verhindert, dass helle Fenster-Innenräume die Außenfassade in Post-Processing überstrahlen.
 * Angelehnt an three.js webgl_postprocessing_unreal_bloom_selective (MIT).
 */
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { BLOOM_LAYER } from '../utils/sunLighting'

const DARK = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })
const savedMaterials = new Map<string, THREE.Material | THREE.Material[]>()

const mixShader = {
  uniforms: {
    baseTexture: { value: null as THREE.Texture | null },
    bloomTexture: { value: null as THREE.Texture | null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D baseTexture;
    uniform sampler2D bloomTexture;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
    }
  `,
}

function darkenNonBloomed(obj: THREE.Object3D): void {
  if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Sprite) && !(obj instanceof THREE.Line)) return
  if (!('material' in obj) || !obj.material) return
  if (obj.layers.isEnabled(BLOOM_LAYER)) return
  savedMaterials.set(obj.uuid, obj.material as THREE.Material | THREE.Material[])
  ;(obj as THREE.Mesh).material = DARK
}

function restoreMaterials(obj: THREE.Object3D): void {
  if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Sprite) && !(obj instanceof THREE.Line)) return
  const prev = savedMaterials.get(obj.uuid)
  if (!prev) return
  ;(obj as THREE.Mesh).material = prev
  savedMaterials.delete(obj.uuid)
}

export function enableBloomLayer(obj: THREE.Object3D): void {
  obj.layers.enable(BLOOM_LAYER)
}

export class SelectiveBloomPipeline {
  readonly bloomComposer: EffectComposer
  readonly bloomPass: UnrealBloomPass
  readonly mixPass: ShaderPass
  readonly bloomRenderPass: RenderPass

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    camera: THREE.Camera,
    size: THREE.Vector2,
    strength: number,
    radius: number,
    threshold: number,
    msaaSamples: number,
  ) {
    const rtOpts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      samples: msaaSamples,
    }
    this.bloomComposer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, rtOpts))
    this.bloomComposer.renderToScreen = false
    this.bloomRenderPass = new RenderPass(scene, camera)
    this.bloomComposer.addPass(this.bloomRenderPass)
    this.bloomPass = new UnrealBloomPass(size.clone(), strength, radius, threshold)
    this.bloomComposer.addPass(this.bloomPass)

    this.mixPass = new ShaderPass(new THREE.ShaderMaterial(mixShader), 'baseTexture')
    this.mixPass.needsSwap = true
  }

  setCamera(camera: THREE.Camera): void {
    this.bloomRenderPass.camera = camera
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.bloomComposer.setSize(width, height)
    this.bloomComposer.setPixelRatio(pixelRatio)
    this.bloomPass.resolution.set(width * pixelRatio, height * pixelRatio)
  }

  setBloomParams(strength: number, radius: number, threshold: number): void {
    this.bloomPass.strength = strength
    this.bloomPass.radius = radius
    this.bloomPass.threshold = threshold
  }

  /** Bloom-Layer isolieren; anschließend composer.render() (RenderPass + Mix). */
  prepareMix(): void {
    this.scene.traverse(darkenNonBloomed)
    this.bloomComposer.render()
    this.scene.traverse(restoreMaterials)
    this.mixPass.uniforms.bloomTexture.value = this.bloomComposer.readBuffer.texture
  }
}
