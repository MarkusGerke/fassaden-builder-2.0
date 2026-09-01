import type { WebGLRenderer } from 'three'

let root: HTMLDivElement | null = null
let enabled = false
let frameMs = 0
let frameCount = 0
let accumMs = 0

export function isPerfOverlayEnabled(): boolean {
  return enabled
}

export function setPerfOverlayEnabled(on: boolean): void {
  enabled = on
  if (!root) {
    root = document.createElement('div')
    root.id = 'perf-overlay'
    root.hidden = true
    Object.assign(root.style, {
      position: 'fixed',
      bottom: '8px',
      right: '8px',
      zIndex: '9999',
      font: '11px/1.4 ui-monospace, monospace',
      color: '#e8e8e8',
      background: 'rgba(0,0,0,0.72)',
      padding: '6px 8px',
      borderRadius: '4px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    })
    document.body.appendChild(root)
  }
  root.hidden = !on
  if (!on) root.textContent = ''
}

export function markPerfFrameStart(): number {
  return performance.now()
}

export function markPerfFrameEnd(t0: number, renderer: WebGLRenderer): void {
  if (!enabled || !root) return
  const dt = performance.now() - t0
  frameCount += 1
  accumMs += dt
  if (frameCount < 10) return
  frameMs = accumMs / frameCount
  frameCount = 0
  accumMs = 0
  const info = renderer.info.render
  root.textContent = [
    `ms/frame  ${frameMs.toFixed(1)}`,
    `calls     ${info.calls}`,
    `tris      ${info.triangles.toLocaleString('de-DE')}`,
    `lines     ${info.lines}`,
    `points    ${info.points}`,
  ].join('\n')
  renderer.info.reset()
}
