import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import {
  archHybridCourseYs,
  archHybridVoussoirPolysFromSpec,
  buildSemicircularArchSpec,
  cartesianPartOverlapsHybridSector,
  hybridArchBayRect,
  hybridSectorRMax,
  openingArchHybridMasonryEnabled,
  normalizeOpeningArch,
} from './openingGeometry'

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

describe('Hybrid Rechteckverband ↔ Radialkeile', () => {
  it('nur bei voussoirs + Verband (nicht Streifen/Alt ohne Flag)', () => {
    const withRing = roundOpening({
      enabled: true,
      form: 'round',
      voussoirs: true,
      riseCm: 48,
    })
    expect(openingArchHybridMasonryEnabled(withRing, 'runningBond')).toBe(true)
    expect(openingArchHybridMasonryEnabled(withRing, 'strip')).toBe(false)
    const alt = roundOpening(normalizeOpeningArch({ enabled: true, form: 'round' }))
    expect(openingArchHybridMasonryEnabled(alt, 'runningBond')).toBe(false)
  })

  it('schichtweise Steine: Oberkanten an Lagerfugen, Höhe ≈ Schicht', () => {
    const opening = roundOpening({
      enabled: true,
      form: 'round',
      voussoirs: true,
      riseCm: 48,
      keystoneCount: 7,
    })
    const spec = buildSemicircularArchSpec(opening, {
      panelWidth: 48,
      panelHeight: 16,
      joint: 0.8,
    })!
    const courseYs = archHybridCourseYs(
      [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176],
      spec.cy,
      spec.cy + spec.rOuter,
      16,
    )
    const polys = archHybridVoussoirPolysFromSpec(spec, courseYs, {
      panelWidth: 48,
      panelHeight: 16,
    })
    expect(polys.length).toBeGreaterThanOrEqual(spec.count)
    const dockYs = new Set(courseYs.map((y) => Math.round(y * 10) / 10))
    for (const p of polys) {
      expect(p.outline?.length ?? 0).toBeGreaterThanOrEqual(3)
      expect(p.width * p.height).toBeGreaterThan(10)
      const topY = Math.max(...(p.outline ?? []).map((pt) => pt.y))
      const nearCourse = [...dockYs].some((cy) => Math.abs(cy - topY) < 0.5)
      expect(nearCourse).toBe(true)
      expect(p.height).toBeLessThan(16 * 2.5)
    }
    const bay = hybridArchBayRect(spec, polys)
    expect(bay.y + bay.height).toBeGreaterThanOrEqual(spec.cy + spec.rOuter - 2)
  })

  it('Sektor-Filter trifft Bogenband, nicht den Pfeiler daneben', () => {
    const opening = roundOpening({
      enabled: true,
      form: 'round',
      voussoirs: true,
      riseCm: 48,
    })
    const spec = buildSemicircularArchSpec(opening, {
      panelWidth: 48,
      panelHeight: 16,
      joint: 0.8,
    })!
    const courseYs = archHybridCourseYs(
      [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160],
      spec.cy,
      spec.cy + spec.rOuter,
      16,
    )
    const polys = archHybridVoussoirPolysFromSpec(spec, courseYs, { panelHeight: 16 })
    const rMax = hybridSectorRMax(spec, polys)
    const rMid = (spec.rInner + spec.rOuter) * 0.5
    const inSector = {
      x: spec.cx - 8,
      y: spec.cy + rMid - 8,
      width: 16,
      height: 16,
    }
    const pier = {
      x: spec.cx + spec.rOuter + 20,
      y: spec.cy + 8,
      width: 48,
      height: 16,
    }
    expect(cartesianPartOverlapsHybridSector(inSector, spec, rMax)).toBe(true)
    expect(cartesianPartOverlapsHybridSector(pier, spec, rMax)).toBe(false)
  })
})
