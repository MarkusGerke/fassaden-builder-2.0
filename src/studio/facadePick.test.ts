import { describe, expect, it } from 'vitest'
import {
  ceilingBeatsFacadeMesh,
  isNonPickableIndoorKind,
  isSelectableCeilingKind,
  roofBeatsFacadeMesh,
} from './facadePick'

describe('facadePick', () => {
  it('schließt Schatten-Okkluder und Soffits von der Deckenwahl aus', () => {
    expect(isNonPickableIndoorKind('sunCeilingOccluder')).toBe(true)
    expect(isNonPickableIndoorKind('baySoffit')).toBe(true)
    expect(isNonPickableIndoorKind('bayMouthSunOccluder')).toBe(true)
    expect(isSelectableCeilingKind('sunCeilingOccluder', 'ceiling')).toBe(false)
    expect(isSelectableCeilingKind('ceiling', 'ceiling')).toBe(true)
    expect(isSelectableCeilingKind('floor', 'floor')).toBe(true)
  })

  it('Fassade gewinnt bei gleichem Abstand und wenn sie näher ist', () => {
    expect(ceilingBeatsFacadeMesh(100, 100)).toBe(false)
    expect(ceilingBeatsFacadeMesh(100.2, 100)).toBe(false)
    // Knapp davor reicht nicht (eps 12) — Deckenkante an der Fassade.
    expect(ceilingBeatsFacadeMesh(99, 100)).toBe(false)
    expect(ceilingBeatsFacadeMesh(87, 100)).toBe(true)
    expect(ceilingBeatsFacadeMesh(50, Infinity)).toBe(true)
  })

  it('Dach gewinnt nur mit klarem Vorsprung vor der Fassade (eps 6)', () => {
    expect(roofBeatsFacadeMesh(100, 100)).toBe(false)
    expect(roofBeatsFacadeMesh(95, 100)).toBe(false)
    expect(roofBeatsFacadeMesh(93, 100)).toBe(true)
    expect(roofBeatsFacadeMesh(50, Infinity)).toBe(true)
  })
})
