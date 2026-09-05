import * as THREE from 'three'
import type { Wall } from '../types/facade'
import { isStudioWall, studioFacadeOutwardDepth, studioWallTransform } from '../studio/walls'
import {
  colorTempFromElevation,
  dayOfYearFromMonthDay,
  solarDayBounds,
  solarPosition,
  timeWhenSunAzimuth,
  todayMonthDay,
} from './solar'

export interface SunSettings {
  /** Anzeige / manuell: Solar-Azimut (0=N, 90=O, CW). */
  azimuth: number
  /** Sonnenhöhe in Radiant (negativ = unter Horizont). Manuell beibehalten, bis Datum/Uhrzeit neu setzt. */
  elevationRad: number
  timeOfDay: number
  intensity: number
  shadowSoftness: number
  colorTemperature: number
  /** Hemisphere-Intensität (Umgebungslicht). */
  ambient: number
  /** >1 dunkelt Schatten relativ zur Sonne ab. */
  shadowContrast: number
  /** 0…1: Hemisphere-Bodenfarbe dunkler (Schatten-Tiefe). */
  shadowDensity: number
  /** Monat 1–12 (Berlin-Sonnenverlauf). */
  month: number
  /** Tag im Monat 1–31. */
  day: number
  /** Animation über Uhrzeit (Sonnenstand). */
  animUseTime: boolean
  /** Animation über Himmelsrichtung (Kamera-Orbit). */
  animUseCompass: boolean
  /** Von-Uhrzeit als Dezimalstunden. */
  animFromTime: number
  /** Bis-Uhrzeit als Dezimalstunden. */
  animToTime: number
  /** Von-Azimut solar CW (0=N, 90=O), 45°-Raster. */
  animFromAzimuth: number
  /** Bis-Azimut solar CW. */
  animToAzimuth: number
  /** Abspieldauer in Sekunden (5…120). */
  animDurationSec: number
  /**
   * Kontinuierlicher Tageszyklus.
   * Unabhängig von manueller Uhrzeit-Steuerung.
   */
  dayCycleEnabled?: boolean
  /**
   * Echtzeit-Minuten für einen Szene-Tag (24 h). Default 60 (= 1 Stunde).
   * Bereich 1…1440.
   */
  dayCycleRealMinutes?: number
  /** Master-Pause: Blaulicht, Fenster/Tür-Animation, Tageszyklus. */
  animationsPaused?: boolean
  /** Bibliotheks-Lichter bei Sonnenuntergang an, bei Sonnenaufgang aus. */
  autoSceneLightsWithSun?: boolean
}

/** Alte Saves: ein gemeinsames Von/Bis plus exklusiver Modus. */
type LegacySunAnim = {
  animMode?: 'time' | 'compass'
  animFrom?: number
  animTo?: number
}

/** Schattenweichheit aus Sonnenhöhe: Mittag hart (0.5), Horizont weich (8). */
export function shadowSoftnessFromElevation(elevationRad: number): number {
  const elev = Math.max(0, elevationRad)
  const t = 1 - Math.min(1, elev / (Math.PI / 2))
  return 0.5 + 7.5 * t * t
}

/** Intensität aus Sonnenhöhe: Horizont schwächer, hoch am Himmel stärker. */
export function intensityFromElevation(elevationRad: number): number {
  const t = Math.min(1, Math.max(0, elevationRad) / (Math.PI / 2))
  return Math.round((1.0 + 2.5 * t) * 10) / 10
}

export const DEFAULT_SUN_TIME_OF_DAY = 13.25
export const DEFAULT_SUN_AZIMUTH = 210
export const DEFAULT_SUN_INTENSITY = 3.9
export const DEFAULT_SUN_SHADOW_SOFTNESS = 2.5
export const DEFAULT_SUN_COLOR_TEMP = 4500
export const DEFAULT_SUN_AMBIENT = 0.53
export const DEFAULT_SUN_SHADOW_CONTRAST = 1.4
export const DEFAULT_SUN_SHADOW_DENSITY = 0.55

const today = todayMonthDay()
/** Sonnenhöhe für Standard-Tageszeit (Berlin, heutiges Datum). */
export const DEFAULT_SUN_ELEVATION_RAD = solarPosition(
  dayOfYearFromMonthDay(today.month, today.day),
  DEFAULT_SUN_TIME_OF_DAY,
).elevationRad

