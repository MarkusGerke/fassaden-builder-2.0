import { describe, expect, it } from 'vitest'
import type { Wall } from '../types/facade'
import { emptyNeighbors } from '../types/facade'
import { DEFAULT_STUDIO_PANEL, WALL_DEPTH, normalizeStudioPanel } from './constants'
import { masonryPatternCuts, visiblePanelRowRange } from './panelLayout'
import { wallFaceGridXs, wallFaceGridYs } from './placementGrid'

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
      panelHeight: 16,
      plinthEnabled: false,
      plinthHeight: 0,
    },
    ...partial,
  }
}

describe('wallFaceGrid — Verband statt 32-cm', () => {
  it('Vertikalen folgen Stoßfugen (gerade + ungerade Lage)', () => {
    const wall = studioWall({ id: 'w' })
    const panel = normalizeStudioPanel(wall.panel!)
    const xs = wallFaceGridXs(wall, [wall])
    const even = masonryPatternCuts(wall, panel, [wall], 0)
    const odd = masonryPatternCuts(wall, panel, [wall], 1)
    for (const c of even) expect(xs.some((x) => Math.abs(x - c) < 0.1)).toBe(true)
    for (const c of odd) expect(xs.some((x) => Math.abs(x - c) < 0.1)).toBe(true)
    // Kein starres 32-cm-Gitter (z. B. 32 bei 48er-Läufer ohne Fuge)
    expect(xs.includes(32)).toBe(false)
  })

  it('Horizontalen folgen Schichtgrenzen', () => {
    const wall = studioWall({ id: 'w' })
    const panel = normalizeStudioPanel(wall.panel!)
    const ys = wallFaceGridYs(wall)
    const { rowCuts } = visiblePanelRowRange(wall.height, panel)
    expect(ys[0]).toBe(0)
    expect(ys[ys.length - 1]).toBe(wall.height)
    for (const c of rowCuts) {
      expect(ys.some((y) => Math.abs(y - c) < 0.1)).toBe(true)
    }
  })

  it('Streifen: nur Laibungen vertikal, Schichten horizontal', () => {
    const wall = studioWall({
      id: 'strip',
      panel: {
        ...DEFAULT_STUDIO_PANEL,
        enabled: true,
        pattern: 'strip',
        panelWidth: 64,
        panelHeight: 24,
        plinthEnabled: false,
        plinthHeight: 0,
      },
    })
    expect(wallFaceGridXs(wall, [wall])).toEqual([0, wall.width])
    const ys = wallFaceGridYs(wall)
    expect(ys.length).toBeGreaterThan(2)
    expect(ys[0]).toBe(0)
    expect(ys[ys.length - 1]).toBe(wall.height)
  })
})
