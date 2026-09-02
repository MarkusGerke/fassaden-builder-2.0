import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import {
  archHybridCourseYs,
  archHybridVoussoirPolysFromSpec,
  buildSemicircularArchSpec,
  hybridArchBayRect,
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
    expect(openingArchHybridMasonryEnabled(withRing, 'headerBond')).toBe(true)
    expect(openingArchHybridMasonryEnabled(withRing, 'strip')).toBe(false)
    expect(openingArchHybridMasonryEnabled(withRing, 'none')).toBe(false)
    expect(openingArchHybridMasonryEnabled(withRing, null)).toBe(false)

    const alt = roundOpening(normalizeOpeningArch({ enabled: true, form: 'round' }))
    expect(openingArchHybridMasonryEnabled(alt, 'runningBond')).toBe(false)
  })

  it('Hybrid-Polys docken Extrados an Lagerfugen-Y; keine Mikro-Dreiecke', () => {
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
    })
    expect(spec).not.toBeNull()
    const courseYs = archHybridCourseYs(
      [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160],
      spec!.cy,
      spec!.cy + spec!.rOuter,
      16,
    )
    expect(courseYs.length).toBeGreaterThan(1)

    const polys = archHybridVoussoirPolysFromSpec(spec!, courseYs, { panelWidth: 48 })
    expect(polys.length).toBeGreaterThanOrEqual(3)
    expect(polys.length).toBeLessThanOrEqual(spec!.count)

    const dockYs = new Set(courseYs.map((y) => Math.round(y * 10) / 10))
    for (const p of polys) {
      expect(p.outline?.length ?? 0).toBeGreaterThanOrEqual(3)
      expect(p.width).toBeGreaterThan(2)
      expect(p.height).toBeGreaterThan(2)
      // Keine Splitter: Bounding-Fläche und Seitenverhältnis
      expect(p.width * p.height).toBeGreaterThan(12)
      const topY = Math.max(...(p.outline ?? []).map((pt) => pt.y))
      const nearCourse = [...dockYs].some((cy) => Math.abs(cy - topY) < 0.35)
      // Schulter kann am Kämpfer enden; sonst oberste Kante ≈ Lagerfuge
      const atSpring = Math.abs(topY - spec!.cy) < 1
      expect(nearCourse || atSpring || topY >= spec!.cy + spec!.rOuter - 1).toBe(true)
    }

    const bay = hybridArchBayRect(spec!, polys)
    expect(bay.y).toBeLessThanOrEqual(spec!.cy + 0.1)
    expect(bay.y + bay.height).toBeGreaterThanOrEqual(spec!.cy + spec!.rOuter - 1)
  })

  it('Schultersteine können über rOuter hinaus L-förmig sein', () => {
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
    const polys = archHybridVoussoirPolysFromSpec(spec, courseYs, { panelWidth: 48 })
    const left = polys.filter((p) => p.x + p.width / 2 < spec.cx)
    const right = polys.filter((p) => p.x + p.width / 2 > spec.cx)
    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    // Mindestens ein Stein reicht bis ±rOuter (Schulter-Außenkante)
    const hitsOuter =
      polys.some((p) => p.x <= spec.cx - spec.rOuter + 0.5) &&
      polys.some((p) => p.x + p.width >= spec.cx + spec.rOuter - 0.5)
    expect(hitsOuter).toBe(true)
  })
})