export const DEFAULT_SUN_SETTINGS: SunSettings = {
  azimuth: DEFAULT_SUN_AZIMUTH,
  elevationRad: DEFAULT_SUN_ELEVATION_RAD,
  timeOfDay: DEFAULT_SUN_TIME_OF_DAY,
  intensity: DEFAULT_SUN_INTENSITY,
  shadowSoftness: DEFAULT_SUN_SHADOW_SOFTNESS,
  colorTemperature: DEFAULT_SUN_COLOR_TEMP,
  ambient: DEFAULT_SUN_AMBIENT,
  shadowContrast: DEFAULT_SUN_SHADOW_CONTRAST,
  shadowDensity: DEFAULT_SUN_SHADOW_DENSITY,
  month: today.month,
  day: today.day,
  animUseTime: false,
  animUseCompass: true,
  animFromTime: 6,
  animToTime: 20,
  animFromAzimuth: 45,
  animToAzimuth: 180,
  animDurationSec: 20,
  dayCycleEnabled: true,
  dayCycleRealMinutes: 60,
  animationsPaused: false,
  autoSceneLightsWithSun: true,
}

/** Mindestabstand Licht→Ziel (cm). Wird bei großen Baukörpern angehoben, damit nichts hinter der Shadow-Camera liegt. */
export const MIN_SUN_DISTANCE = 900
export const SHADOW_MAP_SIZE = 4096
/** Kleine/mittlere Sites: feinere Texel → weniger Treppenstufen in der Penumbra. */
export const SHADOW_MAP_SIZE_HIGH = 8192
/**
 * Site-Spanne (max XZ, cm), bis zu der 8192 genutzt wird.
 * Darüber 4096 — bei Wachstum der Fassade muss Map-Größe **vor** Frustum-Fit
 * und mit Dispose gewechselt werden (`ensureDirectionalShadowMapSize`).
 */
export const SHADOW_MAP_HIGH_SPAN_CM = 4800

/** Site-Spanne → Shadow-Map-Auflösung (4096 oder 8192). */
export function shadowMapSizeForSiteSpan(span: number): number {
  return span <= SHADOW_MAP_HIGH_SPAN_CM ? SHADOW_MAP_SIZE_HIGH : SHADOW_MAP_SIZE
}
/** Innen-Sonne: kleinere Map reicht (nur Etagenplatten + Wände). */
export const SHADOW_MAP_SIZE_INDOOR = 2048
export const SHADOW_BIAS = -0.0002
export const SHADOW_NORMAL_BIAS_MIN = 0.05
/** Folgt der Texelgröße; zu groß → Lichtspalten (Peter-Panning) an Laibung/Sockel. */
export const SHADOW_NORMAL_BIAS_MAX = 0.22
export const SHADOW_FRUSTUM_PAD = 120
/** Extra near/far (cm), damit Boden-Treffer nicht aus der Tiefe fallen. */
export const SHADOW_FRUSTUM_DEPTH_PAD = 80
/**
 * Boden-y der Shadow-Projektion — gleich `GROUND_Y` in main.ts.
 * Nicht die Gebäude-AABB bei y=0: lange Schatten liegen außerhalb.
 */
export const SHADOW_GROUND_Y = -0.5
/**
 * Maximale mitgenommene Schattenlänge auf dem Boden (cm).
 * Begrenzt die Texelgröße bei sehr flacher Sonne; typische Fassaden bis ~8° Elevation.
 */
export const SHADOW_GROUND_MAX_LENGTH = 3200
/**
 * Layer-Trennung Außen vs. Innenböden/Decken.
 * Eine Shadow-Map kann nicht beides: Platten dichten den Innenraum ab,
 * würden aber auf dem Außenboden ein Prisma/Würfel erzeugen.
 */
export const SHADOW_LAYER_EXTERIOR = 0
export const SHADOW_LAYER_INTERIOR = 1
/** Nur diese Layer-Objekte erzeugen Bloom (Glühbirnen-Marker) — nicht die ganze Szene. */
export const BLOOM_LAYER = 2
/**
 * Nur Cube-Shadow der Bibliotheks-Punktlichter (nicht Sonne, nicht Hauptkamera).
 * Unsichtbare Raum-Dichtungen: keine Extra-Flächen im Bild, kein Z-Fighting.
 */
