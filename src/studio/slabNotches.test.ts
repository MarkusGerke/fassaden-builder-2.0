import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { PLAN_GRID_LEGACY_SCALE } from './constants'
import { createEmptyFloorPlan, drawPlanLine, extractPlanRings, planNodeWorld, wallsFromFloorPlan } from './floorPlan'
import { notchSlabRingAtOpenings, slabOpeningNotchIntervals } from './slabNotches'

/** Rechteck wie früher 10×8 bei 48-cm-Zellen → skaliert auf 8-cm-Zellen. */
function rectanglePlan() {
  const s = PLAN_GRID_LEGACY_SCALE
  let plan = createEmptyFloorPlan()
  plan = drawPlanLine(plan, 0, 0, 10 * s, 0)
  plan = drawPlanLine(plan, 10 * s, 0, 10 * s, 8 * s)
  plan = drawPlanLine(plan, 10 * s, 8 * s, 0, 8 * s)
  plan = drawPlanLine(plan, 0, 8 * s, 0, 0)
  return plan
}

function basementWindow(x: number): Opening {
  return { id: `kw-${x}`, type: 'window', x, y: 0, width: 96, height: 64 }
}

function polygonArea(pts: Array<{ x: number; z: number }>): number {
  let sum = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    sum += p.x * q.z - q.x * p.z
  }
  return Math.abs(sum) / 2
}

describe('slabOpeningNotchIntervals', () => {
  const wall = (openings: Opening[]): Wall => ({
    id: 'w',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 640,
    height: 320,
    depth: WALL_DEPTH,
    openings,
    profiles: [],
    neighbors: {},
  })

  it('Kellerfenster unter angehobenem Boden (Treppe) erzeugt Kerbe', () => {
    const w = wall([basementWindow(200)])
    // Boden-OK 72 (3 Stufen à 24), Platte 64…72 → Fenster 0…64 berührt Unterseite.
    expect(slabOpeningNotchIntervals(w, 64, 72)).toEqual([[199, 297]])
    // Boden-OK 48 → Platte 40…48 schneidet das Fenster 0…64.
    expect(slabOpeningNotchIntervals(w, 40, 48)).toEqual([[199, 297]])
  })

  it('Tür mit Unterkante = Boden-OK kerbt nur wenn die Schwelle angehoben ist', () => {
    const door: Opening = { id: 'd', type: 'door', x: 100, y: 72, width: 110, height: 240 }
    expect(slabOpeningNotchIntervals(wall([door]), 64, 72)).toEqual([[99, 211]])
    const flush: Opening = { id: 'd0', type: 'door', x: 100, y: 0, width: 110, height: 240 }
    expect(slabOpeningNotchIntervals(wall([flush]), -8, 0)).toEqual([])
  })

  it('Boden auf Nullniveau: Platte unter Terrain, keine Kerbe', () => {
    expect(slabOpeningNotchIntervals(wall([basementWindow(200)]), -8, 0)).toEqual([])
  })

  it('überlappende Öffnungen werden zu einem Intervall verschmolzen', () => {
    const w = wall([basementWindow(200), basementWindow(290)])
    expect(slabOpeningNotchIntervals(w, 40, 48)).toEqual([[199, 387]])
  })

  it('versteckte Öffnungen zählen nicht', () => {
    const w = wall([{ ...basementWindow(200), hidden: true }])
    expect(slabOpeningNotchIntervals(w, 40, 48)).toEqual([])
  })
})

describe('notchSlabRingAtOpenings', () => {
  it('ohne schneidende Öffnung bleibt der Ring unverändert', () => {
    const plan = rectanglePlan()
    const ring = extractPlanRings(plan).find((item) => item.closed)!
    const walls = wallsFromFloorPlan(plan)
    const world = ring.nodes.map(planNodeWorld)
    expect(notchSlabRingAtOpenings(world, walls, -8, 0)).toBe(world)
  })

  it('Kerbe reicht von der Außenkante bis knapp hinter die Wandinnenseite', () => {
    const plan = rectanglePlan()
    const ring = extractPlanRings(plan).find((item) => item.closed)!
    const walls = wallsFromFloorPlan(plan)
    const south = walls.find((wall) => Math.abs((wall.yawDeg ?? 0) % 360) < 1e-6)!
    south.openings = [basementWindow(200)]
    const world = ring.nodes.map(planNodeWorld)
    const notched = notchSlabRingAtOpenings(world, walls, 40, 48)

    expect(notched.length).toBe(world.length + 4)
    const notchDepth = south.depth + 0.5
    const expectedLoss = 98 * notchDepth
    expect(polygonArea(world) - polygonArea(notched)).toBeCloseTo(expectedLoss, 3)

    // Kerbenrückwand liegt um Wandtiefe + 0.5 von der Außenkante nach innen.
    const zs = new Set(notched.map((p) => Math.round(p.z * 10) / 10))
    const outerZ = Math.round(south.originZ! * 10) / 10
    expect(zs.has(outerZ)).toBe(true)
    expect([...zs].some((z) => Math.abs(Math.abs(z - outerZ) - notchDepth) < 1e-6)).toBe(true)
  })

  it('zwei Öffnungen auf derselben Wand → zwei Kerben in Kantenreihenfolge', () => {
    const plan = rectanglePlan()
    const ring = extractPlanRings(plan).find((item) => item.closed)!
    const walls = wallsFromFloorPlan(plan)
    const south = walls.find((wall) => Math.abs((wall.yawDeg ?? 0) % 360) < 1e-6)!
    south.openings = [basementWindow(300), basementWindow(100)]
    const world = ring.nodes.map(planNodeWorld)
    const notched = notchSlabRingAtOpenings(world, walls, 40, 48)
    expect(notched.length).toBe(world.length + 8)
    // Polygon bleibt einfach: keine sich kreuzenden Kanten → Fläche = Ausgang − 2 Kerben.
    expect(polygonArea(world) - polygonArea(notched)).toBeCloseTo(2 * 98 * (south.depth + 0.5), 3)
  })
})
