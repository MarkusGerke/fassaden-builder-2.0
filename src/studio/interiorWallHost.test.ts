import { describe, expect, it } from 'vitest'
import { WALL_DEPTH, WALL_HEIGHT } from '../constants/presets'
import { facadeOutward } from './elevation'
import {
  createInteriorWallFromHostNormal,
  createStudioWall,
  inwardYawDeg,
  normalizeStudioWall,
  styleWallAsInterior,
  wallEndTouchesForeignSpine,
  wallStartPoint,
  wallThicknessCenterlinePoint,
} from './walls'

describe('createInteriorWallFromHostNormal', () => {
  it('legt 90°-Innenwand: Mittelachse an Host-Innenseite, Dicke ±½, ohne Host-Änderung', () => {
    const host = normalizeStudioWall({
      ...createStudioWall(0, 0),
      id: 'host',
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      width: 384,
      height: WALL_HEIGHT,
      depth: WALL_DEPTH,
      panelFlip: true,
      openings: [],
    })
    const hostSnapshot = structuredClone(host)
    const depthCm = 24
    const localX = 192
    const interior = createInteriorWallFromHostNormal({
      host,
      localXCm: localX,
      lengthCm: 96,
      depthCm,
    })
    expect(interior).not.toBeNull()
    expect(interior!.role).toBe('interior')
    expect(interior!.width).toBe(96)
    expect(interior!.depth).toBe(depthCm)
    expect(interior!.yawDeg).toBe(inwardYawDeg(0, true))
    expect(Math.abs(((interior!.yawDeg ?? 0) - 0 + 360) % 180 - 90)).toBeLessThan(1)
    expect(interior!.panel?.plinthEnabled).toBe(false)
    expect(interior!.planLinked).toBe(true)
    expect(interior!.height).toBe(host.height)
    expect(host).toEqual(hostSnapshot)

    const out = facadeOutward(0, true)
    const into = { x: -out.x, z: -out.z }
    // Host-Innenseite am Anker
    const face = {
      x: 0 + localX,
      z: into.z * WALL_DEPTH,
    }
    const mid = wallThicknessCenterlinePoint(interior!, 0)
    expect(mid.x).toBeCloseTo(face.x, 5)
    expect(mid.z).toBeCloseTo(face.z, 5)
    // Flanken-Origin liegt ±½ entlang Host (nicht in den Host hinein)
    const start = wallStartPoint(interior!)
    expect(Math.hypot(start.x - face.x, start.z - face.z)).toBeCloseTo(depthCm / 2, 5)
    expect(wallEndTouchesForeignSpine(interior!, 'start', [host, interior!])).toBe(true)
  })

  it('setzt Innenwand auf Innenwand-Host (fromFace outer) mit Mittelachsen-Dock', () => {
    const exterior = normalizeStudioWall({
      ...createStudioWall(0, 0),
      id: 'ext',
      originX: 0,
      originZ: 0,
      yawDeg: 0,
      width: 384,
      height: WALL_HEIGHT,
      depth: WALL_DEPTH,
      panelFlip: true,
      openings: [],
    })
    const first = createInteriorWallFromHostNormal({
      host: exterior,
      localXCm: 192,
      lengthCm: 192,
      depthCm: 24,
    })!
    const firstStyled = styleWallAsInterior(
      { ...first, role: 'interior', planLinked: true },
      24,
    )
    const second = createInteriorWallFromHostNormal({
      host: firstStyled,
      localXCm: 96,
      lengthCm: 96,
      depthCm: 24,
      fromFace: 'outer',
    })
    expect(second).not.toBeNull()
    expect(second!.role).toBe('interior')
    const mid0 = wallThicknessCenterlinePoint(second!, 0)
    const hostFace = wallStartPoint(firstStyled)
    // fromFace outer + panelFlip true: Dock an Planlinie des Hosts
    const hostAlong = { x: Math.cos((firstStyled.yawDeg! * Math.PI) / 180), z: -Math.sin((firstStyled.yawDeg! * Math.PI) / 180) }
    // Mittelachse Start liegt auf Host-Plan (Außenflanke)
    const distToHostPlan = Math.abs(
      (mid0.x - hostFace.x) * -hostAlong.z + (mid0.z - hostFace.z) * hostAlong.x,
    )
    // Bei 90°: lateraler Abstand zur Host-Achse ≈ 0
    expect(distToHostPlan).toBeLessThan(1)
    expect(wallEndTouchesForeignSpine(second!, 'start', [exterior, firstStyled, second!])).toBe(true)
  })
})
