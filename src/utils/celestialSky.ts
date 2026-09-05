/**
 * Sichtbarer Himmel (Dom) + Sonne/Mond-Logik für Beleuchtung.
 * Sonnenstand: `solar.ts` (NOAA-Näherung). Mond: ~12 h Versatz + einfache Phase.
 */
import * as THREE from 'three'
import {
  dayOfYearFromMonthDay,
  solarDayBounds,
  solarPosition,
  type SolarPosition,
} from './solar'
import type { SunSettings } from './sunLighting'
import { expandBoxByGroundShadow, kelvinToColor, SHADOW_GROUND_Y } from './sunLighting'

export const SKY_DOME_RADIUS = 6400

export interface CelestialState {
  sun: SolarPosition
  moon: SolarPosition
  /** 0…1, wie hell der Mond scheint (Phasen-Näherung). */
  moonIllumination: number
  /** Welche Lichtquelle die DirectionalLight steuert. */
  activeLight: 'sun' | 'moon' | 'night'
  sunAboveHorizon: boolean
  moonAboveHorizon: boolean
  /** Für DirectionalLight (Azimut CW 0=N). */
  lightAzimuthDeg: number
  lightElevationRad: number
  lightIntensity: number
  lightColorTemp: number
  /** Hemisphere-Multiplikator 0…1. */
  skyAmbientFactor: number
  twilightFactor: number
}

export interface SkyPalette {
  zenith: THREE.Color
  horizon: THREE.Color
  ground: THREE.Color
}

/** Mond gegenüber der Sonne (~12 h), ausreichend für Fassaden-Vorschau. */
export function moonPosition(
  dayOfYear: number,
  timeHours: number,
  latDeg?: number,
  lonDeg?: number,
): SolarPosition {
  return solarPosition(dayOfYear, timeHours + 12, latDeg, lonDeg)
}

/** Einfache Mondphase 0…1 (1 = Vollmond). */
export function moonIlluminationFraction(month: number, day: number, dayOfYear: number): number {
  const cycle = 29.53
  const phase = ((dayOfYear + day * 0.7 + month * 2.1) % cycle) / cycle
  const illum = Math.sin(phase * Math.PI)
  return THREE.MathUtils.clamp(illum, 0.06, 1)
}

export function directionFromSolar(azimuthDeg: number, elevationRad: number, out = new THREE.Vector3()): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azimuthDeg)
  const cosElev = Math.cos(elevationRad)
  return out.set(Math.sin(az) * cosElev, Math.sin(elevationRad), -Math.cos(az) * cosElev)
}

function twilightFromSunElevation(elevationRad: number): number {
  const elevDeg = (elevationRad * 180) / Math.PI
  if (elevDeg >= 6) return 0
  if (elevDeg <= -12) return 1
  return THREE.MathUtils.smoothstep(elevDeg, 6, -12)
}

function sunLightIntensity(elevationRad: number, userIntensity: number): number {
  if (elevationRad <= 0) return 0
  const t = Math.min(1, elevationRad / (Math.PI / 2))
  const base = 0.6 + 2.4 * t
  return base * THREE.MathUtils.clamp(userIntensity / 2.4, 0.15, 3.5)
}

function moonLightIntensity(elevationRad: number, illumination: number, userIntensity: number): number {
  if (elevationRad <= 0) return 0
  const t = Math.min(1, elevationRad / (Math.PI / 4))
  // Sichtbar, aber deutlich unter Tageslicht — Key für blaue Mondschatten.
  const base = 0.07 + 0.26 * t * illumination
  return base * THREE.MathUtils.clamp(userIntensity / 2.4, 0.2, 2)
}

/** Kelvin für kühles Mondlicht (klar, bläulich). */
export const MOONLIGHT_COLOR_TEMP = 8200