export const SHADOW_LAYER_OCCLUDER = 3
/** Dicke der Innenboden-/Decken-Extrusion (cm) für stabile Shadow-Occluder. */
export const INDOOR_SLAB_THICKNESS = 8
/**
 * Zusätzlicher Rückzug der sichtbaren Platte hinter die Wandinnenseite (cm).
 * Vermeidet Z-Fighting / Flackern an der Innenwand; Lichtdichte über Okkluder + Wand.
 */
export const INDOOR_SLAB_VISUAL_INSET_CM = 1
export const SUN_PATH_ANIM_SEC_MIN = 5
export const SUN_PATH_ANIM_SEC_MAX = 120
export const SUN_PATH_ANIM_SEC_DEFAULT = 20
/** @deprecated Prefer animDurationSec on SunSettings */
export const SUN_PATH_ANIM_MS = SUN_PATH_ANIM_SEC_DEFAULT * 1000

/** Echtzeit-Minuten für einen Szene-Tag (Tageszyklus). */
export const DAY_CYCLE_REAL_MINUTES_MIN = 1
export const DAY_CYCLE_REAL_MINUTES_MAX = 1440
export const DAY_CYCLE_REAL_MINUTES_DEFAULT = 60

export function clampDayCycleRealMinutes(minutes: number | undefined): number {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return DAY_CYCLE_REAL_MINUTES_DEFAULT
  return Math.min(DAY_CYCLE_REAL_MINUTES_MAX, Math.max(DAY_CYCLE_REAL_MINUTES_MIN, Math.round(minutes)))
}

/** Szene-Stunden pro Echtzeit-Sekunde aus Tagesdauer (Minuten). */
export function dayCycleSceneHoursPerRealSec(realMinutes: number | undefined): number {
  const minutes = clampDayCycleRealMinutes(realMinutes)
  return 24 / (minutes * 60)
}

function clampAnimDuration(sec: number): number {
  if (!Number.isFinite(sec)) return SUN_PATH_ANIM_SEC_DEFAULT
  return Math.min(SUN_PATH_ANIM_SEC_MAX, Math.max(SUN_PATH_ANIM_SEC_MIN, sec))
}

function clampAnimYaw(yaw: number): number {
  const n = ((Math.round(yaw / 45) * 45) % 360 + 360) % 360
  return n
}
const _size = new THREE.Vector3()
const _center = new THREE.Vector3()
const _corner = new THREE.Vector3()
const _lightPos = new THREE.Vector3()
const _lookTarget = new THREE.Vector3()
const _sunFromTarget = new THREE.Vector3()
const _sunRay = new THREE.Vector3()
const _shadowHit = new THREE.Vector3()

/** Tageszeit-Slider: 00:00 … 23:59 (kein 24:00). */
export const TIME_OF_DAY_MIN = 0
export const TIME_OF_DAY_MAX = 23 + 59 / 60
export const TIME_OF_DAY_STEP = 1 / 60

/** Tageszeit und Animations-Von/Bis: volle 24 h, nicht nur Aufgang–Untergang. */
function clampDayHours(hours: number): number {
  if (!Number.isFinite(hours)) return 12
  return THREE.MathUtils.clamp(hours, TIME_OF_DAY_MIN, TIME_OF_DAY_MAX)
}

export function formatTimeOfDay(hours: number): string {
  const clamped = clampDayHours(hours)
  const h = Math.floor(clamped)
  const m = Math.round((clamped - h) * 60)
  const mm = h >= 23 ? Math.min(59, m) : m
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function kelvinToColor(kelvin: number): THREE.Color {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100
  let r: number
  let g: number
  let b: number

  if (temp <= 66) {
    r = 255
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661))
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)))
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)))
  }

  if (temp >= 66) {
    b = 255
  } else if (temp <= 19) {
    b = 0
  } else {
    b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307))
  }

  return new THREE.Color(r / 255, g / 255, b / 255)
}

