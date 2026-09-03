import * as THREE from 'three'
import type { SceneLight } from '../scene/sceneLights'
import {
  createLightBloomCore,
  createLightGlowSprite,
  createLightSolidMarker,
  disposeLightBloomCore,
  disposeLightGlowSprite,
  disposeLightSolidMarker,
  updateLightBloomCore,
  updateLightGlowSprite,
  updateLightSolidMarker,
} from './lightGlowMarker'
import { enableBloomLayer } from './selectiveBloom'
import { markerGlowBrightness, wattsToThreeIntensity } from './sceneLightUnits'
import { pointShadowRadiusFromSoftness } from './pcssShadows'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR, SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import {
  normalizeSceneLightAnimation,
  sceneLightAnimationFactor,
  blaulichtPhaseOffsetsById,
  type SceneLightAnimationId,
} from '../scene/sceneLightAnimation'
import {
  DEFAULT_BEAM_ANGLE_DOWN_DEG,
  DEFAULT_BEAM_ANGLE_UP_DEG,
  normalizeBeamMode,
  type SceneLightBeamMode,
} from '../scene/sceneLightPresets'

const MARKER_RADIUS_CM = 40
const PICK_RADIUS_CM = 64
const POINT_SHADOW_MAP = 2048
/** Ortho-2D vergrößert Cube-Texel — höhere Map gegen Treppchen. */
export const POINT_SHADOW_MAP_FRONT = 4096
const POINT_SHADOW_NEAR_CM = 8
const POINT_SHADOW_FAR_DEFAULT_CM = 2400
const SPOT_TARGET_OFFSET_CM = 1200
const SPOT_PENUMBRA = 0.35
/** Marker/Bloom-Kern unter diesem Animationsfaktor ausblenden (Dunkelhälfte). */
const BLAULICHT_VISIBLE_MARKER_FACTOR = 0.15

/** Extra-Weichheit für Ortho-Front — seit v2.0.118 ungenutzt (Hard-Cube, kein Soft-Würfel). */
export const POINT_SHADOW_RADIUS_SCALE_FRONT = 1

interface LightEntry {
  root: THREE.Group
  point: THREE.PointLight
  spotDown: THREE.SpotLight
  spotUp: THREE.SpotLight
  marker: THREE.Sprite
  bloomCore: THREE.Mesh
  solidMarker: THREE.Mesh
  pick: THREE.Mesh
  beamMode: SceneLightBeamMode
  /** Basisleistung (Watt) vor Animations-Multiplikator. */
  baseWatts: number
  animation: SceneLightAnimationId
  /** Phasenversatz für Blaulicht-Doppelblitz (ms). */
  phaseOffsetMs: number
  enabled: boolean
  colorHex: string
  selected: boolean
  markerRadiusCm: number
  markersGloballyOn: boolean
  showMarker: boolean
  bloomActive: boolean
  roomOcclusion: boolean
}

export interface SceneLightRuntimeSyncOptions {
  selectedId?: string
  /** Raumhülle: Wände/Böden/Decken okkludieren Punktlicht (Render, 3D/Front). */
  roomOcclusion?: boolean
  /** Cube-Shadow Reichweite (cm-Maßstab). */
  shadowFarCm?: number
  /** Sonnen-Weichheit-Slider → Punktlicht shadow.radius. */
  shadowSoftness?: number
  /**
   * Extra-Weichheit für Ortho-2D (Cube-Schatten wirken sonst pixelig).
   * 1 = normal, ~2 in Front-Ansicht.
   */
  pointShadowRadiusScale?: number
  /** Cube-Shadow-Map-Kantenlänge; Front oft höher. */
  pointShadowMapSize?: number
  /** Globale Anzeige der Editor-Kugeln (Bibliothek → Licht). */
  showMarkers?: boolean
  /** Bloom aktiv — HDR-Kern für Glühbirnen-Effekt. */
  bloomActive?: boolean
  /** Zeitstempel für Blink-Animationen (ms). */
  timeMs?: number
}

function configureShadowLayers(light: THREE.Light): void {
  light.layers.enable(SHADOW_LAYER_INTERIOR)
  light.layers.enable(SHADOW_LAYER_EXTERIOR)
  if (light.shadow) {
    light.shadow.camera.layers.enable(SHADOW_LAYER_INTERIOR)
    light.shadow.camera.layers.enable(SHADOW_LAYER_EXTERIOR)
    light.shadow.camera.layers.enable(SHADOW_LAYER_OCCLUDER)
  }
}

function createPointLight(color: THREE.Color): THREE.PointLight {
  const light = new THREE.PointLight(color, 2800, 0, 2)
  light.castShadow = true
  light.shadow.bias = -0.001
  light.shadow.normalBias = 0.25
  light.shadow.mapSize.setScalar(POINT_SHADOW_MAP)
  light.shadow.radius = 1
  light.shadow.camera.near = POINT_SHADOW_NEAR_CM
  light.shadow.camera.far = POINT_SHADOW_FAR_DEFAULT_CM
  configureShadowLayers(light)
  light.userData.kind = 'sceneLight'
  return light
}

