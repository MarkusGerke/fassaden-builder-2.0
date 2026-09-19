import { describe, expect, it } from 'vitest'
import {
  generateHauswand,
  hauswandPlanHasEntrance,
  parseHauswandSeed,
  randomHauswandSeed,
} from './generateHauswand'
import { hauswandWidthCm } from './hauswandGrid'
import { HAUSWAND_REGELWERK } from './constants'
import { pickHauswandRoof } from './applyHauswandGeneration'

describe('hauswandWidthCm', () => {
  it('entspricht n × 192 + 96 für 96er-Fenster mit 96 cm Abstand und 96 cm Rändern', () => {
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
      expect(plan.widthCm).toBeGreaterThanOrEqual(hauswandWidthCm(plan.axes, plan.windowWidthCm) - 128)
      // Breite kann bei Leerraum-Cap schrumpfen oder durch Füllen wachsen
      expect(plan.widthCm % 8).toBe(0)
      expect(plan.storeys).toBeGreaterThanOrEqual(2)
      expect(plan.storeys).toBeLessThanOrEqual(HAUSWAND_REGELWERK.constraints.storeys.max)
      expect(hauswandPlanHasEntrance(plan)).toBe(true)
    }
  })

  it('zieht nie 1 Geschoss; Schwerpunkt 3–4 Geschosse und 3–7 Achsen', () => {
    const storeys: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 }
    const axes: Record<number, number> = {}
    for (let seed = 0; seed < 800; seed += 1) {
      const plan = generateHauswand(seed)
      expect(plan.storeys).toBeGreaterThanOrEqual(2)
      expect(plan.storeys).toBeLessThanOrEqual(5)
      expect(plan.axes).toBeGreaterThanOrEqual(3)
      expect(plan.axes).toBeLessThanOrEqual(7)
      storeys[plan.storeys] = (storeys[plan.storeys] ?? 0) + 1
      axes[plan.axes] = (axes[plan.axes] ?? 0) + 1
    }
    expect(storeys[3]! + storeys[4]!).toBeGreaterThan(storeys[2]! + storeys[5]!)
    expect((axes[4] ?? 0) + (axes[5] ?? 0) + (axes[6] ?? 0)).toBeGreaterThan(
      (axes[3] ?? 0) + (axes[7] ?? 0),
    )
    expect(axes[8] ?? 0).toBe(0)
    expect(axes[9] ?? 0).toBe(0)
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

  it('randomHauswandSeed liefert uint32', () => {
    const a = randomHauswandSeed()
    const b = randomHauswandSeed()
    expect(a).toBeGreaterThanOrEqual(0)
    expect(a).toBeLessThanOrEqual(0xffffffff)
    expect(b).toBeGreaterThanOrEqual(0)
    expect(b).toBeLessThanOrEqual(0xffffffff)
  })
})

describe('pickHauswandRoof', () => {
  it('schließt Pultdach und Walmdach aus', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const roof = pickHauswandRoof(seed)
      expect(roof.kind).not.toBe('shed')
      expect(roof.kind).not.toBe('hip')
    }
  })
})