/** Azimut + Elevation + Farbtemperatur aus Datum und Uhrzeit (Berlin, volle 24 h). */
export function resolveSunFromDate(settings: SunSettings): {
  azimuthDeg: number
  elevationRad: number
  colorTemperature: number
  bounds: ReturnType<typeof solarDayBounds>
} {
  const doy = dayOfYearFromMonthDay(settings.month, settings.day)
  const bounds = solarDayBounds(doy)
  const time = ((settings.timeOfDay % 24) + 24) % 24
  const pos = solarPosition(doy, time)
  const elev = pos.elevationRad
  return {
    azimuthDeg: pos.azimuthDeg,
    elevationRad: elev,
    colorTemperature: elev > 0 ? colorTempFromElevation(elev) : 4200,
    bounds,
  }
}

function normalizeAnimChannels(settings: SunSettings): Pick<
  SunSettings,
  'animUseTime' | 'animUseCompass'
> {
  const useTime = settings.animUseTime === true
  const useCompass = settings.animUseCompass === true
  if (useTime || useCompass) return { animUseTime: useTime, animUseCompass: useCompass }
  return { animUseTime: false, animUseCompass: true }
}

/**
 * Synchronisiert Settings mit dem Sonnenstand (Berlin).
 * `applySolarLook: true` (Datum/Tageszeit-Slider): Azimut, Elevation, Weichheit,
 * Farbtemperatur und Intensität neu aus dem Stand — manuelle Overrides weg.
 * `false`: Uhrzeit 0–24 behalten; Winkel/Weichheit/Intensität bleiben.
 */
export function syncSunSettingsFromSolar(
  settings: SunSettings,
  options: { applySolarLook?: boolean; updateColorTemp?: boolean } = {},
): SunSettings {
  const applySolarLook = options.applySolarLook === true || options.updateColorTemp === true
  const resolved = resolveSunFromDate(settings)
  const channels = normalizeAnimChannels(settings)
  const timeOfDay = clampDayHours(settings.timeOfDay)
  const next: SunSettings = {
    ...settings,
    ...channels,
    timeOfDay,
    animFromTime: clampDayHours(settings.animFromTime),
    animToTime: clampDayHours(settings.animToTime),
    animFromAzimuth: clampAnimYaw(settings.animFromAzimuth),
    animToAzimuth: clampAnimYaw(settings.animToAzimuth),
    animDurationSec: clampAnimDuration(settings.animDurationSec),
  }
  if (applySolarLook) {
    const elev = resolved.elevationRad
    return {
      ...next,
      azimuth: resolved.azimuthDeg,
      elevationRad: elev,
      colorTemperature: resolved.colorTemperature,
      shadowSoftness: shadowSoftnessFromElevation(Math.max(0, elev)),
      intensity: elev > 0 ? intensityFromElevation(elev) : Math.max(0.04, settings.intensity * 0.08),
    }
  }
  return {
    ...next,
    azimuth: Number.isFinite(settings.azimuth) ? settings.azimuth : resolved.azimuthDeg,
    elevationRad: Number.isFinite(settings.elevationRad)
      ? settings.elevationRad
      : resolved.elevationRad,
  }
}

/** Löst Animations-Von/Bis in chronologische Dezimalstunden auf. */
export function resolveAnimTimeRange(settings: SunSettings): {
  fromHours: number
  toHours: number
  approxHint: boolean
} {
  const doy = dayOfYearFromMonthDay(settings.month, settings.day)
  const bounds = solarDayBounds(doy)
  let fromHours: number
  let toHours: number
  let approxHint = false

  if (settings.animUseTime) {
    fromHours = clampDayHours(settings.animFromTime)
    toHours = clampDayHours(settings.animToTime)
  } else {
    const a = timeWhenSunAzimuth(doy, clampAnimYaw(settings.animFromAzimuth))
    const b = timeWhenSunAzimuth(doy, clampAnimYaw(settings.animToAzimuth))
    fromHours = a.hours
    toHours = b.hours
    approxHint = !a.exact || !b.exact
  }

  const t0 = Math.min(fromHours, toHours)
  const t1 = Math.max(fromHours, toHours)
  return { fromHours: t0, toHours: t1, approxHint }
}

function migrateLegacyAnim(value: Partial<SunSettings> & LegacySunAnim, base: SunSettings): Pick<
  SunSettings,
  | 'animUseTime'
  | 'animUseCompass'
  | 'animFromTime'
  | 'animToTime'
  | 'animFromAzimuth'
  | 'animToAzimuth'
