/**
 * Radiale Rustika-/Quaderlagen am Bogen (v2.0.78).
 *
 * Horizontale Strip-/Verband-Schichten bleiben außen gerade; ab einem Knickpunkt
 * (~ Laibung ± Überstand) laufen die Lagerfugen radial zum Bogen-Kämpferzentrum —
 * trapez-/keilförmige Quader, die den Bogen umschließen. Primär für Rundbogen
 * (Referenzfoto); greift auch bei anderen Bogenformen (Tudor/Stich), damit
 * Strip-Fassaden nicht mit kaputten Clip-Resten enden.
 *
 * Kein schwebendes Trapezfeld über dem Scheitel (`Opening.taperedField` ist ein
 * anderes, optionales Feature).
 */
import type { Opening, StudioPanelConfig } from '../types/facade'
import {
  archHybridCourseYs,
  openingArchGeom,
  openingArchOutline,
  openingMasonryRect,
  normalizeOpeningArch,
  openingArchVoussoirsEnabled,
  type OpeningPoly,
} from '../utils/openingGeometry'

/** Abstand Knick außerhalb der Laibung (cm), Fallback wenn nicht gesetzt. */
export const DEFAULT_ARCH_RUSTICATION_KNUCKLE_CM = 8
/** Extra Schichten über Scheitel, die noch radial staffeln. */
export const ARCH_RUSTICATION_COURSES_ABOVE_CROWN = 1
const MIN_POLY_AREA = 10
const ARC_SEGS = 8

export interface ArchRusticationOpts {
  panelHeight: number
  panelWidth: number
  joint?: number
  /** Abstand Knick außerhalb Laibung (cm). Default aus panelHeight. */
  knuckleOffsetCm?: number
  /**
   * Scheitel-Keilsteine (1–3) wenn Voussoir an.
   * Ohne Voussoir: 1 schließender Scheitelstein (kein Loch).
   */
  crownKeystones?: number
}

/** Gemeinsame Bogen-Basis für Round (Kreis) und andere Formen (Kronen-Polyline). */
export interface RusticationGeom {
  cx: number
  /** Kämpfer-Y / Radialzentrum. */
  cy: number
  /** Näherungsradius (Stich / Halbbreite). */
  r: number
  x0: number
  x1: number
  springY: number
  apexY: number
  /** Kronen-Polyline Kämpfer links → Scheitel → Kämpfer rechts. */
  crown: { x: number; y: number }[]
}

export function defaultKnuckleOffsetCm(panel: Pick<StudioPanelConfig, 'panelHeight' | 'panelWidth'>): number {
  const fromH = Math.round((panel.panelHeight || 16) * 0.5)
  const fromW = Math.round((panel.panelWidth || 32) * 0.2)
  return Math.max(DEFAULT_ARCH_RUSTICATION_KNUCKLE_CM, Math.min(48, Math.max(fromH, fromW)))
}

/**
 * Aktiv bei Bogenöffnung (nicht eckig) + Strip oder Verband (nicht `none`).
 * Unabhängig vom Keilstein-Ring — der steuert nur optionale Scheitel-Keilsteine.
 *
 * **v2.0.79:** Standardmäßig **aus**. Die Auto-Rustika (v2.0.78) hat Spandrillen
 * ausgestanzt und mit fehlerhaften Polygonen gefüllt (graue Treppenlöcher,
 * schwebende Fächer). Generator bleibt für die nächste Iteration; Einbindung
 * erst wieder mit explizitem Opt-in (`Opening.archRustication?.enabled`).
 */
export function openingArchRusticationEnabled(
  opening: Opening,
  panelPattern?: string | null,
): boolean {
  if (!opening.archRustication?.enabled) return false
  const form = normalizeOpeningArch(opening.arch).form
  if (form === 'rect') return false
  if (!buildRusticationGeom(opening)) return false
  if (panelPattern == null || panelPattern === '' || panelPattern === 'none') return false
  return true
}

/** True wenn Intrados-Kreis-Clip möglich (nur Rundbogen). */
export function openingArchRusticationUsesCircleClip(opening: Opening): boolean {
  return normalizeOpeningArch(opening.arch).form === 'round' && Boolean(openingArchGeom(opening))
}

