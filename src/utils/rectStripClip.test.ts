import { describe, expect, it } from 'vitest'
import { clipRectMinusBox } from './openingGeometry'

/** Assert: bottomArc hat keine Diagonalsegmente (nur lotrecht oder waagerecht). */
function expectNoDiagonalArc(
  parts: Array<{ bottomArc?: Array<{ x: number; y: number }> }>,
): void {
  for (const p of parts) {
    if (!p.bottomArc) continue
    for (let i = 0; i < p.bottomArc.length - 1; i += 1) {
      const a = p.bottomArc[i]!
      const b = p.bottomArc[i + 1]!
      const dy = Math.abs(b.y - a.y)
      const dx = Math.abs(b.x - a.x)
      expect(
        dy < 0.5 || dx < 0.5,
        `Diagonale dx=${dx.toFixed(2)} dy=${dy.toFixed(2)} (${a.x.toFixed(1)},${a.y.toFixed(1)})→(${b.x.toFixed(1)},${b.y.toFixed(1)})`,
      ).toBe(true)
    }
  }
}

function coversPoint(
  parts: Array<{
    x: number
    y: number
    width: number
    height: number
    outline?: Array<{ x: number; y: number }>
  }>,
  px: number,
  py: number,
): boolean {
  for (const p of parts) {
    if (p.outline && p.outline.length >= 3) {
      // Outline: nur wenn Punkt im Polygon (nicht nur BBox)
      let inside = false
      const poly = p.outline
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i]!.x
        const yi = poly[i]!.y
        const xj = poly[j]!.x
        const yj = poly[j]!.y
        if (yi > py !== yj > py && Math.abs(yj - yi) > 1e-12) {
          if (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
        }
      }
      if (inside) return true
      continue
    }
    if (px >= p.x && px <= p.x + p.width && py >= p.y && py <= p.y + p.height) return true
  }
  return false
}

describe('rechteckiges Streifen-Fenster (Sturz-Clip)', () => {
  it('keine Diagonale vom Streifenboden in die Öffnungsecke', () => {
    const strip = { x: 0, y: 200, width: 500, height: 60 }
    const hole = { x: 150, y: 80, width: 120, height: 160 } // top 240
    const parts = clipRectMinusBox(strip, hole)
    expect(parts.length).toBeGreaterThan(0)
    expectNoDiagonalArc(parts)
    expect(parts.every((p) => !p.outline && !p.bottomArc)).toBe(true)

    // Sturz nur oberhalb der Öffnung, nicht im Glas
    const inGlass = coversPoint(parts, hole.x + hole.width / 2, hole.y + hole.height - 20)
    expect(inGlass).toBe(false)
    const lintelOk = coversPoint(parts, hole.x + hole.width / 2, 250)
    expect(lintelOk).toBe(true)
  })

  it('zwei Fenster: erstes Loch bleibt frei, keine Diagonale', () => {
    const strip = { x: 0, y: 200, width: 600, height: 60 }
    const holes = [
      { x: 80, y: 60, width: 140, height: 180 },
      { x: 320, y: 60, width: 140, height: 180 },
    ]
    let parts = [strip]
    for (const hole of holes) {
      parts = parts.flatMap((p) => clipRectMinusBox(p, hole))
    }
    expect(parts.length).toBeGreaterThan(0)
    expectNoDiagonalArc(parts)
    for (const hole of holes) {
      expect(
        coversPoint(parts, hole.x + hole.width / 2, hole.y + hole.height - 20),
        `Loch ${hole.x} wieder bedeckt`,
      ).toBe(false)
    }
  })
})
