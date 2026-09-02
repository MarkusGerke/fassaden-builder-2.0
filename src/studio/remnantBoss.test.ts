import { describe, expect, it } from 'vitest'
import { buildRemnantBossSurface, type BossPt } from './remnantBoss'

function area(ring: BossPt[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i += 1) {
    const p = ring[i]!
    const q = ring[(i + 1) % ring.length]!
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

function rect(x: number, y: number, w: number, h: number): BossPt[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ]
}

/** Rechteck, unten mittig von einem Kreis (Bogen-Scheitel) angeschnitten. */
function crownStone(w: number, h: number, r: number, cy: number): BossPt[] {
  const pts: BossPt[] = [{ x: 0, y: 0 }]
  const x0 = -Math.sqrt(Math.max(0, r * r - cy * cy))
  pts.push({ x: w / 2 + x0, y: 0 })
  const a0 = Math.atan2(-cy, x0)
  const a1 = Math.atan2(-cy, -x0)
  const steps = 24
  for (let i = 1; i < steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps
    pts.push({ x: w / 2 + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  pts.push({ x: w / 2 - x0, y: 0 })
  pts.push({ x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h })
  return pts
}

describe('buildRemnantBossSurface', () => {
  it('volles Rechteck: Deckfläche = Rechteck um die Fase eingezogen, überall volle Weite', () => {
    const s = buildRemnantBossSurface(rect(0, 0, 48, 24), 4)!
    expect(s).toBeTruthy()
    expect(s.tops).toHaveLength(1)
    expect(area(s.tops[0]!)).toBeCloseTo(40 * 16, 3)
    for (const strip of s.strips) for (const t of strip.top) expect(t.t).toBeCloseTo(4, 6)
  })

  it('schmaler Rest (Höhe < 2·Fase): First statt Front, gleiche Steigung', () => {
    const s = buildRemnantBossSurface(rect(0, 0, 48, 6), 4)!
    expect(s.tops).toHaveLength(0)
    // Zwischenstrahlen der langen Kanten enden auf der Mittelachse (t = h/2).
    const mids = s.strips.flatMap((st) => st.top.slice(1, -1))
    expect(mids.length).toBeGreaterThan(4)
    for (const m of mids) {
      expect(m.t).toBeCloseTo(3, 2)
      expect(m.y).toBeCloseTo(3, 2)
    }
  })

  it('Scheitelstein: Kerbe teilt die Deckfläche in links und rechts, Fase bleibt voll', () => {
    // 96 breit, 24 hoch; Bogen r=40, Mittelpunkt 22 unter der Unterkante → Scheitel bei y=18.
    const ring = crownStone(96, 24, 40, -22)
    const c = 4
    const s = buildRemnantBossSurface(ring, c)!
    expect(s.tops).toHaveLength(2)
    for (const top of s.tops) {
      expect(area(top)).toBeGreaterThan(20)
      // Deckfläche liegt vollständig innerhalb des um c eingezogenen Rechtecks.
      for (const p of top) {
        expect(p.x).toBeGreaterThanOrEqual(c - 1e-6)
        expect(p.x).toBeLessThanOrEqual(96 - c + 1e-6)
        expect(p.y).toBeGreaterThanOrEqual(c - 1e-6)
        expect(p.y).toBeLessThanOrEqual(24 - c + 1e-6)
        // und außerhalb des um c vergrößerten Bogens
        // (Polylinie des Bogens liegt bis zu 0,05 cm innerhalb des Kreises)
        expect(Math.hypot(p.x - 48, p.y + 22)).toBeGreaterThanOrEqual(40 + c - 0.1)
      }
    }
    // Über dem Scheitel (6 cm Rest) ist die Oberkante ein First bei t = 3.
    const topEdge = s.strips[s.strips.length - 2]!
    const overCrown = topEdge.top.filter((p) => Math.abs(p.x - 48) < 6)
    expect(overCrown.length).toBeGreaterThan(0)
    for (const p of overCrown) expect(p.t).toBeLessThan(3.6)
    // Ecken der Deckfläche liegen auf Streifen-Firstpunkten (kein Spalt).
    const stripTops = s.strips.flatMap((st) => st.top)
    for (const top of s.tops) {
      for (const p of top) {
        const d = Math.min(...stripTops.map((q) => Math.hypot(q.x - p.x, q.y - p.y)))
        expect(d).toBeLessThan(1e-6)
      }
    }
  })

  it('L-Form (Laibungsstein): eine zusammenhängende Deckfläche mit 6 Ecken', () => {
    const ring: BossPt[] = [
      { x: 0, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: 12 },
      { x: 24, y: 12 },
      { x: 24, y: 24 },
      { x: 0, y: 24 },
    ]
    const s = buildRemnantBossSurface(ring, 3)!
    expect(s.tops).toHaveLength(1)
    expect(s.tops[0]).toHaveLength(6)
    expect(area(s.tops[0]!)).toBeCloseTo(42 * 6 + 18 * 12, 3)
  })

  it('Dreieck (Zwickel): Deckfläche ist ein kleineres Dreieck, Miter läuft am spitzen Winkel weiter ein', () => {
    const s = buildRemnantBossSurface(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 0, y: 20 },
      ],
      2,
    )!
    expect(s.tops).toHaveLength(1)
    expect(s.tops[0]).toHaveLength(3)
    expect(area(s.tops[0]!)).toBeGreaterThan(100)
  })

  it('Realer Reststein neben dem Scheitel (kurze Kante an der Ecke kollabiert): Deckfläche bleibt geschlossen', () => {
    // Aus dem Browser (v2.0.86): 43,6 breit, 22–28 hoch, Bogen steigt nach rechts.
    // Die 2-cm-Kante unten links und die 1,6-cm-Kante unten rechts kollabieren beim
    // Einzug um 6,4 — vorher riss dort die Verkettung und der Stein blieb ohne Front.
    const raw: [number, number][] = [
      [143.254, 354], [144.869, 354], [145.24, 354], [146.484, 354.005], [147.534, 354.009],
      [148.099, 354.164], [149.713, 354.608], [151.328, 355.026], [152.201, 355.25], [152.943, 355.428],
      [154.558, 355.816], [156.173, 356.176], [156.963, 356.352], [157.788, 356.522], [159.377, 356.851],
      [161.017, 357.162], [161.81, 357.313], [162.632, 357.456], [164.247, 357.737], [165.862, 357.993],
      [166.73, 358.13], [167.477, 358.236], [169.092, 358.466], [170.706, 358.673], [171.711, 358.801],
      [172.321, 358.869], [173.936, 359.05], [174.22, 359.081], [175.551, 359.21], [176.74, 359.325],
      [177.166, 359.359], [178.781, 359.491], [179.269, 359.531], [180.396, 359.606], [181.806, 359.7],
      [182.01, 359.71], [183.625, 359.794], [184.349, 359.831], [185.24, 359.864], [186.855, 359.923],
      [186.855, 382], [143.254, 382],
    ]
    const s = buildRemnantBossSurface(raw.map(([x, y]) => ({ x, y })), 6.4)!
    expect(s.tops).toHaveLength(1)
    const top = s.tops[0]!
    expect(area(top)).toBeGreaterThan(300)
    for (const p of top) {
      expect(p.x).toBeGreaterThanOrEqual(143.254 + 6.4 - 1e-6)
      expect(p.x).toBeLessThanOrEqual(186.855 - 6.4 + 1e-6)
      expect(p.y).toBeLessThanOrEqual(382 - 6.4 + 1e-6)
    }
  })

  it('Selbstüberschneidende Kontur (Clip-Müll): kein Boss statt Geometrie-Salat', () => {
    const s = buildRemnantBossSurface(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 30 },
        { x: 20, y: -10 },
        { x: 0, y: 30 },
      ],
      3,
    )
    expect(s).toBeNull()
  })

  it('Krümel: leere Deckfläche, aber keine Exception', () => {
    const s = buildRemnantBossSurface(rect(0, 0, 3, 3), 4)
    expect(s).toBeTruthy()
    expect(s!.tops).toHaveLength(0)
  })
})
