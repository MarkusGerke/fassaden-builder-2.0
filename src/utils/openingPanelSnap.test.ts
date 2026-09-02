import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, WALL_DEPTH } from '../studio/constants'
import {
  alignOpeningToMasonry,
  openingMasonryJambXs,
  snapOpeningMoveToMasonry,
  wallUsesOpeningMasonrySnap,
} from './openingPanelSnap'

function studioWall(partial: Partial<Wall> & { id: string }): Wall {
  return {
    id: partial.id,
    kind: 'studio',
    x: 0,
    y: 0,
    width: partial.width ?? 384,
    height: partial.height ?? 256,
    depth: WALL_DEPTH,
    originX: 0,
    originZ: 0,
    yawDeg: 0,
    openings: [],
    profiles: [],
    neighbors: emptyNeighbors(),
    planLinked: true,
    panel: partial.panel ?? {
      ...DEFAULT_STUDIO_PANEL,
      pattern: 'runningBond',
      panelWidth: 48,
      panelHeight: 8,
      plinthEnabled: false,
      plinthHeight: 0,
    },
    ...partial,
  }
}

describe('openingPanelSnap', () => {
  it('erkennt Läuferverband, nicht Streifen', () => {
    const bond = studioWall({ id: 'a' })
    expect(wallUsesOpeningMasonrySnap(bond)).toBe(true)
    const strip = studioWall({
      id: 'b',
      panel: { ...DEFAULT_STUDIO_PANEL, pattern: 'strip', enabled: true },
    })
    expect(wallUsesOpeningMasonrySnap(strip)).toBe(false)
  })

  it('liefert Fugen auf dem Läufer-Modul (gerade + Versatzlage)', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const xs = openingMasonryJambXs(wall, [wall])
    expect(xs).toContain(0)
    expect(xs).toContain(384)
    expect(xs).toContain(48)
    expect(xs).toContain(24)
  })

  it('rückt ±8 cm zur nächsten Fuge, nicht nur 8 cm', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const opening = {
      x: 48,
      y: 32,
      width: 96,
      height: 96,
      type: 'window' as const,
    }
    const right = snapOpeningMoveToMasonry(wall, [wall], opening, 56, 32, 8, 0)
    expect(right.x).toBe(72)
    const left = snapOpeningMoveToMasonry(wall, [wall], opening, 40, 32, -8, 0)
    expect(left.x).toBe(24)
  })

  it('richtet Laibungen beidseitig auf Fugen aus', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const aligned = alignOpeningToMasonry(wall, [wall], {
      x: 50,
      y: 30,
      width: 100,
      height: 100,
      type: 'window',
    })
    const xs = openingMasonryJambXs(wall, [wall])
    expect(xs.some((c) => Math.abs(c - aligned.x) < 0.05)).toBe(true)
    expect(xs.some((c) => Math.abs(c - (aligned.x + aligned.width)) < 0.05)).toBe(true)
  })
})