> {
  const hasNewFlags = value.animUseTime !== undefined || value.animUseCompass !== undefined
  if (hasNewFlags) {
    return {
      animUseTime: value.animUseTime === true,
      animUseCompass: value.animUseCompass === true,
      animFromTime: typeof value.animFromTime === 'number' ? value.animFromTime : base.animFromTime,
      animToTime: typeof value.animToTime === 'number' ? value.animToTime : base.animToTime,
      animFromAzimuth:
        typeof value.animFromAzimuth === 'number' ? value.animFromAzimuth : base.animFromAzimuth,
      animToAzimuth:
        typeof value.animToAzimuth === 'number' ? value.animToAzimuth : base.animToAzimuth,
    }
  }
  const mode = value.animMode === 'time' ? 'time' : 'compass'
  if (mode === 'time') {
    return {
      animUseTime: true,
      animUseCompass: false,
      animFromTime: typeof value.animFrom === 'number' ? value.animFrom : base.animFromTime,
      animToTime: typeof value.animTo === 'number' ? value.animTo : base.animToTime,
      animFromAzimuth: base.animFromAzimuth,
      animToAzimuth: base.animToAzimuth,
    }
  }
  return {
    animUseTime: false,
    animUseCompass: true,
    animFromTime: base.animFromTime,
    animToTime: base.animToTime,
    animFromAzimuth: typeof value.animFrom === 'number' ? value.animFrom : base.animFromAzimuth,
    animToAzimuth: typeof value.animTo === 'number' ? value.animTo : base.animToAzimuth,
  }
}

export function normalizeSunSettings(
  value: (Partial<SunSettings> & LegacySunAnim) | undefined,
): SunSettings {
  const base = { ...DEFAULT_SUN_SETTINGS }
  if (!value) return syncSunSettingsFromSolar(base, { applySolarLook: true })
  const month = typeof value.month === 'number' ? value.month : base.month
  const day = typeof value.day === 'number' ? value.day : base.day
  const merged: SunSettings = {
    azimuth: typeof value.azimuth === 'number' ? value.azimuth : base.azimuth,
    elevationRad:
      typeof value.elevationRad === 'number'
        ? THREE.MathUtils.clamp(value.elevationRad, -Math.PI / 2, Math.PI / 2)
        : base.elevationRad,
    timeOfDay: typeof value.timeOfDay === 'number' ? value.timeOfDay : base.timeOfDay,
    intensity: typeof value.intensity === 'number' ? value.intensity : base.intensity,
    shadowSoftness:
      typeof value.shadowSoftness === 'number' ? value.shadowSoftness : base.shadowSoftness,
    colorTemperature:
      typeof value.colorTemperature === 'number' ? value.colorTemperature : base.colorTemperature,
    ambient:
      typeof value.ambient === 'number'
        ? THREE.MathUtils.clamp(value.ambient, 0.05, 1.5)
        : base.ambient,
    shadowContrast:
      typeof value.shadowContrast === 'number'
        ? THREE.MathUtils.clamp(value.shadowContrast, 0.5, 5)
        : base.shadowContrast,
    shadowDensity:
      typeof value.shadowDensity === 'number'
        ? THREE.MathUtils.clamp(value.shadowDensity, 0, 1)
        : base.shadowDensity,
    month,
    day,
    ...migrateLegacyAnim(value, base),
    animDurationSec:
      typeof value.animDurationSec === 'number' ? value.animDurationSec : base.animDurationSec,
    dayCycleEnabled:
      typeof value.dayCycleEnabled === 'boolean' ? value.dayCycleEnabled : base.dayCycleEnabled,
    dayCycleRealMinutes: clampDayCycleRealMinutes(
      typeof value.dayCycleRealMinutes === 'number'
        ? value.dayCycleRealMinutes
        : base.dayCycleRealMinutes,
    ),
    animationsPaused:
      typeof value.animationsPaused === 'boolean' ? value.animationsPaused : base.animationsPaused,
    autoSceneLightsWithSun:
      typeof value.autoSceneLightsWithSun === 'boolean'
        ? value.autoSceneLightsWithSun
        : base.autoSceneLightsWithSun,
  }
  // Alt-Saves ohne elevationRad: Höhe aus Datum/Uhrzeit, Overrides (Intensität etc.) behalten.
  if (typeof value.elevationRad !== 'number') {
    merged.elevationRad = resolveSunFromDate(merged).elevationRad
  }
  return syncSunSettingsFromSolar(merged, { applySolarLook: false })
}

