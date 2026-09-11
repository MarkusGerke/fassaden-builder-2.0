/**
 * 2D-Aufriss: gleicher Takram-Himmel wie 3D; darunter (Welt-Y &lt; 0) flache Untergrundfarbe.
 */
import * as THREE from 'three'
import { worldYNdcAt } from '../utils/celestialSky'

const vertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.999999, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uHorizonNdc;
uniform float uViewportHeight;
void main() {
  float fragNdcY = gl_FragCoord.y / max(uViewportHeight, 1.0) * 2.0 - 1.0;
  if (uHorizonNdc < -1.99 || fragNdcY >= uHorizonNdc) discard;
  gl_FragColor = vec4(uColor, 1.0);
}
`

export class FrontUndergroundCap {
  readonly mesh: THREE.Mesh
  private readonly uniforms: {
    uColor: THREE.IUniform<THREE.Color>
    uHorizonNdc: THREE.IUniform<number>
    uViewportHeight: THREE.IUniform<number>
  }

  constructor() {
    this.uniforms = {
      uColor: { value: new THREE.Color('#555555') },
      uHorizonNdc: { value: -2 },
      uViewportHeight: { value: 720 },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -950
    this.mesh.name = 'frontUndergroundCap'
  }

  sync(camera: THREE.Camera, groundHex: string, lookX: number, lookZ: number, viewportHeight: number) {
    this.uniforms.uColor.value.set(groundHex)
    this.uniforms.uHorizonNdc.value = worldYNdcAt(camera, lookX, 0, lookZ)
    this.uniforms.uViewportHeight.value = Math.max(1, viewportHeight)
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible
  }
}
