import * as THREE from 'three'
import { isTransparentGlass } from '../constants/colorPalettes'
import type { SurfaceFinish } from '../types/facade'
import {
  openingGlassConfig,
  PHYSICAL_CLEAR_GLASS_COLOR,
  resolveGlassConfig,
  type OpeningGlassConfig,
} from './glassConfig'
import { surfaceFinishParams, normalizeSurfaceFinish } from './surfaceFinish'

function isGlassLike(material: THREE.Material): boolean {
  const name = material.name.toLowerCase()
  if (name.includes('glas') || name.includes('glass')) return true
  const physical = material instanceof THREE.MeshPhysicalMaterial ? material : null
  if (physical && (physical.transparent || physical.transmission > 0)) return true
  return material.transparent && material.opacity < 0.95
}

let glassEnvMap: THREE.Texture | null = null
/**
 * 0…1+ Skala für Außen-/Glas-EnvMap — nachts ≈0, damit Paneele nicht
 * tagshelle CubeCamera-Reflexion als Mittelgrau behalten.
 */
let exteriorEnvFillFactor = 1

export function setGlassEnvironment(map: THREE.Texture | null) {
  glassEnvMap = map
}

export function getGlassEnvironment(): THREE.Texture | null {
  return glassEnvMap
}

export function getExteriorEnvFillFactor(): number {
  return exteriorEnvFillFactor
}

/** Celestial-abhängige Env-Stärke (Tag 1, Mond ~0,35, Sternennacht ~0,05). */
export function setExteriorEnvFillFactor(factor: number): void {
  exteriorEnvFillFactor = THREE.MathUtils.clamp(factor, 0, 1.5)
}

function scaledEnvIntensity(base: number): number {
  return base * exteriorEnvFillFactor
}

function rememberBaseEnvIntensity(material: THREE.MeshStandardMaterial, base: number): number {
  material.userData.baseEnvMapIntensity = base
  return scaledEnvIntensity(base)
}

/** EnvMap-Intensitäten an aktuellem Fill-Faktor ausrichten (nach Tageszeit-Wechsel). */
export function syncEnvMapFillIntensities(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name === 'studioGround') return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      if (material.name === 'studioGround') continue
      if (!material.envMap && !isGlassLike(material)) continue

      const stored = material.userData.baseEnvMapIntensity as number | undefined
      if (typeof stored === 'number' && Number.isFinite(stored)) {
        material.envMapIntensity = scaledEnvIntensity(stored)
        continue
      }
      if (isGlassLike(material)) {
        const base =
          material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.5
            ? 2.6
            : material.transparent
              ? 2.4
              : 1.8
        material.userData.baseEnvMapIntensity = base
        material.envMapIntensity = scaledEnvIntensity(base)
      } else if (material.userData.forceExteriorEnv === true) {
        const base = material.metalness > 0.08 ? 0.75 : 0.58
        material.userData.baseEnvMapIntensity = base
        material.envMapIntensity = scaledEnvIntensity(base)
      } else if (material.userData.interiorWallSurface === true) {
        material.userData.baseEnvMapIntensity = 0.55
        material.envMapIntensity = scaledEnvIntensity(0.55)
      }
    }
  })
}

