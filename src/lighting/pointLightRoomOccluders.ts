import * as THREE from 'three'
import type { Building } from '../types/facade'
import { planFacesWithHoles, planNodeWorld } from '../studio/floorPlan'
import { SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import { storeyFloorSurfaceY, storeyTopY } from '../utils/layers'

/**
 * Dicke der Punktlicht-Geschoss-Okkluder (cm). Dicker als sichtbare Platten (8 cm),
 * damit Licht aus dem Untergeschoss nicht an der Sockelhöhe der Etage darüber leckt.
 */
export const POINT_LIGHT_OCCLUDER_THICKNESS = 24

/**
 * Unsichtbare Boden-/Deckenplatten auf dem **Außenring** (Wandaußenkante).
 * Nur für Punktlicht-Cube-Shadows (Layer 3) — Hauptkamera und Sonne sehen sie nicht.
 *
 * Sichtbare Indoor-Platten liegen ebenfalls auf dem Außenring (v2.0.92). Die Okkluder
 * bleiben als Backup, wenn Decke/Boden ausgeblendet sind (`showCeiling === false`),
 * und sind dicker (v2.0.106), damit Etagenübergänge lichtdicht bleiben.
 */
export function buildPointLightRoomOccluders(
  buildings: Building[],
  material: THREE.Material,
  slabThickness = POINT_LIGHT_OCCLUDER_THICKNESS,
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []

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

  const addSlab = (shape: THREE.Shape, y: number, buildingId: string, role: string) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: slabThickness,
      bevelEnabled: false,
    })
    const mesh = new THREE.Mesh(geo, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(0, y, 0)
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
    meshes.push(mesh)
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
        const floorY = storeyFloorSurfaceY(building, fi) - slabThickness
        const ceilingY = storeyTopY(building, fi) - slabThickness
        addSlab(shape.clone(), floorY, building.id, 'floor')
        addSlab(shape.clone(), ceilingY, building.id, 'ceiling')

        // Zusätzliche Dichtung am Etagenstoß: überlappt Decke dieser und Boden der nächsten Etage.
        if (fi + 1 < floors.length && floors[fi + 1] && !floors[fi + 1]!.hidden) {
          const junctionTop = Math.max(storeyTopY(building, fi), storeyFloorSurfaceY(building, fi + 1))
          const junctionY = junctionTop - slabThickness * 0.5
          addSlab(shape.clone(), junctionY, building.id, 'junction')
        }
      }
    }
  }
  return meshes
}
