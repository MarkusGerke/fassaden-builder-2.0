import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WALL_DEPTH, WALL_HEIGHT } from '../constants/presets'
import type { Building } from '../types/facade'
import { createEmptyFloorPlan, drawPlanLine } from '../studio/floorPlan'
import { SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import { storeyFloorSurfaceY } from '../utils/layers'
import {
  buildPointLightRoomOccluders,
  POINT_LIGHT_JUNCTION_THICKNESS,
  POINT_LIGHT_OCCLUDER_THICKNESS,
} from './pointLightRoomOccluders'

function rectanglePlan() {
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10, 0)
  plan = drawPlanLine(plan, 10, 0, 10, 8)
  plan = drawPlanLine(plan, 10, 8, 0, 8)
  plan = drawPlanLine(plan, 0, 8, 0, 0)
  return plan
}

describe('pointLightRoomOccluders', () => {
  it('erzeugt dicke Außenring-Platten auf Okkluder-Layer', () => {
    const plan = rectanglePlan()
    const mat = new THREE.MeshBasicMaterial()
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      walls: [],
      wallHeight: WALL_HEIGHT,
      wallDepth: WALL_DEPTH,
      floors: [plan],
    }
    const group = buildPointLightRoomOccluders([building], mat)
    expect(group.children.length).toBe(2)
    for (const child of group.children) {
      const mesh = child as THREE.Mesh
      expect(mesh.layers.isEnabled(SHADOW_LAYER_OCCLUDER)).toBe(true)
      expect(mesh.layers.isEnabled(0)).toBe(false)
      expect(mesh.castShadow).toBe(true)
      expect(mesh.userData.shadowOccluder).toBe(true)
      expect(mesh.frustumCulled).toBe(false)
    }
    const floor = group.children.find((m) => m.userData.indoorRole === 'floor')!
    expect(floor.position.y).toBe(storeyFloorSurfaceY(building, 0) - POINT_LIGHT_OCCLUDER_THICKNESS)
  })

  it('legt am Etagenstoß eine dicke Stoß-Dichtung', () => {
    const mat = new THREE.MeshBasicMaterial()
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      walls: [],
      wallHeight: WALL_HEIGHT,
      wallDepth: WALL_DEPTH,
      floors: [rectanglePlan(), rectanglePlan()],
    }
    const group = buildPointLightRoomOccluders([building], mat)
    const junctions = group.children.filter((m) => m.userData.indoorRole === 'junction')
    expect(junctions.length).toBeGreaterThanOrEqual(1)
    const jGeo = (junctions[0] as THREE.Mesh).geometry as THREE.ExtrudeGeometry
    // Extrude depth = Stoßdicke
    expect(jGeo.parameters.options.depth).toBeGreaterThanOrEqual(POINT_LIGHT_JUNCTION_THICKNESS)
  })
})
