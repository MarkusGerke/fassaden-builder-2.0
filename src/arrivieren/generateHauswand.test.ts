import { describe, expect, it } from 'vitest'
import { generateHauswand, parseHauswandSeed } from './generateHauswand'
import { hauswandWidthCm } from './hauswandGrid'
import { HAUSWAND_REGELWERK } from './constants'

describe('hauswandWidthCm', () => {
  it('entspricht n * 144 + 48 für Standardfenster', () => {
    expect(hauswandWidthCm(3)).toBe(3 * 144 + 48)
    expect(hauswandWidthCm(6)).toBe(6 * 144 + 48)
    expect(hauswandWidthCm(9)).toBe(9 * 144 + 48)
  })
})

describe('generateHauswand', () => {
  it('ist deterministisch für denselben Seed', () => {
    const a = generateHauswand(42)
    const b = generateHauswand(42)
    expect(b).toEqual(a)
  })

  it('hält Achsen im Soft-Bereich und Breite konsistent', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const plan = generateHauswand(seed)
      expect(plan.axes).toBeGreaterThanOrEqual(HAUSWAND_REGELWERK.constraints.axes.min)
      expect(plan.axes).toBeLessThanOrEqual(HAUSWAND_REGELWERK.constraints.axes.softMax)
      expect(plan.widthCm).toBe(hauswandWidthCm(plan.axes))
      expect(plan.storeys).toBeGreaterThanOrEqual(HAUSWAND_REGELWERK.constraints.storeys.min)
      expect(plan.storeys).toBeLessThanOrEqual(HAUSWAND_REGELWERK.constraints.storeys.max)
    }
  })

  it('Erker nur bei Gate (≥4 Geschosse und ≥4 Achsen)', () => {
    let withBay = 0
    let gated = 0
    for (let seed = 0; seed < 200; seed += 1) {
      const plan = generateHauswand(seed)
      const gate = plan.storeys >= 4 && plan.axes >= 4
      if (gate) gated += 1
      if (plan.bay) {
        expect(gate).toBe(true)
        expect(plan.storeys).toBeGreaterThanOrEqual(4)
        expect(plan.axes).toBeGreaterThanOrEqual(4)
        withBay += 1
      }
    }
    expect(gated).toBeGreaterThan(0)
    expect(withBay).toBeGreaterThan(0)
  })

  it('parst String-Seeds stabil', () => {
    expect(parseHauswandSeed('12345')).toBe(12345)
    expect(parseHauswandSeed('demo')).toBe(parseHauswandSeed('demo'))
  })
})
