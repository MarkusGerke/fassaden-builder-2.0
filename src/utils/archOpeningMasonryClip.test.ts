import { describe, expect, it } from 'vitest'
import type { Opening, Wall } from '../types/facade'
import {
  clipPolysMinusArches,
  clipRectMinusArch,
  normalizeOpeningArch,
  openingArchGeom,
  openingClipRects,
  openingContainsPoint,
  openingHasCurvedMask,
  openingHasRoundMask,
} from './openingGeometry'
import { layoutPanelTiles } from '../studio/panelLayout'
import { normalizeStudioPanel } from '../studio/constants'

/**
 * Spiegelt snapOpeningHolesToTileGrid + buildStudioPanelGeometry-Clip:
 * Bogen → Körperloch aus openingClipRects, Stadion → keine Rechtecklöcher.
 */
function clipLikePanelPipeline(wall: Wall) {
  const panel = wall.panel!
  const tiles = layoutPanelTiles(wall, panel, [])
  const holes = wall.openings.flatMap((o) => {
    if (o.hidden || openingHasRoundMask(o)) return []
    return openingClipRects(o, 0.8 + 0 /* clearance in openingHoles adds panel clearance; 0 for test */)
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
  })
  // With panel clearance 0 for simplicity — openingHoles adds clearance in production.
  // Use same as openingHoles(opening, 0.8) would: inflate 0.8 + clearance.
  const holes2 = wall.openings.flatMap((o) => {
    if (o.hidden || openingHasRoundMask(o)) return []
    return openingClipRects(o, 0.8).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
  })
  void holes
  function subtract(tile: { x: number; y: number; width: number; height: number }, hole: typeof holes2[0]) {
    const parts: typeof holes2 = []
    const x0 = tile.x, x1 = tile.x + tile.width, y0 = tile.y, y1 = tile.y + tile.height
    const hx0 = hole.x, hx1 = hole.x + hole.width, hy0 = hole.y, hy1 = hole.y + hole.height
    if (hx0 >= x1 || hx1 <= x0 || hy0 >= y1 || hy1 <= y0) return [tile]
    if (hx0 > x0) parts.push({ x: x0, y: y0, width: hx0 - x0, height: tile.height })
    if (hx1 < x1) parts.push({ x: hx1, y: y0, width: x1 - hx1, height: tile.height })
    const mx0 = Math.max(x0, hx0), mx1 = Math.min(x1, hx1)
    if (mx1 > mx0) {
      if (hy0 > y0) parts.push({ x: mx0, y: y0, width: mx1 - mx0, height: hy0 - y0 })
      if (hy1 < y1) parts.push({ x: mx0, y: hy1, width: mx1 - mx0, height: y1 - hy1 })
    }
    return parts.filter((p) => p.width > 0.5 && p.height > 0.5)
  }
  let parts = tiles.map((t) => ({ x: t.x, y: t.y, width: t.width, height: t.height }))
  for (const h of holes2) parts = parts.flatMap((p) => subtract(p, h))
  return clipPolysMinusArches(parts, wall.openings, 0.8, panel.panelHeight, {
    panelWidth: panel.panelWidth,
    joint: panel.joint,
  })
}

function countHitsInside(
  clipped: ReturnType<typeof clipPolysMinusArches>,
  opening: Opening,
): { hits: number; samples: number } {
  let hits = 0
  let samples = 0
  for (let xi = 1; xi < 10; xi++) {
    for (let yi = 1; yi < 10; yi++) {
      const x = opening.x + (opening.width * xi) / 10
      const y = opening.y + (opening.height * yi) / 10
      if (!openingContainsPoint(opening, x, y)) continue
      samples++
      for (const c of clipped) {
        if (x < c.x || x > c.x + c.width) continue
        if (c.bottomArc && c.bottomArc.length >= 2) {
          let ay: number | null = null
          for (let i = 0; i < c.bottomArc.length - 1; i++) {
            const a = c.bottomArc[i]!, b = c.bottomArc[i + 1]!
            if (x >= Math.min(a.x, b.x) - 0.1 && x <= Math.max(a.x, b.x) + 0.1) {
              const u = Math.abs(b.x - a.x) < 1e-9 ? 0 : (x - a.x) / (b.x - a.x)
              ay = a.y + u * (b.y - a.y)
              break
            }
          }
          if (ay != null && y >= ay - 0.15) hits++
        } else if (!(c.topArc && c.topArc.length >= 2)) {
          if (y >= c.y && y <= c.y + c.height) hits++
        }
      }
    }
  }
  return { hits, samples }
}

