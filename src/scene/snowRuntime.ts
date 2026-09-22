/**
 * Fallende Schneeflocken (Points) + Runtime-Deckenhöhe + grobe Himmelssicht-Map.
 */

import * as THREE from 'three'
import {
  SNOW_FLAKE_SIZE_CM,
  snowAccumulateRatePerSec,
  snowMeltRatePerSec,
  snowParticleBudget,
  type SnowWeatherSettings,
} from '../lighting/snowWeather'
import { setGroundMoodSnowCover } from '../lighting/groundMood'
import { setSnowCoverageUniforms, snowCoverageModeForObject } from '../lighting/snowCoverage'

const OCC_RES = 256

function createFlakeCircleMap(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size * 0.5
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.92)')
  g.addColorStop(0.72, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

export interface SnowTickContext {
  paused: boolean
  orbitLite: boolean
  /**
   * Darstellungsmodus erlaubt Schnee (Vorschau oder Render; nicht Entwurf).
   */
  presentationOk: boolean
  /** 3D oder Fassade (`present`). */
  view3d: boolean
  dtSec: number
  buildingBox: THREE.Box3 | null
  /**
   * Fassadenmodus: Flocken zwischen Kamera und Fassade spawnen
   * (sonst oft hinterm Haus / außerhalb des engen Blickfelds).
   */
  cameraSpawn?: {
    position: THREE.Vector3
    target: THREE.Vector3
  }
}

export class SnowRuntime {
  readonly group = new THREE.Group()
  private points: THREE.Points | null = null
  private positions: Float32Array | null = null
  private velocities: Float32Array | null = null
  private settled: Uint8Array | null = null
  private settledCount = 0
  private capacity = 0
  private activeCount = 0
  /** Runtime-only Decke 0…1 (nicht persistiert). */
  cover = 0
  private readonly material: THREE.PointsMaterial
  private occTarget: THREE.WebGLRenderTarget | null = null
  private readonly occCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 5000)
  private readonly heightMat: THREE.ShaderMaterial
  private occOriginX = 0
  private occOriginZ = 0
  private occSizeX = 1
  private occSizeZ = 1
  private occYMin = 0
  private occYMax = 1
  private occDirty = true
  private padsDirty = true
  private lastOccMs = 0
  private groundCover: THREE.Mesh | null = null
  private readonly surfaceOverlays = new Map<string, THREE.Mesh>()
  private landingPads: Array<{
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    topY: number
    ground: boolean
  }> = []
  private heightField: Uint8Array | null = null
  private readonly _padBox = new THREE.Box3()
  private readonly _invGroup = new THREE.Matrix4()

  constructor() {
    this.group.name = 'snowWeather'
    this.material = new THREE.PointsMaterial({
      color: 0xf4f8fc,
      size: SNOW_FLAKE_SIZE_CM,
      sizeAttenuation: true,
      map: createFlakeCircleMap(),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.NormalBlending,
      alphaTest: 0.08,
    })
    this.material.customProgramCacheKey = () => 'snow-flake-world-cm'
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize *= ( scale / - mvPosition.z )',
        'gl_PointSize = min(64.0, size * projectionMatrix[1][1] * scale / max(1.0, -mvPosition.z))',
      )
    }
    this.heightMat = new THREE.ShaderMaterial({
      uniforms: {
        uYMin: { value: 0 },
        uYMax: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying float vWorldY;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldY = world.y;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uYMin;
        uniform float uYMax;
        varying float vWorldY;
        void main() {
          float t = clamp((vWorldY - uYMin) / max(1.0, uYMax - uYMin), 0.0, 1.0);
          gl_FragColor = vec4(t, t, t, 1.0);
        }
      `,
      side: THREE.DoubleSide,
    })
  }

  markOcclusionDirty(): void {
    this.occDirty = true
    this.padsDirty = true
  }

  dispose(): void {
    this.disposePoints()
    this.disposeOverlays()
    this.occTarget?.dispose()
    this.occTarget = null
    this.heightMat.dispose()
    this.material.dispose()
  }

  private disposeOverlays(): void {
    for (const mesh of this.surfaceOverlays.values()) {
      mesh.removeFromParent()
      const mat = mesh.material
      if (mat instanceof THREE.Material) mat.dispose()
    }
    this.surfaceOverlays.clear()
    if (this.groundCover) {
      this.group.remove(this.groundCover)
      if (this.groundCover.material instanceof THREE.Material) this.groundCover.material.dispose()
      this.groundCover = null
    }
  }

  /**
   * Räumt alte Overlay-Meshes weg und baut Landepads (Hof, Dach, Bänke, Decke).
   */
  syncSettledCover(opts: {
    ground: THREE.Mesh
    surfaceRoots: THREE.Object3D[]
  }): void {
    if (this.groundCover) {
      this.group.remove(this.groundCover)
      if (this.groundCover.material instanceof THREE.Material) this.groundCover.material.dispose()
      this.groundCover = null
    }
    for (const mesh of this.surfaceOverlays.values()) {
      mesh.removeFromParent()
      if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    }
    this.surfaceOverlays.clear()
    if (this.padsDirty || this.landingPads.length === 0) {
      for (const root of opts.surfaceRoots) {
        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return
          if (
            obj.userData.snowOverlay !== true &&
            obj.name !== 'snowSurfaceCover' &&
            obj.name !== 'snowGroundCover'
          ) {
            return
          }
          obj.removeFromParent()
        })
      }
      this.rebuildLandingPads(opts.surfaceRoots, opts.ground)
    }
  }

  private rebuildLandingPads(roots: THREE.Object3D[], ground: THREE.Mesh): void {
    this.landingPads.length = 0
    this.group.updateMatrixWorld(true)
    this._invGroup.copy(this.group.matrixWorld).invert()
    const addBox = (box: THREE.Box3, groundPad: boolean) => {
      if (box.isEmpty()) return
      box.applyMatrix4(this._invGroup)
      this.landingPads.push({
        minX: box.min.x,
        maxX: box.max.x,
        minZ: box.min.z,
        maxZ: box.max.z,
        topY: box.max.y + 0.35,
        ground: groundPad,
      })
    }
    this._padBox.setFromObject(ground)
    addBox(this._padBox.clone(), true)
    for (const root of roots) {
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        if (obj.userData.snowOverlay === true) return
        if (obj.userData.kind === 'sunCeilingOccluder' || obj.userData.kind === 'bayMouthSunOccluder') {
          return
        }
        if (obj.userData.shadowOccluder === true) return
        const mode = snowCoverageModeForObject(obj)
        if (mode === 'none') return
        // Innenboden nicht als Pad — sonst landen Flocken auf y≈0 statt auf dem Hof
        if (obj.userData.kind === 'floor') return
        this._padBox.setFromObject(obj)
        if (this._padBox.isEmpty()) return
        addBox(this._padBox.clone(), false)
      })
    }
    if (this.landingPads.length > 480) this.landingPads.length = 480
    this.padsDirty = false
  }

  private sampleHeightField(localX: number, localZ: number): number | null {
    if (!this.heightField) return null
    const u = (localX - (this.occOriginX - this.occSizeX * 0.5)) / this.occSizeX
    const v = (localZ - (this.occOriginZ - this.occSizeZ * 0.5)) / this.occSizeZ
    if (u < 0 || u > 1 || v < 0 || v > 1) return null
    const ix = Math.min(OCC_RES - 1, Math.max(0, Math.floor(u * OCC_RES)))
    const iy = Math.min(OCC_RES - 1, Math.max(0, Math.floor(v * OCC_RES)))
    const packed = this.heightField[(iy * OCC_RES + ix) * 4]! / 255
    if (packed < 0.01) return null
    return this.occYMin + packed * (this.occYMax - this.occYMin)
  }

  /** Höchste Fläche, die die Flocke in diesem Schritt kreuzt. */
  private landingHit(
    x: number,
    z: number,
    prevY: number,
    nextY: number,
  ): { y: number; ground: boolean } | null {
    let bestY: number | null = null
    let bestGround = false
    const consider = (y: number, ground: boolean) => {
      if (y <= prevY + 4 && y >= nextY - 3) {
        if (bestY === null || y > bestY) {
          bestY = y
          bestGround = ground
        }
      }
    }
    for (let i = 0; i < this.landingPads.length; i += 1) {
      const p = this.landingPads[i]!
      if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue
      consider(p.topY, p.ground)
    }
    return bestY === null ? null : { y: bestY, ground: bestGround }
  }

  private disposePoints(): void {
    if (!this.points) return
    this.group.remove(this.points)
    this.points.geometry.dispose()
    this.points = null
    this.positions = null
    this.velocities = null
    this.settled = null
    this.settledCount = 0
    this.capacity = 0
    this.activeCount = 0
  }

  private ensureCapacity(count: number): void {
    if (this.capacity >= count && this.points) return
    this.disposePoints()
    this.capacity = count
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.settled = new Uint8Array(count)
    this.settledCount = 0
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setDrawRange(0, 0)
    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
    this.points.name = 'snowFlakes'
    this.group.add(this.points)
    for (let i = 0; i < count; i += 1) this.recycleFlake(i, true)
  }

  private cameraSpawn: SnowTickContext['cameraSpawn'] = undefined

  private recycleFlake(index: number, init: boolean): void {
    if (!this.positions || !this.velocities) return
    if (this.settled?.[index]) {
      this.settled[index] = 0
      this.settledCount = Math.max(0, this.settledCount - 1)
    }
    const i3 = index * 3
    // Y immer über Dach (Q3A); XZ optional kamera-nah für Fassade
    const topY = this.occYMax + 100 + Math.random() * 260
    const bias = this.cameraSpawn
    if (bias) {
      const dx = bias.target.x - bias.position.x
      const dz = bias.target.z - bias.position.z
      const dist = Math.hypot(dx, dz) || 1
      const fx = dx / dist
      const fz = dz / dist
      let rx = fz
      let rz = -fx
      const rLen = Math.hypot(rx, rz) || 1
      rx /= rLen
      rz /= rLen
      const along = 0.12 + Math.random() * 0.75
      const lateral = (Math.random() * 2 - 1) * Math.min(420, dist * 0.55)
      this.positions[i3] = bias.position.x + fx * dist * along + rx * lateral
      this.positions[i3 + 1] = init ? this.occYMin + Math.random() * (topY - this.occYMin) : topY
      this.positions[i3 + 2] = bias.position.z + fz * dist * along + rz * lateral
    } else {
      const span = Math.max(this.occSizeX, this.occSizeZ, 800)
      const half = span * 0.55
      this.positions[i3] = this.occOriginX + (Math.random() * 2 - 1) * half
      this.positions[i3 + 2] = this.occOriginZ + (Math.random() * 2 - 1) * half
      this.positions[i3 + 1] = init ? this.occYMin + Math.random() * (topY - this.occYMin) : topY
    }
    this.velocities[i3] = (Math.random() - 0.5) * 18
    this.velocities[i3 + 1] = -(55 + Math.random() * 70)
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 18
  }

  private settleFlake(index: number, y: number): void {
    if (!this.positions || !this.velocities || !this.settled) return
    if (this.settled[index]) return
    const i3 = index * 3
    this.positions[i3 + 1] = y
    this.velocities[i3] = 0
    this.velocities[i3 + 1] = 0
    this.velocities[i3 + 2] = 0
    this.settled[index] = 1
    this.settledCount += 1
  }

  /** Fallende Flocken aus dem Draw-Range entfernen, liegende behalten. */
  private deactivateFalling(): void {
    if (!this.positions || !this.velocities || !this.settled) return
    let write = 0
    for (let i = 0; i < this.activeCount; i += 1) {
      if (!this.settled[i]) continue
      if (write !== i) {
        const a = i * 3
        const b = write * 3
        this.positions[b] = this.positions[a]!
        this.positions[b + 1] = this.positions[a + 1]!
        this.positions[b + 2] = this.positions[a + 2]!
        this.velocities[b] = 0
        this.velocities[b + 1] = 0
        this.velocities[b + 2] = 0
        this.settled[write] = 1
        this.settled[i] = 0
      }
      write += 1
    }
    this.activeCount = write
    this.settledCount = write
  }

  private syncBounds(box: THREE.Box3 | null): void {
    if (!box || box.isEmpty()) {
      this.occOriginX = 0
      this.occOriginZ = 0
      this.occSizeX = 1200
      this.occSizeZ = 1200
      this.occYMin = -20
      this.occYMax = 800
      return
    }
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    const pad = 180
    this.occOriginX = center.x
    this.occOriginZ = center.z
    this.occSizeX = Math.max(400, size.x + pad * 2)
    this.occSizeZ = Math.max(400, size.z + pad * 2)
    this.occYMin = box.min.y - 20
    this.occYMax = box.max.y + 80
  }

  private ensureOccTarget(): THREE.WebGLRenderTarget {
    if (this.occTarget) return this.occTarget
    this.occTarget = new THREE.WebGLRenderTarget(OCC_RES, OCC_RES, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    })
    this.occTarget.texture.generateMipmaps = false
    return this.occTarget
  }

  /**
   * Grobe Himmelssicht: Ortho von oben, Fragmentfarbe = normalisierte Welt-Y
   * der obersten Fläche (Depth-Test).
   */
  bakeOcclusionInPlace(
    renderer: THREE.WebGLRenderer,
    siteRoot: THREE.Object3D,
    force = false,
  ): void {
    const now = performance.now()
    if (!force && !this.occDirty && now - this.lastOccMs < 1200) return
    this.lastOccMs = now
    this.occDirty = false

    const parentScene = siteRoot.parent
    if (!(parentScene instanceof THREE.Scene)) return

    const halfX = this.occSizeX * 0.5
    const halfZ = this.occSizeZ * 0.5
    this.occCamera.left = -halfX
    this.occCamera.right = halfX
    this.occCamera.top = halfZ
    this.occCamera.bottom = -halfZ
    this.occCamera.near = 1
    this.occCamera.far = Math.max(200, this.occYMax - this.occYMin + 200)
    this.occCamera.position.set(this.occOriginX, this.occYMax + 100, this.occOriginZ)
    this.occCamera.up.set(0, 0, -1)
    this.occCamera.lookAt(this.occOriginX, this.occYMin, this.occOriginZ)
    this.occCamera.updateProjectionMatrix()
    this.occCamera.updateMatrixWorld(true)

    this.heightMat.uniforms.uYMin!.value = this.occYMin
    this.heightMat.uniforms.uYMax!.value = this.occYMax

    const target = this.ensureOccTarget()
    const prevTarget = renderer.getRenderTarget()
    const prevClear = new THREE.Color()
    renderer.getClearColor(prevClear)
    const prevAlpha = renderer.getClearAlpha()
    const prevBackground = parentScene.background
    const prevOverride = parentScene.overrideMaterial
    const prevAutoClear = renderer.autoClear
    const snowVis = this.group.visible
    this.group.visible = false

    parentScene.overrideMaterial = this.heightMat
    parentScene.background = new THREE.Color(0x000000)
    renderer.setRenderTarget(target)
    renderer.autoClear = true
    renderer.setClearColor(0x000000, 1)
    renderer.clear()
    renderer.render(parentScene, this.occCamera)
    if (!this.heightField || this.heightField.length !== OCC_RES * OCC_RES * 4) {
      this.heightField = new Uint8Array(OCC_RES * OCC_RES * 4)
    }
    renderer.readRenderTargetPixels(target, 0, 0, OCC_RES, OCC_RES, this.heightField)

    parentScene.overrideMaterial = prevOverride
    parentScene.background = prevBackground
    renderer.setRenderTarget(prevTarget)
    renderer.setClearColor(prevClear, prevAlpha)
    renderer.autoClear = prevAutoClear
    this.group.visible = snowVis
  }

  private pushCoverageUniforms(): void {
    const cornerX = this.occOriginX - this.occSizeX * 0.5
    const cornerZ = this.occOriginZ - this.occSizeZ * 0.5
    setSnowCoverageUniforms({
      cover: this.cover,
      displaceCm: 0,
      occMap: this.occTarget?.texture ?? null,
      occEnabled: Boolean(this.occTarget),
      occOriginX: cornerX,
      occOriginZ: cornerZ,
      occSizeX: this.occSizeX,
      occSizeZ: this.occSizeZ,
      occYMin: this.occYMin,
      occYMax: this.occYMax,
    })
    setGroundMoodSnowCover(this.cover)
  }

  /**
   * @returns true wenn sich etwas Sichtbares geändert hat (Dirty-Flag).
   */
  tick(settings: SnowWeatherSettings, ctx: SnowTickContext): boolean {
    const active =
      settings.enabled &&
      ctx.presentationOk &&
      ctx.view3d &&
      (settings.intensity > 0.01 || this.cover > 0.001)

    this.syncBounds(ctx.buildingBox)
    this.group.updateMatrixWorld(true)
    this.cameraSpawn = ctx.cameraSpawn
      ? {
          position: this.group.worldToLocal(ctx.cameraSpawn.position.clone()),
          target: this.group.worldToLocal(ctx.cameraSpawn.target.clone()),
        }
      : undefined
    this.group.visible = active

    if (!settings.enabled) {
      if (this.cover !== 0 || this.activeCount !== 0) {
        this.cover = 0
        this.activeCount = 0
        this.settledCount = 0
        if (this.settled) this.settled.fill(0)
        if (this.points) this.points.geometry.setDrawRange(0, 0)
        this.pushCoverageUniforms()
        return true
      }
      this.pushCoverageUniforms()
      return false
    }

    let dirty = false

    if (!ctx.paused) {
      const acc = snowAccumulateRatePerSec(settings.temperatureC, settings.intensity)
      const melt = snowMeltRatePerSec(settings.temperatureC)
      const before = this.cover
      if (acc > 0) this.cover = Math.min(1, this.cover + acc * ctx.dtSec)
      if (melt > 0) this.cover = Math.max(0, this.cover - melt * ctx.dtSec)
      if (Math.abs(this.cover - before) > 1e-5) dirty = true
    }

    const showFalling =
      active && !ctx.paused && settings.intensity > 0.02 && settings.temperatureC <= 2
    const keepSettled = active && this.cover > 0.01 && settings.temperatureC <= 2
    if (!showFalling) {
      if (keepSettled && this.settledCount > 0) {
        this.deactivateFalling()
        if (this.points) this.points.geometry.setDrawRange(0, this.activeCount)
        dirty = true
        this.pushCoverageUniforms()
        return dirty
      }
      if (this.activeCount > 0) {
        this.activeCount = 0
        this.settledCount = 0
        if (this.settled) this.settled.fill(0)
        if (this.points) this.points.geometry.setDrawRange(0, 0)
        dirty = true
      }
      this.pushCoverageUniforms()
      return dirty
    }

    const budget = snowParticleBudget(settings.quality)
    this.ensureCapacity(budget.count)
    if (!this.positions || !this.velocities || !this.settled || !this.points) return dirty

    const target = Math.max(
      200,
      Math.floor(budget.count * THREE.MathUtils.clamp(settings.intensity, 0.15, 1)),
    )
    const maxSettled = Math.floor(target * 0.6)
    const minFalling = Math.max(200, Math.floor(target * 0.4))
    if (this.activeCount < target) {
      const spawn = Math.min(
        target - this.activeCount,
        Math.max(1, Math.floor(budget.spawnPerSec * ctx.dtSec)),
      )
      for (let s = 0; s < spawn; s += 1) {
        this.recycleFlake(this.activeCount, false)
        this.activeCount += 1
      }
      dirty = true
    } else if (this.activeCount > target) {
      for (let i = target; i < this.activeCount; i += 1) {
        if (this.settled[i]) {
          this.settled[i] = 0
          this.settledCount = Math.max(0, this.settledCount - 1)
        }
      }
      this.activeCount = target
      dirty = true
    }

    const groundPad = this.landingPads.find((p) => p.ground)
    const killY = (groundPad?.topY ?? this.occYMin) - 10
    const t = performance.now() * 0.001
    const melt = snowMeltRatePerSec(settings.temperatureC)
    for (let i = 0; i < this.activeCount; i += 1) {
      const i3 = i * 3
      if (this.settled[i]) {
        if (melt > 0 && Math.random() < Math.min(1, melt * ctx.dtSec * 2.4)) {
          this.recycleFlake(i, false)
        }
        continue
      }
      const prevY = this.positions[i3 + 1]!
      this.positions[i3]! += this.velocities[i3]! * ctx.dtSec
      this.positions[i3 + 1]! += this.velocities[i3 + 1]! * ctx.dtSec
      this.positions[i3 + 2]! += this.velocities[i3 + 2]! * ctx.dtSec
      this.positions[i3]! += Math.sin(i * 0.7 + t) * 2.2 * ctx.dtSec
      const x = this.positions[i3]!
      const y = this.positions[i3 + 1]!
      const z = this.positions[i3 + 2]!
      const hit = this.landingHit(x, z, prevY, y)
      if (hit || y < killY) {
        if (settings.temperatureC <= 0.05) {
          this.cover = Math.min(1, this.cover + 0.00012 * settings.intensity)
        }
        const fallingN = this.activeCount - this.settledCount
        const canSettle =
          Boolean(hit) &&
          settings.temperatureC <= 0.05 &&
          this.settledCount < maxSettled &&
          fallingN > minFalling
        if (canSettle && hit) {
          this.settleFlake(i, hit.y)
        } else {
          this.recycleFlake(i, false)
        }
      }
    }
    const attr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    attr.needsUpdate = true
    this.points.geometry.setDrawRange(0, this.activeCount)
    this.material.size = SNOW_FLAKE_SIZE_CM
    dirty = true

    this.pushCoverageUniforms()
    return dirty
  }
}
