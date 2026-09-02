/**
 * Bossen-Dachfläche einer beliebigen Restform (Stein, von einer Öffnung maskiert).
 *
 * Volle Steine sind ein Pyramidenstumpf: Fase `chamfer` breit, Front `depth` vor.
 * Ein Reststein (3, 4, n Ecken, Bogenkante) bekommt dieselbe Fase — nicht kleiner
 * skaliert, nicht steiler. Wo der Rest schmaler als zwei Fasen ist, laufen die
 * Fasen in einen First zusammen (Dach), die Front dort hat Nullbreite.
 *
 * Konstruktion ohne Polygon-Offset-Bibliothek: Von jedem Randpunkt läuft ein
 * Strahl entlang der Innennormale (an Ecken entlang der Winkelhalbierenden, Miter)
 * bis zur Fasenbreite — oder bis er die Mittelachse trifft (`ridgeT`: der Punkt ist
 * genau so weit vom Rand entfernt wie gelaufen). Zwischen benachbarten Strahlen
 * entstehen Quads (Fasenstreifen), die Strahlenden bilden die Deckfläche.
 * `t` ist die erreichte Weite (0..chamfer); Höhe = depth · t / chamfer.
 */

export type BossPt = { x: number; y: number }
export type BossTopPt = { x: number; y: number; t: number }

export interface RemnantBossSurface {
  /** Pro Außenkante: Basispunkte (auf der Kante) und Firstpunkte, gleiche Länge. */
  strips: { base: BossPt[]; top: BossTopPt[] }[]
  /**
   * Deckflächen (volle Fase erreicht) als geschlossene CCW-Ringe — mehrere, wenn
   * ein First die Front teilt (z. B. Scheitelstein: links und rechts der Kerbe).
   */
  tops: BossPt[][]
}

export interface RemnantBossOptions {
  /** Firstpunkt nachträglich auf Bündig-Ebenen ziehen (Wandende). */
  pin?: (base: BossPt, top: BossPt) => BossPt
  /** Abstand der Zwischenstrahlen auf langen Kanten (cm). Default max(0.75·chamfer, 2). */
  sampleSpacing?: number
}

const EPS_PT = 1e-4
const RIDGE_EPS = 2e-3
const BISECT_STEPS = 16

function ringArea(pts: BossPt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    a += p.x * q.y - q.x * p.y
  }
  return a / 2
}

function cleanCcw(ring: BossPt[]): BossPt[] {
  const out: BossPt[] = []
  for (const p of ring) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > EPS_PT) out.push({ x: p.x, y: p.y })
  }
  while (out.length >= 2) {
    const a = out[0]!
    const b = out[out.length - 1]!
    if (Math.hypot(a.x - b.x, a.y - b.y) > EPS_PT) break
    out.pop()
  }
  // Kollineare Zwischenpunkte auf geraden Kanten entfernen (sonst Null-Winkel-Miter).
  const n = out.length
  if (n < 3) return out
  const keep: BossPt[] = []
  for (let i = 0; i < n; i += 1) {
    const a = out[(i - 1 + n) % n]!
    const b = out[i]!
    const c = out[(i + 1) % n]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)
    if (Math.abs(cross) < 1e-7 && dot > 0) continue
    keep.push(b)
  }
  if (keep.length < 3) return keep
  return ringArea(keep) < 0 ? keep.reverse() : keep
}

function pointInRing(p: BossPt, ring: BossPt[]): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const a = ring[i]!
    const b = ring[j]!
    if (a.y > p.y !== b.y > p.y) {
      const x = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y)
      if (p.x < x) inside = !inside
    }
  }
  return inside
}

/** Einfacher Ring: keine sich kreuzenden, nicht benachbarten Kanten (sonst Geometrie-Müll). */
function ringIsSimple(ring: BossPt[]): boolean {
  const n = ring.length
  for (let i = 0; i < n; i += 1) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue
      if (segSegIntersect(a, b, ring[j]!, ring[(j + 1) % n]!)) return false
    }
  }
  return true
}

function segSegIntersect(
  a: BossPt,
  b: BossPt,
  c: BossPt,
  d: BossPt,
): { u: number; v: number; p: BossPt } | null {
  const dax = b.x - a.x
  const day = b.y - a.y
  const dbx = d.x - c.x
  const dby = d.y - c.y
  const det = dax * dby - day * dbx
  if (Math.abs(det) < 1e-12) return null
  const u = ((c.x - a.x) * dby - (c.y - a.y) * dbx) / det
  const v = ((c.x - a.x) * day - (c.y - a.y) * dax) / det
  if (u <= 1e-9 || u >= 1 - 1e-9 || v <= 1e-9 || v >= 1 - 1e-9) return null
  return { u, v, p: { x: a.x + u * dax, y: a.y + u * day } }
}

