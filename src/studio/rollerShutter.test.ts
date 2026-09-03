import { describe, expect, it } from 'vitest'
import {
  normalizeOpeningRollerShutter,
  rollerShutterCoverHeightFromTop,
  rollerShutterSlatCentersFromBottom,
  rollerShutterSlatCount,
  rollerShutterSlatWidth,
  ROLLER_GUIDE_EDGE_INSET_CM,
  ROLLER_STACK_PITCH_FACTOR,
} from './rollerShutter'

describe('rollerShutterSlatCentersFromBottom', () => {
  it('liefert keine Lamellen bei drop 0', () => {
    expect(rollerShutterSlatCentersFromBottom(200, 0, 5, 0.85)).toEqual([])
  })

  it('hängt mit Spalt vom Sturz nach unten (noch nicht auf der Bank)', () => {
    const H = 200
    const h = 5
    const gap = 0.85
    const centers = rollerShutterSlatCentersFromBottom(H, 0.2, h, gap)
    expect(centers.length).toBeGreaterThan(1)
    // Oberste nahe Sturz
    expect(centers[0]!).toBeCloseTo(H - h / 2, 5)
    const spacings: number[] = []
    for (let i = 1; i < centers.length; i += 1) {
      spacings.push(centers[i - 1]! - centers[i]!)
    }
    // Freihängend: Abstände = Höhe + Spalt
    expect(spacings.every((s) => Math.abs(s - (h + gap)) < 0.05)).toBe(true)
    // Unterkante noch über der Bank
    const bottomEdge = centers[centers.length - 1]! - h / 2
    expect(bottomEdge).toBeGreaterThan(0)
  })

  it('stapelt auf der Fensterbank sobald die unterste Lamelle aufsetzt', () => {
    const H = 200
    const h = 5
    const gap = 0.85
    const nMax = rollerShutterSlatCount(H, h)
    const Lmax = (nMax - 1) * (h + gap) + h
    // drop knapp über Kontakt (L ≈ H)
    const dropContact = H / Lmax
    const free = rollerShutterSlatCentersFromBottom(H, dropContact * 0.92, h, gap)
    const bottomFree = free[free.length - 1]! - h / 2
    expect(bottomFree).toBeGreaterThan(-0.5)

    const stacked = rollerShutterSlatCentersFromBottom(H, 1, h, gap)
    expect(stacked.length).toBe(nMax)
    expect(stacked[stacked.length - 1]!).toBeCloseTo(h / 2, 5)
    const spacings: number[] = []
    for (let i = 1; i < stacked.length; i += 1) {
      spacings.push(stacked[i - 1]! - stacked[i]!)
    }
    const topGap = spacings[0]!
    const bottomGap = spacings[spacings.length - 1]!
    expect(bottomGap).toBeLessThan(topGap)
    expect(bottomGap).toBeLessThanOrEqual(h * ROLLER_STACK_PITCH_FACTOR + 0.05)
  })

  it('deckt bei drop 1 die volle Höhe ab', () => {
    const H = 192
    const h = 5
    const cover = rollerShutterCoverHeightFromTop(H, 1, h, 0.85)
    expect(cover).toBeGreaterThanOrEqual(H - 0.5)
  })
})

describe('rollerShutterSlatWidth', () => {
  it('geht bis zur Laibung (volle Öffnungsbreite)', () => {
    expect(ROLLER_GUIDE_EDGE_INSET_CM).toBe(0)
    expect(rollerShutterSlatWidth(96)).toBe(96)
    expect(rollerShutterSlatWidth(144)).toBe(144)
  })
})

describe('normalizeOpeningRollerShutter', () => {
  it('ist standardmäßig deaktiviert', () => {
    expect(normalizeOpeningRollerShutter(undefined).enabled).toBe(false)
    expect(normalizeOpeningRollerShutter({}).drop).toBe(0)
    expect(normalizeOpeningRollerShutter({ enabled: true }).enabled).toBe(true)
  })
})
