import * as THREE from 'three'
import { isTransparentGlass } from '../constants/colorPalettes'
import type { SurfaceFinish } from '../types/facade'
import {
  openingGlassConfig,
  PHYSICAL_CLEAR_GLASS_COLOR,
  resolveGlassConfig,
  type OpeningGlassConfig,
} from './glassConfig'
import { surfaceFinishParams } from './surfaceFinish'

function isGlassLike(material: THREE.Material): boolean {
  const name = material.name.toLowerCase()
  if (name.includes('glas') || name.includes('glass')) return true
  const physical = material instanceof THREE.MeshPhysicalMaterial ? material : null
  if (physical && (physical.transparent || physical.transmission > 0)) return true
  return material.transparent && material.opacity < 0.95
}

let glassEnvMap: THREE.Texture | null = null

export function setGlassEnvironment(map: THREE.Texture | null) {
  glassEnvMap = map
}

export function getGlassEnvironment(): THREE.Texture | null {
  return glassEnvMap
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
      if (isGlassLike(material) || material.envMap || material.envMapIntensity > 0.2) {
        material.envMap = glassEnvMap
        material.needsUpdate = true
      } else if (material.userData.interiorWallSurface === true) {
        material.envMap = glassEnvMap
        material.envMapIntensity = Math.max(material.envMapIntensity, 0.42)
        material.needsUpdate = true
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
    material.envMapIntensity = glassEnvMap ? 2.6 : 0
  } else if (seeThrough) {
    material.color.set(tint)
    material.transparent = true
    material.opacity = 0.5
    material.transmission = 0
    material.thickness = config.thickness
    material.attenuationDistance = Infinity
    material.envMapIntensity = glassEnvMap ? 2.4 : 0
  } else {
    material.color.set(tint)
    material.transparent = false
    material.opacity = 1
    material.transmission = config.transmission
    material.thickness = config.thickness
    material.attenuationColor.set('#ffffff')
    material.attenuationDistance = Math.max(24, config.thickness * 12)
    material.envMapIntensity = glassEnvMap ? 1.8 : 0
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
  const params = surfaceFinishParams(finish)
  material.roughness = params.roughness
  material.metalness = params.metalness
  material.envMapIntensity = params.envMapIntensity
  // Ohne scene.environment: Studio-EnvMap nur am Material (Glas / Glanz).
  if (params.useEnvMap && glassEnvMap) {
    material.envMap = glassEnvMap
  } else {
    material.envMap = null
  }
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
