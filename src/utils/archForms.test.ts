import { describe, expect, it } from 'vitest'
import {
  ARCH_FORM_IDS,
  clampArchRiseForOpening,
  defaultArchRise,
  normalizeArchFormId,
  resolveArchRiseForOpening,
  sampleArchCrown,
  sampleOpeningArchCrown,
  snapArchRiseCm,
} from './archForms'

describe('archForms', () => {
  it('liefert symmetrische Kronen mit Kämpfer-Endpunkten', () => {
    for (const form of ARCH_FORM_IDS) {
      if (form === 'rect') continue
      const span = 120
      const rise = defaultArchRise(form, span)
      const crown = sampleArchCrown(form, span, rise, 48)
      expect(crown.length, form).toBeGreaterThan(4)
      expect(crown[0]!.x, form).toBeCloseTo(0, 5)
      expect(crown[0]!.y, form).toBeCloseTo(0, 4)
      expect(crown.at(-1)!.x, form).toBeCloseTo(span, 5)
      expect(crown.at(-1)!.y, form).toBeCloseTo(0, 4)
      const apex = crown.reduce((best, p) => (p.y > best.y ? p : best), crown[0]!)
      expect(apex.x, form).toBeCloseTo(span / 2, 0)
      expect(apex.y, form).toBeGreaterThan(rise * 0.85)
    }
  })

  it('trifft beim Spitzbogen die gleichseitige Stichhöhe', () => {
    const span = 100
    const rise = defaultArchRise('pointed', span)
    expect(rise).toBeCloseTo((Math.sqrt(3) / 2) * span, 6)
    const crown = sampleArchCrown('pointed', span, rise, 64)
    const apex = crown.reduce((best, p) => (p.y > best.y ? p : best), crown[0]!)
    expect(apex.y).toBeCloseTo(rise, 4)
    expect(apex.x).toBeCloseTo(span / 2, 4)
  })

  it('kappt das Stichmaß bei niedriger Öffnung', () => {
    const rise = clampArchRiseForOpening('pointed', 200, 80)
    expect(rise).toBeLessThan(80)
    expect(rise).toBeGreaterThan(0)
  })

  it('setzt Öffnungs-Kronen auf die Kämpferlinie', () => {
    const pts = sampleOpeningArchCrown('round', 10, 20, 100, 150, 32)
    expect(pts[0]!.y).toBeCloseTo(20 + 150 - 50, 5)
    expect(pts.at(-1)!.y).toBeCloseTo(20 + 150 - 50, 5)
    const apex = pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]!)
    expect(apex.y).toBeCloseTo(20 + 150, 4)
  })

  it('mappt Legacy Korbbogen (basket) auf ellipse', () => {
    expect(normalizeArchFormId('basket')).toBe('ellipse')
    expect(normalizeArchFormId('basket', 'round')).toBe('ellipse')
    expect(normalizeArchFormId('ellipse')).toBe('ellipse')
    expect(normalizeArchFormId('unknown', 'rect')).toBe('rect')
  })

  it('Rundbogen-Krone erreicht die Kämpfer bei Form-Standard-Stich', () => {
    const span = 120
    const rise = defaultArchRise('round', span)
    const crown = sampleArchCrown('round', span, rise, 32)
    expect(crown[0]!.x).toBeCloseTo(0, 4)
    expect(crown.at(-1)!.x).toBeCloseTo(span, 4)
  })

  it('Rundbogen mit zu kleinem Stichmaß spannt nicht die volle Breite (Formwechsel-Bug)', () => {
    const span = 120
    const smallRise = defaultArchRise('segmental', span)
    const crown = sampleArchCrown('round', span, smallRise, 32)
    expect(crown[0]!.x).toBeGreaterThan(0)
    expect(crown.at(-1)!.x).toBeLessThan(span)
  })

  it('resolveArchRiseForOpening: Form-Standard ohne riseCm', () => {
    const span = 120
    const height = 200
    expect(resolveArchRiseForOpening('round', span, height)).toBeCloseTo(span / 2, 5)
    expect(resolveArchRiseForOpening('segmental', span, height)).toBeCloseTo(span / 6, 5)
    expect(resolveArchRiseForOpening('rect', span, height)).toBe(0)
  })

  it('resolveArchRiseForOpening: manuelles riseCm gerastert und geklemmt', () => {
    const span = 120
    const height = 200
    const manual = resolveArchRiseForOpening('round', span, height, 40)
    expect(manual).toBe(snapArchRiseCm(40))
    expect(manual).toBe(40)

    // Über Max (Öffnungshöhe − Leibungskörper) → gekappt
    const tall = resolveArchRiseForOpening('ellipse', span, 80, 200)
    expect(tall).toBeLessThanOrEqual(80 - 24)
    expect(tall).toBeGreaterThan(0)

    // Rundbogen zusätzlich ≤ Spannweite/2
    const roundCap = resolveArchRiseForOpening('round', 100, 300, 80)
    expect(roundCap).toBe(50)
  })

  it('sampleOpeningArchCrown respektiert manuelles riseCm', () => {
    const pts = sampleOpeningArchCrown('round', 0, 0, 100, 200, 32, 40)
    expect(pts[0]!.y).toBeCloseTo(200 - 40, 5)
    const apex = pts.reduce((best, p) => (p.y > best.y ? p : best), pts[0]!)
    expect(apex.y).toBeCloseTo(200, 4)
  })
})
