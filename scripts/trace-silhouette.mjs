#!/usr/bin/env node
/**
 * Traces left edge of a black silhouette PNG → ProfileSectionPoint[] (cm scale).
 * Usage: node scripts/trace-silhouette.mjs <png> [targetHeightCm] [targetDepthCm]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PNG } from 'pngjs'

const pngPath = process.argv[2]
const targetH = Number(process.argv[3] ?? 32)
const targetD = Number(process.argv[4] ?? 8)
if (!pngPath) {
  console.error('Usage: node scripts/trace-silhouette.mjs <png> [heightCm] [depthCm]')
  process.exit(1)
}

const buf = readFileSync(pngPath)
const png = PNG.sync.read(buf)
const { width, height, data } = png

function opaque(x, y) {
  const i = (y * width + x) * 4
  return data[i + 3] > 128 && data[i] < 200
}

// Find bounding box of silhouette
let minX = width, maxX = 0, minY = height, maxY = 0
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    if (opaque(x, y)) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
}

const spanY = maxY - minY || 1
const spanX = maxX - minX || 1

// Sample left outline: for each row, leftmost opaque pixel
const raw = []
for (let y = minY; y <= maxY; y++) {
  let lx = maxX
  for (let x = minX; x <= maxX; x++) {
    if (opaque(x, y)) {
      lx = x
      break
    }
  }
  if (lx <= maxX) raw.push({ px: lx - minX, py: y - minY })
}

// Douglas-Peucker simplification
function dist(a, b, p) {
  const dx = b.px - a.px
  const dy = b.py - a.py
  if (dx === 0 && dy === 0) return Math.hypot(p.px - a.px, p.py - a.py)
  const t = ((p.px - a.px) * dx + (p.py - a.py) * dy) / (dx * dx + dy * dy)
  const tx = a.px + t * dx
  const ty = a.py + t * dy
  return Math.hypot(p.px - tx, p.py - ty)
}

function simplify(pts, eps) {
  if (pts.length <= 2) return pts
  let maxD = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(pts[0], pts[pts.length - 1], pts[i])
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > eps) {
    const left = simplify(pts.slice(0, idx + 1), eps)
    const right = simplify(pts.slice(idx), eps)
    return [...left.slice(0, -1), ...right]
  }
  return [pts[0], pts[pts.length - 1]]
}

const simplified = simplify(raw, Math.max(spanY, spanX) * 0.008)

// Map: SVG top = outward max, bottom = 0; forward = depth from wall
const points = simplified.map(({ px, py }) => {
  const outward = ((spanY - py) / spanY) * targetH
  const forward = (px / spanX) * targetD
  return {
    outward: Math.round(outward * 100) / 100,
    forward: Math.round(forward * 100) / 100,
  }
})

// Close at wall
if (points.length > 0) {
  const top = points[0]
  const bottom = points[points.length - 1]
  if (top.forward > 0.01) points.unshift({ outward: top.outward, forward: 0 })
  if (bottom.forward > 0.01) points.push({ outward: bottom.outward, forward: 0 })
  points.push({ outward: 0, forward: 0 })
}

const lines = points.map(
  (p) => `  { outward: ${p.outward}, forward: ${p.forward} },`,
)
const out = `export const SOCKELPROFIL_SECTION: ProfileSectionPoint[] = [\n${lines.join('\n')}\n]\n`
console.log(out)
writeFileSync('scripts/.sockel-section.txt', out)
