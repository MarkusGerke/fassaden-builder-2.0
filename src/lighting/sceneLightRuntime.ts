import * as THREE from 'three'
import type { SceneLight } from '../scene/sceneLights'
import {
  createLightBloomCore,
  createLightEditRing,
  createLightGlowSprite,
  createLightSolidMarker,
  disposeLightBloomCore,
  disposeLightEditRing,
  disposeLightGlowSprite,
  disposeLightSolidMarker,
  updateLightBloomCore,
  updateLightEditRing,
  updateLightGlowSprite,
  updateLightSolidMarker,
} from './lightGlowMarker'
import { enableBloomLayer } from './selectiveBloom'
import { markerGlowBrightness, wattsToThreeIntensity } from './sceneLightUnits'
import { pointShadowRadiusFromSoftness } from './pcssShadows'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR, SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import {
  DEFAULT_SCENE_LIGHT_FADE_IN_MS,
  DEFAULT_SCENE_LIGHT_FADE_OUT_MS,
} from '../scene/sceneLights'
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
  /** Licht-Modus: Kreismarke um jedes Licht, unabhängig von Tag/Nacht. */
  editRing: THREE.Sprite
  pick: THREE.Mesh
  beamMode: SceneLightBeamMode
  /** Basisleistung (Watt) vor Animations-Multiplikator. */
  baseWatts: number
  animation: SceneLightAnimationId
  /** Phasenversatz für Blaulicht-Doppelblitz (ms). */
  phaseOffsetMs: number
  /** Ziel an/aus aus State. */
  enabled: boolean
  /** 0…1 Ein-/Ausblendfaktor. */
  fadeFactor: number
  fadeInMs: number
  fadeOutMs: number
  colorHex: string
  selected: boolean
  markerRadiusCm: number
  markersGloballyOn: boolean
  showMarker: boolean
  bloomActive: boolean
  roomOcclusion: boolean
  /** Licht-Modus: Lichter bleiben im Shader gezählt (visible, Intensität 0) — kein Rebuild bei Blink/aus. */
  keepCounted: boolean
}

/**
 * Padding-Schrittweite für die stabile Lichtanzahl im Licht-Modus. Three.js kompiliert bei jeder
 * neuen Anzahl sichtbarer Punkt-/Spotlichter **alle** Programme neu (~3–4 s bei ~90 Programmen).
 * Reserve-Lichter mit Intensität 0 halten die Anzahl konstant; erst nach 4 Hinzufügungen ein Rebuild.
 */
export const STABLE_LIGHT_COUNT_STEP = 4

/**
 * Max. gleichzeitige Punkt-/Spot-Shadow-Maps (Cube oder 2D).
 * Ab ~16 Shadow-Casters (WebGL-Texture-Units) wird die Szene schwarz — nachts mit vielen
 * „Lichter an“ wirkte das wie „Lichter gehen nicht“. Unter dem Limit bleiben, stärkste zuerst.
 */
export const MAX_SCENE_LIGHT_SHADOWS = 12

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
  /** Licht-Modus: Kreismarken um alle Lichter (auch aus / tagsüber). */
  showMarkers?: boolean
  /** Bloom aktiv — HDR-Kern für Glühbirnen-Effekt. */
  bloomActive?: boolean
  /** Zeitstempel für Blink-Animationen (ms). */
  timeMs?: number
  /**
   * Licht-Modus: Anzahl sichtbarer Punkt-/Spotlichter konstant halten (Reserve-Lichter mit
   * Intensität 0, inaktive Lichter bleiben `visible`). Hinzufügen/Löschen/Blinken löst dann keine
   * Shader-Neukompilierung aus. Ohne Option werden Reserven ausgeblendet.
   */
  stableLightCount?: boolean
}

