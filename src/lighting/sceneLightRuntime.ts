import * as THREE from 'three'
import type { SceneLight } from '../scene/sceneLights'
import {
  createLightBloomCore,
  createLightGlowSprite,
  disposeLightBloomCore,
  disposeLightGlowSprite,
  updateLightBloomCore,
  updateLightGlowSprite,
} from './lightGlowMarker'
import { markerGlowBrightness, wattsToThreeIntensity } from './sceneLightUnits'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR } from '../utils/sunLighting'

const MARKER_RADIUS_CM = 40
const PICK_RADIUS_CM = 64
const POINT_SHADOW_MAP = 1024
const POINT_SHADOW_NEAR_CM = 8
const POINT_SHADOW_FAR_DEFAULT_CM = 2400

interface LightEntry {
  light: THREE.PointLight
  marker: THREE.Sprite
  bloomCore: THREE.Mesh
  pick: THREE.Mesh
}

export interface SceneLightRuntimeSyncOptions {
  castShadow: boolean
  selectedId?: string
  /** Cube-Shadow Reichweite (cm-Maßstab). */
  shadowFarCm?: number
  /** Globale Anzeige der Editor-Kugeln (Bibliothek → Licht). */
  showMarkers?: boolean
  /** Bloom aktiv — HDR-Kern für Glühbirnen-Effekt. */
  bloomActive?: boolean
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

    for (const spec of lights) {
      let entry = this.entries.get(spec.id)
      if (!entry) {
        entry = this.createEntry(spec.color)
        this.entries.set(spec.id, entry)
        this.root.add(entry.light, entry.pick)
      }
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
    const light = new THREE.PointLight(color, 2800, 0, 2)
    light.castShadow = true
    light.shadow.bias = -0.002
    light.shadow.normalBias = 0.04
    light.shadow.mapSize.setScalar(POINT_SHADOW_MAP)
    light.shadow.radius = 6
    light.shadow.camera.near = POINT_SHADOW_NEAR_CM
    light.shadow.camera.far = POINT_SHADOW_FAR_DEFAULT_CM
    light.layers.enable(SHADOW_LAYER_INTERIOR)
    light.layers.enable(SHADOW_LAYER_EXTERIOR)
    light.shadow.camera.layers.enable(SHADOW_LAYER_INTERIOR)
    light.shadow.camera.layers.enable(SHADOW_LAYER_EXTERIOR)

    const marker = createLightGlowSprite(MARKER_RADIUS_CM * 2)
    const bloomCore = createLightBloomCore()
    light.add(marker, bloomCore)
    light.userData.kind = 'sceneLight'

    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(PICK_RADIUS_CM, 12, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    pick.userData.kind = 'sceneLightPick'

    return { light, marker, bloomCore, pick }
  }

  private applySpec(entry: LightEntry, spec: SceneLight, options: SceneLightRuntimeSyncOptions): void {
    entry.light.userData.sceneLightId = spec.id
    entry.marker.userData.sceneLightId = spec.id
    entry.pick.userData.sceneLightId = spec.id
    entry.light.position.set(spec.x, spec.y, spec.z)
    entry.pick.position.set(spec.x, spec.y, spec.z)
    entry.light.visible = spec.enabled
    entry.light.intensity = spec.enabled ? wattsToThreeIntensity(spec.intensity) : 0
    entry.light.color.set(spec.color)
    entry.light.distance = spec.distance ?? 0
    entry.light.decay = spec.decay ?? 2
    entry.light.castShadow = spec.enabled && spec.castShadow && options.castShadow
    const shadowFar = options.shadowFarCm ?? POINT_SHADOW_FAR_DEFAULT_CM
    if (entry.light.shadow.camera.far !== shadowFar) {
      entry.light.shadow.camera.far = shadowFar
      entry.light.shadow.camera.updateProjectionMatrix()
    }
    const selected = options.selectedId === spec.id
    const markersGloballyOn = options.showMarkers !== false
    const markerRadius =
      markersGloballyOn && spec.showMarker !== false
        ? Math.max(0, spec.markerSizeCm ?? MARKER_RADIUS_CM)
        : 0
    const glowBrightness = markerGlowBrightness(spec.intensity, selected)
    const markerDiameter = markerRadius > 0 && spec.enabled ? markerRadius * 2 : 0
    updateLightGlowSprite(entry.marker, spec.color, markerDiameter, glowBrightness)
    updateLightBloomCore(
      entry.bloomCore,
      spec.color,
      markerDiameter,
      spec.intensity,
      options.bloomActive === true,
      markersGloballyOn && spec.showMarker !== false && spec.enabled,
    )
    const pickScale = (markerRadius > 0 ? Math.max(markerRadius * 1.6, 48) : 48) / PICK_RADIUS_CM
    entry.pick.scale.setScalar(selected ? pickScale * 1.15 : pickScale)
    entry.pick.visible = true
  }

  private disposeEntry(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.root.remove(entry.light, entry.pick)
    disposeLightGlowSprite(entry.marker)
    disposeLightBloomCore(entry.bloomCore)
    entry.pick.geometry.dispose()
    ;(entry.pick.material as THREE.Material).dispose()
    entry.light.dispose()
    this.entries.delete(id)
  }
}