/** EnvMap an Glas- und Glanz-Materialien hängen (nach CubeCamera-Bake). */
export function bindMaterialsToGlassEnv(root: THREE.Object3D) {
  if (!glassEnvMap) return
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name === 'studioGround') return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      if (material.name === 'studioGround') continue

      // Ohne forceExteriorEnv: matte Rahmen ohne Env (Legacy). Mit Außen-Finish
      // (finishOpeningFrameTree) teilen Rahmen die CubeCamera mit Wand/Laibung.
      const finish = material.userData.surfaceFinish as string | undefined
      const matteWithoutExteriorEnv =
        material.userData.forceExteriorEnv !== true &&
        !isGlassLike(material) &&
        (finish === 'matte' ||
          (material.userData.windowFrameSurface === true &&
            finish !== 'glossy' &&
            finish !== 'metal'))
      if (matteWithoutExteriorEnv) {
        if (material.envMap) {
          material.envMap = null
          material.needsUpdate = true
        }
        continue
      }

      const assignEnv = (base: number, opts?: { minIntensity?: boolean }) => {
        const next = scaledEnvIntensity(base)
        const intensity =
          opts?.minIntensity === true ? Math.max(material.envMapIntensity, next) : next
        material.userData.baseEnvMapIntensity = base
        if (material.envMap !== glassEnvMap || Math.abs(material.envMapIntensity - intensity) > 1e-5) {
          material.envMap = glassEnvMap
          material.envMapIntensity = intensity
          material.needsUpdate = true
        }
      }

      if (isGlassLike(material)) {
        const base =
          typeof material.userData.baseEnvMapIntensity === 'number'
            ? material.userData.baseEnvMapIntensity
            : material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0.5
              ? 2.6
              : material.transparent
                ? 2.4
                : 1.8
        assignEnv(base)
      } else if (material.userData.interiorWallSurface === true) {
        assignEnv(0.55, { minIntensity: true })
      } else if (material.userData.forceExteriorEnv === true) {
        assignEnv(material.metalness > 0.08 ? 0.75 : 0.58)
      } else if (material.envMap || material.envMapIntensity > 0.2) {
        // Glänzend / Metall ohne forceExteriorEnv
        if (material.envMap !== glassEnvMap) {
          material.envMap = glassEnvMap
          material.needsUpdate = true
        }
      }
    }
  })
}

/** Spiegelungen entfernen (Arbeitsdarstellung) — EnvMap an Materialien lösen. */
export function clearGlassEnvironmentBindings(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name === 'studioGround') return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      if (material.name === 'studioGround') continue
      if (!isGlassLike(material) && !material.envMap) continue
      material.envMap = null
      if (isGlassLike(material) && material instanceof THREE.MeshPhysicalMaterial) {
        material.envMapIntensity = 0
        material.clearcoat = 0
      }
      material.needsUpdate = true
    }
  })
}

/** Default-Himmelsfarbe in Klar-Glas-Reflexionen (Szene-Einstellung). */
export let glassSkyReflectionColor = '#3A6084'
/** Bodenfarbe in der CubeCamera-Himmelssphäre. */
export let glassGroundReflectionColor = '#c4bfb6'

export function setGlassSkyReflectionColor(hex: string) {
  glassSkyReflectionColor = hex
}

export function setGlassGroundReflectionColor(hex: string) {
  glassGroundReflectionColor = hex
}

/**
 * Fenster: echte Szene hinter der Scheibe (Transparenz) plus Spiegelung der
 * Außen-EnvMap (Fresnel/Clearcoat). Klarglas filtert Licht dahinter nicht.
 */
