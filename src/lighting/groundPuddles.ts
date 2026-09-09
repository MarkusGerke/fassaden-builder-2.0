/**
 * Boden-Steingrau und optionale Spiegelflächen (Pfützen) vor der Fassade.
 */

import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

/** Fester Boden-Ton (Himmel- und Neutral-Modus). */
export const GROUND_STONE_GRAY = '#7E848C'

export interface GroundPuddleSettings {
  enabled: boolean
}

export const DEFAULT_GROUND_PUDDLE_SETTINGS: GroundPuddleSettings = {
  enabled: false,
}

export function normalizeGroundPuddleSettings(value: unknown): GroundPuddleSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_GROUND_PUDDLE_SETTINGS }
  const raw = value as Record<string, unknown>
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_GROUND_PUDDLE_SETTINGS.enabled,
  }
}

export function isGroundPuddleSettings(value: unknown): value is GroundPuddleSettings {
  if (!value || typeof value !== 'object') return false
  return typeof (value as Record<string, unknown>).enabled === 'boolean'
}

type PuddleSpec = {
  /** Offset vom Gebäudezentrum in lokaler X (cm). */
  dx: number
  /** Offset in lokaler Z (cm). */
  dz: number
  /** Ellipse Breite / Tiefe (cm). */
  sx: number
  sz: number
  yaw: number
}

/** Feste, natürliche Anordnung — nicht jedes Frame neu würfeln. */
const PUDDLE_LAYOUT: PuddleSpec[] = [
  { dx: -120, dz: 220, sx: 140, sz: 70, yaw: 0.2 },
  { dx: 90, dz: 280, sx: 100, sz: 55, yaw: -0.35 },
  { dx: 40, dz: -240, sx: 160, sz: 80, yaw: 0.1 },
  { dx: -200, dz: -160, sx: 90, sz: 50, yaw: 0.55 },
  { dx: 210, dz: 40, sx: 110, sz: 60, yaw: -0.15 },
]

const PUDDLE_Y_EPS = 0.08
const REFLECT_SIZE = 512

/**
 * Spiegelt die Szene in mehreren elliptischen Pfützen auf dem Boden.
 * Teuer (Extra-Pass pro Pfütze) — bei Orbit ausgeblendet.
 */
export class GroundPuddleRuntime {
  readonly group = new THREE.Group()
  private reflectors: Reflector[] = []
  private built = false

  constructor() {
    this.group.name = 'groundPuddles'
    this.group.visible = false
  }

  ensureBuilt(): void {
    if (this.built) return
    this.built = true
    for (const spec of PUDDLE_LAYOUT) {
      const geo = new THREE.CircleGeometry(1, 48)
      const reflector = new Reflector(geo, {
        clipBias: 0.02,
        textureWidth: REFLECT_SIZE,
        textureHeight: REFLECT_SIZE,
        color: 0x6a7078,
      })
      reflector.name = 'groundPuddle'
      reflector.rotation.x = -Math.PI / 2
      reflector.scale.set(spec.sx * 0.5, spec.sz * 0.5, 1)
      reflector.rotation.z = spec.yaw
      reflector.castShadow = false
      reflector.receiveShadow = false
      reflector.frustumCulled = false
      this.reflectors.push(reflector)
      this.group.add(reflector)
    }
  }

  /**
   * Positioniert Pfützen um die Gebäudebox (vor allem vor den Fassaden).
   * `yawRad` = Site-Drehung.
   */
  sync(opts: {
    enabled: boolean
    view3d: boolean
    orbitLite: boolean
    groundY: number
    cx: number
    cz: number
    box: THREE.Box3 | null
  }): void {
    const show = opts.enabled && opts.view3d && !opts.orbitLite
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

    for (let i = 0; i < this.reflectors.length; i += 1) {
      const spec = PUDDLE_LAYOUT[i]!
      const reflector = this.reflectors[i]!
      // Außerhalb der Gebäude-Halbspanne → vor den Fassaden, nicht unter dem Haus.
      const px = cx + Math.sign(spec.dx || 1) * (halfX * 0.55 + Math.abs(spec.dx) * 0.25)
      const pz = cz + Math.sign(spec.dz || 1) * (halfZ * 0.55 + Math.abs(spec.dz) * 0.25)
      reflector.position.set(px, opts.groundY + PUDDLE_Y_EPS, pz)
      reflector.scale.set(spec.sx * 0.5, spec.sz * 0.5, 1)
      reflector.rotation.z = spec.yaw
    }
  }

  dispose(): void {
    for (const reflector of this.reflectors) {
      reflector.geometry.dispose()
      const mat = reflector.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
      const rt = (reflector as unknown as { getRenderTarget?: () => THREE.WebGLRenderTarget })
        .getRenderTarget?.()
      rt?.dispose()
      this.group.remove(reflector)
    }
    this.reflectors = []
    this.built = false
  }
}
