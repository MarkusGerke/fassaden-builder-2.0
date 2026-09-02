import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import {
  archRusticatedCoursePolys,
  archRusticationKnuckles,
  buildRusticationGeom,
  cartesianPartOverlapsRusticationZone,
  defaultKnuckleOffsetCm,
  openingArchRusticationEnabled,
  rusticatedCrownKeystonePolys,
  rusticatedSideCoursePoly,
  rusticationSectorRMax,
} from './archRustication'
import { archHybridCourseYs } from '../utils/openingGeometry'

function roundOpening(arch: Opening['arch']): Opening {
  return {
    id: 'o1',
    type: 'window',
    x: 48,
    y: 32,
    width: 96,
    height: 128,
    arch,
  }
}

describe('Arch-Rustikation (radiale Quaderlagen)', () => {
  it('Standard aus; nur mit archRustication.enabled (v2.0.79)', () => {
    const round = roundOpening({ enabled: true, form: 'round', riseCm: 48, voussoirs: false })
    expect(openingArchRusticationEnabled(round, 'strip')).toBe(false)
    expect(openingArchRusticationEnabled(round, 'runningBond')).toBe(false)
    const on = { ...round, archRustication: { enabled: true } }
    expect(openingArchRusticationEnabled(on, 'strip')).toBe(true)
    expect(openingArchRusticationEnabled(on, 'runningBond')).toBe(true)
    expect(openingArchRusticationEnabled(on, 'none')).toBe(false)
    expect(openingArchRusticationEnabled(on, null)).toBe(false)
    const tudor = {
      ...roundOpening({ enabled: true, form: 'tudor', voussoirs: false }),
      archRustication: { enabled: true },
    }
    expect(openingArchRusticationEnabled(tudor, 'strip')).toBe(true)
    const rect = roundOpening({ enabled: false, form: 'rect' })
    expect(openingArchRusticationEnabled({ ...rect, archRustication: { enabled: true } }, 'strip')).toBe(
      false,
    )
  })

  it('inaktiv bei eckiger Öffnung', () => {
    const opening = {
      ...roundOpening({ enabled: false, form: 'rect' }),
      archRustication: { enabled: true },
    }
    expect(openingArchRusticationEnabled(opening, 'strip')).toBe(false)
  })

  it('Seitenstein: Knick vertikal, innen Bogen, Lagerfugen radial', () => {
    const opening = roundOpening({ enabled: true, form: 'round', riseCm: 48 })
    const geom = buildRusticationGeom(opening)!
    const knuckle = archRusticationKnuckles(geom, 8)
    const y0 = geom.cy + 16
    const y1 = geom.cy + 32
    const left = rusticatedSideCoursePoly(geom, 'left', y0, y1, knuckle.left)!
    expect(left.outline!.length).toBeGreaterThanOrEqual(4)
    expect(left.outline!.some((p) => Math.abs(p.x - knuckle.left) < 0.2)).toBe(true)
    const nearArch = left.outline!.some(
      (p) => Math.abs(Math.hypot(p.x - geom.cx, p.y - geom.cy) - geom.r) < 2,
    )
    expect(nearArch).toBe(true)
    expect(left.width).toBeGreaterThan(4)
    expect(left.height).toBeLessThan((y1 - y0) * 1.4)
  })

  it('unter Kämpfer keine Radialsteine', () => {
    const opening = roundOpening({ enabled: true, form: 'round', riseCm: 48 })
    const geom = buildRusticationGeom(opening)!
    const knuckle = archRusticationKnuckles(geom, 8)
    const poly = rusticatedSideCoursePoly(geom, 'left', geom.cy - 32, geom.cy - 8, knuckle.left)
    expect(poly).toBeNull()
  })

  it('baut Lagen links/rechts + Scheitel ohne Voussoir (kein Loch)', () => {
    const opening = roundOpening({
      enabled: true,
      form: 'round',
      riseCm: 48,
      voussoirs: false,
    })
    const geom = buildRusticationGeom(opening)!
    const courseYs = archHybridCourseYs(
      [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192],
      geom.cy,
      geom.apexY,
      16,
    )
    const polys = archRusticatedCoursePolys(opening, courseYs, {
      panelHeight: 16,
      panelWidth: 48,
      knuckleOffsetCm: 8,
    })
    expect(polys.length).toBeGreaterThanOrEqual(5)
    const crown = polys.filter((p) => {
      const mx = p.x + p.width * 0.5
      return Math.abs(mx - geom.cx) < geom.r * 0.35
    })
    expect(crown.length).toBeGreaterThanOrEqual(1)
    const maxY = Math.max(...polys.map((p) => p.y + p.height))
    expect(maxY).toBeGreaterThanOrEqual(geom.apexY - 2)
  })

  it('Tudor + Strip: Generator liefert Polys', () => {
    const opening = roundOpening({ enabled: true, form: 'tudor', voussoirs: false })
    const geom = buildRusticationGeom(opening)!
    expect(geom.crown.length).toBeGreaterThan(3)
    const polys = archRusticatedCoursePolys(opening, [], {
      panelHeight: 32,
      panelWidth: 48,
      knuckleOffsetCm: 8,
    })
    expect(polys.length).toBeGreaterThanOrEqual(3)
  })

  it('mit Voussoir: 1–3 Scheitel-Keilsteine', () => {
    const opening = roundOpening({
      enabled: true,
      form: 'round',
      riseCm: 48,
      voussoirs: true,
      keystoneCount: 7,
    })
    const geom = buildRusticationGeom(opening)!
    const knuckle = archRusticationKnuckles(geom, 8)
    const keys = rusticatedCrownKeystonePolys(geom, knuckle, 3)
    expect(keys.length).toBe(3)
    for (const k of keys) {
      expect(k.polar).toBeTruthy()
      expect(k.outline!.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('Sektor-Filter trifft Spandrille, nicht Pfeiler außen', () => {
    const opening = roundOpening({ enabled: true, form: 'round', riseCm: 48 })
    const geom = buildRusticationGeom(opening)!
    const knuckle = archRusticationKnuckles(geom, 8)
    const courseYs = archHybridCourseYs([], geom.cy, geom.apexY, 16)
    const polys = archRusticatedCoursePolys(opening, courseYs, {
      panelHeight: 16,
      panelWidth: 48,
      knuckleOffsetCm: 8,
    })
    const rMax = rusticationSectorRMax(geom, polys)
    const inZone = {
      x: knuckle.left + 2,
      y: geom.cy + geom.r * 0.55,
      width: 10,
      height: 10,
    }
    const pier = {
      x: knuckle.right + 24,
      y: geom.cy + 8,
      width: 48,
      height: 16,
    }
    expect(cartesianPartOverlapsRusticationZone(inZone, geom, knuckle, rMax)).toBe(true)
    expect(cartesianPartOverlapsRusticationZone(pier, geom, knuckle, rMax)).toBe(false)
  })

  it('Knick-Default aus Paneelmaßen', () => {
    expect(defaultKnuckleOffsetCm({ panelHeight: 16, panelWidth: 48 })).toBeGreaterThanOrEqual(8)
  })
})