export function buildRusticationGeom(opening: Opening, inflate = 0): RusticationGeom | null {
  const round = openingArchGeom(opening, inflate)
  if (round) {
    const crown: { x: number; y: number }[] = []
    for (let s = 0; s <= 48; s += 1) {
      const t = Math.PI - (Math.PI * s) / 48
      crown.push({
        x: round.cx + Math.cos(t) * round.r,
        y: round.cy + Math.sin(t) * round.r,
      })
    }
    return {
      cx: round.cx,
      cy: round.cy,
      r: round.r,
      x0: round.x0,
      x1: round.x1,
      springY: round.cy,
      apexY: round.cy + round.r,
      crown,
    }
  }
  const outline = openingArchOutline(opening, inflate)
  if (!outline || outline.length < 3) return null
  const masonry = openingMasonryRect(opening, inflate)
  const springY = outline[0]!.y
  let apexY = outline[0]!.y
  for (const p of outline) if (p.y > apexY) apexY = p.y
  const rise = Math.max(1, apexY - springY)
  return {
    cx: masonry.x + masonry.width / 2,
    cy: springY,
    r: rise,
    x0: masonry.x,
    x1: masonry.x + masonry.width,
    springY,
    apexY,
    crown: outline,
  }
}

export function archRusticationKnuckles(
  geom: Pick<RusticationGeom, 'x0' | 'x1'>,
  knuckleOffsetCm: number,
): { left: number; right: number } {
  const pad = Math.max(0, knuckleOffsetCm)
  return {
    left: geom.x0 - pad,
    right: geom.x1 + pad,
  }
}

