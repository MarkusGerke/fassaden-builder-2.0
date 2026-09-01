import type { ProfileSectionPoint } from './types'
import type { ProfileDefinition } from './types'
import { renderTrimBand } from './windowTrim'

/** Vertex of a custom 2D profile. x = outward (mm), y = forward (mm). */
export interface ProfileVertex {
  xMm: number
  yMm: number
  radiusMm?: number
  invert?: boolean
}

export interface CustomProfileDef {
  id: string
  label: string
  vertices: ProfileVertex[]
}

const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const
const DEFAULT_FILLET_MM = 20
const ARC_STEP_DEG = 8

export function mmToCm(mm: number): number {
  return mm / 10
}

export function cmToMm(cm: number): number {
  return cm * 10
}

export function snapSegmentToOctant(
  from: ProfileVertex,
  toX: number,
  toY: number,
): { xMm: number; yMm: number } {
  const dx = toX - from.xMm
  const dy = toY - from.yMm
  const len = Math.hypot(dx, dy)
  if (len < 0.5) return { xMm: from.xMm, yMm: from.yMm }
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
  let best: (typeof SNAP_ANGLES)[number] = SNAP_ANGLES[0]
  let bestDiff = 360
  for (const a of SNAP_ANGLES) {
    const d = Math.min(Math.abs(deg - a), 360 - Math.abs(deg - a))
    if (d < bestDiff) {
      bestDiff = d
      best = a
    }
  }
  const rad = (best * Math.PI) / 180
  const snappedLen = Math.max(1, Math.round(len))
  return {
    xMm: from.xMm + Math.cos(rad) * snappedLen,
    yMm: from.yMm + Math.sin(rad) * snappedLen,
  }
}

function sub(a: ProfileVertex, b: ProfileVertex): { x: number; y: number } {
  return { x: a.xMm - b.xMm, y: a.yMm - b.yMm }
}

function norm(a: { x: number; y: number }) {
  const l = Math.hypot(a.x, a.y)
  if (l < 1e-6) return { x: 0, y: 0 }
  return { x: a.x / l, y: a.y / l }
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.x + a.y * b.y
}

function cross(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.y - a.y * b.x
}

function reflectAcrossSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  const ab = { x: b.x - a.x, y: b.y - a.y }
  const ap = { x: p.x - a.x, y: p.y - a.y }
  const ab2 = ab.x * ab.x + ab.y * ab.y
  if (ab2 < 1e-8) return p
  const t = (ap.x * ab.x + ap.y * ab.y) / ab2
  const proj = { x: a.x + ab.x * t, y: a.y + ab.y * t }
  return { x: 2 * proj.x - p.x, y: 2 * proj.y - p.y }
}

function filletArc(
  prev: ProfileVertex,
  curr: ProfileVertex,
  next: ProfileVertex,
  radiusMm: number,
  invert: boolean,
): { x: number; y: number }[] {
  const v1 = norm(sub(prev, curr))
  const v2 = norm(sub(next, curr))
  const cosA = Math.max(-1, Math.min(1, dot(v1, v2)))
  const angle = Math.acos(cosA)
  if (angle < 0.05 || angle > Math.PI - 0.05) return [{ x: curr.xMm, y: curr.yMm }]
  const half = angle / 2
  const dist = radiusMm / Math.tan(half)
  const maxDist = Math.min(Math.hypot(prev.xMm - curr.xMm, prev.yMm - curr.yMm), Math.hypot(next.xMm - curr.xMm, next.yMm - curr.yMm)) * 0.45
  const d = Math.min(dist, Math.max(1, maxDist))
  const t1 = { x: curr.xMm + v1.x * d, y: curr.yMm + v1.y * d }
  const t2 = { x: curr.xMm + v2.x * d, y: curr.yMm + v2.y * d }
  const n1 = { x: -v1.y, y: v1.x }
  const turn = cross(v1, v2) < 0 ? 1 : -1
  let center = { x: t1.x + n1.x * radiusMm * turn, y: t1.y + n1.y * radiusMm * turn }
  const a0 = Math.atan2(t1.y - center.y, t1.x - center.x)
  const a1 = Math.atan2(t2.y - center.y, t2.x - center.x)
  let delta = a1 - a0
  while (delta > Math.PI) delta -= Math.PI * 2
  while (delta < -Math.PI) delta += Math.PI * 2
  const steps = Math.max(3, Math.round((Math.abs(delta) * 180) / Math.PI / ARC_STEP_DEG))
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const a = a0 + delta * t
    pts.push({
      x: center.x + Math.cos(a) * radiusMm,
      y: center.y + Math.sin(a) * radiusMm,
    })
  }
  if (invert) {
    return pts.map((p) => reflectAcrossSegment(p, t1, t2))
  }
  return pts
}

export function sampleCustomSection(vertices: ProfileVertex[]): ProfileSectionPoint[] {
  if (vertices.length < 2) {
    return [
      { outward: 0, forward: 0 },
      { outward: 4, forward: 0 },
    ]
  }
  const pts: { x: number; y: number }[] = []
  pts.push({ x: vertices[0].xMm, y: vertices[0].yMm })
  for (let i = 1; i < vertices.length - 1; i += 1) {
    const r = vertices[i].radiusMm ?? 0
    if (r > 0.5) {
      pts.push(
        ...filletArc(vertices[i - 1], vertices[i], vertices[i + 1], r, Boolean(vertices[i].invert)),
      )
    } else {
      pts.push({ x: vertices[i].xMm, y: vertices[i].yMm })
    }
  }
  const last = vertices[vertices.length - 1]
  pts.push({ x: last.xMm, y: last.yMm })
  const section: ProfileSectionPoint[] = pts.map((p) => ({
    outward: mmToCm(p.x),
    forward: mmToCm(p.y),
  }))
  const minOut = Math.min(...section.map((p) => p.outward))
  const minFwd = Math.min(...section.map((p) => p.forward))
  return section.map((p) => ({ outward: p.outward - minOut, forward: p.forward - minFwd }))
}

export function cycleVertexFillet(vertex: ProfileVertex): ProfileVertex {
  const r = vertex.radiusMm ?? 0
  if (r <= 0.5) return { ...vertex, radiusMm: DEFAULT_FILLET_MM, invert: false }
  if (!vertex.invert) return { ...vertex, radiusMm: DEFAULT_FILLET_MM, invert: true }
  return { ...vertex, radiusMm: 0, invert: false }
}

export function defaultDraftVertices(): ProfileVertex[] {
  return [
    { xMm: 0, yMm: 0 },
    { xMm: 40, yMm: 0 },
    { xMm: 40, yMm: 30 },
    { xMm: 0, yMm: 30 },
  ]
}

export function customProfileToDefinition(def: CustomProfileDef): ProfileDefinition {
  const section = sampleCustomSection(def.vertices)
  const depth = Math.max(0.5, ...section.map((p) => p.outward))
  const forward = Math.max(0.5, ...section.map((p) => p.forward))
  return {
    id: def.id,
    label: def.label,
    depth,
    forward,
    tileLength: 48,
    projecting: true,
    section,
    renderEdge(parent, context) {
      renderTrimBand(parent, context, depth)
    },
  }
}