function configureShadowLayers(light: THREE.Light): void {
  light.layers.enable(SHADOW_LAYER_INTERIOR)
  light.layers.enable(SHADOW_LAYER_EXTERIOR)
  if (light.shadow) {
    // Manuelle Bakes: nur dirty Lichter (nicht Sonne + alle Cubes bei jedem Duplikat).
    light.shadow.autoUpdate = false
    light.shadow.needsUpdate = false
    light.shadow.camera.layers.enable(SHADOW_LAYER_INTERIOR)
    light.shadow.camera.layers.enable(SHADOW_LAYER_EXTERIOR)
    light.shadow.camera.layers.enable(SHADOW_LAYER_OCCLUDER)
  }
}

function createPointLight(color: THREE.Color): THREE.PointLight {
  const light = new THREE.PointLight(color, 2800, 0, 2)
  // castShadow erst in applySpec — sonst 3 Maps pro Entry sofort allokiert.
  light.castShadow = false
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
  light.castShadow = false
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
  /** Reserve-Lichter (Intensität 0) für die stabile Lichtanzahl im Licht-Modus. */
  private readonly sparePoints: THREE.PointLight[] = []
  private readonly spareSpots: THREE.SpotLight[] = []
  /** Ziel-Anzahl gezählter Lichter; wächst nur (Hysterese), Reset beim Verlassen des Modus. */
  private stablePointTarget = 0
  private stableSpotTarget = 0

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
        entry.fadeFactor = spec.enabled !== false ? 1 : 0
        this.entries.set(spec.id, entry)
        this.root.add(entry.root, entry.pick)
      }
      entry.phaseOffsetMs = phaseById.get(spec.id) ?? 0
      this.applySpec(entry, spec, options)
    }
    this.enforceShadowBudget()
    this.syncSpareLights(options.stableLightCount === true)
  }

  /**
   * Nur die hellsten N Shadow-Casters behalten — sonst Texture-Unit-Overflow → schwarze Szene.
   * Beleuchtung selbst bleibt an (nur `castShadow` aus für den Rest).
   */
  private enforceShadowBudget(maxShadows = MAX_SCENE_LIGHT_SHADOWS): void {
    const casters: { light: THREE.Light; score: number }[] = []
    for (const entry of this.entries.values()) {
      if (entry.point.castShadow) {
        casters.push({ light: entry.point, score: entry.point.intensity })
      }
      if (entry.spotDown.castShadow) {
        casters.push({ light: entry.spotDown, score: entry.spotDown.intensity })
      }
      if (entry.spotUp.castShadow) {
        casters.push({ light: entry.spotUp, score: entry.spotUp.intensity })
      }
    }
    if (casters.length <= maxShadows) return
    casters.sort((a, b) => b.score - a.score)
    for (let i = maxShadows; i < casters.length; i += 1) {
      casters[i]!.light.castShadow = false
    }
  }

  /** Anzahl aktuell im Shader gezählter (sichtbarer) Punkt-/Spotlichter inkl. Reserven. */
  countedLights(): { points: number; spots: number } {
    let points = 0
    let spots = 0
    for (const entry of this.entries.values()) {
      if (entry.point.visible) points += 1
      if (entry.spotDown.visible) spots += 1
      if (entry.spotUp.visible) spots += 1
    }
    for (const spare of this.sparePoints) if (spare.visible) points += 1
    for (const spare of this.spareSpots) if (spare.visible) spots += 1
    return { points, spots }
  }

  /**
   * Reserve-Lichter so setzen, dass die gezählte Anzahl auf ein Vielfaches von
   * `STABLE_LIGHT_COUNT_STEP` (mit mindestens einer freien Reserve) aufgefüllt ist.
   */
  private syncSpareLights(stable: boolean): void {
    if (!stable) {
      this.stablePointTarget = 0
      this.stableSpotTarget = 0
      for (const spare of this.sparePoints) spare.visible = false
      for (const spare of this.spareSpots) spare.visible = false
      return
    }
    let points = 0
    let spots = 0
    for (const entry of this.entries.values()) {
      if (entry.point.visible) points += 1
      if (entry.spotDown.visible) spots += 1
      if (entry.spotUp.visible) spots += 1
    }
    const step = STABLE_LIGHT_COUNT_STEP
    const roundUp = (n: number) => Math.ceil((n + 1) / step) * step
    this.stablePointTarget = Math.max(this.stablePointTarget, roundUp(points))
    this.stableSpotTarget = Math.max(this.stableSpotTarget, roundUp(spots))

    const needPoints = Math.max(0, this.stablePointTarget - points)
    while (this.sparePoints.length < needPoints) {
      const spare = new THREE.PointLight(0xffffff, 0, 1, 2)
      spare.name = 'sceneLightSparePoint'
      spare.castShadow = false
      spare.userData.kind = 'sceneLightSpare'
      this.root.add(spare)
      this.sparePoints.push(spare)
    }
    this.sparePoints.forEach((spare, index) => {
      spare.visible = index < needPoints
      spare.intensity = 0
    })

    const needSpots = Math.max(0, this.stableSpotTarget - spots)
    while (this.spareSpots.length < needSpots) {
      const spare = new THREE.SpotLight(0xffffff, 0, 1, 0.1, 0, 2)
      spare.name = 'sceneLightSpareSpot'
      spare.castShadow = false
      spare.userData.kind = 'sceneLightSpare'
      spare.target.position.set(0, -1, 0)
      this.root.add(spare, spare.target)
      this.spareSpots.push(spare)
    }
    this.spareSpots.forEach((spare, index) => {
      spare.visible = index < needSpots
      spare.intensity = 0
    })
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
    for (const spare of this.sparePoints) {
      this.root.remove(spare)
      spare.dispose()
    }
    for (const spare of this.spareSpots) {
      this.root.remove(spare, spare.target)
      spare.dispose()
    }
    this.sparePoints.length = 0
    this.spareSpots.length = 0
    this.stablePointTarget = 0
    this.stableSpotTarget = 0
  }

  /** Geometrie-/Sonnen-Bake: alle Bibliotheks-Licht-Shadows neu. */
  markAllShadowsDirty(): void {
    for (const entry of this.entries.values()) {
      for (const light of [entry.point, entry.spotDown, entry.spotUp]) {
        if (light.castShadow) light.shadow.needsUpdate = true
      }
    }
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
    const editRing = createLightEditRing(MARKER_RADIUS_CM * 2.4)
    root.add(
      point,
      spotDown,
      spotDown.target,
      spotUp,
      spotUp.target,
      marker,
      bloomCore,
      solidMarker,
      editRing,
    )

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
      editRing,
      pick,
      beamMode: 'omni',
      baseWatts: 0,
      animation: 'none',
      phaseOffsetMs: 0,
      enabled: true,
      fadeFactor: 1,
      fadeInMs: DEFAULT_SCENE_LIGHT_FADE_IN_MS,
      fadeOutMs: DEFAULT_SCENE_LIGHT_FADE_OUT_MS,
      colorHex: '#ffffff',
      selected: false,
      markerRadiusCm: 0,
      markersGloballyOn: true,
      showMarker: true,
      bloomActive: false,
      roomOcclusion: false,
      keepCounted: false,
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
      if (entry.animation === 'none' || entry.fadeFactor < 0.001) continue
      any = true
      this.applyAnimatedIntensity(entry, timeMs)
    }
    return any
  }

  /** Fade Richtung enabled-Ziel. @returns true wenn noch unterwegs. */
  tickFades(dtMs: number, timeMs = performance.now()): boolean {
    let any = false
    for (const entry of this.entries.values()) {
      const target = entry.enabled ? 1 : 0
      if (Math.abs(entry.fadeFactor - target) < 1e-4) {
        entry.fadeFactor = target
        continue
      }
      any = true
      const dur = target > entry.fadeFactor ? entry.fadeInMs : entry.fadeOutMs
      const step = dur <= 0 ? 1 : Math.min(1, Math.max(0, dtMs) / dur)
      entry.fadeFactor =
        target > entry.fadeFactor
          ? Math.min(1, entry.fadeFactor + step)
          : Math.max(0, entry.fadeFactor - step)
      this.applyAnimatedIntensity(entry, timeMs)
    }
    return any
  }

  /** Sofort auf enabled-Ziel springen (Licht-Modus mit pausierten Animationen). */
  snapFadesToEnabled(timeMs = performance.now()): void {
    for (const entry of this.entries.values()) {
      const target = entry.enabled ? 1 : 0
      if (Math.abs(entry.fadeFactor - target) < 1e-4) continue
      entry.fadeFactor = target
      this.applyAnimatedIntensity(entry, timeMs)
    }
  }

  private litFactor(entry: LightEntry, timeMs: number): number {
    const anim = sceneLightAnimationFactor(entry.animation, timeMs, entry.phaseOffsetMs)
    return entry.fadeFactor * anim
  }

  private applyAnimatedIntensity(entry: LightEntry, timeMs: number): void {
    const factor = this.litFactor(entry, timeMs)
    const usePoint = entry.beamMode === 'omni'
    const useDown = entry.beamMode === 'down' || entry.beamMode === 'upDown'
    const useUp = entry.beamMode === 'up' || entry.beamMode === 'upDown'
    const split = entry.beamMode === 'upDown' ? 0.5 : 1
    const inten = wattsToThreeIntensity(entry.baseWatts) * factor
    const active = factor > 0.001
    // Licht-Modus: inaktive Lichter bleiben sichtbar (Intensität 0) — Blinken ändert die
    // Lichtanzahl im Shader nicht, sonst Programmwechsel für alle Materialien pro Blitz.
    const counted = active || entry.keepCounted
    entry.point.visible = usePoint && counted
    entry.spotDown.visible = useDown && counted
    entry.spotUp.visible = useUp && counted
    entry.point.intensity = usePoint ? inten : 0
    entry.spotDown.intensity = useDown ? inten * split : 0
    entry.spotUp.intensity = useUp ? inten * split : 0

    this.syncEditorMarkers(entry, {
      active,
      factor,
      watts: entry.baseWatts * factor,
      selected: entry.selected,
      colorHex: entry.colorHex,
      markerRadiusCm: entry.markerRadiusCm,
      markersGloballyOn: entry.markersGloballyOn,
      showMarker: entry.showMarker,
      roomOcclusion: entry.roomOcclusion,
      bloomActive: entry.bloomActive,
    })
  }

  /**
   * Licht-Modus (`markersGloballyOn`): Kreismarke + sichtbare Position für **alle** Lichter,
   * unabhängig von Tag/Nacht / Fade / Blink. Glühen/Bloom nur wenn das Licht wirklich leuchtet.
   */
  private syncEditorMarkers(
    entry: LightEntry,
    opts: {
      active: boolean
      factor: number
      watts: number
      selected: boolean
      colorHex: string
      markerRadiusCm: number
      markersGloballyOn: boolean
      showMarker: boolean
      roomOcclusion: boolean
      bloomActive: boolean
    },
  ): void {
    const editOn =
      opts.markersGloballyOn && opts.showMarker && opts.markerRadiusCm > 0
    const litMarkerOn = editOn && opts.active
    const markerDiameter = litMarkerOn ? opts.markerRadiusCm * 2 : 0
    const glowBrightness = markerGlowBrightness(opts.watts, opts.selected)

    // Editor-Kreis: immer im Licht-Modus, auch tagsüber wenn das Licht aus ist.
    updateLightEditRing(
      entry.editRing,
      opts.colorHex,
      editOn ? opts.markerRadiusCm * 2.4 : 0,
      opts.selected,
    )
    entry.editRing.userData.sceneLightId = entry.root.userData.sceneLightId

    // Kleine Positions-Kugel im Licht-Modus immer sichtbar (auch ohne Beleuchtung).
    updateLightSolidMarker(
      entry.solidMarker,
      opts.colorHex,
      editOn || (opts.roomOcclusion && litMarkerOn && opts.factor > BLAULICHT_VISIBLE_MARKER_FACTOR),
      opts.selected,
    )
    if (editOn && !opts.active) {
      // Ausgeschaltetes Licht: gedimmte Kugel, Ring bleibt die Hauptmarke.
      entry.solidMarker.scale.setScalar(opts.selected ? 10 : 6)
      const mat = entry.solidMarker.material as THREE.MeshBasicMaterial
      mat.color.set(opts.selected ? '#ff8800' : opts.colorHex)
      mat.color.multiplyScalar(0.55)
    }

    updateLightGlowSprite(
      entry.marker,
      opts.colorHex,
      opts.roomOcclusion ? 0 : markerDiameter,
      glowBrightness,
    )
    const bloomCoreDiameter = opts.roomOcclusion
      ? litMarkerOn
        ? Math.max(8, opts.markerRadiusCm * 0.55)
        : 0
      : markerDiameter
    const bloomCoreVisible =
      opts.markersGloballyOn &&
      opts.showMarker &&
      opts.active &&
      bloomCoreDiameter > 0 &&
      opts.factor > BLAULICHT_VISIBLE_MARKER_FACTOR
    updateLightBloomCore(
      entry.bloomCore,
      opts.colorHex,
      bloomCoreDiameter,
      opts.watts,
      opts.bloomActive,
      bloomCoreVisible,
    )

    const pickScale =
      (editOn ? Math.max(opts.markerRadiusCm * 1.6, 48) : 48) / PICK_RADIUS_CM
    entry.pick.scale.setScalar(opts.selected ? pickScale * 1.15 : pickScale)
    entry.pick.visible = true
  }

  private applySpec(entry: LightEntry, spec: SceneLight, options: SceneLightRuntimeSyncOptions): void {
    const beamMode = normalizeBeamMode(spec.beamMode)
    entry.beamMode = beamMode
    entry.baseWatts = spec.intensity
    entry.animation = normalizeSceneLightAnimation(spec.animation)
    entry.enabled = spec.enabled !== false
    entry.fadeInMs =
      typeof spec.fadeInMs === 'number' && Number.isFinite(spec.fadeInMs)
        ? Math.min(60000, Math.max(0, Math.round(spec.fadeInMs)))
        : DEFAULT_SCENE_LIGHT_FADE_IN_MS
    entry.fadeOutMs =
      typeof spec.fadeOutMs === 'number' && Number.isFinite(spec.fadeOutMs)
        ? Math.min(60000, Math.max(0, Math.round(spec.fadeOutMs)))
        : DEFAULT_SCENE_LIGHT_FADE_OUT_MS
    entry.colorHex = spec.color
    entry.root.userData.sceneLightId = spec.id
    entry.point.userData.sceneLightId = spec.id
    entry.spotDown.userData.sceneLightId = spec.id
    entry.spotUp.userData.sceneLightId = spec.id
    entry.marker.userData.sceneLightId = spec.id
    entry.bloomCore.userData.sceneLightId = spec.id
    entry.solidMarker.userData.sceneLightId = spec.id
    entry.editRing.userData.sceneLightId = spec.id
    entry.pick.userData.sceneLightId = spec.id

    const moved =
      entry.root.position.x !== spec.x ||
      entry.root.position.y !== spec.y ||
      entry.root.position.z !== spec.z
    entry.root.position.set(spec.x, spec.y, spec.z)
    entry.pick.position.set(spec.x, spec.y, spec.z)

    const color = new THREE.Color(spec.color)
    const timeMs = options.timeMs ?? performance.now()
    const animFactor = sceneLightAnimationFactor(entry.animation, timeMs, entry.phaseOffsetMs)
    const litFactor = entry.fadeFactor * animFactor
    const active = litFactor > 0.001
    const inten = wattsToThreeIntensity(spec.intensity) * litFactor
    const distance = spec.distance ?? 0
    const decay = spec.decay ?? 2
    const cast = entry.enabled && spec.castShadow !== false && options.roomOcclusion !== false
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

    entry.keepCounted = options.stableLightCount === true
    const counted = active || entry.keepCounted
    entry.point.visible = usePoint && counted
    entry.spotDown.visible = useDown && counted
    entry.spotUp.visible = useUp && counted

    this.syncPoint(entry.point, {
      color,
      intensity: usePoint ? inten : 0,
      distance,
      decay,
      cast: cast && usePoint,
      mapSize,
      shadowFar,
      softRadius,
      dirty: moved,
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
      dirty: moved,
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
      dirty: moved,
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

    this.syncEditorMarkers(entry, {
      active,
      factor: litFactor,
      watts: spec.intensity * litFactor,
      selected,
      colorHex: spec.color,
      markerRadiusCm: markerRadius,
      markersGloballyOn,
      showMarker: spec.showMarker !== false,
      roomOcclusion: entry.roomOcclusion,
      bloomActive: options.bloomActive === true,
    })
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
      dirty?: boolean
    },
  ): void {
    light.color.copy(opts.color)
    light.intensity = opts.intensity
    light.distance = opts.distance
    light.decay = opts.decay
    light.castShadow = opts.cast
    light.shadow.radius = opts.softRadius
    let mapOrFarChanged = false
    if (light.shadow.mapSize.x !== opts.mapSize) {
      light.shadow.mapSize.setScalar(opts.mapSize)
      if (light.shadow.map) {
        light.shadow.map.dispose()
        light.shadow.map = null
      }
      mapOrFarChanged = true
    }
    if (light.shadow.camera.far !== opts.shadowFar) {
      light.shadow.camera.far = opts.shadowFar
      light.shadow.camera.updateProjectionMatrix()
      mapOrFarChanged = true
    }
    // Kein Re-Bake nur weil cast wieder an — bestehende Map bleibt gültig (Dämmerung/Tageszyklus).
    if (opts.cast && (opts.dirty || mapOrFarChanged || !light.shadow.map)) {
      light.shadow.needsUpdate = true
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
      dirty?: boolean
    },
  ): void {
    light.color.copy(opts.color)
    light.intensity = opts.intensity
    light.distance = opts.distance
    light.decay = opts.decay
    const nextAngle = Math.min(Math.PI / 2 - 0.01, Math.max(0.05, opts.angle))
    const angleChanged = Math.abs(light.angle - nextAngle) > 1e-5
    light.angle = nextAngle
    light.penumbra = SPOT_PENUMBRA
    light.castShadow = opts.cast
    light.shadow.radius = opts.softRadius
    let mapOrFarChanged = false
    if (light.shadow.mapSize.x !== opts.mapSize) {
      light.shadow.mapSize.setScalar(opts.mapSize)
      if (light.shadow.map) {
        light.shadow.map.dispose()
        light.shadow.map = null
      }
      mapOrFarChanged = true
    }
    if (light.shadow.camera.far !== opts.shadowFar) {
      light.shadow.camera.far = opts.shadowFar
      light.shadow.camera.updateProjectionMatrix()
      mapOrFarChanged = true
    }
    // Kein Re-Bake nur weil cast wieder an — bestehende Map bleibt gültig (Dämmerung/Tageszyklus).
    if (
      opts.cast &&
      (opts.dirty || mapOrFarChanged || angleChanged || !light.shadow.map)
    ) {
      light.shadow.needsUpdate = true
    }
  }

  private disposeEntry(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    this.root.remove(entry.root, entry.pick)
    disposeLightGlowSprite(entry.marker)
    disposeLightBloomCore(entry.bloomCore)
    disposeLightSolidMarker(entry.solidMarker)
    disposeLightEditRing(entry.editRing)
    entry.pick.geometry.dispose()
    ;(entry.pick.material as THREE.Material).dispose()
    entry.point.dispose()
    entry.spotDown.dispose()
    entry.spotUp.dispose()
    this.entries.delete(id)
  }
}
