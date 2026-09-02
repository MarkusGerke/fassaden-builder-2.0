import { describe, expect, it } from 'vitest'
import type { Opening } from '../types/facade'
import {
  archVoussoirPolysFromSpec,
  buildSemicircularArchSpec,
  normalizeOpeningArch,
  openingArchVoussoirsEnabled,
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

describe('Rundbogen Keilstein-Ring', () => {
  it('ohne voussoirs: Ring aus — Alt-Save ohne Feld bleibt false', () => {
    const missing = normalizeOpeningArch({ enabled: true, form: 'round' })
    expect(missing.voussoirs).toBe(false)
    expect(openingArchVoussoirsEnabled(roundOpening(missing))).toBe(false)

    const explicitOff = normalizeOpeningArch({
      enabled: true,
      form: 'round',
      voussoirs: false,
    })
    expect(explicitOff.voussoirs).toBe(false)
    expect(openingArchVoussoirsEnabled(roundOpening(explicitOff))).toBe(false)
  })

  it('mit voussoirs: Spec + Ring-Polygone', () => {
    const opening = roundOpening({
      enabled: true,
      form: 'round',
      voussoirs: true,
      riseCm: 48,
    })
    expect(openingArchVoussoirsEnabled(opening)).toBe(true)

    const spec = buildSemicircularArchSpec(opening, {
      panelWidth: 48,
      panelHeight: 8,
      joint: 0.8,
    })
    expect(spec).not.toBeNull()
    expect(spec!.rOuter).toBeGreaterThan(spec!.rInner)
    expect(spec!.count).toBeGreaterThanOrEqual(5)

    const polys = archVoussoirPolysFromSpec(spec!)
    expect(polys.length).toBe(spec!.count)
    for (const p of polys) {
      expect(p.polar).toBeTruthy()
      expect(p.width).toBeGreaterThan(0)
      expect(p.height).toBeGreaterThan(0)
    }
  })

  it('explizites spandrel bond bleibt; rect wird übernommen', () => {
    expect(normalizeOpeningArch({ form: 'round', voussoirs: true, spandrel: 'bond' }).spandrel).toBe(
      'bond',
    )
    expect(normalizeOpeningArch({ form: 'round', voussoirs: true, spandrel: 'rect' }).spandrel).toBe(
      'rect',
    )
  })
})
