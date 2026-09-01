import { describe, expect, it } from 'vitest'
import {
  normalizeOpeningRollerShutter,
  rollerShutterSlatCentersFromBottom,
  rollerShutterSlatCount,
  rollerShutterSlatWidth,
  ROLLER_GUIDE_EDGE_INSET_CM,
} from './rollerShutter'

describe('rollerShutterSlatCentersFromBottom', () => {
  it('liefert keine Lamellen bei drop 0', () => {
    expect(rollerShutterSlatCentersFromBottom(200, 0, 5, 0.85)).toEqual([])
  })

  it('hängt mit Spalt bei teilweiser Absenkung', () => {
    const centers = rollerShutterSlatCentersFromBottom(200, 0.35, 5, 0.85)
    expect(centers.length).toBeGreaterThan(1)
    const spacings: number[] = []
    for (let i = 1; i < centers.length; i += 1) {
      spacings.push(centers[i - 1]! - centers[i]!)
    }
    // Freihängend: Abstände nahe Lamellenhöhe + Spalt
    expect(spacings.every((s) => s > 5.5)).toBe(true)
  })

  it('komprimiert Abstände bei voller Schließung (Stapel unten)', () => {
    const H = 200
    const h = 5
    const gap = 0.85
    const centers = rollerShutterSlatCentersFromBottom(H, 1, h, gap)
    expect(centers.length).toBe(rollerShutterSlatCount(H, h))
    const spacings: number[] = []
    for (let i = 1; i < centers.length; i += 1) {
      spacings.push(centers[i - 1]! - centers[i]!)
    }
    const topGap = spacings[0]!
    const bottomGap = spacings[spacings.length - 1]!
    expect(bottomGap).toBeLessThan(topGap)
    expect(bottomGap).toBeLessThan(h + gap * 0.5)
  })
})

describe('normalizeOpeningRollerShutter', () => {
  it('ist standardmäßig deaktiviert', () => {
    expect(normalizeOpeningRollerShutter(undefined).enabled).toBe(false)
    expect(normalizeOpeningRollerShutter({}).drop).toBe(0)
  })
})

describe('rollerShutterSlatWidth', () => {
  it('zieht beidseitig 8 cm Führung ein', () => {
    expect(ROLLER_GUIDE_EDGE_INSET_CM).toBe(8)
    expect(rollerShutterSlatWidth(96)).toBe(80)
  })
})

describe('normalizeOpeningRollerShutter', () => {
  it('ist standardmäßig deaktiviert', () => {
    expect(normalizeOpeningRollerShutter(undefined).enabled).toBe(false)
    expect(normalizeOpeningRollerShutter({}).drop).toBe(0)
    expect(normalizeOpeningRollerShutter({ enabled: true }).enabled).toBe(true)
  })
})