/** Welt-AABB des Baukörpers inkl. Innenraum (für Shadow-Frustum und Sonnenziel). */
export function buildingWorldBox(walls: Wall[]): THREE.Box3 {
  const box = new THREE.Box3()
  for (const wall of walls) {
    const transform = isStudioWall(wall)
      ? studioWallTransform(wall)
      : {
          position: { x: wall.x + wall.width / 2, y: wall.y + wall.height / 2, z: 0 },
          rotationY: 0,
        }
    const hw = wall.width / 2
    const hh = wall.height / 2
    const outward = isStudioWall(wall) ? studioFacadeOutwardDepth(wall) : 0
    const flip = wall.panelFlip ?? false
    const z0 = flip ? -outward : 0
    const z1 = flip ? wall.depth : wall.depth + outward
    const cos = Math.cos(transform.rotationY)
    const sin = Math.sin(transform.rotationY)
    for (const lx of [-hw, hw]) {
      for (const ly of [-hh, hh]) {
        for (const lz of [z0, z1]) {
          box.expandByPoint(
            _corner.set(
              transform.position.x + lx * cos + lz * sin,
              transform.position.y + ly,
              transform.position.z - lx * sin + lz * cos,
            ),
          )
        }
      }
    }
  }
  if (!box.isEmpty()) {
    box.min.y = Math.min(box.min.y, 0)
  }
  return box
}