function createSpotLight(color: THREE.Color, direction: 'down' | 'up'): THREE.SpotLight {
  const light = new THREE.SpotLight(color, 2800, 0, Math.PI / 4, SPOT_PENUMBRA, 2)
  light.castShadow = true
  light.shadow.bias = -0.001
  light.shadow.normalBias = 0.25
  light.shadow.mapSize.setScalar(POINT_SHADOW_MAP)
  light.shadow.radius = 1
  light.shadow.camera.near = POINT_SHADOW_NEAR_CM
  light.shadow.camera.far = POINT_SHADOW_FAR_DEFAULT_CM
  light.shadow.focus = 1
  configureShadowLayers(light)
  light.userData.kind = 'sceneLight'
  light.userData.spotDir = direction
  light.target.position.set(0, direction === 'down' ? -SPOT_TARGET_OFFSET_CM : SPOT_TARGET_OFFSET_CM, 0)
  return light
}

export class SceneLightRuntime {
  readonly root = new THREE.Group()
  private readonly entries = new Map<string, LightEntry>()

  constructor() {
    this.root.name = 'sceneLightRuntime'
  }

  sync(lights: SceneLight[], options: SceneLightRuntimeSyncOptions): void {
    const ids = new Set(lights.map((item) => item.id))
    for (const id of [...this.entries.keys()]) {
      if (ids.has(id)) continue
      this.disposeEntry(id)
    }

    const phaseById = blaulichtPhaseOffsetsById(lights)
    for (const spec of lights) {
      let entry = this.entries.get(spec.id)
      if (!entry) {
        entry = this.createEntry(spec.color)
        this.entries.set(spec.id, entry)
        this.root.add(entry.root, entry.pick)
      }
      entry.phaseOffsetMs = phaseById.get(spec.id) ?? 0
      this.applySpec(entry, spec, options)
    }
  }

  pickObject(object: THREE.Object3D): string | undefined {
    let current: THREE.Object3D | null = object
    while (current) {
      const id = current.userData.sceneLightId as string | undefined
      if (id) return id
      current = current.parent
    }
    return undefined
  }

  dispose(): void {
    for (const id of [...this.entries.keys()]) this.disposeEntry(id)
  }