/**
 * Exakte Offset-Ringe (Abstand `dist` nach innen) einer einfachen CCW-Kontur:
 * Rohoffset mit Miter-Ecken, Kreuzungen nicht benachbarter Offset-Kanten,
 * Teilstücke behalten, deren Mitte wirklich `dist` vom Rand liegt, verketten.
 * Liefert 0 Ringe, wenn die Form überall schmaler als 2·dist ist.
 */
function offsetLoops(
  pts: BossPt[],
  normals: BossPt[],
  dist: number,
  distToBoundary: (p: BossPt) => number,
): { loops: BossPt[][]; miters: BossPt[]; cutsByEdge: Map<number, BossPt[]> } {
  const n = pts.length
  const miters: BossPt[] = []
  for (let i = 0; i < n; i += 1) {
    const v = pts[i]!
    const n1 = normals[(i - 1 + n) % n]!
    const n2 = normals[i]!
    const dot = n1.x * n2.x + n1.y * n2.y
    if (dot < -0.995) {
      miters.push({ x: v.x + n2.x * dist, y: v.y + n2.y * dist })
      continue
    }
    const f = dist / (1 + dot)
    miters.push({ x: v.x + (n1.x + n2.x) * f, y: v.y + (n1.y + n2.y) * f })
  }

  type Raw = { i: number; a: BossPt; b: BossPt; cuts: { u: number; p: BossPt }[] }
  // Umgedrehte Offset-Kanten (Kante kürzer als die Miter-Verschiebung) tragen nichts
  // bei; ihre Nachbarn werden über das Loch hinaus verlängert, damit sie sich (oder
  // eine dritte Offset-Kante) schneiden können — sonst reißt die Verkettung.
  const inverted: boolean[] = []
  for (let i = 0; i < n; i += 1) {
    const a = miters[i]!
    const b = miters[(i + 1) % n]!
    const ex = pts[(i + 1) % n]!.x - pts[i]!.x
    const ey = pts[(i + 1) % n]!.y - pts[i]!.y
    inverted.push((b.x - a.x) * ex + (b.y - a.y) * ey <= 0)
  }
  const raws: Raw[] = []
  const ext = dist * 3
  for (let i = 0; i < n; i += 1) {
    if (inverted[i]) continue
    let a = miters[i]!
    let b = miters[(i + 1) % n]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    if (inverted[(i - 1 + n) % n]) a = { x: a.x - (dx / len) * ext, y: a.y - (dy / len) * ext }
    if (inverted[(i + 1) % n]) b = { x: b.x + (dx / len) * ext, y: b.y + (dy / len) * ext }
    raws.push({ i, a, b, cuts: [] })
  }
  for (let p = 0; p < raws.length; p += 1) {
    for (let q = p + 1; q < raws.length; q += 1) {
      const A = raws[p]!
      const B = raws[q]!
      const adjacent = (A.i + 1) % n === B.i || (B.i + 1) % n === A.i
      if (adjacent) continue
      const hit = segSegIntersect(A.a, A.b, B.a, B.b)
      if (!hit) continue
      A.cuts.push({ u: hit.u, p: hit.p })
      B.cuts.push({ u: hit.v, p: hit.p })
    }
  }

  type Piece = { a: BossPt; b: BossPt }
  const pieces: Piece[] = []
  const minDist = dist - Math.max(RIDGE_EPS, dist * 2e-3)
  const cutsByEdge = new Map<number, BossPt[]>()
  for (const raw of raws) {
    raw.cuts.sort((x, y) => x.u - y.u)
    if (raw.cuts.length > 0) cutsByEdge.set(raw.i, raw.cuts.map((c) => c.p))
    const chain = [raw.a, ...raw.cuts.map((c) => c.p), raw.b]
    for (let k = 0; k < chain.length - 1; k += 1) {
      const a = chain[k]!
      const b = chain[k + 1]!
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (!pointInRing(mid, pts)) continue
      if (distToBoundary(mid) < minDist) continue
      pieces.push({ a, b })
    }
  }

  const byStart = new Map<BossPt, Piece>()
  for (const piece of pieces) byStart.set(piece.a, piece)
  const used = new Set<Piece>()
  const loops: BossPt[][] = []
  for (const start of pieces) {
    if (used.has(start)) continue
    const loop: BossPt[] = []
    let cur: Piece | undefined = start
    let closed = false
    while (cur && !used.has(cur)) {
      used.add(cur)
      loop.push(cur.a)
      if (cur.b === start.a) {
        closed = true
        break
      }
      cur = byStart.get(cur.b)
    }
    if (!closed) continue
    const clean = loop.filter(
      (p, idx) => idx === 0 || Math.hypot(p.x - loop[idx - 1]!.x, p.y - loop[idx - 1]!.y) > EPS_PT,
    )
    if (clean.length >= 3 && ringArea(clean) > 1e-3) loops.push(clean)
  }
  return { loops, miters, cutsByEdge }
}

function segDist(p: BossPt, a: BossPt, b: BossPt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-14) return Math.hypot(p.x - a.x, p.y - a.y)
  let u = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  u = u < 0 ? 0 : u > 1 ? 1 : u
  return Math.hypot(p.x - a.x - u * dx, p.y - a.y - u * dy)
}