/** Dreht eine Welt-AABB um Y durch (cx, cz) — für `siteYawDeg`. */
export function applyYawAroundYToBox(
  box: THREE.Box3,
  yawDeg: number,
  cx: number,
  cz: number,
): THREE.Box3 {
  if (box.isEmpty()) return box.clone()
  const yaw = ((yawDeg % 360) + 360) % 360
  if (yaw === 0) return box.clone()
  const rad = (yaw * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const out = new THREE.Box3()
  for (let i = 0; i < 8; i += 1) {
    const x = i & 1 ? box.max.x : box.min.x
    const y = i & 2 ? box.max.y : box.min.y
    const z = i & 4 ? box.max.z : box.min.z
    const dx = x - cx
    const dz = z - cz
    out.expandByPoint(
      _corner.set(cx + dx * cos - dz * sin, y, cz + dx * sin + dz * cos),
    )
  }
  return out
}

export function sunTargetFromBox(box: THREE.Box3): THREE.Vector3 {
  if (box.isEmpty()) return new THREE.Vector3(192, 224, 0)
  box.getCenter(_center)
  return new THREE.Vector3(_center.x, Math.max(0, _center.y), _center.z)
}

export function sunDistanceForBox(box: THREE.Box3): number {
  if (box.isEmpty()) return MIN_SUN_DISTANCE
  box.getSize(_size)
  const radius = _size.length() * 0.5
  return Math.max(MIN_SUN_DISTANCE, radius * 2.5 + SHADOW_FRUSTUM_PAD)
}

/**
 * Einheitsvektor vom Ziel zur Sonne (App-Welt: Azimut 0=N/−Z, 90=O/+X).
 * Eigenes Mapping, kein fremdes Sonnen-Skript.
 */
export function sunFromTargetDirection(settings: SunSettings, out = _sunFromTarget): THREE.Vector3 {
  const azimuthRad = THREE.MathUtils.degToRad(
    Number.isFinite(settings.azimuth) ? settings.azimuth : 180,
  )
  const elevation = Math.max(
    0,
    Number.isFinite(settings.elevationRad) ? settings.elevationRad : DEFAULT_SUN_ELEVATION_RAD,
  )
  const cosElev = Math.cos(elevation)
  return out.set(
    Math.sin(azimuthRad) * cosElev,
    Math.sin(elevation),
    -Math.cos(azimuthRad) * cosElev,
  )
}

/** Richtung der Sonnenstrahlen (Sonne → Szene), parallel zur DirectionalLight. */
export function sunRayDirectionFromSettings(settings: SunSettings, out = _sunRay): THREE.Vector3 {
  return sunFromTargetDirection(settings, out).multiplyScalar(-1)
}

/**
 * Nutzer-Schattenweichheit (Slider 0,5…8), 1:1 geklemmt.
 * Steuert PCSS-Lichtgröße (`pcssLightWorldSizeFromSoftness`), nicht `shadow.radius`.
 */
export function shadowRadiusFromSoftness(softness: number): number {
  const n = Number.isFinite(softness) ? softness : DEFAULT_SUN_SHADOW_SOFTNESS
  return THREE.MathUtils.clamp(n, 0.5, 8)
}

/**
 * Erweitert die Gebäude-AABB um die Schnittpunkte der Sonnenstrahlen mit dem Boden.
 * So liegt der lange Bodenschatten im Ortho-Frustum — nicht nur der Baukörper.
 * Eigenes Verfahren; kein CSM-Addon, kein kopiertes Listing.
 */
export function expandBoxByGroundShadow(
  box: THREE.Box3,
  rayDirection: THREE.Vector3,
  groundY = SHADOW_GROUND_Y,
  maxLength = SHADOW_GROUND_MAX_LENGTH,
): THREE.Box3 {
  const out = box.clone()
  if (box.isEmpty()) return out
  const len = rayDirection.length()
  if (len < 1e-8) return out
  const dx = rayDirection.x / len
  const dy = rayDirection.y / len
  const dz = rayDirection.z / len
  if (dy >= -1e-6) return out

  const cap = Math.max(0, maxLength)
  for (let i = 0; i < 8; i += 1) {
    const x = i & 1 ? box.max.x : box.min.x
    const y = i & 2 ? box.max.y : box.min.y
    const z = i & 4 ? box.max.z : box.min.z
    if (y <= groundY + 1e-4) continue
    const t = (groundY - y) / dy
    if (!(t > 0) || !Number.isFinite(t)) continue
    const travel = Math.min(t, cap)
    out.expandByPoint(_shadowHit.set(x + dx * travel, y + dy * travel, z + dz * travel))
  }
  return out
}

export function prepareSunShadowBox(
  buildingBox: THREE.Box3,
  settings: SunSettings,
  groundY = SHADOW_GROUND_Y,
): THREE.Box3 {
  return expandBoxByGroundShadow(buildingBox, sunRayDirectionFromSettings(settings), groundY)
}

/** Ortho-Seiten auf Texelraster legen — weniger Schimmern, eigene Rasterung. */
function snapOrthoSides(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  mapSize: number,
): { minX: number; maxX: number; minY: number; maxY: number } {
  const w = Math.max(1, maxX - minX)
  const h = Math.max(1, maxY - minY)
  const size = Math.max(1, mapSize)
  const tx = w / size
  const ty = h / size
  return {
    minX: Math.floor(minX / tx) * tx,
    maxX: Math.ceil(maxX / tx) * tx,
    minY: Math.floor(minY / ty) * ty,
    maxY: Math.ceil(maxY / ty) * ty,
  }
}

/**
 * Ortho-Frustum der DirectionalLight-Shadow-Camera im Licht-Raum.
 * WebGLShadowMap setzt die Camera jedes Frame auf light.position → target;
 * left/right/top/bottom/near/far müssen in genau diesem Raum liegen — nicht in Welt-XY.
 */
export function fitDirectionalShadowCamera(
  dirLight: THREE.DirectionalLight,
  worldBox: THREE.Box3,
): void {
  const cam = dirLight.shadow.camera
  const box = worldBox.clone()
  if (box.isEmpty()) {
    cam.left = -600
    cam.right = 600
    cam.top = 600
    cam.bottom = -600
    cam.near = 1
    cam.far = 2000
    cam.updateProjectionMatrix()
    dirLight.shadow.bias = SHADOW_BIAS
    dirLight.shadow.normalBias = SHADOW_NORMAL_BIAS_MIN
    return
  }
  box.expandByScalar(SHADOW_FRUSTUM_PAD)

  dirLight.updateMatrixWorld()
  dirLight.target.updateMatrixWorld()
  _lightPos.setFromMatrixPosition(dirLight.matrixWorld)
  _lookTarget.setFromMatrixPosition(dirLight.target.matrixWorld)
  cam.position.copy(_lightPos)
  cam.lookAt(_lookTarget)
  cam.updateMatrixWorld()

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < 8; i++) {
    _corner
      .set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      )
      .applyMatrix4(cam.matrixWorldInverse)
    minX = Math.min(minX, _corner.x)
    maxX = Math.max(maxX, _corner.x)
    minY = Math.min(minY, _corner.y)
    maxY = Math.max(maxY, _corner.y)
    minZ = Math.min(minZ, _corner.z)
    maxZ = Math.max(maxZ, _corner.z)
  }

  const snapped = snapOrthoSides(minX, maxX, minY, maxY, dirLight.shadow.mapSize.x)
  cam.left = snapped.minX
  cam.right = snapped.maxX
  cam.top = snapped.maxY
  cam.bottom = snapped.minY
  // Kamera schaut nach −Z: vordere Ecken haben größeres (weniger negatives) z.
  cam.near = Math.max(0.5, -maxZ - SHADOW_FRUSTUM_DEPTH_PAD)
  cam.far = Math.max(cam.near + 10, -minZ + SHADOW_FRUSTUM_DEPTH_PAD)
  cam.updateProjectionMatrix()

  const frustumW = Math.max(1, snapped.maxX - snapped.minX)
  const frustumH = Math.max(1, snapped.maxY - snapped.minY)
  const mapSize = Math.max(dirLight.shadow.mapSize.x, 1)
  const texel = Math.max(frustumW, frustumH) / mapSize
  dirLight.shadow.bias = SHADOW_BIAS
  dirLight.shadow.normalBias = THREE.MathUtils.clamp(
    texel * 0.14,
    SHADOW_NORMAL_BIAS_MIN,
    SHADOW_NORMAL_BIAS_MAX,
  )
}