function outlineBounds(pts: { x: number; y: number }[]): { x: number; y: number; width: number; height: number } {
  let x0 = pts[0]!.x
  let x1 = pts[0]!.x
  let y0 = pts[0]!.y
  let y1 = pts[0]!.y
  for (const p of pts) {
    if (p.x < x0) x0 = p.x
    if (p.x > x1) x1 = p.x
    if (p.y < y0) y0 = p.y
    if (p.y > y1) y1 = p.y
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

function pushPt(out: { x: number; y: number }[], p: { x: number; y: number }) {
  const last = out[out.length - 1]
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.04) out.push(p)
}

/** Schnitt Strahl Zentrum → (px,py) mit Kronen-Polyline (erster Treffer ab Zentrum). */
function rayHitCrown(
  geom: RusticationGeom,
  px: number,
  py: number,
): { x: number; y: number; theta: number } | null {
  const dx = px - geom.cx
  const dy = py - geom.cy
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return null
  const theta = Math.atan2(dy, dx)
  if (theta < -0.05 || theta > Math.PI + 0.05) return null
  const ux = dx / len
  const uy = dy / len

  let bestT = Infinity
  let best: { x: number; y: number } | null = null
  for (let i = 0; i < geom.crown.length - 1; i += 1) {
    const a = geom.crown[i]!
    const b = geom.crown[i + 1]!
    const ex = b.x - a.x
    const ey = b.y - a.y
    const denom = ux * ey - uy * ex
    if (Math.abs(denom) < 1e-9) continue
    const qx = a.x - geom.cx
    const qy = a.y - geom.cy
    const t = (qx * ey - qy * ex) / denom
    const u = (qx * uy - qy * ux) / denom
    if (t > 0.5 && t < bestT && u >= -0.02 && u <= 1.02) {
      bestT = t
      best = { x: geom.cx + ux * t, y: geom.cy + uy * t }
    }
  }
  if (!best) {
    // Fallback: Kreisnäherung
    return {
      x: geom.cx + Math.cos(theta) * geom.r,
      y: geom.cy + Math.sin(theta) * geom.r,
      theta,
    }
  }
  return { ...best, theta }
}

/** Kronen-Punkte zwischen zwei Winkeln (inkl.). */
function crownArcBetween(
  geom: RusticationGeom,
  theta0: number,
  theta1: number,
): { x: number; y: number }[] {
  const lo = Math.min(theta0, theta1)
  const hi = Math.max(theta0, theta1)
  const pts: { x: number; y: number }[] = []
  for (const p of geom.crown) {
    const t = Math.atan2(p.y - geom.cy, p.x - geom.cx)
    if (t >= lo - 0.02 && t <= hi + 0.02) pts.push(p)
  }
  if (pts.length < 2) {
    for (let s = 0; s <= ARC_SEGS; s += 1) {
      const t = theta0 + ((theta1 - theta0) * s) / ARC_SEGS
      const hit = rayHitCrown(geom, geom.cx + Math.cos(t) * geom.r * 2, geom.cy + Math.sin(t) * geom.r * 2)
      if (hit) pts.push({ x: hit.x, y: hit.y })
    }
  }
  // Richtung theta0 → theta1
  pts.sort((a, b) => {
    const ta = Math.atan2(a.y - geom.cy, a.x - geom.cx)
    const tb = Math.atan2(b.y - geom.cy, b.x - geom.cx)
    return theta0 <= theta1 ? ta - tb : tb - ta
  })
  return pts
}

function polyArea(outline: { x: number; y: number }[]): number {
  let area = 0
  for (let i = 0; i < outline.length; i += 1) {
    const j = (i + 1) % outline.length
    area += outline[i]!.x * outline[j]!.y - outline[j]!.x * outline[i]!.y
  }
  return Math.abs(area) * 0.5
}

function finalizePoly(
  outline: { x: number; y: number }[],
  geom: RusticationGeom,
  t0: number,
  t1: number,
  rOuterHint: number,
): OpeningPoly | null {
  if (outline.length < 3) return null
  const b = outlineBounds(outline)
  if (b.width < 1.2 || b.height < 1.0) return null
  const area = polyArea(outline)
  if (area < MIN_POLY_AREA) return null
  if (area / (b.width * b.height + 1e-6) < 0.12) return null
  return {
    ...b,
    outline,
    polar: {
      cx: geom.cx,
      cy: geom.cy,
      rInner: geom.r * 0.98,
      rOuter: Math.max(rOuterHint, geom.r + 1),
      t0,
      t1,
    },
  }
}

/**
 * Ein Seiten-Quader: vertikal am Knick, innen Bogenkrone, Lagerfugen radial.
 */
export function rusticatedSideCoursePoly(
  geom: RusticationGeom,
  side: 'left' | 'right',
  y0: number,
  y1: number,
  knuckleX: number,
): OpeningPoly | null {
  if (y1 - y0 < 1.2) return null
  const springY = geom.springY
  const crownY = geom.apexY
  if (y1 <= springY + 0.3) return null
  if (y0 >= crownY + (y1 - y0) * 1.2) return null

  const bandY0 = Math.max(y0, springY)
  const bandY1 = y1
  if (bandY1 - bandY0 < 1.2) return null

  const knickBot = { x: knuckleX, y: bandY0 }
  const knickTop = { x: knuckleX, y: bandY1 }

  const knickR = Math.hypot(knuckleX - geom.cx, (bandY0 + bandY1) * 0.5 - geom.cy)
  if (knickR <= geom.r * 0.85) return null

  const hitBot = rayHitCrown(geom, knickBot.x, knickBot.y)
  const hitTop = rayHitCrown(geom, knickTop.x, knickTop.y)
  if (!hitBot || !hitTop) return null

  if (side === 'left' && (hitBot.x > geom.cx + 0.5 || hitTop.x > geom.cx + 0.5)) return null
  if (side === 'right' && (hitBot.x < geom.cx - 0.5 || hitTop.x < geom.cx - 0.5)) return null

  const thetaBot = hitBot.theta
  const thetaTop = hitTop.theta
  const arc = crownArcBetween(geom, thetaBot, thetaTop)

  const outline: { x: number; y: number }[] = []
  pushPt(outline, knickBot)
  pushPt(outline, { x: hitBot.x, y: hitBot.y })
  for (const p of arc) pushPt(outline, p)
  pushPt(outline, { x: hitTop.x, y: hitTop.y })
  pushPt(outline, knickTop)

  const rOuter = Math.max(
    Math.hypot(knickBot.x - geom.cx, knickBot.y - geom.cy),
    Math.hypot(knickTop.x - geom.cx, knickTop.y - geom.cy),
  )
  return finalizePoly(outline, geom, Math.min(thetaBot, thetaTop), Math.max(thetaBot, thetaTop), rOuter)
}

/**
 * Scheitel-Keilstein(e): radial von der Krone nur bis ca. eine Schichthöhe darüber
 * (nicht bis Knick-Radius — sonst wirkt es wie ein schwebendes Trapezfeld).
 */
export function rusticatedCrownKeystonePolys(
  geom: RusticationGeom,
  knuckle: { left: number; right: number },
  count: number,
  courseTopY?: number,
  panelHeight = 16,
): OpeningPoly[] {
  const n = Math.max(1, Math.min(3, Math.round(count)))
  const crownY = geom.apexY
  const ph = Math.max(4, panelHeight)
  void knuckle
  const rOuter = Math.max(
    geom.r + ph * 0.55,
    (courseTopY != null ? courseTopY : crownY + ph * 0.45) - geom.cy,
  )

  const halfSpan = Math.min(0.28, Math.atan2(ph * 0.85, Math.max(geom.r, 1)))
  const span = halfSpan * 2 * (n === 1 ? 1 : 1.15)
  const tMid = Math.PI / 2
  const t0 = tMid - span / 2
  const t1 = tMid + span / 2
  const jointGap = 0.01

  const out: OpeningPoly[] = []
  for (let i = 0; i < n; i += 1) {
    const a0 = t0 + ((t1 - t0) * i) / n + (i > 0 ? jointGap * 0.5 : 0)
    const a1 = t0 + ((t1 - t0) * (i + 1)) / n - (i < n - 1 ? jointGap * 0.5 : 0)
    if (a1 - a0 < 0.03) continue
    const outline: { x: number; y: number }[] = []
    for (let s = 0; s <= ARC_SEGS; s += 1) {
      const t = a0 + ((a1 - a0) * s) / ARC_SEGS
      const hit = rayHitCrown(geom, geom.cx + Math.cos(t) * geom.r * 2, geom.cy + Math.sin(t) * geom.r * 2)
      if (hit) pushPt(outline, { x: hit.x, y: hit.y })
    }
    for (let s = ARC_SEGS; s >= 0; s -= 1) {
      const t = a0 + ((a1 - a0) * s) / ARC_SEGS
      pushPt(outline, {
        x: geom.cx + Math.cos(t) * rOuter,
        y: geom.cy + Math.sin(t) * rOuter,
      })
    }
    const poly = finalizePoly(outline, geom, a0, a1, rOuter)
    if (poly) out.push(poly)
  }
  return out
}

/**
 * Alle radialen Quaderlagen + optional Scheitelsteine für eine Öffnung.
 */
export function archRusticatedCoursePolys(
  opening: Opening,
  courseYs: number[],
  opts: ArchRusticationOpts,
): OpeningPoly[] {
  const geom = buildRusticationGeom(opening)
  if (!geom) return []
  const panelH = Math.max(4, opts.panelHeight)
  const knuckleOff = opts.knuckleOffsetCm ?? defaultKnuckleOffsetCm({
    panelHeight: panelH,
    panelWidth: opts.panelWidth,
  })
  const knuckle = archRusticationKnuckles(geom, knuckleOff)
  const springY = geom.springY
  const crownY = geom.apexY
  const top = crownY + panelH * (ARCH_RUSTICATION_COURSES_ABOVE_CROWN + 0.5)

  const courses =
    courseYs.length > 0
      ? [...courseYs].sort((a, b) => a - b)
      : archHybridCourseYs([], springY, top, panelH)

  const bands: { y0: number; y1: number }[] = []
  for (let i = 0; i < courses.length - 1; i += 1) {
    const y0 = courses[i]!
    const y1 = courses[i + 1]!
    if (y1 - y0 < 1) continue
    if (y1 <= springY + 0.3) continue
    if (y0 >= top) continue
    bands.push({ y0, y1 })
  }
  if (bands.length === 0) {
    bands.push({ y0: springY, y1: Math.min(top, springY + panelH) })
  }

  const voussoirsOn = openingArchVoussoirsEnabled(opening)
  const crownCount = voussoirsOn
    ? Math.max(1, Math.min(3, opts.crownKeystones ?? 1))
    : 1

  // Kleiner Scheitel-Sektor freilassen; Seitensteine dürfen nah an den Scheitel reichen.
  const crownHalf = Math.min(0.22, Math.atan2(panelH * 0.7, Math.max(geom.r, 1))) + 0.02
  const crownT0 = Math.PI / 2 - crownHalf
  const crownT1 = Math.PI / 2 + crownHalf

  const out: OpeningPoly[] = []
  let maxSideTop = crownY

  for (const band of bands) {
    const left = rusticatedSideCoursePoly(geom, 'left', band.y0, band.y1, knuckle.left)
    const right = rusticatedSideCoursePoly(geom, 'right', band.y0, band.y1, knuckle.right)

    const trimSide = (poly: OpeningPoly | null): OpeningPoly | null => {
      if (!poly?.polar) return poly
      const midT = (poly.polar.t0 + poly.polar.t1) * 0.5
      if (midT >= crownT0 && midT <= crownT1) return null
      return poly
    }

    const L = trimSide(left)
    const R = trimSide(right)
    if (L) {
      out.push(L)
      maxSideTop = Math.max(maxSideTop, L.y + L.height)
    }
    if (R) {
      out.push(R)
      maxSideTop = Math.max(maxSideTop, R.y + R.height)
    }
  }

  const crownTop = Math.min(crownY + panelH * 0.55, Math.max(maxSideTop, crownY + panelH * 0.35))
  out.push(
    ...rusticatedCrownKeystonePolys(geom, knuckle, crownCount, crownTop, panelH),
  )
  return out
}

/** Max. Radius der erzeugten Polys (für Sektor-Filter). */
export function rusticationSectorRMax(geom: RusticationGeom, polys: OpeningPoly[]): number {
  let rMax = geom.r + 4
  for (const p of polys) {
    for (const pt of p.outline ?? []) {
      rMax = Math.max(rMax, Math.hypot(pt.x - geom.cx, pt.y - geom.cy))
    }
    if (p.polar) rMax = Math.max(rMax, p.polar.rOuter)
  }
  return rMax
}

/**
 * Kartesische Reste im Spandrillen-/Radialbereich entfernen
 * (zwischen Knick-Linien, Kämpfer → Scheitel + Puffer).
 */
export function cartesianPartOverlapsRusticationZone(
  part: OpeningPoly,
  geom: RusticationGeom,
  knuckle: { left: number; right: number },
  rMax: number,
): boolean {
  // Nur Kämpfer → knapp über Scheitel — darüber bleibt der horizontale Verband.
  const yLo = geom.springY - 0.5
  const yHi = geom.apexY + Math.max(6, Math.min(24, (rMax - geom.r) * 0.25))
  const samples = [
    { x: part.x + part.width * 0.5, y: part.y + part.height * 0.5 },
    { x: part.x + part.width * 0.25, y: part.y + part.height * 0.5 },
    { x: part.x + part.width * 0.75, y: part.y + part.height * 0.5 },
    { x: part.x + part.width * 0.5, y: part.y + part.height * 0.25 },
    { x: part.x + part.width * 0.5, y: part.y + part.height * 0.75 },
  ]
  for (const p of samples) {
    if (p.y < yLo || p.y > yHi) continue
    if (p.x < knuckle.left - 0.5 || p.x > knuckle.right + 0.5) continue
    const dx = p.x - geom.cx
    const dy = p.y - geom.cy
    if (dy < -0.5) continue
    const r = Math.hypot(dx, dy)
    // Nur im Bogen-nahen Band (nicht die ganze Knick-Bucht bis rMax weit außen oben)
    const localRMax = Math.min(rMax, geom.r + Math.max(8, (knuckle.right - knuckle.left) * 0.15))
    if (r < geom.r * 0.85) continue
    if (r > localRMax + 1) continue
    const theta = Math.atan2(dy, dx)
    if (theta >= -0.08 && theta <= Math.PI + 0.08) return true
  }
  if (part.bottomArc?.length || part.topArc?.length) {
    const py1 = part.y + part.height
    if (part.y < yHi && py1 > yLo) {
      const mx = part.x + part.width * 0.5
      if (mx >= knuckle.left - 1 && mx <= knuckle.right + 1) return true
    }
  }
  return false
}
