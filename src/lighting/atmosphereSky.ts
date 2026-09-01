/**
 * Bruneton-Himmel (@takram/three-atmosphere): SkyMaterial, Sterne, SunDirectionalLight, SkyLightProbe.
 * Lichtquellen liegen NICHT im Himmels-Root — sonst wandert der Schatten mit der Kamera.
 */
import * as THREE from 'three'
import { Ellipsoid } from '@takram/three-geospatial'
import {
  DEFAULT_PRECOMPUTED_TEXTURES_URL,
  DEFAULT_STARS_DATA_URL,
  getECIToECEFRotationMatrix,
  getMoonDirectionECI,
  getSunDirectionECI,
  PrecomputedTexturesGenerator,
  PrecomputedTexturesLoader,
  SkyLightProbe,
  SkyMaterial,
  StarsGeometry,
  StarsMaterial,
  SunDirectionalLight,
  type PrecomputedTextures,
} from '@takram/three-atmosphere'
import {
  directionFromSolar,
  moonIlluminationFraction,
  moonPosition,
  resolveCelestialState,
  type CelestialState,
} from '../utils/celestialSky'
import { dayOfYearFromMonthDay, SOLAR_REF_YEAR } from '../utils/solar'
import { DEFAULT_SUN_SETTINGS, kelvinToColor, type SunSettings } from '../utils/sunLighting'

const BERLIN_ALTITUDE_M = 50
/** HDR-Scale für SkyMaterial (toneMapped:false). Mit Bloom leicht gedrosselt — Uniform, siehe patchSkyDisplayToneMap. */
export const SKY_DISPLAY_EXPOSURE_BLOOM = 7
export const SKY_DISPLAY_EXPOSURE_PLAIN = 8
/** Planetboden im Himmel — nicht die Studio-Bodenfarbe (sonst weiße Scheibe). */
const EARTH_ALBEDO = new THREE.Color(0.22, 0.21, 0.18)

const _worldDir = new THREE.Vector3()
const _ecefRef = new THREE.Vector3()
const _east = new THREE.Vector3()
const _north = new THREE.Vector3()
const _up = new THREE.Vector3()
const _south = new THREE.Vector3()

/** Datum aus SunSettings (Referenzjahr, lokale Uhrzeit ≈ Berlin). */
export function sunSettingsToDate(settings: SunSettings): Date {
  const t = ((settings.timeOfDay % 24) + 24) % 24
  const hours = Math.floor(t)
  const minutes = Math.round((t - hours) * 60)
  return new Date(SOLAR_REF_YEAR, settings.month - 1, settings.day, hours, minutes, 0, 0)
}

function geodeticToEcef(latRad: number, lonRad: number, altM: number, out: THREE.Vector3): THREE.Vector3 {
  const a = 6378137
  const f = 1 / 298.257223563
  const e2 = 2 * f - f * f
  const sinLat = Math.sin(latRad)
  const cosLat = Math.cos(latRad)
  const sinLon = Math.sin(lonRad)
  const cosLon = Math.cos(lonRad)
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat)
  out.x = (n + altM) * cosLat * cosLon
  out.y = (n + altM) * cosLat * sinLon
  out.z = (n * (1 - e2) + altM) * sinLat
  return out
}

/**
 * Welt→ECEF für Three.js Y-up: +X Ost, +Y oben, −Z Nord.
 * (Takram-Default NUE wäre +X Nord — das verdreht Azimut vs. unseren Sonnenstand.)
 */
export function berlinWorldToECEFMatrix(out = new THREE.Matrix4()): THREE.Matrix4 {
  geodeticToEcef(
    THREE.MathUtils.degToRad(52.52),
    THREE.MathUtils.degToRad(13.405),
    BERLIN_ALTITUDE_M,
    _ecefRef,
  )
  Ellipsoid.WGS84.getEastNorthUpVectors(_ecefRef, _east, _north, _up)
  _south.copy(_north).multiplyScalar(-1)
  return out.makeBasis(_east, _up, _south).setPosition(_ecefRef)
}

