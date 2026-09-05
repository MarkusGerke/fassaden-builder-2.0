/**
 * Mehrschichtige Außen-Lichtstimmung: Key (Sonne/Mond), Himmel, Bodenreflex.
 * Wird aus Sonnen-Slidern + Himmelszustand abgeleitet — keine extra UI.
 */
import * as THREE from 'three'
import type { CelestialState } from './celestialSky'
import { directionFromSolar } from './celestialSky'
import type { SunSettings } from './sunLighting'
import { kelvinToColor, shadowRadiusFromSoftness } from './sunLighting'
import type { SkyPalette } from './celestialSky'

export interface LightingMood {
  /** Key-Light (Sonne/Mond) — Intensität/Farbe aus CelestialState; Schattenweichheit (0,5…8) für PCSS. */
  keyShadowSoftness: number
  keyCastShadow: boolean
  /** Himmel-Fill-Intensität (Hemisphere + SkyLightProbe). */
  skyIntensity: number
  /** Himmel-Fill (Hemisphere) — obere Hemi-Farbe. */
  hemiSkyColor: THREE.Color
  skyColor: THREE.Color
  groundHemiColor: THREE.Color
  /**
   * Indirektes Bodenlicht (Faktor auf Nutzer-Albedo): Sonnenfarbe + Ambient,
   * ohne Himmelsblau (das würde die Platte fluten).
   */
  groundAmbientColor: THREE.Color
  /** Umbra-Stärke auf dem Boden (0…1, aus shadowDensity). */
  shadowUmbraStrength: number
  /** Bodenreflex-Richtung (Einheitsvektor zur Lichtquelle). */
  bounceDirection: THREE.Vector3
  bounceIntensity: number
  bounceColor: THREE.Color
  /** PCSS-ähnliche Weichheit am Boden (0 = aus, 1 = voll). */
  groundShadowSoftness: number
}

const _bounceDir = new THREE.Vector3()

/** Bounce: gegenüber der Sonne, flach vom Boden — typisches Archviz-Fill. */
export function bounceDirectionFromKey(
  lightAzimuthDeg: number,
  _lightElevationRad: number,
  out = _bounceDir,
): THREE.Vector3 {
  const bounceAz = (lightAzimuthDeg + 180) % 360
  const bounceElev = THREE.MathUtils.degToRad(24)
  return directionFromSolar(bounceAz, bounceElev, out)
}

export function resolveLightingMood(
  settings: SunSettings,
  celestial: CelestialState,
  palette: SkyPalette,
  sceneGroundHex: string,
): LightingMood {
  const contrast = Math.max(0.5, settings.shadowContrast)
  const density = THREE.MathUtils.clamp(settings.shadowDensity, 0, 1)
  const ambientNorm = THREE.MathUtils.clamp(settings.ambient / 0.65, 0.25, 1.4)
  const twilight = celestial.twilightFactor
  const isDay = celestial.activeLight === 'sun'
  const isMoon = celestial.activeLight === 'moon'
  const isDeepNight = celestial.activeLight === 'night'

  let skyIntensity = Math.max(
    0.008,
    (settings.ambient / contrast) * celestial.skyAmbientFactor,
  )
  if (isDeepNight) skyIntensity = Math.min(skyIntensity, 0.014)
  else if (isMoon) skyIntensity = Math.min(skyIntensity, 0.042)

  const groundUser = new THREE.Color(sceneGroundHex)
  const sunTint = kelvinToColor(celestial.lightColorTemp)
  const lowSunWarm =
    celestial.sun.elevationRad > 0
      ? THREE.MathUtils.smoothstep(
          celestial.sun.elevationRad,
          THREE.MathUtils.degToRad(14),
          THREE.MathUtils.degToRad(0.5),
        )
      : 0
  const sunWarmMix = THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(0.18, 0.52, twilight) + lowSunWarm * 0.38,
    0.12,
    0.72,
  )

  let hemiSky: THREE.Color
  let groundHemi: THREE.Color
  if (isDeepNight) {
    hemiSky = new THREE.Color('#04060e')
    groundHemi = new THREE.Color('#020308')
  } else if (isMoon) {
    hemiSky = new THREE.Color('#071018')
    hemiSky.lerp(sunTint, 0.22)
    hemiSky.lerp(new THREE.Color('#6a8cff'), 0.18)
    groundHemi = groundUser.clone().multiplyScalar(0.06)
    groundHemi.lerp(new THREE.Color('#0a1020'), 0.55)
  } else {
    hemiSky = palette.horizon.clone()
    hemiSky.lerp(sunTint, sunWarmMix)
    hemiSky.lerp(groundUser, THREE.MathUtils.lerp(0.28, 0.42, 1 - twilight * 0.65))
    groundHemi = groundUser.clone()
    groundHemi.multiplyScalar(THREE.MathUtils.lerp(0.92, 0.38, density))
  }

  const groundAmbient = sunTint.clone()
  if (isDeepNight) {
    groundAmbient.set('#000000')
  } else if (isMoon) {
    groundAmbient.multiplyScalar(0.04 + 0.06 * celestial.moonIllumination)
    groundAmbient.lerp(new THREE.Color('#88a0ff'), 0.35)
  } else {
    groundAmbient.multiplyScalar(
      THREE.MathUtils.lerp(0.16, 0.42, ambientNorm) * (1 - twilight * 0.62) + (isDay ? 0 : 0.04),
    )
    groundAmbient.lerp(sunTint, lowSunWarm * 0.35)
  }

  const bounceDir = bounceDirectionFromKey(celestial.lightAzimuthDeg, celestial.lightElevationRad)
  const bounceColor = new THREE.Color(sceneGroundHex)
  if (isMoon) bounceColor.lerp(new THREE.Color('#a8c0ff'), 0.4)
  else bounceColor.lerp(kelvinToColor(settings.colorTemperature), 0.35)

  let bounceIntensity = 0
  if (isDay) {
    bounceIntensity =
      celestial.lightIntensity *
      THREE.MathUtils.lerp(0.08, 0.18, ambientNorm) *
      (1 - twilight * 0.85)
  } else if (isMoon) {
    bounceIntensity = celestial.lightIntensity * 0.04
  }

  const groundShadowSoftness = THREE.MathUtils.clamp(
    shadowRadiusFromSoftness(settings.shadowSoftness) / 8,
    0.15,
    1,
  )

  const keyCastShadow =
    (celestial.activeLight === 'sun' && celestial.sun.elevationRad > 0.04) ||
    (celestial.activeLight === 'moon' &&
      celestial.moon.elevationRad > 0.06 &&
      celestial.moonIllumination > 0.12)

  return {
    keyShadowSoftness: shadowRadiusFromSoftness(settings.shadowSoftness),
    keyCastShadow,
    skyIntensity,
    hemiSkyColor: hemiSky,
    skyColor: palette.horizon.clone(),
    groundHemiColor: groundHemi,
    groundAmbientColor: groundAmbient,
    // Schatten-Kontrast wirkt auch auf Boden-Umbra (Neutral sonst zu blass bei Max).
    shadowUmbraStrength: THREE.MathUtils.clamp(
      THREE.MathUtils.lerp(0.45, 0.92, density) *
        THREE.MathUtils.clamp(0.75 + 0.2 * settings.shadowContrast, 0.85, 1.75),
      0.35,
      0.99,
    ),
    bounceDirection: bounceDir.clone(),
    bounceIntensity,
    bounceColor,
    groundShadowSoftness,
  }
}