export function resolveCelestialState(settings: SunSettings): CelestialState {
  const doy = dayOfYearFromMonthDay(settings.month, settings.day)
  const time = ((settings.timeOfDay % 24) + 24) % 24
  const solar = solarPosition(doy, time)
  const moon = moonPosition(doy, time)
  const moonIllumination = moonIlluminationFraction(settings.month, settings.day, doy)
  const azimuthDeg = Number.isFinite(settings.azimuth)
    ? ((settings.azimuth % 360) + 360) % 360
    : solar.azimuthDeg
  const elevationRad = Number.isFinite(settings.elevationRad) ? settings.elevationRad : solar.elevationRad
  const sun: SolarPosition = { azimuthDeg, elevationRad }
  const sunAboveHorizon = sun.elevationRad > -0.02
  const moonAboveHorizon = moon.elevationRad > 0.02
  const twilightFactor = twilightFromSunElevation(sun.elevationRad)

  let activeLight: CelestialState['activeLight'] = 'night'
  let lightAzimuthDeg = sun.azimuthDeg
  let lightElevationRad = Math.max(0, sun.elevationRad)
  let lightIntensity = 0
  let lightColorTemp = MOONLIGHT_COLOR_TEMP

  if (sun.elevationRad > 0) {
    activeLight = 'sun'
    lightAzimuthDeg = sun.azimuthDeg
    lightElevationRad = sun.elevationRad
    lightIntensity = sunLightIntensity(sun.elevationRad, settings.intensity)
    lightColorTemp = settings.colorTemperature
  } else if (moon.elevationRad > 0 && moonIllumination > 0.08) {
    activeLight = 'moon'
    lightAzimuthDeg = moon.azimuthDeg
    lightElevationRad = moon.elevationRad
    lightIntensity = moonLightIntensity(moon.elevationRad, moonIllumination, settings.intensity)
    lightColorTemp = MOONLIGHT_COLOR_TEMP
  } else {
    // Sternennacht: kein Key-Licht — nur minimales Ambient (in lightingMood).
    lightIntensity = 0
    lightColorTemp = MOONLIGHT_COLOR_TEMP
    if (moon.elevationRad > -0.15) {
      lightAzimuthDeg = moon.azimuthDeg
      lightElevationRad = Math.max(0.02, moon.elevationRad + 0.08)
    }
  }

  let skyAmbientFactor: number
  if (sun.elevationRad > 0) {
    skyAmbientFactor = THREE.MathUtils.lerp(
      THREE.MathUtils.clamp(settings.ambient / 0.32, 0.2, 2),
      0.12 + 0.25 * moonIllumination,
      twilightFactor,
    )
  } else if (activeLight === 'moon') {
    // Schwaches kühles Himmelsfill — Mond-Key und Schatten bleiben lesbar.
    skyAmbientFactor = 0.028 + 0.035 * moonIllumination
  } else {
    // Fast schwarz ohne Lichtquelle (kein Mittelgrau durch Ambient).
    skyAmbientFactor = 0.01
  }

  return {
    sun,
    moon,
    moonIllumination,
    activeLight,
    sunAboveHorizon,
    moonAboveHorizon,
    lightAzimuthDeg,
    lightElevationRad,
    lightIntensity,
    lightColorTemp,
    skyAmbientFactor,
    twilightFactor,
  }
}

/** EnvMap-Stärke für Paneel/Glas: Tag voll, Mond gedämpft, Sternennacht fast aus. */
export function exteriorEnvFillFromCelestial(celestial: CelestialState): number {
  if (celestial.activeLight === 'night') return 0.05
  if (celestial.activeLight === 'moon') return 0.22 + 0.18 * celestial.moonIllumination
  return THREE.MathUtils.lerp(1, 0.42, celestial.twilightFactor)
}

/** Himmelsfarben: Nutzer-Szenenfarben bleiben die Basis, Nacht dunkelt sie nur ab. */
export function skyPaletteFromCelestial(
  celestial: CelestialState,
  sceneSkyHex: string,
  sceneGroundHex: string,
  sceneBackgroundHex = sceneSkyHex,
): SkyPalette {
  const userZenith = new THREE.Color(sceneSkyHex)
  const userGround = new THREE.Color(sceneGroundHex)
  const userBg = new THREE.Color(sceneBackgroundHex)
  const t = celestial.twilightFactor
  const dayZenith = userZenith.clone()
  const nightZenith = userZenith.clone().multiplyScalar(0.16).lerp(new THREE.Color('#070b18'), 0.28)
  const dayHorizon = userBg.clone().lerp(userZenith, 0.32).lerp(userGround, 0.1)
  const twilightHorizon = userBg.clone().lerp(new THREE.Color('#ff8c5a'), 0.42)
  const nightHorizon = userBg.clone().multiplyScalar(0.14).lerp(new THREE.Color('#0c1428'), 0.35)
  const zenith = dayZenith.lerp(nightZenith, t)
  const horizon = dayHorizon
    .clone()
    .lerp(twilightHorizon, Math.min(1, t * 1.2))
    .lerp(nightHorizon, t)
  const ground = userGround.clone().lerp(userGround.clone().multiplyScalar(0.22), t * 0.75)
  return { zenith, horizon, ground }
}