function assignAtmosphereTextures(
  target: {
    irradianceTexture?: THREE.Texture | null
    scatteringTexture?: THREE.Data3DTexture | null
    transmittanceTexture?: THREE.Texture | null
    singleMieScatteringTexture?: THREE.Data3DTexture | null
    higherOrderScatteringTexture?: THREE.Data3DTexture | null
  },
  textures: PrecomputedTextures,
): void {
  target.irradianceTexture = textures.irradianceTexture
  target.scatteringTexture = textures.scatteringTexture
  target.transmittanceTexture = textures.transmittanceTexture
  target.singleMieScatteringTexture = textures.singleMieScatteringTexture ?? null
  target.higherOrderScatteringTexture = textures.higherOrderScatteringTexture ?? null
}

const skyExposureUniform = { value: SKY_DISPLAY_EXPOSURE_BLOOM }
/** Feste Sonnenscheiben-AA in Radiant — dFdx/dFdy flackert beim Orbit (Bloom-Fireflies). */
export const SKY_SUN_FRAGMENT_ANGLE = 0.003
/** Weiche HDR-Kappe nach Display-Exposure, damit Bloom die Sonne nicht weiß aufblitzt. */
export const SKY_BLOOM_PEAK_COMPRESS = 0.14
export const SKY_BLOOM_PEAK_MAX = 5.5

/** Shader-Patches für Anzeige-Tonemapping (testbar ohne WebGL). */
export function patchSkyFragmentShader(fragmentShader: string): string {
  let src = fragmentShader
  if (!src.includes('uniform float uSkyDisplayExposure')) {
    src = src.replace(
      'layout(location = 0) out vec4 outputColor;',
      `uniform float uSkyDisplayExposure;
layout(location = 0) out vec4 outputColor;`,
    )
  }
  src = src.replace(
    'float fragmentAngle = length(dRDdx + dRDdy) / length(rayDirection);',
    `float fragmentAngle = ${SKY_SUN_FRAGMENT_ANGLE.toFixed(4)};`,
  )
  if (!src.includes('SKY_HDR_CLAMP')) {
    src = src.replace(
      'outputColor.a = 1.0;',
      `outputColor.rgb *= uSkyDisplayExposure;
  float skyPeak = max(max(outputColor.r, outputColor.g), outputColor.b);
  float skyCapped = skyPeak / (1.0 + skyPeak * ${SKY_BLOOM_PEAK_COMPRESS.toFixed(2)});
  outputColor.rgb *= skyCapped / max(skyPeak, 1e-4);
  outputColor.rgb = min(outputColor.rgb, vec3(${SKY_BLOOM_PEAK_MAX.toFixed(1)}));
  outputColor.a = 1.0; // SKY_HDR_CLAMP`,
    )
  }
  return src
}

function patchSkyDisplayToneMap(material: SkyMaterial): void {
  // RawShaderMaterial: Uniform muss im GLSL explizit deklariert werden (kein Auto-Inject).
  material.uniforms.uSkyDisplayExposure = skyExposureUniform
  const prev = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (parameters, renderer) => {
    prev(parameters, renderer)
    parameters.uniforms.uSkyDisplayExposure = skyExposureUniform
    parameters.fragmentShader = patchSkyFragmentShader(parameters.fragmentShader)
  }
}

/** Physikalische Sonne → Anzeige-Farbe; Intensität bleibt die der Slider. */
export function applyDisplaySunColor(
  light: THREE.DirectionalLight,
  celestial: CelestialState,
  intensityScale: number,
): void {
  const peak = Math.max(light.color.r, light.color.g, light.color.b)
  if (peak < 0.002 || celestial.sun.elevationRad <= 0) {
    light.color.copy(kelvinToColor(celestial.lightColorTemp))
  } else {
    const lum = 0.2126 * light.color.r + 0.7152 * light.color.g + 0.0722 * light.color.b
    light.color.multiplyScalar(1 / Math.max(lum, 1e-4))
    const m = Math.max(light.color.r, light.color.g, light.color.b)
    if (m > 1.35) light.color.multiplyScalar(1.35 / m)
  }
  light.intensity = celestial.lightIntensity * intensityScale
}

