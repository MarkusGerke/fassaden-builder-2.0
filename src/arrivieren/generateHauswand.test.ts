import { describe, expect, it } from 'vitest'
import { generateHauswand, parseHauswandSeed } from './generateHauswand'
import { pickHauswandRoof } from './applyHauswandGeneration'
import { hauswandWidthCm } from './hauswandGrid'
import { HAUSWAND_REGELWERK } from './constants'

describe('hauswandWidthCm', () => {
  it('entspricht n × 192 + 96 für 96er-Fenster mit 96 cm Abstand und Rändern', () => {
    expect(hauswandWidthCm(3)).toBe(3 * 192 + 96)
    expect(hauswandWidthCm(6)).toBe(6 * 192 + 96)
    expect(hauswandWidthCm(9)).toBe(9 * 192 + 96)
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
      expect(plan.widthCm).toBe(hauswandWidthCm(plan.axes, plan.windowWidthCm))
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

  it('Fensterbreite nur 96 oder 144 (92/8)', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const w = generateHauswand(seed).windowWidthCm
      expect(w === 96 || w === 144).toBe(true)
    }
  })
})

describe('pickHauswandRoof', () => {
  it('ohne Pultdach und Walmdach', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const kind = pickHauswandRoof(seed).kind
      expect(kind).not.toBe('shed')
      expect(kind).not.toBe('hip')
    }
  })
})