  private createEntry(colorHex: string): LightEntry {
    const color = new THREE.Color(colorHex)
    const root = new THREE.Group()
    root.name = 'sceneLightRoot'

    const point = createPointLight(color)
    const spotDown = createSpotLight(color, 'down')
    const spotUp = createSpotLight(color, 'up')

    const marker = createLightGlowSprite(MARKER_RADIUS_CM * 2)
    enableBloomLayer(marker)
    const bloomCore = createLightBloomCore()
    enableBloomLayer(bloomCore)
    const solidMarker = createLightSolidMarker()
    root.add(point, spotDown, spotDown.target, spotUp, spotUp.target, marker, bloomCore, solidMarker)

    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(PICK_RADIUS_CM, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    pick.userData.kind = 'sceneLightPick'

    return {
      root,
      point,
      spotDown,
      spotUp,
      marker,
      bloomCore,
      solidMarker,
      pick,
      beamMode: 'omni',
      baseWatts: 0,
      animation: 'none',
      phaseOffsetMs: 0,
      enabled: true,
      colorHex: '#ffffff',
      selected: false,
      markerRadiusCm: 0,
      markersGloballyOn: true,
      showMarker: true,
      bloomActive: false,
      roomOcclusion: false,
    }
  }

  /**
   * Aktualisiert nur Intensitäten/Marker für Blink-Animationen.
   * @returns true wenn mindestens ein Licht animiert wurde.
   */
  tickAnimations(timeMs: number, lights?: SceneLight[]): boolean {
    if (lights) {
      const phaseById = blaulichtPhaseOffsetsById(lights)
      for (const [id, entry] of this.entries) {
        entry.phaseOffsetMs = phaseById.get(id) ?? 0
      }
    }
    let any = false
    for (const entry of this.entries.values()) {
      if (entry.animation === 'none' || !entry.enabled) continue
      any = true
      this.applyAnimatedIntensity(entry, timeMs)
    }
    return any
  }

  private applyAnimatedIntensity(entry: LightEntry, timeMs: number): void {
    const factor = sceneLightAnimationFactor(entry.animation, timeMs, entry.phaseOffsetMs)
    const usePoint = entry.beamMode === 'omni'
    const useDown = entry.beamMode === 'down' || entry.beamMode === 'upDown'
    const useUp = entry.beamMode === 'up' || entry.beamMode === 'upDown'
    const split = entry.beamMode === 'upDown' ? 0.5 : 1
    const inten = entry.enabled ? wattsToThreeIntensity(entry.baseWatts) * factor : 0
    entry.point.intensity = usePoint ? inten : 0
    entry.spotDown.intensity = useDown ? inten * split : 0
    entry.spotUp.intensity = useUp ? inten * split : 0

    const markerOn =
      entry.markersGloballyOn && entry.showMarker && entry.markerRadiusCm > 0 && entry.enabled
    const markerDiameter = markerOn ? entry.markerRadiusCm * 2 : 0
    const glowBrightness = markerGlowBrightness(entry.baseWatts * factor, entry.selected)
    updateLightGlowSprite(
      entry.marker,
      entry.colorHex,
      entry.roomOcclusion ? 0 : markerDiameter,
      glowBrightness,
    )
    const bloomCoreDiameter = entry.roomOcclusion
      ? markerOn
        ? Math.max(8, entry.markerRadiusCm * 0.55)
        : 0
      : markerDiameter
    const bloomCoreVisible =
      entry.markersGloballyOn && entry.showMarker && entry.enabled && bloomCoreDiameter > 0
    updateLightBloomCore(
      entry.bloomCore,
      entry.colorHex,
      bloomCoreDiameter,
      entry.baseWatts * factor,
      entry.bloomActive,
      bloomCoreVisible && factor > BLAULICHT_VISIBLE_MARKER_FACTOR,
    )
    updateLightSolidMarker(
      entry.solidMarker,
      entry.colorHex,
      entry.roomOcclusion && markerOn && factor > BLAULICHT_VISIBLE_MARKER_FACTOR,
      entry.selected,
    )
  }

  private applySpec(entry: LightEntry, spec: SceneLight, options: SceneLightRuntimeSyncOptions): void {
    const beamMode = normalizeBeamMode(spec.beamMode)
    entry.beamMode = beamMode
    entry.baseWatts = spec.intensity
    entry.animation = normalizeSceneLightAnimation(spec.animation)
    entry.enabled = spec.enabled !== false
    entry.colorHex = spec.color
    entry.root.userData.sceneLightId = spec.id
    entry.point.userData.sceneLightId = spec.id
    entry.spotDown.userData.sceneLightId = spec.id
    entry.spotUp.userData.sceneLightId = spec.id
    entry.marker.userData.sceneLightId = spec.id
    entry.pick.userData.sceneLightId = spec.id

    entry.root.position.set(spec.x, spec.y, spec.z)
    entry.pick.position.set(spec.x, spec.y, spec.z)

    const color = new THREE.Color(spec.color)
    const timeMs = options.timeMs ?? performance.now()
    const animFactor = sceneLightAnimationFactor(entry.animation, timeMs, entry.phaseOffsetMs)
    const inten = entry.enabled ? wattsToThreeIntensity(spec.intensity) * animFactor : 0
    const distance = spec.distance ?? 0
    const decay = spec.decay ?? 2
    const cast =
      entry.enabled && spec.castShadow !== false && options.roomOcclusion !== false
    const mapSize = options.pointShadowMapSize ?? POINT_SHADOW_MAP
    const shadowFar =
      distance > 0
        ? Math.max(distance * 1.05, POINT_SHADOW_NEAR_CM * 4)
        : (options.shadowFarCm ?? POINT_SHADOW_FAR_DEFAULT_CM)
    const softRadius = pointShadowRadiusFromSoftness(
      options.shadowSoftness ?? 2.5,
      options.pointShadowRadiusScale ?? 1,
    )
    const angleDown = THREE.MathUtils.degToRad(
      spec.beamAngleDownDeg ?? DEFAULT_BEAM_ANGLE_DOWN_DEG,
    )
    const angleUp = THREE.MathUtils.degToRad(spec.beamAngleUpDeg ?? DEFAULT_BEAM_ANGLE_UP_DEG)

    const usePoint = beamMode === 'omni'
    const useDown = beamMode === 'down' || beamMode === 'upDown'
    const useUp = beamMode === 'up' || beamMode === 'upDown'

    entry.point.visible = usePoint && entry.enabled
    entry.spotDown.visible = useDown && entry.enabled
    entry.spotUp.visible = useUp && entry.enabled

    this.syncPoint(entry.point, {
      color,
      intensity: usePoint ? inten : 0,
      distance,
      decay,
      cast: cast && usePoint,
      mapSize,
      shadowFar,
      softRadius,
    })
    const split = beamMode === 'upDown' ? 0.5 : 1
    this.syncSpot(entry.spotDown, {
      color,
      intensity: useDown ? inten * split : 0,
      distance,
      decay,
      cast: cast && useDown,
      mapSize,
      shadowFar,
      softRadius,
      angle: angleDown,
    })
    this.syncSpot(entry.spotUp, {
      color,
      intensity: useUp ? inten * split : 0,
      distance,
      decay,
      cast: cast && useUp,
      mapSize,
      shadowFar,
      softRadius,
      angle: angleUp,
    })

    const selected = options.selectedId === spec.id
    const markersGloballyOn = options.showMarkers !== false
    const markerRadius =
      markersGloballyOn && spec.showMarker !== false
        ? Math.max(0, spec.markerSizeCm ?? MARKER_RADIUS_CM)
        : 0
    entry.selected = selected
    entry.markersGloballyOn = markersGloballyOn
    entry.showMarker = spec.showMarker !== false
    entry.markerRadiusCm = markerRadius
    entry.bloomActive = options.bloomActive === true
    entry.roomOcclusion = options.roomOcclusion === true

    const glowBrightness = markerGlowBrightness(spec.intensity * animFactor, selected)
    const markerOn = markerRadius > 0 && entry.enabled
    const markerDiameter = markerOn ? markerRadius * 2 : 0
    const roomOcclusion = entry.roomOcclusion
    updateLightGlowSprite(entry.marker, spec.color, roomOcclusion ? 0 : markerDiameter, glowBrightness)
    const bloomCoreDiameter = roomOcclusion
      ? markerOn
        ? Math.max(8, markerRadius * 0.55)
        : 0
      : markerDiameter
    const bloomCoreVisible =
      markersGloballyOn &&
      spec.showMarker !== false &&
      entry.enabled &&
      bloomCoreDiameter > 0 &&
      animFactor > BLAULICHT_VISIBLE_MARKER_FACTOR
    updateLightBloomCore(
      entry.bloomCore,
      spec.color,
      bloomCoreDiameter,
      spec.intensity * animFactor,
      options.bloomActive === true,
      bloomCoreVisible,
    )
    updateLightSolidMarker(
      entry.solidMarker,
      spec.color,
      roomOcclusion && markerOn && animFactor > BLAULICHT_VISIBLE_MARKER_FACTOR,
      selected,
    )
    const pickScale = (markerRadius > 0 ? Math.max(markerRadius * 1.6, 48) : 48) / PICK_RADIUS_CM
    entry.pick.scale.setScalar(selected ? pickScale * 1.15 : pickScale)
    entry.pick.visible = true
  }

  private syncPoint(
    light: THREE.PointLight,
    opts: {
      color: THREE.Color
      intensity: number
      distance: number
      decay: number
      cast: boolean
      mapSize: number
      shadowFar: number
      softRadius: number
    },
  ): void {
    light.color.copy(opts.color)
    light.intensity = opts.intensity
    light.distance = opts.distance
    light.decay = opts.decay
    light.castShadow = opts.cast
    light.shadow.radius = opts.softRadius
    if (light.shadow.mapSize.x !== opts.mapSize) {
      light.shadow.mapSize.setScalar(opts.mapSize)
      if (light.shadow.map) {
        light.shadow.map.dispose()
        light.shadow.map = null
      }
    }
    if (light.shadow.camera.far !== opts.shadowFar) {
      light.shadow.camera.far = opts.shadowFar
      light.shadow.camera.updateProjectionMatrix()
    }
  }

  private syncSpot(
    light: THREE.SpotLight,
    opts: {
      color: THREE.Color
      intensity: number
      distance: number
      decay: number
      cast: boolean
      mapSize: number
      shadowFar: number
      softRadius: number
      angle: number
    },
  ): void {
    light.color.copy(opts.color)
    light.intensity = opts.intensity
    light.distance = opts.distance
    light.decay = opts.decay
    light.angle = Math.min(Math.PI / 2 - 0.01, Math.max(0.05, opts.angle))
    light.penumbra = SPOT_PENUMBRA
    light.castShadow = opts.cast
    light.shadow.radius = opts.softRadius
    if (light.shadow.mapSize.x !== opts.mapSize) {
      light.shadow.mapSize.setScalar(opts.mapSize)
      if (light.shadow.map) {
        light.shadow.map.dispose()
        light.shadow.map = null
      }
    }
    if (light.shadow.camera.far !== opts.shadowFar) {
      light.shadow.camera.far = opts.shadowFar
      light.shadow.camera.updateProjectionMatrix()
    }
  }

  private disposeEntry(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.root.remove(entry.root, entry.pick)
    disposeLightGlowSprite(entry.marker)
    disposeLightBloomCore(entry.bloomCore)
    disposeLightSolidMarker(entry.solidMarker)
    entry.pick.geometry.dispose()
    ;(entry.pick.material as THREE.Material).dispose()
    entry.point.dispose()
    entry.spotDown.dispose()
    entry.spotUp.dispose()
    this.entries.delete(id)
  }
}
