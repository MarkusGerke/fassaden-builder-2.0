import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WALL_DEPTH, WALL_HEIGHT } from '../constants/presets'
import type { Building } from '../types/facade'
import { createEmptyFloorPlan, drawPlanLine, innerFaceRingWorld, planFacesWithHoles, planNodeWorld } from '../studio/floorPlan'
import { SHADOW_LAYER_OCCLUDER } from '../utils/sunLighting'
import { storeyFloorSurfaceY } from '../utils/layers'
import { buildPointLightRoomOccluders, POINT_LIGHT_OCCLUDER_THICKNESS } from './pointLightRoomOccluders'

function rectanglePlan() {
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10, 0)
  plan = drawPlanLine(plan, 10, 0, 10, 8)
  plan = drawPlanLine(plan, 10, 8, 0, 8)
  plan = drawPlanLine(plan, 0, 8, 0, 0)
  return plan
}

describe('pointLightRoomOccluders', () => {
  it('erzeugt unsichtbare Außenring-Platten auf Okkluder-Layer, nicht durch Kellerfenster angehoben', () => {
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
    const meshes = buildPointLightRoomOccluders([building], mat)
    expect(meshes.length).toBe(2)
    for (const mesh of meshes) {
      expect(mesh.layers.isEnabled(SHADOW_LAYER_OCCLUDER)).toBe(true)
      expect(mesh.layers.isEnabled(0)).toBe(false)
      expect(mesh.castShadow).toBe(true)
      expect(mesh.userData.shadowOccluder).toBe(true)
    }
    const floor = meshes.find((m) => m.userData.indoorRole === 'floor')!
    expect(floor.position.y).toBe(storeyFloorSurfaceY(building, 0) - POINT_LIGHT_OCCLUDER_THICKNESS)

    const face = planFacesWithHoles(plan)[0]!
    const outerArea = polygonArea(face.outer.map(planNodeWorld))
    const innerArea = polygonArea(innerFaceRingWorld(face.outer, WALL_DEPTH))
    expect(outerArea).toBeGreaterThan(innerArea)
  })

  it('legt am Etagenstoß eine zusätzliche Dichtungsplatte', () => {
    const mat = new THREE.MeshBasicMaterial()
    const building: Building = {
      id: 'b1',
      name: 'Haus',
      walls: [],
      wallHeight: WALL_HEIGHT,
      wallDepth: WALL_DEPTH,
      floors: [rectanglePlan(), rectanglePlan()],
    }
    const meshes = buildPointLightRoomOccluders([building], mat)
    const junctions = meshes.filter((m) => m.userData.indoorRole === 'junction')
    expect(junctions.length).toBeGreaterThanOrEqual(1)
  })
})

function polygonArea(pts: Array<{ x: number; z: number }>): number {
  let sum = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    sum += p.x * q.z - q.x * p.z
  }
  return Math.abs(sum) / 2
}