export function buildRemnantBossSurface(
  ring: BossPt[],
  chamfer: number,
  opts: RemnantBossOptions = {},
): RemnantBossSurface | null {
  if (chamfer <= 1e-6) return null
  const pts = cleanCcw(ring)
  const n = pts.length
  if (n < 3 || !ringIsSimple(pts)) return null

  const normals: BossPt[] = []
  const lens: number[] = []
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const len = Math.hypot(ex, ey) || 1
    lens.push(len)
    normals.push({ x: -ey / len, y: ex / len })
  }

  const distToBoundary = (p: BossPt): number => {
    let d = Infinity
    for (let i = 0; i < n; i += 1) {
      const v = segDist(p, pts[i]!, pts[(i + 1) % n]!)
      if (v < d) d = v
    }
    return d
  }

  /**
   * Weite entlang eines Strahls, bis die Fase erreicht ist oder der Punkt die
   * Mittelachse trifft (Abstand zum Rand = gelaufene Weite).
   */
  const ridgeT = (from: BossPt, dir: BossPt, scale: number): number => {
    const at = (t: number): BossPt => ({
      x: from.x + dir.x * scale * t,
      y: from.y + dir.y * scale * t,
    })
    const ok = (t: number) => distToBoundary(at(t)) >= t - RIDGE_EPS
    if (ok(chamfer)) return chamfer
    let lo = 0
    let hi = chamfer
    for (let k = 0; k < BISECT_STEPS; k += 1) {
      const mid = (lo + hi) / 2
      if (ok(mid)) lo = mid
      else hi = mid
    }
    return lo
  }

  const finish = (base: BossPt, dir: BossPt, scale: number): BossTopPt => {
    const t = ridgeT(base, dir, scale)
    let top: BossPt = { x: base.x + dir.x * scale * t, y: base.y + dir.y * scale * t }
    if (opts.pin) top = opts.pin(base, top)
    return { x: top.x, y: top.y, t }
  }

  // Ecken: Miter entlang (n1 + n2), Länge t / cos(φ/2) → Faktor 1/(1 + n1·n2).
  const miters: BossTopPt[] = []
  for (let i = 0; i < n; i += 1) {
    const n1 = normals[(i - 1 + n) % n]!
    const n2 = normals[i]!
    const dot = n1.x * n2.x + n1.y * n2.y
    if (dot < -0.995) {
      miters.push(finish(pts[i]!, n2, 1))
      continue
    }
    miters.push(finish(pts[i]!, { x: n1.x + n2.x, y: n1.y + n2.y }, 1 / (1 + dot)))
  }

  const offset = offsetLoops(pts, normals, chamfer, distToBoundary)

  const spacing = Math.max(opts.sampleSpacing ?? Math.max(chamfer * 0.75, 2), 0.5)
  const strips: RemnantBossSurface['strips'] = []
  for (let i = 0; i < n; i += 1) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const len = lens[i]!
    const nrm = normals[i]!
    // Zwischenstrahlen: gleichmäßig auf langen Kanten (First-Erkennung) plus die
    // Fußpunkte der Offset-Kreuzungen, damit der Streifen die Deckflächen-Ecke trifft.
    // Die Eckzonen (eine Fase breit) deckt der Miter ab — dort keine Zwischenstrahlen.
    const us: number[] = []
    const inner = len - 2 * chamfer
    const k = inner > chamfer * 0.5 ? Math.floor(inner / spacing) : 0
    for (let j = 1; j <= k; j += 1) us.push((chamfer + (inner * j) / (k + 1)) / len)
    for (const cut of offset.cutsByEdge.get(i) ?? []) {
      const fx = cut.x - nrm.x * chamfer
      const fy = cut.y - nrm.y * chamfer
      const u = ((fx - a.x) * (b.x - a.x) + (fy - a.y) * (b.y - a.y)) / (len * len)
      if (u > 1e-3 && u < 1 - 1e-3) us.push(u)
    }
    us.sort((p, q) => p - q)
    const base: BossPt[] = [a]
    const tops: BossTopPt[] = [miters[i]!]
    let lastU = 0
    for (const u of us) {
      if (u - lastU < 1e-3) continue
      lastU = u
      const s: BossPt = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }
      base.push(s)
      tops.push(finish(s, nrm, 1))
    }
    base.push(b)
    tops.push(miters[(i + 1) % n]!)
    strips.push({ base, top: tops })
  }

  // Deckflächen: Miter-Ecken ggf. wie die Streifen auf Bündig-Ebenen ziehen.
  const miterBase = new Map<BossPt, BossPt>()
  offset.miters.forEach((m, i) => miterBase.set(m, pts[i]!))
  const tops = offset.loops.map((loop) =>
    loop.map((p) => {
      const base = miterBase.get(p)
      return opts.pin && base ? opts.pin(base, p) : { x: p.x, y: p.y }
    }),
  )
  return { strips, tops }
}