/**
 * Lichtposition: Solar-Azimut 0=N/−Z, 90=O/+X (App-Welt).
 * x = sin(az), z = −cos(az).
 */
export function applySunSettings(
  settings: SunSettings,
  dirLight: THREE.DirectionalLight,
  hemiLight: THREE.HemisphereLight,
  target: THREE.Vector3,
  distance = MIN_SUN_DISTANCE,
  sceneColors?: { sky: string; ground: string },
): void {
  applyDirectionalSun(settings, dirLight, target, distance)
  const contrast = Math.max(0.5, settings.shadowContrast)
  hemiLight.intensity = Math.max(0.04, settings.ambient / contrast)
  const groundDark = THREE.MathUtils.clamp(settings.shadowDensity, 0, 1)
  if (sceneColors) {
    hemiLight.color.set(sceneColors.sky)
    const ground = new THREE.Color(sceneColors.ground)
    ground.multiplyScalar(THREE.MathUtils.lerp(0.92, 0.38, groundDark))
    hemiLight.groundColor.copy(ground)
  } else {
    hemiLight.color.set(0xffffff)
    hemiLight.groundColor.setRGB(
      THREE.MathUtils.lerp(0.69, 0.12, groundDark),
      THREE.MathUtils.lerp(0.69, 0.12, groundDark),
      THREE.MathUtils.lerp(0.69, 0.14, groundDark),
    )
  }
}

/** Gleiche Sonnenpose/Farbe/Intensität auf ein DirectionalLight (Außen- oder Innen-Sonne). */
export function applyDirectionalSun(
  settings: SunSettings,
  dirLight: THREE.DirectionalLight,
  target: THREE.Vector3,
  distance = MIN_SUN_DISTANCE,
): void {
  const lightColor = kelvinToColor(settings.colorTemperature)
  const dist = Math.max(MIN_SUN_DISTANCE, distance)
  const fromTarget = sunFromTargetDirection(settings)

  dirLight.position.set(
    target.x + fromTarget.x * dist,
    target.y + fromTarget.y * dist,
    target.z + fromTarget.z * dist,
  )
  dirLight.target.position.copy(target)
  dirLight.target.updateMatrixWorld()
  dirLight.intensity = settings.intensity
  dirLight.color.copy(lightColor)
  dirLight.shadow.bias = SHADOW_BIAS
  dirLight.shadow.normalBias = SHADOW_NORMAL_BIAS_MIN
}

export function isSunSettings(value: unknown): value is SunSettings {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.timeOfDay === 'number' &&
    typeof record.intensity === 'number' &&
    typeof record.shadowSoftness === 'number'
  )
}
