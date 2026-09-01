import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL } from './constants'
import { studioMiterLocalX } from './wallMiterX'

function wall(partial: Partial<Wall> = {}): Wall {
  return {
    id: 'w',
    kind: 'studio',
    x: 0,
    y: 0,
    width: 1056,
    height: 256,
    depth: 40,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    panelFlip: false,
    miterStart: 40,
    miterEnd: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    planLinked: true,
    panel: { ...DEFAULT_STUDIO_PANEL, enabled: true, pattern: 'runningBond' },
    ...partial,
  }
}

describe('studioMiterLocalX', () => {
  it('lässt Feld-X ungehrt (Öffnungen)', () => {
    const w = wall()
    const halfW = w.width / 2
    expect(studioMiterLocalX(w, 200, 44, true, true)).toBeCloseTo(200 - halfW, 5)
    expect(studioMiterLocalX(w, 800, 44, true, true)).toBeCloseTo(800 - halfW, 5)
  })

  it('klemmt wallX=0 auf die Gehrungsebene (Außenecke)', () => {
    const w = wall()
    const halfW = w.width / 2
    const z = 44
    expect(studioMiterLocalX(w, 0, z, true, true)).toBeCloseTo(-halfW - z, 5)
  })

  it('füllt den Keil mit wallX < 0 — erste 32 cm Front von der Ecke', () => {
    const w = wall()
    const halfW = w.width / 2
    const z = 44
    const corner = studioMiterLocalX(w, 0, z, true, true)
    const jointWx = 32 - z
    const joint = studioMiterLocalX(w, jointWx, z, true, true)
    expect(jointWx).toBeLessThan(0)
    expect(joint - corner).toBeCloseTo(32, 5)
  })
})
