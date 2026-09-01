/**
 * Zusätzliche Punktlichter (innen/außen) für Nachtszenen — angelehnt an
 * three.js webgl_shadowmap_pointlight (MIT).
 */
import * as THREE from 'three'
import { dayOfYearFromMonthDay, solarPosition } from '../utils/solar'
import type { SunSettings } from '../utils/sunLighting'
import { SHADOW_LAYER_EXTERIOR, SHADOW_LAYER_INTERIOR } from '../utils/sunLighting'
import {
  createLightGlowSprite,
  updateLightGlowSprite,
} from './lightGlowMarker'
import { markerGlowBrightness, wattsToThreeIntensity } from './sceneLightUnits'

const INDOOR_COLOR = 0xffaa66
const OUTDOOR_COLOR = 0x88ccff
const POINT_SHADOW_MAP = 512
const MARKER_RADIUS_CM = 22
const INDOOR_WATTS = 8
const OUTDOOR_WATTS = 12

export interface ScenePointLightBundle {
  indoor: THREE.PointLight
  outdoor: THREE.PointLight
  indoorMarker: THREE.Sprite
  outdoorMarker: THREE.Sprite
  root: THREE.Group
}

function createLightMarker(color: number): THREE.Sprite {
  const marker = createLightGlowSprite(MARKER_RADIUS_CM * 2)
  const mat = marker.material as THREE.SpriteMaterial
  mat.color.set(color)
  return marker
}

function createPointLightWithMarker(color: number, watts: number): {
  light: THREE.PointLight
  marker: THREE.Sprite
} {
  const light = new THREE.PointLight(color, wattsToThreeIntensity(watts), 0, 2)
  light.castShadow = true
  light.shadow.bias = -0.005
  light.shadow.mapSize.setScalar(POINT_SHADOW_MAP)
  light.shadow.radius = 10
  const marker = createLightMarker(color)
  light.add(marker)
  return { light, marker }
}

function syncMarkerGlow(marker: THREE.Sprite, color: number, watts: number): void {
  const hex = `#${color.toString(16).padStart(6, '0')}`
  updateLightGlowSprite(marker, hex, MARKER_RADIUS_CM * 2, markerGlowBrightness(watts))
}

export function createScenePointLights(): ScenePointLightBundle {
  const root = new THREE.Group()
  root.name = 'scenePointLights'

  const indoorPair = createPointLightWithMarker(INDOOR_COLOR, INDOOR_WATTS)
  const indoor = indoorPair.light
  indoor.name = 'indoorPointLight'
  indoor.layers.enable(SHADOW_LAYER_INTERIOR)
  indoor.layers.enable(SHADOW_LAYER_EXTERIOR)
  indoor.shadow.camera.layers.enable(SHADOW_LAYER_INTERIOR)
  indoor.shadow.camera.layers.enable(SHADOW_LAYER_EXTERIOR)

  const outdoorPair = createPointLightWithMarker(OUTDOOR_COLOR, OUTDOOR_WATTS)
  const outdoor = outdoorPair.light
  outdoor.name = 'outdoorPointLight'
  outdoor.layers.enable(SHADOW_LAYER_EXTERIOR)
  outdoor.shadow.camera.layers.enable(SHADOW_LAYER_EXTERIOR)

  root.add(indoor, outdoor)
  return {
    indoor,
    outdoor,
    indoorMarker: indoorPair.marker,
    outdoorMarker: outdoorPair.marker,
    root,
  }
}

export interface ScenePointLightUpdateOptions {
  /** 3D-Ansicht, nicht Entwurf. */
  enabled: boolean
  /** Orbit-Lite: Schatten der Punktlichter aus. */
  castShadow: boolean
  /** Editor-Kugeln (Bibliothek → Licht → Anzeige). */
  showMarkers?: boolean
}

const _center = new THREE.Vector3()
const _size = new THREE.Vector3()

/** Nacht-Faktor 0…1 aus Tageszeit (Solar-Elevation, nicht manueller elevationRad-Override). */
export function scenePointLightNightFactor(settings: SunSettings): number {
  const doy = dayOfYearFromMonthDay(settings.month, settings.day)
  const time = ((settings.timeOfDay % 24) + 24) % 24
  const elev = solarPosition(doy, time).elevationRad
  if (elev <= -0.02) return 1
  if (elev > 0.15) return 0.22
  return THREE.MathUtils.smoothstep(0.15, -0.05, elev)
}

export function updateScenePointLights(
  bundle: ScenePointLightBundle,
  buildingBox: THREE.Box3,
  sunSettings: SunSettings,
  options: ScenePointLightUpdateOptions,
): void {
  const { enabled, castShadow } = options
  bundle.root.visible = enabled
  if (!enabled || buildingBox.isEmpty()) {
    bundle.indoor.intensity = 0
    bundle.outdoor.intensity = 0
    bundle.indoor.castShadow = false
    bundle.outdoor.castShadow = false
    bundle.indoorMarker.visible = false
    bundle.outdoorMarker.visible = false
    return
  }

  buildingBox.getCenter(_center)
  buildingBox.getSize(_size)
  const night = scenePointLightNightFactor(sunSettings)
  const nightBoost = THREE.MathUtils.lerp(0.35, 1, night)

  bundle.indoor.intensity = wattsToThreeIntensity(INDOOR_WATTS * nightBoost)
  bundle.outdoor.intensity = wattsToThreeIntensity(OUTDOOR_WATTS * nightBoost)
  syncMarkerGlow(bundle.indoorMarker, INDOOR_COLOR, INDOOR_WATTS * nightBoost)
  syncMarkerGlow(bundle.outdoorMarker, OUTDOOR_COLOR, OUTDOOR_WATTS * nightBoost)
  const showMarkers = options.showMarkers !== false
  bundle.indoorMarker.visible = showMarkers
  bundle.outdoorMarker.visible = showMarkers

  const floorY = Math.max(buildingBox.min.y + 18, 120)
  const indoorY = floorY + Math.min(_size.y * 0.42, 220)
  bundle.indoor.position.set(_center.x, indoorY, _center.z)

  const porchY = floorY + Math.min(240, _size.y * 0.38)
  bundle.outdoor.position.set(
    _center.x,
    porchY,
    buildingBox.max.z + Math.max(100, _size.z * 0.12 + 80),
  )

  const shadows = castShadow && night > 0.25
  bundle.indoor.castShadow = shadows
  bundle.outdoor.castShadow = shadows
}