export function applyGlassLook(material: THREE.MeshPhysicalMaterial, config: OpeningGlassConfig) {
  const clear = isTransparentGlass(config.color)
  const tint = clear ? PHYSICAL_CLEAR_GLASS_COLOR : config.color
  const seeThrough = config.mode !== 'physical' || config.transmission <= 0.08
  material.name = 'glass'
  material.userData.glassConfig = config
  material.metalness = 0
  material.specularIntensity = 1
  material.specularColor.set('#ffffff')
  material.side = THREE.DoubleSide
  material.shadowSide = THREE.DoubleSide
  if (glassEnvMap) material.envMap = glassEnvMap
  else material.envMap = null

  material.roughness = config.roughness
  material.ior = config.ior
  if (glassEnvMap) {
    material.clearcoat = 1
    material.clearcoatRoughness = Math.min(0.06, config.roughness + 0.01)
  } else {
    material.clearcoat = 0
    material.clearcoatRoughness = 1
  }
  material.specularIntensity = 1
  material.depthWrite = false

  if (clear) {
    // Klarglas: Transmission ohne Farbfilter — kein Sonnenbrillen-Effekt auf Licht/Glühen
    material.color.set('#ffffff')
    material.transparent = false
    material.opacity = 1
    material.transmission = config.transmission > 0.08 ? config.transmission : 0.96
    material.thickness = Math.min(config.thickness, 0.25)
    material.roughness = Math.min(config.roughness, 0.02)
    material.attenuationColor.set('#ffffff')
    material.attenuationDistance = Infinity
    material.envMapIntensity = glassEnvMap ? rememberBaseEnvIntensity(material, 2.6) : 0
  } else if (seeThrough) {
    material.color.set(tint)
    material.transparent = true
    material.opacity = 0.5
    material.transmission = 0
    material.thickness = config.thickness
    material.attenuationDistance = Infinity
    material.envMapIntensity = glassEnvMap ? rememberBaseEnvIntensity(material, 2.4) : 0
  } else {
    material.color.set(tint)
    material.transparent = false
    material.opacity = 1
    material.transmission = config.transmission
    material.thickness = config.thickness
    material.attenuationColor.set('#ffffff')
    material.attenuationDistance = Math.max(24, config.thickness * 12)
    material.envMapIntensity = glassEnvMap ? rememberBaseEnvIntensity(material, 1.8) : 0
  }
  material.needsUpdate = true
}

/** True wenn das Material Glas (Transmission oder Name) ist. */
export function materialIsGlassLike(material: THREE.Material): boolean {
  return isGlassLike(material)
}

/**
 * Orthografische 2D-Front: Physical-Transmission liefert oft Schwarz.
 * Echte Alpha-Transparenz zeigt den Innenraum / das Punktlicht durch die Scheibe.
 */
export function applyOrthographicGlassSeeThrough(
  material: THREE.MeshPhysicalMaterial,
  enable: boolean,
): void {
  const config = material.userData.glassConfig as OpeningGlassConfig | undefined
  if (enable) {
    material.transmission = 0
    material.transparent = true
    material.opacity = 0.06
    material.roughness = 0
    material.metalness = 0
    material.clearcoat = 0
    material.depthWrite = false
    material.needsUpdate = true
    return
  }
  if (config) applyGlassLook(material, config)
}

export function createGlassMaterial(source: string | OpeningGlassConfig): THREE.MeshPhysicalMaterial {
  const config = resolveGlassConfig(source)
  const material = new THREE.MeshPhysicalMaterial()
  applyGlassLook(material, config)
  return material
}

export function createGlassMaterialFromOpening(
  opening: Parameters<typeof openingGlassConfig>[0],
): THREE.MeshPhysicalMaterial {
  return createGlassMaterial(openingGlassConfig(opening))
}

export function applyMeshColor(
  root: THREE.Object3D,
  hex: string,
  options: { skipGlass?: boolean; finish?: SurfaceFinish | null } = {},
) {
  const color = new THREE.Color(hex)
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    const nextMaterials = materials.map((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material
      if (options.skipGlass && isGlassLike(material)) return material
      const clone = material.clone()
      clone.color.copy(color)
      if (options.finish != null) applySurfaceFinish(clone, options.finish)
      return clone
    })
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0]
  })
}

export function applyGlassColor(root: THREE.Object3D, source: string | OpeningGlassConfig) {
  const config = resolveGlassConfig(source)
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    const nextMaterials = materials.map((material) => {
      if (!isGlassLike(material)) return material
      if (material instanceof THREE.MeshPhysicalMaterial) {
        const clone = material.clone()
        applyGlassLook(clone, config)
        return clone
      }
      if (material instanceof THREE.MeshStandardMaterial) {
        return createGlassMaterial(config)
      }
      return material
    })
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0]
  })
}

export function createTintedMaterial(
  base: THREE.MeshStandardMaterial,
  hex: string,
  finish?: SurfaceFinish | null,
): THREE.MeshStandardMaterial {
  const material = base.clone()
  material.color.set(hex)
  applySurfaceFinish(material, finish)
  return material
}