export class AtmosphereSky {
  readonly root = new THREE.Group()
  readonly sunLight: SunDirectionalLight
  readonly skyLightProbe: SkyLightProbe
  readonly sunDirection = new THREE.Vector3()
  readonly moonDirection = new THREE.Vector3()
  readonly inertialToECEFMatrix = new THREE.Matrix4()
  readonly worldToECEFMatrix = new THREE.Matrix4()

  private readonly skyMesh: THREE.Mesh
  private readonly skyMaterial: SkyMaterial
  private readonly stars: THREE.Points
  private readonly starsMaterial: StarsMaterial
  private generator: PrecomputedTexturesGenerator | null = null
  private textures: PrecomputedTextures | null = null
  private loadPromise: Promise<void> | null = null
  private _ready = false
  private _wantVisible = true
  lastCelestial: CelestialState = resolveCelestialState(DEFAULT_SUN_SETTINGS)

  constructor() {
    berlinWorldToECEFMatrix(this.worldToECEFMatrix)

    this.sunLight = new SunDirectionalLight({
      ellipsoid: Ellipsoid.WGS84,
      correctAltitude: true,
      distance: 1200,
      ...({ irradianceTexture: null } as Record<string, unknown>),
    })
    this.skyLightProbe = new SkyLightProbe({
      ellipsoid: Ellipsoid.WGS84,
      correctAltitude: true,
    })

    this.skyMaterial = new SkyMaterial({
      sun: true,
      moon: true,
      ground: true,
      groundAlbedo: EARTH_ALBEDO.clone(),
      ellipsoid: Ellipsoid.WGS84,
      correctAltitude: true,
    })
    this.skyMaterial.depthWrite = false
    this.skyMaterial.depthTest = true
    patchSkyDisplayToneMap(this.skyMaterial)

    this.skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMaterial)
    this.skyMesh.frustumCulled = false
    this.skyMesh.renderOrder = 1000
    this.root.add(this.skyMesh)
    this.root.visible = false