describe('arch opening masonry clip (regression)', () => {
  it('openingClipRects liefert Körperloch für Spitzbogen, nicht für Stadion', () => {
    const pointed = {
      id: 'o', type: 'window', x: 10, y: 10, width: 100, height: 180,
      arch: normalizeOpeningArch({ form: 'pointed', enabled: true }),
    } as Opening
    expect(openingHasCurvedMask(pointed)).toBe(true)
    expect(openingHasRoundMask(pointed)).toBe(false)
    expect(openingClipRects(pointed, 0.8).length).toBe(1)
    expect(openingClipRects(pointed, 0.8)[0]!.height).toBeLessThan(pointed.height)
  })

  for (const form of ['pointed', 'segmental', 'lancet', 'ellipse', 'tudor'] as const) {
    it(`${form}: Paneel-Pipeline lässt Öffnungsinneres frei`, () => {
      const opening = {
        id: 'o1', type: 'window', x: 150, y: 100, width: 120, height: 200,
        arch: normalizeOpeningArch({ form, enabled: true }),
      } as Opening
      const wall = {
        id: 'w1', width: 500, height: 400, depth: 30, x: 0, y: 0, z: 0, rotationY: 0,
        openings: [opening],
        profiles: [],
        neighbors: {},
        panel: normalizeStudioPanel({
          enabled: true,
          pattern: 'stretcherBond',
          panelWidth: 32,
          panelHeight: 12,
          joint: 0.8,
          projectDepth: 4,
        }),
      } as Wall
      const clipped = clipLikePanelPipeline(wall)
      const { hits, samples } = countHitsInside(clipped, opening)
      expect(samples).toBeGreaterThan(10)
      expect(hits, `${form} masonry hits`).toBe(0)
    })
  }

  it('Stein über Kämpfer + Laibung: lotrechte Laibungskante, keine Diagonale im Stein', () => {
    const opening = {
      id: 'o1', type: 'window', x: 150, y: 100, width: 120, height: 200,
      arch: normalizeOpeningArch({ form: 'round', enabled: true }),
    } as Opening
    const geom = openingArchGeom(opening, 0)!
    expect(geom).toBeTruthy()
    const springY = geom.springY
    // Schicht schneidet die Kämpferlinie, Stein läuft von links über die Laibung hinweg.
    const stone = { x: 90, y: springY - 12, width: 100, height: 31.2 }
    const parts = clipRectMinusArch(stone, geom, geom)
    expect(parts.length).toBeGreaterThan(0)
    const withArc = parts.find((p) => p.bottomArc && p.bottomArc.length >= 2)!
    expect(withArc, 'Rest mit bottomArc erwartet').toBeTruthy()
    const arc = withArc.bottomArc!
    // Der Sprung vom Steinboden auf Kämpferhöhe muss lotrecht sein (Laibung), keine Sehne.
    for (let i = 0; i < arc.length - 1; i += 1) {
      const a = arc[i]!
      const b = arc[i + 1]!
      const fromFloor = Math.abs(a.y - stone.y) < 0.05
      const toSpring = b.y > springY - 0.5
      if (fromFloor && toSpring) {
        const dx = Math.abs(b.x - a.x)
        expect(dx, `Diagonale bei x=${a.x.toFixed(2)} (dx=${dx.toFixed(2)})`).toBeLessThan(0.01)
      }
    }
    // Die Laibungs-Ecke (x = Öffnung links, y = Steinboden) bleibt als Punkt erhalten.
    const corner = arc.find((p) => Math.abs(p.x - opening.x) < 0.01 && Math.abs(p.y - stone.y) < 0.05)
    expect(corner, 'Laibungs-Eckpunkt fehlt').toBeTruthy()
  })
})
