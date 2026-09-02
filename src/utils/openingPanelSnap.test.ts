import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, PLAN_DIAGONAL_STEP, WALL_DEPTH } from '../studio/constants'
import { applyTwoHorizontalCladdingZones } from '../studio/facadeLayers'
import {
  alignOpeningToMasonry,
  commonMasonrySnapStepCm,
  DRAG_SNAP_MAGNET_CM,
  masonryFacadeStack,
  openingMasonryJambXs,
  openingPlacementCandidateXs,
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

  it('Kandidaten: Fuge, Steinmitte und Wandmitte', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const width = 96
    const xs = openingPlacementCandidateXs(wall, [wall], width)
    // Fuge
    expect(xs).toContain(48)
    // Steinmitte 24–48 → mid 36 → x = 36 - 48 = -12 verworfen; Stein 48–72 → mid 60 → x = 12
    expect(xs.some((x) => Math.abs(x - 12) < 0.05)).toBe(true)
    // Wandmitte
    expect(xs.some((x) => Math.abs(x - (384 / 2 - width / 2)) < 0.05)).toBe(true)
  })

  it('45°-Wand: Wandmitte ist Snap-Ziel auch wenn nicht auf Fugenraster', () => {
    const width = 128
    const wallW = PLAN_DIAGONAL_STEP * 4 // ≈ 271.53, Hälfte nicht auf 8/24-Raster
    const wall = studioWall({
      id: 'diag',
      width: wallW,
      yawDeg: 45,
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 8,
        plinthEnabled: false,
        plinthHeight: 0,
      },
    })
    const centerX = wallW / 2 - width / 2
    const xs = openingPlacementCandidateXs(wall, [wall], width)
    expect(xs.some((x) => Math.abs(x - centerX) < 0.05)).toBe(true)

    const opening = { x: 0, y: 32, width, height: 96, type: 'window' as const }
    const snapped = snapOpeningMoveToMasonry(
      wall,
      [wall],
      opening,
      centerX + 2,
      32,
      centerX + 2,
      0,
      'drag',
    )
    expect(Math.abs(snapped.x - centerX)).toBeLessThan(0.05)
    expect(Math.abs(snapped.x + width / 2 - wallW / 2)).toBeLessThan(0.05)
  })

  it('Nudge springt zum nächsten Kandidaten; Drag nur Fuge + Magnet', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const opening = {
      x: 48,
      y: 32,
      width: 96,
      height: 96,
      type: 'window' as const,
    }
    const full = openingPlacementCandidateXs(wall, [wall], 96, undefined, 'full')
    const after48 = full.find((c) => c > 48 + 0.05)!
    const nudged = snapOpeningMoveToMasonry(wall, [wall], opening, 56, 32, 8, 0, 'nudge')
    expect(nudged.x).toBe(after48)

    // Nahe Fuge 48 (≤ Magnet) → rastet
    const nearFlush = snapOpeningMoveToMasonry(wall, [wall], opening, 48 + 4, 32, 4, 0, 'drag')
    expect(nearFlush.x).toBe(48)

    // Außerhalb Magnet → freie Position (kein Springen zur nächsten Fuge)
    const freeX = 48 + DRAG_SNAP_MAGNET_CM + 2
    const free = snapOpeningMoveToMasonry(wall, [wall], opening, freeX, 32, freeX - 48, 0, 'drag')
    expect(free.x).toBe(freeX)
  })

  it('Drag-Kandidaten ohne Steinmitten; Nudge behält Steinmitte', () => {
    const wall = studioWall({ id: 'w', width: 384 })
    const width = 96
    const dragXs = openingPlacementCandidateXs(wall, [wall], width, undefined, 'drag')
    const fullXs = openingPlacementCandidateXs(wall, [wall], width, undefined, 'full')
    // Steinmitte 48–72 → mid 60 → x = 12
    expect(fullXs.some((x) => Math.abs(x - 12) < 0.05)).toBe(true)
    expect(dragXs.some((x) => Math.abs(x - 12) < 0.05)).toBe(false)
    expect(dragXs).toContain(48)
    expect(dragXs.some((x) => Math.abs(x - (384 / 2 - width / 2)) < 0.05)).toBe(true)
  })

  it('richtet Laibungen beidseitig auf Fugen aus wenn Breite snappt', () => {
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

  it('snapt bei gemischtem Stapel auf gemeinsames Cut-Raster', () => {
    const lower = studioWall({ id: 'eg', y: 0, width: 384, panel: panel48 })
    const upper = studioWall({ id: 'og', y: 448, width: 384, panel: panel24 })
    const walls = [lower, upper]
    const xsLower = openingMasonryJambXs(lower, walls)
    expect(xsLower).toContain(0)
    expect(xsLower).toContain(24)
    expect(xsLower).toContain(48)
    expect(xsLower).not.toContain(12)

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
    const next = openingPlacementCandidateXs(lower, walls, 96).find((c) => c > 0.05)!
    expect(moved.x).toBe(next)
  })

  it('alleinstehende 24er-Wand behält Halbstein-Fugen (12)', () => {
    const only = studioWall({ id: 'solo', width: 384, panel: panel24 })
    const xs = openingMasonryJambXs(only, [only])
    expect(xs).toContain(12)
    expect(xs).toContain(24)
  })
})

describe('Multi-Zone Snap (48 unten / 24 oben)', () => {
  it('Cuts unten vs. oben folgen dem Zonen-Modul', () => {
    const base = studioWall({
      id: 'bands',
      width: 384,
      height: 256,
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        pattern: 'runningBond',
        panelWidth: 48,
        panelHeight: 8,
        plinthEnabled: false,
        plinthHeight: 0,
      },
    })
    const wall = applyTwoHorizontalCladdingZones(base, {
      splitYCm: 128,
      lowerPanelWidth: 48,
      upperPanelWidth: 24,
    })

    const lowerY = 64 // Mitte unteres Band
    const upperY = 192 // Mitte oberes Band
    const xsLower = openingMasonryJambXs(wall, [wall], lowerY)
    const xsUpper = openingMasonryJambXs(wall, [wall], upperY)

    expect(xsLower).toContain(48)
    expect(xsLower).toContain(24) // Halbstein der 48er-Lage
    expect(xsLower).not.toContain(12)

    expect(xsUpper).toContain(24)
    expect(xsUpper).toContain(12) // Halbstein der 24er-Lage

    const candLower = openingPlacementCandidateXs(wall, [wall], 96, lowerY)
    const candUpper = openingPlacementCandidateXs(wall, [wall], 96, upperY)
    // Unteres Modul: Fuge 48 ist Kandidat; oberes Raster hat feinere Schritte
    expect(candLower).toContain(48)
    expect(candUpper.some((x) => Math.abs(x - 12) < 0.05)).toBe(true)
  })

  it('ohne atY bleibt Verhalten wie wall.panel (unteres Modul)', () => {
    const wall = applyTwoHorizontalCladdingZones(
      studioWall({
        id: 'bands2',
        width: 384,
        height: 256,
        panel: {
          ...DEFAULT_STUDIO_PANEL,
          pattern: 'runningBond',
          panelWidth: 48,
          panelHeight: 8,
          plinthEnabled: false,
          plinthHeight: 0,
        },
      }),
      { splitYCm: 128, lowerPanelWidth: 48, upperPanelWidth: 24 },
    )
    const xs = openingMasonryJambXs(wall, [wall])
    expect(xs).toContain(48)
    expect(xs).not.toContain(12)
  })
})
