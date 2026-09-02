import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import {
  buildTaperedFieldLayout,
  taperedFieldBaseY,
  taperedFieldCourseWidths,
  taperedFieldEndWidths,
  taperedFieldPolysFromLayout,
  normalizeOpeningTaperedField,
} from '../studio/taperedField'

function baseOpening(over: Partial<Opening> = {}): Opening {
  return {
    id: 'o1',
    type: 'window',
    x: 100,
    y: 80,
    width: 96,
    height: 160,
    ...over,
  }
}

const panel = { panelWidth: 32, panelHeight: 24, joint: 0.8 }

describe('taperedField generator', () => {
  it('liefert Trapez-Breiten je Lage ohne Voussoir', () => {
    const widths = taperedFieldCourseWidths(112, 61.6, 3)
    expect(widths).toHaveLength(3)
    expect(widths[0]!.widthBottom).toBeCloseTo(112)
    expect(widths[0]!.widthTop).toBeCloseTo(112 + (61.6 - 112) / 3)
    expect(widths[2]!.widthTop).toBeCloseTo(61.6)
    // Jede Lage schmaler als die darunter (nach oben verjüngend)
    expect(widths[0]!.widthBottom).toBeGreaterThan(widths[1]!.widthBottom)
    expect(widths[1]!.widthBottom).toBeGreaterThan(widths[2]!.widthBottom)
  })

  it('Default: unten breit (Öffnung + Überstand), oben schmaler', () => {
    const ends = taperedFieldEndWidths(96, {
      enabled: true,
      overhangCm: 8,
      topWidthRatio: 0.55,
      invert: false,
    })
    expect(ends.bottomWidth).toBe(112)
    expect(ends.topWidth).toBeCloseTo(112 * 0.55)
  })

  it('invert: nach unten verjüngend', () => {
    const ends = taperedFieldEndWidths(96, {
      enabled: true,
      overhangCm: 8,
      topWidthRatio: 0.55,
      invert: true,
    })
    expect(ends.topWidth).toBe(112)
    expect(ends.bottomWidth).toBeCloseTo(112 * 0.55)
    expect(ends.bottomWidth).toBeLessThan(ends.topWidth)
  })

  it('baut Layout über eckiger Öffnung ohne arch/voussoirs', () => {
    const opening = baseOpening({
      taperedField: { enabled: true, courses: 3, overhangCm: 8 },
    })
    expect(opening.arch?.voussoirs).toBeUndefined()
    const layout = buildTaperedFieldLayout(
      opening,
      normalizeOpeningTaperedField(opening.taperedField),
      panel,
    )
    expect(layout).not.toBeNull()
    expect(layout!.baseY).toBe(80 + 160)
    expect(layout!.courses).toHaveLength(3)
    expect(layout!.bottomWidth).toBeGreaterThan(layout!.topWidth)
    const polys = taperedFieldPolysFromLayout(layout!)
    expect(polys).toHaveLength(3)
    for (const p of polys) {
      expect(p.outline).toBeDefined()
      expect(p.outline!.length).toBe(4)
    }
  })

  it('sitzt über Bogenscheitel wenn arch.enabled (ohne Voussoir)', () => {
    const opening = baseOpening({
      height: 160,
      arch: { enabled: true, form: 'round', riseCm: 48, voussoirs: false },
      taperedField: { enabled: true, courses: 2 },
    })
    const baseY = taperedFieldBaseY(opening, panel)
    // Scheitel = springY + rise; springY = y + height - rise
    expect(baseY).toBeCloseTo(80 + 160) // crown at opening top for full rise=half width? rise 48, width 96 → r=48, spring=y+h-48, crown=spring+48=y+h
    const layout = buildTaperedFieldLayout(
      opening,
      normalizeOpeningTaperedField(opening.taperedField),
      panel,
    )
    expect(layout).not.toBeNull()
    expect(layout!.baseY).toBeCloseTo(baseY)
  })

  it('erzeugt keine Polygone wenn disabled', () => {
    const opening = baseOpening({ taperedField: { enabled: false } })
    expect(
      buildTaperedFieldLayout(opening, normalizeOpeningTaperedField(opening.taperedField), panel),
    ).toBeNull()
  })
})
