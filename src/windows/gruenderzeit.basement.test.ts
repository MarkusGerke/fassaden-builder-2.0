import { describe, expect, it } from 'vitest'
import {
  clampGruenderzeitForBasement,
  defaultGruenderzeitConfig,
  gruenderzeitConfigForOpening,
} from './gruenderzeit'
import type { Opening } from '../types/facade'

describe('clampGruenderzeitForBasement', () => {
  it('begrenzt Flügel, Oberlicht, Teilung und Sprossen', () => {
    const base = defaultGruenderzeitConfig(120, 64, 'window')
    const clamped = clampGruenderzeitForBasement({
      ...base,
      casements: 3,
      transom: true,
      splitVCount: 3,
      splitHCount: 2,
      paneMuntins: [{ v: 2, h: 2 }],
    })
    expect(clamped.casements).toBe(2)
    expect(clamped.transom).toBe(false)
    expect(clamped.splitVCount).toBe(1)
    expect(clamped.splitHCount).toBe(1)
    expect(clamped.paneMuntins[0]?.v).toBe(1)
    expect(clamped.paneMuntins[0]?.h).toBe(1)
  })

  it('gruenderzeitConfigForOpening wendet Keller-Clamp an', () => {
    const opening: Opening = {
      id: 'o1',
      type: 'window',
      x: 0,
      y: 0,
      width: 48,
      height: 64,
      basementWindow: { enabled: true, grilleHeight: 0.5 },
      gruenderzeit: {
        ...defaultGruenderzeitConfig(48, 64, 'window'),
        casements: 3,
        transom: true,
      },
    }
    const config = gruenderzeitConfigForOpening(opening)
    expect(config.casements).toBeLessThanOrEqual(2)
    expect(config.transom).toBe(false)
  })
})