/** Arbeitsmodus: matt, ohne Env/Bloom-Look; polygonOffset gegen Z-Fight auf der Flachebene. */
export function applyWorkModeSurfaceLook(material: THREE.MeshStandardMaterial): void {
  material.roughness = 1
  material.metalness = 0
  material.envMap = null
  material.envMapIntensity = 0
  material.polygonOffset = true
  material.polygonOffsetFactor = 1
  material.polygonOffsetUnits = 1
  if (material instanceof THREE.MeshPhysicalMaterial) {
    material.clearcoat = 0
    material.sheen = 0
  }
  material.needsUpdate = true
}

export function applySurfaceFinish(
  material: THREE.MeshStandardMaterial,
  finish?: SurfaceFinish | null,
): void {
  const normalized = normalizeSurfaceFinish(finish)
  const params = surfaceFinishParams(normalized)
  material.userData.surfaceFinish = normalized
  material.roughness = params.roughness
  material.metalness = params.metalness
  material.envMapIntensity = rememberBaseEnvIntensity(material, params.envMapIntensity)
  // Ohne scene.environment: Studio-EnvMap nur am Material (Glas / Glanz).
  if (params.useEnvMap && glassEnvMap) {
    material.envMap = glassEnvMap
  } else {
    material.envMap = null
  }
  material.needsUpdate = true
}

/** Markiert Holz/Rahmen eines Fensters/Tür — bindMaterialsToGlassEnv lässt Env weg. */
export function markWindowFrameSurface(material: THREE.MeshStandardMaterial): void {
  material.userData.windowFrameSurface = true
}

/** Render-Modus: Außenflächen reflektieren Himmel/Szene (CubeCamera-EnvMap). */
export function applyRenderExteriorSurfaceLook(material: THREE.MeshStandardMaterial): void {
  material.userData.exteriorSurface = true
  // Explizit gewünscht (Paneel/Profil) — nicht nur Facade-Shade-Flag.
  material.userData.forceExteriorEnv = true
  const env = getGlassEnvironment()
  const base = material.metalness > 0.08 ? 0.75 : 0.58
  if (env) {
    material.envMap = env
    material.envMapIntensity = rememberBaseEnvIntensity(material, base)
  } else {
    material.userData.baseEnvMapIntensity = base
    material.envMapIntensity = scaledEnvIntensity(base)
  }
  material.roughness = Math.min(material.roughness, 0.78)
  material.metalness = Math.min(material.metalness, 0.06)
  material.needsUpdate = true
}

/** Render-Modus: Innenwände nehmen Punktlicht und EnvMap-Fill sichtbar auf. */
export function applyRenderInteriorSurfaceLook(material: THREE.MeshStandardMaterial): void {
  material.userData.interiorWallSurface = true
  const env = getGlassEnvironment()
  const base = 0.55
  if (env) {
    material.envMap = env
    material.envMapIntensity = rememberBaseEnvIntensity(material, base)
  } else {
    material.userData.baseEnvMapIntensity = base
    material.envMapIntensity = scaledEnvIntensity(base)
  }
  material.roughness = Math.min(material.roughness, 0.86)
  material.needsUpdate = true
}

/**
 * Shadow-Pass ohne polygonOffset — Farbpass behält Offset gegen Z-Fight.
 * Verhindert Peter-Panning durch versetzte Cast-Tiefe (Laibung/Sockel).
 */
export function ensureShadowDepthMaterial(material: THREE.MeshStandardMaterial): void {
  if (material.customDepthMaterial) return
  material.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
  })
  material.userData.pcssShadowDepthMat = true
}

export function clearShadowDepthMaterial(material: THREE.MeshStandardMaterial): void {
  if (!material.userData.pcssShadowDepthMat) return
  material.customDepthMaterial = null
  delete material.userData.pcssShadowDepthMat
  material.needsUpdate = true
}
