import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOOR_MOTION,
  DEFAULT_WINDOW_MOTION,
  LINEAR_MOTION,
  deleteMotionKey,
  evalMotionCurve,
  insertMotionKey,
  normalizeOpeningMotion,
  parseOpeningMotionDataset,
  openingMotionToDataset,
} from './openingMotion'

describe('openingMotion', () => {
  it('wertet lineare Kurven proportional aus', () => {
    expect(evalMotionCurve(LINEAR_MOTION.open, 0)).toBeCloseTo(0, 5)
    expect(evalMotionCurve(LINEAR_MOTION.open, 0.5)).toBeCloseTo(0.5, 5)
    expect(evalMotionCurve(LINEAR_MOTION.open, 1)).toBeCloseTo(1, 5)
    expect(evalMotionCurve(LINEAR_MOTION.close, 0.25)).toBeCloseTo(0.75, 5)
  })

  it('überdreht die Fenster-Öffnung und landet bei 1', () => {
    const mid = evalMotionCurve(DEFAULT_WINDOW_MOTION.open, 0.78)
    expect(mid).toBeGreaterThan(1)
    expect(evalMotionCurve(DEFAULT_WINDOW_MOTION.open, 1)).toBeCloseTo(1, 5)
  })

  it('startet die Haustür träge', () => {
    const early = evalMotionCurve(DEFAULT_DOOR_MOTION.open, 0.2)
    expect(early).toBeLessThan(0.12)
    expect(evalMotionCurve(DEFAULT_DOOR_MOTION.open, 0.52)).toBeGreaterThan(0.35)
  })

  it('parst den Datensatz und weist unbekannte Formate ab', () => {
    const json = JSON.stringify(openingMotionToDataset(DEFAULT_WINDOW_MOTION, 'window'))
    const parsed = parseOpeningMotionDataset(json, 'window')
    expect(parsed?.open.keys.length).toBeGreaterThan(2)
    expect(parseOpeningMotionDataset('{', 'window')).toBeNull()
    expect(parseOpeningMotionDataset(JSON.stringify({ format: 'other' }), 'window')).toBeNull()
  })

  it('fügt Zwischenpunkte ein und löscht sie', () => {
    const withKey = insertMotionKey(LINEAR_MOTION.open, 0.4, 0.2)
    expect(withKey.keys.length).toBe(3)
    const removed = deleteMotionKey(withKey, 1)
    expect(removed.keys.length).toBe(2)
  })

  it('füllt fehlende Motion aus dem Typ-Default', () => {
    const door = normalizeOpeningMotion(undefined, 'door')
    expect(door.open.holdMs).toBeGreaterThan(0)
    const window = normalizeOpeningMotion({ maxDeg: 70 }, 'window')
    expect(window.maxDeg).toBe(70)
    expect(window.open.keys.length).toBeGreaterThan(1)
  })
})
