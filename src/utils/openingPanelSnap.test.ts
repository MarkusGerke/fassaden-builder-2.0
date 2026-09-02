import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, WALL_DEPTH } from '../studio/constants'
import {
  alignOpeningToMasonry,
  commonMasonrySnapStepCm,
  masonryFacadeStack,
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
    buildingId: 'b1',
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

  it('rückt per Nudge zur nächsten Fuge; Drag snapt absolut ohne Überspringen', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const opening = {
      x: 48,
      y: 32,
      width: 96,
      height: 96,
      type: 'window' as const,
    }
    const nudged = snapOpeningMoveToMasonry(wall, [wall], opening, 56, 32, 8, 0, 'nudge')
    expect(nudged.x).toBe(72)
    // Drag: Vorschlag 56 → nächste Fuge 48 (nicht adjacent 72)
    const dragged = snapOpeningMoveToMasonry(wall, [wall], opening, 56, 32, 8, 0, 'drag')
    expect(dragged.x).toBe(48)
    const draggedFar = snapOpeningMoveToMasonry(wall, [wall], opening, 70, 32, 22, 0, 'drag')
    expect(draggedFar.x).toBe(72)
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

describe('gemeinsames Raster 24er + 48er Etagen', () => {
  const panel24 = {
    ...DEFAULT_STUDIO_PANEL,
    pattern: 'runningBond' as const,
    panelWidth: 24,
    panelHeight: 8,
    joint: 0.8,
    plinthEnabled: false,
    plinthHeight: 0,
  }
  const panel48 = {
    ...DEFAULT_STUDIO_PANEL,
    pattern: 'runningBond' as const,
    panelWidth: 48,
    panelHeight: 16,
    joint: 1.2,
    plinthEnabled: false,
    plinthHeight: 0,
  }

  it('findet gestapelte Fassaden und LCM-Schritt 24', () => {
    const lower = studioWall({ id: 'eg', y: 0, width: 384, panel: panel48 })
    const upper = studioWall({ id: 'og', y: 448, width: 384, panel: panel24 })
    const stack = masonryFacadeStack(lower, [lower, upper])
    expect(stack).toHaveLength(2)
    expect(commonMasonrySnapStepCm(stack)).toBe(24)
  })

  it('snapt bei gemischtem Stapel auf 24 cm (nicht 12)', () => {
    const lower = studioWall({ id: 'eg', y: 0, width: 384, panel: panel48 })
    const upper = studioWall({ id: 'og', y: 448, width: 384, panel: panel24 })
    const walls = [lower, upper]
    const xsLower = openingMasonryJambXs(lower, walls)
    const xsUpper = openingMasonryJambXs(upper, walls)
    // Gemeinsames Raster: alle 24 cm — 12 wäre nur auf dem 24er bündig.
    expect(xsLower).toContain(0)
    expect(xsLower).toContain(24)
    expect(xsLower).toContain(48)
    expect(xsLower).not.toContain(12)
    expect(xsUpper).toEqual(xsLower)

    const moved = snapOpeningMoveToMasonry(
      lower,
      walls,
      { x: 0, y: 32, width: 96, height: 96, type: 'window' },
      8,
      32,
      8,
      0,
      'nudge',
    )
    expect(moved.x).toBe(24)
  })

  it('alleinstehende 24er-Wand behält Halbstein-Fugen (12)', () => {
    const only = studioWall({ id: 'solo', width: 384, panel: panel24 })
    const xs = openingMasonryJambXs(only, [only])
    expect(xs).toContain(12)
    expect(xs).toContain(24)
  })
})
