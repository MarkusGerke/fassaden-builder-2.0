import { describe, expect, it } from 'vitest'
import type { Building } from '../types/facade'
import { WALL_DEPTH } from '../constants/presets'
import { normalizeRoof } from './roof'
import { createDormerFixture, resolveDormerModel, dormerEavePlacement, roofEaveInfo } from './roofOpenings'
import { computeRoofFixtureGuides, snapRoofFixturePlacement } from './roofFixtureGuides'

function gableHouse(): Building {
  return {
    id: 'b1',
    name: 'T',
    wallHeight: 448,
    wallDepth: WALL_DEPTH,
    walls: [],
    floors: [
      {
        nodes: [
          { id: 'a', gx: 0, gz: 0 },
          { id: 'b', gx: 960, gz: 0 },
          { id: 'c', gx: 960, gz: 480 },
          { id: 'd', gx: 0, gz: 480 },
        ],
        edges: [
          { id: 'e1', fromId: 'a', toId: 'b' },
          { id: 'e2', fromId: 'b', toId: 'c' },
          { id: 'e3', fromId: 'c', toId: 'd' },
          { id: 'e4', fromId: 'd', toId: 'a' },
        ],
      },
    ],
    roof: normalizeRoof({ enabled: true, kind: 'gable', pitch: 45, overhang: 40 }),
  }
}

describe('snapRoofFixturePlacement', () => {
  it('snappt Trauf-along und distance auf 8 cm', () => {
    const building = gableHouse()
    const roof = normalizeRoof(building.roof)
    const snapped = snapRoofFixturePlacement(building, roof, 483, 200)
    expect(snapped).not.toBeNull()
    const placement = dormerEavePlacement(building, roof, snapped!)
    expect(placement).not.toBeNull()
    expect(placement!.alongCm % 8).toBeCloseTo(0, 5)
    expect(placement!.distanceCm % 8).toBeCloseTo(0, 5)
  })
})

describe('computeRoofFixtureGuides', () => {
  it('Boden-Fuß der U-Linie liegt unter der Gaubenkante (gleiche XZ), nicht an der Traufe', () => {
    const building = gableHouse()
    const roof = normalizeRoof({ ...building.roof!, dormers: [] })
    const d = createDormerFixture('gable', 480, 200, 160, 400, 140)
    roof.dormers = [d]
    const model = resolveDormerModel(building, roof, d)!
    const guides = computeRoofFixtureGuides(building, roof, { kind: 'dormer', id: d.id })
    const hw = model.widthCm / 2
    const f = model.frame
    const leftFront = {
      x: model.origin.x + f.u.x * -hw,
      z: model.origin.z + f.u.z * -hw,
    }
    // Senkrechte Boden-Segmente: a.y ≈ ground, b nahe Fixture-Front
    const drops = guides.lines.filter(
      (l) => l.style === 'self' && l.a.y < 5 && Math.abs(l.b.y - model.y0) < 40,
    )
    expect(drops.length).toBeGreaterThanOrEqual(2)
    const leftDrop = drops.find(
      (l) => Math.hypot(l.b.x - leftFront.x, l.b.z - leftFront.z) < 2,
    )
    expect(leftDrop).toBeTruthy()
    expect(Math.hypot(leftDrop!.a.x - leftFront.x, leftDrop!.a.z - leftFront.z)).toBeLessThan(2)
  })

  it('Trauf-along und frame.u können entgegengesetzt sein — Querlinien nutzen Vorzeichen', () => {
    const building = gableHouse()
    const roof = normalizeRoof({ ...building.roof!, dormers: [] })
    const d = createDormerFixture('gable', 480, 200, 160, 400, 140)
    roof.dormers = [d]
    const model = resolveDormerModel(building, roof, d)!
    const place = dormerEavePlacement(building, roof, d)!
    const info = roofEaveInfo(building, roof)!
    const a = info.eave[place.edgeIndex]
    const b = info.eave[(place.edgeIndex + 1) % info.eave.length]
    const ex = (b.x - a.x) / place.edgeLengthCm
    const ez = (b.z - a.z) / place.edgeLengthCm
    const dot = model.frame.u.x * ex + model.frame.u.z * ez
    // Auf diesem Testdach ist dot typisch −1 — Guide-Code muss das aushalten.
    expect(dot).toBeLessThan(-0.5)

    const guides = computeRoofFixtureGuides(building, roof, { kind: 'dormer', id: d.id })
    // Querlinie an der Front: fast horizontal auf Schräge, Länge ≈ Trauflänge
    const frontY = model.y0
    const cross = guides.lines
      .filter((l) => {
        if (l.style !== 'self') return false
        const dy = Math.abs(l.a.y - l.b.y)
        const span = Math.hypot(l.a.x - l.b.x, l.a.z - l.b.z)
        const midY = (l.a.y + l.b.y) / 2
        return dy < 8 && span > place.edgeLengthCm * 0.8 && Math.abs(midY - frontY) < 12
      })
      .sort(
        (l, r) =>
          Math.hypot(r.a.x - r.b.x, r.a.z - r.b.z) - Math.hypot(l.a.x - l.b.x, l.a.z - l.b.z),
      )
    expect(cross.length).toBeGreaterThanOrEqual(1)
    expect(Math.hypot(cross[0]!.a.x - cross[0]!.b.x, cross[0]!.a.z - cross[0]!.b.z)).toBeGreaterThan(
      place.edgeLengthCm * 0.8,
    )
  })
})
