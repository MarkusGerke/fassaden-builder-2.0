import type { WebGLRenderer } from 'three'

const PLACEHOLDER = 'Performance-Debug\nWarte auf Render-Frames…'

let root: HTMLDivElement | null = null
let enabled = false
let frameMs = 0
let lastSampleAt = 0

function perfHost(): HTMLElement {
  return document.querySelector<HTMLElement>('#viewport-stage') ?? document.body
}

function ensureRoot(): HTMLDivElement {
  if (root) return root
  root = document.createElement('div')
  root.id = 'perf-overlay'
  root.setAttribute('aria-live', 'polite')
  root.hidden = true
  perfHost().appendChild(root)
  return root
}

export function isPerfOverlayEnabled(): boolean {
  return enabled
}

export function setPerfOverlayEnabled(on: boolean): void {
  enabled = on
  const el = ensureRoot()
  el.hidden = !on
  el.textContent = on ? PLACEHOLDER : ''
}

export function markPerfFrameStart(): number {
  return performance.now()
}

export function markPerfFrameEnd(t0: number, renderer: WebGLRenderer): void {
  if (!enabled) return
  const el = ensureRoot()
  const dt = performance.now() - t0
  // Leicht geglättet — reagiert schneller als 10-Frame-Block.
  frameMs = frameMs > 0 ? frameMs * 0.82 + dt * 0.18 : dt
  const now = performance.now()
  if (now - lastSampleAt < 80 && el.textContent !== PLACEHOLDER) return
  lastSampleAt = now
  const info = renderer.info.render
  const fps = frameMs > 0 ? 1000 / frameMs : 0
  el.textContent = [
    'Performance-Debug',
    `FPS       ${fps.toFixed(0)}  (${frameMs.toFixed(1)} ms)`,
    `DrawCalls ${info.calls}`,
    `Dreiecke  ${info.triangles.toLocaleString('de-DE')}`,
    `Linien    ${info.lines.toLocaleString('de-DE')}`,
    `Punkte    ${info.points.toLocaleString('de-DE')}`,
  ].join('\n')
  renderer.info.reset()
}
