import * as THREE from 'three'
import type { Building } from '../types/facade'
import { planFacesWithHoles, planNodeWorld } from '../studio/floorPlan'
import { storeyFloorSurfaceY, storeyTopY } from '../utils/layers'
import { SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'

/**
 * Dicke Geschoss-Dichtung (cm) für Point-Light-Cube-Schatten.
 * Weiche Schatten (radius) und normalBias lecken an dünnen Platten —
 * deshalb deutlich dicker als die sichtbaren Indoor-Platten (8 cm).
 */
export const POINT_LIGHT_OCCLUDER_THICKNESS = 100

/** Extra-Dicke der Stoß-Dichtung zwischen zwei Geschossen (cm). */
export const POINT_LIGHT_JUNCTION_THICKNESS = 160

/**
 * Unsichtbare Boden-/Deckenplatten auf dem **Außenring** (Wandaußenkante).
 * Nur für Punktlicht-Cube-Shadows (Layer 3) — Hauptkamera und Sonne sehen sie nicht.
 *
 * Extrude + Rotation bleibt formtreu (Höfe/Löcher). Dicke + Stoßplatte dichten
 * weiche Cube-Schatten zwischen Etagen ab.
 */
export function buildPointLightRoomOccluders(
  buildings: Building[],
  material: THREE.Material,
  slabThickness = POINT_LIGHT_OCCLUDER_THICKNESS,
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'pointLightRoomOccluders'

  const ringToShapeXY = (pts: Array<{ x: number; z: number }>) => {
    if (pts.length < 3) return null
    const shape = new THREE.Shape()
    shape.moveTo(pts[0]!.x, -pts[0]!.z)
    for (let i = 1; i < pts.length; i += 1) {
      shape.lineTo(pts[i]!.x, -pts[i]!.z)
    }
    shape.closePath()
    return shape
  }

  const addSlab = (
    shape: THREE.Shape,
    yTop: number,
    thickness: number,
    buildingId: string,
    role: string,
    fi: number,
  ) => {
    const depth = Math.max(8, thickness)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
    })
    // Extrude +Z → nach rotation.x = −π/2 Welt +Y. position.y = Unterkante; Oberkante = yTop.
    const mesh = new THREE.Mesh(geo, material)
    mesh.name = `plOcc_${role}_${buildingId}_${fi}`
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(0, yTop - depth, 0)
    mesh.castShadow = true
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    mesh.layers.set(SHADOW_LAYER_OCCLUDER)
    mesh.userData = {
      kind: 'pointLightRoomOccluder',
      shadowOccluder: true,
      indoorRole: role,
      buildingId,
    }
    group.add(mesh)
  }

  for (const building of buildings) {
    if (building.hidden) continue
    const floors = building.floors
    if (!floors || floors.length === 0) continue
    for (let fi = 0; fi < floors.length; fi += 1) {
      const plan = floors[fi]
      if (!plan || plan.hidden) continue
      const faces = planFacesWithHoles(plan)
      for (const face of faces) {
        const outer = face.outer.map(planNodeWorld)
        const shape = ringToShapeXY(outer)
        if (!shape) continue
        for (const holeNodes of face.holes) {
          const hole = holeNodes.map(planNodeWorld)
          if (hole.length < 3) continue
          const path = new THREE.Path()
          path.moveTo(hole[0]!.x, -hole[0]!.z)
          for (let i = hole.length - 1; i >= 1; i -= 1) {
            path.lineTo(hole[i]!.x, -hole[i]!.z)
          }
          path.closePath()
          shape.holes.push(path)
        }

        // Extrude geht nach Rotation nach −Y → Mesh.position.y = Oberkante der Platte.
        addSlab(shape.clone(), storeyFloorSurfaceY(building, fi), slabThickness, building.id, 'floor', fi)
        addSlab(shape.clone(), storeyTopY(building, fi), slabThickness, building.id, 'ceiling', fi)

        if (fi + 1 < floors.length && floors[fi + 1] && !floors[fi + 1]!.hidden) {
          const yLo = storeyTopY(building, fi)
          const yHi = storeyFloorSurfaceY(building, fi + 1)
          const mid = (yLo + yHi) * 0.5
          const span = Math.max(
            POINT_LIGHT_JUNCTION_THICKNESS,
            Math.abs(yHi - yLo) + slabThickness,
          )
          // Stoßplatte zentriert: Oberkante = mid + span/2
          addSlab(shape.clone(), mid + span * 0.5, span, building.id, 'junction', fi)
        }
      }
    }
  }

  return group
}