    this.starsMaterial = new StarsMaterial({
      ellipsoid: Ellipsoid.WGS84,
      correctAltitude: true,
      background: true,
      ground: true,
      pointSize: 1,
      intensity: 1,
    })
    this.starsMaterial.depthWrite = false
    this.starsMaterial.depthTest = true
    this.stars = new THREE.Points(new THREE.BufferGeometry(), this.starsMaterial)
    this.stars.frustumCulled = false
    this.stars.renderOrder = 999
    this.root.add(this.stars)
    this.root.visible = false
  }

  get ready(): boolean {
    return this._ready
  }

  /** Sonnenlicht + Probe in die Szene (nicht ins Himmels-Root). */
  attachLights(scene: THREE.Scene): void {
    scene.add(this.sunLight)
    scene.add(this.sunLight.target)
    scene.add(this.skyLightProbe)
  }

  load(renderer: THREE.WebGLRenderer, texturesUrl = DEFAULT_PRECOMPUTED_TEXTURES_URL): Promise<void> {
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = (async () => {
      let textures: PrecomputedTextures
      try {
        const loader = new PrecomputedTexturesLoader().setType(renderer)
        textures = await loader.loadAsync(texturesUrl)
      } catch (err) {
        console.warn('Atmosphere CDN-Textures fehlgeschlagen, generiere lokal.', err)
        this.generator = new PrecomputedTexturesGenerator(renderer)
        textures = await this.generator.update()
      }
      this.textures = textures
      assignAtmosphereTextures(this.skyMaterial, textures)
      assignAtmosphereTextures(this.starsMaterial, textures)
      assignAtmosphereTextures(this.sunLight, textures)
      this.sunLight.transmittanceTexture = textures.transmittanceTexture
      assignAtmosphereTextures(this.skyLightProbe, textures)

      try {
        const starsBuf = await fetch(DEFAULT_STARS_DATA_URL).then((r) => {
          if (!r.ok) throw new Error(`stars.bin: ${r.status}`)
          return r.arrayBuffer()
        })
        this.stars.geometry.dispose()
        this.stars.geometry = new StarsGeometry(starsBuf)
      } catch (err) {
        console.warn('Sterne nicht geladen', err)
      }

      this._ready = true
      this.root.visible = this._wantVisible
    })().catch((err) => {
      this.loadPromise = null
      console.error('AtmosphereSky load failed', err)
      throw err
    })
    return this.loadPromise
  }

  update(
    settings: SunSettings,
    opts?: {
      intensityScale?: number
      castShadow?: boolean
      lightTarget?: THREE.Vector3
      lightDistance?: number
    },
  ): CelestialState {
    const date = sunSettingsToDate(settings)
    const doy = dayOfYearFromMonthDay(settings.month, settings.day)
    const celestial = resolveCelestialState(settings)
    this.lastCelestial = celestial

    getECIToECEFRotationMatrix(date, this.inertialToECEFMatrix)
    getSunDirectionECI(date, this.sunDirection).applyMatrix4(this.inertialToECEFMatrix)
    getMoonDirectionECI(date, this.moonDirection).applyMatrix4(this.inertialToECEFMatrix)

    directionFromSolar(settings.azimuth, settings.elevationRad, _worldDir)
    _worldDir.transformDirection(this.worldToECEFMatrix).normalize()
    this.sunDirection.copy(_worldDir)

    const moon = moonPosition(doy, settings.timeOfDay)
    directionFromSolar(moon.azimuthDeg, moon.elevationRad, _worldDir)
    _worldDir.transformDirection(this.worldToECEFMatrix).normalize()
    this.moonDirection.copy(_worldDir)

    const moonIllum = moonIlluminationFraction(settings.month, settings.day, doy)

    this.skyMaterial.sunDirection.copy(this.sunDirection)
    this.skyMaterial.moonDirection.copy(this.moonDirection)
    this.skyMaterial.worldToECEFMatrix.copy(this.worldToECEFMatrix)
    this.skyMaterial.lunarRadianceScale = moonIllum
    this.skyMaterial.groundAlbedo.copy(EARTH_ALBEDO)

    this.starsMaterial.sunDirection.copy(this.sunDirection)
    this.starsMaterial.worldToECEFMatrix.copy(this.worldToECEFMatrix)
    this.stars.setRotationFromMatrix(this.inertialToECEFMatrix)

    this.sunLight.sunDirection.copy(this.sunDirection)
    this.sunLight.worldToECEFMatrix.copy(this.worldToECEFMatrix)
    if (opts?.lightDistance != null) {
      this.sunLight.distance = opts.lightDistance
    }
    if (opts?.lightTarget) {
      this.sunLight.target.position.copy(opts.lightTarget)
      this.sunLight.target.updateMatrixWorld()
    }
    this.sunLight.update()
    applyDisplaySunColor(this.sunLight, celestial, opts?.intensityScale ?? 1)

    this.skyLightProbe.sunDirection.copy(this.sunDirection)
    this.skyLightProbe.worldToECEFMatrix.copy(this.worldToECEFMatrix)
    if (opts?.lightTarget) {
      this.skyLightProbe.position.copy(opts.lightTarget)
    }
    this.skyLightProbe.update()

    if (opts?.castShadow != null) {
      this.sunLight.castShadow = opts.castShadow
    }

    return celestial
  }

  setVisible(visible: boolean): void {
    this._wantVisible = visible
    this.root.visible = visible && this._ready
  }

  /** Anzeige-HDR des Himmels — mit Bloom niedrig, ohne Bloom etwas höher. */
  setDisplayExposure(exposure: number): void {
    skyExposureUniform.value = exposure
  }

  dispose(): void {
    this.skyMesh.geometry.dispose()
    this.skyMaterial.dispose()
    this.stars.geometry.dispose()
    this.starsMaterial.dispose()
    if (this.textures) {
      for (const tex of Object.values(this.textures)) {
        tex?.dispose()
      }
    }
  }
}