const skyVertexShader = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(world.xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const skyFragmentShader = /* glsl */ `
uniform vec3 uZenithColor;
uniform vec3 uHorizonColor;
uniform vec3 uGroundColor;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uSunVisible;
uniform float uMoonVisible;
uniform float uMoonIllum;
uniform float uStars;
varying vec3 vWorldDir;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float h = clamp(dir.y, -1.0, 1.0);
  vec3 sky = mix(uHorizonColor, uZenithColor, pow(max(h, 0.0), 0.65));
  if (h < 0.0) {
    sky = mix(uHorizonColor, uGroundColor, clamp(-h, 0.0, 1.0));
  }

  float sunDot = max(0.0, dot(dir, uSunDir));
  float sunDisc = smoothstep(0.9993, 0.99985, sunDot) * uSunVisible;
  sky += vec3(1.0, 0.92, 0.72) * sunDisc * 3.5;

  float moonDot = max(0.0, dot(dir, uMoonDir));
  float moonDisc = smoothstep(0.99955, 0.9999, moonDot) * uMoonVisible;
  sky += vec3(0.85, 0.88, 0.95) * moonDisc * (1.2 + uMoonIllum);

  if (uStars > 0.01) {
    float star = step(0.9975, hash(floor(dir * 180.0)));
    sky += vec3(0.9, 0.92, 1.0) * star * uStars * max(h, 0.0);
  }

  gl_FragColor = vec4(sky, 1.0);
}
`

/** Großer Himmelsdom mit Sonne, Mond und Sternen. */
const _camWorld = new THREE.Vector3()

export class CelestialSky {
  readonly root = new THREE.Group()
  private readonly dome: THREE.Mesh
  private readonly uniforms: Record<string, THREE.IUniform>

  constructor() {
    const geo = new THREE.SphereGeometry(SKY_DOME_RADIUS, 48, 32)
    this.uniforms = {
      uZenithColor: { value: new THREE.Color('#3a6084') },
      uHorizonColor: { value: new THREE.Color('#8ab0d0') },
      uGroundColor: { value: new THREE.Color('#3a3a3a') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunVisible: { value: 1 },
      uMoonVisible: { value: 0 },
      uMoonIllum: { value: 1 },
      uStars: { value: 0 },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
    this.dome = new THREE.Mesh(geo, mat)
    this.dome.frustumCulled = false
    this.dome.renderOrder = -1000
    this.root.add(this.dome)
  }

  /** Dom um die Kamera, Radius innerhalb der Far-Plane — sonst wird der Himmel schwarz weggeclippt. */
  fitToCamera(camera: THREE.Camera) {
    const far = 'far' in camera && typeof (camera as { far: number }).far === 'number'
      ? (camera as THREE.PerspectiveCamera).far
      : SKY_DOME_RADIUS
    const radius = Math.max(80, Math.min(SKY_DOME_RADIUS, far * 0.88))
    this.dome.scale.setScalar(radius / SKY_DOME_RADIUS)
    camera.getWorldPosition(_camWorld)
    this.root.position.copy(_camWorld)
  }

  /** Dom zentrieren (typisch Kamera-XZ + Gebäude-Y). */
  placeAt(x: number, y: number, z: number) {
    this.root.position.set(x, y, z)
  }

  update(celestial: CelestialState, palette: SkyPalette) {
    ;(this.uniforms.uZenithColor.value as THREE.Color).copy(palette.zenith)
    ;(this.uniforms.uHorizonColor.value as THREE.Color).copy(palette.horizon)
    ;(this.uniforms.uGroundColor.value as THREE.Color).copy(palette.ground)
    directionFromSolar(celestial.sun.azimuthDeg, celestial.sun.elevationRad, this.uniforms.uSunDir.value as THREE.Vector3)
    directionFromSolar(celestial.moon.azimuthDeg, celestial.moon.elevationRad, this.uniforms.uMoonDir.value as THREE.Vector3)
    this.uniforms.uSunVisible.value = celestial.sunAboveHorizon ? 1 : 0
    this.uniforms.uMoonVisible.value = celestial.moonAboveHorizon ? celestial.moonIllumination : 0
    this.uniforms.uMoonIllum.value = celestial.moonIllumination
    this.uniforms.uStars.value = celestial.twilightFactor > 0.55 ? (celestial.twilightFactor - 0.55) * 2.2 : 0
  }

  setVisible(visible: boolean) {
    this.root.visible = visible
  }

  dispose() {
    this.dome.geometry.dispose()
    ;(this.dome.material as THREE.Material).dispose()
  }
}

export function prepareCelestialShadowBox(
  buildingBox: THREE.Box3,
  celestial: CelestialState,
  groundY = SHADOW_GROUND_Y,
): THREE.Box3 {
  const ray = directionFromSolar(celestial.lightAzimuthDeg, celestial.lightElevationRad).multiplyScalar(-1)
  return expandBoxByGroundShadow(buildingBox, ray, groundY)
}

/** DirectionalLight aus dem aktiven Himmelskörper. */
export function applyCelestialDirectionalLight(
  celestial: CelestialState,
  dirLight: THREE.DirectionalLight,
  target: THREE.Vector3,
  distance: number,
): void {
  const dist = Math.max(900, distance)
  const dir = directionFromSolar(celestial.lightAzimuthDeg, celestial.lightElevationRad)
  dirLight.position.set(target.x + dir.x * dist, target.y + dir.y * dist, target.z + dir.z * dist)
  dirLight.target.position.copy(target)
  dirLight.target.updateMatrixWorld()
  dirLight.intensity = celestial.lightIntensity
  dirLight.color.copy(kelvinToColor(celestial.lightColorTemp))
  dirLight.visible = true
  const castShadow =
    (celestial.activeLight === 'sun' && celestial.sun.elevationRad > 0.04) ||
    (celestial.activeLight === 'moon' &&
      celestial.moon.elevationRad > 0.06 &&
      celestial.moonIllumination > 0.12)
  dirLight.castShadow = castShadow
}

export function fullDayTimeRange(_settings: SunSettings): { min: number; max: number } {
  return { min: 0, max: 23 + 59 / 60 }
}
