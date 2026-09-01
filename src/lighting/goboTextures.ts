/**
 * Prozedurale Gobo-Texturen für Baum/Blatt- und Wolkenschatten.
 * Jede Funktion erzeugt ein CanvasTexture – weiß = lässt Licht durch, schwarz = wirft Schatten.
 * Die Textur wird als alphaMap auf einem MeshBasicMaterial mit colorWrite:false verwendet,
 * das Mesh ist unsichtbar (no color output) aber wirft Schatten via Shadow-Map.
 */
import * as THREE from 'three'

const SIZE = 512

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  return { canvas, ctx }
}

/** Füllt den Hintergrund mit weiß (transparent = kein Schatten). */
function clearWhite(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIZE, SIZE)
}

/** Malt einen Blob (unregelmäßige Ellipse). */
function blob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points = 12,
  jitter = 0.3,
  color = '#000000',
) {
  ctx.beginPath()
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2
    const r = 1 + (Math.random() - 0.5) * jitter * 2
    const x = cx + Math.cos(angle) * rx * r
    const y = cy + Math.sin(angle) * ry * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

// ─── Preset: Laubbaum ────────────────────────────────────────────────────────

function drawTree(ctx: CanvasRenderingContext2D, seed: number) {
  // deterministischer Pseudozufall
  let r = seed
  const rng = () => { r = (r * 16807 + 0) % 2147483647; return (r - 1) / 2147483646 }

  // Stamm
  const trunkW = SIZE * 0.07
  const trunkH = SIZE * 0.38
  const trunkX = SIZE / 2 - trunkW / 2
  const trunkY = SIZE * 0.6
  ctx.fillStyle = '#222222'
  ctx.fillRect(trunkX, trunkY, trunkW, trunkH)

  // Hauptkrone
  const crownCX = SIZE / 2
  const crownCY = SIZE * 0.4
  blob(ctx, crownCX, crownCY, SIZE * 0.33, SIZE * 0.28, 14, 0.4)
  // Nebenkronen
  for (let i = 0; i < 6; i++) {
    const angle = rng() * Math.PI * 2
    const dist = rng() * SIZE * 0.15 + SIZE * 0.08
    blob(ctx, crownCX + Math.cos(angle) * dist, crownCY + Math.sin(angle) * dist,
      SIZE * (0.1 + rng() * 0.14), SIZE * (0.08 + rng() * 0.12), 10, 0.45)
  }
  // Lichtlöcher
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 30; i++) {
    const lx = SIZE * 0.15 + rng() * SIZE * 0.7
    const ly = SIZE * 0.1 + rng() * SIZE * 0.55
    const lr = SIZE * (0.01 + rng() * 0.03)
    ctx.beginPath()
    ctx.arc(lx, ly, lr, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── Preset: Blätter/Gestrüpp ─────────────────────────────────────────────

function drawLeaves(ctx: CanvasRenderingContext2D, seed: number) {
  let r = seed + 999
  const rng = () => { r = (r * 16807 + 0) % 2147483647; return (r - 1) / 2147483646 }

  // Viele unregelmäßige Blobs
  for (let i = 0; i < 40; i++) {
    const cx = rng() * SIZE
    const cy = rng() * SIZE
    const rx = SIZE * (0.04 + rng() * 0.1)
    const ry = SIZE * (0.03 + rng() * 0.08)
    blob(ctx, cx, cy, rx, ry, 8, 0.5, '#111111')
  }
  // Stiele
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 3
  for (let i = 0; i < 20; i++) {
    const x1 = rng() * SIZE
    const y1 = rng() * SIZE
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x1 + (rng() - 0.5) * 40, y1 + (rng() - 0.5) * 40)
    ctx.stroke()
  }
  // Löcher
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 50; i++) {
    const lx = rng() * SIZE
    const ly = rng() * SIZE
    const lr = SIZE * (0.005 + rng() * 0.025)
    ctx.beginPath()
    ctx.arc(lx, ly, lr, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── Preset: Wolken ───────────────────────────────────────────────────────────

function drawClouds(ctx: CanvasRenderingContext2D, seed: number) {
  let r = seed + 42
  const rng = () => { r = (r * 16807 + 0) % 2147483647; return (r - 1) / 2147483646 }

  // Weiche Wolkenmassen mit radialen Gradienten
  ctx.fillStyle = '#000000'
  for (let c = 0; c < 4; c++) {
    const cx = (0.15 + rng() * 0.7) * SIZE
    const cy = (0.2 + rng() * 0.6) * SIZE
    const numBlobs = 4 + Math.floor(rng() * 5)
    for (let b = 0; b < numBlobs; b++) {
      const bx = cx + (rng() - 0.5) * SIZE * 0.3
      const by = cy + (rng() - 0.5) * SIZE * 0.15
      const br = SIZE * (0.06 + rng() * 0.1)
      ctx.beginPath()
      ctx.arc(bx, by, br, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Aufhellungsmaske: Rand der Wolke bleibt dunkler, innen heller
  ctx.globalCompositeOperation = 'destination-out'
  for (let c = 0; c < 4; c++) {
    const cx = (0.15 + rng() * 0.7) * SIZE
    const cy = (0.2 + rng() * 0.6) * SIZE
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, SIZE * 0.12)
    grad.addColorStop(0, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, SIZE * 0.22, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
}

// ─── Preset: Jalousie / Lamellen ─────────────────────────────────────────────

function drawBlinds(ctx: CanvasRenderingContext2D, angle = 30) {
  ctx.fillStyle = '#111111'
  const spacing = SIZE * 0.12
  const width = SIZE * 0.07
  const rad = (angle * Math.PI) / 180
  const step = spacing / Math.cos(rad)
  for (let i = -2; i < SIZE / step + 2; i++) {
    const y0 = i * step
    ctx.save()
    ctx.translate(0, y0)
    ctx.transform(1, 0, Math.tan(rad), 1, 0, 0)
    ctx.fillRect(0, 0, SIZE, width)
    ctx.restore()
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type GoboPreset = 'tree' | 'leaves' | 'clouds' | 'blinds'

export const GOBO_PRESETS: { id: GoboPreset; label: string }[] = [
  { id: 'tree', label: 'Baum' },
  { id: 'leaves', label: 'Blätter' },
  { id: 'clouds', label: 'Wolken' },
  { id: 'blinds', label: 'Jalousie' },
]

const cache = new Map<string, THREE.CanvasTexture>()

export function createGoboTexture(preset: GoboPreset, seed = 1): THREE.CanvasTexture {
  const key = `${preset}:${seed}`
  const cached = cache.get(key)
  if (cached) return cached

  const { canvas, ctx } = makeCanvas()
  clearWhite(ctx)

  switch (preset) {
    case 'tree':
      drawTree(ctx, seed)
      break
    case 'leaves':
      drawLeaves(ctx, seed)
      break
    case 'clouds':
      drawClouds(ctx, seed)
      break
    case 'blinds':
      drawBlinds(ctx, 30)
      break
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  cache.set(key, tex)
  return tex
}

export function disposeGoboTextures() {
  for (const tex of cache.values()) tex.dispose()
  cache.clear()
}
